// Determinism (research/ANALYSIS.md B.14, A.8 #25, A.4, A.5, §11.6): every kernel state at shared
// tH samples is identical (max |Δ| = 0) whatever the frame rate (10, 23.7, 30, 60, 144, 240 fps) and
// whether the SimClock is adaptive or locked, through stimuli of every brain-only sense, network
// switch ramps (including a reversal mid-ramp), the master switch both ways and arousal-state changes.
// The kernel runs the brain plugins (brainnet, sensory). The orgasm scenario is excluded (B.13: its
// legacy clock is tested by orgasm-regression.test.mjs).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph } from '../src/sim/graph.js';
import { SimClock } from '../src/clock.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { makeStimulus } from '../src/sim/stimuli.js';

const PLUGINS = [brainnet, sensory];
const GRAPH = buildGraph({ plugins: PLUGINS });
const FPS = [10, 23.7, 30, 60, 144, 240];
const T_END = 4.3;
const SAMPLES = [0.1, 0.2, 0.2347, 0.5, 0.8312, 1.0, 1.4, 1.75, 2.0, 2.31, 2.9, 3.05, 3.33, 3.6, 3.9, 4.25];

const STIMULI = [
  makeStimulus({ sense: 'hearing', mode: 'click', side: 'both', intensity: 95, tOnset: 0.2 }),
  makeStimulus({ sense: 'vision', mode: 'flash', side: 'R', intensity: 3, tOnset: 0.9 }),
  makeStimulus({ sense: 'smell', mode: 'odour', side: 'L', intensity: 4, tOnset: 2.25, params: { cls: 'food' } }),
  makeStimulus({ sense: 'balance', mode: 'rotation', intensity: 60, durationMs: 1500, tOnset: 2.6 }),
  makeStimulus({ sense: 'taste', mode: 'salty', site: 'tongueAnt', side: 'R', intensity: 10, tOnset: 3.5 }),
  makeStimulus({ sense: 'hearing', mode: 'tone', side: 'R', intensity: 70, tOnset: 3.95 }),
];

// Every event is scheduled at tH 0, before the first frame, so the event list is the same in all runs.
function makeKernel() {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 7 });
  for (const s of STIMULI) k.schedule(s);
  k.setNet('somatic', false, 0.45);
  k.setNet('somatic', true, 1.2);          // reversal mid-ramp
  k.setNet('autonomic', false, 1.6);
  k.setBodyMode('brain', 2.0);
  k.setBodyMode('body', 3.0);
  k.setArousalState('n2', 3.2);
  k.setArousalState('wakeRelaxed', 3.8);
  return k;
}

// Largest absolute difference between two snapshots (typed arrays, arrays, objects, scalars), with
// the path of the first worst entry; a type or length mismatch counts as Infinity.
function maxDiff(a, b, path = '$') {
  if (a === b) return { d: 0, path };
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return { d: 0, path };
    return { d: Math.abs(a - b), path };
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.length !== b.length || a.constructor !== b.constructor) return { d: Infinity, path: `${path}.length` };
    let w = { d: 0, path };
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x === y || (Number.isNaN(x) && Number.isNaN(y))) continue;
      const d = Math.abs(x - y);
      if (d > w.d) w = { d, path: `${path}[${i}]` };
    }
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

// Run the frame loop of B.6 at a fixed frame rate: clock proposal, kernel advance (stopping exactly at
// each sample tH inside the frame), clock commit, adaptive target from the kernel.
function run(fps, mode) {
  const k = makeKernel();
  const clock = new SimClock({ kh: 1 });
  if (mode === 'locked') clock.lock(0.25);
  else for (const s of STIMULI) clock.anticipate(s.tOnset, 0.05, s.tOnset + 0.1);
  const out = [];
  let si = 0, frames = 0;
  while (k.t < T_END && frames < 1e6) {
    const p = clock.advance(1 / fps);
    while (si < SAMPLES.length && SAMPLES[si] <= p.t1H) { k.advanceTo(SAMPLES[si]); out.push(k.snapshot()); si++; }
    k.advanceTo(Math.min(p.t1H, T_END));
    clock.commit(k.t);
    const kt = k.khTarget();
    clock.setAdaptiveTarget(Number.isFinite(kt) ? kt : 1);
    frames++;
  }
  return { out, frames, kernel: k };
}

describe('kernel state identity across frame rates and clock modes (B.14)', () => {
  const ref = run(FPS[0], 'adaptive');

  test('reference run covers every sample and responds to the script', () => {
    assert.equal(ref.out.length, SAMPLES.length);
    // Sanity: the samples are not trivially equal (stimuli, ramps and the master switch acted).
    const base = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 7 }).snapshot();
    assert.ok(maxDiff(ref.out[2].nf.r, base.nf.r).d > 0, 'the click changed NF rates');
    const k = ref.kernel;
    assert.equal(k.bodyMode, 'body');
    assert.equal(k.state.arousalState, 1);
  });

  for (const mode of ['adaptive', 'locked']) {
    for (const fps of FPS) {
      if (mode === 'adaptive' && fps === FPS[0]) continue;
      test(`${mode} clock at ${fps} fps: max |Δ| = 0 at every shared tH`, () => {
        const r = run(fps, mode);
        assert.equal(r.out.length, SAMPLES.length);
        for (let i = 0; i < SAMPLES.length; i++) {
          const w = maxDiff(r.out[i], ref.out[i]);
          assert.equal(w.d, 0, `tH ${SAMPLES[i]}: max |Δ| ${w.d} at ${w.path}`);
        }
      });
    }
  }
});

describe('switch ramps and the master switch (A.5, §11.10)', () => {
  test('network gains ramp linearly over 1 s of tH and reverse mid-ramp', () => {
    const k = makeKernel();
    k.advanceTo(0.95);
    assert.ok(Math.abs(k.g('somatic') - 0.5) < 1e-9, `g at 0.95 s = ${k.g('somatic')}`);
    k.advanceTo(1.3);   // reversal at 1.2 from g = 0.25: back up at 1 per s
    assert.ok(Math.abs(k.g('somatic') - 0.35) < 1e-9, `g at 1.3 s = ${k.g('somatic')}`);
    k.advanceTo(2.0 - 1e-6);
    assert.ok(Math.abs(k.g('autonomic') - 0.6) < 1e-5);
    k.advanceTo(2.5);
    assert.equal(k.bodyMode, 'brain');
    for (const n of ['somatic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune']) assert.equal(k.g(n), 0);
    k.advanceTo(3.1);
    assert.equal(k.bodyMode, 'body');
    assert.equal(k.g('somatic'), 1);
    assert.equal(k.g('autonomic'), 0, 'switch set kept across the master switch');
  });

  test('snapshot and restore reproduce the uninterrupted run (seek, §12.2)', () => {
    const a = makeKernel();
    a.advanceTo(1.0);
    const s = a.snapshot();
    a.advanceTo(T_END);
    const end = a.snapshot();
    const b = makeKernel();
    b.restore(s);
    b.advanceTo(T_END);
    const w = maxDiff(b.snapshot(), end);
    assert.equal(w.d, 0, `max |Δ| ${w.d} at ${w.path}`);
  });
});
