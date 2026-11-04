// Dopamine layer (research/DOPAMINE.md §6): seven dopaminergic populations drive extracellular
// dopamine in nine terminal fields. It integrates in human time after every step of the response
// model, which supplies arousal, stimulation, the climax and the hormones; prolactin, GABA,
// endogenous opioids, serotonin and oxytocin enter only as modulators of dopamine. It writes the
// dopaminergic drive D back into the response model (closed loop, §6.4 (11)).
//
//   firing      ν_i = soft saturation of ν_T,i·(1 + β_i·δ) at 20 Hz; partial pause below (§6.4 (5))
//   release     dC_j/dt = q_j · F_aut,j · F_K,j · Σ_i π_ij ν_i ρ_i − Vmax_j C_j/(Km + C_j) − k_l,j C_j
//   receptors   dθ/dt = k_on C (1 − θ) − k_off θ          (D1: Kd 1 µM; D2: Kd 10 nM)
//   prediction  δ = r + dV̂/dt with V = ŵ·Φ; r is an alpha-kernel reward envelope over the train
//
// Units: s (human time), nM, Hz. Concentrations are calibrated on rat microdialysis and
// voltammetry; human dopamine during sex has never been measured (§4).
// Region ids are the post-port set of anatomy.js (§7.3, §9.1): `vtaMedial`, `a14`, `caudate`,
// `medianEminence` and `pituitaryGland` exist, so no id falls back to a parent region.

import { R, REGION_COUNT, PATHWAYS } from './anatomy.js';
import { PATH_HIST } from './shaders.js';
import { desaturate } from './color.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const relax = (x, target, h, tau) => target + (x - target) * Math.exp(-h / tau);

// --- Cell groups: tonic rate ν0 (Hz) and prediction-error gain β (s) (§6.5) ---
export const POPS = [
  { id: 'VTAl', nu0: 4.0, beta: 25, label: 'VTA lateral', region: R.vta, autoreceptor: true },
  { id: 'VTAm', nu0: 5.0, beta: 10, label: 'VTA medial', region: R.vtaMedial, autoreceptor: true },
  { id: 'SNc', nu0: 4.0, beta: 6, label: 'Substantia nigra', region: R.snc, autoreceptor: true },
  { id: 'A11', nu0: 2.0, beta: 0, label: 'A11', region: R.a11 },
  { id: 'A12', nu0: 2.0, beta: 0, label: 'A12 (TIDA)', region: R.arcuate },
  { id: 'A13', nu0: 2.0, beta: 0, label: 'A13 (zona incerta)', region: R.zonaIncerta },
  { id: 'A14', nu0: 2.0, beta: 0, label: 'A14', region: R.a14 },
];
const P = Object.fromEntries(POPS.map((p, i) => [p.id, i]));

// Region → compartment mapping with each region's w_vis (§8.1, §8.3). `pituitaryGland`, `cerebellum`
// and `whiteMatter` take no dopamine glow; `hypothalamus` is drawn from mean(MPOA, PVN) × 0.5.
const visual = (...pairs) => {
  const regions = [], wVis = [];
  for (const [r, w] of pairs) { regions.push(r); wVis.push(w); }
  return { regions, wVis };
};

// --- Terminal fields: tonic C0 (nM), DAT Vmax (nM/s), linear clearance k_l (1/s: NET, COMT,
// diffusion, portal blood), source mix π, terminal D2 autoreceptor gain, dynorphin/KOR gain (§6.5) ---
export const FIELDS = [
  { id: 'naccCore', C0: 15, Vmax: 2500, kl: 0.1, src: { VTAl: 0.85, VTAm: 0.15 }, aut: 1, kor: 1, ...visual([R.naccCore, 0.92]) },
  { id: 'naccShell', C0: 15, Vmax: 1200, kl: 0.1, src: { VTAl: 0.6, VTAm: 0.4 }, aut: 1, kor: 1, ...visual([R.naccShell, 0.81]) },
  { id: 'dStriatum', C0: 20, Vmax: 4000, kl: 0.1, src: { SNc: 0.9, VTAl: 0.1 }, aut: 1, kor: 1, ...visual([R.dorsalStriatum, 1], [R.caudate, 0.89], [R.pallidum, 0.45]) },
  { id: 'mPFC', C0: 2, Vmax: 100, kl: 0.5, src: { VTAm: 0.9, VTAl: 0.1 }, aut: 0.5, kor: 0, ...visual([R.pfc, 0.17], [R.ofc, 0.17], [R.acc, 0.24], [R.frontal, 0.24], [R.thalamus, 0.32], [R.insula, 0.10], [R.parietal, 0.10], [R.temporal, 0.10], [R.occipital, 0.10]) },
  { id: 'amygdala', C0: 5, Vmax: 100, kl: 0.3, src: { VTAm: 0.6, VTAl: 0.2, SNc: 0.2 }, aut: 1, kor: 0, ...visual([R.amygdala, 0.55], [R.hippocampus, 0.14]) },
  { id: 'MPOA', C0: 5, Vmax: 0, kl: 0.3, src: { A14: 0.6, A13: 0.4 }, aut: 0, kor: 0, ...visual([R.mpoa, 0.55]) },
  { id: 'PVN', C0: 5, Vmax: 0, kl: 0.3, src: { A13: 0.5, A14: 0.5 }, aut: 0, kor: 0, ...visual([R.pvn, 0.50]) },
  { id: 'medEminence', C0: 20, Vmax: 0, kl: 0.2, src: { A12: 1 }, aut: 0, kor: 0, ...visual([R.medianEminence, 0.77]) },
  { id: 'spinal', C0: 2, Vmax: 0, kl: 0.3, src: { A11: 1 }, aut: 0, kor: 0, ...visual([R.spinal, 0.55]) },
];
const F = Object.fromEntries(FIELDS.map((f, i) => [f.id, i]));
const KM = 200;   // nM, apparent DAT Km in vivo (§6.5)

// Receptor binding (on nM⁻¹ s⁻¹, off s⁻¹): EC50s as in Dreyer et al. 2010 (§6.5).
const REC = { D1: [0.01, 10], D2: [0.02, 0.2], AUT: [0.02, 0.6] };

export const PARAMS = {
  kF: 1.010, tauF: 5.45, kDep: 0.984, tauDep: 4.38,   // §6.5: release plasticity (Montague et al. 2004, rat)
  ksd: 0.2, tauSd: 1.0,                               // §6.5: somatodendritic D2 autoreceptor
  nuSat: 20, nuTCap: 0.95, pauseFloor: 0.5, tauP: 5,  // §6.4 (5), §6.5: soft ceiling, partial pause, recruitment
  gX: 1.5, gPsi: 0.5, PsiPk: 0.9,                     // §6.4 (1)–(2), §6.5: VTA GABA tone
  zZ: 0.2, zR: 0, tauZ: 60,                           // §6.4 (1)–(2), §6.5: serotonin, prolactin brake (opt-in)
  gO: 0.15, OCap: 1.3,                                // §6.4 (1), §6.5: oxytocin
  gTR: 0.5, sT: 0.6, aT: 0.08, tauOmUp: 2, tauOmDown: 120,   // §6.4 (1), (3), §6.5: TIDA
  phiS: 0.3, phiA: 0.45, TphiMin: 1.5,                // §6.4 (4), §6.5: value feature
  w0: 0.5, alphaW: 0.3, cW: 0.8, r0: 0.6, rq: 0.8,    // §6.5: learned and obtained reward
  tauV: 0.4, tauRew: 1.0, tauPulse: 0.3,              // §6.5, §6.10: value filter, alpha kernel, pulse-locked kernel
  gK: 0.2, tauK: 300,                                 // §6.4 (9), §6.5: κ-opioid feedback on the relative D1 excess
  kB: 1.6, D0: 0.2,                                   // §6.4 (11), §6.7: closed-loop slope
  tauTonic: 10, tauPeak: 30,                          // §6.3 C̄; HUD last-peak hold [model]
  hFine: 0.02, hCoarse: 0.1, hTonic: 0.5, khFine: 20, khTonic: 200,   // §6.8: dopamine substep by k_h
  tauSat: 10800, satK: 3,                             // §6.10: session satiety (off by default)
  tauVisFloor: 0.3, tauSpreadFloor: 0.5, tauVisLocked: 2, tauMod: 0.5, tauAct: 0.4,   // §8.1, §9.3: screen-time filters
  flareCore: 0.5,                                     // §8.2: F above which the flare core warms
  histStep: 0.125,                                    // §9.3: pathHist cadence (s screen, 2 s travel)
  somaRate: 0.4, sparkRate: 6, somaKMax: 1.4, sparkKMax: 0.17, hzMax: 2,   // §8.1, §9.8: per-point twinkle cap
  imagingAmp: 1,                                      // §8.1: optional overlay amplitude
  pulseLocked: false, satiety: false, imaging: false, // §6.10, §8.1 switches
};

// What happens to accumbens dopamine after orgasm is unresolved (§4.5, §6.10): both readings rest on
// male-rat data and neither is established. Prolactin is not part of either option.
export const HYPOTHESES = {
  sustained: { zZ: 0.2, gPsi: 0.5 },
  dip: { zZ: 0.5, gPsi: 0.3 },
};

// Pathway → source cell group (for the flow drawn along the fibres; §7.6, §9.8).
const PATH_SOURCE = {
  mesolimbic: 'VTAl', mesoAmygdala: 'VTAm', mesoHippocampal: 'VTAm', mesocorticalMedial: 'VTAm',
  mesocorticalOrbital: 'VTAm', mesocorticalCingulate: 'VTAm', slMFB: 'VTAm', nigrostriatalPutamen: 'SNc',
  nigrostriatalCaudate: 'SNc', incertoMpoa: 'A13', incertoPvn: 'A13', tuberoinfundibular: 'A12', diencephalospinal: 'A11',
};

// Modulator tints on their source nuclei: low chroma, so they never compete with dopamine amber (§8.1).
export const MODULATORS = {
  prolactin: { regions: [R.pituitaryGland], rgb: desaturate([1.0, 0.55, 0.68], 0.55) },
  serotonin: { regions: [R.raphe], rgb: desaturate([0.62, 0.55, 1.0], 0.5) },
  gaba: { regions: [R.rmtg, R.vta, R.vtaMedial], rgb: desaturate([0.45, 0.95, 0.9], 0.55) },
  opioid: { regions: [R.pag, R.arcuate], rgb: desaturate([0.75, 1.0, 0.55], 0.6) },
};

export class DopamineModel {
  constructor(opts = {}) {
    this.p = { ...PARAMS, ...opts };
    this.region = new Float32Array(REGION_COUNT * 4);     // activity, dopamine glow, spread, modulator
    this.tint = new Float32Array(REGION_COUNT * 4);
    this.da = new Float32Array(REGION_COUNT * 4);         // firing level, spike phase, release phase
    this.pathHist = new Float32Array(Math.ceil(PATHWAYS.length * PATH_HIST / 4) * 4);
    this.histAcc = 0;
    this.reducedMotion = false;
    for (const m of Object.values(MODULATORS)) for (const r of m.regions) this.tint.set(m.rgb, r * 4);
    this.setHypothesis('sustained');
    this.reset();
  }

  reset() {
    const p = this.p;
    const m = FIELDS.length;
    this.nu = POPS.map((q) => q.nu0);
    this.nubar = POPS.map((q) => q.nu0);
    this.tonicBar = POPS.map(() => 1);
    // Release plasticity at its tonic steady state (log facilitation and depression factors).
    this.lf = POPS.map((q) => q.nu0 * p.tauF * Math.log(p.kF));
    this.ld = POPS.map((q) => q.nu0 * p.tauDep * Math.log(p.kDep));
    this.rho0 = POPS.map((_, i) => Math.exp(this.lf[i] + this.ld[i]));
    this.rho = [...this.rho0];
    this.src = FIELDS.map((f) => Object.entries(f.src).map(([k, w]) => [P[k], w]));
    this.tonicRelease = this.src.map((s) => s.reduce((a, [i, w]) => a + w * POPS[i].nu0, 0));
    this.relRelease = FIELDS.map(() => 1);
    // q_j: release per impulse (population average) so that tonic firing gives C0 exactly (§6.4 (7)).
    this.q = FIELDS.map((f, j) => (f.Vmax * f.C0 / (KM + f.C0) + f.kl * f.C0) / this.tonicRelease[j]);
    const eq = ([on, off], C) => on * C / (on * C + off);
    this.C = FIELDS.map((f) => f.C0);
    this.Cslow = FIELDS.map((f) => f.C0);
    this.Cpeak = FIELDS.map((f) => f.C0);        // last peak for the HUD: substep maximum, slow hold (§8.6)
    this.Cmax = FIELDS.map((f) => f.C0);         // session maximum over substeps (§6.8, resetPeaks)
    this.Cmean = FIELDS.map((f) => f.C0);        // frame mean, kept through a frame without substeps (§9.1)
    this.Csum = new Float64Array(m); this.Cn = 0;
    this.th1 = FIELDS.map((f) => eq(REC.D1, f.C0));
    this.th10 = [...this.th1];
    this.th2 = FIELDS.map((f) => eq(REC.D2, f.C0));
    this.aut = FIELDS.map((f) => eq(REC.AUT, f.C0));
    this.aut0 = [...this.aut];
    this.K = new Float64Array(m);
    this.w = p.w0;
    this.Vhat = 0; this.delta = 0; this.Phi = 0; this.resetPending = 0;
    this.prevPhase = 'baseline'; this.phiIg = 0;
    this.OmegaS = 0; this.Z = 0; this.Gamma = 1; this.gMod = 1; this.PsiHat = 0;
    this.nEff = 0;
    this.burst = 0;
    // Visual state (screen time): at rest T = 0.3, so E0 = 0.3 and s0 = 0.475 (§8.1).
    this.vis = {
      E: new Float64Array(m).fill(0.3), spread: new Float64Array(m).fill(0.475),
      fire: POPS.map(() => 1), act: new Float64Array(REGION_COUNT).fill(1), omega: 0,
    };
    this.region.fill(0);
    for (let r = 0; r < REGION_COUNT; r++) this.region[r * 4] = 1;
    this.da.fill(0);
    this.pathHist.fill(0.5);
  }

  setHypothesis(id) {
    if (!HYPOTHESES[id]) throw new Error(`unknown dopamine hypothesis: ${id}`);
    this.hypothesis = id;
    Object.assign(this.p, HYPOTHESES[id]);
  }

  // The other §6.10 rows (the onset window is set on the response model, ResponseModel.setOnset).
  setSwitch(name, value) {
    const p = this.p;
    switch (name) {
      case 'pulseLocked': p.pulseLocked = !!value; break;
      case 'zR': p.zR = value === true ? 0.2 : Number(value) || 0; break;
      case 'kappa': p.gK = value === true ? PARAMS.gK : Number(value) || 0; break;
      case 'satiety': p.satiety = !!value; break;
      case 'sT': p.sT = Number(value) || 0; break;
      case 'imaging': p.imaging = !!value; break;
      default: throw new Error(`unknown dopamine switch: ${name}`);
    }
  }

  // Session satiety "novel stimulus" event: halves n_eff, a partial reset (§6.10).
  novelStimulus() { this.nEff *= 0.5; }

  // prefers-reduced-motion: flare and imaging amplitudes halved, tract flow off (§10 rule 6).
  setReducedMotion(on) { this.reducedMotion = !!on; }

  resetPeaks() { for (let j = 0; j < FIELDS.length; j++) { this.Cmax[j] = this.C[j]; this.Cpeak[j] = this.C[j]; } }

  // One response step of length dt (§6.4, §6.8): called after the response model integrated it and
  // ran its transitions, with its pre-step snapshot. Every state input is interpolated inside the
  // step (§6.4 (12)); substeps use the end-of-step phase.
  step(dt, m, prev = m) {
    const p = this.p;
    if (!(dt > 0)) return;   // no substep when Δ = 0: the frame mean keeps its value (§9.1)
    const phase = m.phase;
    if (phase === 'onset' && this.prevPhase !== 'onset') this.phiIg = this.Phi;
    if (this.prevPhase === 'orgasm' && phase !== 'orgasm') {
      // Incomplete learning: the next orgasm is predicted better, never perfectly (§6.4 (4)).
      const Robt = p.r0 + p.rq * (m.train ? m.train.q : 0.5);
      this.w += p.alphaW * (p.cW * Robt - this.w);
      this.nEff += 1;
      this.resetPending = 2;   // V̂ is re-seated without a derivative for two response steps
    }
    this.prevPhase = phase;
    const hadReset = this.resetPending > 0;

    const kh = m.khNow ?? 10;
    const hMax = kh <= p.khFine ? p.hFine : kh <= p.khTonic ? p.hCoarse : p.hTonic;
    const n = Math.max(1, Math.ceil(dt / hMax));
    const h = dt / n;
    const inOrgasm = phase === 'orgasm' && m.train;
    const Robt = inOrgasm ? p.r0 + p.rq * m.train.q : 0;
    const Tphi = Math.max(m.p ? m.p.Tpre : 1.5, p.TphiMin);
    const nPops = POPS.length;
    const tonic = this._tonic || (this._tonic = new Float64Array(nPops));
    for (let s = 0; s < n; s++) {
      const f = (s + 1) / n;
      const lerp = (a, b) => a + f * (b - a);
      const St = lerp(prev.St, m.St), Aeff = lerp(prev.Aeff, m.Aeff), A = lerp(prev.A, m.A);
      const X = lerp(prev.X, m.X), I = lerp(prev.I, m.I), H = lerp(prev.H, m.H), G = lerp(prev.G, m.G);
      const M = lerp(prev.M, m.M), N = lerp(prev.N, m.N), O = lerp(prev.O, m.O), Rp = lerp(prev.R, m.R);
      const Psi = lerp(prev.Psi, m.Psi), Omega = lerp(prev.Omega, m.Omega);
      const t = lerp(prev.tHuman, m.tHuman);
      const Seff = St * (1 - I) * (1 - 0.9 * H);

      // Value feature Φ and prediction error δ (§6.4 (4)).
      const tTr = inOrgasm ? Math.max(0, m.train.t - (1 - f) * dt) : 0;
      let g = 0, cum = 0, locked = 0;
      if (inOrgasm) {
        const tr = m.train, sum = tr.sumA;
        for (let k = 0; k < tr.times.length; k++) {
          const u = tTr - tr.times[k];
          if (!(u > 0)) continue;
          const a = tr.amps[k] / sum, x = u / p.tauRew;
          g += a * (u / (p.tauRew * p.tauRew)) * Math.exp(-x);
          cum += a * (1 - (1 + x) * Math.exp(-x));
          if (u < 6 * p.tauPulse) locked += a * Math.exp(-u / p.tauPulse) / p.tauPulse;
        }
      }
      let Phi;
      if (phase === 'onset' || inOrgasm) {
        const ramp = this.phiIg + (1 - this.phiIg) * Math.min(1, Math.max(0, t - m.tIgnite) / Tphi);
        if (phase === 'onset') Phi = ramp;
        else if (p.pulseLocked) {
          let rem = 0;
          for (let k = 0; k < m.train.times.length; k++) if (m.train.times[k] > tTr) rem += m.train.amps[k];
          Phi = rem / m.train.sumA;
        } else Phi = Math.min(ramp, 1 - cum);
      } else {
        Phi = Math.min(1, p.phiS * Math.min(1, St) + p.phiA * Aeff * Aeff) * (1 - 0.8 * Math.min(1, X)) * (1 - I);
      }
      this.Phi = Phi;
      let delta;
      const V = this.w * Phi;
      if (inOrgasm && p.pulseLocked) {
        delta = (Robt - this.w) * locked;
        this.Vhat = V;
      } else if (this.resetPending > 0) {
        delta = 0; this.Vhat = V;
      } else {
        const Vnew = V + (this.Vhat - V) * Math.exp(-h / p.tauV);
        delta = (Vnew - this.Vhat) / h + (inOrgasm ? Robt * g : 0);
        this.Vhat = Vnew;
      }
      this.delta = delta;

      // Derived inputs and modulator gains (§6.4 (1)–(2)).
      this.PsiHat = clamp(Psi / p.PsiPk);
      const Ohat = Math.min(O, p.OCap), Nprime = clamp(N - 0.1, 0, 1.2);
      this.Z = relax(this.Z, I, h, p.tauZ);
      this.OmegaS = relax(this.OmegaS, Omega, h, Omega > this.OmegaS ? p.tauOmUp : p.tauOmDown);
      this.Gamma = (1 + p.gX * Math.min(1, X)) * (1 - p.gPsi * this.PsiHat);
      this.gMod = 1 / ((1 + p.zZ * this.Z) * (1 + p.zR * Rp));
      this.nEff *= Math.exp(-h / p.tauSat);
      const gSat = p.satiety ? 1 / (1 + (this.nEff / p.satK) ** 2) : 1;

      // Tonic recruitment, each 1 at rest (§6.4 (3)).
      const stim = 0.4 * Math.min(1, St) + 0.6 * A;
      const VTAnorm = 2 / (1 + this.Gamma) * this.gMod * gSat;
      tonic[0] = VTAnorm * (1 + 0.70 * Aeff + 0.35 * Seff + p.gO * Ohat);
      tonic[1] = VTAnorm * (1 + 0.35 * Aeff + 0.15 * Seff + 0.25 * Nprime + 0.20 * Ohat);
      tonic[2] = (1 + 0.25 * Aeff + 0.35 * M) * Math.sqrt(this.gMod);
      tonic[3] = 1 + 1.5 * Omega + 0.3 * G;
      tonic[4] = (1 + p.gTR * Rp) * (1 - p.sT * this.OmegaS) * (1 + p.aT * Math.sin(2 * Math.PI * t / 20));
      tonic[5] = (1 + 0.5 * stim + 0.3 * G + 0.3 * Omega) / (1 + 0.5 * I);
      tonic[6] = (1 + 0.6 * stim + 0.2 * G) / (1 + 0.5 * I);

      // Firing with soft saturation and partial pauses (§6.4 (5)); release plasticity (§6.4 (6)).
      const lnF = Math.log(p.kF), lnD = Math.log(p.kDep);
      for (let i = 0; i < nPops; i++) {
        const pop = POPS[i];
        this.tonicBar[i] = relax(this.tonicBar[i], tonic[i], h, p.tauP);
        const gsd = pop.autoreceptor ? (1 + p.ksd) / (1 + p.ksd * this.nubar[i] / pop.nu0) : 1;
        const nuT = Math.min(p.nuTCap * p.nuSat, pop.nu0 * this.tonicBar[i] * gsd);
        const x = pop.beta * delta;
        const nu = x >= 0
          ? nuT + (p.nuSat - nuT) * Math.tanh(nuT * x / (p.nuSat - nuT))
          : nuT * Math.max(p.pauseFloor, 1 + x);
        this.nu[i] = nu;
        this.nubar[i] = relax(this.nubar[i], nu, h, p.tauSd);
        const lfs = nu * p.tauF * lnF, lds = nu * p.tauDep * lnD;
        this.lf[i] = lfs + (this.lf[i] - lfs) * Math.exp(-h / p.tauF);
        this.ld[i] = lds + (this.ld[i] - lds) * Math.exp(-h / p.tauDep);
        this.rho[i] = Math.exp(this.lf[i] + this.ld[i]);
      }

      // Extracellular dopamine: exact exponential update with the clearance linearised at C (§6.8).
      for (let j = 0; j < FIELDS.length; j++) {
        const fld = FIELDS[j];
        let J = 0;
        for (const [i, w] of this.src[j]) J += w * this.nu[i] * (this.rho[i] / this.rho0[i]);
        this.relRelease[j] = J / this.tonicRelease[j];
        const Faut = fld.aut > 0 ? (1 + fld.aut * this.aut0[j]) / (1 + fld.aut * this.aut[j]) : 1;
        J *= this.q[j] * Faut / (1 + fld.kor * this.K[j]);
        const C = this.C[j];
        const kEff = fld.Vmax / (KM + C) + fld.kl;
        const Cstar = J / kEff;
        const Cn = Cstar + (C - Cstar) * Math.exp(-kEff * h);
        this.C[j] = Cn;
        const upd = (th, [on, off]) => { const a = on * Cn, b = a + off; return a / b + (th - a / b) * Math.exp(-b * h); };
        this.th1[j] = upd(this.th1[j], REC.D1);
        this.th2[j] = upd(this.th2[j], REC.D2);
        this.aut[j] = upd(this.aut[j], REC.AUT);
        if (fld.kor > 0) this.K[j] = relax(this.K[j], p.gK * Math.max(0, this.th1[j] / this.th10[j] - 1), h, p.tauK);
        this.Cslow[j] = relax(this.Cslow[j], Cn, h, p.tauTonic);
        this.Csum[j] += Cn;
        if (Cn > this.Cmax[j]) this.Cmax[j] = Cn;
        this.Cpeak[j] = Cn >= this.Cpeak[j] ? Cn : relax(this.Cpeak[j], Cn, h, p.tauPeak);
      }
      this.Cn++;
    }
    if (hadReset) this.resetPending--;
    // Burst indicator for the HUD: lateral VTA relative to its tonic rate.
    this.burst = Math.max(0, this.nu[P.VTAl] / (POPS[P.VTAl].nu0 * this.tonicBar[P.VTAl]) - 1);
    // Closed loop: the drive of the arousal equation follows the slow shell level (§6.4 (11)).
    m.D = clamp(p.D0 + p.kB * (this.Cslow[F.naccShell] / FIELDS[F.naccShell].C0 - 1));
  }

  // Visual state, advanced in screen time (§8.1). Every large-area change is low-passed with
  // τ ≥ 0.3 s (photosensitivity); individual spikes are never drawn: firing shows as a rate-coded
  // twinkle capped at 2 Hz per point, whatever the per-point rate factor of the shader.
  updateVisuals(dts, m, kh) {
    const v = this.vis, p = this.p;
    const flareGain = this.reducedMotion ? 0.5 : 1;
    if (this.Cn > 0) {
      for (let j = 0; j < FIELDS.length; j++) { this.Cmean[j] = this.Csum[j] / this.Cn; this.Csum[j] = 0; }
      this.Cn = 0;
    }
    const lockedOrgasm = p.pulseLocked && m.phase === 'orgasm';
    const sparkMax = p.hzMax / p.sparkKMax;
    for (let j = 0; j < FIELDS.length; j++) {
      const f = FIELDS[j];
      const Cflare = kh > 2 ? this.Cmean[j] : this.C[j];
      const T = clamp(0.3 + 0.5 * Math.log2(this.Cslow[j] / f.C0));
      const Fl = flareGain * clamp(0.5 * Math.log2(Cflare / this.Cslow[j]));
      const tauClear = 1 / (f.Vmax / (KM + this.C[j]) + f.kl);
      let tau = Math.max(p.tauVisFloor, 0.5 * tauClear / Math.max(1, kh));
      if (lockedOrgasm) tau = Math.max(tau, p.tauVisLocked);
      v.E[j] = relax(v.E[j], clamp(T + 0.6 * Fl, 0, 1.3), dts, tau);
      v.spread[j] = relax(v.spread[j], clamp(0.25 + 0.75 * T + 0.3 * Fl), dts, Math.max(p.tauSpreadFloor, tau));
      // Release sparks: phase advances with release relative to tonic, ≤ 2 Hz per site.
      const sparks = Math.min(sparkMax, p.sparkRate * this.relRelease[j]);
      for (let k = 0; k < f.regions.length; k++) {
        const r = f.regions[k];
        this.region[r * 4 + 1] = f.wVis[k] * v.E[j];
        this.region[r * 4 + 2] = v.spread[j];
        this.da[r * 4 + 2] = (this.da[r * 4 + 2] + dts * sparks) % 4096;
      }
    }
    // Hypothalamus: mean(MPOA, PVN) × 0.5 (§8.1).
    const hy = R.hypothalamus * 4;
    this.region[hy + 1] = 0.5 * 0.5 * (FIELDS[F.MPOA].wVis[0] * v.E[F.MPOA] + FIELDS[F.PVN].wVis[0] * v.E[F.PVN]);
    this.region[hy + 2] = 0.5 * (v.spread[F.MPOA] + v.spread[F.PVN]);

    for (let i = 0; i < POPS.length; i++) {
      v.fire[i] = relax(v.fire[i], this.nu[i] / POPS[i].nu0, dts, p.tauVisFloor);
    }
    // Cell-group lanterns: VTA-l on `vta`, VTA-m on `vtaMedial` (§8.1); A8 is pooled with the SNc.
    const spikeMax = p.hzMax / p.somaKMax;
    const setGroup = (r, lvl, nuHz) => {
      this.da[r * 4] = lvl;
      this.da[r * 4 + 1] = (this.da[r * 4 + 1] + dts * Math.min(spikeMax, p.somaRate * nuHz)) % 4096;
    };
    setGroup(R.vta, v.fire[P.VTAl], this.nu[P.VTAl]);
    setGroup(R.vtaMedial, v.fire[P.VTAm], this.nu[P.VTAm]);
    setGroup(R.snc, v.fire[P.SNc], this.nu[P.SNc]);
    setGroup(R.a11, v.fire[P.A11], this.nu[P.A11]);
    setGroup(R.arcuate, v.fire[P.A12], this.nu[P.A12]);
    setGroup(R.zonaIncerta, v.fire[P.A13], this.nu[P.A13]);
    setGroup(R.a14, v.fire[P.A14], this.nu[P.A14]);

    // Flow along the fibres: firing history of each pathway's source, newest first. The 2-s visual
    // travel time is a declared slowdown (real conduction takes 40–200 ms; §8.1, §9.3).
    this.histAcc += dts;
    while (this.histAcc >= p.histStep) {
      this.histAcc -= p.histStep;
      PATHWAYS.forEach((pw, k) => {
        const base = k * PATH_HIST;
        this.pathHist.copyWithin(base + 1, base, base + PATH_HIST - 1);
        this.pathHist[base] = this.reducedMotion ? 0.5 : clamp(v.fire[P[PATH_SOURCE[pw.id]] ?? P.VTAl] - 0.5, 0, 3);
      });
    }

    // Modulators on their source nuclei (fourth channel of the region state; §8.1).
    const mods = this.modulators(m);
    const setMod = (key, x) => { for (const r of MODULATORS[key].regions) this.region[r * 4 + 3] = relax(this.region[r * 4 + 3], x, dts, p.tauMod); };
    setMod('prolactin', clamp(mods.prolactin / 1.2));
    setMod('serotonin', mods.serotonin);
    setMod('gaba', clamp((mods.gaba - 0.5) * 1.2));
    setMod('opioid', mods.opioid);

    this._activity(dts, m);
  }

  // Optional imaging-based overlay, off by default: small ±10–20 % flux changes of cool stars, labelled
  // "blood flow, not dopamine" in the HUD (§8.1). Disputed human PET and fMRI findings of orgasm.
  _activity(dts, m) {
    const v = this.vis, p = this.p;
    v.omega = relax(v.omega, m.Omega, dts, m.Omega > v.omega ? 0.6 : 4);
    const W = v.omega * (p.imaging ? p.imagingAmp * (this.reducedMotion ? 0.5 : 1) : 0);
    for (let r = 0; r < REGION_COUNT; r++) {
      let target = 1;
      if (r === R.cerebellum) target = 1 + 0.15 * W;
      else if (r === R.dentate) target = 1 + 0.2 * W;
      else if (r === R.pag) target = 1 + 0.15 * W;
      else if (r === R.ofc) target = 1 - 0.15 * W;
      v.act[r] = relax(v.act[r], target, dts, p.tauAct);
      this.region[r * 4] = v.act[r];
    }
  }

  // Modulator levels for the HUD (normalized; 0 = absent or baseline).
  modulators(m) {
    return {
      prolactin: m.R,                                // relative surge, 0 at baseline (response model)
      serotonin: clamp(this.Z),                      // lateral-hypothalamic 5-HT, satiety proxy
      gaba: this.Gamma / (1 + this.Gamma),           // VTA/RMTg GABA brake, 0.5 at baseline
      opioid: this.PsiHat,                           // μ-opioid tone Ψ̂
      oxytocin: m.O,
      gain: this.gMod,                               // net modulator gain on midbrain drive
    };
  }

  readouts() {
    const f = (id) => this.C[F[id]];
    const pct = (id) => 100 * this.C[F[id]] / FIELDS[F[id]].C0;
    return {
      naccCore: f('naccCore'), naccShell: f('naccShell'), dStriatum: f('dStriatum'), mPFC: f('mPFC'),
      amygdala: f('amygdala'), mpoa: f('MPOA'), pvn: f('PVN'), medEminence: f('medEminence'), spinal: f('spinal'),
      // §8.6: NAcc rows show the tonic level and the last peak; MPOA, ME and A11 in % baseline.
      naccCoreTonic: this.Cslow[F.naccCore], naccShellTonic: this.Cslow[F.naccShell],
      naccCorePeak: this.Cpeak[F.naccCore], naccShellPeak: this.Cpeak[F.naccShell],
      mpoaPct: pct('MPOA'), medEminencePct: pct('medEminence'), spinalPct: pct('spinal'),
      ratioNacc: this.C[F.naccCore] / FIELDS[F.naccCore].C0,
      tonicNacc: this.Cslow[F.naccShell] / FIELDS[F.naccShell].C0,
      vta: 0.5 * (this.nu[P.VTAl] + this.nu[P.VTAm]), vtaL: this.nu[P.VTAl], vtaM: this.nu[P.VTAm],
      snc: this.nu[P.SNc], tida: this.nu[P.A12],
      d1: this.th1[F.naccCore], d2: this.th2[F.naccCore],
      lactotrophD2: this.th2[F.medEminence],
      delta: this.delta, burst: this.burst,
    };
  }
}
