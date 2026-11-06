// @ts-check
// Heart form (research/HEART.md §2): the chambers, valve rings, great-vessel roots and the cardiac
// conduction system, in the body frame (mm; x right, y anterior, z superior). Shared by the star
// generator (body/generate.js) and the body shader (shaders.js), so it has no heavy imports.
//
// Every heart star carries three numbers in its normal slot (the slot is unused for volumes):
//   x: τ, its place on the activation timeline (−1 none; 0–1 atrial, 1–2 AV node, 2–3 His–Purkinje
//      and ventricles; heart.js maps τ to seconds for the beat at hand);
//   y: the part code (PART);
//   z: its axial place in the ventricles, 0 at the apex and 1 at the base (the base moves most).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

export const PART = {
  RA: 1, LA: 2, RV: 3, LV: 4, VALVE: 5, SA: 6, ATRIAL_PATH: 7, AV: 8, HIS: 9, PURKINJE: 10, ROOT: 11,
  CORONARY_A: 12, CORONARY_V: 13, LEAFLET: 14, CHORDAE: 15,
  // Fine anatomy (HEART.md §8): ventricular trabeculae, atrial pectinate muscles and the crista
  // terminalis, epicardial fat, the pericardial sac, and the fibrous parts of the right atrium (fossa
  // ovalis, the valves of the coronary sinus and the IVC, the tendon of Todaro).
  TRABECULA: 16, PECTINATE: 17, FAT: 18, PERICARDIUM: 19, ATRIAL_FIBROUS: 20,
};
// Structure names for the hover label (HEART.md §8.6): every heart star carries the id of its
// structure in the path-position slot (heart stars have no path) as id / LABEL_SCALE, so the slot
// keeps its B.7 range 0–1 (exact in float32). 0 = none.
const LABEL_LIST = [
  ['lvWall', 'Left ventricle'], ['ivs', 'Interventricular septum'], ['rvWall', 'Right ventricle'],
  ['raWall', 'Right atrium'], ['laWall', 'Left atrium'], ['raAuricle', 'Right auricle'], ['laAuricle', 'Left auricle'],
  ['tvRing', 'Tricuspid annulus'], ['mvRing', 'Mitral annulus'], ['avRing', 'Aortic annulus'], ['pvRing', 'Pulmonary annulus'],
  ['tvAnt', 'Tricuspid valve · anterior leaflet'], ['tvPost', 'Tricuspid valve · posterior leaflet'], ['tvSept', 'Tricuspid valve · septal leaflet'],
  ['mvAnt', 'Mitral valve · anterior leaflet'], ['mvPost', 'Mitral valve · posterior leaflet (P1–P3)'],
  ['avR', 'Aortic valve · right coronary cusp'], ['avL', 'Aortic valve · left coronary cusp'], ['avN', 'Aortic valve · non-coronary cusp'],
  ['pvA', 'Pulmonary valve · anterior cusp'], ['pvL', 'Pulmonary valve · left cusp'], ['pvR', 'Pulmonary valve · right cusp'],
  ['nodule', 'Nodule of Arantius'], ['lunula', 'Lunula of a semilunar cusp'],
  ['chordae1', 'Chordae tendineae · primary (free edge)'], ['chordae2', 'Chordae tendineae · secondary'], ['chordae3', 'Chordae tendineae · tertiary'],
  ['pmAL', 'Anterolateral papillary muscle'], ['pmPM', 'Posteromedial papillary muscle'],
  ['pmRA', 'Anterior papillary muscle (RV)'], ['pmRP', 'Posterior papillary muscle (RV)'], ['pmRS', 'Septal papillary muscle (RV)'],
  ['trabLV', 'Trabeculae carneae (LV)'], ['trabRV', 'Trabeculae carneae (RV)'], ['moderator', 'Septomarginal trabecula (moderator band)'],
  ['falseTendon', 'False tendon (LV)'], ['crista', 'Crista terminalis'], ['pectRA', 'Pectinate muscles'], ['pectLA', 'Pectinate muscles (left auricle)'],
  ['fossa', 'Fossa ovalis'], ['limbus', 'Limbus of the fossa ovalis'], ['csOstium', 'Coronary sinus ostium'],
  ['thebesian', 'Thebesian valve (coronary sinus)'], ['eustachian', 'Eustachian valve (IVC)'], ['todaro', 'Tendon of Todaro'],
  ['membranous', 'Membranous septum'],
  ['aorta', 'Ascending aorta'], ['pulmonaryTrunk', 'Pulmonary trunk'], ['pulmonaryArteryL', 'Left pulmonary artery'],
  ['pulmonaryArteryR', 'Right pulmonary artery'], ['svc', 'Superior vena cava'], ['ivc', 'Inferior vena cava'],
  ['pulmonaryVeinLU', 'Left superior pulmonary vein'], ['pulmonaryVeinLL', 'Left inferior pulmonary vein'],
  ['pulmonaryVeinRU', 'Right superior pulmonary vein'], ['pulmonaryVeinRL', 'Right inferior pulmonary vein'],
  ['sinusR', 'Right coronary sinus (of Valsalva)'], ['sinusL', 'Left coronary sinus (of Valsalva)'], ['sinusN', 'Non-coronary sinus (of Valsalva)'],
  ['pulmSinus', 'Pulmonary sinus'], ['lcaOstium', 'Left coronary ostium'], ['rcaOstium', 'Right coronary ostium'],
  ['LM', 'Left main coronary artery'], ['LAD', 'Left anterior descending artery'], ['D1', 'First diagonal branch'], ['D2', 'Second diagonal branch'],
  ['LCx', 'Left circumflex artery'], ['OM', 'Obtuse marginal branch'], ['OM2', 'Second obtuse marginal branch'], ['RCA', 'Right coronary artery'],
  ['AM', 'Acute marginal branch'], ['PDA', 'Posterior descending artery'], ['PL', 'Posterolateral branch'], ['septal', 'Septal perforator'],
  ['conus', 'Conus branch'], ['sanA', 'Sinoatrial nodal artery'], ['avnA', 'Atrioventricular nodal artery'],
  ['greatCardiac', 'Great cardiac vein'], ['coronarySinus', 'Coronary sinus'], ['middleCardiac', 'Middle cardiac vein'],
  ['smallCardiac', 'Small cardiac vein'], ['posteriorLV', 'Posterior vein of the left ventricle'], ['anteriorCardiac', 'Anterior cardiac vein'],
  ['oblique', 'Oblique vein of the left atrium'],
  ['sa', 'Sinoatrial node'], ['internodal', 'Internodal tract'], ['bachmann', "Bachmann's bundle"], ['av', 'Atrioventricular node'],
  ['avExt', 'Inferior nodal extension (slow pathway)'], ['his', 'Bundle of His'], ['lbb', 'Left bundle branch'],
  ['lpf', 'Left posterior fascicle'], ['laf', 'Left anterior fascicle'], ['lsf', 'Left septal fascicle'], ['rbb', 'Right bundle branch'],
  ['purkinje', 'Purkinje fibres'], ['fat', 'Epicardial fat'], ['pericardium', 'Pericardium'],
];
export const LABEL = Object.fromEntries(LABEL_LIST.map(([k], i) => [k, i + 1]));
export const LABEL_NAMES = ['', ...LABEL_LIST.map(([, n]) => n)];
export const LABEL_SCALE = 128;
export const labelOf = (u) => Math.round(u * LABEL_SCALE);
// τ codes of stars that never depolarise: −1, and for leaflets −(2 + valve index) (valves order),
// for roots −1 (oxygenated, red) or −2 (venous, blue).
// Parts that conduct the impulse (drawn brighter; the wave is sharper in them).
export const CONDUCTION = new Set([PART.SA, PART.ATRIAL_PATH, PART.AV, PART.HIS, PART.PURKINJE]);

// Ventricular frame: the base (centre of the atrioventricular plane) and the apex (§2.8 apex less
// the wall); w runs base → apex, `ant` and `right` are perpendicular to it.
const BASE = [4, -2, -326], APEX = [-76, 46, -384];
const W = norm(sub(APEX, BASE));
const ANT = norm(sub([0, 1, 0], [W[0] * W[1], W[1] * W[1], W[2] * W[1]]));
const RIGHT = (() => { const r = cross(ANT, W); return r[0] > 0 ? r : [-r[0], -r[1], -r[2]]; })();
const LENGTH = len(sub(APEX, BASE));

export const HEART_FORM = {
  base: BASE, apex: APEX, w: W, ant: ANT, right: RIGHT, length: LENGTH,
  // Left ventricle: an ellipsoid whose equator lies `equator` of the way to the apex, cut by the base
  // plane (offset behind the frame axis): a full, rounded cone rather than a spindle.
  lv: { base: add(BASE, ANT, -6), r: 31, wall: 10, equator: 0.25 },
  // Right ventricle: an ellipsoid shell to the right and in front of the LV, kept only outside the LV.
  rv: { base: add(add(BASE, ANT, 16), RIGHT, 8), reach: 0.8, r: [33, 28], wall: 4, equator: 0.2 },
  ra: { c: [22, 4, -330], r: [18, 17, 22], wall: 2.5, appendage: { c: [12, 30, -318], r: [11, 8, 12] } },
  la: { c: [-14, -24, -322], r: [26, 14, 16], wall: 2.5, appendage: { c: [-42, 10, -318], r: [12, 7, 9] } },
  valves: [   // centre, ring radius; rings lie in the base plane
    { id: 'tricuspid', c: add(add(BASE, RIGHT, 14), ANT, 6), r: 15 },
    { id: 'mitral', c: add(add(BASE, RIGHT, -14), ANT, -4), r: 14 },
    { id: 'aortic', c: add(add(BASE, ANT, 8), W, -6), r: 11 },
    { id: 'pulmonary', c: add(add(add(BASE, ANT, 30), RIGHT, -8), W, -10), r: 11 },
  ],
  roots: [   // great vessels at the heart (polyline, radius; venous ones drawn blue)
    { id: 'aorta', pts: [add(add(BASE, ANT, 8), W, -6), [-4, 8, -306], [-6, 4, -286]], r: 12 },
    { id: 'pulmonaryTrunk', pts: [add(add(add(BASE, ANT, 30), RIGHT, -8), W, -10), [-22, 26, -298], [-26, 18, -288]], r: 12, venous: true },
    { id: 'pulmonaryArteryL', pts: [[-26, 18, -288], [-44, 4, -290], [-62, -6, -296]], r: 8, venous: true },
    { id: 'pulmonaryArteryR', pts: [[-26, 18, -288], [-4, 0, -290], [22, -6, -296]], r: 8, venous: true },
    { id: 'svc', pts: [[28, 2, -316], [27, 2, -284], [26, 0, -256]], r: 9, venous: true },
    { id: 'ivc', pts: [[20, -4, -348], [18, -8, -372], [16, -12, -398]], r: 11, venous: true },
    { id: 'pulmonaryVeinLU', pts: [[-34, -30, -312], [-52, -34, -306], [-66, -36, -302]], r: 5 },
    { id: 'pulmonaryVeinLL', pts: [[-34, -30, -330], [-52, -36, -334], [-66, -40, -338]], r: 5 },
    { id: 'pulmonaryVeinRU', pts: [[6, -34, -312], [22, -38, -308], [38, -40, -304]], r: 5 },
    { id: 'pulmonaryVeinRL', pts: [[6, -34, -330], [22, -40, -334], [38, -44, -338]], r: 5 },
  ],
  // Myocardial fibres: strands on surfaces of equal depth whose helix angle turns from +60° at the
  // endocardium to −60° at the epicardium (Streeter 1969); `share` of the wall stars lie on them.
  fibres: { lv: 1800, rv: 700, length: [16, 40], step: 2.2, helix: [60, -60], rvHelix: [20, -20], share: 0.65 },
  // Coronary vessels on the epicardium, as [s, θ] pairs: s from the base (0) to the apex (1) along
  // w, θ in degrees around it (0 anterior, +90 right, −90 left, ±180 posterior); radius in mm.
  coronary: {
    arteries: [
      { id: 'LAD', r: 1.8, pts: [[0.04, -20], [0.15, -32], [0.35, -36], [0.55, -34], [0.75, -30], [0.92, -24], [1.0, -10]] },
      { id: 'D1', r: 1.2, pts: [[0.3, -36], [0.42, -60], [0.55, -82]] },
      { id: 'D2', r: 1.1, pts: [[0.5, -34], [0.62, -58], [0.74, -78]] },
      { id: 'LCx', r: 1.6, pts: [[0.04, -20], [0.07, -60], [0.08, -100], [0.08, -140], [0.08, -175]] },
      { id: 'OM', r: 1.2, pts: [[0.08, -110], [0.3, -115], [0.55, -118], [0.7, -122]] },
      { id: 'RCA', r: 1.8, pts: [[0.04, 10], [0.07, 50], [0.08, 90], [0.08, 130], [0.08, 170], [0.09, 195]] },
      { id: 'AM', r: 1.2, pts: [[0.08, 95], [0.3, 100], [0.55, 104], [0.7, 106]] },
      { id: 'PDA', r: 1.4, pts: [[0.09, 190], [0.3, 188], [0.55, 185], [0.8, 182]] },
      // Smaller branches (HEART.md §8.2): a second obtuse marginal, the posterolateral branch beyond
      // the crux and the conus branch round the right ventricular outflow.
      { id: 'OM2', r: 1.0, pts: [[0.08, -135], [0.3, -138], [0.52, -141], [0.68, -144]] },
      { id: 'PL', r: 1.0, pts: [[0.09, 195], [0.25, 208], [0.42, 218], [0.55, 224]] },
      { id: 'conus', r: 0.8, pts: [[0.03, 22], [0.025, 8], [0.035, -6], [0.06, -16]] },
    ],
    veins: [
      { id: 'greatCardiac', r: 2.2, pts: [[0.95, -16], [0.75, -40], [0.5, -42], [0.25, -42], [0.1, -50], [0.09, -90], [0.09, -130], [0.09, -170]] },
      { id: 'coronarySinus', r: 3.5, pts: [[0.09, -170], [0.09, -200], [0.07, -230]] },   // + the ostium (generate.js)
      { id: 'middleCardiac', r: 1.8, pts: [[0.85, 176], [0.55, 178], [0.3, 180], [0.1, 182]] },
      { id: 'smallCardiac', r: 1.2, pts: [[0.12, 72], [0.09, 100], [0.08, 125]] },
      { id: 'posteriorLV', r: 1.4, pts: [[0.62, -150], [0.4, -156], [0.2, -162], [0.09, -168]] },
      { id: 'anteriorCardiac', r: 0.9, pts: [[0.45, 42], [0.28, 52], [0.1, 62], [0.02, 68]] },
      { id: 'anteriorCardiac', r: 0.8, pts: [[0.5, 78], [0.3, 84], [0.12, 90], [0.03, 94]] },
    ],
    taper: 0.45,   // radius falls by this share along each vessel, origin to end
  },
  // Valve leaflets (cusps), closed in the ring plane; heart.js opens them with the cycle. Papillary
  // muscles as [s, θ] of their base on the wall and of their tip inside the cavity (tip radius as a
  // share of the cavity radius), with chordae to the leaflets of their valve.
  leaflets: [{ n: 3, dome: -3 }, { n: 2, dome: -3 }, { n: 3, dome: 3 }, { n: 3, dome: 3 }],   // valves order
  // Each muscle splits into `heads` (the LV muscles commonly have 1–3; Wilcox et al. 2004); `r` its
  // trunk radius (mm). The septal muscle of the RV rises from the septum (`septal`), `tipMm` long.
  papillary: [
    { id: 'pmAL', chamber: 'lv', base: [0.62, -70], tip: [0.34, -62], tipR: 0.45, valve: 1, heads: 2, r: 6 },
    { id: 'pmPM', chamber: 'lv', base: [0.62, -150], tip: [0.34, -140], tipR: 0.45, valve: 1, heads: 3, r: 6 },
    { id: 'pmRA', chamber: 'rv', base: [0.55, 60], tip: [0.32, 52], tipR: 0.5, valve: 0, heads: 2, r: 5 },
    { id: 'pmRP', chamber: 'rv', base: [0.55, 100], tip: [0.36, 95], tipR: 0.5, valve: 0, heads: 2, r: 3.5 },
    { id: 'pmRS', septal: true, base: [0.18, 30], tipMm: 7, valve: 0, heads: 1, r: 2.2 },
  ],
  // Chordae per head (LV, RV), fanning into `fan` branches over the last `split` of their length;
  // primary chordae reach the free edge (r 0.15–0.35 of the ring radius), secondary ones the rough
  // zone (0.45–0.65), tertiary ones run from the basal wall to the posterior mitral leaflet (0.85–0.95).
  chordae: { perHead: [5, 4], fan: 3, split: 0.3, tertiary: 10, primaryShare: 0.6 },
  // Trabeculae carneae (Ho 2009): fine apical ridges in the LV, coarse ones over the RV body; strands
  // on the endocardium raised `h` mm into the cavity, of radius `r` mm, `share` branching once.
  trabeculae: { lv: 320, rv: 200, length: [6, 22], lvS: [0.35, 0.96], rvS: [0.25, 0.95], lvR: [0.5, 1.0], rvR: [0.9, 1.6],
    lvH: [0.6, 1.6], rvH: [0.8, 2.2], wander: 0.35, branch: 0.35, moderatorR: 2.2, falseTendons: 3 },
  // Pectinate muscles: ridges from the crista terminalis across the right atrial wall towards the
  // auricle, and ridges inside both auricles; the crista is a C-shaped ridge from the SVC to the IVC.
  pectinate: { ra: 14, raAuricle: 8, laAuricle: 6, r: 0.9, h: 0.9, cristaR: 1.6, cristaH: 1.3 },
  // Fossa ovalis on the septal wall of the right atrium (≈ 18 × 14 mm, Sweeney & Rosenquist 1979):
  // a thin floor recessed `recess` mm, ringed by the limbus.
  fossa: { dir: [-0.78, -0.55, -0.15], a: 9, b: 7, recess: 1.2, limbus: [1.5, 3] },
  csOstium: { r: 5, rim: 1.0 },   // ≈ 10 mm across [model]; the Thebesian valve covers its lower half
  eustachian: { width: 5, span: 100 },   // crescent along the anterior lip of the IVC, ±span°
  // Epicardial fat (Iacobellis 2005): lobules along the atrioventricular and interventricular grooves,
  // thickest at the base; `thick` per groove, lobule radius `r` mm × thick.
  fat: { step: 2.5, r: [1.2, 2.4], across: [1.5, 5.5], grooves: { RCA: 1, LCx: 1, coronarySinus: 1, greatCardiac: 0.8, LAD: 0.75, PDA: 0.7, middleCardiac: 0.6, AM: 0.5 } },
  pericardium: { gap: 4.5, flux: 0.6 },   // the parietal sac `gap` mm outside the heart, faint
  // Aortic and pulmonary sinuses (of Valsalva): three bulges of `bulge` × the ring radius above the
  // cusps, up to the sinotubular junction `height` mm above the ring; coronary ostia at `ostium` of it.
  sinuses: { height: 18, bulge: 0.3, ostium: 0.55, ostiumR: 2 },
  sa: { c: [30, 0, -312], r: [4, 4, 7] },        // §2.8 saNode
  av: { c: [5, -2, -350], r: [3, 3, 5] },        // §2.8 avNode
  // Atrial conduction: internodal tracts (SA → AV) and Bachmann's bundle (SA → left atrium).
  atrialPaths: [
    [[30, 0, -312], [20, 14, -322], [10, 6, -340], [5, -2, -350]],
    [[30, 0, -312], [22, 2, -332], [5, -2, -350]],
    [[30, 0, -312], [24, -8, -334], [12, -8, -346], [5, -2, -350]],
    [[30, 0, -312], [8, 8, -314], [-14, -6, -316], [-34, -18, -320]],
  ],
  atrialReach: 85,   // mm: the farthest atrial wall from the SA node (≈ 1 m/s × 85 ms, the P wave)
  // His bundle to the top of the septum, then the bundle branches.
  his: [[5, -2, -350], [-5, 6, -358]],
  branches: [
    [[-5, 6, -358], [-30, 18, -372], [-56, 30, -380]],   // left posterior fascicle
    [[-5, 6, -358], [-22, 28, -362], [-50, 42, -372]],   // left anterior fascicle
    [[-5, 6, -358], [-28, 24, -368], [-62, 40, -380]],   // left septal fibres
    [[-5, 6, -358], [-20, 30, -370], [-45, 46, -378], [-20, 50, -368]],   // right bundle and moderator band
  ],
  purkinje: { strands: 90, length: [30, 60] },
};

// Outflow axes of the semilunar valves (valve → root), and the opening axis of every valve: the
// atrioventricular valves open towards the apex, the semilunar ones into their artery.
HEART_FORM.valveAxis = HEART_FORM.valves.map((v, i) => (i < 2 ? W : norm(sub(HEART_FORM.roots[i - 2].pts[1], HEART_FORM.roots[i - 2].pts[0]))));

// Axial place in the ventricles: 0 at the apex, 1 at the base plane (clamped).
export function axialOf(p) {
  const s = dot(sub(p, BASE), W);
  return Math.min(1, Math.max(0, 1 - s / LENGTH));
}
// Signed distance-like value of the LV outer surface (< 0 inside), for the RV crescent.
export function lvInside(p, grow = 0) {
  const L = HEART_FORM.lv, q = sub(p, L.base), s = dot(q, W);
  if (s < -grow) return false;
  const Lt = len(sub(APEX, L.base)), s0 = L.equator * Lt, a = Lt - s0 + grow, rr = L.r + grow;
  const rad = len(sub(q, [W[0] * s, W[1] * s, W[2] * s]));
  return ((s - s0) / a) ** 2 + (rad / rr) ** 2 < 1;
}
// Inside the RV outer ellipsoid (the crescent is this less the LV).
export function rvInside(p, grow = 0) {
  const V = HEART_FORM.rv, q = sub(p, V.base), s = dot(q, W);
  if (s < -grow) return false;
  const Lt = V.reach * LENGTH, s0 = V.equator * Lt, a = Lt - s0 + grow, x = dot(q, ANT), y = dot(q, RIGHT);
  return ((s - s0) / a) ** 2 + (x / (V.r[0] + grow)) ** 2 + (y / (V.r[1] + grow)) ** 2 < 1;
}
// A point of the heart frame from [s, θ]: on the axis at s·length, then out along θ until it leaves
// both ventricles, plus `lift` mm (the epicardium and what lies on it).
export function surfacePoint(s, thetaDeg, lift = 1.5) {
  const th = (thetaDeg * Math.PI) / 180, d = add([ANT[0] * Math.cos(th), ANT[1] * Math.cos(th), ANT[2] * Math.cos(th)], RIGHT, Math.sin(th));
  const c = add(BASE, W, s * LENGTH);
  let r = 0;
  while (r < 80 && (lvInside(add(c, d, r)) || rvInside(add(c, d, r)))) r += 0.5;
  return add(c, d, r + lift);
}
export { sub as hSub, dot as hDot, len as hLen, norm as hNorm, cross as hCross, add as hAdd };

// --- Fine anatomy landmarks (HEART.md §8.2) ------------------------------------------------------
// Point on the ellipsoid (centre c, radii r) along the unit direction d, `inset` mm inside it.
export function ellPoint(c, r, d, inset = 0) {
  const rho = 1 / Math.sqrt((d[0] / r[0]) ** 2 + (d[1] / r[1]) ** 2 + (d[2] / r[2]) ** 2);
  return add(c, d, rho - inset);
}
// Unit vectors perpendicular to n; the first leans towards `up`.
export function tangents(n, up = [0, 0, 1]) {
  const k = dot(up, n);
  let e1 = sub(up, [n[0] * k, n[1] * k, n[2] * k]);
  if (len(e1) < 1e-6) e1 = cross(n, [1, 0, 0]);
  e1 = norm(e1);
  return [e1, cross(n, e1)];
}
// Normalised interpolation between unit directions (enough for arcs below 120°).
export const dirLerp = (a, b, t) => norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);

{
  const H = HEART_FORM, RA = H.ra, raDir = (p) => norm(sub(p, RA.c));
  const root = (id) => H.roots.find((g) => g.id === id).pts[0];
  const site = (n, up) => { const [e1, e2] = tangents(n, up); return { c: ellPoint(RA.c, RA.r, n), n, e1, e2 }; };
  const csEnd = surfacePoint(0.07, -230, 4);
  const ivcN = raDir(root('ivc')), svcN = raDir(root('svc'));
  H.landmarks = {
    fossa: site(norm(H.fossa.dir)),
    csOstium: site(raDir(csEnd)),
    ivc: site(ivcN, [0, 1, 0]),   // e1 anterior: the Eustachian valve lies along the anterior lip
    svc: site(svcN, [0, 1, 0]),
    csEnd,
    // Crista terminalis: from the anterolateral rim of the SVC down the lateral wall to that of the IVC.
    crista: [norm(add(svcN, [0.35, 0.35, 0])), norm([1, 0.25, 0]), norm(add(ivcN, [0.45, 0.35, 0]))],
  };
}

// Section (HEART.md §8.4): the four-chamber plane, fitted through the apex, both atrioventricular
// valves and both atrial centres; the half towards the camera is taken away.
function fitPlane(pts) {
  const c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
  let best = null, bestE = Infinity;
  const N = 6000, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {   // Fibonacci half-sphere of normals
    const z = 1 - (i + 0.5) / N, r = Math.sqrt(1 - z * z), n = [r * Math.cos(i * ga), r * Math.sin(i * ga), z];
    const e = pts.reduce((a, p) => a + dot(sub(p, c), n) ** 2, 0);
    if (e < bestE) { bestE = e; best = n; }
  }
  return { p: c, n: dot(best, ANT) < 0 ? [-best[0], -best[1], -best[2]] : best };
}
const SECTION_PLANE = fitPlane([APEX, HEART_FORM.valves[0].c, HEART_FORM.valves[1].c, HEART_FORM.ra.c, HEART_FORM.la.c]);
// open: plane offset (mm) at which the cut begins, outside the heart; rim: stars within `rim` mm of
// the cut face are lifted × rimGain, so the walls read in section as in an anatomy atlas [model].
export const HEART_SECTION = { ...SECTION_PLANE, open: 95, rim: 4, rimGain: 1.5, faceGain: 0.7, seconds: 0.6 };

// Depth cue (HEART.md §8.3): along the line of sight from the heart's centre, stars beyond t0 dim as
// exp(−(t − t0)/λ); the inner parts (valves, chordae, conduction system, fibrous tissue) dim less, so
// they read through the wall. Opened, the depth is taken behind the cut face, with the steeper
// lambdaOpen. `gain` restores the heart's front surface brightness [model, browser check].
const HC = add(add(add(BASE, W, 42), ANT, 5), RIGHT, -2);
export const HEART_DEPTH = { c: HC, t0: -22, lambda: [30, 70], lambdaOpen: [14, 32], gain: 1.25,
  envelope: [68, 45, 38] };   // half-axes (mm) along w, ant, right: the pericardium's facing law

// Close-up level of detail (HEART.md §8.1): the wanted star density grows as (q/q0)² with q the
// star's own pixels per mm (1,080-px reference). Close-up stars of rank below the filled share f
// fade in (over `fade` of rank), up to D_max; every heart star's flux is divided by the expected
// drawn density, so the heart's light does not change as stars are added. Beyond D_max the stars
// grow as (want/D_max)^grow, at most × sizeMax.
export const HEART_LOD = { q0: 4.5, fade: 0.08, grow: 0.25, sizeMax: 1.5, rankMul: 31.7, rankAdd: 0.21,
  stars: { low: 0, medium: 60000, high: 150000, ultra: 250000 }, lod: 4,
  // The cut face (§8.4): stars within `slab` mm of the section plane on either side, drawn only while
  // the heart is open, so the walls read as solid bands in section (LOD 5).
  section: { low: 0, medium: 30000, high: 60000, ultra: 100000 }, sectionLod: 5, slab: 4, tries: 400 };
const rampInt = (x) => { const d = HEART_LOD.fade; return x <= 0 ? 0 : x < d ? (x * x) / (2 * d) : x - d / 2; };
// Wanted density, filled share f, the expected drawn density and the size factor at q px/mm when
// the close-up stars can bring the density to dmax.
export function heartDensity(q, dmax) {
  const want = Math.max(1, (q / HEART_LOD.q0) ** 2), m = Math.max(1, dmax);
  const f = m > 1 ? (Math.min(want, m) - 1) / (m - 1) : 0, F = f * (1 + HEART_LOD.fade);
  const share = rampInt(F) - rampInt(F - 1);   // expected visible share of the close-up stars
  return { want, f, d: 1 + (m - 1) * share, size: Math.min(HEART_LOD.sizeMax, Math.max(1, want / m) ** HEART_LOD.grow) };
}
// Visibility 0–1 of a close-up star of rank r (0–1) at filled share f.
export function closeUpWeight(rank, f) {
  return Math.min(1, Math.max(0, (f * (1 + HEART_LOD.fade) - rank) / HEART_LOD.fade));
}
// LOD tag added to the close-up stars of the body's focus region (research/CLOSEUP.md §3; generate.js
// generateFocusRegionChunks); kept here, with the heart's tags, because the shader reads it too.
export const FOCUS_LOD = 8;
// Seed → rank of a close-up star (the shader does the same with the seed in aNrm.w).
export const closeUpRank = (seed) => { const x = seed * HEART_LOD.rankMul + HEART_LOD.rankAdd; return x - Math.floor(x); };
