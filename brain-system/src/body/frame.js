// Body frame of the whole-body extension (research/ANALYSIS.md §2, Appendix A.2). The body frame IS
// the MNI-152 brain frame: same origin (≈ anterior commissure), x → right, y → anterior, z →
// superior, millimetres. No transform exists between brain and body, so `anatomy.js` coordinates
// hold unchanged. This module owns the frame constants, the vertebral column, the spinal cord
// segments with their diameters, the dorsal root ganglia and exits, the canal centreline
// (`canalAt`) and the dermatome key points (`dermatomeAt`). Right-side values are listed; the left
// mirrors x. Every number lives in a table at the top with its section, so corrections land as data.

import { MM } from '../anatomy.js';

export { MM };

export const PARAMS = {
  vertex: [0, -20, 88],              // §2.1 scalp vertex
  floorZ: -1672,                     // §2.1, A.2 floor plane (h = z + 1,672)
  stature: 1760,                     // §2.2 model stature, vertex to sole
  mass: 75,                          // §2.2 kg
  bsa: 1.91,                         // §2.2 m² (DuBois & DuBois 1916)
  age: 30,                           // §2.2, A.9 default age (y)
  junction: [0, -45, -72],           // §2.1 cervicomedullary junction (brain–body boundary)
  brainstemEnd: [0, -46, -88],       // §2.1 end of the existing BRAINSTEM tube (functionally upper cord)
  conus: [0, -63, -499],             // §2.5 conus tip
  sacEnd: [0, -73, -676],            // §2.5 dural sac end (S2 vertebra)
  filumEnd: [0, -70, -760],          // §2.5 filum terminale at the coccyx dorsum
  conusTipDiameter: 0.5,             // §2.5 cord tapers to 0.5 mm at the conus tip
  rootForamenX: 10,                  // §2.5 chord route: inner foramen at |x| 10 on the DRG's y, z
                                     //   (reproduces the dorsal-root length table to ≤ 1 mm)
  rootEntryLateral: 3.5,             // §2.5 root entry zone, lateral of the segment centre
  rootEntryDorsal: 3,                // §2.5 root entry zone, dorsal of the segment centre
  canalRadius: { cervical: 9, thoracic: 7, lumbosacral: 8 }, // §2.4 canal radius 7–9 mm
  heightFractions: {                 // §2.2 Drillis & Contini fractions of the model stature
    shoulder: 0.818, chest: 0.720, elbow: 0.630, trochanter: 0.530, wrist: 0.485,
    fingertip: 0.377, knee: 0.285, ankle: 0.039,
  },
  overlapWeight: 0.4,                // §6.6 overlap segments drive at 0.4, the primary at 1.0
  perianalBand: { maxAbsX: 15, z0: -825, z1: -840 }, // §2.7 S4–S5 band (posterior, never pickable)
};

// Height above the floor and the landmark law below the chin (A.2): z = f · 1,760 − 1,672.
export const heightAt = (z) => z - PARAMS.floorZ;
export const landmarkZ = (f) => f * PARAMS.stature + PARAMS.floorZ;

// Mirror a right-side point to `side` (+1 right, −1 left).
export const sided = (p, side = 1) => (side < 0 ? [-p[0], p[1], p[2]] : [p[0], p[1], p[2]]);
export const sideSuffix = (side) => (side > 0 ? '.R' : side < 0 ? '.L' : '');

// --- Spinal segments (31, §2.5) ---
export const SEGMENTS = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
  'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4', 'S5', 'Co1',
];
export const SEG_INDEX = Object.fromEntries(SEGMENTS.map((s, i) => [s, i]));

// Segment centres on the canal centreline (x 0), §2.5 table "Segments".
const CORD_Z = [-76, -83, -98, -114, -129, -144, -158, -165,
  -172, -184, -196, -220, -244, -267, -291, -315, -327, -339, -363, -386,
  -404, -416, -428, -440, -458, -474, -479, -484, -489, -493, -499];
const CORD_Y = [-45, -46, -47, -46, -44, -48, -51, -53,
  -55, -60, -64, -70, -75, -79, -84, -86, -87, -87, -88, -87,
  -83, -81, -78, -76, -72, -69, -68, -66, -65, -64, -63];
// Transverse and AP diameters, Frostell et al. 2016 Table 5 (§2.5); Co1 = conus tip.
const CORD_TR = [11.3, 11.5, 12.0, 12.8, 13.3, 13.1, 12.5, 11.3,
  10.7, 10.0, 9.6, 9.5, 9.2, 8.7, 8.4, 8.3, 8.6, 8.6, 8.3, 8.2,
  8.6, 9.1, 9.4, 9.3, 8.8, 8.4, 7.1, 6.3, 5.5, 4.7, PARAMS.conusTipDiameter];
const CORD_AP = [8.3, 8.2, 8.0, 7.7, 7.4, 7.0, 6.9, 6.8,
  6.9, 6.9, 6.8, 6.6, 6.4, 6.4, 6.3, 6.3, 6.5, 6.5, 6.4, 6.4,
  6.7, 7.2, 7.5, 7.5, 7.1, 6.8, 5.8, 5.2, 4.6, 3.9, PARAMS.conusTipDiameter];
// Dorsal root ganglia, right side (§2.5 "DRG" rows).
const DRG_X = [24, 24, 24, 24, 24, 24, 24, 24, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26,
  32, 32, 32, 32, 32, 26, 26, 26, 26, 26, 24];
const DRG_Z = [-77, -90, -106, -121, -136, -151, -165, -184,
  -208, -232, -255, -279, -303, -327, -351, -374, -398, -422, -446, -470,
  -499, -534, -569, -604, -638, -659, -680, -701, -722, -747, -759];
const DRG_Y = [-45, -46, -46, -45, -46, -49, -53, -60,
  -68, -72, -77, -82, -86, -87, -87, -88, -84, -80, -75, -70,
  -63, -57, -53, -53, -56, -65, -75, -84, -84, -81, -76];
// Reference values the geometry must reproduce (§2.5, computed there): dorsal-root chord length
// and arc position of each segment from the junction (mm).
export const DORSAL_ROOT_LENGTH_REF = [21, 24, 25, 24, 24, 24, 24, 34,
  54, 65, 76, 76, 76, 77, 76, 75, 87, 100, 101, 103,
  120, 143, 166, 188, 203, 201, 217, 233, 249, 270, 274];
export const SEGMENT_ARC_REF = [4, 11, 26, 42, 57, 73, 87, 94,
  102, 114, 127, 152, 177, 200, 224, 249, 261, 273, 297, 320,
  338, 350, 363, 375, 393, 410, 415, 420, 425, 429, 435];

// Segment–vertebra rule and exit rule (§2.5), as vertebral labels for the HUD readout.
const SEG_VERTEBRA = ['foramen magnum', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C6/C7',
  'C7', 'C7/T1', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T6/T7', 'T7', 'T8', 'T9',
  'T10', 'T10', 'T11', 'T11', 'T12', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1/L2'];
function exitText(seg) {
  if (seg === 'C1') return 'between occiput and atlas';
  if (/^C[2-7]$/.test(seg)) return `above vertebra ${seg}`;
  if (seg === 'C8') return 'below vertebra C7';
  if (/^S[1-4]$/.test(seg)) return 'sacral foramen';
  if (seg === 'S5' || seg === 'Co1') return 'sacral hiatus';
  return `below vertebra ${seg}`;
}

// --- Vertebral column (§2.4) ---
const VERT = [
  ['C1', -83, -27], ['C2', -98, -28], ['C3', -114, -29], ['C4', -129, -30], ['C5', -144, -32], ['C6', -158, -35], ['C7', -172, -38],
  ['T1', -196, -42], ['T2', -220, -46], ['T3', -244, -50], ['T4', -267, -54], ['T5', -291, -58], ['T6', -315, -62],
  ['T7', -339, -62], ['T8', -363, -62], ['T9', -386, -62], ['T10', -410, -58], ['T11', -434, -53], ['T12', -458, -47],
  ['L1', -482, -37], ['L2', -517, -31], ['L3', -552, -25], ['L4', -587, -22], ['L5', -622, -28],
  ['S1', -655, -42], ['S2', -676, -56], ['S3', -697, -68], ['S4', -718, -72], ['S5', -739, -70], ['Co', -765, -62],
];
const VERT_HALF = { C: [9, 8, 6], T: [14, 12, 10], L: [22, 16, 13], Co: [8, 6, 6] };   // §2.4 half extents
export const VERTEBRAE = VERT.map(([label, z, y]) => {
  let half;
  if (label === 'Co') half = VERT_HALF.Co;
  else if (label[0] === 'S') {                                          // S1 (24, 10, 9) → S5 (12, 10, 9)
    const k = (+label.slice(1) - 1) / 4;
    half = [24 - 12 * k, 10, 9];
  } else half = VERT_HALF[label[0]];
  return { id: `vert.${label}`, label, c: [0, y, z], half };
});
export const VERTEBRA = Object.fromEntries(VERTEBRAE.map((v) => [v.label, v]));

// --- Canal centreline (§2.4): control points (y, z) on x 0; piecewise linear, as the §2.5 segment
// table and arc positions are computed on it. ---
export const CANAL = [[-45, -72], [-47, -100], [-44, -130], [-55, -172], [-66, -200], [-86, -300], [-88, -380],
  [-72, -460], [-58, -520], [-52, -585], [-56, -640], [-84, -700], [-84, -740], [-74, -765]];
const CANAL_ARC = (() => {
  const a = [0];
  for (let i = 1; i < CANAL.length; i++) a.push(a[i - 1] + Math.hypot(CANAL[i][0] - CANAL[i - 1][0], CANAL[i][1] - CANAL[i - 1][1]));
  return a;
})();
export const CANAL_LENGTH = CANAL_ARC[CANAL_ARC.length - 1];

function canalRadiusAt(z) {
  const R = PARAMS.canalRadius;
  if (z > -172) return R.cervical;
  if (z > -460) return R.thoracic;
  return R.lumbosacral;
}

// Canal centreline at height z (mm): { x, y, z, r, arc, t: unit tangent (caudal) }.
export function canalAt(z) {
  const zc = Math.min(CANAL[0][1], Math.max(CANAL[CANAL.length - 1][1], z));
  let i = 0;
  while (i < CANAL.length - 2 && CANAL[i + 1][1] > zc) i++;
  const [y0, z0] = CANAL[i], [y1, z1] = CANAL[i + 1];
  const f = (z0 - zc) / (z0 - z1);
  const segLen = CANAL_ARC[i + 1] - CANAL_ARC[i];
  return {
    x: 0, y: y0 + (y1 - y0) * f, z: zc, r: canalRadiusAt(zc), arc: CANAL_ARC[i] + segLen * f,
    t: [0, (y1 - y0) / segLen, (z1 - z0) / segLen],
  };
}

// Canal centreline at arc length s (mm from the junction).
export function canalAtArc(s) {
  const sc = Math.min(CANAL_LENGTH, Math.max(0, s));
  let i = 0;
  while (i < CANAL.length - 2 && CANAL_ARC[i + 1] < sc) i++;
  const segLen = CANAL_ARC[i + 1] - CANAL_ARC[i];
  const f = (sc - CANAL_ARC[i]) / segLen;
  const [y0, z0] = CANAL[i], [y1, z1] = CANAL[i + 1];
  const z = z0 + (z1 - z0) * f;
  return { x: 0, y: y0 + (y1 - y0) * f, z, r: canalRadiusAt(z), arc: sc, t: [0, (y1 - y0) / segLen, (z1 - z0) / segLen] };
}

// --- Cord segments, DRG and roots ---
export const CORD_SEGMENTS = SEGMENTS.map((seg, i) => {
  const c = [0, CORD_Y[i], CORD_Z[i]];
  return {
    id: `cord.${seg}`, seg, index: i, c, arc: canalAt(CORD_Z[i]).arc,
    rx: CORD_TR[i] / 2, ry: CORD_AP[i] / 2,                // half-diameters (transverse, AP)
    vertebra: SEG_VERTEBRA[i], exit: exitText(seg),
  };
});
export const CORD = Object.fromEntries(CORD_SEGMENTS.map((s) => [s.seg, s]));
export const CORD_ARC_CONUS = canalAt(PARAMS.conus[2]).arc;  // junction → conus along the curve (≈ 435, §2.14)

export function cordSegment(seg) { return CORD[seg]; }
export function drg(seg, side = 1) {
  const i = SEG_INDEX[seg];
  return sided([DRG_X[i], DRG_Y[i], DRG_Z[i]], side);
}

// Half-diameters of the cord at arc s, interpolated between segment centres and tapering to the
// conus tip; above C1 the BRAINSTEM tube takes over (anatomy.js).
export function cordRadiiAtArc(s) {
  const segs = CORD_SEGMENTS;
  if (s <= segs[0].arc) return [segs[0].rx, segs[0].ry];
  for (let i = 0; i < segs.length - 1; i++) {
    if (s <= segs[i + 1].arc) {
      const f = (s - segs[i].arc) / Math.max(1e-6, segs[i + 1].arc - segs[i].arc);
      return [segs[i].rx + (segs[i + 1].rx - segs[i].rx) * f, segs[i].ry + (segs[i + 1].ry - segs[i].ry) * f];
    }
  }
  return [PARAMS.conusTipDiameter / 2, PARAMS.conusTipDiameter / 2];
}

// Root route (§2.5): entry zone (3.5 mm lateral, 3 mm dorsal of the segment centre; ventral roots
// 3 mm anterior) → inner foramen → DRG. Returned CNS end first (u = 0 at the cord, A.2).
export function rootPath(seg, side = 1, ventral = false) {
  const c = CORD[seg].c, g = drg(seg, side), sgn = side < 0 ? -1 : 1;
  const entry = [sgn * PARAMS.rootEntryLateral, c[1] + (ventral ? 1 : -1) * PARAMS.rootEntryDorsal, c[2]];
  const foramen = [sgn * PARAMS.rootForamenX, g[1], g[2]];
  return [entry, foramen, g];
}
export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return L;
}
export const rootLength = (seg) => polylineLength(rootPath(seg, 1));

// --- Dermatome key points (§2.7, ISNCSCI [G Dermatome_anatomy L61–L87]) and site segments (§6.6) ---
export const DERMATOME_POINTS = {
  C2: [15, -105, -50], C3: [60, 50, -215], C4: [175, -15, -222], C5: [215, 5, -545], C6: [280, -30, -910],
  C7: [240, -35, -930], C8: [205, -35, -915], T1: [161, -6, -570], T2: [150, -25, -265], T3: [95, 85, -340],
  T4: [95, 87, -370], T5: [95, 86, -379], T6: [95, 84, -388], T7: [95, 78, -454], T8: [95, 76, -498],
  T9: [95, 74, -541], T10: [95, 78, -585], T11: [95, 82, -654], T12: [72, 94, -722], L1: [55, 67, -829],
  L2: [37, 43, -936], L3: [19, -31, -1150], L4: [41, -45, -1605], L5: [85, 120, -1640], S1: [105, -85, -1640],
  S2: [80, -92, -1165], S3: [55, -139, -815],
};

// Site → segment (primary; overlap) and peripheral nerve (§6.6). Joint primaries are the middle of
// the listed span ([model]); tendon primaries follow the first listed segment, patellar the L4 path.
export const SITE_SEGMENTS = {
  indexTip: { segment: 'C7', overlap: ['C6'], nerve: 'median' },
  palm: { segment: 'C7', overlap: ['C6', 'C8'], nerve: 'median' },
  forearmDorsal: { segment: 'C7', overlap: ['C6', 'C8'], nerve: 'radial' },
  footSole: { segment: 'S1', overlap: ['L5'], nerve: 'tibial' },
  heel: { segment: 'S1', overlap: [], nerve: 'sural' },
  bigToe: { segment: 'L5', overlap: ['L4'], nerve: 'commonFibular' },
  umbilicus: { segment: 'T10', overlap: [], nerve: 'intercostal.T10' },
  foreheadV1: { segment: 'V1', overlap: [], nerve: 'cn5.som' },
  cheekV2: { segment: 'V2', overlap: [], nerve: 'cn5.som' },
  chinV3: { segment: 'V3', overlap: [], nerve: 'cn5.som' },
  bicepsTendon: { segment: 'C5', overlap: ['C6'], nerve: 'musculocutaneous' },
  tricepsTendon: { segment: 'C7', overlap: ['C8'], nerve: 'radial' },
  patellarTendon: { segment: 'L4', overlap: ['L3', 'L2'], nerve: 'femoral' },
  achillesTendon: { segment: 'S1', overlap: ['S2'], nerve: 'tibial' },
  shoulder: { segment: 'C5', overlap: ['C6'], nerve: 'axillary' },
  elbow: { segment: 'C6', overlap: ['C5', 'C7', 'C8'], nerve: 'musculocutaneous' },
  wrist: { segment: 'C7', overlap: ['C6', 'C8'], nerve: 'median' },
  finger: { segment: 'C8', overlap: ['C6', 'C7', 'T1'], nerve: 'median' },
  hip: { segment: 'L3', overlap: ['L2', 'L4', 'L5', 'S1'], nerve: 'femoral' },
  knee: { segment: 'L4', overlap: ['L3', 'L5', 'S1'], nerve: 'femoral' },
  ankle: { segment: 'L5', overlap: ['L4', 'S1', 'S2'], nerve: 'tibial' },
};
// Peripheral nerve of each dermatome key point (§6.6 first table).
export const DERMATOME_NERVE = {
  C2: 'greaterOccipital', C3: 'plexusCervical', C4: 'plexusCervical', C5: 'musculocutaneous', C6: 'radial',
  C7: 'radial', C8: 'ulnar', T1: 'medialCutaneousForearm', T2: 'intercostal.T2', T3: 'intercostal.T3',
  T4: 'intercostal.T4', T5: 'intercostal.T5', T6: 'intercostal.T6', T7: 'intercostal.T7', T8: 'intercostal.T8',
  T9: 'intercostal.T9', T10: 'intercostal.T10', T11: 'intercostal.T11', T12: 'subcostal', L1: 'ilioinguinal',
  L2: 'femoral', L3: 'femoral', L4: 'saphenous', L5: 'commonFibular', S1: 'sural', S2: 'posteriorFemoralCutaneous',
  S3: 'inferiorCluneal',
};

const inPerianalBand = (p) => {
  const b = PARAMS.perianalBand;
  return Math.abs(p[0]) <= b.maxAbsX && p[2] <= b.z0 && p[2] >= b.z1 && p[1] < -60;
};

// Dermatome of a site id ('palm', 'dermatome.C5', 'palm.R') or of a skin point [x, y, z] (nearest
// key point on the same side; a [model] Voronoi approximation of the ISNCSCI map). Returns
// { segment, overlap, nerve, key, distance, pickable } or null.
export function dermatomeAt(q) {
  if (typeof q === 'string') {
    const base = q.replace(/\.(R|L)$/, '');
    if (base === 'dermatome.S4' || base === 'dermatome.S5') {
      return { segment: base.slice(10), overlap: [], nerve: 'pudendal', key: base, distance: 0, pickable: false };
    }
    if (base.startsWith('dermatome.')) {
      const seg = base.slice(10);
      if (!DERMATOME_POINTS[seg]) return null;
      return { segment: seg, overlap: [], nerve: DERMATOME_NERVE[seg], key: base, distance: 0, pickable: true };
    }
    const s = SITE_SEGMENTS[base];
    return s ? { ...s, key: base, distance: 0, pickable: true } : null;
  }
  if (inPerianalBand(q)) return { segment: 'S4', overlap: ['S5'], nerve: 'pudendal', key: 'dermatome.S4', distance: 0, pickable: false };
  const side = q[0] < 0 ? -1 : 1;
  let best = null, bd = Infinity;
  for (const [seg, p] of Object.entries(DERMATOME_POINTS)) {
    const s = sided(p, side);
    const d = Math.hypot(q[0] - s[0], q[1] - s[1], q[2] - s[2]);
    if (d < bd) { bd = d; best = seg; }
  }
  return { segment: best, overlap: [], nerve: DERMATOME_NERVE[best], key: `dermatome.${best}`, distance: bd, pickable: true };
}
