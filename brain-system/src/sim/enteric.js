// @ts-check
// Enteric network plugin (research/ANALYSIS.md §8; §11.3, §11.6, §11.10–§11.13; A.3.4, A.4, A.5, A.6;
// B.7 uGut; B.15 phase 7). The gut model of §8.15: an analytic slow-wave field, gated contractions with
// the peristaltic reflex kernels on a 250-cell grid, sphincters, the MMC scheduler, lumped gastric
// emptying and small-intestinal and colonic transit, enteroendocrine hormones, vagal and spinal
// afferents onto the brain ports, satiety and hunger. Plugin contract: graph.js header.
//
//   grid       s = in-vivo arc length (cm) from the upper oesophageal sphincter, 2-cm cells, N = 250 (§8.2)
//   phase      swPhase[i] = 2π f(s_i)(tH − λ(s_i)) mod 2π; colon: 3 cpm plus a seeded per-patch OU offset (§8.4)
//   gutX       b + g_e·[E_asc + V + Mo + H5] − [I_desc + I0] − k_S·S + P_mmc               (§8.5)
//   gate       C* = clamp01(gutX)·max(0, (cos φ − 0.3)/0.7)²; gutC = first-order filter (τ 1 s up, 3 s down)
//   sphincter  tone = clamp01(0.7 + 0.3·S − relax·g.enteric)                                 (§8.7)
//   stomach    dF_solid = −k1·F_solid; dF_fine = k1·F_solid − k2·F_fine; liquid −(ln 2/t½)·V·G   (§8.8, §8.15)
//   small      ∂n/∂t = −v ∂n/∂s + D ∂²n/∂s² − n/τ_abs (s 55–345), upwind on the cells, 1-s sub-step
//   colon      three tanks, d c_k/dt = in_k − κ_k·c_k/τ_c; HAPCs as seeded Poisson events
//   hormone    X ← relax(X, X_b + g.neuroendocrine·ΔX, τ_X) (§11.13 basal replacement); ℓ_X local, τ 1 min
//   satiety    1 − exp(−[0.6·Δm + 0.5·Δc + 0.8·Δh]), τ 2 min; hunger clamp01(0.3 + …), τ 5 min  (§8.14)
//
// Cross-network values are read only through k.ref with their A.5 rest or basal value as fallback,
// so the module runs alone with the brain: tone.fVagGut 0.20, tone.fSymGut 0.10, tone.fSacral 0.02
// (§7.6 rest tones), adrenalineRel 1, sickness.anorexia 0, arousalState 1 (wakeRelaxed). The module
// writes only the A.3.4 gut variables it declares and its own `ens.*` internals.
// Layers (A.4, §8.15): slow-wave phase analytic; gutX, gutC, sphincters, MMC and afferents on GI
// (100 ms); transit on the 1-s sub-step inside GI; hormones, satiety and hunger on EN (1 s).

import { sToDraw, gutAt, pathById, SITES } from '../body/geometry.js';

const TAU = 2 * Math.PI;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const hill2 = (x) => (x <= 0 ? 0 : (x * x) / (x * x + 1));

export const PARAMS = {
  // --- Grid and regions (§8.2) ---
  ds: 2,                     // cm; cell width of the two highest tiers (N = 250), used for every tier so traces are tier-independent [model]
  length: 500,               // cm; model gut length (s at the anal verge) [model]
  // [id, s0, s1] in cm (§8.2 table); the ileocaecal valve is one 2-cm cell at s 345 [model]
  regions: /** @type {[string, number, number][]} */ ([['gut.oes', 0, 21], ['gut.les', 21, 25], ['gut.fundus', 25, 33], ['gut.corpus', 33, 45], ['gut.antrum', 45, 53],
    ['gut.pylorus', 53, 55], ['gut.duod', 55, 80], ['gut.jej', 80, 185], ['gut.ileum', 185, 345], ['gut.icv', 345, 347],
    ['gut.caecum', 347, 351], ['gut.colAsc', 351, 369], ['gut.colTrans', 369, 414], ['gut.colDesc', 414, 439],
    ['gut.sigmoid', 439, 482], ['gut.rectum', 482, 496], ['gut.ias', 496, 498], ['gut.eas', 498, 500]]),
  cannonBohm: 399,           // cm; vagal territory ends, sacral begins (§8.2)
  sacralFull: 414,           // cm; w_sac ramps 0 → 1 over 399–414 (§8.5)

  // --- Slow waves (§8.4) ---
  sw: {
    gastricCpm: 2.83,        // O'Grady et al. 2010
    pacemakerS: 36,          // cm
    // phase velocity (cm/s) by stomach zone: pacemaker 8.0, corpus 3.0, antrum 5.7 mm/s (O'Grady et al. 2010);
    // pacemaker zone 33–38 cm [model] so the wave takes ≈ 43 s to the pylorus (§8.4 model check ≈ 44 s)
    stomachV: [[33, 38, 0.80], [38, 45, 0.30], [45, 55, 0.57]],
    // small-intestinal plateaus [s0, s1, cpm] (§8.4 model plateaus 1–6)
    plateaus: [[55, 100, 11.7], [100, 150, 11.0], [150, 200, 10.3], [200, 260, 9.5], [260, 310, 8.8], [310, 345, 8.2]],
    siV: 0.9,                // cm/s (Angeli et al. 2018)
    colonCpm: 3.0,           // §8.4 model 3.0
    colonPatch: 8,           // cm; coherence patch [model]
    colonSigma: 0.5,         // rad; random-walk σ [model]
    colonTau: 300,           // s; τ 5 min [model]
    gateThr: 0.3,            // gate threshold on cos φ (§8.5) [model]
  },

  // --- Contraction and reflex kernels (§8.5) ---
  tauRise: 1, tauFall: 3,    // s, contraction filter [model]
  nAsc: 1, nDesc: 2,         // cells (2 cm, 4 cm) of ascending excitation and descending inhibition (Furness 2006)
  kAsc: 0.8, kDesc: 0.4,     // kernel gains [model]
  i0: 0.3,                   // tonic inhibition I0_base [model]
  relaxCmd: 0.6,             // sphincter relaxation command [model]
  base: { off: 0.15, phase1: 0.05, phase2Rand: 0.3, fed: 0.35 },   // b(s, mode) (§8.5) [model]; phase II = phase I + 0.3·patch
  mmcDrive: 0.8,             // P_mmc inside the phase III band [model]
  kV: 0.2,                   // gain of the extrinsic term V in gutX [model]
  kS: 0.2,                   // k_S, sympathetic subtraction [model]
  symExcite: 0.6,            // excitability × (1 − 0.6·S) (§8.5)
  symSphincter: 0.3,         // sphincter tone + 0.3·S (§8.5, §8.7)
  kMo: 0.1,                  // motilin drive per unit (motilin − 1), stomach and duodenum [model]
  k5ht: 0.2,                 // H5: EC 5-HT drive per unit (ec5ht − 1) [model]
  adrBeta2: 0.05,            // excitability × (1 − 0.05·(adrenalineRel − 1)), small β2 inhibition (§8.15) [model]
  tachykininShare: 0.4,      // atropine-resistant excitation (§8.5) [model]
  // w_vag by s range [s0, s1, w] (§8.5); w_sac 0 before 399, ramp to 1 at 414
  wVag: [[21, 55, 1.0], [55, 80, 0.6], [80, 185, 0.3], [185, 399, 0.15]],
  patchCm: 8,                // cm; correlation length of the fed segmenting pattern (§8.5)
  patchEvery: 10,            // s; the random pattern is redrawn every 10 s [model]
  ipan: { theta: 0.5, kappa: 0.1, v50Gastric: 300, fundus: 0.5, n50SI: 2, colon50: 6, rectal50: 40 },   // §4 sigmoid of local stretch [model]

  // --- MMC and fed pattern (§8.6) ---
  mmc: {
    median: 110 * 60, sigma: 0.3, min: 80 * 60, max: 230 * 60,   // s; lognormal period, clipped
    phase3: 6.99 * 60,       // s (Baker et al. 2019)
    phase1Share: 0.55,       // phase I : II = 0.55 : 0.45 of the rest of the cycle [model]
    antralP: 0.48,           // antral origin 0.48·g.ne·(0.3 + 0.7·g.aut)
    couple: 0.5,             // gastric and small-intestinal clocks shared while g.autonomic ≥ 0.5
    motilinLead: 600,        // s; motilin pulse ≈ 10 min before antral phase III [model]
    frontA: 4.5, frontL: 200, frontB: 0.8,   // front velocity 4.5·e^(−s_SI/200) + 0.8 cm/min
    widthL: 290,             // band width × (1 + s_SI/290)
    stomachFrontV: 5.3,      // cm/min; antral fronts use the pyloric value [model]
  },
  fedRule: { base: 120, perKcal: 0.25, max: 480, gastricKcal: 15, siKcal: 40 },   // min(120 + 0.25·E₀, 480) min, held while nutrient remains

  // --- Oesophagus, swallowing and sphincters (§8.7) ---
  swallow: { interval: 25, v: 3.5, band: 2, striatedS: 7, lesOnset: 2, lesDur: 8 },   // s, cm/s, cm; interval 15–40 s [T], 25 [model]
  sphT0: 0.7,                // resting tone T0_sph [model]
  tlesr: { volume: 300, perHour: 4, dur: 20 },   // mL trigger [model]; 2–6 per h; > 10 s [model 20]
  pylRelaxC: 0.3,            // antral gutC that opens the pylorus fully [model]
  icvKcal: 1,                // kcal in the last 10 cm of ileum that opens the ileocaecal valve [model]

  // --- Gastric emptying, transit and colon (§8.8, §8.15) ---
  gastric: {
    kTrit: 40, kEmpty: 12,   // min: k1 = A/40, k2 = A·G/12 (min⁻¹)
    rSetLiquid: 2.0, rSetK: 1.2, rSetRef: 255, rSetMax: 2.0,   // kcal/min
    rTau: 180,               // s; r̃ low-pass (τ 3 min)
    gPylOn: 1, gPylOff: 0.05,
    brake: { ne: 0.5, aut: 0.3, ent: 0.2 },
    // brakeGain × B: a departure from the §8.8 brake (B = 0.5·g.ne + 0.3·g.aut + 0.2·g.ent ≤ 1). With B
    // as written the 600-kcal meal empties at ≈ 2.9 kcal/min, against the §8.13 model output "linear
    // emptyRate (r_set at 600 kcal) ≈ 1.8" (r_set = 1.84); the two §8 statements disagree, so §8 has to
    // decide. ×16 keeps the switch weights of B and reproduces §8.13 (≈ 1.8 kcal/min at 1 h) [model].
    brakeGain: 16,
    waterHalf: 15, waterHalfNoAcc: 8,   // min
    mlPerKcal: 1.2,
    basalVolume: 50,         // mL; fasting gastric contents [model]
    discomfort: 700,         // mL; §5.11 discomfort ≈ 600–800 [model 700]
  },
  si: {
    s0: 55, s1: 345, vFed: 1.25, vFast: 0.25, D: 1.0,   // cm/min, cm²/min
    tauAbs: 45 * 60,         // s
    ilealBrake: 0.35, ilealS: 185, distalKcal: 1,
    residueFrac: 0.05,       // non-absorbable residue carried with each emptied kcal [model]
    iCellL: 5,               // cm; I-cell exposure weight e^(−(s − 55)/5 cm) [model]
    lCellS: 260,             // cm; L cells 260–482 (§8.10)
  },
  colon: {
    tauC: 11 * 3600,         // s (Metcalf et al. 1987)
    kappaBase: 0.6, kappaNerve: 0.4, kappaFloor: 0.05, kappaRest: 1,
    perKcal: 1 / 600,        // relative colonic content per kcal of ileal efflux [model]
    rightEnd: 399, leftEnd: 439,
  },
  hapc: { perDay: 6, waking: 2, gastrocolonic: 2, move: 0.5 },
  gastrocolonic: { gain: 0.5, dur: 3 * 3600, extrinsic: 0.3 },   // excitability + 0.5 for 2.5–3.5 h [model 3 h] × (0.3 + 0.7·g.aut)
  wakingDur: 3600,           // s; waking pulse 60 min after wakeAlert

  // --- Afferents (§8.9, §8.17) ---
  afferent: {
    rmax: 100,               // Hz; node rmax of Aδ / C afferent populations (Table 4.8b)
    // Hz; ceiling of the §4 receptor sigmoid [model]. Kept below rest + 0.1·rmax (the kernel's elevated and
    // packet thresholds, §11.6, §11.8), so a meal's hours of sustained afferent drive let the NF layer stride;
    // display packets are emitted by this module on rises (lead packets, below).
    rSat: 11.5,
    rRest: 2,                // Hz; vagMech and vagChem at fasting rest (§8.17)
    leadStep: 2,             // Hz; a rise of the drive by this much above the last emitted level emits a lead packet [model]
    antralC: 0.3,            // + 0.3 × antral gutC
    chemZ50: 2,              // half-activation of the vagChem drive [model]
    rectalThr: 120,          // mL; colorectal spinal threshold (§5.11 desire 60–150, maximum 150–300) [model]
    quantum: 0.5,            // Hz; NF drive steps (the NF graph wakes only on changes ≥ one step) [model]
    w: 1,                    // drive per unit activation at the port [model]
  },

  // --- Enteroendocrine hormones (§8.10, §8.13) ---
  // basal; half-life (s) or τ (s); `ne`: plasma pool (basal replacement with neuroendocrine off)
  hormones: {
    cck: { basal: 1.0, half: 3 * 60, ne: true, unit: 'pM' },        // 1.0 pM (Liddle et al. 1985); t½ 2–5 min [model 3]
    glp1: { basal: 7.5, half: 1.5 * 60, ne: true, unit: 'pM' },     // 5–10 pM; t½ 1–2 min
    pyy: { basal: 20, half: 8 * 60, ne: true, unit: 'pM' },         // 15–25 pM; t½ [model]
    ghrelin: { basal: 1, half: 10 * 60, ne: true, unit: 'rel' },    // t½ ≈ 10 min
    motilin: { basal: 1, half: 5 * 60, ne: true, unit: 'rel' },     // [model]
    gastrin: { basal: 1, half: 5 * 60, ne: true, unit: 'rel' },     // [model]
    insulin: { basal: 1, tau: 5 * 60, ne: true, unit: 'rel' },      // τ 5 min (§8.13 cephalic row)
    ec5ht: { basal: 1, tau: 60, ne: false, unit: 'rel' },           // paracrine (tissue) [model τ]
  },
  // steady-state increments [model], calibrated to the §12 meal: CCK ≈ 6 pM, PYY 2×, insulin peak ×7
  release: {
    cckPerI: 0.55,           // pM per kcal of I-cell exposure (plateau ≈ 6 pM, Liddle et al. 1985)
    glp1PerI: 2.0, glp1PerL: 0.5,
    pyyPerI: 3.0, pyyPerL: 1.0,
    ghrelinDepth: 0.5, ghrelinAbs: 1.0,   // −50 % at ≥ 1 kcal/min absorbed (depth −40 to −60 %)
    motilin: 1.5,
    gastrin: 1.5, gastrinVolume: 600,
    insulinPerAbs: 2.6, insulinPerGlp1: 0.3,
    ec5htStretch: 0.5, ec5htPerI: 0.02,
    absTau: 1800,            // s; absorption low-pass for ghrelin [model]
    localTau: 60,            // s; ℓ_X (§8.10)
  },
  cephalic: { request: 0.3, hold: 300, rise: 120, gastrin: 0.3 },   // + 0.3 for the cue plus 5 min, rise 2 min (§8.13)
  satiety: { wm: 0.6, wc: 0.5, wh: 0.8, tau: 120, cckPeak: 6, glp1Peak: 30, pyyPeak: 50 },
  hunger: { base: 0.3, ghrelin: 0.4, satiety: 0.8, tau: 300 },
  brainOnly: { satiety: 0, hunger: 0.3 },   // §8.16
  microbiota: 'eubiotic',    // setting (§8.12): eubiotic | germFreeLike (EC 5-HT synthesis × 0.5) | dysbiotic
  restTones: { vagGut: 0.20, symGut: 0.10, sacral: 0.02 },   // §7.6 rest tones, the v_n and q_n references
  quietIpan: 0.05,           // GI striding threshold (§8.15)
};

// --- Static tables ---
const N = Math.round(PARAMS.length / PARAMS.ds);
const ROLE = { oes: 0, sph: 1, fundus: 2, stomach: 3, si: 4, colon: 5, eas: 6 };
const roleOf = (id) => (id === 'gut.oes' ? ROLE.oes : ['gut.les', 'gut.pylorus', 'gut.icv', 'gut.ias'].includes(id) ? ROLE.sph
  : id === 'gut.fundus' ? ROLE.fundus : ['gut.corpus', 'gut.antrum'].includes(id) ? ROLE.stomach
    : ['gut.duod', 'gut.jej', 'gut.ileum'].includes(id) ? ROLE.si : id === 'gut.eas' ? ROLE.eas : ROLE.colon);
const SPH = ['gut.les', 'gut.pylorus', 'gut.icv', 'gut.ias'];
const SPH_IDX = { les: 0, pyl: 1, icv: 2, ias: 3 };
const N_PATCH = Math.ceil(PARAMS.length / PARAMS.patchCm);
const N_COLPATCH = Math.ceil((PARAMS.length - 345) / PARAMS.sw.colonPatch);

function cellTable() {
  const P = PARAMS, ds = P.ds;
  const s = new Float64Array(N), region = new Int16Array(N), role = new Int8Array(N), f = new Float64Array(N), lam = new Float64Array(N);
  const sw = new Uint8Array(N), colPatch = new Int16Array(N).fill(-1), patch = new Int16Array(N), tank = new Int8Array(N).fill(-1);
  const wVag = new Float64Array(N), wSac = new Float64Array(N);
  const stomachLam = (x) => {   // |∫ from the pacemaker to x of ds′/c(s′)|
    const a = Math.min(x, P.sw.pacemakerS), b = Math.max(x, P.sw.pacemakerS);
    let T = 0;
    for (const [z0, z1, c] of P.sw.stomachV) { const lo = Math.max(a, z0), hi = Math.min(b, z1); if (hi > lo) T += (hi - lo) / c; }
    return T;
  };
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * ds;
    s[i] = x;
    const ri = P.regions.findIndex(([, a, b]) => x >= a && x < b);
    region[i] = ri; role[i] = roleOf(P.regions[ri][0]);
    patch[i] = Math.floor(x / P.patchCm);
    if (x >= 33 && x < 55) { sw[i] = 1; f[i] = P.sw.gastricCpm / 60; lam[i] = stomachLam(x); }
    else if (x >= 55 && x < 345) {
      const pl = P.sw.plateaus.find(([a, b]) => x >= a && x < b);
      sw[i] = 1; f[i] = pl[2] / 60; lam[i] = (x - pl[0]) / P.sw.siV;
    } else if (x >= 345 && x < 498) { sw[i] = 1; f[i] = P.sw.colonCpm / 60; lam[i] = 0; colPatch[i] = Math.floor((x - 345) / P.sw.colonPatch); }
    for (const [a, b, w] of P.wVag) if (x >= a && x < b) wVag[i] = w;
    wSac[i] = x < P.cannonBohm ? 0 : x >= P.sacralFull ? 1 : (x - P.cannonBohm) / (P.sacralFull - P.cannonBohm);
    if (x >= 345 && x < 496) tank[i] = x < P.colon.rightEnd ? 0 : x < P.colon.leftEnd ? 1 : 2;
  }
  const cellsOf = (id) => { const ri = P.regions.findIndex((r) => r[0] === id); const out = []; for (let i = 0; i < N; i++) if (region[i] === ri) out.push(i); return out; };
  return { s, region, role, f, lam, sw, colPatch, patch, tank, wVag, wSac, cellsOf };
}
const CELLS = cellTable();
const SI0 = Math.floor(PARAMS.si.s0 / PARAMS.ds), SI1 = Math.floor(PARAMS.si.s1 / PARAMS.ds) - 1;   // cells 27…171 (s 55–345)
const STOMACH_CELLS = [...CELLS.cellsOf('gut.fundus'), ...CELLS.cellsOf('gut.corpus'), ...CELLS.cellsOf('gut.antrum')];
const ANTRUM = CELLS.cellsOf('gut.antrum');
const SPH_CELLS = SPH.map((id) => CELLS.cellsOf(id));
const RECTUM = CELLS.cellsOf('gut.rectum');
const DUOD = CELLS.cellsOf('gut.duod');

/** Gut cell layout for the renderer (B.7 uGut): N cells of 2 cm, s at cell centres (cm), region ids. */
export const GUT_CELLS = Object.freeze({ n: N, ds: PARAMS.ds, s: CELLS.s, region: CELLS.region, regions: PARAMS.regions.map((r) => r[0]) });

// ---------------------------------------------------------------------------------------------
// Fragment (§8.2, §8.3, §8.9, §8.10, §8.14; A.3.3 ids)
// ---------------------------------------------------------------------------------------------
const posAt = (s) => /** @type {[number, number, number]} */ (gutAt(sToDraw(s) * 10).p.map((v) => +v.toFixed(2)));
const sitePos = (id) => { const st = SITES.find((x) => x.id === id); return /** @type {[number, number, number]} */ ([...st.pos]); };
const mirrorX = (p) => /** @type {[number, number, number]} */ ([-p[0], p[1], p[2]]);
const ROUTE_POINTS = (id) => /** @type {[number, number, number][]} */ ((pathById(id)?.pts ?? []).map((p) => [p[0], p[1], p[2]]));

// Interventions whose gut wiring this module cuts (classified at init).
const SUBMUCOSAL_FROM = 55;
/** @type {[string, number, string][]} */
const EEC = [
  ['ecCells', 120, 'enterochromaffin cells (5-HT), whole mucosa'], ['iCells', 120, 'I cells (CCK), s 55–185'],
  ['lCells', 371, 'L cells (GLP-1, PYY), s 260–482'], ['xaCells', 35, 'X/A cells (ghrelin), s 25–45'],
  ['mCells', 67, 'M cells (motilin), s 55–80'], ['gCells', 49, 'G cells (gastrin), s 45–53'],
];

/** @param {import('./contracts').FragmentContext} ctx */
function fragment(ctx) {
  const P = PARAMS;
  /** @type {import('./contracts').NodeSpec[]} */
  const nodes = [];
  /** @type {import('./contracts').EdgeSpec[]} */
  const edges = [];
  /** @type {Record<string, import('./contracts').Vec3[]>} */
  const paths = {};
  const port = (id, side) => (side && ctx.has(`${id}.${side}`) ? `${id}.${side}` : ctx.has(id) ? id : null);

  // Gut regions (tissue: smooth muscle, ICC) and their plexuses (ens.*). The striated oesophagus and the
  // external anal sphincter are somatic targets, so another module may declare them first (shared).
  for (const [id, s0, s1] of P.regions) {
    const pos = posAt(0.5 * (s0 + s1));
    nodes.push({ id, kind: 'organ', owner: 'tissue', layer: 'GI', pos, label: id.slice(4), ...(id === 'gut.oes' || id === 'gut.eas' ? { shared: true } : {}) });
    if (id === 'gut.eas') continue;
    nodes.push({ id: `${id}.myenteric`, kind: 'ganglion', owner: 'ens.myenteric', layer: 'GI', pos, label: `${id.slice(4)} myenteric plexus` });
    if (s0 >= SUBMUCOSAL_FROM && id !== 'gut.ias') nodes.push({ id: `${id}.submucosal`, kind: 'ganglion', owner: 'ens.submucosal', layer: 'GI', pos, label: `${id.slice(4)} submucosal plexus` });
  }
  for (const [id, s, label] of EEC) nodes.push({ id, kind: 'gland', owner: 'tissue', layer: 'EN', pos: posAt(s), label });

  // Visceral afferent populations (ans.vaff, NF 'direct' nodes driven by this module: §8.17 rates).
  const A = P.afferent;
  const rec = (id, site, cls, rSpont, label) => nodes.push({ id, kind: 'receptor', owner: 'ans.vaff', pos: sitePos(site), site, cls,
    xfer: 'direct', tau: 0.0005, rmax: A.rmax, rSpont, label, shared: true });
  rec('rec.stomachWall.vagMech', 'stomachWall', 'vagMech', A.rRest, 'gastric vagal mechanoreceptors (IGLE, IMA)');
  rec('rec.duodenum.vagChem', 'duodenum', 'vagChem', A.rRest, 'duodenal vagal mucosal chemoreceptors');
  rec('rec.stomachWall.spinNoci', 'stomachWall', 'spinNoci', 0, 'gastric spinal visceral afferents (T6–T9)');
  rec('rec.colonRectum.spinNoci', 'colonRectum', 'spinNoci', 0, 'colorectal spinal visceral afferents (S2–S4, L1–L2)');

  // Routes (mm, CNS end first, A.2): vagal trunks from the §2.12 routes; spinal routes [model] polylines.
  const vagL = ROUTE_POINTS('cn10.L'), vagR = ROUTE_POINTS('cn10.duodenum.R');
  if (vagL.length > 1) paths['ens.vagus.L'] = vagL;
  if (vagR.length > 1) paths['ens.vagus.R'] = vagR;
  const splR = ROUTE_POINTS('splanchnicGreater.R');
  const stomach = sitePos('stomachWall'), rectum = sitePos('colonRectum');
  for (const side of ['R', 'L']) {
    const pS = port('portSpinoVisc', side), m = side === 'L' ? mirrorX : (p) => p;
    if (!pS) continue;
    const top = ctx.pos(pS);
    paths[`ens.splanchnic.${side}`] = [top, m([3, -55, -339]), ...splR.map(m), stomach];
    paths[`ens.pelvic.${side}`] = [top, m([3, -60, -480]), m([26, -84, -701]), m([35, -20, -760]), rectum];
  }

  const E = (spec) => edges.push(spec);
  const visc = port('portVisc', 'L'), viscR = port('portVisc', 'R');
  if (visc) E({ from: 'rec.stomachWall.vagMech', to: visc, kind: 'axon', fibre: 'C', nets: ['autonomic'], w: A.w, transmitter: 'Glu',
    ...(paths['ens.vagus.L'] ? { path: 'ens.vagus.L' } : {}), label: 'gastric vagal afferents (cn10.aff, nodose)' });
  if (viscR) E({ from: 'rec.duodenum.vagChem', to: viscR, kind: 'axon', fibre: 'C', nets: ['autonomic'], w: A.w, transmitter: 'Glu',
    ...(paths['ens.vagus.R'] ? { path: 'ens.vagus.R' } : {}), label: 'duodenal vagal afferents (cn10.aff, nodose)' });
  for (const side of ['R', 'L']) {
    const pS = port('portSpinoVisc', side);
    if (!pS) continue;
    E({ from: 'rec.stomachWall.spinNoci', to: pS, kind: 'axon', fibre: 'Adelta', nets: ['autonomic'], w: 0.5 * A.w, path: `ens.splanchnic.${side}`, transmitter: 'Glu', label: 'splanchnic visceral afferents' });
    E({ from: 'rec.colonRectum.spinNoci', to: pS, kind: 'axon', fibre: 'Adelta', nets: ['autonomic'], w: 0.5 * A.w, path: `ens.pelvic.${side}`, transmitter: 'Glu', label: 'pelvic visceral afferents' });
  }

  // Extrinsic motor (§8.9): vagal (s 21–399) and sacral (s 399–500) preganglionics end on myenteric
  // neurons, so they need autonomic ∧ enteric (A.5, §11.11). Drive is read from the §7 tones.
  const vagEff = { L: ['gut.les', 'gut.fundus', 'gut.corpus', 'gut.antrum', 'gut.pylorus'],
    R: ['gut.duod', 'gut.jej', 'gut.ileum', 'gut.icv', 'gut.caecum', 'gut.colAsc', 'gut.colTrans'] };
  for (const side of /** @type {('L' | 'R')[]} */ (['L', 'R'])) {
    const pv = port('portVag', side);
    if (!pv) continue;
    for (const r of vagEff[side]) {
      const [, s0, s1] = P.regions.find((x) => x[0] === r);
      const w = (P.wVag.find(([a, b]) => 0.5 * (s0 + s1) >= a && 0.5 * (s0 + s1) < b) ?? [0, 0, 0.15])[2];
      E({ from: pv, to: `${r}.myenteric`, kind: 'axon', fibre: 'B', nets: ['autonomic', 'enteric'], w, transmitter: 'ACh',
        ...(paths[`ens.vagus.${side}`] ? { path: `ens.vagus.${side}` } : {}), label: 'vagal motor to the myenteric plexus' });
    }
  }
  for (const side of ['R', 'L']) {
    const ps = port('portSacral', side);
    if (!ps) continue;
    for (const r of ['gut.colTrans', 'gut.colDesc', 'gut.sigmoid', 'gut.rectum', 'gut.ias']) {
      E({ from: ps, to: `${r}.myenteric`, kind: 'axon', fibre: 'B', nets: ['autonomic', 'enteric'], w: r === 'gut.colTrans' ? 0.25 : 0.5,
        transmitter: 'ACh', ...(paths[`ens.pelvic.${side}`] ? { path: `ens.pelvic.${side}` } : {}), label: 'sacral motor (pelvic splanchnic, inferior hypogastric)' });
    }
  }
  // Sympathetic postganglionics and intestinofugal neurons, when the autonomic fragment declared the
  // prevertebral ganglia (§8.9): α2 on enteric neurons (autonomic ∧ enteric), α1 on sphincters (autonomic).
  const gang = (id) => [id, `${id}.R`, `${id}.L`].filter((x) => ctx.has(x));
  const symp = [['coeliac', ['gut.corpus', 'gut.antrum', 'gut.duod'], ['gut.les', 'gut.pylorus']],
    ['smg', ['gut.jej', 'gut.ileum', 'gut.caecum', 'gut.colAsc', 'gut.colTrans'], ['gut.icv']],
    ['img', ['gut.colDesc', 'gut.sigmoid', 'gut.rectum'], ['gut.ias']]];
  for (const [g, plex, sph] of /** @type {[string, string[], string[]][]} */ (symp)) for (const gid of gang(g)) {
    for (const r of plex) E({ from: gid, to: `${r}.myenteric`, kind: 'axon', fibre: 'Cpost', nets: ['autonomic', 'enteric'], w: -0.6, transmitter: 'NA', label: 'sympathetic α2 (presynaptic) inhibition' });
    for (const r of sph) E({ from: gid, to: r, kind: 'axon', fibre: 'Cpost', nets: ['autonomic'], w: 0.3, transmitter: 'NA', label: 'sympathetic α1 sphincter contraction' });
  }
  for (const [r, g] of [['gut.duod', 'coeliac'], ['gut.jej', 'smg'], ['gut.colDesc', 'img']]) for (const gid of gang(g)) {
    E({ from: `${r}.myenteric`, to: gid, kind: 'axon', fibre: 'C', nets: ['enteric', 'autonomic'], w: 0.3, transmitter: 'ACh', label: 'intestinofugal (intestino-intestinal reflex)' });
  }

  // Intrinsic circuits (§8.3, §8.5): descending plexus chain, motor and secretomotor output.
  const plex = P.regions.filter(([id]) => id !== 'gut.eas').map(([id]) => id);
  for (let q = 0; q + 1 < plex.length; q++) E({ from: `${plex[q]}.myenteric`, to: `${plex[q + 1]}.myenteric`, kind: 'axon', fibre: 'C', nets: ['enteric'], w: 1, transmitter: 'ACh/NO', label: 'myenteric interneurons (descending)' });
  for (const id of plex) {
    E({ from: `${id}.myenteric`, to: id, kind: 'axon', fibre: 'C', nets: ['enteric'], w: 1, transmitter: 'ACh/NO/VIP', label: 'enteric motor neurons' });
    const [, s0] = P.regions.find((x) => x[0] === id);
    if (s0 >= SUBMUCOSAL_FROM && id !== 'gut.ias') E({ from: `${id}.submucosal`, to: id, kind: 'axon', fibre: 'C', nets: ['enteric'], w: 1, transmitter: 'ACh/VIP', label: 'secretomotor neurons' });
  }
  // Paracrine (tissue) and humoral (ne.gut distant action) routes (§8.10, §8.11, §8.14).
  E({ from: 'ecCells', to: 'gut.jej.myenteric', kind: 'volume', w: 1, transmitter: '5-HT', label: 'mucosal 5-HT on IPAN terminals' });
  E({ from: 'ecCells', to: 'rec.duodenum.vagChem', kind: 'volume', w: 1, transmitter: '5-HT', label: '5-HT3 on vagal endings' });
  E({ from: 'iCells', to: 'rec.duodenum.vagChem', kind: 'volume', w: 1, transmitter: 'CCK', label: 'local CCK on vagal endings (CCK1)' });
  const cvo = port('portCVO', null);
  for (const [from, tx] of [['iCells', 'CCK'], ['lCells', 'GLP-1/PYY'], ['xaCells', 'ghrelin']]) {
    if (cvo) E({ from, to: cvo, kind: 'blood', nets: ['neuroendocrine'], w: 1, transmitter: tx, label: `${tx} to the area postrema and arcuate` });
  }
  E({ from: 'iCells', to: 'gut.pylorus', kind: 'blood', nets: ['neuroendocrine'], w: 1, transmitter: 'CCK', label: 'pyloric brake' });
  E({ from: 'lCells', to: 'gut.ileum', kind: 'blood', nets: ['neuroendocrine'], w: 1, transmitter: 'GLP-1/PYY', label: 'ileal brake' });
  E({ from: 'mCells', to: 'gut.antrum', kind: 'blood', nets: ['neuroendocrine'], w: 1, transmitter: 'motilin', label: 'gastric phase III' });
  E({ from: 'gCells', to: 'gut.corpus', kind: 'blood', nets: ['neuroendocrine'], w: 1, transmitter: 'gastrin', label: 'gastrin' });
  return { nodes, edges, paths };
}

// ---------------------------------------------------------------------------------------------
// Interventions (§8.16) as data
// ---------------------------------------------------------------------------------------------
// Gut factors: vagProx / vagDist (vagal motor to the fundus and corpus / to the antrum and beyond),
// vagAff (vagal afferents), excite (enteric excitation), colonKappa, gastrocolonic, sacral (sacral
// motor), spinGastric / spinColorectal (spinal visceral afferents), lesRelax, icc (slow-wave
// amplitude), aganglionicFrom (s, cm: no enteric neurons aboral of it).
export const FX_DEFAULTS = Object.freeze({ vagProx: 1, vagDist: 1, vagAff: 1, excite: 1, colonKappa: 1, gastrocolonic: 1, sacral: 1,
  spinGastric: 1, spinColorectal: 1, lesRelax: 1, icc: 1, aganglionicFrom: 1e9 });

/** Gut effects of interventions owned by other sections (§8.16 table), keyed by preset id. A preset
 *  may also carry `params.gut` with any FX_DEFAULTS key, which overrides the entry. */
export const GUT_EFFECTS = Object.freeze({
  truncalVagotomy: { vagProx: 0, vagDist: 0, vagAff: 0 },            // §7: A halved, faster water emptying, no TLESR, cephalic phase or CCK satiety
  vagotomy: { vagProx: 0, vagDist: 0, vagAff: 0 },
  highlySelectiveVagotomy: { vagProx: 0 },                           // spares the antrum and pylorus
  atropine: { excite: PARAMS.tachykininShare },                      // excitation × 0.4 (tachykinergic share)
  sympathectomy: {}, sympathectomyT2T3: {},                          // gut outflow is T5–L2: no gut effect
  pureAutonomicFailure: { colonKappa: 0.7 },                         // sympathetic gut drive per the §7 preset
  /** Spinal cord injury by level (§6): C2–T6 no spinal visceral input from below, gastrocolonic 0.3; T10, L2 partial; S2 sacral loss. */
  sci: (p) => {
    const lv = String(p?.level ?? 'T6');
    const n = { C: 0, T: 8, L: 20, S: 25 }[lv[0]] + Number(lv.slice(1));
    if (n <= 14) return { spinGastric: 0, spinColorectal: 0, gastrocolonic: 0.3, colonKappa: 0.8 };   // C2–T6 [model κ]
    if (n <= 22) return { spinColorectal: 0.5, gastrocolonic: 0.65 };   // T10, L2: partial splanchnic loss [model]
    return { sacral: 0, spinColorectal: 0.5 };                          // S2: sacral and EAS loss, RAIR kept
  },
  spinalCordInjury: (p) => /** @type {any} */ (GUT_EFFECTS).sci(p),
  /** Dorsal rhizotomy (§6): spinal visceral afferents lost at the cut roots. */
  rhizotomy: (p) => {
    const segs = new Set(p?.segments ?? []);
    const any = (list) => list.some((x) => segs.has(x));
    return { spinGastric: any(['T6', 'T7', 'T8', 'T9']) ? 0 : 1, spinColorectal: any(['S2', 'S3', 'S4', 'L1', 'L2']) ? 0 : 1 };
  },
  dorsalRhizotomy: (p) => /** @type {any} */ (GUT_EFFECTS).rhizotomy(p),
  hirschsprung: (p) => ({ aganglionicFrom: Number(p?.arrestS ?? 439) }),
  achalasia: { lesRelax: 0 },
  pseudoObstruction: { icc: 0 },
});

/** Clinical analogues of enteric off (§8.16), as InterventionPreset data owned by this module. */
/** @type {import('./contracts').InterventionPreset[]} */
export const INTERVENTIONS = [
  // apply() is empty: the module's 'intervention' handler applies GUT_EFFECTS[id] after the kernel reset the cuts.
  { id: 'hirschsprung', label: 'Hirschsprung disease (aganglionic rectosigmoid)', net: 'enteric', params: { arrestS: 439 }, apply() {} },
  { id: 'achalasia', label: 'Achalasia (LES does not relax)', net: 'enteric', params: {}, apply() {} },
  { id: 'pseudoObstruction', label: 'Intestinal pseudo-obstruction (ICC loss)', net: 'enteric', params: {}, apply() {} },
];

// ---------------------------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------------------------
const H_IDS = Object.keys(PARAMS.hormones);
const TIME_VARS = ['mmcT0', 'siT0', 'fedT0', 'tLast', 'lastSwallow', 'eatStart', 'tlesrUntil', 'cephUntil', 'balGEnd', 'balREnd', 'lipStart', 'lipEnd', 'wakeUntil', 'tPatch', 'mealT0'];

class Enteric {
  /** @param {import('./contracts').KernelApi} k */
  constructor(k) {
    this.k = k;
    const P = PARAMS, Hm = P.hormones, d = (name, init = 0, unit = undefined) => k.declare(name, init, unit ? { unit } : {});
    const fx = (name, init) => k.declare(`ens.fx.${name}`, init, { body: false });
    // A.3.4 gut variables (§8).
    this.v = {
      gastricSolid: d('gastricSolid', 0, 'kcal'), gastricLiquid: d('gastricLiquid', 0, 'mL'), emptyRate: d('emptyRate', 0, 'kcal/min'),
      mmcPhase: d('mmcPhase', 1), fed: d('fed', 0), satiety: d('satiety', 0), hunger: d('hunger', P.hunger.base),
      rectalVol: d('rectalVol', 0, 'mL'), vagMech: d('vagMech', P.afferent.rRest, 'Hz'), vagChem: d('vagChem', P.afferent.rRest, 'Hz'), spinNoci: d('spinNoci', 0, 'Hz'),
    };
    /** @type {Record<string, number>} */
    this.h = {};
    for (const id of H_IDS) this.h[id] = k.declare(id, Hm[id].basal, { unit: Hm[id].unit, basal: Hm[id].basal });
    k.declareArray('swPhase', N, -1);
    k.declareArray('gutX', N, 0);
    k.declareArray('gutC', N, 0);
    k.declareArray('colon', 3, 1);
    // Internals.
    k.declareArray('ens.ipan', N, 0);
    k.declareArray('ens.siN', N, 0);       // small-intestinal nutrient, kcal per cell
    k.declareArray('ens.siR', N, 0);       // non-absorbable residue (marker), kcal-equivalent per cell
    k.declareArray('ens.sph', 4, P.sphT0);
    k.declareArray('ens.patch', N_PATCH, 0.5);
    k.declareArray('ens.colPhi', N_COLPATCH, 0);
    k.declareArray('ens.front', 2, -1);
    k.declareArray('ens.pk', 4, 0);         // afferent drive at the last lead packet (vagMech, vagChem, spinal gastric, spinal colorectal)
    const iv = (name, init = 0) => k.declare(`ens.${name}`, init);
    this.i = {
      fSolid: iv('fSolid'), fFine: iv('fFine'), rLP: iv('rLP'), E0: iv('E0'), mealT0: iv('mealT0', -1),
      mmcT0: iv('mmcT0', -1), mmcP: iv('mmcP', P.mmc.median), origin: iv('origin', -1), siT0: iv('siT0', -1), siP: iv('siP', P.mmc.median), siOn: iv('siOn', 0),
      fedT0: iv('fedT0', -1), tLast: iv('tLast', 0), lastSwallow: iv('lastSwallow', -1e9), eatStart: iv('eatStart', -1),
      tlesrUntil: iv('tlesrUntil', -1), cephUntil: iv('cephUntil', -1), cephF: iv('cephF'),
      balG: iv('balG'), balGEnd: iv('balGEnd', -1), balR: iv('balR'), balREnd: iv('balREnd', -1), lipRate: iv('lipRate'), lipStart: iv('lipStart', -1), lipEnd: iv('lipEnd', -1),
      wakeUntil: iv('wakeUntil', -1), prevArousal: iv('prevArousal', 1), tPatch: iv('tPatch', 0),
      uI: iv('uI'), uL: iv('uL'), absRate: iv('absRate'), absLP: iv('absLP'), duoIn: iv('duoIn'), lCck: iv('lCck'),
      motilinDrive: iv('motilinDrive'), volG: iv('volG', P.gastric.basalVolume), chymeHead: iv('chymeHead', -1), tHead: iv('tHead', -1),
      motility: iv('motility', 0), rG: iv('rSpinG'), rR: iv('rSpinR'), antralC: iv('antralC'),
    };
    this.fx = Object.fromEntries(Object.entries(FX_DEFAULTS).map(([key, val]) => [key, fx(key, val)]));
    this.microbiota = P.microbiota;
    this.settleSeconds = 0;
    k.onLayer('GI', (t, h) => this.gi(t, h));
    k.onLayer('EN', (t, h) => this.en(t, h));
    k.onQuiet('GI', () => this.quiet());
    k.onStimulus((rec) => this.onStimulus(rec));
    k.on('body', (p) => this.onBody(p));
    k.on('intervention', (preset) => this.onIntervention(preset));
    this._scratch = new Float64Array(N);
    this._scratch2 = new Float64Array(N);
    this._ipanFloor = 1 / (1 + Math.exp(PARAMS.ipan.theta / PARAMS.ipan.kappa));   // ipan of an empty cell
  }

  init(k) {
    const R = PARAMS.restTones;
    // A.3.4 `tone.<channel>` for the fVagGut, fSymGut and fSacral channels; the §11.14 spelling
    // (tone.vagGut, tone.symGut, tone.sacral) is accepted when a module declared that instead.
    const tone = (names, fb) => { for (const n of names) if (k.idx(n) >= 0) return k.idx(n); return k.ref(names[0], fb); };
    this.r = {
      vag: tone(['tone.fVagGut', 'tone.vagGut'], R.vagGut), sym: tone(['tone.fSymGut', 'tone.symGut'], R.symGut), sac: tone(['tone.fSacral', 'tone.sacral'], R.sacral),
      adr: k.ref('adrenalineRel', 1), anorexia: k.ref('sickness.anorexia', 0), arousal: k.ref('arousalState', 1),
    };
    this.swPhase = k.array('swPhase'); this.gutX = k.array('gutX'); this.gutC = k.array('gutC'); this.colon = k.array('colon');
    this.ipan = k.array('ens.ipan'); this.siN = k.array('ens.siN'); this.siR = k.array('ens.siR'); this.sph = k.array('ens.sph');
    this.patch = k.array('ens.patch'); this.colPhi = k.array('ens.colPhi'); this.front = k.array('ens.front'); this.pk = k.array('ens.pk');
    this.j = { mech: k.nfIndex('rec.stomachWall.vagMech'), chem: k.nfIndex('rec.duodenum.vagChem'),
      spinG: k.nfIndex('rec.stomachWall.spinNoci'), spinR: k.nfIndex('rec.colonRectum.spinNoci') };
    // Edge groups for interventions (own edges only).
    const g = k.graph;
    /** @type {Record<string, number[]>} */
    this.edges = { vagAff: [], spinGastric: [], spinColorectal: [] };
    /** @type {{ e: number, s: number }[]} */
    this.plexusEdges = [];
    /** @type {number[][]} */
    this.affEdges = [[], [], [], []];
    g.edges.forEach((e, q) => {
      if (e.plugin !== 'enteric') return;
      const from = /** @type {string} */ (e.fromId), to = /** @type {string} */ (e.toId);
      const ch = ['rec.stomachWall.vagMech', 'rec.duodenum.vagChem', 'rec.stomachWall.spinNoci', 'rec.colonRectum.spinNoci'].indexOf(from);
      if (ch >= 0 && e.kind === 'axon') this.affEdges[ch].push(q);
      if (from === 'rec.stomachWall.vagMech' || from === 'rec.duodenum.vagChem') this.edges.vagAff.push(q);
      else if (from === 'rec.stomachWall.spinNoci') this.edges.spinGastric.push(q);
      else if (from === 'rec.colonRectum.spinNoci') this.edges.spinColorectal.push(q);
      const m = /^(gut\.[A-Za-z]+)\.myenteric$/.exec(to) ?? /^(gut\.[A-Za-z]+)\.(myenteric|submucosal)$/.exec(from);
      if (m) { const r = PARAMS.regions.find((x) => x[0] === m[1]); if (r) this.plexusEdges.push({ e: q, s: r[1] }); }
    });
  }

  // --- Rest (§8.16: fasting rest, MMC at the start of phase I) ---
  preSettle(init, k) {
    const gE = k.g('enteric', 0);
    const q = PARAMS.afferent.quantum, r0 = PARAMS.afferent.rRest;
    if (this.j.mech >= 0) k.setExt(this.j.mech, Math.round((r0 * (0.5 + 0.5 * gE)) / q) * q);
    if (this.j.chem >= 0) k.setExt(this.j.chem, r0);
    if (this.j.spinG >= 0) k.setExt(this.j.spinG, 0);
    if (this.j.spinR >= 0) k.setExt(this.j.spinR, 0);
  }

  settle(init, k) {
    const vars = k.vars, i = this.i;
    vars[this.v.vagMech] = PARAMS.afferent.rRest * (0.5 + 0.5 * k.g('enteric', 0));
    vars[i.mmcT0] = k.g('enteric', 0) >= 0.5 ? 0 : -1;   // first cycle at the median period (no draw outside a step)
    vars[i.siT0] = vars[i.mmcT0];
    vars[this.v.mmcPhase] = vars[i.mmcT0] >= 0 ? 1 : 0;
    vars[i.prevArousal] = vars[this.r.arousal];
    this.micro = this.microbiota === 'germFreeLike' ? 0.5 : 1;
    vars[this.h.ec5ht] = PARAMS.hormones.ec5ht.basal * this.micro;
    const q = PARAMS.afferent.quantum;
    this.pk.set([Math.round(vars[this.v.vagMech] / q) * q, PARAMS.afferent.rRest, 0, 0]);
    this._field(0, 0, true);
    let vSum = 0; for (let c = SI0; c <= SI1; c++) vSum += (k.g('enteric', 0) * PARAMS.si.vFast) / 60;   // as _transit computes it
    vars[i.motility] = (100 * vSum / (SI1 - SI0 + 1)) / (PARAMS.si.vFed / 60);   // fasting transit, % of the intact fed value
  }

  // --- Brain-only mode and return (A.5, §8.16, §11.10 rule 5) ---
  onBody(p) {
    const vars = this.k.vars;
    if (p.mode === 'brain') { vars[this.v.satiety] = PARAMS.brainOnly.satiety; vars[this.v.hunger] = PARAMS.brainOnly.hunger; return; }
    // Body state was restored from the resting-state cache (rest at tH 0): re-anchor its times to now.
    const t = p.tH;
    for (const name of TIME_VARS) { const q = this.i[name]; if (vars[q] >= 0 || name === 'lastSwallow') vars[q] += t; }
    vars[this.i.tLast] = Math.floor(t + 1e-9);
  }

  // --- Interventions (§8.16) ---
  onIntervention(preset) {
    const k = this.k, vars = k.vars;
    /** @type {Record<string, number>} */
    const fx = { ...FX_DEFAULTS };
    if (preset) {
      const e = GUT_EFFECTS[preset.id];
      Object.assign(fx, typeof e === 'function' ? e(preset.params) : (e ?? {}));
      const over = /** @type {any} */ (preset.params)?.gut;
      if (over) for (const key of Object.keys(FX_DEFAULTS)) if (key in over) fx[key] = Number(over[key]);
    }
    for (const [key, q] of Object.entries(this.fx)) vars[q] = fx[key];
    for (const [key, list] of Object.entries(this.edges)) if (fx[key] === 0) for (const e of list) k.cutEdge(e, true);
    if (fx.aganglionicFrom < 1e8) this.cutAganglionic(k, fx.aganglionicFrom);
  }

  cutAganglionic(k, s) {
    for (const { e, s: s0 } of this.plexusEdges) if (s0 >= s) k.cutEdge(e, true);
  }

  // --- Interoceptive stimuli (§8.17, A.6) ---
  onStimulus(rec) {
    const k = this.k, vars = k.vars, i = this.i;
    if (rec.sense !== 'interoception' || !k.bodyOn) return;
    const t = rec.tOnset, dur = Math.max(0.1, rec.durationMs / 1000), I = Math.max(0, rec.intensity);
    if (rec.mode === 'gastricDistension') { vars[i.balG] = I; vars[i.balGEnd] = t + dur; }
    else if (rec.mode === 'duodenalLipid') { vars[i.lipRate] = I / dur; vars[i.lipStart] = t; vars[i.lipEnd] = t + dur; }
    else if (rec.mode === 'colorectalDistension') { vars[i.balR] = I; vars[i.balREnd] = t + dur; }
  }

  // --- GI layer (100 ms): inputs, MMC, field, sphincters, afferents; transit on 1-s boundaries ---
  gi(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS, i = this.i, v = this.v;
    const gE = k.g('enteric', t), gA = k.g('autonomic', t), gN = k.g('neuroendocrine', t);
    const inp = k.input(t - 0.5 * h);   // midpoint of the step: intake integrates exactly over (t − h, t]
    // Ingestion (§12.3 input `eat`; swallowing is somatic, ingestion is maintained without it, §8.16).
    const eat = /** @type {{ kcalPerMin?: number, liquidShare?: number } | undefined} */ (inp.eat);
    if (eat && eat.kcalPerMin > 0) {
      const kcal = (eat.kcalPerMin / 60) * h, liq = eat.liquidShare ?? 0;
      vars[i.fSolid] += (1 - liq) * kcal;
      vars[v.gastricLiquid] += liq * kcal * P.gastric.mlPerKcal;
      vars[i.E0] += kcal;
      if (vars[i.eatStart] < 0) vars[i.eatStart] = t - h;
      const n = Math.floor((t - vars[i.eatStart]) / P.swallow.interval);
      vars[i.lastSwallow] = vars[i.eatStart] + n * P.swallow.interval;
      if (!vars[v.fed]) {   // fed at the first swallow; aborts any phase III (§8.13)
        vars[v.fed] = 1; vars[i.fedT0] = t - h; vars[i.mealT0] = t - h; vars[i.tHead] = -1; vars[i.chymeHead] = -1;
        this.front[0] = -1; this.front[1] = -1; vars[v.mmcPhase] = 0;
        k.log({ kind: 'state', node: 'gut.antrum', label: 'Fed pattern (MMC interrupted)' });
      }
    } else vars[i.eatStart] = -1;
    vars[v.gastricSolid] = vars[i.fSolid] + vars[i.fFine];
    if (inp.cephalic) vars[i.cephUntil] = t + P.cephalic.hold;
    // Stimulus ends.
    if (vars[i.balGEnd] >= 0 && t >= vars[i.balGEnd]) { vars[i.balG] = 0; vars[i.balGEnd] = -1; }
    if (vars[i.balREnd] >= 0 && t >= vars[i.balREnd]) { vars[i.balR] = 0; vars[i.balREnd] = -1; }
    if (vars[i.lipEnd] >= 0 && Math.floor(t + 1e-9) > vars[i.lipEnd]) { vars[i.lipRate] = 0; vars[i.lipEnd] = -1; }
    vars[v.rectalVol] = vars[i.balR];
    // Waking pulse (§8.8): 60 min after a transition into wakeAlert (arousalState 0).
    const ar = vars[this.r.arousal];
    if (ar === 0 && vars[i.prevArousal] !== 0) vars[i.wakeUntil] = t + P.wakingDur;
    vars[i.prevArousal] = ar;
    // Cephalic drive (special ∧ autonomic; §8.13): rise 2 min.
    const vagEff = Math.min(vars[this.fx.vagProx], 1);
    const cephCmd = t < vars[i.cephUntil] ? P.cephalic.request * gA * vagEff : 0;
    vars[i.cephF] = cephCmd + (vars[i.cephF] - cephCmd) * Math.exp(-h / P.cephalic.rise);

    this._mmc(t, h, gE, gA, gN);
    this._fedEnd(t);
    if (Math.floor(t / P.patchEvery + 1e-9) > Math.floor(vars[i.tPatch] / P.patchEvery + 1e-9)) {   // redraw the segmenting pattern
      for (let p = 0; p < N_PATCH; p++) this.patch[p] = k.rand('GI');
      vars[i.tPatch] = t;
    }
    // Colonic OU phase offsets (exact update).
    const a = Math.exp(-h / P.sw.colonTau), sd = P.sw.colonSigma * Math.sqrt(1 - a * a);
    for (let p = 0; p < N_COLPATCH; p++) this.colPhi[p] = this.colPhi[p] * a + sd * this._gauss();

    this._field(t, h, false);
    // TLESR (vagovagal arc, §8.7): Poisson while gastric volume exceeds the trigger.
    const vagArc = gA * vars[this.fx.vagAff] * vagEff;
    if (vars[i.volG] > P.tlesr.volume && vagArc > 0 && t >= vars[i.tlesrUntil]) {
      if (k.rand('GI') < (P.tlesr.perHour / 3600) * h * vagArc) { vars[i.tlesrUntil] = t + P.tlesr.dur; k.log({ kind: 'state', node: 'gut.les', label: 'TLESR' }); }
    }
    // Transit on the 1-s sub-step (§8.15).
    const tr = Math.round(t);
    if (Math.abs(t - tr) < 1e-6 && tr > vars[i.tLast]) { this._transit(t, tr - vars[i.tLast], gE, gA, gN); vars[i.tLast] = tr; }
    this._afferents(t, h, gE);
  }

  _gauss() {   // standard normal from the GI stream (Box–Muller)
    const u = Math.max(1e-12, this.k.rand('GI')), w = this.k.rand('GI');
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * w);
  }

  _drawPeriod() {
    const M = PARAMS.mmc;
    return Math.min(M.max, Math.max(M.min, M.median * Math.exp(M.sigma * this._gauss())));
  }

  // MMC scheduler (§8.6): gastric clock; the small-intestinal clock is slaved to it while g.autonomic ≥ 0.5.
  _mmc(t, h, gE, gA, gN) {
    const k = this.k, vars = k.vars, i = this.i, M = PARAMS.mmc, v = this.v, fr = this.front;
    // Fronts migrate aborally (cm/min).
    for (let q = 0; q < 2; q++) {
      if (fr[q] < 0) continue;
      const s = fr[q], sSI = Math.max(0, s - 55);
      const vf = s < 55 ? M.stomachFrontV : M.frontA * Math.exp(-sSI / M.frontL) + M.frontB;
      fr[q] = s + (vf * h * gE) / 60;
      if (fr[q] - this._bandWidth(fr[q]) > PARAMS.si.s1) fr[q] = -1;
    }
    if (vars[v.fed] || gE < 0.5) {
      vars[i.motilinDrive] = 0;
      if (!vars[v.fed]) { vars[v.mmcPhase] = 0; vars[i.mmcT0] = -1; vars[i.siT0] = -1; fr[0] = fr[1] = -1; }
      return;
    }
    if (vars[i.mmcT0] < 0) {   // (re)start at phase I
      vars[i.mmcT0] = t; vars[i.mmcP] = this._drawPeriod(); vars[i.origin] = -1;
      vars[i.siT0] = t; vars[i.siP] = this._drawPeriod(); vars[i.siOn] = 0;
    }
    while (t >= vars[i.mmcT0] + vars[i.mmcP]) { vars[i.mmcT0] += vars[i.mmcP]; vars[i.mmcP] = this._drawPeriod(); vars[i.origin] = -1; }
    const tau = t - vars[i.mmcT0], p3 = vars[i.mmcP] - M.phase3, p1 = M.phase1Share * p3;
    const ph = tau < p1 ? 1 : tau < p3 ? 2 : 3;
    const coupled = gA * Math.min(vars[this.fx.vagProx], vars[this.fx.vagDist]) >= M.couple;
    if (ph === 3 && vars[i.origin] < 0) {
      const pAnt = M.antralP * gN * (0.3 + 0.7 * gA);
      vars[i.origin] = k.rand('GI') < pAnt ? 1 : 0;
      if (coupled) this._startFront(vars[i.origin] ? 45 : 55);
      k.log({ kind: 'state', node: vars[i.origin] ? 'gut.antrum' : 'gut.duod', label: `MMC phase III (${vars[i.origin] ? 'antral' : 'duodenal'} origin)` });
    }
    vars[v.mmcPhase] = ph;
    vars[i.motilinDrive] = tau >= p3 - M.motilinLead ? 1 : 0;
    if (!coupled) {   // uncoupled small-intestinal clock (§8.6, §8.16): fronts start in the duodenum
      while (t >= vars[i.siT0] + vars[i.siP]) { vars[i.siT0] += vars[i.siP]; vars[i.siP] = this._drawPeriod(); vars[i.siOn] = 0; }
      if (t - vars[i.siT0] >= vars[i.siP] - M.phase3 && !vars[i.siOn]) { vars[i.siOn] = 1; this._startFront(55); }
    } else { vars[i.siT0] = vars[i.mmcT0]; vars[i.siP] = vars[i.mmcP]; vars[i.siOn] = ph === 3 ? 1 : 0; }
  }

  _startFront(s) { const fr = this.front; const q = fr[0] < 0 ? 0 : fr[1] < 0 ? 1 : (fr[0] > fr[1] ? 0 : 1); fr[q] = s; }

  _bandWidth(s) {
    const M = PARAMS.mmc, sSI = Math.max(0, s - 55);
    const vf = s < 55 ? M.stomachFrontV : M.frontA * Math.exp(-sSI / M.frontL) + M.frontB;
    return (M.phase3 / 60) * vf * (1 + sSI / M.widthL);
  }

  // Fed pattern end (§8.6): ≥ min(120 + 0.25·E₀, 480) min, held while nutrient remains.
  _fedEnd(t) {
    const k = this.k, vars = k.vars, i = this.i, F = PARAMS.fedRule;
    if (!vars[this.v.fed] || vars[i.eatStart] >= 0) return;
    const minDur = Math.min(F.base + F.perKcal * vars[i.E0], F.max) * 60;
    if (t - vars[i.fedT0] < minDur) return;
    let si = 0; for (let c = SI0; c <= SI1; c++) si += this.siN[c];
    if (vars[i.fSolid] + vars[i.fFine] + vars[this.v.gastricLiquid] / PARAMS.gastric.mlPerKcal > F.gastricKcal || si > F.siKcal) return;
    vars[this.v.fed] = 0; vars[i.E0] = 0; vars[i.mmcT0] = -1;
    k.log({ kind: 'state', node: 'gut.duod', label: 'Fasting pattern (MMC returns)' });
  }

  // Slow waves, IPANs, gutX, contractions and sphincters (§8.4, §8.5, §8.7).
  _field(t, h, rest) {
    const k = this.k, vars = k.vars, P = PARAMS, i = this.i, v = this.v, C = CELLS;
    const gE = k.g('enteric', t), gA = k.g('autonomic', t), gN = k.g('neuroendocrine', t), gS = k.g('somatic', t);
    const S = gA * vars[this.r.sym];
    const vn = vars[this.r.vag] / P.restTones.vagGut, qn = (vars[this.r.sac] / P.restTones.sacral) * vars[this.fx.sacral];
    const fxProx = vars[this.fx.vagProx], fxDist = vars[this.fx.vagDist], agang = vars[this.fx.aganglionicFrom];
    const ge = (1 - P.symExcite * S) * vars[this.fx.excite] * (1 - P.adrBeta2 * Math.max(0, vars[this.r.adr] - 1));
    const fed = vars[v.fed] > 0, ph = vars[v.mmcPhase];
    const motilin = vars[this.h.motilin], ec = vars[this.h.ec5ht], micro = this.micro ?? 1;
    const gcOn = vars[i.mealT0] >= 0 && t - vars[i.mealT0] < P.gastrocolonic.dur ? 1 : 0;
    const gc = gcOn * P.gastrocolonic.gain * (P.gastrocolonic.extrinsic + (1 - P.gastrocolonic.extrinsic) * gA) * vars[this.fx.gastrocolonic];
    // Gastric volume (mL) and stretch per cell.
    const G = P.gastric;
    const volG = G.basalVolume + G.mlPerKcal * (vars[i.fSolid] + vars[i.fFine]) + vars[v.gastricLiquid] + vars[i.balG];
    vars[i.volG] = volG;
    const Ip = P.ipan, ipan = this.ipan, sw = this.swPhase, X = this.gutX, Cc = this.gutC;
    const h5 = P.k5ht * (ec / micro - 1);
    for (let c = 0; c < N; c++) {
      const role = C.role[c];
      let u = 0;
      if (role === ROLE.fundus) u = Ip.fundus * volG / Ip.v50Gastric;
      else if (role === ROLE.stomach) u = volG / Ip.v50Gastric;
      else if (role === ROLE.si) u = (this.siN[c] + this.siR[c]) / Ip.n50SI;
      else if (C.tank[c] >= 0) u = C.tank[c] === 2 && RECTUM.includes(c) ? vars[v.rectalVol] / Ip.rectal50 : this.colon[C.tank[c]] / Ip.colon50;
      ipan[c] = role === ROLE.oes || role === ROLE.eas ? 0 : 1 / (1 + Math.exp(-(u + h5 - Ip.theta) / Ip.kappa));
    }
    // Slow-wave phase (analytic in tH; colon with its OU patch offsets; ICC loss removes it).
    const icc = vars[this.fx.icc];
    for (let c = 0; c < N; c++) {
      if (!C.sw[c] || (icc === 0 && C.role[c] === ROLE.si)) { sw[c] = -1; continue; }
      let phi = TAU * C.f[c] * (t - C.lam[c]);
      if (C.colPatch[c] >= 0) phi += this.colPhi[C.colPatch[c]];
      phi %= TAU; if (phi < 0) phi += TAU;
      sw[c] = phi;
    }
    // Phase III bands.
    const fr = this.front, inBand = (s) => {
      for (let q = 0; q < 2; q++) if (fr[q] >= 0 && s <= fr[q] && s >= fr[q] - this._bandWidth(fr[q])) return true;
      return false;
    };
    const antralIII = !fed && ph === 3 && vars[i.origin] === 1;
    const kRise = rest ? 1 : 1 - Math.exp(-h / P.tauRise), kFall = rest ? 1 : 1 - Math.exp(-h / P.tauFall);
    const thr = P.sw.gateThr;
    let antC = 0;
    for (let c = 0; c < N; c++) {
      const role = C.role[c], s = C.s[c];
      if (role === ROLE.sph || role === ROLE.eas) continue;
      const eC = s >= agang ? 0 : gE;
      let Cs = 0;
      if (role === ROLE.oes) {   // swallow-driven peristalsis (§8.7): striated part somatic, smooth part myenteric
        const dt = t - vars[i.lastSwallow];
        const sf = P.swallow.v * dt;
        if (!rest && dt >= 0 && Math.abs(s - sf) < P.swallow.band) Cs = s < P.swallow.striatedS ? gS : eC * (0.5 + 0.5 * gA);
        X[c] = Cs;
      } else {
        const b = eC * (fed ? P.base.fed * (0.5 + this.patch[C.patch[c]]) : ph === 2 ? P.base.phase1 + P.base.phase2Rand * this.patch[C.patch[c]] : P.base.phase1) + (1 - eC) * P.base.off;
        const Ea = eC * P.kAsc * (c + 1 < N ? ipan[c + 1] : 0);
        let Id = 0; for (let q = 1; q <= P.nDesc; q++) if (c - q >= 0) Id += ipan[c - q];
        Id *= eC * P.kDesc;
        const vf = s < 45 ? fxProx : fxDist;
        const V = P.kV * gA * eC * (C.wVag[c] * vn * vf + C.wSac[c] * qn);
        const Mo = (role === ROLE.stomach || (s >= 55 && s < 80)) ? P.kMo * gN * Math.max(0, motilin - 1) : 0;
        const H5 = eC * h5;
        const gcol = role === ROLE.colon ? gc : 0;
        const Pm = (antralIII && role === ROLE.stomach && s >= 45) || (eC > 0 && inBand(s)) ? P.mmcDrive * eC : 0;
        const x = b + ge * (Ea + V + Mo + H5 + gcol) - Id - eC * P.i0 - P.kS * S + Pm;
        X[c] = x;
        if (role !== ROLE.fundus && sw[c] >= 0) {
          const g = Math.max(0, (Math.cos(sw[c]) - thr) / (1 - thr));
          Cs = clamp01(x) * g * g;
        }
      }
      Cc[c] += (Cs - Cc[c]) * (Cs > Cc[c] ? kRise : kFall);
      if (rest) Cc[c] = Cs;
    }
    for (const c of ANTRUM) antC += Cc[c];
    antC /= ANTRUM.length;
    vars[i.antralC] = antC;
    // Sphincters (§8.7): tone = clamp01(T0 + 0.3·S − relax·g.enteric).
    const R = P.relaxCmd, sph = this.sph;
    const sinceSw = t - vars[i.lastSwallow];
    const lesRelax = (!rest && ((sinceSw >= P.swallow.lesOnset && sinceSw < P.swallow.lesOnset + P.swallow.lesDur) || t < vars[i.tlesrUntil])) ? R * vars[this.fx.lesRelax] : 0;
    const pylRelax = R * clamp01(Cc[ANTRUM[ANTRUM.length - 1]] / P.pylRelaxC);
    let ileal = 0; for (let c = SI1 - 4; c <= SI1; c++) ileal += this.siN[c] + this.siR[c];
    const icvRelax = R * clamp01(ileal / P.icvKcal);
    let rectIpan = 0; for (const c of RECTUM) rectIpan = Math.max(rectIpan, ipan[c]);
    const iasRelax = R * clamp01((rectIpan - 0.3) / 0.4);
    const relax = [lesRelax, pylRelax, icvRelax, iasRelax];
    for (let q = 0; q < 4; q++) {
      const eC = C.s[SPH_CELLS[q][0]] >= agang ? 0 : gE;
      sph[q] = clamp01(P.sphT0 + P.symSphincter * S - relax[q] * eC);
      for (const c of SPH_CELLS[q]) { X[c] = sph[q]; Cc[c] = sph[q]; }
    }
    // EAS: somatic tone (§6 owns it); shown at the somatic gain.
    const eas = N - 1; X[eas] = P.sphT0 * gS; Cc[eas] = X[eas];
  }

  // Gastric emptying, small-intestinal and colonic transit, HAPCs (§8.8, §8.15), at 1-s sub-steps.
  _transit(t, dt, gE, gA, gN) {
    const k = this.k, vars = k.vars, P = PARAMS, i = this.i, v = this.v, G = P.gastric, Si = P.si, Cn = P.colon;
    const S = gA * vars[this.r.sym], vn = vars[this.r.vag] / P.restTones.vagGut;
    const fxProx = vars[this.fx.vagProx], fxDist = vars[this.fx.vagDist];
    const agang = vars[this.fx.aganglionicFrom];
    const gEs = 45 >= agang ? 0 : gE, gEi = (s) => (s >= agang ? 0 : gE);
    const mSick = 1 - 0.3 * vars[this.r.anorexia];
    // Antral strength and pyloric conductance (§8.8, §11.13 gut form).
    const A = gEs * (0.5 + 0.5 * gA * Math.min(vn * fxDist, 1.5)) * (1 - 0.4 * S) * mSick * (0.5 + 0.5 * vars[this.fx.excite]);
    const E0 = vars[i.E0];
    const rSet = E0 > 0 ? Math.min(G.rSetMax, G.rSetK * Math.sqrt(E0 / G.rSetRef)) : G.rSetLiquid;
    const B = G.brakeGain * (G.brake.ne * gN + G.brake.aut * gA + G.brake.ent * gE);
    const gPyl = G.gPylOff + (G.gPylOn - G.gPylOff) * gEs;
    const Gc = gPyl / (1 + B * (vars[i.rLP] / rSet) ** 4);
    const k1 = A / G.kTrit / 60, k2 = (A * Gc) / G.kEmpty / 60;
    const dS = vars[i.fSolid] * (1 - Math.exp(-k1 * dt));
    vars[i.fSolid] -= dS; vars[i.fFine] += dS;
    const outF = vars[i.fFine] * (1 - Math.exp(-k2 * dt));
    vars[i.fFine] -= outF;
    const half = G.waterHalfNoAcc + (G.waterHalf - G.waterHalfNoAcc) * gA * gEs * Math.min(1, vn * fxProx);   // accommodation (vagal ∧ enteric)
    const kL = (Math.LN2 / (half * 60)) * Gc;
    const outV = vars[v.gastricLiquid] * (1 - Math.exp(-kL * dt));
    vars[v.gastricLiquid] -= outV;
    const emptied = outF + outV / G.mlPerKcal;
    vars[v.emptyRate] = (emptied / dt) * 60;
    vars[i.rLP] = vars[v.emptyRate] + (vars[i.rLP] - vars[v.emptyRate]) * Math.exp(-dt / G.rTau);
    vars[v.gastricSolid] = vars[i.fSolid] + vars[i.fFine];
    // Duodenal inflow: gastric chyme plus an infused lipid stimulus over the duodenum (s 55–80).
    const n = this.siN, r = this.siR, ds = P.ds;
    n[SI0] += emptied; r[SI0] += emptied * Si.residueFrac;
    // lipid delivered over the overlap of (t − dt, t] with the stimulus window
    const lip = vars[i.lipRate] > 0 ? vars[i.lipRate] * Math.max(0, Math.min(t, vars[i.lipEnd]) - Math.max(t - dt, vars[i.lipStart])) : 0;
    if (lip > 0) for (const c of DUOD) n[c] += lip / DUOD.length;
    vars[i.duoIn] = ((emptied + lip) / dt) * 60;
    if (emptied > 1e-9 && vars[v.fed] && vars[i.chymeHead] < 0 && vars[i.tHead] < 0) vars[i.chymeHead] = Si.s0;
    // Small intestine: upwind advection, dispersion, absorption (s 55–345).
    let distal = 0; for (let c = Math.floor(Si.ilealS / ds); c <= SI1; c++) distal += n[c];
    const ileal = distal > Si.distalKcal ? 1 : 0;
    const vBase = (vars[v.fed] ? Si.vFed * (1 - Si.ilealBrake * gN * ileal) : Si.vFast) / 60;   // cm/s
    const fr = this.front, Dc = (Si.D / 60) * dt / (ds * ds);
    const nn = this._scratch, rr = this._scratch2;
    let flowN = 0, flowR = 0, vSum = 0, absorbed = 0;
    const icvOpen = clamp01((1 - this.sph[SPH_IDX.icv]) / 0.9);
    for (let c = SI0; c <= SI1; c++) { nn[c] = n[c]; rr[c] = r[c]; }
    for (let c = SI0; c <= SI1; c++) {
      const s = CELLS.s[c], e = gEi(s);
      let vc = e * vBase;
      for (let q = 0; q < 2; q++) if (fr[q] >= 0 && s <= fr[q] && s >= fr[q] - this._bandWidth(fr[q])) {
        const sSI = Math.max(0, s - 55); vc += (e * (P.mmc.frontA * Math.exp(-sSI / P.mmc.frontL) + P.mmc.frontB)) / 60;
      }
      vSum += vc;
      const fAdv = Math.min(1, (vc * dt) / ds) * (c === SI1 ? icvOpen : 1);
      const fD = e * Dc;
      const outN = n[c] * fAdv, outR = r[c] * fAdv;
      nn[c] -= outN; rr[c] -= outR;
      if (c < SI1) { nn[c + 1] += outN; rr[c + 1] += outR; } else { flowN += outN; flowR += outR; }
      if (fD > 0) {
        if (c > SI0) { const d = fD * (n[c] - n[c - 1]); nn[c] -= d; nn[c - 1] += d; const dr = fD * (r[c] - r[c - 1]); rr[c] -= dr; rr[c - 1] += dr; }
      }
    }
    const kAbs = 1 - Math.exp(-dt / Si.tauAbs);
    let uI = 0, uL = 0;
    for (let c = SI0; c <= SI1; c++) {
      const a = Math.max(0, nn[c]) * kAbs;
      n[c] = Math.max(0, nn[c]) - a; r[c] = Math.max(0, rr[c]); absorbed += a;
      const s = CELLS.s[c];
      if (s < 185) uI += n[c] * Math.exp(-(s - Si.s0) / Si.iCellL);
      if (s >= Si.lCellS) uL += n[c];
    }
    vars[i.uI] = uI; vars[i.uL] = uL;
    vars[i.absRate] = (absorbed / dt) * 60;
    vars[i.absLP] = vars[i.absRate] + (vars[i.absLP] - vars[i.absRate]) * Math.exp(-dt / P.release.absTau);
    vars[i.motility] = (100 * vSum / (SI1 - SI0 + 1)) / (Si.vFed / 60);
    // Chyme head (marker front) at the local transit velocity.
    if (vars[i.chymeHead] >= 0) {
      vars[i.chymeHead] += gEi(vars[i.chymeHead]) * vBase * dt;
      if (vars[i.chymeHead] >= Si.s1) {
        vars[i.tHead] = t - vars[i.mealT0]; vars[i.chymeHead] = -1;
        k.log({ kind: 'state', node: 'gut.caecum', label: `Chyme head at the caecum (${(vars[i.tHead] / 3600).toFixed(2)} h)` });
      }
    }
    // Colon: three tanks (§8.8); basal residue keeps the resting content at 1 (relative) [model].
    const col = this.colon, fl = Math.max(gE, Cn.kappaFloor) * vars[this.fx.colonKappa];
    const qn = (vars[this.r.sac] / P.restTones.sacral) * vars[this.fx.sacral];
    const kap = [(Cn.kappaBase + Cn.kappaNerve * gA * vn * fxDist) * fl, (Cn.kappaBase + Cn.kappaNerve * gA * qn) * fl, (Cn.kappaBase + Cn.kappaNerve * gA * qn) * fl];
    const inflow = (Cn.kappaRest / Cn.tauC) * dt + (flowN + flowR) * Cn.perKcal;
    const o0 = col[0] * kap[0] * dt / Cn.tauC, o1 = col[1] * kap[1] * dt / Cn.tauC, o2 = col[2] * kap[2] * dt / Cn.tauC;
    col[0] += inflow - o0; col[1] += o0 - o1; col[2] += o1 - o2;   // rectosigmoid outflow leaves (evacuation not simulated, §8.8)
    // HAPC hazard (§8.8).
    const Hp = P.hapc, wake = t < vars[i.wakeUntil] ? 1 : 0;
    const gcOn = vars[i.mealT0] >= 0 && t - vars[i.mealT0] < P.gastrocolonic.dur ? vars[this.fx.gastrocolonic] * (P.gastrocolonic.extrinsic + (1 - P.gastrocolonic.extrinsic) * gA) : 0;
    const hz = (Hp.perDay / 86400) * (1 + Hp.waking * wake + Hp.gastrocolonic * gcOn) * gE * (0.5 + 0.5 * gA);
    if (hz > 0 && k.rand('GI') < hz * dt) {
      const m0 = Hp.move * col[0], m1 = Hp.move * col[1];
      col[0] -= m0; col[1] += m0 - m1; col[2] += m1;
      k.log({ kind: 'state', node: 'gut.colTrans', label: 'High-amplitude propagating contraction' });
    }
  }

  // Vagal and spinal afferents (§8.17) and their NF drives; local hormone terms ℓ (§8.10).
  _afferents(t, h, gE) {
    const k = this.k, vars = k.vars, P = PARAMS, A = P.afferent, i = this.i, v = this.v;
    const lt = 1 - Math.exp(-h / P.release.localTau);
    const cckLocal = P.release.cckPerI * vars[i.uI];
    vars[i.lCck] += (cckLocal - vars[i.lCck]) * lt;
    const volG = vars[i.volG], V0 = P.gastric.basalVolume;
    const mech = (A.rRest + (A.rSat - A.rRest) * Math.min(1, hill2((volG - V0) / P.ipan.v50Gastric) + A.antralC * vars[i.antralC])) * (0.5 + 0.5 * gE);
    const lipNow = vars[i.lipRate] > 0 && t >= vars[i.lipStart] && t < vars[i.lipEnd] ? vars[i.lipRate] * 60 : 0;   // kcal/min, luminal now
    const z = vars[i.lCck] / 3 + (vars[v.emptyRate] + lipNow) / 1 + Math.max(0, vars[this.h.ec5ht] - 1);
    const chem = A.rRest + (A.rSat - A.rRest) * hill2(z / A.chemZ50);
    const thrG = P.gastric.discomfort;
    const rG = volG > thrG ? A.rSat * hill2((volG - thrG) / thrG) * vars[this.fx.spinGastric] : 0;
    const rR = vars[v.rectalVol] > A.rectalThr ? A.rSat * hill2((vars[v.rectalVol] - A.rectalThr) / A.rectalThr) * vars[this.fx.spinColorectal] : 0;
    vars[v.vagMech] = mech; vars[v.vagChem] = chem; vars[v.spinNoci] = Math.max(rG, rR);
    vars[i.rG] = rG; vars[i.rR] = rR;
    const q = A.quantum, rates = [mech, chem, rG, rR], js = [this.j.mech, this.j.chem, this.j.spinG, this.j.spinR], pk = this.pk;
    for (let c = 0; c < 4; c++) {
      if (js[c] < 0) continue;
      const x = Math.round(rates[c] / q) * q;
      k.setExt(js[c], x);
      // Display: a lead packet on each afferent edge when the drive has risen by leadStep since the last one (§11.8, §13).
      if (x >= pk[c] + A.leadStep) {
        pk[c] = x;
        for (const e of this.affEdges[c]) if (k.edgeGate(e, t) > 0) k.emitPacket(e, { amp: x / A.rmax, lead: true, tEmit: t });
      } else if (x < pk[c]) pk[c] = x;
    }
  }

  // --- EN layer (1 s): hormones (§8.10, §11.13), satiety and hunger (§8.14) ---
  en(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS, i = this.i, v = this.v, Rl = P.release, Hm = P.hormones;
    const gN = k.g('neuroendocrine', t), gA = k.g('autonomic', t), gE = k.g('enteric', t);
    const vn = Math.min(1.5, (vars[this.r.vag] / P.restTones.vagGut) * vars[this.fx.vagDist]);
    const uI = vars[i.uI], uL = vars[i.uL], ceph = vars[i.cephF];
    const glp1Rel = vars[this.h.glp1] / Hm.glp1.basal - 1;
    const volMeal = Math.max(0, vars[i.volG] - P.gastric.basalVolume);
    const micro = this.micro ?? 1;
    let stretch = 0; for (let c = SI0; c <= SI1; c++) stretch += this.ipan[c];
    stretch = Math.max(0, stretch / (SI1 - SI0 + 1) - this._ipanFloor);   // above the empty-gut value, so rest is basal
    /** @type {Record<string, number>} */
    const dX = {
      cck: Rl.cckPerI * uI,
      glp1: Rl.glp1PerI * uI + Rl.glp1PerL * uL,
      pyy: Rl.pyyPerI * uI + Rl.pyyPerL * uL,
      ghrelin: -Rl.ghrelinDepth * clamp01(vars[i.absLP] / Rl.ghrelinAbs),
      motilin: Rl.motilin * vars[i.motilinDrive],
      gastrin: Rl.gastrin * clamp01(volMeal / Rl.gastrinVolume) * (0.5 + 0.5 * gA * vn) + P.cephalic.gastrin * ceph / P.cephalic.request,
      insulin: Rl.insulinPerAbs * vars[i.absRate] + Rl.insulinPerGlp1 * gN * Math.max(0, glp1Rel) + ceph,
      ec5ht: Rl.ec5htStretch * stretch + Rl.ec5htPerI * uI,
    };
    for (const id of H_IDS) {
      const H = Hm[id], q = this.h[id], basal = H.basal * (id === 'ec5ht' ? micro : 1);
      const tau = H.tau ?? H.half / Math.LN2;
      const target = basal + (H.ne ? gN : 1) * dX[id] * (id === 'ec5ht' ? micro : 1);
      vars[q] = target + (vars[q] - target) * Math.exp(-h / tau);
    }
    // Satiety and hunger, referenced to the fasting rest so that rest gives 0 and 0.3 (§8.16) [model].
    const A = P.afferent, Sa = P.satiety;
    const fxAff = vars[this.fx.vagAff];
    const dm = gA * fxAff * Math.max(0, vars[v.vagMech] - A.rRest * (0.5 + 0.5 * gE)) / A.rSat;
    const dc = gA * fxAff * Math.max(0, vars[v.vagChem] - A.rRest) / A.rSat;
    const dh = gN * (Math.max(0, (vars[this.h.cck] - Hm.cck.basal) / (Sa.cckPeak - Hm.cck.basal))
      + Math.max(0, (vars[this.h.glp1] - Hm.glp1.basal) / (Sa.glp1Peak - Hm.glp1.basal))
      + Math.max(0, (vars[this.h.pyy] - Hm.pyy.basal) / (Sa.pyyPeak - Hm.pyy.basal))) / 3;
    const sat = 1 - Math.exp(-(Sa.wm * dm + Sa.wc * dc + Sa.wh * dh));
    vars[v.satiety] = sat + (vars[v.satiety] - sat) * Math.exp(-h / Sa.tau);
    const Hu = P.hunger;
    const hun = clamp01(Hu.base + Hu.ghrelin * gN * (vars[this.h.ghrelin] - 1) - Hu.satiety * vars[v.satiety] - vars[this.r.anorexia]);
    vars[v.hunger] = hun + (vars[v.hunger] - hun) * Math.exp(-h / Hu.tau);
  }

  // --- GI striding vote (§8.15): quiet when the gut is empty, fasting, and no reflex or MMC window is active ---
  quiet() {
    const k = this.k, vars = k.vars, i = this.i, v = this.v, t = k.t;
    if (vars[v.fed] || vars[i.eatStart] >= 0 || vars[v.mmcPhase] === 3 || this.front[0] >= 0 || this.front[1] >= 0) return false;
    if (vars[i.balG] > 0 || vars[i.balR] > 0 || vars[i.lipRate] > 0 || t < vars[i.tlesrUntil] || t < vars[i.cephUntil]) return false;
    if (t - vars[i.lastSwallow] < PARAMS.swallow.lesOnset + PARAMS.swallow.lesDur) return false;
    const inp = k.input(t);
    if (inp.eat || inp.cephalic) return false;
    if (vars[i.fSolid] + vars[i.fFine] > 1e-3 || vars[v.gastricLiquid] > 1e-3) return false;
    for (let c = SI0; c <= SI1; c++) if (this.siN[c] > 1e-3 || this.siR[c] > 1e-3) return false;
    for (let c = 0; c < N; c++) if (this.ipan[c] >= PARAMS.quietIpan) return false;
    return true;
  }

  // --- Display (B.7 uGut): per cell contraction, slow-wave phase (cycles, −1 none), excitability, bolus ---
  gutTexture(out = new Float32Array(4 * 256)) {
    const vars = this.k.vars, P = PARAMS, Ip = P.ipan, C = CELLS;
    const volG = vars[this.i.volG];
    for (let c = 0; c < N && 4 * c + 3 < out.length; c++) {
      const role = C.role[c];
      let bolus = 0;
      if (role === ROLE.fundus || role === ROLE.stomach) bolus = clamp01((volG - P.gastric.basalVolume) / 800);
      else if (role === ROLE.si) bolus = clamp01((this.siN[c] + this.siR[c]) / Ip.n50SI);
      else if (C.tank[c] >= 0) bolus = clamp01(RECTUM.includes(c) ? vars[this.v.rectalVol] / 300 : (this.colon[C.tank[c]] - 1) / 5);
      out[4 * c] = this.gutC[c];
      out[4 * c + 1] = this.swPhase[c] < 0 ? -1 : this.swPhase[c] / TAU;
      out[4 * c + 2] = clamp01(this.gutX[c]);
      out[4 * c + 3] = bolus;
    }
    return out;
  }
}

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'enteric',
  scope: 'body',
  order: 40,
  fragment,
  create: (k) => new Enteric(k),
};
export { Enteric };
