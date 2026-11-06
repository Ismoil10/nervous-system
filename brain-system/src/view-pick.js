// Depth under a pixel for camera navigation (focus, pivot and zoom towards the cursor; camera.js).
// The scene is additive stars without a depth buffer, so the depth is read from the stars: those
// inside a narrow cone round the ray are binned by their distance along it, weighted by their flux,
// and the first bin that reaches `frac` of the densest bin wins. A click on the heart through the
// chest therefore finds the heart wall, not the empty air in front of it, and a click on the brain
// finds the cortex rather than its centre. [model]
//
// sets: [{ data, stride, count, cutX?, weight? }], positions (render units) in floats 0–2 and the
// flux in float 3 of each record (brain.js FLOATS 12, body/generate.js FLOATS 16). cutX hides the
// points with x < cutX (the cutaway plane, shaders.js uCut).

export const VIEW_PICK = { conePx: 7, widen: 3, minStars: 3, binFrac: 0.012, frac: 0.35 };

export function pickStars(origin, dir, sets, { cone = 0.006, near = 0.01, bin = 0.03, frac = VIEW_PICK.frac, minStars = VIEW_PICK.minStars } = {}) {
  const [ox, oy, oz] = origin, [dx, dy, dz] = dir;
  const tc2 = Math.tan(cone) ** 2;
  const ts = [], ws = [];
  for (const s of sets) {
    const { data, stride, count } = s;
    if (!data || !count) continue;
    const cutX = s.cutX ?? -Infinity, weight = s.weight ?? 1;
    const n = Math.min(count, Math.floor(data.length / stride));
    for (let i = 0, o = 0; i < n; i++, o += stride) {
      const x = data[o] - ox, y = data[o + 1] - oy, z = data[o + 2] - oz;
      const t = x * dx + y * dy + z * dz;
      if (t <= near) continue;
      const lim = t * t * tc2, r2 = x * x + y * y + z * z - t * t;
      if (r2 > lim || data[o] < cutX) continue;
      const flux = data[o + 3];
      ts.push(t);
      ws.push(weight * (flux > 0.05 ? flux : 0.05) * (1 - 0.7 * r2 / lim));   // centre-weighted
    }
  }
  if (ts.length < minStars) return null;
  let tMin = Infinity, tMax = -Infinity;
  for (const t of ts) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const b = Math.max(bin, (tMax - tMin) / 4095, 1e-9);
  const nb = Math.floor((tMax - tMin) / b) + 1;
  const h = new Float64Array(nb), ht = new Float64Array(nb);
  for (let i = 0; i < ts.length; i++) {
    const k = Math.min(nb - 1, Math.floor((ts[i] - tMin) / b));
    h[k] += ws[i];
    ht[k] += ws[i] * ts[i];
  }
  const sm = new Float64Array(nb);
  let peak = 0;
  for (let k = 0; k < nb; k++) {
    sm[k] = h[k] + 0.5 * ((k > 0 ? h[k - 1] : 0) + (k + 1 < nb ? h[k + 1] : 0));
    if (sm[k] > peak) peak = sm[k];
  }
  let k = 0;
  while (k < nb - 1 && sm[k] < frac * peak) k++;
  while (k < nb - 1 && sm[k + 1] > sm[k]) k++;   // climb to the top of that layer
  let w = 0, wt = 0;
  for (let j = Math.max(0, k - 1); j <= Math.min(nb - 1, k + 1); j++) { w += h[j]; wt += ht[j]; }
  const t = w > 0 ? wt / w : tMin + (k + 0.5) * b;
  return { t, point: [ox + dx * t, oy + dy * t, oz + dz * t], stars: ts.length };
}
