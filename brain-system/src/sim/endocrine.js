// @ts-check
// Neuroendocrine network plugin (research/ANALYSIS.md §9; switches A.5, §11.10–§11.13; interventions
// §9.9, §11.12; scenarios §12.9, §12.11, §12.15; B.15 phase 6). Plugin contract: graph.js header.
// Scope 'body', order 50: the fragment attaches to brainnet's `portPortal`, `portNeurohyp`, `portSymp`,
// `pvn` and `hippocampus`, and the instance steps on the EN layer (1 s, A.4).
//
//   HPA (§9.4; time in min, every pool a ratio to basal)
//     dCRH/dt   = k_CRH  · (C(tH) · drive(tH) · F(S_fb) − CRH)              brain command, always computed
//     dACTH/dt  = k_ACTH · (g·CRH · F(S_fb) · (1 + e_E·(adrenalineRel − 1)) + (1 − g) − ACTH)
//     dS/dt     = k_S    · (g·ACTH(tH − τ_adrenal) + (1 − g) − S)             fast feedback signal (adrenal output)
//     dcort/dt  = k_C    · (g·S + (1 − g) − cortisol)                          plasma pool, displayed
//     F(S)      = 2 / (1 + S^n);   S_fb = g·S + (1 − g)                       g = g.neuroendocrine (§11.13)
//     drive     = 1 + G_s · u_stress + k_cyto · pge2 · g.neuroimmune          u_stress from k.input (§12.3)
//     C(tH)     = (1 + a_C · procC) · (1 + a_CAR · α(tH − t_wake; 15 min))     procC, arousal from §3
//   SAM (§9.6, §11.11): adrenalineRel relaxes (t½ 2.5 min) toward g_ne·(1 + g_aut·(cmd − 1)) + (1 − g_ne),
//     cmd = tone.symAdr / rest tone (§7 channel table); with no autonomic module present, a [model]
//     stand-in cmd = 1 + G_adr·u_stress reproduces the §12.11 input profile (×4.12 peak).
//   Posterior pituitary (§9.7): avpRel relaxes (t½ 15 min) toward g_ne·(1 + g_aut·K_baro·max(0, fall − 0.10)/0.10)
//     + (1 − g_ne), fall = (MAP_rest − map)/MAP_rest (baroreceptor-driven AVP, autonomic ∧ neuroendocrine);
//     oxytocinRel (t½ 3 min) holds its basal command (no driver in §12; DOPAMINE.md owns the orgasm case).
//   RAAS (§9.7): raas relaxes (τ 2 min rising, 15 min falling) toward g_ne·cmd + (1 − g_ne),
//     cmd = 1 + k_P·max(0, fall) + k_sym·g_aut·(tone.symSpl / rest − 1): renal perfusion plus a renal
//     sympathetic share (§11.13).
//   HPT, HPG (§9.7): slow scalars, constant within any §12 scenario.
//   Off-semantics (A.5, §9.9): "off" is basal replacement for blood hormones, never zero. In brain-only
//   mode the body state is frozen and the CRH command runs with the feedback clamped at basal (§12.15).
//   Removing a gland (§9.9 adrenalectomy, hypophysectomy) cuts its output: the cortisol, adrenaline, AVP
//   and oxytocin pools are clamped at basal (replacement), but ACTH and the adrenal feedback signal S
//   are not replaced, so neither feedback limb closes and CRH and ACTH rise to the ceiling of F (= 2).
//
// HPA calibration [model]. The §9.4 defaults (n 6, ACTH t½ 22 min, τ_adrenal 10 min, k_C t½ 66 min,
// G_s 6) fail §12.20 rows 32–33 and pulse at baseline; §12.11 proposes variant E for an earlier kernel and
// leaves the choice to §9 (§12.22). PARAMS.hpa carries variant E transposed to the §9.4 two-pool ODE:
// ACTH t½ 10 min and G_s 9 (variant E), τ_adrenal 5 min (between variant E's 3 and the §9.4 range),
// S t½ 2.5 min, an effective free-cortisol clearance τ 30 min (§9.10's open "faster effective clearance")
// and n = 2 (stable, so rest is a steady state; §9.5's pulses need the n = 6 option). HPA_SETS.spec94
// keeps the §9.4 defaults for comparison.

import * as A from '../anatomy.js';

/** @typedef {import('./contracts').KernelApi} KernelApi */
/** @typedef {import('./contracts').Vec3} Vec3 */
/** @typedef {import('./contracts').NodeSpec} NodeSpec */
/** @typedef {import('./contracts').EdgeSpec} EdgeSpec */
/** @typedef {import('./contracts').InterventionPreset} InterventionPreset */

const MIN = 60;   // s per min

// HPA parameter sets (§9.4; §12.11 variant E). Rates in 1/min, delays in s.
export const HPA_SETS = Object.freeze({
  calibrated: Object.freeze({
    kCRH: 0.1732,                 // 1/min, t½ ≈ 4.0 min (§9.4, Andersen et al. 2013 [secondary])
    kACTH: Math.LN2 / 10,         // 1/min, t½ 10 min (§12.11 variant E [T]) [model]
    kS: Math.LN2 / 2.5,           // 1/min, t½ 2.5 min fast feedback signal [model]
    kC: 1 / 30,                   // 1/min, effective free-cortisol τ 30 min (§9.10 open calibration) [model]
    tauAdrenal: 300,              // s, transport + biosynthesis delay (§9.4: 10 min, 9.4–15; variant E 3 min) [model]
    n: 2,                         // Hill exponent of F (§9.4 options 6 and 4; 2 is the variant E feedback) [model]
    Gs: 9,                        // stress gain (§12.11 variant E; §12.15 ×8.5 brain-only CRH command) [model]
    eE: 0.2,                      // adrenaline → ACTH positive limb (§9.3, §9.4) [model]
  }),
  spec94: Object.freeze({ kCRH: 0.1732, kACTH: 0.0315, kS: 0.069, kC: 0.0105, tauAdrenal: 600, n: 6, Gs: 6, eE: 0.2 }),   // §9.4 defaults
});

export const PARAMS = {
  hpa: HPA_SETS.calibrated,
  aC: 0.6,                        // circadian gain on the CRH drive (§9.4) [model]
  aCAR: 1.0,                      // awakening gain (§9.4) [model]
  tauCAR: 15 * MIN,               // s, α time to peak after the wake transition (§9.4)
  kCyto: 3,                       // per PGE2 unit, cytokine → PVN edge (§10.5) [model]
  sleepStates: [2, 3, 4, 5],      // brainnet STATES indices n1, n2, n3, rem (§3.11)
  // MR / GR occupancy readouts (§9.3; display only): high-affinity MR near saturation at basal [model].
  kMR: 0.1, kGR: 1.0,
  // SAM (§9.6).
  kAdr: Math.LN2 / (2.5 * MIN),   // 1/s, adrenaline t½ 2.5 min (2–3, §9.6)
  toneAdrRest: 0.05,              // tone.symAdr at rest (§7 channel table, fSymAdr 0.05)
  gAdrStandIn: 3.12,              // stand-in medullary command per unit u_stress without the autonomic module:
                                  // ×4.12 peak, the §12.11 / §9.4 input profile [model]
  kNa: Math.LN2 / (2.4 * MIN),    // 1/s, plasma noradrenaline t½ 2.4 min (§9.6, Silverberg et al. 1978)
  naNerveShare: 0.8,              // plasma noradrenaline from nerve spillover vs adrenal medulla 0.2 (§9.6 80:20 ratio) [model]
  toneMusRest: 0.10,              // tone.symMus at rest (§7 channel table), proxy for spillover
  // Posterior pituitary (§9.7).
  kAvp: Math.LN2 / (15 * MIN),    // 1/s, AVP t½ 15 min (10–20)
  kOt: Math.LN2 / (3 * MIN),      // 1/s, oxytocin t½ 3 min (1–6 i.v.)
  avpBaroThreshold: 0.10,         // fractional fall in pressure before the steep AVP rise (§9.7 [T])
  avpBaroGain: 2,                 // AVP command per further 10 % fall [model]
  // RAAS (§9.7, §11.13).
  tauRaasOn: 2 * MIN, tauRaasOff: 15 * MIN,   // s (§9.7 [model])
  raasPerfusionGain: 5,           // command per unit fractional MAP fall [model]
  raasSymGain: 0.5,               // command per unit tone.symSpl ratio above rest (needs autonomic) [model]
  toneSplRest: 0.10,              // tone.symSpl at rest (§7 channel table)
  mapRest: 88,                    // mmHg, supine rest MAP (§7; A.7 row 7)
  // Scalars (§9.7): T4 t½ ≈ 7 d, so constant within §12 [T].
  kScalar: Math.LN2 / (7 * 86400),
  // Display units at basal (§9.9; the kernel carries ratios).
  display: { acth: 20, cortisol: 12, adrenaline: 44, noradrenalinePl: 250, avp: 2, oxytocin: 2 },
  // Clock vote (A.4): HPA active → kh ≤ 60; active while a pool is more than activeEps (relative) from its
  // current target [model]. A pool that tracks the circadian envelope lags its target by τ · dx/dt, which
  // stays under ≈ 5 % even for the open-loop axis after a gland is removed (ACTH, adrenalectomy); a stress
  // transient is far above it. activeFloor: relative to at least 0.1 of basal (pools that go to 0).
  khActive: 60, activeEps: 0.08, activeFloor: 0.1,
  // Graph (§9.2 positions; §2 anchors; §9.8 transport delays).
  pos: {
    adrenal: { R: [42, -42, -447], L: [-38, -36, -448] },   // §2 table (adrenal cortex shell and medulla core)
    kidney: { R: [62, -50, -512], L: [-60, -50, -497] },    // §2 table
    thyroid: [0, 32, -180],                                 // §2 table, isthmus
    stalk: [[0, -6, -15], [0, -1, -28]],                    // §9.2 stalk tube
  },
  delay: { portal: 2, release: 1, distant: 10, pituitaryAdrenal: 20 },   // s (§9.8; portal "short" [model])
  routeFactor: 1.2,               // unrouted blood edge length = 1.2 × centre distance (§3.15)
};

const SIDES = /** @type {const} */ (['R', 'L']);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// --- Fragment (§9.1, §9.2, §11.3, §11.11) ---
/** @param {import('./contracts').FragmentContext} ctx */
function fragment(ctx) {
  /** @type {NodeSpec[]} */
  const nodes = [];
  /** @type {EdgeSpec[]} */
  const edges = [];
  const P = PARAMS.pos;
  const at = (id) => /** @type {Vec3} */ (A.nodePos(id) ?? [0, 0, 0]);
  const posAnt = at('pituitaryAnt'), posPost = at('pituitaryPost');
  const mean = (a, b) => /** @type {Vec3} */ ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  const adrMid = mean(P.adrenal.R, P.adrenal.L), kidMid = mean(P.kidney.R, P.kidney.L);

  nodes.push({ id: 'pituitaryAnt', kind: 'gland', owner: 'ne.hpa', pos: posAnt, label: 'anterior pituitary (corticotropes)', shared: true });
  nodes.push({ id: 'pituitaryPost', kind: 'gland', owner: 'ne.post', pos: posPost, label: 'posterior pituitary', shared: true });
  for (const s of SIDES) {
    nodes.push({ id: `adrenalCortex.${s}`, kind: 'gland', owner: 'ne.hpa', pos: /** @type {Vec3} */ ([...P.adrenal[s]]), side: s, label: 'adrenal cortex', shared: true });
    nodes.push({ id: `adrenalMedulla.${s}`, kind: 'gland', owner: 'ne.sam', pos: /** @type {Vec3} */ ([...P.adrenal[s]]), side: s, label: 'adrenal medulla', shared: true });
    nodes.push({ id: `kidney.${s}`, kind: 'organ', owner: 'tissue', pos: /** @type {Vec3} */ ([...P.kidney[s]]), side: s, label: 'kidney', shared: true });
  }
  nodes.push({ id: 'thyroid', kind: 'gland', owner: 'ne.scalar', pos: /** @type {Vec3} */ ([...P.thyroid]), label: 'thyroid (HPT scalar)', shared: true });
  // Blood pools (kind 'pool', EN layer), drawn at their source gland.
  const pool = (id, owner, pos, label) => nodes.push({ id, kind: 'pool', owner, layer: 'EN', pos: /** @type {Vec3} */ ([...pos]), label });
  pool('acth', 'ne.hpa', posAnt, 'ACTH (blood)');
  pool('cortisol', 'ne.hpa', adrMid, 'cortisol (blood)');
  pool('adrenaline', 'ne.sam', adrMid, 'adrenaline (blood)');
  pool('noradrenalinePl', 'ne.sam', adrMid, 'plasma noradrenaline (marker)');
  pool('avp', 'ne.post', posPost, 'vasopressin (blood)');
  pool('oxytocin', 'ne.post', posPost, 'oxytocin (blood)');
  pool('raas', 'ne.raas', kidMid, 'renin–angiotensin–aldosterone');

  // Ids of brain nodes and ports: unsided when midline, else both sides.
  const inst = (id) => (ctx.has(id) ? [id] : SIDES.map((s) => `${id}.${s}`).filter((x) => ctx.has(x)));
  const posOf = (id) => ctx.pos(id) ?? nodes.find((n) => n.id === id)?.pos ?? [0, 0, 0];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Humoral edge with a transport delay d (s): v = len / d, so the kernel's delay is d (§9.8).
  const blood = (from, to, d, o = {}) => {
    const len = Math.max(1, PARAMS.routeFactor * dist(posOf(from), posOf(to)));
    edges.push({ from, to, kind: 'blood', nSyn: 0, len, v: len / (1000 * d), transport: 'layer', ...o });
  };
  /** @type {import('./contracts').NetId[]} */
  const NE = ['neuroendocrine'];
  /** @type {import('./contracts').NetId[]} */
  const AND = ['autonomic', 'neuroendocrine'];
  const D = PARAMS.delay;

  // HPA: portal transport (CRH, parvocellular AVP), ACTH to blood, adrenal cortex, cortisol (§9.3).
  for (const p of inst('portPortal')) {
    const len = Math.max(1, PARAMS.routeFactor * dist(posOf(p), posAnt));
    edges.push({ from: p, to: 'pituitaryAnt', kind: 'portal', nSyn: 0, len, v: len / (1000 * D.portal), nets: NE, transport: 'layer',
      transmitter: 'CRH/AVP', label: 'hypophyseal portal vessels' });
  }
  blood('pituitaryAnt', 'acth', D.release, { nets: NE, transmitter: 'ACTH', label: 'ACTH release' });
  for (const s of SIDES) blood('acth', `adrenalCortex.${s}`, D.pituitaryAdrenal, { nets: NE, transmitter: 'ACTH', label: 'ACTH to the adrenal cortex' });
  for (const s of SIDES) blood(`adrenalCortex.${s}`, 'cortisol', D.release, { nets: NE, transmitter: 'cortisol', label: 'cortisol release' });
  // Feedback limbs (§9.3): cortisol crosses the barrier (§9.8); w −1 marks the sign only (read in this module).
  for (const t of [...inst('pvn'), 'pituitaryAnt', ...inst('hippocampus')]) {
    blood('cortisol', t, D.distant, { nets: NE, w: -1, sign: -1, transmitter: 'cortisol', label: `glucocorticoid feedback (${t})` });
  }
  blood('cortisol', 'macrophages', D.distant, { nets: ['neuroendocrine', 'neuroimmune'], w: -1, sign: -1, transmitter: 'cortisol',
    label: 'glucocorticoid brake', optional: true });

  // SAM (§9.6, §11.11): preganglionic B fibres → chromaffin cells → adrenaline (autonomic ∧ neuroendocrine).
  // A module that declared the medulla before this fragment (autonomic, order 30) owns its preganglionic
  // input; otherwise a logical edge from the sympathetic port stands for the cord and splanchnic route.
  for (const s of SIDES) {
    const src = ctx.has(`adrenalMedulla.${s}`) ? null
      : ctx.has(`splanchnicGreater.${s}`) ? `splanchnicGreater.${s}` : ctx.has('splanchnicGreater') ? 'splanchnicGreater'
        : inst('portSymp').find((x) => x.endsWith(`.${s}`)) ?? inst('portSymp')[0];
    if (src) edges.push({ from: src, to: `adrenalMedulla.${s}`, kind: 'axon', fibre: 'B', nets: ['autonomic'], transmitter: 'ACh',
      transport: 'layer', label: 'sympathoadrenal preganglionic (T5–T11, greater splanchnic)' });
    blood(`adrenalMedulla.${s}`, 'adrenaline', D.release, { nets: AND, transmitter: 'adrenaline', label: 'adrenal adrenaline' });
    blood(`adrenalMedulla.${s}`, 'noradrenalinePl', D.release, { nets: AND, transmitter: 'noradrenaline', label: 'adrenal noradrenaline' });
  }
  blood('adrenaline', 'pituitaryAnt', D.distant, { nets: NE, transmitter: 'adrenaline', label: 'E/NE → POMC cleavage (+)' });
  for (const t of ['heart', 'muscleVessels', 'liver']) blood('adrenaline', t, D.distant, { nets: AND, transmitter: 'adrenaline', label: 'adrenaline action', optional: true });

  // Posterior pituitary (§9.7): magnocellular axons in the stalk, release to blood.
  for (const p of inst('portNeurohyp')) {
    edges.push({ from: p, to: 'pituitaryPost', kind: 'axon', fibre: 'cns', nets: NE, transmitter: 'AVP/oxytocin', transport: 'layer',
      path: [...PARAMS.pos.stalk.map((q) => /** @type {Vec3} */ ([...q])), [...posPost]], label: 'hypothalamo-neurohypophyseal tract' });
  }
  blood('pituitaryPost', 'avp', D.release, { nets: NE, transmitter: 'AVP', label: 'AVP release' });
  blood('pituitaryPost', 'oxytocin', D.release, { nets: NE, transmitter: 'oxytocin', label: 'oxytocin release' });
  for (const s of SIDES) blood('avp', `kidney.${s}`, D.distant, { nets: NE, transmitter: 'AVP', label: 'antidiuretic action' });
  blood('avp', 'muscleVessels', D.distant, { nets: NE, transmitter: 'AVP', label: 'AVP pressor action', optional: true });

  // RAAS (§9.7): kidney → raas → angiotensin II at the SFO (peptide entry at a CVO, §9.8).
  for (const s of SIDES) blood(`kidney.${s}`, 'raas', D.release, { nets: NE, transmitter: 'renin', label: 'renin release' });
  for (const t of inst('sfo')) blood('raas', t, D.distant, { nets: NE, transmitter: 'angiotensin II', label: 'angiotensin II at the SFO' });

  // HPT scalar (§9.7): TSH to the thyroid, drawn only.
  blood('pituitaryAnt', 'thyroid', D.distant, { nets: NE, transmitter: 'TSH', label: 'TSH (HPT scalar)' });
  return { nodes, edges };
}

// --- Interventions (§9.9, §11.12): remove gland output edges; the module reads its flags. ---
const GLANDS = Object.freeze({ adrenalCortex: 'en.rmCortex', adrenalMedulla: 'en.rmMedulla', pituitaryAnt: 'en.rmAnt', pituitaryPost: 'en.rmPost' });

/** @param {KernelApi} k @param {string[]} remove */
function cutGlands(k, remove) {
  const g = k.graph, set = new Set(remove);
  const base = (i) => g.nodes[i].id.replace(/\.(R|L)$/, '');
  g.edges.forEach((e, q) => { if (set.has(base(e.from)) || set.has(base(e.to))) k.cutEdge(q, true); });
}

/** @type {Readonly<Record<string, InterventionPreset>>} */
export const INTERVENTIONS = Object.freeze({
  adrenalectomy: {
    id: 'adrenalectomy', label: 'Adrenalectomy', net: 'neuroendocrine',
    params: { remove: ['adrenalCortex', 'adrenalMedulla'] },
    apply(k) { cutGlands(k, ['adrenalCortex', 'adrenalMedulla']); },
  },
  hypophysectomy: {
    id: 'hypophysectomy', label: 'Hypophysectomy', net: 'neuroendocrine',
    params: { remove: ['pituitaryAnt', 'pituitaryPost'] },
    apply(k) { cutGlands(k, ['pituitaryAnt', 'pituitaryPost']); },
  },
});

// --- Instance ---
// Rest of the HPA loop for envelope C and drive d: S = C·d·F(S)² (A = 1), solved by bisection on [0, 8].
function restS(C, d, n) {
  let lo = 0, hi = 8;
  for (let i = 0; i < 80; i++) {
    const s = 0.5 * (lo + hi), F = 2 / (1 + s ** n);
    if (C * d * F * F - s > 0) lo = s; else hi = s;
  }
  return 0.5 * (lo + hi);
}

export class Endocrine {
  /** @param {KernelApi} k */
  constructor(k) {
    this.k = k;
    const H = PARAMS.hpa;
    const B = { body: false }, U = (unit) => ({ unit });
    // Brain-side state: the PVN command and its envelope bookkeeping keep running in brain-only mode.
    this.v = {
      crhRel: k.declare('crhRel', 1, { ...B, unit: 'rel' }),
      crh: k.declare('crh', 1, { ...B, unit: 'rel' }),
      tWake: k.declare('en.tWake', -1e12, B),
      asleep: k.declare('en.asleep', 0, B),
      rmCortex: k.declare(GLANDS.adrenalCortex, 0, B),
      rmMedulla: k.declare(GLANDS.adrenalMedulla, 0, B),
      rmAnt: k.declare(GLANDS.pituitaryAnt, 0, B),
      rmPost: k.declare(GLANDS.pituitaryPost, 0, B),
      // Body state (frozen in brain-only mode, restored from the resting-state cache, A.5).
      acthRel: k.declare('acthRel', 1, U('rel')),
      S: k.declare('en.S', 1, U('rel')),
      cortisolRel: k.declare('cortisolRel', 1, U('rel')),
      adrenalineRel: k.declare('adrenalineRel', 1, U('rel')),
      noradrenalinePlRel: k.declare('noradrenalinePlRel', 1, U('rel')),
      avpRel: k.declare('avpRel', 1, U('rel')),
      oxytocinRel: k.declare('oxytocinRel', 1, U('rel')),
      raas: k.declare('raas', 1, U('rel')),
      hpt: k.declare('hpt', 1, U('rel')),
      hpg: k.declare('hpg', 1, U('rel')),
      acth: k.declare('acth', PARAMS.display.acth, U('pg/mL')),
      cortisol: k.declare('cortisol', PARAMS.display.cortisol, U('µg/dL')),
      adrenaline: k.declare('adrenaline', PARAMS.display.adrenaline, U('pg/mL')),
      noradrenalinePl: k.declare('noradrenalinePl', PARAMS.display.noradrenalinePl, U('pg/mL')),
      avp: k.declare('avp', PARAMS.display.avp, U('pg/mL')),
      oxytocin: k.declare('oxytocin', PARAMS.display.oxytocin, U('pg/mL')),
      mr: k.declare('en.mrOcc', 1 / (1 + PARAMS.kMR)),
      gr: k.declare('en.grOcc', 1 / (1 + PARAMS.kGR)),
      ringIdx: k.declare('en.ringIdx', 0),
      gap: k.declare('en.gap', 0),   // largest |pool − target| of the last EN step (A.4 clock vote)
    };
    this.ringLen = Math.max(1, Math.round(H.tauAdrenal));   // one sample per 1-s EN step
    k.declareArray('en.acthRing', this.ringLen, 1);
    // Per-step decay factors (EN step 1 s).
    this.dec = {
      crh: Math.exp(-H.kCRH / MIN), acth: Math.exp(-H.kACTH / MIN), S: Math.exp(-H.kS / MIN), cort: Math.exp(-H.kC / MIN),
      adr: Math.exp(-PARAMS.kAdr), na: Math.exp(-PARAMS.kNa), avp: Math.exp(-PARAMS.kAvp), ot: Math.exp(-PARAMS.kOt),
      raasOn: Math.exp(-1 / PARAMS.tauRaasOn), raasOff: Math.exp(-1 / PARAMS.tauRaasOff), scalar: Math.exp(-PARAMS.kScalar),
    };
    this.sleep = new Set(PARAMS.sleepStates);
    k.onLayer('EN', (t, h) => this.step(t, h), { always: true });
    k.onKhVote(() => this.khVote());
    k.on('intervention', (p) => this.onIntervention(p));
    this.settleSeconds = 0;
  }

  /** @param {KernelApi} k */
  init(k) {
    // Cross-module readouts (A.3.4 names; fallbacks are the A.5 basal or rest values).
    this.r = {
      procC: k.ref('procC', 0),
      arousal: k.ref('arousalState', 1),          // wakeRelaxed (§3.11)
      pge2: k.ref('pge2', 0),                     // no immune signal at rest (§10.2)
      toneAdr: k.ref('tone.symAdr', PARAMS.toneAdrRest),
      toneSpl: k.ref('tone.symSpl', PARAMS.toneSplRest),
      toneMus: k.ref('tone.symMus', PARAMS.toneMusRest),
      map: k.ref('map', PARAMS.mapRest),
    };
    this.ring = k.array('en.acthRing');
    // Without the autonomic module there is no preganglionic adrenal command: the stress stand-in drives it.
    this.hasAutonomic = !!k.plugin('autonomic');
  }

  // Circadian and awakening envelope of the CRH drive (§9.4, §9.5).
  envelope(t) {
    const vars = this.k.vars, x = (t - vars[this.v.tWake]) / PARAMS.tauCAR;
    const alpha = x > 0 ? x * Math.exp(1 - x) : 0;
    return (1 + PARAMS.aC * vars[this.r.procC]) * (1 + PARAMS.aCAR * alpha);
  }

  drive(t) {
    const k = this.k, u = this.stress(t);
    return 1 + PARAMS.hpa.Gs * u + PARAMS.kCyto * Math.max(0, k.vars[this.r.pge2]) * k.g('neuroimmune', t);
  }

  stress(t) { const s = Number(this.k.input(t).stress ?? 0); return Number.isFinite(s) ? clamp(s, 0, 1) : 0; }

  // Preganglionic adrenal command as a ratio to rest (§9.6): the autonomic tone, else the stress stand-in.
  adrenalCmd(t) {
    if (this.hasAutonomic) return Math.max(0, this.k.vars[this.r.toneAdr] / PARAMS.toneAdrRest);
    return 1 + PARAMS.gAdrStandIn * this.stress(t);
  }

  pressureFall() { return Math.max(0, (PARAMS.mapRest - this.k.vars[this.r.map]) / PARAMS.mapRest); }

  raasCmd(gA) {
    const sym = this.k.vars[this.r.toneSpl] / PARAMS.toneSplRest - 1;
    return Math.max(0, 1 + PARAMS.raasPerfusionGain * this.pressureFall() + PARAMS.raasSymGain * gA * sym);
  }

  // --- Rest (§11.6): the loop's steady state for the envelope and drive at settle time. ---
  /** @param {import('./contracts').SettleInit} init @param {KernelApi} k */
  settle(init, k) {
    const vars = k.vars, v = this.v, H = PARAMS.hpa;
    vars[v.asleep] = this.sleep.has(vars[this.r.arousal] | 0) ? 1 : 0;
    const C = this.envelope(0), d = this.drive(0);
    const gA = k.g('autonomic', 0), gN = k.g('neuroendocrine', 0);   // 0 or 1 at settle; both 0 in brain-only mode
    // Body rest of the current switch set; in brain-only mode the frozen body sits at the whole-body rest.
    const on = k.bodyOn ? gN : 1;
    const S = on ? restS(C, d, H.n) : 1, F = 2 / (1 + S ** H.n);
    vars[v.crhRel] = vars[v.crh] = k.bodyOn ? C * d * (gN ? F : 1) : C * d;
    vars[v.S] = vars[v.acthRel] = vars[v.cortisolRel] = S;
    this.ring.fill(S);
    vars[v.ringIdx] = 0;
    vars[v.raas] = k.bodyOn ? gN * this.raasCmd(gA) + (1 - gN) : 1;
    vars[v.avpRel] = k.bodyOn ? gN * this.avpCmd(gA) + (1 - gN) : 1;
    vars[v.gap] = 0;
    this.display();
  }

  avpCmd(gA) {
    const f = this.pressureFall() - PARAMS.avpBaroThreshold;
    return 1 + gA * PARAMS.avpBaroGain * Math.max(0, f) / PARAMS.avpBaroThreshold;
  }

  onIntervention(preset) {
    const vars = this.k.vars, remove = /** @type {string[]} */ (preset?.params?.remove ?? []);
    for (const [gland, name] of Object.entries(GLANDS)) vars[this.k.idx(name)] = remove.includes(gland) ? 1 : 0;
  }

  // --- EN layer (1 s): one exact exponential step per second of tH. ---
  step(t, h) {
    const n = Math.max(1, Math.round(h));
    for (let q = n - 1; q >= 0; q--) this._step1(t - q);
  }

  _step1(t) {
    const k = this.k, vars = k.vars, v = this.v, H = PARAMS.hpa, dc = this.dec;
    // Wake transition (§9.5: the awakening response is a property of the state change).
    const asleep = this.sleep.has(vars[this.r.arousal] | 0) ? 1 : 0;
    if (vars[v.asleep] && !asleep) vars[v.tWake] = t;
    vars[v.asleep] = asleep;
    const relax = (x, target, d) => target + (x - target) * d;
    const gN = k.g('neuroendocrine', t), gA = k.g('autonomic', t);   // both 0 in brain-only mode
    // Feedback seen by the brain and the corticotropes: the adrenal signal, else basal (A.5 clamp).
    const Sfb = gN * vars[v.S] + (1 - gN);
    const F = 2 / (1 + Sfb ** H.n);
    vars[v.crhRel] = relax(vars[v.crhRel], this.envelope(t) * this.drive(t) * F, dc.crh);
    vars[v.crh] = vars[v.crhRel];
    if (!k.bodyOn) return;   // body frozen (A.5 master switch)

    const rmCortex = vars[v.rmCortex] === 1, rmMedulla = vars[v.rmMedulla] === 1, rmAnt = vars[v.rmAnt] === 1, rmPost = vars[v.rmPost] === 1;
    const basal = (cmd) => gN * cmd + (1 - gN);   // §11.13 hormone form
    // SAM: adrenal adrenaline (autonomic ∧ neuroendocrine); denervated medulla → basal command.
    const cmdA = 1 + gA * (this.adrenalCmd(t) - 1);
    vars[v.adrenalineRel] = relax(vars[v.adrenalineRel], rmMedulla ? 1 : basal(cmdA), dc.adr);
    // Plasma noradrenaline: nerve spillover plus the medullary share, clamped at basal with the switch
    // off like every pool of the §9.9 basal-clamp table (§9.10 "all hormone pools at basal").
    const sym = vars[this.r.toneMus] / PARAMS.toneMusRest - 1;
    const naCmd = 1 + gA * PARAMS.naNerveShare * sym + (rmMedulla ? 0 : gA * (1 - PARAMS.naNerveShare) * (this.adrenalCmd(t) - 1));
    vars[v.noradrenalinePlRel] = relax(vars[v.noradrenalinePlRel], basal(Math.max(0, naCmd)), dc.na);
    // HPA: ACTH with the delay ring, the fast adrenal signal S and the plasma pool.
    const ring = this.ring, idx = vars[v.ringIdx] | 0, acthDel = ring[idx];
    const acthCmd = vars[v.crhRel] * F * (1 + H.eE * (vars[v.adrenalineRel] - 1));
    const tA = rmAnt ? 0 : basal(acthCmd), tS = rmCortex ? 0 : basal(acthDel), tC = rmCortex || rmAnt ? 1 : basal(vars[v.S]);
    const cmdC = this.envelope(t) * this.drive(t) * F;
    // A.4 activity: the distance of each pool from its current target (a removed gland's saturated
    // steady state is not activity, §9.9).
    const rel = (x, y) => Math.abs(x - y) / Math.max(x, y, PARAMS.activeFloor);
    vars[v.gap] = Math.max(rel(vars[v.crhRel], cmdC), rel(vars[v.acthRel], tA), rel(vars[v.S], tS),
      rel(vars[v.cortisolRel], tC), rel(vars[v.adrenalineRel], rmMedulla ? 1 : basal(cmdA)));
    vars[v.acthRel] = relax(vars[v.acthRel], tA, dc.acth);
    ring[idx] = vars[v.acthRel];
    vars[v.ringIdx] = (idx + 1) % this.ringLen;
    vars[v.S] = relax(vars[v.S], tS, dc.S);
    vars[v.cortisolRel] = relax(vars[v.cortisolRel], tC, dc.cort);
    // Posterior pituitary and RAAS.
    vars[v.avpRel] = relax(vars[v.avpRel], rmPost ? 1 : basal(this.avpCmd(gA)), dc.avp);
    vars[v.oxytocinRel] = relax(vars[v.oxytocinRel], 1, dc.ot);
    const rt = basal(this.raasCmd(gA));
    vars[v.raas] = relax(vars[v.raas], rt, rt > vars[v.raas] ? dc.raasOn : dc.raasOff);
    vars[v.hpt] = relax(vars[v.hpt], basal(1), dc.scalar);
    vars[v.hpg] = relax(vars[v.hpg], basal(1), dc.scalar);
    this.display();
  }

  display() {
    const vars = this.k.vars, v = this.v, D = PARAMS.display;
    vars[v.acth] = D.acth * vars[v.acthRel];
    vars[v.cortisol] = D.cortisol * vars[v.cortisolRel];
    vars[v.adrenaline] = D.adrenaline * vars[v.adrenalineRel];
    vars[v.noradrenalinePl] = D.noradrenalinePl * vars[v.noradrenalinePlRel];
    vars[v.avp] = D.avp * vars[v.avpRel];
    vars[v.oxytocin] = D.oxytocin * vars[v.oxytocinRel];
    const S = vars[v.S];
    vars[v.mr] = S / (S + PARAMS.kMR);
    vars[v.gr] = S / (S + PARAMS.kGR);
  }

  // A.4 clock vote: ×60 ceiling while the HPA or the adrenaline pool is away from its current target
  // (a transient). A steady state, including the saturated one after a gland is removed, votes nothing.
  khVote() {
    return this.k.vars[this.v.gap] > PARAMS.activeEps ? PARAMS.khActive : Infinity;
  }
}

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'endocrine',
  scope: 'body',
  order: 50,
  fragment,
  create: (k) => new Endocrine(k),
};
