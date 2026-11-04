// Neuroendocrine network plugin (research/ANALYSIS.md §9, A.5, §11.10–§11.13, §12.11, §12.15, §12.20
// rows 32–34, B.14, B.15 phase 6): graph build with and without the other brain plugins, rest as a
// steady state, the stressor checkpoints through scenarios.js evaluate, switch-off semantics (basal
// replacement for hormones, denervation of the adrenal medulla), brain-only freezing, the §9.9
// interventions, the RAAS and baroreceptor AVP limbs, and determinism across frame schedules.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, NET, BODY_BIT } from '../src/sim/graph.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as autonomic } from '../src/sim/autonomic.js';
import { plugin as endocrine, PARAMS, INTERVENTIONS } from '../src/sim/endocrine.js';
import { SCENARIOS, evaluate, checkpointSkip } from '../src/sim/scenarios.js';

const PLUGINS = [brainnet, sensory, endocrine];
const GRAPH = buildGraph({ plugins: PLUGINS });
const STRESS = SCENARIOS.stressor.inputs;
const HORMONES = ['acthRel', 'cortisolRel', 'adrenalineRel', 'noradrenalinePlRel', 'avpRel', 'oxytocinRel', 'raas', 'hpt', 'hpg'];

const kernel = ({ plugins = PLUGINS, graph = GRAPH, seed = 1, brain = false, nets = {} } = {}) => {
  const k = new Kernel({ graph, plugins, seed, settle: false });
  for (const [n, on] of Object.entries(nets)) k.set(`net.${n}`, on ? 1 : 0);
  if (brain) k.set('bodyMode', 0);
  k.settle({});
  return k;
};
const withStress = (k) => { k.setInputs((tH) => STRESS(tH)); return k; };
// Peak of a variable over [t0, t1] sampled each `dt` s of tH.
function trace(k, name, t1, dt = 10) {
  const out = [];
  for (let t = k.t + dt; t <= t1 + 1e-9; t += dt) { k.advanceTo(t); out.push(k.get(name)); }
  return out;
}

describe('graph (§9.1, §9.2, §11.3, §11.11)', () => {
  test('builds with brainnet, sensory and endocrine, and with brainnet alone', () => {
    for (const plugins of [PLUGINS, [brainnet, endocrine]]) {
      const g = buildGraph({ plugins });
      for (const id of ['pituitaryAnt', 'pituitaryPost', 'adrenalCortex.R', 'adrenalMedulla.L', 'acth', 'cortisol', 'adrenaline', 'avp', 'raas', 'kidney.R'])
        assert.ok(g.index.has(id), id);
      const k = new Kernel({ graph: g, plugins });
      assert.ok(k.plugin('endocrine'));
      assert.equal(k.get('cortisolRel') > 0, true);
    }
  });

  test('brain-only graph skips the body fragment', () => {
    const g = buildGraph({ plugins: PLUGINS, body: false });
    assert.equal(g.index.has('pituitaryAnt'), false);
    assert.equal(g.plugins.includes('endocrine'), false);
  });

  test('edge masks: portal and release neuroendocrine, adrenal adrenaline autonomic ∧ neuroendocrine', () => {
    const e = (a, b) => GRAPH.edges.find((x) => GRAPH.nodes[x.from].id === a && GRAPH.nodes[x.to].id === b);
    assert.equal(e('portPortal', 'pituitaryAnt').nets, NET.neuroendocrine | BODY_BIT);
    assert.equal(e('portPortal', 'pituitaryAnt').kind, 'portal');
    assert.equal(e('adrenalMedulla.R', 'adrenaline').nets, NET.autonomic | NET.neuroendocrine | BODY_BIT);
    assert.equal(e('acth', 'adrenalCortex.L').kind, 'blood');
    assert.ok(Math.abs(e('acth', 'adrenalCortex.R').delay - PARAMS.delay.pituitaryAdrenal) < 1e-9, 'pituitary → adrenal 20 s (§9.8)');
    assert.ok(e('cortisol', 'pvn.R') && e('cortisol', 'hippocampus.L') && e('cortisol', 'pituitaryAnt'), 'three feedback limbs (§9.3)');
    assert.equal(e('cortisol', 'pvn.R').sign, -1);
    assert.equal(e('adrenaline', 'pituitaryAnt').sign, 1, 'positive limb (§9.3)');
    // Optional targets of other modules are dropped, not fatal.
    assert.ok(GRAPH.dropped.some((d) => d.to === 'macrophages'));
  });
});

describe('rest (§11.6)', () => {
  test('rest is the steady state after settle', () => {
    const k = kernel();
    const s0 = Object.fromEntries(HORMONES.map((n) => [n, k.get(n)]));
    // Loop consistency at rest: ACTH = S = cortisol, CRH = C·F(S).
    assert.ok(Math.abs(s0.acthRel - s0.cortisolRel) < 1e-12 && Math.abs(k.get('en.S') - s0.cortisolRel) < 1e-12);
    for (const n of ['adrenalineRel', 'avpRel', 'oxytocinRel', 'raas', 'hpt', 'hpg', 'noradrenalinePlRel']) assert.equal(s0[n], 1, n);
    k.advanceTo(900);
    // Only the circadian envelope (procC, §3.11) moves, slowly.
    for (const n of HORMONES) assert.ok(Math.abs(k.get(n) - s0[n]) < 0.01, `${n}: ${s0[n]} → ${k.get(n)}`);
    for (const n of ['adrenalineRel', 'avpRel', 'raas']) assert.equal(k.get(n), 1, n);
    assert.equal(k.get('cortisol'), PARAMS.display.cortisol * k.get('cortisolRel'));
  });

  test('every hormone is a ratio to basal near 1 at rest; display units at their §9.9 basal', () => {
    const k = kernel();
    assert.ok(Math.abs(k.get('cortisolRel') - 1) < 0.1, String(k.get('cortisolRel')));
    assert.equal(k.get('adrenaline'), 44);
    assert.equal(k.get('avp'), 2);
  });
});

describe('§12 checkpoints of stressor (§12.11, §12.15, §12.20 rows 32–34)', () => {
  const results = evaluate('stressor', { graph: GRAPH, plugins: PLUGINS });
  for (const cp of SCENARIOS.stressor.checkpoints) {
    test(`${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`, (t) => {
      assert.equal(checkpointSkip(cp, PLUGINS.map((p) => p.id)), '');
      const r = results.find((x) => x.id === cp.id);
      t.diagnostic(`${cp.v} = ${r.value} (band ${cp.range.join('–')})`);
      assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
    });
  }

  test('two channels: adrenaline is fast (peak within the stressor), cortisol slow (peak after it)', () => {
    const k = withStress(kernel());
    const A = trace(k, 'adrenalineRel', 3600), k2 = withStress(kernel()), C = trace(k2, 'cortisolRel', 3600);
    const ia = A.indexOf(Math.max(...A)), ic = C.indexOf(Math.max(...C));
    assert.ok(Math.max(...A) > 3.5 && Math.max(...A) < 4.2, `adrenaline ×${Math.max(...A)} (§12.11 ×4.12)`);
    assert.ok((ia + 1) * 10 <= 900 && (ic + 1) * 10 > 900, `adrenaline at ${(ia + 1) * 10} s, cortisol at ${(ic + 1) * 10} s`);
    // Adrenaline t½ 2–3 min after the stressor (§9.10).
    const a900 = A[89] - 1, a1050 = A[104] - 1;
    assert.ok(a1050 / a900 > 0.4 && a1050 / a900 < 0.6, `decay over 150 s ${a1050 / a900}`);
  });

  test('with the autonomic module the command is tone.symAdr and gives the same ×4.12 profile (§12.11, §9.10)', () => {
    const plugins = [brainnet, sensory, autonomic, endocrine], graph = buildGraph({ plugins });
    const k = withStress(kernel({ plugins, graph }));
    const A = trace(k, 'adrenalineRel', 3600), ia = A.indexOf(Math.max(...A));
    assert.ok(Math.max(...A) > 3.5 && Math.max(...A) < 4.2, `adrenaline ×${Math.max(...A)} (§12.11 ×4.12)`);
    assert.ok((ia + 1) * 10 <= 900, `peak at ${(ia + 1) * 10} s`);
    const r = evaluate('stressor', { graph, plugins });
    for (const x of r) assert.equal(x.status, 'pass', `${x.id} = ${x.value}`);
  });
});

describe('switch-off semantics (A.5, §11.10, §12.14)', () => {
  test('neuroendocrine off: no ACTH, cortisol or adrenaline rise; the CRH command still rises', () => {
    const k = withStress(kernel({ nets: { neuroendocrine: false } }));
    // Sympathetic tone above rest (the A.5 fallback variable stands in for §7), so the nerve-spillover
    // share of plasma noradrenaline would move the pool if it were not clamped.
    k.set('tone.symMus', 2 * PARAMS.toneMusRest);
    let crhMax = 0, dev = 0;
    for (let t = 60; t <= 5400; t += 60) {
      k.advanceTo(t);
      crhMax = Math.max(crhMax, k.get('crhRel'));
      for (const n of HORMONES) dev = Math.max(dev, Math.abs(k.get(n) - 1));
    }
    assert.ok(dev < 1e-9, `hormones at basal (max |Δ| ${dev})`);
    assert.ok(crhMax > 6, `CRH command ×${crhMax}`);
  });

  test('neuroendocrine switched off mid-response: pools relax by their own kinetics to basal (replacement)', () => {
    const k = withStress(kernel());
    k.advanceTo(1500);
    const c0 = k.get('cortisolRel');
    assert.ok(c0 > 1.8, String(c0));
    k.setNet('neuroendocrine', false, 1500);
    k.advanceTo(1530);
    assert.ok(k.get('cortisolRel') > 0.9 * c0, 'not instantaneous');
    k.advanceTo(1500 + 6 * 3600);
    for (const n of HORMONES) assert.ok(Math.abs(k.get(n) - 1) < 0.01, `${n} ${k.get(n)}`);
    assert.ok(k.get('cortisolRel') >= 1 - 1e-9, 'never below basal (never zero)');
  });

  test('autonomic off: adrenal medulla denervated (adrenaline basal), the HPA still responds', () => {
    const k = withStress(kernel({ nets: { autonomic: false } }));
    const A = trace(k, 'adrenalineRel', 1800, 30);
    assert.ok(Math.max(...A.map((x) => Math.abs(x - 1))) < 1e-12, 'no adrenaline surge');
    const k2 = withStress(kernel({ nets: { autonomic: false } }));
    const C = trace(k2, 'cortisolRel', 5400, 30), k3 = withStress(kernel()), Con = trace(k3, 'cortisolRel', 5400, 30);
    // Lower than with all networks on: the adrenaline → ACTH positive limb (e_E, §9.3) needs the surge.
    assert.ok(Math.max(...C) > 1.5 && Math.max(...C) < Math.max(...Con), `cortisol ×${Math.max(...C)} vs ×${Math.max(...Con)}`);
  });

  test('neuroimmune gates the cytokine → PVN drive (§10.5)', () => {
    for (const on of [true, false]) {
      const k = kernel({ nets: { neuroimmune: on } });
      const before = k.get('crhRel');
      k.set('pge2', 1);   // the A.5 fallback variable stands in for the immune module
      k.advanceTo(600);
      const rise = k.get('crhRel') - before;
      if (on) assert.ok(rise > 0.5, `CRH +${rise}`); else assert.ok(Math.abs(rise) < 0.05, `CRH +${rise}`);
    }
  });
});

describe('master switch (A.5, §11.10 rule 5)', () => {
  test('brain-only mode freezes the body state; the CRH command keeps computing; the body returns at rest', () => {
    const k = withStress(kernel());
    k.advanceTo(600);
    k.setBodyMode('brain', 600);
    k.advanceTo(601);
    const frozen = Object.fromEntries(HORMONES.map((n) => [n, k.get(n)]));
    assert.ok(frozen.adrenalineRel > 2 && frozen.acthRel > 2, JSON.stringify(frozen));
    const crh0 = k.get('crhRel');
    k.advanceTo(1500);
    for (const n of HORMONES) assert.equal(k.get(n), frozen[n], n);
    assert.notEqual(k.get('crhRel'), crh0);
    // Brain-only: feedback clamped at basal, so the command follows C·drive (§12.15).
    k.advanceTo(2400);
    k.setBodyMode('body', 2400);
    k.advanceTo(2401);
    const rest = kernel();
    for (const n of ['adrenalineRel', 'avpRel', 'raas']) assert.ok(Math.abs(k.get(n) - 1) < 1e-6, `${n} ${k.get(n)}`);
    assert.ok(Math.abs(k.get('cortisolRel') - rest.get('cortisolRel')) < 0.01, 'cortisol from the resting-state cache');
  });

  test('brain-only settle: central form with cortisol clamped at basal', () => {
    const k = withStress(kernel({ brain: true }));
    const C = (1 + PARAMS.aC * k.get('procC'));
    assert.ok(Math.abs(k.get('crhRel') - C) < 1e-9, 'rest command = C (F(1) = 1)');
    k.advanceTo(900);
    assert.ok(k.get('crhRel') > 6 && k.get('crhRel') < 8.5, String(k.get('crhRel')));
    for (const n of HORMONES) assert.ok(Math.abs(k.get(n) - (n === 'acthRel' || n === 'cortisolRel' ? k.get('en.S') : 1)) < 1e-12, n);
  });
});

describe('§9 interventions (§9.9, §11.12)', () => {
  test('presets are data with an apply(k) that cuts the gland output edges', () => {
    for (const p of Object.values(INTERVENTIONS)) {
      assert.equal(typeof p.apply, 'function');
      assert.ok(Array.isArray(p.params.remove) && p.net === 'neuroendocrine');
    }
    const k = kernel();
    k.setIntervention(INTERVENTIONS.adrenalectomy, 1);
    k.advanceTo(2);
    const e = GRAPH.edges.findIndex((x) => GRAPH.nodes[x.from].id === 'adrenalCortex.R' && GRAPH.nodes[x.to].id === 'cortisol');
    assert.equal(k.edgeGate(e), 0);
    k.setIntervention(null, 3);
    k.advanceTo(4);
    assert.equal(k.edgeGate(e), 1);
    assert.equal(k.get('en.rmCortex'), 0);
  });

  test('adrenalectomy: cortisol and adrenaline at basal; CRH and ACTH rise to the ceiling of F', () => {
    const k = withStress(kernel());
    const crh0 = k.get('crhRel'), acth0 = k.get('acthRel');
    k.setIntervention(INTERVENTIONS.adrenalectomy, 0);
    k.advanceTo(3 * 3600);
    assert.ok(Math.abs(k.get('cortisolRel') - 1) < 0.01 && Math.abs(k.get('adrenalineRel') - 1) < 1e-6);
    assert.ok(k.get('crhRel') > 1.8 * crh0, `CRH ${crh0} → ${k.get('crhRel')}`);
    assert.ok(k.get('acthRel') > 3 * acth0, `ACTH ${acth0} → ${k.get('acthRel')}`);
  });

  test('clock vote (A.4): ×60 while the HPA is in a transient, none once a removed gland has left it at its saturated steady state', () => {
    const vote = (k) => /** @type {any} */ (k.plugin('endocrine')).khVote();
    const s = withStress(kernel());
    s.advanceTo(600);
    assert.equal(vote(s), PARAMS.khActive, 'stress response');
    assert.equal(vote(kernel()), Infinity, 'rest');
    for (const p of [INTERVENTIONS.adrenalectomy, INTERVENTIONS.hypophysectomy]) {
      const k = kernel();
      k.setIntervention(p, 0);
      k.advanceTo(600);
      assert.equal(vote(k), PARAMS.khActive, `${p.id}: the axis moves to its new state`);
      k.advanceTo(12 * 3600);
      assert.equal(vote(k), Infinity, `${p.id}: steady after 12 h`);
    }
  });

  test('hypophysectomy: adrenaline surge preserved, ACTH lost, cortisol flat, AVP at basal', () => {
    const k = withStress(kernel());
    k.setIntervention(INTERVENTIONS.hypophysectomy, 0);
    let aMax = 0, cDev = 0;
    for (let t = 30; t <= 5400; t += 30) { k.advanceTo(t); aMax = Math.max(aMax, k.get('adrenalineRel')); if (t > 1800) cDev = Math.max(cDev, Math.abs(k.get('cortisolRel') - 1)); }
    assert.ok(aMax > 3.5, `adrenaline ×${aMax}`);
    assert.ok(k.get('acthRel') < 0.01, String(k.get('acthRel')));
    assert.ok(cDev < 0.05, `cortisol |Δ| ${cDev}`);
    assert.ok(Math.abs(k.get('avpRel') - 1) < 1e-9);
  });
});

describe('RAAS and posterior pituitary (§9.7, §11.13, §12.9)', () => {
  // The A.5 fallback 'map' variable stands in for the autonomic module's MAP (88 mmHg, §7 rest).
  test('RAAS rises over minutes (τ 2 min) on a pressure fall and decays slowly (τ 15 min)', () => {
    const k = kernel();
    assert.equal(k.get('map'), PARAMS.mapRest);
    k.set('map', 0.8 * PARAMS.mapRest);
    const cmd = 1 + PARAMS.raasPerfusionGain * 0.2;
    k.advanceTo(120);
    const r120 = k.get('raas');
    assert.ok(Math.abs((r120 - 1) / (cmd - 1) - (1 - Math.exp(-1))) < 0.02, `raas at 2 min ${r120}`);
    k.advanceTo(1200);
    assert.ok(Math.abs(k.get('raas') - cmd) < 0.01);
    k.set('map', PARAMS.mapRest);
    k.advanceTo(1200 + 900);
    assert.ok(Math.abs((k.get('raas') - 1) / (cmd - 1) - Math.exp(-1)) < 0.02, `raas 15 min after ${k.get('raas')}`);
  });

  test('RAAS is renal: it survives autonomic off, and stops with neuroendocrine off', () => {
    for (const [nets, up] of [[{ autonomic: false }, true], [{ neuroendocrine: false }, false]]) {
      const k = kernel({ nets });
      k.set('map', 0.75 * PARAMS.mapRest);
      k.advanceTo(1200);
      if (up) assert.ok(k.get('raas') > 2); else assert.equal(k.get('raas'), 1);
    }
  });

  test('baroreceptor AVP (autonomic ∧ neuroendocrine): steep only beyond a 10 % fall', () => {
    const avpAt = (fall, nets = {}) => { const k = kernel({ nets }); k.set('map', (1 - fall) * PARAMS.mapRest); k.advanceTo(7200); return k.get('avpRel'); };
    assert.ok(Math.abs(avpAt(0.08) - 1) < 1e-9);
    assert.ok(avpAt(0.25) > 3.5);
    assert.ok(Math.abs(avpAt(0.25, { autonomic: false }) - 1) < 1e-9);
    assert.ok(Math.abs(avpAt(0.25, { neuroendocrine: false }) - 1) < 1e-9);
  });
});

describe('determinism (A.8 #25, §11.6)', () => {
  // Same seed, two frame schedules (60 fps at ×60 and 23.7 fps at ×600, with a frame at every sample):
  // every kernel variable and array is identical at the shared samples.
  const SAMPLES = [30, 95.5, 600, 901.25, 1500, 2222, 3000, 3600];
  function run(fps, kh) {
    const k = withStress(kernel({ seed: 3 }));
    k.setNet('autonomic', false, 1000.3);
    k.setNet('autonomic', true, 1700);
    k.setIntervention(INTERVENTIONS.hypophysectomy, 2500);
    k.setBodyMode('brain', 2700);
    k.setBodyMode('body', 3100);
    const snaps = [];
    const dt = kh / fps;
    let t = 0;
    for (const s of SAMPLES) {
      while (t + dt < s) { t += dt; k.advanceTo(t); }
      t = s; k.advanceTo(s);
      snaps.push({ vars: Float64Array.from(k.vars), pool: Float64Array.from(/** @type {any} */ (k).pool) });
    }
    return snaps;
  }
  test('same seed, two frame-rate schedules: max |Δ| = 0', () => {
    const a = run(60, 60), b = run(23.7, 600);
    let d = 0;
    a.forEach((s, i) => {
      for (const key of ['vars', 'pool']) for (let q = 0; q < s[key].length; q++) {
        const x = s[key][q], y = b[i][key][q];
        if (!(x === y || (Number.isNaN(x) && Number.isNaN(y)))) d = Math.max(d, Math.abs(x - y));
      }
    });
    assert.equal(d, 0);
  });
});
