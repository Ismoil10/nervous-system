// Body part of the geometry tests (research/ANALYSIS.md B.14 `geometry.test.mjs`, phase 3, B.15):
// body point counts per tier (B.8, §13.4), determinism and chunked generation (§13.4 lazy build),
// the B.7 record layout, §2.14 path lengths against A.9 (10 %), the §13.12 picking exclusions from
// every §13.11 view and 1,000 random camera poses, and the A.1 pelvic-box content rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/anatomy.js';
import {
  STANDARD_PATHS, SITES, NODE_IDS, PATHS, TISSUE, TISSUE_NAMES, BODY_BOUNDS, PELVIC_FLOOR, siteById, bodySDF, inPerineum, sdEllipsoid, LUNG_ROLE,
} from '../src/body/geometry.js';
import { generateBody, generateBodyChunks, FLOATS, PARAMS as GEN } from '../src/body/generate.js';
import { pick, isPosteriorView } from '../src/body/picking.js';

const TIERS = ['low', 'medium', 'high', 'ultra'];
const B8_TOTAL = { low: 129583, medium: 253167, high: 417000, ultra: 648667 };  // B.8 `TIERS.body` (dense star model, dense heart, vascular tree)
const A9_TOLERANCE = 0.10;                                                      // A.9, §2.15
const SEED = 1848;
const bodies = new Map();
const bodyAt = (tier) => { if (!bodies.has(tier)) bodies.set(tier, generateBody({ budget: tier }, SEED)); return bodies.get(tier); };

test('generated counts stay within each tier budget (B.8, §13.4)', () => {
  for (const tier of TIERS) {
    const b = bodyAt(tier);
    assert.equal(b.floats, FLOATS);
    assert.equal(FLOATS, 16, 'B.7 body vertex record: 16 floats');
    assert.ok(b.count <= B8_TOTAL[tier], `${tier}: ${b.count} > ${B8_TOTAL[tier]}`);
    assert.equal(b.count, B8_TOTAL[tier], `${tier}: the budget is filled`);
    assert.equal(b.points.length, b.count * FLOATS);
    assert.deepEqual(b.ranges.map((r) => r.name), TISSUE_NAMES, 'one range per §13.4 budget group, in TISSUE order');
    let start = 0;
    for (const r of b.ranges) {
      assert.equal(r.start, start, `${tier} ${r.name} contiguous`);
      assert.ok(r.count <= GEN.budgets[tier][r.name], `${tier} ${r.name}: ${r.count} > ${GEN.budgets[tier][r.name]}`);
      start += r.count;
    }
  }
});

test('same seed gives the same hash; another seed a different one', () => {
  const a = generateBody({ budget: 'low' }, SEED), b = generateBody({ budget: 'low' }, SEED), c = generateBody({ budget: 'low' }, SEED + 1);
  assert.equal(a.hash, b.hash);
  assert.deepEqual(a.points, b.points);
  assert.notEqual(a.hash, c.hash);
});

test('chunked generation equals the one-shot result', () => {
  for (const tier of ['low', 'high']) {
    const one = bodyAt(tier);
    let yields = 0, body = null, ret = null;
    const it = generateBodyChunks({ budget: tier }, SEED, 0.25);
    for (;;) {
      const r = it.next();
      if (r.done) { ret = r.value; break; }
      yields++;
      if (r.value.done) body = r.value.body;
    }
    assert.ok(yields > 2, `${tier}: the build yields between slices (${yields})`);
    assert.ok(body && ret === body);
    assert.equal(body.hash, one.hash, `${tier} hash`);
    assert.deepEqual(body.points, one.points);
    assert.deepEqual(body.ranges, one.ranges);
  }
});

test('records follow the B.7 layout', () => {
  const b = bodyAt('high'), P = b.points;
  const lo = BODY_BOUNDS.min.map((v) => v - 20), hi = BODY_BOUNDS.max.map((v) => v + 20);
  for (const r of b.ranges) {
    for (let i = r.start; i < r.start + r.count; i++) {
      const k = i * FLOATS;
      for (let j = 0; j < FLOATS; j++) assert.ok(Number.isFinite(P[k + j]), `point ${i} float ${j}`);
      for (let a = 0; a < 3; a++) {
        const mm = P[k + a] * 100;
        assert.ok(mm >= lo[a] && mm <= hi[a], `${r.name} point ${i} outside the body bounds (${a}: ${mm})`);
      }
      assert.ok(P[k + 3] > 0, 'flux');
      assert.ok(P[k + 7] >= 0 && P[k + 7] < 1, 'seed');
      assert.ok(Number.isInteger(P[k + 8]) && P[k + 8] >= 0 && P[k + 8] < NODE_IDS.length, 'nodeId');
      assert.ok(Number.isInteger(P[k + 9]) && P[k + 9] >= -1 && P[k + 9] < PATHS.length, 'pathId');
      assert.ok(P[k + 10] >= 0 && P[k + 10] <= 1, 'u');
      assert.equal(P[k + 11], r.tissue, `${r.name} tissue class`);
      assert.ok(Number.isInteger(P[k + 12]) && P[k + 12] >= 0 && P[k + 12] <= 255, 'network bits');
      assert.ok([0, 1, 2].includes(P[k + 13]), 'LOD');
      assert.ok([-1, 0, 1].includes(P[k + 14]), 'side');
      assert.ok(P[k + 15] >= 0 && P[k + 15] < 14, 'rigid segment');
      const nl = Math.hypot(P[k + 4], P[k + 5], P[k + 6]);
      if (r.tissue === TISSUE.skin) assert.ok(Math.abs(nl - 1) < 1e-3, 'skin normal');
      else if (r.tissue === TISSUE.organ && P[k + 5] > 0.5) {   // heart stars (HEART.md): τ, part, axial place
        assert.ok([-1, -2, -3, -4, -5].includes(P[k + 4]) || (P[k + 4] >= 0 && P[k + 4] <= 3), 'heart τ (codes −1 to −5: inert, venous, leaflet valves)');
        assert.ok(Number.isInteger(P[k + 5]) && P[k + 5] >= 1 && P[k + 5] <= 20, 'heart part (1–15, and 16–20 the fine anatomy of HEART.md §8)');
        assert.ok(P[k + 6] >= 0 && P[k + 6] <= 1, 'heart axial place');
      } else if (r.tissue === TISSUE.vessel && P[k + 5] > 0.5) {   // vessel stars (PULSE.md §9): delay, part, amplitude
        assert.ok(P[k + 4] === -1 || (P[k + 4] >= 0 && P[k + 4] < 0.3), 'pulse delay (s; −1 none)');
        assert.ok(Number.isInteger(P[k + 5]) && P[k + 5] >= 1 && P[k + 5] <= 9, 'vessel part');
        if (P[k + 5] === 5) assert.ok(P[k + 4] === -1 && P[k + 6] >= 0.6 && P[k + 6] <= 1, 'capillary: no pulse, oxygen saturation');
        else assert.ok(P[k + 4] === -1 ? P[k + 6] === 0 : P[k + 6] > 0 && P[k + 6] < 2, 'pulse amplitude');
      } else if ((r.tissue === TISSUE.organ || r.tissue === TISSUE.muscle) && P[k + 5] < -1.5) {   // lung stars (LUNGS.md §7): volume coordinate, −role
        const role = -P[k + 5];
        assert.ok(Object.values(LUNG_ROLE).includes(role), `lung role ${role}`);
        assert.equal(role === LUNG_ROLE.DIAPHRAGM, r.tissue === TISSUE.muscle, 'the diaphragm is muscle; the other roles are organ');
        assert.ok(P[k + 4] >= 0 && P[k + 4] <= 0.46 && P[k + 6] === 0, 'volume coordinate (L)');
      } else assert.equal(nl, 0, 'volume points carry no normal');
    }
  }
  const skin = b.ranges[TISSUE.skin];   // skin stars lie on the drawn skin (§2.15 ±3 mm)
  for (let i = skin.start; i < skin.start + skin.count; i += 37) {
    const k = i * FLOATS;
    assert.ok(Math.abs(bodySDF(P[k] * 100, P[k + 1] * 100, P[k + 2] * 100)) < 3, `skin point ${i} off the skin`);
  }
});

test('body path lengths match §2.14 within the A.9 tolerance (10 %)', () => {
  for (const [id, v] of Object.entries(STANDARD_PATHS)) {
    if (v.a9) assert.ok(Math.abs(v.value - v.a9) / v.a9 <= A9_TOLERANCE, `${id}: ${v.value.toFixed(1)} vs A.9 ${v.a9}`);
    if (v.ref) assert.ok(Math.abs(v.value - v.ref) / v.ref <= A9_TOLERANCE, `${id}: ${v.value.toFixed(1)} vs §2.14 ${v.ref}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Picking (§13.12) from the §13.11 views and random camera poses
// ---------------------------------------------------------------------------------------------
const FOV = 0.55, ASPECT = 16 / 9;   // §13.11 vertical field of view; a landscape canvas
// §13.11 presets (target in units, distance in units, yaw, pitch). The brain views use main.js's
// distances; their target and angles are approximations (only the distance is tabulated in §13.11).
const VIEWS = [
  { id: 'brainWhole', t: [0, 0, 0], d: 3.6, yaw: -0.6, pitch: 0.3 },
  { id: 'brainCutaway', t: [0, 0, 0], d: 3.2, yaw: -0.6, pitch: 0.3 },
  { id: 'brainDopamine', t: [0, 0, 0], d: 3.0, yaw: -0.6, pitch: 0.3 },
  { id: 'wholeBody', t: [0, -0.2, -7.9], d: 35, yaw: -0.35, pitch: 0.10 },
  { id: 'upperBody', t: [0, 0, -2.46], d: 13.6, yaw: -0.35, pitch: 0.10 },
  { id: 'headNeck', t: [0, 0.1, -0.4], d: 6.7, yaw: -0.5, pitch: 0.15 },
  { id: 'thorax', t: [-0.1, 0, -3.3], d: 6.7, yaw: -0.25, pitch: 0.10 },
  { id: 'abdomen', t: [0, 0.1, -5.9], d: 8.6, yaw: -0.25, pitch: 0.10 },
  { id: 'torso', t: [0, 0, -4.6], d: 14.3, yaw: -0.35, pitch: 0.10 },
  { id: 'spine', t: [0, -0.6, -4.3], d: 15.9, yaw: Math.PI, pitch: 0.10 },
  { id: 'rightArm', t: [2.2, -0.2, -5.5], d: 17.5, yaw: 0.6, pitch: 0.10 },
  { id: 'rightLeg', t: [0.9, 0, -12.0], d: 20.4, yaw: 0.45, pitch: 0.10 },
];
const SENSES = [null, 'touch', 'pain', 'temperature', 'proprioception', 'interoception', 'vision', 'hearing', 'smell', 'taste', 'balance'];
const FORBIDDEN = new Set(['dermatome.S4', 'dermatome.S5', 'perineum', 'pelvicFloor']);

// Camera as camera.js: eye = target + d·(cos p · sin yaw, cos p · cos yaw, sin p); rays in mm.
function camera({ t, d, yaw, pitch }) {
  const T = t.map((v) => v * 100), D = d * 100, cp = Math.cos(pitch);
  const eye = [T[0] + D * cp * Math.sin(yaw), T[1] + D * cp * Math.cos(yaw), T[2] + D * Math.sin(pitch)];
  const f = norm([T[0] - eye[0], T[1] - eye[1], T[2] - eye[2]]);
  const r = norm(cross(f, [0, 0, 1])), u = cross(r, f), th = Math.tan(FOV / 2);
  return { eye, yaw, ray(nx, ny) {
    const cx = nx * th * ASPECT, cy = ny * th;
    return { origin: eye, dir: norm([f[0] + r[0] * cx + u[0] * cy, f[1] + r[1] * cx + u[1] * cy, f[2] + r[2] * cx + u[2] * cy]) };
  } };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

function checkPick(res, yaw, where) {
  if (!res) return null;
  const s = res.site;
  assert.ok(!FORBIDDEN.has(s.base), `${where}: returned ${s.id}`);
  assert.ok(!inPerineum(s.pos), `${where}: ${s.id} lies in the perineal region`);
  assert.ok(sdEllipsoid(s.pos, PELVIC_FLOOR.c, PELVIC_FLOOR.r) >= 0, `${where}: ${s.id} lies in the pelvic-floor field`);
  if (s.kind === 'skin') assert.ok(!inPerineum(res.point), `${where}: skin hit in the perineal region resolved to ${s.id}`);
  if (s.base === 'dermatome.S3') assert.ok(isPosteriorView(yaw), `${where}: dermatome.S3 from yaw ${yaw.toFixed(2)}`);
  return s;
}

test('no ray from any §13.11 view returns S4–S5, perineal or pelvic-floor sites; S3 only from posterior views', () => {
  const GX = 48, GY = 27;
  let picks = 0;
  const s3ByView = {};
  for (const v of VIEWS) {
    const cam = camera(v);
    for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
      const ray = cam.ray(((i + 0.5) / GX) * 2 - 1, ((j + 0.5) / GY) * 2 - 1);
      for (const sense of SENSES) {
        const s = checkPick(pick(ray, { sense, bodyMode: 'body', yaw: v.yaw }), v.yaw, `${v.id} ${sense}`);
        if (s) picks++;
        if (s?.base === 'dermatome.S3') s3ByView[v.id] = (s3ByView[v.id] || 0) + 1;
      }
      assert.equal(pick(ray, { sense: 'touch', bodyMode: 'brain', yaw: v.yaw }), null, 'brain-only mode: no body picking');
    }
  }
  assert.ok(picks > 1000, `views produce picks (${picks})`);
  for (const id of Object.keys(s3ByView)) assert.equal(id, 'spine', `dermatome.S3 picked from ${id}`);
});

test('1,000 random camera poses never return excluded sites; S3 only from posterior yaw', () => {
  const rnd = mulberry32(1302);
  const R = (a, b) => a + (b - a) * rnd();
  const targets = [   // aimed rays at the excluded structures and at S3 (the hardest cases)
    siteById('dermatome.S4').pos, siteById('dermatome.S5').pos, [0, -10, -845], [20, 40, -830], PELVIC_FLOOR.c,
    siteById('dermatome.S3.R').pos, siteById('dermatome.S3.L').pos, [0, -120, -800],
  ];
  const senses = SENSES;
  let picks = 0, s3 = 0;
  for (let n = 0; n < 1000; n++) {
    const pose = { t: [R(-2, 2), R(-1.5, 1.5), R(-16, 0.5)], d: R(1, 45), yaw: R(-Math.PI, Math.PI), pitch: R(-1.4, 1.4) };
    const cam = camera(pose);
    const rays = [];
    for (let k = 0; k < 6; k++) rays.push(cam.ray(R(-1, 1), R(-1, 1)));
    for (const q of targets) rays.push({ origin: cam.eye, dir: norm([q[0] - cam.eye[0], q[1] - cam.eye[1], q[2] - cam.eye[2]]) });
    for (const [k, ray] of rays.entries()) {
      for (const sense of senses) {
        const s = checkPick(pick(ray, { sense, bodyMode: 'body', yaw: pose.yaw }), pose.yaw, `pose ${n} ray ${k} ${sense}`);
        if (s) picks++;
        if (s?.base === 'dermatome.S3') s3++;
      }
    }
  }
  assert.ok(picks > 500, `random poses produce picks (${picks})`);
  assert.ok(s3 > 0, 'dermatome.S3 is reachable from posterior poses');
});

test('dermatome.S3 is picked from behind and refused from the front along the same ray', () => {
  const s3 = siteById('dermatome.S3.R');
  const eye = [s3.pos[0], s3.pos[1] - 1500, s3.pos[2] + 100];
  const ray = { origin: eye, dir: norm([s3.pos[0] - eye[0], s3.pos[1] - eye[1], s3.pos[2] - eye[2]]) };
  assert.equal(pick(ray, { sense: 'touch', yaw: Math.PI })?.site.base, 'dermatome.S3');
  assert.notEqual(pick(ray, { sense: 'touch', yaw: 0 })?.site.base, 'dermatome.S3');
  assert.equal(pick(ray, { sense: 'touch', yaw: Math.PI, bodyMode: 'brain' }), null);
});

test('no body points of excluded structures in the pelvic box (A.1)', () => {
  const forbiddenName = /genit|penis|penile|prostat|testi|scrot|vagin|uter|ovar|clitor|vulv|labia|semin|nipple|navel|hair/i;
  for (const id of NODE_IDS) assert.ok(!forbiddenName.test(id), `node id ${id}`);
  const nerveIds = new Set(PATHS.map((p) => p.nerve));
  const allowed = {
    [TISSUE.skin]: (id) => id.startsWith('skin.'),                                   // the smooth pelvic shell (§13.2)
    [TISSUE.organ]: (id) => id === 'bladder' || (id.startsWith('gut.') && id !== 'gut.ias' && id !== 'gut.eas'),
    [TISSUE.muscle]: (id) => ['pelvicFloor', 'glutealMax', 'adductors', 'hamstrings', 'quadriceps', 'rectusAbdominis', 'erectorSpinae'].includes(id),
    [TISSUE.bone]: (id) => id === 'pelvis' || id.startsWith('vert.'),
    [TISSUE.cord]: (id) => id.startsWith('cord.') || id.startsWith('drg.') || id === 'filum',
    [TISSUE.nerve]: (id) => nerveIds.has(id),
    [TISSUE.ganglion]: (id) => nerveIds.has(id) || /^(chain\.|impar|infHypogastric|supHypogastric)/.test(id),
    [TISSUE.enteric]: (id) => id.startsWith('gut.') && id !== 'gut.ias' && id !== 'gut.eas',
    [TISSUE.vessel]: (id) => ['blood', 'aorta', 'ivc', 'gut.ileum'].includes(id),
  };
  const box = (x, y, z) => Math.abs(x) < 110 && y > -130 && y < 110 && z < -640 && z > -900;   // pelvic box (§2.6 pelvis, crotch)
  for (const tier of ['low', 'ultra']) {
    const b = bodyAt(tier), P = b.points;
    let inBox = 0;
    for (let i = 0; i < b.count; i++) {
      const k = i * FLOATS, x = P[k] * 100, y = P[k + 1] * 100, z = P[k + 2] * 100;
      if (!box(x, y, z)) continue;
      inBox++;
      const id = NODE_IDS[P[k + 8]], tissue = P[k + 11];
      assert.ok(allowed[tissue](id), `${tier}: ${TISSUE_NAMES[tissue]} point of ${id} in the pelvic box at (${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)})`);
      if (inPerineum([x, y, z])) {
        // Besides the smooth shell, nerves, the unlabelled field and the thigh and gluteal muscles,
        // the only viscus in the perineal region is the rectum down to the anorectal junction above
        // the pelvic-floor field (the anal canal is not drawn).
        const floorLow = PELVIC_FLOOR.c[2] - PELVIC_FLOOR.r[2];
        if (tissue === TISSUE.organ || tissue === TISSUE.enteric) {
          assert.ok(id === 'gut.rectum' && z >= floorLow, `${tier}: ${TISSUE_NAMES[tissue]} point of ${id} in the perineal region at z ${z.toFixed(0)}`);
        }
      }
    }
    assert.ok(inBox > 0, 'the pelvic box is populated by allowed structures');
  }
});

test('every never-pickable site is flagged and absent from picking lists', () => {
  for (const s of SITES) if (FORBIDDEN.has(s.base)) assert.equal(s.pickable, false, s.id);
});
