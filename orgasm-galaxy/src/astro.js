// Astrophysical populations: star colors (Planck + CIE 1931), initial mass
// function (IMF), spatial distribution across the galaxy components, and the background sky.
// Figures come from the table in research/ANALYSIS.md (Stellar classification, IMF sources).

import { MODEL } from './galaxy-model.js';

// Each particle record: aOrbit(4) + aColor(4) + aMeta(4) = 12 floats.
export const FLOATS_PER = 12;

export const KIND = {
  DISK: 0, BULGE: 1, HALO: 2, YOUNG_ARM: 3, YOUNG_RING: 4,
  GLOW_DISK: 5, GLOW_ARM: 6, HII_ARM: 7, HII_RING: 8, DUST: 9, BAR_LANE: 10, JET: 11, CONE: 12, FLUSH: 13,
};

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Sampler {
  constructor(seed) { this.next = mulberry32(seed); this.spare = null; }
  u() { return this.next(); }
  range(a, b) { return a + (b - a) * this.next(); }
  gauss() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const m = Math.sqrt(-2 * Math.log(u));
    this.spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }
  // Radial distribution for an exponential disk Σ(r) ∝ e^(−r/Rd): r·e^(−r/Rd) = Gamma(2, Rd).
  expDisk(Rd, rmin, rmax) {
    for (;;) {
      const r = -Rd * Math.log(this.u() * this.u() + 1e-12);
      if (r >= rmin && r <= rmax) return r;
    }
  }
  // Vertical sech² profile (logistic distribution).
  sech2() {
    const u = Math.min(Math.max(this.u(), 1e-6), 1 - 1e-6);
    return 0.5 * Math.log(u / (1 - u));
  }
  // Heavy-tailed luminosity (Pareto): many faint, few bright.
  pareto(base, gamma, cap) {
    return Math.min(cap * base, base * Math.pow(1 - this.u() + 1e-9, -1 / gamma));
  }
}

// --- Color: Planck's law × CIE 1931 (Wyman–Sloan–Shirley 2013 analytic approximation) ---

function lobe(x, mu, s1, s2) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}

function cie(nm) {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}

// XYZ -> linear sRGB (D65), normalized by luminance (unit Y).
function xyzToRgb(X, Y, Z) {
  const r = Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z);
  const g = Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z);
  const b = Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / lum, g / lum, b / lum];
}

export function blackbodyRGB(T) {
  const C2 = 1.4388e-2;   // hc/k, m·K
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const l = nm * 1e-9;
    const B = 1 / (Math.pow(l, 5) * (Math.exp(C2 / (l * T)) - 1));
    const [x, y, z] = cie(nm);
    X += B * x; Y += B * y; Z += B * z;
  }
  return xyzToRgb(X, Y, Z);
}

// Color of an emission-line spectrum (H II: Hα 656.3 + Hβ 486.1 + [O III] 500.7 nm).
// The human eye (CIE) is barely sensitive to Hα — the visual color comes out a pale gray-lavender.
// The familiar pink-red of astrophotographs comes from broadband R/G/B filters,
// so camera filters (Gaussian approximation) are used here instead.
export function emissionRGB(lines) {
  const band = (nm, c, s) => Math.exp(-0.5 * ((nm - c) / s) ** 2);
  let r = 0, g = 0, b = 0;
  for (const [nm, w] of lines) {
    r += w * band(nm, 640, 40);
    g += w * band(nm, 540, 25);
    b += w * band(nm, 450, 30);
  }
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / lum, g / lum, b / lum];
}

const LUT_N = 256;
const LOG_TMIN = Math.log10(2000), LOG_TMAX = Math.log10(50000);
let LUT = null;

export function starColor(T) {
  if (!LUT) {
    LUT = new Float32Array(LUT_N * 3);
    for (let i = 0; i < LUT_N; i++) {
      const rgb = blackbodyRGB(Math.pow(10, LOG_TMIN + (LOG_TMAX - LOG_TMIN) * i / (LUT_N - 1)));
      LUT.set(rgb, i * 3);
    }
  }
  const x = Math.min(LUT_N - 1.001, Math.max(0, (Math.log10(T) - LOG_TMIN) / (LOG_TMAX - LOG_TMIN) * (LUT_N - 1)));
  const i = Math.floor(x), f = x - i;
  return [0, 1, 2].map((c) => LUT[i * 3 + c] * (1 - f) + LUT[(i + 1) * 3 + c] * f);
}

// --- Mass, temperature, luminosity, lifetime ---

// Salpeter IMF: dN/dm ∝ m^(−2.35).
function salpeterMass(s, m1, m2, alpha = 2.35) {
  const p = 1 - alpha;
  const a = Math.pow(m1, p), b = Math.pow(m2, p);
  return Math.pow(a + s.u() * (b - a), 1 / p);
}

// Main sequence: T ≈ 5772·m^0.6 K (matches the class boundaries in the table), L ∝ m^3.5, τ ≈ 10 billion yr·m^(−2.5).
function mainSequence(m) {
  return {
    T: Math.min(45000, 5772 * Math.pow(m, 0.6)),
    L: Math.pow(m, 3.5),
    lifeMyr: 10000 * Math.pow(m, -2.5),
  };
}

// Old populations: a light-weighted mix (not number-weighted —
// each particle represents the combined light of many stars).
const OLD_DISK_MIX = [
  { w: 0.40, T: [4600, 6000], base: 0.50 },   // G/K dwarfs and subgiants
  { w: 0.25, T: [3900, 4900], base: 0.80 },   // K giants
  { w: 0.08, T: [3200, 3900], base: 1.00 },   // M giants
  { w: 0.15, T: [6000, 7300], base: 0.60 },   // F
  { w: 0.04, T: [7300, 9500], base: 0.70 },   // A
  { w: 0.08, T: [2800, 3800], base: 0.25 },   // M dwarfs
];
const BULGE_MIX = [
  { w: 0.70, T: [3800, 4900], base: 0.80 },
  { w: 0.20, T: [4900, 5800], base: 0.50 },
  { w: 0.10, T: [3300, 3900], base: 1.00 },
];

function pickMix(s, mix) {
  let x = s.u();
  for (const m of mix) { if ((x -= m.w) <= 0) return m; }
  return mix[mix.length - 1];
}

function writeRecord(buf, i, orbit, color, lum, meta) {
  const o = i * FLOATS_PER;
  buf[o] = orbit[0]; buf[o + 1] = orbit[1]; buf[o + 2] = orbit[2]; buf[o + 3] = orbit[3];
  buf[o + 4] = color[0]; buf[o + 5] = color[1]; buf[o + 6] = color[2]; buf[o + 7] = lum;
  buf[o + 8] = meta[0]; buf[o + 9] = meta[1]; buf[o + 10] = meta[2]; buf[o + 11] = meta[3];
}

// Mix a colour toward white of the same luminance (lower chroma).
function desaturate(rgb, k) {
  return rgb.map((c) => c * (1 - k) + k);
}

// Optical synchrotron light of a jet: a power law F_ν ∝ ν^(−α) is F_λ ∝ λ^(α−2), rising toward
// the blue — which is why the M87 jet looks pale blue. Same camera-filter bands as emissionRGB.
export function synchrotronRGB(alpha = 0.7) {
  const r = Math.pow(640, alpha - 2), g = Math.pow(540, alpha - 2), b = Math.pow(450, alpha - 2);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / lum, g / lum, b / lum];
}

// Shuffle each particle kind, then interleave the kinds in blocks of 64 records in proportion to
// their counts. The first N records stay a fair subsample (quality tiers draw prefixes), while
// every GPU warp now processes a single kind and runs one shader branch instead of all of them.
function interleaveByKind(buf, start, count, s, block = 64) {
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const o = (start + i) * FLOATS_PER;
    const kind = buf[o + 8];
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(buf.slice(o, o + FLOATS_PER));
  }
  const lists = [...groups.values()];
  for (const list of lists) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(s.u() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const taken = lists.map(() => 0);
  let out = start;
  while (out < start + count) {
    // Next block from the kind that is furthest behind its share.
    let best = -1, bestProgress = Infinity;
    lists.forEach((list, k) => {
      if (taken[k] >= list.length) return;
      const progress = taken[k] / list.length;
      if (progress < bestProgress) { bestProgress = progress; best = k; }
    });
    const n = Math.min(block, lists[best].length - taken[best]);
    for (let i = 0; i < n; i++) buf.set(lists[best][taken[best] + i], (out + i) * FLOATS_PER);
    taken[best] += n;
    out += n;
  }
}

// Young star clusters in the spiral arms (OB associations), outside the bar.
function makeArmClusters(s, n) {
  const clusters = [];
  for (let i = 0; i < n; i++) {
    clusters.push({
      a: s.expDisk(0.36, MODEL.R_BAR * 1.15, MODEL.R_OLR * 1.15),
      branch: s.u() < 0.5 ? 0 : Math.PI,
      jit: s.gauss() * 0.2,
      phase: s.u(),     // position in the cycle: clusters are born at different times
      act: s.u(),       // activation threshold: the higher the star formation rate, the more clusters light up
    });
  }
  return clusters;
}

// Nuclear-ring clusters on x2 orbits. They are born where the bar dust lanes meet the ring
// (the two contact points) and age as they orbit — the "pearls on a string" age gradient.
// In the x2 frame the contact point at polar angle ≈ 66° (bar frame) is at E ≈ −0.42 rad.
const CONTACT_E = -0.42;
function makeRingClusters(s, n) {
  const clusters = [];
  for (let i = 0; i < n; i++) {
    clusters.push({
      a: MODEL.RING_R + s.gauss() * MODEL.RING_W * 0.5,
      E: CONTACT_E + (s.u() < 0.5 ? 0 : Math.PI) + s.gauss() * 0.12,
      phase: s.u(),
      act: s.u(),
    });
  }
  return clusters;
}

function youngStar(s, cycle) {
  let T, lum, lifeMyr;
  if (s.u() < 0.05) {
    T = s.range(3500, 4300); lum = s.range(3, 6); lifeMyr = s.range(10, 25);
  } else {
    const ms = mainSequence(salpeterMass(s, 1.6, 40));
    T = ms.T; lum = 0.55 * Math.pow(ms.L, 0.22); lifeMyr = ms.lifeMyr;
  }
  // Very short lifetimes are clamped from below so they stay visible: a particle stands for a whole association.
  const life = Math.min(cycle * 1.2, Math.max(0.04, lifeMyr / MODEL.MYR_PER_UNIT));
  return { color: starColor(T), lum, life };
}

export function generateGalaxy({ stars, glow, hii, dust, jet, cone }, seed = 1977) {
  const t0 = performance.now();
  const s = new Sampler(seed);

  const youngCount = Math.round(stars * 0.22);
  const oldCount = stars - youngCount;
  const starBuf = new Float32Array(stars * FLOATS_PER);
  const armClusters = makeArmClusters(s, Math.max(100, Math.round(youngCount * 0.7 / 45)));
  const ringClusters = makeRingClusters(s, Math.max(40, Math.round(youngCount * 0.3 / 30)));

  // Old stars: disk 80 % (its inner part on aligned x1 orbits *is* the bar), a small classical
  // bulge 12 % (barred galaxies have modest bulges), halo 8 % with globular clusters.
  const globulars = Array.from({ length: 70 }, () => ({
    r: 0.18 + 1.2 * Math.pow(s.u(), 1.6), phi: s.u() * Math.PI * 2, w: s.range(-1, 1),
  }));
  for (let i = 0; i < oldCount; i++) {
    const x = s.u();
    const epi = s.u() * Math.PI * 2;
    if (x < 0.8) {
      const a = s.expDisk(0.28, 0.015, 1.3);
      const m = pickMix(s, a < MODEL.R_BAR * 1.05 ? BULGE_MIX : OLD_DISK_MIX);   // the bar is old: 4,200–5,000 K
      writeRecord(starBuf, i, [a, s.u() * Math.PI * 2, s.sech2(), epi],
        starColor(s.range(m.T[0], m.T[1])), s.pareto(m.base, 1.8, 25), [KIND.DISK, s.u(), 0, 0]);
    } else if (x < 0.92) {
      const m = pickMix(s, BULGE_MIX);
      // Hernquist profile: M(<r) = r² / (r + a)²  ->  r = a·√u / (1 − √u), truncated at r ≈ 0.25.
      const q = Math.sqrt(s.u() * 0.77);
      const r = 0.035 * q / (1 - q);
      writeRecord(starBuf, i, [r, s.u() * Math.PI * 2, s.range(-1, 1), epi],
        starColor(s.range(m.T[0], m.T[1])), s.pareto(m.base * 0.55, 1.8, 25), [KIND.BULGE, s.u(), 0, 0]);
    } else {
      // Metal-poor halo stars are slightly bluer.
      const T = s.range(4300, 6300);
      if (s.u() < 0.15) {
        const g = globulars[Math.floor(s.u() * globulars.length)];
        const rr = g.r * (1 + s.gauss() * 0.008);
        writeRecord(starBuf, i, [rr, g.phi + s.gauss() * 0.008 / g.r, Math.max(-1, Math.min(1, g.w + s.gauss() * 0.008)), epi],
          starColor(T), s.pareto(0.22, 2.2, 6), [KIND.HALO, s.u(), 0, 0]);
      } else {
        const r = 0.12 + 0.9 * Math.pow(s.u(), 2.2) * 1.8;
        writeRecord(starBuf, i, [r, s.u() * Math.PI * 2, s.range(-1, 1), epi],
          starColor(T), s.pareto(0.12, 2.2, 6), [KIND.HALO, s.u(), 0, 0]);
      }
    }
  }

  // Young stars: Salpeter IMF (1.6–40 M☉), 70 % in arm associations, 30 % in the nuclear ring.
  for (let j = 0; j < youngCount; j++) {
    const i = oldCount + j;
    const epi = s.u() * Math.PI * 2;
    if (s.u() < 0.7) {
      const c = armClusters[Math.floor(s.u() * armClusters.length)];
      const st = youngStar(s, MODEL.CLUSTER_CYCLE);
      writeRecord(starBuf, i, [c.a * (1 + s.gauss() * 0.018) + s.gauss() * 0.004, c.branch + c.jit + s.gauss() * 0.035, s.sech2(), epi],
        st.color, st.lum, [KIND.YOUNG_ARM, c.act, c.phase, st.life]);
    } else {
      const c = ringClusters[Math.floor(s.u() * ringClusters.length)];
      const st = youngStar(s, MODEL.RING_CYCLE);
      writeRecord(starBuf, i, [c.a * (1 + s.gauss() * 0.02), c.E + s.gauss() * 0.04, s.sech2() * 0.6, epi],
        st.color, st.lum, [KIND.YOUNG_RING, c.act, c.phase, st.life]);
    }
  }
  interleaveByKind(starBuf, 0, oldCount, s);
  interleaveByKind(starBuf, oldCount, youngCount, s);

  // --- Sprite particles: diffuse glow, H II, dust, jet, ionization cones ---
  const spriteBuf = new Float32Array((glow + hii + dust + jet + cone) * FLOATS_PER);
  let n = 0;
  const ranges = {};

  ranges.glow = [n, glow];
  const warm = starColor(5000), blue = starColor(11000);
  // In the outer parts the sprites are larger and fainter (same total energy), so even sparse
  // regions form smooth light rather than separate "blobs".
  for (let j = 0; j < glow; j++, n++) {
    if (s.u() < 0.7) {
      const a = s.expDisk(0.28, 0.02, 1.25);
      const size = s.range(0.05, 0.09) * (0.6 + 1.1 * a);
      writeRecord(spriteBuf, n, [a, s.u() * Math.PI * 2, s.sech2(), s.u() * 6.283],
        warm, s.range(0.5, 1.0) * (0.07 / size) ** 2, [KIND.GLOW_DISK, 0, 0, size]);
    } else {
      const a = s.expDisk(0.36, MODEL.R_BAR * 1.1, 1.15);
      const size = s.range(0.045, 0.08) * (0.6 + 1.0 * a);
      writeRecord(spriteBuf, n, [a, (s.u() < 0.5 ? 0 : Math.PI) + s.gauss() * 0.2, s.sech2(), s.u() * 6.283],
        blue, s.range(0.6, 1.0) * (0.065 / size) ** 2, [KIND.GLOW_ARM, 0, 0, size]);
    }
  }

  ranges.hii = [n, hii];
  const hiiColor = desaturate(emissionRGB([[656.3, 2.86], [658.4, 0.9], [486.1, 1.0], [500.7, 0.6]]), 0.25);
  for (let j = 0; j < hii; j++, n++) {
    const x = s.u();
    if (x < 0.4) {
      const c = armClusters[Math.floor(s.u() * armClusters.length)];
      writeRecord(spriteBuf, n, [c.a * (1 + s.gauss() * 0.012), c.branch + c.jit + s.gauss() * 0.02, s.sech2() * 0.5, s.u() * 6.283],
        hiiColor, s.range(0.6, 1.4), [KIND.HII_ARM, c.act, c.phase, 0.012 + 0.03 * s.u() * s.u()]);
    } else if (x < 0.75) {
      const c = ringClusters[Math.floor(s.u() * ringClusters.length)];
      writeRecord(spriteBuf, n, [c.a + s.gauss() * 0.0015, c.E + s.gauss() * 0.03, s.sech2() * 0.3, s.u() * 6.283],
        hiiColor, s.range(0.6, 1.4), [KIND.HII_RING, c.act, c.phase, 0.004 + 0.008 * s.u() * s.u()]);
    } else {
      // Diffuse H-alpha of the inner disk, lit only by the flush analog.
      const size = s.range(0.02, 0.035);
      writeRecord(spriteBuf, n, [s.range(0.03, MODEL.R_BAR * 1.25), s.u() * Math.PI * 2, s.sech2() * 0.4, s.u() * 6.283],
        hiiColor, s.range(0.5, 1.0) * (0.028 / size) ** 2, [KIND.FLUSH, 0, 0, size]);
    }
  }

  // Dust: arm lanes made of clouds and filaments (some branch into "feathers"), diffuse dust,
  // and the two straight bar dust lanes — standing shocks on the leading edges of the bar —
  // with gas clumps flowing along them into the nuclear ring.
  ranges.dust = [n, dust];
  const dustClouds = Array.from({ length: Math.max(50, Math.round(dust / 16)) }, () => ({
    a: s.expDisk(0.38, MODEL.R_BAR * 1.1, MODEL.R_OLR * 1.2),
    E: (s.u() < 0.5 ? 0 : Math.PI) + s.gauss() * 0.12,
    len: s.range(0.04, 0.22),       // filament length (radians, along the arm)
    spur: s.u() < 0.25 ? s.range(-0.6, 0.6) : 0,
    op: s.range(0.35, 1.0),
  }));
  const dustColor = [0.55, 0.75, 1.0];
  const laneClouds = Array.from({ length: 56 }, (_, i) => ({
    side: i % 2 ? 1 : -1, s: Math.pow(s.u(), 0.8), len: s.range(0.015, 0.06), off: s.gauss() * 0.6, op: s.range(0.35, 1.0),
  }));
  for (let j = 0; j < dust; j++, n++) {
    const x = s.u();
    if (x < 0.5) {
      const c = dustClouds[Math.floor(s.u() * dustClouds.length)];
      const t = s.gauss();
      const a = c.a * (1 + s.gauss() * 0.01 + c.spur * 0.05 * t);
      writeRecord(spriteBuf, n, [a, c.E + t * c.len * 0.5 + s.gauss() * 0.01, s.sech2() * 0.3, s.u() * 6.283],
        dustColor, c.op * s.range(0.12, 0.3), [KIND.DUST, 0, 1, s.range(0.012, 0.035)]);
    } else if (x < 0.62) {
      writeRecord(spriteBuf, n, [s.expDisk(0.33, 0.05, 1.2), s.u() * Math.PI * 2, s.sech2() * 0.3, s.u() * 6.283],
        dustColor, s.range(0.04, 0.10), [KIND.DUST, 0, 0, s.range(0.03, 0.07)]);
    } else if (x < 0.7) {
      // Nuclear feeding spirals inside the ring: [radius, arm angle, z, –]; flag 2.
      writeRecord(spriteBuf, n, [MODEL.RING_R * s.range(0.12, 0.95), (s.u() < 0.5 ? 0 : Math.PI) + s.gauss() * 0.12, s.sech2() * 0.2, 0],
        dustColor, s.range(0.2, 0.45), [KIND.DUST, 0, 2, s.range(0.003, 0.007)]);
    } else {
      // Bar lane: [position along the lane 0..1, side ±1, lateral offset, z]. flow = 1 marks a moving clump.
      // Standing-lane sprites gather in patchy clouds of uneven opacity, so the lane is not a solid bar.
      const flowing = x > 0.87;
      const c = laneClouds[Math.floor(s.u() * laneClouds.length)];
      const along = flowing ? s.u() : Math.min(1, Math.max(0, c.s + s.gauss() * c.len));
      writeRecord(spriteBuf, n, [along, flowing ? (s.u() < 0.5 ? -1 : 1) : c.side, s.gauss() + c.off, s.sech2() * 0.2],
        dustColor, (flowing ? 1 : c.op) * s.range(0.15, 0.35), [KIND.BAR_LANE, flowing ? 1 : 0, s.u(), s.range(0.008, 0.022)]);
    }
  }

  // Relativistic jet: [position along the jet 0..1 (denser near the core), side ±1, angle, radial fraction].
  ranges.jet = [n, jet];
  const syncColor = synchrotronRGB(0.7);
  for (let j = 0; j < jet; j++, n++) {
    writeRecord(spriteBuf, n, [Math.pow(s.u(), 1.6), s.u() < 0.5 ? -1 : 1, s.u() * Math.PI * 2, Math.sqrt(s.u())],
      syncColor, s.range(0.6, 1.0), [KIND.JET, 0, 0, s.range(0.008, 0.02)]);
  }

  // Ionization cones: AGN-lit gas glowing in [O III] (teal) and H-alpha (pink); 20 % of the
  // sprites form five light-echo clouds 3–10 kpc out inside the cone directions (Hanny's Voorwerp).
  ranges.cone = [n, cone];
  const oiiiColor = desaturate(emissionRGB([[500.7, 1.0], [495.9, 0.33]]), 0.55);
  const coneHii = desaturate(hiiColor, 0.4);
  const coneHalf = 35 * Math.PI / 180;
  // Each echo cloud has one spectrum: [O III]-dominated like Hanny's Voorwerp, or H-alpha-dominated.
  const echoClouds = Array.from({ length: 5 }, () => {
    const D = s.range(0.2, 0.67), th = s.u() * coneHalf;
    return { along: D * Math.cos(th), radius: D * Math.sin(th), ang: s.u() * Math.PI * 2, side: s.u() < 0.5 ? -1 : 1, size: s.range(0.015, 0.03), oiii: s.u() < 0.8 };
  });
  for (let j = 0; j < cone; j++, n++) {
    if (s.u() < 0.2) {
      const c = echoClouds[Math.floor(s.u() * echoClouds.length)];
      writeRecord(spriteBuf, n, [c.along + s.gauss() * c.size, c.side, c.ang + s.gauss() * c.size / Math.max(c.radius, 0.05), Math.max(0, c.radius + s.gauss() * c.size)],
        c.oiii ? oiiiColor : coneHii, s.range(0.2, 0.5), [KIND.CONE, 2, s.u(), s.range(0.02, 0.045)]);
    } else {
      const oiii = s.u() < 0.55;
      writeRecord(spriteBuf, n, [Math.pow(s.u(), 0.7), s.u() < 0.5 ? -1 : 1, s.u() * Math.PI * 2, Math.sqrt(s.u())],
        oiii ? oiiiColor : coneHii, s.range(0.4, 1.0), [KIND.CONE, oiii ? 0 : 1, s.u(), s.range(0.012, 0.03)]);
    }
  }
  for (const key of Object.keys(ranges)) interleaveByKind(spriteBuf, ranges[key][0], ranges[key][1], s);

  return {
    stars: starBuf, oldCount, youngCount,
    sprites: spriteBuf, ranges,
    ms: performance.now() - t0,
  };
}

// Background sky: foreground Milky Way stars (diffraction spikes on the brightest ones)
// and distant background galaxies. Placed at infinity, so it depends only on camera rotation.
export function generateBackground(seed = 4242) {
  const s = new Sampler(seed);
  const nStars = 2600, nGal = 240;
  const buf = new Float32Array((nStars + nGal) * FLOATS_PER);
  const dir = () => {
    const z = s.range(-1, 1), p = s.u() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    return [r * Math.cos(p), r * Math.sin(p), z];
  };
  for (let i = 0; i < nStars; i++) {
    const d = dir();
    const T = s.u() < 0.7 ? s.range(3600, 6500) : s.range(6500, 12000);
    const lum = s.pareto(0.18, 1.35, 400);
    const spike = lum > 9 ? 2 : 0;
    writeRecord(buf, i, [d[0], d[1], d[2], spike], starColor(T), lum, [0, 0, 0, 0]);
  }
  for (let i = 0; i < nGal; i++) {
    const d = dir();
    // Redshifted distant galaxies: yellowish-reddish, very faint, elongated.
    writeRecord(buf, nStars + i, [d[0], d[1], d[2], 1], starColor(s.range(3600, 5600)), s.range(0.08, 0.35),
      [s.range(2.0, 6.5), s.u() * Math.PI, s.range(0.15, 0.75), 0]);
  }
  return { data: buf, count: nStars + nGal };
}
