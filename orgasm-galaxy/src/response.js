// Human sexual response model and its mapping onto the galaxy (research/ANALYSIS.md §7–§9).
//
// Physiology integrates in *human* time with first-order dynamics: felt arousal A with positive
// dopaminergic feedback and dual control, genital vasocongestion G, autonomic tone, myotonia,
// catecholamines, oxytocin, prolactin, opioid tone, vasopressin, refractory inhibition and the
// spinal rhythm generator. The galaxy integrates in *astrophysical* time. Both clocks are set per
// phase and ramp smoothly in log space (§7.7). All numbers are illustrative typical values.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const relax = (x, target, dt, tauUp, tauDown = tauUp) =>
  x + (target - x) * (1 - Math.exp(-dt / (target > x ? tauUp : tauDown)));

export const PHASES = {
  baseline: {
    name: 'Baseline',
    desc: 'Resting tone. Gas lies quietly in the bar dust lanes; the nuclear ring is faint and the nucleus is quiet.',
  },
  excitement: {
    name: 'Excitement',
    desc: 'Arousal builds slowly, then faster as dopaminergic drive feeds back. Gas streams in along the bar lanes and the first young clusters appear in the nuclear ring.',
  },
  plateau: {
    name: 'Plateau',
    desc: 'High, fluctuating arousal and rising heart rate. The nuclear ring is in a starburst, with pink H II regions near the lane contact points.',
  },
  inevitability: {
    name: 'Point of inevitability',
    desc: 'A 2.5-second reflex phase that can no longer be stopped. The nucleus ignites while the galaxy clock slows to about 1,000 years per second.',
  },
  orgasm: {
    name: 'Orgasm',
    desc: 'Rhythmic contractions about 0.8 s apart, each a little weaker and later than the last. Each one launches a knot into the jet, and the ionization cones light up.',
  },
  resolutionEarly: {
    name: 'Early resolution',
    desc: 'Heart rate, blood pressure and muscle tension fall within minutes. Relic knots fly out, light echoes fade and H-alpha leaves the ring.',
  },
  resolutionLate: {
    name: 'Late resolution',
    desc: 'Vasocongestion clears while prolactin stays raised. The ring’s blue stars fade into a white post-starburst glow.',
  },
  recovery: {
    name: 'Recovery',
    desc: 'Refractory period: stimulation has little effect until the inhibition wanes. The bar slowly refills the depleted nuclear reservoir.',
  },
  noClimax: {
    name: 'Resolution without climax',
    desc: 'The plateau ended without orgasm. The ring burns its gas without fuelling the nucleus, and congestion clears slowly.',
  },
};

// Profiles are response patterns available to any body (§7.9).
const BASE = {
  e: 0.5, s: 0.5, kappa: 0.45, rho: 0.5, q: 0.5, I0: 1.0, tref: 900, tauH: 120, f: 0.6, age: 0,
  tauAScale: 1, gDecayScale: 1, growth: 1.08, tail: 2,
};
export const PROFILES = {
  single: { ...BASE },
  multiple: { ...BASE, I0: 0.05, tauH: 30 },
  rapid: { ...BASE, e: 0.8, tauAScale: 0.5, gDecayScale: 0.5 },
  noclimax: { ...BASE, e: 0.3, s: 0.8 },
  extended: { ...BASE, q: 1.0, growth: 1.04, tail: 3 },
  older: { ...BASE, age: 0.8, q: 0.3, tref: 12 * 3600 },
};

export const C = {
  // τ_A, γ and τ_c are re-tuned from §7.4 (120 s, 3, 60 s): with those values the coupling to G
  // holds A below θ, so the climax would depend on noise alone. These reproduce the §7.7 timeline.
  tauA: 440, gamma: 5, lambda: 0.10, aH: 0.5, tauC: 720,
  etaTau: 20, etaSd: 0.03,
  tauG: 20, tauD: 30,
  theta: 0.92, thetaHold: 0.5, inevitability: 2.5,
  plateauA: 0.75, tauO: 350, tauPsi: 900,
};

// Clock regimes (§7.7): human seconds and astrophysical years per screen second.
const CLOCK = {
  baseline: { kh: 10, ka: 4.8e6 },
  excitement: { kh: 10, ka: 4.8e6 },
  plateau: { kh: 10, ka: 4.8e6 },
  inevitability: { kh: 1, ka: 1e3 },
  orgasm: { kh: 1, ka: 1e3 },
  resolutionEarly: { kh: 20, ka: 4.8e6 },
  resolutionLate: { kh: 60, ka: 1e7 },
  recovery: { kh: 60, ka: 1e7 },
  noClimax: { kh: 60, ka: 1e7 },
};

class LogRamp {
  constructor(v) { this.from = this.to = this.value = Math.log10(v); this.t = 0; this.dur = 0; }
  set(target, dur) {
    const t = Math.log10(target);
    if (Math.abs(t - this.to) < 1e-6) return;
    this.from = this.value; this.to = t; this.t = 0; this.dur = dur;
  }
  step(dt) {
    this.t += dt;
    this.value = this.dur > 0 ? this.from + (this.to - this.from) * clamp(this.t / this.dur) : this.to;
    return Math.pow(10, this.value);
  }
}

export class ResponseModel {
  constructor() {
    this.mode = 'demo';
    this.level = 0;
    this.held = false;
    this.setProfile('single');
    this.envelope = 'typical';
    this.reset();
  }

  reset() {
    Object.assign(this, {
      phase: 'baseline', phaseT: 0, phaseTh: 0,
      St: 0, X: 0, eta: 0, A: 0, G: 0, Gpeak: 0, D: 0.2, sigma: 0.1, M: 0, N: 0.1, O: 0, R: 0, Psi: 0, V: 0,
      I: 0, H: 0, F: 0, Fpeak: 0, Omega: 0, OmegaAstro: 0, phasic: 0,
      tHuman: 0, orgasmEnds: [], aboveTheta: 0, train: null, pulses: { done: 0, total: 0 },
      demoT: 0, demoPeaks: 0, events: [], flicker: 0, flickerT: 0, astroSinceEnd: Infinity,
    });
    this.kh = new LogRamp(10);
    this.ka = new LogRamp(4.8e6);
  }

  setProfile(id) {
    this.profileId = id;
    this.p = { ...PROFILES[id] };
    if (this.trefOverride) this.p.tref = this.trefOverride;
  }
  setTref(seconds) { this.trefOverride = seconds; this.p.tref = seconds; }
  setMode(m) { this.mode = m; this.held = false; }
  setLevel(v) { this.level = v; }
  setHeld(h) { this.held = h; }
  distract() { this.X = Math.min(1, this.X + 0.6); }

  // Felt arousal with its slow waves (Ornstein–Uhlenbeck, sd 0.03): used for the threshold,
  // the ring bursts and the readouts, while A itself follows the deterministic dynamics.
  get Aeff() { return clamp(this.A + this.eta, 0, 1 - this.I); }
  // Arousal seen by the sympathetic system: the discharge of felt arousal during the train
  // does not cut the sympathetic peak short.
  get Ah() { return Math.max(this.Aeff, C.theta * this.Omega); }

  _enter(phase) {
    this.phase = phase; this.phaseT = 0; this.phaseTh = 0;
    const c = CLOCK[phase];
    const toClimax = phase === 'inevitability';
    const fromClimax = phase === 'resolutionEarly';
    this.ka.set(c.ka, toClimax ? C.inevitability : fromClimax ? 8 : 3);
    let kh = c.kh;
    if (phase === 'recovery') kh = Math.max(60, this._recoveryRemaining() / 20);
    // Human time switches to real time at once, so the reflex phase lasts exactly 2.5 s on screen.
    this.kh.set(kh, toClimax ? 0 : 1);
  }

  // Human seconds until the refractory inhibition and prolactin have both fallen (I < 0.08, R < 0.2).
  _recoveryRemaining() {
    for (let t = 0; t < 30 * 3600; t += 30) {
      if (this._Iat(this.tHuman + t) < 0.08 && this._Rat(this.tHuman + t) < 0.2) return t;
    }
    return 30 * 3600;
  }
  _Iat(t) {
    const te = this.orgasmEnds[this.orgasmEnds.length - 1];
    if (te === undefined) return 0;
    const I0 = this.p.I0;
    const tau = I0 > 0.08 ? this.p.tref / Math.log(I0 / 0.08) : 20;
    return I0 * Math.exp(-(t - te) / tau);
  }
  // Prolactin: closed form after each orgasm end, accumulating over orgasms (§7.4).
  _Rat(t) {
    let R = 0;
    for (const te of this.orgasmEnds) {
      if (t < te) continue;
      R += (1 - Math.exp(-(t - te) / 300)) * Math.exp(-Math.max(0, t - te - 1800) / 1500);
    }
    return Math.min(1.5, R);
  }

  _demoStimulus(dt) {
    this.demoT += dt;
    const ph = this.phase;
    if (ph === 'baseline') return this.demoT > 3 ? 1 : 0;
    if (ph === 'excitement' || ph === 'plateau') {
      if (this.profileId === 'noclimax' && this.demoT > 75) return 0;
      return 1;
    }
    if (ph === 'inevitability' || ph === 'orgasm') return 1;
    // A multiple-peak profile keeps going for one serial peak.
    if (ph === 'resolutionEarly' && this.profileId === 'multiple' && this.demoPeaks < 2) return 1;
    return 0;
  }

  _startTrain() {
    const q = clamp(this.p.q * (1 + (Math.random() * 2 - 1) * 0.15));
    const N = Math.round(3 + 12 * q), nReg = 3 + Math.floor(3 * q);
    const times = [], amps = [];
    let t = 0;
    for (let k = 1; k <= N; k++) {
      times.push(t);
      amps.push(k <= 2 ? 1 : Math.pow(0.82, k - 2));
      t += k < nReg ? 0.8 : 0.8 * Math.pow(this.p.growth, k + 1 - nReg);
    }
    const tail = Math.floor(Math.random() * (this.p.tail + 1));
    let tt = times[times.length - 1];
    for (let i = 0; i < tail; i++) {
      tt += 3 * (1 + (Math.random() * 2 - 1) * 0.25);
      times.push(tt); amps.push(0.1 + 0.1 * Math.random());
    }
    const sumA = amps.reduce((a, b) => a + b, 0);
    const Ares = 0.35 + 0.4 * (1 - this.p.I0);
    this.train = { times, amps, next: 0, t: 0, end: tt + 2, dA: Math.max(0, this.A - Ares) / sumA, q };
    this.pulses = { done: 0, total: N };
  }

  // One integration step in human time (dt ≤ 0.5 s).
  _integrate(dt, S) {
    const p = this.p, ph = this.phase;
    this.St = relax(this.St, S, dt, 1);
    this.X *= Math.exp(-dt / 20);
    const prevSt = this.St;
    // Ornstein–Uhlenbeck arousal waves (20 s correlation, sd 0.03).
    const g = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
    this.eta += -this.eta / C.etaTau * dt + C.etaSd * Math.sqrt(2 * dt / C.etaTau) * g;

    this.I = this._Iat(this.tHuman);
    const te = this.orgasmEnds[this.orgasmEnds.length - 1];
    this.H = te === undefined ? 0 : Math.exp(-(this.tHuman - te) / p.tauH);
    this.R = this._Rat(this.tHuman);
    const Q = Math.max(this.I, this.R);

    const Seff = this.St * (1 - this.I) * (1 - 0.9 * this.H);
    // Central arousal: self-amplifying, dual control, coupled to G, with slow waves.
    if (ph !== 'orgasm' && ph !== 'inevitability') {
      const tauA = C.tauA * p.tauAScale;
      const dA = (p.e * Seff * (1 + C.gamma * this.D) * (1 - this.A)
        - (C.lambda + p.s * this.X + C.aH * this.St * this.H) * this.A) / tauA
        + p.kappa * (this.G - this.A) / C.tauC;
      this.A = clamp(this.A + dA * dt, 0, 1 - this.I);
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

    // Dopaminergic drive (anticipation or responsive), suppressed by satiety; phasic burst at onset.
    if (S > 0.05 && prevSt < 0.05) this.phasic = 0.1;
    this.phasic *= Math.exp(-dt / 2);
    const Dstar = (1 - 0.85 * Q) * clamp(0.2 + 0.6 * (p.rho * this.St + (1 - p.rho) * this.A) + 0.2 * this.A);
    this.D = clamp(relax(this.D, Dstar, dt, C.tauD) + this.phasic * dt);

    // The sympathetic discharge at the climax is fast (τ 3 s), otherwise τ 10 s up / 60 s down.
    this.sigma = relax(this.sigma, 0.10 + 0.55 * this.Ah ** 2 + 0.35 * this.Omega, dt, this.Omega > 0.5 ? 3 : 10, 60);
    this.M = relax(this.M, Math.pow(this.A, 1.5) + 0.3 * this.Omega, dt, 30, 60);
    this.N = relax(this.N, this.sigma + 0.5 * this.Omega, dt, 30, 173);
    this.O += (1e-3 * this.A + 0.035 * this.Omega - this.O / C.tauO) * dt;
    this.Psi += (0.05 * this.Omega - this.Psi / C.tauPsi) * dt;
    this.V = relax(this.V, 0.6 * this.A * (1 - this.Omega), dt, 60, 600);
    const Fstar = p.f * smoothstep(0.6, 0.95, this.Aeff) + 0.2 * p.f * this.Omega;
    this.F = relax(this.F, Fstar, dt, 30, 300);
    this.Fpeak = this.F > this.Fpeak || this.F < 0.01 ? this.F : this.Fpeak;

    // Spinal generator envelope Ω and the contraction train.
    if (ph === 'inevitability') {
      this.Omega = clamp(this.phaseTh / C.inevitability);
    } else if (ph === 'orgasm' && this.train) {
      const tr = this.train;
      tr.t += dt;
      while (tr.next < tr.times.length && tr.t >= tr.times[tr.next]) {
        const a = tr.amps[tr.next];
        this.A = clamp(this.A - tr.dA * a);
        this.O += 0.03 * a;
        if (tr.next < this.pulses.total) this.pulses.done = tr.next + 1;
        this.events.push({ type: 'pulse', amp: a });
        tr.next++;
      }
      this.Omega = 1;
    } else {
      this.Omega *= Math.exp(-dt / 20);
    }
    this.tHuman += dt;
  }

  _transitions() {
    const ph = this.phase;
    const Seff = this.St * (1 - this.I) * (1 - 0.9 * this.H);
    if (ph === 'baseline' && Seff > 0.05) return this._enter('excitement');
    if (ph === 'excitement') {
      if (this.A >= C.plateauA) return this._enter('plateau');
      if (this.A < 0.03 && this.St < 0.02 && this.phaseTh > 20) return this._enter('baseline');
    }
    if (ph === 'plateau') {
      if (this.aboveTheta >= C.thetaHold && this.I < 0.08) {
        this.events.push({ type: 'ignite' });
        return this._enter('inevitability');
      }
      if (this.St < 0.05 && this.stimOffH >= 60 && this.A < 0.6) return this._enter('noClimax');
      if (this.A < 0.6 && this.St > 0.05) return this._enter('excitement');
    }
    if (ph === 'inevitability' && this.phaseTh >= C.inevitability) {
      this._startTrain();
      return this._enter('orgasm');
    }
    if (ph === 'orgasm' && this.train && this.train.t >= this.train.end) {
      this.orgasmEnds.push(this.tHuman);
      if (this.orgasmEnds.length > 4) this.orgasmEnds.shift();
      this.demoPeaks++;
      this.astroSinceEnd = 0;
      this.events.push({ type: 'end' });
      return this._enter('resolutionEarly');
    }
    if (ph === 'resolutionEarly') {
      if (Seff > 0.05 && this.I < 0.08 && this.A >= C.plateauA) return this._enter('plateau');
      if (this.phaseTh >= 300) return this._enter('resolutionLate');
    }
    if (ph === 'resolutionLate') {
      if (Seff > 0.05 && this.I < 0.08) return this._enter('excitement');
      if (this.tHuman - this.orgasmEnds[this.orgasmEnds.length - 1] >= 1800) return this._enter('recovery');
    }
    if (ph === 'recovery' && this.I < 0.08 && this.R < 0.2) {
      this.demoT = 0; this.demoPeaks = 0;
      return this._enter('baseline');
    }
    if (ph === 'noClimax' && this.A < 0.1 && this.phaseT > 6) {
      this.demoT = 0;
      return this._enter('baseline');
    }
  }

  // Advance by dt screen seconds. Returns the clock factors used this frame.
  update(dt) {
    const kh = this.kh.step(dt), ka = this.ka.step(dt);
    let S = this.mode === 'demo' ? this._demoStimulus(dt) : (this.held ? 1 : this.level);
    if (this.mode === 'demo') this.level = S;
    const human = dt * kh;
    const steps = Math.max(1, Math.ceil(human / 0.5));
    for (let i = 0; i < steps; i++) {
      this._integrate(human / steps, S);
      this.phaseTh += human / steps;
      this.aboveTheta = this.Aeff >= C.theta ? this.aboveTheta + human / steps : 0;
      this.stimOffH = S < 0.05 ? (this.stimOffH || 0) + human / steps : 0;
      this._transitions();
    }
    this.phaseT += dt;

    // Low-level AGN flicker during the build: Poisson bursts of 0.1–0.3 s, amplitude ∝ D·A⁴.
    this.flickerT -= dt;
    if (this.flickerT <= 0 && (this.phase === 'plateau' || this.phase === 'excitement')) {
      if (Math.random() < dt * 1.5 * this.D * this.A ** 4) { this.flicker = 1; this.flickerT = 0.1 + 0.2 * Math.random(); }
    }
    if (this.flickerT <= 0) this.flicker = 0;

    // The AGN envelope follows Ω up to the climax, then fades in astro time (e-folding 2 × 10⁴ yr).
    const years = dt * ka;
    if (this.phase === 'inevitability' || this.phase === 'orgasm') this.OmegaAstro = this.Omega;
    else this.OmegaAstro *= Math.exp(-years / 2e4);
    return { kh, ka, years };
  }

  vitals() {
    const lab = this.envelope === 'lab';
    const HRpk = lab ? 175 : 125, dSBP = lab ? 100 : 45;
    const h = clamp(0.3 * this.Ah + 0.7 * this.sigma);
    const hold = this.Omega > 0.8 && this.phase === 'orgasm' && (this.train?.t % 6) < 3;
    return {
      hr: 68 + (HRpk - 68) * h,
      rr: hold ? 0 : 14 + 22 * h,
      sys: 115 + dSBP * h,
      dia: 75 + 0.45 * dSBP * h,
    };
  }

  // Galaxy parameters (mapping table §8.1).
  galaxy() {
    const Q = Math.max(this.I, this.R);
    const ringGas = this.G * (1 - this.I);
    const b = 1 + 4 * this.Aeff ** 2 * (1 - Q);
    const burst = clamp(this.eta / 0.03, -1, 1);
    const Lpk = 0.1 + 0.4 * (this.train ? this.train.q : this.p.q);
    const rOut = 0.06 + 0.34 * Math.max(this.F, this.Fpeak);
    const fading = this.Fpeak > 0.02 && this.F < this.Fpeak * 0.98;
    const rIn = fading ? clamp(1 - this.F / this.Fpeak) * rOut : 0;   // centre-first fade
    return {
      ringSF: (0.05 * (1 - Q) + (b - 1) / 4 * clamp(ringGas * 1.4) * (1 + 0.2 * burst)),
      inflow: ringGas,
      laneOpacity: 0.3 + 1.2 * this.G,
      laneWidth: 0.012 - 0.006 * this.M,
      flowSpeed: 0.2 + this.G,
      nucFeed: this.D * this.G,
      agn: 1e-3 + 3e-3 * this.flicker * this.D * this.Aeff ** 4 + Lpk * this.OmegaAstro * (0.7 + 0.3 * Math.min(1, this.N)),
      jet: 0.2 * this.Omega,
      coneO: Math.min(1.3, this.O),
      relicTau: 2 + 6 * this.Psi,
      flush: [rIn, rOut, Math.min(1, this.F / 0.6)],
      trainOver: this.phase !== 'orgasm' && this.phase !== 'inevitability',
    };
  }

  neuro() {
    return { D: this.D, O: this.O, R: this.R, N: this.N, Psi: this.Psi, V: this.V, I: this.I };
  }
}
