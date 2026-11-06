// @ts-check
// Airway tree (research/LUNGS.md §2.2, §2.3, §7.1, §12): the conducting airways from the trachea to
// the terminal bronchioles, the five lobes with their fissures, the 18 bronchopulmonary segments
// (Boyden) and one acinus (or group of acini) at every terminal branch. Body frame, mm: x+ = the
// subject's right, y+ = anterior, z+ = up.
//
// - Large airways at their anatomical positions (§2.2): trachea, carina, the short steep wide right
//   main bronchus and the long oblique left one, the eparterial right upper lobe bronchus, the
//   bronchus intermedius, the middle and lower lobe bronchi, the left upper and lower lobe bronchi
//   with the upper division and the lingula, then the 18 segmental bronchi aimed into their segments.
// - Below segmental level a space-filling tree in the manner of Tawhai, Pullan & Hunter (2000) and
//   Kitaoka, Takaki & Suki (1999): each branch owns a cloud of seed points spread uniformly through
//   its segment; the cloud is split by a plane through the branch axis (turned ≈ 90° from the
//   parent's branching plane), and each child grows from the parent's tip, in the plane of the parent
//   axis and its half's centre of mass, 40 % of the way to that centre, at Murray's optimal angle for
//   its share of the flow (≤ 60°). After each generation the seeds of a segment go to the nearest
//   growing tip (Tawhai), which makes the tree asymmetric. A cloud of one seed, or a branch shorter
//   than the minimum length, ends the path; each seed is one leaf (an acinus or a group of acini).
//   Branches stay in their lobe (they never cross a fissure), in the lung region and clear of the
//   hilar vessels of heart-form.js.
// - Diameters by Murray's law from the leaves upward (d³ of a parent = the sum over its children),
//   scaled so a terminal bronchiole serving one acinus is 0.6 mm (Weibel z 16); the trachea, the main
//   bronchi, the bronchus intermedius, the lobar bronchi and the intralobar trunks are pinned to
//   measured calibres.
//
// Plain data, deterministic per options (seeded) and memoised; no heavy imports beyond the body
// geometry, so the star generator, the renderer and the tests can all share it.

import { mulberry32 } from '../anatomy.js';
import { ORGANS, PARAMS, bodySDF, diaphragmZ, sdEllipsoid } from './geometry.js';
import { HEART_FORM } from './heart-form.js';

/**
 * @typedef {[number, number, number]} V3
 * @typedef {{ id: string, name: string, side: number }} Lobe
 * @typedef {{ id: string, b: string, name: string, lobe: number, side: number, anchor: V3 }} Segment
 * Branch: a straight tube a → b (mm) of lumen radius r (mm); gen 0 = trachea; lobe and segment
 * index LOBES / SEGMENTS (−1 above lobar / segmental level); side 1 right, −1 left, 0 trachea;
 * vol0 / vol1 cumulative lumen volume (mL) from the mouth to a / b, the upper airway included;
 * leaves = seeds (acini or groups of acini) downstream; children = child ids; len = |b − a|.
 * @typedef {{ id: number, parent: number, gen: number, a: V3, b: V3, r: number, lobe: number,
 *   segment: number, side: number, name: string, vol0: number, vol1: number, leaves: number,
 *   children: number[], len: number }} Branch
 * @typedef {{ c: V3, r: number, branch: number, lobe: number, segment: number }} Acinus
 * @typedef {{ p: V3, lobe: number, seg: number }} Seed
 * @typedef {{ perGen: number[], terminalPerGen: number[], maxPathGen: number, minPathGen: number,
 *   meanPathGen: number, conductingVolume: number, upperDeadSpace: number, branches: number,
 *   leaves: number, acini: number, seedSpacing: number, fallbacks: number, meanAngle: number,
 *   meanPlaneTurn: number, ms: { seeds: number, named: number, grow: number, murray: number, total: number } }} Stats
 * @typedef {{ branches: Branch[], acini: Acinus[], stats: Stats }} AirwayTree
 */

// ---------------------------------------------------------------------------------------------
// Parameters (each cites its source; [model] = design choice of this project)
// ---------------------------------------------------------------------------------------------
export const AIRWAY = {
  seed: 1963,                 // [model] default seed (any integer)
  leaves: 14000,              // [model] target leaves over both lungs (mean path generation ≈ 14.5, range ≈ 7–21)
  aciniTotal: 30000,          // §2.2 ≈ 30,000 acini (Haefeli-Bleuer & Weibel 1988)
  dTerminal: 0.6,             // §2.2 terminal bronchiole diameter (mm), Weibel z 16
  upperDeadSpace: 50,         // [model] mL from the mouth to the top of the trachea (≈ 1/3 of Fowler's 150 mL)
  grow: 0.4,                  // Tawhai et al. 2000: a child grows 40 % of the way to its cloud's centre of mass
  maxAngle: 60,               // [model] largest angle (°) between a child and its parent
  murrayAngle: 1,             // [model] share of Murray's optimal branching angle for the flow split (Kitaoka 1999) against the aim at the centre of mass
  minLength: 0.6,             // [model] mm: a shorter branch is terminal
  planeBias: 10,              // [model] weight towards turning the branching plane 90° per generation (Kitaoka 1999)
  reassign: true,             // Tawhai et al. 2000: seeds go to the nearest growing tip after each generation
  fissureClear: 1.5,          // [model] mm: seeds keep this far from a fissure (the drawn gap is ≈ 2 mm, §7.1)
  skinGap: 4,                 // [model] mm: the lungs stay this far inside the skin
  vesselGap: 1,               // [model] mm of clearance between an airway wall and the hilar vessels of heart-form.js
  acinusR: 3.25,              // [model] mm: drawn acinus radius (an acinus is ≈ 6–7 mm across, §2.2)
  // Large airways (§2.2). The carina sits at T4–T5, just below the aortic arch (geometry.js ORGANS).
  tracheaTop: /** @type {V3} */ ([0, 22, -171]),   // just below the larynx (0, 30, −158.5) r (15, 12, 13.5)
  carina: /** @type {V3} */ ([0, -14, -274]),
  mainR: { length: 24, tilt: 25, back: 30 },        // right main bronchus: mm, ° from vertical, ° of azimuth posterior
  mainL: { length: 50, tilt: 45, back: 6 },        // left main bronchus
  hilumR: /** @type {V3} */ ([25, -20, -319]),      // end of the bronchus intermedius: the right lobar bronchi part here
  // Pinned lumen diameters (mm): Weibel 1963 (trachea 18, main 12.2, lobar 8.3); right main wider.
  pinFloor: 1.08,             // [model] a pinned airway is at least 8 % wider than its widest child (Weibel: ≈ 0.68–0.8 per generation)
  pins: { trachea: 18, RMB: 12.6, LMB: 11.6, BI: 10.4, RUL: 8.6, RML: 6.8, RLL: 8.8, LUL: 9.0, LLL: 8.6,
    LUD: 7.6, LING: 6.6, RBAS: 8.2, LBAS: 8.0 },
};

// ---------------------------------------------------------------------------------------------
// Lobes, fissures and segments (§2.3)
// ---------------------------------------------------------------------------------------------
/** @type {Lobe[]} */
export const LOBES = [
  { id: 'RUL', name: 'Right upper lobe', side: 1 },
  { id: 'RML', name: 'Right middle lobe', side: 1 },
  { id: 'RLL', name: 'Right lower lobe', side: 1 },
  { id: 'LUL', name: 'Left upper lobe', side: -1 },
  { id: 'LLL', name: 'Left lower lobe', side: -1 },
];
export const LOBE = { RUL: 0, RML: 1, RLL: 2, LUL: 3, LLL: 4 };

// Fissure surfaces [model, shaped to Gray's surface markings, §2.3, and fitted to the lobe shares].
// The oblique fissure on each side is the height field
//   z = zBack + slope·(y − yBack) + curve·(y − yBack)(y − yFront) + kx·(|x| − x0),
// from the T4–T5 level behind (z ≈ −268 at y −95) down and forward to the 6th costal cartilage in
// front (y 45), where it reaches the anterior diaphragm; it is a little steeper in front than behind
// and passes through the hilum. Points above it are in the upper (and, on the right, middle) lobe.
// The right horizontal fissure is the plane z = zH in front of the oblique fissure, at the 4th costal
// cartilage of this lung's height (the anterior lung runs from z ≈ −200 to −390; zH also gives the
// middle lobe its ≈ 9 %). The fissures are open at the hilum (`hilumR`, `hilumL`), where the lobes
// meet round the bronchi and vessels.
export const FISSURES = {
  obliqueR: { yBack: -95, zBack: -268, yFront: 45, slope: -0.943, curve: -0.006, kx: 0.2, x0: 70 },
  obliqueL: { yBack: -95, zBack: -265, yFront: 45, slope: -0.893, curve: -0.003, kx: -0.1, x0: 80 },
  horizontal: { zH: -304 },
  hilumR: { c: /** @type {V3} */ ([25, -20, -318]), r: 16 },
  hilumL: { c: /** @type {V3} */ ([-38, -20, -312]), r: 16 },
};

// Bronchopulmonary segments (Boyden): B-number, name and lobe. `anchor` is a point in the middle of
// the segment [model]; a point of a lobe belongs to the segment with the nearest anchor.
/** @type {Segment[]} */
export const SEGMENTS = [
  { id: 'RB1', b: 'B1', name: 'Apical', lobe: 0, side: 1, anchor: [70, -15, -228] },
  { id: 'RB2', b: 'B2', name: 'Posterior', lobe: 0, side: 1, anchor: [96, -48, -264] },
  { id: 'RB3', b: 'B3', name: 'Anterior', lobe: 0, side: 1, anchor: [86, 26, -292] },
  { id: 'RB4', b: 'B4', name: 'Lateral', lobe: 1, side: 1, anchor: [102, 12, -326] },
  { id: 'RB5', b: 'B5', name: 'Medial', lobe: 1, side: 1, anchor: [54, 32, -340] },
  { id: 'RB6', b: 'B6', name: 'Superior', lobe: 2, side: 1, anchor: [82, -76, -296] },
  { id: 'RB7', b: 'B7', name: 'Medial basal', lobe: 2, side: 1, anchor: [42, -22, -372] },
  { id: 'RB8', b: 'B8', name: 'Anterior basal', lobe: 2, side: 1, anchor: [92, 5, -378] },
  { id: 'RB9', b: 'B9', name: 'Lateral basal', lobe: 2, side: 1, anchor: [122, -38, -370] },
  { id: 'RB10', b: 'B10', name: 'Posterior basal', lobe: 2, side: 1, anchor: [80, -62, -362] },
  { id: 'LB1+2', b: 'B1+2', name: 'Apicoposterior', lobe: 3, side: -1, anchor: [-80, -40, -250] },
  { id: 'LB3', b: 'B3', name: 'Anterior', lobe: 3, side: -1, anchor: [-78, 24, -282] },
  { id: 'LB4', b: 'B4', name: 'Superior lingular', lobe: 3, side: -1, anchor: [-108, 8, -315] },
  { id: 'LB5', b: 'B5', name: 'Inferior lingular', lobe: 3, side: -1, anchor: [-95, 25, -340] },
  { id: 'LB6', b: 'B6', name: 'Superior', lobe: 4, side: -1, anchor: [-80, -76, -300] },
  { id: 'LB7+8', b: 'B7+8', name: 'Anteromedial basal', lobe: 4, side: -1, anchor: [-78, -10, -385] },
  { id: 'LB9', b: 'B9', name: 'Lateral basal', lobe: 4, side: -1, anchor: [-120, -38, -378] },
  { id: 'LB10', b: 'B10', name: 'Posterior basal', lobe: 4, side: -1, anchor: [-80, -62, -368] },
];

// ---------------------------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------------------------
/** @param {number[]} a @param {number[]} b @returns {V3} */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} a @param {number[]} b */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** @param {number[]} a */
const len = (a) => Math.sqrt(dot(a, a));
/** @param {number[]} a @returns {V3} */
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** @param {number[]} a @param {number[]} b @returns {V3} */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} p @param {number[]} w @param {number} k @returns {V3} */
const along = (p, w, k) => [p[0] + w[0] * k, p[1] + w[1] * k, p[2] + w[2] * k];
/** @param {number[]} a @param {number[]} b @param {number} t @returns {V3} */
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const DEG = Math.PI / 180;
/** Unit vector `tilt`° from straight down, leaning to `side` and `back`° of azimuth posterior.
 * @param {number} side @param {number} tilt @param {number} back @returns {V3} */
const downTilt = (side, tilt, back) => {
  const s = Math.sin(tilt * DEG);
  return [side * s * Math.cos(back * DEG), -s * Math.sin(back * DEG), -Math.cos(tilt * DEG)];
};

// ---------------------------------------------------------------------------------------------
// Lung region, lobes, fissures, segments
// ---------------------------------------------------------------------------------------------
const LUNG_R = ORGANS.find((o) => o.id === 'lungs' && o.side === 1);
const LUNG_L = ORGANS.find((o) => o.id === 'lungs' && o.side === -1);
const HEART_E = ORGANS.filter((o) => (o.id === 'heart' || o.id === 'ventricles') && o.type === 'e');
// The great vessels at the hilum (heart-form.js): the airways keep clear of their walls.
const HILAR = HEART_FORM.roots.filter((v) => /^(pulmonaryArtery|pulmonaryVein|pulmonaryTrunk|svc|aorta)/.test(v.id))
  .flatMap((v) => v.pts.slice(1).map((q, i) => ({ a: v.pts[i], b: q, r: v.r })));
/** Clearance (mm) between a tube of radius r at p and the nearest hilar vessel wall.
 * @param {number[]} p @param {number} r */
const HILAR_BOX = HILAR.reduce((B, s) => {
  for (let i = 0; i < 3; i++) {
    B.min[i] = Math.min(B.min[i], s.a[i] - s.r, s.b[i] - s.r);
    B.max[i] = Math.max(B.max[i], s.a[i] + s.r, s.b[i] + s.r);
  }
  return B;
}, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
function vesselClearance(p, r) {
  const M = 20 + r;   // far from every hilar vessel: no need to measure
  for (let i = 0; i < 3; i++) if (p[i] < HILAR_BOX.min[i] - M || p[i] > HILAR_BOX.max[i] + M) return M;
  let m = Infinity;
  for (const s of HILAR) {
    const ab = sub(s.b, s.a), t = Math.max(0, Math.min(1, dot(sub(p, s.a), ab) / dot(ab, ab)));
    m = Math.min(m, len(sub(p, mix3(s.a, s.b, t))) - s.r - r);
  }
  return m;
}

/** Which lung p lies in (1 right, −1 left, 0 neither): inside the lung ellipsoid, above the
 * diaphragm, clear of the heart (the organ carve gap) and inside the body.
 * @param {number[]} p */
export function lungRegion(p) {
  const L = p[0] > -5 ? LUNG_R : LUNG_L;
  const qx = (p[0] - L.c[0]) / L.r[0], qy = (p[1] - L.c[1]) / L.r[1], qz = (p[2] - L.c[2]) / L.r[2];
  if (qx * qx + qy * qy + qz * qz >= 1) return 0;
  if (p[2] <= diaphragmZ(p[0], p[1])) return 0;
  for (const h of HEART_E) if (sdEllipsoid(p, h.c, h.r) < PARAMS.carveGap) return 0;
  if (bodySDF(p[0], p[1], p[2]) > -AIRWAY.skinGap) return 0;
  return L.side;
}

/** Signed distance (mm, first order) to the oblique fissure of a side; > 0 above (upper lobe side).
 * @param {number[]} p @param {number} side */
function obliqueSD(p, side) {
  const F = side > 0 ? FISSURES.obliqueR : FISSURES.obliqueL;
  const y = p[1], ax = Math.abs(p[0]);
  const zf = F.zBack + F.slope * (y - F.yBack) + F.curve * (y - F.yBack) * (y - F.yFront) + F.kx * (ax - F.x0);
  const gy = F.slope + F.curve * (2 * y - F.yBack - F.yFront);
  return (p[2] - zf) / Math.sqrt(1 + gy * gy + F.kx * F.kx);
}
/** Signed distance to the right horizontal fissure (> 0 above). @param {number[]} p */
const horizontalSD = (p) => p[2] - FISSURES.horizontal.zH;

/** Lobe of p, given its side, from the fissures alone (no region test).
 * @param {number[]} p @param {number} side */
function lobeBySide(p, side) {
  if (side > 0) return obliqueSD(p, 1) < 0 ? LOBE.RLL : horizontalSD(p) > 0 ? LOBE.RUL : LOBE.RML;
  return obliqueSD(p, -1) < 0 ? LOBE.LLL : LOBE.LUL;
}

/** Lobe index of p (LOBES), or −1 outside the lungs. @param {number[]} p */
export function lobeOf(p) {
  const side = lungRegion(p);
  return side ? lobeBySide(p, side) : -1;
}

/** Distance (mm) from p to the nearest fissure surface of the lung on p's side (x > −5: right),
 * for carving the ≈ 2-mm gaps. The fissures open out at the hilum, so it grows near the hilum. On
 * the right it is a lower bound near the junction of the horizontal and the oblique fissure.
 * @param {number[]} p */
export function fissureDist(p) {
  const side = p[0] > -5 ? 1 : -1;
  const ob = obliqueSD(p, side);
  let d = Math.abs(ob);
  if (side > 0 && ob > 0) d = Math.min(d, Math.abs(horizontalSD(p)));
  const H = side > 0 ? FISSURES.hilumR : FISSURES.hilumL;
  return Math.max(d, H.r - len(sub(p, H.c)));
}

/** Segment index of p (SEGMENTS) given its lobe: the nearest anchor of that lobe.
 * @param {number[]} p @param {number} lobe */
function segmentInLobe(p, lobe) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const s = SEGMENTS[i];
    if (s.lobe !== lobe) continue;
    const dx = p[0] - s.anchor[0], dy = p[1] - s.anchor[1], dz = p[2] - s.anchor[2], d = dx * dx + dy * dy + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Segment index of p (SEGMENTS), or −1 outside the lungs. @param {number[]} p */
export function segmentOf(p) {
  const lobe = lobeOf(p);
  return lobe < 0 ? -1 : segmentInLobe(p, lobe);
}

// ---------------------------------------------------------------------------------------------
// Seeds: a jittered grid through the lung region, one seed per leaf
// ---------------------------------------------------------------------------------------------
/** @param {typeof AIRWAY} o @param {() => number} rnd */
function makeSeeds(o, rnd) {
  const boxes = [LUNG_R, LUNG_L].map((L) => ({ min: sub(L.c, L.r), max: [L.c[0] + L.r[0], L.c[1] + L.r[1], L.c[2] + L.r[2]] }));
  const ok = (p) => {
    const side = lungRegion(p);
    return side !== 0 && fissureDist(p) >= o.fissureClear ? side : 0;
  };
  // Volume of the usable region on a coarse lattice, then the spacing for `leaves` seeds.
  const h0 = 6;
  let count = 0;
  for (const B of boxes) {
    for (let x = B.min[0] + h0 / 2; x < B.max[0]; x += h0)
      for (let y = B.min[1] + h0 / 2; y < B.max[1]; y += h0)
        for (let z = B.min[2] + h0 / 2; z < B.max[2]; z += h0) if (ok([x, y, z])) count++;
  }
  const volume = count * h0 * h0 * h0;
  const h = Math.cbrt(volume / o.leaves), jit = 0.42 * h;
  /** @type {{ p: V3, lobe: number, seg: number }[]} */
  const seeds = [];
  for (const B of boxes) {
    for (let x = B.min[0] + h / 2; x < B.max[0]; x += h)
      for (let y = B.min[1] + h / 2; y < B.max[1]; y += h)
        for (let z = B.min[2] + h / 2; z < B.max[2]; z += h) {
          /** @type {V3} */
          const p = [x + (2 * rnd() - 1) * jit, y + (2 * rnd() - 1) * jit, z + (2 * rnd() - 1) * jit];
          const side = ok(p);
          if (!side) continue;
          const lobe = lobeBySide(p, side);
          seeds.push({ p, lobe, seg: segmentInLobe(p, lobe) });
        }
  }
  return { seeds, h, volume };
}

/** @param {{ p: V3 }[]} pts @returns {V3} */
function centroid(pts) {
  let x = 0, y = 0, z = 0;
  for (const s of pts) { x += s.p[0]; y += s.p[1]; z += s.p[2]; }
  const n = pts.length || 1;
  return [x / n, y / n, z / n];
}

// ---------------------------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------------------------
// Named large airways: key, parent key, name, pin key (AIRWAY.pins), target (segment ids whose seeds it
// heads for; null: ends at AIRWAY.hilumR), length (mm). The trachea and main bronchi are placed explicitly.
/** @type {[string, string, string, string, string[] | null, number][]} */
const NAMED = [
  ['RUL', 'RMB', 'Right upper lobe bronchus', 'RUL', ['RB1', 'RB2', 'RB3'], 16],
  ['BI', 'RMB', 'Bronchus intermedius', 'BI', null, 0],   // ends at AIRWAY.hilumR
  ['RML', 'BI', 'Right middle lobe bronchus', 'RML', ['RB4', 'RB5'], 14],
  ['RLL', 'BI', 'Right lower lobe bronchus', 'RLL', ['RB6', 'RB7', 'RB8', 'RB9', 'RB10'], 8],
  ['RBAS', 'RLL', 'Right basal trunk', 'RBAS', ['RB7', 'RB8', 'RB9', 'RB10'], 14],
  ['LUL', 'LMB', 'Left upper lobe bronchus', 'LUL', ['LB1+2', 'LB3', 'LB4', 'LB5'], 12],
  ['LUD', 'LUL', 'Left upper division bronchus', 'LUD', ['LB1+2', 'LB3'], 10],
  ['LING', 'LUL', 'Lingular bronchus', 'LING', ['LB4', 'LB5'], 14],
  ['LLL', 'LMB', 'Left lower lobe bronchus', 'LLL', ['LB6', 'LB7+8', 'LB9', 'LB10'], 14],
  ['LBAS', 'LLL', 'Left basal trunk', 'LBAS', ['LB7+8', 'LB9', 'LB10'], 14],
];
// Parent key of each segmental bronchus.
const SEG_PARENT = { RB1: 'RUL', RB2: 'RUL', RB3: 'RUL', RB4: 'RML', RB5: 'RML', RB6: 'RLL', RB7: 'RBAS', RB8: 'RBAS',
  RB9: 'RBAS', RB10: 'RBAS', 'LB1+2': 'LUD', LB3: 'LUD', LB4: 'LING', LB5: 'LING', LB6: 'LLL', 'LB7+8': 'LBAS',
  LB9: 'LBAS', LB10: 'LBAS' };
const SEG_LENGTH = 15;   // [model] mm: segmental bronchi are ≈ 1–2 cm long

const cache = new Map();
/** Forget the memoised trees (tests and tuning). */
export function clearAirwayTreeCache() { cache.clear(); }

/**
 * Build the airway tree (memoised per options).
 * @param {Partial<typeof AIRWAY>} [opts]
 * @returns {AirwayTree}
 */
export function buildAirwayTree(opts = {}) {
  const o = { ...AIRWAY, ...opts };
  const key = JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const t0 = performance.now();
  const rnd = mulberry32(o.seed ^ 0x2a1b);
  const { seeds, h } = makeSeeds(o, rnd);
  const t1 = performance.now();

  /** @type {Branch[]} */
  const branches = [];
  /** @type {Acinus[]} */
  const acini = [];
  /** @type {(number | undefined)[]} pinned diameters by branch id */
  const pinned = [];
  /** @type {number[]} seeds served directly by a terminal branch */
  const direct = [];
  /** @type {(V3 | null)[]} split normal used at each branch's tip */
  const splitN = [];
  let fallbacks = 0;
  /**
   * @param {number} parent @param {V3} a @param {V3} b @param {Partial<Branch>} f @param {number} [pin]
   */
  const addBranch = (parent, a, b, f, pin) => {
    const id = branches.length;
    const gen = parent < 0 ? 0 : branches[parent].gen + 1;
    branches.push({ id, parent, gen, a, b, r: 0, lobe: f.lobe ?? -1, segment: f.segment ?? -1, side: f.side ?? 0,
      name: f.name ?? '', vol0: 0, vol1: 0, leaves: 0, children: [], len: len(sub(b, a)) });
    if (parent >= 0) branches[parent].children.push(id);
    pinned.push(pin);
    direct.push(0);
    splitN.push(null);
    return id;
  };

  // --- Large airways ---------------------------------------------------------------------
  const C = o.carina;
  const segIndex = new Map(SEGMENTS.map((s, i) => [s.id, i]));
  /** @type {Map<number, { p: V3, lobe: number, seg: number }[]>} */
  const bySeg = new Map(SEGMENTS.map((_, i) => [i, []]));
  for (const s of seeds) bySeg.get(s.seg).push(s);
  const keyId = new Map();
  keyId.set('trachea', addBranch(-1, [...o.tracheaTop], [...C], { name: 'Trachea' }, o.pins.trachea));
  const R1 = along(C, downTilt(1, o.mainR.tilt, o.mainR.back), o.mainR.length);
  const L1 = along(C, downTilt(-1, o.mainL.tilt, o.mainL.back), o.mainL.length);
  keyId.set('RMB', addBranch(keyId.get('trachea'), [...C], R1, { name: 'Right main bronchus', side: 1 }, o.pins.RMB));
  keyId.set('LMB', addBranch(keyId.get('trachea'), [...C], L1, { name: 'Left main bronchus', side: -1 }, o.pins.LMB));
  const lobeOfSegs = (ids) => { const l = new Set(ids.map((s) => SEGMENTS[segIndex.get(s)].lobe)); return l.size === 1 ? [...l][0] : -1; };
  const perAcinus = o.aciniTotal / Math.max(1, seeds.length);   // acini per seed
  /** Murray estimate of the lumen radius for n seeds (before the final pass). @param {number} n */
  const rEst = (n) => 0.5 * o.dTerminal * Math.cbrt(n * perAcinus);
  /** Does the tube a→b of radius r stay clear of the hilar vessels and, when lobe ≥ 0, end in its
   * lobe (and, with `whole`, stay in it)? @param {V3} a @param {V3} b @param {number} lobe @param {number} r @param {boolean} whole */
  const clear = (a, b, lobe, r, whole) => {
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const p = mix3(a, b, t);
      if (vesselClearance(p, r) < o.vesselGap + (t === 1 ? 3 : 0)) return false;   // room for the children at the tip
      if (lobe >= 0 && (whole || t === 1) && lobeOf(p) !== lobe) return false;
    }
    return true;
  };
  // A named branch from `a` towards the seeds of `segIds`: the straightest direction (within 40° of
  // the centre of mass, then up to 60°) and the longest length that keep it in its lobe and clear of
  // the vessels.
  const aim = (a, segIds, length, lobe, r, whole) => {
    const pts = segIds.flatMap((s) => bySeg.get(segIndex.get(s)));
    const c0 = norm(sub(centroid(pts), a)), e1 = norm(cross(c0, Math.abs(c0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(c0, e1);
    for (const dev of [0, 6, 12, 18, 24, 30, 40, 50, 60]) {
      for (let k = 0; k < (dev ? 12 : 1); k++) {
        const az = (k * Math.PI) / 6, sd = Math.sin(dev * DEG), cd = Math.cos(dev * DEG);
        const dir = norm([0, 1, 2].map((i) => c0[i] * cd + (e1[i] * Math.cos(az) + e2[i] * Math.sin(az)) * sd));
        for (const f of [1, 0.8, 0.6]) {
          const b = along(a, dir, length * f);
          if (clear(a, b, lobe, r, whole)) return b;
        }
      }
    }
    return along(a, c0, length * 0.3);
  };
  for (const [k, pk, name, pin, segIds, length] of NAMED) {
    const parent = keyId.get(pk), side = branches[parent].side, lobe = segIds ? lobeOfSegs(segIds) : -1;
    const a = /** @type {V3} */ ([...branches[parent].b]);
    const b = segIds ? aim(a, segIds, length, lobe, 0.5 * o.pins[pin], false) : /** @type {V3} */ ([...o.hilumR]);
    keyId.set(k, addBranch(parent, a, b, { name, side, lobe }, o.pins[pin]));
  }
  /** @type {number[]} segmental branch id per segment */
  const segBranch = [];
  SEGMENTS.forEach((s, i) => {
    const parent = keyId.get(SEG_PARENT[s.id]);
    const a = /** @type {V3} */ ([...branches[parent].b]);
    const cloud = bySeg.get(i);
    const dist = len(sub(centroid(cloud), a));
    const b = aim(a, [s.id], Math.min(SEG_LENGTH, 0.5 * dist), s.lobe, rEst(cloud.length), true);
    segBranch[i] = addBranch(parent, a, b, { name: `${s.name} segmental bronchus (${s.b})`, side: s.side, lobe: s.lobe, segment: i });
  });
  const t2 = performance.now();

  // --- Space-filling growth below segmental level ----------------------------------------
  /** Is the straight branch a→b (radius r) inside its lobe (and the lung) along its length, and
   * clear of the hilar vessels? @param {V3} a @param {V3} b @param {number} lobe @param {number} r */
  const inside = (a, b, lobe, r) => {
    const L = len(sub(b, a)), n = L > 6 ? 4 : 2;
    for (let i = 1; i <= n; i++) {
      const p = mix3(a, b, i / n);
      if (lobeOf(p) !== lobe || vesselClearance(p, r) < o.vesselGap) return false;
    }
    return true;
  };
  /** Split normal for a cloud at branch `id`: the long axis of the cloud across the branch axis,
   * biased towards the parent's branching-plane normal (turns the plane ≈ 90° per generation). */
  const chooseNormal = (id, cloud, t) => {
    const c = centroid(cloud);
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    for (const s of cloud) {
      const dx = s.p[0] - c[0], dy = s.p[1] - c[1], dz = s.p[2] - c[2];
      xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * dz; zz += dz * dz;
    }
    // Basis of the plane across t.
    const e1 = norm(cross(t, Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(t, e1);
    const q = (u, v) => u[0] * (xx * v[0] + xy * v[1] + xz * v[2]) + u[1] * (xy * v[0] + yy * v[1] + yz * v[2]) + u[2] * (xz * v[0] + yz * v[1] + zz * v[2]);
    let a11 = q(e1, e1), a12 = q(e1, e2), a22 = q(e2, e2);
    const p = branches[id].parent, pn = p >= 0 ? splitN[p] : null;
    if (pn) {
      const pt = norm(sub(branches[p].b, branches[p].a));
      const m = cross(pt, pn), m1 = dot(m, e1), m2 = dot(m, e2), ml = Math.hypot(m1, m2);
      if (ml > 1e-6) {
        const w = o.planeBias * (a11 + a22);
        a11 += w * m1 * m1 / (ml * ml); a12 += w * m1 * m2 / (ml * ml); a22 += w * m2 * m2 / (ml * ml);
      }
    }
    const ang = 0.5 * Math.atan2(2 * a12, a11 - a22);
    return norm([0, 1, 2].map((k) => e1[k] * Math.cos(ang) + e2[k] * Math.sin(ang)));
  };
  /** @param {number} id @param {{ p: V3, lobe: number, seg: number }[]} cloud */
  const terminal = (id, cloud) => {
    const B = branches[id];
    direct[id] = cloud.length;
    for (const s of cloud) acini.push({ c: s.p, r: o.acinusR, branch: id, lobe: B.lobe, segment: B.segment });
  };
  /** One generation of growth from branch `id` with its cloud: split the cloud by a plane through the
   * branch axis and grow a child towards each half. Returns the children still growing.
   * @param {number} id @param {Seed[]} cloud @returns {{ id: number, cloud: Seed[] }[]} */
  const cosMax = Math.cos(o.maxAngle * DEG), sinMax = Math.sin(o.maxAngle * DEG);
  /** u turned towards t until it is at most maxAngle from it. @param {V3} u @param {V3} t @param {V3} n */
  const capAngle = (u, t, n) => {
    const c = dot(u, t);
    if (c >= cosMax) return u;
    let w = sub(u, along([0, 0, 0], t, c));
    w = len(w) < 1e-6 ? n : norm(w);
    return norm(along(along([0, 0, 0], t, cosMax), w, sinMax));
  };
  const divide = (id, cloud) => {
    const B = branches[id], t = norm(sub(B.b, B.a)), n = chooseNormal(id, cloud, t);
    splitN[id] = n;
    let A = [], Bh = [];
    for (const s of cloud) (dot(sub(s.p, B.b), n) >= 0 ? A : Bh).push(s);
    if (!A.length || !Bh.length) {   // the plane through the axis misses the cloud: split at the median
      const pr = cloud.map((s) => dot(s.p, n)).sort((x, y) => x - y), med = pr[(pr.length - 1) >> 1];
      A = []; Bh = [];
      for (const s of cloud) (dot(s.p, n) > med ? A : Bh).push(s);
    }
    const out = [];
    for (const half of [A, Bh]) {
      if (!half.length) continue;
      const target = centroid(half), u = norm(sub(target, B.b));
      // Angle from the parent: towards the centre of mass (Tawhai), blended with Murray's optimum for
      // this flow share (Kitaoka 1999: the larger daughter turns less), capped at maxAngle.
      const phi = Math.acos(Math.max(-1, Math.min(1, dot(u, t))));
      const r = half.length / cloud.length, r1 = 1 - r;
      const cOpt = (1 + r ** (4 / 3) - r1 ** (4 / 3)) / (2 * r ** (2 / 3));
      const thOpt = Math.acos(Math.max(-1, Math.min(1, cOpt)));
      const th = Math.min(o.maxAngle * DEG, (1 - o.murrayAngle) * phi + o.murrayAngle * thOpt);
      let w = sub(u, along([0, 0, 0], t, dot(u, t)));
      if (len(w) < 1e-6) w = dot(sub(target, B.b), n) >= 0 ? n : along([0, 0, 0], n, -1);
      w = norm(w);
      const dir = norm(along(along([0, 0, 0], t, Math.cos(th)), w, Math.sin(th)));
      const rc = rEst(half.length);
      let L = o.grow * len(sub(target, B.b));
      let b = along(B.b, dir, L);
      if (!inside(B.b, b, B.lobe, rc)) {
        // Fall back: towards the seed nearest the centre of mass, then the straightest direction within
        // 40° of the aim (all within the angle cap), at shorter lengths; then without the vessel
        // clearance; last a terminal stub along the parent.
        fallbacks++;
        let best = half[0], bd = Infinity;
        for (const s of half) { const d = len(sub(s.p, target)); if (d < bd) { bd = d; best = s; } }
        const e1 = norm(cross(dir, Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(dir, e1);
        const dirs = [capAngle(norm(sub(best.p, B.b)), t, n)];
        for (const dev of [10, 20, 30, 40]) {
          for (let k = 0; k < 8; k++) {
            const az = (k * Math.PI) / 4, sd = Math.sin(dev * DEG), cd = Math.cos(dev * DEG);
            dirs.push(capAngle(norm([0, 1, 2].map((i) => dir[i] * cd + (e1[i] * Math.cos(az) + e2[i] * Math.sin(az)) * sd)), t, n));
          }
        }
        b = null;
        search: for (const vr of [rc, -Infinity]) {
          for (const d of vr === rc ? dirs : [dir, ...dirs]) {
            for (const f of [1, 0.6, 0.35]) {
              const cand = along(B.b, d, f * L);
              if (inside(B.b, cand, B.lobe, vr)) { b = cand; L *= f; break search; }
            }
          }
        }
        if (!b) {   // a terminal stub along the parent, as long as stays in the lobe (the tip lies on its edge)
          for (L = 0.5 * o.minLength; L > 0.01; L /= 3) if (lobeOf(along(B.b, t, L)) === B.lobe) break;
          if (L <= 0.01) L = 0;
          b = along(B.b, t, L);
        }
      }
      const cid = addBranch(id, /** @type {V3} */ ([...B.b]), b, { side: B.side, lobe: B.lobe, segment: B.segment,
        name: `${SEGMENTS[B.segment].id} g${B.gen + 1}` });
      if (L < o.minLength || half.length === 1) terminal(cid, half); else out.push({ id: cid, cloud: half });
    }
    return out;
  };
  /** Tawhai et al. 2000: after each generation the seeds of a segment go to the nearest growing tip,
   * so the tips compete for space and the tree becomes asymmetric. Every tip keeps at least one seed.
   * @param {{ id: number, cloud: Seed[] }[]} act */
  const reassign = (act) => {
    const tips = act.map((e) => branches[e.id].b), pool = act.flatMap((e) => e.cloud);
    const clouds = act.map(() => /** @type {Seed[]} */ ([]));
    for (const s of pool) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < tips.length; k++) {
        const dx = s.p[0] - tips[k][0], dy = s.p[1] - tips[k][1], dz = s.p[2] - tips[k][2], d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = k; }
      }
      clouds[best].push(s);
    }
    for (let k = 0; k < act.length; k++) {
      if (clouds[k].length) continue;
      let bj = -1, bi = -1, bd = Infinity;   // take the nearest seed from a tip that has more than one
      for (let j = 0; j < act.length; j++) {
        if (clouds[j].length < 2) continue;
        for (let i = 0; i < clouds[j].length; i++) {
          const d = len(sub(clouds[j][i].p, tips[k]));
          if (d < bd) { bd = d; bj = j; bi = i; }
        }
      }
      clouds[k].push(clouds[bj].splice(bi, 1)[0]);
    }
    act.forEach((e, k) => { e.cloud = clouds[k]; });
  };
  /** Grow one segment's subtree generation by generation. @param {number} root @param {Seed[]} cloud */
  const growSegment = (root, cloud) => {
    let act = [{ id: root, cloud }];
    while (act.length) {
      const next = [];
      for (const e of act) {
        if (e.cloud.length <= 1) terminal(e.id, e.cloud);
        else next.push(...divide(e.id, e.cloud));
      }
      if (o.reassign && next.length > 1) reassign(next);
      act = next;
    }
  };
  SEGMENTS.forEach((_, i) => growSegment(segBranch[i], bySeg.get(i)));
  const t3 = performance.now();

  // --- Murray diameters, leaves, volumes ---------------------------------------------------
  const d3leaf = o.dTerminal ** 3 * perAcinus;
  const d3 = new Float64Array(branches.length);
  for (let i = branches.length - 1; i >= 0; i--) {   // children always follow their parent
    const B = branches[i];
    let s = direct[i] * d3leaf, leaves = direct[i];
    for (const c of B.children) { s += d3[c]; leaves += branches[c].leaves; }
    d3[i] = s;
    B.leaves = leaves;
    let d = Math.cbrt(s);
    if (pinned[i] !== undefined) {   // a pinned airway stays wider than its widest child
      d = pinned[i];
      for (const c of B.children) d = Math.max(d, o.pinFloor * 2 * branches[c].r);
    }
    B.r = d / 2;
  }
  let conducting = 0;
  for (const B of branches) {
    const v = Math.PI * B.r * B.r * B.len / 1000;
    B.vol0 = B.parent < 0 ? o.upperDeadSpace : branches[B.parent].vol1;
    B.vol1 = B.vol0 + v;
    conducting += v;
  }
  const t4 = performance.now();

  // --- Statistics -------------------------------------------------------------------------
  const perGen = [], terminalPerGen = [];
  let maxG = 0, minG = Infinity, sumG = 0, nT = 0, angSum = 0, angN = 0, turnSum = 0, turnN = 0;
  for (const B of branches) {
    perGen[B.gen] = (perGen[B.gen] || 0) + 1;
    if (!B.children.length) {
      terminalPerGen[B.gen] = (terminalPerGen[B.gen] || 0) + 1;
      maxG = Math.max(maxG, B.gen); minG = Math.min(minG, B.gen); sumG += B.gen * B.leaves; nT += B.leaves;
    }
    if (B.segment >= 0 && B.parent >= 0 && branches[B.parent].segment >= 0) {
      const P = branches[B.parent];
      angSum += Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(B.b, B.a)), norm(sub(P.b, P.a)))))) / DEG; angN++;
      if (splitN[B.id] && splitN[P.id]) {
        const n1 = cross(norm(sub(P.b, P.a)), splitN[P.id]), n2 = cross(norm(sub(B.b, B.a)), splitN[B.id]);
        turnSum += Math.acos(Math.min(1, Math.abs(dot(norm(n1), norm(n2))))) / DEG; turnN++;
      }
    }
  }
  for (let g = 0; g < perGen.length; g++) { perGen[g] = perGen[g] || 0; terminalPerGen[g] = terminalPerGen[g] || 0; }
  const t5 = performance.now();
  const tree = {
    branches, acini,
    stats: {
      perGen, terminalPerGen, maxPathGen: maxG, minPathGen: minG, meanPathGen: sumG / Math.max(1, nT),
      conductingVolume: conducting, upperDeadSpace: o.upperDeadSpace, branches: branches.length, leaves: seeds.length,
      acini: acini.length, seedSpacing: h, fallbacks, meanAngle: angSum / Math.max(1, angN), meanPlaneTurn: turnSum / Math.max(1, turnN),
      ms: { seeds: t1 - t0, named: t2 - t1, grow: t3 - t2, murray: t4 - t3, total: t5 - t0 },
    },
  };
  cache.set(key, tree);
  return tree;
}

// ---------------------------------------------------------------------------------------------
// Upper airway (research/LUNGS.md §2.1, §14.1): from each nostril through the nasal vestibule and
// the nasal cavity to the choanae, then the nasopharynx, oropharynx, laryngopharynx and larynx (the
// glottis a narrow slit) to the top of the trachea. Rows are [x, y, z, half-width (lateral), half-
// height (in the sagittal plane)], mm. Kept inside the head and neck (bodySDF ≤ −1 mm), medial to
// the eyes (|x| ≤ 14), below the cribriform plate and olfactory epithelium (z ≤ −50) and in front
// of the cervical vertebrae [model; positions fitted to geometry.js HEAD landmarks: subnasale
// (0, 96, −94), tongue, hyoid (0, 25, −145), larynx (0, 30, −158.5)].
// ---------------------------------------------------------------------------------------------
export const UPPER_AIRWAY = {
  nose: [   // right nostril to the right choana; the left is its mirror (x → −x)
    { name: 'Nostril (naris)', p: [6, 91, -91, 1.8, 1.8] },
    { name: 'Nasal vestibule', p: [6, 86, -90, 2, 2] },
    { name: 'Nasal vestibule', p: [6, 80, -87.5, 2.2, 2.8] },
    { name: 'Nasal cavity', p: [6.5, 70, -77, 2.8, 10] },
    { name: 'Nasal cavity', p: [7, 60, -70, 3, 15] },
    { name: 'Nasal cavity', p: [7, 46, -69, 3, 16] },
    { name: 'Choana', p: [6, 34, -71, 4, 12] },
  ],
  pharynx: [   // the two nasal cavities meet in the nasopharynx
    { name: 'Nasopharynx', p: [0, 22, -74, 13, 10] },
    { name: 'Nasopharynx', p: [0, 12, -88, 14, 11] },
    { name: 'Oropharynx', p: [0, 9, -104, 14, 9] },
    { name: 'Oropharynx', p: [0, 11, -122, 13, 8] },
    { name: 'Laryngopharynx', p: [0, 16, -137, 12, 7] },
    { name: 'Larynx · vestibule', p: [0, 25, -149, 8, 6] },
    { name: 'Larynx · glottis', p: [0, 28, -158, 7, 2.5] },
    { name: 'Larynx · subglottis', p: [0, 25, -165, 8, 8] },
  ],
};

/** @typedef {{ a: V3, b: V3, wa: number, ha: number, wb: number, hb: number, vol0: number, vol1: number, name: string, side: number }} UpperSegment */
/** @type {UpperSegment[] | null} */
let upperCache = null;
/**
 * Straight segments of the upper airway, nostrils to the trachea, with the cumulative lumen volume
 * (mL) from the mouth of the nose: each nasal passage carries half the flow, so its volume counts
 * half; the whole is scaled to AIRWAY.upperDeadSpace at the top of the trachea.
 * @returns {UpperSegment[]}
 */
export function upperAirwaySegments() {
  if (upperCache) return upperCache;
  const T = buildAirwayTree().branches[0], top = /** @type {number[]} */ ([...T.a, T.r, T.r]);
  const rows = (list) => list.map((q) => q.p);
  const segVol = (A, B) => Math.PI * len(sub(B, A)) * (A[3] * A[4] + B[3] * B[4]) / 2 / 1000;   // mL
  const out = [];
  const mk = (A, B, name, side, v0, k) => { const v = k * segVol(A, B); out.push({ a: [A[0], A[1], A[2]], b: [B[0], B[1], B[2]], wa: A[3], ha: A[4], wb: B[3], hb: B[4], vol0: v0, vol1: v0 + v, name, side }); return v0 + v; };
  const nose = rows(UPPER_AIRWAY.nose), ph = [...rows(UPPER_AIRWAY.pharynx), top];
  let vNose = 0;
  for (const side of [1, -1]) {
    let v = 0;
    const N = nose.map((r) => [side * r[0], r[1], r[2], r[3], r[4]]);
    for (let i = 0; i < N.length - 1; i++) v = mk(N[i], N[i + 1], UPPER_AIRWAY.nose[i + 1].name, side, v, 0.5);
    v = mk(N[N.length - 1], ph[0], UPPER_AIRWAY.pharynx[0].name, side, v, 0.5);
    vNose = v;
  }
  let v = vNose;
  for (let i = 0; i < ph.length - 1; i++) v = mk(ph[i], ph[i + 1], (UPPER_AIRWAY.pharynx[i + 1] ?? UPPER_AIRWAY.pharynx[i]).name, 0, v, 1);
  const k = AIRWAY.upperDeadSpace / v;
  for (const s of out) { s.vol0 *= k; s.vol1 *= k; }
  upperCache = out;
  return out;
}

/**
 * A candidate point on a fissure surface (LUNGS.md §14.2), for the visceral pleura that lines it:
 * kind 0 the right oblique, 1 the left oblique, 2 the right horizontal fissure; u, v ∈ [0, 1).
 * The caller keeps it only where the lobes on either side differ (lobeOf above and below).
 * @param {number} u @param {number} v @param {number} kind @returns {V3}
 */
export function fissureSurfacePoint(u, v, kind) {
  const L = kind === 1 ? LUNG_L : LUNG_R;
  const x = L.c[0] + (2 * u - 1) * L.r[0];
  if (kind === 2) return [x, L.c[1] + (2 * v - 1) * L.r[1], FISSURES.horizontal.zH];
  const F = kind === 0 ? FISSURES.obliqueR : FISSURES.obliqueL, y = F.yBack - 8 + v * (F.yFront - F.yBack + 16);
  return [x, y, F.zBack + F.slope * (y - F.yBack) + F.curve * (y - F.yBack) * (y - F.yFront) + F.kx * (Math.abs(x) - F.x0)];
}
