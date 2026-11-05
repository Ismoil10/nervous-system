// @ts-check
// Glass shells (user decision, 5 November 2026; stage 1 of the visual upgrade): the existing
// procedural signed distance fields of the brain (anatomy.js), the skin (body/geometry.js
// bodySDF) and the main organs (body/geometry.js ORGANS) meshed at load time with naive surface
// nets, then drawn as clear glass (shaders.js GLASS_VS/FS): a Fresnel rim, a faint face and a
// small highlight, added to the scene so the stars, the dopamine system and the signals stay
// visible inside. No downloaded meshes (DOPAMINE.md §7.2). Display only; nothing here touches the
// DOM or WebGL, so the module also loads in Node tests.

import { sdCerebrum, sdCerebellum, folding } from './anatomy.js';
import { bodySDF, BODY_BOUNDS, ORGANS } from './body/geometry.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// ---- Surface nets ------------------------------------------------------------------------------
// Samples sdf (mm) on a grid of `step` mm over bounds { min, max } and returns a closed triangle mesh
// of its zero set: positions and outward unit normals (mm, xyz per vertex) and Uint32 indices. A
// generator: it yields between z slabs and between smoothing passes so the caller can spread the
// work over frames. Options: `blur` passes of a [1 2 1]/4 filter over the sampled field (they melt
// the seams where a composite field switches primitives), and `smooth` Taubin passes over the mesh
// (they remove the grid's terracing without shrinking it); normals are then the area-weighted
// normals of the smoothed mesh.
export function* meshSDFChunks(sdf, bounds, step, slabMs = 6, { blur = 0, smooth = 0 } = {}) {
  const [x0, y0, z0] = bounds.min.map((v) => v - step);
  const nx = Math.ceil((bounds.max[0] + step - x0) / step) + 1;
  const ny = Math.ceil((bounds.max[1] + step - y0) / step) + 1;
  const nz = Math.ceil((bounds.max[2] + step - z0) / step) + 1;
  const f = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => i + nx * (j + ny * k);
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
  let t0 = now();
  for (let k = 0; k < nz; k++) {
    const z = z0 + k * step;
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * step;
      for (let i = 0; i < nx; i++) f[at(i, j, k)] = sdf(x0 + i * step, y, z);
    }
    if (now() - t0 > slabMs) { yield k / nz; t0 = now(); }
  }
  for (let b = 0; b < blur; b++) { blurField(f, nx, ny, nz); yield 1; }

  // One vertex per cell that the surface crosses: the mean of its edge crossings.
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [], nrm = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const val = f[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          v[c] = val;
          if (val < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of E) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += (a & 1) + t * ((b & 1) - (a & 1));
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
          n++;
        }
        // Gradient across the cell (finite differences of its corners), normalised: outward normal.
        const gx = (v[1] + v[3] + v[5] + v[7]) - (v[0] + v[2] + v[4] + v[6]);
        const gy = (v[2] + v[3] + v[6] + v[7]) - (v[0] + v[1] + v[4] + v[5]);
        const gz = (v[4] + v[5] + v[6] + v[7]) - (v[0] + v[1] + v[2] + v[3]);
        const gl = Math.hypot(gx, gy, gz) || 1;
        cell[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * step, y0 + (j + sy / n) * step, z0 + (k + sz / n) * step);
        nrm.push(gx / gl, gy / gl, gz / gl);
      }
    }
  }

  // One quad per grid edge with a sign change, joining the four cells around that edge.
  const idx = [];
  const C = (i, j, k) => cell[i + cx * (j + cy * k)];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 0; i < cx; i++) {   // edges along x
        const s0 = f[at(i, j, k)] < 0, s1 = f[at(i + 1, j, k)] < 0;
        if (s0 !== s1) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), s1);
      }
    }
  }
  for (let k = 1; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 1; i < cx; i++) {   // edges along y
        const s0 = f[at(i, j, k)] < 0, s1 = f[at(i, j + 1, k)] < 0;
        if (s0 !== s1) quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), s1);
      }
    }
  }
  for (let k = 0; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 1; i < cx; i++) {   // edges along z
        const s0 = f[at(i, j, k)] < 0, s1 = f[at(i, j, k + 1)] < 0;
        if (s0 !== s1) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), s1);
      }
    }
  }
  const positions = Float32Array.from(pos), indices = Uint32Array.from(idx);
  if (smooth > 0) {
    const adj = adjacency(positions.length / 3, indices);
    for (let s = 0; s < smooth; s++) { taubin(positions, adj); yield 1; }
    return { positions, normals: faceNormals(positions, indices), indices };
  }
  return { positions, normals: Float32Array.from(nrm), indices };
}

// One pass of a separable [1 2 1]/4 filter along x, y and z, edges clamped.
function blurField(f, nx, ny, nz) {
  const line = new Float32Array(Math.max(nx, ny, nz));
  const pass = (n, stride, count, base) => {
    for (let c = 0; c < count; c++) {
      const o = base(c);
      for (let i = 0; i < n; i++) line[i] = f[o + i * stride];
      for (let i = 0; i < n; i++) {
        const a = line[i > 0 ? i - 1 : 0], b = line[i], d = line[i < n - 1 ? i + 1 : n - 1];
        f[o + i * stride] = 0.25 * a + 0.5 * b + 0.25 * d;
      }
    }
  };
  pass(nx, 1, ny * nz, (c) => c * nx);
  pass(ny, nx, nx * nz, (c) => (c % nx) + Math.floor(c / nx) * nx * ny);
  pass(nz, nx * ny, nx * ny, (c) => c);
}

// Vertex neighbours from the triangles (compressed rows; an edge shared by two triangles is listed
// twice, which keeps the weights uniform).
function adjacency(n, idx) {
  const deg = new Int32Array(n + 1);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { deg[idx[t + e]] += 2; }
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, n), nb = new Int32Array(start[n]);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    nb[fill[a]++] = b; nb[fill[a]++] = c; nb[fill[b]++] = c; nb[fill[b]++] = a; nb[fill[c]++] = a; nb[fill[c]++] = b;
  }
  return { start, nb };
}

// One Taubin λ|μ pass (λ 0.5, μ −0.53): a shrinking Laplacian step and an inflating one.
function taubin(P, { start, nb }) {
  const n = P.length / 3, tmp = new Float32Array(P.length);
  for (const k of [0.5, -0.53]) {
    for (let i = 0; i < n; i++) {
      const s = start[i], e = start[i + 1];
      if (e === s) { tmp[3 * i] = P[3 * i]; tmp[3 * i + 1] = P[3 * i + 1]; tmp[3 * i + 2] = P[3 * i + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let j = s; j < e; j++) { const q = 3 * nb[j]; x += P[q]; y += P[q + 1]; z += P[q + 2]; }
      const m = 1 / (e - s);
      tmp[3 * i] = P[3 * i] + k * (x * m - P[3 * i]);
      tmp[3 * i + 1] = P[3 * i + 1] + k * (y * m - P[3 * i + 1]);
      tmp[3 * i + 2] = P[3 * i + 2] + k * (z * m - P[3 * i + 2]);
    }
    P.set(tmp);
  }
}

// Area-weighted vertex normals (the triangles wind counter-clockwise seen from outside).
function faceNormals(P, idx) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { N[q] += nx; N[q + 1] += ny; N[q + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
  }
  return N;
}

export function meshSDF(sdf, bounds, step, opts) {
  const it = meshSDFChunks(sdf, bounds, step, Infinity, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// ---- Shell fields --------------------------------------------------------------------------------
// Approximate ellipsoid distance (mm), as anatomy.js and geometry.js use it.
function sdEll(x, y, z, c, r) {
  const qx = (x - c[0]) / r[0], qy = (y - c[1]) / r[1], qz = (z - c[2]) / r[2];
  const k0 = Math.hypot(qx, qy, qz), k1 = Math.hypot(qx / r[0], qy / r[1], qz / r[2]);
  return k0 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }

// Cerebrum of both hemispheres with the gyri and sulci of anatomy.js `folding`, pressed in to a
// quarter of their depth so the glass shows the folds (the stars keep the full depth).
export const FOLD_SCALE = 0.25;
export function sdCerebrumGlass(x, y, z) {
  const d = Math.min(sdCerebrum(x, y, z, 1), sdCerebrum(x, y, z, -1));
  if (d > 12 || d < -12) return d;
  return d + FOLD_SCALE * folding(x, y, z).depth;
}

// Organ entries of one group as one field: a smooth union of their ellipsoids (mirrored when
// `sided`), clipped where the table clips them.
export function organSDF(group) {
  const parts = [];
  for (const o of ORGANS) {
    if (o.group !== group || o.type === 'tube') continue;
    const sides = o.sided ? [1, -1] : [1];
    for (const s of sides) parts.push({ c: [s * o.c[0], o.c[1], o.c[2]], r: o.r, clipBelow: o.clipBelow });
  }
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const p of parts) for (let a = 0; a < 3; a++) {
    bounds.min[a] = Math.min(bounds.min[a], p.c[a] - p.r[a]);
    bounds.max[a] = Math.max(bounds.max[a], p.c[a] + p.r[a]);
  }
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (const p of parts) {
      let e = sdEll(x, y, z, p.c, p.r);
      if (p.clipBelow !== undefined) e = Math.max(e, p.clipBelow - z);
      d = d === 1e9 ? e : smin(d, e, 4);
    }
    return d;
  };
  return { sdf, bounds, parts: parts.length };
}

// The shells: field, bounds (mm), grid step per quality tier (mm; low → ultra), field blur and
// mesh smoothing passes, glass tint and gain [model]. `body` shells show only with the body on.
// Anatomical colours, as in anatomy atlases: heart red, lungs pink, liver red-brown, spleen purple,
// kidneys maroon, bladder pale yellow; brain pink-lavender; skin a faint peach.
const ORGAN_GLASS = [
  ['heart', [1.0, 0.28, 0.32]], ['lungs', [1.0, 0.62, 0.68]], ['liver', [0.8, 0.34, 0.26]],
  ['spleen', [0.62, 0.36, 0.86]], ['kidney', [0.82, 0.3, 0.44]], ['pelvic', [0.96, 0.86, 0.5]],
];
const BRAIN_GLASS = [0.96, 0.74, 0.92];
export const GLASS_SHELLS = [
  { id: 'cerebrum', sdf: sdCerebrumGlass, bounds: { min: [-70, -105, -44], max: [70, 71, 78] },
    steps: [2.8, 2.4, 2.0, 1.8], blur: 1, smooth: 3, tint: BRAIN_GLASS, gain: 1, body: false },
  { id: 'cerebellum', sdf: sdCerebellum, bounds: { min: [-52, -92, -68], max: [52, -32, -10] },
    steps: [2.8, 2.4, 2.0, 1.8], blur: 1, smooth: 3, tint: BRAIN_GLASS, gain: 0.9, body: false },
  { id: 'skin', sdf: bodySDF, bounds: BODY_BOUNDS, steps: [10, 8, 6.5, 5.5], blur: 2, smooth: 8, tint: [0.96, 0.86, 0.8], gain: 0.5, body: true },
  ...ORGAN_GLASS.map(([group, tint]) => {
    const o = organSDF(group);
    return { id: group, sdf: o.sdf, bounds: o.bounds, steps: [5, 4.2, 3.6, 3.2], blur: 1, smooth: 4, tint, gain: 1, body: true };
  }),
];

// All shells for a tier, one after another; yields while it works. Returns [{ id, tint, gain,
// body, mesh }] with positions in mm.
export function* glassChunks(tier, slabMs = 6) {
  const out = [];
  const t = clamp(tier | 0, 0, 3);
  for (const s of GLASS_SHELLS) {
    const mesh = yield* meshSDFChunks(s.sdf, s.bounds, s.steps[t], slabMs, { blur: s.blur, smooth: s.smooth });
    if (mesh.indices.length) out.push({ id: s.id, tint: s.tint, gain: s.gain, body: s.body, mesh });
    yield s.id;
  }
  return out;
}
