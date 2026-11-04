// The integrated frame loop of the app (research/ANALYSIS.md B.6, B.11–B.13, §11.14; src/sim/runtime.js,
// src/wiring.js): the orgasm scenario through the Runtime keeps the post-port call order bit for bit,
// the kernel follows the clock's tH axis, the HUD actions reach the kernel, and kernel packets land on
// the body buffer's geometry paths.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Runtime, PLUGINS } from '../src/sim/runtime.js';
import { buildGraph } from '../src/sim/graph.js';
import { ResponseModel } from '../src/response.js';
import { DopamineModel } from '../src/dopamine.js';
import { SimClock } from '../src/clock.js';
import { OrgasmAdapter } from '../src/sim/orgasm-adapter.js';
import { PacketMap, NetGhost, jointPose } from '../src/wiring.js';
import { PATHS } from '../src/body/geometry.js';

const GRAPH = buildGraph({ plugins: PLUGINS });
const FPS = 60;
// Jittered frame times with paused frames (dt 0), as orgasm-regression.test.mjs uses for main.js.
const dtAt = (f) => (1 / FPS) * (1 + 0.3 * Math.sin(f * 1.7)) * (f % 97 === 5 ? 0 : 1);

describe('Runtime: the orgasm scenario keeps the post-port loop (B.13, §11.14)', () => {
  for (const bodyMode of ['body', 'brain']) {
    test(`${bodyMode === 'body' ? 'whole body' : 'brain only (central form)'}: every model state equals the stand-alone adapter loop`, () => {
      const rt = new Runtime({ graph: GRAPH, bodyMode });
      rt.select('orgasm');
      // main.js before the integration: SimClock + OrgasmAdapter, the per-tick contract only.
      const model = new ResponseModel({ seed: 1 }), dopamine = new DopamineModel();
      const adapter = new OrgasmAdapter(model, dopamine), clock = new SimClock();
      if (bodyMode === 'brain') adapter.setBodyMode('brain');
      adapter.start({ mode: model.mode, profile: model.profileId, hypothesis: dopamine.hypothesis, seed: 1 });
      clock.delegate(adapter.clock);
      for (let f = 0; f < 45 * FPS; f++) {
        const sdt = dtAt(f);
        rt.frame(sdt, { budgetMs: 1 });
        const s = clock.advance(sdt);
        clock.settleDelegate(adapter.advance(sdt, s.t0H, s.h, s.source), adapter.kh);
        model.events.length = 0;
        dopamine.updateVisuals(sdt, model, clock.kh);
        for (const key of ['A', 'G', 'D', 'I', 'H', 'Omega', 'tHuman', 'phase']) assert.equal(rt.model[key], model[key], `frame ${f}: ${key}`);
        assert.equal(rt.clock.tH, clock.tH, `frame ${f}: clock tH`);
        assert.equal(rt.clock.kh, clock.kh, `frame ${f}: kh`);
      }
      assert.deepEqual(Array.from(rt.dopamine.region), Array.from(dopamine.region));
      assert.deepEqual(Array.from(rt.dopamine.da), Array.from(dopamine.da));
      assert.ok(rt.kernel.t <= rt.clock.tH + 1e-9, 'the kernel follows the adapter on the same tH axis');
      assert.equal(rt.clock.source, 'delegate');
      if (bodyMode === 'brain') assert.ok(Object.values(rt.vitals()).every((v) => v === null), 'brain-only vitals read "—" (A.8 #10)');
      else assert.equal(rt.vitals().hr, adapter.vitals().hr, 'all networks on: HR passes through from vitals() (§11.14)');
    });
  }
});

describe('Runtime: whole-body actions (A.5, B.11, B.12)', () => {
  const rt = new Runtime({ graph: GRAPH });
  const frames = (n) => { for (let f = 0; f < n; f++) rt.frame(1 / FPS, { budgetMs: Infinity }); };

  test('at rest the adaptive clock runs at ×1 and the kernel commits the clock time', () => {
    frames(120);
    assert.equal(rt.clock.kh, 1);
    assert.equal(rt.clock.source, 'adaptive');
    assert.ok(Math.abs(rt.kernel.t - rt.clock.tH) < 1e-9);
    assert.ok(Math.abs(rt.vitals().hr - 68) < 1, `HR ${rt.vitals().hr}`);
  });

  test('a manual stimulus is scheduled after the stepwise descent, slows the clock and logs arrivals', () => {
    const now = rt.clock.tH;
    const r = rt.deliver({ sense: 'touch', mode: 'press', site: 'indexTip', side: 'R', intensity: 200, durationMs: 200, params: {}, repeat: { count: 1, intervalS: 20 } });
    assert.ok(r && r.tOnset > now && r.k1 < 0.01, JSON.stringify(r && { tOnset: r.tOnset, k1: r.k1 }));
    const pm = new PacketMap(GRAPH);
    let onBody = 0, afferent = 0;
    for (let f = 0; f < 6 * FPS; f++) {
      rt.frame(1 / FPS, { budgetMs: Infinity });
      const mapped = pm.map(rt.kernel.packets([]), []);
      onBody += mapped.length;
      for (const q of mapped) {
        assert.ok(Number.isInteger(q.pathId) && q.pathId >= 0 && q.pathId < PATHS.length);
        assert.ok(q.uHead >= 0 && q.uHead <= 1);
        if (q.dir === 'aff') afferent++;
      }
    }
    assert.ok(rt.clock.kh < 0.02, `kh ${rt.clock.kh}`);
    assert.ok(onBody > 0 && afferent > 0, `${onBody} packet records on body paths, ${afferent} afferent`);
    assert.ok(rt.events().some((e) => e.event === 'arrival'), 'arrivals in the event log');
  });

  test('switches ramp the kernel gain and the ghost display follows it; interventions round-trip by HUD id', () => {
    rt.lock(1);   // the previous episode left the clock slow; the ramp is 1 s of tH (A.5)
    rt.setNet('enteric', false);
    const ghost = new NetGhost(['enteric']);
    const step = () => { rt.frame(1 / FPS, { budgetMs: Infinity }); ghost.update(rt.kernel, 1 / FPS); };
    for (let f = 0; f < 30 * FPS && rt.kernel.g('enteric') > 0; f++) step();
    assert.equal(rt.kernel.g('enteric'), 0);
    for (let f = 0; f < FPS; f++) step();
    assert.ok(Math.abs(ghost.gains[0] - 0.08) < 1e-6, `ghost ${ghost.gains[0]}`);
    rt.lock(null);
    rt.setNet('enteric', true);
    rt.setIntervention({ id: 'sympathectomy', stellate: false });
    assert.equal(rt.interventionId(), 'sympathectomy', 'the requested preset while its event is pending');
    frames(1);
    assert.equal(rt.kernel.stores._k.intervention, 'sympathectomyT2T3');
    assert.equal(rt.interventionId(), 'sympathectomy');
    rt.select('loudSound');
    assert.ok(rt.play());
    frames(1);
    assert.equal(rt.kernel.stores._k.intervention, 'sympathectomyT2T3', 're-applied after Play');
    rt.setIntervention(null);
    frames(1);
    assert.equal(rt.interventionId(), null);
  });

  test('scenarios play, seek and stop; the master switch stops a body-only scenario', () => {
    rt.select('kneeJerk');
    assert.ok(rt.play());
    frames(60);
    assert.ok(rt.scenarioHud().active);
    assert.ok(rt.seek(1));
    assert.ok(Math.abs(rt.player.tH - 1) < 1e-3 && rt.clock.tH === rt.kernel.t);
    assert.ok(jointPose(rt.kernel).length > 0);
    rt.setBodyMode('brain');
    assert.equal(rt.player.active, false, 'kneeJerk needs the body (A.3.5)');
    assert.equal(rt.unavailable().kneeJerk, 'Needs the body');
    assert.equal(rt.deliver({ sense: 'touch', mode: 'press', site: 'indexTip', side: 'R', intensity: 50, durationMs: 100 }), null);
    assert.ok(rt.deliver({ sense: 'hearing', mode: 'click', site: 'cochlea', side: 'both', intensity: 70 }));
    frames(10);
    rt.setBodyMode('body');
    frames(10);
    assert.ok(rt.kernel.bodyOn && Number.isFinite(rt.vitals().hr));
  });
});
