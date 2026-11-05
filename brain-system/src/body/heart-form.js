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
};
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
    ],
    veins: [
      { id: 'greatCardiac', r: 2.2, pts: [[0.95, -16], [0.75, -40], [0.5, -42], [0.25, -42], [0.1, -50], [0.09, -90], [0.09, -130], [0.09, -170]] },
      { id: 'coronarySinus', r: 3.5, pts: [[0.09, -170], [0.09, -200], [0.07, -230]] },
      { id: 'middleCardiac', r: 1.8, pts: [[0.85, 176], [0.55, 178], [0.3, 180], [0.1, 182]] },
    ],
  },
  // Valve leaflets (cusps), closed in the ring plane; heart.js opens them with the cycle. Papillary
  // muscles as [s, θ] of their base on the wall and of their tip inside the cavity (tip radius as a
  // share of the cavity radius), with chordae to the leaflets of their valve.
  leaflets: [{ n: 3, dome: -3 }, { n: 2, dome: -3 }, { n: 3, dome: 3 }, { n: 3, dome: 3 }],   // valves order
  papillary: [
    { chamber: 'lv', base: [0.62, -70], tip: [0.34, -62], tipR: 0.45, valve: 1 },
    { chamber: 'lv', base: [0.62, -150], tip: [0.34, -140], tipR: 0.45, valve: 1 },
    { chamber: 'rv', base: [0.55, 60], tip: [0.32, 52], tipR: 0.5, valve: 0 },
  ],
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
