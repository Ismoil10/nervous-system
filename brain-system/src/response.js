// Human sexual response model (research/DOPAMINE.md §6.7, the corrected orgasm-galaxy/research/ANALYSIS.md
// §7.2–§7.9), the physiological driver of Brain System. It integrates in human time with first-order
// dynamics: felt arousal A with positive dopaminergic feedback and dual control, genital vasocongestion
// G, autonomic tone, myotonia, catecholamines, oxytocin, prolactin, opioid tone, vasopressin, refractory
// inhibition and the spinal rhythm generator. The human clock is set per phase and ramps smoothly in log
// space (§9.3). The dopamine layer (dopamine.js) follows every human step through
// onStep(h, prev) and writes the dopaminergic drive D back (closed loop, DOPAMINE.md §6.4 (11)). All
// numbers are illustrative typical values.
//
// Brain System integration (research/ANALYSIS.md B.5, §11.14): every random draw comes from a seeded
// mulberry32 stream (`this.rand`), and `update(dt)` is split into stepClock(dtS), stimulusFor(dtS) and
// advanceFrame(dtS, S) so that the orgasm scenario adapter (src/sim/orgasm-adapter.js) drives the same
// substep loop from the shared clock (test/orgasm-regression.test.mjs).

import { mulberry32 } from './anatomy.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const relax = (x, target, dt, tauUp, tauDown = tauUp) =>
  x + (target - x) * (1 - Math.exp(-dt / (target > x ? tauUp : tauDown)));

// Phase names and texts (research/DOPAMINE.md §9.9; species-tagged, neutral).
export const PHASES = {
  baseline: {
    name: 'Baseline',
    desc: 'Resting tone. In the model, midbrain dopamine neurons fire at about 4 Hz and accumbens dopamine sits near 15 nM, which occupies about 60 % of high-affinity D2 receptors (rat-calibrated values).',
  },
  excitement: {
    name: 'Excitement',
    desc: "Arousal builds. In male rats, accumbens dopamine rises when a receptive partner is presented and rises further during copulation (microdialysis, samples of several minutes); the model's opening transient stands in for that anticipatory cue signal. In the model, medial preoptic dopamine climbs with arousal, as it does in male rats before and during copulation (microdialysis); its role in humans is unknown.",
  },
  plateau: {
    name: 'Plateau',
    desc: 'High, fluctuating arousal. Model accumbens dopamine averages about 1.45 times rest, inside the 1.4–2-fold rise measured in male rats during copulation (microdialysis).',
  },
  onset: {
    name: 'Onset',
    desc: 'A brief onset window; with the emission setting it cannot be stopped. In the model, midbrain firing ramps as the expected reward approaches (reward-prediction framework; not measured during sex).',
  },
  orgasm: {
    name: 'Orgasm',
    desc: 'Rhythmic contractions begin about 0.6–0.8 s apart (human recordings, both sexes). Human imaging at the climax is not consistent: most studies report cerebellar increases, but prefrontal and orbitofrontal blood flow fell in PET studies (women; men on re-analysis), while an fMRI study of women found orbitofrontal increases and no region decreasing. A ventral-midbrain increase reported in one PET study of men was largely not confirmed by its re-analysis; fMRI in women shows a broad rise that includes the ventral tegmental region. None of these methods measures dopamine. Model dopamine follows a smooth reward envelope; no data link dopamine to individual contractions. Prolactin is released (human blood samples); a withdrawal of tuberoinfundibular dopamine is one proposed mechanism (hypothesis).',
  },
  resolutionEarly: {
    name: 'Early resolution',
    desc: 'What accumbens dopamine does now is unresolved. In male rats it falls from its copulation level after ejaculation but, in 15-min samples, stays above baseline across repeated ejaculations and returns to baseline only at satiety (microdialysis). Whether it dips below rest, possibly through lateral-hypothalamic serotonin, is unknown. The model shows the selected hypothesis. The model assumes a post-orgasmic opioid contribution (rat place-preference studies; unmeasured in humans).',
  },
  resolutionLate: {
    name: 'Late resolution',
    desc: 'Prolactin stays raised (men and women, blood samples after coitus; still raised 60 min after orgasm, the end of sampling). In the model its short-loop feedback (rodent evidence) drives tuberoinfundibular dopamine above rest, as a consequence of prolactin, not its cause. With the default setting the refractory period ends during this phase.',
  },
  recovery: {
    name: 'Recovery',
    desc: 'Return toward baseline. In the model prolactin declines slowly (human blood samples show it still raised at 60 min; the later decline is a model assumption), and the median-eminence dopamine rebound fades with it. Orgasm is possible again once refractory inhibition ends: with the default setting this happened during late resolution; with long settings (for example the older-adult profile) it still gates stimulation here, and settings without an obligatory refractory period have none.',
  },
  noClimax: {
    name: 'No climax',
    desc: 'The plateau ended without orgasm. In the model, withdrawing stimulation briefly pauses midbrain firing (a negative reward-prediction error); dopamine and arousal then decline slowly, with no prolactin surge.',
  },
};

// Profiles are response patterns available to any body (galaxy §7.2, §7.9; DOPAMINE.md §6.7).
const BASE = {
  e: 0.5, s: 0.5, kappa: 0.45, q: 0.5, I0: 1.0, tref: 900, tauH: 120, f: 0.6, age: 0,
  tauAScale: 1, gDecayScale: 1, growth: 1.08,
  tail: 3,                     // galaxy §7.5: 0–3 minor pulses
  tailRef: 2,                  // §6.9 deterministic reference tail
  delta0: 0.8,                 // galaxy §7.2: initial contraction interval, 0.6–0.9 s
  pattern: 'mj',               // galaxy §7.5: 'mj' or 'emg'
  Tpre: 1.5, uPre: false,      // galaxy §7.2: onset window (human s) and emission setting
  gate: true,                  // galaxy §7.9: orgasm gate active
};
export const PROFILES = {
  single: { ...BASE },
  multiple: { ...BASE, I0: 0.05, tauH: 30 },
  rapid: { ...BASE, e: 0.8, tauAScale: 0.5, gDecayScale: 0.5 },
  noclimax: { ...BASE, e: 0.3, s: 0.8, gate: false },
  extended: { ...BASE, q: 1.0, growth: 1.04, tailRef: 3 },
  older: { ...BASE, age: 0.8, q: 0.3, tref: 12 * 3600 },
};

export const C = {
  tauA: 600, gamma: 5, lambda: 0.03, lambdaS: 0.15, aH: 0.5, tauC: 60,   // §6.7, galaxy §7.4
  tauInh: 20, tauOff: 180, tauR: 90, iGate: 0.08,                        // §6.7 decay terms on A
  etaTau: 20, etaSd: 0.03,                                               // galaxy §7.4 level noise
  tauG: 20,
  theta: 0.85, thetaHold: 0.5, plateauA: 0.75, plateauSag: 0.7,          // §6.7, galaxy §7.6
  onsetScreen: 2.5, cancelS: 0.5, tauOmega: 20, tauOmegaCancel: 2,       // §6.7 ONSET row
  tauO: 350, tauPsi: 900, kO: 5e-4, kOOmega: 0.03, kPsi: 0.025,          // §6.7
  tauVFall: 1200,                                                        // §6.7: vasopressin fall 20 min
  tauRRise: 300, tauRFall: 2400, rHold: 1800, rCap: 1.5,                 // §6.7: prolactin closed form
  tauITiny: 20,                                                          // galaxy §7.4: τ_I for I₀ ≤ 0.08
  aRes: 0.35, aResSpan: 0.45,                                            // §6.7: A_res = 0.35 + 0.45·(1 − I₀)
  hMax: 0.5, hFine: 0.05, stimGap: 0.02,                                 // §6.7, §9.3: human step cap
  clockRamp: 1,                                                          // §9.3: screen s of a log ramp
  tailAmp: 0.10, tailAmpSpan: 0.10, tailGap: 2, tailGapSpan: 2,          // §6.7: tail pulses
  tailRefAmp: 0.15, tailRefGap: 3, trainEnd: 2,                          // §6.7, §6.9 reference tail
};

// Clock regimes (§9.3): human seconds per screen second. ONSET runs at T_pre / 2.5 s, recovery and
// no climax at a value fixed at phase entry. Read by src/clock.js through the orgasm adapter's
// delegate (ANALYSIS.md §11.14).
export const CLOCK = {
  baseline: 10, excitement: 10, plateau: 10, orgasm: 1,
  resolutionEarly: 20, resolutionLate: 60, recovery: 60, noClimax: 60,
};

// Linear ramp in log10 space over `dur` screen seconds; re-exported by src/clock.js.
export class LogRamp {
  constructor(v) { this.from = this.to = this.value = Math.log10(v); this.t = 0; this.dur = 0; }
  set(target, dur) {
    const t = Math.log10(target);
    if (Math.abs(t - this.to) < 1e-6) return;
    this.from = this.value; this.to = t; this.t = 0; this.dur = dur;
  }
  // Jump to v at once (the instant switch into ONSET and out of a T_pre = 0 ONSET, §9.3).
  snap(v) { this.from = this.to = this.value = Math.log10(v); this.t = 0; this.dur = 0; }
  step(dt) {
    this.t += dt;
    this.value = this.dur > 0 ? this.from + (this.to - this.from) * clamp(this.t / this.dur) : this.to;
    return Math.pow(10, this.value);
  }
}

export class ResponseModel {
  // `rng` (a function returning [0, 1)) overrides the default stream mulberry32(seed). `deterministic`
  // is the §6.9 reference: η = 0, q = p.q exactly and the fixed reference tail (§6.7, §9.1).
  constructor({ seed = 1, rng = null, deterministic = false } = {}) {
    this.rand = rng || mulberry32(seed);
    this.deterministic = deterministic;
    this.mode = 'demo';
    this.level = 0;
    this.held = false;
    this.prev = {};
    this.setProfile('single');
    this.envelope = 'typical';
    this.reset();
  }

  reset() {
    Object.assign(this, {
      phase: 'baseline', phaseT: 0, phaseTh: 0, onsetS: 0,
      St: 0, X: 0, eta: 0, A: 0, G: 0, Gpeak: 0, D: 0.2, sigma: 0.1, M: 0, N: 0.1, O: 0, R: 0, Psi: 0, V: 0,
      I: 0, Itgt: 0, H: 0, F: 0, Fpeak: 0, Omega: 0, omegaCancel: false,
      tHuman: 0, tIgnite: 0, khNow: CLOCK.baseline, orgasmEnds: [], aboveTheta: 0, stimOffH: 0, lowHeldH: 0,
      train: null, pulses: { done: 0, total: 0 },
      demoT: 0, demoPeaks: 0, events: [],
    });
    this.kh = new LogRamp(CLOCK.baseline);
  }

  setProfile(id) {
    this.profileId = id;
    this.p = { ...PROFILES[id] };
    if (this.trefOverride) this.p.tref = this.trefOverride;
    if (this.onsetOverride) Object.assign(this.p, this.onsetOverride);
  }
  setTref(seconds) { this.trefOverride = seconds; this.p.tref = seconds; }
  // Onset window (§6.10): T_pre 0–3 s, or the emission setting (u_pre on, T_pre ≈ 2.5 s, irreversible).
  setOnset({ Tpre, uPre = false } = {}) {
    const T = Tpre == null ? (uPre ? 2.5 : PROFILES[this.profileId].Tpre) : clamp(Tpre, 0, 3);
    this.onsetOverride = { Tpre: T, uPre: !!uPre };
    Object.assign(this.p, this.onsetOverride);
  }
  // Restart the random stream (the adapter calls this before reset(), B.13).
  setSeed(seed) { this.rand = mulberry32(seed); }
  setMode(m) { this.mode = m; this.held = false; }
  setLevel(v) { this.level = v; }
  setHeld(h) { this.held = h; }
  distract() { this.X = Math.min(1, this.X + 0.6); }

  // A_obs: felt arousal with its slow waves (Ornstein–Uhlenbeck, sd 0.03), used for the thresholds and
  // the readouts, while A itself follows the deterministic dynamics. No ceiling but 1 (§6.7).
  get Aeff() { return clamp(this.A + this.eta, 0, 1); }
  // â: arousal seen by the autonomic system, which keeps the sympathetic peak through the train (§6.7).
  get ahat() { return Math.min(1, Math.max(this.A / C.theta, this.Omega)); }
  // Effective stimulation, gated by refractory inhibition I and habituation H (DOPAMINE.md §9.1).
  get Seff() { return this.St * (1 - this.I) * (1 - 0.9 * this.H); }

  _enter(phase) {
    const from = this.phase;
    this.phase = phase; this.phaseT = 0; this.phaseTh = 0;
    if (phase === 'onset') {
      // Human time switches at once, so ONSET lasts exactly 2.5 s on screen (§6.7 clock row).
      this.tIgnite = this.tHuman;
      this.omegaCancel = false;
      if (this.p.Tpre > 0) this.kh.snap(this.p.Tpre / C.onsetScreen);
      return;
    }
    let kh = CLOCK[phase];
    // Fixed once at phase entry; recomputing it each frame would stretch the phase (§9.3).
    if (phase === 'recovery') kh = Math.max(60, this._recoveryRemaining() / 20);
    if (phase === 'noClimax') kh = Math.max(60, this._noClimaxRemaining() / 30);
    if (phase === 'baseline') { this.demoT = 0; this.demoPeaks = 0; }
    // A log ramp cannot start at log10 0 (§6.7 clock row).
    if (from === 'onset' && this.p.Tpre === 0) { this.kh.snap(kh); this.khNow = kh; }
    else this.kh.set(kh, C.clockRamp);
  }

  // Human seconds until the refractory inhibition and prolactin have both fallen (I < 0.08, R < 0.2).
  _recoveryRemaining() {
    for (let t = 0; t < 30 * 3600; t += 30) {
      if (this._Iat(this.tHuman + t) < C.iGate && this._Rat(this.tHuman + t) < 0.2) return t;
    }
    return 30 * 3600;
  }
  // Human seconds until G < 0.1 at the no-climax decay (§6.7).
  _noClimaxRemaining() { return this.G > 0.1 ? 2700 * Math.log(this.G / 0.1) : 0; }
  // I after the last orgasm end; during a train it rises with the pulses instead (§6.7).
  _Iat(t) {
    const te = this.orgasmEnds[this.orgasmEnds.length - 1];
    if (te === undefined) return 0;
    const I0 = this.p.I0;
    const tau = I0 > C.iGate ? this.p.tref / Math.log(I0 / C.iGate) : C.tauITiny;
    return this.Itgt * Math.exp(-(t - te) / tau);
  }
  // Prolactin: closed form after each orgasm end, over all orgasm ends of the session, capped (§6.7).
  _Rat(t) {
    let R = 0;
    const ctx = 0.3 + 0.7 * this.p.I0;
    for (const te of this.orgasmEnds) {
      if (t < te) continue;
      R += ctx * (1 - Math.exp(-(t - te) / C.tauRRise)) * Math.exp(-Math.max(0, t - te - C.rHold) / C.tauRFall);
    }
    return Math.min(C.rCap, R);
  }

  _demoStimulus(dt) {
    this.demoT += dt;
    const ph = this.phase, multiple = this.profileId === 'multiple';
    if (ph === 'baseline') return this.demoT > 3 ? 1 : 0;
    if (ph === 'excitement' || ph === 'plateau') {
      if (this.profileId === 'noclimax' && this.demoT > 75) return 0;
      return 1;
    }
    if (ph === 'onset') return 1;
    // A multiple-peak profile goes for one serial peak: stimulation ends when the second ORGASM
    // begins (never during ONSET, where releasing cancels it; §9.8 demo row).
    if (ph === 'orgasm') return multiple && this.demoPeaks >= 1 ? 0 : 1;
    if (ph === 'resolutionEarly' && multiple && this.demoPeaks < 2) return 1;
    return 0;
  }

  _startTrain() {
    const p = this.p;
    const q = this.deterministic ? p.q : clamp(p.q * (1 + (this.rand() * 2 - 1) * 0.15));
    const N = Math.round(3 + 12 * q);
    const emg = p.pattern === 'emg';
    const nReg = emg ? 1 : 3 + Math.floor(3 * q);
    const times = [], amps = [];
    let t = 0;
    for (let k = 1; k <= N; k++) {
      times.push(t);
      amps.push(k <= 2 ? 1 : Math.pow(0.82, k - 2));
      if (emg) t += p.delta0 + 0.1 * (k - 1);
      else t += k < nReg ? p.delta0 : p.delta0 * Math.pow(p.growth, k + 1 - nReg);
    }
    let tt = times[times.length - 1];
    if (this.deterministic) {
      for (let i = 0; i < p.tailRef; i++) { tt += C.tailRefGap; times.push(tt); amps.push(C.tailRefAmp); }
    } else {
      const tail = Math.floor(this.rand() * (p.tail + 1));
      for (let i = 0; i < tail; i++) {
        tt += C.tailGap + C.tailGapSpan * this.rand();
        times.push(tt); amps.push(C.tailAmp + C.tailAmpSpan * this.rand());
      }
    }
    const sumA = amps.reduce((a, b) => a + b, 0);
    const Ares = C.aRes + C.aResSpan * (1 - p.I0);
    this.Itgt = Math.max(this.I, p.I0);
    this.train = {
      times, amps, sumA, next: 0, t: 0, end: tt + C.trainEnd, q,
      dA: Math.max(0, this.A - Ares) / sumA, dI: (this.Itgt - this.I) / sumA,
    };
    this.pulses = { done: 0, total: N };
  }

  // One integration step in human time (dt ≤ the current cap).
  _integrate(dt, S) {
    const p = this.p, ph = this.phase;
    this.St = relax(this.St, S, dt, 1);
    this.X *= Math.exp(-dt / C.tauInh);
    if (!this.deterministic) {
      // Ornstein–Uhlenbeck arousal waves (20 s correlation, sd 0.03).
      const g = (this.rand() + this.rand() + this.rand() + this.rand() - 2) * 1.732;
      this.eta += -this.eta / C.etaTau * dt + C.etaSd * Math.sqrt(2 * dt / C.etaTau) * g;
    }

    if (ph !== 'orgasm') this.I = this._Iat(this.tHuman);
    const te = this.orgasmEnds[this.orgasmEnds.length - 1];
    this.H = te === undefined ? 0 : Math.exp(-(this.tHuman - te) / p.tauH);
    this.R = this._Rat(this.tHuman);

    const Seff = this.Seff;
    // Central arousal: self-amplifying, dual control, upward genital feedback, withdrawal and
    // refractory decline. Not integrated during ONSET and ORGASM (galaxy §7.4).
    if (ph !== 'orgasm' && ph !== 'onset') {
      const dA = (p.e * Seff * (1 + C.gamma * this.D) * (1 - this.A)
        - (C.lambda + C.lambdaS * p.s + C.aH * this.St * this.H) * this.A) / (C.tauA * p.tauAScale)
        + p.kappa * Seff * Math.max(0, this.G - this.A) / C.tauC
        - this.A * (p.s * this.X / C.tauInh + (1 - this.St) / C.tauOff + Math.max(0, this.I - C.iGate) / C.tauR);
      this.A = clamp(this.A + dA * dt);
    }

    // Genital vasocongestion: parasympathetic, with an inverted-U sympathetic effect.
    const nu = clamp(p.kappa * this.A + (1 - p.kappa) * p.e * Seff) * (1 + 1.2 * this.sigma * (0.6 - this.sigma));
    const tauG = C.tauG * (1 + 4 * p.age);
    if (ph === 'resolutionEarly' || ph === 'resolutionLate' || ph === 'recovery') {
      const since = this.tHuman - te;
      const stage2 = this.I < 0.5 || since > 300;
      this.G = stage2 ? relax(this.G, 0, dt, 600 * p.gDecayScale) : relax(this.G, 0.5 * this.Gpeak, dt, 60 * p.gDecayScale);
      if (Seff > 0.05) this.G = Math.max(this.G, relax(this.G, nu, dt, tauG));
    } else if (ph === 'noClimax') {
      this.G = relax(this.G, 0, dt, 2700);
    } else {
      this.G = relax(this.G, nu, dt, tauG);
    }
    this.Gpeak = Math.max(this.Gpeak * (ph === 'baseline' ? 0 : 1), this.G);

    // The sympathetic discharge at the climax is fast (τ 3 s), otherwise τ 10 s up / 60 s down.
    const a = this.ahat;
    this.sigma = relax(this.sigma, 0.10 + 0.55 * a ** 2 + 0.35 * this.Omega, dt, this.Omega > 0.5 ? 3 : 10, 60);
    this.M = relax(this.M, Math.pow(a, 1.5) + 0.3 * this.Omega, dt, 30, 60);
    this.N = relax(this.N, this.sigma + 0.5 * this.Omega, dt, 30, 173);
    this.O += (C.kO * this.A + C.kOOmega * this.Omega - this.O / C.tauO) * dt;
    this.Psi += (C.kPsi * this.Omega - this.Psi / C.tauPsi) * dt;
    this.V = relax(this.V, 0.6 * this.A * (1 - this.Omega), dt, 60, C.tauVFall);
    const Fstar = p.f * smoothstep(0.7, 1.0, a) + 0.2 * p.f * this.Omega;
    this.F = relax(this.F, Fstar, dt, 30, 300);
    this.Fpeak = this.F > this.Fpeak || this.F < 0.01 ? this.F : this.Fpeak;

    // Spinal generator envelope Ω and the contraction train. Ω = 1 until t_e (§6.7).
    if (ph === 'onset') {
      this.Omega = clamp((this.phaseTh + dt) / p.Tpre);
    } else if (ph === 'orgasm' && this.train) {
      const tr = this.train;
      tr.t += dt;
      while (tr.next < tr.times.length && tr.t >= tr.times[tr.next]) {
        const amp = tr.amps[tr.next];
        this.A = clamp(this.A - tr.dA * amp);
        this.I = Math.min(this.Itgt, this.I + tr.dI * amp);
        if (tr.next < this.pulses.total) this.pulses.done = tr.next + 1;
        this.events.push({ type: 'pulse', amp });
        tr.next++;
      }
      this.Omega = 1;
    } else {
      this.Omega *= Math.exp(-dt / (this.omegaCancel ? C.tauOmegaCancel : C.tauOmega));
    }
    this.tHuman += dt;
  }

  // ONSET → ORGASM (§6.7): the train is drawn here, and Ω is 1 from its first pulse.
  _beginOrgasm() {
    this.onsetS = this.phaseT;
    this._startTrain();
    this.Omega = 1;
    this._enter('orgasm');
  }

  // The phase machine (galaxy §7.6 table, DOPAMINE.md §6.7 row).
  _transitions() {
    const ph = this.phase, p = this.p;
    const Seff = this.Seff, Aobs = this.Aeff;
    if (ph === 'baseline' && Seff > 0.05) return this._enter('excitement');
    if (ph === 'excitement') {
      if (Aobs >= C.plateauA) return this._enter('plateau');
      if (this.lowHeldH >= 20) return this._enter('baseline');
    }
    if (ph === 'plateau') {
      // Below S̃ = 0.5 an interruptible ONSET would cancel in its first step, so it does not begin.
      if (p.gate && this.aboveTheta >= C.thetaHold && this.I < C.iGate && (p.uPre || this.St >= C.cancelS)) {
        this.events.push({ type: 'ignite' });
        return this._enter('onset');
      }
      if (this.stimOffH >= 60 && this.A < 0.6) return this._enter('noClimax');
      if (Aobs < C.plateauSag && this.St > 0.05) return this._enter('excitement');
    }
    if (ph === 'onset') {
      if (!p.uPre && this.St < C.cancelS) {
        this.omegaCancel = true;
        this.aboveTheta = 0;
        this.events.push({ type: 'cancel' });
        return this._enter('plateau');
      }
      if (this.phaseTh >= p.Tpre - 1e-9) return this._beginOrgasm();
    }
    if (ph === 'orgasm' && this.train && this.train.t >= this.train.end) {
      this.orgasmEnds.push(this.tHuman);
      while (this.orgasmEnds.length > 1 && this.tHuman - this.orgasmEnds[0] > 30 * 3600) this.orgasmEnds.shift();
      this.demoPeaks++;
      this.events.push({ type: 'end' });
      return this._enter('resolutionEarly');
    }
    const te = this.orgasmEnds[this.orgasmEnds.length - 1];
    if (ph === 'resolutionEarly') {
      if (Seff > 0.05 && this.I < C.iGate && Aobs >= C.plateauA) return this._enter('plateau');
      if (this.phaseTh >= 300) return this._enter('resolutionLate');
    }
    if (ph === 'resolutionLate') {
      if (Seff > 0.05 && this.I < C.iGate) return this._enter('excitement');
      if (this.tHuman - te >= 1800) return this._enter('recovery');
    }
    if (ph === 'recovery') {
      if (Seff > 0.05 && this.I < C.iGate) return this._enter('excitement');
      if (this.I < C.iGate && this.R < 0.2) return this._enter('baseline');
    }
    if (ph === 'noClimax') {
      if (Seff > 0.05) return this._enter('excitement');
      if (this.G < 0.1) return this._enter('baseline');
    }
  }

  // The pre-step state the dopamine layer interpolates from (§6.4 (12), §9.1). One reused object: a
  // reader must not keep it past its onStep call.
  snapshot() {
    const s = this.prev;
    s.tHuman = this.tHuman; s.phase = this.phase; s.St = this.St; s.Aeff = this.Aeff; s.A = this.A;
    s.X = this.X; s.I = this.I; s.H = this.H; s.G = this.G; s.M = this.M; s.N = this.N; s.O = this.O;
    s.R = this.R; s.Psi = this.Psi; s.Omega = this.Omega; s.trainT = this.train ? this.train.t : 0;
    return s;
  }

  // Stimulus for this frame, evaluated once at its start: the demo script (screen time) or the level.
  stimulusFor(dtS) {
    const S = this.mode === 'demo' ? this._demoStimulus(dtS) : (this.held ? 1 : this.level);
    if (this.mode === 'demo') this.level = S;
    return S;
  }

  // Largest human step now: 0.5 s, or 0.05 s while S and S̃ differ and in ONSET and ORGASM (§6.7).
  _stepCap(S) {
    return (this.phase === 'onset' || this.phase === 'orgasm' || Math.abs(S - this.St) > C.stimGap) ? C.hFine : C.hMax;
  }

  // Advance h human seconds at stimulus S. Each step integrates, updates the counters _transitions
  // reads, then calls onStep(h, prev) (ANALYSIS.md §11.14). A zero-length advance makes no step and
  // calls no onStep. Returns the human time reached; with stopAtOnset it stops at a transition into
  // ONSET, and no human time passes in an ONSET with T_pre = 0 (§9.3).
  advanceHuman(h, S, stopAtOnset = false) {
    let done = 0;
    for (;;) {
      const rem = h - done;
      if (!(rem > 1e-12)) break;
      if (this.phase === 'onset' && this.p.Tpre === 0) break;
      const cap = this._stepCap(S);
      let step = rem / Math.max(1, Math.ceil(rem / cap));
      if (this.phase === 'onset') {
        const left = this.p.Tpre - this.phaseTh;   // ONSET ends exactly at T_pre
        if (left > 1e-9 && step > left) step = left;
      }
      const prev = this.snapshot();
      this._integrate(step, S);
      this.phaseTh += step;
      if (this.khNow > 0) this.phaseT += step / this.khNow;
      this.aboveTheta = this.Aeff >= C.theta ? this.aboveTheta + step : 0;
      this.stimOffH = this.St < 0.05 ? this.stimOffH + step : 0;
      this.lowHeldH = this.A < 0.03 && this.St < 0.02 ? this.lowHeldH + step : 0;
      const before = this.phase;
      this._transitions();
      this.onStep?.(step, prev);
      done += step;
      if (stopAtOnset && before !== 'onset' && this.phase === 'onset') break;
    }
    return done;
  }

  // The clock value of this frame (the orgasm adapter's SimClock delegate calls this): 0 in an ONSET
  // with T_pre = 0, where a log ramp is undefined (§9.3). Stored as khNow before the step loop (§9.1).
  stepClock(dtS) {
    this.khNow = this.phase === 'onset' && this.p.Tpre === 0 ? 0 : this.kh.step(dtS);
    return this.khNow;
  }

  // One frame of dtS screen seconds at stimulus S and the current khNow. On a transition into ONSET
  // the rest of the frame runs at the ONSET clock; an ONSET with T_pre = 0 passes screen time only
  // and ends after 2.5 s of it (§6.7, §9.3). `locked` holds the frame's clock (a user lock replaced
  // the model's own, ANALYSIS.md A.4). Returns the human seconds reached.
  advanceFrame(dtS, S, locked = false) {
    let rem = dtS, reached = 0;
    while (rem > 0) {
      if (this.phase === 'onset' && this.p.Tpre === 0) {
        const step = Math.min(rem, C.onsetScreen - this.phaseT);
        this.phaseT += step;
        rem -= step;
        if (this.phaseT >= C.onsetScreen - 1e-9) { this.khNow = 0; this._beginOrgasm(); }
        continue;
      }
      const k = this.khNow;
      if (!(k > 0)) break;
      const want = rem * k;
      const done = this.advanceHuman(want, S, true);
      reached += done;
      if (done >= want - 1e-12 || this.phase !== 'onset') break;
      rem -= done / k;
      if (!locked) this.khNow = this.p.Tpre === 0 ? 0 : this.p.Tpre / C.onsetScreen;
    }
    return reached;
  }

  // Advance by dt screen seconds with the model's own clock (the legacy path). Returns the clock
  // factor at the end of the frame.
  update(dt) {
    this.stepClock(dt);
    const S = this.stimulusFor(dt);
    this.advanceFrame(dt, S);
    return { kh: this.khNow };
  }

  // Autonomic drive behind vitals(): h (0–1) and the breath-hold flag. The orgasm adapter writes
  // them into its command records (ANALYSIS.md §11.14: cmdSym = cmdVag = h, apnoea = hold).
  drive() {
    return {
      h: clamp(0.3 * this.ahat + 0.7 * this.sigma),
      hold: this.Omega > 0.8 && this.phase === 'orgasm' && (this.train?.t % 6) < 3,
    };
  }

  // Algebraic vitals (galaxy §7.4); kept as the regression reference (ANALYSIS.md B.13).
  vitals() {
    const lab = this.envelope === 'lab';
    const HRpk = lab ? 180 : 125, dSBP = lab ? 100 : 45, dDBP = lab ? 50 : 8, dRR = lab ? 26 : 13;
    const { h, hold } = this.drive();
    return {
      hr: 68 + (HRpk - 68) * h,
      rr: hold ? 0 : 14 + dRR * h,
      sys: 115 + dSBP * h,
      dia: 75 + dDBP * h,
    };
  }

  neuro() {
    return { D: this.D, O: this.O, R: this.R, N: this.N, Psi: this.Psi, V: this.V, I: this.I };
  }
}
