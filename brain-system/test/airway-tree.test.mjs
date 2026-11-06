// Airway tree, lobes, fissures and segments (research/LUNGS.md §2.2, §2.3, §7.1, §12): determinism,
// Boyden's segments, the lobe volume shares, every branch and acinus in its lobe and the lung region
// with no fissure crossed, Murray's law, the conducting volume, L/d, branching angles, the spread of
// path generations, the main bronchi and their relation to the pulmonary arteries, and build time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIRWAY, LOBES, SEGMENTS, buildAirwayTree, clearAirwayTreeCache, fissureDist, lobeOf, lungRegion, segmentOf }
  from '../src/body/airway-tree.js';
import { HEART_FORM } from '../src/body/heart-form.js';
import { mulberry32 } from '../src/anatomy.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const median = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[s.length >> 1]; };
const angleDeg = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180 / Math.PI;
const fromVertical = (B) => angleDeg(sub(B.b, B.a), [0, 0, -1]);

const tree = () => buildAirwayTree();
const named = (name) => tree().branches.find((b) => b.name === name);
const root = (id) => HEART_FORM.roots.find((v) => v.id === id);
// Segmental and below: the branches that a segment owns.
const owned = () => tree().branches.filter((b) => b.segment >= 0);
// Pinned large airways: the trachea, the main bronchi, the bronchus intermedius, lobar bronchi and trunks.
const isPinned = (b) => b.segment < 0;

test('deterministic: the same options give the same tree; another seed gives another', () => {
  const opts = { seed: 11, leaves: 3000 };
  const a = buildAirwayTree(opts);
  assert.equal(buildAirwayTree(opts), a, 'memoised');
  clearAirwayTreeCache();
  const b = buildAirwayTree(opts);
  assert.notEqual(a, b);
  assert.deepEqual(b.branches, a.branches);
  assert.deepEqual(b.acini, a.acini);
  const c = buildAirwayTree({ seed: 12, leaves: 3000 });
  assert.notDeepEqual(c.acini.slice(0, 50).map((x) => x.c), a.acini.slice(0, 50).map((x) => x.c));
});

test('five lobes and Boyden\'s 10 right and 8 left segments, with names and B-numbers (§2.3)', () => {
  assert.deepEqual(LOBES.map((l) => l.id), ['RUL', 'RML', 'RLL', 'LUL', 'LLL']);
  for (const l of LOBES) assert.ok(l.name.length > 5 && Math.abs(l.side) === 1);
  const right = SEGMENTS.filter((s) => s.side > 0), left = SEGMENTS.filter((s) => s.side < 0);
  assert.equal(right.length, 10);
  assert.equal(left.length, 8);
  assert.deepEqual(right.map((s) => s.b), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10']);
  assert.deepEqual(left.map((s) => s.b), ['B1+2', 'B3', 'B4', 'B5', 'B6', 'B7+8', 'B9', 'B10']);
  assert.deepEqual(right.map((s) => s.name), ['Apical', 'Posterior', 'Anterior', 'Lateral', 'Medial', 'Superior',
    'Medial basal', 'Anterior basal', 'Lateral basal', 'Posterior basal']);
  assert.deepEqual(left.map((s) => s.name), ['Apicoposterior', 'Anterior', 'Superior lingular', 'Inferior lingular',
    'Superior', 'Anteromedial basal', 'Lateral basal', 'Posterior basal']);
  for (const s of SEGMENTS) {
    assert.equal(LOBES[s.lobe].side, s.side, s.id);
    assert.equal(segmentOf(s.anchor), SEGMENTS.indexOf(s), `${s.id}: its anchor lies in it`);
  }
  // One segmental bronchus per segment, named.
  for (const [i, s] of SEGMENTS.entries()) {
    const segs = tree().branches.filter((b) => b.name === `${s.name} segmental bronchus (${s.b})` && b.segment === i);
    assert.equal(segs.length, 1, s.id);
  }
});

test('lobe volume shares by Monte Carlo: RUL 20, RML 9, RLL 25, LUL 23, LLL 23 % (±5 points, §2.3)', () => {
  const rnd = mulberry32(2024), n = [0, 0, 0, 0, 0];
  let tot = 0;
  for (let i = 0; i < 120000; i++) {
    const l = lobeOf([-140 + 280 * rnd(), -100 + 165 * rnd(), -440 + 245 * rnd()]);
    if (l >= 0) { n[l]++; tot++; }
  }
  const share = n.map((v) => 100 * v / tot);
  [20, 9, 25, 23, 23].forEach((want, i) => assert.ok(Math.abs(share[i] - want) <= 5, `${LOBES[i].id} ${share[i].toFixed(1)} %`));
  // Every segment holds some of its lobe.
  const seg = new Array(SEGMENTS.length).fill(0);
  for (let i = 0; i < 40000; i++) { const s = segmentOf([-140 + 280 * rnd(), -100 + 165 * rnd(), -440 + 245 * rnd()]); if (s >= 0) seg[s]++; }
  for (const [i, c] of seg.entries()) assert.ok(c / tot * 3 > 0.01, `${SEGMENTS[i].id} has a territory`);
});

test('fissures: the oblique fissure runs from ≈ z −270 behind to the anterior diaphragm; gaps measure in mm', () => {
  // Lobes met going down a vertical line through the lung: [z where it starts, lobe].
  const column = (x, y) => {
    const out = [];
    for (let z = -200, prev = null; z >= -440; z -= 1) {
      const l = lobeOf([x, y, z]);
      if (l !== prev) out.push([z, l]);
      prev = l;
    }
    return out;
  };
  const lobesDown = (x, y) => column(x, y).filter(([, l]) => l >= 0).map(([, l]) => l);
  const startOf = (col, lobe) => col.find(([, l]) => l === lobe)[0];
  const bottom = (col) => col[col.length - 1][0];
  // Behind: upper lobe over lower lobe, the fissure at ≈ z −270 (T4–T5).
  for (const [x, up, low] of [[70, 0, 2], [-80, 3, 4]]) {
    const col = column(x, -80);
    assert.deepEqual(lobesDown(x, -80), [up, low]);
    assert.ok(startOf(col, low) <= -262 && startOf(col, low) >= -290, `oblique fissure behind at ${startOf(col, low)}`);
  }
  // In front: right upper, middle (from the horizontal fissure, ≈ 4th costal cartilage) and a low
  // lower-lobe sliver; left upper lobe nearly to the diaphragm.
  const rf = column(80, 30);
  assert.deepEqual(lobesDown(80, 30), [0, 1, 2]);
  assert.ok(Math.abs(startOf(rf, 1) - (-304)) <= 2);
  assert.ok(bottom(rf) - startOf(rf, 2) >= -20, 'the oblique fissure meets the front of the diaphragm');
  const lf = column(-90, 25);
  assert.deepEqual(lobesDown(-90, 25), [3, 4]);
  assert.ok(bottom(lf) - startOf(lf, 4) >= -45);
  assert.equal(lobeOf([0, 0, -300]), -1, 'mediastinum');
  // fissureDist is a distance: a 3-mm step across the fissure changes it by ≈ 3 mm.
  const p = [90, -40, -300];
  const d0 = fissureDist(p), d1 = fissureDist([90, -40, -297]);
  assert.ok(d0 >= 0 && Math.abs(Math.abs(d1 - d0) - 3 * 0.7) < 1.5, `${d0.toFixed(2)} → ${d1.toFixed(2)}`);
});

test('every acinus lies in the lung region, in its lobe and segment, clear of the fissures', () => {
  const T = tree();
  assert.equal(T.acini.length, T.stats.leaves);
  for (const a of T.acini) {
    assert.ok(lungRegion(a.c) !== 0);
    assert.equal(lobeOf(a.c), a.lobe);
    assert.equal(segmentOf(a.c), a.segment);
    assert.ok(fissureDist(a.c) >= AIRWAY.fissureClear - 1e-9);
    assert.equal(T.branches[a.branch].children.length, 0, 'fed by a terminal branch');
    assert.ok(a.r >= 3 && a.r <= 3.5);
  }
  const leaves = T.branches.reduce((s, b) => s + (b.children.length ? 0 : b.leaves), 0);
  assert.equal(leaves, T.acini.length);
});

test('no branch crosses a fissure or leaves the lung; only the trachea and main bronchi are mediastinal', () => {
  const T = tree();
  for (const B of T.branches) {
    if (B.gen <= 1) { assert.equal(B.lobe, -1); continue; }
    assert.ok(lungRegion(B.b) === B.side, `${B.name} ends in its lung`);
    if (B.lobe >= 0) assert.equal(lobeOf(B.b), B.lobe, `${B.name} ends in its lobe`);
  }
  for (const B of owned()) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.equal(lobeOf(mix(B.a, B.b, t)), B.lobe, `${B.id} ${B.name} at ${t}`);
    assert.equal(T.branches[B.parent].lobe, B.lobe, 'children stay in their lobe');
  }
});

test('the large airways keep clear of the hilar great vessels (heart-form.js)', () => {
  const segDist = (a, b, c, d) => {
    let m = Infinity;
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) m = Math.min(m, len(sub(mix(a, b, i / 24), mix(c, d, j / 24))));
    return m;
  };
  const big = tree().branches.filter((b) => b.gen <= 5 && (isPinned(b) || b.name.includes('segmental')));
  for (const v of HEART_FORM.roots.filter((x) => /^(pulmonaryArtery|pulmonaryVein|svc)/.test(x.id))) {
    for (let k = 0; k < v.pts.length - 1; k++) {
      for (const B of big) assert.ok(segDist(v.pts[k], v.pts[k + 1], B.a, B.b) >= v.r + B.r, `${B.name} vs ${v.id}`);
    }
  }
});

test('Murray: below the pinned large airways a parent\'s d³ is the sum of its children\'s (±5 %)', () => {
  const T = tree();
  let n = 0;
  for (const B of T.branches) {
    if (!B.children.length) continue;
    const sum = B.children.reduce((s, c) => s + (2 * T.branches[c].r) ** 3, 0), d3 = (2 * B.r) ** 3;
    if (isPinned(B)) { for (const c of B.children) assert.ok(T.branches[c].r < B.r, `${B.name} wider than its children`); continue; }
    assert.ok(Math.abs(sum - d3) / d3 <= 0.05, `${B.id} ${B.name}`);
    n++;
  }
  assert.ok(n > 1000);
  // Calibres: trachea ≈ 18, main ≈ 12 (right wider), lobar ≈ 8–10, terminal ≈ 0.6 × (acini per leaf)^⅓.
  assert.equal(2 * named('Trachea').r, 18);
  const R = 2 * named('Right main bronchus').r, L = 2 * named('Left main bronchus').r;
  assert.ok(R > L && L >= 11 && R <= 13.5);
  for (const id of ['Right upper lobe bronchus', 'Right middle lobe bronchus', 'Right lower lobe bronchus', 'Left upper lobe bronchus', 'Left lower lobe bronchus']) {
    const d = 2 * named(id).r;
    assert.ok(d >= 6.5 && d <= 10.5, `${id} ${d.toFixed(2)} mm`);
  }
  const perLeaf = AIRWAY.aciniTotal / T.stats.leaves;
  const one = T.branches.filter((b) => !b.children.length && b.leaves === 1);
  for (const b of one) assert.ok(Math.abs(2 * b.r - AIRWAY.dTerminal * Math.cbrt(perLeaf)) < 1e-9);
});

test('conducting volume 100–200 mL; cumulative volumes run from the mouth (upper airway first)', () => {
  const T = tree();
  let sum = 0;
  for (const B of T.branches) {
    const v = Math.PI * B.r * B.r * B.len / 1000;
    sum += v;
    assert.ok(Math.abs(B.vol1 - B.vol0 - v) < 1e-9);
    assert.equal(B.vol0, B.parent < 0 ? AIRWAY.upperDeadSpace : T.branches[B.parent].vol1);
  }
  assert.ok(Math.abs(sum - T.stats.conductingVolume) < 1e-6);
  assert.ok(sum >= 100 && sum <= 200, `${sum.toFixed(1)} mL`);
  assert.equal(named('Trachea').vol0, 50);
});

test('shape: median L/d 2–4 for generations 4–14; mean branching angle 25–50°, none over 60°; the plane turns', () => {
  const T = tree();
  for (let g = 4; g <= 14; g++) {
    const ld = median(T.branches.filter((b) => b.gen === g).map((b) => b.len / (2 * b.r)));
    assert.ok(ld >= 2 && ld <= 4, `generation ${g}: L/d ${ld.toFixed(2)}`);
  }
  const angles = owned().filter((b) => T.branches[b.parent].segment >= 0)
    .map((b) => angleDeg(sub(b.b, b.a), sub(T.branches[b.parent].b, T.branches[b.parent].a)));
  const mean = angles.reduce((s, a) => s + a, 0) / angles.length;
  assert.ok(mean >= 25 && mean <= 50, `mean ${mean.toFixed(1)}°`);
  assert.ok(Math.max(...angles) <= AIRWAY.maxAngle + 1e-6);
  assert.ok(T.stats.meanPlaneTurn >= 70, `plane turn ${T.stats.meanPlaneTurn.toFixed(0)}°`);
});

test('path generations are asymmetric (Horsfield): terminal generations span at least 8 to 20', () => {
  const T = tree(), gens = T.branches.filter((b) => !b.children.length).map((b) => b.gen);
  assert.ok(Math.min(...gens) <= 8 && Math.max(...gens) >= 20, `${Math.min(...gens)}–${Math.max(...gens)}`);
  assert.ok(T.stats.meanPathGen >= 13 && T.stats.meanPathGen <= 17);
  assert.equal(T.stats.perGen.reduce((s, n) => s + n, 0), T.branches.length);
  assert.ok(T.stats.leaves >= 8000 && T.stats.leaves <= 16000);
});

test('main bronchi: right short, steep and wide; left long and oblique (§2.2)', () => {
  const R = named('Right main bronchus'), L = named('Left main bronchus');
  assert.ok(Math.abs(fromVertical(R) - 25) <= 3 && Math.abs(fromVertical(L) - 45) <= 3);
  assert.ok(fromVertical(R) < fromVertical(L), 'the right is steeper');
  assert.ok(Math.abs(R.len - 25) <= 4 && Math.abs(L.len - 50) <= 5);
  assert.ok(R.b[0] > 0 && L.b[0] < 0);
  assert.deepEqual(R.a, AIRWAY.carina);
  const T = named('Trachea');
  assert.ok(T.a[2] < -158.5 - 10 && T.len > 95 && T.len < 125, 'trachea below the larynx, ≈ 11 cm');
  // The right upper lobe bronchus leaves ≈ 2 cm below the carina.
  const RUL = named('Right upper lobe bronchus');
  assert.ok(AIRWAY.carina[2] - RUL.a[2] >= 15 && AIRWAY.carina[2] - RUL.a[2] <= 25);
});

test('pulmonary arteries: the right runs in front of and below the RUL bronchus; the left arches over the left main bronchus', () => {
  const rpa = root('pulmonaryArteryR'), lpa = root('pulmonaryArteryL');
  const rEnd = rpa.pts[rpa.pts.length - 1], RUL = named('Right upper lobe bronchus');
  for (const t of [0.5, 1]) {
    const p = mix(RUL.a, RUL.b, t);
    assert.ok(p[2] > rEnd[2], `RUL bronchus at ${t} above the right PA (z ${p[2].toFixed(1)} vs ${rEnd[2]})`);
    assert.ok(p[1] < rEnd[1], 'and behind it');
  }
  const BI = named('Bronchus intermedius');
  assert.ok(BI.b[2] < rEnd[2], 'the bronchus intermedius runs below the artery (eparterial RUL bronchus)');
  // Along the left PA, wherever it is over the left main bronchus, it is higher.
  const LMB = named('Left main bronchus'), zAt = (x) => LMB.a[2] + (LMB.b[2] - LMB.a[2]) * (x - LMB.a[0]) / (LMB.b[0] - LMB.a[0]);
  let n = 0;
  for (let k = 0; k < lpa.pts.length - 1; k++) {
    for (let i = 0; i <= 20; i++) {
      const p = mix(lpa.pts[k], lpa.pts[k + 1], i / 20);
      if (p[0] > LMB.a[0] || p[0] < LMB.b[0]) continue;
      assert.ok(p[2] > zAt(p[0]) + lpa.r * 0.5, `left PA over the bronchus at x ${p[0].toFixed(1)}`);
      n++;
    }
  }
  assert.ok(n > 10);
  const lEnd = lpa.pts[lpa.pts.length - 1];
  assert.ok(lEnd[2] > LMB.b[2] + lpa.r, 'the arch ends above the left hilum');
});

test('build time ≤ 1 s (fresh, default options)', () => {
  clearAirwayTreeCache();
  const t0 = performance.now();
  const T = buildAirwayTree();
  const ms = performance.now() - t0;
  assert.ok(ms <= 1000, `${ms.toFixed(0)} ms`);
  assert.ok(T.stats.ms.total <= 1000);
  assert.equal(buildAirwayTree(), T, 'memoised');
});
