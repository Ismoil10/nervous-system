// Autonomic network plugin (research/ANALYSIS.md §7; A.5, §11.10–§11.14; §12.6, §12.7, §12.9, §12.20;
// B.14, B.15 phase 5).
// 1. Graph: builds with [brainnet, sensory, autonomic] and with [brainnet, autonomic]; every ANS edge
//    needs `autonomic` and runs in whole-body mode only; the baroreflex and light-reflex routes exist.
// 2. Rest (§7.13 V1): the settled state is a fixed point at the §7 resting values.
// 3. §12 checkpoints of standUp, brightLight and loudSound that need only this module (§12.20 tolerances),
//    evaluated with scenarios.js `evaluate` on [brainnet, sensory, autonomic].
// 4. Switch-off (A.5, §7.12, §11.10): denervation for the nerves (tones → 0 by their own kinetics,
//    HR → IHR, pupils → 5.0 mm, no light reflex, no SCR; the baroreceptor afferents open) and basal
//    replacement for the hormone this module reads (the adrenaline β1 term follows g.neuroendocrine).
// 5. Brain-only mode freezes the body state; whole body restores the resting state.
// 6. Interventions (§7.11), orgasm commands in switched modes only (§11.14), thermoregulation (§7.10).
// 7. Determinism: the same seed under two frame-rate schedules gives max |Δ| = 0 (A.8 #25).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, NET, BODY_BIT } from '../src/sim/graph.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic, spinalCordInjury } from '../src/sim/somatic.js';
import { plugin as autonomic, PARAMS, INTERVENTIONS, ihr } from '../src/sim/autonomic.js';
import { SCENARIOS, ScenarioPlayer, evaluate, checkpointSkip } from '../src/sim/scenarios.js';
import { makeStimulus } from '../src/sim/stimuli.js';

const PLUGINS = [brainnet, sensory, autonomic];
const IDS = PLUGINS.map((p) => p.id);
const GRAPH = buildGraph({ plugins: PLUGINS });
const kernel = (o = {}) => new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, ...o });
const preset = (id, params) => { const p = INTERVENTIONS.find((x) => x.id === id); return params ? { ...p, params: { ...p.params, ...params } } : p; };

// Largest absolute difference between two snapshots (as in determinism.test.mjs).
function maxDiff(a, b, path = '$') {
  if (a === b) return { d: 0, path };
  if (typeof a === 'number' && typeof b === 'number') return { d: Number.isNaN(a) && Number.isNaN(b) ? 0 : Math.abs(a - b), path };
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.length !== b.length) return { d: Infinity, path: `${path}.length` };
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

const CV_STATE = ['hr', 'hp', 'sbp', 'dbp', 'map', 'pp', 'co', 'sv', 'tpr', 'contractility', 'rr', 'vt', 've', 'paco2', 'pao2',
  'pupilD.L', 'pupilD.R', 'scl', 'scr', 'tCore', 'tSkin', 'tSet', 'sweat', 'sbf', 'bat',
  'tone.vagCard', 'tone.symCard', 'tone.symMus', 'tone.symSpl', 'tone.symSkin', 'tone.fSudo.palm', 'tone.symAdr', 'tone.symBat',
  'tone.symPup', 'tone.symGut', 'tone.vagGut', 'tone.ew', 'tone.sal', 'tone.sacral',
  'fSymCard', 'fVagCard', 'fSymMus', 'fSymSpl', 'fSymSkin', 'fSudo.palm', 'fSymAdr', 'fSymBat', 'fSymPup', 'fSymGut', 'fVagGut', 'fEw', 'fSal', 'fSacral'];

// --- 1. Graph ---
describe('autonomic fragment (§7.2, §7.4, §11.3)', () => {
  test('builds with brainnet and sensory, and with brainnet alone; nothing dropped', () => {
    for (const plugins of [PLUGINS, [brainnet, autonomic]]) {
      const g = buildGraph({ plugins });
      assert.equal(g.dropped.length, 0, JSON.stringify(g.dropped.map((e) => `${e.from}→${e.to}`)));
      for (const id of ['carotidSinus.R', 'carotidSinus.L', 'aorticArch', 'cord.T1.iml.R', 'stellate.L', 'cardiacPlexus', 'ciliaryGang.R',
        'pupilSphincter.L', 'saNode', 'sweatPalm.R', 'cord.S2.spn.R', 'bladder']) assert.ok(g.index.has(id), id);
      const k = new Kernel({ graph: g, plugins, seed: 1 });
      assert.ok(Math.abs(k.get('hr') - 68) < 0.01, `hr ${k.get('hr')}`);
    }
  });

  test('every edge of the fragment needs autonomic and runs in whole-body mode only (A.5, §11.3)', () => {
    const mine = GRAPH.edges.filter((e) => e.plugin === 'autonomic');
    assert.ok(mine.length > 30);
    for (const e of mine) {
      assert.ok(e.nets & NET.autonomic, `${e.fromId} → ${e.toId}`);
      assert.ok(e.nets & BODY_BIT, `${e.fromId} → ${e.toId}`);
    }
    for (const n of GRAPH.nodes.filter((x) => x.plugin === 'autonomic')) assert.equal(n.body, true, n.id);
  });

  test('baroreflex and light-reflex chains are connected (§7.4, §7.8, B.15 phase 5)', () => {
    const has = (a, b) => GRAPH.edges.some((e) => e.fromId === a && e.toId === b);
    // carotid sinus (IX) and aortic arch (X) → NTS → CVLM ⊣ RVLM → IML; NTS → nucleus ambiguus, DMV
    for (const [a, b] of [['carotidSinus.R', 'portVisc.R'], ['aorticArch', 'portVisc.L'], ['portVisc.R', 'ntsVisc.R'], ['ntsVisc.R', 'cvlm.R'],
      ['cvlm.R', 'rvlm.R'], ['rvlm.R', 'portSymp.R'], ['portSymp.R', 'cord.T1.iml.R'], ['cord.T1.iml.R', 'stellate.R'], ['stellate.R', 'saNode'],
      ['ntsVisc.R', 'nAmbVagal.R'], ['ntsVisc.R', 'dmv.R'], ['portVag.R', 'cardiacPlexus'], ['cardiacPlexus', 'saNode']]) assert.ok(has(a, b), `${a} → ${b}`);
    assert.equal(GRAPH.edges.find((e) => e.fromId === 'cvlm.R' && e.toId === 'rvlm.R').sign, -1);
    // retina → pretectal → both EW → ciliary ganglion → sphincter
    for (const [a, b] of [['portRetina.R', 'opn.R'], ['opn.R', 'ew.R'], ['opn.R', 'ew.L'], ['ew.L', 'portPara.L'], ['portPara.L', 'ciliaryGang.L'],
      ['ciliaryGang.L', 'pupilSphincter.L']]) assert.ok(has(a, b), `${a} → ${b}`);
    // Conduction parts of the §7.6 latency budget: vagal 279 mm B + 10 mm Cpost; bulbospinal 131 mm.
    const d = (a, b) => GRAPH.edges.find((e) => e.fromId === a && e.toId === b).delay;
    assert.ok(Math.abs(d('portVag.R', 'cardiacPlexus') - (0.279 / 8 + 0.0006)) < 1e-9);
    assert.ok(Math.abs(d('portSymp.R', 'cord.T1.iml.R') - (0.131 / 3 + 0.0006)) < 1e-9);
  });
});

// --- 2. Rest ---
describe('resting state (§7.5, §7.7, §7.9, §7.10; §7.13 V1)', () => {
  test('the settled state is a fixed point at the §7 resting values', () => {
    const k = kernel();
    const s = k.state;
    // The §7.5 resting tones (0.309, 0.105) are rounded: the law gives 68.0005 bpm, and the closed loop
    // settles 4·10⁻⁵ mmHg above 88.
    assert.ok(Math.abs(s.hr - 68) < 0.01, `hr ${s.hr}`);
    assert.ok(Math.abs(s.map - 88) < 0.01, `map ${s.map}`);
    assert.ok(Math.abs(s.sbp - 115) < 0.5 && Math.abs(s.dbp - 75) < 0.5, `${s.sbp}/${s.dbp}`);
    assert.ok(Math.abs(s.co - 5) < 1e-3 && Math.abs(s.sv - 73.5) < 0.1 && Math.abs(s.tpr - 17.6) < 1e-3);
    assert.ok(Math.abs(s.rr - 14) < 1e-9 && Math.abs(s.vt - 0.5) < 1e-9 && Math.abs(s.paco2 - 40) < 1e-9 && Math.abs(s.pao2 - 95) < 1e-9);
    assert.ok(Math.abs(s['pupilD.R'] - 4.0) < 0.01 && s['pupilD.R'] === s['pupilD.L'], `pupil ${s['pupilD.R']}`);
    assert.equal(s.tCore, 37); assert.equal(s.tSet, 37); assert.equal(s.scr, 0);
    assert.ok(Math.abs(s['tone.vagCard'] - 0.309) < 1e-5 && Math.abs(s['tone.symCard'] - 0.105) < 1e-5);
    const before = Object.fromEntries(CV_STATE.map((n) => [n, k.get(n)]));
    k.advanceTo(120);
    for (const n of CV_STATE) assert.ok(Math.abs(k.get(n) - before[n]) < 1e-9, `${n}: ${before[n]} → ${k.get(n)}`);
    assert.ok(k.get('bladderVol') > PARAMS.bladder.v0, 'the bladder fills at the urine rate');
  });

  test('autonomic-off rest: HR = IHR(30) = 101.0, 92/65, pupils 5.0 mm (§7.5 model check, §7.13 V2)', () => {
    const k = kernel({ settle: false });
    k.set('net.autonomic', 0);
    k.settle({});
    assert.ok(Math.abs(k.get('hr') - ihr(30)) < 1e-6 && Math.abs(ihr(30) - 101.0) < 1e-9, `hr ${k.get('hr')}`);
    assert.ok(Math.abs(k.get('sbp') - 92) < 1 && Math.abs(k.get('dbp') - 65) < 1 && Math.abs(k.get('map') - 74) < 0.5);
    assert.ok(Math.abs(k.get('pupilD.R') - 5.0) < 1e-6 && Math.abs(k.get('pupilD.L') - 5.0) < 1e-6);
    for (const n of CV_STATE.filter((x) => x.startsWith('tone.'))) assert.ok(k.get(n) < 1e-6, n);
  });
});

// --- 3. §12 checkpoints ---
const results = new Map();
const resultsFor = (id) => { if (!results.has(id)) results.set(id, evaluate(id, { graph: GRAPH, plugins: PLUGINS })); return results.get(id); };

describe('§12 checkpoints of this module (§12.20 tolerances)', () => {
  for (const id of ['standUp', 'brightLight', 'loudSound', 'hotObject']) {
    describe(id, () => {
      for (const cp of SCENARIOS[id].checkpoints.filter((c) => c.needs.includes('autonomic'))) {
        const name = `${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`;
        const skip = checkpointSkip(cp, IDS);
        if (skip) { test(name, { todo: skip }, () => {}); continue; }
        test(name, (t) => {
          const r = resultsFor(id).find((x) => x.id === cp.id);
          assert.notEqual(r.status, 'skipped', r.reason);
          t.diagnostic(`${cp.v}${cp.v2 ? ` vs ${cp.v2}` : ''}: ${r.value}${r.trials ? ` (trials ${r.trials.map((x) => x.toFixed(4)).join(', ')})` : ''} (band ${cp.range.join('–')})`);
          assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
        });
      }
    });
  }
});

// The rows that need the somatic module too (hotObject rows 11–12) run with it here, so they are
// measured rather than skipped; standUp and loudSound check that the somatic plugin changes nothing else.
const SOM_PLUGINS = [brainnet, sensory, somatic, autonomic];
const SOM_IDS = SOM_PLUGINS.map((p) => p.id);
const SOM_GRAPH = buildGraph({ plugins: SOM_PLUGINS });
const somResults = new Map();
const somResultsFor = (id) => { if (!somResults.has(id)) somResults.set(id, evaluate(id, { graph: SOM_GRAPH, plugins: SOM_PLUGINS })); return somResults.get(id); };

describe('§12 checkpoints with somatic and autonomic together (§12.20 rows 11, 12)', () => {
  for (const id of ['hotObject', 'loudSound', 'standUp']) {
    describe(id, () => {
      for (const cp of SCENARIOS[id].checkpoints.filter((c) => c.needs.includes('autonomic'))) {
        const name = `${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`;
        const skip = checkpointSkip(cp, SOM_IDS);
        if (skip) { test(name, { todo: skip }, () => {}); continue; }
        test(name, (t) => {
          const r = somResultsFor(id).find((x) => x.id === cp.id);
          assert.notEqual(r.status, 'skipped', r.reason);
          t.diagnostic(`${cp.v}: ${r.value} (band ${cp.range.join('–')})`);
          assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
        });
      }
    });
  }
});

// --- 4. Switch-off behaviour ---
describe('switch-off behaviour (A.5, §7.12, §11.10, §11.13)', () => {
  test('autonomic off from rest: tones denervate by their own kinetics, HR → IHR with the ≈108-bpm overshoot', () => {
    const k = kernel();
    k.setNet('autonomic', false, 1);
    k.advanceTo(2.5);
    // Vagal tone falls within 1.5 s (τ 0.5 s, gate after the dead time); sympathetic tone is still in its
    // 2-s dead time and τ_off 10 s (A.8 #14).
    assert.ok(k.get('tone.vagCard') < 0.2 * 0.309, `vag ${k.get('tone.vagCard')}`);
    assert.ok(k.get('tone.symCard') > 0.8 * 0.105, `sym ${k.get('tone.symCard')}`);
    let peak = 0;
    while (k.t < 30) { k.advance(0.1); peak = Math.max(peak, k.get('hr')); }
    assert.ok(peak > 104 && peak < 112, `overshoot ${peak} (§11.10: ≈ 108 at 3 s)`);
    k.advanceTo(120);
    assert.ok(Math.abs(k.get('hr') - 101) < 0.05, `hr ${k.get('hr')}`);
    assert.ok(Math.abs(k.get('sbp') - 92) < 1, `sbp ${k.get('sbp')}`);
    assert.ok(Math.abs(k.get('pupilD.R') - 5) < 0.01);
    // Visceral afferents cut: NTS loses baroreceptor drive (baroreflex-failure pattern, §7.12).
    const j = k.nfIndex('ntsVisc.R');
    assert.ok(k.a(j) < k.aRest(j), 'ntsVisc below rest');
    // Back on: the loop re-engages to the all-on rest.
    k.setNet('autonomic', true, 121);
    k.advanceTo(500);
    assert.ok(Math.abs(k.get('hr') - 68) < 0.05 && Math.abs(k.get('map') - 88) < 0.05, `${k.get('hr')} ${k.get('map')}`);
  });

  test('autonomic off: pupils fixed (no light reflex) and no SCR to a loud sound (§7.12, A.5)', () => {
    const k = kernel({ settle: false });
    k.set('net.autonomic', 0); k.settle({});
    k.schedule(makeStimulus({ sense: 'vision', mode: 'step', side: 'R', intensity: 3, durationMs: 1000, tOnset: 1 }));
    k.schedule(makeStimulus({ sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, tOnset: 5, params: { riseMs: 0.5 } }));
    const jEw = k.nfIndex('ew.L');
    let dP = 0, scr = 0, ew = 0;
    while (k.t < 12) {
      k.advance(0.01);
      dP = Math.max(dP, Math.abs(k.get('pupilD.R') - 5), Math.abs(k.get('pupilD.L') - 5)); scr = Math.max(scr, k.get('scr'));
      ew = Math.max(ew, k.a(jEw) - k.aRest(jEw));
    }
    assert.ok(dP < 1e-9, `pupil moved ${dP}`);
    assert.equal(scr, 0);
    assert.ok(ew > 0.5, 'EW still computes its (consensual) command: efference only (§11.10 rule 3)');
  });

  test('autonomic off from rest: no phantom SCR while the palm tone decays (§7.12, §11.10)', () => {
    const k = kernel();
    k.setNet('autonomic', false, 1);
    let scr = 0;
    while (k.t < 15) { k.advance(0.01); scr = Math.max(scr, k.get('scr')); }
    assert.ok(scr < 1e-3, `scr ${scr} µS (the SCR onset threshold is 0.05)`);
    k.setNet('autonomic', true, 15);
    while (k.t < 40) { k.advance(0.01); scr = Math.max(scr, k.get('scr')); }
    assert.ok(scr < 1e-3, `scr ${scr} µS on switching back on`);
  });

  test('basal replacement: the adrenaline β1 term follows g.autonomic · g.neuroendocrine (§7.5, §11.13)', () => {
    // A stand-in endocrine module that holds plasma adrenaline at ×3 basal.
    const stub = { id: 'endocrine', scope: 'body', order: 50, create: (k) => { k.declare('adrenalineRel', 3); return {}; } };
    const plugins = [...PLUGINS, stub];
    const k = new Kernel({ plugins, seed: 1 });
    const hrOn = k.get('hr');
    assert.ok(hrOn > 68.5, `adrenaline raises hr: ${hrOn}`);
    k.setNet('neuroendocrine', false, 1);
    k.advanceTo(300);
    const k0 = kernel();
    assert.ok(Math.abs(k.get('hr') - k0.get('hr')) < 0.01, `neuroendocrine off: adrenaline term basal (${k.get('hr')} vs ${k0.get('hr')})`);
  });

  test('somatic off: the stand becomes a passive tilt (no central command, no muscle vasodilation, §7.12)', () => {
    const r = evaluate('standUp', { graph: GRAPH, plugins: PLUGINS, only: ['hrPeak'] })[0];
    const k = kernel({ settle: false });
    k.set('net.somatic', 0); k.settle({ posture: 'supine' });
    const p = new ScenarioPlayer({ kernel: k }); p.select('standUp'); p._start({ trials: 1 });
    const base = k.get('hr'); let peak = 0;
    while (k.t < p.run.onset + 30) { p.advanceTo(k.t + 0.25); peak = Math.max(peak, k.get('hr') - base); }
    assert.ok(peak < r.value - 5, `passive tilt peak ${peak} < active ${r.value}`);
  });
});

// --- 5. Master switch ---
describe('brain-only mode (A.5, §11.10 rule 5)', () => {
  test('brain only freezes the body state; whole body restores the resting state', () => {
    const k = kernel();
    k.setPosture('upright', 1);
    k.advanceTo(8);
    k.setBodyMode('brain', 8);
    k.advanceTo(8.001);
    const frozen = Object.fromEntries([...CV_STATE, 'bladderVol', 'aut.standFrac', 'aut.pPost'].map((n) => [n, k.get(n)]));
    assert.ok(frozen.hr > 75, 'mid-transient when frozen');
    k.schedule(makeStimulus({ sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, tOnset: 10, params: { riseMs: 0.5 } }));
    k.advanceTo(10.3);
    assert.ok(k.get('salience') > 0, 'the brain kept computing');
    k.advanceTo(60);
    for (const [n, v] of Object.entries(frozen)) assert.equal(k.get(n), v, n);
    k.setBodyMode('body', 60);
    k.advanceTo(60.001);
    // Rest of the current switch set and posture (upright) from the resting-state cache.
    const ref = kernel({ settle: false }); ref.set('posture', 1); ref.settle({});
    for (const n of ['hr', 'map', 'pupilD.R']) assert.ok(Math.abs(k.get(n) - ref.get(n)) < 1e-6, `${n} ${k.get(n)} vs ${ref.get(n)}`);
  });
});

// --- 6. Interventions, orgasm commands, thermoregulation ---
describe('interventions (§7.11, §11.12)', () => {
  const run = (p, T = 120) => { const k = kernel(); k.setIntervention(p, 0.5); k.advanceTo(T); return k; };

  test('atropine: HR ≈ 110 (model 108), pupils dilated and unreactive, anhidrosis (§7.11, V3)', () => {
    const k = run(preset('atropine'));
    assert.ok(k.get('hr') > 104 && k.get('hr') < 112, `hr ${k.get('hr')}`);
    assert.ok(Math.abs(k.get('pupilD.R') - 5.3) < 0.01, `pupil ${k.get('pupilD.R')}`);
    assert.ok(k.get('tone.fSudo.palm') < 1e-6 && k.get('tone.sal') < 1e-6);
  });

  test('heart transplant: HR = IHR(donor age) · f_T, no baroreflex HR on standing (§7.11, V4)', () => {
    const k = run(preset('heartTransplant', { donorAge: 40 }));
    assert.ok(Math.abs(k.get('hr') - ihr(40)) < 0.01, `hr ${k.get('hr')}`);
    k.setPosture('upright', 121);
    let dHr = 0; const h0 = k.get('hr');
    while (k.t < 180) { k.advance(0.5); dHr = Math.max(dHr, Math.abs(k.get('hr') - h0)); }
    assert.ok(dHr < 0.01, `ΔHR ${dHr}`);
    assert.ok(k.edgeGate(k.edgeIndex('cardiacPlexus', 'saNode')) === 0, 'cardiac vagal edge cut');
  });

  test('pure autonomic failure: orthostatic fall with near-fixed HR (ΔHR/ΔSBP < 0.5, §7.11, V8)', () => {
    const k = run(preset('pureAutonomicFailure'), 300);
    const h0 = k.get('hr'), s0 = k.get('sbp');
    k.setPosture('upright', 301);
    let dS = 0, dH = 0;
    while (k.t < 480) { k.advance(0.5); dS = Math.max(dS, s0 - k.get('sbp')); dH = Math.max(dH, k.get('hr') - h0); }
    assert.ok(dS >= 20, `SBP fall ${dS}`);
    assert.ok(dH / dS < 0.5, `ΔHR/ΔSBP ${dH / dS}`);
  });

  test('truncal vagotomy: fVagGut 0, heart unaffected; T2–T3 sympathectomy: no palmar SCR; reset with null', () => {
    const k = run(preset('truncalVagotomy')), k0 = kernel();
    assert.ok(k.get('tone.vagGut') < 1e-6 && Math.abs(k.get('hr') - k0.get('hr')) < 1e-9);
    const s = run(preset('sympathectomyT2T3', { side: 'R', stellate: true }));
    s.schedule(makeStimulus({ sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, tOnset: 121, params: { riseMs: 0.5 } }));
    let scr = 0; while (s.t < 130) { s.advance(0.05); scr = Math.max(scr, s.get('scr')); }
    assert.equal(scr, 0);
    assert.ok(s.get('pupilD.R') < s.get('pupilD.L') - 0.2, 'Horner miosis on the operated side');
    s.setIntervention(null, 130); s.advanceTo(400);
    assert.ok(Math.abs(s.get('pupilD.R') - s.get('pupilD.L')) < 1e-6 && s.get('tone.fSudo.palm') > 0.04, 'reset');
  });
});

describe('spinal cord injury (§7.8 rule, §6.15 preset; V19)', () => {
  const run = (p, T = 300) => { const k = new Kernel({ graph: SOM_GRAPH, plugins: SOM_PLUGINS, seed: 1 }); k.setIntervention(p, 0.5); k.advanceTo(T); return k; };
  const bs = (k, seg, s) => k.edgeIndex(`portSymp.${s}`, `cord.${seg}.iml.${s}`);
  test('a cervical lesion cuts every bulbospinal edge and removes the supraspinal sympathetic drive', () => {
    const k0 = new Kernel({ graph: SOM_GRAPH, plugins: SOM_PLUGINS, seed: 1 });
    const k = run(spinalCordInjury({ level: 'C6', phase: 4 }));
    for (const seg of ['T1', 'T3', 'T6', 'L1']) for (const s of ['R', 'L']) assert.equal(k.edgeGate(bs(k, seg, s)), 0, `${seg}.${s}`);
    assert.equal(k.edgeGate(k.edgeIndex('portSacral.R', 'cord.S2.spn.R')), 0, 'sacral column');
    // Chronic phase: the spinal tone is half of rest; the baroreflex cannot raise it, only the vagus moves.
    assert.ok(Math.abs(k.get('tone.symCard') - 0.5 * PARAMS.ch.symCard.rest) < 1e-3, `symCard ${k.get('tone.symCard')}`);
    assert.ok(k.get('map') < k0.get('map') - 5, `map ${k0.get('map')} → ${k.get('map')}`);
    assert.ok(k.get('tone.vagCard') < k0.get('tone.vagCard'), 'vagal tone falls with the pressure (intact baroreflex limb)');
    const k1 = run(spinalCordInjury({ level: 'C6', phase: 1 }));
    assert.ok(k1.get('tone.symCard') < k.get('tone.symCard') && k1.get('map') < k.get('map'), 'spinal shock: lower tone and pressure acutely');
  });

  test('a low thoracic lesion keeps the upper segments: only L1 loses its drive', () => {
    const k = run(spinalCordInjury({ level: 'T10', phase: 4 }));
    for (const s of ['R', 'L']) {
      assert.equal(k.edgeGate(bs(k, 'L1', s)), 0, `L1.${s}`);
      for (const seg of ['T1', 'T3', 'T6']) assert.ok(k.edgeGate(bs(k, seg, s)) > 0, `${seg}.${s} intact`);
    }
    assert.ok(Math.abs(k.get('tone.symCard') - PARAMS.ch.symCard.rest) < 0.02, `symCard ${k.get('tone.symCard')}`);
    k.setIntervention(null, 300); k.advanceTo(700);
    assert.ok(k.edgeGate(bs(k, 'L1', 'R')) > 0, 'reset with null');
  });
});

describe('respiratory sinus arrhythmia (§7.8; §12.20 row 27, V13)', () => {
  test('peak-to-trough at rest (14 breaths/min, VT 0.5 L) inside 5–15 bpm, through the vagal lag', () => {
    const k = kernel();
    let lo = Infinity, hi = -Infinity;
    while (k.t < 30) { k.advance(0.01); if (k.t > 5) { lo = Math.min(lo, k.get('aut.hrInst')); hi = Math.max(hi, k.get('aut.hrInst')); } }
    const pt = hi - lo, base = ihr(30) * (1 + PARAMS.kS * PARAMS.ch.symCard.rest), x = PARAMS.kV * PARAMS.ch.vagCard.rest;
    const wt = 2 * Math.PI * (14 / 60) * PARAMS.ch.vagCard.on, a = PARAMS.resp.rsa / Math.sqrt(1 + wt * wt);
    const model = base / (1 + x * (1 - a)) - base / (1 + x * (1 + a));
    assert.ok(pt > 5 && pt < 15, `RSA ${pt} bpm`);
    assert.ok(Math.abs(pt - model) < 0.3, `RSA ${pt} bpm, analytic ${model}`);
  });
});

describe('orgasm command record (§11.14)', () => {
  const recs = [{ tH: 0, cmdSym: 0, cmdVag: 0, cmdSacral: 0, apnoea: false, omega: 0 },
    { tH: 2, cmdSym: 1, cmdVag: 1, cmdSacral: 0.8, apnoea: true, omega: 0.5 }];
  test('all networks on: the CV layer ignores the record (the adapter passes legacy vitals through)', () => {
    const k = kernel(), k0 = kernel(); k.setExternalCommands({ commands: recs }); k.advanceTo(60); k0.advanceTo(60);
    for (const n of CV_STATE) assert.equal(k.get(n), k0.get(n), n);
  });
  test('switched mode (neuroendocrine off): the record drives HR, the sacral tone and apnoea', () => {
    const k = kernel({ settle: false }); k.set('net.neuroendocrine', 0); k.settle({});
    k.setExternalCommands({ commands: recs }); k.advanceTo(30);
    assert.ok(k.get('hr') > 85, `hr ${k.get('hr')}`);
    assert.ok(k.get('tone.sacral') > 0.7 && k.get('ve') < 0.1, `${k.get('tone.sacral')} ${k.get('ve')}`);
    assert.ok(k.get('paco2') > 40, 'CO₂ rises during the apnoea command');
  });
  test('autonomic off: HR at IHR whatever the record (§11.14)', () => {
    const k = kernel({ settle: false }); k.set('net.autonomic', 0); k.settle({});
    k.setExternalCommands({ commands: recs }); k.advanceTo(30);
    assert.ok(Math.abs(k.get('hr') - 101) < 1e-6);
  });
});

describe('thermoregulation (§7.10, §11.13)', () => {
  test('tSet = 37.0 + tSetShift; tCore relaxes with A = 1.0 on, 0.58 with autonomic off (warming)', () => {
    const stub = { id: 'immune', scope: 'body', order: 60, create: (k) => { k.declare('tSetShift', 0); return {}; } };
    const plugins = [...PLUGINS, stub];
    for (const [aut, A] of [[1, 1.0], [0, 0.58]]) {
      const k = new Kernel({ plugins, seed: 1, settle: false });
      k.set('net.autonomic', aut); k.settle({});
      assert.equal(k.get('tSet'), 37);
      k.set('tSetShift', 1.5);
      k.advanceTo(3600);
      assert.equal(k.get('tSet'), 38.5);
      const want = 38.5 - 1.5 * Math.exp(-A * 3599 / PARAMS.thermo.tauT);
      assert.ok(Math.abs(k.get('tCore') - want) < 0.01, `aut ${aut}: tCore ${k.get('tCore')} vs ${want}`);
      if (aut) assert.ok(k.get('hr') > 70, 'f_T and the chill raise HR');
    }
  });
});

// --- 7. Determinism ---
describe('determinism (A.8 #25, §12.20 row 42)', () => {
  for (const [id, T] of [['standUp', 20], ['loudSound', 6], ['brightLight', 5]]) {
    test(`${id}: two frame-rate schedules give max |Δ| = 0`, () => {
      const play = (frame) => {
        const k = kernel({ settle: false }), p = new ScenarioPlayer({ kernel: k });
        p.select(id); p.play();
        let n = 0;
        const end = p.run.onset + T;
        while (k.t < end) p.advanceTo(Math.min(end, k.t + frame(n++)));
        return k.snapshot();
      };
      const a = play(() => 1 / 60), b = play((n) => 0.0137 * (1 + (n % 7)));
      const w = maxDiff(a, b);
      assert.equal(w.d, 0, `max |Δ| ${w.d} at ${w.path}`);
    });
  }
});
