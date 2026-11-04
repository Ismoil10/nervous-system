// @ts-check
// Brain network plugin (research/ANALYSIS.md §3, §4.8, §4.9, §4.13; §11.5, §11.15, §13.6–§13.7; B.4).
// The brain fragment of the simulation graph: nuclei, cortical areas, tracts, the 21 ports that body
// fragments attach to (§3.14) and the five modulator pools (§3.10). The instance (BrainNet) owns the
// arousal state machine (§3.11), salience and the LC phasic response (§3.12, §4.9), the pools and
// the noradrenergic and relay gains (§4.8), and the rest-normalised activity per sided region and
// per sided cortical area for StateTextures.compose (B.4, §11.15, §13.7). Plugin contract: graph.js.
//
//   nodes      one rate unit per side (`id.R`, `id.L`; midline structures unsided, A.3.2), classes of
//              Table 4.13a (τ) and Table 4.8b (rmax); resting rates §3 where given, else [model]
//   edges      §3.15 table and §3.3–§3.14 flows; d = L/v + n_syn·t_syn with the §3.16 routes and the
//              Table 4.4b tract classes; driver w ±1 (Table 4.8e); modulatory inputs (L6 feedback,
//              thalRet, PPN/LDT, ACh) capped at Σ|w| ≤ 0.2 per target [model]
//   pools      τ_p dP/dt = mean(r_src / r_src,rest) − P (CV layer), so P = 1 in wakeRelaxed (§3.10)
//   g_NE       clamp(1 + γ_t·(modNE − 1) + γ_p·lcPhasic, 0.7, 2.0) on the slope of sensory relays and
//              primary sensory areas (§4.8); relay gain of the state on the thalamic input sum (§3.3, §3.11)
//   salience   min(1, I_n · N · (b + c)), N = g_hab · (1 − p̂), g_hab = 1/(1 + k_hab·H) (§3.12, §4.9, §5.12)
//   activity   clamp(1 + 0.8·(a − a_rest), 0.6, 1.8), low-passed with τ 0.3 s of screen time (§13.7)
//
// State drives are tonic external drives on the modulator sources, solved so that each source sits at
// its §3.11 target rate given the targets of the other driven sources (the flip-flop edges included).

import * as A from '../anatomy.js';
import { mirror } from './graph.js';

export const STATES = Object.freeze(['wakeAlert', 'wakeRelaxed', 'n1', 'n2', 'n3', 'rem']);   // §3.11
const S_IDX = Object.fromEntries(STATES.map((s, i) => [s, i]));
const SLEEP = new Set([2, 3, 4, 5]);

export const PARAMS = {
  // Node classes: τ s (Table 4.13a), rmax Hz (Table 4.8b), resting rate Hz ([model] unless §3 gives one).
  classes: {
    relay: { tau: 0.0006, rmax: 300, rSpont: 5 },      // fast sensory relays
    inter: { tau: 0.0015, rmax: 200, rSpont: 4 },      // brainstem interneurons, cranial motor nuclei
    retic: { tau: 0.010, rmax: 200, rSpont: 4 },       // reticular premotor pno gi mrf
    pnc: { tau: 0.020, rmax: 200, rSpont: 4, theta: 0.7 },   // PnC: θ 0.7 (Table 4.8a), τ 20 ms (§4.11)
    auto: { tau: 0.003, rmax: 50, rSpont: 2 },         // autonomic premotor and preganglionic
    assoc: { tau: 0.005, rmax: 100, rSpont: 5 },       // thalamic association, BG and cerebellar nuclei
    limbic: { tau: 0.020, rmax: 50, rSpont: 1 },       // limbic, hypothalamic, forebrain
    modsrc: { tau: 0.020, rmax: 50, rSpont: 2 },       // modulator sources
    cortex: { tau: 0.010, rmax: 100, rSpont: 2 },      // cortical areas
    portEff: { tau: 0.0006, rmax: 300, rSpont: 3 },    // efferent ports (fast relay)
    // Afferent ports rest at 15 Hz [model], so that a silenced port (tonic drive gated off, A.5) falls
    // to the logistic floor F(0) ≈ 4.6 Hz instead of rising to it.
    portAff: { tau: 0.0006, rmax: 300, rSpont: 15 },
  },
  rates: {                     // §3 resting rates (wakeRelaxed) and their rmax where the class default is too low
    gpi: [70, 150], gpe: [60, 150], snr: [60, 150], stn: [20, 100],    // §3.5 model values
    msn: [1, 50],                                                      // §3.5 MSN rate (model 1)
    purkinje: [60, 200],                                               // §3.6 simple-spike rate (model 60)
    deepCb: [40, 150],                                                 // deep cerebellar nuclei [model]
    lc: [2, 50],                                                       // §3.10/§3.11: 2 Hz in wakeRelaxed
    dr: [3, 50],                                                       // §3.10: 1–5 Hz [model 3]
    tmn: [2, 50], lh: [2, 50],                                         // §3.10: 1–4 Hz; "a few" [model 2]
    ppn: [8, 50],                                                      // §3.10: waking 8 Hz [model]
    ach: [4, 50],                                                      // basal forebrain cholinergic [model]
    vlpo: [0.5, 50],                                                   // sleep-active, quiet in waking [model]
    vp: [30, 150],                                                     // ventral pallidum, tonic [model]
    da: [4, 50],                                                       // VTA/SNc tonic (DOPAMINE.md runs its own model) [model]
  },
  modCap: 0.2,                 // Σ|w| of modulatory inputs per target [model]; drivers keep w ±1 (Table 4.8e)
  junctionDx: 3,               // mm; sided junction ports sit ± this from the midline [model] (§3.14: (ξ, η) from §6)
  junctionPorts: { portSTT: [5, -42, -72], portSymp: [5, -44, -72], portRS: [4, -45, -72], portCST: [3, -40, -72] },   // §3.16 route ends [model x]
  cerebellumPos: [25, -60, -40],   // cerebellar cortex node: §3.16 tractMCP end, mirrored to the right [model]
  // Pools (§3.10): τ s and sources.
  pools: {
    modNE: { tau: 2, src: ['lc'] },
    modACh: { tau: 1, src: ['nbm', 'msdb', 'hdb', 'ppn', 'ldt'] },
    mod5HT: { tau: 7, src: ['dr', 'mnr'] },
    modHA: { tau: 10, src: ['tmn'] },
    modOX: { tau: 30, src: ['lh'] },
  },
  // §3.11 state table: pools, LC rate (Hz), relay gain, arousal factor; vlpo rate (Hz) and PnO factor
  // (REM-on) [model].
  states: {
    wakeAlert: { NE: 1.5, HT: 1.2, HA: 1.2, ACh: 1.2, OX: 1.5, lc: 3, relay: 1.0, factor: 1, vlpo: 0.3, pno: 1 },
    wakeRelaxed: { NE: 1, HT: 1, HA: 1, ACh: 1, OX: 1, lc: 2, relay: 1.0, factor: 1, vlpo: 0.5, pno: 1 },
    n1: { NE: 0.75, HT: 0.7, HA: 0.5, ACh: 0.5, OX: 0.3, lc: 1.5, relay: 0.6, factor: 1.5, vlpo: 3, pno: 1 },
    n2: { NE: 0.5, HT: 0.5, HA: 0.1, ACh: 0.25, OX: 0.1, lc: 1, relay: 0.35, factor: 2.5, vlpo: 6, pno: 1 },
    n3: { NE: 0.4, HT: 0.4, HA: 0.05, ACh: 0.15, OX: 0.05, lc: 0.8, relay: 0.2, factor: 3.5, vlpo: 8, pno: 1 },
    rem: { NE: 0, HT: 0, HA: 0, ACh: 1.0, OX: 0.1, lc: 0, relay: 0.5, factor: 3.0, vlpo: 5, pno: 4 },
  },
  minRateFrac: 1e-3,           // floor of a state target rate, fraction of rmax ("≈ 0" in REM) [model]
  // Two-process model (§3.11).
  // Resting day of the §3.11 model check: asleep 23:06–06:59 (used only to start procS at settle).
  procS: { tauRise: 18.2 * 3600, tauDecay: 4.2 * 3600, deep: 0.35, wakeTime: 6 * 3600 + 59 * 60, sleepTime: 23 * 3600 + 6 * 60 },
  thresholds: { up: 0.63, down: 0.20, cAmp: 0.12 },   // H⁺ = 0.63 + 0.12·procC; H⁻ = 0.20 + 0.12·procC
  procCPhase: 17 * 3600,       // s; procC = cos(2π (t_clock − 17 h) / 24 h)
  day: 86400,
  n1Hold: 300,                 // s of N1 after sleep onset and after each REM episode (§3.11)
  cycle: 5400, remFirst: 600, remStep: 300,   // s: 90-min cycle; REM 10 min, +5 min per cycle (§3.11)
  // Salience (§3.12) and habituation (§4.9, §5.12).
  thetaS: 0.25, b: 0.3,
  kHab: 0.25, tauRec: 300, rho: 1,
  tauPred: 0.5,                // s, τ_pred (Table 4.9)
  tauSalience: 2,              // s, decay of the salience readout [model]
  salWindow: 2,                // s, duration of the network response to a salient event [model]
  salDrive: { insAnt: 0.3, dacc: 0.3, dlpfc: 0.3, ppc: 0.3, pcc: -0.3, precuneus: -0.3, mpfc: -0.3, angular: -0.3, cea: 0.3 },   // drive per unit salience; ±0.3 §3.12, insula/dACC/CeA [model]
  // LC phasic response (§3.10): latency 100 ms, 3 spikes at 15 Hz (0.2 s), suppression 500 ms.
  lcLatency: 0.1, lcBurstHz: 15, lcBurstS: 0.2, lcSuppressS: 0.5, lcSuppressHz: 0.2,
  // NE gain (Table 4.8c).
  gammaT: 0.5, gammaP: 1.0, gNEMin: 0.7, gNEMax: 2.0,
  // The gain is applied in steps of 0.01 [model]: the kernel wakes a node's targets only on steps
  // that change it by more than its sleep threshold (§11.6), so a gain drifting smoothly with the pool
  // (τ 2 s) would leave downstream nodes stale. Quantised steps propagate, and the last one is exactly 1.
  gNEQuantum: 0.01,
  // Display (§13.7).
  display: { k: 0.8, min: 0.6, max: 1.8, tau: 0.3 },
  quietEps: 1e-9,
  // §13.6 tints (sRGB 0–1) on source nuclei and the state-table maxima mod_max.
  tints: {
    NE: { rgb: [0xa2, 0xdf, 0xff], pool: 'modNE', max: 1.5, src: ['lc'] },
    ACh: { rgb: [0xb4, 0xff, 0xe4], pool: 'modACh', max: 1.2, src: ['nbm', 'msdb', 'hdb', 'ppn', 'ldt'] },
    '5HT': { rgb: [0xe1, 0xca, 0xff], pool: 'mod5HT', max: 1.2, src: ['dr', 'mnr', 'rmg', 'rpa', 'rob'] },
    HA: { rgb: [0xff, 0xbf, 0xb9], pool: 'modHA', max: 1.2, src: ['tmn'] },
    OX: { rgb: [0xe9, 0xff, 0xc9], pool: 'modOX', max: 1.5, src: ['lh'] },
  },
  tintMix: 0.8,                // m = 0.8 · a_mod (§13.6)
  areaColumns: 64,             // matches StateTextures PARAMS.areas (sided area column 2·area + s)
};

// --- Node table (A.3.3; classes Table 4.13a; positions §3.16 through anatomy.js nodePos) ---
// [id, class, opts]: region (render region id, default id), regions, rates (PARAMS.rates key), kind,
// relay (thalamic relay gain), ne (NE slope gain), log (event-log crossings).
const N = [
  // Thalamus (§3.3)
  // The state's relay gain multiplies the input sum of the first-order sensory relays only: on the
  // basal-ganglia-recipient and association nuclei it would also scale their tonic pallidal
  // inhibition and so raise their rates in sleep [model].
  ['thalAnt', 'assoc'], ['thalMD', 'assoc'], ['thalVA', 'assoc'], ['thalVL', 'assoc'],
  ['thalVPL', 'relay', { relay: 1, ne: 1, log: 1 }], ['thalVPM', 'relay', { relay: 1, ne: 1, log: 1 }], ['thalVPMpc', 'relay', { relay: 1, ne: 1, log: 1 }],
  ['thalVMpo', 'relay', { relay: 1, ne: 1, log: 1 }], ['thalCM', 'assoc'], ['thalPulv', 'assoc'], ['thalRet', 'assoc'],
  ['lgn', 'relay', { relay: 1, ne: 1, log: 1 }], ['mgn', 'relay', { relay: 1, ne: 1, log: 1 }],
  // Basal ganglia (§3.5)
  ['putamen', 'assoc', { region: 'dorsalStriatum', rates: 'msn' }], ['caudate', 'assoc', { rates: 'msn' }],
  ['nacc', 'assoc', { regions: ['naccCore', 'naccShell'], rates: 'msn' }],
  ['gpe', 'assoc', { rates: 'gpe' }], ['gpi', 'assoc', { rates: 'gpi' }], ['stn', 'assoc', { rates: 'stn' }], ['snr', 'assoc', { rates: 'snr' }],
  ['vp', 'assoc', { rates: 'vp' }], ['snc', 'limbic', { rates: 'da' }], ['vta', 'limbic', { rates: 'da' }], ['rmtg', 'limbic'],
  // Basal forebrain and limbic (§3.7, §3.10)
  ['nbm', 'modsrc', { rates: 'ach' }], ['msdb', 'modsrc', { rates: 'ach' }], ['hdb', 'modsrc', { rates: 'ach' }],
  ['bnst', 'limbic'], ['habenula', 'limbic'], ['cea', 'limbic'], ['amygdala', 'limbic', { log: 1 }], ['hippocampus', 'limbic'],
  // Hypothalamus and circumventricular organs (§3.8)
  ['hypothalamus', 'limbic'], ['mpoa', 'limbic'], ['pvn', 'limbic'], ['arcuate', 'limbic'], ['scn', 'limbic', { kind: 'oscillator' }],
  ['son', 'limbic'], ['vlpo', 'limbic', { rates: 'vlpo' }], ['lh', 'modsrc', { rates: 'lh' }], ['tmn', 'modsrc', { rates: 'tmn' }],
  ['dmh', 'limbic'], ['vmh', 'limbic'], ['mammillary', 'limbic'], ['mnpo', 'limbic', { rates: 'vlpo' }], ['ovlt', 'limbic'], ['sfo', 'limbic'],
  ['areaPostrema', 'auto'], ['medianEminence', 'limbic'],
  // Brainstem (§3.9, §3.10)
  ['lc', 'modsrc', { rates: 'lc', log: 1 }], ['ppn', 'modsrc', { rates: 'ppn' }], ['ldt', 'modsrc', { rates: 'ppn' }], ['pbn', 'auto'],
  ['pno', 'retic'], ['pnc', 'pnc', { log: 1 }], ['gi', 'retic'], ['mrf', 'retic'], ['vestNuc', 'inter', { log: 1 }],
  ['ntsGust', 'auto', { log: 1 }], ['ntsVisc', 'auto'], ['dmv', 'auto'], ['nAmbMotor', 'inter'], ['nAmbVagal', 'auto'],
  ['rvlm', 'auto'], ['cvlm', 'auto'], ['preBotC', 'inter', { kind: 'oscillator' }], ['rtn', 'auto'], ['io', 'inter'],
  ['gracile', 'relay', { log: 1 }], ['cuneate', 'relay', { log: 1 }], ['spV', 'relay'], ['prV', 'relay'], ['mesV', 'inter'], ['motV', 'inter'],
  ['cochNuc', 'relay', { log: 1 }], ['soc', 'inter', { log: 1 }], ['ic', 'inter', { log: 1 }], ['sc', 'inter', { log: 1 }], ['opn', 'inter'],
  ['ew', 'auto'], ['n3', 'inter'], ['n4', 'inter'], ['n6', 'inter'], ['n7m', 'inter'], ['n12', 'inter'], ['ssn', 'auto'], ['isn', 'auto'],
  ['barrington', 'auto'], ['redNucleus', 'inter'], ['pontineNuc', 'inter'],
  ['dr', 'modsrc', { rates: 'dr' }], ['mnr', 'modsrc', { rates: 'dr' }], ['rmg', 'modsrc', { rates: 'dr' }], ['rpa', 'modsrc', { rates: 'dr' }], ['rob', 'modsrc', { rates: 'dr' }],
  ['pag', 'limbic'],
  // Cerebellum (§3.6): `cerebellum` is the cerebellar cortex (Purkinje cells)
  ['cerebellum', 'assoc', { rates: 'purkinje' }], ['flocculus', 'assoc', { rates: 'purkinje' }], ['nodulus', 'assoc', { rates: 'purkinje' }],
  ['dentate', 'assoc', { rates: 'deepCb' }], ['interposed', 'assoc', { rates: 'deepCb' }], ['fastigial', 'assoc', { rates: 'deepCb' }],
  // Olfactory (§5.7)
  ['olfBulb', 'inter', { log: 1 }], ['olfTubercle', 'limbic'],
];
// Primary sensory areas take the NE slope gain (§4.8); logged areas mark the §5 cortical targets.
const PRIMARY = new Set(['s1.face', 's1.hand', 's1.trunk', 's1.leg', 's1.foot', 'v1', 'a1', 'gust', 'piriform']);
const LOGGED_AREAS = new Set(['v1', 'a1', 'gust', 'areaG', 'piriform', 'pivc', 's1.hand', 's1.face', 'insPost', 'insAnt', 'dacc', 'ffa', 'mt', 'pt']);
const POOL_IDS = Object.keys(PARAMS.pools);

// State-driven modulator sources and their §3.11 column.
const DRIVEN = { lc: 'lc', dr: 'HT', mnr: 'HT', tmn: 'HA', lh: 'OX', nbm: 'ACh', msdb: 'ACh', hdb: 'ACh', ppn: 'ACh', ldt: 'ACh', vlpo: 'vlpo', mnpo: 'vlpo', pno: 'pno' };

// --- Edge table (§3.3–§3.15) ---
// E(from, to, w, o): o.x 'ipsi' (default) | 'cross' | 'bi' (o.wc: crossed weight); o.path: a §3.16
// route id (anatomy BRAIN_TRACTS), optionally with o.seg [i0, i1] waypoint indices and o.alt / o.branch,
// or a right-side polyline; o.tract: Table 4.4b class; o.mod: modulatory; o.tx transmitter.
function edgeTable() {
  const L = [];
  const E = (from, to, w = 1, o = {}) => {
    for (const f of [].concat(from)) for (const t of [].concat(to)) L.push({ from: f, to: t, w, ...o });
  };
  const S1 = ['s1.hand', 's1.face', 's1.trunk', 's1.leg', 's1.foot'], M1 = ['m1.hand', 'm1.face', 'm1.trunk', 'm1.leg', 'm1.foot'];
  const RELAYS = ['thalVPL', 'thalVPM', 'thalVPMpc', 'thalVMpo', 'lgn', 'mgn', 'thalMD', 'thalVL', 'thalVA', 'thalPulv', 'thalCM', 'thalAnt'];

  // Afferent ports → first central stations (§3.14). Retina: each eye reaches both hemispheres
  // (nasal fibres cross at the chiasm; crossed share 0.5 [model], ≈ 53 % [T]).
  E('portDC', ['gracile', 'cuneate'], 1, { tx: 'Glu' });
  E('portSTT', 'thalVPL', 1, { path: 'tractSTT', tract: 'sttAd', tx: 'Glu' });
  E('portSTT', ['thalVMpo', 'thalCM', 'thalMD'], 1, { tract: 'sttAd', tx: 'Glu' });
  E('portSTT', ['pbn', 'mrf', 'gi', 'lc', 'pag'], 0.5, { tract: 'sttAd', tx: 'Glu' });   // collaterals [model w]
  E('portTrig', ['prV', 'spV', 'mesV'], 1, { tx: 'Glu' });
  E('portVisc', 'ntsVisc', 1, { tx: 'Glu' });
  E('portGust', 'ntsGust', 1, { tx: 'Glu' });
  E('portSpinoVisc', ['ntsVisc', 'pbn', 'thalVMpo', 'thalVPL'], 1, { tx: 'Glu' });
  E('portCVO', ['areaPostrema', 'ovlt', 'sfo', 'medianEminence', 'mnpo', 'arcuate'], 1);
  E('portVest', 'vestNuc', 1, { tx: 'Glu' });
  E('portVest', ['flocculus', 'nodulus'], 0.3, { tx: 'Glu' });   // direct primary input (§5.9) [model w]
  E('portCoch', 'cochNuc', 1, { tx: 'Glu' });
  E('portRetina', 'lgn', 0.5, { x: 'bi', wc: 0.5, path: 'tractOptic', pathC: 'tractOptic:cross', tract: 'optic', tx: 'Glu' });
  E('portRetina', ['sc', 'opn', 'scn'], 0.5, { x: 'bi', wc: 0.5, tract: 'optic', tx: 'Glu' });
  E('portOlf', 'olfBulb', 1, { tx: 'Glu' });

  // Lemniscal, trigeminal and auditory crossings (§3.15 row 2, §3.16 routes)
  E('cuneate', 'thalVPL', 1, { x: 'cross', path: 'tractML', tract: 'ml', tx: 'Glu' });
  E('gracile', 'thalVPL', 1, { x: 'cross', path: 'tractML', alt: 'gracile', tract: 'ml', tx: 'Glu' });
  E('prV', 'thalVPM', 1, { x: 'cross', path: 'tractTrigLem', tract: 'ml', tx: 'Glu' });
  E('prV', 'thalVPM', 0.2, { path: 'tractTrigDors', tract: 'ml', tx: 'Glu' });
  E('spV', 'thalVPM', 1, { x: 'cross', path: 'tractTrigSp', tract: 'sttAd', tx: 'Glu' });
  E('spV', 'thalVMpo', 1, { x: 'cross', path: 'tractTrigSp', branch: 'thalVMpo', tract: 'sttAd', tx: 'Glu' });
  E('cochNuc', 'soc', 1, { x: 'cross', path: 'tractLatLem', seg: [0, 2], tx: 'Glu' });
  E('cochNuc', 'soc', 0.4, { path: 'tractLatLemU', seg: [0, 1], tx: 'Glu' });
  E('cochNuc', 'ic', 1, { x: 'bi', wc: 1, tx: 'Glu' });          // direct lemniscal input; ipsilateral at 0.4 below
  E('soc', 'ic', 1, { path: 'tractLatLemU', seg: [1, 3], tx: 'Glu' });
  E('ic', 'mgn', 1, { path: 'tractLatLemU', seg: [3, 5], tx: 'Glu' });
  E('ic', 'sc', 0.5, { tx: 'Glu' });                              // orienting (§5.3)
  // Acoustic startle (§3.9): the cochlear root neurons (represented by cochNuc, §4.11) sit in the nerve
  // root, so their drive is taken from the less compressed port activity. With θ_pnc 0.7 the weight
  // puts the PnC threshold between 70 and 90 dB SPL (startle ≈ 90 dB, §6) [model w].
  E('portCoch', 'pnc', 0.26, { x: 'bi', wc: 0.13, tx: 'Glu' });
  E('pnc', 'n7m', 1, { x: 'bi', wc: 0.5, tx: 'Glu' });             // blink (§4.11) [model crossed w]
  E('pnc', 'portRS', 1, { tx: 'Glu' });
  // Vestibular (§5.9): VOR push–pull [model weights], vestibulospinal, vestibulothalamic.
  E('vestNuc', 'n6', 1, { x: 'bi', wc: 1, tx: 'Glu' });
  E('vestNuc', 'n3', 0.5, { tx: 'Glu' });
  E('vestNuc', 'n4', 0.3, { x: 'cross', tx: 'Glu' });
  E('vestNuc', ['portRS', 'thalVPL'], 1, { tx: 'Glu' });
  E('vestNuc', 'rvlm', 0.3, { tx: 'Glu' });
  E('vestNuc', ['flocculus', 'nodulus'], 0.3, { tx: 'Glu' });

  // Thalamocortical (§3.3 table; lemniscal thalamocortical class 35 m/s, Table 4.4b, used for every
  // first-order radiation [model])
  E('thalVPL', 's1.hand', 1, { path: 'tractThalS1', tract: 'tc', tx: 'Glu' });
  E('thalVPL', ['s1.trunk', 's1.leg', 's1.foot', 'ba3a', 'ba2', 's2', 'insPost', 'pivc'], 1, { tract: 'tc', tx: 'Glu' });
  E('thalVPM', 's1.face', 1, { tract: 'tc', tx: 'Glu' });
  E('thalVPMpc', ['gust', 'areaG'], 1, { tract: 'tc', tx: 'Glu' });
  E('thalVMpo', ['insPost', 'insAnt', 'dacc'], 1, { tx: 'Glu' });
  E('thalAnt', ['pcc', 'rsc'], 1, { tx: 'Glu' });
  E('thalMD', ['dlpfc', 'ofcOlf', 'dacc'], 1, { tx: 'Glu' });
  E('thalVA', ['preSma', 'pmd', 'fef', 'dlpfc'], 1, { tx: 'Glu' });
  E('thalVL', ['sma', 'pmd', ...M1], 1, { tx: 'Glu' });
  E('thalCM', ['putamen', 'caudate'], 0.5, { tx: 'Glu' });
  E('thalPulv', ['ppc', 'ips', 'mt', 'v4'], 1, { tx: 'Glu' });
  E('thalPulv', 'amygdala', 0.5, { tx: 'Glu' });
  E('lgn', 'v1', 1, { path: 'tractOptRad', tract: 'tc', tx: 'Glu' });
  E('mgn', 'a1', 1, { path: 'tractAcRad', tract: 'tc', tx: 'Glu' });
  E('mgn', ['pt', 'amygdala'], 0.5, { tx: 'Glu' });
  // L6 feedback (+, modulatory), thalRet (−), PPN/LDT (+), relay collaterals onto thalRet (§3.3, §3.15 row 1)
  for (const [c, t] of [['s1.hand', 'thalVPL'], ['s1.face', 'thalVPM'], ['v1', 'lgn'], ['a1', 'mgn'], ['gust', 'thalVPMpc'], ['insPost', 'thalVMpo'],
    ['m1.hand', 'thalVL'], ['dlpfc', 'thalMD'], ['ppc', 'thalPulv']]) E(c, t, 0.1, { mod: 1, tx: 'Glu' });
  E('thalRet', RELAYS, -0.1, { mod: 1, tx: 'GABA' });
  E(['thalVPL', 'thalVPM', 'lgn', 'mgn'], 'thalRet', 0.3, { tx: 'Glu' });
  E('ppn', ['lgn', 'mgn', 'thalVPL', 'thalVPM', 'thalMD', 'thalCM'], 0.05, { mod: 1, tx: 'ACh' });
  E('ldt', ['thalAnt', 'thalMD', 'thalCM'], 0.05, { mod: 1, tx: 'ACh' });
  E('mrf', 'thalCM', 0.3, { tx: 'Glu' });

  // Cortico-cortical flows (§3.4)
  E('v1', ['v4', 'mt'], 1); E('v4', 'ffa', 1); E('ffa', ['amygdala', 'ofcOlf'], 0.5);
  E('mt', ['ppc', 'fef'], 1);
  E('a1', 'pt', 1); E('pt', 'tpj', 1);
  E('s1.hand', ['ba2', 's2'], 1); E('s2', 'insPost', 1); E('ba3a', 'm1.hand', 1);
  E('insPost', 'insMid', 1); E('insMid', 'insAnt', 1); E('insAnt', 'dacc', 1); E('dacc', 'insAnt', 0.2);   // reciprocal weight < θ: no self-sustaining loop [model]
  E('gust', 'ofcOlf', 1); E('piriform', ['ofcOlf', 'entorhinal'], 1);
  E('dlpfc', ['caudate', 'preSma'], 1);
  E(['dacc', 'sgacc', 'pgacc'], ['pag', 'lh', 'pvn', 'lc'], 0.15);   // visceromotor [model w]
  E(['entorhinal', 'parahipp'], 'hippocampus', 1);
  // Motor outflow and cortico-subcortical projections
  E('m1.hand', 'portCST', 1, { path: 'tractCST', tract: 'cst', tx: 'Glu' });
  E([...M1.slice(1), 'pmd', 'sma'], 'portCST', 1, { tract: 'cst', tx: 'Glu' });
  E('s1.hand', 'portCST', 0.3, { tract: 'cst', tx: 'Glu' });
  E(['m1.hand', 'sma', 'pmd'], 'putamen', 1); E('s1.hand', 'putamen', 0.5);
  E(['fef', 'ppc', 'dlpfc', 'ofcOlf'], 'caudate', 0.5);
  E(['hippocampus', 'entorhinal', 'amygdala'], 'nacc', 0.5);
  E('m1.hand', 'stn', 1, { path: 'tractHyperdirect', tx: 'Glu' });
  E(['sma', 'preSma'], 'stn', 1, { tx: 'Glu' });
  E(['m1.hand', 'pmd', 'dlpfc', 's1.hand'], 'pontineNuc', 1, { tx: 'Glu' });
  E('m1.hand', 'redNucleus', 0.5, { tx: 'Glu' });

  // Basal ganglia (§3.5): one striatal node per side carries the D1 (direct) and D2 (indirect) halves
  E(['putamen', 'caudate'], ['gpi', 'snr', 'gpe'], -0.5, { tx: 'GABA' });
  E('nacc', 'vp', -1, { tx: 'GABA' });
  E('gpe', 'stn', -1, { tx: 'GABA' }); E('gpe', 'gpi', -0.5, { tx: 'GABA' });
  E('stn', ['gpi', 'snr'], 1, { tx: 'Glu' }); E('stn', 'gpe', 0.5, { tx: 'Glu' });
  E('gpi', ['thalVA', 'thalVL'], -1, { tx: 'GABA' }); E('gpi', ['thalMD', 'ppn'], -0.5, { tx: 'GABA' });
  E('snr', ['thalVA', 'thalMD', 'ppn'], -0.5, { tx: 'GABA' }); E('snr', 'sc', -1, { tx: 'GABA' });
  E('vp', 'thalMD', -0.5, { tx: 'GABA' });
  E('snc', ['putamen', 'caudate'], 1, { kind: 'volume', tx: 'DA' });   // DA by volume transmission (DOPAMINE.md; read by no NF unit)
  E('vta', 'nacc', 1, { kind: 'volume', tx: 'DA' });
  E('ppn', 'snc', 0.3, { tx: 'ACh' });

  // Cerebellum (§3.6)
  E('pontineNuc', 'cerebellum', 1, { x: 'cross', path: 'tractMCP', tx: 'Glu' });
  E('io', 'cerebellum', 1, { x: 'cross', tx: 'Glu' }); E('io', 'flocculus', 0.5, { x: 'cross', tx: 'Glu' });
  E('cerebellum', ['dentate', 'interposed', 'fastigial'], -1, { tx: 'GABA' });
  E(['flocculus', 'nodulus'], 'vestNuc', -0.2, { tx: 'GABA' });   // [model w]: Purkinje inhibition must not cancel the canal drive
  E('dentate', 'thalVL', 1, { x: 'cross', path: 'tractSCP', tx: 'Glu' });
  E('interposed', 'redNucleus', 1, { x: 'cross', tx: 'Glu' });
  E('fastigial', ['vestNuc', 'gi'], 0.5, { tx: 'Glu' });
  E('fastigial', 'rvlm', 0, { tx: 'Glu' });            // fastigial pressor projection, weight 0 by default (§3.6)
  E('redNucleus', 'portRS', 1, { tx: 'Glu' }); E('redNucleus', 'io', 0.3, { tx: 'Glu' });

  // Limbic (§3.7)
  E('amygdala', 'cea', 1, { tx: 'Glu' }); E('amygdala', 'bnst', 0.5, { tx: 'Glu' });
  E('cea', ['pag', 'pbn', 'bnst', 'dmv', 'nAmbVagal'], 0.5, { tx: 'GABA' });   // net + by disinhibition (§3.7)
  E('cea', ['lh', 'lc'], 0.3, { tx: 'GABA' });   // [model w]: with the cortical inputs, a salient event drives LC near its burst rate
  E('cea', 'insAnt', 0.2); E('insAnt', 'cea', 0.2);   // reciprocal CeA–insula link [model w]
  E('hippocampus', 'bnst', 0.5, { tx: 'Glu' }); E('bnst', 'pvn', -0.5, { tx: 'GABA' });   // hippocampal brake on PVN via BNST
  E('mammillary', 'thalAnt', 1, { tx: 'Glu' });
  E('olfBulb', ['piriform', 'olfTubercle'], 1, { tx: 'Glu' }); E('olfBulb', ['amygdala', 'entorhinal'], 0.5, { tx: 'Glu' });
  E('olfTubercle', 'hypothalamus', 0.5); E('piriform', 'thalMD', 0.5);
  E('msdb', 'hippocampus', 0.1, { mod: 1, tx: 'ACh' });

  // Hypothalamus, sleep switch and orexin (§3.8, §3.15 row 8)
  E('scn', ['dmh', 'pvn'], 0.3, { tx: 'GABA/AVP' });
  E('vlpo', ['lc', 'dr', 'mnr', 'tmn', 'lh', 'ppn', 'ldt'], -0.3, { tx: 'GABA/galanin' });
  E('mnpo', ['lc', 'dr', 'mnr', 'tmn', 'lh', 'ppn', 'ldt'], -0.2, { tx: 'GABA' });
  E('lc', 'vlpo', -0.3, { tract: 'lc', tx: 'NA' }); E('dr', 'vlpo', -0.3, { tx: '5-HT' });
  E('lh', ['lc', 'tmn', 'dr', 'nbm', 'vta'], 0.15, { tx: 'orexin' });   // [model w]
  E('habenula', 'rmtg', 1, { tx: 'Glu' }); E('rmtg', 'vta', -1, { tx: 'GABA' });
  E('mnpo', 'dmh', -0.5, { tx: 'GABA' }); E('dmh', 'rpa', 1, { tx: 'Glu' }); E('dmh', 'pvn', 0.5, { tx: 'Glu' });
  E('pvn', ['rvlm', 'ntsVisc', 'dmv'], 0.3, { tx: 'Glu/AVP/OT' });
  E('pvn', ['portSymp', 'portPortal', 'portNeurohyp'], 1); E('pvn', 'portImmune', 0.3);
  E('son', 'portNeurohyp', 1); E(['arcuate', 'mpoa'], 'portPortal', 1);
  E('vmh', 'pag', 0.5); E(['sfo', 'ovlt'], ['mnpo', 'son'], 0.5);

  // Brainstem autonomic, respiratory and descending control (§3.9, §3.15 rows 10–14)
  E('ntsVisc', ['cvlm', 'nAmbVagal', 'dmv'], 1, { tx: 'Glu' }); E('ntsVisc', ['pbn', 'pvn'], 0.5, { tx: 'Glu' }); E('ntsVisc', 'son', 0.3, { tx: 'Glu' });
  E('cvlm', 'rvlm', -1, { tx: 'GABA' });
  E('rvlm', 'portSymp', 1, { path: 'tractBulbospinal', tract: 'bulbospinal', tx: 'Glu' }); E('rvlm', 'portImmune', 0.3);
  E(['nAmbVagal', 'dmv'], 'portVag', 1, { tx: 'ACh' }); E('dmv', 'portImmune', 0.5);
  E('preBotC', 'nAmbVagal', -0.5, { tx: 'GABA/Gly' }); E('rtn', 'preBotC', 1, { tx: 'Glu' }); E('preBotC', 'portRS', 1);
  E('areaPostrema', 'ntsVisc', 0.5);
  E('barrington', 'portSacral', 1); E('pag', 'portSacral', 0.3);
  E('pag', 'rvlm', 0.5, { tx: 'Glu' });
  E('pag', 'rmg', 1, { path: 'tractPagRvm', seg: [0, 1], tx: 'Glu' });
  E('rmg', 'portRS', 1, { path: 'tractPagRvm', seg: [1, 3], tx: '5-HT/Enk' });
  E('lc', 'portRS', 0.5, { tract: 'lc', tx: 'NA' });   // descending α2 inhibition: the sign acts at the dorsal horn (§6)
  E('pbn', ['cea', 'lh'], 0.3, { tx: 'Glu' }); E('pbn', 'thalVMpo', 0.5, { tx: 'Glu' });
  E('ntsGust', 'thalVPMpc', 1, { tx: 'Glu' }); E('ntsGust', ['ssn', 'isn'], 0.5, { tx: 'Glu' });
  E(['ssn', 'isn', 'ew'], 'portPara', 1, { tx: 'ACh' });
  E('opn', 'ew', 1, { x: 'bi', wc: 1, tx: 'Glu' });
  E('sc', 'thalPulv', 1, { tx: 'Glu' }); E('sc', 'portRS', 0.5, { tx: 'Glu' });
  E(['n3', 'n4', 'n6', 'motV', 'n7m', 'nAmbMotor', 'n12'], 'portCranMotor', 1, { tx: 'ACh' });
  E('mesV', 'motV', 1, { tx: 'Glu' });
  E('pno', 'gi', 1, { tx: 'Glu' }); E('gi', 'portRS', 1, { tx: 'Glu' });
  E('lc', 'dlpfc', 0.1, { mod: 1, path: 'tractDNB', tract: 'lc', tx: 'NA' });   // dorsal noradrenergic bundle (§3.10: ≈ 0.2 s to PFC)

  // Modulator pools by volume transmission (§3.15 last row)
  for (const [p, d] of Object.entries(PARAMS.pools)) E(d.src, p, 1, { kind: 'volume', tx: p });
  return L;
}

// --- Fragment ---
function brainFragment() {
  const nodes = [], edges = [], paths = {};
  const base = new Map();        // base id → { mid, pos (right side) }

  const regionOf = (id, o) => o.regions ?? [o.region ?? id];
  const isMid = (id, o, pos) => {
    if (o.mid !== undefined) return !!o.mid;
    const r = A.R[regionOf(id, o)[0]];
    if (r !== undefined) return A.MIDLINE[r] === 1;
    return pos[0] === 0;
  };
  const add = (id, spec, o, pos) => {
    const mid = isMid(id, o, pos);
    base.set(id, { mid, pos });
    if (mid) nodes.push({ ...spec, id, pos: [0, pos[1], pos[2]], side: null });
    else {
      nodes.push({ ...spec, id: `${id}.R`, pos: [...pos], side: 'R' });
      nodes.push({ ...spec, id: `${id}.L`, pos: mirror(pos), side: 'L' });
    }
  };

  // Nuclei
  for (const [id, cls, o = {}] of N) {
    const c = PARAMS.classes[cls];
    const pos = id === 'cerebellum' ? PARAMS.cerebellumPos : (A.nodePos(id) ?? A.nodePos(regionOf(id, o)[0]));
    if (!pos) throw new Error(`brainnet: no position for '${id}'`);
    const rr = o.rates ? PARAMS.rates[o.rates] : null;
    const gain = o.relay || o.ne ? { ...(o.relay ? { drive: 'relay' } : {}), ...(o.ne ? { slope: 'ne' } : {}) } : undefined;
    add(id, { kind: o.kind ?? 'nucleus', owner: 'cns', tau: c.tau, rmax: rr ? rr[1] : c.rmax, rSpont: rr ? rr[0] : c.rSpont,
      theta: c.theta, region: regionOf(id, o)[0], log: !!o.log, label: id, gain }, o, pos);
  }
  // Cortical areas (one unit per area and side, A.3.3; §3.4)
  A.AREAS.forEach((a, ai) => {
    const c = PARAMS.classes.cortex;
    add(a.id, { kind: 'area', owner: 'cns', tau: c.tau, rmax: c.rmax, rSpont: c.rSpont, area: ai, log: LOGGED_AREAS.has(a.id), label: a.id,
      gain: PRIMARY.has(a.id) ? { slope: 'ne' } : undefined }, { mid: false }, a.c);
  });
  // Ports (§3.14): afferent ports carry the gated tonic drive (portNets = their main channel, A.5).
  for (const p of A.PORTS) {
    const at = p.at;
    let pos = A.portPos(p.id), mid = false;
    if (at.junction) pos = PARAMS.junctionPorts[p.id] ?? [PARAMS.junctionDx, pos[1], pos[2]];
    else if (at.node) mid = pos[0] === 0;
    const c = PARAMS.classes[p.dir === 'aff' ? 'portAff' : 'portEff'];
    add(p.id, { kind: 'port', owner: 'cns', tau: c.tau, rmax: c.rmax, rSpont: c.rSpont, portDir: p.dir,
      portNets: p.dir === 'aff' ? p.channels[0].nets : undefined, log: p.dir === 'aff' && p.brainOnly === 'fed', label: p.id }, { mid }, pos);
  }
  // Pools (§3.10): CV-layer quantities, drawn at their first source.
  for (const [id, d] of Object.entries(PARAMS.pools)) {
    const src = base.get(d.src[0]);
    add(id, { kind: 'pool', owner: 'cns', layer: 'CV', label: id }, { mid: true }, [0, src.pos[1], src.pos[2]]);
  }

  // Routes (§3.16). A route's right-side polyline serves the right-side source; the left source
  // uses its mirror. Segments and branches of a route are registered as their own paths.
  const tract = Object.fromEntries(A.BRAIN_TRACTS.map((t) => [t.id, t]));
  const routePts = (o) => {
    if (Array.isArray(o.path)) return o.path;
    if (o.path === 'tractOptic:cross') {   // through the chiasm to the opposite optic tract
      const p = tract.tractOptic.pts;
      return [...p.slice(0, 3).map((q) => [...q]), ...p.slice(3).map(mirror)];
    }
    const t = tract[o.path];
    if (!t) throw new Error(`brainnet: unknown route '${o.path}'`);
    let pts = t.pts;
    if (o.alt) pts = t.alt.find((a) => a.from === o.alt).pts;
    if (o.branch) pts = t.branches.find((b) => b.to === o.branch).pts;
    if (o.seg) pts = pts.slice(o.seg[0], o.seg[1] + 1);
    return pts;
  };
  const routeId = (o) => (Array.isArray(o.path) ? null
    : `${o.path}${o.alt ? `.${o.alt}` : ''}${o.branch ? `.${o.branch}` : ''}${o.seg ? `.${o.seg[0]}-${o.seg[1]}` : ''}`);
  const usePath = (o, side, flip) => {
    const id = routeId(o);
    let pts = routePts(o);
    if (flip) pts = pts.map(mirror);
    const key = id ? `${id}${side ? `.${side}` : ''}` : null;
    if (key) { if (!(key in paths)) paths[key] = pts.map((q) => [...q]); return key; }
    return pts;
  };

  const specs = [];
  for (const e of edgeTable()) {
    const F = base.get(e.from), T = base.get(e.to);
    if (!F || !T) throw new Error(`brainnet: edge ${e.from} → ${e.to} names an unknown node`);
    const common = { kind: e.kind ?? 'tract', fibre: 'cns', transmitter: e.tx ?? null, tract: e.tract, nSyn: e.kind === 'volume' ? 0 : 1,
      transport: e.kind === 'volume' ? 'layer' : undefined, mod: !!e.mod };
    const push = (from, to, w, path) => specs.push({ ...common, from, to, w, sign: w < 0 ? -1 : 1, ...(path ? { path } : {}) });
    const pathFor = (o, side) => (o.path ? usePath(o, side, side === 'L') : undefined);
    if (F.mid && T.mid) push(e.from, e.to, e.w, pathFor(e, null));
    else if (F.mid) for (const s of ['R', 'L']) push(e.from, `${e.to}.${s}`, e.w, pathFor(e, s));
    else if (T.mid) for (const s of ['R', 'L']) push(`${e.from}.${s}`, e.to, e.w, pathFor(e, s));
    else {
      const x = e.x ?? 'ipsi';
      for (const s of ['R', 'L']) {
        const o = s === 'R' ? 'L' : 'R';
        if (x === 'ipsi' || x === 'bi') push(`${e.from}.${s}`, `${e.to}.${s}`, e.w, pathFor(e, s));
        if (x === 'cross') push(`${e.from}.${s}`, `${e.to}.${o}`, e.w, pathFor(e, s));
        if (x === 'bi') push(`${e.from}.${s}`, `${e.to}.${o}`, e.wc ?? e.w, e.pathC ? pathFor({ path: e.pathC }, s) : undefined);
      }
    }
  }
  // Modulatory cap per target (Σ|w_mod| ≤ modCap) [model].
  const modSum = new Map();
  for (const s of specs) if (s.mod) modSum.set(s.to, (modSum.get(s.to) ?? 0) + Math.abs(s.w));
  for (const s of specs) {
    if (s.mod) { const m = modSum.get(s.to); if (m > PARAMS.modCap) s.w *= PARAMS.modCap / m; }
    const { mod, tract: tr, ...rest } = s;
    edges.push(tr ? { ...rest, tract: tr } : rest);
  }
  return { nodes, edges, paths };
}

// --- Instance ---
const logit = (r, rmax) => Math.log(r / (rmax - r));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class BrainNet {
  constructor(k) {
    this.k = k;
    const g = k.graph;
    // Variables (A.3.4 names for the canonical ones).
    this.v = {
      state: k.declare('arousalState', S_IDX.wakeRelaxed),
      auto: k.declare('arousalAuto', 0),
      procS: k.declare('procS', 0),
      procC: k.declare('procC', 0),
      salience: k.declare('salience', 0),
      predErr: k.declare('predErr', 0),
      lcPhasic: k.declare('lcPhasic', 0),
      lcExtra: k.declare('bn.lcExtra', 0),
      lcRefract: k.declare('bn.lcRefract', -1),
      lcUntil: k.declare('bn.lcUntil', -1),
      salUntil: k.declare('bn.salUntil', -1),
      salAmp: k.declare('bn.salAmp', 0),
      cycleStart: k.declare('bn.cycleStart', -1),
      cycle: k.declare('bn.cycle', 0),
      remStart: k.declare('bn.remStart', -1),
      n1Until: k.declare('bn.n1Until', -1),
      gNE: k.declare('bn.gNE', 1),
    };
    this.vPool = Object.fromEntries(POOL_IDS.map((p) => [p, k.declare(p, 1, { unit: 'rel' })]));
    const nSense = 10;   // A.6 senses
    k.declareArray('bn.hab', nSense, 0);
    k.declareArray('bn.habT', nSense, 0);
    k.declareArray('bn.pred', nSense, 0);
    k.declareArray('bn.predT', nSense, 0);
    // Driven instances (state drives) and salience targets, as graph node indices.
    const inst = (id) => [g.index.get(id), g.index.get(`${id}.R`), g.index.get(`${id}.L`)].filter((i) => i !== undefined);
    /** @type {{ i: number, id: string, col: string, j: number, in?: { w: number, src: number }[], rmax?: number, kappa?: number, r0?: number }[]} */
    this.driven = [];
    for (const [id, col] of Object.entries(DRIVEN)) for (const i of inst(id)) this.driven.push({ i, id, col, j: -1 });
    this.salTargets = [];
    for (const [id, w] of Object.entries(PARAMS.salDrive)) for (const i of inst(id)) this.salTargets.push({ i, id, w, j: -1 });
    k.declareArray('bn.stateExt', Math.max(1, this.driven.length), 0);
    k.onLayer('CV', (t, h) => this.cv(t, h));
    k.onLayer('CR', (t, h) => this.cr(t, h));
    k.onQuiet('CV', () => this.quiet());
    k.on('arousal', (s) => this.setState(s));
    k.on('sense', (p) => this.onSense(p));
    k.on('bn.lcBurst', (p) => this.lcBurst(p));
    k.on('bn.lcSuppress', () => this.lcSuppress());
    k.on('bn.lcRecover', () => this.lcRecover());
    k.on('bn.salStart', (p) => this.salStart(p));
    k.on('bn.salEnd', () => this.salEnd());
    k.on('bn.wake', () => this.wake());
    this.settleSeconds = 0;

    // Display (screen time; not simulation state).
    this.activity = new Float32Array(2 * A.REGION_COUNT).fill(1);
    this.areaActivity = new Float32Array(2 * Math.max(PARAMS.areaColumns, A.AREAS.length)).fill(1);
    this.tint = null;
    this._tintSet = [];
  }

  init(k) {
    const g = k.graph;
    for (const d of this.driven) d.j = k.nfIndex(g.nodes[d.i].id);
    for (const s of this.salTargets) s.j = k.nfIndex(g.nodes[s.i].id);
    this.stateExt = k.array('bn.stateExt');
    this.hab = k.array('bn.hab'); this.habT = k.array('bn.habT'); this.pred = k.array('bn.pred'); this.predT = k.array('bn.predT');
    const nf = (id) => [k.nfIndex(id), k.nfIndex(`${id}.R`), k.nfIndex(`${id}.L`)].filter((j) => j >= 0);
    this.poolSrc = POOL_IDS.map((p) => ({ v: this.vPool[p], tau: PARAMS.pools[p].tau, js: PARAMS.pools[p].src.flatMap(nf) }));
    this.lcJ = nf('lc');
    this.lcKappa = this.driven.find((d) => d.id === 'lc')?.kappa ?? 0.12;
    this.vTod = k.idx('timeOfDay');
    // Display map: column → NF index (regions: 2·r + s; areas: 2·area + s).
    this.regionCols = [];
    this.areaCols = [];
    for (const n of g.nodes) {
      if (n.plugin !== 'brainnet' || n.layer !== 'NF') continue;
      const j = k.nfIndex(n.id), s = n.side === 'L' ? 1 : 0;
      if (n.kind === 'area') { this.areaCols.push({ col: 2 * n.area + s, j, mid: false }); continue; }
      const def = /** @type {any[] | undefined} */ (N.find((d) => d[0] === n.id.replace(/\.(R|L)$/, '')));
      if (!def) continue;
      const o = /** @type {{ regions?: string[], region?: string }} */ (def[2] ?? {});
      for (const reg of o.regions ?? [o.region ?? def[0]]) {
        const r = A.R[reg];
        if (r !== undefined) this.regionCols.push({ col: 2 * r + s, j, mid: n.side === null });
      }
    }
    // Driven sources' in-edges among driven sources (for the state-drive solve).
    const di = new Map(this.driven.map((d, q) => [d.i, q]));
    for (const d of this.driven) {
      d.in = [];
      for (let q = g.inOff[d.i]; q < g.inOff[d.i + 1]; q++) {
        const e = g.edges[g.inEdge[q]];
        if (e.transport !== 'layer' && di.has(e.from)) d.in.push({ w: e.w, src: di.get(e.from) });
      }
      const n = g.nodes[d.i];
      d.rmax = n.rmax; d.kappa = n.kappa;
      d.r0 = clamp(n.rSpont, 1e-4 * n.rmax, (1 - 1e-4) * n.rmax);
    }
  }

  // --- Rest (§11.6): procS and procC for the clock time; state drives of the current state. ---
  preSettle(init, k) {
    const vars = k.vars, tod = vars[this.vTod];
    vars[this.v.procC] = this.procCAt(tod);
    vars[this.v.procS] = this.restingProcS(tod);
    if (init.arousalState && init.arousalState in S_IDX) vars[this.v.state] = S_IDX[init.arousalState];
    this.applyState(vars[this.v.state] | 0, true);
  }

  procCAt(tod) { return Math.cos((2 * Math.PI * (tod - PARAMS.procCPhase)) / PARAMS.day); }
  // procS of the §3.11 steady day (awake 07:00–23:00) at clock time tod [model].
  restingProcS(tod) {
    const P = PARAMS.procS, t = ((tod % PARAMS.day) + PARAMS.day) % PARAMS.day;
    const sWake = PARAMS.thresholds.down + PARAMS.thresholds.cAmp * this.procCAt(P.wakeTime);
    const awakeS = (dt) => 1 - (1 - sWake) * Math.exp(-dt / P.tauRise);
    if (t >= P.wakeTime && t < P.sleepTime) return awakeS(t - P.wakeTime);
    const sOn = awakeS(P.sleepTime - P.wakeTime), dt = (t - P.sleepTime + PARAMS.day) % PARAMS.day;
    return sOn * Math.exp(-dt / P.tauDecay);
  }

  // --- Arousal state machine (§3.11) ---
  setState(s) {
    const vars = this.k.vars;
    if (s === 'auto') { vars[this.v.auto] = 1; return; }
    if (!(s in S_IDX)) return;
    vars[this.v.auto] = 0;
    this.applyState(S_IDX[s]);
  }

  // Target rate of a driven source in state s.
  _target(d, st) {
    const P = PARAMS.states[STATES[st]];
    let r;
    if (d.col === 'lc') r = P.lc;
    else if (d.col === 'vlpo') r = d.r0 * P.vlpo / PARAMS.states.wakeRelaxed.vlpo;
    else if (d.col === 'pno') r = d.r0 * P.pno;
    else r = d.r0 * P[d.col];
    return clamp(r, PARAMS.minRateFrac * d.rmax, (1 - 1e-4) * d.rmax);
  }

  applyState(st, settling = false) {
    const k = this.k, vars = k.vars;
    const prev = vars[this.v.state] | 0;
    vars[this.v.state] = st;
    const tgt = this.driven.map((d) => this._target(d, st));
    this.driven.forEach((d, q) => {
      let ext = d.kappa * (logit(tgt[q], d.rmax) - logit(d.r0, d.rmax));
      for (const e of d.in) { const s = this.driven[e.src]; ext -= e.w * (tgt[e.src] / s.rmax - s.r0 / s.rmax); }
      this.stateExt[q] = ext;
    });
    this._applyDrives();
    k.setGain('relay', PARAMS.states[STATES[st]].relay);
    if (!settling && prev !== st) k.log({ kind: 'state', node: 'arousalState', label: STATES[st] });
  }

  _applyDrives() {
    const k = this.k, extra = k.vars[this.v.lcExtra];
    this.driven.forEach((d, q) => { if (d.j >= 0) k.setExt(d.j, this.stateExt[q] + (d.id === 'lc' ? extra : 0)); });
  }

  wake() {
    const st = this.k.vars[this.v.state] | 0;
    if (SLEEP.has(st)) { this.applyState(S_IDX.wakeAlert); this.k.vars[this.v.remStart] = -1; }
  }

  cr(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS.procS, T = PARAMS.thresholds;
    const st = vars[this.v.state] | 0, asleep = SLEEP.has(st);
    vars[this.v.procC] = this.procCAt(vars[this.vTod] + t);
    const S = vars[this.v.procS];
    vars[this.v.procS] = asleep ? S * Math.exp(-h / P.tauDecay) : 1 - (1 - S) * Math.exp(-h / P.tauRise);
    if (!vars[this.v.auto]) return;
    const s = vars[this.v.procS], c = vars[this.v.procC];
    if (!asleep) {
      if (s >= T.up + T.cAmp * c) {
        vars[this.v.cycleStart] = t; vars[this.v.cycle] = 0; vars[this.v.remStart] = -1; vars[this.v.n1Until] = t + PARAMS.n1Hold;
        this.applyState(S_IDX.n1);
      }
      return;
    }
    if (s <= T.down + T.cAmp * c) { vars[this.v.remStart] = -1; this.applyState(S_IDX.wakeRelaxed); return; }
    const remLen = PARAMS.remFirst + PARAMS.remStep * vars[this.v.cycle];
    let next;
    if (vars[this.v.remStart] >= 0) {
      if (t - vars[this.v.remStart] >= remLen) {
        vars[this.v.cycle] += 1; vars[this.v.cycleStart] = t; vars[this.v.remStart] = -1; vars[this.v.n1Until] = t + PARAMS.n1Hold;
        next = S_IDX.n1;
      } else next = S_IDX.rem;
    } else if (t - vars[this.v.cycleStart] >= PARAMS.cycle - remLen) { vars[this.v.remStart] = t; next = S_IDX.rem; }
    else if (t < vars[this.v.n1Until]) next = S_IDX.n1;
    else next = s > P.deep ? S_IDX.n3 : S_IDX.n2;
    if (next !== st) this.applyState(next);
  }

  // --- Pools, decays and gains (CV layer) ---
  _poolTarget(p) {
    const k = this.k;
    let sum = 0;
    for (const j of p.js) { const r0 = k.aRest(j); sum += r0 > 0 ? k.a(j) / r0 : 1; }
    return p.js.length ? sum / p.js.length : 1;
  }

  cv(t, h) {
    const k = this.k, vars = k.vars;
    for (const p of this.poolSrc) {
      const T = this._poolTarget(p);
      vars[p.v] = T + (vars[p.v] - T) * Math.exp(-h / p.tau);
    }
    const sal = vars[this.v.salience] * Math.exp(-h / PARAMS.tauSalience);
    vars[this.v.salience] = sal < 1e-6 ? 0 : sal;
    const pe = vars[this.v.predErr] * Math.exp(-h / PARAMS.tauPred);
    vars[this.v.predErr] = pe < 1e-6 ? 0 : pe;
    const g = clamp(1 + PARAMS.gammaT * (vars[this.vPool.modNE] - 1) + PARAMS.gammaP * vars[this.v.lcPhasic], PARAMS.gNEMin, PARAMS.gNEMax);
    const gq = Math.round(g / PARAMS.gNEQuantum) * PARAMS.gNEQuantum;
    vars[this.v.gNE] = gq;
    k.setGain('ne', gq);
  }

  quiet() {
    const vars = this.k.vars;
    if (vars[this.v.salience] !== 0 || vars[this.v.predErr] !== 0) return false;
    for (const p of this.poolSrc) if (Math.abs(vars[p.v] - this._poolTarget(p)) > PARAMS.quietEps) return false;
    return true;
  }

  // --- Salience (§3.12, §4.9, §5.12, §5.16) ---
  onSense(p) {
    const k = this.k, vars = k.vars, t = p.tOnset, m = p.idx;
    if (m < 0) return;
    // Habituation trace and running prediction, decayed analytically to t.
    const H = this.hab[m] * Math.exp(-(t - this.habT[m]) / PARAMS.tauRec);
    const pr = this.pred[m] * Math.exp(-(t - this.predT[m]) / PARAMS.tauPred);
    const gHab = 1 / (1 + PARAMS.kHab * H), N = gHab * (1 - Math.min(1, pr));
    const sal = Math.min(1, p.psiN * N * (PARAMS.b + p.c));
    const eps = p.psiN * (1 - Math.min(1, pr));
    this.hab[m] = H + (p.psiN > 0 ? PARAMS.rho : 0); this.habT[m] = t;
    if (p.psiN > 0) { this.pred[m] = 1; this.predT[m] = t; }
    vars[this.v.predErr] = Math.max(vars[this.v.predErr], eps);
    vars[this.v.salience] = Math.max(vars[this.v.salience], sal);
    const st = vars[this.v.state] | 0, asleep = SLEEP.has(st);
    const thr = PARAMS.thetaS * (asleep ? PARAMS.states[STATES[st]].factor : 1);
    const tResp = p.tStart + PARAMS.lcLatency;
    if (p.psiN > 0 && sal >= thr) {
      k.at(tResp, 'bn.lcBurst', { amp: sal });
      k.at(tResp, 'bn.salStart', { amp: sal });
      if (asleep) k.at(tResp, 'bn.wake', null);
    } else if (asleep && p.psiN > 0) {
      k.log({ kind: 'kcomplex', node: 'thalRet', label: 'K-complex (below arousal threshold)' });
    }
  }

  lcBurst({ amp }) {
    const k = this.k, vars = k.vars, t = k.t;
    if (t < vars[this.v.lcRefract]) return;   // no second burst during post-burst suppression (§3.12)
    const st = vars[this.v.state] | 0, P = PARAMS.rates.lc, rs = Math.max(PARAMS.states[STATES[st]].lc, PARAMS.minRateFrac * P[1]);
    vars[this.v.lcExtra] = this.lcKappa * (logit(PARAMS.lcBurstHz, P[1]) - logit(rs, P[1]));
    vars[this.v.lcPhasic] = amp;
    vars[this.v.lcUntil] = t + PARAMS.lcBurstS;
    vars[this.v.lcRefract] = t + PARAMS.lcBurstS + PARAMS.lcSuppressS;
    this._applyDrives();
    k.at(t + PARAMS.lcBurstS, 'bn.lcSuppress', null);
    k.at(t + PARAMS.lcBurstS + PARAMS.lcSuppressS, 'bn.lcRecover', null);
    k.log({ kind: 'lcPhasic', node: 'lc', label: `LC burst, salience ${amp.toFixed(2)}` });
  }

  lcSuppress() {
    const k = this.k, vars = k.vars, st = vars[this.v.state] | 0, P = PARAMS.rates.lc;
    const rs = Math.max(PARAMS.states[STATES[st]].lc, PARAMS.minRateFrac * P[1]);
    const rLow = Math.min(rs, PARAMS.lcSuppressHz);
    vars[this.v.lcExtra] = this.lcKappa * (logit(rLow, P[1]) - logit(rs, P[1]));
    this._applyDrives();
  }

  lcRecover() {
    const vars = this.k.vars;
    if (this.k.t + 1e-12 < vars[this.v.lcRefract]) return;
    vars[this.v.lcExtra] = 0; vars[this.v.lcPhasic] = 0;
    this._applyDrives();
  }

  salStart({ amp }) {
    const k = this.k, vars = k.vars, t = k.t;
    vars[this.v.salAmp] = Math.max(amp, t < vars[this.v.salUntil] ? vars[this.v.salAmp] : 0);
    vars[this.v.salUntil] = t + PARAMS.salWindow;
    for (const s of this.salTargets) {
      if (s.j < 0) continue;
      if (s.id === 'cea' && !k.bodyOn) continue;   // CeA drives lh, pag, pvn, nAmbVagal with the body on (§3.12)
      k.setExt(s.j, s.w * vars[this.v.salAmp]);
    }
    k.at(t + PARAMS.salWindow, 'bn.salEnd', null);
  }

  salEnd() {
    const k = this.k, vars = k.vars;
    if (k.t + 1e-12 < vars[this.v.salUntil]) return;
    vars[this.v.salAmp] = 0;
    for (const s of this.salTargets) if (s.j >= 0) k.setExt(s.j, 0);
  }

  // --- Display (§13.6, §13.7; screen time) ---
  // Instantaneous rest-normalised activity into `out` (regions) and `outArea` (areas).
  computeActivity(out = new Float32Array(this.activity.length).fill(1), outArea = new Float32Array(this.areaActivity.length).fill(1)) {
    const k = this.k, D = PARAMS.display;
    const f = (j) => clamp(1 + D.k * (k.a(j) - k.aRest(j)), D.min, D.max);
    for (const c of this.regionCols) { const v = f(c.j); out[c.col] = v; if (c.mid) out[c.col + 1] = v; }
    for (const c of this.areaCols) outArea[c.col] = f(c.j);
    return { activity: out, areaActivity: outArea };
  }

  updateVisuals(dtS = 0) {
    if (!this._tmp) { this._tmp = new Float32Array(this.activity.length); this._tmpA = new Float32Array(this.areaActivity.length); }
    this._tmp.fill(1); this._tmpA.fill(1);
    this.computeActivity(this._tmp, this._tmpA);
    const a = dtS > 0 ? 1 - Math.exp(-dtS / PARAMS.display.tau) : 0;
    for (let i = 0; i < this.activity.length; i++) this.activity[i] += (this._tmp[i] - this.activity[i]) * a;
    for (let i = 0; i < this.areaActivity.length; i++) this.areaActivity[i] += (this._tmpA[i] - this.areaActivity[i]) * a;
    if (this.tint) this._fillTint();
  }

  // Modulator tints on source nuclei (§13.6), ≤ 4 at once; [] or null turns them off.
  setTints(names) {
    const set = (names ?? []).filter((n) => n in PARAMS.tints).slice(0, 4);
    this._tintSet = set;
    this.tint = set.length ? new Float32Array(8 * A.REGION_COUNT) : null;
    if (this.tint) this._fillTint();
  }

  _fillTint() {
    const vars = this.k.vars, t = this.tint;
    t.fill(0);
    for (const name of this._tintSet) {
      const T = PARAMS.tints[name], m = PARAMS.tintMix * clamp(vars[this.vPool[T.pool]] / T.max, 0, 1);
      for (const id of T.src) {
        const r = A.R[id];
        if (r === undefined) continue;
        for (let s = 0; s < 2; s++) { const o = (2 * r + s) * 4; t[o] = T.rgb[0] / 255; t[o + 1] = T.rgb[1] / 255; t[o + 2] = T.rgb[2] / 255; t[o + 3] = m; }
      }
    }
  }
}
BrainNet.fragment = brainFragment;
BrainNet.STATES = STATES;

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'brainnet',
  scope: 'brain',
  order: 0,
  fragment: brainFragment,
  create: (k) => new BrainNet(k),
};
