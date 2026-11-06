// Orgasm scenario, switched-mode vitals (research/ANALYSIS.md §11.14, §12.14 orgasm row, A.8 #21,
// B.13, B.14 orgasm-regression row, phase 5).
// The OrgasmAdapter runs the legacy ResponseModel/DopamineModel on the scenario clock and writes one
// command record per substep; the kernel (all seven plugins) advances to the same tH and reads the
// record zero-order hold (k.command). The HUD vitals follow the §11.14 rule, `hudVitals` below:
//   all networks on        hr, rr, sbp, dbp pass through from vitals() — the regression is exact
//   a network off          the kernel's CV readouts, driven by the command record (§7.15 offsets)
//   brain only             null ("—")
// main.js does not build a Kernel yet; when it does, its HUD should use this rule.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResponseModel } from '../src/response.js';
import { DopamineModel } from '../src/dopamine.js';
import { SimClock } from '../src/clock.js';
import { OrgasmAdapter } from '../src/sim/orgasm-adapter.js';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, NET_IDS } from '../src/sim/graph.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic } from '../src/sim/somatic.js';
import { plugin as autonomic, ihr } from '../src/sim/autonomic.js';
import { plugin as enteric } from '../src/sim/enteric.js';
import { plugin as endocrine } from '../src/sim/endocrine.js';
import { plugin as immune } from '../src/sim/immune.js';

const PLUGINS = [brainnet, sensory, somatic, autonomic, enteric, endocrine, immune];
const GRAPH = buildGraph({ plugins: PLUGINS });
const RUN = { mode: 'demo', profile: 'single', seed: 1 };
const FRAMES = 60 * 60;   // 60 s of screen time at 60 fps: past ignition into the plateau and onset [model]

// §11.14 HUD vitals: pass-through with every network on, the kernel CV layer in switched modes.
function hudVitals(adapter, k) {
  if (!k.bodyOn || adapter.bodyMode === 'brain') return null;
  const switched = NET_IDS.some((n) => k.get(`net.${n}`) === 0);
  if (!switched) return adapter.vitals();
  return { hr: k.get('hr'), rr: k.get('rr'), sbp: k.get('sbp'), dbp: k.get('dbp') };
}

// Adapter + kernel on one tH axis (B.6 order: the adapter advances first, the kernel follows).
function rig({ off = [], brain = false, commands = true } = {}) {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, settle: false });
  for (const n of off) k.set(`net.${n}`, 0);
  if (brain) k.set('bodyMode', 0);
  k.settle({});
  const response = new ResponseModel(), dopamine = new DopamineModel();
  const adapter = new OrgasmAdapter(response, dopamine);
  for (const n of off) adapter.setNet(n, false);
  if (brain) adapter.setBodyMode('brain');
  const clock = new SimClock({ tH: k.t });
  adapter.start(RUN);
  clock.delegate(adapter.clock);
  if (commands) k.setExternalCommands(adapter);
  const frame = (dt = 1 / 60) => {
    const s = clock.advance(dt);
    const t1 = adapter.advance(dt, s.t0H, s.h, s.source);
    clock.settleDelegate(t1, adapter.kh);
    k.advanceTo(t1);
    response.events.length = 0;
    return t1;
  };
  return { k, adapter, response, frame };
}

// Peak of a readout over the run, and the phases the scenario passed.
function play(r, names, frames = FRAMES) {
  const peak = Object.fromEntries(names.map((n) => [n, -Infinity])), low = Object.fromEntries(names.map((n) => [n, Infinity]));
  const phases = new Set();
  for (let f = 0; f < frames; f++) {
    r.frame();
    phases.add(r.response.phase);
    for (const n of names) { const x = r.k.get(n); peak[n] = Math.max(peak[n], x); low[n] = Math.min(low[n], x); }
  }
  return { peak, low, phases };
}

describe('switched-mode vitals of the orgasm scenario (§11.14, §12.14)', () => {
  test('all networks on: HUD vitals equal the legacy vitals() at every frame, and the command record leaves the kernel untouched', () => {
    const r = rig(), r0 = rig({ commands: false });
    // The legacy update(dt) path, same seed and frame times.
    const legacy = new ResponseModel({ seed: RUN.seed });
    legacy.setProfile(RUN.profile); legacy.setMode(RUN.mode);
    const dL = new DopamineModel();
    legacy.onStep = (h, prev) => dL.step(h, legacy, prev);
    let climax = false;
    for (let f = 0; f < FRAMES; f++) {
      r.frame(); r0.frame();
      legacy.update(1 / 60); legacy.events.length = 0;
      const v = legacy.vitals();
      assert.deepEqual(hudVitals(r.adapter, r.k), { hr: v.hr, rr: v.rr, sbp: v.sys, dbp: v.dia }, `frame ${f}`);
      climax ||= r.adapter.climax;
    }
    assert.ok(r.adapter.commands.written > 0, 'command records written');
    assert.ok(climax, 'the run reaches onset');
    for (const n of ['hr', 'sbp', 'dbp', 'tone.sacral', 'tone.symCard', 'tone.vagCard']) assert.equal(r.k.get(n), r0.k.get(n), `${n}: record ignored with every network on`);
    // The respiratory layer follows the arousal drive with every network on (LUNGS.md §8).
    assert.notEqual(r.k.get('paco2'), r0.k.get('paco2'), 'paco2 follows the arousal drive');
  });

  test('neuroendocrine off: the command record drives the autonomic CV layer; HUD vitals come from the kernel', () => {
    const names = ['hr', 'sbp', 'tone.sacral', 'tone.symCard', 'tone.vagCard'];
    const r = rig({ off: ['neuroendocrine'] }), r0 = rig({ off: ['neuroendocrine'], commands: false });
    const a = play(r, names), b = play(r0, names);
    const v = hudVitals(r.adapter, r.k), legacy = r.adapter.vitals();
    assert.equal(v.hr, r.k.get('hr'));
    assert.notEqual(v.hr, legacy.hr, 'not the pass-through');
    assert.ok(a.peak.hr > b.peak.hr + 5, `HR peak ${a.peak.hr} vs ${b.peak.hr} without the record`);
    assert.ok(a.peak['tone.symCard'] > b.peak['tone.symCard'], 'cmdSym offsets the cardiac sympathetic tone');
    assert.ok(a.low['tone.vagCard'] < b.low['tone.vagCard'], 'cmdVag withdraws the cardiac vagal tone');
    assert.ok(a.peak['tone.sacral'] > b.peak['tone.sacral'], 'cmdSacral sets the sacral parasympathetic tone');
    assert.ok(a.phases.has('plateau') || a.phases.has('onset'), [...a.phases].join(','));
  });

  test('autonomic off: HR at IHR(age), tagged intrinsic; BP at the autonomic-off rest; the pelvic command has no effect', () => {
    const names = ['hr', 'sbp', 'dbp', 'tone.sacral'];
    const r = rig({ off: ['autonomic'] }), r0 = rig({ off: ['autonomic'], commands: false });
    const rest = { sbp: r.k.get('sbp'), dbp: r.k.get('dbp') };
    const a = play(r, names), b = play(r0, names);
    assert.ok(Math.abs(a.peak.hr - ihr(30)) < 0.05 && Math.abs(a.low.hr - ihr(30)) < 0.05, `hr ${a.low.hr}–${a.peak.hr}`);
    assert.ok(Math.abs(a.peak.sbp - rest.sbp) < 0.5 && Math.abs(a.low.dbp - rest.dbp) < 0.5, 'BP at the autonomic-off rest');
    for (const n of names) assert.equal(a.peak[n], b.peak[n], `${n}: the record has no peripheral effect`);
    assert.equal(hudVitals(r.adapter, r.k).hr, r.k.get('hr'));
  });

  test('somatic off: the central models are unchanged and the record still drives HR through autonomic', () => {
    const r = rig({ off: ['somatic'] }), ref = rig();
    for (let f = 0; f < FRAMES; f++) { r.frame(); ref.frame(); }
    for (const key of ['A', 'D', 'G', 'sigma', 'phase']) assert.deepEqual(r.response[key], ref.response[key], key);
    assert.equal(hudVitals(r.adapter, r.k).hr, r.k.get('hr'));
    assert.ok(r.k.get('hr') !== ref.adapter.vitals().hr, 'switched: kernel vitals');
  });

  test('brain only: vitals "—" (null); the central form runs', () => {
    const r = rig({ brain: true });
    for (let f = 0; f < 600; f++) r.frame();
    assert.equal(hudVitals(r.adapter, r.k), null);
    assert.equal(r.adapter.vitals(), null);
    assert.ok(r.response.tHuman > 0);
  });
});
