// @ts-check
// Lungs view names (research/LUNGS.md §7.6): the structure under the mouse. The lung stars of the
// body buffer inside a narrow cone round the cursor ray are weighted by flux and by how near the
// front they lie; the front-most cluster's point is named by the airway tree (airway-tree.js): a named
// airway (trachea to segmental bronchi), a smaller bronchus or bronchiole with its segment and
// generation, or the lobe and segment of the lung tissue there. Rest positions: breathing moves the
// bases by 1–2 cm at most, so the name is that of the structure at rest. Display only.

import { LOBES, SEGMENTS, buildAirwayTree, lobeOf, segmentOf } from './body/airway-tree.js';
import { LUNG_ROLE } from './body/geometry.js';

export const LUNG_PICK = { front: 25, minWeight: 0.1, airwayMm: 2.0, maxGen: 11, cartilageMm: 1.0 };
const STRIDE = 5;   // x, y, z (render units), role, flux
const MM_UNITS = 100;   // mm per render unit (anatomy.js MM = 0.01)

// Lung stars of a body buffer (generate.js: 16 floats per point; organ class 1; −role in float 5).
export function lungStarIndex(points, floats, count) {
  const ok = (o) => points[o + 11] === 1 && points[o + 5] <= -LUNG_ROLE.AIRWAY + 0.5 && points[o + 5] >= -LUNG_ROLE.PARENCHYMA - 0.5;
  let n = 0;
  for (let i = 0; i < count; i++) if (ok(i * floats)) n++;
  const data = new Float32Array(n * STRIDE);
  for (let i = 0, k = 0; i < count; i++) {
    const o = i * floats;
    if (!ok(o)) continue;
    data.set([points[o], points[o + 1], points[o + 2], -points[o + 5], points[o + 3]], k);
    k += STRIDE;
  }
  return { data, count: n };
}

// The rest position (mm) of the front-most lung structure under the ray, or null.
export function pickLungPoint(origin, dir, index, { cone = 0.006, near = 0.01 } = {}) {
  if (!index || !index.count) return null;
  const { data, count } = index, [ox, oy, oz] = origin, [dx, dy, dz] = dir, tc2 = Math.tan(cone) ** 2;
  let tMin = Infinity;
  const hit = [];
  for (let i = 0, o = 0; i < count; i++, o += STRIDE) {
    const x = data[o] - ox, y = data[o + 1] - oy, z = data[o + 2] - oz, t = x * dx + y * dy + z * dz;
    if (t <= near) continue;
    const lim = t * t * tc2, r2 = x * x + y * y + z * z - t * t;
    if (r2 > lim) continue;
    const w = data[o + 4] * (data[o + 3] === LUNG_ROLE.AIRWAY ? 2 : 1) * (1 - 0.7 * r2 / lim);
    hit.push([t, w, o]);
    tMin = Math.min(tMin, t);
  }
  if (!hit.length) return null;
  const front = LUNG_PICK.front / MM_UNITS;
  let total = 0, best = null, bestW = 0;
  for (const [t, w, o] of hit) {
    const v = w * Math.exp(-(t - tMin) / front);
    total += v;
    if (v > bestW) { bestW = v; best = o; }
  }
  if (total < LUNG_PICK.minWeight || best === null) return null;
  return [data[best] * MM_UNITS, data[best + 1] * MM_UNITS, data[best + 2] * MM_UNITS];
}

// The name of the lung structure at p (mm), or null outside the lungs and airways.
export function lungName(p) {
  const T = buildAirwayTree();
  let best = null, bestD = Infinity;
  for (const b of T.branches) {
    if (b.gen > LUNG_PICK.maxGen) continue;
    const d = [b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - b.a[0]) * d[0] + (p[1] - b.a[1]) * d[1] + (p[2] - b.a[2]) * d[2]) / l2));
    const q = Math.hypot(b.a[0] + t * d[0] - p[0], b.a[1] + t * d[1] - p[1], b.a[2] + t * d[2] - p[2]);
    const off = Math.abs(q - b.r);
    if (q < b.r + LUNG_PICK.airwayMm && off < bestD) { bestD = off; best = b; }
  }
  if (best) {
    if (!/ g\d+$/.test(best.name)) return best.name;
    const seg = SEGMENTS[best.segment], kind = 2 * best.r >= LUNG_PICK.cartilageMm ? 'bronchus' : 'bronchiole';
    return `${seg ? `${seg.name} segment (${seg.b})` : LOBES[best.lobe]?.name ?? 'Lung'} · ${kind}, generation ${best.gen}`;
  }
  const lobe = lobeOf(p);
  if (lobe < 0) return null;
  const seg = SEGMENTS[segmentOf(p)];
  return seg ? `${LOBES[lobe].name} · ${seg.name.toLowerCase()} segment` : LOBES[lobe].name;
}
