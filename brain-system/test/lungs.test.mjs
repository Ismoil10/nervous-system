// Lungs in the body (research/LUNGS.md §7, §14): the lung stars by role and their shares, the upper
// airway inside the head and neck, the airway generations of the whole-body build, the pleura over
// the lungs and along the fissures, the air particles, the diaphragm sheet, the bronchovascular
// arteries, the close-up region's finer airways and acini, the names, and the breathing uniforms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBody, generateFocusRegion, vascularDetail, packVector, FLOATS, PARAMS as GEN } from '../src/body/generate.js';
import { LUNG_ROLE, TISSUE, HEAD, diaphragmZ, bodySDF } from '../src/body/geometry.js';
import { buildAirwayTree, lobeOf, lungRegion, upperAirwaySegments, AIRWAY } from '../src/body/airway-tree.js';
import { VPART, TREE } from '../src/body/vessel-tree.js';
import { BODY_VS, uniformSlots } from '../src/shaders.js';
import { BREATH } from '../src/breath.js';

const body = generateBody({ budget: 'high', lod: 2 }, 1848);
const roleOf = (P, k) => (P[k + 5] < -1.5 ? Math.round(-P[k + 5]) : 0);
const stars = (tissue, role, pts = body) => {
  const r = pts.ranges ? pts.ranges[tissue] : { start: 0, count: pts.count }, P = pts.points, out = [];
  for (let i = r.start; i < r.start + r.count; i++) {
    const k = i * FLOATS;
    if (P[k + 11] === tissue && roleOf(P, k) === role) out.push([P[k] * 100, P[k + 1] * 100, P[k + 2] * 100, P[k + 4], P[k + 6], P[k + 10]]);
  }
  return out;
};
const T = buildAirwayTree(), U = upperAirwaySegments();
const nearSeg = (p, a, b) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2));
  return [Math.hypot(a[0] + t * d[0] - p[0], a[1] + t * d[1] - p[1], a[2] + t * d[2] - p[2]), t];
};

test('lung stars: the roles in their shares; no parenchyma haze in the body build', () => {
  const S = GEN.lung.share, n = (role) => stars(TISSUE.organ, LUNG_ROLE[role]).length;
  const c = { airway: n('AIRWAY'), air: n('AIR'), acini: n('ACINUS'), pleura: n('PLEURA'), haze: n('PARENCHYMA') };
  const total = c.airway + c.air + c.acini + c.pleura;
  assert.ok(total > 28000 && total < 32000, `${total} lung stars at High`);
  assert.equal(c.haze, 0);
  for (const [k, s] of [['airway', S.airway + S.upper], ['air', S.air], ['acini', S.acini], ['pleura', S.pleura + S.fissure]]) {
    assert.ok(Math.abs(c[k] / total - s) < 0.01, `${k}: ${c[k]} of ${total}`);
  }
});

test('upper airway: nostrils to the trachea, inside the head and neck, clear of the eyes and the brain (§14.1)', () => {
  assert.ok(Math.abs(U[0].a[1] - 91) < 2 && Math.abs(U.at(-1).b[2] - T.branches[0].a[2]) < 1e-9, 'from the nostril to the top of the trachea');
  assert.ok(Math.abs(U.at(-1).vol1 - AIRWAY.upperDeadSpace) < 1e-9 && U[0].vol0 === 0, 'volume coordinate 0 at the nostril, the upper dead space at the trachea');
  const up = stars(TISSUE.organ, LUNG_ROLE.AIRWAY).filter((p) => p[2] > T.branches[0].a[2] + 1);
  assert.ok(up.length > 1000, `${up.length} upper airway stars`);
  for (const p of up) {
    assert.ok(bodySDF(p[0], p[1], p[2]) <= 0.2, `inside the skin at ${p.map((v) => v.toFixed(0))}`);
    assert.ok(Math.hypot(Math.abs(p[0]) - HEAD.eye.c[0], p[1] - HEAD.eye.c[1], p[2] - HEAD.eye.c[2]) > HEAD.eye.r + 2, 'clear of the eyes');
    assert.ok(p[2] < -48, 'below the cribriform plate and the brain');
  }
});

test('airway walls of the base generations; volume coordinates within the dead space', () => {
  const air = stars(TISSUE.organ, LUNG_ROLE.AIRWAY).filter((p) => p[2] <= T.branches[0].a[2] + 1), base = T.branches.filter((b) => b.gen <= GEN.lung.baseGen.high);
  for (let i = 0; i < air.length; i += 61) {
    const p = air[i];
    const best = Math.min(...base.map((b) => Math.abs(nearSeg(p, b.a, b.b)[0] - b.r)));
    assert.ok(best < 0.5 * GEN.lung.wall * 9 + 0.05, `airway star ${i} ${best.toFixed(2)} mm from a wall`);
    assert.ok(p[3] >= 0 && p[3] <= BREATH.vd + 1e-6, `volume coordinate ${p[3]}`);
  }
});

test('pleura: the lung surface and the fissure sheets between lobes (§14.2)', () => {
  const pl = stars(TISSUE.organ, LUNG_ROLE.PLEURA);
  let fissure = 0;
  for (const p of pl) {
    const a = lobeOf([p[0], p[1], p[2] + 1.5]), b = lobeOf([p[0], p[1], p[2] - 1.5]);
    if (a >= 0 && b >= 0 && a !== b) fissure++;
  }
  assert.ok(Math.abs(fissure / pl.length - GEN.lung.share.fissure / (GEN.lung.share.fissure + GEN.lung.share.pleura)) < 0.06, `${fissure} of ${pl.length} on the fissures`);
  for (let i = 0; i < pl.length; i += 17) assert.ok(lungRegion(pl[i]) !== 0 || lungRegion([pl[i][0], pl[i][1], pl[i][2] - 1]) !== 0, 'on a lung');
});

test('air particles: inside a lumen, each with its branch vector packed exactly (§14.3)', () => {
  const air = stars(TISSUE.organ, LUNG_ROLE.AIR), pipes = [...U, ...T.branches.filter((b) => b.gen <= GEN.lung.air.maxGen && b.len >= GEN.lung.air.minLen)];
  const packs = new Set(pipes.map((b) => packVector([b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]])));
  assert.ok(air.length > 2500, `${air.length} particles`);
  for (let i = 0; i < air.length; i += 7) {
    const p = air[i], v = p[4];
    assert.ok(packs.has(v), 'a known branch vector');
    const z = Math.floor(v / 65536), y = Math.floor((v - z * 65536) / 256), x = v - z * 65536 - y * 256;
    for (const c of [x, y, z]) assert.ok(c >= 8 && c <= 248, 'components clear of the unpacking edges');
    assert.ok(p[5] >= 0 && p[5] < 1, 'phase');
  }
});

test('the diaphragm sheet lies on its dome, as muscle', () => {
  const d = stars(TISSUE.muscle, LUNG_ROLE.DIAPHRAGM);
  assert.ok(d.length > 500, `${d.length} diaphragm stars`);
  for (const p of d) assert.ok(Math.abs(p[2] - diaphragmZ(p[0], p[1])) <= GEN.diaphragmSheet.thick / 2 + 1e-6, 'on the dome');
});

test('pulmonary arteries run beside the bronchi to generation pulmGen (bronchovascular bundles)', () => {
  const O = TREE.organ, det = vascularDetail();
  const arts = det.branches.filter((b) => b.part === VPART.PULM_ARTERY && b.name === 'pulmonary');
  assert.equal(arts.length, T.branches.filter((b) => b.gen >= 2 && b.gen <= O.pulmGen && b.side).length);
  const ends = T.branches.filter((b) => b.gen >= 2 && b.gen <= O.pulmGen);
  for (const a of arts) {
    const e = a.pts[a.pts.length - 1];
    const near = Math.min(...ends.map((b) => Math.abs(Math.hypot(e[0] - b.b[0], e[1] - b.b[1], e[2] - b.b[2]) - b.r - Math.max(TREE.twig.minR, b.r * O.pulmCal) - O.pulmGap)));
    assert.ok(near < 1e-3, `each artery ends beside its bronchus (${near})`);
  }
});

test('close-up region in a lung: every airway generation and the acini near the pivot', () => {
  const seg = T.branches.find((b) => b.gen === 14 && b.side === 1);
  const reg = generateFocusRegion({ budget: 'high', centre: seg.b, radius: 30, k: 4, cap: 60000 });
  const air = stars(TISSUE.organ, LUNG_ROLE.AIRWAY, reg), ac = stars(TISSUE.organ, LUNG_ROLE.ACINUS, reg);
  const fine = air.filter((p) => p[3] > 0.6 * BREATH.vd).length;
  assert.ok(air.length > 300 && fine > 0.2 * air.length, `${air.length} airway stars, ${fine} on the small airways`);
  const baseAcini = stars(TISSUE.organ, LUNG_ROLE.ACINUS).filter((p) => Math.hypot(p[0] - seg.b[0], p[1] - seg.b[1], p[2] - seg.b[2]) < 30).length;
  assert.ok(ac.length > 3 * Math.max(1, baseAcini), `${ac.length} acinus stars in the region, ${baseAcini} in the body build there`);
});

test('Lungs view names: the nose, named airways, smaller airways by segment and generation, lung tissue by lobe', async () => {
  const { lungName, lungStarIndex, pickLungPoint } = await import('../src/lung-ui.js');
  const mid = (b) => [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, (b.a[2] + b.b[2]) / 2];
  const onWall = (b) => {
    const m = mid(b), d = [b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]], ax = Math.abs(d[2]) < 0.9 * Math.hypot(...d) ? [0, 0, 1] : [1, 0, 0];
    const n = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]], nl = Math.hypot(...n);
    return [m[0] + (n[0] / nl) * b.r, m[1] + (n[1] / nl) * b.r, m[2] + (n[2] / nl) * b.r];
  };
  const tr = T.branches[0];
  assert.equal(lungName([tr.a[0] + tr.r, (tr.a[1] + tr.b[1]) / 2, (tr.a[2] + tr.b[2]) / 2]), 'Trachea');
  assert.match(lungName(mid(U[2])), /Nasal (cavity|vestibule) · right/);
  assert.match(lungName(mid(U.find((g) => g.name === 'Oropharynx'))), /Oropharynx/);
  const g6 = T.branches.find((b) => b.gen === 6 && b.side === 1);
  assert.match(lungName(onWall(g6)), /segment \(B\d+(\+\d+)?\) · bronch(us|iole), generation 6/);
  assert.match(lungName(T.acini[0].c), /lobe · .+ segment|generation/);
  assert.equal(lungName([0, 200, -100]), null, 'outside the lungs');
  const idx = lungStarIndex(body.points, FLOATS, body.count);
  assert.ok(idx.count > 20000);
  const eye = [0.8, 2.5, -3.0], tgt = [0.78, -0.18, -3.2], d = tgt.map((v, i) => v - eye[i]), l = Math.hypot(...d);
  const p = pickLungPoint(eye, d.map((v) => v / l), idx, { cone: 0.01 });
  assert.ok(p && lungName(p), 'a ray through the right lung names a structure');
});

test('BODY_VS: the breathing uniforms within the slot budget', () => {
  assert.match(BODY_VS, /uniform vec4 uBreath;/);
  assert.match(BODY_VS, /uniform vec4 uAir;/);
  assert.ok(uniformSlots(BODY_VS).slots <= 110);
});

test('breathing gate: trunk lung stars as packed by put() pass BODY_VS\'s gate; the head stays out', () => {
  // generate.js stores rigidAt(p) in float 15; BODY_VS takes seg = floor(aNet.w + 0.5) and moves
  // the trunk (seg 0) with the breath (LUNGS.md §14.3; the gate once tested seg < 0 and never ran).
  const gate = BODY_VS.match(/if \(seg (==|<|<=|>=) (-?\d+) && \(uBreath\.x > 0\.0/);
  assert.ok(gate, 'the breathing gate is in BODY_VS');
  const pass = (seg) => ({ '==': seg === +gate[2], '<': seg < +gate[2], '<=': seg <= +gate[2], '>=': seg >= +gate[2] })[gate[1]];
  const P = body.points;
  let trunk = 0, head = 0;
  for (const tissue of [TISSUE.organ, TISSUE.muscle]) {
    const r = body.ranges[tissue];
    for (let i = r.start; i < r.start + r.count; i++) {
      const k = i * FLOATS, role = roleOf(P, k);
      if (!role) continue;
      const seg = Math.floor(P[k + 15] + 0.5);
      if (P[k + 2] * 100 < -220) { assert.ok(pass(seg), `a lung star at z ${(P[k + 2] * 100).toFixed(0)} with seg ${seg} must breathe`); trunk++; }
      else if (P[k + 2] * 100 > -90 && role === LUNG_ROLE.AIRWAY) { assert.ok(!pass(seg), 'the nose is on the head segment'); head++; }
    }
  }
  assert.ok(trunk > 20000 && head > 100, `${trunk} trunk, ${head} head stars checked`);
});

test('the airways and air particles keep their light in the head (no head fade, §14.1)', () => {
  assert.match(BODY_VS, /lungRole != \d+ && lungRole != \d+\) flux \*= mix\(1\.0, mix\(headF, 1\.0, uSenseFull\), head\)/);
});
