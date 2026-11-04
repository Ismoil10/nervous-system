// Brain graph, sensory pipeline and stimuli (research/ANALYSIS.md §3, §4.11, §4.14, §5, A.5, A.6,
// B.4, B.15 phase 2): the graph builds and every edge resolves, body fragments can attach to the
// ports, rest is the steady state, a probe of each brain-only sense reaches its cortical target
// within the §5 arrival window (± the provisional 10 % of §4.11/§12), psi is monotone in intensity,
// sites resolve per sense and mode, the arousal machine, salience and habituation behave as §3.11,
// §3.12 and §5.12 state, and the display activity is rest-normalised (§13.7).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/anatomy.js';
import { buildGraph, BODY_BIT, NET } from '../src/sim/graph.js';
import { Kernel } from '../src/sim/kernel.js';
import { plugin as brainnet, BrainNet, PARAMS as BP, STATES } from '../src/sim/brainnet.js';
import { plugin as sensory, psi } from '../src/sim/sensory.js';
import { SENSES, SENSE_IDS, RECEPTORS, validSites, resolveSite, makeStimulus, predictArrivals } from '../src/sim/stimuli.js';

const PLUGINS = [brainnet, sensory];
const GRAPH = buildGraph({ plugins: PLUGINS });
const kernel = (opts = {}) => new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, ...opts });
const TOL = 0.1;   // provisional ±10 % (§4.11, §12)

// Run a stimulus and return the event-log arrivals (ms from onset) by node id.
function arrivals(k, rec, until) {
  k.schedule(rec);
  k.advanceTo(until);
  const ev = [];
  k.events(ev);
  return { map: Object.fromEntries(ev.filter((e) => e.kind === 'arrival').map((e) => [e.node, e.latencyMs])), ev };
}
const within = (x, lo, hi) => x >= lo * (1 - TOL) && x <= hi * (1 + TOL);

describe('graph (§3.14–§3.16, §11.4)', () => {
  test('builds, ids unique, every edge resolves, no edge dropped', () => {
    assert.equal(GRAPH.dropped.length, 0);
    assert.equal(new Set(GRAPH.nodes.map((n) => n.id)).size, GRAPH.nodes.length);
    for (const e of GRAPH.edges) {
      assert.ok(GRAPH.nodes[e.from] && GRAPH.nodes[e.to], `edge ${e.i}`);
      assert.equal(GRAPH.nodes[e.from].id, e.fromId);
      // Volume edges onto a pool drawn at its midline source may have zero length (layer transport).
      assert.ok(Number.isFinite(e.delay) && (e.delay > 0 || e.transport === 'layer'), `${e.fromId} → ${e.toId} delay`);
      if (typeof e.path === 'string') assert.ok(GRAPH.paths.has(e.path), `path ${e.path}`);
      assert.equal(e.nets & ~BODY_BIT, 0, `brain edge ${e.fromId} → ${e.toId} lists no network`);
    }
    const brainN = GRAPH.nodes.filter((n) => n.plugin === 'brainnet').length;
    const brainE = GRAPH.edges.filter((e) => e.plugin === 'brainnet').length;
    assert.ok(brainN >= 300 && brainE >= 600, `brain fragment ${brainN} nodes, ${brainE} edges`);
  });

  test('A.3.3 brain ids, cortical areas, ports and pools are present', () => {
    const has = (id) => GRAPH.index.has(id) || (GRAPH.index.has(`${id}.R`) && GRAPH.index.has(`${id}.L`));
    const newIds = A.REGION_IDS.slice(A.LEGACY_REGION_COUNT).filter((id) => !['pituitaryPost', 'pineal', 'vtaMedial', 'a14', 'caudate'].includes(id));
    for (const id of [...newIds, 'caudate', 'putamen', 'gpe', 'dr', 'pag', 'amygdala', 'hippocampus', 'pvn']) assert.ok(has(id), id);
    for (const a of A.AREAS) assert.ok(has(a.id), a.id);
    for (const p of A.PORTS) {
      assert.ok(has(p.id), p.id);
      const n = GRAPH.nodes[GRAPH.index.get(p.id) ?? GRAPH.index.get(`${p.id}.R`)];
      assert.equal(n.kind, 'port');
      assert.equal(n.portDir, p.dir);
      if (p.dir === 'aff') assert.equal(n.portNets, p.channels[0].nets.reduce((m, x) => m | NET[x], 0), p.id);
    }
    for (const p of ['modNE', 'modACh', 'mod5HT', 'modHA', 'modOX']) assert.equal(GRAPH.nodes[GRAPH.index.get(p)].layer, 'CV');
    // Midline structures are single nodes (A.3.2).
    for (const id of ['pag', 'dr', 'nodulus', 'areaPostrema', 'portCVO']) assert.ok(GRAPH.index.has(id), id);
  });

  test('crossed routes end on the opposite side and follow the §3.16 lengths', () => {
    const e = (a, b) => GRAPH.edges.find((x) => x.fromId === a && x.toId === b);
    const ml = e('cuneate.R', 'thalVPL.L');
    assert.ok(ml && Math.abs(ml.len - 73.0) < 0.5, `tractML ${ml?.len}`);
    assert.ok(e('cuneate.L', 'thalVPL.R'));
    assert.ok(!e('cuneate.R', 'thalVPL.R'), 'dorsal column–lemniscal route crosses');
    assert.ok(Math.abs(e('lgn.R', 'v1.R').len - 72.6) < 0.5);
    assert.ok(Math.abs(e('m1.hand.R', 'portCST.R').len - 141.4) < 0.5);
    assert.ok(e('portRetina.R', 'lgn.L') && e('portRetina.R', 'lgn.R'), 'each eye reaches both LGN');
    assert.ok(e('dentate.R', 'thalVL.L') && e('pontineNuc.R', 'cerebellum.L'));
  });

  test('a body fragment can attach to the ports (contract §1, A.5)', () => {
    const body = { id: 'testBody', scope: 'body', order: 20,
      fragment(ctx) {
        for (const p of A.PORTS) assert.ok(ctx.has(`${p.id}.R`) || ctx.has(p.id), `port ${p.id} visible to body fragments`);
        return { nodes: [{ id: 'drg.test.R', kind: 'ganglion', owner: 'som.aff', pos: [40, -40, -300], side: 'R' }],
          edges: [{ from: 'drg.test.R', to: 'portDC.R', kind: 'axon', fibre: 'Abeta', nets: ['somatic'] }] };
      } };
    const g = buildGraph({ plugins: [...PLUGINS, body] });
    const e = g.edges.find((x) => x.fromId === 'drg.test.R');
    assert.equal(e.dir, 'aff');
    assert.equal(e.nets, NET.somatic | BODY_BIT);
    const gb = buildGraph({ plugins: [...PLUGINS, body], body: false });
    assert.ok(!gb.index.has('drg.test.R') && gb.index.has('portDC.R'));
  });
});

describe('rest (§11.6, Table 4.8e)', () => {
  test('rest is the steady state: 30 s of tH change no rate, pool or display value', () => {
    const k = kernel();
    const r0 = Float64Array.from(k.nf.r);
    for (let j = 0; j < k.nf.N; j++) assert.ok(Math.abs(r0[j] - k.nf.rest[j]) < 1e-9);
    k.advanceTo(30);
    let d = 0;
    for (let j = 0; j < k.nf.N; j++) d = Math.max(d, Math.abs(k.nf.r[j] - r0[j]));
    assert.ok(d < 1e-9, `max |Δr| ${d}`);
    for (const p of ['modNE', 'modACh', 'mod5HT', 'modHA', 'modOX']) assert.equal(k.state[p], 1, p);
    assert.equal(k.state.salience, 0);
    assert.equal(k.state.arousalState, STATES.indexOf('wakeRelaxed'));
    const bn = k.plugin('brainnet');
    const { activity, areaActivity } = bn.computeActivity();
    assert.ok(activity.every((v) => Math.abs(v - 1) < 1e-9) && areaActivity.every((v) => Math.abs(v - 1) < 1e-9));
    assert.ok(bn.activity.length === 2 * A.REGION_COUNT && bn.areaActivity.length >= 2 * A.AREAS.length);
  });

  test('GPi, GPe, STN, Purkinje and LC sit at their §3 resting rates', () => {
    const k = kernel();
    for (const [id, hz] of [['gpi.R', 70], ['gpe.R', 60], ['stn.R', 20], ['cerebellum.R', 60], ['lc.R', 2], ['putamen.L', 1]]) {
      assert.ok(Math.abs(k.rate(id) - hz) < 1e-6, `${id} ${k.rate(id)}`);
    }
  });
});

describe('brain-only senses reach their cortical targets (§5.2–§5.9, §4.11 tolerance)', () => {
  test('vision: flash +3 log cd/m² → LGN, V1 of both hemispheres in 40–60 ms', () => {
    const { map } = arrivals(kernel(), makeStimulus({ sense: 'vision', mode: 'flash', side: 'R', tOnset: 0.1 }), 0.4);
    for (const n of ['v1.R', 'v1.L']) assert.ok(within(map[n], 40, 60), `${n} ${map[n]} ms`);
    assert.ok(within(map['lgn.L'], 33, 50), `lgn ${map['lgn.L']} ms`);
  });

  test('hearing: 75 dB click → contralateral A1 in 12–15 ms, stations in order', () => {
    const { map } = arrivals(kernel(), makeStimulus({ sense: 'hearing', mode: 'click', side: 'R', intensity: 75, tOnset: 0.1 }), 0.3);
    assert.ok(within(map['a1.L'], 12, 15), `a1.L ${map['a1.L']} ms`);
    assert.ok(within(map['mgn.L'], 8, 10), `mgn.L ${map['mgn.L']} ms`);
    const order = ['cochNuc.R', 'soc.L', 'ic.L', 'mgn.L', 'a1.L'].map((n) => map[n]);
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `order ${order}`);
  });

  test('taste: 10 × threshold NaCl → gust ≈ 93 ms; sweet ≈ 172 ms', () => {
    const salty = arrivals(kernel(), makeStimulus({ sense: 'taste', mode: 'salty', site: 'tongueAnt', side: 'R', tOnset: 0.1 }), 0.5).map;
    assert.ok(within(salty['gust.R'], 93, 93), `gust ${salty['gust.R']} ms`);
    const sweet = arrivals(kernel(), makeStimulus({ sense: 'taste', mode: 'sweet', site: 'tongueAnt', side: 'R', tOnset: 0.1 }), 0.6).map;
    assert.ok(within(sweet['gust.R'], 172, 172), `gust (sweet) ${sweet['gust.R']} ms`);
  });

  test('smell: 2 log × threshold → olfBulb then piriform after the ORN onset (100–400 ms), before N1 (≤ 450 ms)', () => {
    const { map } = arrivals(kernel(), makeStimulus({ sense: 'smell', mode: 'odour', side: 'R', tOnset: 0.1 }), 0.9);
    assert.ok(map['olfBulb.R'] < map['piriform.R']);
    assert.ok(map['piriform.R'] >= 100 && map['piriform.R'] <= 450, `piriform ${map['piriform.R']} ms`);
    assert.ok(!('thalVPL.R' in map), 'no thalamic first relay (§5.7)');
  });

  test('balance: yaw 60 deg/s → vestNuc, VPL and PIVC during the rotation (no cortical target adopted, §5.9)', () => {
    const rec = makeStimulus({ sense: 'balance', mode: 'rotation', durationMs: 3000, tOnset: 0.1 });
    const { map } = arrivals(kernel(), rec, 3.1);
    for (const n of ['vestNuc.R', 'thalVPL.R', 'pivc.R']) assert.ok(map[n] > 0 && map[n] < rec.durationMs, `${n} ${map[n]}`);
    assert.ok(map['vestNuc.R'] < map['thalVPL.R'] && map['thalVPL.R'] < map['pivc.R']);
  });

  test('analytic overlay (§4.14) matches the simulated arrivals within 1 ms per relay', () => {
    for (const [rec, targets] of [
      [makeStimulus({ sense: 'hearing', mode: 'click', side: 'R', intensity: 90, tOnset: 0.1 }), ['cochNuc.R', 'mgn.L', 'a1.L']],
      [makeStimulus({ sense: 'vision', mode: 'flash', side: 'both', tOnset: 0.1 }), ['lgn.R', 'v1.R']],
    ]) {
      const k = kernel();
      const pred = predictArrivals(k, rec, { targets, relay: true });
      const { map } = arrivals(k, rec, 0.4);
      for (const n of targets) {
        assert.ok(pred[n], n);
        const dt = Math.abs(pred[n].t * 1000 - map[n]);
        assert.ok(dt <= pred[n].hops * 1 + 0.5, `${n}: overlay ${(pred[n].t * 1000).toFixed(1)} vs simulated ${map[n]} ms`);
      }
    }
  });

  test('brain-only mode: special senses unchanged, non-special afferent ports fall silent (A.5, §3.18)', () => {
    const k = kernel();
    k.setBodyMode('brain', 0);
    k.advanceTo(2);
    assert.ok(k.rate('portDC.R') < 5 && k.rate('portVisc.R') < 5, `portDC ${k.rate('portDC.R')}`);
    assert.ok(k.rate('ntsVisc.R') < k.nf.rest[k.nfIndex('ntsVisc.R')], 'NTS baseline falls');
    assert.ok(Math.abs(k.rate('portCoch.R') - 15) < 1e-6, 'special port keeps its rest');
    const rec = makeStimulus({ sense: 'hearing', mode: 'click', side: 'R', intensity: 75, tOnset: 2.1 });
    const ref = arrivals(kernel(), { ...rec, tOnset: 0.1 }, 0.3).map['a1.L'];
    assert.ok(Math.abs(arrivals(k, rec, 2.3).map['a1.L'] - ref) < 1e-6, 'same NF step');
    assert.deepEqual(validSites('touch', { bodyMode: 'brain' }), []);
  });
});

describe('psi and stimuli (§4.10, §5.13–§5.14, A.6)', () => {
  test('psi is 0 at threshold and monotone in intensity for every mode', () => {
    for (const sense of SENSE_IDS) for (const [mode, M] of Object.entries(SENSES[sense].modes)) {
      const site = validSites(sense, { mode })[0];
      // Monotone in stimulus strength, i.e. along the continuum (for cold, a lower temperature).
      const up = M.psi.toI(M.param.max, {}) >= M.psi.toI(M.param.min, {});
      let prev = { psi: -1, psiN: -1 };
      for (let i = 0; i <= 40; i++) {
        const f = up ? i / 40 : 1 - i / 40;
        const v = M.param.min + (M.param.max - M.param.min) * f;
        const p = psi(makeStimulus({ sense, mode, site, intensity: v }));
        assert.ok(p.psi >= prev.psi && p.psiN >= prev.psiN, `${sense} ${mode} at ${v}`);
        assert.ok(p.psiN >= 0 && p.psiN <= 1);
        prev = p;
      }
      if (Number.isFinite(M.psi.I0)) {
        const lo = psi(makeStimulus({ sense, mode, site, intensity: up ? M.param.min : M.param.max }));
        const hi = psi(makeStimulus({ sense, mode, site, intensity: up ? M.param.max : M.param.min }));
        assert.ok(hi.psi > lo.psi, `${sense} ${mode} increases`);
      }
    }
    assert.equal(psi(makeStimulus({ sense: 'hearing', mode: 'tone', intensity: 0 })).psi, 0);
    assert.equal(psi(makeStimulus({ sense: 'interoception', mode: 'baroStep' })).psi, 0, 'baroStep is not perceived');
  });

  test('validSites per sense, mode and body mode', () => {
    assert.deepEqual(validSites('vision'), ['retina']);
    assert.deepEqual(validSites('taste'), ['tongueAnt', 'tonguePost']);
    assert.deepEqual(validSites('balance', { bodyMode: 'brain' }), ['vestLabyrinth']);
    for (const s of ['touch', 'pain', 'temperature', 'proprioception', 'interoception']) assert.deepEqual(validSites(s, { bodyMode: 'brain' }), []);
    assert.ok(validSites('touch').includes('dermatome.C2') && validSites('touch').includes('dermatome.S3'));
    assert.ok(!validSites('touch').includes('dermatome.S4'), 'S4–S5 not pickable (A.1)');
    assert.deepEqual(validSites('proprioception', { mode: 'tendonTap' }), ['bicepsTendon', 'tricepsTendon', 'patellarTendon', 'achillesTendon']);
    assert.throws(() => validSites('sixth'));
  });

  test('resolveSite: sides, ports and validity', () => {
    const r = resolveSite('retina', { sense: 'vision' });
    assert.equal(r.side, 'both'); assert.deepEqual(r.sides, ['R', 'L']); assert.deepEqual(r.ports, ['portRetina']);
    assert.deepEqual(r.classes, ['cone', 'rod', 'ip']);
    assert.equal(resolveSite('cochlea', { sense: 'hearing', side: 'L' }).sides[0], 'L');
    assert.equal(resolveSite('tongueAnt', { sense: 'taste', side: 'both' }), null, 'tongue: L/R only (§5.14)');
    assert.equal(resolveSite('retina', { sense: 'hearing' }), null);
    assert.equal(resolveSite('indexTip', { sense: 'touch', bodyMode: 'brain' }), null);
    assert.deepEqual(resolveSite('cheekV2', { sense: 'touch' }).ports, ['portTrig']);
    assert.equal(resolveSite('umbilicus', { sense: 'touch' }).side, null);
    assert.equal(resolveSite('vestLabyrinth', { sense: 'balance' }).side, 'both');
    assert.equal(resolveSite('nowhere'), null);
  });

  test('makeStimulus: §5.14 defaults, clamping and secondary parameters', () => {
    const v = makeStimulus({ sense: 'vision' });
    assert.deepEqual([v.mode, v.site, v.side, v.intensity, v.unit, v.durationMs, v.tOnset], ['flash', 'retina', 'both', 3, 'log10 cd/m²', 10, 0]);
    const h = makeStimulus({ sense: 'hearing', mode: 'tone', intensity: 200, durationMs: 5, params: { freq: 20000 } });
    assert.deepEqual([h.intensity, h.durationMs, h.params.freq, h.params.riseMs], [130, 10, 8000, 5]);
    assert.equal(makeStimulus({ sense: 'pain', mode: 'heat' }).intensity, 50);
    assert.equal(makeStimulus({ sense: 'smell' }).params.cls, 'food');
    assert.equal(makeStimulus({ sense: 'proprioception', mode: 'imposedMovement', site: 'knee', intensity: 5, params: { velocity: 10 } }).durationMs, 500);
    assert.throws(() => makeStimulus({ sense: 'taste', mode: 'spicy' }));
    assert.throws(() => makeStimulus({ sense: 'vision', site: 'cochlea' }));
    for (const c of Object.keys(RECEPTORS)) assert.ok(RECEPTORS[c].I0 >= 0 && RECEPTORS[c].tauA.every((x) => x > 0), c);
  });
});

describe('arousal, salience and habituation (§3.11, §3.12, §4.9, §5.12)', () => {
  test('a forced state moves the pools to the §3.11 table and sets the relay gain', () => {
    const k = kernel();
    k.setArousalState('n2', 0);
    k.advanceTo(120);
    const P = BP.states.n2;
    for (const [pool, v] of [['modNE', P.NE], ['mod5HT', P.HT], ['modHA', P.HA], ['modACh', P.ACh], ['modOX', P.OX]]) {
      assert.ok(Math.abs(k.state[pool] - v) < 0.02, `${pool} ${k.state[pool]} vs ${v}`);
    }
    assert.ok(Math.abs(k.rate('lc.R') - P.lc) < 0.02 * 50);
    assert.equal(k.get('gain.relay'), P.relay);
    k.setArousalState('wakeRelaxed', 120);
    k.advanceTo(300);
    for (const pool of ['modNE', 'mod5HT', 'modHA', 'modACh', 'modOX']) assert.ok(Math.abs(k.state[pool] - 1) < 0.01, `${pool} ${k.state[pool]}`);
  });

  test('a salient stimulus fires one LC burst; a loud sound wakes from N2, a soft one gives a K-complex', () => {
    const k = kernel();
    k.schedule(makeStimulus({ sense: 'hearing', mode: 'click', intensity: 110, tOnset: 0.1 }));
    k.advanceTo(0.25);
    const burst = k.rate('lc.R');
    assert.ok(k.state.lcPhasic > 0 && burst > 10, `lc ${burst}`);
    assert.ok(k.get('bn.gNE') > 1);
    k.advanceTo(0.45);
    assert.ok(k.rate('lc.R') < 0.5 * burst, 'post-burst suppression');
    k.schedule(makeStimulus({ sense: 'hearing', mode: 'click', intensity: 110, tOnset: 0.46 }));   // inside the suppression
    k.advanceTo(1.2);
    const ev = []; k.events(ev);
    assert.equal(ev.filter((e) => e.kind === 'lcPhasic').length, 1, 'no second burst during suppression');
    assert.equal(k.state.lcPhasic, 0);
    const s = kernel();
    s.setArousalState('n2', 0);
    s.advanceTo(60);
    s.schedule(makeStimulus({ sense: 'hearing', mode: 'tone', intensity: 50, tOnset: 60.1 }));
    s.advanceTo(61);
    const evs = []; s.events(evs);
    assert.ok(evs.some((e) => e.kind === 'kcomplex'));
    assert.equal(s.state.arousalState, STATES.indexOf('n2'));
    // θ_s × 2.5 in N2: a 120-dB tone 10 s later (habituation g 0.8 after the soft tone) wakes the model.
    s.schedule(makeStimulus({ sense: 'hearing', mode: 'tone', intensity: 120, tOnset: 70.1 }));
    s.advanceTo(71);
    assert.equal(s.state.arousalState, STATES.indexOf('wakeAlert'));
  });

  test('after a salient event the network returns to its resting state (no self-sustaining loop)', () => {
    const k = kernel();
    k.schedule(makeStimulus({ sense: 'hearing', mode: 'click', intensity: 110, tOnset: 0.1 }));
    k.advanceTo(0.4);
    assert.ok(k.rate('dacc.R') > 10 && k.rate('dacc.R') < 60, `dACC ${k.rate('dacc.R')}`);
    k.advanceTo(60);
    let worst = 0;
    for (let j = 0; j < k.nf.N; j++) worst = Math.max(worst, Math.abs(k.nf.r[j] - k.nf.rest[j]) / k.nf.rmax[j]);
    assert.ok(worst < 1e-4, `max |r − rest| / rmax = ${worst}`);
    assert.equal(k.get('bn.gNE'), 1);
  });

  test('repeated identical stimuli habituate salience (k_hab 0.25, τ_rec 300 s, ρ 1)', () => {
    const k = kernel();
    const sal = [];
    for (let i = 0; i < 5; i++) {
      const t0 = 1 + 20 * i;
      k.schedule(makeStimulus({ sense: 'hearing', mode: 'click', intensity: 100, tOnset: t0 }));
      k.advanceTo(t0 + 0.001);
      sal.push(k.state.salience);
    }
    for (let i = 1; i < sal.length; i++) assert.ok(sal[i] < sal[i - 1], `salience ${sal.map((x) => x.toFixed(3))}`);
    // g_hab at trial 5 with a 20-s interval ≈ 0.54 (§5.12): salience ratio to trial 1.
    assert.ok(Math.abs(sal[4] / sal[0] - 0.54) < 0.03, `trial 5 / trial 1 = ${(sal[4] / sal[0]).toFixed(3)}`);
  });

  test('auto mode: sleep onset when procS crosses H⁺ (§3.11)', () => {
    const k = kernel();
    k.settle({ timeOfDay: 23 * 3600 + 5 * 60 });
    k.setArousalState('auto', 0);
    k.advanceTo(15 * 60);
    assert.ok([2, 3, 4].includes(k.state.arousalState), `state ${STATES[k.state.arousalState]}`);
    assert.ok(k.state.procS > 0.55 && k.state.procS < 0.65, `procS ${k.state.procS}`);
  });

  test('display activity is rest-normalised and sided (§11.15, §13.7)', () => {
    const k = kernel();
    k.schedule(makeStimulus({ sense: 'vision', mode: 'flash', side: 'R', tOnset: 0.1 }));
    k.advanceTo(0.15);
    const bn = k.plugin('brainnet');
    const { activity, areaActivity } = bn.computeActivity();
    const lgn = A.R.lgn, v1 = A.AREA.v1;
    assert.ok(activity[2 * lgn] > 1 && activity[2 * lgn + 1] > 1);
    assert.ok(areaActivity[2 * v1] > 1 && areaActivity[2 * v1] <= BP.display.max);
    assert.equal(activity[2 * A.R.pag], activity[2 * A.R.pag + 1], 'midline region: both columns');
    bn.updateVisuals(0.3);
    assert.ok(bn.activity[2 * lgn] > 1 && bn.activity[2 * lgn] < activity[2 * lgn], 'low-passed in screen time');
    bn.setTints(['NE', 'ACh', '5HT', 'HA', 'OX']);
    assert.equal(bn._tintSet.length, 4, '≤ 4 tints (§13.6)');
    assert.ok(bn.tint[(2 * A.R.lc) * 4 + 3] > 0);
    assert.equal(BrainNet.STATES, STATES);
  });
});
