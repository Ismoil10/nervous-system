// Procedural human brain in MNI-152 space: millimetres, x → right, y → anterior, z → superior.
// Every structure is an analytic volume (ellipsoid, tube or an implicit surface) placed at its
// MNI centroid with its typical adult extent (research/DOPAMINE.md §2 and §7). Nothing is
// downloaded: the cortex is an implicit cerebrum with procedural gyri, the cerebellum carries
// folia, and the dopamine pathways are spline bundles between the nuclei they connect.

export const MM = 0.01;                    // render units per millimetre (1 unit = 10 cm)
export const CENTER = [0, -16, 6];         // camera target (mm): middle of the brain's bounding box

// Regions drive both the dopamine model (per-region concentration) and the imaging-based
// activity map. The order is the index used in vertex attributes and the per-region state.
// Indices 0–32 are the original set and never move; the brain-system ids of
// research/ANALYSIS.md A.3.3 (89 ids, §3.15) are appended after `whiteMatter`.
export const REGION_IDS = [
  'cortex', 'frontal', 'pfc', 'ofc', 'acc', 'insula', 'parietal', 'temporal', 'occipital',
  'cerebellum', 'dentate', 'thalamus', 'dorsalStriatum', 'naccCore', 'naccShell', 'pallidum',
  'amygdala', 'hippocampus', 'hypothalamus', 'mpoa', 'pvn', 'arcuate', 'pituitary', 'vta', 'snc',
  'zonaIncerta', 'a11', 'rmtg', 'raphe', 'pag', 'brainstem', 'spinal', 'whiteMatter',
  // Thalamus (13)
  'thalAnt', 'thalMD', 'thalVA', 'thalVL', 'thalVPL', 'thalVPM', 'thalVPMpc', 'thalVMpo', 'thalCM',
  'thalPulv', 'thalRet', 'lgn', 'mgn',
  // Basal ganglia, basal forebrain and limbic (9)
  'stn', 'snr', 'vp', 'nbm', 'msdb', 'hdb', 'bnst', 'habenula', 'cea',
  // Hypothalamus and circumventricular organs (14)
  'scn', 'son', 'vlpo', 'lh', 'tmn', 'dmh', 'vmh', 'mammillary', 'mnpo', 'ovlt', 'sfo',
  'areaPostrema', 'medianEminence', 'pineal',
  // Brainstem, cerebellar and olfactory nuclei (47)
  'lc', 'ppn', 'ldt', 'pbn', 'pno', 'pnc', 'gi', 'mrf', 'vestNuc', 'ntsGust', 'ntsVisc', 'dmv',
  'nAmbMotor', 'nAmbVagal', 'rvlm', 'cvlm', 'preBotC', 'rtn', 'io', 'gracile', 'cuneate', 'spV',
  'prV', 'mesV', 'motV', 'cochNuc', 'soc', 'ic', 'sc', 'opn', 'ew', 'n3', 'n4', 'n6', 'n7m', 'n12',
  'ssn', 'isn', 'barrington', 'redNucleus', 'pontineNuc', 'fastigial', 'interposed', 'flocculus',
  'nodulus', 'olfBulb', 'olfTubercle',
  // Splits (6 new; `gpe`, `dr` and `pituitaryAnt` reuse the old ids, see REGION_ALIASES)
  'gpi', 'mnr', 'rmg', 'rpa', 'rob', 'pituitaryPost',
];
export const REGION_ALIASES = { gpe: 'pallidum', dr: 'raphe', pituitaryAnt: 'pituitary' };   // A.3.3 splits
export const R = Object.fromEntries([
  ...REGION_IDS.map((id, i) => [id, i]),
  ...Object.entries(REGION_ALIASES).map(([alias, id]) => [alias, REGION_IDS.indexOf(id)]),
]);
export const REGION_COUNT = REGION_IDS.length;
export const LEGACY_REGION_COUNT = 33;     // regions of the original build (indices 0–32)

// Constants of the brain-system additions (research/ANALYSIS.md). Coordinates live in the
// tables further down, one row per structure, each citing its section.
export const BRAIN_PARAMS = {
  junction: [0, -45, -72],      // cervicomedullary junction, brain–body boundary (mm; A.2)
  pituitarySplitY: -2,          // pituitaryAnt y > −2, pituitaryPost y ≤ −2 (mm; A.3.3)
  thalRetThickness: 1,          // reticular nucleus drawn as a 1-mm shell of the thalamus (mm; §3.16)
  thalRetMinNormalX: 0.5,       // shell part whose outward normal points laterally (x component; [model])
  // Star colour temperature (a2.z) per group, matching the existing NUCLEI tints ([model]).
  tint: { thal: 0.55, pallid: 0.6, sub: 0.45, bf: 0.5, limbic: 0.5, hyp: 0.35, gland: 0.3, bs: 0.42, raphe: 0.4, cb: 0.5, olf: 0.4 },
};

// Point kinds (attribute a2.w).
export const KIND = { CORTEX: 0, CEREBELLUM: 1, NUCLEUS: 2, BRAINSTEM: 3, WHITE: 4, GLAND: 5 };

// --- Small vector helpers ---
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

// --- Seeded random numbers ---
export function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 3D gradient noise (Perlin's improved noise) with a seeded permutation ---
const PERM = new Uint8Array(512);
{
  const rnd = mulberry32(90210);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  const l = (a, b, t) => a + t * (b - a);
  return l(
    l(l(grad(PERM[AA] & 15, x, y, z), grad(PERM[BA] & 15, x - 1, y, z), u),
      l(grad(PERM[AB] & 15, x, y - 1, z), grad(PERM[BB] & 15, x - 1, y - 1, z), u), v),
    l(l(grad(PERM[AA + 1] & 15, x, y, z - 1), grad(PERM[BA + 1] & 15, x - 1, y, z - 1), u),
      l(grad(PERM[AB + 1] & 15, x, y - 1, z - 1), grad(PERM[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}

// --- Signed distance helpers (millimetres; approximate for ellipsoids) ---
function sdEllipsoid(x, y, z, c, r) {
  const qx = (x - c[0]) / r[0], qy = (y - c[1]) / r[1], qz = (z - c[2]) / r[2];
  const k0 = len3(qx, qy, qz);
  const k1 = len3(qx / r[0], qy / r[1], qz / r[2]);
  return k0 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); }
function smax(a, b, k) { return -smin(-a, -b, k); }

// Cerebrum, one hemisphere (s = +1 right, −1 left). A single ellipsoid for the frontal–parietal–
// occipital mass with a flattened orbital base, temporal lobes that hang below the Sylvian
// fissure, an inferior-medial notch where the diencephalon and brainstem emerge, and the
// longitudinal fissure as a plane 1 mm from the midline. Volume ≈ 1,050 cm³ for both hemispheres.
export function sdCerebrum(x, y, z, s) {
  let d = sdEllipsoid(x, y, z, [0, -17, 14], [68, 86, 62]);
  d = smax(d, -(z + 23 - 0.12 * Math.max(0, -y - 10)), 5);             // orbital and basal surface
  d = smin(d, sdEllipsoid(x, y, z, [s * 43, -15, -21], [24, 44, 21]), 5); // temporal lobe
  d = smax(d, -sdEllipsoid(x, y, z, [0, -22, -43], [23, 40, 36]), 5);   // inferior-medial notch
  d = smax(d, 1 - s * x, 2);                                            // longitudinal fissure
  return d;
}

// Cerebellum: two hemispheres and the vermis under the tentorium, notched in front for the
// fourth ventricle and the pons.
export function sdCerebellum(x, y, z) {
  let d = smin(
    smin(sdEllipsoid(x, y, z, [23, -63, -37], [26, 27, 21]), sdEllipsoid(x, y, z, [-23, -63, -37], [26, 27, 21]), 6),
    sdEllipsoid(x, y, z, [0, -61, -31], [10, 27, 21]), 6);
  d = smax(d, -sdEllipsoid(x, y, z, [0, -36, -36], [15, 12, 24]), 4);
  d = smax(d, z - (-12 + 0.35 * (y + 45)), 4);                          // tentorial (superior) surface
  return d;
}

// Medial surface: the corpus callosum and diencephalon occupy the middle of the cut face, so
// no cortex is drawn inside this ellipse (the cingulate gyrus wraps around it).
export function insideCallosalWindow(y, z) {
  const u = (y + 6) / 37, v = (z - 7) / 21;
  return u * u + v * v < 1;
}

// Major sulci with their depth (mm): central, Sylvian (lateral), parieto-occipital, calcarine and
// cingulate. Returns { depth, w } where w ∈ [0, 1] is how close the point is to the fundus line.
export function majorSulcus(x, y, z) {
  const ax = Math.abs(x);
  let best = 0, depth = 0;
  const take = (dist, width, dmm) => {
    const w = 1 - smoothstep(0, width, Math.abs(dist));
    if (w * dmm > best * depth || (w > best && dmm >= depth)) { best = w; depth = dmm; }
  };
  // Central sulcus: from the vertex (y ≈ −40) down and forward to the Sylvian fissure (y ≈ −12).
  if (z > 24 && ax > 4) take(y - (-10 - 0.62 * (z - 30) + 3 * Math.sin(z * 0.23)), 2.4, 20);
  // Sylvian fissure: rises posteriorly from the temporal pole; separates the temporal lobe.
  const zs = sylvianZ(y);
  if (ax > 28 && y > -48 && y < 22) take(z - zs, 3.6, 26);
  // Medial face (|x| small): parieto-occipital and calcarine sulci, cingulate sulcus.
  if (ax < 6) {
    if (y < -55 && z > 0) take(y - (-62 - 0.33 * (z - 5)), 2.2, 18);
    if (y < -62 && z > -15 && z < 18) take(z - (4 + 0.12 * (y + 62)), 2.0, 16);
    const u = (y + 6) / 37, v = (z - 7) / 21, rr = Math.sqrt(u * u + v * v);
    if (y > -45) take((rr - 1.55) * 21, 2.0, 12);
  }
  return { depth, w: best };
}
export function sylvianZ(y) { return -15 + (17 - y) * 0.55; }

// Lobe/region of a cortical surface point.
export function corticalRegion(x, y, z) {
  const ax = Math.abs(x);
  if (y > 8 && z < -6) return R.ofc;
  if (ax < 9 && y > -6 && y < 38 && z > 0 && z < 42) return R.acc;
  if (y > 22) return R.pfc;
  if (ax > 26 && z < sylvianZ(y) && y > -72) return R.temporal;
  if (y < -72) return R.occipital;
  if (y < -10 - 0.62 * (z - 30)) return R.parietal;
  return R.frontal;
}

// Folding field: gyri and sulci from warped ridged noise (spacing ≈ 14 mm) plus the major sulci.
// Returns { depth, sulcus } — fundus depth (mm) and how close the point is to a sulcal line (0..1).
export function folding(x, y, z) {
  const wx = x + 7 * noise3(x / 38 + 3.1, y / 38, z / 38);
  const wy = y + 7 * noise3(x / 38, y / 38 + 7.7, z / 38);
  const wz = z + 7 * noise3(x / 38, y / 38, z / 38 + 1.9);
  const n = noise3(wx / 26, wy / 26, wz / 26) + 0.35 * noise3(wx / 11, wy / 11, wz / 11);
  const sul = 1 - smoothstep(0.015, 0.075, Math.abs(n));
  const major = majorSulcus(x, y, z);
  const minorDepth = 11 * sul;
  const depth = Math.max(minorDepth, major.depth * major.w);
  return { depth, sulcus: Math.max(sul, major.w) };
}

// --- Deep structures (bilateral unless `mid`) ---
// type 'e': ellipsoid { c, r }; type 't': tube { pts: [[x,y,z,radius], …] }.
export const NUCLEI = [
  { id: 'thalamus', region: R.thalamus, type: 'e', c: [11, -18, 7], r: [8, 15, 9], share: 0.20, tint: 0.55 },
  { id: 'caudate', region: R.dorsalStriatum, type: 't', pts: [[13, 15, 8, 7], [14, 4, 15, 5.5], [17, -10, 21, 3.8], [23, -27, 18, 2.8], [29, -33, 6, 2.2], [31, -22, -7, 1.6]], share: 0.12, tint: 0.45 },
  { id: 'putamen', region: R.dorsalStriatum, type: 'e', c: [25, 2, 1], r: [5.5, 15, 9], share: 0.16, tint: 0.45 },
  { id: 'pallidum', region: R.pallidum, type: 'e', c: [19, -3, 0], r: [3.5, 8, 5], share: 0.04, tint: 0.6 },
  { id: 'nacc', region: R.naccShell, type: 'e', c: [10, 12, -8], r: [5, 6, 4.5], share: 0.06, tint: 0.4 },
  { id: 'amygdala', region: R.amygdala, type: 'e', c: [23, -5, -18], r: [7, 8, 7], share: 0.07, tint: 0.5 },
  { id: 'hippocampus', region: R.hippocampus, type: 't', pts: [[25, -8, -20, 6], [29, -19, -15, 5], [30, -31, -7, 4], [24, -39, 3, 3]], share: 0.08, tint: 0.5 },
  { id: 'hypothalamus', region: R.hypothalamus, type: 'e', c: [5, -3, -10], r: [4.5, 9, 5], share: 0.035, tint: 0.35 },
  { id: 'mpoa', region: R.mpoa, type: 'e', c: [3.5, 4, -10], r: [2.6, 3.2, 3], share: 0.012, tint: 0.35 },
  { id: 'pvn', region: R.pvn, type: 'e', c: [3, -4, -6], r: [1.8, 3, 2.4], share: 0.008, tint: 0.35 },
  { id: 'arcuate', region: R.arcuate, type: 'e', c: [2, -7, -13], r: [2, 3, 2], share: 0.005, tint: 0.35 },
  { id: 'pituitary', region: R.pituitary, type: 'e', c: [0, 0, -32], r: [6, 4.5, 3], share: 0.010, tint: 0.3, mid: true },
  { id: 'stalk', region: R.pituitary, type: 't', pts: [[0, -6, -15, 1.3], [0, -3, -22, 1.1], [0, -1, -28, 1.2]], share: 0.002, tint: 0.3, mid: true },
  { id: 'zonaIncerta', region: R.zonaIncerta, type: 'e', c: [12, -16, -3], r: [2.2, 5, 2], share: 0.006, tint: 0.4 },
  // Non-dopaminergic neurons inside the dopamine groups: the VTA is ~35 % GABA and glutamate
  // cells (rat), the SNc almost purely dopaminergic.
  { id: 'vtaOther', region: R.vta, type: 'e', c: [4, -16, -12], r: [3, 5, 3.5], share: 0.004, tint: 0.4 },
  { id: 'sncOther', region: R.snc, type: 'e', c: [11, -18, -12], r: [3.5, 7, 2.8], share: 0.002, tint: 0.4 },
  { id: 'pag', region: R.pag, type: 'e', c: [0, -31, -7], r: [6, 5, 6], share: 0.02, tint: 0.45, mid: true },
  { id: 'raphe', region: R.raphe, type: 't', pts: [[0, -27, -9, 2.2], [0, -30, -17, 2.4], [0, -32, -26, 2.2]], share: 0.01, tint: 0.4, mid: true },
  { id: 'rmtg', region: R.rmtg, type: 'e', c: [4, -28, -18], r: [2, 3, 2], share: 0.004, tint: 0.4 },
  { id: 'dentate', region: R.dentate, type: 'e', c: [15, -57, -35], r: [5, 7, 5], share: 0.03, tint: 0.5 },
];

// Dopaminergic cell groups (Dahlström–Fuxe A-groups) drawn as lantern sources.
export const DA_GROUPS = [
  { id: 'vta', region: R.vta, label: 'VTA (A10)', type: 'e', c: [4, -16, -12], r: [3, 5, 3.5], share: 0.30 },
  { id: 'snc', region: R.snc, label: 'Substantia nigra pars compacta (A9)', type: 'e', c: [11, -18, -12], r: [3.5, 7, 2.8], share: 0.52 },
  { id: 'a11', region: R.a11, label: 'A11', type: 'e', c: [3, -14, -6], r: [1.5, 2, 1.5], share: 0.03 },
  { id: 'a12', region: R.arcuate, label: 'A12 (TIDA)', type: 'e', c: [2, -7, -13], r: [1.8, 2.6, 1.8], share: 0.05 },
  { id: 'a13', region: R.zonaIncerta, label: 'A13', type: 'e', c: [12, -16, -3], r: [2, 4, 1.8], share: 0.05 },
  { id: 'a14', region: R.pvn, label: 'A14', type: 'e', c: [2.5, -1, -8], r: [1.2, 4, 2.5], share: 0.05 },
];

// Brainstem and the upper spinal cord: a tube with an elliptical cross-section [x radius, y radius].
export const BRAINSTEM = [
  [0, -16, 0, 13, 11], [0, -24, -10, 14, 12], [0, -26, -22, 16, 13], [0, -27, -33, 17, 12],
  [0, -34, -47, 10, 9], [0, -40, -60, 8, 7], [0, -44, -74, 6.5, 5.5], [0, -46, -88, 6, 5],
];

// Dopamine projections: spline bundles from a cell group to a terminal field (MNI mm).
// Mirrored for the left hemisphere. `fan` is the terminal spread radius in mm.
export const PATHWAYS = [
  { id: 'mesolimbic', label: 'Mesolimbic: VTA → nucleus accumbens', from: R.vta, to: R.naccShell, share: 0.20, fan: 4.5,
    pts: [[4, -16, -12], [6, -9, -11], [8, -1, -10], [9, 6, -9], [10, 12, -8]] },
  { id: 'mesoAmygdala', label: 'Mesolimbic: VTA → amygdala', from: R.vta, to: R.amygdala, share: 0.05, fan: 5,
    pts: [[4, -16, -12], [9, -11, -14], [16, -7, -17], [23, -5, -18]] },
  { id: 'mesoHippocampal', label: 'Mesolimbic: VTA → hippocampus', from: R.vta, to: R.hippocampus, share: 0.03, fan: 5,
    pts: [[4, -16, -12], [12, -17, -14], [22, -19, -15], [28, -20, -14]] },
  { id: 'mesocorticalMedial', label: 'Mesocortical: VTA → medial prefrontal cortex', from: R.vta, to: R.pfc, share: 0.12, fan: 9,
    pts: [[4, -16, -12], [6, -8, -10], [8, 2, -8], [9, 14, -6], [9, 26, -2], [8, 38, 6], [7, 48, 15]] },
  { id: 'mesocorticalOrbital', label: 'Mesocortical: VTA → orbitofrontal cortex', from: R.vta, to: R.ofc, share: 0.06, fan: 8,
    pts: [[4, -16, -12], [6, -8, -10], [8, 2, -8], [10, 14, -7], [15, 25, -12], [20, 36, -16]] },
  { id: 'mesocorticalCingulate', label: 'Mesocortical: VTA → anterior cingulate', from: R.vta, to: R.acc, share: 0.05, fan: 7,
    pts: [[4, -16, -12], [6, -8, -10], [8, 2, -8], [8, 14, -4], [7, 25, 6], [6, 30, 18], [5, 22, 30]] },
  { id: 'nigrostriatalPutamen', label: 'Nigrostriatal: SNc → putamen', from: R.snc, to: R.dorsalStriatum, share: 0.28, fan: 9,
    pts: [[11, -18, -12], [14, -12, -8], [18, -7, -3], [22, -2, 1], [25, 3, 1]] },
  { id: 'nigrostriatalCaudate', label: 'Nigrostriatal: SNc → caudate', from: R.snc, to: R.dorsalStriatum, share: 0.13, fan: 6,
    pts: [[11, -18, -12], [13, -10, -6], [14, -2, 2], [14, 6, 7], [13, 13, 9]] },
  { id: 'incertoMpoa', label: 'Incertohypothalamic: A13/A14 → medial preoptic area', from: R.zonaIncerta, to: R.mpoa, share: 0.03, fan: 2.5,
    pts: [[12, -16, -3], [8, -8, -6], [5, -2, -8], [3.5, 4, -10]] },
  { id: 'incertoPvn', label: 'Incertohypothalamic: A13/A14 → paraventricular nucleus', from: R.zonaIncerta, to: R.pvn, share: 0.02, fan: 2,
    pts: [[12, -16, -3], [7, -8, -5], [3, -4, -6]] },
  { id: 'tuberoinfundibular', label: 'Tuberoinfundibular: arcuate (A12) → median eminence → pituitary', from: R.arcuate, to: R.pituitary, share: 0.015, fan: 2,
    pts: [[2, -7, -13], [0.8, -6, -15], [0.3, -3, -22], [0, -1, -28], [0, 0, -32]] },
  { id: 'diencephalospinal', label: 'Diencephalospinal: A11 → spinal cord', from: R.a11, to: R.spinal, share: 0.025, fan: 2,
    pts: [[3, -14, -6], [3, -22, -16], [2.5, -28, -32], [3, -36, -50], [3, -42, -66], [3, -46, -86]] },
];

// Terminal fields: where dopamine is released (volume for varicosities and lantern glows).
// Shell and core of the accumbens share the accumbens volume and are split by distance from
// the core centre. Cortical fields are sampled from the cortical sheet of their region.
export const TERMINALS = [
  { region: R.naccShell, type: 'e', c: [10, 12, -8], r: [5, 6, 4.5], density: 1.0, lanterns: 14 },
  { region: R.naccCore, type: 'e', c: [11.5, 12.5, -6.5], r: [3.2, 4, 3.2], density: 1.0, lanterns: 6 },
  { region: R.dorsalStriatum, type: 'e', c: [25, 2, 1], r: [5.5, 15, 9], density: 1.0, lanterns: 40 },
  { region: R.dorsalStriatum, type: 't', pts: [[13, 15, 8, 7], [14, 4, 15, 5.5], [17, -10, 21, 3.8], [23, -27, 18, 2.8]], density: 0.9, lanterns: 22 },
  { region: R.amygdala, type: 'e', c: [23, -5, -18], r: [7, 8, 7], density: 0.25, lanterns: 8 },
  { region: R.hippocampus, type: 't', pts: [[25, -8, -20, 6], [29, -19, -15, 5], [30, -31, -7, 4]], density: 0.08, lanterns: 4 },
  { region: R.mpoa, type: 'e', c: [3.5, 4, -10], r: [2.6, 3.2, 3], density: 0.6, lanterns: 3 },
  { region: R.pvn, type: 'e', c: [3, -4, -6], r: [1.8, 3, 2.4], density: 0.5, lanterns: 2 },
  { region: R.pituitary, type: 'e', c: [0, -6, -15], r: [2.5, 2.5, 1.5], density: 0.8, lanterns: 2, mid: true },   // median eminence
  { region: R.pfc, type: 'cortex', density: 0.10, lanterns: 26 },
  { region: R.ofc, type: 'cortex', density: 0.09, lanterns: 14 },
  { region: R.acc, type: 'cortex', density: 0.12, lanterns: 10 },
  { region: R.spinal, type: 't', pts: [[3, -42, -66, 3], [3, -46, -86, 3]], density: 0.2, lanterns: 2 },
];

// Catmull–Rom spline through control points (arrays of [x, y, z, …]); returns a sampler
// pos(u) for u ∈ [0, 1] with roughly uniform parameter speed per segment.
export function spline(pts) {
  const n = pts.length - 1;
  const P = (i) => pts[Math.max(0, Math.min(n, i))];
  return (u) => {
    const f = clamp(u) * n;
    const i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const t2 = t * t, t3 = t2 * t;
    const out = [];
    for (let k = 0; k < p1.length; k++) {
      out.push(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
    }
    return out;
  };
}

// =====================================================================================
// Brain-system additions (research/ANALYSIS.md §3, §11; Appendix A.3.3 and B.5).
// Nothing above this line moves: NUCLEI, DA_GROUPS, BRAINSTEM, PATHWAYS and TERMINALS stay as
// they are, so the generateBrain buffer is unchanged. The structures below are drawn in a
// separate buffer (brain.js generateBrainExtra) or obtained by relabelling existing stars.
// =====================================================================================

// --- New brain structures (§3.16; right side, mirrored unless `mid`) ---
// type 'e': ellipsoid { c, r }; 't': tube { pts: [[x, y, z, radius], …] }; 'shell': a layer of
// an existing NUCLEI volume. `stars: true` → own stars in the extra buffer; `stars: false` →
// the structure takes over existing stars through RELABEL. `node` is the A.3.2 node kind when it
// is not 'nucleus'; `pos` overrides the representative position of a tube. Positions and extents
// are §3.16 (source [T], low confidence unless the row says otherwise).
const TINT = BRAIN_PARAMS.tint;
const nuc = (id, group, type, geo, opt = {}) => ({ id, region: R[id], type, ...geo, tint: TINT[group], group, stars: true, ...opt });
const ell = (id, group, c, r, opt) => nuc(id, group, 'e', { c, r }, opt);
export const NUCLEI_V2 = [
  // Thalamic subnuclei inside the existing thalamus: relabels (B.8), §3.16 rows 1–3.
  ell('thalAnt', 'thal', [7, -7, 13], [2.5, 3, 2.5], { stars: false }),
  ell('thalMD', 'thal', [6, -17, 8], [3.5, 6, 4], { stars: false }),
  ell('thalVA', 'thal', [12, -8, 7], [3, 3, 3], { stars: false }),
  ell('thalVL', 'thal', [14, -15, 5], [3.5, 4, 4], { stars: false }),
  ell('thalVPL', 'thal', [18, -21, 3], [3, 3.5, 3], { stars: false }),
  ell('thalVPM', 'thal', [14, -21, 1], [2.5, 3, 2.5], { stars: false }),
  ell('thalVPMpc', 'thal', [12, -19, -1], [1.5, 2, 1.5], { stars: false }),
  ell('thalVMpo', 'thal', [11, -23, -1], [1.5, 2, 1.5], { stars: false }),     // Craig 2002
  ell('thalCM', 'thal', [9, -20, 2], [2.5, 3, 2.5], { stars: false }),
  ell('thalPulv', 'thal', [16, -29, 6], [5, 6, 5], { stars: false }),
  nuc('thalRet', 'thal', 'shell', { c: [19, -16, 6], of: 'thalamus', thickness: BRAIN_PARAMS.thalRetThickness }, { stars: false }),
  // Relay nuclei outside the thalamus ellipsoid (§3.17), habenula (epithalamus).
  ell('lgn', 'thal', [22, -25, -5], [3, 4, 2.5]),                             // Andrews, Halpern & Purves 1997 (volume)
  ell('mgn', 'thal', [15, -26, -6], [2.5, 3, 2.5]),
  ell('habenula', 'thal', [3.5, -25, 2], [1.5, 2, 1.5]),
  // Pallidum split (§3.17): both drawn in the extra buffer, existing stars relabelled.
  ell('gpe', 'pallid', [22, -2, 1], [3, 9, 6]),
  ell('gpi', 'pallid', [17, -6, -3], [2.5, 6, 4]),
  // STN (medium; DOPAMINE.md §2.4). §3.16 gives the long axis only qualitatively
  // (anterolateral-superior → posteromedial-inferior), so it is drawn axis-aligned.
  ell('stn', 'sub', [12, -13, -5], [2.5, 5, 2.5]),
  ell('snr', 'sub', [13, -14, -11], [3, 6, 2.5]),                             // Keuken et al. 2014 (orientation)
  ell('vp', 'pallid', [13, 4, -6], [3, 4, 2.5]),
  nuc('nbm', 'bf', 't', { pts: [[13, 4, -10, 2], [19, -2, -9, 2.5], [24, -9, -8, 2], [28, -16, -9, 1.5]] }),   // Zaborszky et al. 2008
  ell('msdb', 'bf', [2, 6, -3], [1.5, 3, 3]),
  ell('hdb', 'bf', [10, 4, -13], [3, 2, 1.5]),
  ell('bnst', 'limbic', [7, 2, 0], [2, 3, 3]),
  ell('cea', 'limbic', [22, -6, -14], [2.5, 3, 2.5]),                         // DOPAMINE.md §2.4
  ell('olfTubercle', 'olf', [13, 8, -14], [3, 3, 1.5]),
  ell('olfBulb', 'olf', [8, 36, -25], [2, 5, 1.5]),                           // 2 mm below the frontal hull
  // Hypothalamus and circumventricular organs (§3.17: own ellipsoids).
  ell('scn', 'hyp', [2, 2, -13], [1.5, 2, 1.5], { node: 'oscillator' }),     // drawn size; real ≈ (1, 1.2, 1)
  ell('son', 'hyp', [10, 0, -14], [1.5, 3, 1.2]),
  ell('vlpo', 'hyp', [6, 3, -12], [1.5, 2, 1.5]),                             // Saper, Scammell & Lu 2005
  ell('mnpo', 'hyp', [0, 4, -8], [1, 2, 3], { mid: true }),
  ell('ovlt', 'hyp', [0, 6, -11], [1, 1, 1.5], { mid: true }),
  ell('sfo', 'hyp', [0, -2, 10], [1, 1.5, 1], { mid: true }),
  ell('lh', 'hyp', [6, -10, -9], [3, 4, 3]),                                  // orexin field; Thannickal et al. 2000
  ell('tmn', 'hyp', [6, -12, -14], [2, 2.5, 1.5]),
  ell('dmh', 'hyp', [4, -8, -6], [1.5, 2, 2]),
  ell('vmh', 'hyp', [4.5, -6, -11], [2, 2.5, 2]),
  ell('mammillary', 'hyp', [3, -11, -14], [2, 2.5, 2]),
  ell('areaPostrema', 'hyp', [0, -44, -56], [2, 1, 2], { mid: true }),
  ell('medianEminence', 'hyp', [0, -6, -15], [2.5, 2.5, 1.5], { mid: true }),
  ell('pineal', 'gland', [0, -32, 1], [3, 4, 3], { mid: true, node: 'gland' }),
  // Brainstem (§3.16; checked inside the post-port BRAINSTEM tube). Locus coeruleus: medium,
  // Keren et al. 2009; mean right LC (5.4, −37.9, −24.7) via Astafiev et al. 2010 [secondary].
  nuc('lc', 'bs', 't', { pts: [[4.1, -36.2, -18, 0.9], [5.2, -36.9, -24, 1.4], [5.8, -37.2, -27, 1.4], [6.4, -37.7, -30, 1.2], [7.6, -38.5, -33, 0.8]], pos: [5.4, -37.9, -24.7] }),
  ell('dr', 'raphe', [0, -30, -13], [2.5, 3, 5], { mid: true, stars: false }),    // raphe tube split
  ell('mnr', 'raphe', [0, -29, -22], [2, 3, 4], { mid: true, stars: false }),
  ell('rmg', 'raphe', [0, -31, -40], [2, 3, 5], { mid: true }),
  ell('rpa', 'raphe', [0, -29, -50], [1.5, 2, 5], { mid: true }),
  ell('rob', 'raphe', [0, -35, -52], [1.5, 2, 6], { mid: true }),
  ell('ppn', 'bs', [7, -31, -19], [2, 3, 4]),
  ell('ldt', 'bs', [3, -36, -19], [1.5, 2, 3]),
  ell('pbn', 'bs', [9, -35, -26], [2, 2.5, 4]),                               // Singh et al. 2020 (volume)
  ell('pno', 'bs', [4, -31, -24], [3, 3, 4]),
  ell('pnc', 'bs', [4, -32, -34], [3, 3, 4]),
  ell('gi', 'bs', [3, -35, -45], [2.5, 3, 6]),
  ell('mrf', 'bs', [6, -32, -12], [2.5, 2.5, 3]),
  ell('vestNuc', 'bs', [9, -37, -40], [3, 2.2, 5]),
  ell('ntsGust', 'bs', [5, -39, -44], [1.5, 1.5, 3]),
  ell('ntsVisc', 'bs', [3.5, -42, -53], [1.8, 1.8, 5]),
  ell('dmv', 'bs', [3, -40, -51], [1, 1.2, 6]),
  ell('nAmbMotor', 'bs', [7.5, -38, -50], [1, 1.2, 5]),
  ell('nAmbVagal', 'bs', [7.5, -36.5, -52.5], [1, 1, 4]),
  ell('rvlm', 'bs', [6.5, -33, -45], [2, 2, 3]),                              // rostral pole of the olive
  ell('cvlm', 'bs', [6, -34, -56], [1.8, 1.8, 3]),
  ell('preBotC', 'bs', [6.5, -35, -51], [1.5, 1.2, 2], { node: 'oscillator' }),   // Schwarzacher, Rüb & Deller 2011
  ell('rtn', 'bs', [9, -26, -43], [2, 1.5, 3]),                               // Guyenet & Bayliss 2015
  ell('io', 'bs', [5, -31.5, -53], [2.5, 2, 6.5]),
  ell('gracile', 'bs', [2.5, -44, -62], [1.5, 1.5, 4]),
  ell('cuneate', 'bs', [5.5, -43, -60], [1.5, 1.5, 4]),
  nuc('spV', 'bs', 't', { pts: [[8, -38, -42, 1.5], [6.5, -42.5, -70, 1.5]], pos: [7, -41, -60] }),   // pos: caudalis (§3.16 routes)
  ell('prV', 'bs', [11, -33, -28], [2, 2, 3]),
  nuc('mesV', 'bs', 't', { pts: [[7, -36.5, -26, 0.8], [6, -33, -10, 0.8]] }),
  ell('motV', 'bs', [8, -32, -28], [1.5, 2, 2.5]),
  ell('cochNuc', 'bs', [12, -36, -40], [2, 2, 3]),                            // Sitek et al. 2019
  ell('soc', 'bs', [8, -30, -34], [2, 2, 3]),
  // Tectum: the ellipsoids sit at or past the dorsal tube boundary and form the tectal bumps (§3.17).
  ell('ic', 'bs', [6, -36, -11], [3, 3, 3]),
  ell('sc', 'bs', [5, -32, -4], [3, 2.5, 2.5]),
  ell('opn', 'bs', [6, -28, -1], [1.5, 1.5, 1.5]),
  ell('ew', 'bs', [2, -26, -6], [1, 1.5, 2]),
  ell('n3', 'bs', [3, -25, -9], [1.5, 2, 2.5]),
  ell('n4', 'bs', [3, -30, -15], [1, 1, 1.2]),
  ell('n6', 'bs', [4, -37, -34], [1.2, 1.2, 1.5]),
  ell('n7m', 'bs', [10, -31, -38], [1.5, 1.5, 2.5]),
  ell('n12', 'bs', [1.5, -40, -54], [1, 1, 5]),
  ell('ssn', 'bs', [6, -33, -39], [1, 1, 1.5]),
  ell('isn', 'bs', [6, -36, -46], [1, 1, 1.5]),
  ell('barrington', 'bs', [4, -35, -27], [1, 1.5, 1.5]),
  ell('redNucleus', 'bs', [5, -20, -8], [2.5, 3, 3]),                         // medium; DOPAMINE.md §2.4
  ell('pontineNuc', 'bs', [7, -20, -32], [6, 5, 8]),
  // Deep cerebellar nuclei and vestibulocerebellum.
  ell('fastigial', 'cb', [5, -53, -27], [1.5, 2.5, 1.5]),
  ell('interposed', 'cb', [10, -55, -31], [1.5, 3, 2]),
  ell('flocculus', 'cb', [25, -44, -36], [4, 4, 3]),
  ell('nodulus', 'cb', [0, -50, -33], [4, 3, 3], { mid: true }),
];
export const V2 = Object.fromEntries(NUCLEI_V2.map((d) => [d.id, d]));

// --- Relabels of existing stars (A.3.3 splits; §3.17; B.5 applyRelabel) ---
// Rules act on the region float of stars whose region is `from`. Positions are compared on the
// right side (|x|). 'nearest': the target with the smallest distance to its centre, Euclidean
// ('euclid') or in units of each target's half-axes ('scaled'); an optional lateral shell of the
// `from` volume goes to `shell.id` first. 'plane': split at a coordinate (axis 0 x, 1 y, 2 z).
export const RELABEL = [
  { from: R.pallidum, rule: 'nearest', metric: 'euclid', to: ['gpe', 'gpi'] },                    // §3.17: nearer of the two centres
  { from: R.raphe, rule: 'nearest', metric: 'euclid', to: ['dr', 'mnr'] },                        // §3.17: raphe tube → dr + mnr
  { from: R.pituitary, rule: 'plane', axis: 1, at: BRAIN_PARAMS.pituitarySplitY, above: 'pituitaryAnt', below: 'pituitaryPost' },   // A.3.3
  { from: R.thalamus, rule: 'nearest', metric: 'scaled',                                          // B.8: 11 subnuclei as relabels
    to: ['thalAnt', 'thalMD', 'thalVA', 'thalVL', 'thalVPL', 'thalVPM', 'thalVPMpc', 'thalVMpo', 'thalCM', 'thalPulv'],
    shell: { id: 'thalRet', thickness: BRAIN_PARAMS.thalRetThickness, minNormalX: BRAIN_PARAMS.thalRetMinNormalX } },
];

// --- Midline regions: 1 where every structure of the region is a single midline structure
// (`mid: true`, A.2), so left and right stars share one state (statetex §11.15). Plane splits of
// a midline region stay midline. ---
export const MIDLINE = (() => {
  const seen = new Uint8Array(REGION_COUNT), sided = new Uint8Array(REGION_COUNT), mid = new Uint8Array(REGION_COUNT);
  for (const d of [...NUCLEI, ...NUCLEI_V2]) { seen[d.region] = 1; if (!d.mid) sided[d.region] = 1; }
  for (let r = 0; r < REGION_COUNT; r++) mid[r] = seen[r] && !sided[r] ? 1 : 0;
  for (const rule of RELABEL) if (rule.rule === 'plane' && mid[rule.from]) mid[R[rule.above]] = mid[R[rule.below]] = 1;
  return mid;
})();

// --- Parent region: whose dopamine channels and imaging activity a new id inherits (B.5) ---
// Relabelled ids inherit from the region their stars came from, so brain-only rendering is
// unchanged; new nuclei inherit from the existing region that contains or adjoins them.
// Choices for new nuclei are [model]; DOPAMINE.md defines no dopamine field of its own for them.
const PARENT_OF = {
  thalamus: ['thalAnt', 'thalMD', 'thalVA', 'thalVL', 'thalVPL', 'thalVPM', 'thalVPMpc', 'thalVMpo', 'thalCM', 'thalPulv',
    'thalRet', 'lgn', 'mgn', 'habenula', 'pineal'],
  pallidum: ['gpi', 'vp', 'nbm', 'msdb', 'hdb'],
  zonaIncerta: ['stn'],
  snc: ['snr'],
  amygdala: ['bnst', 'cea'],
  hypothalamus: ['scn', 'son', 'vlpo', 'lh', 'tmn', 'dmh', 'vmh', 'mammillary', 'mnpo', 'ovlt', 'sfo'],
  pituitary: ['medianEminence', 'pituitaryPost'],
  raphe: ['mnr', 'rmg', 'rpa', 'rob'],
  dentate: ['fastigial', 'interposed'],
  cerebellum: ['flocculus', 'nodulus'],
  cortex: ['olfBulb', 'olfTubercle'],
  brainstem: ['areaPostrema', 'lc', 'ppn', 'ldt', 'pbn', 'pno', 'pnc', 'gi', 'mrf', 'vestNuc', 'ntsGust', 'ntsVisc', 'dmv',
    'nAmbMotor', 'nAmbVagal', 'rvlm', 'cvlm', 'preBotC', 'rtn', 'io', 'gracile', 'cuneate', 'spV', 'prV', 'mesV', 'motV',
    'cochNuc', 'soc', 'ic', 'sc', 'opn', 'ew', 'n3', 'n4', 'n6', 'n7m', 'n12', 'ssn', 'isn', 'barrington', 'redNucleus', 'pontineNuc'],
};
export const PARENT = (() => {
  const p = new Uint8Array(REGION_COUNT).fill(255);
  for (let r = 0; r < LEGACY_REGION_COUNT; r++) p[r] = r;
  for (const [parent, ids] of Object.entries(PARENT_OF)) for (const id of ids) p[R[id]] = R[parent];
  return p;
})();

// --- Cortical areas: an `area` attribute on existing cortical stars, not regions (§3.16; A.3.3) ---
// Spherical patches { c, radius } (mm, right side). The three insular sub-patches have no
// radius: they partition the insular sheet (`sheet`) by nearest centre. The S1/M1 sub-site
// radii are given as "6–8 mm"; hand and face take the upper end (large cortical magnification),
// trunk 7, leg and foot 6 ([model]). Index in this array = area id (255 = none, AREA_NONE).
const patch = (id, c, radius) => ({ id, c, radius });
export const AREAS = [
  patch('v1', [10, -86, 4], 15), patch('v4', [30, -78, -14], 8), patch('mt', [46, -72, 4], 8), patch('ffa', [40, -52, -18], 6),   // Dumoulin et al. 2000 (MT)
  patch('a1', [48, -18, 6], 7), patch('pt', [54, -28, 12], 8),                                                              // Morosan et al. 2001
  patch('s1.face', [56, -14, 34], 8), patch('s1.hand', [40, -30, 58], 8), patch('s1.trunk', [20, -42, 70], 7),
  patch('s1.leg', [8, -42, 72], 6), patch('s1.foot', [4, -40, 64], 6),
  patch('m1.face', [54, -6, 34], 8), patch('m1.hand', [38, -22, 58], 8), patch('m1.trunk', [22, -18, 68], 7),                   // Yousry et al. 1997
  patch('m1.leg', [12, -22, 72], 6), patch('m1.foot', [6, -26, 72], 6),
  patch('ba3a', [36, -26, 50], 5), patch('ba2', [42, -36, 56], 6),
  patch('sma', [4, -6, 62], 8), patch('preSma', [6, 14, 56], 8), patch('pmd', [26, -10, 62], 8), patch('pmv', [52, 8, 24], 8), patch('fef', [30, -4, 54], 6),   // Paus 1996 (FEF)
  patch('s2', [52, -24, 20], 7), patch('pivc', [40, -20, 18], 5),                                                           // Eickhoff et al. 2006; zu Eulenburg et al. 2012
  { id: 'insPost', c: [38, -16, 6], sheet: R.insula }, { id: 'insMid', c: [38, -2, 6], sheet: R.insula },            // Craig 2002; Seeley et al. 2007
  { id: 'insAnt', c: [36, 18, 0], sheet: R.insula },
  patch('gust', [38, 2, 10], 6), patch('areaG', [44, 10, 8], 5), patch('piriform', [22, 2, -18], 6), patch('ofcOlf', [24, 34, -14], 6),
  patch('dlpfc', [42, 32, 28], 10), patch('ips', [30, -56, 50], 10), patch('ppc', [46, -52, 48], 10), patch('angular', [46, -70, 34], 10), patch('tpj', [54, -50, 22], 8),
  patch('pcc', [4, -54, 28], 10), patch('precuneus', [4, -62, 46], 10), patch('mpfc', [4, 52, 2], 10), patch('rsc', [6, -50, 12], 5),   // Raichle et al. 2001; Fox et al. 2005
  patch('dacc', [4, 24, 34], 8), patch('sgacc', [4, 18, -10], 5), patch('pgacc', [4, 38, 10], 6),                                // Öngür & Price 2000
  patch('entorhinal', [24, -10, -32], 6), patch('parahipp', [26, -32, -16], 6),
];
export const AREA = Object.fromEntries(AREAS.map((a, i) => [a.id, i]));
export const AREA_NONE = 255;

// --- Cranial nerve attachments: CNS ends of the §2.12 nerve routes and supraspinal port sites (§3.16) ---
export const CN_ATTACH = {
  cn1: [8, 36, -27], cn2: [30, 48, -39], 'cn2.chiasm': [0, 3, -18], cn3: [5, -14, -14], cn4: [4, -38.5, -16],
  cn5: [17, -27, -30], cn6: [4, -21, -42], cn7: [13, -29, -41], cn8: [14.5, -32, -41], cn9: [9.5, -33, -47],
  cn10: [9.5, -35, -51], cn11: [8.5, -37, -56], cn12: [3.5, -28.5, -53],
};
export const CHIASM_EXTENT = [7, 4, 2];   // half-axes of the optic chiasm (mm; §3.16)

// --- Principal CNS routes (§3.16): polylines used for packets and edge lengths ---
// `pts` are complete waypoint lists in mm (node ends resolved to their §3.16 positions); a crossed
// route passes its midline decussation and ends on the left (x < 0). `len` is the §3.16 model check
// (mm), reproduced by the straight polyline. `alt` and `branches` are further polylines of the same
// tract; `branchTo` lists targets reached by straight edges (§3.16: all other edges are straight).
export const BRAIN_TRACTS = [
  { id: 'tractML', from: 'cuneate', to: 'thalVPL', crossed: true, r: 1.5, len: 73.0,
    pts: [[5.5, -43, -60], [0, -38, -52], [-4, -36, -48], [-5, -30, -32], [-8, -25, -15], [-14, -22, -3], [-18, -21, 3]],
    alt: [{ from: 'gracile', len: 74.0, pts: [[2.5, -44, -62], [0, -38, -52], [-4, -36, -48], [-5, -30, -32], [-8, -25, -15], [-14, -22, -3], [-18, -21, 3]] }] },
  { id: 'tractSTT', from: 'junction', to: 'thalVPL', crossed: false, r: 1.5, len: 80.1,
    pts: [[5, -42, -72], [8, -36, -50], [10, -30, -30], [10, -26, -12], [18, -21, 3]], branchTo: ['thalVMpo', 'pbn', 'pag'] },
  { id: 'tractTrigLem', from: 'prV', to: 'thalVPM', crossed: true, r: 1, len: 42.8,
    pts: [[11, -33, -28], [0, -30, -24], [-8, -28, -15], [-14, -21, 1]] },
  { id: 'tractThalS1', from: 'thalVPL', to: 's1.hand', crossed: false, r: 2, len: 60.0,
    pts: [[18, -21, 3], [26, -24, 20], [40, -30, 58]] },
  { id: 'tractTrigSp', from: 'spV', to: 'thalVPM', crossed: true, r: 1, len: 71.1,
    pts: [[7, -41, -60], [0, -38, -52], [-8, -36, -45], [-10, -30, -30], [-10, -26, -12], [-14, -21, 1]],
    branches: [{ to: 'thalVMpo', len: 68.0, pts: [[7, -41, -60], [0, -38, -52], [-8, -36, -45], [-10, -30, -30], [-10, -26, -12], [-11, -23, -1]] }] },
  { id: 'tractTrigDors', from: 'prV', to: 'thalVPM', crossed: false, r: 0.7, len: 32.7, weight: 0.2,   // weight [model]
    pts: [[11, -33, -28], [8, -28, -15], [14, -21, 1]] },
  { id: 'tractLatLem', from: 'cochNuc', to: 'mgn', crossed: true, r: 1, len: 61.5,
    pts: [[12, -36, -40], [0, -30, -36], [-8, -30, -34], [-10, -33, -22], [-6, -36, -11], [-11, -31, -7], [-15, -26, -6]] },
  { id: 'tractLatLemU', from: 'cochNuc', to: 'mgn', crossed: false, r: 0.7, len: 48.6, weight: 0.4,     // weight [model]
    pts: [[12, -36, -40], [8, -30, -34], [10, -33, -22], [6, -36, -11], [11, -31, -7], [15, -26, -6]] },
  { id: 'tractAcRad', from: 'mgn', to: 'a1', crossed: false, r: 2, len: 36.3,
    pts: [[15, -26, -6], [30, -22, 2], [48, -18, 6]] },
  { id: 'tractOptic', from: 'cn2', to: 'lgn', crossed: false, r: 2, len: 96.9,       // through the optic canal and the chiasm
    pts: [[30, 48, -39], [12, 22, -26], [0, 3, -18], [12, -6, -14], [18, -16, -10], [22, -25, -5]] },
  { id: 'tractOptRad', from: 'lgn', to: 'v1', crossed: false, r: 3, len: 72.6,
    pts: [[22, -25, -5], [32, -45, 0], [25, -75, 4], [10, -86, 4]] },
  { id: 'tractCST', from: 'm1.hand', to: 'junction', crossed: false, r: 3, len: 141.4,
    pts: [[38, -22, 58], [28, -18, 30], [22, -14, 8], [14, -16, -12], [8, -20, -30], [3, -31, -55], [0, -40, -72]] },
  { id: 'tractSCP', from: 'dentate', to: 'thalVL', crossed: true, r: 2, len: 66.7,  // via the left red nucleus
    pts: [[15, -57, -35], [10, -45, -28], [0, -27, -14], [-5, -20, -8], [-14, -15, 5]] },
  { id: 'tractMCP', from: 'pontineNuc', to: 'cerebellum', crossed: true, r: 4, len: 59.0,
    pts: [[7, -20, -32], [0, -18, -34], [-18, -38, -32], [-25, -60, -40]] },
  { id: 'tractDNB', from: 'lc', to: 'pfc', crossed: false, r: 1.5, len: 96.5,        // starts at LC tube point 2
    pts: [[5.2, -36.9, -24], [5, -28, -10], [6, -12, -6], [8, 6, -4], [8, 30, 6], [8, 45, 18]] },
  { id: 'tractPagRvm', from: 'pag', to: 'junction', crossed: false, r: 1, len: 68.2,
    pts: [[0, -31, -7], [0, -31, -40], [3, -38, -56], [4, -45, -72]] },
  { id: 'tractBulbospinal', from: 'rvlm', to: 'junction', crossed: false, r: 1, len: 29.3,
    pts: [[6.5, -33, -45], [6, -38, -60], [5, -44, -72]] },
  { id: 'tractHyperdirect', from: 'm1.hand', to: 'stn', crossed: false, r: 1, len: 69.5,
    pts: [[38, -22, 58], [22, -14, 8], [12, -13, -5]] },
];

// --- Brain ports: the only crossings between the brain graph and the body networks (§3.14, §11.5) ---
// `channels[0]` is the port's main signal; further channels carry their own AND set of networks
// (A.5: an edge runs only in whole-body mode with every listed network on; [] = always on,
// `tissue: true` = runs whenever bodyMode = 'body'). `nodes` are the brain-side nodes of §3.14.
// `at`: nerve attachments (CN_ATTACH), `node` (a structure), `junction` (cervicomedullary
// junction; the tract's (ξ, η) comes from the §6.3 cord map) or `via` (logical port).
// `brainOnly` and `feedAt` give the brain-only behaviour (§3.14, §3.18, A.8 #5).
const ch = (signal, nets, extra) => ({ signal, nets, ...extra });
export const PORTS = [
  { id: 'portDC', dir: 'aff', nodes: ['gracile', 'cuneate'], channels: [ch('touch, vibration, proprioception', ['somatic'])],
    at: { junction: ['dcGracile', 'dcCuneate', 'dsct', 'vsct'] }, brainOnly: 'silent' },
  { id: 'portSTT', dir: 'aff', nodes: ['thalVPL', 'thalVMpo', 'thalCM', 'thalMD', 'pbn', 'pag', 'mrf', 'gi', 'lc'],
    channels: [ch('pain, temperature, itch, crude and affective touch', ['somatic'])], at: { junction: ['stt'] }, brainOnly: 'silent' },
  { id: 'portTrig', dir: 'aff', nodes: ['prV', 'spV', 'mesV'], channels: [ch('facial touch, pain, temperature; jaw proprioception', ['somatic'])],
    at: { attach: ['cn5'] }, brainOnly: 'silent' },
  { id: 'portVisc', dir: 'aff', nodes: ['ntsVisc'],
    channels: [ch('baroreceptor, chemoreceptor, lung and gut afferents', ['autonomic']), ch('immune afferents', ['autonomic', 'neuroimmune'])],
    at: { attach: ['cn10', 'cn9'] }, brainOnly: 'silent; NTS baseline falls' },
  { id: 'portGust', dir: 'aff', nodes: ['ntsGust'], channels: [ch('taste (VII, IX, X)', [])], at: { attach: ['cn7', 'cn9', 'cn10'] },
    brainOnly: 'fed', feedAt: 'ntsGust' },
  { id: 'portSpinoVisc', dir: 'aff', nodes: ['ntsVisc', 'pbn', 'thalVMpo', 'thalVPL'],
    channels: [ch('bladder, colorectal and cardiac spinal afferents', ['autonomic'])], at: { junction: ['stt'] }, brainOnly: 'silent' },
  { id: 'portCVO', dir: 'aff', nodes: ['areaPostrema', 'ovlt', 'sfo', 'medianEminence', 'mnpo'],
    channels: [ch('hormones', ['neuroendocrine']), ch('cytokines and PGE2', ['neuroimmune']), ch('osmolality and glucose', [], { tissue: true })],
    at: { node: 'areaPostrema' }, brainOnly: 'clamped at basal' },
  { id: 'portVest', dir: 'aff', nodes: ['vestNuc'], channels: [ch('rotation, linear acceleration, tilt', [])], at: { attach: ['cn8'] },
    brainOnly: 'fed', feedAt: 'vestNuc' },
  { id: 'portCoch', dir: 'aff', nodes: ['cochNuc'], channels: [ch('sound', [])], at: { attach: ['cn8'] }, brainOnly: 'fed', feedAt: 'cochNuc' },
  { id: 'portRetina', dir: 'aff', nodes: ['lgn', 'sc', 'opn', 'scn'], channels: [ch('light', [])], at: { attach: ['cn2'] },
    brainOnly: 'fed', feedAt: 'cn2' },
  { id: 'portOlf', dir: 'aff', nodes: ['olfBulb'], channels: [ch('odour', [])], at: { attach: ['cn1'] }, brainOnly: 'fed', feedAt: 'olfBulb' },
  { id: 'portCST', dir: 'eff', nodes: ['m1', 'pmd', 'sma', 's1'], channels: [ch('voluntary commands', ['somatic'])],
    at: { junction: ['cstLat', 'cstAnt'] }, brainOnly: 'efference only' },
  { id: 'portRS', dir: 'eff', nodes: ['gi', 'pnc', 'pno', 'vestNuc', 'redNucleus', 'rmg', 'lc', 'preBotC'],
    channels: [ch('posture, REM atonia, breathing drive, descending pain control', ['somatic']), ch('startle', ['somatic'], { special: true })],
    at: { junction: ['rsMed', 'rsPont', 'lvst', 'mvst', 'rubrospinal', 'tectospinal', 'bsResp', 'descMod'] }, brainOnly: 'efference only' },
  { id: 'portCranMotor', dir: 'eff', nodes: ['n3', 'n4', 'n6', 'motV', 'n7m', 'nAmbMotor', 'n12', 'n11'],
    channels: [ch('eye, jaw, face, pharynx, larynx, tongue', ['somatic'])],
    at: { attach: ['cn3', 'cn4', 'cn5', 'cn6', 'cn7', 'cn9', 'cn10', 'cn11', 'cn12'] }, brainOnly: 'efference only' },
  { id: 'portSymp', dir: 'eff', nodes: ['rvlm', 'pvn', 'rpa', 'lh'],
    channels: [ch('heart, vessels, sweat glands, adrenal medulla, brown fat, pupil dilator', ['autonomic'])],
    at: { junction: ['bulbospinalSymp'] }, brainOnly: 'efference only' },
  { id: 'portVag', dir: 'eff', nodes: ['nAmbVagal', 'dmv'],
    channels: [ch('heart', ['autonomic']), ch('gut, cephalic phase', ['autonomic', 'enteric']), ch('inflammatory reflex', ['autonomic', 'neuroimmune'])],
    at: { attach: ['cn10'] }, brainOnly: 'efference only' },
  { id: 'portPara', dir: 'eff', nodes: ['ew', 'ssn', 'isn'],
    channels: [ch('pupil constriction, accommodation, tears, saliva', ['autonomic']), ch('light reflex', ['autonomic'], { special: true })],
    at: { attach: ['cn3', 'cn7', 'cn9'] }, brainOnly: 'efference only' },
  { id: 'portSacral', dir: 'eff', nodes: ['barrington', 'pag'], channels: [ch('drive to the sacral parasympathetic nucleus', ['autonomic'])],
    at: { junction: [] }, brainOnly: 'efference only' },
  { id: 'portPortal', dir: 'eff', nodes: ['pvn', 'arcuate', 'mpoa'], channels: [ch('releasing hormones; TIDA dopamine (DOPAMINE.md)', ['neuroendocrine'])],
    at: { node: 'medianEminence' }, brainOnly: 'commands shown as tints' },
  { id: 'portNeurohyp', dir: 'eff', nodes: ['pvn', 'son'],
    channels: [ch('AVP, oxytocin', ['neuroendocrine']), ch('baroreceptor-driven AVP', ['autonomic', 'neuroendocrine'])],
    at: { node: 'pituitaryPost' }, brainOnly: 'commands shown as tints' },
  { id: 'portImmune', dir: 'eff', nodes: ['dmv', 'rvlm', 'pvn'],
    channels: [ch('inflammatory reflex, splenic sympathetic drive', ['autonomic', 'neuroimmune']), ch('glucocorticoid brake', ['neuroendocrine', 'neuroimmune'])],
    at: { via: ['portVag', 'portSymp', 'portPortal'] }, brainOnly: 'efference only' },
];
export const PORT = Object.fromEntries(PORTS.map((p) => [p.id, p]));

// --- Positions (mm, right side) of any structure id: new and existing nuclei, cortical areas,
// nerve attachments, the pituitary lobes and the ports. null for ids without a position. ---
const tubeMid = (pts) => spline(pts)(0.5).slice(0, 3);
function capCentroidY(c, r, splitY, upper) {
  // Centroid of the ellipsoid cap beyond a y-plane (closed form for a solid cap of a unit sphere).
  const t0 = Math.max(-1, Math.min(1, (splitY - c[1]) / r[1])) * (upper ? 1 : -1);
  const t = (3 * (1 - t0 * t0) ** 2) / (4 * (2 - 3 * t0 + t0 * t0 * t0));
  return c[1] + (upper ? 1 : -1) * t * r[1];
}
export function nodePos(id) {
  const v = V2[id];
  if (v) return v.pos ? [...v.pos] : v.type === 't' ? tubeMid(v.pts) : [...v.c];
  if (id === 'pituitaryAnt' || id === 'pituitaryPost') {
    const g = NUCLEI.find((d) => d.id === 'pituitary');
    return [g.c[0], capCentroidY(g.c, g.r, BRAIN_PARAMS.pituitarySplitY, id === 'pituitaryAnt'), g.c[2]];
  }
  const legacy = NUCLEI.find((d) => d.id === (REGION_ALIASES[id] ?? id) || (d.region === R[id] && R[id] < LEGACY_REGION_COUNT));
  if (legacy) return legacy.type === 't' ? tubeMid(legacy.pts) : [...legacy.c];
  if (id in AREA) return [...AREAS[AREA[id]].c];
  if (id in CN_ATTACH) return [...CN_ATTACH[id]];
  if (id === 'junction') return [...BRAIN_PARAMS.junction];
  return null;
}
export function portPos(id) {
  const at = PORT[id]?.at;
  if (!at) return null;
  if (at.attach) return [...CN_ATTACH[at.attach[0]]];
  if (at.node) return nodePos(at.node);
  if (at.junction) return [...BRAIN_PARAMS.junction];
  return at.via ? portPos(at.via[0]) : null;
}
