// @ts-check
// Neuroimmune network plugin (research/ANALYSIS.md §10; A.3.1 `neuroimmune`, sub-networks `ni.route`,
// `ni.reflex`, `ni.fever`, `ni.sickness`; A.3.4 state names; A.5 switch semantics; §11.3 masks,
// §11.10–§11.13 switch execution and gating forms; §12.12 the `infection` scenario; B.15 phase 8).
// Plugin contract: the header of graph.js. Scope 'body', order 60, so its fragment sees the brain
// fragment and attaches to the §3.14 ports.
//
//   kinetics   the §10.2 block on the IM layer (10 s), exponential relaxation with a transcription
//              delay ring; feed-forward from a decaying LPS source, so the self-amplifying cascade
//              stays bounded with both brakes removed (§10.9, hard check)
//   routes     fast neural: `macrophages` → `immuneAff` → `portVisc` → `ntsVisc` (autonomic ∧
//              neuroimmune); slow humoral: `macrophages` → `immuneCVO` → `portCVO` and the
//              endothelial PGE2 step `immuneCVO` ⊣ `mnpo` (EP3; Lazarus et al. 2007), plus the
//              cytokine → `pvn` edge (§10.5, k_cyto is §9's gain on `pge2`)
//   brakes     cholinergic: `portImmune` → `coeliac` → (splenicNerve) → `splenicTcells` → ACh at
//              α7nAChR on `macrophages`, autonomic ∧ neuroimmune, efferent route contested (A.8 #16);
//              glucocorticoid: `cortisolRel` (§9) on the type-1 pools, neuroendocrine ∧ neuroimmune
//   fever      tSet = 37.0 + g.neuroimmune · min(4.5, ΔT_max · pge2/(pge2 + K_P))  (§10.6, §11.13);
//              the heat balance and every effector (vasoconstriction, BAT, shivering, sweating) are
//              §6/§7's and read `tSet`; this module reads `tCore` through k.ref only
//   sickness   `sickness.<c>` ∈ [0, 1] for the nine §10.7 components, read as modifiers by §3, §5,
//              §6 and §8; this module never writes another module's state
//
// Off-semantics (A.5): with `neuroimmune` off the peripheral innate response continues (owner
// `tissue`, runs whenever bodyMode = 'body'), the central signal `pge2` and `vagAI` go to 0
// (denervation) and `tSet` returns to its 37.0 baseline (basal replacement), so cytokines run higher
// and longer and nothing is recruited. In brain-only mode every body layer is frozen and an
// endotoxin event is refused, as the scenario is unavailable (A.3.5).
//
// Units: pg/mL for `tnf il1b il6 il10` (A.3.4), ng/kg for `lps`, °C for `tSet`, dimensionless for
// `pge2`, `mac`, `vagAI` and the brakes. Time in s of tH.

import { NET } from './graph.js';

/** @typedef {import('./contracts').KernelApi} KernelApi */

export const PARAMS = {
  // --- §10.2 kinetic block (IM layer, 10 s). All [model], low confidence; the form behind §12.12. ---
  tauLPS: 600,            // s, decay of the endotoxin bolus (§10.2)
  dtx: 2100,              // s, transcription delay before macrophage activation (§10.2)
  tauMac: 900,            // s (§10.2)
  tauTNF: 1500, tauIL6: 4800, tauIL10: 3600, tauPGE: 2700,   // s (§10.2)
  tauIL1B: 1200,          // s; tissue IL-1β compartment [model], not in the §10.2 table (see below)
  aTNF: 14, aIL6: 2.2, aIL10: 1.0, c10: 1.0,                 // model units (§10.2)
  aIL1B: 1.0,             // model units; tissue IL-1β per unit of `mac` [model]
  bC: 1.5,                // glucocorticoid brake gain, per unit of cortisolRel above basal (§10.2)
  KV: 0.4,                // vagal immune afferent half-activation, PGE2 units (§10.2)
  vBrake: 0.5,            // brake_V = 1 − 0.5 · clamp(vagAI, 0, 1) (§10.2)
  // Display scales: the §10.2 rule is that the 2 ng/kg peaks read 231 pg/mL TNF (Copeland et al.
  // 2005) and ≈ 1,000 pg/mL IL-6 (same). Calibrated on the reference run of this module (all
  // networks on, no endocrine module, so cortisolRel = 1); §10.10 lists the absolute scaling of the
  // pools as open. pg/mL per model unit [model].
  sTNF: 56.4, sIL6: 286, sIL10: 56.4, sIL1B: 56.4,
  // --- §10.6 fever ---
  dTmax: 2.2,             // °C, set-point law amplitude (§10.6 [model]; gives ≈ +1.5 °C at 2 ng/kg)
  KP: 0.6,                // PGE2 units, set-point half-activation (§10.6 [model])
  dTcap: 4.5,             // °C; the 41–42 °C practical ceiling of [G Fever L42] (§10.2, §10.6)
  tSetBase: 37.0,         // °C, baseline set point (§7 owner; §10.6 row)
  // PGE2 → autonomic command gains, each × pge2/(pge2 + K_P): sympathetic (+), cardiac vagal (−),
  // adrenal medulla (+) (§10.6 [model], low). Published here as commands for §7 to read; this module
  // never writes an autonomic channel.
  cmdSym: 0.6, cmdVag: 0.5, cmdAdr: 0.3,
  // --- NF drive of the two afferent routes ---
  // The route latencies of §10.3 (vagal "minutes", humoral "tens of minutes", both [T]/[model], and
  // §10.10 records that no source gives a number for the humoral route) live in the IM kinetics
  // (δ_tx, τ_PGE), not in edge delays, so the drawn edges keep their anatomical conduction times.
  recRmax: 100,           // Hz, output ceiling of the two sensing nodes [model]
  // Working range of the two sensing nodes, as a fraction of rmax: just under the §11.8 emission
  // threshold (rest + 0.1 rmax). A slow tonic immune signal is not a volley — §13 draws cytokines as
  // short-range diffuse clouds with occasional long-range blood transport, not as packet trains — and
  // keeping both routes under that threshold also keeps the NF cascade below the §11.6 "elevated"
  // bound, so the layer strides through hours of tH instead of updating every 0.5 ms. The magnitude
  // of the immune → brain rate change is "low (magnitude)" confidence in §10.3; the fever, heart-rate
  // and sickness effects run through `tSet`, the published commands and the §10.7 modifiers. [model]
  driveMax: 0.09,
  // The two drives are applied in quantised steps of this fraction of rmax, as brainnet does for
  // g_NE (its PARAMS.gNEQuantum): the kernel wakes a node's targets only on steps that change a
  // drive by more than its sleep threshold (§11.6), so a drive creeping with τ_PGE = 2,700 s would
  // hold the NF layer at full update for hours of tH. Quantised steps propagate and strides resume
  // between them. [model]
  driveQuantum: 0.01,
  wCVO: 1.0,              // weight of `immuneCVO` → `portCVO` (humoral entry) [model]
  wEP3: -0.5,             // `immuneCVO` ⊣ `mnpo`: EP3 inhibits the tonically inhibitory preoptic
                          // output and so disinhibits `dmh` → `rpa` (§10.6) [model]
  wPVN: 0.5,              // cytokine → `pvn` (§10.5; k_cyto is §9's gain on `pge2`) [model]
  wAff: 1.0,              // `immuneAff` → `portVisc` (vagal immune afferent) [model]
  // --- §10.7 sickness behaviour: amplitude per component, saturating in the central signal ---
  // Every component is medium confidence at best as a human quantity (§10.7), so the weights and the
  // half-activation are [model]; the HUD describes what changes, not why.
  KS: 1.0,                // PGE2 units, half-activation of the sickness components [model]
  sickness: { hyperalgesia: 0.9, anorexia: 0.8, lethargy: 0.9, sleepiness: 0.8, concentration: 0.6,
    mood: 0.5, anxiety: 0.4, malaise: 0.9, grooming: 0.7 },
  // --- Clock (§11.7) ---
  khImmune: 900,          // A.4 `immune` preset; voted while cytokines are present or |tCore − tSet| > 0.05
  khTempEps: 0.05,        // °C (§11.7)
  cytokineEps: 0.5,       // pg/mL; "cytokines present" [model]
  // --- Body anchors (§2, A.2 precedence; §10.1 reads the spleen and coeliac anchors) ---
  pos: /** @type {Record<string, import('./contracts').Vec3>} */ ({
    spleen: [-108, -55, -458], spleenHilum: [-86, -40, -460],
    coeliac: [18, -10, -470], splenicMid: [-45, -12, -472],
    macrophages: [-90, -45, -458],      // splenic red pulp, the reflex endpoint [model]
    immuneAff: [0, -5, -455],           // abdominal vagal afferent terminal field [model]
    portCVO: [0, -44, -56],             // fallback if the brain fragment is absent (§3.14 port)
  }),
};

export const SICKNESS_IDS = Object.freeze(Object.keys(PARAMS.sickness));
/** A.3.4 immune state names this module declares (`tSet` only when §7 has not declared it). */
export const STATE_NAMES = Object.freeze(['lps', 'mac', 'tnf', 'il1b', 'il6', 'il10', 'pge2', 'vagAI', 'vns',
  'brakeC', 'brakeV', 'tSetShift', ...SICKNESS_IDS.map((c) => `sickness.${c}`)]);

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sat = (x, K) => (x > 0 ? x / (x + K) : 0);

// --- Fragment (§10.1 node ids; §11.3 ownership and edge `nets`) ---
// `coeliac` is declared `shared: true` because §7's autonomic fragment needs the same prevertebral
// ganglion; the first declaration wins (graph.js contract §1).
/**
 * @param {import('./contracts').FragmentContext} ctx
 * @returns {import('./contracts').Fragment}
 */
function fragment(ctx) {
  const P = PARAMS.pos;
  /** @type {import('./contracts').NodeSpec[]} */
  const nodes = [
    // Peripheral innate response: `tissue`, so it runs whenever bodyMode = 'body' and no switch
    // removes it (A.8 decision 9, §10.1).
    { id: 'macrophages', kind: 'organ', owner: 'tissue', layer: 'IM', pos: P.macrophages, shared: true, label: 'macrophages (α7nAChR)' },
    { id: 'spleen', kind: 'organ', owner: 'tissue', layer: 'IM', pos: P.spleen, shared: true, label: 'spleen' },
    { id: 'splenicTcells', kind: 'organ', owner: 'tissue', layer: 'IM', pos: P.spleenHilum, shared: true, label: 'ACh-synthesising T cells' },
    // The two sensing elements of §10.3. They are the NF sources that carry the immune signal into
    // the brain ports, so they are rate units with a direct transfer (the IM layer sets their drive).
    { id: 'immuneAff', kind: 'receptor', owner: 'ni.route', pos: P.immuneAff, rmax: PARAMS.recRmax, rSpont: 0,
      xfer: 'direct', log: true, label: 'vagal immune afferent' },
    { id: 'immuneCVO', kind: 'receptor', owner: 'ni.route', pos: ctx.pos('portCVO') ?? P.portCVO, rmax: PARAMS.recRmax,
      rSpont: 0, xfer: 'direct', log: true, label: 'CVO and endothelial cytokine sensing (mPGES-1, EP3)' },
    { id: 'coeliac.R', kind: 'ganglion', owner: 'ans.symp', side: 'R', pos: P.coeliac, shared: true, label: 'coeliac ganglion' },
    { id: 'coeliac.L', kind: 'ganglion', owner: 'ans.symp', side: 'L', pos: ctx.mirror(P.coeliac), shared: true, label: 'coeliac ganglion' },
  ];
  // §2 route of the splenic artery and nerve (left coeliac ganglion → splenic hilum), contested (A.8 #16).
  const paths = { splenicNerve: [ctx.mirror(P.coeliac), P.splenicMid, P.spleenHilum] };

  /** @type {import('./contracts').NetId[]} */ const NI = ['neuroimmune'];
  /** @type {import('./contracts').NetId[]} */ const AN_NI = ['autonomic', 'neuroimmune'];
  /** @type {import('./contracts').NetId[]} */ const AN_EN_NI = ['autonomic', 'enteric', 'neuroimmune'];
  /** @type {import('./contracts').EdgeSpec[]} */
  const edges = [
    // Immune → brain, fast neural route (§10.3; §11.11 "vagal immune sensing").
    { from: 'macrophages', to: 'immuneAff', kind: 'volume', nets: AN_NI, nSyn: 0, transmitter: 'IL-1β/ATP', label: 'cytokines at the afferent terminal' },
    { from: 'immuneAff', to: 'portVisc.R', kind: 'axon', fibre: 'C', nets: AN_NI, nSyn: 0, w: PARAMS.wAff, transmitter: 'Glu', label: 'cn10.aff (immune)' },
    { from: 'immuneAff', to: 'portVisc.L', kind: 'axon', fibre: 'C', nets: AN_NI, nSyn: 0, w: PARAMS.wAff, transmitter: 'Glu', label: 'cn10.aff (immune)' },
    // Immune → brain, slow humoral route and the endothelial PGE2 step (§10.3, §10.6).
    { from: 'macrophages', to: 'immuneCVO', kind: 'blood', nets: NI, nSyn: 0, label: 'blood cytokines' },
    { from: 'immuneCVO', to: 'portCVO', kind: 'volume', nets: NI, w: PARAMS.wCVO, label: 'CVO and choroid-plexus entry' },
    { from: 'immuneCVO', to: 'mnpo', kind: 'volume', nets: NI, w: PARAMS.wEP3, transmitter: 'PGE2', label: 'PGE2 at EP3 (mnpo)' },
    { from: 'immuneCVO', to: 'pvn.R', kind: 'volume', nets: NI, w: PARAMS.wPVN, label: 'cytokine → pvn' },
    { from: 'immuneCVO', to: 'pvn.L', kind: 'volume', nets: NI, w: PARAMS.wPVN, label: 'cytokine → pvn' },
    // Brain → immune: the inflammatory reflex efferent (§10.4; route contested, A.8 #16).
    { from: 'portImmune.R', to: 'coeliac.R', kind: 'axon', fibre: 'B', nets: AN_NI, transmitter: 'ACh', label: 'cn10.para (contested, A.8 #16)' },
    { from: 'portImmune.L', to: 'coeliac.L', kind: 'axon', fibre: 'B', nets: AN_NI, transmitter: 'ACh', label: 'cn10.para (contested, A.8 #16)' },
    { from: 'coeliac.L', to: 'splenicTcells', kind: 'axon', fibre: 'Cpost', nets: AN_NI, path: 'splenicNerve', transmitter: 'NA', label: 'splenicNerve' },
    { from: 'splenicTcells', to: 'macrophages', kind: 'volume', nets: AN_NI, nSyn: 0, transmitter: 'ACh', label: 'ACh at α7nAChR' },
    // Sympathetic lymphoid brake, drawn alongside the cholinergic route (§10.5).
    { from: 'coeliac.L', to: 'spleen', kind: 'axon', fibre: 'Cpost', nets: AN_NI, path: 'splenicNerve', transmitter: 'NA', label: 'splenic sympathetic' },
    // Gut branch of the inflammatory reflex (§10.4, §11.11): lost if any of the three is off.
    { from: 'portVag.R', to: 'macrophages', kind: 'axon', fibre: 'B', nets: AN_EN_NI, transmitter: 'ACh', label: 'gut branch (enteric cholinergic)' },
    // The glucocorticoid brake is drawn by §9 (endocrine.js: cortisol → macrophages, neuroendocrine ∧
    // neuroimmune); the brake itself reads `cortisolRel` through k.ref.
  ];
  return { nodes, edges, paths };
}

// --- Instance ---
class Immune {
  /** @param {KernelApi} k */
  constructor(k) {
    this.k = k;
    const S = PARAMS.sickness;
    this.vLps = k.declare('lps', 0, { unit: 'ng/kg' });
    this.vMac = k.declare('mac', 0);
    this.vTnf = k.declare('tnf', 0, { unit: 'pg/mL' });
    // Plasma IL-1β does not rise measurably at this dose range (Michie et al. 1988), so `il1b` is a
    // tissue-compartment concentration and never drives the PVN (§10.2).
    this.vIl1b = k.declare('il1b', 0, { unit: 'pg/mL (tissue)' });
    this.vIl6 = k.declare('il6', 0, { unit: 'pg/mL' });
    this.vIl10 = k.declare('il10', 0, { unit: 'pg/mL' });
    this.vPge2 = k.declare('pge2', 0);
    this.vVagAI = k.declare('vagAI', 0);
    // Vagus nerve stimulation: a relative efferent drive (0–1, model; experimental, §10.4).
    this.vVns = k.declare('vns', 0);
    this.vBrakeC = k.declare('brakeC', 1, { basal: 1 });
    this.vBrakeV = k.declare('brakeV', 1, { basal: 1 });
    this.vShift = k.declare('tSetShift', 0, { unit: '°C' });
    // Commands published for §7 (§10.6); read through k.ref, applied by the autonomic module.
    this.vCmdSym = k.declare('immuneCmdSym', 0);
    this.vCmdVag = k.declare('immuneCmdVag', 0);
    this.vCmdAdr = k.declare('immuneCmdAdr', 0);
    this.vSick = Object.fromEntries(SICKNESS_IDS.map((c) => [c, k.declare(`sickness.${c}`, 0)]));
    this.sickW = S;
    // `tSet` is shared: §7 owns its 37.0 baseline, §10 the fever shift (A.3.4). Plugins create in
    // `order`, so §7 (order 30) has already declared it when this runs; if it has not, this module
    // owns the readout so that the §12.20 row 41 check (ΔtSet = 0) works with the immune module
    // alone. `tSetShift` is published either way.
    this.ownsTSet = k.idx('tSet') < 0;
    this.vTSet = this.ownsTSet ? k.declare('tSet', PARAMS.tSetBase, { unit: '°C', basal: PARAMS.tSetBase }) : k.idx('tSet');
    // Transcription delay ring on the IM grid (§11.6: "transcription delay ring").
    this.ringLen = Math.round(PARAMS.dtx / 10) + 1;
    k.declareArray('imm.lpsRing', this.ringLen, 0);
    this.vN = k.declare('imm.n', 0);

    k.on('lps', (ev) => this.onLps(ev));
    k.on('vns', (ev) => this.onVns(ev));
    k.on('intervention', (preset) => this.onIntervention(preset));
    k.onLayer('IM', (t, h) => this.step(t, h));
    k.onKhVote(() => this.khVote());
  }

  /** @param {KernelApi} k */
  init(k) {
    this.ring = k.array('imm.lpsRing');
    // Cross-module reads: A.3.4 names with their A.5 basal fallbacks (cortisol basal, tCore 37.0).
    this.vCortisol = k.ref('cortisolRel', 1);
    this.vTCore = k.ref('tCore', 37.0);
    this.jAff = k.nfIndex('immuneAff');
    this.jCVO = k.nfIndex('immuneCVO');
    // Efferent chain of the splenic route (portImmune.L → coeliac.L → splenicTcells) and the gut branch.
    this.eEff = k.edgeIndex('portImmune.L', 'coeliac.L');
    this.eSplenic = k.edgeIndex('coeliac.L', 'splenicTcells');
    this.eGut = k.edgeIndex('portVag.R', 'macrophages');
  }

  // Share of an edge that is not cut or scaled by an intervention (its network gate taken out).
  _pass(e, t) {
    if (e < 0) return 1;
    const k = this.k, gm = k.gate(k.graph.edges[e].nets, t);
    return gm > 0 ? Math.min(1, k.edgeGate(e, t) / gm) : 1;
  }

  // Truncal vagotomy (§10.8, §11.12; the preset is §7's): the abdominal cn10 edges of this module go
  // with it. A preset other than vns (or none) ends the stimulation (one preset at a time, §11.12).
  onIntervention(preset) {
    const k = this.k;
    if (preset?.id === 'truncalVagotomy') {
      for (const [a, b] of VAGOTOMY_EDGES) { const e = k.edgeIndex(a, b); if (e >= 0) k.cutEdge(e, true); }
    }
    if (preset?.id !== 'vns') k.vars[this.vVns] = 0;
  }

  // An endotoxin bolus (§12.3: 2 ng/kg i.v.). In brain-only mode there is no immune tissue and the
  // scenario is unavailable (A.3.5, A.5), so the event is refused.
  onLps(ev) {
    const k = this.k, dose = Number(ev?.dose ?? 0);
    if (!(dose > 0)) return;
    if (!k.bodyOn) { k.log({ kind: 'lps-refused', node: 'macrophages', label: 'brain only: no immune tissue' }); return; }
    k.vars[this.vLps] += dose;
    k.log({ kind: 'lps', node: 'macrophages', label: `endotoxin ${dose} ng/kg ${ev?.route ?? 'iv'}` });
  }

  // VNS slider (§10.4): a relative efferent drive, 0–1, model units, experimental.
  onVns(ev) { this.k.vars[this.vVns] = clamp(Number(ev?.drive ?? ev?.value ?? 0), 0, 1); }

  // §11.7 clock vote: the A.4 `immune` preset while cytokines are present or the core temperature is
  // away from the set point.
  khVote() {
    const v = this.k.vars;
    const active = v[this.vTnf] + v[this.vIl6] > PARAMS.cytokineEps
      || Math.abs(v[this.vTCore] - v[this.vTSet]) > PARAMS.khTempEps;
    return active ? PARAMS.khImmune : Infinity;
  }

  // IM layer, 10 s: the §10.2 kinetic block, the §10.6 set point and the §10.7 modifiers.
  step(t, h) {
    const k = this.k, v = k.vars, P = PARAMS;
    const dec = (tau) => Math.exp(-h / tau);
    const gNI = k.g('neuroimmune', t), gNE = k.g('neuroendocrine', t), gEnt = k.g('enteric', t);

    // Transcription delay ring: write the current LPS level, read the oldest slot (δ_tx earlier).
    const n = v[this.vN] | 0;
    this.ring[n % this.ringLen] = v[this.vLps];
    v[this.vN] = n + 1;
    const lpsDelayed = this.ring[(n + 1) % this.ringLen];

    // Brakes (§10.2, §11.13): brake_C uses g.neuroendocrine · g.neuroimmune; brake_V uses
    // g.autonomic · g.neuroimmune times the uncut share of every edge on the efferent chain
    // (portImmune.L → coeliac.L → splenicTcells), so splenic denervation or truncal vagotomy removes it;
    // the gut branch term takes its own edge gate (autonomic ∧ enteric ∧ neuroimmune, §11.11).
    const excess = Math.max(0, v[this.vCortisol] - 1);
    const brakeC = 1 / (1 + P.bC * excess * gNE * gNI);
    const gEff = this.eSplenic >= 0 ? k.gate(k.graph.edges[this.eSplenic].nets, t) * this._pass(this.eEff, t) * this._pass(this.eSplenic, t) : 0;
    const gGut = this.eGut >= 0 ? k.edgeGate(this.eGut, t) : gEnt;
    const pge2 = v[this.vPge2];
    const vagAI = gEff * (sat(pge2, P.KV) * (1 + 0.1 * gGut) + v[this.vVns]);
    const brakeV = 1 - P.vBrake * clamp(vagAI, 0, 1);
    v[this.vBrakeC] = brakeC; v[this.vBrakeV] = brakeV; v[this.vVagAI] = vagAI;

    // Pools. The chain is feed-forward from a decaying source, so it is bounded with both brakes
    // removed (§10.9, hard check). Model-unit pools are stored in their A.3.4 display units, which is
    // exact because each pool is linear in its source term.
    const macT = lpsDelayed;
    v[this.vMac] = macT + (v[this.vMac] - macT) * dec(P.tauMac);
    const mac = v[this.vMac];
    const tnfT = P.aTNF * mac * brakeC * brakeV * P.sTNF;
    v[this.vTnf] = tnfT + (v[this.vTnf] - tnfT) * dec(P.tauTNF);
    const tnfModel = v[this.vTnf] / P.sTNF;
    const il6T = P.aIL6 * tnfModel * brakeC * brakeC * P.sIL6;
    v[this.vIl6] = il6T + (v[this.vIl6] - il6T) * dec(P.tauIL6);
    // Type 2: upregulated by cortisol and not braked by ACh on its own source term (§10.2, §10.5).
    const il10T = P.aIL10 * tnfModel * (1 + P.c10 * excess) * P.sIL10;
    v[this.vIl10] = il10T + (v[this.vIl10] - il10T) * dec(P.tauIL10);
    const il1bT = P.aIL1B * mac * P.sIL1B;
    v[this.vIl1b] = il1bT + (v[this.vIl1b] - il1bT) * dec(P.tauIL1B);
    const pgeT = gNI * (v[this.vIl6] / P.sIL6);
    v[this.vPge2] = pgeT + (v[this.vPge2] - pgeT) * dec(P.tauPGE);
    v[this.vLps] *= dec(P.tauLPS);

    const p = v[this.vPge2];
    // Set point (§10.6, §11.13). The 4.5 °C cap is the 41–42 °C practical ceiling.
    const shift = gNI * Math.min(P.dTcap, P.dTmax * sat(p, P.KP));
    v[this.vShift] = shift;
    if (this.ownsTSet) v[this.vTSet] = P.tSetBase + shift;
    // PGE2 → autonomic commands (§10.6): published for §7, gated there with g.autonomic.
    const s = sat(p, P.KP);
    v[this.vCmdSym] = gNI * P.cmdSym * s;
    v[this.vCmdVag] = -gNI * P.cmdVag * s;
    v[this.vCmdAdr] = gNI * P.cmdAdr * s;
    // Sickness behaviour (§10.7): saturating in the central signal, zero when the switch is off.
    const sick = sat(p, P.KS);
    for (const c of SICKNESS_IDS) v[this.vSick[c]] = clamp(gNI * this.sickW[c] * sick, 0, 1);

    // Afferent drive of the two routes: the fast neural one carries the vagal immune signal, the
    // slow humoral one the blood cytokine and endothelial PGE2 signal (§10.3).
    const q = (x) => P.recRmax * P.driveMax * Math.round(clamp(x, 0, 1) / P.driveQuantum) * P.driveQuantum;
    if (this.jAff >= 0) k.setExt(this.jAff, q(sat(v[this.vTnf] / P.sTNF, P.KV)));
    if (this.jCVO >= 0) k.setExt(this.jCVO, q(s));
  }
}

// --- §10.8 interventions, as data (§11.12 owner semantics; one preset at a time) ---
/** @type {import('./contracts').InterventionPreset} */
export const splenicDenervation = {
  id: 'splenicDenervation',
  label: 'Splenic denervation (§10.8)',
  net: 'neuroimmune',
  apply(k) {
    for (const [a, b] of [['coeliac.L', 'splenicTcells'], ['coeliac.L', 'spleen']]) {
      const e = k.edgeIndex(a, b);
      if (e >= 0) k.cutEdge(e, true);
    }
  },
};

/**
 * Vagus nerve stimulation (§10.4, §10.8): a relative efferent drive, 0–1, model units. Animal and
 * early human data (Borovikova et al. 2000; Koopman et al. 2016, open-label, n = 17); not a clinical
 * setting and never a clinical unit.
 * @param {number} [drive]
 * @returns {import('./contracts').InterventionPreset}
 */
export const vns = (drive = 1) => ({
  id: 'vns',
  label: 'Vagus nerve stimulation (slider; experimental)',
  net: 'neuroimmune',
  params: { drive: clamp(drive, 0, 1) },
  apply(k) { k.set('vns', clamp(drive, 0, 1)); },
});

export const INTERVENTIONS = Object.freeze({ splenicDenervation, vns });

/** Edge ends this module cuts itself when §7's truncal-vagotomy preset is applied (§10.8, §11.12). */
export const VAGOTOMY_EDGES = Object.freeze([['immuneAff', 'portVisc.R'], ['immuneAff', 'portVisc.L'],
  ['portImmune.R', 'coeliac.R'], ['portImmune.L', 'coeliac.L'], ['portVag.R', 'macrophages']]);

/** Network bit of this module (§11.3). */
export const NET_BIT = NET.neuroimmune;

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'immune',
  scope: 'body',
  order: 60,
  fragment,
  create: (k) => new Immune(k),
};
export { Immune, fragment };
