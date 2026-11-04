// Latencies (research/ANALYSIS.md §4.11, §2.14, §4.4, §4.14, §12.20 rows 1–4 and 47–49; B.14 phase 4).
// 1. Table 4.11 recomputed from the §2.14 lengths, the §4.4 velocities and the Table 4.3a synaptic, NMJ
//    and EMG-spread delays (graph.js PARAMS): the event (EV) times and their §12.20 bands.
// 2. The built graph (all seven plugins) carries the §2.14 lengths on its routes (A.9: within 10 %).
// 3. Analytic overlay (stimuli.js predictArrivals, §4.14) against the simulated NF arrivals: within
//    1 ms per relay plus one NF step, as in brainnet.test.mjs.
// 4. §12.20 rows 1–4 and 47–49 on the simulated arrivals. Rows 1, 2 and 47–49 are electrical or
//    near-threshold stimuli in §4.11 (t_rec excluded), so the receptor's t_rec is subtracted; rows 3
//    and 4 are measured from tap onset (§12.20 row 3: "kernel 24.2 from tap onset").

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, PARAMS as G, FIBRE_V, edgeDelay } from '../src/sim/graph.js';
import { makeStimulus, predictArrivals, tRec } from '../src/sim/stimuli.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic } from '../src/sim/somatic.js';
import { plugin as autonomic } from '../src/sim/autonomic.js';
import { plugin as enteric } from '../src/sim/enteric.js';
import { plugin as endocrine } from '../src/sim/endocrine.js';
import { plugin as immune } from '../src/sim/immune.js';

const PLUGINS = [brainnet, sensory, somatic, autonomic, enteric, endocrine, immune];
const GRAPH = buildGraph({ plugins: PLUGINS });
const kernel = () => new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1 });
const HNF = 0.0005;

// --- 1. Table 4.11 from the §2.14 lengths ---
// Segments [mm, m/s]; the CVs are the §4.4 values Table 4.11 names (Aβ65 proximal, Aβ50 distal, DC55,
// ML45, TC35, Ia65, α50).
const seg = (mm, v) => mm / v;   // ms
const T411 = {
  N20: { ms: seg(737 + 24, 65) + seg(100, 55) + seg(73, 45) + seg(60, 35) + 3 * G.tSyn * 1000, ev: 18.7, row: 1, band: [18 - 1, 20 + 1] },
  fingertipS1: { ms: seg(182, 50) + seg(737 + 24, 65) + seg(100, 55) + seg(73, 45) + seg(60, 35) + 3 * G.tSyn * 1000, ev: 22.3, row: 2, band: [21 - 1.5, 24 + 1.5] },
  patellar: { ms: seg(413 + 188, 65) + seg(188 + 413, 50) + G.tSyn * 1000 + (G.nmj + G.emgSpread) * 1000, ev: 23.1, row: 3, band: [18 - 2, 23 + 2] },
  achilles: { ms: seg(676 + 201, 65) + seg(201 + 676, 50) + G.tSyn * 1000 + (G.nmj + G.emgSpread) * 1000, ev: 32.8, row: 4, band: [30 - 2, 36 + 2] },
  N22: { ms: seg(511, 50) + seg(466 + 201, 65) + G.tSyn * 1000, ev: 21.1, row: 47, band: [21 * 0.9, 23 * 1.1] },
  P30: { ms: seg(511, 50) + seg(466 + 201, 65) + seg(420, 55) + G.tSyn * 1000, ev: 28.7, row: 48, band: [30 * 0.9, 30 * 1.1] },
  P37: { ms: seg(511, 50) + seg(466 + 201, 65) + seg(420, 55) + seg(74, 45) + seg(65, 35) + 3 * G.tSyn * 1000, ev: 33.4, row: 49, band: [0, 40 * 1.1] },   // arrival ≤ peak (§5.1)
};

describe('Table 4.11 on the §2.14 lengths (§4.4 velocities, Table 4.3a delays)', () => {
  for (const [id, r] of Object.entries(T411)) {
    test(`${id}: EV ${r.ev} ms, §12.20 row ${r.row}`, (t) => {
      t.diagnostic(`EV ${r.ms.toFixed(2)} ms (Table 4.11 ${r.ev}); band ${r.band.map((x) => x.toFixed(1)).join('–')}`);
      assert.ok(Math.abs(r.ms - r.ev) < 0.1, `${r.ms} vs ${r.ev}`);
      assert.ok(r.ms >= r.band[0] && r.ms <= r.band[1]);
    });
  }
  test('the kernel delay law composes the same terms (§11.4)', () => {
    assert.equal(edgeDelay(601, 50, 0, true), 601 / 50 / 1000 + G.nmj + G.emgSpread);
    assert.equal(FIBRE_V.Ia, 65);
  });
});

// --- 2. §2.14 lengths in the built graph ---
const E = (from, to) => { const e = GRAPH.edges.find((x) => x.fromId === from && x.toId === to); assert.ok(e, `edge ${from} → ${to}`); return e; };
describe('§2.14 path lengths on the graph routes (A.9: within 10 %)', () => {
  const ROUTES = [
    ['index fingertip → C7 segment (919 + 24)', 'rec.indexTip.SA1.R', 'cord.C7.dh.R', 943],
    ['wrist → C7 → cuneate entry (737 + 24 + 100)', 'rec.wrist.Ia.R', 'portDC.R', 861],
    ['cuneate → contralateral VPL', 'cuneate.R', 'thalVPL.L', 73],
    ['gracile → contralateral VPL', 'gracile.R', 'thalVPL.L', 74],
    ['VPL → S1 hand', 'thalVPL.L', 's1.hand.L', 60],
    ['quadriceps → L4 segment (413 + 188)', 'rec.patellarTendon.Ia.R', 'cord.L4.vh.quadriceps.R', 601],
    ['L4 segment → quadriceps', 'cord.L4.vh.quadriceps.R', 'quadriceps.R', 601],
    ['calf → S1 segment (676 + 201)', 'rec.achillesTendon.Ia.R', 'cord.S1.vh.gastrocSoleus.R', 877],
    ['S1 segment → triceps surae', 'cord.S1.vh.gastrocSoleus.R', 'gastrocSoleus.R', 877],
    ['C6 segment → biceps', 'cord.C6.vh.biceps.R', 'biceps.R', 392],
    ['ankle → S1 → gracile entry (977 + 201 + 420)', 'rec.ankle.Ia.R', 'portDC.R', 1598],
  ];
  for (const [label, a, b, mm] of ROUTES) {
    test(label, (t) => {
      const e = E(a, b);
      t.diagnostic(`${e.len.toFixed(0)} mm (§2.14 ${mm})`);
      assert.ok(Math.abs(e.len - mm) <= 0.1 * mm, `${e.len} vs ${mm}`);
    });
  }
  test('VPL → S1 foot (65 mm)', { todo: 'brainnet.js: thalVPL → s1.foot is 78 mm (1.2 × centre distance), +20 % on the §2.14 65 mm' }, () => {
    const e = E('thalVPL.L', 's1.foot.L');
    assert.ok(Math.abs(e.len - 65) <= 6.5, `${e.len}`);
  });
});

// --- 3 and 4. Simulated arrivals ---
// First NF step at which a(t) − a(onset) ≥ 0.1 (the §11.8 threshold), in ms after onset; readouts that
// are kernel variables (EMG) use the scenarios.js EMG threshold 0.1.
function arrivals(spec, nodes, vars = [], until = 0.06) {
  const k = kernel(), t0 = 0.1;
  const rec = makeStimulus({ ...spec, tOnset: t0 });
  const pred = predictArrivals(k, rec, { targets: nodes, relay: true });
  const ev = predictArrivals(k, rec, { targets: nodes, relay: false });
  k.schedule(rec);
  k.advanceTo(t0 - 1e-6);
  const js = nodes.map((n) => k.nfIndex(n)), a0 = js.map((j) => k.a(j)), v0 = vars.map((n) => k.get(n));
  const sim = {};
  for (let n = 1; n * HNF <= until + 1e-12; n++) {
    k.advanceTo(t0 + n * HNF + 1e-7);
    const ms = Math.round(n * HNF * 1e6) / 1000;
    nodes.forEach((id, i) => { if (sim[id] === undefined && k.a(js[i]) - a0[i] >= 0.1) sim[id] = ms; });
    vars.forEach((id, i) => { if (sim[id] === undefined && k.get(id) - v0[i] >= 0.1) sim[id] = ms; });
  }
  return { rec, pred, ev, sim };
}
const WRIST = { sense: 'proprioception', mode: 'imposedMovement', site: 'wrist', side: 'R' };
const TIP = { sense: 'touch', mode: 'press', site: 'indexTip', side: 'R', intensity: 50, durationMs: 50 };
const ANKLE = { sense: 'proprioception', mode: 'imposedMovement', site: 'ankle', side: 'R' };
const tap = (site) => ({ sense: 'proprioception', mode: 'tendonTap', site, side: 'R', intensity: 2 });
const RUNS = {
  wrist: [WRIST, ['cuneate.R', 'thalVPL.L', 's1.hand.L'], [], 'Ia'],
  indexTip: [TIP, ['cuneate.R', 'thalVPL.L', 's1.hand.L'], [], 'SA1'],
  ankle: [ANKLE, ['gracile.R', 'thalVPL.L', 's1.foot.L'], [], 'Ia'],
  patellar: [tap('patellarTendon'), ['cord.L4.vh.quadriceps.R', 'quadriceps.R'], ['emg.quadriceps'], 'Ia'],
  achilles: [tap('achillesTendon'), ['cord.S1.vh.gastrocSoleus.R', 'gastrocSoleus.R'], ['emg.gastrocSoleus'], 'Ia'],
};
const runs = new Map();
const runOf = (id) => { if (!runs.has(id)) { const [spec, nodes, vars] = RUNS[id]; runs.set(id, arrivals(spec, nodes, vars)); } return runs.get(id); };

describe('analytic overlay vs simulated arrivals (§4.14)', () => {
  for (const [id, [, nodes]] of Object.entries(RUNS)) {
    test(`${id}: overlay within 1 ms per relay of the NF arrival; EV ≤ overlay`, (t) => {
      const { pred, ev, sim } = runOf(id);
      for (const n of nodes) {
        assert.ok(pred[n] && sim[n] !== undefined, `${n}: overlay ${pred[n]?.t}, simulated ${sim[n]}`);
        const dt = Math.abs(pred[n].t * 1000 - sim[n]);
        t.diagnostic(`${n}: EV ${(ev[n].t * 1000).toFixed(2)}, overlay ${(pred[n].t * 1000).toFixed(2)}, NF ${sim[n].toFixed(2)} ms (${pred[n].hops} hops)`);
        assert.ok(dt <= pred[n].hops * 1 + HNF * 1000, `${n}: overlay ${(pred[n].t * 1000).toFixed(2)} vs NF ${sim[n]} ms`);
        assert.ok(ev[n].t <= pred[n].t + 1e-12);
      }
    });
  }
  test('EMG onset follows the arrival at the muscle within the NMJ and spread delays (§6.11)', () => {
    for (const [id, muscle, emg] of [['patellar', 'quadriceps.R', 'emg.quadriceps'], ['achilles', 'gastrocSoleus.R', 'emg.gastrocSoleus']]) {
      const { pred, sim } = runOf(id);
      assert.ok(Math.abs(sim[emg] - pred[muscle].t * 1000) <= 1 + HNF * 1000, `${id}: EMG ${sim[emg]} vs overlay ${(pred[muscle].t * 1000).toFixed(2)} ms`);
    }
  });
});

describe('§12.20 rows 1–4 and 47–49 on the simulated arrivals', () => {
  const ROWS = [
    ['row 1: median SEP N20 (wrist → S1 hand)', 'wrist', 's1.hand.L', 'N20', true],
    ['row 2: fingertip → S1', 'indexTip', 's1.hand.L', 'fingertipS1', true],
    ['row 3: quadriceps EMG (knee jerk)', 'patellar', 'emg.quadriceps', 'patellar', false],
    ['row 4: triceps surae EMG (Achilles tap)', 'achilles', 'emg.gastrocSoleus', 'achilles', false],
    ['row 48: tibial P30 (ankle → gracile)', 'ankle', 'gracile.R', 'P30', true],
    ['row 49: tibial P37 (ankle → S1 foot), arrival ≤ peak', 'ankle', 's1.foot.L', 'P37', true],
  ];
  for (const [label, run, node, row, noRec] of ROWS) {
    test(label, (t) => {
      const { rec, sim } = runOf(run);
      const cls = RUNS[run][3], tr = noRec ? tRec(cls, rec) * 1000 : 0;
      const ms = Math.round((sim[node] - tr) * 1000) / 1000;
      const { band } = T411[row];
      t.diagnostic(`${node}: NF ${sim[node]} ms${noRec ? ` − t_rec ${tr} ms = ${ms} ms` : ''}; band ${band.map((x) => x.toFixed(1)).join('–')}`);
      assert.ok(ms >= band[0] && ms <= band[1], `${ms} ms outside ${band.join('–')}`);
    });
  }
  test('row 47: tibial N22 at the S1 dorsal horn', { todo: 'somatic.js: the ankle joint receptors run via L5 straight to portDC; no tibial-at-ankle edge into cord.S1.dh, so there is no N22 arrival to measure (EV 21.1 ms above)' }, () => {
    const { sim } = arrivals(ANKLE, ['cord.S1.dh.R']);
    assert.ok(sim['cord.S1.dh.R'] !== undefined);
  });
});
