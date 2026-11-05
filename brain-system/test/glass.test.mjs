// Glass shells (src/glass.js): the surface-nets mesher on a known field, and the shell table
// against the fields and organs it names.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { meshSDF, meshSDFChunks, organSDF, GLASS_SHELLS, glassChunks, sdCerebrumGlass, FOLD_SCALE } from '../src/glass.js';
import { sdCerebrum } from '../src/anatomy.js';
import { ORGANS } from '../src/body/geometry.js';
import { GLASS_VS, GLASS_FS, BODY_VS, uniformSlots } from '../src/shaders.js';
import { PROGRAMS } from '../src/renderer.js';

test('surface nets: a closed, accurate sphere with outward normals', () => {
  const R = 10;
  const m = meshSDF((x, y, z) => Math.hypot(x, y, z) - R, { min: [-R, -R, -R], max: [R, R, R] }, 1);
  const V = m.positions.length / 3, T = m.indices.length / 3;
  assert.ok(V > 1000);
  assert.equal(T, 2 * V - 4, 'a closed genus-0 surface: Euler V − E + F = 2');
  for (let i = 0; i < V; i++) {
    const p = [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]];
    const r = Math.hypot(...p);
    assert.ok(Math.abs(r - R) < 0.1, `vertex ${i} on the sphere`);
    const dot = (p[0] * m.normals[3 * i] + p[1] * m.normals[3 * i + 1] + p[2] * m.normals[3 * i + 2]) / r;
    assert.ok(dot > 0.95, `vertex ${i} normal points outward`);
  }
  for (const k of m.indices) assert.ok(k < V);
});

test('surface nets yields between slabs and returns the same mesh', () => {
  const f = (x, y, z) => Math.hypot(x, y, z) - 6;
  const b = { min: [-6, -6, -6], max: [6, 6, 6] };
  const it = meshSDFChunks(f, b, 0.5, 0);
  let yields = 0, r = it.next();
  while (!r.done) { yields++; r = it.next(); }
  assert.ok(yields > 5, 'it yields while sampling');
  assert.deepEqual(r.value.indices.length, meshSDF(f, b, 0.5).indices.length);
});

test('organ fields come from the ORGANS table', () => {
  for (const group of ['heart', 'lungs', 'liver', 'spleen', 'kidney', 'pelvic']) {
    const o = organSDF(group);
    assert.ok(o.parts > 0, `${group} has parts`);
    const first = ORGANS.find((e) => e.group === group && e.type !== 'tube');
    assert.ok(o.sdf(first.c[0], first.c[1], first.c[2]) < 0, `${group}: its first centre is inside`);
    assert.ok(o.sdf(first.c[0], first.c[1], first.c[2] + 2000) > 0, `${group}: far away is outside`);
  }
  const heart = organSDF('heart');
  assert.ok(heart.sdf(-22, 15, -395) > 0, 'the heart is clipped below z −392');
});

test('the shell table: fields, bounds, tiers, colours', () => {
  const ids = GLASS_SHELLS.map((s) => s.id);
  assert.deepEqual(ids.slice(0, 3), ['cerebrum', 'cerebellum', 'skin']);
  for (const s of GLASS_SHELLS) {
    assert.equal(s.steps.length, 4, `${s.id}: one grid step per quality tier`);
    for (let t = 1; t < 4; t++) assert.ok(s.steps[t] < s.steps[t - 1], `${s.id}: finer at higher tiers`);
    assert.equal(s.tint.length, 3);
    assert.ok(s.gain > 0 && s.gain <= 1);
    for (let a = 0; a < 3; a++) assert.ok(s.bounds.min[a] < s.bounds.max[a]);
  }
  // The glass cerebrum is the hull with the folds pressed in to FOLD_SCALE of their depth.
  assert.ok(FOLD_SCALE > 0 && FOLD_SCALE < 1);
  assert.equal(sdCerebrumGlass(0, -17, 200), Math.min(sdCerebrum(0, -17, 200, 1), sdCerebrum(0, -17, 200, -1)), 'far from the surface: the plain hull');
  assert.ok(sdCerebrumGlass(30, -17, 14) < 0, 'inside the right hemisphere');
});

test('every shell meshes at the lowest tier', () => {
  const it = glassChunks(0, Infinity);
  let r = it.next();
  while (!r.done) r = it.next();
  const ids = r.value.map((s) => s.id);
  assert.deepEqual(ids, GLASS_SHELLS.map((s) => s.id));
  for (const s of r.value) assert.ok(s.mesh.indices.length > 300, `${s.id}: a mesh`);
});

test('the glass program is registered and its uniforms are small', () => {
  assert.deepEqual(PROGRAMS.glass, [GLASS_VS, GLASS_FS]);
  assert.ok(uniformSlots(GLASS_VS).slots <= 8);
  assert.ok(uniformSlots(GLASS_FS).names.includes('uCut'), 'the cutaway removes glass too');
});

test('smoothing keeps the shape: a blurred, Taubin-smoothed sphere stays on its radius', () => {
  const R = 10;
  const m = meshSDF((x, y, z) => Math.hypot(x, y, z) - R, { min: [-R, -R, -R], max: [R, R, R] }, 1, { blur: 1, smooth: 4 });
  const V = m.positions.length / 3;
  for (let i = 0; i < V; i++) {
    const p = [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]];
    const r = Math.hypot(...p);
    assert.ok(Math.abs(r - R) < 0.15, `vertex ${i} stays within 0.15 mm of the sphere`);
    const dot = (p[0] * m.normals[3 * i] + p[1] * m.normals[3 * i + 1] + p[2] * m.normals[3 * i + 2]) / r;
    assert.ok(dot > 0.95, `vertex ${i}: smooth outward normal`);
  }
});

test('a field with a step seam meshes without a ridge once blurred and smoothed', () => {
  // A cylinder whose field jumps by 1.5 mm at z = 0, like a primitive switched off by a guard.
  const seam = (x, y, z) => Math.hypot(x, y) - 12 + (z > 0 ? 1.5 : 0);
  const b = { min: [-15, -15, -10], max: [15, 15, 10] };
  const raw = meshSDF(seam, b, 1), soft = meshSDF(seam, b, 1, { blur: 2, smooth: 8 });
  const spread = (m) => {   // radial step across the seam: mean radius just above minus just below z = 0
    let up = 0, nu = 0, dn = 0, nd = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      const r = Math.hypot(m.positions[i], m.positions[i + 1]), z = m.positions[i + 2];
      if (z > 0.2 && z < 1.5) { up += r; nu++; } else if (z < -0.2 && z > -1.5) { dn += r; nd++; }
    }
    return Math.abs(up / nu - dn / nd);
  };
  assert.ok(spread(soft) < spread(raw), 'the seam is softened');
});

test('anatomical colours: the body shader has one per tissue class; the shells are tinted', () => {
  assert.match(BODY_VS, /uniform float uAnat;/);
  assert.match(BODY_VS, /const vec3 ANAT\[9\] = vec3\[9\]\(/);
  const tint = Object.fromEntries(GLASS_SHELLS.map((s) => [s.id, s.tint]));
  assert.ok(tint.heart[0] > tint.heart[1] * 2, 'the heart is red');
  assert.ok(tint.spleen[2] > tint.spleen[1], 'the spleen is purple');
  assert.notDeepEqual(tint.cerebrum, tint.lungs, 'brain and lungs differ');
  for (const s of GLASS_SHELLS) assert.ok(s.smooth > 0 && s.blur > 0, `${s.id}: smoothed`);
});
