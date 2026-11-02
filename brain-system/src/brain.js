// Point populations of the star brain: neurons (cortex, cerebellum, deep nuclei, brainstem,
// white matter), the dopamine system (cell bodies, axon bundles, release sites) and the lantern
// glows of the terminal fields. Budgets per structure follow research/DOPAMINE.md §7: visual area
// and volume rather than raw neuron counts (the cerebellum holds ~80 % of all neurons but would
// swallow the picture), with deep structures drawn denser so they read through the cortex.

import {
  MM, R, KIND, NUCLEI, DA_GROUPS, BRAINSTEM, PATHWAYS, TERMINALS,
  sdCerebrum, sdCerebellum, insideCallosalWindow, folding, corticalRegion, noise3, spline, mulberry32, len3,
  NUCLEI_V2, V2, RELABEL, PARENT, AREAS, AREA_NONE, REGION_IDS,
} from './anatomy.js';

export const FLOATS = 12;   // a0: pos.xyz, lum · a1: normal.xyz | path data, seed · a2: region, daW, tint, kind
export const DA_KIND = { SOMA: 10, AXON: 11, VARICOSITY: 12 };

// Extra brain buffer (generateBrainExtra): the new nuclei of research/ANALYSIS.md §3.16–§3.17
// and the anterior-insula extension, drawn with the neuron program in a buffer of their own so
// the generateBrain buffer stays bit-identical (B.2, B.5). The buffer is floor-stratified (B.8).
export const EXTRA_PARAMS = {
  floors: [40, 80, 120, 120],   // minimum stars per new nucleus at low/medium/high/ultra; a bilateral pair counts once (§13.4; B.16)
  insulaShare: 0.14,            // share of every stratum given to the anterior-insula extension ([model]): the largest share at which the
                                // B.8 high budget (10,800) still meets the high-tier floor; ≈ 0.4 of the coded insula's star density
  areaColumn: true,             // a cortical patch also takes the stars straight above a deep centre (areaIds; [model])
  lumNucleus: 0.42,             // flux factor of nucleus stars (as NUCLEI in generateBrain)
  lumGland: 0.35,               // flux factor of gland haze (pineal; as the pituitary)
  tintJitter: 0.15,             // added to the structure tint × u (as NUCLEI)
  insula: { c: [37, -3, 4], r: [4, 26, 11] },        // insular ribbon of DOPAMINE.md §7.3, adopted by §3.17 (mm)
  insulaCoded: { c: [36, -9, 2], r: [4, 17, 10] },   // ribbon drawn by generateBrain (brain.js step 2); its (y, z) footprint is not redrawn
  insulaBackFace: -0.2,         // lateral cap only: directions with dx ≥ −0.2·|d| (as the coded insula)
  insulaDepth: 2,               // inward jitter (mm; as the coded insula)
  insulaLum: 0.7,               // flux factor (as the coded insula)
  insulaTint: 0.2,              // tint (as the coded insula)
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

// Dopamine innervation weight per region (0..1): how strongly local neurons are bathed by
// released dopamine. Striatum densest, prefrontal moderate, other cortex sparse, cerebellum none.
const DA_WEIGHT = {
  [R.naccShell]: 1, [R.naccCore]: 1, [R.dorsalStriatum]: 0.95, [R.pfc]: 0.32, [R.ofc]: 0.28, [R.acc]: 0.38,
  [R.insula]: 0.12, [R.amygdala]: 0.45, [R.hippocampus]: 0.12, [R.mpoa]: 0.7, [R.pvn]: 0.55, [R.arcuate]: 0.4,
  [R.pituitary]: 0.5, [R.frontal]: 0.06, [R.temporal]: 0.05, [R.parietal]: 0.04, [R.occipital]: 0.02,
  [R.thalamus]: 0.08, [R.pallidum]: 0.2, [R.hypothalamus]: 0.25, [R.spinal]: 0.3,
};

// Corpus callosum and ventricles stay (nearly) empty: white matter is axons, not neurons.
const SHARES = { cortex: 0.585, insula: 0.016, cerebellum: 0.165, nuclei: 0.165, brainstem: 0.059, white: 0.01 };

let cortexGrid = null, cerebellumGrid = null;

export function generateBrain({ neurons, da }, seed = 1848) {
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
  const daW = (region, x, y, z) => (DA_WEIGHT[region] ?? 0.03) * (0.75 + 0.5 * (0.5 + 0.5 * noise3(x / 9, y / 9, z / 9)));

  // 1. Cerebral cortex: a 2.5 mm ribbon under the hull. Seen from outside, the walls of a sulcus are
  //    hidden by the neighbouring gyri, so most sulcal points are dropped (as if occluded) and the
  //    rest sink to the fundus and dim: sulci read as dark lines between brighter crowns.
  cortexGrid ||= surfaceGrid((x, y, z) => sdCerebrum(x, y, z, 1), [30, -20, 8], 112, 224, 130);
  const nCortex = Math.round(neurons * SHARES.cortex);
  for (let k = 0; k < nCortex;) {
    const { p, n: nn } = cortexGrid.sample(s);
    if (p[0] < 3.5 && insideCallosalWindow(p[1], p[2])) continue;
    const side = s.u() < 0.5 ? 1 : -1;
    const x0 = p[0] * side, nx = nn[0] * side;
    const f = folding(x0, p[1], p[2]);
    if (s.u() < 0.75 * f.sulcus) continue;
    const sink = f.sulcus > 0.04 ? f.depth * (0.3 + 0.7 * s.u()) : 0;
    const d = sink + 2.6 * s.u();
    const x = x0 - nx * d, y = p[1] - nn[1] * d, z = p[2] - nn[2] * d;
    const region = corticalRegion(x0, p[1], p[2]);
    const lum = s.lum() * Math.exp(-sink / 5) * (1.15 - 0.3 * f.sulcus);
    put(x, y, z, lum, nx, nn[1], nn[2], region, daW(region, x, y, z), 0.15 + 0.2 * s.u(), KIND.CORTEX);
    if (region === R.pfc || region === R.ofc || region === R.acc) {
      if (!cortexBy.has(region)) cortexBy.set(region, []);
      if (cortexBy.get(region).length < 6000) cortexBy.get(region).push([x, y, z]);
    }
    k++;
  }

  // 2. Insula: cortex folded deep inside the Sylvian fissure, under the opercula.
  const nIns = Math.round(neurons * SHARES.insula);
  for (let k = 0; k < nIns; k++) {
    const side = s.u() < 0.5 ? 1 : -1;
    let dx, dy, dz;
    do { dx = s.gauss(); dy = s.gauss(); dz = s.gauss(); } while (dx < -0.2 * len3(dx, dy, dz));
    const l = len3(dx, dy, dz);
    const x = side * (36 + 4 * dx / l), y = -9 + 17 * dy / l, z = 2 + 10 * dz / l;
    put(x - side * 2 * s.u(), y, z, s.lum() * 0.7, side * dx / l, dy / l, dz / l, R.insula, daW(R.insula, x, y, z), 0.2, KIND.CORTEX);
  }

  // 3. Cerebellum: a densely folded sheet whose fissures fan backward from the fourth ventricle and
  //    the peduncles, like the pages of a half-open book: level sets of the sagittal angle about a
  //    transverse axis at the front of the cerebellum, warped so they are not perfectly regular.
  //    Folia groups are ≈ 2.4 mm apart; grooves sink and dim by at most 30 %, so the stripes never
  //    form a high-contrast grating (photosensitivity). Points fill the outer ~6 mm, where the
  //    folded cortex lies, so the cerebellum reads as solid rather than as a hollow shell.
  cerebellumGrid ||= surfaceGrid(sdCerebellum, [0, -62, -36], 80, 160, 70);
  const nCb = Math.round(neurons * SHARES.cerebellum);
  for (let k = 0; k < nCb; k++) {
    const { p, n: nn } = cerebellumGrid.sample(s);
    const ang = Math.atan2(p[2] + 33, -(p[1] + 38)) * 26 + 0.12 * Math.abs(p[0]);   // arc length (mm) at r ≈ 26 mm
    const groove = 0.5 + 0.5 * Math.cos((ang + 2.5 * noise3(p[0] / 12, p[1] / 12, p[2] / 12)) / 2.4 * 2 * Math.PI);
    if (s.u() < 0.35 * (1 - groove)) { k--; continue; }
    const sink = (1 - groove) ** 2 * 2.5;
    const d = sink + 6 * s.u() ** 1.7;
    put(p[0] - nn[0] * d, p[1] - nn[1] * d, p[2] - nn[2] * d, s.lum() * (0.7 + 0.3 * groove), nn[0], nn[1], nn[2],
      R.cerebellum, 0, 0.3 + 0.2 * s.u(), KIND.CEREBELLUM);
  }

  // 4. Deep nuclei: filled volumes (no facing attenuation), denser than cortex per mm³.
  const nNuc = Math.round(neurons * SHARES.nuclei);
  const nucSamplers = NUCLEI.map((d) => (d.type === 't' ? tubeSampler(d.pts) : null));
  const shareSum = NUCLEI.reduce((a, d) => a + d.share, 0);
  NUCLEI.forEach((d, i) => {
    const count = Math.round(nNuc * d.share / shareSum);
    for (let k = 0; k < count; k++) {
      const q = d.type === 't' ? nucSamplers[i](s) : s.inEllipsoid(d.c, d.r);
      const side = d.mid ? 1 : (s.u() < 0.5 ? 1 : -1);
      const x = q[0] * side, y = q[1], z = q[2];
      let region = d.region;
      if (d.id === 'nacc') {
        const u = (Math.abs(x) - 11.5) / 3.2, v = (y - 12.5) / 4, w = (z + 6.5) / 3.2;
        if (u * u + v * v + w * w < 1) region = R.naccCore;
      }
      // The pituitary is glandular tissue, not neurons: a faint haze (drawn as soft wide sprites).
      const kind = region === R.pituitary ? KIND.GLAND : KIND.NUCLEUS;
      put(x, y, z, s.lum() * (kind === KIND.GLAND ? 0.35 : 0.42), 0, 0, 0, region, daW(region, x, y, z), d.tint + 0.15 * s.u(), kind);
    }
  });

  // 5. Brainstem and upper spinal cord.
  const bs = tubeSampler(BRAINSTEM);
  const nBs = Math.round(neurons * SHARES.brainstem);
  for (let k = 0; k < nBs; k++) {
    const q = bs(s);
    const region = q[2] < -64 ? R.spinal : R.brainstem;
    put(q[0], q[1], q[2], s.lum() * 0.5, 0, 0, 0, region, region === R.spinal ? 0.1 : 0.02, 0.4 + 0.2 * s.u(), KIND.BRAINSTEM);
  }

  // 6. White matter: the corpus callosum arching between the hemispheres (faint, axons only).
  const cc = spline([[0, 31, 8], [0, 26, 18], [0, 12, 24], [0, -8, 26], [0, -26, 23], [0, -37, 15], [0, -40, 8]]);
  while (n < neurons) {
    const u = s.u(), c = cc(u);
    const x = s.gauss() * 13;
    if (Math.abs(x) > 34) continue;
    const thick = 2 + 2.5 * (Math.exp(-(((u - 0.05) / 0.12) ** 2)) + Math.exp(-(((u - 0.93) / 0.1) ** 2)));
    put(x, c[1] + s.gauss() * 1.2, c[2] + 0.2 * Math.abs(x) + s.gauss() * thick * 0.5, s.lum() * 0.32, 0, 0, 0,
      R.whiteMatter, 0, 0.05, KIND.WHITE);
  }
  shuffleRecords(buf, n, s);

  // --- Dopamine system ---
  const dbuf = new Float32Array(da.total * FLOATS);
  let m = 0;
  const dput = (x, y, z, lum, a, b, c, region, w, kind) => {
    if (m >= da.total) return;
    const o = m * FLOATS;
    dbuf[o] = x * MM; dbuf[o + 1] = y * MM; dbuf[o + 2] = z * MM; dbuf[o + 3] = lum;
    dbuf[o + 4] = a; dbuf[o + 5] = b; dbuf[o + 6] = c; dbuf[o + 7] = s.u();
    dbuf[o + 8] = region; dbuf[o + 9] = w; dbuf[o + 10] = 0; dbuf[o + 11] = kind;
    m++;
  };
  const ranges = {};

  // Cell bodies: one drawn soma stands for several hundred real dopamine neurons.
  ranges.soma = [m, 0];
  for (const g of DA_GROUPS) {
    const count = Math.round(da.soma * g.share);
    for (let k = 0; k < count; k++) {
      const q = s.inEllipsoid(g.c, g.r);
      const side = s.u() < 0.5 ? 1 : -1;
      dput(q[0] * side, q[1], q[2], 0.6 + 0.8 * s.u(), 0, 0, 0, g.region, q[3], DA_KIND.SOMA);
    }
  }
  ranges.soma[1] = m - ranges.soma[0];

  // Axon bundles as streamlines (as in diffusion tractography): each pathway is a bundle of fibres
  // with fixed offsets in the cross-section, ~1 mm wide in the medial forebrain bundle and fanning
  // out to the pathway's terminal spread. Points are strung along each fibre, so threads read as
  // threads; a slow wander keeps them from looking machine-made.
  ranges.axon = [m, 0];
  PATHWAYS.forEach((pw, pi) => {
    const pos = spline(pw.pts);
    const count = Math.round(da.axon * pw.share);
    const fibres = Math.max(6, Math.round(Math.sqrt(count) * 1.1));
    const per = Math.ceil(count / fibres);
    for (let f = 0; f < fibres; f++) {
      const side = f % 2 ? 1 : -1;
      const a0 = s.gauss() * 0.8, b0 = s.gauss() * 0.8;              // offset in the bundle (mm)
      const a1 = s.gauss() * pw.fan, b1 = s.gauss() * pw.fan;        // offset at the terminal fan
      const ph = s.u() * 6.283, lumF = 0.55 + 0.45 * s.u();
      for (let k = 0; k < per; k++) {
        const u = Math.min(1, (k + s.u()) / per);
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
  const fieldVol = (t) => (t.type === 'e' ? t.r[0] * t.r[1] * t.r[2] : t.type === 't' ? 900 : 2500);
  const volSum = TERMINALS.reduce((a, t) => a + fieldVol(t) * t.density, 0);
  for (const t of TERMINALS) {
    const count = Math.round(da.vari * fieldVol(t) * t.density / volSum);
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
  }
  ranges.vari[1] = m - ranges.vari[0];
  shuffleRecords(dbuf, ranges.vari[1], s, ranges.vari[0]);

  return {
    neurons: buf, neuronCount: n,
    da: dbuf.subarray(0, m * FLOATS), daCount: m, daRanges: ranges,
    lanterns: Float32Array.from(lanterns.flat()), lanternCount: lanterns.length,
  };
}

// =====================================================================================
// Brain-system additions (research/ANALYSIS.md B.5). generateBrain above is unchanged.
// =====================================================================================

// Dopamine bathing weight of a star: the rule of generateBrain's daW, applied to the region whose
// dopamine channels the star inherits (PARENT), so new structures are bathed like their parent.
const bathing = (region, x, y, z) => (DA_WEIGHT[region] ?? 0.03) * (0.75 + 0.5 * (0.5 + 0.5 * noise3(x / 9, y / 9, z / 9)));

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
      const ex = x - host.c[0], ey = y - host.c[1], ez = z - host.c[2];
      const qn = len3(ex / host.r[0], ey / host.r[1], ez / host.r[2]);
      const depth = qn > 1e-9 ? (1 - qn) * len3(ex, ey, ez) / qn : Infinity;   // radial distance to the surface
      const gx = ex / host.r[0] ** 2, gy = ey / host.r[1] ** 2, gz = ez / host.r[2] ** 2;
      if (depth <= rule.shell.thickness && gx / (len3(gx, gy, gz) || 1) >= rule.shell.minNormalX) return shellRegion;
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
// (pallidum → gpe/gpi, raphe → dr/mnr, pituitary → anterior/posterior lobe, thalamus → its 11
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
