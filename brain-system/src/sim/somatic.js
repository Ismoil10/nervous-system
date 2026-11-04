// @ts-check
// Somatic network plugin (research/ANALYSIS.md §6; latencies §4.11, §6.11; switch §6.14, A.5, §11.10;
// interventions §6.15, §11.12; scenarios §12.5, §12.6, §12.8; B.4, B.15 phase 4). Plugin contract:
// graph.js header. Scope 'body', order 20: the fragment attaches to brainnet's ports (portDC, portSTT,
// portTrig, portCST) and to its brainstem nuclei (pnc, n7m, motV, n3, n4, n6, vestNuc, preBotC, rmg,
// lc, prV, spV), so it needs the brain fragment and works with or without sensory.js.
//
//   graph     31 cord segments × 2 sides (`cord.<seg>.dh`, `cord.<seg>.vh`), DRG ganglia, motor pools
//             (`cord.<seg>.vh.<muscle>`, `n11`, `phrenicNuc`, `onuf`), Ia / Ib / Renshaw interneurons of
//             the four tendon-reflex muscles, flexor-reflex premotor pools (`cord.C6.vh.fra`,
//             `cord.L5.vh.fra`), commissural interneurons, the lumbar CPG half-centres (`cpgL`),
//             muscle effectors and the body receptors (skin, spindle, tendon organ, joint) that
//             sensory.js drives; edges routed on the §2.12 nerve, root and cord polylines (body/geometry.js)
//   delay     d = L/v + n_syn · t_syn (+ NMJ + EMG spread at a muscle), §11.4; multi-part routes
//             (peripheral nerve + dorsal column or tract) use the exact sum Σ L_i/v_i
//   emg       emg = clamp((a − a_rest)/(1 − a_rest)) of the muscle unit (NF), + 0.3 · shiver on the
//             §6.13 shivering muscles (glow only)                                               §6.9
//   force     max(activation, twitch): activation relaxes to emg(t − EMD) with τ 15 / 50 ms (§6.9);
//             twitch = a · (s/τ_tw) · e^(1 − s/τ_tw), s = t − t_EMG − EMD, τ_tw 20 ms (§6.16)
//   joint     θ = θ_rest + filter₂(k_j · (F_ag − F_ant)), 3 Hz, ζ 0.8, k_j = cap (A.8 #22)    §6.16
//   startle   limb and neck pools: pnc activation delayed by conduction + a central recruitment delay
//             [model, §12.22], × state factor × g_hab (§6.11; g_hab = 1/(1 + k_hab·H), §4.9, §5.12)
//   gains     pool drive gain = state factor × Jendrassik × SCI tendon gain per segment and side;
//             flexor-reflex interneurons carry flexor gain / tendon gain (§6.11, §6.15)
//   breathing diaphragm and intercostal EMG and `diaphragmExc` are CV-layer overlays on respPhase and vt
//             (§6.13; rhythm owned by §7); somatic off → 0 (A.5 "ventilation maintained")
//   shiver    g.somatic · clamp((tSet − 0.7 − tCore)/1 °C, 0, 1) on EN (§6.13, §7.10 onsets)
//
// Switch semantics: NF edges carry nets ['somatic'] and are gated by the kernel; the plugin's own drives
// (startle, breathing, shivering) multiply the gate after the dead time (§11.13). Brain-only mode skips
// every hook, so body state freezes (A.5). Cross-module values are read only through k.ref with the A.5
// basal fallback (arousalState, posture, respPhase, vt, tCore, tSet).
// Units: mm, m/s, human seconds, Hz; joints in degrees from the drawn reference pose (A.2).

import { FIBRE_V, TRACT_V, PARAMS as GRAPH_PARAMS, mirror } from './graph.js';
import { RECEPTORS } from './stimuli.js';
import * as G from '../body/geometry.js';
import * as F from '../body/frame.js';

// --------------------------------------------------------------------------------------------------
// Parameters
// --------------------------------------------------------------------------------------------------
export const PARAMS = {
  // Node classes: τ s (Table 4.13a), rmax Hz (Table 4.8b, §6.9), resting rate Hz [model], κ (Table 4.8a).
  classes: {
    dh: { tau: 0.0015, rmax: 200, rSpont: 2 },            // dorsal horn projection / WDR pool (§6.2)
    vh: { tau: 0.0015, rmax: 200, rSpont: 2 },            // intermediate-zone interneurons, lamina VII
    inter: { tau: 0.0015, rmax: 200, rSpont: 2 },         // Ia, Ib, Renshaw and flexor-reflex interneurons
    comm: { tau: 0.030, rmax: 200, rSpont: 2 },           // commissural lamina VIII; τ 30 ms gives the 10–30 ms crossed delay (§6.11) [model]
    pool: { tau: 0.0015, rmax: 50, rSpont: 1 },           // α-MN pool: 20–50 Hz sustained ceiling (§6.9); rest 1 Hz [model]
    muscle: { tau: 0.0006, rmax: 50, rSpont: 0, kappa: 0.2 },   // effector output stage (KIND_DEFAULTS); κ 0.2 graded recruitment [model]
    cpg: { tau: 0.010, rmax: 100, rSpont: 2 },            // locomotor half-centres (§6.13) [model]
    drg: { tau: 0.0005, rmax: 300, rSpont: 1 },           // DRG ganglion node (display; not on the reflex chain) [model]
    receptorTau: 0.0005,                                  // s, receptor output stage (Table 4.13a; sensory.js)
  },
  // §6.3 cross-section placements (ξ, η) of the node kinds, right half [model inside the §6.3 boxes].
  xs: { dh: [0.3, -0.5], vh: [0.3, 0], ia: [0.25, 0.05], ib: [0.3, -0.1], rc: [0.3, 0.12], fra: [0.3, -0.05], comm: [0.1, 0.3],
    limbPool: [0.5, 0.35], axialPool: [0.2, 0.35], n11: [0.52, 0.15], phrenicNuc: [0.27, 0.4], onuf: [0.56, 0.42], cpg: [0.2, 0.17] },
  // Edge weights (drive per unit source activation, Table 4.8e) [model unless stated].
  w: {
    dh: { SA1: 0.3, RA1: 0.3, PC: 0.2, SA2: 0.2, CT: 0.3, AMH2: 1.0, AMH1: 1.0, Cpoly: 0.8, cold: 0.5, warm: 0.5, II: 0.3 },   // laminae I–V
    dc: { SA1: 1.0, RA1: 1.0, PC: 0.6, SA2: 0.6, Ia: 0.5, II: 0.5, Ib: 0.5 },   // → portDC (dorsal columns, spinocerebellar)
    trig: { SA1: 1.0, RA1: 1.0, PC: 0.6, SA2: 0.6, CT: 0.5, AMH2: 1.0, AMH1: 1.0, Cpoly: 0.8, cold: 0.6, warm: 0.6 },   // → portTrig
    overlap: 0.4,            // §6.6 overlap rule: primary 1.0, each overlap segment 0.4
    midline: 0.5,            // midline site (umbilicus) onto each side [model]
    stt: 1.0,                // dh → crossed anterolateral system (portSTT)
    dhVh: 1.0,               // dh → segmental flexor-reflex interneuron
    vhFra: 1.2,              // segmental → limb premotor flexor-reflex pool
    fraFlex: 2.0, fraExt: -1.5,   // premotor FRA → flexor pools (+), extensor pools (−) (§6.10)
    fraComm: 0.8, commExt: 1.5,   // crossed extension: ≈ 1.5 × withdrawal threshold (§6.11) [model]
    ia: 3.2,                 // spindle Ia → homonymous pool (monosynaptic, §6.10)
    iaIn: 2.0, iaInAnt: -1.5,     // Ia → Ia inhibitory interneuron → antagonist pool (reciprocal inhibition)
    ib: 1.5, ibIn: -0.8,     // Ib → Ib interneuron → homonymous pool (autogenic inhibition)
    rc: 1.0, rcPool: -0.4, rcIa: -0.4,   // pool → Renshaw → pool, Ia interneuron (recurrent inhibition)
    motor: 2.6,              // pool → muscle (α-motor axon, NMJ safety factor 3–5: every impulse transmits, §6.9)
    cst: 0.5, cstIpsi: 0.05, cstAxial: 0.2,   // portCST → pools: crossed lateral / uncrossed / axial (87/3/10 %, §6.8)
    vst: 0.2,                // vestNuc → ipsilateral extensor pools (lvst, §6.8)
    descMod: -0.15,          // rmg (RVM) and lc → dorsal horn (descending inhibition, §6.8, §5)
    bsResp: 0.3,             // preBotC → phrenicNuc, intercostal pool (bsResp, §6.13)
    cranial: 6.0,            // cranial motor nucleus → muscle (n7m, motV, n3, n4, n6)
    blinkR1: 0.6, blinkR2: 0.4,   // prV → ipsilateral n7m (R1), spV → both n7m (R2) (§6.10)
    // Delayed pnc Δa → recruited pool (ext drive per unit Δa), per §6.11 band: neck and shoulder strong,
    // limbs weak enough that the startle stays under the §6.16 cap (≤ 5°) [model].
    startle: { neck: 2.5, shoulder: 2.0, arm: 1.3, leg: 1.7 },
    cpg: 1.0, cpgMutual: -1.0, cpgOut: 0.4,
  },
  nSyn: { blinkR1: 2, blinkR2: 3 },   // §6.10 centres
  fibreV: { aalphaArm: 55, aalphaLeg: 50 },   // α-motor CV arm / leg, A.9 (§4.4)
  synV: 20,                // m/s, short intraspinal hops (TRACT_V.cns) for interneuron edges
  // Startle (§6.11, §12.6, §12.22). Recruitment delays are [model] central delays chosen inside the
  // §6.11 onset bands (neck 75–121, shoulder 100–121, arms 125–195, legs 145–395 ms); conduction runs
  // on the reticulospinal edge (TRACT_V.cns, low confidence).
  startle: {
    recruit: { neck: 0.068, shoulder: 0.085, arm: 0.115, leg: 0.15 },   // s [model]
    thresholdDb: 80,       // dB SPL, acoustic startle threshold (§6.11)
    kHab: 0.25, tauRec: 300, rho: 1,   // habituation trace (§4.9, §5.12)
    lineS: 0.512,          // s of NF history held by the plugin's delay line (≥ conduction + recruitment)
    activeEps: 1e-9,
  },
  stateFactor: [1.1, 1.0, 0.9, 0.7, 0.6, 0.1],   // wakeAlert … rem (§6.11)
  jendrassik: 1.5,         // optional flag, × tendon reflexes (§6.11)
  // SCI phases (§6.15): tendon and cutaneous/flexor gains below the lesion [model].
  sciPhase: [null, { tendon: 0, flexor: 0.05 }, { tendon: 0.1, flexor: 0.3 }, { tendon: 1.2, flexor: 1.0 }, { tendon: 2.5, flexor: 1.5 }],
  sciLevels: ['C2', 'C4', 'C6', 'T1', 'T6', 'T10', 'L2', 'S2'],   // §6.15; default C6
  dysreflexiaLevel: 'T6',  // at or above: the §7 rule (flag on the preset)
  stump: { motorHold: 3, motorZero: 9, sensoryZero: 11 },   // d, distal excitability (§6.15) [model]
  // Muscle output (§6.9, §6.16).
  emd: 0.030,              // s, electromechanical delay (A.9)
  tauAct: 0.015, tauDeact: 0.050,   // s, activation / deactivation (§6.9) [model]
  tauTwitch: 0.020,        // s, α-function twitch (§6.16) [model]
  burstOn: 0.05, burstOff: 0.025,   // delayed-EMG burst detection for the twitch [model]
  jointHz: 3, jointZeta: 0.8,       // second-order joint filter (§6.16) [model]
  shiverW: 0.3,            // emg per unit shiver on the §6.13 muscles [model]
  emgGain: 1.0,            // emg per unit pool Δa at the muscle (linear recruitment to MVC) [model]
  shiverOnset: 0.7, shiverSpan: 1.0,   // °C below tSet (§7.10 model onset) and range to full shivering [model]
  // Breathing overlay (§6.13; §7.9 rhythm): inspiratory fraction 0.4 of the cycle (I:E ≈ 1:1.5) [T].
  resp: { inspFrac: 0.4, vtRest: 0.5, excursion: 17, exponent: 0.75, emgDiaphragm: 0.15, emgIntercostal: 0.08 },
  cpgHz: 0.9,              // stride frequency 0.8–1.0 Hz (§6.13); only with a `locomotor` input [model]
  contact: { mm: 5, rElbow: 360, rWrist: 100, sites: ['palm', 'indexTip'] },   // §12.3 contact break [model]
  quietEps: 1e-7,
};

// --------------------------------------------------------------------------------------------------
// Anatomy tables (§6.5, §6.6, §6.10, §6.16)
// --------------------------------------------------------------------------------------------------
const SEGMENTS = F.SEGMENTS;
const SEG_IDX = F.SEG_INDEX;
const SIDES = /** @type {const} */ (['R', 'L']);
const sfx = (s) => (s === 'R' ? '.R' : s === 'L' ? '.L' : '');
const sgn = (s) => (s === 'L' ? -1 : 1);
const opp = (s) => (s === 'R' ? 'L' : 'R');
const isSpinal = (seg) => seg in SEG_IDX;
const ARM_SEGS = ['C5', 'C6', 'C7', 'C8', 'T1'];
const LEG_SEGS = ['L4', 'L5', 'S1', 'S2'];

// Muscles: pool segment (myotome key segment, §6.6; reflex centres §6.10, §12.5, §12.8), §2.12 route of
// the motor branch, the nerves a section of which denervates it (§6.15), limb class and antagonist.
/** @typedef {{ id: string, seg?: string, pool?: string, brain?: string[], route?: string | null, routes?: string[], nerves: string[],
 *   limb?: string, antag?: string, tendon?: string, overlay?: boolean, mid?: boolean, crossed?: boolean[], pos?: number[] }} MuscleDef */
/** @type {MuscleDef[]} */
export const MUSCLES = [
  { id: 'deltoid', seg: 'C5', route: 'axillary', nerves: ['axillary'], limb: 'arm' },
  { id: 'biceps', seg: 'C6', route: 'musculocutaneous.biceps', nerves: ['musculocutaneous'], limb: 'arm', antag: 'triceps', tendon: 'bicepsTendon' },
  { id: 'triceps', seg: 'C7', route: 'radial.triceps', nerves: ['radial'], limb: 'arm', antag: 'biceps', tendon: 'tricepsTendon' },
  { id: 'forearmFlexors', seg: 'C8', route: 'median.forearmFlexors', nerves: ['median'], limb: 'arm', antag: 'forearmExtensors' },
  { id: 'forearmExtensors', seg: 'C6', route: 'radial.forearmExtensors', nerves: ['radial'], limb: 'arm', antag: 'forearmFlexors' },
  { id: 'quadriceps', seg: 'L4', route: 'femoral', nerves: ['femoral'], limb: 'leg', antag: 'hamstrings', tendon: 'patellarTendon' },
  { id: 'hamstrings', seg: 'S1', route: 'sciatic.hamstrings', nerves: ['sciatic'], limb: 'leg', antag: 'quadriceps' },
  { id: 'gastrocSoleus', seg: 'S1', route: 'tibial.gastrocSoleus', nerves: ['tibial', 'sciatic'], limb: 'leg', antag: 'tibialisAnt', tendon: 'achillesTendon' },
  { id: 'tibialisAnt', seg: 'L4', route: 'commonFibular.tibialisAnt', nerves: ['commonFibular', 'sciatic'], limb: 'leg', antag: 'gastrocSoleus' },
  { id: 'adductors', seg: 'L3', route: 'obturator.adductors', nerves: ['obturator'], limb: 'leg' },
  { id: 'glutealMax', seg: 'S1', route: null, nerves: ['inferiorGluteal'], limb: 'leg' },
  { id: 'rectusAbdominis', seg: 'T10', route: 'intercostal.T10', nerves: ['intercostal.T10'], limb: 'axial' },
  { id: 'erectorSpinae', seg: 'T8', route: null, nerves: [], limb: 'axial' },
  { id: 'intercostalMuscles', seg: 'T6', route: 'intercostal.T6', nerves: ['intercostal.T6'], limb: 'axial', overlay: true, pos: [140, -20, -330] },
  { id: 'sternocleidomastoid', pool: 'n11', route: 'cn11.scm', nerves: ['cn11'], limb: 'neck' },
  { id: 'trapezius', pool: 'n11', route: 'cn11', nerves: ['cn11'], limb: 'neck' },
  { id: 'diaphragm', pool: 'phrenicNuc', route: 'phrenic', nerves: ['phrenic'], overlay: true, pos: [55, -5, -382] },
  { id: 'pelvicFloor', pool: 'onuf', route: 'pudendal', nerves: ['pudendal'], mid: true },
  { id: 'orbicularisOculi', brain: ['n7m'], routes: ['cn7.motor'], nerves: ['cn7.motor'], crossed: [false] },
  { id: 'stapedius', brain: ['n7m'], routes: ['cn7.stapedius'], nerves: ['cn7.motor'], crossed: [false] },
  { id: 'masseter', brain: ['motV'], routes: ['cn5.motor'], nerves: ['cn5.motor'], crossed: [false] },
  { id: 'extraocular', brain: ['n3', 'n4', 'n6'], routes: ['cn3', 'cn4', 'cn6'], nerves: ['cn3', 'cn4', 'cn6'], crossed: [false, true, false] },
];
const MUSCLE = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
const SPECIAL_POOLS = { n11: { seg: 'C3', xs: 'n11', label: 'spinal accessory nucleus' }, phrenicNuc: { seg: 'C4', xs: 'phrenicNuc', label: 'phrenic motor nucleus' },
  onuf: { seg: 'S2', xs: 'onuf', label: "Onuf's nucleus" } };
const SHIVER_MUSCLES = new Set(['trapezius', 'erectorSpinae', 'deltoid', 'rectusAbdominis', 'quadriceps']);   // §6.13
// Flexor-reflex (withdrawal) targets per limb (§6.10).
const FRA = {
  arm: { node: 'C6', segs: ARM_SEGS, flex: ['biceps', 'deltoid', 'forearmExtensors'], ext: ['triceps', 'forearmFlexors'] },
  leg: { node: 'L5', segs: LEG_SEGS, flex: ['hamstrings', 'tibialisAnt'], ext: ['quadriceps', 'gastrocSoleus'], crossed: ['quadriceps', 'gastrocSoleus', 'glutealMax'] },
};
const ANTIGRAVITY = ['quadriceps', 'gastrocSoleus', 'glutealMax', 'erectorSpinae', 'triceps'];   // lvst targets (§6.8)
// Startle recruitment targets (§6.11 cascade; §12.6 path pnc → reticulospinal → pools).
const STARTLE = [{ pool: 'n11', band: 'neck' }, { muscle: 'deltoid', band: 'shoulder' }, { muscle: 'biceps', band: 'arm' }, { muscle: 'quadriceps', band: 'leg' }];
// Joints that move the figure (§6.16, A.8 #22): agonist − antagonist, cap (deg); k_j = cap.
export const JOINTS = [
  { id: 'elbow', ag: 'biceps', ant: 'triceps', cap: 30 },
  { id: 'wrist', ag: 'forearmExtensors', ant: 'forearmFlexors', cap: 20 },
  { id: 'knee', ag: 'quadriceps', ant: 'hamstrings', cap: 15 },
  { id: 'shoulder', ag: 'deltoid', ant: null, cap: 5 },
  { id: 'neck', ag: 'sternocleidomastoid', ant: null, cap: 5 },
];
// Receptor classes per site kind (stimuli.js RECEPTORS; one receptor model, A.6). Dermatome key points
// carry one class per submodality to bound the graph (§11.4 sizes) [model]; named sites carry all.
const SKIN_CLASSES = ['SA1', 'RA1', 'PC', 'SA2', 'CT', 'AMH2', 'AMH1', 'Cpoly', 'cold', 'warm'];
const DERM_CLASSES = ['SA1', 'AMH2', 'Cpoly', 'cold', 'warm'];
const NAMED_SKIN = ['indexTip', 'palm', 'forearmDorsal', 'footSole', 'heel', 'bigToe', 'umbilicus', 'foreheadV1', 'cheekV2', 'chinV3'];
const TRIGEMINAL = new Set(['foreheadV1', 'cheekV2', 'chinV3']);
const MIDLINE = new Set(['umbilicus']);
const DERMATOMES = Object.keys(F.DERMATOME_POINTS).map((s) => `dermatome.${s}`);   // C2 … S3 (A.1)
const JOINT_SITES = ['shoulder', 'elbow', 'wrist', 'finger', 'hip', 'knee', 'ankle'];
const LARGE_FIBRES = new Set(['Ia', 'Ib', 'II', 'Abeta']);
// Nerve names a route passes through (sections cut every edge in the nerve, §6.15).
const ROUTE_NERVES = { tibial: ['tibial', 'sciatic'], commonFibular: ['commonFibular', 'sciatic'], saphenous: ['saphenous', 'femoral'] };
const nervesOf = (route) => { if (!route) return []; const base = route.split('.')[0] === 'intercostal' ? route : route.split('.')[0];
  return ROUTE_NERVES[base] ?? [base]; };
// §6.3 tract boxes: top of the η range (anterior limit) per tract, for the anterior-cord preset.
// bulbospinal: the §7 sympathetic premotor axons in the lateral funiculus (Nathan & Smith 1987 [recalled]),
// so an anterior-cord lesion cuts them (autonomic dysfunction is part of that syndrome) [model η].
const TRACT_ETA = { dc: -0.40, stt: 0.60, cstLat: -0.02, cstAnt: 0.97, rsPont: 0.75, lvst: 0.92, descMod: -0.30, bsResp: 0.50, bulbospinal: 0.20 };
export const NERVE_SECTIONS = ['radial', 'median', 'ulnar', 'axillary', 'musculocutaneous', 'femoral', 'obturator', 'sciatic', 'tibial', 'commonFibular', 'phrenic', 'cn7.motor'];

// --------------------------------------------------------------------------------------------------
// Geometry helpers (body/geometry.js routes; u = 0 at the CNS end)
// --------------------------------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; };
const cp = (p) => [p[0], p[1], p[2]];
function dedupe(pts) { const out = [cp(pts[0])]; for (let i = 1; i < pts.length; i++) if (dist(pts[i], out[out.length - 1]) > 0.25) out.push(cp(pts[i])); return out; }
function cordPos(seg, side, xs) {
  const c = F.CORD[seg];
  return [sgn(side) * xs[0] * c.rx, c.c[1] + xs[1] * c.ry, c.c[2]];
}
// Projection of q on a polyline: segment index and point.
function project(pts, q) {
  let best = { i: 0, p: cp(pts[0]), d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1] + (q[2] - a[2]) * ab[2]) / L2)) : 0;
    const p = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]], d = dist(p, q);
    if (d < best.d) best = { i, p, d };
  }
  return best;
}
// Canal centreline from a segment up to the cervicomedullary junction (§2.5).
let CANAL = null;
function canalUp(seg) {
  CANAL ??= G.pathById('cord').pts;
  const z = F.CORD[seg].c[2];
  return CANAL.filter((p) => p[2] > z + 0.5).reverse().map(cp);
}
const arcOf = (seg) => F.CORD[seg].arc;   // junction → segment along the cord (§2.14)
const junction = () => cp(F.PARAMS.junction);
// Peripheral route from a point near a nerve (site or muscle) to the DRG of `seg`, then through the
// dorsal root to the cord: { pts (periphery first), len, approx }.
function afferentRoute(routeId, q, seg, side) {
  const s = side ?? 'R';
  const nv = routeId ? G.nervePath(routeId, { root: isSpinal(seg) ? seg : null, side: sgn(s) }) : null;
  const spinal = isSpinal(seg);
  if (nv && (!spinal || nv.root === seg)) {
    const pr = project(nv.pts, q);
    const back = [cp(q), pr.p];
    for (let i = pr.i; i >= 0; i--) back.push(nv.pts[i]);
    const root = spinal ? F.rootPath(seg, sgn(s), false).slice(0, 2).reverse() : [];
    const pts = dedupe([...back, ...root]);
    return { pts, len: plen(pts), approx: false };
  }
  // No §2.12 route for this segment: straight line to the DRG × tortuosity (geometry.js PARAMS), flagged.
  const g = F.drg(seg, sgn(s)), root = F.rootPath(seg, sgn(s), false).slice(0, 2).reverse();
  const pts = dedupe([cp(q), g, ...root]);
  return { pts, len: dist(q, g) * G.PARAMS.tortuosity + F.rootLength(seg), approx: true };
}
// Motor route from the cord (ventral root) along the muscle branch to the muscle.
function efferentRoute(routeId, seg, side, target) {
  const s = sgn(side);
  const root = F.rootPath(seg, s, true).slice(0, 2);
  const nv = routeId ? G.nervePath(routeId, { root: seg, side: s }) : null;
  if (nv && nv.root === seg) {
    const pts = dedupe([...root, ...nv.pts, ...(target ? [target] : [])]);
    return { pts, len: plen(pts) };
  }
  const g = F.drg(seg, s), pts = dedupe([...root, g, target]);
  return { pts, len: F.rootLength(seg) + dist(g, target) * G.PARAMS.tortuosity };
}
const musclePos = (m, side) => {
  const g = G.MUSCLES.find((x) => x.id === m.id);
  const p = g ? g.c : m.pos;
  return m.mid ? cp(p) : (side === 'L' ? mirror(p) : cp(p));
};

// --------------------------------------------------------------------------------------------------
// Fragment (§6.2–§6.13 in the graph); META keeps the anatomical tags interventions select on.
// --------------------------------------------------------------------------------------------------
/** @typedef {{ kind: string, side: string | null, seg?: string, segIdx?: number, nerves?: string[], root?: 'dorsal' | 'ventral',
 *   fibre?: string, tract?: string, cordSide?: string, occIdx?: number }} EdgeMeta */

const poolId = (m, side) => (m.pool ? `${m.pool}${sfx(side)}` : `cord.${m.seg}.vh.${m.id}${sfx(side)}`);
const muscleId = (m, side) => (m.mid ? m.id : `${m.id}${sfx(side)}`);
const poolSeg = (m) => (m.pool ? SPECIAL_POOLS[m.pool].seg : m.seg);

function fragment(ctx) {
  const nodes = [], edges = [], paths = {};
  const meta = new Map(), nodeMeta = new Map();
  const C = PARAMS.classes, W = PARAMS.w;
  const has = (id) => !ctx || ctx.has(id);
  const brainPos = (id) => (ctx && ctx.has(id) ? cp(ctx.pos(id)) : null);
  const node = (spec, m) => { nodes.push(spec); if (m) nodeMeta.set(spec.id, m); return spec.id; };
  const path = (id, pts) => { if (!(id in paths)) paths[id] = pts.map(cp); return id; };
  const edge = (spec, m) => {
    const key = `${spec.from}>${spec.to}`;
    if (meta.has(key)) throw new Error(`somatic: duplicate edge ${key}`);
    meta.set(key, m);
    edges.push(spec);
  };
  // Multi-part conduction: explicit length and the velocity that gives Σ L_i / v_i (§4.4 per part).
  const parts = (list) => { const len = list.reduce((a, [L]) => a + L, 0), t = list.reduce((a, [L, v]) => a + L / v, 0); return { len, v: len / t }; };

  // --- Cord: dorsal and ventral grey per segment and side; DRG (§6.2–§6.4) ---
  for (const seg of SEGMENTS) for (const side of SIDES) {
    node({ id: `cord.${seg}.dh${sfx(side)}`, kind: 'segment', owner: 'som.aff', pos: cordPos(seg, side, PARAMS.xs.dh), side, ...C.dh, label: `cord ${seg} dorsal horn` },
      { seg, side, part: 'dh' });
    node({ id: `cord.${seg}.vh${sfx(side)}`, kind: 'segment', owner: 'som.motor', pos: cordPos(seg, side, PARAMS.xs.vh), side, ...C.vh, label: `cord ${seg} intermediate zone`,
      gain: { drive: `som.fg.${seg}${sfx(side)}` } }, { seg, side, part: 'vh' });
    node({ id: `drg.${seg}${sfx(side)}`, kind: 'ganglion', owner: 'som.aff', pos: F.drg(seg, sgn(side)), side, tau: C.drg.tau, rmax: C.drg.rmax, rSpont: C.drg.rSpont,
      label: `DRG ${seg}` }, { seg, side, part: 'drg' });
  }
  // Motor pools (§6.2 lamina IX), special nuclei, interneurons.
  for (const side of SIDES) {
    for (const [id, d] of Object.entries(SPECIAL_POOLS)) {
      node({ id: `${id}${sfx(side)}`, kind: 'segment', owner: 'som.motor', pos: cordPos(d.seg, side, PARAMS.xs[d.xs]), side, ...C.pool, label: d.label,
        gain: { drive: `som.tg.${d.seg}${sfx(side)}` } }, { seg: d.seg, side, part: 'pool' });
    }
    for (const m of MUSCLES) {
      if (!m.seg) continue;
      node({ id: poolId(m, side), kind: 'segment', owner: 'som.motor', pos: cordPos(m.seg, side, PARAMS.xs[m.limb === 'axial' ? 'axialPool' : 'limbPool']), side, ...C.pool,
        label: `${m.id} motor pool`, gain: { drive: `som.tg.${m.seg}${sfx(side)}` } }, { seg: m.seg, side, part: m.limb === 'axial' ? 'axialPool' : 'pool' });
      if (m.tendon) {
        for (const [k, xs, lab] of [['ia', 'ia', 'Ia inhibitory interneuron'], ['ib', 'ib', 'Ib interneuron'], ['rc', 'rc', 'Renshaw cell']]) {
          node({ id: `cord.${m.seg}.vh.${k}.${m.id}${sfx(side)}`, kind: 'segment', owner: 'som.motor', pos: cordPos(m.seg, side, PARAMS.xs[xs]), side, ...C.inter,
            label: `${m.id} ${lab}` }, { seg: m.seg, side, part: 'inter' });
        }
      }
    }
    for (const [limb, d] of Object.entries(FRA)) {
      node({ id: `cord.${d.node}.vh.fra${sfx(side)}`, kind: 'segment', owner: 'som.motor', pos: cordPos(d.node, side, PARAMS.xs.fra), side, ...C.inter,
        label: `${limb} flexor-reflex interneurons` }, { seg: d.node, side, part: 'inter' });
    }
    node({ id: `cord.L4.vh.comm${sfx(side)}`, kind: 'segment', owner: 'som.motor', pos: cordPos('L4', side, PARAMS.xs.comm), side, ...C.comm,
      label: 'commissural interneurons (crossed extension)', gain: { drive: `som.crossed${sfx(side)}` } }, { seg: 'L4', side, part: 'inter' });
    for (const [h, seg] of [['flex', 'L1'], ['ext', 'L2']]) {
      node({ id: `cpgL.${h}${sfx(side)}`, kind: 'oscillator', owner: 'som.motor', pos: cordPos(seg, side, PARAMS.xs.cpg), side, ...C.cpg,
        label: `locomotor CPG ${h === 'flex' ? 'flexor' : 'extensor'} half-centre (inferred in humans)` }, { seg, side, part: 'cpg' });
    }
  }
  // Muscles (effectors, NMJ + EMG spread on their in-edges, §11.4).
  for (const m of MUSCLES) for (const side of m.mid ? [null] : SIDES) {
    node({ id: muscleId(m, side), kind: 'effector', owner: 'som.motor', pos: musclePos(m, side), side, ...C.muscle, muscle: true, label: m.id });
  }

  // --- Receptors and afferents (§6.6, §5; sensory.js drives them by site and class) ---
  const recNode = (site, cls, side, pos) => {
    const R = RECEPTORS[cls];
    return node({ id: `rec.${site}.${cls}${side ? sfx(side) : ''}`, kind: 'receptor', owner: 'som.aff', pos, side, site, cls, tau: PARAMS.classes.receptorTau,
      rmax: R.rmax, rSpont: R.rSpont, xfer: 'direct', label: `${site} ${cls}` });
  };
  const fibreOf = (cls) => RECEPTORS[cls].fibre ?? 'Abeta';
  // Afferent edge into the cord (dh, pool or interneuron), routed through the nerve, DRG and root.
  const intoCord = (from, cls, routeKey, rt, seg, side, to, w, nerves) => {
    const fib = fibreOf(cls);
    edge({ from, to, kind: 'axon', fibre: fib, nets: ['somatic'], path: routeKey, len: rt.len, nSyn: 1, w, transmitter: 'Glu', label: `${cls} afferent ${seg}` },
      { kind: 'afferent', side, seg, segIdx: SEG_IDX[seg], nerves, root: 'dorsal', fibre: fib });
  };
  // Ascending dorsal-column edge to portDC (§6.3: gracile / cuneate fasciculus, ipsilateral).
  const intoDC = (from, cls, site, rt, seg, side, w, nerves) => {
    const port = `portDC${sfx(side)}`;
    if (!has(port)) return;
    const fib = fibreOf(cls), up = canalUp(seg);
    const pts = dedupe([...rt.pts, ...up, ctx ? ctx.pos(port) : junction()]);
    const pid = path(`som.dc.${site}.${seg}${sfx(side)}`, pts);
    const pv = parts([[rt.len, FIBRE_V[fib]], [arcOf(seg), TRACT_V.dc]]);
    edge({ from, to: port, kind: 'axon', fibre: fib, nets: ['somatic'], path: pid, len: pv.len, v: pv.v, nSyn: 0, w, transmitter: 'Glu', optional: true,
      label: `${cls} dorsal column` }, { kind: 'afferent', side, seg, segIdx: SEG_IDX[seg], nerves, root: 'dorsal', fibre: fib, tract: 'dc', cordSide: side, occIdx: SEG_IDX[seg] });
  };

  const skinSites = [...NAMED_SKIN, ...DERMATOMES];
  for (const site of skinSites) {
    const derm = site.startsWith('dermatome.');
    const classes = derm ? DERM_CLASSES : SKIN_CLASSES;
    for (const side of MIDLINE.has(site) ? [null] : SIDES) {
      const s = G.siteById(`${site}${side ? sfx(side) : ''}`);
      if (!s) continue;
      const routeNerve = s.pathId ? G.pathById(s.pathId)?.nerve ?? null : null;
      const ids = classes.map((cls) => recNode(site, cls, side, cp(s.pos)));
      if (TRIGEMINAL.has(site)) {   // trigeminal GSA → portTrig (cn5.som), first synapse at prV / spV (§6.7)
        const port = `portTrig${sfx(side)}`;
        if (!has(port)) continue;
        const nv = G.nervePath(routeNerve, { side: sgn(side) });
        const pr = project(nv.pts, s.pos), back = [cp(s.pos), pr.p];
        for (let i = pr.i; i >= 0; i--) back.push(nv.pts[i]);
        const pid = path(`som.trig.${site}${sfx(side)}`, dedupe(back));
        ids.forEach((id, q) => edge({ from: id, to: port, kind: 'axon', fibre: fibreOf(classes[q]), nets: ['somatic'], path: pid, nSyn: 0, w: W.trig[classes[q]],
          transmitter: 'Glu', optional: true, label: `${classes[q]} trigeminal` }, { kind: 'afferent', side, nerves: ['cn5.som'], fibre: fibreOf(classes[q]) }));
        continue;
      }
      /** @type {[string, number][]} */
      const segs = [[s.segment, 1], ...(s.overlap ?? []).map((o) => /** @type {[string, number]} */ ([o, W.overlap]))].filter(([g]) => isSpinal(g));
      /** @type {[string, number][]} */
      const targets = side ? [[side, 1]] : SIDES.map((x) => /** @type {[string, number]} */ ([x, W.midline]));
      for (const [tside, wm] of targets) for (const [seg, wo] of segs) {
        const rt = afferentRoute(routeNerve, s.pos, seg, tside);
        const pid = path(`som.aff.${site}.${seg}${sfx(tside)}`, [...rt.pts, cordPos(seg, tside, PARAMS.xs.dh)]);
        const nerves = nervesOf(routeNerve);
        ids.forEach((id, q) => {
          const cls = classes[q];
          intoCord(id, cls, pid, rt, seg, tside, `cord.${seg}.dh${sfx(tside)}`, W.dh[cls] * wo * wm, nerves);
          if (wo === 1 && W.dc[cls]) intoDC(id, cls, site, rt, seg, tside, W.dc[cls] * wm, nerves);
        });
      }
    }
  }
  // Tendons: spindle Ia in the muscle (route of its motor branch), tendon organ Ib at the tendon (§6.10).
  for (const m of MUSCLES.filter((x) => x.tendon)) for (const side of SIDES) {
    const site = m.tendon, s = G.siteById(`${site}${sfx(side)}`), seg = m.seg, mpos = musclePos(m, side);
    const ia = recNode(site, 'Ia', side, mpos), ib = recNode(site, 'Ib', side, cp(s.pos));
    const nerves = nervesOf(m.route);
    const rIa = afferentRoute(m.route, mpos, seg, side);
    const pIa = path(`som.ia.${m.id}${sfx(side)}`, [...rIa.pts, cordPos(seg, side, PARAMS.xs.limbPool)]);
    intoCord(ia, 'Ia', pIa, rIa, seg, side, poolId(m, side), W.ia, nerves);
    intoCord(ia, 'Ia', pIa, rIa, seg, side, `cord.${seg}.vh.ia.${m.id}${sfx(side)}`, W.iaIn, nerves);
    intoDC(ia, 'Ia', site, rIa, seg, side, W.dc.Ia, nerves);
    const rIb = afferentRoute(m.route, s.pos, seg, side);
    const pIb = path(`som.ib.${m.id}${sfx(side)}`, [...rIb.pts, cordPos(seg, side, PARAMS.xs.ib)]);
    intoCord(ib, 'Ib', pIb, rIb, seg, side, `cord.${seg}.vh.ib.${m.id}${sfx(side)}`, W.ib, nerves);
  }
  // Joints: spindle and joint afferents (Ia, II, Ib) → portDC; II also → dorsal horn (§6.6).
  for (const site of JOINT_SITES) for (const side of SIDES) {
    const s = G.siteById(`${site}${sfx(side)}`);
    if (!s) continue;
    const routeNerve = s.pathId ? G.pathById(s.pathId)?.nerve ?? null : null, nerves = nervesOf(routeNerve);
    const seg = s.segment, rt = afferentRoute(routeNerve, s.pos, seg, side);
    const pid = path(`som.aff.${site}.${seg}${sfx(side)}`, [...rt.pts, cordPos(seg, side, PARAMS.xs.dh)]);
    for (const cls of ['Ia', 'II', 'Ib']) {
      const id = recNode(site, cls, side, cp(s.pos));
      if (cls === 'II') intoCord(id, cls, pid, rt, seg, side, `cord.${seg}.dh${sfx(side)}`, W.dh.II, nerves);
      intoDC(id, cls, site, rt, seg, side, W.dc[cls], nerves);
    }
  }

  // --- Segmental circuits (§6.10) ---
  const local = (from, to, w, seg, side, label, extra = {}) => {
    const len = Math.max(1, dist(nodePos(from), nodePos(to)));
    edge({ from, to, kind: 'tract', fibre: 'cns', nets: ['somatic'], len, v: PARAMS.synV, nSyn: 1, w, transmitter: w < 0 ? 'Gly' : 'Glu', label },
      { kind: 'segmental', side, seg, segIdx: SEG_IDX[seg], ...extra });
  };
  const POS = new Map();
  const nodePos = (id) => { if (!POS.size) for (const n of nodes) POS.set(n.id, n.pos); return POS.get(id) ?? brainPos(id); };
  for (const side of SIDES) {
    // Anterolateral system: dh → crossed STT → portSTT (crossing 1 segment above entry [model], §6.3).
    for (const seg of SEGMENTS) {
      const port = `portSTT${sfx(opp(side))}`;
      if (!has(port)) break;
      const from = `cord.${seg}.dh${sfx(side)}`, xIdx = Math.max(0, SEG_IDX[seg] - 1);
      const pts = dedupe([cordPos(seg, side, PARAMS.xs.dh), [0, F.CORD[seg].c[1] + 0.3 * F.CORD[seg].ry, F.CORD[seg].c[2]], ...canalUp(seg).map((p) => [sgn(opp(side)) * 2, p[1], p[2]]),
        ctx ? ctx.pos(port) : junction()]);
      const pid = path(`som.stt.${seg}${sfx(side)}`, pts);
      edge({ from, to: port, kind: 'tract', fibre: 'cns', nets: ['somatic'], path: pid, len: arcOf(seg) + 2 * F.CORD[seg].rx, tract: 'sttAd', nSyn: 0, w: W.stt,
        transmitter: 'Glu', optional: true, label: `anterolateral system ${seg}` }, { kind: 'tract', side, seg, segIdx: SEG_IDX[seg], tract: 'stt', cordSide: opp(side), occIdx: xIdx });
    }
    // Flexor-reflex: dh → segmental interneuron → limb premotor pool → flexor / extensor pools.
    for (const seg of SEGMENTS) local(`cord.${seg}.dh${sfx(side)}`, `cord.${seg}.vh${sfx(side)}`, W.dhVh, seg, side, `flexor-reflex afferent ${seg}`);
    for (const d of Object.values(FRA)) {
      const fra = `cord.${d.node}.vh.fra${sfx(side)}`;
      for (const seg of d.segs) local(`cord.${seg}.vh${sfx(side)}`, fra, W.vhFra, seg, side, `flexor-reflex interneuron ${seg}`);
      for (const mid of d.flex) local(fra, poolId(MUSCLE[mid], side), W.fraFlex, d.node, side, `withdrawal → ${mid}`);
      for (const mid of d.ext) local(fra, poolId(MUSCLE[mid], side), W.fraExt, d.node, side, `withdrawal inhibits ${mid}`);
      if (d.crossed) {
        const comm = `cord.L4.vh.comm${sfx(side)}`;
        local(fra, comm, W.fraComm, 'L4', side, 'crossed extension');
        for (const mid of d.crossed) local(comm, poolId(MUSCLE[mid], opp(side)), W.commExt, 'L4', opp(side), `crossed extension → ${mid}`);
      }
    }
    // Stretch-reflex interneurons: reciprocal Ia, autogenic Ib, recurrent Renshaw (§6.10).
    for (const m of MUSCLES.filter((x) => x.tendon)) {
      const pre = `cord.${m.seg}.vh`, pool = poolId(m, side);
      if (m.antag) local(`${pre}.ia.${m.id}${sfx(side)}`, poolId(MUSCLE[m.antag], side), W.iaInAnt, m.seg, side, `reciprocal inhibition → ${m.antag}`);
      local(`${pre}.ib.${m.id}${sfx(side)}`, pool, W.ibIn, m.seg, side, `autogenic inhibition ${m.id}`);
      local(pool, `${pre}.rc.${m.id}${sfx(side)}`, W.rc, m.seg, side, `${m.id} recurrent collateral`);
      local(`${pre}.rc.${m.id}${sfx(side)}`, pool, W.rcPool, m.seg, side, `Renshaw → ${m.id}`);
      local(`${pre}.rc.${m.id}${sfx(side)}`, `${pre}.ia.${m.id}${sfx(side)}`, W.rcIa, m.seg, side, 'Renshaw → Ia interneuron');
    }
    // Locomotor CPG half-centres: mutual inhibition and output to leg pools (§6.13).
    local(`cpgL.flex${sfx(side)}`, `cpgL.ext${sfx(side)}`, W.cpgMutual, 'L1', side, 'half-centre inhibition');
    local(`cpgL.ext${sfx(side)}`, `cpgL.flex${sfx(side)}`, W.cpgMutual, 'L2', side, 'half-centre inhibition');
    for (const mid of ['hamstrings', 'tibialisAnt']) local(`cpgL.flex${sfx(side)}`, poolId(MUSCLE[mid], side), W.cpgOut, 'L1', side, `CPG → ${mid}`);
    for (const mid of ['quadriceps', 'gastrocSoleus']) local(`cpgL.ext${sfx(side)}`, poolId(MUSCLE[mid], side), W.cpgOut, 'L2', side, `CPG → ${mid}`);
  }

  // --- Motor axons: pool → muscle (Aα; NMJ and EMG spread via the muscle flag, §11.4) ---
  for (const m of MUSCLES) for (const side of SIDES) {
    const to = muscleId(m, m.mid ? null : side), tpos = musclePos(m, m.mid ? null : side);
    if (m.brain) {   // cranial motor nuclei (cns) → GSE / SVE axons (§6.7)
      m.brain.forEach((nuc, q) => {
        const src = `${nuc}${sfx(m.crossed[q] ? opp(side) : side)}`;
        const sp = brainPos(src);
        if (!sp) return;
        const r = G.pathById(`${m.routes[q]}${sfx(side)}`);
        const pts = dedupe([sp, ...(r ? r.pts : []), tpos]);
        const pid = path(`som.eff.${m.id}.${nuc}${sfx(side)}`, pts);
        edge({ from: src, to, kind: 'axon', fibre: 'Aalpha', nets: ['somatic'], path: pid, nSyn: 0, w: W.cranial, transmitter: 'ACh', optional: true,
          label: `${m.routes[q]} → ${m.id}` }, { kind: 'motor', side, nerves: [m.nerves[q] ?? m.nerves[0]], fibre: 'Aalpha' });
      });
      continue;
    }
    const seg = poolSeg(m), from = poolId(m, side);
    let rt;
    if (m.pool === 'n11') {   // spinal root rises through the foramen magnum, leaves by the jugular foramen (§6.7)
      const r = G.pathById(`${m.route}${sfx(side)}`);
      const pts = dedupe([cordPos(seg, side, PARAMS.xs.n11), junction(), ...r.pts, tpos]);
      rt = { pts, len: plen(pts) };
    } else rt = efferentRoute(m.route, seg, side, tpos);
    const v = m.limb === 'leg' || m.pool === 'onuf' ? PARAMS.fibreV.aalphaLeg : PARAMS.fibreV.aalphaArm;
    const pid = path(`som.eff.${m.id}${sfx(side)}`, [nodePos(from), ...rt.pts]);
    edge({ from, to, kind: 'axon', fibre: 'Aalpha', nets: ['somatic'], path: pid, len: rt.len, v, nSyn: 0, w: W.motor, transmitter: 'ACh',
      label: `${m.nerves[0] ?? 'nerve'} → ${m.id}` }, { kind: 'motor', side, seg, segIdx: SEG_IDX[seg], nerves: m.nerves, root: 'ventral', fibre: 'Aalpha' });
  }

  // --- Descending tracts from brain ports and nuclei (§6.8) ---
  const tractEdge = (from, to, seg, side, w, tract, cls, extra = {}) => {
    const sp = brainPos(from);
    if (!sp || !nodePos(to)) return;
    const pts = dedupe([sp, junction(), ...canalUp(seg).reverse(), nodePos(to)]);
    const len = dist(sp, junction()) + arcOf(seg);
    edge({ from, to, kind: 'tract', fibre: 'cns', nets: ['somatic'], path: extra.pathId ? path(extra.pathId, pts) : pts, len, tract: cls, nSyn: 1, w,
      transmitter: w < 0 ? 'GABA' : 'Glu', optional: true, transport: extra.transport, label: extra.label ?? tract },
    { kind: 'tract', side, seg, segIdx: SEG_IDX[seg], tract, cordSide: side, occIdx: SEG_IDX[seg] });
  };
  for (const side of SIDES) {
    for (const m of MUSCLES.filter((x) => x.seg && !x.overlay)) {
      const tgt = poolId(m, side), seg = m.seg;
      if (m.limb === 'axial') {
        tractEdge(`portCST${sfx(side)}`, tgt, seg, side, W.cstAxial, 'cstAnt', 'cst', { label: 'anterior corticospinal' });
      } else {
        tractEdge(`portCST${sfx(opp(side))}`, tgt, seg, side, W.cst, 'cstLat', 'cst', { label: 'lateral corticospinal', pathId: `som.cst.${m.id}${sfx(side)}` });
        tractEdge(`portCST${sfx(side)}`, tgt, seg, side, W.cstIpsi, 'cstLat', 'cst', { label: 'uncrossed lateral corticospinal' });
      }
    }
    for (const mid of ANTIGRAVITY) tractEdge(`vestNuc${sfx(side)}`, poolId(MUSCLE[mid], side), MUSCLE[mid].seg, side, W.vst, 'lvst', 'cns', { label: 'lateral vestibulospinal' });
    // Startle reticulospinal edges (pnc → pools): 'layer' transport; the plugin applies the drive with its
    // recruitment delay (§12.22) and the edge gate (cuts, g.somatic).
    for (const st of STARTLE) {
      const tgt = st.pool ? `${st.pool}${sfx(side)}` : poolId(MUSCLE[st.muscle], side), seg = st.pool ? SPECIAL_POOLS[st.pool].seg : MUSCLE[st.muscle].seg;
      tractEdge(`pnc${sfx(side)}`, tgt, seg, side, 1, 'rsPont', 'cns', { transport: 'layer', label: `pontine reticulospinal startle (${st.band})`, pathId: `som.rs.${st.band}${sfx(side)}` });
    }
    // Descending modulation of the dorsal horn: RVM (rmg) and coerulospinal (lc), inhibitory (§6.8).
    for (const seg of SEGMENTS) {
      tractEdge('rmg', `cord.${seg}.dh${sfx(side)}`, seg, side, W.descMod, 'descMod', 'cns', { label: 'raphespinal' });
      tractEdge(`lc${sfx(side)}`, `cord.${seg}.dh${sfx(side)}`, seg, side, W.descMod, 'descMod', 'lc', { label: 'coerulospinal' });
    }
    tractEdge(`preBotC${sfx(side)}`, `phrenicNuc${sfx(side)}`, 'C4', side, W.bsResp, 'bsResp', 'cns', { label: 'bulbospinal respiratory' });
    tractEdge(`preBotC${sfx(side)}`, poolId(MUSCLE.intercostalMuscles, side), 'T6', side, W.bsResp, 'bsResp', 'cns', { label: 'bulbospinal respiratory' });
    // Trigeminal blink reflex centres (§6.10, cns): prV → ipsilateral n7m (R1); spV → both n7m (R2).
    for (const [from, to, w, n] of [[`prV${sfx(side)}`, `n7m${sfx(side)}`, W.blinkR1, PARAMS.nSyn.blinkR1], [`spV${sfx(side)}`, `n7m${sfx(side)}`, W.blinkR2, PARAMS.nSyn.blinkR2],
      [`spV${sfx(side)}`, `n7m${sfx(opp(side))}`, W.blinkR2, PARAMS.nSyn.blinkR2]]) {
      if (!brainPos(from) || !brainPos(to)) continue;
      edge({ from, to, kind: 'tract', fibre: 'cns', w, nSyn: n, transmitter: 'Glu', optional: true, label: n === 2 ? 'blink R1' : 'blink R2' }, { kind: 'brainstem', side });
    }
  }
  return { frag: { nodes, edges, paths }, meta, nodeMeta };
}

const buildFragment = (ctx) => fragment(ctx).frag;
// Anatomical tags of a built graph: the fragment rebuilt against that graph's nodes (pure, memoised).
const META_CACHE = new WeakMap();
function metaFor(graph) {
  let m = META_CACHE.get(graph);
  if (!m) {
    const ctx = { has: (id) => graph.index.has(id), pos: (id) => graph.nodes[graph.index.get(id)]?.pos };
    const r = fragment(ctx);
    m = { meta: r.meta, nodeMeta: r.nodeMeta };
    META_CACHE.set(graph, m);
  }
  return m;
}

// --------------------------------------------------------------------------------------------------
// Interventions (§6.15, §11.12): presets as data; `targets(graph)` lists the edges they cut.
// --------------------------------------------------------------------------------------------------
const SIDE_NUM = { R: 1, L: -1, both: 0 };
// Descending tracts of other modules that end in a cord column (§7 bulbospinal premotor axons:
// brain port → cord.<seg>.iml / cord.S2.spn): every edge crossing the lesion is cut (§6.15, §7.8). Their
// occupancy is the target segment; they run in the lateral funiculus (TRACT_ETA.bulbospinal).
const FOREIGN_TRACT = /^cord\.([A-Z]\d+)\.(iml|spn)\.(R|L)$/;
function foreignTract(e) {
  if (e.kind !== 'tract' || !String(e.fromId).startsWith('port')) return null;
  const x = FOREIGN_TRACT.exec(e.toId);
  if (!x || !(x[1] in SEG_IDX)) return null;
  return { tract: 'bulbospinal', occIdx: SEG_IDX[x[1]], cordSide: x[3] };
}
// Edge indices removed by an intervention described by `params` (nerve section, SCI, dorsal rhizotomy).
// Edges of other modules are matched by their §2.12 path id (e.g. 'median.R', 'root.C7.R').
export function cutTargets(graph, params) {
  const { meta, nodeMeta } = metaFor(graph);
  const out = new Set();
  const removed = new Set();
  const sideOk = (s, want) => want === 'both' || want == null || s === want;
  if (params.kind === 'sci') {
    const l = SEG_IDX[params.level], type = params.type, side = params.side ?? 'R';
    for (const [id, m] of nodeMeta) {
      const i = SEG_IDX[m.seg];
      const inSpan = type === 'central' ? Math.abs(i - l) <= 1 : type === 'anterior' ? i === l || i === l + 1 : i === l;
      if (!inSpan) continue;
      if (type === 'brownSequard' && m.side !== side) continue;
      if (type === 'central' && (m.part === 'pool' || m.part === 'drg')) continue;   // limb pools lie at |ξ| ≥ 0.5 (§6.3)
      if (type === 'anterior' && (m.part === 'dh' || m.part === 'drg')) continue;    // dorsal grey spared (η < −0.4)
      if (m.part === 'drg') continue;                                                 // ganglia are outside the cord
      removed.add(id);
    }
    for (const e of graph.edges) {
      if (removed.has(e.fromId) || removed.has(e.toId)) { out.add(e.i); continue; }
      const m = meta.get(`${e.fromId}>${e.toId}`) ?? foreignTract(e);
      if (!m || !m.tract) continue;
      const occ = m.occIdx ?? -1;
      if (type === 'complete' && occ >= l) out.add(e.i);
      else if (type === 'brownSequard' && m.cordSide === side && occ >= l) out.add(e.i);
      else if (type === 'central' && m.tract === 'stt' && Math.abs(occ - l) <= 1) out.add(e.i);   // anterior white commissure
      else if (type === 'anterior' && (TRACT_ETA[m.tract] ?? -1) > -0.4 && occ >= l) out.add(e.i);
    }
  } else if (params.kind === 'nerve') {
    const nv = params.nerve, side = params.side;
    for (const e of graph.edges) {
      const m = meta.get(`${e.fromId}>${e.toId}`);
      if (m && m.nerves?.includes(nv) && sideOk(m.side, side)) { out.add(e.i); continue; }
      const pid = typeof e.path === 'string' ? e.path : null;
      if (pid && (pid === `${nv}${sfx(side)}` || (pid.startsWith(`${nv}.`) && pid.endsWith(sfx(side))))) out.add(e.i);
    }
  } else if (params.kind === 'rhizotomy') {
    const segs = new Set(params.segments), side = params.side;
    for (const e of graph.edges) {
      const m = meta.get(`${e.fromId}>${e.toId}`);
      if (m && m.root === 'dorsal' && segs.has(m.seg) && sideOk(m.side, side) && (params.variant !== 'largeFibre' || LARGE_FIBRES.has(m.fibre))) { out.add(e.i); continue; }
      const pid = typeof e.path === 'string' ? e.path : null;
      if (pid && params.variant !== 'largeFibre') for (const seg of segs) if (pid === `root.${seg}${sfx(side === 'both' ? 'R' : side)}` || (side === 'both' && pid === `root.${seg}.L`)) out.add(e.i);
    }
  }
  return [...out].sort((a, b) => a - b);
}
const INT_KIND = { none: 0, nerve: 1, sci: 2, rhizotomy: 3 };
const SCI_TYPE = { complete: 0, brownSequard: 1, central: 2, anterior: 3 };
function makePreset(id, label, params) {
  return {
    id, label, net: /** @type {'somatic'} */ ('somatic'), params: { somatic: true, ...params },
    targets(graph) { return cutTargets(graph, params); },
    apply(k) {
      for (const e of cutTargets(k.graph, params)) k.cutEdge(e, true);
      const set = (n, v) => { const i = k.idx(n); if (i >= 0) k.vars[i] = v; };
      set('som.int.kind', INT_KIND[params.kind] ?? 0);
      set('som.int.level', params.level ? SEG_IDX[params.level] : -1);
      set('som.int.type', SCI_TYPE[params.type] ?? 0);
      set('som.int.side', SIDE_NUM[params.side] ?? 0);
      set('som.int.phase', params.phase ?? 1);
      set('som.int.day', params.day ?? 0);
    },
  };
}
// Named-nerve section (§6.15): every edge in the nerve; day slider sets the distal-stump excitability.
export function nerveSection({ nerve, side = 'R', day = 0 }) {
  if (!NERVE_SECTIONS.includes(nerve)) throw new Error(`somatic: no section preset for '${nerve}'`);
  return makePreset(`som.nerve.${nerve}.${side}.d${day}`, `${nerve} nerve section (${side}), day ${day}`, { kind: 'nerve', nerve, side, day });
}
// Spinal cord injury (§6.15): level × type (complete, brownSequard, central, anterior) × phase 1–4.
export function spinalCordInjury({ level = 'C6', type = 'complete', side = 'R', phase = 1 } = {}) {
  if (!(level in SEG_IDX)) throw new Error(`somatic: unknown SCI level '${level}'`);
  const p = { kind: 'sci', level, type, side, phase, dysreflexia: SEG_IDX[level] <= SEG_IDX[PARAMS.dysreflexiaLevel] };
  return Object.assign(makePreset(`som.sci.${level}.${type}${type === 'brownSequard' ? `.${side}` : ''}.p${phase}`, `SCI ${level} ${type}, phase ${phase}`, p),
    { partial: type === 'central' ? { cstArm: 0.3 } : type === 'complete' ? { zpp: 0.5 } : null });
}
// Dorsal rhizotomy (§6.15): all dorsal-root edges of the segments, or the large-fibre-only variant.
export function dorsalRhizotomy({ segments = ['C5', 'C6', 'C7'], side = 'R', variant = 'all' } = {}) {
  return makePreset(`som.rhizotomy.${segments.join('-')}.${side}.${variant}`, `dorsal rhizotomy ${segments.join('–')} (${side}${variant === 'largeFibre' ? ', large fibre' : ''})`,
    { kind: 'rhizotomy', segments, side, variant });
}
// The default catalogue: each named-nerve section per side, each SCI level (complete, phase 1), the C6
// incomplete types, and the two rhizotomy variants (§6.15; one preset at a time, §11.12).
export const INTERVENTIONS = Object.freeze([
  ...NERVE_SECTIONS.flatMap((nerve) => SIDES.map((side) => nerveSection({ nerve, side }))),
  ...PARAMS.sciLevels.map((level) => spinalCordInjury({ level })),
  spinalCordInjury({ type: 'brownSequard', side: 'R' }), spinalCordInjury({ type: 'brownSequard', side: 'L' }),
  spinalCordInjury({ type: 'central' }), spinalCordInjury({ type: 'anterior' }),
  dorsalRhizotomy({}), dorsalRhizotomy({ variant: 'largeFibre' }),
]);

// --------------------------------------------------------------------------------------------------
// Instance
// --------------------------------------------------------------------------------------------------
const HNF = 0.0005;
const RING = 64;                     // emg history per muscle (≥ EMD / HNF + 1)
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

class Somatic {
  constructor(k) {
    this.k = k;
    const g = k.graph;
    const D = (n, v = 0, o = {}) => k.declare(n, v, o);
    // Muscles on the NF loop (overlay muscles: diaphragm, intercostals) and their readouts (A.3.4).
    /** @type {{ m: MuscleDef, id: string, side: string | null, i: number, j: number, vEmg: number, vForce: number, shW: number, src?: { e: number, j: number, d: number }[], blink?: boolean }[]} */
    this.mus = [];
    /** @type {{ m: MuscleDef, id: string, side: string | null, vEmg: number, vForce: number, e: number[] }[]} */
    this.overlay = [];
    this.agg = [];
    for (const m of MUSCLES) {
      const sides = m.mid ? [null] : SIDES;
      const vs = [];
      for (const side of sides) {
        const id = muscleId(m, side), i = g.index.get(id);
        if (i === undefined) continue;
        const rec = { m, id, side, i, j: -1, vEmg: D(m.mid ? `emg.${m.id}` : `emg.${m.id}${sfx(side)}`, 0, { unit: '0–1' }),
          vForce: D(m.mid ? `force.${m.id}` : `force.${m.id}${sfx(side)}`, 0, { unit: '0–1' }), shW: SHIVER_MUSCLES.has(m.id) ? PARAMS.shiverW : 0 };
        vs.push(rec);
        if (m.overlay) this.overlay.push({ ...rec, e: [] }); else this.mus.push(rec);
      }
      if (!m.mid && vs.length) this.agg.push({ emg: D(`emg.${m.id}`, 0, { unit: '0–1' }), force: D(`force.${m.id}`, 0, { unit: '0–1' }), parts: vs });
    }
    this.qOf = new Map(this.mus.map((r, q) => [r.id, q]));
    this.joints = [];
    for (const jd of JOINTS) {
      const sides = SIDES.map((side) => ({ side, v: D(`joint.${jd.id}${sfx(side)}`, 0, { unit: 'deg' }), ag: this.qOf.get(`${jd.ag}${sfx(side)}`) ?? -1,
        ant: jd.ant ? this.qOf.get(`${jd.ant}${sfx(side)}`) ?? -1 : -1 }));
      this.joints.push({ jd, agg: D(`joint.${jd.id}`, 0, { unit: 'deg' }), sides });
    }
    this.v = {
      shiver: D('shiver', 0, { unit: '0–1' }), reflexGain: D('reflexGain', 1, { unit: 'rel' }), diaphragmExc: D('diaphragmExc', 0, { unit: 'mm' }),
      lastTick: D('som.lastTick', -1), lineUntil: D('som.lineUntil', -1), gStartle: D('som.gStartle', 1), habH: D('som.habH', 0), habT: D('som.habT', 0),
      gainKey: D('som.gainKey', -1), contactR: D('som.contact.R', 0), contactL: D('som.contact.L', 0), breakR: D('som.contactBreak.R', -1), breakL: D('som.contactBreak.L', -1),
      fingertip: D('som.fingertipMm', 0, { unit: 'mm' }), stumpMotor: D('som.stumpMotor', 1), stumpSensory: D('som.stumpSensory', 1),
    };
    // Intervention configuration (kept across the master switch like the kernel's cuts: body false).
    for (const [n, v] of /** @type {[string, number][]} */ ([['som.int.kind', 0], ['som.int.level', -1], ['som.int.type', 0], ['som.int.side', 0], ['som.int.phase', 1], ['som.int.day', 0]])) D(n, v, { body: false });
    const M = Math.max(1, this.mus.length), RL = 1 << Math.ceil(Math.log2(PARAMS.startle.lineS / HNF + 4));
    this.RL = RL;
    k.declareArray('som.ring', M * RING, 0);
    k.declareArray('som.act', M, 0);
    k.declareArray('som.twOn', M, -1);
    k.declareArray('som.twPk', M, 0);
    k.declareArray('som.inBurst', M, 0);
    k.declareArray('som.jointVel', 2 * JOINTS.length, 0);
    k.declareArray('som.line', 2 * RL, 0);
    k.onLayer('NF', (t, h) => this.nf(t, h));
    k.onLayer('CV', (t, h) => this.cv(t, h));
    k.onLayer('EN', (t, h) => this.en(t, h));
    k.onStimulus((rec) => this.onStimulus(rec));
    k.on('intervention', (preset) => { this.onIntervention(preset); this._startleBlink(); });
    k.on('body', (p) => { if (p?.mode === 'brain') k.holdNF('somatic', false); else { this.updateGains(true); this._startleBlink(); } });
    k.on('posture', () => this.updateGains(true));
    // The startle state factor follows the arousal state at the change (§6.11).
    k.on('arousal', () => { this.updateGains(false); k.vars[this.v.gStartle] = this._startleGain(k.t); this._startleBlink(); });
    this.settleSeconds = 0;
    this._moving = false;   // scratch flag of the current NF step
  }

  init(k) {
    const g = k.graph;
    // Motor axons into each muscle: { edge, NF source, delay } (pool or cranial nucleus → muscle).
    for (const r of this.mus) {
      r.j = k.nfIndex(r.id);
      r.src = [];
      for (let q = g.inOff[r.i]; q < g.inOff[r.i + 1]; q++) {
        const e = g.edges[g.inEdge[q]], j = k.nfIndex(e.fromId);
        if (j >= 0 && e.w > 0) r.src.push({ e: e.i, j, d: e.delay });
      }
      r.blink = r.m.id === 'orbicularisOculi';
    }
    this.ring = k.array('som.ring'); this.act = k.array('som.act'); this.twOn = k.array('som.twOn'); this.twPk = k.array('som.twPk');
    this.inBurst = k.array('som.inBurst'); this.jVel = k.array('som.jointVel'); this.line = k.array('som.line');
    this.r = { arousal: k.ref('arousalState', 1), posture: k.ref('posture', 0), respPhase: k.ref('respPhase', 0), vt: k.ref('vt', PARAMS.resp.vtRest),
      tCore: k.ref('tCore', 37.0), tSet: k.ref('tSet', 37.0) };
    this.pncJ = SIDES.map((s) => k.nfIndex(`pnc${sfx(s)}`));
    // Startle targets: the reticulospinal layer edge (gate, conduction delay) and the pool it drives.
    this.startle = [];
    SIDES.forEach((side, s) => {
      for (const st of STARTLE) {
        const tgt = st.pool ? `${st.pool}${sfx(side)}` : poolId(MUSCLE[st.muscle], side);
        const e = k.edgeIndex(`pnc${sfx(side)}`, tgt), j = k.nfIndex(tgt);
        if (e < 0 || j < 0) continue;
        const d = g.edges[e].delay + PARAMS.startle.recruit[st.band];
        this.startle.push({ s, e, j, ticks: Math.round(d / HNF), w: PARAMS.w.startle[st.band] });
      }
    });
    // Startle blink route: brainnet's pnc → n7m edges (both sides, crossed). The startle product scales
    // only these edges, so the trigeminal blink R1/R2 into the same n7m keeps its gain (§6.10, §6.11).
    this.blinkEdges = [];
    for (const a of SIDES) for (const b of SIDES) { const e = k.edgeIndex(`pnc${sfx(a)}`, `n7m${sfx(b)}`); if (e >= 0) this.blinkEdges.push(e); }
    this.maxLine = this.startle.reduce((a, x) => Math.max(a, x.ticks), 0) * HNF;
    if (this.maxLine / HNF + 2 > this.RL) throw new Error('somatic: startle delay line too short');
    // Overlay gates: bsResp and the motor axon of each breathing muscle.
    for (const o of this.overlay) {
      const pool = poolId(o.m, o.side);
      o.e = [k.edgeIndex(`preBotC${sfx(o.side)}`, pool), k.edgeIndex(pool, o.id)].filter((e) => e >= 0);
    }
    // Contact model: joints used for fingertip displacement.
    this.jElbow = this.joints.find((x) => x.jd.id === 'elbow'); this.jWrist = this.joints.find((x) => x.jd.id === 'wrist');
    this.cpg = SIDES.map((s) => [k.nfIndex(`cpgL.flex${sfx(s)}`), k.nfIndex(`cpgL.ext${sfx(s)}`)]);
    this.vKeys = { kind: k.idx('som.int.kind'), level: k.idx('som.int.level'), type: k.idx('som.int.type'), side: k.idx('som.int.side'), phase: k.idx('som.int.phase'), day: k.idx('som.int.day') };
    this.decayAct = Math.exp(-HNF / PARAMS.tauAct); this.decayDeact = Math.exp(-HNF / PARAMS.tauDeact);
    this.emdTicks = Math.round(PARAMS.emd / HNF);
  }

  // --- Rest (§11.6): gains before the NF settle; dynamic state after it ---
  preSettle(init, k) { this.k.vars[this.v.gainKey] = -1; this.updateGains(true); for (const st of this.startle) k.setExt(st.j, 0); }

  settle(init, k) {
    const vars = k.vars;
    this.line.fill(0); this.act.fill(0); this.twOn.fill(-1); this.twPk.fill(0); this.inBurst.fill(0); this.jVel.fill(0);
    this.mus.forEach((r, q) => {
      const e = this._emg(r, k.t);
      this.ring.fill(e, q * RING, (q + 1) * RING); this.act[q] = e;
      vars[r.vEmg] = clamp(e + r.shW * vars[this.v.shiver], 0, 1); vars[r.vForce] = e;
    });
    for (const J of this.joints) for (const s of J.sides) vars[s.v] = this._jointTarget(J, s);
    for (const st of this.startle) k.setExt(st.j, 0);
    vars[this.v.lastTick] = Math.round(k.t / HNF); vars[this.v.lineUntil] = -1;
    vars[this.v.habH] = 0; vars[this.v.habT] = k.t;
    vars[this.v.gStartle] = this._startleGain(k.t);
    this._startleBlink();
    this._aggregate();
    this.cv(k.t, 0);
    k.holdNF('somatic', false);
  }

  // Recruitment-weighted pool drive at the muscle (§6.9): Σ over the muscle's motor axons of
  // gate · (a_pool(t − d_e) − a_rest), read from the pool's history ring (exact conduction + NMJ +
  // EMG-spread delay, no output-stage lag) [model: linear recruitment to MVC]. `moving` reports a
  // source whose delayed and current values still differ (the readout is not yet stationary).
  _emg(r, t) {
    const k = this.k;
    let x = 0;
    for (const s of r.src) {
      const g = k.edgeGate(s.e, t);
      if (g === 0) continue;
      const ad = k.readDelayed(s.j, s.d), ar = k.aRest(s.j);
      if (Math.abs(ad - k.a(s.j)) > PARAMS.quietEps) this._moving = true;
      if (ad > ar) x += g * (ad - ar);
    }
    return clamp(PARAMS.emgGain * x, 0, 1);
  }
  // Startle product on the startle blink route (pnc → n7m edge gain). An edge gain is at most 1, so the
  // wakeAlert state factor 1.1 reads as 1 on the blink [model]; the limb startle keeps the full product.
  _startleBlink() {
    const g = clamp(this.k.vars[this.v.gStartle], 0, 1);
    for (const e of this.blinkEdges ?? []) if (this.k.edgeScale(e) !== g) this.k.scaleEdge(e, g);
  }
  _jointTarget(J, s) {
    const f = this.k.vars, fa = s.ag >= 0 ? f[this.mus[s.ag].vForce] : 0, fb = s.ant >= 0 ? f[this.mus[s.ant].vForce] : 0;
    return J.jd.cap * (fa - fb);
  }

  // --- Gains (§6.11, §6.15) ---
  // Per segment and side: tendon gain on the pools, flexor / tendon ratio on the flexor-reflex
  // interneurons (their output passes the pool), crossed extension with posture upright.
  _sciGain(segIdx, side) {
    const vars = this.k.vars, K = this.vKeys;
    if (vars[K.kind] !== INT_KIND.sci) return { tendon: 1, flexor: 1 };
    const l = vars[K.level], type = vars[K.type], sd = vars[K.side];
    if (!(segIdx > l)) return { tendon: 1, flexor: 1 };
    if (type === SCI_TYPE.central) return { tendon: 1, flexor: 1 };
    if (type === SCI_TYPE.brownSequard && sgn(side) !== sd) return { tendon: 1, flexor: 1 };
    const ph = PARAMS.sciPhase[clamp(Math.round(vars[K.phase]), 1, 4)];
    return { tendon: ph.tendon, flexor: ph.flexor };
  }
  updateGains(force) {
    const k = this.k, vars = k.vars, K = this.vKeys;
    const st = clamp(Math.round(vars[this.r.arousal]), 0, 5), up = vars[this.r.posture] >= 0.5 ? 1 : 0;
    const jend = k.input(k.t)?.jendrassik ? 1 : 0;
    const key = st + 10 * up + 100 * jend + 1000 * (vars[K.kind] + 4 * (vars[K.level] + 1) + 200 * vars[K.type] + 1000 * (vars[K.side] + 1) + 3000 * vars[K.phase]);
    if (!force && key === vars[this.v.gainKey]) return;
    vars[this.v.gainKey] = key;
    const fState = PARAMS.stateFactor[st], fJ = jend ? PARAMS.jendrassik : 1;
    for (const seg of SEGMENTS) for (const side of SIDES) {
      const s = this._sciGain(SEG_IDX[seg], side), tendon = fState * fJ * s.tendon;
      k.setGain(`som.tg.${seg}${sfx(side)}`, tendon);
      k.setGain(`som.fg.${seg}${sfx(side)}`, tendon > 1e-3 ? Math.min(50, s.flexor / tendon) : 0);
      if (seg === 'L4') { k.setGain(`som.crossed${sfx(side)}`, up); if (side === 'R') vars[this.v.reflexGain] = tendon; }
    }
    // Distal stump excitability after a nerve section (§6.15 model).
    const day = vars[K.kind] === INT_KIND.nerve ? vars[K.day] : 0, S = PARAMS.stump;
    vars[this.v.stumpMotor] = day <= S.motorHold ? 1 : clamp(1 - (day - S.motorHold) / (S.motorZero - S.motorHold), 0, 1);
    vars[this.v.stumpSensory] = day <= S.motorHold ? 1 : clamp(1 - (day - S.motorHold) / (S.sensoryZero - S.motorHold), 0, 1);
  }
  // A preset that is not one of this module's (or none) clears the somatic intervention state.
  onIntervention(preset) {
    const vars = this.k.vars, K = this.vKeys;
    if (!preset?.params?.somatic) { vars[K.kind] = 0; vars[K.level] = -1; vars[K.type] = 0; vars[K.side] = 0; vars[K.phase] = 1; vars[K.day] = 0; }
    this.updateGains(true);
  }
  // Startle product: state factor × habituation (§6.11; fear factor not modelled).
  _startleGain(t) {
    const vars = this.k.vars, P = PARAMS.startle, st = clamp(Math.round(vars[this.r.arousal]), 0, 5);
    const H = vars[this.v.habH] * Math.exp(-Math.max(0, t - vars[this.v.habT]) / P.tauRec);
    return PARAMS.stateFactor[st] / (1 + P.kHab * H);
  }

  // --- Stimuli: startle habituation trace and hot-object contact ---
  onStimulus(rec) {
    const k = this.k, vars = k.vars, t = rec.tOnset, P = PARAMS.startle;
    if (!k.bodyOn) return;
    if (rec.sense === 'hearing' && rec.intensity >= P.thresholdDb) {
      const H = vars[this.v.habH] * Math.exp(-Math.max(0, t - vars[this.v.habT]) / P.tauRec);
      vars[this.v.habH] = H; vars[this.v.habT] = t;
      vars[this.v.gStartle] = this._startleGain(t);
      this._startleBlink();
      vars[this.v.habH] = H + P.rho;
    }
    if ((rec.sense === 'pain' && rec.mode === 'heat') && PARAMS.contact.sites.includes(rec.site) && (rec.side === 'R' || rec.side === 'L')) {
      const side = rec.side;
      vars[side === 'R' ? this.v.contactR : this.v.contactL] = 1;
      vars[side === 'R' ? this.v.breakR : this.v.breakL] = -1;
    }
  }

  // --- NF layer: startle delay line, muscle output, joints, contact ---
  nf(t, h) {
    const k = this.k, vars = k.vars, n = Math.round(t / HNF);
    let last = vars[this.v.lastTick];
    if (!(n > last)) { this.line.fill(0); last = n - 1; }   // the clock went back (settle, pre-roll rebase)
    const gap = n - last;
    vars[this.v.lastTick] = n;
    let busy = this._startleLine(t, n, gap);
    busy = this._muscles(t, n, gap, h) || busy;
    k.holdNF('somatic', busy);
  }

  _startleLine(t, n, gap) {
    const k = this.k, vars = k.vars, L = this.line, RL = this.RL, M = RL - 1;
    for (let s = 0; s < 2; s++) {
      const j = this.pncJ[s];
      if (j < 0) continue;
      const d = Math.max(0, k.a(j) - k.aRest(j)), b = s * RL;
      for (let m = Math.max(n - gap + 1, n - RL + 1); m < n; m++) L[b + (m & M)] = d;   // stride: the source was constant
      if (Math.abs(d - L[b + ((n - 1) & M)]) > PARAMS.startle.activeEps) vars[this.v.lineUntil] = t + this.maxLine + 2 * HNF;
      L[b + (n & M)] = d;
    }
    const gS = vars[this.v.gStartle];
    for (const st of this.startle) k.setExt(st.j, st.w * gS * k.edgeGate(st.e, t) * L[st.s * RL + ((n - st.ticks) & M)]);
    return t < vars[this.v.lineUntil];
  }

  _muscles(t, n, gap, h) {
    const k = this.k, vars = k.vars, R = this.ring, P = PARAMS, eps = P.quietEps;
    let busy = false;
    this._moving = false;
    const shiver = vars[this.v.shiver];
    for (let q = 0; q < this.mus.length; q++) {
      const r = this.mus[q], b = q * RING;
      const e = this._emg(r, t);
      if (gap > 1) { const prev = R[b + ((n - gap) & (RING - 1))]; for (let m = Math.max(n - gap + 1, n - RING + 1); m < n; m++) R[b + (m & (RING - 1))] = prev; }
      R[b + (n & (RING - 1))] = e;
      const u = R[b + ((n - this.emdTicks) & (RING - 1))];
      const A = this.act[q], a1 = u + (A - u) * (u > A ? this.decayAct : this.decayDeact);
      this.act[q] = Math.abs(a1 - u) < eps ? u : a1;
      // Twitch of the current burst (§6.16): onset on the delayed EMG, amplitude its running peak.
      if (!this.inBurst[q]) { if (u >= P.burstOn) { this.inBurst[q] = 1; this.twOn[q] = t; this.twPk[q] = u; } }
      else { if (u > this.twPk[q]) this.twPk[q] = u; if (u < P.burstOff) this.inBurst[q] = 0; }
      let tw = 0;
      if (this.twOn[q] >= 0) {
        const s = (t - this.twOn[q]) / P.tauTwitch;
        if (s > 15 && !this.inBurst[q]) this.twOn[q] = -1; else tw = this.twPk[q] * s * Math.exp(1 - s);
      }
      vars[r.vForce] = Math.max(this.act[q], tw);
      vars[r.vEmg] = clamp(e + r.shW * shiver, 0, 1);
      if (this.twOn[q] >= 0 || this.inBurst[q] || Math.abs(u - e) > eps || this.act[q] !== u) busy = true;
    }
    // Joints (§6.16): second-order low-pass toward k_j · (F_ag − F_ant), clamped at the cap.
    const w = 2 * Math.PI * P.jointHz, w2 = w * w, z2 = 2 * P.jointZeta * w;
    this.joints.forEach((J, ji) => J.sides.forEach((s, si) => {
      const vi = 2 * ji + si, tgt = this._jointTarget(J, s);
      let th = vars[s.v], v = this.jVel[vi];
      if (Math.abs(tgt - th) < 1e-6 && Math.abs(v) < 1e-6) { vars[s.v] = tgt; this.jVel[vi] = 0; return; }
      busy = true;
      v += h * (w2 * (tgt - th) - z2 * v); th += h * v;
      const cap = J.jd.cap;
      if (th > cap) { th = cap; v = Math.min(0, v); } else if (th < -cap) { th = -cap; v = Math.max(0, v); }
      vars[s.v] = th; this.jVel[vi] = v;
    }));
    this._aggregate();
    this._contact(t);
    return busy || this._moving;
  }

  _aggregate() {
    const vars = this.k.vars;
    for (const a of this.agg) {
      let e = 0, f = 0;
      for (const p of a.parts) { if (vars[p.vEmg] > e) e = vars[p.vEmg]; if (vars[p.vForce] > f) f = vars[p.vForce]; }
      vars[a.emg] = e; vars[a.force] = f;
    }
    for (const J of this.joints) {
      const a = vars[J.sides[0].v], b = vars[J.sides[1].v];
      vars[J.agg] = Math.abs(b) > Math.abs(a) ? b : a;
    }
  }

  // Contact break (§12.3): the fingertip has moved ≥ 5 mm (elbow and wrist rotation, small angles) [model].
  _contact(t) {
    const k = this.k, vars = k.vars, C = PARAMS.contact, rad = Math.PI / 180;
    let best = 0;
    for (let si = 0; si < 2; si++) {
      const vC = si === 0 ? this.v.contactR : this.v.contactL;
      const d = C.rElbow * Math.abs(vars[this.jElbow.sides[si].v]) * rad + C.rWrist * Math.abs(vars[this.jWrist.sides[si].v]) * rad;
      if (d > best) best = d;
      if (vars[vC] === 1 && d >= C.mm) {
        vars[vC] = 0; vars[si === 0 ? this.v.breakR : this.v.breakL] = t;
        k.log({ kind: 'contact', node: `palm${si === 0 ? '.R' : '.L'}`, label: 'Contact broken (fingertip moved 5 mm)' });
        k.dispatch('somatic.contactBroken', { side: si === 0 ? 'R' : 'L', tH: t, sites: C.sites });
      }
    }
    vars[this.v.fingertip] = best;
  }

  // --- CV layer: gains, breathing overlay, CPG drive ---
  cv(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS.resp;
    this.updateGains(false);
    const gS = k.g('somatic', t), ph = vars[this.r.respPhase], vt = Math.max(0, vars[this.r.vt]);
    const phi = ph - Math.floor(ph), fi = P.inspFrac;
    const insp = phi < fi ? Math.sin((Math.PI * phi) / fi) : 0;
    const vol = phi < fi ? 0.5 * (1 - Math.cos((Math.PI * phi) / fi)) : 0.5 * (1 + Math.cos((Math.PI * (phi - fi)) / (1 - fi)));
    const scale = (vt / P.vtRest) ** P.exponent;
    let gBreath = 0;
    for (const o of this.overlay) {
      let g = gS; for (const e of o.e) g *= k.edgeGate(e, t) > 0 ? 1 : 0;
      const amp = o.m.id === 'diaphragm' ? P.emgDiaphragm : P.emgIntercostal;
      vars[o.vEmg] = clamp(g * amp * insp * scale, 0, 1); vars[o.vForce] = vars[o.vEmg];
      if (o.m.id === 'diaphragm') gBreath = Math.max(gBreath, g);
    }
    vars[this.v.diaphragmExc] = gBreath * P.excursion * scale * vol;
    for (const a of this.agg) if (a.parts.some((p) => p.m.overlay)) {
      let e = 0, f = 0; for (const p of a.parts) { e = Math.max(e, vars[p.vEmg]); f = Math.max(f, vars[p.vForce]); }
      vars[a.emg] = e; vars[a.force] = f;
    }
    // Locomotor CPG (§6.13): half-centre drives only with a scenario `locomotor` input (0–1) [model].
    const loco = Number(k.input(t)?.locomotor ?? 0);
    const sw = Math.sin(2 * Math.PI * PARAMS.cpgHz * t);
    this.cpg.forEach(([jf, je], s) => {
      if (jf < 0 || je < 0) return;
      const ph2 = s === 0 ? sw : -sw;
      k.setExt(jf, loco > 0 ? PARAMS.w.cpg * loco * Math.max(0, ph2) : 0);
      k.setExt(je, loco > 0 ? PARAMS.w.cpg * loco * Math.max(0, -ph2) : 0);
    });
  }

  // --- EN layer: shivering (§6.13; onsets §7.10) ---
  en(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS;
    const err = vars[this.r.tSet] - P.shiverOnset - vars[this.r.tCore];
    const sh = k.g('somatic', t) * clamp(err / P.shiverSpan, 0, 1);
    if (sh === vars[this.v.shiver]) return;
    vars[this.v.shiver] = sh;
    this.mus.forEach((r, q) => { if (r.shW) vars[r.vEmg] = clamp(this.ring[q * RING + (vars[this.v.lastTick] & (RING - 1))] + r.shW * sh, 0, 1); });
    this._aggregate();
  }
}

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'somatic',
  scope: 'body',
  order: 20,
  fragment: buildFragment,
  create: (k) => new Somatic(k),
};
export { Somatic };
