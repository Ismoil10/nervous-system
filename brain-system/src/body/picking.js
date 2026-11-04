// Body picking (research/ANALYSIS.md §13.12): a click, unprojected to a ray in mm of the body frame
// (A.2; camera.js `unproject`), is resolved to a stimulus site for the chosen sense.
//
//   skin senses (touch, pain, temperature): sphere-trace the §13.2 skin field (≤ 64 steps, stop at
//     0.5 mm), then snap the hit to the nearest valid site within 30 mm through a 10-mm hash grid;
//   proprioception: tendon and joint pick spheres of radius 25 mm;
//   interoception: the ray ignores the skin and hits the §2.8 organ and receptor volumes;
//   special senses: the hit volumes of the eyes, ears, nose, tongue and labyrinth (1.5 × drawn size).
//
// Content rules (A.1, §13.12): the S4–S5 perianal band, the perineal region and the pelvic-floor
// field are never returned, from any view; a skin hit inside them returns null rather than a
// neighbouring site. `dermatome.S3` is returned only while |yaw − π| < π/2 (posterior views).
// Brain-only mode disables body picking (A.5, A.6): pick() returns null.

import {
  SITES, NEVER_PICKABLE, BODY_BOUNDS, PELVIC_FLOOR, bodySDF, bodyNormal, inPerineum, sdEllipsoid,
} from './geometry.js';
import { dermatomeAt } from './frame.js';

export const PARAMS = {
  maxSteps: 64,          // §13.12 sphere tracing: ≤ 64 steps
  hitEps: 0.5,           // §13.12 stop at 0.5 mm
  stepScale: 0.95,       // [model] under-relaxed steps (the field is not an exact distance)
  boundsMargin: 10,      // [model] mm around BODY_BOUNDS where tracing starts
  cell: 10,              // §13.12 hash-grid cell (mm)
  snapRadius: 30,        // §13.12 skin snap radius; beyond it, "no valid site"
  jointRadius: 25,       // §13.12 joint and tendon pick spheres (mm)
  occlusionDepth: 80,    // [model] a volume or sphere hit counts only within this depth (mm) behind the skin hit
  posteriorHalfAngle: Math.PI / 2,   // §13.12 dermatome.S3 only while |yaw − π| < π/2
};

const SKIN_SENSES = new Set(['touch', 'pain', 'temperature']);
const VOLUME_SENSES = new Set(['vision', 'hearing', 'smell', 'taste', 'balance']);

const wrapPi = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
export const isPosteriorView = (yaw) => Number.isFinite(yaw) && Math.abs(wrapPi(yaw - Math.PI)) < PARAMS.posteriorHalfAngle;

// Never pickable from any view (A.1): listed ids, the perineal region and the pelvic-floor field.
function excludedSite(site) {
  return !site.pickable || NEVER_PICKABLE.has(site.base) || inPerineum(site.pos)
    || sdEllipsoid(site.pos, PELVIC_FLOOR.c, PELVIC_FLOOR.r) < 0;
}
function siteAllowed(site, sense, yaw, filter) {
  if (excludedSite(site)) return false;
  if (site.posteriorOnly && !isPosteriorView(yaw)) return false;
  if (sense && !site.senses.includes(sense)) return false;
  if (filter && !filter(site)) return false;
  return true;
}
function siteFilter(sites) {
  if (!sites) return null;
  if (typeof sites === 'string') return (s) => s.kind === sites;
  const set = new Set(sites);
  return (s) => set.has(s.base) || set.has(s.id);
}

// ---------------------------------------------------------------------------------------------
// Ray helpers
// ---------------------------------------------------------------------------------------------
function normRay(ray) {
  const o = ray.origin || ray.o, d0 = ray.dir || ray.d;
  const l = Math.hypot(d0[0], d0[1], d0[2]) || 1;
  return { o, d: [d0[0] / l, d0[1] / l, d0[2] / l] };
}
const at = (r, t) => [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t];
// Slab test against the body bounds: [tEnter, tExit] or null.
function boxSpan(r) {
  let t0 = 0, t1 = Infinity;
  const m = PARAMS.boundsMargin;
  for (let k = 0; k < 3; k++) {
    const lo = BODY_BOUNDS.min[k] - m, hi = BODY_BOUNDS.max[k] + m;
    if (Math.abs(r.d[k]) < 1e-12) { if (r.o[k] < lo || r.o[k] > hi) return null; continue; }
    let a = (lo - r.o[k]) / r.d[k], b = (hi - r.o[k]) / r.d[k];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
// Sphere trace of the skin field: { t, p } or null.
export function traceSkin(ray) {
  const r = ray.d && ray.o ? ray : normRay(ray);
  const span = boxSpan(r);
  if (!span) return null;
  let t = span[0];
  for (let i = 0; i < PARAMS.maxSteps && t <= span[1]; i++) {
    const p = at(r, t), d = bodySDF(p[0], p[1], p[2]);
    if (d < PARAMS.hitEps) return d < -PARAMS.hitEps && i === 0 ? null : { t, p };   // starting inside the body: no pick
    t += d * PARAMS.stepScale;
  }
  return null;
}
// Ray–ellipsoid entry: { t, p, n } or null (origin inside: t = 0).
function rayEllipsoid(r, c, rad) {
  const ox = (r.o[0] - c[0]) / rad[0], oy = (r.o[1] - c[1]) / rad[1], oz = (r.o[2] - c[2]) / rad[2];
  const dx = r.d[0] / rad[0], dy = r.d[1] / rad[1], dz = r.d[2] / rad[2];
  const A = dx * dx + dy * dy + dz * dz, B = ox * dx + oy * dy + oz * dz, C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - A * C;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t0 = (-B - s) / A, t1 = (-B + s) / A;
  if (t1 < 0) return null;
  const t = Math.max(0, t0), p = at(r, t);
  const g = [(p[0] - c[0]) / (rad[0] * rad[0]), (p[1] - c[1]) / (rad[1] * rad[1]), (p[2] - c[2]) / (rad[2] * rad[2])];
  const l = Math.hypot(g[0], g[1], g[2]) || 1;
  return { t, p, n: [g[0] / l, g[1] / l, g[2] / l] };
}

// ---------------------------------------------------------------------------------------------
// Hash grid of the skin sites (10-mm cells)
// ---------------------------------------------------------------------------------------------
let GRID = null;
const cellKey = (i, j, k) => `${i},${j},${k}`;
function skinGrid() {
  if (GRID) return GRID;
  GRID = new Map();
  for (const s of SITES) {
    if (s.kind !== 'skin') continue;
    const key = cellKey(...s.pos.map((v) => Math.floor(v / PARAMS.cell)));
    if (!GRID.has(key)) GRID.set(key, []);
    GRID.get(key).push(s);
  }
  return GRID;
}
function nearestSkinSite(p, ok) {
  const G = skinGrid(), c = PARAMS.cell, R = Math.ceil(PARAMS.snapRadius / c);
  const ci = Math.floor(p[0] / c), cj = Math.floor(p[1] / c), ck = Math.floor(p[2] / c);
  let best = null, bd = PARAMS.snapRadius;
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) {
    const list = G.get(cellKey(ci + i, cj + j, ck + k));
    if (!list) continue;
    for (const s of list) {
      const d = Math.hypot(s.pos[0] - p[0], s.pos[1] - p[1], s.pos[2] - p[2]);
      if (d <= bd && ok(s)) { bd = d; best = s; }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// pick(ray, { sense, bodyMode, yaw, sites }) → { site, point, normal } or null
//   ray: { origin, dir } in mm (camera.js unproject); sense: an A.6 sense id ('touch', 'pain',
//   'temperature', 'proprioception', 'interoception', 'vision', 'hearing', 'smell', 'taste',
//   'balance') or null for any; yaw: camera yaw (rad; π = posterior, §13.11); sites: optional
//   narrowing to a site kind ('joint', 'tendon', 'skin') or a list of site ids (per stimulus mode).
// ---------------------------------------------------------------------------------------------
export function pick(ray, { sense = null, bodyMode = 'body', yaw = 0, sites = null } = {}) {
  if (bodyMode === 'brain') return null;
  const sid = sense && typeof sense === 'object' ? sense.id : sense;
  const r = normRay(ray), filter = siteFilter(sites);
  const ok = (s) => siteAllowed(s, sid, yaw, filter);
  const skin = traceSkin(r);
  const tSkin = skin ? skin.t : Infinity;
  const candidates = [];

  if (!sid || SKIN_SENSES.has(sid)) {
    if (skin) {
      const p = skin.p, der = dermatomeAt(p);
      const forbidden = inPerineum(p) || (der && der.pickable === false) || sdEllipsoid(p, PELVIC_FLOOR.c, PELVIC_FLOOR.r) < 0;
      if (forbidden) {
        if (sid) return null;   // a click on an excluded region never resolves to a neighbouring site
      } else {
        const s = nearestSkinSite(p, (q) => ok(q) && q.senses.some((x) => SKIN_SENSES.has(x)));
        if (s) candidates.push({ t: skin.t, site: s, point: p, normal: bodyNormal(p[0], p[1], p[2]) });
      }
    }
  }
  if (!sid || sid === 'proprioception') {
    for (const s of SITES) {
      if ((s.kind !== 'joint' && s.kind !== 'tendon') || !ok(s)) continue;
      const R = PARAMS.jointRadius, h = rayEllipsoid(r, s.pos, [R, R, R]);
      if (h && h.t <= tSkin + PARAMS.occlusionDepth) candidates.push({ t: h.t, site: s, point: h.p, normal: h.n });
    }
  }
  if (!sid || sid === 'interoception') {   // the ray ignores the skin (§13.12)
    for (const s of SITES) {
      if (s.kind !== 'organ' || !s.pick || !ok(s)) continue;
      const h = rayEllipsoid(r, s.pick.c, s.pick.r);
      if (h) candidates.push({ t: h.t, site: s, point: h.p, normal: h.n, deep: true });
    }
  }
  if (!sid || VOLUME_SENSES.has(sid)) {
    for (const s of SITES) {
      if (s.kind !== 'special' || !s.pick || !ok(s)) continue;
      const h = rayEllipsoid(r, s.pick.c, s.pick.r);
      if (h && h.t <= tSkin + PARAMS.occlusionDepth) candidates.push({ t: h.t, site: s, point: h.p, normal: h.n });
    }
  }
  if (!candidates.length) return null;
  // With no sense given, surface hits win over the skin-ignoring interoceptive volumes.
  candidates.sort((a, b) => (!sid && a.deep !== b.deep ? (a.deep ? 1 : -1) : a.t - b.t));
  const c = candidates[0];
  return { site: c.site, point: c.point, normal: c.normal };
}

// Sites a sense may select from this view (hover highlight, keyboard list; §13.12).
export function validSitesFor(sense, { yaw = 0, bodyMode = 'body', sites = null } = {}) {
  if (bodyMode === 'brain') return [];
  const filter = siteFilter(sites);
  return SITES.filter((s) => siteAllowed(s, sense, yaw, filter));
}
