// Lungs in the body (research/LUNGS.md §7): the lung stars by role and their shares, the airway
// generations of the whole-body build, the fissure gaps, the diaphragm sheet, the airflow histogram,
// the bronchovascular arteries, the close-up region's finer airways, and the breathing uniforms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBody, generateFocusRegion, lungFrontHist, vascularDetail, FLOATS, PARAMS as GEN } from '../src/body/generate.js';
import { LUNG_ROLE, TISSUE, diaphragmZ } from '../src/body/geometry.js';
import { buildAirwayTree, fissureDist, lungRegion } from '../src/body/airway-tree.js';
import { VPART, TREE } from '../src/body/vessel-tree.js';
import { BODY_VS, uniformSlots } from '../src/shaders.js';
import { BREATH } from '../src/breath.js';

const body = generateBody({ budget: 'high', lod: 2 }, 1848);
const roleOf = (P, k) => (P[k + 5] < -1.5 ? Math.round(-P[k + 5]) : 0);
const stars = (tissue, role) => {
  const r = body.ranges[tissue], P = body.points, out = [];
  for (let i = r.start; i < r.start + r.count; i++) { const k = i * FLOATS; if (roleOf(P, k) === role) out.push([P[k] * 100, P[k + 1] * 100, P[k + 2] * 100, P[k + 4]]); }
  return out;
};

test('lung stars: the four roles in their shares of the lungs\' organ budget', () => {
  const S = GEN.lung.share, counts = Object.fromEntries(['AIRWAY', 'ACINUS', 'PLEURA', 'PARENCHYMA'].map((k) => [k, stars(TISSUE.organ, LUNG_ROLE[k]).length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total > 28000 && total < 32000, `${total} lung stars at High`);
  for (const [k, s] of [['AIRWAY', S.airway], ['ACINUS', S.acini], ['PLEURA', S.pleura], ['PARENCHYMA', S.parenchyma]]) {
    assert.ok(Math.abs(counts[k] / total - s) < 0.01, `${k}: ${counts[k]} of ${total}`);
  }
});

test('airway stars: on the walls of generations ≤ the tier\'s base, volume coordinate within the dead space', () => {
  const T = buildAirwayTree(), air = stars(TISSUE.organ, LUNG_ROLE.AIRWAY), base = T.branches.filter((b) => b.gen <= GEN.lung.baseGen.high);
  for (let i = 0; i < air.length; i += 97) {
    const p = air[i];
    let best = Infinity;
    for (const b of base) {
      const d = [b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      const t = Math.max(0, Math.min(1, ((p[0] - b.a[0]) * d[0] + (p[1] - b.a[1]) * d[1] + (p[2] - b.a[2]) * d[2]) / l2));
      const q = [b.a[0] + t * d[0] - p[0], b.a[1] + t * d[1] - p[1], b.a[2] + t * d[2] - p[2]];
      best = Math.min(best, Math.abs(Math.hypot(...q) - b.r));
    }
    assert.ok(best < 0.5 * GEN.lung.wall * 9 + 0.05, `airway star ${i} ${best.toFixed(2)} mm from a wall`);
    assert.ok(p[3] >= 0 && p[3] <= BREATH.vd + 1e-6, `volume coordinate ${p[3]}`);
  }
});

test('parenchyma keeps clear of the fissures; acini lie in the lungs past the dead space', () => {
  const par = stars(TISSUE.organ, LUNG_ROLE.PARENCHYMA), ac = stars(TISSUE.organ, LUNG_ROLE.ACINUS);
  for (let i = 0; i < par.length; i += 13) {
    assert.ok(lungRegion(par[i]) !== 0, 'parenchyma inside a lung');
    assert.ok(fissureDist(par[i]) > GEN.lung.fissureGap - 1e-6, 'a dark gap at each fissure');
  }
  for (let i = 0; i < ac.length; i += 29) assert.ok(ac[i][3] >= BREATH.vd && ac[i][3] <= BREATH.vd + BREATH.front.acinar + 1e-6, 'acinar volume coordinate');
});

test('the diaphragm sheet lies on its dome, as muscle', () => {
  const d = stars(TISSUE.muscle, LUNG_ROLE.DIAPHRAGM);
  assert.ok(d.length > 500, `${d.length} diaphragm stars`);
  for (const p of d) assert.ok(Math.abs(p[2] - diaphragmZ(p[0], p[1])) <= GEN.diaphragmSheet.thick / 2 + 1e-6, 'on the dome');
});

test('the airflow histogram sums to 1 and spans the dead space and the acini', () => {
  const h = lungFrontHist('high');
  assert.ok(Math.abs(h.w.reduce((a, b) => a + b, 0) - 1) < 1e-5);
  const top = h.s[h.s.length - 1];
  assert.ok(top > BREATH.vd && top <= BREATH.vd + BREATH.front.acinar);
  assert.ok(body.lungHist && body.lungHist.s.length === h.s.length, 'the body carries it for the renderer');
});

test('pulmonary arteries run beside the bronchi to generation pulmGen (bronchovascular bundles)', () => {
  const T = buildAirwayTree(), O = TREE.organ, det = vascularDetail();
  const arts = det.branches.filter((b) => b.part === VPART.PULM_ARTERY && b.name === 'pulmonary');
  const expected = T.branches.filter((b) => b.gen >= 2 && b.gen <= O.pulmGen && b.side).length;
  assert.equal(arts.length, expected);
  const ends = T.branches.filter((b) => b.gen >= 2 && b.gen <= O.pulmGen);
  for (const a of arts) {
    const e = a.pts[a.pts.length - 1];
    const near = Math.min(...ends.map((b) => Math.abs(Math.hypot(e[0] - b.b[0], e[1] - b.b[1], e[2] - b.b[2]) - b.r - Math.max(TREE.twig.minR, b.r * O.pulmCal) - O.pulmGap)));
    assert.ok(near < 1e-3, `each artery ends beside its bronchus (${near})`);
  }
});

test('close-up region in a lung: every airway generation near the pivot', () => {
  const T = buildAirwayTree(), seg = T.branches.find((b) => b.gen === 14 && b.side === 1);
  const c = seg.b, reg = generateFocusRegion({ budget: 'high', centre: c, radius: 30, k: 4, cap: 60000 });
  let fine = 0, all = 0;
  for (let i = 0; i < reg.count; i++) {
    const k = i * FLOATS;
    if (reg.points[k + 11] !== TISSUE.organ || roleOf(reg.points, k) !== LUNG_ROLE.AIRWAY) continue;
    all++;
    if (reg.points[k + 4] > 0.6 * BREATH.vd) fine++;
  }
  assert.ok(all > 300, `${all} airway stars in the region`);
  assert.ok(fine > 0.2 * all, `${fine} of them on the small airways`);
});

test('BODY_VS: the breathing uniforms within the slot budget', () => {
  assert.match(BODY_VS, /uniform vec4 uBreath;/);
  assert.match(BODY_VS, /uniform vec4 uAir;/);
  assert.ok(uniformSlots(BODY_VS).slots <= 110);
});

test('Lungs view names: named airways, smaller airways by segment and generation, and lung tissue by lobe', async () => {
  const { lungName, lungStarIndex, pickLungPoint } = await import('../src/lung-ui.js');
  const T = buildAirwayTree(), mid = (b) => [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, (b.a[2] + b.b[2]) / 2];
  const onWall = (b) => {   // the middle of the branch, on its wall
    const m = mid(b), d = [b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]], ax = Math.abs(d[2]) < 0.9 * Math.hypot(...d) ? [0, 0, 1] : [1, 0, 0];
    const n = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]], nl = Math.hypot(...n);
    return [m[0] + (n[0] / nl) * b.r, m[1] + (n[1] / nl) * b.r, m[2] + (n[2] / nl) * b.r];
  };
  const trachea = T.branches[0];
  assert.equal(lungName([trachea.a[0] + trachea.r, (trachea.a[1] + trachea.b[1]) / 2, (trachea.a[2] + trachea.b[2]) / 2]), 'Trachea');
  const g8 = T.branches.find((b) => b.gen === 8 && b.side === 1);
  assert.match(lungName(onWall(g8)), /segment \(B\d+(\+\d+)?\) · bronch(us|iole), generation 8/);
  const acinus = T.acini[0];
  assert.match(lungName(acinus.c), /lobe · .+ segment|generation/);
  assert.equal(lungName([0, 200, -100]), null, 'outside the lungs');
  const idx = lungStarIndex(body.points, FLOATS, body.count);
  assert.ok(idx.count > 28000);
  const eye = [0.8, 2.5, -3.0], tgt = [0.78, -0.18, -3.2], d = tgt.map((v, i) => v - eye[i]), l = Math.hypot(...d);
  const p = pickLungPoint(eye, d.map((v) => v / l), idx, { cone: 0.01 });
  assert.ok(p && lungName(p), 'a ray through the right lung names a structure');
});
