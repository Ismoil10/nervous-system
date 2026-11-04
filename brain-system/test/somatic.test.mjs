// Somatic network plugin (research/ANALYSIS.md §6; §11.10 switches; §12.5, §12.6, §12.8 scenarios;
// §12.20 checkpoints; B.14, B.15 phase 4).
// 1. The graph builds with [brainnet, sensory, somatic] and with [brainnet, somatic]; A.3.3 ids exist.
// 2. Rest is the steady state after settle (every somatic readout and body rate unchanged).
// 3. §12 checkpoints of kneeJerk, the neural part of hotObject and the somatic rows of loudSound, run by
//    scenarios.js evaluate with the somatic plugin passed (scenarios.test.mjs keeps them todo, because it
//    passes the brain plugins only). The hotObject EMG and movement-onset rows also need the §11.9
//    contact-heat transduction delay in stimuli.js tRec; until then they are todo, and the neural part
//    is checked against the §6.10 composition.
// 4. Switch-off (A.5: denervation), brain-only freeze, reflex circuits, gains and interventions (§6.15).
// 5. Determinism: same seed, two frame-rate schedules, max |Δ| = 0 (A.8 #25).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph } from '../src/sim/graph.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic, PARAMS, MUSCLES, JOINTS, INTERVENTIONS, NERVE_SECTIONS, nerveSection, spinalCordInjury, dorsalRhizotomy, cutTargets } from '../src/sim/somatic.js';
import { SCENARIOS, ScenarioPlayer, evaluate, availability } from '../src/sim/scenarios.js';
import { makeStimulus, tRec, RECEPTORS, classesAt } from '../src/sim/stimuli.js';
import { SEGMENTS } from '../src/body/frame.js';

const PLUGINS = [brainnet, sensory, somatic];
const GRAPH = buildGraph({ plugins: PLUGINS });

const kernel = ({ nets = {}, brain = false, init = {}, seed = 1, graph = GRAPH, plugins = PLUGINS } = {}) => {
  const k = new Kernel({ graph, plugins, seed, settle: false });
  for (const [n, on] of Object.entries(nets)) k.set(`net.${n}`, on ? 1 : 0);
  if (brain) k.set('bodyMode', 0);
  k.settle(init);
  return k;
};
const stim = (k, spec, tOnset) => k.schedule({ type: 'stimulus', record: makeStimulus({ ...spec, tOnset }) });
const TAP = { sense: 'proprioception', mode: 'tendonTap', site: 'patellarTendon', side: 'R', intensity: 2 };
const HEAT = { sense: 'pain', mode: 'heat', site: 'palm', side: 'R', intensity: 55, durationMs: 5000 };
const LOUD = { sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, params: { riseMs: 0.5 } };
// Sample readouts (k.get names or NF node ids as a:<id>) every dt from t0 to t1.
function sample(k, names, t0, t1, dt = 0.0005) {
  const read = names.map((n) => (n.startsWith('a:') ? ((j) => () => k.a(j))(k.nfIndex(n.slice(2))) : () => k.get(n)));
  const out = Object.fromEntries(names.map((n) => [n, []])), ts = [];
  for (let t = t0; t <= t1 + 1e-12; t += dt) { k.advanceTo(t); ts.push(t); names.forEach((n, i) => out[n].push(read[i]())); }
  return { ts, ...out };
}
const peak = (xs) => xs.reduce((a, x) => Math.max(a, x), -Infinity);
const onset = (ts, xs, thr, t0) => { const b = xs[0]; for (let i = 0; i < xs.length; i++) if (xs[i] - b >= thr) return ts[i] - t0; return Infinity; };
const SOM_VAR = /^(emg|force|joint)\.|^(shiver|reflexGain|diaphragmExc)$|^som\.(?!lastTick$)/;   // lastTick: NF step bookkeeping

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

// --- 1. Graph ---
describe('graph (§6.2–§6.13, A.3.3)', () => {
  test('builds with brainnet, sensory and somatic; every body node is a somatic sub-network', () => {
    assert.equal(GRAPH.dropped.length, 0, 'no edge dropped');
    const som = GRAPH.nodes.filter((n) => n.plugin === 'somatic');
    assert.ok(som.length > 500, `${som.length} somatic nodes`);
    for (const n of som) {
      assert.ok(['som.aff', 'som.motor'].includes(n.owner), `${n.id} owner ${n.owner}`);
      assert.equal(n.body, true, n.id);
    }
    for (const e of GRAPH.edges.filter((x) => x.plugin === 'somatic' && !(x.fromId.match(/^(prV|spV)\./)))) assert.ok(e.nets & 1, `${e.fromId} → ${e.toId} carries somatic`);
    for (const e of GRAPH.edges) if (typeof e.path === 'string') assert.ok(GRAPH.paths.has(e.path), e.path);
  });

  test('A.3.3 ids: 31 cord segments, DRG, special pools, CPG and the somatic muscles', () => {
    for (const seg of SEGMENTS) for (const s of ['R', 'L']) for (const id of [`cord.${seg}.dh.${s}`, `cord.${seg}.vh.${s}`, `drg.${seg}.${s}`]) assert.ok(GRAPH.index.has(id), id);
    for (const id of ['n11', 'phrenicNuc', 'onuf', 'cpgL.flex', 'cpgL.ext']) for (const s of ['R', 'L']) assert.ok(GRAPH.index.has(`${id}.${s}`), id);
    for (const m of MUSCLES) assert.ok(GRAPH.index.has(m.mid ? m.id : `${m.id}.R`), m.id);
    assert.ok(GRAPH.nodes[GRAPH.index.get('biceps.R')].muscle, 'muscle flag (NMJ + EMG spread on the motor edge, §11.4)');
  });

  test('every body receptor site of A.6 has the classes stimuli.js lists (named sites) or one per submodality', () => {
    const rec = GRAPH.nodes.filter((n) => n.kind === 'receptor' && n.plugin === 'somatic');
    for (const n of rec) assert.ok(n.cls in RECEPTORS && typeof n.site === 'string', n.id);
    for (const site of ['palm', 'indexTip', 'footSole', 'foreheadV1']) {
      const have = new Set(rec.filter((n) => n.site === site && n.side === 'R').map((n) => n.cls));
      for (const c of classesAt(site)) assert.ok(have.has(c), `${site} ${c}`);
    }
    for (const site of ['patellarTendon', 'achillesTendon']) assert.ok(rec.some((n) => n.site === site && n.cls === 'Ia' && n.side === 'L'), site);
    assert.ok(rec.some((n) => n.site === 'umbilicus' && n.side === null), 'midline site');
  });

  test('conduction: the patellar arc composes to the §4.11 event time; withdrawal neural part ≈ 64–67 ms (§6.10)', () => {
    const d = (a, b) => GRAPH.edges.find((e) => e.fromId === a && e.toId === b).delay;
    const knee = d('rec.patellarTendon.Ia.R', 'cord.L4.vh.quadriceps.R') + d('cord.L4.vh.quadriceps.R', 'quadriceps.R');
    assert.ok(knee > 0.0215 && knee < 0.0245, `patellar EV ${(knee * 1000).toFixed(2)} ms (§4.11 23.1 ms)`);
    const hot = d('rec.palm.AMH2.R', 'cord.C7.dh.R') + d('cord.C7.dh.R', 'cord.C7.vh.R') + d('cord.C7.vh.R', 'cord.C6.vh.fra.R')
      + d('cord.C6.vh.fra.R', 'cord.C6.vh.biceps.R') + d('cord.C6.vh.biceps.R', 'biceps.R');
    assert.ok(hot > 0.060 && hot < 0.070, `withdrawal EV ${(hot * 1000).toFixed(1)} ms`);
  });

  test('alone with the brain: [brainnet, somatic] builds and settles; brain-only graphs omit the body fragment', () => {
    const plugins = [brainnet, somatic], g = buildGraph({ plugins });
    assert.equal(g.dropped.length, 0);
    assert.ok(g.index.has('cord.L4.vh.quadriceps.R'));
    const k = new Kernel({ graph: g, plugins, seed: 1 });
    stim(k, TAP, 1);   // no sensory plugin: receptors stay at rest, nothing moves
    k.advanceTo(1.3);
    assert.equal(k.get('emg.quadriceps'), 0);
    const gb = buildGraph({ plugins: PLUGINS, body: false });
    assert.ok(!gb.index.has('cord.C7.dh.R') && gb.index.has('portDC.R'));
  });
});

// --- 2. Rest ---
describe('rest (§11.6)', () => {
  for (const [name, plugins] of [['with sensory', PLUGINS], ['brainnet + somatic', [brainnet, somatic]]]) {
    test(`after settle the somatic state is stationary (${name})`, () => {
      const graph = plugins === PLUGINS ? GRAPH : buildGraph({ plugins });
      const k = kernel({ graph, plugins });
      const names = [...k.varIndex.keys()].filter((n) => SOM_VAR.test(n));
      assert.ok(names.length > 100);
      const before = Object.fromEntries(names.map((n) => [n, k.get(n)]));
      for (const n of names) if (/^(emg|force|joint)\./.test(n)) assert.equal(before[n], 0, n);
      const body = graph.nodes.filter((n) => n.plugin === 'somatic' && n.layer === 'NF').map((n) => k.nfIndex(n.id));
      const r0 = body.map((j) => k.r(j));
      k.advanceTo(5);
      for (const n of names) assert.equal(k.get(n), before[n], n);
      body.forEach((j, q) => assert.equal(k.r(j), r0[q], graph.nodes[k.nf.nodeOf[j]].id));
      assert.equal(k.stores._k.holds.somatic, undefined, 'no NF hold at rest');
      assert.equal(k.get('reflexGain'), 1);
    });
  }
});

// --- 3. Checkpoints (§12.20) ---
const results = new Map();
const resultsFor = (id) => { if (!results.has(id)) results.set(id, evaluate(id, { graph: GRAPH, plugins: PLUGINS })); return results.get(id); };
// Contact-heat transduction (§11.9) is a stimuli.js / sensory.js matter: tRec of the heat nociceptors.
const heatRec = makeStimulus({ ...HEAT, tOnset: 0 });
const CONTACT_HEAT = tRec('AMH2', heatRec) > 0.1;
const TODO_HEAT = 'needs the §11.9 contact-heat transduction delay (stimuli.js tRec for tRecModel "contactHeat"; 224 ms at 55 °C, d 150 µm)';
const SOMATIC_ROWS = { kneeJerk: null, hotObject: null, loudSound: ['blinkEmg', 'neckEmg', 'legEmg', 'blinkHabituation'] };

describe('§12 checkpoints with the somatic plugin (§12.5, §12.6, §12.8, §12.20)', () => {
  for (const [id, only] of Object.entries(SOMATIC_ROWS)) {
    describe(id, () => {
      for (const cp of SCENARIOS[id].checkpoints) {
        if (only && !only.includes(cp.id)) continue;
        if (cp.open || cp.needs.some((p) => !PLUGINS.some((q) => q.id === p))) continue;   // open rows and other modules' rows
        const name = `${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`;
        const heat = id === 'hotObject' && ['withdrawalEmg', 'movementOnset'].includes(cp.id);
        test(name, heat && !CONTACT_HEAT ? { todo: TODO_HEAT } : {}, (t) => {
          const r = resultsFor(id).find((x) => x.id === cp.id);
          assert.notEqual(r.status, 'skipped', r.reason);
          t.diagnostic(`${cp.v}: ${r.trials ? `trials ${r.trials.map((x) => x.toFixed(3)).join(', ')}; ` : ''}${r.value} (band ${cp.range.join('–')})`);
          assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
        });
      }
    });
  }

  test('hotObject neural part: EMG onset − t_rec matches the §6.10 composition; + 224 ms contact heat lands in the §6.11 bands', (t) => {
    const r = Object.fromEntries(resultsFor('hotObject').map((x) => [x.id, x.value]));
    const tr = tRec('AMH2', heatRec), neural = r.withdrawalEmg - tr, move = r.movementOnset - r.withdrawalEmg;
    t.diagnostic(`EMG ${(r.withdrawalEmg * 1000).toFixed(1)} ms, movement ${(r.movementOnset * 1000).toFixed(1)} ms, t_rec ${(tr * 1000).toFixed(1)} ms`);
    assert.ok(neural > 0.060 && neural < 0.080, `neural ${neural}`);
    assert.ok(move > 0.030 && move < 0.060, `EMD + joint filter ${move}`);
    const th = CONTACT_HEAT ? 0 : 0.224;   // §11.9 / §12.5 transduction at 150 µm
    assert.ok(r.withdrawalEmg + th >= 0.25 && r.withdrawalEmg + th <= 0.35);
    assert.ok(r.movementOnset + th >= 0.28 && r.movementOnset + th <= 0.38);
    assert.ok(r.elbowBound > 20 && r.elbowBound <= 30, 'elbow flexion near the A.8 #22 cap');
  });

  test('loudSound ordering: blink before neck before leg (§6.11 cascade)', () => {
    const r = Object.fromEntries(resultsFor('loudSound').map((x) => [x.id, x.value]));
    assert.ok(r.blinkCommand < r.blinkEmg && r.blinkEmg < r.neckEmg && r.neckEmg < r.legEmg, JSON.stringify(r));
  });
});

// --- 4. Behaviour ---
describe('reflexes, switches and interventions', () => {
  test('knee jerk: twitch law peak ≈ 4° at ≈ 155 ms (§6.16, §12.8); reciprocal inhibition of the hamstrings (§6.10)', () => {
    const k = kernel();
    stim(k, TAP, 1);
    const s = sample(k, ['emg.quadriceps', 'force.quadriceps', 'joint.knee', 'a:cord.S1.vh.hamstrings.R'], 1, 1.4);
    const pk = peak(s['joint.knee']), at = s.ts[s['joint.knee'].indexOf(pk)] - 1;
    assert.ok(pk > 3 && pk < 6, `knee ${pk}°`);
    assert.ok(at > 0.12 && at < 0.19, `at ${at}`);
    assert.ok(peak(s['emg.quadriceps']) > 0.6 && peak(s['emg.quadriceps']) < 0.9, 'EMG near the tap law a = 0.71 (§6.11)');
    const ham = s['a:cord.S1.vh.hamstrings.R'];
    assert.ok(Math.min(...ham) < ham[0] - 1e-3, 'antagonist pool inhibited below rest');
    assert.equal(s['joint.knee'].at(-1) < 0.5, true, 'returns toward rest');
  });

  test('somatic off: no tendon-reflex EMG, no movement, silent dorsal-column port; the central startle still computes (A.5, §12.14)', () => {
    const k = kernel({ nets: { somatic: false } });
    assert.equal(k.g('somatic'), 0);
    stim(k, TAP, 1);
    stim(k, LOUD, 2);
    const s = sample(k, ['emg.quadriceps', 'joint.knee', 'a:portDC.R', 'emg.orbicularisOculi', 'emg.sternocleidomastoid', 'a:n7m.R'], 1, 2.4, 0.001);
    assert.equal(peak(s['emg.quadriceps']), 0);
    assert.equal(peak(s['joint.knee']), 0);
    assert.ok(peak(s['a:portDC.R']) < s['a:portDC.R'][0] + 1e-3, 'portDC silent');
    assert.equal(peak(s['emg.orbicularisOculi']), 0, 'no blink EMG (efference only)');
    assert.equal(peak(s['emg.sternocleidomastoid']), 0);
    assert.ok(peak(s['a:n7m.R']) > 0.2, 'n7m command computed');
  });

  test('somatic switched off during a withdrawal: EMG and force relax to 0 by their own kinetics (denervation, §11.10)', () => {
    const k = kernel();
    // Dorsal forearm: no contact break there (§12.3 breaks contact on the palm and fingers only), so the
    // contact-heat withdrawal (§11.9: ≈ 224 ms transduction) is sustained when the switch acts.
    stim(k, { ...HEAT, site: 'forearmDorsal' }, 1);
    k.advanceTo(1.6);
    assert.ok(k.get('emg.biceps') > 0.5 && k.get('joint.elbow') > 20);
    k.setNet('somatic', false, 1.6);
    const s = sample(k, ['emg.biceps', 'force.biceps', 'joint.elbow'], 1.6, 4.5, 0.01);
    const i1 = s.ts.findIndex((t) => t >= 2.0);
    assert.ok(s['emg.biceps'][i1] > 0 && s['emg.biceps'][i1] < s['emg.biceps'][0], 'ramping down over the 1-s gain ramp');
    assert.equal(s['emg.biceps'].at(-1), 0);
    assert.ok(s['force.biceps'].at(-1) < 1e-3 && Math.abs(s['joint.elbow'].at(-1)) < 0.05);
  });

  test('breathing overlay and shivering follow g.somatic; off → 0 (§6.13, A.5)', () => {
    for (const on of [true, false]) {
      const k = kernel({ nets: { somatic: on } });
      k.set('respPhase', 0.2); k.set('vt', 0.5); k.set('tCore', 35.8);
      k.advanceTo(3);
      if (on) {
        assert.ok(k.get('emg.diaphragm') > 0.1 && k.get('diaphragmExc') > 5, `diaphragm ${k.get('emg.diaphragm')} ${k.get('diaphragmExc')}`);
        assert.ok(Math.abs(k.get('shiver') - 0.5) < 1e-9, `shiver ${k.get('shiver')}`);
        assert.ok(k.get('emg.trapezius') >= PARAMS.shiverW * 0.5 - 1e-9, 'shivering glow on trapezius');
        assert.equal(k.get('joint.knee'), 0, 'shivering moves no joint (A.8 #22)');
      } else {
        assert.equal(k.get('emg.diaphragm'), 0); assert.equal(k.get('diaphragmExc'), 0); assert.equal(k.get('shiver'), 0);
      }
    }
  });

  test('brain-only mode freezes the body state; whole body again restores the resting state (A.5)', () => {
    const k = kernel();
    stim(k, HEAT, 1);
    const tf = 1 + tRec('AMH2', heatRec) + 0.13;   // mid-flexion: §11.9 contact heat + the neural part
    k.advanceTo(tf);
    const names = [...k.varIndex.keys()].filter((n) => SOM_VAR.test(n) && !n.startsWith('som.int.'));
    k.setBodyMode('brain', tf);
    k.advanceTo(tf + 0.0005);
    const frozen = Object.fromEntries(names.map((n) => [n, k.get(n)]));
    assert.ok(frozen['joint.elbow'] > 0.5, 'mid-flexion when frozen');
    k.advanceTo(3);
    for (const n of names) assert.equal(k.get(n), frozen[n], n);
    assert.equal(availability('hotObject', k), 'Needs the body');
    assert.equal(availability('kneeJerk', k), 'Needs the body');
    k.setBodyMode('body', 3);
    k.advanceTo(3.001);
    assert.equal(k.get('joint.elbow'), 0);
    assert.equal(k.get('emg.biceps'), 0);
  });

  test('crossed extension only with posture upright (§6.10, §6.11): contralateral quadriceps 10–30 ms after the ipsilateral flexor', () => {
    const run = (posture) => {
      const k = kernel({ init: { posture } });
      stim(k, { sense: 'pain', mode: 'heat', site: 'footSole', side: 'R', intensity: 55, durationMs: 1000 }, 1);
      return sample(k, ['emg.hamstrings.R', 'emg.quadriceps.L', 'emg.quadriceps.R'], 1, 1.4);
    };
    const up = run('upright'), sup = run('supine');
    const tf = onset(up.ts, up['emg.hamstrings.R'], 0.1, 1), tx = onset(up.ts, up['emg.quadriceps.L'], 0.1, 1);
    assert.ok(Number.isFinite(tf), 'ipsilateral flexor withdrawal');
    assert.ok(tx - tf >= 0.010 && tx - tf <= 0.030, `crossed delay ${(tx - tf) * 1000} ms`);
    assert.ok(peak(sup['emg.quadriceps.L']) < 0.05, 'no crossed extension supine (descending background only)');
    assert.ok(peak(up['emg.quadriceps.L']) > 0.3);
    assert.ok(peak(up['emg.quadriceps.R']) < 0.05, 'ipsilateral extensor inhibited');
  });

  test('reflexGain follows the arousal state (§6.11): REM 0.1, deep sleep smaller patellar EMG than wake', () => {
    const k = kernel();
    assert.equal(k.get('reflexGain'), 1);
    const amp = (state) => {
      const kk = kernel({ init: { arousalState: state } });
      stim(kk, TAP, 1);
      return { g: kk.get('reflexGain'), e: peak(sample(kk, ['emg.quadriceps'], 1, 1.06)['emg.quadriceps']) };
    };
    const wake = amp('wakeRelaxed'), n3 = amp('n3'), rem = amp('rem');
    assert.ok(Math.abs(n3.g - 0.6) < 1e-12 && Math.abs(rem.g - 0.1) < 1e-12);
    assert.ok(n3.e < wake.e && rem.e < n3.e, JSON.stringify({ wake, n3, rem }));
  });

  test('startle habituation: blink and neck EMG decline across trials 20 s apart (§6.11, §12.18)', () => {
    const k = kernel();
    const peaks = [];
    for (let i = 0; i < 3; i++) {
      stim(k, LOUD, 1 + 20 * i);
      const s = sample(k, ['emg.orbicularisOculi', 'emg.sternocleidomastoid'], 1 + 20 * i, 1.2 + 20 * i, 0.001);
      peaks.push([peak(s['emg.orbicularisOculi']), peak(s['emg.sternocleidomastoid'])]);
      k.advanceTo(20 * (i + 1));
    }
    assert.ok(peaks[1][0] < peaks[0][0] && peaks[2][0] < peaks[1][0], JSON.stringify(peaks));
    assert.ok(peaks[2][1] < peaks[0][1]);
    assert.ok(Math.abs(k.get('som.gStartle') - 1 / (1 + 0.25 * (Math.exp(-20 / 300) * (1 + Math.exp(-20 / 300))))) < 1e-9);
  });

  test('startle habituation acts on the startle route only: the trigeminal blink to forehead touch keeps its size (§6.10, §6.11)', () => {
    const TOUCH = { sense: 'touch', mode: 'press', site: 'foreheadV1', side: 'R', intensity: 100, durationMs: 50 };
    const blink = (loud) => {
      const k = kernel();
      let t = 1;
      if (loud) for (let i = 0; i < 4; i++) { stim(k, LOUD, t); t += 10; }
      k.advanceTo(t);
      stim(k, TOUCH, t + 1);
      return { e: peak(sample(k, ['emg.orbicularisOculi'], t + 1, t + 1.2, 0.001)['emg.orbicularisOculi']), g: k.get('som.gStartle') };
    };
    const fresh = blink(false), habituated = blink(true);
    assert.ok(habituated.g < 0.7, `startle gain ${habituated.g}`);
    assert.ok(Math.abs(habituated.e - fresh.e) < 0.02 * fresh.e, `forehead blink ${fresh.e} → ${habituated.e}`);
  });

  test('startle limb motion stays under the §6.16 cap (≤ 5°)', () => {
    const k = kernel();
    stim(k, LOUD, 1);
    const s = sample(k, ['joint.elbow', 'joint.knee', 'joint.neck', 'joint.shoulder'], 1, 1.8, 0.002);
    for (const j of ['joint.elbow', 'joint.knee', 'joint.neck', 'joint.shoulder']) assert.ok(peak(s[j]) <= 5 && peak(s[j]) > 0.2, `${j} ${peak(s[j])}`);
  });

  test('intervention catalogue: every preset is data with cut targets and an apply (§6.15, §11.12)', () => {
    assert.equal(INTERVENTIONS.length, 2 * NERVE_SECTIONS.length + PARAMS.sciLevels.length + 6);
    for (const p of INTERVENTIONS) {
      assert.equal(p.net, 'somatic');
      assert.equal(typeof p.apply, 'function');
      const cuts = p.targets(GRAPH);
      assert.ok(cuts.length > 0, `${p.id} cuts something`);
      assert.deepEqual(cuts, cutTargets(GRAPH, p.params));
    }
    assert.equal(new Set(INTERVENTIONS.map((p) => p.id)).size, INTERVENTIONS.length);
    assert.ok(spinalCordInjury({ level: 'C4' }).params.dysreflexia && !spinalCordInjury({ level: 'T10' }).params.dysreflexia, 'T6 flag (§7)');
  });

  test('femoral nerve section abolishes the knee jerk; clearing the preset restores it', () => {
    const k = kernel();
    k.setIntervention(nerveSection({ nerve: 'femoral', side: 'R', day: 5 }), 0.5);
    stim(k, TAP, 1);
    let s = sample(k, ['emg.quadriceps', 'joint.knee', 'som.stumpMotor'], 1, 1.1, 0.001);
    assert.equal(peak(s['emg.quadriceps']), 0);
    assert.ok(Math.abs(s['som.stumpMotor'][0] - (1 - 2 / 6)) < 1e-12, 'distal excitability day 5 (§6.15 model)');
    k.setIntervention(null, 2);
    stim(k, TAP, 3);
    s = sample(k, ['emg.quadriceps'], 3, 3.06, 0.001);
    assert.ok(peak(s['emg.quadriceps']) > 0.5);
  });

  test('musculocutaneous section: no biceps EMG in the withdrawal, deltoid intact; median section: no withdrawal from the palm', () => {
    let k = kernel();
    k.setIntervention(nerveSection({ nerve: 'musculocutaneous', side: 'R' }), 0.5);
    stim(k, HEAT, 1);
    let s = sample(k, ['emg.biceps.R', 'emg.deltoid'], 1, 1.3, 0.002);
    assert.equal(peak(s['emg.biceps.R']), 0);
    assert.ok(peak(s['emg.deltoid']) > 0.3);
    k = kernel();
    k.setIntervention(nerveSection({ nerve: 'median', side: 'R' }), 0.5);
    stim(k, HEAT, 1);
    s = sample(k, ['emg.biceps.R', 'a:cord.C7.dh.R'], 1, 1.3, 0.002);
    assert.equal(peak(s['emg.biceps.R']), 0, 'palm afferents cut (anaesthetic territory)');
    assert.ok(peak(s['a:cord.C7.dh.R']) < 0.01, 'dorsal horn deafferented');
  });

  test('SCI C6 complete: phase 1 areflexia below, phase 4 hyperreflexia (tendon gain 2.5); arm withdrawal from C7 lost', () => {
    const amp = (preset) => {
      const k = kernel();
      if (preset) k.setIntervention(preset, 0.5);
      stim(k, TAP, 1);
      stim(k, HEAT, 2);
      const a = sample(k, ['emg.quadriceps', 'reflexGain'], 1, 1.06, 0.001), b = sample(k, ['emg.biceps'], 2, 2.3, 0.002);
      return { knee: peak(a['emg.quadriceps']), g: a.reflexGain[0], biceps: peak(b['emg.biceps']) };
    };
    const ctl = amp(null), p1 = amp(spinalCordInjury({ level: 'C6', phase: 1 })), p4 = amp(spinalCordInjury({ level: 'C6', phase: 4 }));
    assert.equal(p1.knee, 0); assert.equal(p1.g, 0);
    assert.ok(p4.knee > ctl.knee && Math.abs(p4.g - 2.5) < 1e-12, JSON.stringify({ ctl, p4 }));
    assert.equal(p1.biceps, 0, 'C7 dorsal horn removed at the lesion');
    assert.ok(ctl.biceps > 0.5);
  });

  test('Brown-Séquard (right): ipsilateral dorsal column and CST cut, contralateral STT cut below; dorsal rhizotomy variants', () => {
    const bs = new Set(cutTargets(GRAPH, { kind: 'sci', level: 'T6', type: 'brownSequard', side: 'R' }));
    const eIdx = (a, b) => GRAPH.edges.find((e) => e.fromId === a && e.toId === b).i;
    assert.ok(bs.has(eIdx('rec.footSole.SA1.R', 'portDC.R')), 'right dorsal column');
    assert.ok(!bs.has(eIdx('rec.footSole.SA1.L', 'portDC.L')));
    assert.ok(bs.has(eIdx('cord.L5.dh.L', 'portSTT.R')), 'left-body pain ascends on the right');
    assert.ok(!bs.has(eIdx('cord.L5.dh.R', 'portSTT.L')));
    assert.ok(bs.has(eIdx('portCST.L', 'cord.L4.vh.quadriceps.R')), 'right lateral CST');
    const all = new Set(cutTargets(GRAPH, { kind: 'rhizotomy', segments: ['L4'], side: 'R', variant: 'all' }));
    const large = new Set(cutTargets(GRAPH, { kind: 'rhizotomy', segments: ['L4'], side: 'R', variant: 'largeFibre' }));
    assert.ok(all.has(eIdx('rec.patellarTendon.Ia.R', 'cord.L4.vh.quadriceps.R')) && large.has(eIdx('rec.patellarTendon.Ia.R', 'cord.L4.vh.quadriceps.R')));
    assert.ok(all.has(eIdx('rec.dermatome.L4.AMH2.R', 'cord.L4.dh.R')) && !large.has(eIdx('rec.dermatome.L4.AMH2.R', 'cord.L4.dh.R')), 'Aδ kept (§6.15 large-fibre variant)');
    const k = kernel();
    k.setIntervention(dorsalRhizotomy({ segments: ['L3', 'L4'], side: 'R' }), 0.5);
    stim(k, TAP, 1);
    assert.equal(peak(sample(k, ['emg.quadriceps'], 1, 1.06, 0.001)['emg.quadriceps']), 0, 'stretch reflex through L4 gone');
  });

  test('joints: caps of A.8 #22 and k_j = cap (§6.16)', () => {
    const caps = Object.fromEntries(JOINTS.map((j) => [j.id, j.cap]));
    assert.deepEqual(caps, { elbow: 30, wrist: 20, knee: 15, shoulder: 5, neck: 5 });
  });
});

// --- 5. Determinism ---
describe('determinism (A.8 #25, §12.20 row 42)', () => {
  for (const id of ['kneeJerk', 'hotObject']) {
    test(`${id}: same seed, two frame schedules, max |Δ| = 0`, () => {
      const play = (frames) => {
        const k = kernel(), p = new ScenarioPlayer({ kernel: k });
        p.select(id); assert.ok(p.play());
        const end = p.run.onset + 0.8, snaps = [];
        const marks = [p.run.onset + 0.02, p.run.onset + 0.3, end];
        let n = 0;
        for (const m of marks) { while (k.t < m) p.advanceTo(Math.min(m, k.t + frames(n++))); snaps.push(k.snapshot()); }
        return snaps;
      };
      const a = play(() => 1 / 60 * 0.02), b = play((n) => 0.0013 * (1 + (n % 5)) + 0.00037 * (n % 3));
      a.forEach((s, i) => { const w = maxDiff(s, b[i]); assert.equal(w.d, 0, `mark ${i}: max |Δ| ${w.d} at ${w.path}`); });
    });
  }
});
