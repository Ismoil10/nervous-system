// Body point generation (research/ANALYSIS.md §13.2–§13.5, B.4, B.7, B.8): the star buffer of the
// clinical mannequin, built from the geometry of `geometry.js` and `frame.js`. Nine class ranges
// (the §13.4 budget groups, in TISSUE order), each shuffled so that any prefix is a uniform
// subsample (as `shuffleRecords` in brain.js): an adaptive tier downgrade draws prefixes and never
// rebuilds (§13.4, B.8).
//
// Record layout (B.7 "Body vertex record", 16 floats, 64 B per point):
//   a0: pos.x, pos.y, pos.z (render units, mm × MM as brain.js), flux (× mean brain neuron-star flux, §13.3)
//   a1: normal.x, normal.y, normal.z (skin only; 0 for volumes and streams), seed ∈ [0, 1)
//   a2: nodeId (index into geometry NODE_IDS), pathId (index into geometry PATHS, −1 = none),
//       u (A.2 arc parameter on that path, 0 at the CNS end; 0 when no path), tissue class (TISSUE)
//   a3: network bitmask (NET, eight display bits), LOD (0 always, 1 mid, 2 fine: ≥ 0.8 px/mm, §13.4),
//       side (+1 right, −1 left, 0 midline or unpaired), rigid segment id (+ parent weight, geometry rigidAt)
//
// Content rules (A.1, §13.2): no genital, nipple, navel or hair geometry exists in the field; the
// pelvis holds only schematic nerves and plexuses, the bladder, the rectum (drawn to the anorectal
// junction) and an unlabelled pelvic-floor field. Deterministic per seed (mulberry32), no Math.random.

import { MM, mulberry32 } from '../anatomy.js';
import {
  PARAMS as GEO, NET, TISSUE, TISSUE_NAMES, BODY_BOUNDS, HEAD, ORGANS, ORGAN_SHARES, PELVIC_FLOOR, GUT, GANGLIA, MUSCLES,
  VESSELS, PATHS, SITES, SKIN_REGIONS, bodySDF, bodyNormal, skinRegion, diaphragmZ, sdEllipsoid, gutAt, drawToS, sToDraw,
  gutRegionAt, rigidAt, pathById, pathSamples, nodeIndex,
} from './geometry.js';
import { SEGMENTS, CORD_SEGMENTS, CORD_ARC_CONUS, VERTEBRAE, PARAMS as FRAME, canalAt, canalAtArc, cordRadiiAtArc, drg, sided } from './frame.js';

export const FLOATS = 16;   // B.7

export const PARAMS = {
  // §13.4 point budgets per tier and budget group (= B.8 `TIERS.body` totals 32.5k / 63k / 104k / 158k).
  budgets: {
    low:    { skin: 9000,  organ: 6000,  muscle: 2000,  bone: 1500, cord: 2000, nerve: 6000,  ganglion: 2500,  enteric: 2000,  vessel: 1500 },
    medium: { skin: 16000, organ: 12000, muscle: 4000,  bone: 3000, cord: 4000, nerve: 12000, ganglion: 5000,  enteric: 4000,  vessel: 3000 },
    high:   { skin: 26000, organ: 20000, muscle: 7000,  bone: 5000, cord: 6000, nerve: 20000, ganglion: 8000,  enteric: 7000,  vessel: 5000 },
    ultra:  { skin: 40000, organ: 32000, muscle: 10000, bone: 7000, cord: 9000, nerve: 30000, ganglion: 12000, enteric: 10000, vessel: 8000 },
  },
  // §13.2 Lund–Browder skin shares (% BSA); the perineal 1 % is folded into the smooth pelvic shell.
  skinShares: { head: 7, neck: 2, trunkAnt: 13, trunkPost: 13, buttocks: 5, perineum: 1, upperArm: 8, forearm: 6, hand: 5, thigh: 19, leg: 14, foot: 7 },
  isoGrid: { low: 6, medium: 6, high: 4, ultra: 4 },   // §13.2 iso-surface sampling grid (mm)
  coarseCell: 24,                                     // §13.4 narrow band: coarse 24-mm pass, then the fine grid near the surface
  bandMargin: 1.25,                                   // [model] widening of the band tests (the field is not an exact distance)
  eyeSkinGap: 1,                                      // [model] no skin stars within eyeOpening + 1 mm of the corneal apex (dark pupil)
  // §13.3 flux ratios (× mean brain neuron-star flux; brain.js lum() has mean ≈ 1).
  flux: { skin: 0.15, organ: 0.38, muscle: 0.10, bone: 0.08, cordWhite: 0.5, cordGrey: 0.3, nerve: 0.30, ganglion: 0.5, enteric: 0.2, icc: 0.08, vessel: 0.1 },
  fluxJitter: 0.2,                                    // [model] uniform ± jitter around the class flux (mean kept)
  // §13.3 nerve streams: 6–40 streamlines per nerve, cross-section σ 1–4 mm, minimum drawn width 2 mm.
  streamlines: [6, 40], streamSigma: [1, 4], minNerveWidth: 2,
  streamWobble: 0.3,                                  // [model] slow streamline wander (× σ), 1–3 cycles per path
  pointJitter: 0.15,                                  // [model] per-point jitter (× σ)
  // [model] density per mm ∝ floor + log₁₀(1 + drawn width): the width stands in for the §6 axon count
  // until it is wired; the floor keeps the trochlear nerve visible (§13.3).
  densityFloor: 0.6,
  lowTierSkipIntercostals: true,                      // §13.4 intercostal nerves on the low tier: every other one
  // [model] splits inside a budget group (fractions of the group budget).
  cordSplit: { cord: 0.55, drg: 0.15, roots: 0.30 },
  autonomicSplit: { ganglia: 0.35, streams: 0.65 },
  vesselSplit: { vessels: 0.65, haze: 0.15, immune: 0.20 },
  immuneSplit: { spleen: 0.6, ileum: 0.4 },           // §13.5 speckle at the source tissue and the spleen
  boneSplit: { vertebrae: 0.5, pelvis: 0.2, ribs: 0.3 },
  senseShares: { iris: 30, eye: 20, retina: 15, cochlea: 7, vestLabyrinth: 8, olfEpith: 6, tongue: 8, tonguePatch: 6 }, // % of the §13.4 sense-organ share
  ribOffset: 8,                                       // [model] rib hint above the intercostal nerve (costal groove), mm
  // [model] extent of each rib hint as a fraction u of its intercostal route: T1–T7 reach the sternum,
  // T8–T10 end at the costal margin, T11 is a floating rib (the nerves continue into the abdominal wall).
  ribExtent: [1, 1, 1, 1, 1, 1, 1, 0.75, 0.75, 0.75, 0.55],
  pelvicRim: [[40, -60, -650], [75, -75, -600], [150, -30, -587], [118, 50, -700], [25, 60, -745], [0, 55, -757]], // [model] through §2.6 landmarks
  hollowWall: 4,                                      // §13.3 hollow-organ wall shells 3–5 mm
  gutStep: 4,                                         // [model] gut table resolution (mm of sDraw)
  gutEndS: 496,                                       // A.1 [model] walls and ENS end at the anorectal junction (in-vivo s, cm, §2.9)
  ens: { spacing: 8, myenteric: 0.9, submucosal: 0.7, myentericShare: 0.7, aboveCardiaSparse: 0.2, pylorusS: 55,
    gangliaShare: 0.55, ganglionSigma: 1.0, strandSigma: 0.4, icc: 0.8, iccShare: 0.12 }, // §13.3 (spacing 6–10 mm, ICC on high/ultra)
  minOrganVolume: 900,                                // [model] mm³ floor so nodal and receptor fields stay visible (§13.3 enlarged)
  minOrganR: 4,                                       // [model] = §13.3 minimum drawn ganglion radius, applied to small organs
  organSkinGap: 1,                                    // [model] organ, muscle and haze stars stay ≥ 1 mm inside the skin
  hazeTop: -100,                                      // [model] whole-body blood haze only below z −100 (does not veil the brain)
  maxTries: 64,                                       // [model] rejection-sampling guard (deterministic fallback)
  sliceHeadroom: 0.75,                                // [model] yield at 75 % of the slice (B.9 ≤ 8 ms) to absorb the work between checks
};

const BUDGET_GROUPS = TISSUE_NAMES;   // range order = TISSUE order (skin, organ, muscle, bone, cord, nerve, ganglion, enteric, vessel)

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const now = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len3(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Rng {
  constructor(seed) { this.u = mulberry32(seed | 0); this.spare = null; }
  range(a, b) { return a + (b - a) * this.u(); }
  int(n) { return Math.min(n - 1, Math.floor(this.u() * n)); }
  gauss() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = 0;
    while (u === 0) u = this.u();
    const v = this.u(), m = Math.sqrt(-2 * Math.log(u));
    this.spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }
  unitBall() { for (;;) { const x = this.range(-1, 1), y = this.range(-1, 1), z = this.range(-1, 1); if (x * x + y * y + z * z <= 1) return [x, y, z]; } }
  unitSphere() { const b = this.unitBall(); const l = len3(b[0], b[1], b[2]); return l < 1e-6 ? [0, 0, 1] : [b[0] / l, b[1] / l, b[2] / l]; }
  disk() { const r = Math.sqrt(this.u()), a = 2 * Math.PI * this.u(); return [r * Math.cos(a), r * Math.sin(a)]; }
  pick(cdf) {   // index from a cumulative weight array
    const x = this.u() * cdf[cdf.length - 1];
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }
}
const cumulative = (w) => { const c = new Float64Array(w.length); let a = 0; w.forEach((x, i) => { a += x; c[i] = a; }); return c; };
// Integer split of `total` by weights (largest remainder; exact sum).
function apportion(total, weights) {
  const W = weights.reduce((a, b) => a + b, 0);
  if (!(W > 0)) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => total * w / W), out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}
// Integer hash → [0, 1) (ENS lattice jitter; seed-independent geometry).
function ihash(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const streamSeed = (seed, k) => (Math.imul(seed | 0, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca77)) | 0;

// 64-bit hash over the IEEE-754 bits of the buffer (two 32-bit lanes; hex string).
export function hashPoints(f32) {
  const u = new Uint32Array(f32.buffer, f32.byteOffset, f32.length);
  let h1 = 0xdeadbeef | 0, h2 = 0x41c6ce57 | 0;
  for (let i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 2654435761); h2 = Math.imul(h2 ^ u[i], 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------------------------
// Node ids: registered once, in a fixed order, so indices never depend on the seed or the tier.
// ---------------------------------------------------------------------------------------------
const SENSE_NODES = ['iris', 'eye', 'retina', 'cochlea', 'vestLabyrinth', 'olfEpith', 'tongue', 'tongueAnt', 'tonguePost'];
const ORGAN_NODE = (o) => o.id;
for (const o of ORGANS) nodeIndex(ORGAN_NODE(o));
for (const [id] of GUT.regions) nodeIndex(id);
for (const id of SENSE_NODES) nodeIndex(id);
for (const m of MUSCLES) nodeIndex(m.id);
for (const v of VERTEBRAE) nodeIndex(v.id);
nodeIndex('pelvis');
for (let i = 1; i <= 11; i++) nodeIndex(`rib.T${i}`);
for (const g of GANGLIA) nodeIndex(g.id);
for (const p of PATHS) nodeIndex(p.nerve);
nodeIndex('blood');

// ---------------------------------------------------------------------------------------------
// Point writer
// ---------------------------------------------------------------------------------------------
class Writer {
  constructor(cap) { this.buf = new Float32Array(cap * FLOATS); this.n = 0; this.cap = cap; }
  // p in mm; o = { flux, n, seed, node, path, u, tissue, bits, lod, side }
  put(p, rnd, o) {
    if (this.n >= this.cap) return false;
    const b = this.buf, k = this.n * FLOATS;
    const jit = 1 + PARAMS.fluxJitter * (2 * rnd.u() - 1);
    b[k] = p[0] * MM; b[k + 1] = p[1] * MM; b[k + 2] = p[2] * MM; b[k + 3] = o.flux * jit;
    const nn = o.n;
    b[k + 4] = nn ? nn[0] : 0; b[k + 5] = nn ? nn[1] : 0; b[k + 6] = nn ? nn[2] : 0; b[k + 7] = rnd.u();
    b[k + 8] = o.node; b[k + 9] = o.path ?? -1; b[k + 10] = o.u ?? 0; b[k + 11] = o.tissue;
    b[k + 12] = o.bits || 0; b[k + 13] = o.lod || 0; b[k + 14] = o.side || 0; b[k + 15] = rigidAt(p);
    this.n++;
    return true;
  }
}
function shuffleRange(buf, start, count, rnd) {
  const tmp = new Float32Array(FLOATS);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rnd.u() * (i + 1));
    const a = (start + i) * FLOATS, b = (start + j) * FLOATS;
    tmp.set(buf.subarray(a, a + FLOATS));
    buf.copyWithin(a, b, b + FLOATS);
    buf.set(tmp, b);
  }
}

// ---------------------------------------------------------------------------------------------
// Frames along drawn paths (rotation-minimising, so streamline offsets never jump)
// ---------------------------------------------------------------------------------------------
function transportFrames(P) {
  const n = P.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) T.push(norm(sub(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)])));
  let nn = norm(cross(T[0], Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const d = dot(nn, T[i]);
      let m = [nn[0] - d * T[i][0], nn[1] - d * T[i][1], nn[2] - d * T[i][2]];
      if (len3(m[0], m[1], m[2]) < 1e-6) m = cross(T[i], Math.abs(T[i][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
      nn = norm(m);
    }
    N.push(nn); B.push(cross(T[i], nn));
  }
  return { T, N, B };
}
const FRAME_CACHE = new Map();
function pathFrames(path) {
  let F = FRAME_CACHE.get(path.index);
  if (!F) { const S = pathSamples(path); F = { S, ...transportFrames(S.pts) }; FRAME_CACHE.set(path.index, F); }
  return F;
}
// Point on the drawn path at arc fraction u, with its frame: { p, N, B }.
function pathPoint(path, u) {
  const F = pathFrames(path), c = F.S.cum, s = clamp(u) * F.S.arcLen;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const f = (s - c[lo]) / Math.max(1e-9, c[hi] - c[lo]);
  const i = f < 0.5 ? lo : hi;
  return { p: lerp3(F.S.pts[lo], F.S.pts[hi], f), N: F.N[i], B: F.B[i], seg: lo, f };
}

// ---------------------------------------------------------------------------------------------
// Gut table (sDraw in mm), shared by the organ walls, the ENS mesh and the immune speckle
// ---------------------------------------------------------------------------------------------
let GUT_TABLE = null;
function gutTable() {
  if (GUT_TABLE) return GUT_TABLE;
  const step = PARAMS.gutStep, sEnd = sToDraw(PARAMS.gutEndS) * 10;
  const rows = [];
  for (const [k, pc] of GUT.pieces.entries()) {
    const s0 = pc.cum[0], s1 = Math.min(pc.cum[pc.cum.length - 1], sEnd);
    const pts = [], ss = [];
    for (let s = s0; s <= s1 + 1e-6; s += step) { ss.push(s); pts.push(gutAt(s)); }
    const F = transportFrames(pts.map((g) => g.p));
    pts.forEach((g, i) => {
      const region = gutRegionAt(drawToS(ss[i] / 10));
      rows.push({ s: ss[i], p: g.p, r: g.r, N: F.N[i], B: F.B[i], piece: k, region, node: nodeIndex(region), s0, s1 });
    });
  }
  GUT_TABLE = { rows, step, sEnd, S: Float64Array.from(rows.map((r) => r.s)) };
  return GUT_TABLE;
}
function gutRowAt(s) {
  const S = gutTable().S;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m] <= s) lo = m; else hi = m - 1; }
  return gutTable().rows[lo];
}
// Position at sDraw s on a shell of radius fraction `frac` (or absolute radius `abs`) at angle θ.
function gutShellPoint(s, theta, frac, abs = null) {
  const g = gutAt(s), row = gutRowAt(s);
  const R = abs ?? frac * g.r, c = Math.cos(theta) * R, d = Math.sin(theta) * R;
  return { p: [g.p[0] + row.N[0] * c + row.B[0] * d, g.p[1] + row.N[1] * c + row.B[1] * d, g.p[2] + row.N[2] * c + row.B[2] * d], row, r: g.r };
}

// ---------------------------------------------------------------------------------------------
// Skin: narrow-band iso-surface grid (§13.4), cached per grid size (seed-independent)
// ---------------------------------------------------------------------------------------------
const SKIN_GRID = new Map();
function* skinGrid(h, ctx) {
  if (SKIN_GRID.has(h)) return SKIN_GRID.get(h);
  const H = PARAMS.coarseCell, sub = Math.round(H / h), hh = H / sub;
  const eps = hh / 2, tauFine = (eps + hh * 0.866) * PARAMS.bandMargin, tauCoarse = (tauFine + H * 0.866) * PARAMS.bandMargin;
  const { min, max } = BODY_BOUNDS;
  const nx = Math.ceil((max[0] - min[0]) / H), ny = Math.ceil((max[1] - min[1]) / H), nz = Math.ceil((max[2] - min[2]) / H);
  const byRegion = SKIN_REGIONS.map(() => []);
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x0 = min[0] + ix * H, y0 = min[1] + iy * H, z0 = min[2] + iz * H;
      if (Math.abs(bodySDF(x0 + H / 2, y0 + H / 2, z0 + H / 2)) > tauCoarse) continue;
      for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) for (let c = 0; c < sub; c++) {
        const x = x0 + (a + 0.5) * hh, y = y0 + (b + 0.5) * hh, z = z0 + (c + 0.5) * hh;
        if (Math.abs(bodySDF(x, y, z)) > tauFine) continue;
        byRegion[SKIN_REGIONS.indexOf(skinRegion(x, y, z))].push(x, y, z);
      }
      if (ctx.due()) yield ctx.progress('skin grid', iz / nz);
    }
  }
  const grid = { h: hh, eps, cells: byRegion.map((a) => Float32Array.from(a)) };
  SKIN_GRID.set(h, grid);
  return grid;
}

function* genSkin(w, count, rnd, ctx) {
  const grid = yield* skinGrid(ctx.isoGrid, ctx);
  const shares = SKIN_REGIONS.map((r) => PARAMS.skinShares[r] || 0);
  const quotas = apportion(count, shares);
  const apex = HEAD.cornealApex, eyeR = GEO.eyeOpening + PARAMS.eyeSkinGap;
  for (let ri = 0; ri < SKIN_REGIONS.length; ri++) {
    let cells = grid.cells[ri], node = nodeIndex(`skin.${SKIN_REGIONS[ri]}`);
    if (cells.length === 0) { cells = grid.cells[SKIN_REGIONS.indexOf('trunkAnt')]; node = nodeIndex('skin.trunkAnt'); }
    const nCells = cells.length / 3;
    for (let k = 0; k < quotas[ri]; k++) {
      let p = null, n = null;
      for (let t = 0; t < 4 * PARAMS.maxTries; t++) {
        const c = rnd.int(nCells) * 3;
        let q = [cells[c] + (rnd.u() - 0.5) * grid.h, cells[c + 1] + (rnd.u() - 0.5) * grid.h, cells[c + 2] + (rnd.u() - 0.5) * grid.h];
        let d = bodySDF(q[0], q[1], q[2]);
        if (Math.abs(d) > grid.eps) continue;
        for (let it = 0; it < 2; it++) {            // project onto the iso-surface (Newton steps)
          const g = bodyNormal(q[0], q[1], q[2]);
          q = [q[0] - g[0] * d, q[1] - g[1] * d, q[2] - g[2] * d];
          d = bodySDF(q[0], q[1], q[2]);
        }
        if (Math.abs(d) > 0.5) continue;
        if (Math.abs(q[0]) < 80 && len3(Math.abs(q[0]) - apex[0], q[1] - apex[1], q[2] - apex[2]) < eyeR) continue;
        p = q; n = bodyNormal(q[0], q[1], q[2]);
        break;
      }
      if (!p) { const c = rnd.int(nCells) * 3; p = [cells[c], cells[c + 1], cells[c + 2]]; n = bodyNormal(p[0], p[1], p[2]); }
      const side = Math.abs(p[0]) < 1 ? 0 : Math.sign(p[0]);
      w.put(p, rnd, { flux: PARAMS.flux.skin, n, node, tissue: TISSUE.skin, bits: 0, lod: 0, side });
      if ((k & 63) === 0 && ctx.due()) yield ctx.progress('skin', k / count);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Volume samplers
// ---------------------------------------------------------------------------------------------
const insideSkin = (p) => bodySDF(p[0], p[1], p[2]) < -PARAMS.organSkinGap;
const ellVol = (r) => (4 / 3) * Math.PI * r[0] * r[1] * r[2];
const enlarge = (r) => r.map((v) => Math.max(v, PARAMS.minOrganR));
function inEll(rnd, c, r) { const b = rnd.unitBall(); return [c[0] + b[0] * r[0], c[1] + b[1] * r[1], c[2] + b[2] * r[2]]; }
function hazeEll(rnd, c, r, sigma = 0.45) {   // Gaussian haze truncated at the ellipsoid
  for (;;) {
    const q = [rnd.gauss() * sigma, rnd.gauss() * sigma, rnd.gauss() * sigma];
    if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] <= 1) return [c[0] + q[0] * r[0], c[1] + q[1] * r[1], c[2] + q[2] * r[2]];
  }
}
function onEllShell(rnd, c, r, wall) {
  const d = rnd.unitSphere(), f = 1 - wall * rnd.u() / Math.cbrt(r[0] * r[1] * r[2]);
  return [c[0] + d[0] * r[0] * f, c[1] + d[1] * r[1] * f, c[2] + d[2] * r[2] * f];
}
function tubeSampler(pts) {   // [x, y, z, r] rows, linear segments, volume-uniform
  const w = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const L = len3(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    w.push(L * Math.PI * ((pts[i][3] + pts[i + 1][3]) / 2) ** 2);
  }
  const cdf = cumulative(w);
  return {
    volume: cdf[cdf.length - 1],
    sample(rnd) {
      const i = rnd.pick(cdf), t = rnd.u(), a = pts[i], b = pts[i + 1];
      const c = lerp3(a, b, t), r = a[3] + (b[3] - a[3]) * t;
      const T = norm(sub(b, a)), N = norm(cross(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), B = cross(T, N);
      const [u, v] = rnd.disk();
      return [c[0] + (N[0] * u + B[0] * v) * r, c[1] + (N[1] * u + B[1] * v) * r, c[2] + (N[2] * u + B[2] * v) * r];
    },
  };
}
// Rejection loop with a deterministic fallback (the last candidate).
function tryPoint(rnd, gen, ok) {
  let q = null;
  for (let t = 0; t < PARAMS.maxTries; t++) { q = gen(); if (ok(q)) return q; }
  return q;
}
function* fill(w, rnd, ctx, label, count, entries, base) {
  if (!entries.length || count <= 0) return;
  const counts = apportion(count, entries.map((e) => e.weight));
  for (let e = 0; e < entries.length; e++) {
    for (let k = 0; k < counts[e]; k++) {
      const s = entries[e].sample(rnd);
      w.put(s.p, rnd, { ...base, ...s.o });
      if ((k & 63) === 0 && ctx.due()) yield ctx.progress(label, e / entries.length);
    }
  }
}
const sideOf = (rnd, e) => (e.sided ? (rnd.u() < 0.5 ? 1 : -1) : e.side || 0);

// ---------------------------------------------------------------------------------------------
// Organs (§13.3, §13.4 shares; §2.8 volumes, §2.9 gut walls, §2.3 sense organs)
// ---------------------------------------------------------------------------------------------
const ORGAN_BITS = { thyroid: NET.NE, adrenalCortex: NET.NE, adrenalMedulla: NET.NE, spleen: NET.NI };
const STOMACH = new Set(['gut.les', 'gut.fundus', 'gut.corpus', 'gut.antrum', 'gut.pylorus']);
const PELVIC_GUT = new Set(['gut.rectum']);
function gutGroupOf(region) {
  if (region === 'gut.oes') return 'other';
  if (STOMACH.has(region)) return 'stomach';
  if (PELVIC_GUT.has(region)) return 'pelvic';
  if (region === 'gut.ias' || region === 'gut.eas') return null;   // A.1: not drawn (anal canal)
  return 'intestines';
}
function gutWallEntry(group) {
  const T = gutTable(), rows = T.rows.filter((r) => gutGroupOf(r.region) === group);
  if (!rows.length) return null;
  const cdf = cumulative(rows.map((r) => r.r));
  const wall = PARAMS.hollowWall;
  const path = pathById('gut');
  return {
    weight: rows.reduce((a, r) => a + 2 * Math.PI * r.r * wall * T.step, 0),
    sample(rnd) {
      const row = rows[rnd.pick(cdf)];
      const s = clamp(row.s + (rnd.u() - 0.5) * T.step, row.s0, row.s1);
      const q = gutShellPoint(s, 2 * Math.PI * rnd.u(), 1, null);
      const g = gutAt(s), rr = g.r - wall * rnd.u();
      const pp = gutShellPoint(s, Math.atan2(dot(sub(q.p, g.p), q.row.B), dot(sub(q.p, g.p), q.row.N)), 1, rr).p;
      return { p: pp, o: { node: gutRowAt(s).node, path: path.index, u: s / GUT.totalDraw, side: 0 } };
    },
  };
}
function organEntries() {
  const byId = new Map();
  for (const o of ORGANS) { if (!byId.has(o.id)) byId.set(o.id, []); byId.get(o.id).push(o); }
  const carveHit = (p, ids) => ids.some((id) => (byId.get(id) || []).some((o) => {
    if (o.type !== 'e') return false;
    const cs = o.sided ? [o.c, sided(o.c, -1)] : [o.c];
    return cs.some((c) => sdEllipsoid(p, c, o.r) < GEO.carveGap);
  }));
  const groups = new Map();
  const add = (g, e) => { if (e) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(e); } };
  for (const o of ORGANS) {
    const node = nodeIndex(ORGAN_NODE(o)), bits = ORGAN_BITS[o.id] || 0, mult = o.sided ? 2 : 1;
    if (o.type === 'e') {
      const r = enlarge(o.r);
      const ok = (p) => insideSkin(p) && (o.clipBelow === undefined || p[2] >= o.clipBelow)
        && (!o.aboveDiaphragm || p[2] > diaphragmZ(p[0], p[1])) && (!o.belowDiaphragm || p[2] < diaphragmZ(p[0], p[1]))
        && (!o.hollowCore || sdEllipsoid(p, o.c, o.hollowCore) > 0) && (!o.carve || !carveHit(p, o.carve));
      add(o.group, {
        weight: mult * Math.max(ellVol(r), PARAMS.minOrganVolume),
        sample(rnd) {
          // Sample the right-side volume (tests use the listed centre) and mirror for the left.
          const side = sideOf(rnd, o), p = tryPoint(rnd, () => inEll(rnd, o.c, r), ok);
          return { p: o.sided && side < 0 ? sided(p, -1) : p, o: { node, bits, side } };
        },
      });
    } else if (o.type === 'tube') {
      const T = tubeSampler(o.pts);
      add(o.group, {
        weight: mult * Math.max(T.volume, PARAMS.minOrganVolume),
        sample(rnd) { const side = sideOf(rnd, o), p = T.sample(rnd); return { p: side < 0 && o.sided ? sided(p, -1) : p, o: { node, bits, side } }; },
      });
    } else if (o.type === 'shell') {
      const area = 4 * Math.PI * Math.cbrt(o.r[0] * o.r[1] * o.r[2]) ** 2;
      add(o.group, { weight: area * o.wall, sample(rnd) { return { p: onEllShell(rnd, o.c, o.r, o.wall), o: { node, bits, side: 0 } }; } });
    }
  }
  for (const g of ['intestines', 'stomach', 'pelvic', 'other']) add(g, gutWallEntry(g));
  {   // gastric fundus dome (§2.9) as a wall shell
    const F = GUT.fundus, node = nodeIndex('gut.fundus'), path = pathById('gut');
    const uF = (GUT.landmarks.cardia ?? 0) / GUT.totalDraw;
    add('stomach', { weight: 4 * Math.PI * F.r * F.r * PARAMS.hollowWall, sample(rnd) {
      return { p: onEllShell(rnd, F.c, [F.r, F.r, F.r], PARAMS.hollowWall), o: { node, side: 0, path: path.index, u: uF } };
    } });
  }
  // Sense organs (§2.3; §13.2 eye clusters: an iris ring around a dark pupil disc)
  const S = PARAMS.senseShares, E = HEAD.eye, A = HEAD.cornealApex;
  const sense = (key, node, gen) => add('sense', { weight: S[key], sample(rnd) { const side = rnd.u() < 0.5 ? 1 : -1; return { p: sided(gen(rnd), side), o: { node: nodeIndex(node), side } }; } });
  sense('iris', 'iris', (rnd) => {
    const a = 2 * Math.PI * rnd.u(), i = HEAD.iris.inner, o = HEAD.iris.outer;
    const rho = Math.sqrt(i * i + (o * o - i * i) * rnd.u());
    return [A[0] + rho * Math.cos(a), A[1] - 3, A[2] + rho * Math.sin(a)];
  });
  sense('eye', 'eye', (rnd) => tryPoint(rnd, () => onEllShell(rnd, E.c, [E.r, E.r, E.r], 1), (p) => p[1] < E.c[1] + 8));
  sense('retina', 'retina', (rnd) => tryPoint(rnd, () => onEllShell(rnd, E.c, [HEAD.retinaR, HEAD.retinaR, HEAD.retinaR], 0.8), (p) => p[1] < E.c[1] - 2));
  sense('cochlea', 'cochlea', (rnd) => inEll(rnd, HEAD.cochlea.c, enlarge([HEAD.cochlea.r, HEAD.cochlea.r, HEAD.cochlea.r])));
  sense('vestLabyrinth', 'vestLabyrinth', (rnd) => inEll(rnd, HEAD.vestLabyrinth.c, [HEAD.vestLabyrinth.r, HEAD.vestLabyrinth.r, HEAD.vestLabyrinth.r]));
  sense('olfEpith', 'olfEpith', (rnd) => inEll(rnd, HEAD.olfEpith.c, enlarge(HEAD.olfEpith.r)));
  sense('tongue', 'tongue', (rnd) => hazeEll(rnd, HEAD.tongue.c, HEAD.tongue.r));
  sense('tonguePatch', 'tongueAnt', (rnd) => inEll(rnd, HEAD.tongueAnt, [HEAD.tonguePatchR, HEAD.tonguePatchR, HEAD.tonguePatchR * 0.4]));
  sense('tonguePatch', 'tonguePost', (rnd) => inEll(rnd, HEAD.tonguePost, [HEAD.tonguePatchR, HEAD.tonguePatchR, HEAD.tonguePatchR * 0.4]));
  return groups;
}
function* genOrgans(w, count, rnd, ctx) {
  const groups = organEntries();
  const names = Object.keys(ORGAN_SHARES).filter((g) => groups.has(g) || g === 'intestines' || g === 'stomach');
  const shares = names.map((g) => (groups.has(g) ? ORGAN_SHARES[g] : 0));
  const counts = apportion(count, shares);
  for (let i = 0; i < names.length; i++) {
    yield* fill(w, rnd, ctx, `organ ${names[i]}`, counts[i], groups.get(names[i]) || [], { flux: PARAMS.flux.organ, tissue: TISSUE.organ, lod: 0 });
  }
}

// ---------------------------------------------------------------------------------------------
// Muscles at rest (§2.13 centres; §13.3 haze) and the faint skeleton (§13.3)
// ---------------------------------------------------------------------------------------------
function* genMuscles(w, count, rnd, ctx) {
  const entries = MUSCLES.map((m) => {
    const node = nodeIndex(m.id), mid = !!m.mid;
    const side = (rnd2) => (mid ? 0 : rnd2.u() < 0.5 ? 1 : -1);
    let gen, weight;
    if (m.tube) {
      const T = tubeSampler([[...m.tube[0], m.width / 2], [...m.tube[1], m.width / 2]]);
      gen = (r) => T.sample(r); weight = T.volume ** (2 / 3);
    } else if (m.ring) {
      gen = (r) => { const a = 2 * Math.PI * r.u(), [u, v] = r.disk(); return [m.c[0] + (m.ring + 4 * u) * Math.cos(a), m.c[1] + 4 * v, m.c[2] + (m.ring + 4 * u) * Math.sin(a)]; };
      weight = (2 * Math.PI * m.ring * 50) ** (2 / 3);
    } else { gen = (r) => hazeEll(r, m.c, m.r); weight = ellVol(m.r) ** (2 / 3); }
    return {
      weight: weight * (mid ? 1 : 2),
      sample(r) {
        const s = side(r), p = tryPoint(r, () => gen(r), insideSkin);   // right side (mirror-symmetric field)
        return { p: s < 0 ? sided(p, -1) : p, o: { node, side: s } };
      },
    };
  });
  yield* fill(w, rnd, ctx, 'muscle', count, entries, { flux: PARAMS.flux.muscle, tissue: TISSUE.muscle, bits: 0, lod: 0 });
}

function* genBone(w, count, rnd, ctx) {
  const [nV, nP, nR] = apportion(count, [PARAMS.boneSplit.vertebrae, PARAMS.boneSplit.pelvis, PARAMS.boneSplit.ribs]);
  const base = { flux: PARAMS.flux.bone, tissue: TISSUE.bone, bits: 0, lod: 0 };
  const verts = VERTEBRAE.map((v) => ({
    weight: v.half[0] * v.half[1] + v.half[1] * v.half[2] + v.half[0] * v.half[2],
    sample(r) { const p = [v.c[0] + (r.u() * 2 - 1) * v.half[0], v.c[1] + (r.u() * 2 - 1) * v.half[1], v.c[2] + (r.u() * 2 - 1) * v.half[2]]; return { p, o: { node: nodeIndex(v.id), side: 0 } }; },
  }));
  yield* fill(w, rnd, ctx, 'bone', nV, verts, base);
  const rim = PARAMS.pelvicRim, rimCum = [0];
  for (let i = 1; i < rim.length; i++) rimCum.push(rimCum[i - 1] + len3(...sub(rim[i], rim[i - 1])));
  const pelvis = [{ weight: 1, sample(r) {
    const s = r.u() * rimCum[rimCum.length - 1];
    let i = 0;
    while (i < rim.length - 2 && rimCum[i + 1] < s) i++;
    const c = lerp3(rim[i], rim[i + 1], (s - rimCum[i]) / (rimCum[i + 1] - rimCum[i]));
    const side = r.u() < 0.5 ? 1 : -1, q = [c[0] + r.gauss() * 3, c[1] + r.gauss() * 3, c[2] + r.gauss() * 3];
    return { p: sided(q, side), o: { node: nodeIndex('pelvis'), side } };
  } }];
  yield* fill(w, rnd, ctx, 'bone', nP, pelvis, base);
  const ribs = [];
  for (let i = 1; i <= 11; i++) for (const sfx of ['.R', '.L']) {
    const path = pathById(`intercostal.T${i}${sfx}`);
    if (!path) continue;
    const ext = PARAMS.ribExtent[i - 1];
    ribs.push({ weight: pathSamples(path).arcLen * ext, sample(r) {
      const q = pathPoint(path, ext * r.u()).p;
      return { p: [q[0] + r.gauss() * 2, q[1] + r.gauss() * 2, q[2] + PARAMS.ribOffset + r.gauss() * 2], o: { node: nodeIndex(`rib.T${i}`), side: path.side } };
    } });
  }
  yield* fill(w, rnd, ctx, 'bone', nR, ribs, base);
}

// ---------------------------------------------------------------------------------------------
// Spinal cord, DRG and roots (§13.3; §2.5 geometry)
// ---------------------------------------------------------------------------------------------
const CORD_PATH = () => pathById('cord');
function cordSegAtArc(s) {
  let best = CORD_SEGMENTS[0], bd = Infinity;
  for (const c of CORD_SEGMENTS) { const d = Math.abs(c.arc - s); if (d < bd) { bd = d; best = c; } }
  return best;
}
const isGrey = (xi, eta) => (Math.abs(xi) < 0.12 && Math.abs(eta) < 0.35) || ((Math.abs(xi) - 0.32) ** 2 / 0.18 ** 2 + eta * eta / 0.75 ** 2 < 1); // [model] butterfly
function* genCord(w, count, rnd, ctx) {
  const S = PARAMS.cordSplit, [nC, nD, nR] = apportion(count, [S.cord, S.drg, S.roots]);
  const cp = CORD_PATH(), s0 = canalAt(FRAME.brainstemEnd[2]).arc, s1 = CORD_ARC_CONUS;
  let maxA = 0;
  for (let s = s0; s <= s1; s += 2) { const r = cordRadiiAtArc(s); maxA = Math.max(maxA, r[0] * r[1]); }
  for (let k = 0; k < nC; k++) {
    let s, rr;
    for (let t = 0; t < PARAMS.maxTries; t++) { s = r0(rnd, s0, s1); rr = cordRadiiAtArc(s); if (rnd.u() * maxA <= rr[0] * rr[1]) break; }
    const c = canalAtArc(s), [xi, eta] = rnd.disk();
    const Y = [0, -c.t[2], c.t[1]];                       // anterior, ⟂ to the caudal tangent (η + anterior, A.2)
    const p = [xi * rr[0], c.y + Y[1] * eta * rr[1], c.z + Y[2] * eta * rr[1]];
    const grey = isGrey(xi, eta);
    w.put(p, rnd, { flux: grey ? PARAMS.flux.cordGrey : PARAMS.flux.cordWhite, node: nodeIndex(cordSegAtArc(s).id), path: cp.index,
      u: clamp(s / s1), tissue: TISSUE.cord, bits: eta < 0 ? NET.SA : NET.SE, lod: 0, side: Math.abs(xi) < 0.05 ? 0 : Math.sign(xi) });
    if ((k & 63) === 0 && ctx.due()) yield ctx.progress('cord', k / nC);
  }
  const drgs = [];
  for (const seg of SEGMENTS) for (const side of [1, -1]) {
    const c = drg(seg, side), node = nodeIndex(`drg.${seg}`), root = pathById(`root.${seg}${side > 0 ? '.R' : '.L'}`);
    drgs.push({ weight: 1, sample(r) { return { p: hazeEll(r, c, [GEO.minGanglionRadius, GEO.minGanglionRadius, GEO.minGanglionRadius + 1], 0.5), o: { node, side, path: root ? root.index : -1, u: 1, bits: NET.SA } }; } });
  }
  yield* fill(w, rnd, ctx, 'drg', nD, drgs, { flux: PARAMS.flux.ganglion, tissue: TISSUE.cord, lod: 0 });
  const roots = PATHS.filter((p) => p.kind === 'root' || p.nerve === 'filum').map((p) => {
    const seg = p.root, node = nodeIndex(p.nerve === 'filum' ? 'filum' : p.nerve === 'root' ? `drg.${seg}` : `cord.${seg}`);
    return { weight: pathSamples(p).arcLen, sample(r) {
      const u = r.u(), q = pathPoint(p, u).p;
      return { p: [q[0] + r.gauss() * 0.6, q[1] + r.gauss() * 0.6, q[2] + r.gauss() * 0.6], o: { node, side: p.side, path: p.index, u, bits: p.bits, lod: p.lod } };
    } };
  });
  yield* fill(w, rnd, ctx, 'roots', nR, roots, { flux: PARAMS.flux.nerve, tissue: TISSUE.cord });
}
const r0 = (rnd, a, b) => a + (b - a) * rnd.u();

// ---------------------------------------------------------------------------------------------
// Nerve streams (§13.3): jittered streamlines along the drawn §2.12 splines, one fibre class each
// ---------------------------------------------------------------------------------------------
function pickBit(rnd, mix) {
  const keys = Object.keys(mix), ws = keys.map((k) => mix[k]);
  let x = rnd.u() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) { x -= ws[i]; if (x <= 0) return +keys[i]; }
  return +keys[keys.length - 1];
}
function streamEntries(paths, rnd) {
  const P = PARAMS;
  return paths.map((path) => {
    const width = Math.max(P.minNerveWidth, path.width || 0);
    const nLines = Math.round(clamp(P.streamlines[0] + (P.streamlines[1] - P.streamlines[0]) * (width - P.minNerveWidth) / 15, P.streamlines[0], P.streamlines[1]));
    const sigma = clamp(width / 2, P.streamSigma[0], P.streamSigma[1]);
    const lines = [];
    for (let i = 0; i < nLines; i++) {   // streamline offsets, wander and fibre class (fixed per streamline)
      lines.push({ a: rnd.gauss() * sigma, b: rnd.gauss() * sigma, f1: 1 + 2 * rnd.u(), f2: 1 + 2 * rnd.u(), p1: rnd.u(), p2: rnd.u(), bit: pickBit(rnd, path.mix) });
    }
    const node = nodeIndex(path.nerve);
    return {
      path, weight: pathSamples(path).arcLen * (P.densityFloor + Math.log10(1 + width)),
      sample(r) {
        const L = lines[r.int(lines.length)], u = r.u(), q = pathPoint(path, u);
        const wob = P.streamWobble * sigma, jit = P.pointJitter * sigma;
        const a = L.a + wob * Math.sin(2 * Math.PI * (L.f1 * u + L.p1)) + jit * r.gauss();
        const b = L.b + wob * Math.sin(2 * Math.PI * (L.f2 * u + L.p2)) + jit * r.gauss();
        const p = [q.p[0] + q.N[0] * a + q.B[0] * b, q.p[1] + q.N[1] * a + q.B[1] * b, q.p[2] + q.N[2] * a + q.B[2] * b];
        return { p, o: { node, path: path.index, u, bits: L.bit, lod: path.lod, side: path.side } };
      },
    };
  });
}
function* genNerves(w, count, rnd, ctx) {
  const paths = PATHS.filter((p) => p.cls === TISSUE.nerve && p.lod <= ctx.maxLod && !(ctx.skipIntercostal && /^intercostal\.T(2|4|6|8|10)$/.test(p.nerve)));
  yield* fill(w, rnd, ctx, 'nerve', count, streamEntries(paths, rnd), { flux: PARAMS.flux.nerve, tissue: TISSUE.nerve });
}
function* genAutonomic(w, count, rnd, ctx) {
  const [nG, nS] = apportion(count, [PARAMS.autonomicSplit.ganglia, PARAMS.autonomicSplit.streams]);
  const gangs = [];
  for (const g of GANGLIA) for (const side of g.mid ? [0] : [1, -1]) {
    const r = g.r.map((v) => Math.max(v, GEO.minGanglionRadius)), c = side < 0 ? sided(g.c, -1) : g.c, node = nodeIndex(g.id);
    gangs.push({ weight: ellVol(r) ** (2 / 3), sample(rr) { return { p: hazeEll(rr, c, r, 0.5), o: { node, side, bits: g.bits } }; } });
  }
  yield* fill(w, rnd, ctx, 'ganglia', nG, gangs, { flux: PARAMS.flux.ganglion, tissue: TISSUE.ganglion, lod: 0 });
  const paths = PATHS.filter((p) => p.cls === TISSUE.ganglion && p.lod <= ctx.maxLod);
  yield* fill(w, rnd, ctx, 'autonomic', nS, streamEntries(paths, rnd), { flux: PARAMS.flux.nerve, tissue: TISSUE.ganglion });
}

// ---------------------------------------------------------------------------------------------
// Enteric mesh (§13.3): myenteric (0.9 r) and submucosal (0.7 r) shells, polygonal ganglion mesh
// ---------------------------------------------------------------------------------------------
function* genEnteric(w, count, rnd, ctx) {
  const E = PARAMS.ens, T = gutTable(), path = pathById('gut');
  const sPyl = sToDraw(E.pylorusS) * 10;
  const nIcc = ctx.icc ? Math.round(count * E.iccShare) : 0, nMesh = count - nIcc;
  const cdf = cumulative(T.rows.map((r) => r.r));
  const base = { tissue: TISSUE.enteric, bits: NET.EN, side: 0, path: path.index };
  const node = (i, j, m, piece) => [E.spacing * (i + 0.6 * (ihash(piece, i, j) - 0.5)), 2 * Math.PI * (j + 0.6 * (ihash(piece + 7, i, j) - 0.5)) / m];
  for (let k = 0; k < nMesh; k++) {
    let row, s, frac;
    for (let t = 0; t < PARAMS.maxTries; t++) {
      row = T.rows[rnd.pick(cdf)];
      s = clamp(row.s + (rnd.u() - 0.5) * T.step, row.s0, row.s1);
      frac = rnd.u() < E.myentericShare ? E.myenteric : E.submucosal;
      if (frac === E.submucosal && s < sPyl && rnd.u() > E.aboveCardiaSparse) continue;   // sparse above the pylorus (§8)
      break;
    }
    const R = frac * row.r, m = Math.max(4, Math.round(2 * Math.PI * R / E.spacing));
    const i = Math.round(s / E.spacing), j = ((Math.round(rnd.u() * m)) % m + m) % m;
    const [sN, thN] = node(i, j, m, row.piece);
    let s2, th2;
    if (rnd.u() < E.gangliaShare) { s2 = sN + rnd.gauss() * E.ganglionSigma; th2 = thN + rnd.gauss() * E.ganglionSigma / R; }
    else {
      const [sM, thM0] = rnd.u() < 0.5 ? node(i + 1, j, m, row.piece) : node(i, (j + 1) % m, m, row.piece);
      let thM = thM0;
      while (thM - thN > Math.PI) thM -= 2 * Math.PI;
      while (thM - thN < -Math.PI) thM += 2 * Math.PI;
      const t = rnd.u();
      s2 = sN + (sM - sN) * t + rnd.gauss() * E.strandSigma; th2 = thN + (thM - thN) * t + rnd.gauss() * E.strandSigma / R;
    }
    s2 = clamp(s2, row.s0, row.s1);
    const q = gutShellPoint(s2, th2, frac);
    w.put(q.p, rnd, { ...base, flux: PARAMS.flux.enteric, node: q.row.node, u: s2 / GUT.totalDraw, lod: 2 });
    if ((k & 63) === 0 && ctx.due()) yield ctx.progress('enteric', k / count);
  }
  for (let k = 0; k < nIcc; k++) {   // ICC dots between the shells (high and ultra only)
    const row = T.rows[rnd.pick(cdf)], s = clamp(row.s + (rnd.u() - 0.5) * T.step, row.s0, row.s1);
    const q = gutShellPoint(s, 2 * Math.PI * rnd.u(), E.icc);
    w.put(q.p, rnd, { ...base, flux: PARAMS.flux.icc, node: q.row.node, u: s / GUT.totalDraw, lod: 2 });
  }
}

// ---------------------------------------------------------------------------------------------
// Vascular and immune (§13.3 blood haze; §13.5 neuroendocrine haze and neuroimmune speckle)
// ---------------------------------------------------------------------------------------------
function* genVessels(w, count, rnd, ctx) {
  const V = PARAMS.vesselSplit, [nV, nH, nI] = apportion(count, [V.vessels, V.haze, V.immune]);
  const base = { flux: PARAMS.flux.vessel, tissue: TISSUE.vessel };
  const vpaths = PATHS.filter((p) => p.kind === 'vessel');
  const ves = vpaths.map((path) => {
    const n = path.radii.length, node = nodeIndex(path.nerve);
    const meanR = path.radii.reduce((a, b) => a + b, 0) / n;
    return { weight: pathSamples(path).arcLen * meanR, sample(r) {
      const u = r.u(), q = pathPoint(path, u), x = u * (n - 1), i = Math.min(n - 2, Math.floor(x));
      const rad = path.radii[i] + (path.radii[i + 1] - path.radii[i]) * (x - i);
      let a, b;
      do { a = r.gauss() * 0.6; b = r.gauss() * 0.6; } while (a * a + b * b > 1.69);
      const p = [q.p[0] + (q.N[0] * a + q.B[0] * b) * rad, q.p[1] + (q.N[1] * a + q.B[1] * b) * rad, q.p[2] + (q.N[2] * a + q.B[2] * b) * rad];
      return { p, o: { node, path: path.index, u, bits: NET.NE, lod: 0, side: path.side } };
    } };
  });
  yield* fill(w, rnd, ctx, 'vessels', nV, ves, base);
  const { min, max } = BODY_BOUNDS, blood = nodeIndex('blood');
  const haze = [{ weight: 1, sample(r) {
    const p = tryPoint(r, () => [r0(r, min[0], max[0]), r0(r, min[1], max[1]), r0(r, min[2], PARAMS.hazeTop)], (q) => bodySDF(q[0], q[1], q[2]) < -3);
    return { p, o: { node: blood, bits: NET.NE, lod: 1, side: 0 } };
  } }];
  yield* fill(w, rnd, ctx, 'haze', nH, haze, base);
  const spleen = ORGANS.find((o) => o.id === 'spleen'), T = gutTable();
  const ile = T.rows.filter((r) => r.region === 'gut.ileum'), ileCdf = cumulative(ile.map((r) => r.r)), gut = pathById('gut');
  const imm = [
    { weight: PARAMS.immuneSplit.spleen, sample(r) { return { p: hazeEll(r, spleen.c, spleen.r, 0.5), o: { node: nodeIndex('spleen'), bits: NET.NI, lod: 0, side: 0 } }; } },
    { weight: PARAMS.immuneSplit.ileum, sample(r) {
      const row = ile[r.pick(ileCdf)], s = clamp(row.s + (r.u() - 0.5) * T.step, row.s0, row.s1);
      const q = gutShellPoint(s, 2 * Math.PI * r.u(), 0.8 + 0.2 * r.u());
      return { p: q.p, o: { node: row.node, bits: NET.NI, lod: 1, side: 0, path: gut.index, u: s / GUT.totalDraw } };
    } },
  ];
  yield* fill(w, rnd, ctx, 'immune', nI, imm, base);
}

// ---------------------------------------------------------------------------------------------
// Budget resolution and the build
// ---------------------------------------------------------------------------------------------
// budget: a tier name ('low' … 'ultra'), an object of per-group counts, or a total (split by the
// high-tier proportions).
export function resolveBudget(budget = 'high') {
  if (typeof budget === 'string') {
    const b = PARAMS.budgets[budget];
    if (!b) throw new Error(`unknown body tier ${budget}`);
    return { tier: budget, groups: { ...b } };
  }
  if (typeof budget === 'number') {
    const ref = PARAMS.budgets.high, counts = apportion(Math.max(0, Math.round(budget)), BUDGET_GROUPS.map((g) => ref[g]));
    return { tier: null, groups: Object.fromEntries(BUDGET_GROUPS.map((g, i) => [g, counts[i]])) };
  }
  if (budget && typeof budget === 'object') {
    if (budget.body !== undefined) return resolveBudget(budget.body);   // a TIERS-like entry { name, body }
    if (budget.name && PARAMS.budgets[budget.name] && BUDGET_GROUPS.every((g) => budget[g] === undefined)) return resolveBudget(budget.name);
    return { tier: null, groups: Object.fromEntries(BUDGET_GROUPS.map((g) => [g, Math.max(0, Math.round(budget[g] || 0))])) };
  }
  throw new Error('generateBody: budget must be a tier name, a number or an object of group counts');
}
const GENERATORS = { skin: genSkin, organ: genOrgans, muscle: genMuscles, bone: genBone, cord: genCord, nerve: genNerves, ganglion: genAutonomic, enteric: genEnteric, vessel: genVessels };

function* build({ budget = 'high', lod = 2 } = {}, seed = 1848, sliceMs = Infinity) {
  const { tier, groups } = resolveBudget(budget);
  const total = BUDGET_GROUPS.reduce((a, g) => a + groups[g], 0);
  const isoTier = tier || (groups.skin >= PARAMS.budgets.high.skin ? 'high' : 'low');
  let t0 = now(), phase = '';
  const ctx = {
    maxLod: lod, isoGrid: PARAMS.isoGrid[isoTier],
    icc: tier ? tier === 'high' || tier === 'ultra' : groups.enteric >= PARAMS.budgets.high.enteric,   // §13.3 ICC on high and ultra only
    skipIntercostal: PARAMS.lowTierSkipIntercostals && (tier ? tier === 'low' : groups.nerve <= PARAMS.budgets.low.nerve),
    due: () => sliceMs !== Infinity && now() - t0 >= PARAMS.sliceHeadroom * sliceMs,
    progress: (label, f) => { phase = label; return { done: false, phase, progress: f, points: w.n, total }; },
  };
  const w = new Writer(total);
  const ranges = [];
  const resetSlice = () => { t0 = now(); };
  for (const [k, g] of BUDGET_GROUPS.entries()) {
    const start = w.n, rnd = new Rng(streamSeed(seed, k));
    const it = GENERATORS[g](w, groups[g], rnd, ctx);
    for (let r = it.next(); !r.done; r = it.next()) { yield r.value; resetSlice(); }
    const count = w.n - start;
    shuffleRange(w.buf, start, count, new Rng(streamSeed(seed, 100 + k)));
    ranges.push({ name: g, tissue: TISSUE[g], start, count, budget: groups[g] });
    if (ctx.due()) { yield ctx.progress(g, 1); resetSlice(); }
  }
  const points = w.n === total ? w.buf : w.buf.slice(0, w.n * FLOATS);
  const sites = SITES.map((s) => ({
    id: s.id, base: s.base, kind: s.kind, side: s.side, pos: [...s.pos], pickable: s.pickable, posteriorOnly: s.posteriorOnly,
    senses: [...s.senses], segment: s.segment, nerve: s.nerve, pathId: s.pathId, pathLen: s.pathLen,
    normal: s.kind === 'skin' ? bodyNormal(s.pos[0], s.pos[1], s.pos[2]) : null,
    node: s.kind === 'skin' ? nodeIndex(`skin.${skinRegion(s.pos[0], s.pos[1], s.pos[2])}`) : -1,
  }));
  return { points, count: w.n, floats: FLOATS, ranges, sites, hash: hashPoints(points), tier, seed, lod, budget: groups };
}

// One-shot generation: { points (Float32Array, FLOATS per point), count, ranges, sites, hash, … }.
export function generateBody(opts = {}, seed = 1848) {
  const it = build(opts, seed, Infinity);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

// Sliced generation for the lazy body build (§13.4; slice length owned by B.9, ≤ 8 ms): yields
// { done: false, phase, progress, points, total } between slices and finally { done: true, body },
// whose body equals generateBody(opts, seed) exactly. Also returns the body as the generator value.
export function* generateBodyChunks(opts = {}, seed = 1848, sliceMs = 8) {
  const it = build(opts, seed, sliceMs);
  for (;;) {
    const r = it.next();
    if (r.done) { yield { done: true, body: r.value }; return r.value; }
    yield r.value;
  }
}
