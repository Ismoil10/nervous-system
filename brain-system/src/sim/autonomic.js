// @ts-check
// Autonomic network plugin (research/ANALYSIS.md §7; switches A.5, §11.10–§11.13; orgasm commands §11.14;
// B.4, B.15 phase 5). Plugin contract: graph.js header. Scope 'body', order 30.
//
// Fragment (graph build time): the arterial baroreceptors (carotid sinus in IX, aortic arch in X) as
// receptor nodes on the visceral afferent port (→ ntsVisc → cvlm ⊣ rvlm; ntsVisc → nAmbVagal, dmv in
// the brain fragment), the sympathetic outflow (portSymp → bulbospinal → IML → paravertebral and
// prevertebral ganglia), the vagal, cranial and sacral parasympathetic outflow (portVag → cardiac
// plexus; portPara → ciliary ganglion; portSacral → sacral preganglionic column) and the effectors
// (§7.2, §7.4, §11.3; positions §2). Every ANS edge needs `autonomic` (A.5).
//
// Instance (kernel layers, §7.14):
//   CV (10 ms)   commands      cmd_X = rest_X ∓ G_X · (b − 0.5) + offsets (§7.6, §7.8); b from the
//                              carotid and aortic pressures; offsets from salience, lcPhasic (§3,
//                              §11.13), the EW rate (light reflex), the thermal error, u_stress (§12.3)
//                              and, in switched modes only, the orgasm command record (§11.14)
//                tones         tone ← relax(tone, g.autonomic(t) · F_iv · cmd(t − D), τ)  (§11.10, §11.13)
//                heart         hr = IHR(age) · f_T · (1 + k_s · s̃_eff) / (1 + k_v · ṽ)      (§7.5)
//                vessels       co = 5.0 · (hr/68)^0.25 · P_post · (1 + 0.5 (s̃_ven − 0.10)) · contractility^0.5
//                              G = 0.40 G0 + 0.60 G0 · 1.3 / (1 + 3 s̃_R); map = co / G     (§7.5)
//                pupil         pupilD = clamp(5.0 + 3.0 · tone.symPup − 3.5 · tone.ew + ΔD_ar, 1.5, 8)  (§7.7)
//                skin          scr = Bateman response to phasic palmar sudomotor drive (§7.7)
//                respiration   ve from the CO₂ chemoreflex (central share 2/3, §7.9); vt = 0.5 (ve/7)^0.6
//   EN (1 s)     heat balance  dtCore/dt = A · (tSet − tCore) / τ_T (§7.10); BAT; bladder filling (§7.7)
//
// Cross-module values are read only through k.ref(<A.3.4 name>, <A.5 basal>): salience, lcPhasic,
// arousalState (brainnet), adrenalineRel (endocrine), tSet (immune). The overlays (RSA) are added at
// readout (§11.6): `hr` is the beat-averaged deterministic core; `aut.hrInst` carries the RSA overlay.
// Units: mmHg, bpm, L, mm, µS, °C, human seconds.

import { NET_IDS } from './graph.js';

// --- Constants (§ citations; [model] = model choice) ---
export const PARAMS = {
  hCV: 0.01,                     // s, CV step (A.4)
  fMax: 10,                      // spikes/s, f_max of every channel (§7.6) [model] display scale
  // Heart (§7.5)
  ihr: { a: 118.1, b: 0.57 },    // IHR = 118.1 − 0.57 · age (Jose & Collison 1970 [secondary])
  kV: 2.0, kS: 0.851,            // §7.5 [model]: atropine ≈ 110; HRmax at full sympathetic tone
  kAdr: 0.05,                    // β1 action of plasma adrenaline per unit of the ratio to basal (§7.5) [model]
  kT: 0.075,                     // 1/°C, SA-node temperature coefficient (§10.6) [model]
  // Haemodynamics (§7.5) [model]
  co0: 5.0, hr0: 68, coHrExp: 0.25, venGain: 0.5, ven0: 0.10, contr0: 0.105,
  tpr0: 17.6, gFixed: 0.40, gNeural: 0.60, rGain: 3, rRest: 1.3,
  sv0: 73.5, pp0: 40,
  // Baroreflex (§7.8)
  p50: 88, kB: 10,               // mmHg [model]
  wCs: 0.30,                     // carotid weight [model]
  hydro: 17.9,                   // mmHg, heart–carotid offset upright (232 mm × 0.0772 mmHg/mm, §2)
  baroRate: { min: 2.5, max: 48 },   // Hz, baroreceptor afferent display scale (Ursino 1998 [recalled])
  baroQuantum: 0.25,             // Hz; NF baroreceptor drive is updated in these steps so rest stays asleep [model]
  // Orthostasis (§7.8) [model]
  // §7.8 gives the muscle vasodilation as ×(1 + 0.40 α), α peaking at 10 s, which yields +36 bpm at 10 s
  // (§7.15 "model deviations"). Here 0.30 peaking at 12 s (the Borst et al. 1982 main HR peak) [model],
  // plus the §7.8 low-pressure unloading term, calibrated to §12.20 rows 18–20: HR peak ≈ +30 at ≈ 10 s.
  stand: { ramp: 3, pFall: 0.23, tauPost: 7, ccPeak: 1.5, ccAmp: 0.06, vdPeak: 12, vdAmp: 0.30,
    // Low-pressure (cardiopulmonary) unloading → fSymMus, proportional to the fall of P_post (§7.8; not
    // in the §7.8 model check) [model]: tone per full 23 % preload fall.
    lpGain: 0.10 },
  // Channels: rest tone, baroreflex gain G (sign: + for vagal), dead time D (s), τ on/off (s) (§7.5, §7.6, §7.7).
  // D and τ are the §7.5 values where given; the others are [model].
  ch: {
    vagCard: { rest: 0.309, G: 0.58, D: 0.3, on: 0.5, off: 0.5 },
    symCard: { rest: 0.105, G: -0.50, D: 2.0, on: 4, off: 10 },
    symMus: { rest: 0.10, G: -0.50, D: 2.0, on: 6, off: 6 },       // resistance stage 2 / 6 (Ursino 1998 [recalled])
    symSpl: { rest: 0.10, G: -0.50, D: 2.0, on: 6, off: 6 },
    symSkin: { rest: 0.15, G: -0.10, D: 1.0, on: 3, off: 6 },
    sudoPalm: { rest: 0.05, G: 0, D: 1.15, on: 0.3, off: 1.0 },     // central 0.25 + bulbospinal 0.07 + postganglionic 0.9 m at 1 m/s − gland in the scr filter (§7.6)
    sudoSole: { rest: 0.05, G: 0, D: 1.55, on: 0.3, off: 1.0 },     // 1.2 m postganglionic (§7.6)
    sudoForehead: { rest: 0.05, G: 0, D: 0.6, on: 0.3, off: 1.0 },
    sudoAxilla: { rest: 0.05, G: 0, D: 0.8, on: 0.3, off: 1.0 },
    symAdr: { rest: 0.05, G: -0.20, D: 0.5, on: 2, off: 2 },
    symBat: { rest: 0.02, G: 0, D: 2.0, on: 5, off: 5 },
    symPupR: { rest: 0.10, G: 0, D: 0.3, on: 1, off: 5 },          // redilation, sympathetic 5–15 s (§7.7)
    symPupL: { rest: 0.10, G: 0, D: 0.3, on: 1, off: 5 },
    symGut: { rest: 0.10, G: -0.20, D: 2.0, on: 6, off: 6 },
    vagGut: { rest: 0.20, G: 0, D: 0.3, on: 1, off: 1 },
    // EW: ew → ciliaryGang → sphincter conduction ≈ 45 ms (78 mm B + 35 mm Cpost, §2.14) + sphincter dead
    // time 135 ms (§7.6); constriction τ 0.25 s, parasympathetic redilation τ 1.5 s (§7.7).
    ewR: { rest: 0, G: 0, D: 0.18, on: 0.25, off: 1.5 },
    ewL: { rest: 0, G: 0, D: 0.18, on: 0.25, off: 1.5 },
    sal: { rest: 0.10, G: 0, D: 0.3, on: 0.5, off: 0.5 },
    sacral: { rest: 0.02, G: 0, D: 0.5, on: 1, off: 1 },
  },
  // Haemodynamic effector stages after their own dead time and lag (§7.5 table, Ursino 1998 [recalled]).
  eff: { contr: { cmd: 'symCard', D: 2, on: 8, off: 8 }, ven: { cmd: 'symSpl', D: 5, on: 20, off: 20 } },
  ringS: 5.12,                   // s, dead-time ring (≥ the venous 5 s, §7.14)
  // Pupil (§7.7)
  pupil: { d0: 5.0, kSym: 3.0, kEw: 3.5, min: 1.5, max: 8, lum50: 2.63, lumK: 1.2, background: 100,
    lum1000: 1000,
    // EW command = e_L(background) + kRate · Δa_ew. kRate maps the plateau of the pretectal → EW rate
    // (Δa ≈ 0.954 for a 1,000 cd/m² step, brainnet/sensory) onto e_L(1,000) − e_L(100) (§7.7) [model].
    ewPlateau: 0.954,
    sleep: 0.08,                 // EW tone added in sleep (sleep miosis, §7.6 "sleep (+)") [model]
    // Psychosensory dilation ΔD_ar: lcPhasic and salience through the unit-peak kernel h(t) = tⁿ e^(−n t/t_max)
    // (Hoeks & Levelt 1993: n 10.1, t_max 0.93 s), realised as n + 1 first-order stages of τ = t_max / n.
    arN: 10.1, arTmax: 0.93,
    arGain: 1.5,               // mm per unit drive [model] (§7.15 open: not tabulated); loudSound ≈ 0.8 mm (§12.6)
    // A light drive above background occludes the psychosensory term: ΔD_ar · (1 − m), m = the EW tone
    // increment as a fraction of the 1,000 cd/m² increment [model] (pretectal drive overrides LC inhibition).
  },
  // Skin conductance (§7.7)
  scr: { tauFast: 0.75, tauSlow: 3.0, gain: 6.0,   // µS per unit phasic drive (Bateman A·(e^(−t/3) − e^(−t/0.75))) [model]
    sclBase: 5, sclMin: 2, tauScl: 30 },            // µS model baseline (Dawson et al. 2007); τ [model]
  // Offsets (§7.4, §7.8 defence, §11.13 couplings) [model]: per unit salience / lcPhasic / u_stress.
  // defence.vag 0.12: the transient vagal withdrawal that carries the hotObject HR rise; calibrated with
  // somatic and autonomic together to §12.20 row 12 (paired +5–15 bpm; prototype +6.1) (§7.15: §7 owns
  // the defence gains) [model].
  defence: { vag: 0.12, sym: 0.05, skin: 0.05 },
  emo: { palm: 0.5, sole: 0.5, forehead: 0.2, axilla: 0.3 },
  // stress.symAdr 0.185: with the endocrine module, tone.symAdr / rest peaks near ×4.1, so the adrenaline
  // pool reproduces the §12.11 input profile (×4.12 at 14 min) that endocrine's stand-in gives without
  // this module (§9.10) [model].
  stress: { symCard: 0.15, vag: 0.10, symMus: 0.05, symSpl: 0.05, symAdr: 0.185, pup: 0.10, palm: 0.05 },
  // Spinal cord injury rule (§7.8): each channel follows the bulbospinal drive of the IML segments it
  // leaves the cord from (§7.2 outflow; sided entries 'T1.R', else both sides) [model segment map]. Below
  // a lesion the bulbospinal drive is zero and a segmental spinal tone remains, a fraction of the
  // channel's rest tone scaled by the §6 spinal-shock phase 1–4 (depressed early, recovering late;
  // Ditunno et al. 2004) [model]: chronic tetraplegia keeps roughly a third to a half of resting
  // sympathetic activity (Mathias & Frankel [recalled]).
  bulbospinal: {
    symCard: ['T1', 'T3'], symMus: ['T1', 'T3', 'T6', 'L1'], symSpl: ['T6'], symSkin: ['T1', 'T3', 'T6', 'L1'],
    sudoPalm: ['T1.R', 'T3.R'], sudoSole: ['L1.R'], sudoForehead: ['T1'], sudoAxilla: ['T3'], symAdr: ['T6'], symBat: ['T1', 'T3'],
    symPupR: ['T1.R'], symPupL: ['T1.L'], symGut: ['T6'], sacral: ['S2'],
  },
  spinalRest: [0, 0.1, 0.2, 0.4, 0.5],   // index = phase 1–4 (0 unused) [model]
  // §11.14 offset gains (§7 owns them, §7.15) [model]: cmdSym onto tone.symCard (sym) and tone.symMus,
  // tone.symSpl (vasc); cmdVag subtracted from tone.vagCard. The vascular share is small so that the
  // baroreflex does not cancel the cardiac offsets through a pressor response.
  orgasm: { sym: 0.5, vasc: 0.1, vag: 0.3 },
  // §10.6 PGE2 commands (0.6 / 0.5 / 0.3 "tone units" × saturation, published by the immune module) onto
  // the §7 channel tones. At face value they give ≈ +68 bpm at the fever plateau with the §7.5 law; 0.35
  // gives ≈ +23–28 bpm, the §12.20 row 38 band (§7.15: the PGE2 offset gains are §7's to set) [model].
  pge2Scale: 0.35,
  // Respiration (§7.9) [model]
  resp: { rr0: 14, vt0: 0.5, ve0: 7, paco2: 40, pao2: 95, hcvr: 2.0, central: 2 / 3, vtExp: 0.6,
    tauVe: 5, tauCo2: 600, tauClamp: 1, pao2Slope: 1.25,
    // RSA: inspiration gates the vagal command, which then passes the cardiac vagal effector lag (§7.5,
    // τ = ch.vagCard.on 0.5 s), applied analytically to the sinusoid (gain 1/√(1 + (ωτ)²), phase lag
    // atan ωτ) so it holds in coarse CV mode (§11.6). Gives ≈ 10.5 bpm at 14 breaths/min (§7.8 model
    // check: 9.4) [model].
    rsa: 0.25,
    // LUNGS.md §8 [model]. CO₂ balances on alveolar ventilation V̇A = (VT − VD)·f, so rapid shallow
    // breathing ventilates less; rest is unchanged (4.9 L/min ↔ PaCO₂ 40). Below eupnoeic PaCO₂ the
    // awake CO₂ response is flat (the "dog-leg", LUNGS.md §5.2): hcvrLow.
    vd: 0.15, hcvrLow: 0.5,
    // Two-pool CO₂ (LUNGS.md §4.3): a fast lung-and-blood pool (share `fast`, τ tauFast at resting
    // V̇A) and the tissue pool (τ tauCo2); both relax to 40·V̇A₀/V̇A, so rest is unchanged.
    fast: 0.6, tauFast: 60,
    // Behavioural drive (LUNGS.md §5.3, §6): the rate rises with the stressor input u and the arousal
    // drive h (14 + 13·h, the RESPONSE.md §7.4 law), falls with relaxation c (Calm, slow and deep);
    // stress and arousal add alveolar ventilation beyond the metabolic need (hypocapnia, opposed by
    // the chemoreflex). Arousal's extra V̇A grows as h⁴, so the plateau stays near resting depth and the
    // climax is fast and deep ("hyperventilation begins late", RESPONSE.md §4.1). No metabolic term:
    // exertion's V̇CO₂ is not modelled. Measured: PaCO₂ ≈ 38 in a full stressor (LUNGS.md §13).
    beh: { tau: 5, stressRate: 0.30, stressVA: 0.20, calmRate: 0.25, arousalRate: 13, arousalVA: 3.0, arousalExp: 4 },
    // Sighs (LUNGS.md §5.1): ≈ 12 per hour at rest (Li et al. 2016), doubling in a full stressor.
    sigh: { rate: 12, stress: 1 },
    // PaCO₂ − EtCO₂ (2–5 mmHg in health); HCO₃⁻ and its acute buffering (+1 per 10 mmHg rise,
    // −2 per 10 mmHg fall) for the acute pH (LUNGS.md §4.2).
    etGrad: 3, hco3: 24, hco3Up: 0.1, hco3Down: 0.2 },
  // Thermoregulation (§7.10)
  thermo: { tSet: 37.0, tauT: 2700, warm: [0.08, 0.42, 0.50], cool: [0.25, 0.75], tSkin: 33.0,
    sweatOn: 0.1, vcOn: 0.1,                         // onsets tSet + 0.1 / − 0.1 °C [model]
    skin: 0.5, bat: 0.5, sweat: 0.5, palmSweat: 0.1, skinWarm: 0.15,   // tone per °C [model]
    sweatMax: 1.5, tauBat: 300, sbf0: 0.25, sbfMax: 7 },   // L/h, s (§7.7 "τ ≈ 5 min"), L/min (Rowell 1974)
  // Bladder (§7.7) [model]
  bladder: { v0: 150, urine: 1, capacity: 450, max: 600, flow: 20, voidTone: 0.8 },   // mL, mL/min, mL/s
  // CV quiescence (§11.6): |Δhr| < 0.02 bpm/s and |Δmap| < 0.02 mmHg/s on 1-s boundaries [model]
  quiet: { d: 0.02, gap: 1e-3 },
  settleS: 300,                  // s, resting-state cache window (§11.10)
};

const CH = Object.keys(PARAMS.ch);
const CI = Object.fromEntries(CH.map((c, i) => [c, i]));
const SYM = ['symCard', 'symMus', 'symSpl', 'symSkin', 'symAdr', 'symBat', 'symPupR', 'symPupL', 'symGut'];
const SUDO = ['sudoPalm', 'sudoSole', 'sudoForehead', 'sudoAxilla'];
const RING = Math.round(PARAMS.ringS / PARAMS.hCV);
const STAGES = [...CH.map((c) => ({ id: c, cmd: c, ...PARAMS.ch[c] })), ...Object.entries(PARAMS.eff).map(([id, e]) => ({ id, ...e }))];
const SI = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
// Tone variables (A.3.4 `tone.<channel>`; §7 spells the sided pupil channels and the EW tone this way).
const TONE_NAME = {
  vagCard: 'tone.vagCard', symCard: 'tone.symCard', symMus: 'tone.symMus', symSpl: 'tone.symSpl', symSkin: 'tone.symSkin',
  sudoPalm: 'tone.fSudo.palm', sudoSole: 'tone.fSudo.sole', sudoForehead: 'tone.fSudo.forehead', sudoAxilla: 'tone.fSudo.axilla',
  symAdr: 'tone.symAdr', symBat: 'tone.symBat', symGut: 'tone.symGut', vagGut: 'tone.vagGut', sal: 'tone.sal', sacral: 'tone.sacral',
};
// Channel rates (A.3.4 `f<channel>`, spikes/s).
const RATE_NAME = {
  vagCard: 'fVagCard', symCard: 'fSymCard', symMus: 'fSymMus', symSpl: 'fSymSpl', symSkin: 'fSymSkin',
  sudoPalm: 'fSudo.palm', sudoSole: 'fSudo.sole', sudoForehead: 'fSudo.forehead', sudoAxilla: 'fSudo.axilla',
  symAdr: 'fSymAdr', symBat: 'fSymBat', symGut: 'fSymGut', vagGut: 'fVagGut', sal: 'fSal', sacral: 'fSacral',
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sigma = (x) => 1 / (1 + Math.exp(-x));
const lumDrive = (L) => sigma((Math.log10(L) - PARAMS.pupil.lum50) / PARAMS.pupil.lumK);   // e_L (§7.7)
const E_REST = lumDrive(PARAMS.pupil.background);
const E_1000 = lumDrive(PARAMS.pupil.lum1000);
const alphaFn = (t, tp) => (t <= 0 ? 0 : (t / tp) * Math.exp(1 - t / tp));   // unit-peak alpha function (§7.8)
export const ihr = (age) => PARAMS.ihr.a - PARAMS.ihr.b * age;
// Resting alveolar ventilation (LUNGS.md §3.1): (0.5 − 0.15) × 14 = 4.9 L/min.
const VA0 = (PARAMS.resp.vt0 - PARAMS.resp.vd) * PARAMS.resp.rr0;
// Arterial O₂ saturation, % (Severinghaus 1979, LUNGS.md §4.2): the curve S = 1/(23,400/(P³ + 150P) + 1)
// at the "virtual" PO₂ corrected for temperature, pH and PaCO₂ (the Bohr shift).
export function sao2(po2, ph, pco2, temp = 37) {
  const pv = Math.max(0, po2) * Math.pow(10, 0.024 * (37 - temp) + 0.40 * (ph - 7.40) + 0.06 * Math.log10(40 / Math.max(1, pco2)));
  return pv > 0 ? 100 / (23400 / (pv * pv * pv + 150 * pv) + 1) : 0;
}
// Acute arterial pH from PaCO₂ (Henderson–Hasselbalch, LUNGS.md §4.2): HCO₃⁻ buffered acutely.
export function acutePH(pco2) {
  const R = PARAMS.resp, d = pco2 - R.paco2;
  const hco3 = R.hco3 + (d > 0 ? R.hco3Up : R.hco3Down) * d;
  return 6.1 + Math.log10(Math.max(1, hco3) / (0.03 * Math.max(1, pco2)));
}

// --- Fragment (§7.2, §11.3; positions §2 body frame, mm) ---
const mir = (p) => [-p[0], p[1], p[2]];
const POS = {
  carotidSinus: [25, 5, -120], ixGang: [30, -30, -68], csNerve: [28, -8, -95], aorticArch: [-20, -8, -252], nodose: [30, -24, -80],
  'cord.T1.iml': [4, -55, -172], 'cord.T3.iml': [4, -64, -196], 'cord.T6.iml': [4, -79, -267], 'cord.L1.iml': [4, -83, -404],
  'cord.S2.spn': [3, -68, -479],
  stellate: [32, -40, -186], scg: [32, -20, -105], coeliac: [18, -10, -470], ciliaryGang: [27, 40, -35], cardiacPlexus: [-12, -4, -284],
  saNode: [30, 0, -312], heart: [-22, 15, -352], pupilSphincter: [33, 72, -38], pupilDilator: [33, 72, -38],
  sweatPalm: [238, 0, -870], sweatSole: [85, 30, -1672], sweatForehead: [0, 78, 35], sweatAxilla: [152, -22, -285],
  skinVessels: [214, -60, -690], muscleVessels: [195, -30, -563], splanchnicVessels: [-7, 7, -500],
  adrenalMedulla: [42, -42, -447], bat: [65, 5, -200], bladder: [0, 5, -760],
};
const SIDES = ['R', 'L'];

function fragment(ctx) {
  const nodes = [], edges = [];
  const at = (id, s) => (s === 'L' ? mir(POS[id]) : [...POS[id]]);
  const port = (id, s) => `${id}.${s}`;
  const A = (o) => edges.push({ kind: 'axon', nets: ['autonomic'], ...o });
  const brr = PARAMS.baroRate, rRest = brr.min + (brr.max - brr.min) * 0.5;

  // Visceral afferents (ans.vaff): baroreceptor fields drive the visceral afferent port (§7.8, §11.3).
  // Their rate is set by the CV layer (xfer 'direct'); no `cls`, so sensory.js leaves them alone.
  for (const s of SIDES) {
    nodes.push({ id: `carotidSinus.${s}`, kind: 'receptor', owner: 'ans.vaff', pos: at('carotidSinus', s), side: s, xfer: 'direct',
      rmax: brr.max, rSpont: rRest, site: 'carotidSinus', label: 'carotid sinus baroreceptors' });
    // carotid sinus nerve (IX) → inferior glossopharyngeal ganglion → jugular foramen → NTS; 104 mm A-fibre (§2.14)
    A({ from: `carotidSinus.${s}`, to: port('portVisc', s), fibre: 'Adelta', len: 104, nSyn: 0, w: 1, transmitter: 'Glu', optional: true,
      path: [at('carotidSinus', s), at('csNerve', s), at('ixGang', s), ctx.has(port('portVisc', s)) ? ctx.pos(port('portVisc', s)) : at('ixGang', s)],
      label: 'carotid sinus nerve (IX)' });
  }
  nodes.push({ id: 'aorticArch', kind: 'receptor', owner: 'ans.vaff', pos: [...POS.aorticArch], side: null, xfer: 'direct',
    rmax: brr.max, rSpont: rRest, site: 'aorticArch', label: 'aortic arch baroreceptors' });
  for (const s of SIDES) {
    A({ from: 'aorticArch', to: port('portVisc', s), fibre: 'Adelta', nSyn: 0, w: 0.5, transmitter: 'Glu', optional: true,
      path: [[...POS.aorticArch], at('nodose', s), ctx.has(port('portVisc', s)) ? ctx.pos(port('portVisc', s)) : at('nodose', s)],
      label: 'aortic depressor fibres (X), nodose ganglion' });
  }

  // Sympathetic outflow (ans.symp): bulbospinal premotor axons → IML columns → ganglia (§7.2, §7.6).
  // IML and sacral columns are cord parts other modules may also declare (shared, A.3.3).
  const seg = (id, s, owner) => ({ id: `${id}.${s}`, kind: 'segment', owner, pos: at(id, s), side: s, tau: 0.003, rmax: 50, rSpont: 2,
    shared: true, label: id });
  const gang = (id, s, owner) => ({ id: s ? `${id}.${s}` : id, kind: 'ganglion', owner, pos: s ? at(id, s) : [...POS[id]], side: s ?? null, label: id });
  const eff = (id, s, kind = 'effector') => ({ id: s ? `${id}.${s}` : id, kind, owner: 'tissue', layer: 'CV', pos: s ? at(id, s) : [...POS[id]], side: s ?? null, label: id });
  for (const s of SIDES) {
    for (const c of ['cord.T1.iml', 'cord.T3.iml', 'cord.T6.iml', 'cord.L1.iml']) nodes.push(seg(c, s, 'ans.symp'));
    nodes.push(seg('cord.S2.spn', s, 'ans.para'));
    nodes.push(gang('stellate', s, 'ans.symp'), gang('scg', s, 'ans.symp'), { ...gang('coeliac', s, 'ans.symp'), shared: true }, gang('ciliaryGang', s, 'ans.para'));
    nodes.push(eff('pupilSphincter', s), eff('pupilDilator', s), eff('sweatPalm', s), eff('sweatSole', s), eff('sweatAxilla', s), eff('adrenalMedulla', s, 'organ'));
  }
  nodes.push(gang('cardiacPlexus', null, 'ans.para'));
  nodes.push(eff('saNode'), eff('heart', null, 'organ'), eff('sweatForehead'), eff('skinVessels'), eff('muscleVessels'), eff('splanchnicVessels'),
    eff('bat', null, 'organ'), eff('bladder', null, 'organ'));

  for (const s of SIDES) {
    const T = (c) => `${c}.${s}`;
    // Bulbospinal (3 m/s, §4.4b): portSymp → IML; 131 mm to T1 (§2.14), the lower columns by arc length (§2).
    const bs = { 'cord.T1.iml': 131, 'cord.T3.iml': 156, 'cord.T6.iml': 229, 'cord.L1.iml': 367 };
    for (const [c, len] of Object.entries(bs)) {
      edges.push({ from: port('portSymp', s), to: T(c), kind: 'tract', tract: 'bulbospinal', fibre: 'cns', nets: ['autonomic'], len, w: 1, transmitter: 'Glu', optional: true, label: 'bulbospinal premotor' });
    }
    // Preganglionic B fibres, postganglionic Cpost (§7.2; lengths §2.14 where given, else 1.2 × distance).
    A({ from: T('cord.T1.iml'), to: T('stellate'), fibre: 'B', len: 71, w: 1, transmitter: 'ACh', label: 'white ramus T1 → stellate' });
    A({ from: T('cord.T3.iml'), to: T('stellate'), fibre: 'B', w: 1, transmitter: 'ACh', label: 'chain T3 → T2 → stellate' });
    A({ from: T('cord.T1.iml'), to: T('scg'), fibre: 'B', w: 1, transmitter: 'ACh', label: 'cervical chain → SCG' });
    A({ from: T('cord.T6.iml'), to: T('coeliac'), fibre: 'B', w: 1, transmitter: 'ACh', label: 'greater splanchnic → coeliac' });
    A({ from: T('cord.T6.iml'), to: T('adrenalMedulla'), fibre: 'B', w: 1, transmitter: 'ACh', label: 'greater splanchnic → adrenal medulla (no synapse)' });
    A({ from: T('stellate'), to: s === 'R' ? 'saNode' : 'heart', fibre: 'Cpost', len: 175, w: 1, transmitter: 'NE', label: 'cardiac sympathetic (β1)' });
    A({ from: T('stellate'), to: T('sweatPalm'), fibre: 'Cpost', len: 900, w: 1, transmitter: 'ACh', label: 'sudomotor, palm (M3)' });
    A({ from: T('stellate'), to: T('sweatAxilla'), fibre: 'Cpost', w: 1, transmitter: 'ACh', label: 'sudomotor, axilla' });
    A({ from: T('stellate'), to: 'skinVessels', fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'cutaneous vasoconstrictor (α1)' });
    A({ from: T('stellate'), to: 'muscleVessels', fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'muscle vasoconstrictor (α1)' });
    A({ from: T('stellate'), to: 'bat', fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'BAT (β)' });
    A({ from: T('scg'), to: T('pupilDilator'), fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'pupil dilator (α1)' });
    A({ from: T('scg'), to: 'sweatForehead', fibre: 'Cpost', w: 1, transmitter: 'ACh', label: 'sudomotor, forehead' });
    A({ from: T('coeliac'), to: 'splanchnicVessels', fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'splanchnic vasoconstrictor' });
    A({ from: T('cord.L1.iml'), to: T('sweatSole'), fibre: 'Cpost', len: 1200, w: 1, transmitter: 'ACh', label: 'sudomotor, sole' });
    A({ from: T('cord.L1.iml'), to: 'bladder', fibre: 'Cpost', w: 1, transmitter: 'NE', label: 'hypogastric (storage)' });
    // Parasympathetic: vagal cardiac (279 mm B + 10 mm Cpost, §2.14), EW → ciliary (78 + 35 mm), sacral.
    A({ from: port('portVag', s), to: 'cardiacPlexus', fibre: 'B', len: 279, w: 1, transmitter: 'ACh', optional: true, label: 'cardiac vagal (cn10.para)' });
    A({ from: port('portPara', s), to: T('ciliaryGang'), fibre: 'B', len: 78, w: 1, transmitter: 'ACh', optional: true, label: 'cn3.para' });
    A({ from: T('ciliaryGang'), to: T('pupilSphincter'), fibre: 'Cpost', len: 35, w: 1, transmitter: 'ACh', label: 'short ciliary nerves (M3)' });
    edges.push({ from: port('portSacral', s), to: T('cord.S2.spn'), kind: 'tract', tract: 'bulbospinal', fibre: 'cns', nets: ['autonomic'], len: 410, w: 1, transmitter: 'Glu', optional: true, label: 'pontine micturition → sacral' });
    A({ from: T('cord.S2.spn'), to: 'bladder', fibre: 'B', w: 1, transmitter: 'ACh', label: 'pelvic splanchnic (voiding, M3)' });
  }
  A({ from: 'cardiacPlexus', to: 'saNode', fibre: 'Cpost', len: 10, w: 1, transmitter: 'ACh', label: 'cardiac ganglia → SA node (M2)' });
  return { nodes, edges };
}

// --- Instance ---
class Autonomic {
  constructor(k) {
    this.k = k;
    const P = PARAMS, ch = P.ch;
    const tone0 = (c) => (c.startsWith('ew') ? E_REST : ch[c].rest);
    // A.3.4 readouts (initial = the all-on resting state, §7.5, §7.7, §7.9, §7.10).
    const D = (name, init, unit) => k.declare(name, init, { unit });
    const sv0 = 1000 * P.co0 / P.hr0, pp0 = P.pp0 * sv0 / P.sv0, map0 = P.co0 * P.tpr0;
    this.v = {
      hr: D('hr', P.hr0, 'bpm'), hp: D('hp', 60 / P.hr0, 's'),
      sbp: D('sbp', map0 + 2 * pp0 / 3, 'mmHg'), dbp: D('dbp', map0 - pp0 / 3, 'mmHg'), map: D('map', map0, 'mmHg'), pp: D('pp', pp0, 'mmHg'),
      co: D('co', P.co0, 'L/min'), sv: D('sv', sv0, 'mL'), tpr: D('tpr', P.tpr0, 'mmHg·min/L'), contractility: D('contractility', 1),
      rr: D('rr', P.resp.rr0, '1/min'), vt: D('vt', P.resp.vt0, 'L'), ve: D('ve', P.resp.ve0, 'L/min'), respPhase: D('respPhase', 0),
      paco2: D('paco2', P.resp.paco2, 'mmHg'), pao2: D('pao2', P.resp.pao2, 'mmHg'),
      // LUNGS.md §8: alveolar ventilation, the behavioural rate and extra V̇A, the two CO₂ pools, the
      // derived gases (acute pH, SaO₂ by Severinghaus 1979, EtCO₂), the sigh rate, and the HUD's
      // relaxation input (Calm: 1; written by the app, 0 in every scenario).
      va: D('va', VA0, 'L/min'), rrB: D('resp.rrB', P.resp.rr0, '1/min'), dVA: D('resp.dVA', 0, 'L/min'),
      co2F: D('resp.co2Fast', P.resp.paco2, 'mmHg'), co2S: D('resp.co2Slow', P.resp.paco2, 'mmHg'),
      ph: D('phA', 7.4), sao2: D('sao2', sao2(P.resp.pao2, 7.4, P.resp.paco2, 37), '%'), etco2: D('etco2', P.resp.paco2 - P.resp.etGrad, 'mmHg'),
      sighRate: D('sighRate', P.resp.sigh.rate, '1/h'), relax: D('relax', 0),
      pupilL: D('pupilD.L', 0, 'mm'), pupilR: D('pupilD.R', 0, 'mm'),
      scl: D('scl', P.scr.sclBase, 'µS'), scr: D('scr', 0, 'µS'),
      tCore: D('tCore', P.thermo.tSet, '°C'), tSkin: D('tSkin', P.thermo.tSkin, '°C'),
      // tSet: §7 owns the 37.0 baseline, §10 the fever shift (A.3.4): tSet = 37.0 + tSetShift, the shift
      // already gated by g.neuroimmune in the immune module (§11.13 "Set point").
      tSet: k.declare('tSet', P.thermo.tSet, { unit: '°C', basal: P.thermo.tSet }),
      sweat: D('sweat', 0, 'L/h'), sbf: D('sbf', P.thermo.sbf0, 'L/min'), bat: D('bat', ch.symBat.rest), bladderVol: D('bladderVol', P.bladder.v0, 'mL'),
      ew: D('tone.ew', E_REST), fEw: D('fEw', E_REST * P.fMax, 'spikes/s'), symPup: D('tone.symPup', ch.symPupR.rest), fSymPup: D('fSymPup', ch.symPupR.rest * P.fMax, 'spikes/s'),
      // Private: instantaneous HR with the RSA overlay; posture fraction, preload, stand onset; quiet flag.
      hrInst: D('aut.hrInst', P.hr0, 'bpm'), standFrac: D('aut.standFrac', 0), pPost: D('aut.pPost', 1), standT0: D('aut.standT0', -1),
      cvN: D('aut.cvN', 0), sp: D('aut.scrP', 0), sq: D('aut.scrQ', 0), quiet: D('aut.quiet', 0), voiding: D('aut.voiding', 0),
      // Resting palmar tone trajectory: the palm stage driven by its rest command (same gate, factors and
      // τ), the reference the phasic SCR drive is taken above (§7.7, §7.12).
      scrRef: D('aut.scrRef', ch.sudoPalm.rest),
    };
    // Tones and rates; stage outputs.
    this.vTone = STAGES.map((s) => {
      const name = TONE_NAME[s.id] ?? `aut.tone.${s.id}`;
      const init = s.cmd ? tone0(s.cmd) : 0;
      return k.declare(name, s.id === 'contr' ? ch.symCard.rest : s.id === 'ven' ? ch.symSpl.rest : init);
    });
    this.vRate = CH.map((c) => (RATE_NAME[c] ? k.declare(RATE_NAME[c], tone0(c) * P.fMax, { unit: 'spikes/s' }) : -1));
    // Intervention factors per stage (§7.11); configuration, not body state.
    this.vIv = STAGES.map((s) => k.declare(`aut.iv.${s.id}`, 1, { body: false }));
    this.vIvAge = k.declare('aut.iv.donorAge', -1, { body: false });
    this.vIvAdr = k.declare('aut.iv.adrBeta', 1, { body: false });
    // §6 spinal-shock phase of the current SCI preset (1–4; chronic 4 otherwise), for the §7.8 spinal tone.
    this.vIvPhase = k.declare('aut.iv.sciPhase', 4, { body: false });
    k.declareArray('aut.ring', CH.length * RING, 0);
    this.nAr = Math.round(P.pupil.arN) + 1;
    k.declareArray('aut.ar', this.nAr, 0);
    k.declareArray('aut.qPrev', 6, 0);
    k.onLayer('CV', (t, h) => this.cv(t, h));
    k.onLayer('EN', (t, h) => this.en(t, h));
    k.onQuiet('CV', () => this.k.vars[this.v.quiet] === 1);
    k.onKhVote(() => (this.k.bodyOn && this.k.vars[this.v.quiet] !== 1 ? 1 : Infinity));
    k.on('intervention', (preset) => {
      if (!preset || !PRESET_IDS.has(preset.id)) this.resetPreset();
      const ph = preset?.params?.kind === 'sci' ? Number(preset.params.phase) : 4;
      k.vars[this.vIvPhase] = Number.isFinite(ph) ? clamp(Math.round(ph), 1, 4) : 4;
    });
    this.settleSeconds = P.settleS;
    this.cmd = new Float64Array(CH.length);
  }

  init(k) {
    // Cross-module readers (A.3.4 names, A.5 basal fallbacks).
    this.r = {
      salience: k.ref('salience', 0), lcPhasic: k.ref('lcPhasic', 0), arousal: k.ref('arousalState', 1),
      adrenaline: k.ref('adrenalineRel', 1), tSetShift: k.ref('tSetShift', 0),
      // §10.6 PGE2 commands published by the immune module (0 when it is absent).
      immSym: k.ref('immuneCmdSym', 0), immVag: k.ref('immuneCmdVag', 0), immAdr: k.ref('immuneCmdAdr', 0),
      posture: k.ref('posture', 0), age: k.ref('age', 30),
    };
    this.vNet = NET_IDS.map((n) => k.idx(`net.${n}`));
    this.ring = k.array('aut.ring');
    this.ar = k.array('aut.ar');
    this.qPrev = k.array('aut.qPrev');
    this.jEw = { R: k.nfIndex('ew.R'), L: k.nfIndex('ew.L') };
    this.jBaro = { cs: [k.nfIndex('carotidSinus.R'), k.nfIndex('carotidSinus.L')], ao: k.nfIndex('aorticArch') };
    this.dS = STAGES.map((s) => Math.max(1, Math.round(s.D / PARAMS.hCV)));
    this.cmdOf = STAGES.map((s) => CI[s.cmd]);
    // Bulbospinal edges (portSymp → IML, portSacral → sacral column) behind each stage (§7.8 SCI rule).
    // A cut made by another module's preset (somatic SCI, §6.15) removes the supraspinal drive.
    this.bsEdges = [];
    const bsIdx = (seg, s) => {
      const e = seg === 'S2' ? k.edgeIndex(`portSacral.${s}`, `cord.S2.spn.${s}`) : k.edgeIndex(`portSymp.${s}`, `cord.${seg}.iml.${s}`);
      if (e < 0) return -1;
      let q = this.bsEdges.indexOf(e);
      if (q < 0) { q = this.bsEdges.length; this.bsEdges.push(e); }
      return q;
    };
    this.bsOf = STAGES.map((S) => {
      const segs = PARAMS.bulbospinal[S.cmd] ?? [];
      return segs.flatMap((x) => { const [seg, s] = x.split('.'); return s ? [bsIdx(seg, s)] : SIDES.map((sd) => bsIdx(seg, sd)); }).filter((q) => q >= 0);
    });
    this.bsPass = new Float64Array(this.bsEdges.length).fill(1);
    this.restOf = STAGES.map((S) => PARAMS.ch[S.cmd].rest);
    this._pupilRest();
  }

  // Share of each bulbospinal edge that is not cut or scaled (1 when its networks are off: the gate
  // g.autonomic already removes that drive).
  _bulbospinal(t) {
    const k = this.k, g = k.graph;
    for (let q = 0; q < this.bsEdges.length; q++) {
      const e = this.bsEdges[q], gm = k.gate(g.edges[e].nets, t);
      this.bsPass[q] = gm > 0 ? Math.min(1, k.edgeGate(e, t) / gm) : 1;
    }
  }

  // Supraspinal share f of a stage and its spinal tone: target = g · F_iv · (f · cmd + (1 − f) · ρ · rest).
  _bsShare(s) {
    const list = this.bsOf[s];
    if (!list.length) return 1;
    let f = 0;
    for (const q of list) f += this.bsPass[q];
    return f / list.length;
  }

  _pupilRest() {
    const P = PARAMS.pupil, vars = this.k.vars;
    const d = clamp(P.d0 + P.kSym * PARAMS.ch.symPupR.rest - P.kEw * E_REST, P.min, P.max);
    vars[this.v.pupilR] = d; vars[this.v.pupilL] = d;
  }

  // Rest: states from the declared initial values (all-on rest) and the configured posture; the dead-time
  // rings hold the current commands; the 300-s pre-roll reaches the rest of the current switch set (§11.10).
  settle(init, k) {
    const vars = k.vars;
    const up = vars[this.r.posture] >= 0.5 ? 1 : 0;
    vars[this.v.standFrac] = up; vars[this.v.pPost] = 1 - PARAMS.stand.pFall * up; vars[this.v.standT0] = -1;
    vars[this.v.tSet] = PARAMS.thermo.tSet + vars[this.r.tSetShift];
    this._pupilRest();
    this._commands(0, k.input(0));
    for (let c = 0; c < CH.length; c++) this.ring.fill(this.cmd[c], c * RING, (c + 1) * RING);
    vars[this.v.cvN] = 0;
    this.qPrev.fill(0); vars[this.v.quiet] = 0;
  }

  // --- Interventions (§7.11, §11.12) ---
  resetPreset() {
    const vars = this.k.vars;
    for (const i of this.vIv) vars[i] = 1;
    vars[this.vIvAge] = -1; vars[this.vIvAdr] = 1;
  }

  applyPreset(id, params = {}) {
    const k = this.k, vars = k.vars;
    this.resetPreset();
    const set = (ids, f) => { for (const s of ids) vars[this.vIv[SI[s]]] *= f; };
    if (id === 'heartTransplant') {
      set(['vagCard', 'symCard', 'contr'], 0);
      vars[this.vIvAge] = Number.isFinite(params.donorAge) ? params.donorAge : vars[this.r.age];
      vars[this.vIvAdr] = PRESET_PARAMS.heartTransplant.betaSupersensitivity;
      this._cut([['cardiacPlexus', 'saNode'], ['stellate.R', 'saNode'], ['stellate.L', 'heart']]);
    } else if (id === 'atropine') {
      set(['vagCard', 'ewR', 'ewL', 'vagGut', 'sal', 'sacral', ...SUDO], 0);
    } else if (id === 'truncalVagotomy') {
      set(['vagGut'], 0);
    } else if (id === 'sympathectomyT2T3') {
      const s = params.side === 'L' ? 'L' : 'R';
      if (s === 'R') set(['sudoPalm'], 0);   // the scr readout is the right palm [model]
      set(['symSkin'], 0.5);
      this._cut([[`stellate.${s}`, `sweatPalm.${s}`], [`stellate.${s}`, 'skinVessels']]);
      if (params.stellate) {   // Horner: miosis with dilation lag, facial anhidrosis
        set([s === 'R' ? 'symPupR' : 'symPupL'], 0); set(['sudoForehead'], 0.5);
        this._cut([[`scg.${s}`, `pupilDilator.${s}`], [`cord.T1.iml.${s}`, `scg.${s}`]]);
      }
    } else if (id === 'pureAutonomicFailure') {
      const F = PRESET_PARAMS.pureAutonomicFailure;
      set([...SYM, 'contr', 'ven'], F.sym); set(['vagCard'], F.vagCard); set(SUDO, F.sudo);
    }
  }

  _cut(pairs) {
    for (const [a, b] of pairs) { const e = this.k.edgeIndex(a, b); if (e >= 0) this.k.cutEdge(e, true); }
  }

  // --- Commands (§7.6, §7.8, §11.13, §11.14) ---
  _commands(t, inp) {
    const k = this.k, vars = k.vars, P = PARAMS, ch = P.ch, cmd = this.cmd;
    const map = vars[this.v.map], frac = vars[this.v.standFrac];
    const b = this._baro(map, frac);
    const sal = vars[this.r.salience], lcp = vars[this.r.lcPhasic];
    const uDef = Math.max(sal, lcp);                  // defence / orienting drive (§7.8, §11.13) [model]
    const stress = typeof inp.stress === 'number' ? clamp(inp.stress, 0, 1) : 0;
    const gSom = k.g('somatic', t);
    const st = vars[this.v.standT0];
    const cc = st >= 0 ? gSom * P.stand.ccAmp * alphaFn(t - st, P.stand.ccPeak) : 0;
    const lp = P.stand.lpGain * (1 - vars[this.v.pPost]) / P.stand.pFall;
    const tCore = vars[this.v.tCore], tSet = vars[this.v.tSet], T = P.thermo;
    const eC = Math.max(0, tSet - T.vcOn - tCore), eW = Math.max(0, tCore - tSet - T.sweatOn);
    // Baroreflex term (§7.8): tone.vagCard = 0.309 + 0.58 (b − 0.5); tone.sym<X> = s0 − G (b − 0.5).
    // G is stored signed (+ vagal, − sympathetic), so both are rest + G · (b − 0.5).
    for (let c = 0; c < CH.length; c++) cmd[c] = ch[CH[c]].rest + ch[CH[c]].G * (b - 0.5);
    cmd[CI.vagCard] += -cc - P.defence.vag * uDef - P.stress.vag * stress;
    // PGE2 → autonomic commands of the immune module (§10.6: sympathetic +, cardiac vagal −, adrenal +),
    // published as tone offsets and gated here by g.autonomic through the tones.
    const kP = P.pge2Scale, iS = kP * vars[this.r.immSym], iV = kP * vars[this.r.immVag], iA = kP * vars[this.r.immAdr];
    cmd[CI.symCard] += P.defence.sym * uDef + P.stress.symCard * stress + iS;
    cmd[CI.vagCard] += iV;
    cmd[CI.symAdr] += iA;
    cmd[CI.symMus] += lp + P.stress.symMus * stress;
    cmd[CI.symSpl] += P.stress.symSpl * stress;
    cmd[CI.symSkin] += P.defence.skin * uDef + T.skin * eC - T.skinWarm * eW + iS;
    cmd[CI.sudoPalm] += P.emo.palm * sal + P.stress.palm * stress + T.palmSweat * eW;
    cmd[CI.sudoSole] += P.emo.sole * sal + T.palmSweat * eW;
    cmd[CI.sudoForehead] += P.emo.forehead * sal + T.sweat * eW;
    cmd[CI.sudoAxilla] += P.emo.axilla * sal + T.sweat * eW;
    cmd[CI.symAdr] += P.stress.symAdr * stress;
    cmd[CI.symBat] += T.bat * eC;
    cmd[CI.symPupR] += P.stress.pup * stress;
    cmd[CI.symPupL] += P.stress.pup * stress;
    if (vars[this.v.voiding]) cmd[CI.sacral] += P.bladder.voidTone;
    // Light reflex: the pretectal → EW rate of each side (bilateral, so direct = consensual, §7.7).
    const asleep = (vars[this.r.arousal] | 0) >= 2 ? P.pupil.sleep : 0;
    const kRate = (E_1000 - E_REST) / P.pupil.ewPlateau;
    for (const s of SIDES) {
      const j = this.jEw[s];
      const da = j >= 0 ? k.a(j) - k.aRest(j) : 0;
      cmd[CI[`ew${s}`]] = E_REST + kRate * da + asleep;
    }
    // Orgasm command record, switched modes only (§11.14): with every network on the adapter's legacy
    // vitals are passed through and this layer leaves them alone.
    if (this._switched()) {
      const rec = k.command(t);
      if (rec) {
        const O = P.orgasm;
        cmd[CI.symCard] += O.sym * rec.cmdSym; cmd[CI.symMus] += O.vasc * rec.cmdSym; cmd[CI.symSpl] += O.vasc * rec.cmdSym;
        cmd[CI.vagCard] -= O.vag * rec.cmdVag;
        cmd[CI.sacral] = Math.max(cmd[CI.sacral], rec.cmdSacral);
      }
    }
    for (let c = 0; c < CH.length; c++) cmd[c] = clamp(cmd[c], 0, 1);
    return b;
  }

  _switched() { const vars = this.k.vars; for (const i of this.vNet) if (vars[i] === 0) return true; return false; }

  // Baroreceptor activation b (§7.8) and the NF afferent drive of the receptor nodes.
  _baro(map, frac) {
    const P = PARAMS, pCs = map - P.hydro * frac, pAo = map;
    const sCs = sigma((pCs - P.p50) / P.kB), sAo = sigma((pAo - P.p50) / P.kB);
    this._sCs = sCs; this._sAo = sAo;
    return P.wCs * sCs + (1 - P.wCs) * sAo;
  }

  _baroDrive() {
    const k = this.k, B = PARAMS.baroRate, q = PARAMS.baroQuantum;
    const rate = (s) => Math.round((B.min + (B.max - B.min) * s) / q) * q;
    const rc = rate(this._sCs), ra = rate(this._sAo);
    for (const j of this.jBaro.cs) if (j >= 0) k.setExt(j, rc);
    if (this.jBaro.ao >= 0) k.setExt(this.jBaro.ao, ra);
  }

  // --- CV layer (§7.5–§7.9) ---
  cv(t, h) {
    const k = this.k, vars = k.vars, P = PARAMS;
    const inp = k.input(t);
    // Posture: the scenario's stand fraction, else a 3-s ramp toward the posture variable (§7.8, §12.3).
    const prevFrac = vars[this.v.standFrac];
    let frac = typeof inp.stand === 'number' ? clamp(inp.stand, 0, 1) : prevFrac;
    if (typeof inp.stand !== 'number') {
      const tgt = vars[this.r.posture] >= 0.5 ? 1 : 0, step = h / P.stand.ramp;
      frac = tgt > frac ? Math.min(tgt, frac + step) : Math.max(tgt, frac - step);
    }
    if (vars[this.v.standT0] < 0 && frac > 0 && prevFrac === 0 && inp.active !== false) vars[this.v.standT0] = t;
    if (frac === 0) vars[this.v.standT0] = -1;
    vars[this.v.standFrac] = frac;
    const pT = 1 - P.stand.pFall * frac;
    vars[this.v.pPost] = pT + (vars[this.v.pPost] - pT) * Math.exp(-h / P.stand.tauPost);

    // Commands into the dead-time rings (coarse steps collapse the dead times to the current command, §11.6).
    this._commands(t, inp);
    this._baroDrive();
    const steps = Math.max(1, Math.round(h / P.hCV)), n0 = vars[this.v.cvN];
    for (let c = 0; c < CH.length; c++) {
      const base = c * RING, x = this.cmd[c];
      for (let m = 1; m <= Math.min(steps, RING); m++) this.ring[base + ((n0 + m) % RING)] = x;
    }
    const n = (n0 + steps) % (RING * 1024);
    vars[this.v.cvN] = n;

    // Tones: relax toward g.autonomic(t) · F_iv · cmd(t − D) (§11.10 rule 1, §11.13); below a cord lesion
    // the supraspinal command is replaced by the segmental spinal tone (§7.8 SCI rule).
    const g = k.g('autonomic', t);
    this._bulbospinal(t);
    const rho = P.spinalRest[clamp(Math.round(vars[this.vIvPhase]), 1, 4)];
    let gap = 0;
    for (let s = 0; s < STAGES.length; s++) {
      const S = STAGES[s], c = this.cmdOf[s];
      const x = this.ring[c * RING + (((n - this.dS[s]) % RING) + RING) % RING];
      const f = this._bsShare(s), xs = f === 1 ? x : f * x + (1 - f) * rho * this.restOf[s];
      const tgt = g * vars[this.vIv[s]] * xs, i = this.vTone[s], cur = vars[i];
      const tau = tgt > cur ? S.on : S.off;
      vars[i] = tgt + (cur - tgt) * Math.exp(-h / tau);
      gap = Math.max(gap, Math.abs(vars[i] - tgt), Math.abs(x - this.cmd[c]));
      if (S.id === 'sudoPalm') {   // resting palm trajectory: the same stage driven by its rest command
        const rf = g * vars[this.vIv[s]] * (f * S.rest + (1 - f) * rho * S.rest), r0 = vars[this.v.scrRef];
        vars[this.v.scrRef] = rf + (r0 - rf) * Math.exp(-h / (rf > r0 ? S.on : S.off));
        gap = Math.max(gap, Math.abs(vars[this.v.scrRef] - rf));
      }
    }
    for (let c = 0; c < CH.length; c++) if (this.vRate[c] >= 0) vars[this.vRate[c]] = vars[this.vTone[SI[CH[c]]]] * P.fMax;

    this._heart(t);
    this._pupil(t, h, g);
    this._skin(h, g);
    this._resp(t, h);
    this._quietCheck(t, gap);
  }

  _heart(t) {
    const k = this.k, vars = k.vars, P = PARAMS, tn = (id) => vars[this.vTone[SI[id]]];
    const ageEff = vars[this.vIvAge] >= 0 ? vars[this.vIvAge] : vars[this.r.age];
    const fT = 1 + P.kT * (vars[this.v.tCore] - 37);
    const gA = k.g('autonomic', t), gN = k.g('neuroendocrine', t);
    const sEff = tn('symCard') + P.kAdr * vars[this.vIvAdr] * (vars[this.r.adrenaline] - 1) * gA * gN;
    const v = tn('vagCard');
    const base = ihr(ageEff) * fT * (1 + P.kS * sEff);
    const hr = base / (1 + P.kV * v);
    vars[this.v.hr] = hr; vars[this.v.hp] = 60 / hr;
    // RSA overlay at readout (§7.8, §11.6): inspiration gates cardiac vagal output, seen through the
    // vagal effector lag (first order, τ 0.5 s; analytic for the sinusoid).
    const wt = 2 * Math.PI * (vars[this.v.rr] / 60) * P.ch.vagCard.on;
    const rsa = P.resp.rsa * (vars[this.v.vt] / P.resp.vt0) / Math.sqrt(1 + wt * wt)
      * Math.sin(2 * Math.PI * vars[this.v.respPhase] - Math.atan(wt));
    vars[this.v.hrInst] = base / (1 + P.kV * v * (1 - rsa));
    // Haemodynamics (§7.5, §7.8).
    const contr = 1 + (tn('contr') - P.contr0);
    const ven = tn('ven'), sR = 0.5 * (tn('symMus') + tn('symSpl'));
    const co = P.co0 * Math.pow(hr / P.hr0, P.coHrExp) * vars[this.v.pPost] * (1 + P.venGain * (ven - P.ven0)) * Math.sqrt(Math.max(0, contr));
    const G0 = 1 / P.tpr0, st = vars[this.v.standT0];
    const vd = st >= 0 ? k.g('somatic', t) * P.stand.vdAmp * alphaFn(t - st, P.stand.vdPeak) : 0;
    const G = (P.gFixed * G0 + P.gNeural * G0 * P.rRest / (1 + P.rGain * sR)) * (1 + vd);
    const map = co / G, sv = 1000 * co / hr, pp = P.pp0 * sv / P.sv0;
    vars[this.v.co] = co; vars[this.v.tpr] = 1 / G; vars[this.v.map] = map; vars[this.v.sv] = sv; vars[this.v.pp] = pp;
    vars[this.v.sbp] = map + 2 * pp / 3; vars[this.v.dbp] = map - pp / 3; vars[this.v.contractility] = contr;
  }

  _pupil(t, h, g) {
    const k = this.k, vars = k.vars, P = PARAMS.pupil;
    // Psychosensory kernel: cascade of first-order stages, input 0.5 (lcPhasic + salience) (§7.7) [model].
    const u = 0.5 * (vars[this.r.lcPhasic] + vars[this.r.salience]);
    const tau = P.arTmax / P.arN, e = Math.exp(-h / tau), ar = this.ar;
    let x = u;
    for (let m = 0; m < this.nAr; m++) { ar[m] = x + (ar[m] - x) * e; if (Math.abs(ar[m]) < 1e-12) ar[m] = 0; x = ar[m]; }
    const dAr = g * P.arGain * x;
    let sp = 0;
    for (const s of SIDES) {
      const ew = vars[this.vTone[SI[`ew${s}`]]], sym = vars[this.vTone[SI[`symPup${s}`]]];
      const m = clamp((ew - E_REST) / (E_1000 - E_REST), 0, 1);
      const d = clamp(P.d0 + P.kSym * sym - P.kEw * ew + dAr * (1 - m), P.min, P.max);
      vars[s === 'R' ? this.v.pupilR : this.v.pupilL] = d;
      sp += sym;
    }
    const ewM = 0.5 * (vars[this.vTone[SI.ewR]] + vars[this.vTone[SI.ewL]]);
    vars[this.v.ew] = ewM; vars[this.v.fEw] = ewM * PARAMS.fMax;
    vars[this.v.symPup] = 0.5 * sp; vars[this.v.fSymPup] = 0.5 * sp * PARAMS.fMax;
  }

  _skin(h, g) {
    const vars = this.k.vars, P = PARAMS, S = P.scr, ch = P.ch, T = P.thermo;
    const palm = vars[this.vTone[SI.sudoPalm]];
    // Phasic drive above the resting palm trajectory (the same stage driven by its rest command), so a
    // switch or an intervention that moves the resting tone gives no SCR (§7.12); Bateman shape as a
    // two-stage cascade (τ 0.75, 3.0 s).
    const d = Math.max(0, palm - vars[this.v.scrRef]);
    const ta = S.tauFast, tb = S.tauSlow, p0 = vars[this.v.sp], q0 = vars[this.v.sq];
    const ea = Math.exp(-h / ta), eb = Math.exp(-h / tb), A = ta * (p0 - d) / (ta - tb);
    vars[this.v.sp] = d + (p0 - d) * ea;
    vars[this.v.sq] = d + A * ea + (q0 - d - A) * eb;
    if (Math.abs(vars[this.v.sp]) < 1e-12) vars[this.v.sp] = 0;
    if (Math.abs(vars[this.v.sq]) < 1e-12) vars[this.v.sq] = 0;
    vars[this.v.scr] = S.gain * vars[this.v.sq];
    const sclT = S.sclMin + (S.sclBase - S.sclMin) * palm / ch.sudoPalm.rest;
    vars[this.v.scl] = sclT + (vars[this.v.scl] - sclT) * Math.exp(-h / S.tauScl);
    // Sweat and skin blood flow (display readouts, §7.7, §7.10) [model].
    const therm = Math.max(0, 0.5 * (vars[this.vTone[SI.sudoForehead]] + vars[this.vTone[SI.sudoAxilla]]) - ch.sudoForehead.rest);
    vars[this.v.sweat] = T.sweatMax * clamp(therm / (1 - ch.sudoForehead.rest), 0, 1);
    const vc = vars[this.vTone[SI.symSkin]];
    vars[this.v.sbf] = clamp(T.sbf0 * Math.sqrt(ch.symSkin.rest / Math.max(0.03, vc)) + T.sbfMax * clamp(therm / 0.5, 0, 1), 0.05, T.sbfMax);
  }

  _resp(t, h) {
    const k = this.k, vars = k.vars, R = PARAMS.resp, B = R.beh, v = this.v;
    const gA = k.g('autonomic', t), gS = k.g('somatic', t);
    const p = vars[v.paco2], inp = k.input(t);
    // Behavioural drive (LUNGS.md §5.3, §6, §8): the stressor input u; the arousal drive h and the
    // breath-hold of the orgasm adapter's record, read with every network on (the respiratory layer
    // follows the drive while the HUD keeps the legacy vitals, §11.14); the HUD's relaxation c (Calm),
    // which yields to stress and arousal.
    const rec = k.command(t);
    const apnoea = !!rec?.apnoea;
    const u = typeof inp.stress === 'number' ? clamp(inp.stress, 0, 1) : 0;
    const hA = rec && Number.isFinite(rec.cmdSym) ? clamp(rec.cmdSym, 0, 1) : 0;
    const c = clamp(vars[v.relax], 0, 1) * (1 - u) * (1 - hA);
    const eB = Math.exp(-h / B.tau);
    const rrBT = R.rr0 * (1 + B.stressRate * u) * (1 - B.calmRate * c) + B.arousalRate * hA;
    const dVAT = VA0 * (B.stressVA * u + B.arousalVA * Math.pow(hA, B.arousalExp));
    const rrB = rrBT + (vars[v.rrB] - rrBT) * eB, dVA = dVAT + (vars[v.dVA] - dVAT) * eB;
    vars[v.rrB] = rrB; vars[v.dVA] = dVA;
    // Chemoreflex: central share always (RTN is CNS), peripheral share through the carotid body (§7.9);
    // flat below eupnoea while awake. It sets ventilation in V̇E units (HCVR), scaled to V̇A at the
    // resting dead-space fraction.
    const share = R.central + (1 - R.central) * gA;
    const veC = Math.max(0.5, R.ve0 + (p >= R.paco2 ? R.hcvr : R.hcvrLow) * share * (p - R.paco2));
    // `va` holds the ventilatory drive in V̇A units through a breath-hold, so breathing resumes at its
    // depth; the effective ventilation is 0 while the breath is held.
    const vaT = veC * VA0 / R.ve0 + dVA;
    const vaD = vaT + (vars[v.va] - vaT) * Math.exp(-h / R.tauVe);
    const va = apnoea ? 0 : vaD;
    // Pattern: the behavioural rate, raised by hypercapnia as before (VT first: rate ∝ (V̇E/V̇E₀)^0.4);
    // the depth follows from the alveolar ventilation, VT = V̇A/f + VD.
    const rr = apnoea ? 0 : rrB * Math.pow(Math.max(1, veC / R.ve0), 1 - R.vtExp);
    const vt = rr > 1e-9 ? va / rr + R.vd : 0;
    vars[v.va] = vaD; vars[v.rr] = rr; vars[v.vt] = vt; vars[v.ve] = rr * vt;
    // Two-pool CO₂ balance (LUNGS.md §4.3): each pool relaxes to 40·V̇A₀/V̇A with τ ∝ V̇A₀/V̇A; in apnoea
    // both rise at 40/τ_tissue per s. Somatic off clamps the gases (A.5).
    const cl = gS + (1 - gS) * Math.exp(-h / R.tauClamp);
    const pool = (x, tau) => {
      let y;
      if (va > 1e-9) { const pss = R.paco2 * VA0 / va; y = pss + (x - pss) * Math.exp(-h * va / (VA0 * tau)); }
      else y = x + h * R.paco2 / R.tauCo2;
      return R.paco2 + (y - R.paco2) * cl;
    };
    const pf = pool(vars[v.co2F], R.tauFast), ps = pool(vars[v.co2S], R.tauCo2);
    vars[v.co2F] = pf; vars[v.co2S] = ps;
    const pn = R.fast * pf + (1 - R.fast) * ps;
    vars[v.paco2] = pn;
    vars[v.pao2] = R.pao2 - R.pao2Slope * (pn - R.paco2);
    // Derived gases (LUNGS.md §4.2–4.3) and the sigh rate (§5.1).
    const ph = acutePH(pn);
    vars[v.ph] = ph;
    vars[v.sao2] = sao2(vars[v.pao2], ph, pn, vars[v.tCore]);
    vars[v.etco2] = pn - R.etGrad;
    vars[v.sighRate] = R.sigh.rate * (1 + R.sigh.stress * u);
    const phase = vars[v.respPhase] + h * rr / 60;
    vars[v.respPhase] = phase - Math.floor(phase);
  }

  // CV quiescence of the deterministic core on 1-s boundaries (§11.6; overlays excluded).
  _quietCheck(t, gap) {
    const vars = this.k.vars, q = this.qPrev, P = PARAMS.quiet;
    const tPrev = q[5];
    if (Math.floor(t + 1e-9) === Math.floor(tPrev + 1e-9) && t >= tPrev) return;
    const cur = [vars[this.v.hr], vars[this.v.map], 10 * vars[this.v.pupilR], 10 * vars[this.v.pupilL], 10 * vars[this.v.scr]];
    let d = 0;
    for (let i = 0; i < 5; i++) { d = Math.max(d, Math.abs(cur[i] - q[i])); q[i] = cur[i]; }
    q[5] = t;
    vars[this.v.quiet] = d < P.d && gap < P.gap ? 1 : 0;
  }

  // --- EN layer: heat balance (§7.10), BAT, bladder (§7.7) ---
  en(t, h) {
    const k = this.k, vars = k.vars, T = PARAMS.thermo, B = PARAMS.bladder;
    const gA = k.g('autonomic', t), gS = k.g('somatic', t);
    const tSet = T.tSet + vars[this.r.tSetShift], tc = vars[this.v.tCore];
    vars[this.v.tSet] = tSet;
    const A = tSet > tc ? T.warm[0] + T.warm[1] * gA + T.warm[2] * gS : T.cool[0] + T.cool[1] * gA;
    vars[this.v.tCore] = tSet + (tc - tSet) * Math.exp(-A * h / T.tauT);
    vars[this.v.tSkin] = T.tSkin;
    const bt = vars[this.vTone[SI.symBat]];
    vars[this.v.bat] = bt + (vars[this.v.bat] - bt) * Math.exp(-h / T.tauBat);
    let vol = vars[this.v.bladderVol] + h * B.urine / 60;
    if (vars[this.v.voiding]) {
      vol -= h * B.flow * vars[this.vTone[SI.sacral]];
      if (vol <= 5) { vol = Math.max(0, vol); vars[this.v.voiding] = 0; }
    } else if (vol >= B.capacity && gA >= 0.5) {
      vars[this.v.voiding] = 1;
      k.log({ kind: 'state', node: 'bladder', label: 'voiding (sacral parasympathetic)' });
    }
    vars[this.v.bladderVol] = Math.min(B.max, vol);
  }
}

// --- Interventions as data (§7.11; semantics §11.12, A.5). apply(k) runs after all cuts are reset. ---
export const PRESET_PARAMS = {
  heartTransplant: { donorAge: null, betaSupersensitivity: 2 },     // adrenaline effect × 2 [model] (§7.11)
  atropine: {},
  truncalVagotomy: { selective: false },
  sympathectomyT2T3: { side: 'R', stellate: false },
  pureAutonomicFailure: { sym: 0.1, vagCard: 0.3, sudo: 0.1 },      // §7.11
};
const preset = (id, label, expected) => ({
  id, label, net: /** @type {'autonomic'} */ ('autonomic'), expected, params: { ...PRESET_PARAMS[id] },
  /** @param {import('./contracts').KernelApi} k */
  apply(k) { /** @type {any} */ (k.plugin('autonomic'))?.applyPreset?.(id, this.params); },
});
/** @type {import('./contracts').InterventionPreset[]} */
export const INTERVENTIONS = [
  preset('heartTransplant', 'Heart transplant', 'HR = IHR(donor age) · f_T; RSA and baroreflex HR ≈ 0; adrenaline effect ×2'),
  preset('atropine', 'Atropine', 'HR ≈ 110; pupils dilated and unreactive; anhidrosis; no RSA'),
  preset('truncalVagotomy', 'Truncal vagotomy', 'heart unaffected; fVagGut 0'),
  preset('sympathectomyT2T3', 'T2–T3 sympathectomy', 'no palmar sweating or hand vasoconstriction; stellate option adds Horner signs'),
  preset('pureAutonomicFailure', 'Pure autonomic failure', 'OH with near-fixed HR (ΔHR/ΔSBP < 0.5); anhidrosis'),
];
const PRESET_IDS = new Set(INTERVENTIONS.map((p) => p.id));

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'autonomic',
  scope: 'body',
  order: 30,
  fragment,
  create: (k) => new Autonomic(k),
};
export { Autonomic };
