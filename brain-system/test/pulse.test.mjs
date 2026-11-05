// Arterial pulse and the vascular tree (research/PULSE.md): arrival delays by site, the delay scale
// and amplitude of the state, the energy-conserving brightening, the budgets and the Stars style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VPART, VESSEL_TREE, PULSE_SITES, TREE, pulseSite, nearestOn } from '../src/body/vessel-tree.js';
import { PULSE, PulseWave, delayScale, pulseAmplitude, pulseKernel } from '../src/pulse.js';
import { HeartBeat } from '../src/heart.js';
import { PARAMS as GEN, generateBody, vascularDetail, FLOATS } from '../src/body/generate.js';
import { PARAMS as RP } from '../src/renderer.js';
import { TIERS } from '../src/performance.js';
import { BODY_VS, PARAMS as SP, uniformSlots } from '../src/shaders.js';
import { bodySDF } from '../src/body/geometry.js';

const ms = (id, side = 1) => 1000 * pulseSite(id, side).delay;
let LOW = null;
const low = () => (LOW ??= generateBody({ budget: 'low' }));
const vesselRange = (b) => b.ranges.find((r) => r.name === 'vessel');

test('arrival delays follow the path length along each route and fall in the analysis ranges (§4)', () => {
  for (const side of [1, -1]) {
    const arm = ['carotid', 'brachial', 'radial', 'finger'], leg = ['femoral', 'popliteal', 'posteriorTibial', 'dorsalisPedis'];
    for (const route of [['carotid'], arm.slice(1), leg]) {
      const sites = route.map((id) => pulseSite(id, side));
      for (let i = 1; i < sites.length; i++) {
        assert.ok(sites[i].pathMm > sites[i - 1].pathMm, `${route[i]}: further along than ${route[i - 1]}`);
        assert.ok(sites[i].delay > sites[i - 1].delay, `${route[i]}: later than ${route[i - 1]}`);
      }
    }
    const within = (id, a, b) => assert.ok(ms(id, side) >= a && ms(id, side) <= b, `${id} ${ms(id, side).toFixed(1)} ms in ${a}–${b}`);
    within('carotid', 15, 40); within('radial', 70, 115); within('femoral', 70, 120); within('dorsalisPedis', 150, 230);
    assert.ok(ms('carotid', side) < ms('brachial', side) && ms('femoral', side) < ms('dorsalisPedis', side));
  }
  for (const id of Object.keys(PULSE_SITES)) {
    const r = ms(id, 1), l = ms(id, -1);
    assert.ok(Math.abs(r - l) / r < 0.15, `${id}: left and right within 15 % (${r.toFixed(1)}, ${l.toFixed(1)} ms)`);
  }
});

test('the tree: delays rise along every artery from its parent, radii taper (Murray), veins carry no pulse', () => {
  for (const v of VESSEL_TREE.vessels) {
    if (v.vein) { assert.ok(v.d.every((d) => d === -1) && v.a.every((a) => a === 0), `${v.id}: no pulse`); continue; }
    for (let i = 1; i < v.d.length; i++) assert.ok(v.d[i] > v.d[i - 1], `${v.id}: delay rises`);
    for (let i = 1; i < v.r.length; i++) assert.ok(v.r[i] <= v.r[i - 1] + 1e-9, `${v.id}: radius tapers`);
    if (v.parent) {
      const p = VESSEL_TREE.byId.get(v.parent), at = nearestOn(p, v.pts[0]);
      assert.ok(at.dist < 1e-6, `${v.id}: joined to ${p.id}`);
      assert.ok(Math.abs(at.d - v.d[0]) < 1e-9, `${v.id}: starts at its parent's delay`);
      assert.ok(v.r[0] <= at.r + 1e-9, `${v.id}: no wider than its parent`);
    }
    for (const p of v.pts) assert.ok(bodySDF(p[0], p[1], p[2]) < 0, `${v.id}: inside the body`);
  }
  const { branches: twigs } = vascularDetail();
  assert.ok(twigs.length > 3000, `${twigs.length} branches`);
  for (const t of twigs) {
    assert.ok(t.r.every((r) => r >= TREE.twig.minR && r <= 6.5), `${t.name}: branch radius`);
    if (t.vein) assert.ok(t.d.every((d) => d === -1)); else assert.ok(t.a[0] < 1.3 && t.d[t.d.length - 1] >= t.d[0], `${t.name}: damped, later than its parent`);
  }
  // Every artery star's wave ends within the (reduced) beat, up to 150 bpm at resting pressures.
  const maxD = Math.max(...VESSEL_TREE.vessels.flatMap((v) => v.d), ...twigs.flatMap((t) => t.d));
  for (const hr of [60, 100, 150]) {
    const rrReduced = 60 / hr / delayScale(115, 75, hr);
    assert.ok(maxD + SP.pulse.x0 + SP.pulse.cut * SP.pulse.sigma < rrReduced, `${hr} bpm: the wave ends before the next beat`);
  }
});

test('stress and arousal: higher pressure and rate shorten the delays, the pulse pressure sets the amplitude (§7)', () => {
  assert.ok(Math.abs(delayScale(115, 75, 68) - 1) < 1e-9, 'rest: k = 1');
  const stress = delayScale(122, 80, 82), climax = delayScale(160, 95, 125);
  assert.ok(stress < 0.95 && stress > 0.8, `stress k ${stress.toFixed(3)}`);
  assert.ok(climax < stress && climax >= PULSE.kRange[0], `climax k ${climax.toFixed(3)}`);
  assert.equal(delayScale(80, 50, 40), Math.min(PULSE.kRange[1], delayScale(80, 50, 40)));
  assert.equal(pulseAmplitude(115, 75), 1);
  assert.equal(pulseAmplitude(200, 80), PULSE.gRange[1]);
  assert.ok(pulseKernel(SP.pulse.x0) === SP.pulse.gain && pulseKernel(-1) === 0);
  // The fingertip pulse arrives earlier under Stress: PTT falls.
  const run = (vit) => {
    const h = new HeartBeat(), p = new PulseWave();
    for (let i = 0; i < 300; i++) { h.step(1 / 60, vit); p.step(h); }
    return p;
  };
  const rest = run({ hr: 68, sbp: 115, dbp: 75 }), str = run({ hr: 82, sbp: 122, dbp: 80 });
  assert.ok(str.ptt < rest.ptt && rest.ptt > 120 && rest.ptt < 260, `PTT rest ${rest.ptt} ms, stress ${str.ptt} ms`);
  assert.ok(Math.max(...rest.pleth) > 0.5, 'the PLETH trace carries the pulse');
  const steady = run({ hr: 170, sbp: 130, dbp: 80 });
  assert.equal(steady.g, 0, 'above 150 bpm the arteries are steady (§8)');
});

test('energy-conserving: the pulsing stars keep their total light through the beat (§8)', () => {
  const b = low(), P = b.points, r = vesselRange(b), PULSING = [VPART.ARTERY, VPART.ARTERY_TWIG, VPART.PULM_ARTERY];
  const sets = { tree: [], earlier: [] };
  let counts = { tree: 0, earlier: 0, none: 0 };
  for (let i = r.start; i < r.start + r.count; i++) {
    const k = i * FLOATS, part = Math.round(P[k + 5]), d = P[k + 4], a = P[k + 6];
    if (PULSING.includes(part)) { sets.tree.push([d, a, P[k + 3] * SP.pulse.partGain[part - 1]]); counts.tree++; }
    else if (part === VPART.EARLIER_ARTERY) { sets.earlier.push([d, a, P[k + 3]]); counts.earlier++; }
    else { counts.none++; if (part !== VPART.EARLIER) assert.ok(d === -1 && (part === VPART.CAPILLARY || a === 0), 'veins and capillaries carry no pulse'); }
  }
  assert.ok(counts.tree > 4000 && counts.earlier > 500, JSON.stringify(counts));
  const total = (set, tau, g, mean) => set.reduce((s, [d, a, w]) => s + w * Math.max(0, 1 + g * a * pulseKernel(tau - d) - g * mean), 0);
  for (const vit of [{ hr: 68, sbp: 115, dbp: 75 }, { hr: 83, sbp: 124, dbp: 80 }, { hr: 125, sbp: 160, dbp: 95 }]) {
    const h = new HeartBeat(), p = new PulseWave();
    p.setStars(P, FLOATS, b.count);
    let worst = 0, peak = 0;
    for (let i = 0; i < 240; i++) {
      h.step(1 / 60, vit); p.step(h);
      if (!p.g) continue;
      for (const [name, j] of [['tree', 0], ['earlier', 1]]) {
        const set = sets[name], ref = set.reduce((s, x) => s + x[2], 0);
        worst = Math.max(worst, Math.abs(total(set, p.tau, p.g, p.mean[j]) / ref - 1));
        peak = Math.max(peak, p.mean[j]);
      }
    }
    assert.ok(worst < 0.01, `${vit.hr} bpm: total light within ${(100 * worst).toFixed(2)} % (< 1 %)`);
    assert.ok(peak > 0.005, 'the wave runs');
  }
});

test('budgets: the vessel group, the tree share and the body totals agree everywhere (§9)', () => {
  const tiers = ['low', 'medium', 'high', 'ultra'];
  assert.deepEqual(tiers.map((t) => GEN.budgets[t].vessel), [36000, 72000, 120000, 192000]);
  assert.deepEqual(tiers.map((t) => GEN.budgets[t].vessel - Math.round(GEN.budgets[t].vessel * GEN.treeShare)), [2250, 4500, 7500, 12000], 'the earlier stars keep their counts');
  assert.deepEqual(tiers.map((t) => RP.classBudget[t][8]), tiers.map((t) => GEN.budgets[t].vessel));
  const sum = (t) => Object.values(GEN.budgets[t]).reduce((a, x) => a + x, 0);
  assert.deepEqual(tiers.map(sum), [122250, 238500, 393000, 610000]);
  assert.deepEqual(TIERS.map((t) => t.body), tiers.map(sum));
  const b = low(), r = vesselRange(b), parts = new Map();
  for (let i = r.start; i < r.start + r.count; i++) { const p = Math.round(b.points[i * FLOATS + 5]); parts.set(p, (parts.get(p) || 0) + 1); }
  const tree = [1, 2, 3, 4, 5, 6, 7].reduce((s, p) => s + (parts.get(p) || 0), 0);
  assert.equal(r.count, 36000);
  assert.equal(tree, 33750, 'the tree fills its share');
  GEN.tree.shares.forEach((sh, k) => assert.ok(Math.abs((parts.get(k + 1) || 0) - sh * 33750) <= 1, `part ${k + 1}: its share`));
  let out = 0;
  for (let i = r.start; i < r.start + r.count; i++) {
    const k = i * FLOATS, p = Math.round(b.points[k + 5]);
    if (p >= 1 && p <= 7 && bodySDF(b.points[k] * 100, b.points[k + 1] * 100, b.points[k + 2] * 100) > 0) out++;
  }
  assert.ok(out / tree < 0.01, `${out} tree stars outside the skin`);
  assert.ok(uniformSlots(BODY_VS).slots <= 110, 'BODY_VS stays within the slot limit');
  assert.match(BODY_VS, /uniform vec4 uPulse;/);
});

test('Stars style unchanged: the earlier vessel stars are bit-identical and the tree is not drawn', () => {
  // Hash of the earlier 2,250 low-tier vessel stars (position, flux, seed, node, path, u, bits, LOD,
  // side, rigid segment; sorted), recorded before the tree was added.
  const b = low(), r = vesselRange(b), P = b.points, rows = [];
  for (let i = r.start; i < r.start + r.count; i++) {
    const k = i * FLOATS, part = Math.round(P[k + 5]);
    if (part >= 1 && part <= 7) continue;
    rows.push([P[k], P[k + 1], P[k + 2], P[k + 3], P[k + 7], P[k + 8], P[k + 9], P[k + 10], P[k + 12], P[k + 13], P[k + 14], P[k + 15]]);
  }
  rows.sort((a, c) => a[0] - c[0] || a[1] - c[1] || a[2] - c[2] || a[4] - c[4]);
  let h = 0x811c9dc5 | 0;
  const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (const row of rows) for (const v of row) { f[0] = v; h = Math.imul(h ^ u[0], 16777619); }
  assert.equal(rows.length, 2250);
  assert.equal((h >>> 0).toString(16), '6b70955d');
  assert.equal(RP.style.keepTree, 0, 'Stars draws no tree star');
  assert.equal(RP.style.keep[8], 2 / 3, 'and the earlier vessel stars at their earlier share');
  assert.match(BODY_VS, /if \(tree\) keep = uKeep\[2\]\.w; else if \(vPart > 0\.5\) keep \*= 1\.0 - uKeep\[2\]\.w;/);
});

test('finest detail (§13): aortic sinuses, organ trees, gut arcades, intercostals, valves and capillary beds', () => {
  const aorta = VESSEL_TREE.byId.get('aorta');
  assert.ok(aorta.sinus && aorta.sinus.k > 0.15, 'the aortic root bulges in three sinuses');
  for (const id of ['intThoracic.R', 'profundaFemoris.L', 'pica.R', 'digital2.index.L', 'toeDigital3.R', 'azygos', 'radialV2.R']) assert.ok(VESSEL_TREE.byId.get(id), `${id} exists`);
  const { branches, beds } = vascularDetail(), count = (name) => branches.filter((b) => b.name === name).length;
  for (const side of [1, -1]) {
    const pa = branches.filter((b) => b.part === VPART.PULM_ARTERY && b.side === side), pv = branches.filter((b) => b.part === VPART.PULM_VEIN && b.side === side);
    assert.ok(pa.length > 60 && pv.length > 40, `lung ${side}: ${pa.length} pulmonary arteries, ${pv.length} pulmonary veins`);
    assert.ok(pa.every((b) => b.d[0] >= 0 && b.a[0] <= 0.4), 'the pulmonary pulse is small (A ≤ 0.38)');
  }
  for (const name of ['hepaticTree', 'portalTree', 'hepaticVTree', 'renalTree', 'renalVTree', 'splenicTree']) assert.ok(count(name) > 10, `${name}: ${count(name)}`);
  assert.ok(count('jejunal') >= 15 && count('arcade') >= 14 && count('vasaRecta') > 40 && count('marginal') === 1 && count('colic') === 5, 'gut arcades');
  assert.ok(count('intercostal') === 18 && count('lumbar') === 8, 'intercostal T3–T11 and lumbar L1–L4 pairs');
  assert.ok(count('valve') > 100 && count('vasa') > 10, 'venous valves and vasa vasorum');
  // Capillary beds: saturation falls from the arteriole to the venule (rises in the lungs), within 60–98 %.
  assert.ok(beds.length > 5000, `${beds.length} capillary strands`);
  let lungUp = 0, down = 0;
  for (const c of beds) {
    assert.ok(c.oxy.every((x) => x >= 0.6 && x <= 0.98), 'saturation 60–98 %');
    if (c.oxy[c.oxy.length - 1] > c.oxy[0]) lungUp++; else down++;
  }
  assert.ok(lungUp > 300 && down > 3000, `lung beds ${lungUp}, systemic beds ${down}`);
});
