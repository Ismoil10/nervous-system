// Reference body geometry (research/ANALYSIS.md §2, §13.2–§13.3) in the MNI-identical body frame
// (frame.js, A.2): the skin signed-distance field of a neutral, sex-neutral clinical mannequin
// (A.1: no genital, nipple, navel or hair geometry; pelvic anatomy only as schematic nerves and
// plexuses, bladder, rectum and an unlabelled pelvic-floor field), the solid and hollow organs,
// sense organs, the gut tube with its drawn arc sDraw, the great vessels, the autonomic ganglia,
// every nerve route of §2.12 as a Catmull–Rom spline (u = 0 at the CNS end), the muscle centres,
// the stimulus sites and the §2.14 standard path lengths.
//
// For the kernel: `PATHS` lists every route with its id, waypoint polyline (`pts`, mm) and its
// length `len` (polyline sum over the waypoints, the §2.14 definition used for conduction delays).
// `nervePath(nerve, { root, side })` re-roots a plexus nerve at another of its segments.
//
// Assumptions (B.4 is silent): brain-side CNS ends of the cranial routes use the §3.16 attachment
// coordinates copied into BRAIN_ANCHORS below; node and path indices in the GPU records index
// NODE_IDS and PATHS of this module, which graph.js is expected to adopt.

import { spline, mulberry32 } from '../anatomy.js';
import {
  PARAMS as FRAME, SEGMENTS, SEG_INDEX, CORD, drg, rootPath, rootLength, polylineLength, canalAt, sided,
  sideSuffix, DERMATOME_POINTS, SITE_SEGMENTS, DERMATOME_NERVE, CORD_ARC_CONUS, VERTEBRA, CANAL,
} from './frame.js';

// ---------------------------------------------------------------------------------------------
// Parameters (every constant cites its owner section; [model] = design choice of this project)
// ---------------------------------------------------------------------------------------------
export const PARAMS = {
  kNeckTorso: 15,         // §13.2 smooth-union radius neck–torso
  kTorsoLimb: 15,         // §13.2 smooth-union radius torso–limb
  kJoint: 3,              // [model] limb segment onto the next at a joint: their sections match there, and a
                          // larger radius inflates the overlap by k/4 (a band round the knee and the elbow)
  kHand: 8,               // §13.2 hand, foot and digits
  kCrotch: 40,            // §13.2 crotch fillet radius (smooth surface into the thighs; A.1)
  mandibleSlope: 0.398,   // §2.3 mandibular plane z = −125 − 0.398·(y + 5)
  gutSeed: 4726,          // [model] fixed geometry seed of the jejunoileum and sigmoid walks (tier-independent, §13.4)
  gutWalkStep: 10,        // [model] mm per random-walk step of the jejunoileum and sigmoid
  gutClearance: 3,        // §2.9 walks keep 3 mm from colon, stomach, duodenum, pancreas, bladder
  gutWallMin: 15,         // §2.15 abdominal wall over gut ≥ 15 mm
  bladderRefVolume: 300,  // [model] mL at which the bladder shell is generated (law §2.8; state bladderVol §7)
  bladderAspect: 2.17,    // §2.8 1.4 × 1.55
  carveGap: 3,            // §2.8 3 mm gap where neighbouring organs press
  minGanglionRadius: 4,   // §13.3 minimum drawn ganglion radius
  tortuosity: 1.15,       // [model] straight-line fallback for sites without a §2.12 route
  siteSnapMax: 25,        // §2.7 skin sites are placements on the drawn skin: snapped onto this field when ≤ 25 mm off
};

// Site ids that are never pickable (A.1; §13.12) and the posterior-only S3 key point.
export const NEVER_PICKABLE = new Set(['dermatome.S4', 'dermatome.S5', 'perineum', 'pelvicFloor']);
export const POSTERIOR_ONLY = new Set(['dermatome.S3']);

// Display network bits of the GPU record (B.7).
export const NET = { SA: 1, SE: 2, SY: 4, PA: 8, VA: 16, EN: 32, NE: 64, NI: 128 };
// Tissue classes = the nine §13.4 budget groups (B.7).
export const TISSUE = { skin: 0, organ: 1, muscle: 2, bone: 3, cord: 4, nerve: 5, ganglion: 6, enteric: 7, vessel: 8 };
export const TISSUE_NAMES = Object.keys(TISSUE);

// ---------------------------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------------------------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => len3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm = (a) => { const l = len3(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const PROFILE_ROUND = 10;   // mm: past a joint a limb section shrinks by e²/(2·10), e mm beyond it (makeProfile)
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); }
function smax(a, b, k) { return -smin(-a, -b, k); }
export { dist, norm, cross, lerp3, len3 };

// Ellipsoid (approximate, as anatomy.js), scalar form for the hot path.
function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) {
  const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz;
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const k1 = Math.sqrt(qx * qx / (rx * rx) + qy * qy / (ry * ry) + qz * qz / (rz * rz));
  return k0 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
// Ellipsoid with a bounded gradient inside: there the conservative distance (k0 − 1)·min(r). The
// k0(k0 − 1)/k1 estimate swings near the centre of a flat ellipsoid, which shows in a carve (the eye
// fissure) and in a smooth union of flat parts (the lips).
function sdEllCarve(x, y, z, e) {
  const qx = (x - e.c[0]) / e.r[0], qy = (y - e.c[1]) / e.r[1], qz = (z - e.c[2]) / e.r[2];
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k0 < 1 ? (k0 - 1) * Math.min(e.r[0], e.r[1], e.r[2]) : sdEll(x, y, z, e.c[0], e.c[1], e.c[2], e.r[0], e.r[1], e.r[2]);
}
function sdEllipse2(x, y, a, b) {
  const qx = x / a, qy = y / b;
  const k0 = Math.sqrt(qx * qx + qy * qy);
  const k1 = Math.sqrt(qx * qx / (a * a) + qy * qy / (b * b));
  return k0 < 1e-9 ? -Math.min(a, b) : k0 * (k0 - 1) / k1;
}
// Capsule with a radius that varies linearly along the segment (approximate round cone).
function sdCone(x, y, z, a, ra, b, rb) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const t = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
  return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
}
export function sdEllipsoid(p, c, r) { return sdEll(p[0], p[1], p[2], c[0], c[1], c[2], r[0], r[1], r[2]); }

// ---------------------------------------------------------------------------------------------
// Head soft tissue and sense organs (§2.3)
// ---------------------------------------------------------------------------------------------
export const HEAD = {
  scalp: { c: [0, -17, 12], r: [80, 99, 77] },          // §2.3 headEnv.scalp (picking volume only; the skin is HEAD_FORM)
  neck: { c: [0, -15], r: [60, 58], z0: -95, z1: -200 }, // §2.3 headEnv.neck (elliptic cylinder; skin regions only)
  nasion: [0, 87, -40], pronasale: [0, 108, -82], subnasale: [0, 96, -94], // §2.3 headEnv.nose
  pinna: { c: [80, -24, -45], r: [8, 15, 30] },         // §2.3 pinna.R (picking volume only; the skin is HEAD_FORM.ear)
  cornealApex: [33, 72, -38],                           // §2.3, A.2
  eye: { c: [33, 60, -38], r: 12 },                     // §2.3 eye.R
  retinaPole: [33, 48, -38], retinaR: 11,               // §2.3 retina.R shell
  extraocular: { c: [30, 42, -38], r: [10, 14, 10] },   // §2.3 cone
  cochlea: { c: [39, -22, -45], r: 5 },                 // §2.3
  vestLabyrinth: { c: [42, -28, -43], r: 10 },          // §2.3 ≈ 20 across
  stapedius: { c: [47, -27, -45], r: [3, 3, 3] },       // §2.3
  meatus: [74, -24, -46], porus: [22, -32, -42],        // §2.3
  olfEpith: { c: [5, 45, -40], r: [3, 10, 4] },         // §2.3
  cribriform: [6, 40, -33],                             // §2.3
  tongue: { c: [0, 55, -110], r: [25, 35, 16] },        // §2.3
  tongueAnt: [12, 75, -97], tonguePost: [12, 30, -100], tonguePatchR: 10, // §2.3
  hyoid: [0, 25, -145],                                 // §2.3
  larynx: { c: [0, 30, -158.5], r: [15, 12, 13.5] },    // §2.3
  iris: { inner: 2, outer: 6 },                         // [model] iris ring around the dark pupil disc (§13.2); pupil 4.0 mm (§7)
};

// Head and face form (research/BODY-FORM.md §8): cranium, face skeleton and soft tissue, nose, lips,
// eyelids and auricle, placed on the §2.3 points (nasion, pronasale, subnasale, corneal apex, eye,
// meatus) and sized to the craniofacial norms of §8.1. Right side; the head is evaluated at |x|.
export const HEAD_FORM = {
  // Cranium: the vault, the wide temporal base at ear level, the occiput and nape over the cerebellum.
  vault: { c: [0, -18, 14], r: [77, 94, 76] },
  frontal: { c: [0, 14, 14], r: [66, 72, 72] },
  temporal: { c: [0, -20, -36], r: [74, 74, 42] },
  occiput: { c: [0, -62, -50], r: [64, 50, 40] },
  kCranium: 22,
  // Face skeleton and soft tissue.
  midface: { c: [0, 32, -74], r: [57, 50, 52] },          // upper face; clipped below by the mandibular plane
  lowerFace: { c: [0, 26, -120], r: [50, 54, 40] },       // cheeks over the masseters and the jaw, down to the mandibular plane
  cheekbone: { c: [53, 48, -60], r: [17, 10, 10] },      // malar eminence and zygion (bizygomatic ≈ 138)
  cheek: { c: [33, 48, -90], r: [21, 30, 32] },
  muzzle: { c: [0, 64, -116], r: [38, 26, 28] },         // dental arches under the lips
  chin: { c: [0, 77, -146], r: [18, 12, 13] },           // soft-tissue pogonion y ≈ 89
  brow: { a: [0, 82, -27], b: [42, 70, -27], r: 9 },     // supraorbital ridge; glabella y ≈ 90
  // Eyes: the orbit is recessed, the lids wrap the eye (§2.3 eye.R) and part in an almond fissure
  // about 30 × 11 mm around the corneal apex.
  orbit: { c: [33, 80, -35], r: [17, 10, 12] },
  lidR: 13.6,
  fissure: { r: [15, 7, 5.5] },
  // Nose on the §2.3 points: dorsum from the nasion to the tip, the lobule, the alae (width ≈ 34).
  dorsum: [[0, 6, 5, -5, 0], [0.45, 7.5, 7, -7, 0], [1, 9, 8, -8, 0]],
  lobule: { c: [0, 99, -83], r: [10, 9, 8.5] },
  ala: { c: [10, 89, -89], r: [7, 8, 6.5] },
  kNose: 5,
  // Lips (mouth width ≈ 52, stomion z ≈ −115) and the crease between them.
  upperLip: { c: [0, 87, -106], r: [24, 9, 7] },
  lowerLip: { c: [0, 85, -124], r: [22, 10, 8.5] },
  stomion: { c: [0, 97, -115.5], r: [25, 11], half: 1.3 },   // a thin horizontal slab: the mouth line
  // Auricle: an oval plate (length 62, width 34) with a rolled helix, the concha around the meatus
  // and the lobule. Its lateral face turns 25° forward from the side of the head and its long axis
  // leans 15° back.
  ear: { attach: [70, -9, -49], turn: 25, lean: 15, half: [17, 31], thick: 2.6, helix: 3.2 },
  kFace: 12,
};
// Local frame of the auricle: U along its width (back and out), V up its length, N its lateral face.
const EAR = (() => {
  const E = HEAD_FORM.ear, th = (E.turn * Math.PI) / 180, le = (E.lean * Math.PI) / 180;
  const U = [Math.sin(th), -Math.cos(th), 0];
  let V = [0, -Math.sin(le), Math.cos(le)];
  const dv = V[0] * U[0] + V[1] * U[1] + V[2] * U[2];
  V = norm([V[0] - dv * U[0], V[1] - dv * U[1], V[2] - dv * U[2]]);
  const N = cross(V, U);
  return { A: E.attach, U, V, N: N[0] > 0 ? N : [-N[0], -N[1], -N[2]] };
})();
const NOSE = makeProfile(HEAD.nasion, HEAD.pronasale, HEAD_FORM.dorsum);
const ellF = (e, x, y, z) => sdEllCarve(x, y, z, e);   // head, hand and foot parts: bounded inside too
const capF = (s, x, y, z) => sdCone(x, y, z, s.a, s.r, s.b, s.r);

// Signed distance to the almond eye fissure (negative inside the opening); the skin is carved there.
export function eyeFissure(x, y, z) {
  const a = HEAD.cornealApex;
  return sdEllCarve(Math.abs(x), y, z, { c: [a[0], a[1] + 2, a[2]], r: HEAD_FORM.fissure.r });
}
function sdEar(x, y, z) {
  const E = HEAD_FORM.ear, F = EAR;
  const px = x - F.A[0], py = y - F.A[1], pz = z - F.A[2];
  const s = px * F.U[0] + py * F.U[1] + pz * F.U[2] - E.half[0];
  const t = px * F.V[0] + py * F.V[1] + pz * F.V[2];
  const w = px * F.N[0] + py * F.N[1] + pz * F.N[2];
  const e = sdEllipse2(s, t, E.half[0], E.half[1]);
  let d = smax(e, Math.abs(w - 1) - E.thick, 1.5);                       // the plate
  d = smin(d, Math.hypot(e + E.helix, w - 2.2) - E.helix, 2);             // the helix rim
  d = smin(d, sdEll(s, t, w, -4, -25, 1, 10, 8, 4.6), 3);                // the lobule
  d = smax(d, -sdEllCarve(s, t, w, { c: [-5, -3, 8.5], r: [9.5, 12, 7.5] }), 2);   // the concha
  d = smin(d, sdEll(s, t, w, -15.5, -4, 1.5, 4, 6, 4), 2);               // the tragus
  return d;
}

function sdHead(x, y, z) {   // x = |x|
  const H = HEAD_FORM, kc = H.kCranium, kf = H.kFace;
  // Cranium.
  let d = ellF(H.vault, x, y, z);
  d = smin(d, ellF(H.frontal, x, y, z), kc);
  d = smin(d, ellF(H.temporal, x, y, z), kc);
  d = smin(d, ellF(H.occiput, x, y, z), kc);
  // Face: the midface down to the mandibular plane, then the bony prominences and the jaw.
  const m = PARAMS.mandibleSlope;
  const below = ((-125 - m * (y + 5)) - z) / Math.sqrt(1 + m * m);   // > 0 under the mandibular plane
  let f = smax(smin(ellF(H.midface, x, y, z), ellF(H.lowerFace, x, y, z), 20), below, 8);
  f = smin(f, ellF(H.cheek, x, y, z), kf);
  f = smin(f, ellF(H.cheekbone, x, y, z), 18);
  f = smin(f, ellF(H.muzzle, x, y, z), 10);
  f = smin(f, ellF(H.chin, x, y, z), 9);
  d = smin(d, f, 14);
  d = smin(d, capF(H.brow, x, y, z), 10);
  // Eyes: recess the orbit, wrap the lids round the eye, open the fissure.
  const eye = HEAD.eye.c;
  d = smax(d, -sdEllCarve(x, y, z, H.orbit), 6);
  d = smin(d, len3(x - eye[0], y - eye[1], z - eye[2]) - H.lidR, 6);
  d = smax(d, -eyeFissure(x, y, z), 1.5);
  // Nose.
  if (x < 40 && y > 50 && z < -25 && z > -110) {
    let n = sdProfile(NOSE, x, y, z);
    n = smin(n, ellF(H.lobule, x, y, z), 4);
    n = smin(n, ellF(H.ala, x, y, z), 3);
    d = smin(d, n, H.kNose);
  }
  // Lips and the mouth line.
  if (x < 50 && y > 50 && z < -90 && z > -140) {
    d = smin(d, smin(ellF(H.upperLip, x, y, z), ellF(H.lowerLip, x, y, z), 3), 5);
    const S = H.stomion, e2 = sdEllipse2(x, y - S.c[1], S.r[0], S.r[1]), ez = Math.abs(z - S.c[2]) - S.half;
    d = smax(d, -(Math.hypot(Math.max(e2, 0), Math.max(ez, 0)) + Math.min(Math.max(e2, ez), 0)), 1.2);
  }
  // Auricle.
  if (x > 55 && y < 25 && y > -75 && z < 0 && z > -100) d = smin(d, sdEar(x, y, z), 3);
  return d;
}
function sdNeck(x, y, z) {
  const N = HEAD.neck;
  const d2 = sdEllipse2(x - N.c[0], y - N.c[1], N.r[0], N.r[1]);
  const e = Math.max(z - N.z0, N.z1 - z);
  return e > 0 ? (d2 > 0 ? Math.hypot(d2, e) : e) : (d2 > 0 ? d2 : Math.max(d2, e));
}

// ---------------------------------------------------------------------------------------------
// Trunk, limbs and joints (§2.6)
// ---------------------------------------------------------------------------------------------
export const TORSO = {   // §2.6 torso sections, centre (0, y, z), half-breadth × half-depth
  z: [-185, -260, -370, -420, -560, -600, -740, -835],
  y: [-20, -20, -15, -15, -10, -12, -20, -20],
  a: [65, 170, 165, 155, 145, 160, 175, 175],
  b: [60, 120, 125, 120, 110, 115, 125, 125],
};
// [model] shoulder line (trapezius and clavicle) from the neck base to above the acromion; the
// lofted sections alone leave a notch between the neck and the arm.
export const SHOULDER = { a: [25, -25, -190], ra: 32, b: [150, -22, -245], rb: 22 };

export const JOINTS = {   // §2.6 (right side)
  shoulder: [185, -25, -268], elbow: [195, -30, -563], wrist: [232, -22, -818], palmC: [238, -15, -870],
  finger: [248, -15, -918], hip: [88, -10, -732], knee: [80, -32, -1170], ankle: [78, -45, -1603],
};
export const LANDMARKS = {   // §2.6, §2.7 (right side where sided)
  'lm.acromion': [200, -20, -232], 'lm.shoulderTop': [200, -20, -220], 'lm.cervicale': [0, -110, -185],
  'lm.jugularNotch': [0, 60, -229], 'lm.sternalAngle': [0, 80, -280], 'lm.xiphoid': [0, 92, -388],
  'lm.iliacCrest': [150, -30, -587], 'lm.asis': [118, 50, -700], 'lm.pubicTubercle': [25, 60, -745],
  'lm.trochanter': [170, -20, -739], 'lm.symphysis': [0, 55, -757], 'lm.mastoid': [55, -40, -70], 'lm.gonion': [50, -5, -125],
};
export const LIMB = {
  upperArmR: [50, 40],                                  // §2.6 limb radii, upper arm 50 → 40
  forearmKeys: [[0, 42, 42], [0.25, 45, 40], [1, 30, 20]], // §2.6 forearm (mediolateral × AP)
  thighR: [95, 60],                                     // §2.6 thigh 95 → 60
  legKeys: [[0, 60, 60], [120 / 433, 62, 62], [1, 37, 37]], // §2.6 leg 60 → 62 (calf, z −1,290) → 37
  fingerR: 9, thumbR: 11,                               // §2.6
  // Digit bases ([model]) and tips (§2.6 fingertips; ring tip interpolated [model]).
  digits: [
    { id: 'thumb', base: [266, -10, -848], tip: [282, 0, -930], r: 11.5 },
    { id: 'index', base: [254, -14, -916], tip: [258, -15, -1000], r: 9.5 },
    { id: 'middle', base: [237, -14, -920], tip: [240, -15, -1008], r: 9.5 },
    { id: 'ring', base: [220, -14, -916], tip: [222, -15, -1000], r: 9 },
    { id: 'little', base: [204, -14, -906], tip: [205, -15, -985], r: 8 },
  ],
};

const TORSO_SLOPE = (() => {   // per interval: max |Δ| / Δz × 1.5 (smoothstep peak), for the Lipschitz bound
  const T = TORSO, s = [];
  for (let i = 0; i < T.z.length - 1; i++) {
    const dz = T.z[i] - T.z[i + 1];
    s.push(1.5 * Math.max(Math.abs(T.a[i + 1] - T.a[i]), Math.abs(T.b[i + 1] - T.b[i]), Math.abs(T.y[i + 1] - T.y[i])) / dz);
  }
  return s;
})();
// Torso section at height z: { yc, a, b, slope } with smooth interpolation between the §2.6 rows.
export function torsoSection(z) {
  const T = TORSO, n = T.z.length;
  const zc = clamp(z, T.z[n - 1], T.z[0]);
  let i = 0;
  while (i < n - 2 && T.z[i + 1] > zc) i++;
  const t = (T.z[i] - zc) / (T.z[i] - T.z[i + 1]);
  const s = t * t * (3 - 2 * t);
  return {
    yc: T.y[i] + (T.y[i + 1] - T.y[i]) * s, a: T.a[i] + (T.a[i + 1] - T.a[i]) * s,
    b: T.b[i] + (T.b[i + 1] - T.b[i]) * s, slope: TORSO_SLOPE[i],
  };
}
export function sdTorso(x, y, z) {
  const T = TORSO, top = T.z[0], bot = T.z[T.z.length - 1];
  const s = torsoSection(z);
  const d2 = sdEllipse2(x, y - s.yc, s.a, s.b) / Math.sqrt(1 + s.slope * s.slope);
  const e = Math.max(z - top, bot - z);
  return e > 0 ? (d2 > 0 ? Math.hypot(d2, e) : e) : (d2 > 0 ? d2 : Math.max(d2, e));
}

// Tapered limb segment with elliptical sections [rx lateral, ry anterior] interpolated over t.
function makeLimb(a, b, keys) {
  const w = norm(sub(b, a)), L = dist(a, b);
  const u = norm([1 - w[0] * w[0], -w[0] * w[1], -w[0] * w[2]]);
  const v = cross(u, w);   // anterior for a limb pointing down
  return { a, b, w, L, u, v, keys };
}
function limbRadii(l, t) {
  const k = l.keys;
  if (t <= k[0][0]) return [k[0][1], k[0][2]];
  for (let i = 0; i < k.length - 1; i++) {
    if (t <= k[i + 1][0]) {
      const f = (t - k[i][0]) / (k[i + 1][0] - k[i][0]);
      return [k[i][1] + (k[i + 1][1] - k[i][1]) * f, k[i][2] + (k[i + 1][2] - k[i][2]) * f];
    }
  }
  const e = k[k.length - 1];
  return [e[1], e[2]];
}
function sdLimb(l, x, y, z) {
  const px = x - l.a[0], py = y - l.a[1], pz = z - l.a[2];
  const s = px * l.w[0] + py * l.w[1] + pz * l.w[2];
  const t = s / l.L;
  if (t < 0) { const r = limbRadii(l, 0); return len3(px, py, pz) - 0.5 * (r[0] + r[1]); }
  if (t > 1) { const r = limbRadii(l, 1); return len3(x - l.b[0], y - l.b[1], z - l.b[2]) - 0.5 * (r[0] + r[1]); }
  const qx = px - l.w[0] * s, qy = py - l.w[1] * s, qz = pz - l.w[2] * s;
  const cu = qx * l.u[0] + qy * l.u[1] + qz * l.u[2], cv = qx * l.v[0] + qy * l.v[1] + qz * l.v[2];
  const r = limbRadii(l, t);
  return sdEllipse2(cu, cv, r[0], r[1]);
}
// Limb axis segments (right side) for body regions and rigid segments.
export const LIMBS = {
  upperArm: makeLimb(JOINTS.shoulder, JOINTS.elbow, [[0, LIMB.upperArmR[0], LIMB.upperArmR[0]], [1, LIMB.upperArmR[1], LIMB.upperArmR[1]]]),
  forearm: makeLimb(JOINTS.elbow, JOINTS.wrist, LIMB.forearmKeys),
  thigh: makeLimb(JOINTS.hip, JOINTS.knee, [[0, LIMB.thighR[0], LIMB.thighR[0]], [1, LIMB.thighR[1], LIMB.thighR[1]]]),
  leg: makeLimb(JOINTS.knee, JOINTS.ankle, LIMB.legKeys),
};
// Hand (BODY-FORM.md §9): a palm of two blended masses, from the wrist (≈ 58 × 30) to the knuckles
// (≈ 76 × 27), and digits of three phalanges that taper and bow slightly towards the palm
// (a relaxed hand); the skin passes through the §2.6 fingertips.
export const HAND_FORM = {
  carpus: { c: [231, -21, -840], r: [32, 21, 32] },   // base of the palm; covers the forearm's wrist cap
  metacarpus: { c: [229.5, -16, -888], r: [41, 13.5, 32] },   // the palm proper, to the knuckles (breadth ≈ 80)
  hypothenar: { c: [208, -10, -874], r: [11, 10, 28] },
  joints: [0.47, 0.76],                                // PIP and DIP along each finger (thumb: MCP, IP)
  taper: [1, 0.92, 0.84, 0.74],                        // radius at base, PIP, DIP, tip (× r)
  bow: 4,                                              // mm towards the palm at the middle joints
};
const DIGITS = LIMB.digits.map((g) => {
  const T = HAND_FORM.taper, [j1, j2] = HAND_FORM.joints, ax = norm(sub(g.tip, g.base)), L = dist(g.base, g.tip);
  const rEnd = g.r * T[3], end = [g.tip[0] - ax[0] * rEnd, g.tip[1] - ax[1] * rEnd, g.tip[2] - ax[2] * rEnd];
  const at = (f, bow) => { const p = lerp3(g.base, end, f * L / (L - rEnd)); return [p[0], p[1] + bow, p[2]]; };
  const bow = g.id === 'thumb' ? 0 : HAND_FORM.bow;
  return { ...g, pts: [g.base, at(j1, bow), at(j2, bow * 0.8), end], rs: T.map((k) => g.r * k) };
});
function sdHand(x, y, z) {
  const H = HAND_FORM;
  let d = smin(ellF(H.carpus, x, y, z), ellF(H.metacarpus, x, y, z), 14);
  d = smin(d, ellF(H.hypothenar, x, y, z), 10);
  for (const D of DIGITS) {
    let f2 = sdCone(x, y, z, D.pts[0], D.rs[0], D.pts[1], D.rs[1]);
    f2 = smin(f2, sdCone(x, y, z, D.pts[1], D.rs[1], D.pts[2], D.rs[2]), 2);
    f2 = smin(f2, sdCone(x, y, z, D.pts[2], D.rs[2], D.pts[3], D.rs[3]), 2);
    d = smin(d, f2, PARAMS.kHand);
  }
  return d;
}
// Foot (BODY-FORM.md §9): a rounded heel, a body whose section rises to the instep under the ankle
// and flattens to the ball, a flat sole lifted under the medial arch, and five toes, the big toe
// medial. Footprint of §2.6: heel contact (78, −95), toe tip (≈ 75, 173), half-breadth ≈ 47.
export const FOOT_FORM = {
  heel: { c: [78, -63, -1640], r: [32, 32, 35] },
  body: { a: [78, -58, -1640], b: [98, 96, -1650], keys: [[0, 31, 34, 0, 0], [0.32, 36, 40, 0, 0], [0.7, 44, 28, 0, 0], [1, 46, 21, 0, 0]] },
  ball: { c: [100, 104, -1654], r: [50, 22, 18] },   // the ball of the foot under the metatarsal heads (breadth ≈ 100)
  arch: { c: [52, 30, -1677], r: [22, 62, 13] },
  toes: [   // [base, base radius, tip end, tip radius]: big toe to little toe
    [[70, 126, -1656], 12, [75, 160, -1660], 11.5], [[92, 126, -1660], 8.5, [96, 155, -1663], 8],
    [[107, 120, -1661], 8, [110, 148, -1664], 7.5], [[120, 113, -1662], 7.5, [123, 139, -1665], 7],
    [[132, 104, -1663], 7, [135, 126, -1666], 6.5],
  ],
};
const FOOT_BODY = makeProfile(FOOT_FORM.body.a, FOOT_FORM.body.b, FOOT_FORM.body.keys, false);
function sdFoot(x, y, z) {
  const F = FOOT_FORM;
  let d = smin(ellF(F.heel, x, y, z), sdProfile(FOOT_BODY, x, y, z), 10);
  d = smin(d, ellF(F.ball, x, y, z), 10);
  for (const t of F.toes) d = smin(d, sdCone(x, y, z, t[0], t[1], t[2], t[3]), 4);
  d = smax(d, -sdEllCarve(x, y, z, F.arch), 6);
  return smax(d, FRAME.floorZ - z, 3);   // the sole stands on the floor
}
// ---------------------------------------------------------------------------------------------
// Skin form (research/BODY-FORM.md): the outer surface built from an analysis of the human shape
// (ANSUR II, neutral at 1,760 mm; the head and face to the craniofacial norms of §8). The joints,
// landmarks and the internal trunk field sdTorso (gut, regions, rigid segments) are unchanged; only
// the skin takes this form. The neck is part of the torso sections.
// ---------------------------------------------------------------------------------------------
// Torso sections every 40–80 mm (BODY-FORM.md §2, §3, §5): z, half-breadth a, front yf, back yb,
// superellipse exponents of the front and back halves. The line of greatest breadth lies at
// ym = yb + 0.45·(yf − yb). Values interpolate with a Catmull–Rom spline over z.
export const FORM = {
  torso: [
    //  z     a    yf    yb    nf   nb
    [ -70,  48,  20,  -76, 2.0, 2.0],   // under the skull base (inside the head)
    [-110,  52,  30,  -80, 1.9, 2.1],   // upper neck; the nape under the occiput
    [-150,  55,  42,  -82, 1.9, 2.1],   // hyoid and larynx (front y 42); girth ≈ 375
    [-185,  60,  50,  -92, 2.0, 2.2],   // neck base, towards the C7 spine
    [-225, 120,  63, -106, 2.0, 2.3],   // jugular notch (y 60), clavicles; the trapezius slopes out
    [-250, 142,  73, -118, 2.2, 2.4],   // clavicles to the acromia: the front of the shoulder is full, not a shelf
    [-270, 150,  82, -128, 2.5, 2.5],   // sternal angle (y 80); axilla skin (T2 site at x 150)
    [-330, 150, 103, -140, 2.8, 2.6],   // pectoral level; lungs reach x ±140
    [-390, 148,  96, -136, 2.5, 2.5],   // xiphoid (y 92)
    [-450, 150,  90, -126, 2.2, 2.4],   // costal margin; liver to x 134
    [-520, 150,  92, -112, 2.1, 2.3],   // upper abdomen; the lumbar curve begins
    [-590, 148,  98, -110, 2.1, 2.3],   // waist, just above the iliac crest (150, −30, −587)
    [-650, 162, 100, -122, 2.2, 2.3],   // iliac crest and lower abdomen
    [-720, 175,  92, -138, 2.3, 2.3],   // trochanters (170, −20, −739); the back fills towards the buttocks
    [-780, 170,  72, -128, 2.3, 2.2],   // sacrum and the intergluteal cleft (S4 y −128); symphysis y 55
    [-835, 160,  55, -125, 2.2, 2.1],   // crotch level
  ],
  // Muscle masses and bony prominences (right side; c, r in mm; k = smooth-union radius).
  trapezius: { a: [35, -42, -172], ra: 33, b: [184, -24, -226], rb: 18, k: 20 },
  sternomastoid: { a: [44, -40, -90], ra: 9, b: [14, 54, -220], rb: 8, k: 16 },   // mastoid to the sternal head: the V of the neck
  deltoid: { c: [198, -22, -284], r: [50, 54, 72], k: 18 },     // bideltoid ≈ 496
  pectoral: { c: [64, 58, -322], r: [70, 38, 44], k: 20 },     // a flat plate under the chest front, not a mound
  clavicle: { a: [18, 46, -230], b: [176, -6, -228], r: 10, k: 22 },
  supraclavicular: { a: [36, 6, -196], b: [150, -6, -224], r: 22, k: 24 },   // the slope from the neck base out to the shoulder, in front of the trapezius
  axillaFront: { a: [118, 48, -300], b: [180, 10, -314], r: 18, k: 22 },   // anterior axillary fold (pectoralis major to the arm)
  axillaBack: { a: [112, -114, -312], b: [178, -60, -320], r: 18, k: 22 },  // posterior axillary fold (latissimus, teres major)
  scapula: { c: [80, -112, -300], r: [62, 30, 80], k: 20 },
  gluteal: { c: [80, -100, -768], r: [74, 52, 88], k: 34 },     // a long, flat mass blended into the lower back; fold ≈ z −850; cleft at the midline
  vastusMedialis: { c: [56, -12, -1102], r: [22, 26, 38], k: 20 },
  patella: { c: [80, 20, -1162], r: [20, 8, 24], k: 12 },
  gastrocMedial: { c: [64, -64, -1312], r: [26, 28, 72], k: 18 },
  malleolusLat: { c: [110, -48, -1612], r: [11, 13, 15], k: 8 },
  malleolusMed: { c: [50, -40, -1596], r: [11, 13, 15], k: 8 },
  thenar: { c: [252, -6, -862], r: [16, 12, 24], k: 10 },
  // Limb profiles along the §2.6 joint axes: [t, lateral radius, anterior radius, anterior offset,
  // lateral offset] (mm). The offsets move the section centre: the calf behind the shin, the biceps
  // and quadriceps in front.
  upperArm: [[0, 50, 50, 0, 0], [0.3, 46, 48, 2, 0], [0.55, 44, 48, 4, 0], [0.85, 40, 40, 0, 0], [1, 40, 35, 0, 0]],
  forearm: [[0, 40, 35, 0, 0], [0.22, 45, 40, 0, 0], [0.6, 37, 30, 0, 0], [1, 30, 20, 0, 0]],
  thigh: [[-0.12, 74, 70, 0, 0], [0, 96, 92, 0, 6], [0.18, 100, 96, 4, 4], [0.5, 86, 82, 6, 2], [0.82, 66, 62, 4, 0], [1, 56, 55, 0, 0]],
  leg: [[0, 56, 54, 0, 0], [0.12, 54, 58, -6, 0], [0.28, 60, 66, -14, 2], [0.55, 46, 50, -8, 0], [0.85, 36, 38, -2, 0], [1, 35, 40, 0, 0]],
  distScale: 0.9,   // first-order distances are scaled down so they stay conservative (ray marching)
  // Smooth-union radius of each arm onto the trunk and legs: [below, at the shoulder] and the heights
  // between which it changes. Large over the shoulder (trapezius into deltoid), a crease from the axilla
  // down (along the chest, the flank and the thigh).
  armJoin: [5, 18], armJoinZ: [-345, -265],
};

// Section table at 1-mm steps (built once): a, yf, yb, nf, nb and the steepest |d/dz| for the
// Lipschitz correction. The rows are unevenly spaced, so the spline is a cubic Hermite in z with
// tangents from the neighbouring rows (Catmull–Rom by z): its slope is continuous at every row. A
// spline uniform in the row index changes slope at rows next to a shorter or longer gap, which drew a
// crease line across the chest.
const FORM_TABLE = (() => {
  const R = FORM.torso, top = R[0][0], bot = R[R.length - 1][0], n = Math.round(top - bot) + 1, m = R.length;
  const tan = R.map((r, i) => r.map((_, c) => {   // d/dz at each row
    const a = R[Math.max(0, i - 1)], b = R[Math.min(m - 1, i + 1)];
    return c === 0 ? 0 : (b[c] - a[c]) / (b[0] - a[0]);
  }));
  const tab = new Float32Array(n * 6);
  for (let k = 0; k < n; k++) {
    const z = top - k;
    let i = 0;
    while (i < m - 2 && R[i + 1][0] > z) i++;
    const h = R[i + 1][0] - R[i][0], t = (z - R[i][0]) / h, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (let c = 1; c < 6; c++) tab[k * 6 + c - 1] = h00 * R[i][c] + h10 * h * tan[i][c] + h01 * R[i + 1][c] + h11 * h * tan[i + 1][c];
  }
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(tab[b * 6 + c] - tab[a * 6 + c]) / Math.max(1, b - a));
    tab[k * 6 + 5] = m;
  }
  return { tab, top, bot, n };
})();
export function formSection(z) {   // linear between the 1-mm rows, so the surface has no terraces
  const T = FORM_TABLE, u = Math.min(T.n - 1, Math.max(0, T.top - z)), k = Math.min(T.n - 2, Math.floor(u)), f = u - k;
  const o = k * 6, t = T.tab, g = 1 - f;
  return {
    a: t[o] * g + t[o + 6] * f, yf: t[o + 1] * g + t[o + 7] * f, yb: t[o + 2] * g + t[o + 8] * f,
    nf: t[o + 3] * g + t[o + 9] * f, nb: t[o + 4] * g + t[o + 10] * f, slope: Math.max(t[o + 5], t[o + 11]),
  };
}
// Signed distance to a front/back superelliptic section (first-order estimate (r − 1)/|∇r|).
function sdSection(x, y, s) {
  const ym = s.yb + 0.45 * (s.yf - s.yb), dy = y - ym;
  const depth = dy >= 0 ? s.yf - ym : ym - s.yb, n = dy >= 0 ? s.nf : s.nb;
  const u = x / s.a, v = Math.abs(dy) / depth;
  const r = Math.pow(Math.pow(u, n) + Math.pow(v, n), 1 / n);
  if (r < 1e-6) return -Math.min(s.a, depth);
  const k = Math.pow(r, 1 - n);
  const g = Math.hypot(Math.pow(u, n - 1) * k / s.a, Math.pow(v, n - 1) * k / depth);
  const d = (r - 1) / Math.max(g, 1e-6);
  return r < 1 ? Math.max(d, -Math.min(s.a, depth)) : d * FORM.distScale;
}
function sdTorsoForm(x, y, z) {
  const T = FORM_TABLE, s = formSection(z);
  const d2 = sdSection(x, y, s) / Math.sqrt(1 + s.slope * s.slope);
  const e = Math.max(z - T.top, T.bot - z);
  return e > 0 ? (d2 > 0 ? Math.hypot(d2, e) : e) : (d2 > 0 ? d2 : Math.max(d2, e));
}

// Limb with a profile of keys [t, rx, ry, oy, ox], smoothly interpolated, rounded at both ends.
function makeProfile(a, b, keys, extStart = true, extEnd = 0.3) {
  const l = makeLimb(a, b, keys);
  let slope = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const dt = (keys[i + 1][0] - keys[i][0]) * l.L;
    for (let c = 1; c < 5; c++) slope = Math.max(slope, 1.5 * Math.abs(keys[i + 1][c] - keys[i][c]) / dt);
  }
  // Each segment runs on past its joints by 30 % of its end radius (extEnd at the far end), so two
  // caps never share the joint plane (a crease). Past the joint its section shrinks smoothly
  // (PROFILE_ROUND), so it dips inside the neighbouring segment and leaves no rim: the knee and the
  // elbow are not drums. The upper arm and the thigh start inside the deltoid and the pelvis, so they
  // are not extended there.
  // A first key at t < 0 starts the segment that far above its joint instead, capped there.
  const r0 = keys[0], r1 = keys[keys.length - 1];
  const ext0 = r0[0] < 0 ? -r0[0] * l.L : extStart ? 0.3 * Math.min(r0[1], r0[2]) : 0;
  return { ...l, slope, ext: [ext0, extEnd * Math.min(r1[1], r1[2])], round: [r0[0] < 0 ? 0 : PROFILE_ROUND, PROFILE_ROUND] };
}
function profileAt(keys, t) {
  if (t <= keys[0][0]) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last;
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), s = f * f * (3 - 2 * f);
  const a = keys[i], b = keys[i + 1];
  return [t, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s, a[4] + (b[4] - a[4]) * s];
}
// Inside the segment: the profile section; past either end, the end section continued up to a flat
// cap ext mm beyond the joint (exact at the cap plane, so the field is continuous); the neighbouring
// segment covers the cap.
function sdProfile(l, x, y, z) {
  const px = x - l.a[0], py = y - l.a[1], pz = z - l.a[2];
  const s = px * l.w[0] + py * l.w[1] + pz * l.w[2], t = s / l.L;
  const qx = px - l.w[0] * s, qy = py - l.w[1] * s, qz = pz - l.w[2] * s;
  const cu = qx * l.u[0] + qy * l.u[1] + qz * l.u[2], cv = qx * l.v[0] + qy * l.v[1] + qz * l.v[2];
  const k = profileAt(l.keys, t);
  let d2 = sdEllipse2(cu - k[4], cv - k[3], k[1], k[2]) / Math.sqrt(1 + l.slope * l.slope);
  const past = s < 0 ? (l.ext[0] > 0 ? -s / l.round[0] : 0) : s > l.L ? (s - l.L) / l.round[1] : 0;   // e/w beyond a joint
  if (past > 0 && Number.isFinite(past)) d2 = (d2 + 0.5 * past * past * (s < 0 ? l.round[0] : l.round[1])) / Math.sqrt(1 + past * past);
  const e = Math.max(-s - l.ext[0], s - l.L - l.ext[1]);
  return e > 0 ? (d2 > 0 ? Math.hypot(d2, e) : e) : (d2 > 0 ? d2 : Math.max(d2, e));
}
const PROFILES = {
  upperArm: makeProfile(JOINTS.shoulder, JOINTS.elbow, FORM.upperArm, false),
  forearm: makeProfile(JOINTS.elbow, JOINTS.wrist, FORM.forearm, true, 0.6),   // its wrist cap lies in the carpus
  thigh: makeProfile(JOINTS.hip, JOINTS.knee, FORM.thigh, false),
  leg: makeProfile(JOINTS.knee, JOINTS.ankle, FORM.leg, true, 0.6),             // its ankle cap lies in the foot
};

// Seamless guards: a primitive is skipped only when a lower bound of its distance (to a bounding
// sphere around it) is at least k + margin above the running value, where the smooth union already
// equals the minimum. So no term is ever cut while it shapes the surface (BODY-FORM.md §4 item 7).
const GUARD_MARGIN = 12;
const sphereOf = (pts, r) => {
  const c = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / pts.length;
  return { c, r: Math.max(...pts.map((p) => dist(p, c))) + r };
};
const ellSphere = (e) => ({ c: e.c, r: Math.max(...e.r) });
const limbSphere = (l) => sphereOf([l.a, l.b], Math.max(...l.keys.map((k) => Math.max(k[1], k[2]) + Math.abs(k[3]) + Math.abs(k[4]))));
const BOUNDS = {
  head: { c: [0, 0, -40], r: 175 },
  neck: { c: [0, -15, -147], r: 100 },
  torso: { c: [0, -20, -455], r: 440 },
  trapezius: sphereOf([FORM.trapezius.a, FORM.trapezius.b], FORM.trapezius.ra),
  sternomastoid: sphereOf([FORM.sternomastoid.a, FORM.sternomastoid.b], FORM.sternomastoid.ra),
  clavicle: sphereOf([FORM.clavicle.a, FORM.clavicle.b], FORM.clavicle.r),
  supraclavicular: sphereOf([FORM.supraclavicular.a, FORM.supraclavicular.b], FORM.supraclavicular.r),
  axillaFront: sphereOf([FORM.axillaFront.a, FORM.axillaFront.b], FORM.axillaFront.r),
  axillaBack: sphereOf([FORM.axillaBack.a, FORM.axillaBack.b], FORM.axillaBack.r),
  deltoid: ellSphere(FORM.deltoid), pectoral: ellSphere(FORM.pectoral), scapula: ellSphere(FORM.scapula),
  gluteal: ellSphere(FORM.gluteal), vastusMedialis: ellSphere(FORM.vastusMedialis), patella: ellSphere(FORM.patella),
  gastrocMedial: ellSphere(FORM.gastrocMedial), malleolusLat: ellSphere(FORM.malleolusLat),
  malleolusMed: ellSphere(FORM.malleolusMed), thenar: ellSphere(FORM.thenar),
  upperArm: limbSphere(PROFILES.upperArm), forearm: limbSphere(PROFILES.forearm),
  hand: { c: [240, -12, -912], r: 120 }, foot: { c: [100, 35, -1640], r: 150 },
  thigh: limbSphere(PROFILES.thigh), leg: limbSphere(PROFILES.leg),
};
const armJoin = (z) => {
  const [k0, k1] = FORM.armJoin, [z0, z1] = FORM.armJoinZ, t = clamp((z - z0) / (z1 - z0));
  return k0 + (k1 - k0) * t * t * (3 - 2 * t);
};
const far = (b, x, y, z, d, k) => len3(x - b.c[0], y - b.c[1], z - b.c[2]) - b.r >= d + k + GUARD_MARGIN;
const ell = (e, x, y, z) => sdEll(x, y, z, e.c[0], e.c[1], e.c[2], e.r[0], e.r[1], e.r[2]);
const add = (d, b, k, x, y, z, f) => (far(b, x, y, z, d, k) ? d : smin(d, f(), k));

// One leg (right side at x ≥ 0; called at −|x| for the crotch fillet of the other leg).
function sdLegForm(x, y, z, d0) {
  const F = FORM, B = BOUNDS;
  let d = d0;
  d = add(d, B.thigh, PARAMS.kTorsoLimb, x, y, z, () => sdProfile(PROFILES.thigh, x, y, z));
  d = add(d, B.leg, PARAMS.kJoint, x, y, z, () => sdProfile(PROFILES.leg, x, y, z));
  d = add(d, B.gluteal, F.gluteal.k, x, y, z, () => ell(F.gluteal, x, y, z));
  d = add(d, B.vastusMedialis, F.vastusMedialis.k, x, y, z, () => ell(F.vastusMedialis, x, y, z));
  d = add(d, B.patella, F.patella.k, x, y, z, () => ell(F.patella, x, y, z));
  d = add(d, B.gastrocMedial, F.gastrocMedial.k, x, y, z, () => ell(F.gastrocMedial, x, y, z));
  d = add(d, B.malleolusLat, F.malleolusLat.k, x, y, z, () => ell(F.malleolusLat, x, y, z));
  d = add(d, B.malleolusMed, F.malleolusMed.k, x, y, z, () => ell(F.malleolusMed, x, y, z));
  d = add(d, B.foot, 16, x, y, z, () => sdFoot(x, y, z));
  return d;
}

// Signed distance to the skin (mm; negative inside). Mirror-symmetric, so primitives are
// evaluated at |x|; both thighs enter near the midline for the crotch fillet.
// The trunk (head, neck, torso and its muscle masses, the deltoid caps) is joined to the legs by the
// crotch and hip fillet; each arm is built on its own and joined with a small radius, so it meets the
// shoulder inside the deltoid and leaves a crease along the chest, the flank and the thigh
// (FORM.armJoin).
export function bodySDF(x, y, z) {
  const ax = x < 0 ? -x : x, F = FORM, B = BOUNDS, kn = PARAMS.kNeckTorso, kl = PARAMS.kTorsoLimb;
  let d = 1e9;
  d = add(d, B.torso, kn, ax, y, z, () => sdTorsoForm(ax, y, z));
  d = add(d, B.head, kn, ax, y, z, () => sdHead(ax, y, z));
  d = add(d, B.sternomastoid, F.sternomastoid.k, ax, y, z, () => sdCone(ax, y, z, F.sternomastoid.a, F.sternomastoid.ra, F.sternomastoid.b, F.sternomastoid.rb));
  d = add(d, B.trapezius, F.trapezius.k, ax, y, z, () => sdCone(ax, y, z, F.trapezius.a, F.trapezius.ra, F.trapezius.b, F.trapezius.rb));
  d = add(d, B.pectoral, F.pectoral.k, ax, y, z, () => ell(F.pectoral, ax, y, z));
  d = add(d, B.scapula, F.scapula.k, ax, y, z, () => ell(F.scapula, ax, y, z));
  d = add(d, B.clavicle, F.clavicle.k, ax, y, z, () => capF(F.clavicle, ax, y, z));
  d = add(d, B.supraclavicular, F.supraclavicular.k, ax, y, z, () => capF(F.supraclavicular, ax, y, z));
  d = add(d, B.axillaFront, F.axillaFront.k, ax, y, z, () => capF(F.axillaFront, ax, y, z));
  d = add(d, B.axillaBack, F.axillaBack.k, ax, y, z, () => capF(F.axillaBack, ax, y, z));
  if (z < -560) {   // legs: both of them near the midline, joined by the crotch fillet
    if (!far(B.thigh, ax, y, z, d, PARAMS.kCrotch) || z < -1000) {
      let l = sdLegForm(ax, y, z, 1e9);
      if (ax < 160) l = smin(l, sdLegForm(-ax, y, z, 1e9), PARAMS.kCrotch);
      d = smin(d, l, PARAMS.kCrotch);
    }
  }
  const kj = armJoin(z), kg = F.armJoin[1];
  if (!far(B.deltoid, ax, y, z, d, kg) || !far(B.upperArm, ax, y, z, d, kg) || !far(B.forearm, ax, y, z, d, kg) || !far(B.hand, ax, y, z, d, kg)) {
    let a = sdProfile(PROFILES.upperArm, ax, y, z);
    a = add(a, B.forearm, PARAMS.kJoint, ax, y, z, () => sdProfile(PROFILES.forearm, ax, y, z));
    a = add(a, B.deltoid, F.deltoid.k, ax, y, z, () => ell(F.deltoid, ax, y, z));
    a = add(a, B.thenar, F.thenar.k, ax, y, z, () => ell(F.thenar, ax, y, z));
    a = add(a, B.hand, PARAMS.kHand, ax, y, z, () => sdHand(ax, y, z));
    d = smin(d, a, kj);
  }
  return d;
}
export function bodyNormal(x, y, z, e = 0.5) {
  const nx = bodySDF(x + e, y, z) - bodySDF(x - e, y, z);
  const ny = bodySDF(x, y + e, z) - bodySDF(x, y - e, z);
  const nz = bodySDF(x, y, z + e) - bodySDF(x, y, z - e);
  return norm([nx, ny, nz]);
}
// Pull a point onto the skin along the field gradient (a few Newton steps).
export function snapToSkin(p, iters = 4) {
  let q = [p[0], p[1], p[2]];
  for (let i = 0; i < iters; i++) {
    const d = bodySDF(q[0], q[1], q[2]);
    if (Math.abs(d) < 0.05) break;
    const n = bodyNormal(q[0], q[1], q[2]);
    q = [q[0] - n[0] * d, q[1] - n[1] * d, q[2] - n[2] * d];
  }
  return q;
}
export const BODY_BOUNDS = { min: [-300, -160, FRAME.floorZ - 8], max: [300, 190, 100] }; // §2.2 extent + margin

// Lund–Browder skin regions (§13.2) and the region of a skin point (nearest primitive).
export const SKIN_REGIONS = ['head', 'neck', 'trunkAnt', 'trunkPost', 'buttocks', 'perineum',
  'upperArm', 'forearm', 'hand', 'thigh', 'leg', 'foot'];
export const SKIN_REGION_INDEX = Object.fromEntries(SKIN_REGIONS.map((r, i) => [r, i]));
export function skinRegion(x, y, z) {
  const ax = Math.abs(x);
  let best = 'head', bd = z > -190 ? sdHead(ax, y, z) : 1e9;
  const test = (name, d) => { if (d < bd) { bd = d; best = name; } };
  if (z < -70 && z > -225) test('neck', sdNeck(ax, y, z));
  if (z < -140 && z > -880) test('trunk', Math.min(sdTorso(ax, y, z), z > -300 ? sdCone(ax, y, z, SHOULDER.a, SHOULDER.ra, SHOULDER.b, SHOULDER.rb) : 1e9));
  if (ax > 112 && z < -192 && z > -1030) {
    test('upperArm', sdCone(ax, y, z, JOINTS.shoulder, LIMB.upperArmR[0], JOINTS.elbow, LIMB.upperArmR[1]));
    test('forearm', sdLimb(LIMBS.forearm, ax, y, z));
    if (z < -780) test('hand', sdHand(ax, y, z));
  }
  if (z < -590) {
    test('thigh', z > -1230 ? sdCone(ax, y, z, JOINTS.hip, LIMB.thighR[0], JOINTS.knee, LIMB.thighR[1]) : 1e9);
    if (z < -1080) test('leg', sdLimb(LIMBS.leg, ax, y, z));
    if (z < -1560) test('foot', sdFoot(ax, y, z));
  }
  if (best !== 'trunk') return best;
  if (ax < 40 && z < -805) return 'perineum';
  const yc = torsoSection(z).yc;
  if (y < yc && z < -660) return 'buttocks';
  return y >= yc ? 'trunkAnt' : 'trunkPost';
}
// The perineal region of the smooth pelvic shell: never pickable, never a site (A.1; §13.12).
export function inPerineum(p) { return Math.abs(p[0]) < 45 && p[2] < -790 && p[2] > -900 && p[1] > -100 && p[1] < 80; }

// Rigid limb segments for the vertex shader (§13.9: ≈ 20 segments, two-bone blending over 30 mm).
// a3.w = id + w, with w ∈ [0, 0.5] the weight of the parent segment within 30 mm past the joint.
export const RIGID = [
  { id: 'trunk', parent: -1, pivot: null },
  { id: 'head', parent: 0, pivot: [0, -30, -100] },
  { id: 'upperArm.R', parent: 0, pivot: JOINTS.shoulder }, { id: 'forearm.R', parent: 2, pivot: JOINTS.elbow },
  { id: 'hand.R', parent: 3, pivot: JOINTS.wrist },
  { id: 'upperArm.L', parent: 0, pivot: sided(JOINTS.shoulder, -1) }, { id: 'forearm.L', parent: 5, pivot: sided(JOINTS.elbow, -1) },
  { id: 'hand.L', parent: 6, pivot: sided(JOINTS.wrist, -1) },
  { id: 'thigh.R', parent: 0, pivot: JOINTS.hip }, { id: 'leg.R', parent: 8, pivot: JOINTS.knee },
  { id: 'foot.R', parent: 9, pivot: JOINTS.ankle },
  { id: 'thigh.L', parent: 0, pivot: sided(JOINTS.hip, -1) }, { id: 'leg.L', parent: 11, pivot: sided(JOINTS.knee, -1) },
  { id: 'foot.L', parent: 12, pivot: sided(JOINTS.ankle, -1) },
];
const BLEND_MM = 30;   // §13.9
function segDist(p, a, b) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const L2 = bx * bx + by * by + bz * bz;
  const s = ((p[0] - a[0]) * bx + (p[1] - a[1]) * by + (p[2] - a[2]) * bz) / L2;
  const t = clamp(s);
  return { d: len3(p[0] - a[0] - bx * t, p[1] - a[1] - by * t, p[2] - a[2] - bz * t), t, along: s * Math.sqrt(L2) };
}
export function rigidAt(p) {
  const ax = Math.abs(p[0]), side = p[0] < 0 ? 1 : 0, q = [ax, p[1], p[2]];
  const blend = (seg, along) => seg + 0.5 * clamp(1 - along / BLEND_MM);
  if (p[2] > -100 && ax < 120) return blend(1, p[2] > -100 ? (p[2] + 100) : 0);
  if (ax > 120 && p[2] < -250 && p[2] > -1030 && sdTorso(ax, p[1], p[2]) > -5) {
    const tip = [240, -15, -1008];
    const cand = [[segDist(q, JOINTS.shoulder, JOINTS.elbow), 2], [segDist(q, JOINTS.elbow, JOINTS.wrist), 3], [segDist(q, JOINTS.wrist, tip), 4]];
    cand.sort((a, b) => a[0].d - b[0].d);
    const [c, k] = cand[0];
    if (c.d < 70) return blend(k + side * 3, Math.max(0, c.along));
  }
  if (p[2] < -760 && !(p[2] > -835 && sdTorso(ax, p[1], p[2]) < 0)) {
    const toe = [88, 60, -1650];
    const cand = [[segDist(q, JOINTS.hip, JOINTS.knee), 8], [segDist(q, JOINTS.knee, JOINTS.ankle), 9], [segDist(q, JOINTS.ankle, toe), 10]];
    cand.sort((a, b) => a[0].d - b[0].d);
    const [c, k] = cand[0];
    if (c.d < 110) return blend(k + side * 3, Math.max(0, c.along));
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Diaphragm (§2.8): domes R (55, −5, −382), L (−55, −5, −395), central tendon (0, 15, −392),
// costal attachments z −440 to −470. Height of the sheet at (x, y), end-expiration.
// ---------------------------------------------------------------------------------------------
export const DIAPHRAGM = {
  base: -455,                                            // §2.8 costal attachments (−440 to −470)
  bumps: [[55, -5, -382], [-55, -5, -395], [0, 15, -392]], // §2.8 domes and central tendon
  radius: 135,                                           // [model] dome footprint radius
};
// Lung and breathing star roles (research/LUNGS.md §7): organ and muscle stars carry −role in their
// normal's y (≤ −2, clear of unit normals and of the heart's positive part codes); airway and acinus
// stars carry their volume coordinate from the mouth (L) in the normal's x for the airflow front.
export const LUNG_ROLE = { AIRWAY: 2, ACINUS: 3, PLEURA: 4, PARENCHYMA: 5, DIAPHRAGM: 6 };
export function diaphragmZ(x, y) {
  const D = DIAPHRAGM;
  let z = D.base;
  for (const [bx, by, bz] of D.bumps) {
    const q = 1 - ((x - bx) ** 2 + (y - by) ** 2) / (D.radius * D.radius);
    if (q > 0) z = Math.max(z, D.base + (bz - D.base) * Math.sqrt(q));
  }
  return z;
}

// ---------------------------------------------------------------------------------------------
// Organs, glands and receptor sites (§2.8). type 'e' = filled ellipsoid cluster, 'shell' = wall,
// 'tube' = tube of [x, y, z, r] points. Right-side entries with `sided: true` are mirrored.
// group = organ star share of §13.4.
// ---------------------------------------------------------------------------------------------
export function bladderAt(V = PARAMS.bladderRefVolume) {   // §2.8 bladder law
  const a = 10 * Math.cbrt(3 * V / (4 * Math.PI * PARAMS.bladderAspect));
  const neck = [0, 5, -782];
  return { neck, c: [0, 5, -782 + 1.55 * a], r: [1.4 * a, a, 1.55 * a], a };
}
const BLADDER = bladderAt();

export const ORGANS = [
  { id: 'heart', group: 'heart', type: 'e', c: [-22, 15, -352], r: [52, 45, 55], clipBelow: -392 },        // §2.8
  { id: 'heart', group: 'heart', type: 'e', c: [-62, 40, -377], r: [26, 20, 14], clipBelow: -392, model: true }, // [model] apex lobe toward (−85, 55, −390)
  { id: 'ventricles', group: 'heart', type: 'e', c: [-35, 25, -372], r: [40, 35, 40], clipBelow: -392 },  // §2.8
  { id: 'saNode', group: 'heart', type: 'e', c: [30, 0, -312], r: [4, 4, 4] },                            // §2.8
  { id: 'avNode', group: 'heart', type: 'e', c: [5, -2, -350], r: [3, 3, 3] },                            // §2.8
  { id: 'lungs', side: 1, group: 'lungs', type: 'e', c: [78, -18, -318], r: [62, 80, 118], carve: ['heart', 'ventricles'], aboveDiaphragm: true }, // §2.8
  { id: 'lungs', side: -1, group: 'lungs', type: 'e', c: [-82, -22, -328], r: [56, 78, 112], carve: ['heart', 'ventricles'], aboveDiaphragm: true },
  { id: 'liver', group: 'liver', type: 'e', c: [44, 8, -440], r: [90, 68, 55], carve: ['kidney', 'adrenalCortex', 'lungs'], belowDiaphragm: true }, // §2.8
  { id: 'liver', group: 'liver', type: 'e', c: [-45, 26, -432], r: [48, 32, 20], belowDiaphragm: true, model: true }, // [model] left lobe to the tip (−90, 30, −430)
  { id: 'liver', group: 'liver', type: 'e', c: [70, 60, -495], r: [15, 15, 15] },                        // §2.8 gallbladder fundus
  { id: 'spleen', group: 'spleen', type: 'e', c: [-108, -55, -458], r: [22, 42, 58], carve: ['kidney'], belowDiaphragm: true }, // §2.8, A.2
  { id: 'pancreas', group: 'pancreas', type: 'tube', pts: [[26, 28, -542, 13], [2, 18, -515, 12], [-12, 18, -505, 11], [-45, -8, -488, 10], [-80, -28, -465, 8]] }, // §2.8
  { id: 'kidney', side: 1, group: 'kidney', type: 'e', c: [62, -50, -512], r: [30, 22, 55] },            // §2.8
  { id: 'kidney', side: -1, group: 'kidney', type: 'e', c: [-60, -50, -497], r: [30, 22, 55] },
  { id: 'adrenalCortex', side: 1, group: 'kidney', type: 'e', c: [42, -42, -447], r: [12, 8, 22], hollowCore: [5, 3, 9] }, // §2.8
  { id: 'adrenalCortex', side: -1, group: 'kidney', type: 'e', c: [-38, -36, -448], r: [12, 8, 22], hollowCore: [5, 3, 9] },
  { id: 'adrenalMedulla', side: 1, group: 'kidney', type: 'e', c: [42, -42, -447], r: [5, 3, 9] },        // §2.8 medulla core
  { id: 'adrenalMedulla', side: -1, group: 'kidney', type: 'e', c: [-38, -36, -448], r: [5, 3, 9] },
  { id: 'bladder', group: 'pelvic', type: 'shell', c: BLADDER.c, r: BLADDER.r, wall: 4 },               // §2.8 at the reference volume
  { id: 'thyroid', sided: true, group: 'thyroid', type: 'e', c: [18, 22, -175], r: [9, 9, 22] },         // §2.8 lobes
  { id: 'thyroid', group: 'thyroid', type: 'e', c: [0, 32, -180], r: [10, 4, 5], model: true },          // §2.8 isthmus, extent [model]
  { id: 'carotidSinus', sided: true, group: 'other', type: 'e', c: [25, 5, -120], r: [5, 5, 5] },         // §2.8
  { id: 'carotidBody', sided: true, group: 'other', type: 'e', c: [25, 2, -120], r: [2.5, 2.5, 2.5] },    // §2.8
  { id: 'aorticArch', group: 'other', type: 'e', c: [-20, -8, -252], r: [14, 14, 14] },                  // §2.8 baroreceptor field
  { id: 'lacrimal', sided: true, group: 'other', type: 'e', c: [44, 60, -27], r: [8, 5, 4] },            // §2.8
  { id: 'parotid', sided: true, group: 'other', type: 'e', c: [50, -8, -80], r: [15, 20, 25] },          // §2.8
  { id: 'submandibularGland', sided: true, group: 'other', type: 'e', c: [35, 12, -142], r: [12, 15, 8] }, // §2.8
  { id: 'sublingual', sided: true, group: 'other', type: 'e', c: [18, 55, -128], r: [6, 15, 5] },        // §2.8
  { id: 'bat', sided: true, group: 'other', type: 'e', c: [65, 5, -200], r: [25, 15, 10] },              // §2.8 supraclavicular
  { id: 'bat', sided: true, group: 'other', type: 'e', c: [32, -80, -320], r: [8, 10, 40] },             // §2.8 paravertebral
  { id: 'larynx', group: 'other', type: 'e', c: HEAD.larynx.c, r: HEAD.larynx.r },                      // §2.3
  // The trachea and bronchi are the airway tree of airway-tree.js (research/LUNGS.md §2.2, §7.1).
];
export const ORGAN_SHARES = {   // §13.4 organ star share (% of the organ budget)
  // The heart takes 55 % (HEART.md §6: a dense heart of fine stars, as the brain); the other organs
  // share 45 % of a budget that grew so their counts stay as before.
  // The lungs then grew the budget by a third (LUNGS.md §7.1: the airway tree, the acini, the pleura),
  // and every other organ keeps its count: 55 → 41.25, 9 % + the new third → 31.75, the rest × 0.75.
  heart: 41.25, intestines: 7.5, lungs: 31.75, liver: 4.5, kidney: 3, stomach: 2.625, sense: 2.625, spleen: 1.5, pancreas: 1.125,
  pelvic: 1.125, thyroid: 0.375, other: 2.625,
};
export const PELVIC_FLOOR = { id: 'pelvicFloor', c: [0, -20, -810], r: [45, 50, 8] };   // §2.8 unlabelled field (A.1)

// ---------------------------------------------------------------------------------------------
// Gut tube (§2.9). Centreline rows [label, [x, y, z], rRest, rFed?]; sDraw is the arc along the
// linear polyline (cm in the tables, mm in code). The jejunoileum and sigmoid are non-periodic
// random-walk tubes of fixed length inside their envelopes (photosensitivity, §13).
// ---------------------------------------------------------------------------------------------
export const GUT_DATA = {
  pieceA: [
    ['UES', [0, -8, -165], 10], [null, [-4, -20, -210], 10], [null, [-1, -31, -270], 10], [null, [0, -34, -292], 10],
    [null, [-4, -38, -340], 10], [null, [-12, -30, -392], 10], ['hiatus', [-22, -22, -415], 10], ['cardia', [-30, -10, -435], 10],
    ['corpus', [-58, 16, -468], 28, 42], ['lowerBody', [-45, 35, -522], 30, 40], ['incisure', [-25, 48, -556], 25, 32],
    [null, [0, 52, -550], 22, 25], ['pyloricCanal', [12, 42, -535], 14.5], ['pylorus', [20, 30, -520], 8],
    ['cap', [40, 30, -512], 18], [null, [52, -4, -518], 17.6], [null, [50, -8, -548], 17.2], [null, [50, -5, -580], 16.8],
    [null, [28, 26, -590], 16.4], [null, [0, 38, -594], 16], [null, [-20, 30, -585], 15.6], [null, [-30, 14, -560], 15.3],
    ['DJ', [-32, 5, -540], 15],
  ],
  jejunum: { length: 1050, end: [-10, 40, -640], r: 15, env: { c: [-35, 45, -590], r: [60, 45, 60] }, guides: 3 }, // §2.9; junction [model]
  ileum: { length: 1600, end: [55, 25, -690], r: 12, env: { c: [20, 35, -680], r: [65, 45, 70] }, guides: 4 },     // §2.9 → ileocaecal valve
  icvGap: 1,                                                                                // §2.9 caecal pole sDraw 342.0 vs valve 341.9 (mm)
  pieceB: [
    ['caecalPole', [62, 35, -725], 35], ['ascStart', [80, 15, -680], 32], [null, [92, 0, -600], 31], [null, [90, 4, -545], 29.5],
    ['hepaticFlexure', [80, 18, -525], 28], [null, [55, 52, -620], 27], [null, [0, 60, -636], 26], [null, [-45, 44, -605], 25.5],
    [null, [-80, 24, -570], 25], [null, [-96, 24, -525], 24.5], ['splenicFlexure', [-104, -8, -485], 24],
    [null, [-106, -20, -545], 23.5], [null, [-90, -12, -600], 23], ['sigmoidStart', [-82, -8, -660], 22],
  ],
  sigmoid: { length: 400, end: [0, -32, -705], r: 20, env: { c: [-35, 10, -680], r: [45, 30, 25] },
    guides: [[-65, 10, -680], [-35, 16, -676], [-10, -6, -684]] },                          // §2.9
  pieceBTail: [
    ['rectosigmoid', [0, -32, -705], 20], ['ampulla', [0, -38, -740], 20, 25], [null, [0, -26, -775], 16],
    ['anorectal', [0, -18, -795], 12], [null, [0, -25, -810], 10], ['verge', [0, -35, -835], 8],
  ],
  fundus: { c: [-58, -4, -432], r: 30, rFed: 34 },                                          // §2.9
  // §2.9 breakpoints s (in vivo, §8.2) → sDraw, cm; linear between rows.
  breakpoints: [[0, 0], [21, 24.0], [25, 28.3], [33, 33.3], [45, 43.3], [53, 48.1], [55, 50.2], [80, 76.9], [185, 181.9],
    [345, 342.0], [351, 347.2], [369, 363.6], [414, 400.8], [439, 418.8], [482, 458.8], [496, 468.2], [500, 472.6]],
  regions: [   // A.3.3 ids by in-vivo s (cm), §8.2 boundaries as in the breakpoint table
    ['gut.oes', 0, 21], ['gut.les', 21, 25], ['gut.fundus', 25, 33], ['gut.corpus', 33, 45], ['gut.antrum', 45, 53],
    ['gut.pylorus', 53, 55], ['gut.duod', 55, 80], ['gut.jej', 80, 185], ['gut.ileum', 185, 345], ['gut.caecum', 345, 351],
    ['gut.colAsc', 351, 369], ['gut.colTrans', 369, 414], ['gut.colDesc', 414, 439], ['gut.sigmoid', 439, 482],
    ['gut.rectum', 482, 496], ['gut.ias', 496, 498], ['gut.eas', 498, 500],
  ],
  pacemakerS: 36,      // §2.9 gastric pacemaker s 36 (sDraw 35.8) on the greater-curvature wall
  cannonBohmS: 399,    // §2.9 Cannon–Böhm point
};

// Distance from p to a chain of [a, b, ra, rb] capsules (negative inside).
function capsuleChainDist(p, caps) {
  let d = 1e9;
  for (const c of caps) d = Math.min(d, sdCone(p[0], p[1], p[2], c[0], c[2], c[1], c[3]));
  return d;
}
function capsulesOf(rows) {
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) out.push([rows[i][1], rows[i + 1][1], rows[i][2], rows[i + 1][2]]);
  return out;
}
const ellNorm = (p, env) => len3((p[0] - env.c[0]) / env.r[0], (p[1] - env.c[1]) / env.r[1], (p[2] - env.c[2]) / env.r[2]);

// Fixed-length random walk from `start` to `end` (length = N · step exactly): candidate steps mix
// persistence, noise and a pull toward the target that grows as slack runs out; the envelope,
// obstacle clearance and self-crowding are penalties; the target is always reachable.
function walkTube({ start, end, length, env, radius, clearance, rnd, guidesN = 0, guides = null }) {
  const legsT = guides ? [...guides] : [];
  if (!guides) for (let g = 0; g < guidesN; g++) {   // random guide points inside the envelope spread the tube
    for (let tries = 0; tries < 50; tries++) {
      const q = [env.c[0] + (rnd() * 2 - 1) * env.r[0] * 0.75, env.c[1] + (rnd() * 2 - 1) * env.r[1] * 0.75, env.c[2] + (rnd() * 2 - 1) * env.r[2] * 0.75];
      if (ellNorm(q, env) < 0.8 && clearance(q) > radius + PARAMS.gutClearance) { legsT.push(q); break; }
    }
  }
  const stops = [start, ...legsT, end];
  const straight = [];
  for (let i = 0; i < stops.length - 1; i++) straight.push(Math.max(dist(stops[i], stops[i + 1]), 1));
  const sumS = straight.reduce((a, b) => a + b, 0);
  const step0 = PARAMS.gutWalkStep;
  const pts = [start];
  let dir = norm(sub(stops[1], start)), cur = start, done = 0;
  for (let leg = 0; leg < stops.length - 1; leg++) {
    const target = stops[leg + 1];
    const legLen = leg === stops.length - 2 ? length - done : Math.round(length * straight[leg] / sumS);
    const N = Math.max(2, Math.round(legLen / step0)), step = legLen / N;
    for (let i = 0; i < N - 2; i++) {
      const remaining = (N - i) * step;
      const toT = sub(target, cur), D = len3(toT[0], toT[1], toT[2]);
      const tn = [toT[0] / (D || 1), toT[1] / (D || 1), toT[2] / (D || 1)];
      const pull = 3 * clamp((D / remaining - 0.35) / 0.6);
      let best = null, bestScore = Infinity;
      for (let k = 0; k < 9; k++) {
        let c;
        if (k === 8) c = tn;
        else {
          const g = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
          c = norm([dir[0] + 0.9 * g[0] + pull * tn[0], dir[1] + 0.9 * g[1] + pull * tn[1], dir[2] + 0.9 * g[2] + pull * tn[2]]);
        }
        const q = [cur[0] + c[0] * step, cur[1] + c[1] * step, cur[2] + c[2] * step];
        if (dist(q, target) > remaining - step + 1e-6) continue;          // must stay reachable
        let score = 50 * Math.max(0, ellNorm(q, env) - 1);
        score += 2 * Math.max(0, radius + PARAMS.gutClearance - clearance(q));
        for (let j = 0; j < pts.length - 4; j++) if (dist(q, pts[j]) < 1.6 * radius) score += 0.6;
        score -= 0.4 * (c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2]);
        if (score < bestScore) { bestScore = score; best = [q, c]; }
      }
      if (!best) best = [[cur[0] + tn[0] * step, cur[1] + tn[1] * step, cur[2] + tn[2] * step], tn];
      cur = best[0]; dir = best[1];
      pts.push(cur);
    }
    // Close with two steps of exactly `step`: the middle point lies on the circle of equal reach.
    const D = dist(cur, target), m = lerp3(cur, target, 0.5);
    const h = Math.sqrt(Math.max(0, step * step - (D / 2) * (D / 2)));
    const ax = norm(sub(target, cur));
    let perp = cross(ax, [0, 0, 1]);
    if (len3(perp[0], perp[1], perp[2]) < 1e-3) perp = cross(ax, [1, 0, 0]);
    perp = norm(perp);
    const mid = [m[0] + perp[0] * h, m[1] + perp[1] * h, m[2] + perp[2] * h];
    pts.push(mid, target);
    dir = norm(sub(target, mid)); cur = target; done += legLen;
  }
  return pts;
}

function buildGut() {
  const G = GUT_DATA;
  const rnd = mulberry32(PARAMS.gutSeed);
  const rowsA = G.pieceA.map((r) => [r[0], r[1], r[2], r[3] ?? r[2]]);
  const rowsBc = G.pieceB.map((r) => [r[0], r[1], r[2], r[3] ?? r[2]]);
  const rowsBt = G.pieceBTail.map((r) => [r[0], r[1], r[2], r[3] ?? r[2]]);
  const B = BLADDER, PANC = ORGANS.find((o) => o.id === 'pancreas').pts;
  const fixedCaps = [...capsulesOf(rowsA.slice(7)), ...capsulesOf(rowsBc)];
  const pancCaps = [];
  for (let i = 0; i < PANC.length - 1; i++) pancCaps.push([PANC[i], PANC[i + 1], PANC[i][3], PANC[i + 1][3]]);
  const F = G.fundus;
  const clearSmall = (q) => Math.min(
    capsuleChainDist(q, fixedCaps), capsuleChainDist(q, pancCaps),
    sdEll(q[0], q[1], q[2], F.c[0], F.c[1], F.c[2], F.r, F.r, F.r),
    sdEll(q[0], q[1], q[2], B.c[0], B.c[1], B.c[2], B.r[0], B.r[1], B.r[2]),
    -sdTorso(Math.abs(q[0]), q[1], q[2]) - PARAMS.gutWallMin + PARAMS.gutClearance);
  const J = G.jejunum, I = G.ileum, S = G.sigmoid;
  const jej = walkTube({ start: rowsA[rowsA.length - 1][1], end: J.end, length: J.length, env: J.env, radius: J.r, clearance: clearSmall, rnd, guidesN: J.guides });
  const ile = walkTube({ start: J.end, end: I.end, length: I.length, env: I.env, radius: I.r, clearance: clearSmall, rnd, guidesN: I.guides });
  const smallCaps = [];
  const small = [...jej, ...ile.slice(1)];
  for (let i = 0; i < small.length - 1; i += 2) smallCaps.push([small[i], small[Math.min(small.length - 1, i + 2)], 13, 13]);
  const clearSig = (q) => Math.min(
    capsuleChainDist(q, smallCaps), capsuleChainDist(q, capsulesOf(rowsBc.slice(-4))),
    sdEll(q[0], q[1], q[2], B.c[0], B.c[1], B.c[2], B.r[0], B.r[1], B.r[2]),
    -sdTorso(Math.abs(q[0]), q[1], q[2]) - PARAMS.gutWallMin + PARAMS.gutClearance);
  const sig = walkTube({ start: rowsBc[rowsBc.length - 1][1], end: S.end, length: S.length, env: S.env, radius: S.r, clearance: clearSig, rnd, guides: S.guides });

  // Assemble pieces: rows [label, p, rRest, rFed]
  const pieceA = [...rowsA];
  jej.slice(1).forEach((p, i, a) => pieceA.push([i === a.length - 1 ? 'jejIleJunction' : null, p, J.r, J.r]));
  ile.slice(1).forEach((p, i, a) => pieceA.push([i === a.length - 1 ? 'icv' : null, p, I.r, I.r]));
  const pieceB = [...rowsBc];
  sig.slice(1, -1).forEach((p) => pieceB.push([null, p, S.r, S.r]));
  pieceB.push(...rowsBt);
  const pieces = [];
  let s0 = 0;
  for (const rows of [pieceA, pieceB]) {
    const cum = [s0];
    for (let i = 1; i < rows.length; i++) cum.push(cum[i - 1] + dist(rows[i - 1][1], rows[i][1]));
    pieces.push({ rows, cum });
    s0 = cum[cum.length - 1] + G.icvGap;
  }
  const totalDraw = pieces[1].cum[pieces[1].cum.length - 1];
  const landmarks = {};
  for (const pc of pieces) pc.rows.forEach((r, i) => { if (r[0]) landmarks[r[0]] = pc.cum[i]; });
  return { pieces, totalDraw, landmarks };
}
const GUT_BUILT = buildGut();

// In-vivo s (cm, §8.2) ↔ drawn sDraw (cm) through the §2.9 breakpoint table.
function piecewise(table, x, from, to) {
  if (x <= table[0][from]) return table[0][to];
  for (let i = 0; i < table.length - 1; i++) {
    if (x <= table[i + 1][from]) {
      const f = (x - table[i][from]) / (table[i + 1][from] - table[i][from]);
      return table[i][to] + (table[i + 1][to] - table[i][to]) * f;
    }
  }
  return table[table.length - 1][to];
}
export const sToDraw = (s) => piecewise(GUT_DATA.breakpoints, s, 0, 1);
export const drawToS = (sd) => piecewise(GUT_DATA.breakpoints, sd, 1, 0);
export function gutRegionAt(s) {
  for (const [id, a, b] of GUT_DATA.regions) if (s < b) return id;
  return 'gut.eas';
}
// Centreline at drawn arc sDraw (mm): { p, r, rFed, t (unit tangent), piece }.
export function gutAt(sDrawMm) {
  const P = GUT_BUILT.pieces;
  const pc = sDrawMm < P[1].cum[0] ? P[0] : P[1];
  const c = pc.cum, rows = pc.rows;
  const s = clamp(sDrawMm, c[0], c[c.length - 1]);
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const f = (s - c[lo]) / Math.max(1e-9, c[hi] - c[lo]);
  const a = rows[lo], b = rows[hi];
  return {
    p: lerp3(a[1], b[1], f), r: a[2] + (b[2] - a[2]) * f, rFed: a[3] + (b[3] - a[3]) * f,
    t: norm(sub(b[1], a[1])), piece: pc === P[0] ? 0 : 1,
  };
}
export const GUT = {
  pieces: GUT_BUILT.pieces, totalDraw: GUT_BUILT.totalDraw, landmarks: GUT_BUILT.landmarks,
  fundus: GUT_DATA.fundus, regions: GUT_DATA.regions, breakpoints: GUT_DATA.breakpoints,
  pacemakerDraw: sToDraw(GUT_DATA.pacemakerS) * 10, cannonBohmDraw: sToDraw(GUT_DATA.cannonBohmS) * 10,
};

// ---------------------------------------------------------------------------------------------
// Great vessels (§2.10) as [x, y, z, r] rows.
// ---------------------------------------------------------------------------------------------
export const VESSELS = [
  { id: 'aorta', pts: [[-5, 5, -330, 14], [2, 8, -275, 14], [-20, -8, -252, 14], [-26, -40, -295, 12], [-24, -52, -380, 11.5],
    [-8, -20, -460, 11], [-5, 2, -470, 11], [-7, 7, -500, 10.5], [-6, 13, -552, 10], [-5, 7, -590, 9]] },          // §2.10
  { id: 'ivc', pts: [[21, -1, -590, 11], [24, 2, -520, 11.5], [30, 6, -470, 12], [32, 6, -420, 12], [30, 5, -380, 12], [30, 5, -360, 12]] }, // §2.10
  { id: 'svc', pts: [[30, 0, -250, 10], [30, 5, -320, 10]] },                                                    // §2.10
  { id: 'carotid', sided: true, pts: [[25, 5, -230, 6], [25, 5, -120, 5.5], [27, -5, -90, 5], [25, -15, -60, 4]] }, // §2.10
];

// ---------------------------------------------------------------------------------------------
// Autonomic ganglia and plexuses (§2.11), sense-ganglia; `mid` = unpaired, never mirrored.
// ---------------------------------------------------------------------------------------------
const CHAIN_T_Y = [-51, -55, -59, -63, -67, -67, -67, -67, -63, -58, -52];   // §2.11 T2–T12
const CHAIN_L = [[25, -32, -482], [25, -26, -517], [25, -20, -552], [25, -17, -587]];   // §2.11 L1–L4
const CHAIN_S = [[18, -32, -655], [16, -46, -676], [14, -58, -697], [12, -62, -718]];   // §2.11 S1–S4
export const GANGLIA = [
  { id: 'scg', c: [32, -20, -105], r: [5, 5, 14], bits: NET.SY },           // §2.11
  { id: 'mcg', c: [30, -20, -158], r: [4, 4, 6], bits: NET.SY },
  { id: 'stellate', c: [32, -42.5, -191], r: [6, 4, 12.5], bits: NET.SY, ends: [[32, -40, -186], [32, -45, -196]] },
  ...CHAIN_T_Y.map((y, i) => ({ id: `chain.T${i + 2}`, c: [30, y, VERTEBRA[`T${i + 2}`].c[2]], r: [4, 4, 4], bits: NET.SY })),
  ...CHAIN_L.map((c, i) => ({ id: `chain.L${i + 1}`, c, r: [4, 4, 4], bits: NET.SY })),
  ...CHAIN_S.map((c, i) => ({ id: `chain.S${i + 1}`, c, r: [4, 4, 4], bits: NET.SY })),
  { id: 'impar', mid: true, c: [0, -53, -752], r: [4, 4, 4], bits: NET.SY },
  { id: 'cardiacPlexus', mid: true, c: [-12, -4, -284], r: [15, 12, 12], bits: NET.SY | NET.PA },
  { id: 'coeliac', c: [18, -10, -470], r: [10, 10, 10], bits: NET.SY | NET.PA },
  { id: 'smg', mid: true, c: [-4, 10, -495], r: [6, 6, 6], bits: NET.SY },
  { id: 'img', mid: true, c: [-6, 18, -560], r: [5, 5, 5], bits: NET.SY },
  { id: 'aorticorenal', c: [20, -20, -495], r: [5, 5, 5], bits: NET.SY },
  { id: 'renalPlexus', c: [35, -35, -500], r: [7.5, 7.5, 7.5], bits: NET.SY },
  { id: 'supHypogastric', mid: true, c: [0, -12, -635], r: [15, 5, 20], bits: NET.SY },
  { id: 'infHypogastric', c: [35, -20, -760], r: [15, 20, 20], bits: NET.SY | NET.PA },
  { id: 'ciliaryGang', c: [27, 40, -35], r: [2.5, 2.5, 2.5], bits: NET.PA },
  { id: 'pterygopalatineGang', c: [25, 22, -55], r: [2.5, 2.5, 2.5], bits: NET.PA },
  { id: 'oticGang', c: [25, 0, -55], r: [2.5, 2.5, 2.5], bits: NET.PA },
  { id: 'submandibularGang', c: [28, 30, -125], r: [2.5, 2.5, 2.5], bits: NET.PA },
  { id: 'nodoseGang', c: [30, -24, -80], r: [3, 3, 8], bits: NET.VA },
  { id: 'petrosalGang', c: [30, -30, -68], r: [2, 2, 2], bits: NET.VA },          // inferior glossopharyngeal ganglion
  { id: 'trigeminalGang', c: [24, -12, -36], r: [5, 8, 4], bits: NET.SA },
];
const GANG = Object.fromEntries(GANGLIA.map((g) => [g.id, g]));

// ---------------------------------------------------------------------------------------------
// Muscle centres and effector targets (§2.13)
// ---------------------------------------------------------------------------------------------
export const MUSCLES = [
  { id: 'deltoid', c: [213, -23, -300], r: [25, 25, 50] }, { id: 'biceps', c: [190, -3, -420], r: [25, 22, 90] },
  { id: 'triceps', c: [197, -51, -420], r: [25, 22, 100] }, { id: 'forearmFlexors', c: [207, -7, -660], r: [25, 20, 90] },
  { id: 'forearmExtensors', c: [218, -46, -660], r: [25, 20, 90] }, { id: 'rectusAbdominis', c: [34, 82, -600], r: [30, 6, 150] },
  { id: 'erectorSpinae', c: [33, -103, -460], r: [20, 20, 200] }, { id: 'glutealMax', c: [84, -99, -770], r: [60, 25, 80] },
  { id: 'quadriceps', c: [88, 22, -950], r: [55, 45, 170] }, { id: 'hamstrings', c: [85, -64, -950], r: [45, 35, 170] },
  { id: 'adductors', c: [44, 3, -870], r: [30, 35, 120] }, { id: 'gastrocSoleus', c: [80, -70, -1300], r: [45, 40, 140] },
  { id: 'tibialisAnt', c: [92, -8, -1340], r: [15, 15, 120] }, { id: 'trapezius', c: [75, -70, -215], r: [60, 8, 40] },
  { id: 'masseter', c: [48, 28, -118], r: [12, 20, 25] }, { id: 'stapedius', c: [47, -27, -45], r: [3, 3, 3] },
  { id: 'extraocular', c: [30, 42, -38], r: [10, 14, 10] },
  { id: 'sternocleidomastoid', c: [37, 8, -148], tube: [[55, -40, -70], [20, 55, -225]], width: 25 },   // mastoid → SC joint
  { id: 'orbicularisOculi', c: [33, 70, -38], ring: 18 },
  { id: 'pelvicFloor', mid: true, c: PELVIC_FLOOR.c, r: PELVIC_FLOOR.r },                                // §2.8 unlabelled
];
const MUSCLE = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

// ---------------------------------------------------------------------------------------------
// Brain-side CNS ends of the cranial routes and the §2.14 brain nodes (§3.16; owner §3).
// ---------------------------------------------------------------------------------------------
export const BRAIN_ANCHORS = {
  cn2: [30, 48, -39], chiasm: [0, 3, -18], cn3: [5, -14, -14], cn4: [4, -38.5, -16], cn5: [17, -27, -30], cn6: [4, -21, -42],
  cn7: [13, -29, -41], cn8: [14.5, -32, -41], cn9: [9.5, -33, -47], cn10: [9.5, -35, -51], cn11: [8.5, -37, -56],
  cn12: [3.5, -28.5, -53], olfBulb: [8, 36, -25], ntsVisc: [3.5, -42, -53], ntsGust: [5, -39, -44],
  nAmbVagal: [7.5, -36.5, -52.5], ew: [2, -26, -6], opn: [6, -28, -1], rvlm: [6.5, -33, -45],
  cuneate: [5.5, -43, -60], gracile: [2.5, -44, -62], thalVPL: [18, -21, 3], 's1.hand': [40, -30, 58], 's1.foot': [4, -40, 64],
};
const BRAIN_MID = new Set(['chiasm']);
// §3.16 crossed medial lemniscus and somatosensory radiation (right nucleus → left thalamus).
const TRACT_ML = [[0, -38, -52], [-4, -36, -48], [-5, -30, -32], [-8, -25, -15], [-14, -22, -3], [-18, -21, 3]];
const TRACT_THAL_S1 = [[18, -21, 3], [26, -24, 20], [40, -30, 58]];

// ---------------------------------------------------------------------------------------------
// Sites (§2.7 skin, §2.3 special senses, §2.8 receptor and interoceptive sites, tendons, joints)
// ---------------------------------------------------------------------------------------------
const SKIN_SITES = {   // §2.7 hand, forearm, foot, face and trunk sites (right side)
  indexTip: [258, -15, -1000], palm: [238, 0, -870], forearmDorsal: [214, -60, -690], footSole: [85, 30, -1672],
  heel: [78, -75, -1672], bigToe: [78, 170, -1660], foreheadV1: [20, 77, 25], cheekV2: [45, 76, -75], chinV3: [15, 84, -145],
};
const MID_SKIN_SITES = { umbilicus: [0, 92, -580] };   // §2.7 unlit landmark, no navel geometry
const TENDONS = {   // §2.7 tap sites
  bicepsTendon: [202, 10, -548], tricepsTendon: [195, -64, -535], patellarTendon: [82, 25, -1200], achillesTendon: [78, -80, -1590],
};
const SPECIAL = {   // §2.3 receptor organs; pick volumes are 1.5 × the drawn size (§13.12)
  retina: { pos: HEAD.retinaPole, pick: { c: HEAD.eye.c, r: [HEAD.eye.r, HEAD.eye.r, HEAD.eye.r] } },
  cochlea: { pos: HEAD.cochlea.c, pick: { c: HEAD.pinna.c, r: HEAD.pinna.r } },
  vestLabyrinth: { pos: HEAD.vestLabyrinth.c, pick: { c: HEAD.scalp.c, r: HEAD.scalp.r }, both: true },
  olfEpith: { pos: HEAD.olfEpith.c, pick: { c: [0, 98, -72], r: [12, 10, 22] } },
  tongueAnt: { pos: HEAD.tongueAnt, pick: { c: [8, 75, -105], r: [14, 18, 10] } },
  tonguePost: { pos: HEAD.tonguePost, pick: { c: [10, 40, -105], r: [14, 18, 10] } },
};
const INTERO = {   // §2.8 receptor and visceral sites with their pick volumes ([model] extents)
  carotidSinus: { pos: [25, 5, -120], sided: true, pick: { c: [25, 5, -120], r: [12, 12, 12] } },
  aorticArch: { pos: [-20, -8, -252], pick: { c: [-20, -8, -252], r: [20, 20, 20] } },
  lungStretch: { pos: [45, -20, -300], sided: true, pick: { c: [78, -18, -318], r: [62, 80, 118] } },
  stomachWall: { pos: [-58, 44, -468], pick: { c: [-48, 26, -485], r: [40, 36, 55] } },
  duodenum: { pos: [50, -8, -548], pick: { c: [42, 8, -555], r: [22, 28, 42] } },
  colonRectum: { pos: [0, -38, -740], pick: { c: [0, -32, -752], r: [24, 24, 45] } },
  bladder: { pos: BLADDER.c, pick: { c: BLADDER.c, r: BLADDER.r } },
};

// ---------------------------------------------------------------------------------------------
// Nerve routes (§2.12). Waypoint tokens: [x, y, z] (right side, mirrored for the left), or
// 'drg:<seg>', 'brain:<id>', 'gang:<id>', 'muscle:<id>', 'site:<id>', 'organ:<id>'. `via` maps a
// root segment to the points between its DRG and the shared trunk (`rep` = the drawn root).
// ---------------------------------------------------------------------------------------------
const BP = { U: [66, -26, -178], M: [70, -29, -198], Lo: [70, -33, -218], D: [110, -28, -240],
  LC: [160, -18, -268], PC: [158, -32, -272], MC: [156, -24, -276] };                      // §2.12 brachial plexus
const BRACHIAL_VIA = { C5: [BP.U], C6: [BP.U], C7: [BP.M], C8: [BP.Lo], T1: [BP.Lo] };
const NP = [52, -8, -140];                                                                // §2.12 cervical plexus nerve point
const SAC = { ala: [40, -45, -660], F1: [28, -36, -660], F2: [25, -48, -680], F3: [23, -58, -701], F4: [20, -62, -722],
  P: [45, -50, -690], N: [70, -65, -720], PA: [82, -55, -1090] };                          // §2.12 sacral plexus
const SCIATIC_VIA = { L4: [SAC.ala], L5: [SAC.ala], S1: [SAC.F1], S2: [SAC.F2], S3: [SAC.F3] };
const SCIATIC = [SAC.P, SAC.N, [80, -80, -790], [85, -60, -950], SAC.PA];
const FEMORAL = [[42, -30, -600], [62, -10, -650], [80, 55, -730], [85, 52, -765]];
const MIX = {   // [model] streamline fibre mixes until §6 composition is wired: bit → weight
  mixed: { [NET.SA]: 0.6, [NET.SE]: 0.3, [NET.SY]: 0.1 }, cutaneous: { [NET.SA]: 0.85, [NET.SY]: 0.15 },
  motor: { [NET.SE]: 0.6, [NET.SA]: 0.4 }, symp: { [NET.SY]: 0.8, [NET.VA]: 0.2 }, vagus: { [NET.VA]: 0.8, [NET.PA]: 0.2 },
  para: { [NET.PA]: 0.8, [NET.VA]: 0.2 }, visceralAff: { [NET.VA]: 1 }, special: { 0: 1 }, cranialMotor: { [NET.SE]: 1 },
  pudendal: { [NET.SA]: 0.5, [NET.SE]: 0.35, [NET.SY]: 0.15 }, pelvic: { [NET.PA]: 0.6, [NET.VA]: 0.3, [NET.SY]: 0.1 },
  splenic: { [NET.SY]: 0.5, [NET.NI]: 0.5 }, phrenic: { [NET.SE]: 0.7, [NET.SA]: 0.3 },
};
// Intercostal rule (§2.12): DRG → costal angle (80, y_ca, z_DRG − 15) → midaxillary (x_ma, −20,
// z_DRG − 50) → anterior end (35, y_ae, z_ant), 5 mm below the skin.
const IC = {
  yca: [-72, -98, -111, -110, -110, -110, -109, -107, -104, -101, -98],
  xma: [152, 154, 153, 152, 151, 148, 144, 140, 138, 136, 134],
  yae: [84, 96, 100, 102, 100, 98, 96, 94, 92, 94, 96],
  zant: [-250, -300, -340, -370, -379, -388, -454, -498, -541, -585, -650],
};
// Oesophageal plexus rows: oesophagus + (0, ±12, 0) for z −320 to −405 (§2.12).
const OES_PLEXUS_Z = [-320, -340, -392, -405];
function oesophagusAtZ(z) {
  const rows = GUT_DATA.pieceA.slice(0, 7);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][1], b = rows[i + 1][1];
    if (z <= a[2] && z >= b[2]) return lerp3(a, b, (a[2] - z) / (a[2] - b[2]));
  }
  return rows[rows.length - 1][1];
}
const oesPlexus = (dy) => OES_PLEXUS_Z.map((z) => { const p = oesophagusAtZ(z); return [p[0], p[1] + dy, p[2]]; });
const VAGUS_R = ['brain:cn10', [30, -32, -62], 'gang:nodoseGang', [30, -8, -120], [31, -6, -150], [31, -6, -215], [20, -30, -300],
  ...oesPlexus(-12), [-22, -34, -415], 'gang:coeliac', [-7, 7, -500], [-30, 25, -550], [-64, 33, -586]];   // §2.12; SMA leg [model]
const VAGUS_L = ['brain:cn10', [-30, -32, -62], [-30, -24, -80], [-30, -8, -120], [-31, -6, -150], [-31, -6, -215], [-35, -6, -258],
  [-36, -24, -300], ...oesPlexus(12), [-22, -10, -415], [-35, 20, -460], 'site:stomachWall'];          // §2.12 (left, explicit)
const vagusUpTo = (route, p) => route.slice(0, route.findIndex((q) => Array.isArray(q) && q[0] === p[0] && q[1] === p[1] && q[2] === p[2]) + 1);

export const NERVE_ROUTES = [
  // Brachial plexus branches (§2.12; roots §6.5)
  { id: 'axillary', roots: ['C5', 'C6'], rep: 'C5', via: BRACHIAL_VIA, tail: [BP.D, BP.PC, [153, -30, -302], [170, -40, -312], [187, -41, -321], [207, -16, -326]], width: 3, mix: 'motor' },
  { id: 'musculocutaneous', roots: ['C5', 'C6', 'C7'], rep: 'C6', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [152, 8, -305], [180, 6, -394], [189, 3, -481], [210, -5, -553], [234, -11, -688], [245, -17, -797]], width: 3, mix: 'mixed' },
  { id: 'musculocutaneous.biceps', roots: ['C5', 'C6', 'C7'], rep: 'C6', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [152, 8, -305], [180, 6, -394], 'muscle:biceps'], width: 2, mix: 'motor', lod: 1 },
  { id: 'radial', roots: ['C5', 'C6', 'C7', 'C8', 'T1'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.PC, [150, -35, -275], [200, -50, -420], [225, -25, -560], [245, -25, -780], [262, -35, -880]], width: 5, mix: 'mixed' },
  { id: 'radial.triceps', roots: ['C6', 'C7', 'C8'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.PC, [150, -35, -275], 'muscle:triceps'], width: 2, mix: 'motor', lod: 1 },
  { id: 'radial.forearmExtensors', roots: ['C6', 'C7', 'C8'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.PC, [150, -35, -275], [200, -50, -420], [225, -25, -560], 'muscle:forearmExtensors'], width: 2, mix: 'motor', lod: 1 },
  { id: 'median', roots: ['C6', 'C7', 'C8', 'T1'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [165, -20, -280], [178, -5, -420], [188, -1, -560], [208, -2, -700], [230, -10, -820], [240, -12, -880], 'site:indexTip'], width: 5, mix: 'mixed' },
  { id: 'median.thumb', roots: ['C6', 'C7'], rep: 'C6', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [165, -20, -280], [178, -5, -420], [188, -1, -560], [208, -2, -700], [230, -10, -820], [240, -12, -880], [282, 0, -930]], width: 2, mix: 'cutaneous', lod: 2 },
  { id: 'median.middle', roots: ['C7', 'C8'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [165, -20, -280], [178, -5, -420], [188, -1, -560], [208, -2, -700], [230, -10, -820], [240, -12, -880], [240, -15, -1008]], width: 2, mix: 'cutaneous', lod: 2 },
  { id: 'median.forearmFlexors', roots: ['C7', 'C8'], rep: 'C7', via: BRACHIAL_VIA, tail: [BP.D, BP.LC, [165, -20, -280], [178, -5, -420], [188, -1, -560], 'muscle:forearmFlexors'], width: 2, mix: 'motor', lod: 1 },
  { id: 'ulnar', roots: ['C8', 'T1'], rep: 'C8', via: BRACHIAL_VIA, tail: [BP.D, BP.MC, [160, -30, -280], [163, -35, -420], [166, -42, -560], [190, -15, -700], [212, -15, -822], [205, -15, -985]], width: 4, mix: 'mixed' },
  // Cervical plexus (§2.12); the waypoint into the C4 site is [model] (keeps the route under the skin)
  { id: 'plexusCervical.lesserOccipital', roots: ['C2'], rep: 'C2', tail: [NP, [48, -60, -40]], width: 1.5, mix: 'cutaneous', lod: 2 },
  { id: 'plexusCervical.greatAuricular', roots: ['C2', 'C3'], rep: 'C3', tail: [NP, [76, -22, -72]], width: 1.5, mix: 'cutaneous', lod: 2 },
  { id: 'plexusCervical.transverseCervical', roots: ['C2', 'C3'], rep: 'C3', tail: [NP, [25, 36, -135]], width: 1.5, mix: 'cutaneous', lod: 2 },
  { id: 'plexusCervical.supraclavicular', roots: ['C3', 'C4'], rep: 'C4', tail: [NP, 'site:dermatome.C3'], width: 1.5, mix: 'cutaneous', lod: 2 },
  { id: 'plexusCervical.supraclavicularLat', roots: ['C3', 'C4'], rep: 'C4', tail: [NP, [100, -10, -220], 'site:dermatome.C4'], width: 1.5, mix: 'cutaneous', lod: 2 },
  // Phrenic, per side (§2.12)
  { id: 'phrenic', side: 1, roots: ['C3', 'C4', 'C5'], rep: 'C4', tail: [[40, -10, -170], [35, 0, -215], [42, 10, -320], [40, 5, -380], [55, -5, -382]], width: 2.5, mix: 'phrenic' },
  { id: 'phrenic', side: -1, roots: ['C3', 'C4', 'C5'], rep: 'C4', tail: [[-40, -10, -170], [-35, 0, -215], [-75, 26, -339], [-60, 10, -398]], width: 2.5, mix: 'phrenic' },
  // Intercostals T1–T11 (rule) and subcostal T12
  ...IC.yca.map((yca, i) => {
    const seg = `T${i + 1}`, z = drg(seg)[2];
    return { id: `intercostal.${seg}`, roots: [seg], rep: seg, tail: [[80, yca, z - 15], [IC.xma[i], -20, z - 50], [35, IC.yae[i], IC.zant[i]]], width: 2, mix: 'mixed' };
  }),
  { id: 'subcostal', roots: ['T12'], rep: 'T12', tail: [[80, -95, -485], [131, -10, -540], [75, 70, -715]], width: 2, mix: 'mixed' },
  // Lumbar plexus (§2.12)
  { id: 'femoral', roots: ['L2', 'L3', 'L4'], rep: 'L4', tail: [...FEMORAL, [94, 42, -900], 'muscle:quadriceps'], width: 7, mix: 'mixed' },
  { id: 'saphenous', roots: ['L3', 'L4'], rep: 'L4', tail: [...FEMORAL, [85, 52, -790], [70, 25, -950], [55, -15, -1170], [60, -45, -1450], [80, 10, -1640]], width: 3, mix: 'cutaneous' },
  { id: 'obturator', roots: ['L2', 'L3', 'L4'], rep: 'L3', tail: [[35, -18, -620], [55, 8, -690], [48, 38, -755], [41, 26, -843], [39, 7, -1000], [38, 0, -1064]], width: 4, mix: 'mixed' },
  { id: 'obturator.adductors', roots: ['L2', 'L3', 'L4'], rep: 'L3', tail: [[35, -18, -620], [55, 8, -690], [48, 38, -755], [41, 26, -843], 'muscle:adductors'], width: 2, mix: 'motor', lod: 1 },
  // Sacral plexus (§2.12)
  { id: 'sciatic', roots: ['L4', 'L5', 'S1', 'S2', 'S3'], rep: 'S1', via: SCIATIC_VIA, tail: [...SCIATIC], width: 17, mix: 'mixed' },
  { id: 'sciatic.hamstrings', roots: ['L5', 'S1', 'S2'], rep: 'S1', via: SCIATIC_VIA, tail: [SAC.P, SAC.N, [80, -80, -790], 'muscle:hamstrings'], width: 3, mix: 'motor', lod: 1 },
  { id: 'tibial', roots: ['L4', 'L5', 'S1', 'S2', 'S3'], rep: 'S1', via: SCIATIC_VIA, tail: [...SCIATIC, [80, -60, -1170], [80, -55, -1350], [60, -55, -1600], [80, 20, -1662]], width: 8, mix: 'mixed' },
  { id: 'tibial.gastrocSoleus', roots: ['S1', 'S2'], rep: 'S1', via: SCIATIC_VIA, tail: [...SCIATIC, [80, -60, -1170], 'muscle:gastrocSoleus'], width: 3, mix: 'motor', lod: 1 },
  { id: 'commonFibular', roots: ['L4', 'L5', 'S1', 'S2'], rep: 'L5', via: SCIATIC_VIA, tail: [...SCIATIC, [110, -50, -1150], [133, -28, -1210], [93, -1, -1400], [82, -18, -1585], [88, 60, -1645], [85, 125, -1650], 'site:bigToe'], width: 5, mix: 'mixed' },
  { id: 'commonFibular.tibialisAnt', roots: ['L4', 'L5'], rep: 'L5', via: SCIATIC_VIA, tail: [...SCIATIC, [110, -50, -1150], [133, -28, -1210], 'muscle:tibialisAnt'], width: 2, mix: 'motor', lod: 1 },
  { id: 'pudendal', roots: ['S2', 'S3', 'S4'], rep: 'S3', tail: [[35, -60, -720], [50, -60, -765], [45, -30, -800], [0, -20, -815]], width: 3, mix: 'pudendal' }, // schematic; ends at the perineal midline (A.1)
  // Autonomic: chain, rami, splanchnics, pelvic (§2.11, §2.12)
  { id: 'sympatheticTrunk', cls: 'auto', tail: ['gang:scg', 'gang:mcg', GANG.stellate.ends[0], GANG.stellate.ends[1],
    ...CHAIN_T_Y.map((_, i) => `gang:chain.T${i + 2}`), ...CHAIN_L.map((_, i) => `gang:chain.L${i + 1}`),
    ...CHAIN_S.map((_, i) => `gang:chain.S${i + 1}`), 'gang:impar'], width: 3, mix: 'symp' },
  { id: 'splanchnicGreater', cls: 'auto', roots: ['T5', 'T6', 'T7', 'T8', 'T9'], tail: ['gang:chain.T7', [28, -60, -340], [20, -45, -430], 'gang:coeliac'], width: 2.5, mix: 'symp' },
  { id: 'splanchnicLesser', cls: 'auto', roots: ['T10', 'T11'], tail: ['gang:chain.T10', [22, -45, -460], 'gang:aorticorenal'], width: 2, mix: 'symp' },
  { id: 'splanchnicLeast', cls: 'auto', roots: ['T12'], tail: ['gang:chain.T12', 'gang:renalPlexus'], width: 2, mix: 'symp' },
  { id: 'splanchnicLumbar', cls: 'auto', roots: ['L1', 'L2'], tail: ['gang:chain.L1', 'gang:img', 'gang:supHypogastric'], width: 2, mix: 'symp' },
  { id: 'adrenalNerve', cls: 'auto', tail: ['gang:coeliac', 'organ:adrenalMedulla'], width: 1.5, mix: 'symp', model: true },
  { id: 'cardiacSymp', cls: 'auto', side: 1, tail: [GANG.stellate.ends[1], 'gang:cardiacPlexus', 'organ:saNode'], width: 2, mix: 'symp' },
  { id: 'cardiacSymp', cls: 'auto', side: -1, tail: [sided(GANG.stellate.ends[1], -1), 'gang:cardiacPlexus', 'organ:ventricles'], width: 2, mix: 'symp' },
  { id: 'hypogastric', cls: 'auto', tail: ['gang:supHypogastric', 'gang:infHypogastric'], width: 2, mix: 'symp' },
  { id: 'splanchnicPelvic', cls: 'auto', roots: ['S2', 'S3', 'S4'], rep: 'S3', via: { S2: [SAC.F2], S3: [SAC.F3], S4: [SAC.F4] }, tail: ['gang:infHypogastric'], width: 2, mix: 'pelvic' },
  { id: 'pelvicVisceral.bladder', cls: 'auto', tail: ['gang:infHypogastric', BLADDER.neck], width: 1.5, mix: 'pelvic', model: true },
  { id: 'pelvicVisceral.rectum', cls: 'auto', tail: ['gang:infHypogastric', [0, -38, -740]], width: 1.5, mix: 'pelvic', model: true },
  { id: 'splenicNerve', cls: 'auto', side: -1, tail: [[-18, -10, -470], [-45, -12, -472], [-86, -40, -460]], width: 1.5, mix: 'splenic' }, // §2.10, contested (A.8 #16)
  // Vagus and branches, per side (§2.12)
  { id: 'cn10', cls: 'auto', side: 1, tail: VAGUS_R, width: 3.5, mix: 'vagus' },
  { id: 'cn10', cls: 'auto', side: -1, tail: VAGUS_L, width: 3.5, mix: 'vagus' },
  { id: 'cn10.cardiac', cls: 'auto', side: 1, tail: [...vagusUpTo(VAGUS_R, [31, -6, -215]), 'gang:cardiacPlexus', 'organ:saNode'], width: 1.5, mix: 'para' },
  { id: 'cn10.cardiac', cls: 'auto', side: -1, tail: [...vagusUpTo(VAGUS_L, [-31, -6, -215]), 'gang:cardiacPlexus', 'organ:avNode'], width: 1.5, mix: 'para' },
  { id: 'cn10.pulmonary', cls: 'auto', side: 1, tail: [...vagusUpTo(VAGUS_R, [20, -30, -300]), [45, -20, -300]], width: 1.5, mix: 'vagus', lod: 1 },
  { id: 'cn10.pulmonary', cls: 'auto', side: -1, tail: [...vagusUpTo(VAGUS_L, [-36, -24, -300]), [-45, -20, -300]], width: 1.5, mix: 'vagus', lod: 1 },
  { id: 'cn10.rln', cls: 'nerve', side: 1, tail: [...vagusUpTo(VAGUS_R, [31, -6, -215]), [35, -5, -225], [8, -2, -180]], width: 1.5, mix: 'cranialMotor', lod: 1 },
  { id: 'cn10.rln', cls: 'nerve', side: -1, tail: [...vagusUpTo(VAGUS_L, [-35, -6, -258]), [-12, -16, -280], [-8, -2, -200]], width: 1.5, mix: 'cranialMotor', lod: 1 },
  { id: 'cn10.arch', cls: 'auto', side: -1, tail: [...vagusUpTo(VAGUS_L, [-35, -6, -258]), 'site:aorticArch'], width: 1.5, mix: 'visceralAff' },
  { id: 'cn10.hepatic', cls: 'auto', side: -1, tail: [...vagusUpTo(VAGUS_L, [-22, -10, -415]), [40, 10, -440]], width: 1.5, mix: 'vagus', lod: 1 },
  { id: 'cn10.duodenum', cls: 'auto', side: 1, tail: [...VAGUS_R.slice(0, VAGUS_R.indexOf('gang:coeliac') + 1), 'site:duodenum'], width: 1.5, mix: 'vagus', model: true },
  // Glossopharyngeal, facial, trigeminal, accessory, hypoglossal, ocular (§2.12)
  { id: 'carotidSinusNerve', cls: 'auto', tail: ['brain:cn9', [30, -32, -62], 'gang:petrosalGang', [28, -8, -95], 'site:carotidSinus'], width: 1, mix: 'visceralAff' },
  { id: 'cn9.special', tail: ['brain:cn9', [30, -32, -62], 'gang:petrosalGang', [25, 10, -90], 'site:tonguePost'], width: 1, mix: 'special' },
  { id: 'cn9.para', cls: 'auto', tail: ['brain:cn9', [30, -32, -62], 'gang:oticGang', 'organ:parotid'], width: 1, mix: 'para', model: true },
  { id: 'cn7.special', tail: ['brain:cn7', HEAD.porus, [47, -27, -45], [35, 0, -70], [28, 40, -105], 'site:tongueAnt'], width: 1, mix: 'special' },
  { id: 'cn7.motor', tail: ['brain:cn7', HEAD.porus, [45, -22, -70], [52, -5, -80], [60, 50, -50], 'muscle:orbicularisOculi'], width: 2, mix: 'cranialMotor' },
  { id: 'cn7.motor.temporal', tail: ['brain:cn7', HEAD.porus, [45, -22, -70], [52, -5, -80], [62, 22, -20]], width: 1, mix: 'cranialMotor', lod: 2 },
  { id: 'cn7.motor.buccal', tail: ['brain:cn7', HEAD.porus, [45, -22, -70], [52, -5, -80], [50, 65, -80]], width: 1, mix: 'cranialMotor', lod: 2 },
  { id: 'cn7.motor.mandibular', tail: ['brain:cn7', HEAD.porus, [45, -22, -70], [52, -5, -80], [45, 55, -120]], width: 1, mix: 'cranialMotor', lod: 2 },
  { id: 'cn7.motor.cervical', tail: ['brain:cn7', HEAD.porus, [45, -22, -70], [52, -5, -80], [40, 20, -140]], width: 1, mix: 'cranialMotor', lod: 2 },
  { id: 'cn7.stapedius', tail: ['brain:cn7', HEAD.porus, 'muscle:stapedius'], width: 1, mix: 'cranialMotor', lod: 1 },
  { id: 'cn7.para', cls: 'auto', tail: ['brain:cn7', HEAD.porus, 'gang:pterygopalatineGang', 'organ:lacrimal'], width: 1, mix: 'para', model: true },
  { id: 'cn7.para.submandibular', cls: 'auto', tail: ['brain:cn7', HEAD.porus, [47, -27, -45], [35, 0, -70], [28, 40, -105], 'gang:submandibularGang', 'organ:submandibularGland'], width: 1, mix: 'para', model: true },
  { id: 'cn5.som.v1', tail: ['brain:cn5', 'gang:trigeminalGang', [18, 30, -30], [25, 72, -18], 'site:foreheadV1'], width: 2, mix: 'cutaneous' },
  { id: 'cn5.som.v2', tail: ['brain:cn5', 'gang:trigeminalGang', [20, 15, -45], [28, 72, -60], 'site:cheekV2'], width: 2, mix: 'cutaneous' },
  { id: 'cn5.som.v3', tail: ['brain:cn5', 'gang:trigeminalGang', [24, -5, -50], [25, 78, -135], 'site:chinV3'], width: 2, mix: 'cutaneous' },
  { id: 'cn5.motor', tail: ['brain:cn5', 'gang:trigeminalGang', [24, -5, -50], 'muscle:masseter'], width: 1.5, mix: 'cranialMotor', lod: 1 },
  { id: 'cn11', tail: ['brain:cn11', [30, -32, -62], [45, -15, -95], [52, -30, -150], 'muscle:trapezius'], width: 2.5, mix: 'cranialMotor' },
  { id: 'cn11.scm', tail: ['brain:cn11', [30, -32, -62], [45, -15, -95], 'muscle:sternocleidomastoid'], width: 1.5, mix: 'cranialMotor', lod: 1 },
  { id: 'cn12', tail: ['brain:cn12', [18, -33, -63], [30, -10, -90], [35, 20, -138], [15, 45, -100]], width: 2.5, mix: 'cranialMotor' },
  { id: 'cn3', tail: ['brain:cn3', [18, 30, -30], 'muscle:extraocular'], width: 1.5, mix: 'cranialMotor' },
  { id: 'cn4', tail: ['brain:cn4', [14, -20, -28], [18, 30, -30], 'muscle:extraocular'], width: 1, mix: 'cranialMotor', model: true },
  { id: 'cn6', tail: ['brain:cn6', [16, -5, -36], [18, 30, -30], 'muscle:extraocular'], width: 1, mix: 'cranialMotor', model: true },
  { id: 'cn3.para', cls: 'auto', tail: ['brain:ew', 'brain:cn3', [18, 30, -30], 'gang:ciliaryGang', [39, 49, -37], 'organ:pupilSphincter'], width: 1, mix: 'para' },
  { id: 'pupilSymp', cls: 'auto', tail: ['gang:scg', [27, -5, -90], [25, -15, -60], [20, 10, -35], [18, 30, -30], [39, 49, -37], 'organ:pupilDilator'], width: 1, mix: 'symp', model: true },
  { id: 'cn2', tail: ['brain:chiasm', [12, 22, -26], 'brain:cn2'], width: 2, mix: 'special' },
  { id: 'cn1', tail: ['brain:olfBulb', HEAD.cribriform, 'site:olfEpith'], width: 1, mix: 'special' },
  { id: 'cn8', tail: ['brain:cn8', HEAD.porus, 'site:cochlea'], width: 1.5, mix: 'special' },
  { id: 'cn8.vest', tail: ['brain:cn8', HEAD.porus, 'site:vestLabyrinth'], width: 1.5, mix: 'special' },
];

// White rami (T1–L2, §6.4): IML → ventral root → foramen → DRG → chain ganglion.
const WHITE_RAMI = SEGMENTS.slice(SEG_INDEX.T1, SEG_INDEX.L2 + 1);
const chainFor = (seg) => (seg === 'T1' ? 'gang:stellate' : seg[0] === 'T' ? `gang:chain.${seg}` : `gang:chain.L${seg.slice(1)}`);

// ---------------------------------------------------------------------------------------------
// Anchor resolution and path assembly
// ---------------------------------------------------------------------------------------------
const ORGAN_POINTS = {
  saNode: [30, 0, -312], avNode: [5, -2, -350], ventricles: [-35, 25, -372], parotid: [50, -8, -80], lacrimal: [44, 60, -27],
  submandibularGland: [35, 12, -142], adrenalMedulla: [42, -42, -447], pupilSphincter: HEAD.cornealApex, pupilDilator: HEAD.cornealApex,
};
const MID_ORGANS = new Set(['saNode', 'avNode', 'ventricles']);
function sitePos(id) {
  if (id.startsWith('dermatome.')) return DERMATOME_POINTS[id.slice(10)];
  return SKIN_SITES[id] || MID_SKIN_SITES[id] || TENDONS[id] || SPECIAL[id]?.pos || INTERO[id]?.pos || JOINTS[id];
}
const MID_SITES = new Set(['umbilicus', 'aorticArch', 'stomachWall', 'colonRectum', 'bladder', 'duodenum']);
function resolve(tok, side) {
  if (Array.isArray(tok)) return sided(tok, side);
  const [kind, id] = [tok.slice(0, tok.indexOf(':')), tok.slice(tok.indexOf(':') + 1)];
  switch (kind) {
    case 'drg': return drg(id, side);
    case 'brain': return BRAIN_MID.has(id) ? [...BRAIN_ANCHORS[id]] : sided(BRAIN_ANCHORS[id], side);
    case 'gang': { const g = GANG[id]; return g.mid ? [...g.c] : sided(g.c, side); }
    case 'muscle': { const m = MUSCLE[id]; return m.mid ? [...m.c] : sided(m.c, side); }
    case 'site': { const p = sitePos(id); return MID_SITES.has(id) ? [...p] : sided(p, side); }
    case 'organ': return MID_ORGANS.has(id) ? [...ORGAN_POINTS[id]] : sided(ORGAN_POINTS[id], side);
    default: throw new Error(`unknown waypoint ${tok}`);
  }
}
function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (dist(pts[i], out[out.length - 1]) > 0.25) out.push(pts[i]);
  return out;
}

export const PATHS = [];
export const PATH_INDEX = new Map();
const ROUTE_DEFS = new Map();   // nerve id → route definition(s) by side
function addPath(p) {
  p.index = PATHS.length;
  p.pts = dedupe(p.pts);
  p.len = polylineLength(p.pts);
  PATHS.push(p);
  PATH_INDEX.set(p.id, p.index);
  return p;
}
function routePoints(def, side, root) {
  const tail = def.tail.map((t) => (def.side ? (Array.isArray(t) ? [...t] : resolve(t, def.side)) : resolve(t, side)));
  if (!def.rep) return tail;
  const r = root || def.rep;
  const via = (def.via?.[r] || []).map((t) => (def.side ? [...t] : sided(t, side)));
  return [drg(r, def.side || side), ...via, ...tail];
}
const CLS = { nerve: TISSUE.nerve, auto: TISSUE.ganglion, vessel: TISSUE.vessel, cord: TISSUE.cord, gut: TISSUE.enteric };
const bitsOfMix = (mix) => Object.keys(MIX[mix]).reduce((a, k) => a | +k, 0);

for (const def of NERVE_ROUTES) {
  const sides = def.side ? [def.side] : [1, -1];
  for (const side of sides) {
    const id = def.id + sideSuffix(side);
    if (!ROUTE_DEFS.has(def.id)) ROUTE_DEFS.set(def.id, {});
    ROUTE_DEFS.get(def.id)[side] = def;
    addPath({
      id, nerve: def.id, side, kind: def.cls === 'auto' ? 'autonomic' : 'somatic', cls: CLS[def.cls || 'nerve'],
      bits: bitsOfMix(def.mix), mix: MIX[def.mix], roots: def.roots || [], root: def.rep || null,
      width: def.width, lod: def.lod || 0, model: !!def.model, pts: routePoints(def, side),
    });
  }
}
for (const seg of WHITE_RAMI) for (const side of [1, -1]) {
  const c = CORD[seg], [entry, foramen, g] = rootPath(seg, side, true);
  const iml = [side * 0.5 * c.rx, c.c[1] - 0.03 * c.ry, c.c[2]];   // §6.3 IML at ξ ≈ 0.5
  addPath({ id: `ramus.${seg}${sideSuffix(side)}`, nerve: 'ramus', side, kind: 'autonomic', cls: TISSUE.ganglion, bits: NET.SY,
    mix: { [NET.SY]: 1 }, roots: [seg], root: seg, width: 1, lod: 1, pts: [iml, entry, foramen, g, resolve(chainFor(seg), side)] });
}
// Spinal cord, roots and filum (§2.5).
{
  const canal = [[0, FRAME.junction[1], FRAME.junction[2]]];
  for (const [y, z] of CANAL) if (z < FRAME.junction[2] && z > FRAME.conus[2]) canal.push([0, y, z]);
  canal.push([0, canalAt(FRAME.conus[2]).y, FRAME.conus[2]]);
  addPath({ id: 'cord', nerve: 'cord', side: 0, kind: 'cord', cls: TISSUE.cord, bits: NET.SA | NET.SE, mix: { [NET.SA]: 0.5, [NET.SE]: 0.5 }, roots: [], root: null, width: 8, lod: 0, pts: canal });
  for (const seg of SEGMENTS) for (const side of [1, -1]) {
    addPath({ id: `root.${seg}${sideSuffix(side)}`, nerve: 'root', side, kind: 'root', cls: TISSUE.cord, bits: NET.SA, mix: { [NET.SA]: 1 },
      roots: [seg], root: seg, width: 1.2, lod: 0, pts: rootPath(seg, side, false) });
    addPath({ id: `vroot.${seg}${sideSuffix(side)}`, nerve: 'vroot', side, kind: 'root', cls: TISSUE.cord, bits: NET.SE, mix: { [NET.SE]: 1 },
      roots: [seg], root: seg, width: 1.2, lod: 0, pts: rootPath(seg, side, true) });
  }
  addPath({ id: 'filum', nerve: 'filum', side: 0, kind: 'cord', cls: TISSUE.cord, bits: 0, mix: { 0: 1 }, roots: [], root: null, width: 0.5, lod: 1,
    pts: [FRAME.conus, FRAME.sacEnd, FRAME.filumEnd] });
}
for (const v of VESSELS) for (const side of v.sided ? [1, -1] : [0]) {
  addPath({ id: v.id + sideSuffix(side), nerve: v.id, side, kind: 'vessel', cls: TISSUE.vessel, bits: NET.NE, mix: { [NET.NE]: 1 },
    roots: [], root: null, width: 0, lod: 0, pts: v.pts.map((p) => sided(p, side || 1)), radii: v.pts.map((p) => p[3]) });
}
{   // The gut as one path; u = sDraw / total (A.2 keeps s for the model, §8.2).
  const pts = [...GUT.pieces[0].rows.map((r) => r[1]), ...GUT.pieces[1].rows.map((r) => r[1])];
  const p = addPath({ id: 'gut', nerve: 'gut', side: 0, kind: 'gut', cls: TISSUE.enteric, bits: NET.EN, mix: { [NET.EN]: 1 }, roots: [], root: null, width: 0, lod: 0, pts });
  p.len = GUT.totalDraw;   // drawn arc incl. the 1-mm valve gap, not the polyline across the caecum
}

// Re-rooted nerve path: the same route started at another of its root segments (e.g. the median
// nerve from the C6 DRG through the upper trunk). Returns a path-like object (not in PATHS).
const variantCache = new Map();
export function nervePath(nerve, { root = null, side = 1 } = {}) {
  const defs = ROUTE_DEFS.get(nerve);
  if (!defs) return null;
  const def = defs[side] || defs[1] || defs[-1];
  const s = def.side || side;
  const r = root && def.rep && (def.roots || []).includes(root) ? root : def.rep;
  const key = `${nerve}|${r}|${s}`;
  if (!variantCache.has(key)) {
    const pts = dedupe(routePoints(def, s, r));
    variantCache.set(key, { id: nerve + sideSuffix(s), nerve, side: s, root: r, pts, len: polylineLength(pts), base: PATH_INDEX.get(nerve + sideSuffix(s)) });
  }
  return variantCache.get(key);
}
export function pathById(id) { const i = PATH_INDEX.get(id); return i === undefined ? null : PATHS[i]; }

// Drawn spline of a path (Catmull–Rom through the waypoints, §2.12), resampled by arc length so u
// is uniform along the drawn curve. Lazily built and cached on the path.
export function pathSamples(path) {
  if (path.samples) return path.samples;
  const pts = path.pts, n = pts.length;
  let dense;
  if (path.kind === 'gut' || path.kind === 'cord' || path.kind === 'root' || n < 3) dense = pts.map((p) => [p[0], p[1], p[2]]);
  else {
    const f = spline(pts);
    const N = Math.max(8, (n - 1) * 12);
    dense = [];
    for (let i = 0; i <= N; i++) dense.push(f(i / N));
  }
  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) cum[i] = cum[i - 1] + dist(dense[i - 1], dense[i]);
  path.samples = { pts: dense, cum, arcLen: cum[cum.length - 1] };
  return path.samples;
}
// Position and unit tangent at u ∈ [0, 1] (arc fraction of the drawn curve; u = 0 at the CNS end).
export function pathAt(path, u) {
  const S = pathSamples(path), c = S.cum, s = clamp(u) * S.arcLen;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const f = (s - c[lo]) / Math.max(1e-9, c[hi] - c[lo]);
  const a = S.pts[lo], b = S.pts[hi];
  return { p: lerp3(a, b, f), t: norm(sub(b, a)) };
}
// Distance from the CNS end to the point of a polyline nearest to q: { along, off, t }.
export function nearestOnPolyline(pts, q) {
  let best = { along: 0, off: Infinity }, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = dist(a, b);
    const r = segDist(q, a, b);
    if (r.d < best.off) best = { along: acc + r.t * L, off: r.d };
    acc += L;
  }
  return best;
}
// Polyline length from the CNS end to the waypoint nearest to q (for partial standard paths).
function lengthToWaypoint(pts, q) {
  let acc = 0, best = Infinity, at = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += dist(pts[i - 1], pts[i]);
    const d = dist(pts[i], q);
    if (d < best) { best = d; at = acc; }
  }
  return at;
}

// ---------------------------------------------------------------------------------------------
// Sites with their routing (§13.12: dermatome, nerve territory, segment, path length)
// ---------------------------------------------------------------------------------------------
const SITE_ROUTE = {   // site → drawn path (proxy where the named §6.6 nerve has no §2.12 route)
  'dermatome.C2': 'plexusCervical.lesserOccipital', 'dermatome.C3': 'plexusCervical.supraclavicular',
  'dermatome.C4': 'plexusCervical.supraclavicularLat', 'dermatome.C5': 'musculocutaneous', 'dermatome.C6': 'radial',
  'dermatome.C7': 'radial', 'dermatome.C8': 'ulnar', 'dermatome.T1': 'ulnar', 'dermatome.T12': 'subcostal',
  'dermatome.L2': 'femoral', 'dermatome.L3': 'saphenous', 'dermatome.L4': 'saphenous', 'dermatome.L5': 'commonFibular',
  'dermatome.S1': 'tibial', 'dermatome.S2': 'sciatic', 'dermatome.S3': 'sciatic',
  indexTip: 'median', palm: 'median', forearmDorsal: 'radial', footSole: 'tibial', heel: 'tibial', bigToe: 'commonFibular',
  umbilicus: 'intercostal.T10', foreheadV1: 'cn5.som.v1', cheekV2: 'cn5.som.v2', chinV3: 'cn5.som.v3',
  bicepsTendon: 'musculocutaneous.biceps', tricepsTendon: 'radial.triceps', patellarTendon: 'femoral', achillesTendon: 'tibial.gastrocSoleus',
  shoulder: 'axillary', elbow: 'musculocutaneous', wrist: 'median', finger: 'median', hip: 'femoral', knee: 'femoral', ankle: 'tibial',
  retina: 'cn2', cochlea: 'cn8', vestLabyrinth: 'cn8.vest', olfEpith: 'cn1', tongueAnt: 'cn7.special', tonguePost: 'cn9.special',
  carotidSinus: 'carotidSinusNerve', aorticArch: 'cn10.arch', lungStretch: 'cn10.pulmonary', stomachWall: 'cn10', duodenum: 'cn10.duodenum',
  colonRectum: 'pelvicVisceral.rectum', bladder: 'pelvicVisceral.bladder',
};
for (let i = 2; i <= 11; i++) SITE_ROUTE[`dermatome.T${i}`] = `intercostal.T${i}`;
const SITE_ROUTE_SIDE = { aorticArch: -1, stomachWall: -1, duodenum: 1, colonRectum: 1, bladder: 1 };
const SENSES_OF = {
  skin: ['touch', 'pain', 'temperature'], tendon: ['proprioception'], joint: ['proprioception'], organ: ['interoception'],
  retina: ['vision'], cochlea: ['hearing'], olfEpith: ['smell'], tongueAnt: ['taste'], tonguePost: ['taste'], vestLabyrinth: ['balance'],
};

function makeSite(base, kind, posSpec, side) {
  let pos = posSpec;
  if (kind === 'skin') {                                        // §2.7 placements on the drawn skin (§2.15 ±3 mm)
    const q = snapToSkin(posSpec, 6);
    if (dist(q, posSpec) <= PARAMS.siteSnapMax) pos = q;
  }
  const seg = base.startsWith('dermatome.') ? { segment: base.slice(10), overlap: [], nerve: DERMATOME_NERVE[base.slice(10)] } : SITE_SEGMENTS[base];
  const pickable = !NEVER_PICKABLE.has(base);
  const site = {
    id: base + sideSuffix(side), base, kind, side, pos: [...pos], posSpec: [...posSpec], pickable, posteriorOnly: POSTERIOR_ONLY.has(base),
    segment: seg?.segment ?? null, overlap: seg?.overlap ?? [], nerve: seg?.nerve ?? null,
    senses: kind === 'special' ? SENSES_OF[base] : SENSES_OF[kind] || [], pathId: null, pathLen: null, rootLen: null, approx: false,
  };
  const routeId = SITE_ROUTE[base];
  const isSpinal = site.segment && /^(C|T|L|S)\d/.test(site.segment);
  if (routeId) {
    const rs = SITE_ROUTE_SIDE[base] ?? (side || 1);
    const nv = nervePath(routeId, { root: isSpinal ? site.segment : null, side: rs });
    if (nv) {
      const near = nearestOnPolyline(nv.pts, site.pos);
      site.pathId = nv.id;
      site.pathRoot = nv.root;
      site.pathLen = near.along + near.off;                    // site → CNS end of the route (DRG or brain attachment)
      site.twig = near.off;
      if (isSpinal && nv.root) site.rootLen = rootLength(nv.root);
    }
  }
  if (site.pathLen === null && isSpinal) {                      // no §2.12 route: straight-line estimate, flagged
    site.pathLen = dist(site.pos, drg(site.segment, side || 1)) * PARAMS.tortuosity;
    site.rootLen = rootLength(site.segment);
    site.approx = true;
  }
  return site;
}
function buildSites() {
  const out = [];
  for (const side of [1, -1]) {
    for (const seg of Object.keys(DERMATOME_POINTS)) out.push(makeSite(`dermatome.${seg}`, 'skin', sided(DERMATOME_POINTS[seg], side), side));
    for (const [id, p] of Object.entries(SKIN_SITES)) out.push(makeSite(id, 'skin', sided(p, side), side));
    for (const [id, p] of Object.entries(TENDONS)) out.push(makeSite(id, 'tendon', sided(p, side), side));
    for (const id of ['shoulder', 'elbow', 'wrist', 'finger', 'hip', 'knee', 'ankle']) out.push(makeSite(id, 'joint', sided(JOINTS[id], side), side));
    for (const [id, s] of Object.entries(SPECIAL)) if (!s.both) {
      const site = makeSite(id, 'special', sided(s.pos, side), side);
      site.pick = { c: sided(s.pick.c, side), r: s.pick.r.map((v) => v * 1.5) };
      out.push(site);
    }
    for (const [id, s] of Object.entries(INTERO)) if (s.sided) {
      const site = makeSite(id, 'organ', sided(s.pos, side), side);
      site.pick = { c: sided(s.pick.c, side), r: s.pick.r };
      out.push(site);
    }
  }
  for (const [id, p] of Object.entries(MID_SKIN_SITES)) out.push(makeSite(id, 'skin', p, 0));
  const lab = makeSite('vestLabyrinth', 'special', SPECIAL.vestLabyrinth.pos, 0);    // both labyrinths, the head as the target (A.6)
  lab.pick = { c: SPECIAL.vestLabyrinth.pick.c, r: SPECIAL.vestLabyrinth.pick.r };
  out.push(lab);
  for (const [id, s] of Object.entries(INTERO)) if (!s.sided) {
    const site = makeSite(id, 'organ', s.pos, 0);
    site.pick = { c: s.pick.c, r: s.pick.r };
    out.push(site);
  }
  // S4–S5 perianal band: posterior and schematic, listed so readouts can name it; never pickable (A.1).
  for (const seg of ['S4', 'S5']) {
    out.push({ id: `dermatome.${seg}`, base: `dermatome.${seg}`, kind: 'skin', side: 0, pos: [0, -128, seg === 'S4' ? -828 : -838],
      pickable: false, posteriorOnly: false, segment: seg, overlap: [], nerve: 'pudendal', senses: [], pathId: null, pathLen: null, rootLen: null, approx: true });
  }
  return out;
}
export const SITES = buildSites();
export const SITE_INDEX = new Map(SITES.map((s, i) => [s.id, i]));
export function siteById(id) { const i = SITE_INDEX.get(id); return i === undefined ? null : SITES[i]; }

// ---------------------------------------------------------------------------------------------
// Standard path lengths (§2.14), computed on this geometry; A.9 holds the defaults (≤ 10 %).
// ---------------------------------------------------------------------------------------------
function computeStandardPaths() {
  const P = (id) => pathById(id);
  const B = (id, side = 1) => (BRAIN_MID.has(id) ? BRAIN_ANCHORS[id] : sided(BRAIN_ANCHORS[id], side));
  const median = P('median.R');
  const out = {
    fingertipToC7Drg: { value: median.len, a9: 921, ref: 919 },
    wristToC7Drg: { value: lengthToWaypoint(median.pts, [230, -10, -820]), a9: 738, ref: 737 },
    c7DrgToSegment: { value: rootLength('C7'), a9: 22, ref: 24 },
    c7SegmentToCuneate: { value: CORD.C7.arc + dist(FRAME.junction, B('cuneate')), a9: 100, ref: 100 },
    cuneateToVpl: { value: polylineLength([B('cuneate'), ...TRACT_ML]), a9: 71, ref: 73 },
    vplToS1Hand: { value: polylineLength(TRACT_THAL_S1), a9: 60, ref: 60 },
    quadricepsToL4Drg: { value: P('femoral.R').len, a9: 413, ref: 413 },
    l4DrgToSegment: { value: rootLength('L4'), a9: 173, ref: 188 },
    calfToS1Drg: { value: P('tibial.gastrocSoleus.R').len, a9: 663, ref: 676 },
    s1DrgToSegment: { value: rootLength('S1'), a9: 194, ref: 201 },
    greatToeToL5Drg: { value: P('commonFibular.R').len, a9: 1156, ref: 1196 },
    junctionToConus: { value: CORD_ARC_CONUS, a9: 435, ref: 435 },
    carotidSinusToNts: { value: P('carotidSinusNerve.R').len + dist(B('cn9'), B('ntsVisc')), a9: 100, ref: 104 },
    saNodeToNAmbVagal: { value: P('cn10.cardiac.R').len + dist(B('cn10'), B('nAmbVagal')), a9: 312, ref: 289 },
    stomachToNts: { value: P('cn10.L').len + dist(B('cn10', -1), B('ntsVisc', -1)), a9: 502, ref: 521 },
    // Other §2.14 rows (no A.9 default)
    l3DrgToSegment: { value: rootLength('L3'), a9: null, ref: 166 },
    ankleToS1Drg: { value: lengthToWaypoint(P('tibial.R').pts, [60, -55, -1600]), a9: null, ref: 977 },
    c4SegmentToRightDome: { value: rootLength('C4') + P('phrenic.R').len, a9: null, ref: 319 },
    c4SegmentToLeftDome: { value: rootLength('C4') + P('phrenic.L').len, a9: null, ref: 331 },
    c6SegmentToBiceps: { value: rootLength('C6') + P('musculocutaneous.biceps.R').len, a9: null, ref: 392 },
    ewToCiliaryGang: { value: lengthToWaypoint(P('cn3.para.R').pts, GANG.ciliaryGang.c), a9: null, ref: 78 },
  };
  for (const v of Object.values(out)) {
    v.devA9 = v.a9 ? (v.value - v.a9) / v.a9 : null;
    v.devRef = v.ref ? (v.value - v.ref) / v.ref : null;
  }
  return out;
}
export const STANDARD_PATHS = (() => computeStandardPaths())();

// ---------------------------------------------------------------------------------------------
// Node ids referenced by the GPU records (a2.x = index into NODE_IDS)
// ---------------------------------------------------------------------------------------------
export const NODE_IDS = [];
export const NODE_INDEX = new Map();
export function nodeIndex(id) {
  let i = NODE_INDEX.get(id);
  if (i === undefined) { i = NODE_IDS.length; NODE_IDS.push(id); NODE_INDEX.set(id, i); }
  return i;
}
for (const r of SKIN_REGIONS) nodeIndex(`skin.${r}`);
for (const s of SEGMENTS) { nodeIndex(`cord.${s}`); nodeIndex(`drg.${s}`); }
