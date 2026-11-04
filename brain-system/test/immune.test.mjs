// Neuroimmune network (research/ANALYSIS.md §10, §12.12, §12.20 rows 35–41 and 52, A.5, A.3.4,
// §11.3, §11.6–§11.13, B.14, B.15 phase 8):
// 1. The graph builds with [brainnet, sensory, immune] and with the immune module alone beside the
//    brain; its §10.1 nodes, the §11.11 AND masks and the §2 splenic route are in it, and the
//    brain-only graph drops the whole fragment.
// 2. Rest is the steady state after settle: every pool is empty, tSet sits at its 37.0 baseline and
//    the brain's resting rates are the ones it has without this module.
// 3. The §12 checkpoints this plugin set can reach pass inside their §12.20 bands, and the §10.9
//    display and set-point targets hold; the rows that need §7 or §9 name the module they wait for.
// 4. Switch-off behaviour per A.5: tSet returns to its baseline (basal replacement), the central
//    signal and the efferent arc go to zero (denervation), and the peripheral innate response keeps
//    running, so cytokines are higher and longer. The §10.8 interventions behave as data.
// 5. Brain-only mode freezes the body state and refuses an endotoxin bolus (A.3.5, A.5).
// 6. Determinism: the same seed and two frame-rate schedules give max |Δ| = 0 (A.8 #25).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, NET, BODY_BIT } from '../src/sim/graph.js';
import { Kernel } from '../src/sim/kernel.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as immune, PARAMS, SICKNESS_IDS, STATE_NAMES, splenicDenervation, vns, INTERVENTIONS } from '../src/sim/immune.js';
import { SCENARIOS, evaluate, availability, checkpointSkip } from '../src/sim/scenarios.js';

const PLUGINS = [brainnet, sensory, immune];
const PLUGIN_IDS = PLUGINS.map((p) => p.id);
const GRAPH = buildGraph({ plugins: PLUGINS });
const BRAIN_ONLY_PLUGINS = [brainnet, sensory];
const BRAIN_GRAPH = buildGraph({ plugins: BRAIN_ONLY_PLUGINS });

const NI = NET.neuroimmune, AUT = NET.autonomic, ENT = NET.enteric, NE = NET.neuroendocrine;
const LPS = { type: 'lps', dose: 2, unit: 'ng/kg', route: 'iv' };   // §12.3 scenario input
const SPAN = SCENARIOS.infection.spanH;                             // 28,800 s of tH (§12.12)

const kernel = ({ seed = 1, nets = null, preset = null, brain = false } = {}) => {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed, settle: false });
  if (nets) for (const [n, on] of Object.entries(nets)) k.set(`net.${n}`, on ? 1 : 0);
  if (brain) k.set('bodyMode', 0);
  k.settle({});
  if (preset) k.setIntervention(preset, 0);
  return k;
};

// Run an endotoxin bolus and reduce the trace: peak value, time of peak and the area under it.
function challenge(k, { dose = 2, span = SPAN, dt = 60, names = ['tnf', 'il6', 'il10', 'pge2', 'tSet', 'vagAI'] } = {}) {
  k.schedule({ ...LPS, dose, tH: 0 });
  const peak = {}, at = {}, auc = {}, base = {};
  for (const n of names) { peak[n] = -Infinity; at[n] = NaN; auc[n] = 0; base[n] = k.get(n); }
  for (let t = dt; t <= span; t += dt) {
    k.advanceTo(t);
    for (const n of names) {
      const v = k.get(n);
      assert.ok(Number.isFinite(v), `${n} finite at ${t}`);
      if (v > peak[n]) { peak[n] = v; at[n] = t; }
      auc[n] += (v - base[n]) * dt;
    }
  }
  return { peak, at, auc, end: Object.fromEntries(names.map((n) => [n, k.get(n)])), k };
}

// Largest absolute difference between two snapshots (as in determinism.test.mjs).
function maxDiff(a, b, path = '$') {
  if (a === b) return { d: 0, path };
  if (typeof a === 'number' && typeof b === 'number') return { d: Number.isNaN(a) && Number.isNaN(b) ? 0 : Math.abs(a - b), path };
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.length !== b.length || a.constructor !== b.constructor) return { d: Infinity, path: `${path}.length` };
    let w = { d: 0, path };
    for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x === y || (Number.isNaN(x) && Number.isNaN(y))) continue; const d = Math.abs(x - y); if (d > w.d) w = { d, path: `${path}[${i}]` }; }
    return w;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return { d: Infinity, path: `${path}.length` };
    let w = { d: 0, path };
    for (let i = 0; i < a.length; i++) { const r = maxDiff(a[i], b[i], `${path}[${i}]`); if (r.d > w.d) w = r; }
    return w;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let w = { d: 0, path };
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a) || !(key in b)) return { d: Infinity, path: `${path}.${key}` };
      const r = maxDiff(a[key], b[key], `${path}.${key}`); if (r.d > w.d) w = r;
    }
    return w;
  }
  return { d: Infinity, path };
}

// --- 1. Fragment and graph (§10.1, §11.3, §11.11) ---
describe('immune fragment (§10.1, §11.3, §11.11)', () => {
  test('the graph builds with brainnet and sensory, and every immune edge resolves', () => {
    const own = GRAPH.edges.filter((e) => e.plugin === 'immune');
    assert.ok(own.length >= 13, `${own.length} immune edges`);
    assert.deepEqual(GRAPH.dropped.map((d) => `${d.from}->${d.to}`), [], 'no immune edge is dropped (the cortisol brake is drawn by §9)');
    for (const e of own) {
      assert.ok(GRAPH.nodes[e.from] && GRAPH.nodes[e.to], `${e.fromId} → ${e.toId}`);
      assert.ok(Number.isFinite(e.delay) && (e.delay > 0 || e.transport === 'layer'), `${e.fromId} → ${e.toId} delay`);
      assert.ok(e.nets & BODY_BIT, `${e.fromId} → ${e.toId} carries the body bit (§11.3 rule 2)`);
      if (typeof e.path === 'string') assert.ok(GRAPH.paths.has(e.path), e.path);
    }
    assert.equal(new Set(GRAPH.nodes.map((n) => n.id)).size, GRAPH.nodes.length, 'ids unique');
  });

  test('§10.1 node ids, owners and layers; the peripheral innate response is tissue (A.8 #9)', () => {
    const node = (id) => GRAPH.nodes[GRAPH.index.get(id)];
    for (const id of ['macrophages', 'spleen', 'splenicTcells']) {
      const n = node(id);
      assert.equal(n.owner, 'tissue', id);        // runs whenever bodyMode = 'body', never switched
      assert.equal(n.nets, 0, `${id} lists no network`);
      assert.equal(n.layer, 'IM', id);
      assert.ok(n.body, id);
    }
    for (const id of ['immuneAff', 'immuneCVO']) {
      const n = node(id);
      assert.equal(n.owner, 'ni.route', id);
      assert.equal(n.nets, NI, id);
      assert.equal(n.layer, 'NF', id);
      assert.equal(n.xfer, 'direct', id);
    }
    for (const s of ['R', 'L']) assert.ok(GRAPH.index.has(`coeliac.${s}`), `coeliac.${s}`);
    // §2 anchors read by §10.1 (A.2 precedence).
    assert.deepEqual(node('spleen').pos, [-108, -55, -458]);
    assert.deepEqual(node('coeliac.R').pos, [18, -10, -470]);
    assert.deepEqual(node('coeliac.L').pos, [-18, -10, -470]);
    const route = GRAPH.paths.get('splenicNerve');
    assert.ok(route && route.pts.length === 3 && route.len > 60 && route.len < 100, 'splenicNerve route (§2: ≈ 80 mm)');
  });

  test('§11.11 AND masks: the routes, the reflex efferent and the gut branch', () => {
    const find = (from, to) => GRAPH.edges.find((e) => e.fromId === from && e.toId === to);
    assert.equal(find('immuneAff', 'portVisc.R').nets & ~BODY_BIT, AUT | NI, 'vagal immune sensing');
    assert.equal(find('immuneCVO', 'portCVO').nets & ~BODY_BIT, NI, 'CVO humoral route');
    assert.equal(find('immuneCVO', 'mnpo').nets & ~BODY_BIT, NI, 'endothelial PGE2 → mnpo (EP3)');
    assert.equal(find('immuneCVO', 'pvn.R').nets & ~BODY_BIT, NI, 'cytokine → pvn');
    assert.equal(find('portImmune.R', 'coeliac.R').nets & ~BODY_BIT, AUT | NI, 'inflammatory-reflex efferent');
    assert.equal(find('coeliac.L', 'splenicTcells').nets & ~BODY_BIT, AUT | NI, 'splenicNerve');
    assert.equal(find('splenicTcells', 'macrophages').nets & ~BODY_BIT, AUT | NI, 'ACh at α7nAChR');
    assert.equal(find('coeliac.L', 'spleen').nets & ~BODY_BIT, AUT | NI, 'sympathetic lymphoid');
    assert.equal(find('portVag.R', 'macrophages').nets & ~BODY_BIT, AUT | ENT | NI, 'gut branch');
    // No immune edge emits a volley train: the slow tonic routes stay under the §11.8 threshold.
    for (const e of GRAPH.edges.filter((e) => e.plugin === 'immune' && e.emits)) {
      const src = GRAPH.nodes[e.from];
      assert.ok(PARAMS.recRmax * PARAMS.driveMax < 0.1 * src.rmax, `${e.fromId} stays under the §11.8 threshold`);
    }
  });

  test('the module runs alone beside the brain, and the brain-only graph has no immune fragment', () => {
    const alone = buildGraph({ plugins: [brainnet, immune] });
    assert.ok(alone.index.has('macrophages') && alone.index.has('immuneCVO'));
    const k = new Kernel({ graph: alone, plugins: [brainnet, immune], seed: 1 });
    assert.equal(k.get('tSet'), PARAMS.tSetBase);
    const brainOnly = buildGraph({ plugins: PLUGINS, body: false });
    assert.equal(brainOnly.nodes.filter((n) => n.plugin === 'immune').length, 0);
    assert.equal(brainOnly.edges.filter((e) => e.plugin === 'immune').length, 0);
  });
});

// --- 2. Rest (§11.6, A.3.4) ---
describe('rest is the steady state (§11.6, A.3.4)', () => {
  test('every A.3.4 immune readout is declared and empty at rest; tSet sits at 37.0', () => {
    const k = kernel();
    for (const name of STATE_NAMES) assert.ok(k.idx(name) >= 0, `declared ${name}`);
    for (const name of ['lps', 'mac', 'tnf', 'il1b', 'il6', 'il10', 'pge2', 'vagAI', 'vns', 'tSetShift']) assert.equal(k.get(name), 0, name);
    for (const name of ['brakeC', 'brakeV']) assert.equal(k.get(name), 1, name);
    for (const c of SICKNESS_IDS) assert.equal(k.get(`sickness.${c}`), 0, c);
    assert.equal(k.get('tSet'), PARAMS.tSetBase);
    assert.equal(SICKNESS_IDS.length, 9, 'the nine §10.7 components');
    // Rest holds: 600 s of tH with no challenge changes nothing.
    k.advanceTo(600);
    assert.equal(k.get('tnf'), 0);
    assert.equal(k.get('tSet'), PARAMS.tSetBase);
    assert.equal(k.get('sickness.malaise'), 0);
  });

  test('the fragment does not move the brain’s resting rates', () => {
    const withImmune = kernel();
    const brain = new Kernel({ graph: BRAIN_GRAPH, plugins: BRAIN_ONLY_PLUGINS, seed: 1 });
    for (const id of ['mnpo', 'pvn.R', 'ntsVisc.R', 'portCVO', 'portVisc.R', 'portImmune.R', 'dmv.R', 'rpa']) {
      assert.ok(Math.abs(withImmune.rate(id) - brain.rate(id)) < 1e-9, `${id}: ${withImmune.rate(id)} vs ${brain.rate(id)}`);
    }
    assert.equal(withImmune.rate('immuneAff'), 0);
    assert.equal(withImmune.rate('immuneCVO'), 0);
  });
});

// --- 3. §12 checkpoints and the §10.9 targets ---
describe('§12.12 infection checkpoints (§12.20 rows 35–41, 52)', () => {
  const results = evaluate('infection', { graph: GRAPH, plugins: PLUGINS });
  const byId = new Map(results.map((r) => [r.id, r]));

  test('the scenario is available with the immune module (A.3.5)', () => {
    assert.equal(availability('infection', kernel()), '');
    assert.equal(availability('infection', kernel({ brain: true })), 'Needs the body');
  });

  for (const cp of SCENARIOS.infection.checkpoints) {
    const name = `${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`;
    const skip = checkpointSkip(cp, PLUGIN_IDS);
    if (skip) { test(name, { todo: skip }, () => {}); continue; }
    test(name, (t) => {
      const r = byId.get(cp.id);
      assert.ok(r, 'evaluated');
      assert.notEqual(r.status, 'skipped', r.reason);
      t.diagnostic(`${cp.v}: ${r.value} (band ${cp.range.join('–')}${cp.unit ? ` ${cp.unit}` : ''})`);
      assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
    });
  }

  test('§10.9 targets: TNF 231 ± 80 pg/mL, IL-6 1,000 ± 400 pg/mL, set point +1.5 ± 0.5 °C', (t) => {
    const r = challenge(kernel());
    t.diagnostic(`tnf ${r.peak.tnf.toFixed(1)} pg/mL at ${(r.at.tnf / 3600).toFixed(2)} h; il6 ${r.peak.il6.toFixed(0)} at ${(r.at.il6 / 3600).toFixed(2)} h; ΔtSet ${(r.peak.tSet - 37).toFixed(2)} °C`);
    assert.ok(Math.abs(r.peak.tnf - 231) <= 80, `tnf peak ${r.peak.tnf}`);
    assert.ok(Math.abs(r.peak.il6 - 1000) <= 400, `il6 peak ${r.peak.il6}`);
    assert.ok(Math.abs(r.peak.tSet - 37 - 1.5) <= 0.5, `ΔtSet ${r.peak.tSet - 37}`);
    // §10.9: TNF back to baseline 4–6 h (±2 h) and IL-6 by ≈ 6 h (±2 h); both resolved by the span end.
    assert.ok(r.end.tnf < 0.01 * r.peak.tnf, `tnf at 8 h ${r.end.tnf}`);
    assert.ok(r.end.il6 < 0.1 * r.peak.il6, `il6 at 8 h ${r.end.il6}`);
    // Plasma IL-1β does not rise measurably at this dose (Michie et al. 1988), so `il1b` is read as a
    // tissue-compartment concentration and nothing in the graph carries it: the PVN is driven by the
    // CVO cytokine and PGE2 signal, not by a plasma IL-1β pool (§10.2).
    const il1b = challenge(kernel(), { dt: 300, names: ['il1b', 'mac'] });
    assert.ok(il1b.peak.il1b > 0 && il1b.at.il1b >= il1b.at.mac, 'the tissue pool follows macrophage activation');
    assert.ok(GRAPH.edges.every((e) => e.transmitter !== 'il1b'));
  });

  test('§10.9 hard check: the cascade stays bounded with both brakes removed', () => {
    const r = challenge(kernel({ nets: { autonomic: false, neuroendocrine: false } }), { dt: 10 });
    assert.ok(r.peak.tnf < 1e4 && r.peak.il6 < 1e5, `bounded: tnf ${r.peak.tnf}, il6 ${r.peak.il6}`);
    assert.ok(r.end.tnf < 0.01 * r.peak.tnf, 'the trace decays: the chain is feed-forward from a decaying source');
    assert.equal(r.k.get('brakeV'), 1, 'cholinergic brake removed');
    assert.equal(r.k.get('brakeC'), 1, 'glucocorticoid brake removed');
  });

  test('§11.7 clock: the immune module votes the A.4 ×900 target while cytokines are present', () => {
    const k = kernel();
    assert.equal(k.khTarget(), Infinity, 'no target at rest');
    k.schedule({ ...LPS, tH: 0 });
    k.advanceTo(3600);
    assert.ok(k.get('tnf') > PARAMS.cytokineEps);
    assert.equal(k.khTarget(), PARAMS.khImmune);
  });
});

// --- 4. Switches and interventions (A.5, §10.8, §11.10) ---
describe('switch-off behaviour (A.5, §10.8, §11.10)', () => {
  test('neuroimmune off: tSet flat at its baseline, central signal and efferent arc zero, cytokines higher and longer', () => {
    const on = challenge(kernel());
    const off = challenge(kernel({ nets: { neuroimmune: false } }));
    // Basal replacement for the set point, denervation for the two arcs (A.5).
    assert.equal(off.peak.tSet, PARAMS.tSetBase, 'ΔtSet = 0 (§12.20 row 41)');
    assert.equal(off.peak.pge2, 0, 'pge2 → 0');
    assert.equal(off.peak.vagAI, 0, 'vagAI → 0');
    assert.equal(off.k.get('tSetShift'), 0);
    for (const c of SICKNESS_IDS) assert.equal(off.k.get(`sickness.${c}`), 0, c);
    // The peripheral innate response continues (owner tissue, A.8 #9): cytokines highest and longest.
    assert.ok(off.peak.tnf > on.peak.tnf, `tnf ${off.peak.tnf} > ${on.peak.tnf}`);
    assert.ok(off.auc.tnf > on.auc.tnf && off.auc.il6 > on.auc.il6, 'both AUCs higher (§12.14)');
    assert.ok(off.peak.tnf > 0, 'the challenge still produces cytokines');
  });

  test('autonomic off: the cholinergic brake is lost, so TNF runs higher; the set point still moves', () => {
    const on = challenge(kernel());
    const off = challenge(kernel({ nets: { autonomic: false } }));
    assert.equal(off.k.get('brakeV'), 1, 'brake_V = 1');
    assert.equal(off.peak.vagAI, 0);
    assert.ok(off.peak.tnf > on.peak.tnf, `tnf ${off.peak.tnf} > ${on.peak.tnf} (§12.20 row 40)`);
    assert.ok(off.peak.tSet - 37 > 1.0, 'tSet still rises: the shift needs only neuroimmune (§10.6)');
  });

  test('enteric off: the gut branch of the reflex fails, the splenic branch does not (§10.8)', () => {
    const on = challenge(kernel(), { dt: 300 });
    const off = challenge(kernel({ nets: { enteric: false } }), { dt: 300 });
    assert.ok(off.peak.tnf > on.peak.tnf, `tnf ${off.peak.tnf} > ${on.peak.tnf}`);
    assert.ok(off.peak.vagAI > 0.5 * on.peak.vagAI, 'the splenic branch keeps most of the brake');
  });

  test('glucocorticoid brake: basal replacement when neuroendocrine or neuroimmune is off (§10.2, §11.13)', () => {
    const run = (nets) => {
      const k = kernel({ nets });
      k.set('cortisolRel', 1.9);          // §9's readout, read here through k.ref (A.5 basal 1)
      k.schedule({ ...LPS, tH: 0 });
      k.advanceTo(3600);
      return k;
    };
    const on = run(null);
    assert.ok(on.get('brakeC') < 0.6, `brake_C ${on.get('brakeC')} with cortisolRel 1.9`);
    assert.equal(run({ neuroendocrine: false }).get('brakeC'), 1, 'hormone action replaced by basal');
    assert.equal(run({ neuroimmune: false }).get('brakeC'), 1, 'cortisol on immune cells needs both');
    // Th1 → Th2 shift, not blanket suppression (§10.5): IL-10 rises relative to TNF under cortisol.
    const base = challenge(kernel(), { dt: 120 });
    const k = kernel();
    k.set('cortisolRel', 1.9);
    const high = challenge(k, { dt: 120 });
    assert.ok(high.peak.tnf < base.peak.tnf, 'type 1 suppressed');
    assert.ok(high.peak.il10 / high.peak.tnf > base.peak.il10 / base.peak.tnf, 'type 2 spared and upregulated');
  });

  test('§10.8 interventions as data: splenic denervation and the VNS slider', () => {
    const on = challenge(kernel(), { dt: 120 });
    const cut = challenge(kernel({ preset: splenicDenervation }), { dt: 120 });
    assert.equal(cut.peak.vagAI, 0, 'the brake is gone with the splenic nerve');
    assert.ok(cut.peak.tnf > on.peak.tnf, `tnf peaks higher: ${cut.peak.tnf} > ${on.peak.tnf}`);
    assert.ok(cut.peak.tSet - 37 > 1.0, 'afferent sensing and the set point stay intact (§10.8)');
    const stim = challenge(kernel({ preset: vns(1) }), { dt: 120 });
    assert.ok(stim.peak.tnf < on.peak.tnf, `VNS lowers TNF: ${stim.peak.tnf} < ${on.peak.tnf}`);
    assert.ok(stim.peak.il10 / stim.peak.tnf > on.peak.il10 / on.peak.tnf, 'IL-10 spared relative to TNF (§10.4)');
    assert.equal(stim.k.get('vns'), 1);
    // Presets are plain data with one apply(k), and a null preset resets every cut (§11.12).
    for (const p of [INTERVENTIONS.splenicDenervation, INTERVENTIONS.vns(0.5)]) {
      assert.equal(typeof p.id, 'string');
      assert.equal(p.net, 'neuroimmune');
      assert.equal(typeof p.apply, 'function');
    }
    const k = kernel({ preset: splenicDenervation });
    k.advanceTo(1);
    assert.ok(k.stores._k.cuts.length >= 2, 'edges cut');
    assert.equal(k.get('vns'), 0, 'another preset ends the stimulation');
    k.setIntervention(null, 1);
    k.advanceTo(2);
    assert.equal(k.stores._k.cuts.length, 0, 'cuts reset');
  });
});

describe('truncal vagotomy (§10.8, §11.12)', () => {
  // §7's preset: this module cuts its abdominal cn10 edges (VAGOTOMY_EDGES) on the 'intervention' event,
  // so the efferent chain portImmune.L → coeliac.L → splenicTcells is broken and the brake is lost.
  const truncal = { id: 'truncalVagotomy', label: 'Truncal vagotomy', net: /** @type {'autonomic'} */ ('autonomic'), apply() {} };
  test('the inflammatory-reflex brake is lost and TNF runs higher; the efferent cut alone also removes it', () => {
    const on = challenge(kernel(), { dt: 120 });
    const vag = challenge(kernel({ preset: truncal }), { dt: 120 });
    assert.equal(vag.peak.vagAI, 0, 'no efferent brake');
    assert.ok(vag.peak.tnf > on.peak.tnf, `tnf ${vag.peak.tnf} > ${on.peak.tnf}`);
    const eff = { id: 'efferentCut', label: 'efferent cut', net: /** @type {'neuroimmune'} */ ('neuroimmune'),
      apply(k) { k.cutEdge(k.edgeIndex('portImmune.L', 'coeliac.L'), true); } };
    const cut = challenge(kernel({ preset: eff }), { dt: 120 });
    assert.equal(cut.peak.vagAI, 0, 'the coeliac route carries the splenic brake');
    assert.ok(cut.peak.tnf > on.peak.tnf, `tnf ${cut.peak.tnf} > ${on.peak.tnf}`);
  });
});

// --- 5. Brain-only mode (A.5, A.3.5) ---
describe('brain-only mode (A.5, A.3.5)', () => {
  test('an endotoxin bolus is refused and no immune state moves', () => {
    const k = kernel({ brain: true });
    k.schedule({ ...LPS, tH: 0 });
    k.advanceTo(2000);
    assert.equal(k.get('lps'), 0);
    assert.equal(k.get('tnf'), 0);
    assert.equal(k.get('tSet'), PARAMS.tSetBase);
    const log = [];
    k.events(log);
    assert.ok(log.some((e) => e.kind === 'lps-refused'), 'the refusal is logged');
  });

  test('the master switch freezes the immune state and restores a resting body (§11.10 rule 5)', () => {
    const k = kernel();
    k.schedule({ ...LPS, tH: 0 });
    k.advanceTo(3600);
    const frozen = ['lps', 'mac', 'tnf', 'il6', 'il10', 'pge2', 'tSet', 'sickness.malaise'].map((n) => [n, k.get(n)]);
    assert.ok(frozen.find(([n]) => n === 'tnf')[1] > 100, 'the challenge is under way');
    k.setBodyMode('brain', 3600);
    k.advanceTo(7200);
    for (const [n, v] of frozen) assert.equal(k.get(n), v, `${n} frozen in brain-only mode`);
    k.setBodyMode('body', 7200);
    k.advanceTo(7300);
    assert.equal(k.get('tnf'), 0, 'body state returns to the resting steady state (A.5)');
    assert.equal(k.get('tSet'), PARAMS.tSetBase);
  });
});

// --- 6. Determinism (A.8 #25, §11.6) ---
describe('determinism (A.8 #25, §11.6)', () => {
  test('the same seed and two frame-rate schedules give max |Δ| = 0', () => {
    const SAMPLES = [600, 1800, 3744, 6264, 10800, 21600];
    const run = (dtScreen, kh) => {
      const k = kernel({ seed: 3 });
      k.schedule({ ...LPS, tH: 0 });
      const out = [];
      for (const T of SAMPLES) {
        let n = 0;
        while (k.t < T) k.advanceTo(Math.min(T, k.t + dtScreen * kh * (1 + (n++ % 5) * 0.1)));
        out.push(k.snapshot());
      }
      return out;
    };
    const a = run(1 / 60, PARAMS.khImmune);      // 60 fps at the A.4 immune preset
    const b = run(1 / 23.7, 300);                // 23.7 fps at a third of it
    for (let i = 0; i < SAMPLES.length; i++) {
      const w = maxDiff(a[i], b[i]);
      assert.equal(w.d, 0, `tH ${SAMPLES[i]}: max |Δ| ${w.d} at ${w.path}`);
    }
  });
});
