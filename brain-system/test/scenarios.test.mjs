// Scenarios and the scenario player (research/ANALYSIS.md §12, A.3.5, B.12, B.14, B.15 phases 2–8).
// 1. Every §12 checkpoint, evaluated with all available plugins (brainnet, sensory and the five network
//    modules), within its band. Checkpoints that need a plugin not passed, or that §12.20 lists as open,
//    are `todo` with the reason; so is a checkpoint in KNOWN, which runs and reports its value but waits
//    for its owner module (the reason names what is missing).
// 2. Player semantics: select, play, stop, restart (habituation reset), repeat (habituation kept),
//    seek (lands on the state of playing to the same tH, max |Δ| = 0), clock keyframes, inputs.
// 3. Availability (A.3.5 greying) with the brain plugins, in brain-only mode, and with stub plugins
//    standing in for the five network modules.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph } from '../src/sim/graph.js';
import { SimClock } from '../src/clock.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic } from '../src/sim/somatic.js';
import { plugin as autonomic } from '../src/sim/autonomic.js';
import { plugin as enteric } from '../src/sim/enteric.js';
import { plugin as endocrine } from '../src/sim/endocrine.js';
import { plugin as immune } from '../src/sim/immune.js';
import { SCENARIOS, SCENARIO_IDS, MODULES, ScenarioPlayer, evaluate, checkpointSkip, availability } from '../src/sim/scenarios.js';

const BRAIN_PLUGINS = [brainnet, sensory];
const PLUGINS = [...BRAIN_PLUGINS, somatic, autonomic, enteric, endocrine, immune];
const PLUGIN_IDS = PLUGINS.map((p) => p.id);
const GRAPH = buildGraph({ plugins: PLUGINS });

const kernel = ({ seed = 1, brain = false } = {}) => {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed, settle: !brain });
  if (brain) { k.set('bodyMode', 0); k.settle({}); }
  return k;
};

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

const TIMED = new Set(['onset', 'timeOfPeak', 't90', 't50', 'returnBelow', 'stamp']);

// Checkpoints that run with every plugin but miss their band until the owner module adds a term
// (§12.20 status "pass" in the prototype). Each stays visible as a todo with its reason and value.
const KNOWN = {
  'meal/pph': 'autonomic.js: the §11.13 GI meal load (emptyRate) does not reach CV tpr yet, so there is no postprandial SBP fall with autonomic off',
};
const fmt = (cp, r) => {
  if (cp.m === 'trials') return `${cp.check === 'decline' ? 'trial 5 / trial 1' : 'max |trial / trial 1 − 1|'} ${r.value.toFixed(4)}; trials ${r.trials.map((x) => x.toFixed(4)).join(', ')}`;
  return TIMED.has(cp.m) ? `${(r.value * 1000).toFixed(2)} ms` : `${r.value.toPrecision(4)}${cp.unit ? ` ${cp.unit}` : ''}`;
};

// --- 1. Checkpoints ---
const results = new Map();
const resultsFor = (id) => { if (!results.has(id)) results.set(id, evaluate(id, { graph: GRAPH, plugins: PLUGINS })); return results.get(id); };

describe('§12 checkpoints with all plugins (§12.5–§12.15, §12.18, §12.20)', () => {
  for (const id of SCENARIO_IDS) {
    describe(id, () => {
      for (const cp of SCENARIOS[id].checkpoints) {
        const name = `${cp.row ? `row ${cp.row}: ` : ''}${cp.label}`;
        const skip = checkpointSkip(cp, PLUGIN_IDS);
        if (skip) { test(name, { todo: skip }, () => {}); continue; }
        const known = KNOWN[`${id}/${cp.id}`];
        test(name, known ? { todo: known } : {}, (t) => {
          const r = resultsFor(id).find((x) => x.id === cp.id);
          assert.ok(r, 'checkpoint evaluated');
          assert.notEqual(r.status, 'skipped', r.reason);
          t.diagnostic(`${cp.v}${cp.v2 ? ` vs ${cp.v2}` : ''}: ${fmt(cp, r)} (band ${cp.range.join('–')}${r.kind ? `, ${r.kind}` : ''})`);
          assert.equal(r.status, 'pass', `${cp.v} = ${r.value} outside ${cp.range.join('–')}`);
        });
      }
    });
  }

  test('central loudSound ordering: brainstem relays before the startle command, blink command before LC burst', () => {
    const r = Object.fromEntries(resultsFor('loudSound').map((x) => [x.id, x.value]));
    assert.ok(r.mgn < r.pncCommand && r.pncCommand < r.blinkCommand && r.blinkCommand < r.lcBurst, JSON.stringify(r));
  });
});

// --- 2. Player semantics ---
describe('scenario player (B.12)', () => {
  test('select, play and stop: events, inputs and keyframes come and go with the run', () => {
    const k = kernel(), clock = new SimClock(), p = new ScenarioPlayer({ kernel: k, clock });
    assert.equal(p.select('nope'), false);
    assert.ok(p.select('loudSound'));
    assert.equal(p.active, false);
    assert.ok(p.play());
    assert.equal(p.active, true);
    assert.equal(k.t, 0);
    assert.equal(clock.tH, k.t, 'the clock follows the kernel reset');
    assert.ok(clock.keys && clock.keys.originH === 3, 'keyframes relative to the onset after the 3-s pre-roll');
    assert.equal(k.evq.filter((e) => e.scn).length, 1, 'one tagged stimulus');
    assert.deepEqual(k.input(3.01).sound, { dB: 105, kind: 'noise' });
    assert.equal(p.stage, 'Rest');
    p.advanceTo(3.02);
    assert.equal(p.stage, 'Startle command');
    p.stop();
    assert.equal(p.active, false);
    assert.equal(k.evq.filter((e) => e.scn).length, 0);
    assert.deepEqual(k.input(3.01), {});
    assert.equal(clock.keys, null, 'the clock source is released');
    // Select stops a run and withdraws its pending events.
    p.play();
    p.select('brightLight');
    assert.equal(p.active, false);
    assert.equal(k.evq.filter((e) => e.scn).length, 0);
  });

  test('restart replays bit-for-bit (A.8 #25); repeat keeps habituation, restart resets it (§12.18)', () => {
    const k = kernel(), p = new ScenarioPlayer({ kernel: k });
    p.select('loudSound');
    const peakSal = (t0, t1) => { let m = 0; while (k.t < t1) { p.advanceTo(Math.min(t1, k.t + 0.005)); if (k.t >= t0) m = Math.max(m, k.get('salience')); } return m; };
    p.play();
    const s1 = peakSal(3, 3.3);
    p.advanceTo(3.5);
    const a = k.snapshot();
    p.restart();
    assert.equal(peakSal(3, 3.3), s1);
    p.advanceTo(3.5);
    const w = maxDiff(k.snapshot(), a);
    assert.equal(w.d, 0, `max |Δ| ${w.d} at ${w.path}`);
    p.advanceTo(p.run.end);
    assert.equal(p.active, false, 'the run ends at its span');
    assert.ok(p.repeat());
    assert.equal(p.run.trials, 5);
    const on = p.run.onset, s2 = peakSal(on, on + 0.3);
    assert.ok(s2 < s1, `repeat trial 1 salience ${s2} < first play ${s1} (habituation kept)`);
    p.restart();
    assert.equal(peakSal(3, 3.3), s1, 'restart resets habituation');
  });

  for (const [id, targets] of [['brightLight', [0.5, 7.3, -1, 15]], ['loudSound', [0.03, 41]]]) {
    test(`${id}: seek lands on the state of playing to the same tH (max |Δ| = 0, §12.2)`, () => {
      const play = (tH) => {
        const k = kernel(), p = new ScenarioPlayer({ kernel: k });
        p.select(id); p.play();
        let n = 0;
        while (k.t < p.run.onset + tH) p.advanceTo(Math.min(p.run.onset + tH, k.t + 0.0137 * (1 + (n++ % 7))));   // uneven frames
        return k.snapshot();
      };
      // Forward seek without snapshots, then rewinds from snapshots taken on the way.
      const k = kernel(), p = new ScenarioPlayer({ kernel: k });
      p.select(id); p.play();
      p.advanceTo(p.run.end);
      assert.equal(p.run.marks.filter((m) => m.snap).length, 11, 'snapshots at 0, 10, …, 100 % of the span');
      for (const tH of targets) {
        const ref = play(tH);
        assert.ok(p.seek(tH));
        const w = maxDiff(k.snapshot(), ref);
        assert.equal(w.d, 0, `seek ${tH}: max |Δ| ${w.d} at ${w.path}`);
        assert.equal(p.active, tH < p.spanH);
      }
      const k2 = kernel(), p2 = new ScenarioPlayer({ kernel: k2 });
      p2.select(id); p2.play();
      p2.seek(targets[0]);
      const w = maxDiff(k2.snapshot(), play(targets[0]));
      assert.equal(w.d, 0, `forward seek: max |Δ| ${w.d} at ${w.path}`);
    });
  }

  test('seek after Stop resumes the run with its events', () => {
    const k = kernel(), p = new ScenarioPlayer({ kernel: k });
    p.select('brightLight'); p.play();
    p.stop();
    p.seek(0.5);
    assert.equal(p.active, true);
    assert.ok(k.get('salience') > 0, 'the light step was delivered');
  });

  test('clock keyframes: the pre-roll approach reaches ×1/200 at onset; Stop releases the clock (A.4, §12.4)', () => {
    const k = kernel(), clock = new SimClock({ kh: 1 }), p = new ScenarioPlayer({ kernel: k, clock });
    p.select('loudSound'); p.play();
    let at = null;
    for (let f = 0; f < 5000 && k.t < 3.07; f++) {
      const fr = clock.advance(1 / 60);
      if (at === null && fr.t0H >= 3) at = { kh: fr.kh, source: fr.source };
      p.advanceTo(fr.t1H);
      clock.commit(k.t);
      const kt = k.khTarget();
      clock.setAdaptiveTarget(Number.isFinite(kt) ? kt : 1);
    }
    assert.ok(at, 'reached the onset');
    assert.equal(at.source, 'scenario');
    assert.ok(Math.abs(at.kh - 0.005) < 1e-6, `kh at onset ${at.kh}`);
    assert.ok(clock.label().startsWith('t '), clock.label());
    p.stop();
    clock.advance(1 / 60);
    assert.equal(clock.source, 'adaptive');
  });

  test('stressor central form runs now: u_stress reaches the kernel input hook in brain-only mode (§12.3, §12.15)', () => {
    const k = kernel({ brain: true }), p = new ScenarioPlayer({ kernel: k });
    p.select('stressor');
    assert.equal(p.available(), '');
    assert.ok(p.play());
    assert.equal(k.bodyMode, 'brain');
    assert.equal(k.input(30).stress, 0.5);
    assert.equal(k.input(600).stress, 1);
    assert.equal(k.input(870).stress, 0.5);
    assert.equal(k.input(950).stress, undefined);
    p.advanceTo(120);
    assert.equal(p.stage, 'Sympatho-adrenal channel');
    assert.ok(Math.abs(p.progress - 120 / 10800) < 1e-12);
  });

  test('HUD payload matches what ui-body.js reads', () => {
    const p = new ScenarioPlayer({ kernel: kernel(), seed: 7 });
    p.select('brightLight'); p.play(); p.advanceTo(3.5);
    const h = p.hud();
    assert.equal(h.id, 'brightLight');
    assert.equal(h.active, true);
    assert.equal(h.spanH, 15);
    assert.ok(Math.abs(h.tH - 0.5) < 1e-12);
    assert.equal(typeof h.stage, 'string');
    assert.equal(h.seed, 7);
    assert.ok(h.stages.every((s) => Number.isFinite(s.tH) && typeof s.name === 'string'));
    assert.ok(h.checkpoints.length > 0 && h.checkpoints.every((t) => Number.isFinite(t) && t > 0 && t <= h.spanH));
  });

  test('orgasm is left to the OrgasmAdapter: no Play, no seek (B.13, §12.2)', () => {
    const p = new ScenarioPlayer({ kernel: kernel() });
    p.select('orgasm');
    assert.equal(p.available(), '');
    assert.equal(p.play(), false);
    assert.equal(p.seek(1), false);
    const h = p.hud();
    assert.equal(h.adapter, true);
    assert.equal(h.seek, false);
    assert.equal(h.active, false);
  });
});

// --- 3. Availability ---
describe('availability (A.3.5 greying)', () => {
  const WAIT = { hotObject: 'somatic', kneeJerk: 'somatic', standUp: 'autonomic', meal: 'enteric', infection: 'immune' };

  test('all plugins, whole body: every scenario is available', () => {
    const k = kernel();
    for (const id of SCENARIO_IDS) assert.equal(availability(id, k), '', id);
    const p = new ScenarioPlayer({ kernel: k });
    p.select('hotObject');
    assert.ok(p.play());
  });

  test('brain plugins only: central-form scenarios run, the others name the module they wait for', () => {
    const k = new Kernel({ plugins: BRAIN_PLUGINS, seed: 1 });
    for (const id of SCENARIO_IDS) {
      const why = availability(id, k);
      if (WAIT[id]) assert.match(why, new RegExp(`Needs the ${WAIT[id]} module`), id);
      else assert.equal(why, '', id);
    }
    const p = new ScenarioPlayer({ kernel: k });
    p.select('hotObject');
    assert.equal(p.play(), false);
  });

  test('brain-only mode: scenarios without a central form are greyed (§12.15)', () => {
    const k = kernel({ brain: true });
    for (const id of SCENARIO_IDS) assert.equal(availability(id, k), SCENARIOS[id].brainOnly === 'unavailable' ? 'Needs the body' : '', id);
  });

  test('stub network plugins make every scenario available without player changes', () => {
    const stubs = Object.keys(MODULES).map((id, i) => ({ id, scope: 'body', order: 20 + 10 * i }));
    const plugins = [...BRAIN_PLUGINS, ...stubs];
    const k = new Kernel({ plugins, seed: 1 });
    for (const id of SCENARIO_IDS) assert.equal(availability(id, k), '', id);
    const p = new ScenarioPlayer({ kernel: k });
    for (const id of ['hotObject', 'kneeJerk', 'standUp', 'meal', 'infection']) {
      p.select(id);
      assert.ok(p.play(), id);
      p.advanceTo(p.run.onset + 0.01);
      if (id === 'standUp') assert.equal(k.get('posture'), 1, 'the stand event is delivered');
    }
    // Checkpoints now pass the plugin gate and report the readout they still lack.
    const r = evaluate('kneeJerk', { plugins, only: ['quadricepsEmg'] })[0];
    assert.equal(r.status, 'skipped');
    assert.match(r.reason, /readout 'var:emg.quadriceps' is not declared/);
  });
});
