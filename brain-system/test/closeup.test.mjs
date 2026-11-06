// Body close-up (research/CLOSEUP.md): the focus region's close-up stars (inside the sphere, k × the
// body buffer's stars there in the same mixture, tagged and flux-corrected), the reproducible nerve
// streamlines, and the body shader hooks within the uniform budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateBody, generateFocusRegion, FOCUS_LOD } from '../src/body/generate.js';
import { BODY_VS, JOINT_SLOTS, PARAMS as SP, uniformSlots } from '../src/shaders.js';
import { rigidAt } from '../src/body/geometry.js';

const body = generateBody({ budget: 'medium' }, 1848);
const F = body.floats;
// The body buffer's stars inside a sphere (mm), the heart left out: per class, and their offsets.
const inSphere = (pts, n, c, r) => {
  const per = new Array(9).fill(0), out = [];
  for (let i = 0; i < n; i++) {
    const o = i * F, x = pts[o] / 0.01 - c[0], y = pts[o + 1] / 0.01 - c[1], z = pts[o + 2] / 0.01 - c[2];
    if (x * x + y * y + z * z > r * r) continue;
    if (pts[o + 11] === 1 && pts[o + 5] > 0.5) continue;
    per[Math.round(pts[o + 11])]++;
    out.push(o);
  }
  return { per, out };
};

for (const [name, c, r] of [['abdomen', [30, 5, -500], 70], ['neck', [0, 0, -190], 60], ['thigh', [90, 10, -950], 70]]) {
  test(`focus region (${name}): inside the sphere, k × the body's stars and light per class, no heart, tagged`, () => {
    const { per: base, out: bl } = inSphere(body.points, body.count, c, r), k = 4;
    const reg = generateFocusRegion({ budget: 'medium', centre: c, radius: r, k, cap: 200000, baseCounts: base });
    assert.ok(reg.count > 0);
    let outside = 0, heart = 0, untagged = 0;
    for (let i = 0; i < reg.count; i++) {
      const o = i * F, x = reg.points[o] / 0.01 - c[0], y = reg.points[o + 1] / 0.01 - c[1], z = reg.points[o + 2] / 0.01 - c[2];
      if (x * x + y * y + z * z > r * r * 1.0001) outside++;
      if (reg.points[o + 11] === 1 && reg.points[o + 5] > 0.5) heart++;
      if (reg.points[o + 13] < FOCUS_LOD - 0.5) untagged++;
    }
    assert.equal(outside, 0, 'every star inside the sphere');
    assert.equal(heart, 0, 'no heart stars');
    assert.equal(untagged, 0, 'LOD tag');
    const light = (pts, list, cl) => list.reduce((a, o) => a + (Math.round(pts[o + 11]) === cl ? pts[o + 3] : 0), 0);
    const rl = Array.from({ length: reg.count }, (_, i) => i * F);
    for (let cl = 0; cl < 9; cl++) {
      if (base[cl] < 150) continue;
      const ratio = reg.perClass[cl] / base[cl];
      assert.ok(ratio > 0.6 * k && ratio < 1.5 * k, `class ${cl}: ${reg.perClass[cl]} / ${base[cl]} = ${ratio.toFixed(2)}`);
      // The flux correction makes each class carry k × its light in the body buffer there.
      const q = light(reg.points, rl, cl) / Math.max(1e-9, k * light(body.points, bl, cl));
      assert.ok(q > 0.8 && q < 1.25, `class ${cl} light ×${q.toFixed(2)}`);
    }
  });
}

test('the body build stays deterministic with per-path streamlines', () => {
  assert.equal(generateBody({ budget: 'low' }, 1848).hash, generateBody({ budget: 'low' }, 1848).hash);
});

test('BODY_VS: focus region and slab within the slot budget; joint slots cover the rigid segments', () => {
  assert.ok(uniformSlots(BODY_VS).slots <= 110, `slots ${uniformSlots(BODY_VS).slots}`);
  assert.match(BODY_VS, /uniform vec4 uFocus\[2\];/);
  assert.match(BODY_VS, /bool regionStar = lod > /);
  assert.match(BODY_VS, /float slab = uFocus\[1\]\.z \* uStyle\.x;/, 'the slab is Detailed only');
  let maxSeg = 0;
  for (let i = 0; i < body.count; i += 7) maxSeg = Math.max(maxSeg, Math.round(body.points[i * F + 15]));
  for (const p of [[240, -15, -1008], [-240, -15, -1008], [88, 60, -1650], [-88, 60, -1650]]) maxSeg = Math.max(maxSeg, Math.ceil(rigidAt(p)));
  assert.ok(maxSeg < JOINT_SLOTS, `rigid segment ${maxSeg} < ${JOINT_SLOTS}`);
  assert.ok(SP.focus.conserve >= 0 && SP.focus.conserve <= 1);
});
