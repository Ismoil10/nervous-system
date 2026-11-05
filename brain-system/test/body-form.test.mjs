// Skin form (research/BODY-FORM.md): the skin field built from the anthropometric analysis keeps
// the frame, landmarks and sites, is continuous, and shows the human profile and girths; the head,
// face, hands and feet follow the craniofacial and ANSUR II norms of §8–§9.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bodySDF, LANDMARKS, SITES, FORM, formSection, HEAD, eyeFissure } from '../src/body/geometry.js';
import { sdCerebrum, sdCerebellum } from '../src/anatomy.js';

// Skin point along a ray from (x0, y0) at height z, direction (dx, dy); null if never outside.
function edge(x0, y0, z, dx, dy, max = 400) {
  for (let r = 0; r < max; r += 0.5) if (bodySDF(x0 + dx * r, y0 + dy * r, z) > 0) return [x0 + dx * r, y0 + dy * r];
  return null;
}
// Girth of the section around (cx, cy), staying on the x > xmin side (one limb).
function girth(cx, cy, z, xmin = -Infinity) {
  let c = 0, prev = null;
  for (let k = 0; k <= 360; k++) {
    const th = (k * Math.PI) / 180, dx = Math.cos(th), dy = Math.sin(th);
    let r = 0;
    for (; r < 200; r += 0.5) { const x = cx + dx * r; if (x < xmin || bodySDF(x, cy + dy * r, z) > 0) break; }
    const p = [cx + dx * r, cy + dy * r];
    if (prev) c += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return c;
}

test('landmarks and skin sites stay on or under the new skin', () => {
  for (const [id, p] of Object.entries(LANDMARKS)) {
    if (id === 'lm.cervicale') continue;   // the C7 spine point lies behind the neck cylinder of §2.3, as before
    assert.ok(Math.abs(bodySDF(...p)) < 36, `${id} within 36 mm of the skin`);
  }
  for (const s of SITES) if (s.kind === 'skin') assert.ok(Math.abs(bodySDF(...s.pos)) < 3, `${s.id} on the skin`);
});

test('the field is continuous near the skin (no seams where primitives meet)', () => {
  let worst = 0;
  for (let x = 0; x <= 260; x += 20) {
    for (let y = -170; y <= 130; y += 20) {
      let prev = bodySDF(x, y, 100);
      for (let z = 99; z > -1680; z -= 1) {
        const v = bodySDF(x, y, z);
        if (Math.abs(v) < 8) worst = Math.max(worst, Math.abs(v - prev));
        prev = v;
      }
    }
  }
  assert.ok(worst < 1.6, `largest change per mm near the skin ${worst.toFixed(2)}`);
});

test('girths near the ANSUR II neutral targets (BODY-FORM.md §2)', () => {
  const near = (v, target, tol, what) => assert.ok(Math.abs(v - target) / target < tol, `${what} ${Math.round(v)} vs ${target}`);
  near(girth(80, -38, -1290, 2), 397, 0.08, 'calf');
  near(girth(78, -44, -1560, 2), 230, 0.1, 'ankle');
  near(girth(231, -22, -810), 171, 0.1, 'wrist');
  near(girth(203, -28, -620), 270, 0.1, 'forearm');
  near(girth(0, -15, -150), 375, 0.1, 'neck');
  near(girth(88, -10, -880, 2), 620, 0.1, 'upper thigh');
});

test('the human profile: chest, abdomen, lumbar curve, buttocks', () => {
  const front = (z) => edge(0, -20, z, 0, 1)[1], back = (z) => edge(0, -20, z, 0, -1)[1];
  const lateralBack = (z) => edge(80, -20, z, 0, -1)[1];
  assert.ok(front(-330) > front(-450) + 10, 'the chest stands in front of the upper abdomen');
  assert.ok(back(-330) < back(-600) - 20, 'the upper back is behind the lumbar curve');
  assert.ok(lateralBack(-790) < back(-600) - 30, 'the buttocks are behind the lumbar curve');
  assert.ok(lateralBack(-790) < back(-790) - 8, 'an intergluteal cleft at the midline');
  const s = formSection(-605);
  assert.ok(s.yf - s.yb > 200 && s.yf - s.yb < 240, 'waist depth near 230');
});

test('the arms hang free of the flank and the hips, and the shoulders are capped', () => {
  const gapAt = (z) => {   // along x at y −20: out of the trunk, then into the arm
    let out = null;
    for (let x = 0; x < 320; x += 0.5) {
      const o = bodySDF(x, -20, z) > 0;
      if (out === null && o) out = x;
      else if (out !== null && !o) return x - out;
    }
    return Infinity;
  };
  assert.ok(gapAt(-605) > 3, 'a gap between the waist and the forearm');
  assert.ok(gapAt(-790) > 1, 'a gap between the buttocks and the hand');
  const shoulder = edge(0, -22, -285, 1, 0)[0];
  assert.ok(shoulder > 240 && shoulder < 260, `bideltoid half-breadth ${shoulder} near 249`);
  assert.ok(FORM.armJoin[0] < 10, 'below the shoulder the arms join with a crease, not a web');
});

// Distance from p along d to the skin (the first point outside).
const reach = (p, d, max = 300) => { let t = 0; while (t < max && bodySDF(p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t) < 0) t += 0.25; return t; };

test('the head and face: craniofacial proportions (BODY-FORM.md §8)', () => {
  const near = (v, target, tol, what) => assert.ok(Math.abs(v - target) <= tol, `${what} ${v} vs ${target} ± ${tol}`);
  let breadth = 0; for (let z = -10; z <= 60; z += 2) breadth = Math.max(breadth, 2 * reach([0, -20, z], [1, 0, 0]));
  let front = 0, back = 0;
  for (let z = -30; z <= 0; z++) front = Math.max(front, reach([0, 0, z], [0, 1, 0]));
  for (let z = -40; z <= 40; z++) back = Math.max(back, reach([0, 0, z], [0, -1, 0]));
  let zy = 0; for (let y = 20; y <= 60; y += 2) for (let z = -70; z <= -45; z += 2) zy = Math.max(zy, 2 * reach([0, y, z], [1, 0, 0]));
  let go = 0; for (let y = -10; y <= 20; y += 2) for (let z = -135; z <= -115; z += 2) go = Math.max(go, 2 * reach([0, y, z], [1, 0, 0]));
  let menton = 0; for (let y = 60; y <= 90; y++) { let z = -120; while (bodySDF(0, y, z) < 0) z -= 0.25; menton = Math.min(menton, z); }
  near(breadth, 152, 8, 'head breadth');
  near(front + back, 202, 8, 'head length (glabella to opisthocranion)');
  near(reach([0, -20, 0], [0, 0, 1]), 89, 6, 'vertex z');
  near(zy, 140, 8, 'bizygomatic breadth');
  near(go, 104, 10, 'bigonial breadth');
  near(HEAD.nasion[2] - menton, 118, 8, 'face height (nasion to menton)');
  for (const k of ['nasion', 'pronasale', 'subnasale']) assert.ok(Math.abs(bodySDF(...HEAD[k])) < 3, `${k} on the skin`);
  let ala = 0; for (let z = -96; z <= -80; z++) for (let y = 82; y <= 100; y++) { const x = reach([0, y, z], [1, 0, 0], 40); if (x < 40) ala = Math.max(ala, 2 * x); }
  near(ala, 33, 5, 'nose width');
});

test('the eyes open in an almond fissure, the brain lies deep under the scalp', () => {
  const a = HEAD.cornealApex;
  assert.ok(bodySDF(...a) > 0, 'no skin over the cornea');
  assert.ok(eyeFissure(a[0] + 13, a[1], a[2]) < 0 && eyeFissure(a[0], a[1], a[2] + 8) > 0, 'about 30 mm wide, about 11 mm high');
  assert.ok(bodySDF(a[0], a[1] - 4, a[2] + 14) < 0 && bodySDF(a[0], a[1] - 4, a[2] - 14) < 0, 'upper and lower lids');
  let worst = Infinity;
  for (let x = 0; x <= 90; x += 4) for (let y = -130; y <= 100; y += 4) for (let z = -90; z <= 100; z += 4) {
    const b = Math.min(sdCerebrum(x, y, z, 1), sdCerebrum(x, y, z, -1), sdCerebellum(x, y, z));
    if (b <= 0 && b > -4) worst = Math.min(worst, -bodySDF(x, y, z));
  }
  assert.ok(worst > 6, `the brain surface lies ${worst.toFixed(1)} mm under the skin`);
});

test('hands and feet: breadths, foot length, a free sole arch', () => {
  const c = [229, -14, -900];
  const hand = reach(c, [1, 0, 0]) + reach(c, [-1, 0, 0]);
  assert.ok(hand > 74 && hand < 92, `hand breadth ${hand}`);
  let heel = 0, toe = 0;
  for (let z = -1670; z <= -1600; z += 2) { heel = Math.max(heel, reach([80, 0, z], [0, -1, 0])); toe = Math.max(toe, reach([76, 100, z], [0, 1, 0])); }
  const length = heel + 100 + toe;
  assert.ok(Math.abs(length - 268) < 12, `foot length ${length}`);
  let breadth = 0;
  for (let z = -1670; z <= -1640; z += 2) for (let y = 60; y <= 130; y += 2) if (bodySDF(100, y, z) < 0) breadth = Math.max(breadth, reach([100, y, z], [1, 0, 0]) + reach([100, y, z], [-1, 0, 0]));
  assert.ok(Math.abs(breadth - 100) < 8, `foot breadth ${breadth}`);
  assert.ok(bodySDF(55, 30, -1670) > 0 && bodySDF(95, 30, -1670) < 0, 'the medial arch is lifted; the lateral sole stands on the floor');
});

test('the knee and the elbow carry no band where the limb segments meet', () => {
  // Across the joint the side of the limb stays within 2 mm of the straight line between the sections
  // 30 mm above and below it. Two equal sections overlapping under a wide smooth union stand ≈ k/4
  // proud of it (PARAMS.kJoint).
  for (const [c, zj, what] of [[[80, -32], -1170, 'knee'], [[195, -30], -563, 'elbow']]) {
    for (const d of [[1, 0, 0], [-1, 0, 0]]) {
      const r = (z) => reach([c[0], c[1], z], d, 120), top = r(zj + 30), bot = r(zj - 30);
      for (let dz = -24; dz <= 24; dz += 2) {
        const line = top + (bot - top) * (30 - dz) / 60;
        assert.ok(r(zj + dz) - line < 2, `${what}: ${(r(zj + dz) - line).toFixed(1)} mm proud at z ${zj + dz}`);
      }
    }
  }
});
