// Point populations of the star brain: neurons (cortex, cerebellum, deep nuclei, brainstem,
// white matter), the dopamine system (cell bodies, axon bundles, release sites) and the lantern
// glows of the terminal fields. Budgets per structure follow research/DOPAMINE.md §7: visual area
// and volume rather than raw neuron counts (the cerebellum holds ~80 % of all neurons but would
// swallow the picture), with deep structures drawn denser so they read through the cortex.

import {
  MM, R, KIND, NUCLEI, DA_GROUPS, BRAINSTEM, CRUS, SPINAL_Z, GEOMETRY, PATHWAYS, TERMINALS,
  sdCerebrum, sdCerebellum, notchDistance, insideCallosalWindow, folding, corticalRegion, noise3, spline, mulberry32, len3,
  ellipsoidR2, ellipsoidPoint, NUCLEI_V2, V2, RELABEL, PARENT, AREAS, AREA_NONE, REGION_IDS,
} from './anatomy.js';

export const FLOATS = 12;   // a0: pos.xyz, lum · a1: normal.xyz | path data, seed · a2: region, daW, tint, kind
export const DA_KIND = { SOMA: 10, AXON: 11, VARICOSITY: 12 };

// Construction details of the post-port build (DOPAMINE.md §7.2–§7.6, reconciled in §9.8).
export const BUILD_PARAMS = {
  cortex: {
    ribbon: 2.6,                  // ribbon depth under the hull (mm; mean thickness 2.5, §7.2 item 3)
    sulcalDrop: 0.75,             // probability scale of dropping a sulcal sample (occluded walls)
    sulcalDim: 6,                 // flux × e^(−depth/6 mm) in sulci (§7.2 item 3, §9.8)
    notchBand: 1.5,               // reject or relabel surface points within 1.5 mm of the notch ellipsoid (§7.2 item 3)
    notchMedialX: 15,             // medial notch window |x| ≤ 15 mm …
    notchWindowY: [-45, 8],       // … and −45 < y ≤ +8: rejected (diencephalon and midbrain emerge there)
    occipitalY: -72,              // medial notch points behind y −72 are `occipital`, the rest `temporal`
  },
  insula: { c: [37, -3, 4], r: [4, 26, 11], backFace: -0.2, depth: 2, lum: 0.7, tint: 0.2 },   // §7.3 insula ribbon
  cerebellum: {
    foliaPeriod: 2.2,             // folia groups ~2.2 mm apart (§7.2 item 4, §9.8)
    grooveReject: 0.15,           // groove points rejected with p ≤ 0.15 …
    grooveDim: 0.17,              // … and dimmed by ≤ 17 %: areal drop 1 − 0.85·0.83 = 29.5 % ≤ 30 % (§7.2 item 4, §10)
  },
  lumNucleus: 0.85,               // deep-nucleus flux factor (§7.4: dense floors must not become false hot spots)
  lumGland: 0.35,                 // glandular haze (pituitary gland, stalk)
  lumBrainstem: 0.5,
  lumWhite: 0.32,
  vtaOtherRatio: 0.35 / 0.65,     // non-DA VTA stars per VTA + midline DA soma (§7.5; rat VTA ~35 % GABA + glutamate)
  // Voids (§7.3): lateral ventricles (right side, mirrored) and the third-ventricle lumen. They
  // remove only white-matter, brainstem and cortical points, never nucleus or dopamine points.
  lateralVentricles: [
    { c: [6, 14, 16], r: [3, 8, 5] },        // frontal horn
    { c: [9, -10, 23], r: [4, 14, 3] },      // body
    { c: [28, -40, 12], r: [4, 5, 4] },      // atrium
    { c: [36, -20, -8.5], r: [1.5, 9, 2] },  // temporal horn
  ],
  thirdVentricle: { halfWidth: 2, yFront: 4, yBack: -20, top: 8, floorZ: -14, floorBreakY: -6, floorBackZ: -4 },
  // §8.1 bathing rule: neuron-star amber = uDaGain (0.3) · d_point · E_r, E_r already carrying w_vis.
  // Weight 1 for every region except the tinted modulator regions and the cerebellum (§7.3, §8.1).
  bathingZero: ['pituitaryGland', 'raphe', 'rmtg', 'vta', 'vtaMedial', 'pag', 'arcuate', 'cerebellum'],
};

// Extra brain buffer (generateBrainExtra): the new nuclei of research/ANALYSIS.md §3.16–§3.17,
// drawn with the neuron program in a buffer of their own so the post-port generateBrain buffer
// stays bit-identical (B.2, B.5). The buffer is floor-stratified (B.8).
export const EXTRA_PARAMS = {
  floors: [40, 80, 120, 120],   // minimum stars per new nucleus at low/medium/high/ultra; a bilateral pair counts once (§13.4; B.16)
  insulaShare: 0,               // share of every stratum given to the anterior-insula extension: 0 since Phase 0a, because
                                // generateBrain draws the whole §7.3 ribbon itself (§3.17; the extension filled y > +8 of it before)
  areaColumn: true,             // a cortical patch also takes the stars straight above a deep centre (areaIds; [model])
  lumNucleus: BUILD_PARAMS.lumNucleus,   // flux factor of nucleus stars (as NUCLEI in generateBrain)
  lumGland: BUILD_PARAMS.lumGland,       // flux factor of gland haze (pineal; as the pituitary)
  tintJitter: 0.15,             // added to the structure tint × u (as NUCLEI)
  insula: BUILD_PARAMS.insula,         // insular ribbon of DOPAMINE.md §7.3, adopted by §3.17 (mm)
  insulaCoded: BUILD_PARAMS.insula,    // ribbon drawn by generateBrain; its (y, z) footprint is not redrawn (the whole ribbon since Phase 0a)
  insulaBackFace: BUILD_PARAMS.insula.backFace,
  insulaDepth: BUILD_PARAMS.insula.depth,
  insulaLum: BUILD_PARAMS.insula.lum,
  insulaTint: BUILD_PARAMS.insula.tint,
};

class Sampler {
  constructor(seed) { this.u = mulberry32(seed); this.spare = null; }
  range(a, b) { return a + (b - a) * this.u(); }
  gauss() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = 0;
    while (u === 0) u = this.u();
    const v = this.u(), m = Math.sqrt(-2 * Math.log(u));
    this.spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }
  // Lognormal flux (σ = 0.6 in ln): many faint neurons, 1–3 % distinctly bright ones.
  lum() { return Math.min(6, 0.84 * Math.exp(0.6 * this.gauss())); }
  inEllipsoid(c, r) {
    for (;;) {
      const x = this.range(-1, 1), y = this.range(-1, 1), z = this.range(-1, 1);
      if (x * x + y * y + z * z <= 1) return [c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2], len3(x, y, z)];
    }
  }
  // Right-side point of an ellipsoid volume (rotated with `axes`; Gaussian border with `edge`),
  // with its normalised radius as the fourth value.
  inVolume(d) {
    const E = GEOMETRY.edge;
    for (;;) {
      const x = this.range(-1, 1), y = this.range(-1, 1), z = this.range(-1, 1);
      const q2 = x * x + y * y + z * z;
      if (q2 > 1) continue;
      const rho = Math.sqrt(q2);
      if (d.edge === 'gauss' && rho > E.core && this.u() > Math.exp(-0.5 * ((rho - E.core) / E.sigma) ** 2)) continue;
      return [...ellipsoidPoint(d, x, y, z), rho];
    }
  }
}

// Uniform volume sample inside a tube of control points [x, y, z, radius(, ry)].
function tubeSampler(pts) {
  const pos = spline(pts);
  const maxA = Math.max(...pts.map((p) => p[3] * (p[4] ?? p[3])));
  return (s) => {
    for (;;) {
      const u = s.u();
      const p = pos(u);
      const rx = p[3], ry = p[4] ?? p[3];
      if (s.u() * maxA > rx * ry) continue;
      const q = pos(Math.min(1, u + 0.01)), o = pos(Math.max(0, u - 0.01));
      let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
      const tl = len3(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // Cross-section basis: X along world x made orthogonal to the tangent, Y = T × X.
      let ax = 1 - tx * tx, ay = -tx * ty, az = -tx * tz;
      const al = len3(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
      const r = Math.sqrt(s.u()), a = s.u() * 2 * Math.PI;
      const cx = rx * r * Math.cos(a), cy = ry * r * Math.sin(a);
      return [p[0] + ax * cx + bx * cy, p[1] + ay * cx + by * cy, p[2] + az * cx + bz * cy, r];
    }
  };
}

// Volume of a tube (mm³): swept cross-section π·rx·ry along the centreline.
function tubeVolume(pts, steps = 256) {
  const pos = spline(pts);
  let v = 0;
  for (let k = 0; k < steps; k++) {
    const a = pos(k / steps), b = pos((k + 1) / steps);
    v += Math.PI * 0.5 * (a[3] * (a[4] ?? a[3]) + b[3] * (b[4] ?? b[3])) * len3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return v;
}

// Membership of a right-side point in a tube (swept discs with flat end caps): dense centreline
// samples (≤ 0.5 mm apart) with the cross-section frame of tubeSampler; the nearest sample decides
// (offset along the tangent within one sample spacing, normalised in-plane r² ≤ 1).
function tubeTest(pts) {
  const pos = spline(pts);
  let length = 0;
  for (let k = 0; k < 64; k++) { const a = pos(k / 64), b = pos((k + 1) / 64); length += len3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
  const n = Math.max(16, Math.ceil(length / 0.5)), ds = length / n;
  const S = [];
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let k = 0; k <= n; k++) {
    const u = k / n, p = pos(u), q = pos(Math.min(1, u + 0.01)), o = pos(Math.max(0, u - 0.01));
    let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
    const tl = len3(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let ax = 1 - tx * tx, ay = -tx * ty, az = -tx * tz;
    const al = len3(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
    const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
    const rx = p[3], ry = p[4] ?? p[3], rm = Math.max(rx, ry);
    S.push([p[0], p[1], p[2], rx, ry, ax, ay, az, bx, by, bz, tx, ty, tz]);
    for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], p[i] - rm); box[i + 3] = Math.max(box[i + 3], p[i] + rm); }
  }
  return (x, y, z) => {
    if (x < box[0] || y < box[1] || z < box[2] || x > box[3] || y > box[4] || z > box[5]) return false;
    let best = Infinity, b = null;
    for (const s of S) { const d = (x - s[0]) ** 2 + (y - s[1]) ** 2 + (z - s[2]) ** 2; if (d < best) { best = d; b = s; } }
    const dx = x - b[0], dy = y - b[1], dz = z - b[2];
    if (Math.abs(dx * b[11] + dy * b[12] + dz * b[13]) > ds) return false;
    return ((dx * b[5] + dy * b[6] + dz * b[7]) / b[3]) ** 2 + ((dx * b[8] + dy * b[9] + dz * b[10]) / b[4]) ** 2 <= 1;
  };
}

// Is a point inside any NUCLEI, DA_GROUPS or BRAINSTEM volume (crura included)? Cortical points
// there are rejected (§7.2 item 3). Bilateral volumes are tested at |x|; the midline ones are symmetric.
let deepVolumes = null;
function insideDeepVolume(x, y, z) {
  deepVolumes ||= [
    ...[...NUCLEI.filter((d) => d.type === 'e'), ...DA_GROUPS, CRUS].map((d) => {
      const m = d.axes ? Math.max(...d.r) : 0;
      const lo = d.axes ? d.c.map((c) => c - m) : d.c.map((c, k) => c - d.r[k]), hi = d.axes ? d.c.map((c) => c + m) : d.c.map((c, k) => c + d.r[k]);
      return (ax, py, pz) => ax >= lo[0] && py >= lo[1] && pz >= lo[2] && ax <= hi[0] && py <= hi[1] && pz <= hi[2] && ellipsoidR2(d, ax, py, pz) <= 1;
    }),
    ...NUCLEI.filter((d) => d.type === 't').map((d) => tubeTest(d.pts)),
    tubeTest(BRAINSTEM),
  ];
  const ax = Math.abs(x);
  return deepVolumes.some((f) => f(ax, y, z));
}

// Voids (§7.3): lateral ventricles and the third-ventricle lumen with its sloping floor.
export function insideVoid(x, y, z) {
  const T = BUILD_PARAMS.thirdVentricle, ax = Math.abs(x);
  if (ax <= T.halfWidth && y <= T.yFront && y >= T.yBack && z <= T.top) {
    const floor = y >= T.floorBreakY ? T.floorZ : T.floorZ + (T.floorBreakY - y) * (T.floorBackZ - T.floorZ) / (T.floorBreakY - T.yBack);
    if (z >= floor) return true;
  }
  return BUILD_PARAMS.lateralVentricles.some((v) => ellipsoidR2(v, ax, y, z) <= 1);
}

// Outer surface of an implicit body seen from a centre: a θ×φ grid of ray hits, triangulated,
// with an area CDF so that surface samples are uniform per mm².
function surfaceGrid(sdf, C, NT, NP, tMax) {
  const P = new Float32Array((NT + 1) * NP * 3);
  for (let i = 0; i <= NT; i++) {
    const th = Math.PI * i / NT;
    for (let j = 0; j < NP; j++) {
      const ph = 2 * Math.PI * j / NP;
      const dx = Math.sin(th) * Math.cos(ph), dy = Math.sin(th) * Math.sin(ph), dz = Math.cos(th);
      let t = tMax, step = 1.25, hit = 0;
      for (; t > 0; t -= step) {
        if (sdf(C[0] + dx * t, C[1] + dy * t, C[2] + dz * t) < 0) { hit = t; break; }
      }
      let lo = hit, hi = hit + step;
      for (let k = 0; k < 9 && hit > 0; k++) {
        const m = 0.5 * (lo + hi);
        if (sdf(C[0] + dx * m, C[1] + dy * m, C[2] + dz * m) < 0) lo = m; else hi = m;
      }
      const o = (i * NP + j) * 3;
      P[o] = C[0] + dx * lo; P[o + 1] = C[1] + dy * lo; P[o + 2] = C[2] + dz * lo;
    }
  }
  const tris = [];
  const v = (i, j) => (i * NP + (j % NP)) * 3;
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
    tris.push([v(i, j), v(i + 1, j), v(i + 1, j + 1)], [v(i, j), v(i + 1, j + 1), v(i, j + 1)]);
  }
  const cdf = new Float64Array(tris.length);
  let acc = 0;
  const N = tris.map(([a, b, c], k) => {
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const area = 0.5 * len3(nx, ny, nz);
    acc += area; cdf[k] = acc;
    const l = 2 * area || 1;
    nx /= l; ny /= l; nz /= l;
    // Orient outward (away from the centre).
    if (nx * (P[a] - C[0]) + ny * (P[a + 1] - C[1]) + nz * (P[a + 2] - C[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return [nx, ny, nz];
  });
  return {
    area: acc,
    sample(s) {
      const x = s.u() * acc;
      let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
      const [a, b, c] = tris[lo];
      let r1 = s.u(), r2 = s.u();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      return {
        p: [0, 1, 2].map((k) => P[a + k] + (P[b + k] - P[a + k]) * r1 + (P[c + k] - P[a + k]) * r2),
        n: N[lo],
      };
    },
  };
}

// Fisher–Yates over whole records, so any prefix of the range is a uniform subsample (quality tiers).
function shuffleRecords(buf, count, s, start = 0) {
  const tmp = new Float32Array(FLOATS);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(s.u() * (i + 1));
    const a = (start + i) * FLOATS, b = (start + j) * FLOATS;
    tmp.set(buf.subarray(a, a + FLOATS));
    buf.copyWithin(a, b, b + FLOATS);
    buf.set(tmp, b);
  }
}

// Dopamine bathing weight of a neuron star (§8.1): 1 for lit regions, 0 for the tinted modulator
// regions and the cerebellum, times a per-point jitter d_point ∈ [0.75, 1.25].
const BATHING_ZERO = new Set(BUILD_PARAMS.bathingZero.map((id) => R[id]));
export const bathingWeight = (region) => (BATHING_ZERO.has(region) ? 0 : 1);
const bathing = (region, x, y, z) => bathingWeight(region) * (0.75 + 0.5 * (0.5 + 0.5 * noise3(x / 9, y / 9, z / 9)));

// Corpus callosum and ventricles stay (nearly) empty: white matter is axons, not neurons.
const SHARES = { cortex: 0.585, insula: 0.016, cerebellum: 0.165, nuclei: 0.165, brainstem: 0.059, white: 0.01 };

// Release-site allocation per TERMINALS entry (§7.5): field size × density weight (r_x·r_y·r_z
// per ellipsoid, a fixed 900 per tube, 2,500 per cortical field). Every field receives exactly
// this count (the axon pass no longer overruns into the last field, §7.6).
const fieldVol = (t) => (t.type === 'e' ? t.r[0] * t.r[1] * t.r[2] : t.type === 't' ? 900 : 2500);
export function releaseAllocation(vari) {
  const w = TERMINALS.map((t) => fieldVol(t) * t.density), sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => Math.round(vari * v / sum));
}
// Axon points per pathway: exactly round(axon · share) (§7.6, §9.7).
export const axonAllocation = (axon) => PATHWAYS.map((pw) => Math.round(axon * pw.share));
// Somata per cell group (§7.5).
export const somaAllocation = (soma) => DA_GROUPS.map((g) => Math.round(soma * g.share));

let cortexGrid = null, cerebellumGrid = null, bsVolumes = null;

// `da` gives the dopamine budget { soma, axon, vari }; `da.total` is ignored, the buffer holds
// exactly the records written (soma + axon + vari allocations; returned as daCount and daTotal).
export function generateBrain({ neurons, da }, seed = 1848) {
  const P = BUILD_PARAMS;
  const s = new Sampler(seed);
  const buf = new Float32Array(neurons * FLOATS);
  let n = 0;
  const cortexBy = new Map();   // region -> sampled cortical positions (for cortical terminal fields)
  const put = (x, y, z, lum, nx, ny, nz, region, daW, tint, kind) => {
    if (n >= neurons) return;
    const o = n * FLOATS;
    buf[o] = x * MM; buf[o + 1] = y * MM; buf[o + 2] = z * MM; buf[o + 3] = lum;
    buf[o + 4] = nx; buf[o + 5] = ny; buf[o + 6] = nz; buf[o + 7] = s.u();
    buf[o + 8] = region; buf[o + 9] = daW; buf[o + 10] = tint; buf[o + 11] = kind;
    n++;
  };
  const somata = somaAllocation(da.soma);

  // 0. Leading, unshuffled block (§7.4, §7.5): the non-dopaminergic VTA stars (`vtaOther`), a fixed
  //    count of 0.35/0.65 × the VTA and midline DA somata, placed in the VTA and midline-column
  //    ellipsoids in proportion to their somata, so every tier draws all of them. Region `vta`,
  //    `vtaMedial` within 3.5 mm of the midline; bathing weight 0 (teal GABA tint, never amber).
  const vtaGroups = DA_GROUPS.map((g, i) => [g, somata[i]]).filter(([g]) => g.region === R.vta || g.region === R.vtaMedial);
  const vtaSomata = vtaGroups.reduce((a, [, c]) => a + c, 0);
  const nVtaOther = Math.round(P.vtaOtherRatio * vtaSomata);
  let placed = 0;
  vtaGroups.forEach(([g, c], i) => {
    const count = i === vtaGroups.length - 1 ? nVtaOther - placed : Math.round(nVtaOther * c / vtaSomata);
    placed += count;
    for (let k = 0; k < count; k++) {
      const q = s.inVolume(g);
      const side = g.mid ? 1 : (s.u() < 0.5 ? 1 : -1);
      const x = q[0] * side;
      const region = Math.abs(x) < GEOMETRY.vtaMedialX ? R.vtaMedial : R.vta;
      put(x, q[1], q[2], s.lum() * P.lumNucleus, 0, 0, 0, region, 0, 0.4 + 0.15 * s.u(), KIND.NUCLEUS);
    }
  });
  const lead = n;

  // 1. Cerebral cortex: a 2.5 mm ribbon under the hull. Seen from outside, the walls of a sulcus are
  //    hidden by the neighbouring gyri, so most sulcal points are dropped (as if occluded) and the
  //    rest sink to the fundus and dim: sulci read as dark lines between brighter crowns. The ribbon
  //    does not follow the inferior-medial notch (the cut where hypothalamus, midbrain and pons
  //    emerge), and no cortical point lies inside a deep volume or a ventricle (§7.2 item 3, §7.3).
  const C = P.cortex;
  cortexGrid ||= surfaceGrid((x, y, z) => sdCerebrum(x, y, z, 1), [30, -20, 8], 112, 224, 130);
  const nCortex = Math.round(neurons * SHARES.cortex);
  for (let k = 0; k < nCortex;) {
    const { p, n: nn } = cortexGrid.sample(s);
    if (p[0] < 3.5 && insideCallosalWindow(p[1], p[2])) continue;
    let notchRegion = -1;
    if (Math.abs(notchDistance(p[0], p[1], p[2])) <= C.notchBand) {
      const medial = p[0] <= C.notchMedialX;
      if (medial && p[1] > C.notchWindowY[0] && p[1] <= C.notchWindowY[1]) continue;
      if (!medial) notchRegion = R.temporal;                                       // uncus, parahippocampal gyrus
      else if (p[1] <= C.notchWindowY[0]) notchRegion = p[1] < C.occipitalY ? R.occipital : R.temporal;   // basal occipitotemporal surface
    }
    const side = s.u() < 0.5 ? 1 : -1;
    const x0 = p[0] * side, nx = nn[0] * side;
    const f = folding(x0, p[1], p[2]);
    if (s.u() < C.sulcalDrop * f.sulcus) continue;
    const sink = f.sulcus > 0.04 ? f.depth * (0.3 + 0.7 * s.u()) : 0;
    const d = sink + C.ribbon * s.u();
    const x = x0 - nx * d, y = p[1] - nn[1] * d, z = p[2] - nn[2] * d;
    if (insideVoid(x, y, z) || insideDeepVolume(x, y, z)) continue;
    const region = notchRegion >= 0 ? notchRegion : corticalRegion(x0, p[1], p[2]);
    const lum = s.lum() * Math.exp(-sink / C.sulcalDim) * (1.15 - 0.3 * f.sulcus);
    put(x, y, z, lum, nx, nn[1], nn[2], region, bathing(region, x, y, z), 0.15 + 0.2 * s.u(), KIND.CORTEX);
    if (region === R.pfc || region === R.ofc || region === R.acc) {
      if (!cortexBy.has(region)) cortexBy.set(region, []);
      if (cortexBy.get(region).length < 6000) cortexBy.get(region).push([x, y, z]);
    }
    k++;
  }

  // 2. Insula: cortex folded deep inside the Sylvian fissure, under the opercula. The §7.3 ribbon,
  //    centre (±37, −3, 4), half-extents (4, 26, 11): y −29…+23, anterior insula included.
  const I = P.insula;
  const nIns = Math.round(neurons * SHARES.insula);
  for (let k = 0; k < nIns; k++) {
    const side = s.u() < 0.5 ? 1 : -1;
    let dx, dy, dz;
    do { dx = s.gauss(); dy = s.gauss(); dz = s.gauss(); } while (dx < I.backFace * len3(dx, dy, dz));
    const l = len3(dx, dy, dz);
    const x = side * (I.c[0] + I.r[0] * dx / l), y = I.c[1] + I.r[1] * dy / l, z = I.c[2] + I.r[2] * dz / l;
    put(x - side * I.depth * s.u(), y, z, s.lum() * I.lum, side * dx / l, dy / l, dz / l, R.insula, bathing(R.insula, x, y, z), I.tint, KIND.CORTEX);
  }

  // 3. Cerebellum: a densely folded sheet whose fissures fan backward from the fourth ventricle and
  //    the peduncles, like the pages of a half-open book: level sets of the sagittal angle about a
  //    transverse axis at the front of the cerebellum, warped so they are not perfectly regular.
  //    Folia groups are ≈ 2.2 mm apart; grooves are rejected and dimmed by at most 30 % combined, so
  //    the stripes never form a high-contrast grating (photosensitivity). Points fill the outer
  //    ~6 mm, where the folded cortex lies, so the cerebellum reads as solid rather than as a shell.
  const CB = P.cerebellum;
  cerebellumGrid ||= surfaceGrid(sdCerebellum, [0, -62, -36], 80, 160, 70);
  const nCb = Math.round(neurons * SHARES.cerebellum);
  for (let k = 0; k < nCb; k++) {
    const { p, n: nn } = cerebellumGrid.sample(s);
    const ang = Math.atan2(p[2] + 33, -(p[1] + 38)) * 26 + 0.12 * Math.abs(p[0]);   // arc length (mm) at r ≈ 26 mm
    const groove = 0.5 + 0.5 * Math.cos((ang + 2.5 * noise3(p[0] / 12, p[1] / 12, p[2] / 12)) / CB.foliaPeriod * 2 * Math.PI);
    if (s.u() < CB.grooveReject * (1 - groove)) { k--; continue; }
    const sink = (1 - groove) ** 2 * 2.5;
    const d = sink + 6 * s.u() ** 1.7;
    put(p[0] - nn[0] * d, p[1] - nn[1] * d, p[2] - nn[2] * d, s.lum() * (1 - CB.grooveDim * (1 - groove)), nn[0], nn[1], nn[2],
      R.cerebellum, 0, 0.3 + 0.2 * s.u(), KIND.CEREBELLUM);
  }

  // 4. Deep nuclei: filled volumes (no facing attenuation), denser than cortex per mm³. The VTA
  //    stars of step 0 belong to this budget. Hypothalamic nuclei have soft Gaussian borders.
  const nNuc = Math.max(0, Math.round(neurons * SHARES.nuclei) - nVtaOther);
  const nucSamplers = NUCLEI.map((d) => (d.type === 't' ? tubeSampler(d.pts) : null));
  const shareSum = NUCLEI.reduce((a, d) => a + d.share, 0);
  NUCLEI.forEach((d, i) => {
    const count = Math.round(nNuc * d.share / shareSum);
    for (let k = 0; k < count; k++) {
      const q = d.type === 't' ? nucSamplers[i](s) : s.inVolume(d);
      const side = d.mid ? 1 : (s.u() < 0.5 ? 1 : -1);
      const x = q[0] * side, y = q[1], z = q[2];
      let region = d.region;
      if (d.id === 'nacc') {
        const u = (Math.abs(x) - 11.5) / 3.2, v = (y - 12.5) / 4, w = (z + 6.5) / 3.2;
        if (u * u + v * v + w * w < 1) region = R.naccCore;
      }
      // The pituitary gland and its stalk are glandular tissue, not neurons: a faint haze drawn as
      // soft wide sprites, the lobes under `pituitaryGland`, the stalk under `medianEminence` (§7.3).
      const kind = region === R.pituitaryGland || region === R.medianEminence ? KIND.GLAND : KIND.NUCLEUS;
      put(x, y, z, s.lum() * (kind === KIND.GLAND ? P.lumGland : P.lumNucleus), 0, 0, 0, region, bathing(region, x, y, z), d.tint + 0.15 * s.u(), kind);
    }
  });

  // 5. Brainstem and upper spinal cord, with the crus ellipsoids as filler at the tube's density.
  //    Points below z −72 are the cord (`spinal`). Third-ventricle points are carved out (§7.3).
  const bs = tubeSampler(BRAINSTEM);
  bsVolumes ||= { tube: tubeVolume(BRAINSTEM), crus: 2 * (4 / 3) * Math.PI * CRUS.r[0] * CRUS.r[1] * CRUS.r[2] };
  const nBs = Math.round(neurons * SHARES.brainstem);
  const nCrus = Math.round(nBs * bsVolumes.crus / (bsVolumes.tube + bsVolumes.crus));
  for (let k = 0; k < nBs - nCrus;) {
    const q = bs(s);
    if (insideVoid(q[0], q[1], q[2])) continue;
    const region = q[2] < SPINAL_Z ? R.spinal : R.brainstem;
    put(q[0], q[1], q[2], s.lum() * P.lumBrainstem, 0, 0, 0, region, bathing(region, q[0], q[1], q[2]), 0.4 + 0.2 * s.u(), KIND.BRAINSTEM);
    k++;
  }
  for (let k = 0; k < nCrus;) {
    const q = s.inVolume(CRUS);
    const side = s.u() < 0.5 ? 1 : -1;
    const x = q[0] * side;
    if (insideVoid(x, q[1], q[2])) continue;
    put(x, q[1], q[2], s.lum() * P.lumBrainstem, 0, 0, 0, R.brainstem, bathing(R.brainstem, x, q[1], q[2]), 0.4 + 0.2 * s.u(), KIND.BRAINSTEM);
    k++;
  }

  // 6. White matter: the corpus callosum arching between the hemispheres (faint, axons only; no
  //    bathing). Points in the ventricles are carved out.
  const cc = spline([[0, 31, 8], [0, 26, 18], [0, 12, 24], [0, -8, 26], [0, -26, 23], [0, -37, 15], [0, -40, 8]]);
  while (n < neurons) {
    const u = s.u(), c = cc(u);
    const x = s.gauss() * 13;
    if (Math.abs(x) > 34) continue;
    const thick = 2 + 2.5 * (Math.exp(-(((u - 0.05) / 0.12) ** 2)) + Math.exp(-(((u - 0.93) / 0.1) ** 2)));
    const y = c[1] + s.gauss() * 1.2, z = c[2] + 0.2 * Math.abs(x) + s.gauss() * thick * 0.5;
    if (insideVoid(x, y, z)) continue;
    put(x, y, z, s.lum() * P.lumWhite, 0, 0, 0, R.whiteMatter, 0, 0.05, KIND.WHITE);
  }
  shuffleRecords(buf, n - lead, s, lead);

  // --- Dopamine system: exactly the allocated records (§7.6, §9.7) ---
  const axons = axonAllocation(da.axon), sites = releaseAllocation(da.vari);
  const total = [...somata, ...axons, ...sites].reduce((a, b) => a + b, 0);
  const dbuf = new Float32Array(total * FLOATS);
  let m = 0;
  const dput = (x, y, z, lum, a, b, c, region, w, kind) => {
    if (m >= total) return;
    const o = m * FLOATS;
    dbuf[o] = x * MM; dbuf[o + 1] = y * MM; dbuf[o + 2] = z * MM; dbuf[o + 3] = lum;
    dbuf[o + 4] = a; dbuf[o + 5] = b; dbuf[o + 6] = c; dbuf[o + 7] = s.u();
    dbuf[o + 8] = region; dbuf[o + 9] = w; dbuf[o + 10] = 0; dbuf[o + 11] = kind;
    m++;
  };
  const ranges = {};

  // Cell bodies: one drawn soma stands for several hundred real dopamine neurons. VTA somata within
  // 3.5 mm of the midline take `vtaMedial` (VTA-m), the others `vta` (VTA-l) (§8.1).
  ranges.soma = [m, 0];
  DA_GROUPS.forEach((g, i) => {
    for (let k = 0; k < somata[i]; k++) {
      const q = s.inVolume(g);
      const side = g.mid ? 1 : (s.u() < 0.5 ? 1 : -1);
      const x = q[0] * side;
      const region = g.region === R.vta && Math.abs(x) < GEOMETRY.vtaMedialX ? R.vtaMedial : g.region;
      dput(x, q[1], q[2], 0.6 + 0.8 * s.u(), 0, 0, 0, region, q[3], DA_KIND.SOMA);
    }
  });
  ranges.soma[1] = m - ranges.soma[0];

  // Axon bundles as streamlines (as in diffusion tractography): each pathway is a bundle of fibres
  // with fixed offsets in the cross-section, ~1 mm wide in the medial forebrain bundle and fanning
  // out to the pathway's terminal spread. Points are strung along each fibre, so threads read as
  // threads; a slow wander keeps them from looking machine-made. A pathway of `count` points has
  // floor(count/fibres) points on every fibre plus one on the first (count mod fibres) fibres.
  ranges.axon = [m, 0];
  PATHWAYS.forEach((pw, pi) => {
    const pos = spline(pw.pts);
    const count = axons[pi];
    const fibres = Math.max(6, Math.round(Math.sqrt(count) * 1.1));
    const per = Math.floor(count / fibres), extra = count - per * fibres;
    for (let f = 0; f < fibres; f++) {
      const nf = per + (f < extra ? 1 : 0);
      const side = f % 2 ? 1 : -1;
      const a0 = s.gauss() * 0.8, b0 = s.gauss() * 0.8;              // offset in the bundle (mm)
      const a1 = s.gauss() * pw.fan, b1 = s.gauss() * pw.fan;        // offset at the terminal fan
      const ph = s.u() * 6.283, lumF = 0.55 + 0.45 * s.u();
      for (let k = 0; k < nf; k++) {
        const u = Math.min(1, (k + s.u()) / nf);
        const p = pos(u), q = pos(Math.min(1, u + 0.01)), o = pos(Math.max(0, u - 0.01));
        let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
        const tl = len3(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        // Cross-section basis (X: world x made orthogonal to the tangent; Y = T × X).
        let ax = 1 - tx * tx, ay = -tx * ty, az = -tx * tz;
        const al = len3(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
        const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
        const fan = Math.pow(Math.max(0, (u - 0.65) / 0.35), 1.6);
        const wob = 0.35 * Math.sin(u * 19 + ph);
        const ca = a0 + (a1 - a0) * fan + wob + s.gauss() * 0.12, cb = b0 + (b1 - b0) * fan + s.gauss() * 0.12;
        const x = p[0] + ax * ca + bx * cb, y = p[1] + ay * ca + by * cb, z = p[2] + az * ca + bz * cb;
        dput(x * side, y, z, lumF * (0.8 + 0.2 * s.u()), pi, u, 0, pw.to, pw.from, DA_KIND.AXON);
      }
    }
  });
  ranges.axon[1] = m - ranges.axon[0];
  shuffleRecords(dbuf, ranges.axon[1], s, ranges.axon[0]);

  // Release sites (varicosities) and lantern glows in each terminal field.
  // w = normalized distance from the field centre: the glow spreads outward as dopamine rises.
  ranges.vari = [m, 0];
  const lanterns = [];
  TERMINALS.forEach((t, ti) => {
    const count = sites[ti];
    const tube = t.type === 't' ? tubeSampler(t.pts) : null;
    const pool = t.type === 'cortex' ? cortexBy.get(t.region) || [] : null;
    const centre = t.type === 'cortex' && pool.length ? pool.reduce((a, p) => [a[0] + p[0] / pool.length, a[1] + p[1] / pool.length, a[2] + p[2] / pool.length], [0, 0, 0]) : null;
    const pick = () => {
      if (t.type === 'e') return s.inEllipsoid(t.c, t.r);
      if (tube) return tube(s);
      if (!pool.length) return null;
      const p = pool[Math.floor(s.u() * pool.length)];
      const x = p[0] + s.gauss() * 1.2, y = p[1] + s.gauss() * 1.2, z = p[2] + s.gauss() * 1.2;
      return [x, y, z, Math.min(1, len3(Math.abs(x) - Math.abs(centre[0]), y - centre[1], z - centre[2]) / 30)];
    };
    for (let k = 0; k < count; k++) {
      const q = pick();
      if (!q) break;
      const side = t.mid ? 1 : (t.type === 'cortex' ? Math.sign(q[0]) || 1 : (s.u() < 0.5 ? 1 : -1));
      const x = t.type === 'cortex' ? q[0] : q[0] * side;
      dput(x, q[1], q[2], 0.4 + 0.6 * s.u(), 0, 0, 0, t.region, q[3], DA_KIND.VARICOSITY);
    }
    const nl = t.lanterns * (t.mid ? 1 : 2);
    for (let k = 0; k < nl; k++) {
      const q = pick();
      if (!q) break;
      const side = t.mid ? 1 : (t.type === 'cortex' ? 1 : (k % 2 ? 1 : -1));
      const size = t.type === 'e' ? 0.75 * Math.cbrt(t.r[0] * t.r[1] * t.r[2]) : t.type === 'cortex' ? 7 : 4;
      lanterns.push([q[0] * (t.type === 'cortex' ? 1 : side) * MM, q[1] * MM, q[2] * MM, size * MM * (0.8 + 0.4 * s.u()),
        s.u(), q[3], 0, 0, t.region, 0, 0, 13]);
    }
  });
  ranges.vari[1] = m - ranges.vari[0];
  shuffleRecords(dbuf, ranges.vari[1], s, ranges.vari[0]);

  return {
    neurons: buf, neuronCount: n, leadCount: lead,
    da: dbuf.subarray(0, m * FLOATS), daCount: m, daTotal: m, daRanges: ranges,
    daAlloc: { soma: somata, axon: axons, vari: sites },
    lanterns: Float32Array.from(lanterns.flat()), lanternCount: lanterns.length,
  };
}

// =====================================================================================
// Brain-system additions (research/ANALYSIS.md B.5). generateBrain above is unchanged after Phase 0a.
// =====================================================================================

// Extra-buffer stars use the §8.1 bathing rule of generateBrain (`bathing`), applied to the region
// whose dopamine channels the star inherits (PARENT), so new structures are bathed like their parent.

// Volume of a NUCLEI_V2 structure in mm³, both sides (weights the remainder stratum).
function structureVolume(d) {
  let v;
  if (d.type === 'e') v = (4 / 3) * Math.PI * d.r[0] * d.r[1] * d.r[2];
  else {
    const pos = spline(d.pts), steps = 64;
    v = 0;
    for (let k = 0; k < steps; k++) {
      const a = pos(k / steps), b = pos((k + 1) / steps), rr = 0.5 * (a[3] + b[3]);
      v += Math.PI * rr * rr * len3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
  }
  return d.mid ? v : 2 * v;
}

// Floor-stratified plan (B.8): one stratum per distinct floor level (every nucleus is topped up
// to that floor), then a remainder shared in proportion to volume. Each stratum also gives the
// insula extension the fraction `insulaShare` of its stars, so any prefix of the buffer holds
// the extension at the same density. When the budget ends inside a stratum, that stratum is
// split evenly over the nuclei (largest volumes take the odd stars).
function planStrata(total, vol, P) {
  const S = vol.length, q = P.insulaShare;
  const levels = [...new Set(P.floors)].sort((a, b) => a - b);
  const bySize = vol.map((_, i) => i).sort((a, b) => vol[b] - vol[a] || a - b);
  const even = (count) => {
    const base = Math.floor(count / S), out = new Int32Array(S).fill(base);
    for (let k = 0; k < count - base * S; k++) out[bySize[k]]++;
    return out;
  };
  const strata = [];
  let left = total, prev = 0;
  for (const f of levels) {
    if (left <= 0 || S === 0) break;
    const nuc = S * (f - prev), ins = Math.round(nuc * q / (1 - q));
    if (nuc + ins <= left) {
      strata.push({ floor: f, nuclei: new Int32Array(S).fill(f - prev), insula: ins });
      left -= nuc + ins; prev = f;
    } else {
      const insula = Math.round(left * q);
      strata.push({ floor: f, nuclei: even(left - insula), insula });
      left = 0;
    }
  }
  if (left > 0) {
    const insula = S ? Math.round(left * q) : left, rest = left - insula;
    const sum = vol.reduce((a, v) => a + v, 0) || 1;
    const exact = vol.map((v) => rest * v / sum);
    const out = Int32Array.from(exact, Math.floor);
    const odd = rest - out.reduce((a, b) => a + b, 0);
    const byFrac = exact.map((_, i) => i).sort((a, b) => (exact[b] - out[b]) - (exact[a] - out[a]) || a - b);
    for (let k = 0; k < odd; k++) out[byFrac[k]]++;
    strata.push({ floor: null, nuclei: out, insula });
  }
  return strata;
}

// Internal shuffle of one stratum whose records lie group after group (`counts`): star j of a
// group of c stars gets the jittered key (j + u)/c and records are reordered by key, so every
// prefix of the stratum holds each group in proportion (to within one star). Within a group the
// positions are independent samples, so a prefix of a group is a uniform subsample of it.
function interleaveRecords(buf, start, counts, s) {
  const total = counts.reduce((a, c) => a + c, 0);
  const keys = new Float64Array(total);
  let i = 0;
  for (const c of counts) for (let j = 0; j < c; j++) keys[i++] = (j + s.u()) / c;
  const order = Array.from({ length: total }, (_, k) => k).sort((a, b) => keys[a] - keys[b] || a - b);
  const src = buf.slice(start * FLOATS, (start + total) * FLOATS);
  order.forEach((from, to) => buf.set(src.subarray(from * FLOATS, (from + 1) * FLOATS), (start + to) * FLOATS));
}

// Extra brain buffer: NUCLEI_V2 structures with `stars` (the new nuclei, the pallidal split, the
// tectal bumps, CVLM, LGN, MGN, …) and the anterior-insula extension, in floor-stratified order.
// `neurons` is the size of this buffer (TIERS.extra of the generation tier); a tier draws a
// prefix, and every prefix meets the floor of each stratum it contains. Same 12-float record as
// generateBrain; its own seeded stream.
export function generateBrainExtra({ neurons }, seed = 1849) {
  const P = EXTRA_PARAMS;
  const total = Math.max(0, Math.floor(neurons));
  const s = new Sampler(seed);
  const buf = new Float32Array(total * FLOATS);
  let n = 0;
  const put = (x, y, z, lum, nx, ny, nz, region, daW, tint, kind) => {
    const o = n * FLOATS;
    buf[o] = x * MM; buf[o + 1] = y * MM; buf[o + 2] = z * MM; buf[o + 3] = lum;
    buf[o + 4] = nx; buf[o + 5] = ny; buf[o + 6] = nz; buf[o + 7] = s.u();
    buf[o + 8] = region; buf[o + 9] = daW; buf[o + 10] = tint; buf[o + 11] = kind;
    n++;
  };

  const list = NUCLEI_V2.filter((d) => d.stars);
  const tubes = list.map((d) => (d.type === 't' ? tubeSampler(d.pts) : null));
  const sides = new Int32Array(list.length);
  const nucleusStar = (d, i) => {
    const q = d.type === 't' ? tubes[i](s) : s.inEllipsoid(d.c, d.r);
    const side = d.mid ? 1 : (sides[i]++ % 2 ? -1 : 1);   // alternate, so a pair splits evenly
    const x = q[0] * side, y = q[1], z = q[2];
    const gland = d.node === 'gland';
    put(x, y, z, s.lum() * (gland ? P.lumGland : P.lumNucleus), 0, 0, 0, d.region,
      bathing(PARENT[d.region], x, y, z), d.tint + P.tintJitter * s.u(), gland ? KIND.GLAND : KIND.NUCLEUS);
  };
  // Anterior-insula extension: the §3.17 ribbon sampled like the coded insula, keeping only the
  // part of the sheet whose (y, z) lies outside the coded ribbon's footprint (mainly y > +8).
  const { c, r } = P.insula, o = P.insulaCoded;
  const insulaStar = () => {
    for (;;) {
      const side = s.u() < 0.5 ? 1 : -1;
      let dx, dy, dz;
      do { dx = s.gauss(); dy = s.gauss(); dz = s.gauss(); } while (dx < P.insulaBackFace * len3(dx, dy, dz));
      const l = len3(dx, dy, dz);
      const x = side * (c[0] + r[0] * dx / l), y = c[1] + r[1] * dy / l, z = c[2] + r[2] * dz / l;
      const u = (y - o.c[1]) / o.r[1], v = (z - o.c[2]) / o.r[2];
      if (u * u + v * v <= 1) continue;
      put(x - side * P.insulaDepth * s.u(), y, z, s.lum() * P.insulaLum, side * dx / l, dy / l, dz / l,
        R.insula, bathing(R.insula, x, y, z), P.insulaTint, KIND.CORTEX);
      return;
    }
  };

  const plan = planStrata(total, list.map(structureVolume), P);
  const strata = [];
  let insulaCount = 0;
  for (const st of plan) {
    const start = n, groups = [];
    list.forEach((d, i) => { for (let k = 0; k < st.nuclei[i]; k++) nucleusStar(d, i); groups.push(st.nuclei[i]); });
    for (let k = 0; k < st.insula; k++) insulaStar();
    groups.push(st.insula);
    insulaCount += st.insula;
    interleaveRecords(buf, start, groups, s);
    strata.push({ start, count: n - start, floor: st.floor });
  }
  return {
    neurons: buf, neuronCount: n, extra: true, strata, insulaCount,
    structures: list.map((d, i) => ({ id: d.id, region: d.region, counts: plan.map((st) => st.nuclei[i]) })),
  };
}

// A relabel rule (anatomy.js RELABEL) as a function of a right-side position (mm) → region index.
function compileRule(rule) {
  if (rule.rule === 'plane') {
    const above = R[rule.above], below = R[rule.below];
    return (x, y, z) => ([x, y, z][rule.axis] > rule.at ? above : below);
  }
  const targets = rule.to.map((id) => V2[id]);
  const scaled = rule.metric === 'scaled';
  const host = rule.shell ? NUCLEI.find((d) => d.region === rule.from && d.type === 'e') : null;
  const shellRegion = rule.shell ? R[rule.shell.id] : -1;
  return (x, y, z) => {
    if (host) {
      // In the host's own frame (the post-port thalamus is yawed 15°, §7.3); the outward normal
      // is rotated back to world axes before its lateral (x) component is tested.
      const wx = x - host.c[0], wy = y - host.c[1], wz = z - host.c[2];
      const A = host.axes ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      const [ex, ey, ez] = A.map((a) => wx * a[0] + wy * a[1] + wz * a[2]);
      const qn = len3(ex / host.r[0], ey / host.r[1], ez / host.r[2]);
      const depth = qn > 1e-9 ? (1 - qn) * len3(ex, ey, ez) / qn : Infinity;   // radial distance to the surface
      const g = [ex / host.r[0] ** 2, ey / host.r[1] ** 2, ez / host.r[2] ** 2];
      const gx = g[0] * A[0][0] + g[1] * A[1][0] + g[2] * A[2][0];
      if (depth <= rule.shell.thickness && gx / (len3(g[0], g[1], g[2]) || 1) >= rule.shell.minNormalX) return shellRegion;
    }
    let best = 0, bd = Infinity;
    targets.forEach((t, k) => {
      const dx = x - t.c[0], dy = y - t.c[1], dz = z - t.c[2];
      const d2 = scaled ? (dx / t.r[0]) ** 2 + (dy / t.r[1]) ** 2 + (dz / t.r[2]) ** 2 : dx * dx + dy * dy + dz * dz;
      if (d2 < bd) { bd = d2; best = k; }
    });
    return targets[best].region;
  };
}

// Rewrites the region float (a2.x) of the generateBrain stars that A.3.3 and §3.17 relabel
// (pallidum → gpe/gpi, raphe → dr/mnr, pituitary gland → anterior/posterior lobe, thalamus → its 11
// subnuclei). Nothing else in the record changes, so positions and flux stay bit-identical and the
// relabelled stars keep their parent's dopamine channels through PARENT. Idempotent. The extra
// buffer already carries the new regions and is left alone.
export function applyRelabel(brain) {
  const byRegion = {};
  if (brain.extra) return { relabelled: 0, byRegion };
  const buf = brain.neurons, count = brain.neuronCount ?? buf.length / FLOATS;
  const rules = new Map(RELABEL.map((rule) => [rule.from, compileRule(rule)]));
  let relabelled = 0;
  for (let i = 0; i < count; i++) {
    const o = i * FLOATS;
    const fn = rules.get(buf[o + 8]);
    if (!fn) continue;
    const region = fn(Math.abs(buf[o]) / MM, buf[o + 1] / MM, buf[o + 2] / MM);
    if (region !== buf[o + 8]) { buf[o + 8] = region; relabelled++; }
    byRegion[REGION_IDS[region]] = (byRegion[REGION_IDS[region]] || 0) + 1;
  }
  return { relabelled, byRegion };
}

// Cortical area per star (anatomy.js AREAS index; AREA_NONE = 255). A patch is a disc of the
// cortical sheet: a cortical star belongs to it when it lies inside the patch sphere, or (with
// EXTRA_PARAMS.areaColumn) when it is shallower than the patch centre and its distance to the
// centre, less the depth difference, is within the radius. Many §3.16 centres lie 10–28 mm under
// the procedural hull, where no star sits, and the column rule maps them to the sheet above them.
// Overlapping patches go to the one nearest in units of its radius. Insular stars in no patch take
// the nearest insular sub-patch. Works on generateBrain and generateBrainExtra output.
export function areaIds(brain) {
  const buf = brain.neurons, count = brain.neuronCount ?? buf.length / FLOATS;
  const out = new Uint8Array(count).fill(AREA_NONE);
  const column = EXTRA_PARAMS.areaColumn;
  const patches = [], sheets = [];
  AREAS.forEach((a, i) => {
    if (a.sheet !== undefined) sheets.push([i, a.c, a.sheet]);
    else {
      const cDepth = column ? Math.max(0, -sdCerebrum(Math.max(a.c[0], 2), a.c[1], a.c[2], 1)) : 0;
      patches.push([i, a.c, 1 / (a.radius * a.radius), cDepth, Math.hypot(a.radius, cDepth)]);
    }
  });
  for (let k = 0; k < count; k++) {
    const o = k * FLOATS;
    if (buf[o + 11] !== KIND.CORTEX) continue;
    const x = Math.abs(buf[o]) / MM, y = buf[o + 1] / MM, z = buf[o + 2] / MM;
    let depth = null;
    let best = AREA_NONE, bd = 1;
    for (const [i, c, inv, cDepth, reach] of patches) {
      if (Math.abs(x - c[0]) > reach || Math.abs(y - c[1]) > reach || Math.abs(z - c[2]) > reach) continue;
      if (column && depth === null) depth = Math.max(0, -sdCerebrum(Math.max(x, 2), y, z, 1));   // ≥ 0, so rise ≤ cDepth ≤ reach
      const rise = column ? Math.max(0, cDepth - depth) : 0;
      const d2 = ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 - rise * rise) * inv;
      if (d2 <= bd) { bd = d2; best = i; }
    }
    if (best === AREA_NONE) {
      bd = Infinity;
      for (const [i, c, sheet] of sheets) {
        if (buf[o + 8] !== sheet) continue;
        const d2 = (x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2;
        if (d2 < bd) { bd = d2; best = i; }
      }
    }
    out[k] = best;
  }
  return out;
}
