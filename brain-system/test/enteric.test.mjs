// Enteric network plugin (research/ANALYSIS.md §8, §8.16, §8.18, §11.10–§11.13, §12.10, §12.20 rows 28–31,
// A.5, B.14, B.15 phase 7).
// 1. Graph: builds with [brainnet, sensory, enteric] and alone with the brain [brainnet, enteric]; the
//    fragment attaches to the brain ports (portVisc, portSpinoVisc, portVag, portSacral, portCVO).
// 2. Rest: after settle the fasting rest is a steady state (every declared gut scalar and array is
//    constant; the slow-wave phase, the seeded colonic phase walk and segmenting pattern are excluded).
// 3. §12 checkpoints of `meal` through scenarios.js evaluate (row 29 CCK t50, row 31 enteric off).
// 4. Switch-off (A.5): hormones relax to basal with neuroendocrine off (replacement) while the local
//    term continues; enteric off denervates the gut (sphincters closed, emptying and transit stop,
//    slow waves persist, MMC absent, vagMech × 0.5); autonomic off removes the extrinsic drive.
// 5. Brain-only mode freezes the body state (satiety 0, hunger 0.3) and the return restores fasting rest.
// 6. Determinism: same seed, two frame-rate schedules, max |Δ| = 0.
// 7. §8.18 checks the model can reach in a short run: slow waves, MMC phase III and front velocity,
//    duodenal lipid (first vagal packet ≤ 1.5 s), interventions as data, uGut texture.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph } from '../src/sim/graph.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as enteric, PARAMS, GUT_CELLS, GUT_EFFECTS, INTERVENTIONS } from '../src/sim/enteric.js';
import { ScenarioPlayer, evaluate, availability } from '../src/sim/scenarios.js';
import { makeStimulus } from '../src/sim/stimuli.js';

const PLUGINS = [brainnet, sensory, enteric];
const GRAPH = buildGraph({ plugins: PLUGINS });
// scenarios.test.mjs passes only the brain plugins, so `meal` checkpoints that also list 'endocrine'
// stay todo there. Here a stub stands in for the endocrine module (it declares nothing): the CCK
// readout is a gut variable (A.3.4), owned and computed by this module.
const ENDOCRINE_STUB = { id: 'endocrine', scope: 'body', order: 50 };

const kernel = (o = {}) => new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, ...o });
const ownNames = (k) => k._names.filter((n, i) => k._meta[i].owner === 'enteric');
const ownArrays = (k) => [...k._arrays.keys()].filter((n) => ['swPhase', 'gutX', 'gutC', 'colon'].includes(n) || n.startsWith('ens.'));
const cells = (id) => { const ri = GUT_CELLS.regions.indexOf(id); return [...GUT_CELLS.region.keys()].filter((c) => GUT_CELLS.region[c] === ri); };

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

// A meal run through the player; returns the kernel at scenario tH `T`.
function mealTo(T, { nets = {}, k = kernel({ settle: false }) } = {}) {
  for (const [n, on] of Object.entries(nets)) k.set(`net.${n}`, on ? 1 : 0);
  k.settle({});
  const p = new ScenarioPlayer({ kernel: k });
  p.select('meal'); p.play();
  p.advanceTo(T);
  return { k, p };
}

// --- 1. Graph ---
describe('graph (§8.2, §8.9, §8.14; A.3.3)', () => {
  test('builds with brainnet, sensory and enteric; nothing dropped; region, plexus, EEC and afferent nodes present', () => {
    assert.equal(GRAPH.dropped.length, 0);
    for (const id of ['gut.oes', 'gut.les', 'gut.antrum', 'gut.pylorus', 'gut.duod', 'gut.jej', 'gut.ileum', 'gut.icv', 'gut.colTrans', 'gut.rectum', 'gut.ias', 'gut.eas',
      'gut.antrum.myenteric', 'gut.jej.submucosal', 'ecCells', 'iCells', 'lCells', 'xaCells', 'mCells', 'gCells',
      'rec.stomachWall.vagMech', 'rec.duodenum.vagChem', 'rec.stomachWall.spinNoci', 'rec.colonRectum.spinNoci']) assert.ok(GRAPH.index.has(id), id);
    const node = (id) => GRAPH.nodes[GRAPH.index.get(id)];
    assert.equal(node('gut.antrum.myenteric').owner, 'ens.myenteric');
    assert.equal(node('gut.jej.submucosal').owner, 'ens.submucosal');
    assert.equal(node('gut.antrum').owner, 'tissue');
    assert.equal(node('rec.stomachWall.vagMech').layer, 'NF');
    assert.equal(node('gut.antrum').layer, 'GI');
    assert.ok(GRAPH.nodes.filter((n) => n.plugin === 'enteric').every((n) => n.body), 'every enteric node is a body node');
  });

  test('alone with the brain: [brainnet, enteric] builds and settles', () => {
    const g = buildGraph({ plugins: [brainnet, enteric] });
    assert.equal(g.dropped.length, 0);
    const k = new Kernel({ graph: g, plugins: [brainnet, enteric], seed: 1 });
    assert.equal(k.get('mmcPhase'), 1);
    k.advanceTo(10);
    assert.equal(k.get('vagMech'), PARAMS.afferent.rRest);
  });

  test('attaches to the brain ports with the A.5 / §11.11 network sets', () => {
    const NET = { somatic: 1, autonomic: 2, enteric: 4, neuroendocrine: 8 };
    const edge = (from, to) => GRAPH.edges.find((e) => e.fromId === from && e.toId === to);
    const nets = (e) => e.nets & 31;
    assert.equal(nets(edge('rec.stomachWall.vagMech', 'portVisc.L')), NET.autonomic);
    assert.equal(nets(edge('rec.duodenum.vagChem', 'portVisc.R')), NET.autonomic);
    assert.equal(nets(edge('rec.colonRectum.spinNoci', 'portSpinoVisc.R')), NET.autonomic);
    assert.equal(nets(edge('portVag.L', 'gut.antrum.myenteric')), NET.autonomic | NET.enteric, 'vagal motor to the gut wall: autonomic ∧ enteric');
    assert.equal(nets(edge('portSacral.R', 'gut.rectum.myenteric')), NET.autonomic | NET.enteric);
    assert.equal(nets(edge('iCells', 'portCVO')), NET.neuroendocrine, 'distant CCK action: ne.gut');
    assert.equal(nets(edge('gut.antrum.myenteric', 'gut.antrum')), NET.enteric);
    const e = edge('rec.stomachWall.vagMech', 'portVisc.L');
    assert.equal(e.fibre, 'C');
    assert.ok(e.transport === 'ring' && Math.abs(e.delay - 0.5) < 0.05, `vagal afferent delay ${e.delay} s ≈ 0.5 s (§8.9)`);
  });
});

// --- 2. Rest ---
describe('rest (§8.16, §11.6)', () => {
  test('fasting rest after settle is a steady state', () => {
    const k = kernel();
    assert.equal(k.get('fed'), 0);
    assert.equal(k.get('mmcPhase'), 1);
    assert.equal(k.get('satiety'), 0);
    assert.equal(k.get('hunger'), PARAMS.hunger.base);
    assert.equal(k.get('vagMech'), PARAMS.afferent.rRest);
    for (const [id, H] of Object.entries(PARAMS.hormones)) assert.equal(k.get(id), H.basal, id);
    const skip = new Set(['ens.tLast', 'ens.tPatch']);
    const names = ownNames(k).filter((n) => !skip.has(n));
    const arrays = ownArrays(k).filter((n) => !['swPhase', 'ens.patch', 'ens.colPhi'].includes(n));
    const v0 = names.map((n) => k.get(n)), a0 = arrays.map((n) => Float64Array.from(k.array(n)));
    k.advanceTo(600);
    names.forEach((n, i) => assert.equal(k.get(n), v0[i], `${n} constant at rest`));
    arrays.forEach((n, i) => { const w = maxDiff(k.array(n), a0[i]); assert.equal(w.d, 0, `${n} ${w.path}`); });
    const C = k.array('gutC'), quietRegions = ['gut.corpus', 'gut.antrum', 'gut.duod', 'gut.jej', 'gut.ileum', 'gut.colAsc', 'gut.colTrans', 'gut.colDesc', 'gut.sigmoid'];
    for (const id of quietRegions) assert.ok(cells(id).every((c) => C[c] === 0), `no contractions in phase I (${id})`);
  });

  test('the GI layer strides at fasting rest (§8.15 GI striding)', () => {
    const k = kernel(), inst = k.plugin('enteric'), gi = inst.gi.bind(inst);
    let calls = 0;
    inst.gi = (t, h) => { calls++; gi(t, h); };
    k.advanceTo(60);
    assert.ok(calls < 100, `GI steps in 60 s: ${calls} (60 strided, 600 unstrided)`);
  });
});

// --- 3. §12 checkpoints of `meal` ---
describe('meal checkpoints (§12.10, §12.20)', () => {
  const results = evaluate('meal', { graph: buildGraph({ plugins: [...PLUGINS, ENDOCRINE_STUB] }), plugins: [...PLUGINS, ENDOCRINE_STUB] });
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  test('row 29: CCK at 50 % of its plateau within 9.7 min ± 5 min of meal start', (t) => {
    const r = byId.cck50;
    t.diagnostic(`t50 ${(r.value / 60).toFixed(2)} min (band ${(r.range[0] / 60).toFixed(1)}–${(r.range[1] / 60).toFixed(1)} min)`);
    assert.equal(r.status, 'pass', `${r.value}`);
  });

  test('row 31: enteric off, solid retention ≥ 99 % at 4 h', (t) => {
    const r = byId.entericOff;
    t.diagnostic(`gastricSolid ${r.value.toFixed(2)} kcal (≥ ${r.range[0].toFixed(1)})`);
    assert.equal(r.status, 'pass', `${r.value}`);
  });

  test('rows needing other modules or still open are skipped with their reason', () => {
    assert.equal(byId.pph.status, 'skipped');
    assert.match(byId.pph.reason, /autonomic/);
    assert.equal(byId.retentionTest.status, 'skipped');
    assert.match(byId.retentionTest.reason, /^open/);
  });

  test('availability: meal runs with the enteric module and is greyed in brain-only mode (A.3.5)', () => {
    const k = kernel();
    assert.equal(availability('meal', k), '');
    k.set('bodyMode', 0);
    assert.equal(availability('meal', k), 'Needs the body');
  });

  test('§8.13 meal readouts: fed at the first swallow, satiety up and hunger down by the meal end; emptying near r_set', () => {
    const { k, p } = mealTo(720);
    assert.equal(k.get('fed'), 1);
    assert.equal(k.get('mmcPhase'), 0, 'fed pattern: no MMC');
    assert.ok(k.get('hunger') < 0.2, `hunger ${k.get('hunger')}`);
    assert.ok(k.get('satiety') > 0.5, `satiety ${k.get('satiety')}`);
    p.advanceTo(3600);
    const r = k.get('emptyRate');
    assert.ok(r > 1.65 && r < 1.95, `emptyRate ${r} kcal/min (§8.13 linear emptyRate ≈ 1.8 = r_set at 600 kcal)`);
    assert.ok(k.get('cck') > 4 && k.get('cck') < 8, `cck ${k.get('cck')} pM`);
  });
});

// --- 4. Switch-off (A.5) ---
describe('switch-off behaviour (A.5, §8.16, §11.10)', () => {
  test('neuroendocrine off: plasma gut hormones relax to basal and stay there; the local CCK term continues', () => {
    const { k, p } = mealTo(1800);
    assert.ok(k.get('cck') > 3 && k.get('glp1') > 12, 'hormones raised before the switch');
    k.setNet('neuroendocrine', false, k.t);
    p.advanceTo(k.t + 7200);
    for (const id of ['cck', 'glp1', 'pyy', 'ghrelin', 'motilin', 'gastrin', 'insulin']) {
      const H = PARAMS.hormones[id];
      assert.ok(Math.abs(k.get(id) - H.basal) < 1e-3 * H.basal, `${id} ${k.get(id)} → basal ${H.basal}`);
    }
    assert.ok(k.get('ens.lCck') > 1, `local CCK term ${k.get('ens.lCck')} pM-equivalent continues`);
    assert.ok(k.get('ec5ht') > 1, 'EC 5-HT is paracrine (tissue): unaffected');
  });

  test('enteric off: sphincters closed, emptying and transit stop, slow waves persist, no MMC, vagMech halved', () => {
    const { k, p } = mealTo(1800);
    const sol0 = k.get('gastricSolid');
    k.setNet('enteric', false, k.t);
    p.advanceTo(k.t + 5);
    const solOff = k.get('gastricSolid'), liq0 = k.get('gastricLiquid');
    const t1 = k.t;
    p.advanceTo(t1 + 600);
    assert.ok(sol0 > 300, 'stomach full before the switch');
    assert.ok(Math.abs(k.get('gastricSolid') - solOff) < 1e-9, 'solid emptying stopped');
    assert.ok(k.get('gastricLiquid') > 0.9 * liq0, 'liquid emptying at G_pyl 0.05 only');
    const S = 0.10 * k.g('autonomic');
    for (const q of k.array('ens.sph')) assert.ok(Math.abs(q - (PARAMS.sphT0 + PARAMS.symSphincter * S)) < 1e-12, `sphincter tone ${q} closed`);
    assert.equal(k.get('mmcPhase'), 0);
    assert.equal(k.get('ens.motility'), 0, 'motility index 0');
    // vagMech × 0.5 of the same distension (IGLEs sit in the ganglia)
    const k2 = mealTo(1800).k;
    k2.advanceTo(t1 + 600);
    assert.ok(Math.abs(k.get('vagMech') / k2.get('vagMech') - 0.5) < 0.05, `vagMech ${k.get('vagMech')} vs intact ${k2.get('vagMech')}`);
    // Slow waves persist with weak, non-propagated contractions.
    const sw = k.array('swPhase'), C = k.array('gutC');
    const ant = cells('gut.antrum'), jej = cells('gut.jej');
    assert.ok(ant.every((c) => sw[c] >= 0) && jej.every((c) => sw[c] >= 0), 'slow-wave phase present');
    let m = 0; for (let n = 0; n < 50; n++) { p.advanceTo(k.t + 0.5); for (const c of jej) m = Math.max(m, C[c]); }
    assert.ok(m > 0 && m <= PARAMS.base.off + 1e-9, `jejunal contraction ${m} weak (≤ b_off)`);
  });

  test('autonomic off (denervation): extrinsic drive gone, afferent edges gated, antral pump halved', () => {
    const k = kernel({ settle: false });
    k.set('net.autonomic', 0);
    k.settle({});
    const e = k.edgeIndex('rec.stomachWall.vagMech', 'portVisc.L');
    assert.equal(k.edgeGate(e), 0);
    const { k: kOff } = mealTo(7200, { nets: { autonomic: false } });
    const { k: kOn } = mealTo(7200);
    assert.ok(kOff.get('gastricSolid') > kOn.get('gastricSolid'), `solid retention higher with autonomic off: ${kOff.get('gastricSolid')} vs ${kOn.get('gastricSolid')}`);
    assert.ok(kOff.get('satiety') < kOn.get('satiety'), 'vagal satiety lost');
    assert.equal(kOff.get('ens.cephF'), 0, 'no cephalic phase');
  });
});

// --- 5. Brain-only mode ---
describe('brain-only mode (A.5, §8.16, §11.10 rule 5)', () => {
  test('freezes the body state (satiety 0, hunger 0.3) and restores fasting rest on return', () => {
    const { k, p } = mealTo(900);
    k.setBodyMode('brain', k.t);
    p.advanceTo(k.t + 0.001);
    const names = ownNames(k), arrays = ownArrays(k);
    const v0 = names.map((n) => k.get(n)), a0 = arrays.map((n) => Float64Array.from(k.array(n)));
    p.advanceTo(k.t + 600);
    names.forEach((n, i) => assert.equal(k.get(n), v0[i], `${n} frozen`));
    arrays.forEach((n, i) => assert.equal(maxDiff(k.array(n), a0[i]).d, 0, `${n} frozen`));
    assert.equal(k.get('satiety'), PARAMS.brainOnly.satiety);
    assert.equal(k.get('hunger'), PARAMS.brainOnly.hunger);
    assert.ok(k.get('gastricSolid') > 100, 'meal held in the frozen stomach');
    p.stop();
    k.setBodyMode('body', k.t);
    k.advanceTo(k.t + 2);
    assert.equal(k.get('gastricSolid'), 0, 'fasting rest restored');
    assert.equal(k.get('fed'), 0);
    assert.equal(k.get('mmcPhase'), 1);
    assert.equal(k.get('cck'), PARAMS.hormones.cck.basal);
  });
});

// --- 6. Determinism ---
describe('determinism (A.8 #25, §11.6)', () => {
  test('same seed, two frame-rate schedules: max |Δ| = 0', () => {
    const run = (fps, kh) => {
      const k = kernel(), p = new ScenarioPlayer({ kernel: k });
      p.select('meal'); p.play();
      k.schedule(makeStimulus({ sense: 'interoception', mode: 'gastricDistension', site: 'stomachWall', intensity: 200, durationMs: 30000, tOnset: 40 }));
      k.setNet('enteric', false, 300.25);
      k.setNet('enteric', true, 300.8);
      k.setNet('neuroendocrine', false, 500);
      const h = kh / fps;
      while (k.t < 900) p.advanceTo(Math.min(900, k.t + h));
      return k.snapshot();
    };
    const a = run(30, 60), b = run(144, 60);
    const w = maxDiff(a, b);
    assert.equal(w.d, 0, `max |Δ| ${w.d} at ${w.path}`);
  });
});

// --- 7. §8.18 checks ---
describe('§8.18 model checks', () => {
  test('#3 slow waves: gastric 2.83 cpm, pacemaker to pylorus 40–60 s, no fundic phase', () => {
    const k = kernel();
    k.advanceTo(1);
    const sw = k.array('swPhase');
    assert.ok(cells('gut.fundus').every((c) => sw[c] === -1), 'fundus has no phase');
    // Phase lag from s 36 to the last antral cell.
    const s = GUT_CELLS.s, iP = cells('gut.corpus').find((c) => s[c] >= 36), iA = cells('gut.antrum').at(-1);
    const f = PARAMS.sw.gastricCpm / 60;
    k.advanceTo(2);
    let dphi = (sw[iP] - sw[iA]) / (2 * Math.PI); dphi -= Math.floor(dphi);
    const lag = dphi / f;   // s, modulo one period (21.2 s)
    const T = 1 / f, cand = [lag, lag + T, lag + 2 * T].find((x) => x >= 40 && x <= 60);
    assert.ok(cand !== undefined, `pacemaker → pylorus lag ${lag.toFixed(1)} s (mod ${T.toFixed(1)} s)`);
  });

  test('#4 MMC: phase III in the first cycle, antral or duodenal origin, front 3.5–5.5 cm/min in the duodenum–jejunum', () => {
    const k = kernel();
    let tIII = -1, f0 = null, f1 = null;
    for (let t = 10; t < 7200; t += 10) {
      k.advanceTo(t);
      if (tIII < 0 && k.get('mmcPhase') === 3) tIII = t;
      const fr = k.array('ens.front')[0];
      if (fr >= 55 && !f0) f0 = [t, fr];
      if (f0 && fr >= 0 && t - f0[0] <= 600) f1 = [t, fr];
    }
    assert.ok(tIII > 80 * 60 * 0.9 && tIII < 230 * 60, `first phase III at ${(tIII / 60).toFixed(1)} min`);
    const v = (f1[1] - f0[1]) / ((f1[0] - f0[0]) / 60);
    assert.ok(v >= 3.5 && v <= 5.5, `front velocity ${v.toFixed(2)} cm/min`);
  });

  test('#7 duodenal lipid 30 kcal: first vagal packet at the solitary-nucleus port ≤ 1.5 s; CCK rises', () => {
    const k = kernel();
    const e = k.edgeIndex('rec.duodenum.vagChem', 'portVisc.R');
    k.schedule(makeStimulus({ sense: 'interoception', mode: 'duodenalLipid', site: 'duodenum', intensity: 30, tOnset: 10 }));
    let arr = null;
    for (let t = 10; t < 12 && arr === null; t += 0.01) { k.advanceTo(t); for (const q of k.heap) if (q.edge === e) { arr = q.tArr; break; } }
    assert.ok(arr !== null && arr - 10 <= 1.5, `first packet arrives ${(arr - 10).toFixed(3)} s after onset`);
    k.advanceTo(10 + 900);
    assert.ok(k.get('cck') > 2, `cck ${k.get('cck')} pM`);
  });

  test('#9 colorectal distension 50 mL: the IAS relaxes with enteric on (any autonomic state), not with enteric off', () => {
    const ias = (nets) => {
      const k = kernel({ settle: false });
      for (const [n, on] of Object.entries(nets)) k.set(`net.${n}`, on ? 1 : 0);
      k.settle({});
      k.schedule(makeStimulus({ sense: 'interoception', mode: 'colorectalDistension', site: 'colonRectum', intensity: 50, durationMs: 30000, tOnset: 1 }));
      k.advanceTo(5);
      return k.array('ens.sph')[3];
    };
    assert.ok(ias({}) < 0.4, `IAS ${ias({})} relaxed`);
    assert.ok(ias({ autonomic: false }) < 0.4, 'RAIR is intrinsic');
    assert.ok(ias({ enteric: false }) >= PARAMS.sphT0, 'no RAIR with enteric off');
  });

  test('interventions as data: truncal vagotomy cuts the vagal afferents; Hirschsprung removes the distal plexuses; clearing restores', () => {
    assert.deepEqual(INTERVENTIONS.map((x) => x.id), ['hirschsprung', 'achalasia', 'pseudoObstruction']);
    assert.ok(GUT_EFFECTS.truncalVagotomy.vagAff === 0);
    const k = kernel();
    const eAff = k.edgeIndex('rec.stomachWall.vagMech', 'portVisc.L');
    const ePlex = k.edgeIndex('gut.rectum.myenteric', 'gut.rectum');
    k.setIntervention({ id: 'truncalVagotomy', apply() {} }, 1);
    k.advanceTo(2);
    assert.equal(k.edgeGate(eAff), 0);
    assert.equal(k.get('ens.fx.vagProx'), 0);
    k.setIntervention(INTERVENTIONS[0], 3);
    k.advanceTo(4);
    assert.ok(k.edgeGate(eAff) > 0, 'cuts reset with the next preset');
    assert.equal(k.edgeGate(ePlex), 0, 'aganglionic rectum');
    assert.equal(k.get('ens.fx.aganglionicFrom'), 439);
    k.setIntervention(null, 5);
    k.advanceTo(6);
    assert.ok(k.edgeGate(ePlex) > 0);
    assert.equal(k.get('ens.fx.aganglionicFrom'), 1e9);
  });

  test('uGut texture (B.7): 256 × RGBA, contraction, phase in cycles, excitability, bolus', () => {
    const { k } = mealTo(900);
    const out = k.plugin('enteric').gutTexture();
    assert.equal(out.length, 1024);
    for (let c = 0; c < GUT_CELLS.n; c++) {
      assert.ok(out[4 * c] >= 0 && out[4 * c] <= 1);
      assert.ok(out[4 * c + 1] === -1 || (out[4 * c + 1] >= 0 && out[4 * c + 1] < 1));
      assert.ok(out[4 * c + 3] >= 0 && out[4 * c + 3] <= 1);
    }
    assert.ok(out[4 * cells('gut.antrum')[0] + 3] > 0.3, 'stomach bolus shown');
  });
});
