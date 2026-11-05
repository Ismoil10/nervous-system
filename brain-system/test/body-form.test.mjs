// Skin form (research/BODY-FORM.md): the skin field built from the anthropometric analysis keeps
// the frame, landmarks and sites, is continuous, and shows the human profile and girths.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bodySDF, LANDMARKS, SITES, FORM, formSection } from '../src/body/geometry.js';

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
  assert.ok(FORM.armJoin < 10, 'arms join with a crease, not a web');
});
