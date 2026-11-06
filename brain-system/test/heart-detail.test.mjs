// Heart close-up (research/HEART.md §8): the fine anatomy and its labels, the landmarks of the right
// atrium, the four-chamber section, the energy-conserving close-up density law, the close-up and
// cut-face buffers, the body shader hooks, the hover pick and the beat's focus and section ramps.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HEART_FORM, HEART_SECTION, HEART_LOD, PART, LABEL, LABEL_NAMES, heartDensity, closeUpWeight, closeUpRank, labelOf } from '../src/body/heart-form.js';
import { generateBody, generateHeartCloseUp } from '../src/body/generate.js';
import { BODY_VS, uniformSlots } from '../src/shaders.js';
import { HeartBeat } from '../src/heart.js';
import { heartLabelIndex, pickHeartLabel } from '../src/heart-ui.js';

const body = generateBody({ budget: 'medium' }, 1848);
const heartOf = (pts, floats, count) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const o = i * floats, part = Math.round(pts[o + 5]);
    if (pts[o + 11] === 1 && part > 0) out.push({ p: [0, 1, 2].map((k) => pts[o + k] / 0.01), part, label: labelOf(pts[o + 10]), lod: pts[o + 13] });
  }
  return out;
};
const heart = heartOf(body.points, body.floats, body.count);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sdOf = (p) => (p[0] - HEART_SECTION.p[0]) * HEART_SECTION.n[0] + (p[1] - HEART_SECTION.p[1]) * HEART_SECTION.n[1] + (p[2] - HEART_SECTION.p[2]) * HEART_SECTION.n[2];

test('fine anatomy: every structure has stars and a name; the fine parts are a fifth of the heart', () => {
  const byLabel = new Map();
  for (const s of heart) byLabel.set(s.label, (byLabel.get(s.label) || 0) + 1);
  for (const [key, id] of Object.entries(LABEL)) {
    assert.ok(byLabel.get(id) > 0, `${key} has stars`);
    assert.ok(LABEL_NAMES[id] && LABEL_NAMES[id].length > 3, `${key} has a name`);
  }
  assert.equal(byLabel.get(0) ?? 0, 0, 'every heart star carries a structure');
  const fine = heart.filter((s) => s.part >= PART.TRABECULA).length / heart.length;
  assert.ok(fine > 0.12 && fine < 0.3, `fine anatomy share ${fine.toFixed(3)}`);
  // Leaflets: both mitral leaflets, all three cusps of each semilunar valve, nodules and lunulae.
  for (const k of ['mvAnt', 'mvPost', 'tvAnt', 'tvPost', 'tvSept', 'avR', 'avL', 'avN', 'pvA', 'pvL', 'pvR', 'nodule', 'lunula']) {
    assert.ok(heart.filter((s) => s.label === LABEL[k] && s.part === PART.LEAFLET).length > 20, `${k} leaflet stars`);
  }
});

test('right atrium landmarks: fossa on the septal wall, coronary sinus ostium below it, IVC at the floor', () => {
  const L = HEART_FORM.landmarks, ra = HEART_FORM.ra.c, la = HEART_FORM.la.c;
  const toLa = [la[0] - ra[0], la[1] - ra[1], la[2] - ra[2]];
  assert.ok(L.fossa.n[0] * toLa[0] + L.fossa.n[1] * toLa[1] + L.fossa.n[2] * toLa[2] > 0, 'the fossa faces the left atrium');
  assert.ok(L.csOstium.c[2] < L.fossa.c[2], 'the coronary sinus ostium lies below the fossa');
  assert.ok(L.ivc.c[2] < ra[2] - 15, 'the IVC opens into the floor of the atrium');
  assert.ok(dist(L.csOstium.c, L.csEnd) < 30, 'the coronary sinus reaches its ostium');
  // The RA wall leaves the fossa and the ostium to their own stars.
  const wallInOstium = heart.filter((s) => s.label === LABEL.raWall && dist(s.p, L.csOstium.c) < HEART_FORM.csOstium.r * 0.8).length;
  assert.equal(wallInOstium, 0, 'no atrial wall stars across the coronary sinus ostium');
});

test('section: the four-chamber plane passes through the apex, both AV valves and both atria', () => {
  const H = HEART_FORM;
  for (const [name, p] of [['apex', H.apex], ['tricuspid', H.valves[0].c], ['mitral', H.valves[1].c], ['RA', H.ra.c], ['LA', H.la.c]]) {
    assert.ok(Math.abs(sdOf(p)) < 12, `${name} within 12 mm of the plane (${sdOf(p).toFixed(1)})`);
  }
  assert.ok(Math.abs(Math.hypot(...HEART_SECTION.n) - 1) < 1e-9);
  // Both halves hold walls of all four chambers.
  for (const part of [PART.LV, PART.RV, PART.RA, PART.LA]) {
    const s = heart.filter((x) => x.part === part);
    assert.ok(s.some((x) => sdOf(x.p) > 2) && s.some((x) => sdOf(x.p) < -2), `part ${part} on both sides`);
  }
});

test('close-up density law: energy-conserving, monotonic, the stars grow only past D_max', () => {
  const dmax = 4.8;
  let last = 0;
  for (let q = 1; q <= 40; q += 0.5) {
    const D = heartDensity(q, dmax);
    assert.ok(D.d >= 1 - 1e-12 && D.d <= dmax + 1e-9, `d in [1, D_max] at q ${q}`);
    assert.ok(D.d >= last - 1e-12, 'drawn density never falls as the camera nears');
    last = D.d;
    assert.ok(D.size >= 1 && D.size <= HEART_LOD.sizeMax + 1e-12);
    if (D.want <= dmax) assert.equal(D.size, 1);
  }
  assert.equal(heartDensity(HEART_LOD.q0 * 0.9, dmax).d, 1, 'no close-up stars below q0');
  assert.ok(Math.abs(heartDensity(40, dmax).d - dmax) < 1e-9, 'all close-up stars at the cap');
  // Monte Carlo over ranks: the visible close-up share equals the share the flux is divided by.
  const N = 40000, ranks = Array.from({ length: N }, (_, i) => closeUpRank((i + 0.5) / N * 0.9999 + 1e-5));
  for (const q of [5, 6.4, 8, 9.5]) {
    const D = heartDensity(q, dmax), seen = ranks.reduce((a, r) => a + closeUpWeight(r, D.f), 0) / N;
    const light = (1 + (dmax - 1) * seen) / D.d;   // the heart's light relative to the base buffer alone
    assert.ok(Math.abs(light - 1) < 0.02, `light conserved at q ${q}: ${light.toFixed(4)}`);
  }
});

test('close-up and cut-face buffers: counts, tags, structure shares, the slab, determinism', () => {
  const a = generateHeartCloseUp('medium', 1848), b = generateHeartCloseUp('medium', 1848);
  assert.equal(a.count, HEART_LOD.stars.medium);
  assert.equal(a.sectionCount, HEART_LOD.section.medium);
  assert.equal(a.sectionStart, a.count);
  assert.deepEqual(a.points.subarray(0, 4000), b.points.subarray(0, 4000), 'deterministic per seed');
  assert.equal(generateHeartCloseUp('low').count + generateHeartCloseUp('low').sectionCount, 0, 'nothing at Low');
  const stars = heartOf(a.points, a.floats, a.count + a.sectionCount);
  assert.equal(stars.length, a.count + a.sectionCount, 'every point is a heart star');
  const close = stars.slice(0, a.count), cut = stars.slice(a.count);
  assert.ok(close.every((s) => s.lod === HEART_LOD.lod) && cut.every((s) => s.lod === HEART_LOD.sectionLod), 'LOD tags');
  assert.ok(cut.every((s) => Math.abs(sdOf(s.p)) <= HEART_LOD.slab + 1e-6), 'the cut face lies within the slab');
  // The close-up mixture matches the body's heart, so dividing every heart star's flux by D is fair.
  const share = (list, part) => list.filter((s) => s.part === part).length / list.length;
  for (const part of [PART.LV, PART.RV, PART.LEAFLET, PART.PURKINJE, PART.FAT]) {
    assert.ok(Math.abs(share(close, part) - share(heart, part)) < 0.01, `part ${part} share`);
  }
});

test('BODY_VS: close-up, depth cue, section and focus hooks within the slot limit', () => {
  assert.ok(uniformSlots(BODY_VS).slots <= 110, 'no new uniform slots');
  assert.match(BODY_VS, /uHeartV\.w/, 'section amount in uHeartV.w');
  assert.match(BODY_VS, /uPulse\.w/, 'close-up density cap in uPulse.w');
  assert.match(BODY_VS, /rampInt\(F\) - rampInt\(F - 1\.0\)/, 'expected drawn density');
  assert.match(BODY_VS, /mix\(1\.0, [\d.]+, uHeartK\.w\)/, 'continuous focus');
  assert.match(BODY_VS, /uStyle\.x < 0\.5\) \{ gl_Position/, 'Stars draws no fine anatomy');
});

test('hover pick: the front structure under the ray wins; the section and the style hide stars', () => {
  // Synthetic heart index: an LV wall cluster in front of a leaflet cluster, on the camera's side.
  const pts = [], add = (p, label, part, flux = 0.4) => pts.push([...p.map((v) => v * 0.01), label, part, flux]);
  const C = HEART_FORM.landmarks.fossa.c, n = HEART_SECTION.n, eye = C.map((v, k) => (v + n[k] * 400) * 0.01);
  for (let i = 0; i < 40; i++) { add(C.map((v, k) => v + n[k] * 30 + (i % 3) * 0.1), LABEL.lvWall, PART.LV); add(C.map((v, k) => v + n[k] * 5 + (i % 3) * 0.1), LABEL.mvAnt, PART.LEAFLET); }
  add(C.map((v, k) => v + n[k] * 31), LABEL.fat, PART.FAT, 0.2);
  const index = { data: Float32Array.from(pts.flat()), count: pts.length };
  const dir = n.map((v) => -v);
  assert.equal(pickHeartLabel(eye, dir, index, { section: 0 }), LABEL.lvWall, 'the wall in front');
  assert.equal(pickHeartLabel(eye, dir, index, { section: 1 }), LABEL.mvAnt, 'opened: the wall on the camera side is gone');
  assert.equal(pickHeartLabel(eye, [1, 0, 0], index, {}), 0, 'nothing off the heart');
  const idx = heartLabelIndex(body.points, body.floats, body.count);
  assert.equal(idx.count, heart.length, 'every heart star is indexed');
});

test('beat: the focus eases, the section opens over its ramp, the Stars mean leaves out the fine parts', () => {
  const h = new HeartBeat();
  h.setStars(body.points, body.floats, body.count);
  assert.ok(h.allStars && h.earlierStars && h.allStars !== h.earlierStars, "two wave samples");
  h.step(0.05, { focus: 1 });
  assert.ok(h.K[3] > 0 && h.K[3] < 1, 'the focus eases in');
  for (let i = 0; i < 60; i++) h.step(1 / 60, { focus: 1, section: true });
  assert.ok(h.K[3] > 0.95, "the focus is in");
  assert.equal(h.V[3], 1, 'open within a second');
  h.step(0.1, { focus: 1, section: false });
  assert.ok(h.V[3] < 1 && h.V[3] > 0, 'closing ramps down');
  h.step(0.05, { detailed: false });
  assert.equal(h.stars, h.earlierStars, 'Stars takes the wave mean over the parts it draws');
});
