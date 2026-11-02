// Psychophysiological dynamics of anger and their mapping onto galactic parameters.
//
// Basis (research/ANALYSIS.md, sections 4–5):
//  - anger arousal cycle: trigger -> escalation -> crisis -> recovery -> post-crisis depression -> calm;
//  - physiology: heart rate, blood pressure and adrenaline rise ("fight or flight");
//  - rises fast, falls slowly (adrenaline persists for minutes);
//  - excitation transfer (Zillmann): the residue of successive provocations accumulates.

export const PHASES = {
  calm: {
    name: 'Calm', dur: 11,
    desc: 'The galaxy is in equilibrium: the arms rotate steadily and the core breathes quietly.',
  },
  trigger: {
    name: 'Trigger', dur: 3.5,
    desc: 'Provocation: adrenaline is released, the heart rate quickens and rotation speeds up.',
  },
  escalation: {
    name: 'Escalation', dur: 15,
    desc: 'Anger is building: the arms tighten and wind more closely, and red H-alpha nebulae flare up.',
  },
  crisis: {
    name: 'Crisis — Outburst', dur: 7.5,
    desc: 'Control is lost: a shock-wave ring, supernovae and a red superwind erupting from the core.',
  },
  recovery: {
    name: 'Recovery', dur: 16,
    desc: 'Adrenaline breaks down slowly: everything decays exponentially, with occasional residual tremors.',
  },
  exhaustion: {
    name: 'Exhaustion', dur: 10,
    desc: 'Post-crisis depression: rotation slows down and star formation fades.',
  },
};

const ORDER = ['calm', 'trigger', 'escalation', 'crisis', 'recovery', 'exhaustion'];

function hash1(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x) {
  const i = Math.floor(x), t = x - i;
  const u = t * t * (3 - 2 * t);
  return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1;
}
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// "Lub-dub": the two-beat waveform of a heartbeat.
function heartbeat(phase) {
  const a = (phase - 0.02) / 0.045, b = (phase - 0.2) / 0.06;
  return Math.exp(-a * a) + 0.55 * Math.exp(-b * b);
}

export class AngerModel {
  constructor() {
    this.mode = 'auto';
    this.phaseIdx = 0;
    this.phaseTime = 0;
    this.value = 0.04;
    this.target = 0.04;
    this.manual = 0.1;
    this.residue = 0;
    this.fatigue = 0;
    this.peak = 0;
    this.time = 0;
    this.beatPhase = 0;
    this.pulse = 0;
    this.crisisArmed = true;
    this.events = [];
    this.history = new Float32Array(600);   // last 60 s, 0.1 s step
    this.histHead = 0;
    this.histAcc = 0;
  }

  get phase() { return ORDER[this.phaseIdx]; }
  get phaseInfo() { return PHASES[this.phase]; }
  get phaseProgress() { return Math.min(1, this.phaseTime / PHASES[this.phase].dur); }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'manual') {
      this.manual = this.value;
    } else {
      // When returning to auto mode, continue from the phase that matches the current state.
      this._enter(this.value > 0.45 ? 4 : 0);
    }
  }

  setManual(v) { this.manual = v; }

  provoke() {
    this.residue = Math.min(0.6, this.residue + 0.28);
    if (this.mode === 'auto') {
      const p = this.phase;
      if (p === 'calm' || p === 'recovery' || p === 'exhaustion') this._enter(1);
      else if (p === 'escalation' || p === 'trigger') this.phaseTime += 3;
    }
  }

  _enter(idx) {
    this.phaseIdx = idx;
    this.phaseTime = 0;
  }

  update(dt) {
    this.time += dt;
    this.residue *= Math.exp(-dt / 9);
    const n = noise1(this.time * 0.9) * 0.5 + noise1(this.time * 2.3 + 17) * 0.25;
    let target;
    if (this.mode === 'auto') {
      this.phaseTime += dt;
      const p = this.phaseProgress;
      switch (this.phase) {
        case 'calm': target = 0.04 + 0.025 * n; break;
        case 'trigger': target = 0.06 + 0.32 * smoothstep(0, 1, p) + 0.03 * n; break;
        case 'escalation': target = 0.38 + 0.54 * Math.pow(p, 1.25) + 0.09 * n * (0.4 + p); break;
        case 'crisis': target = 0.97 + 0.03 * n; break;
        case 'recovery': target = 0.06 + 0.88 * Math.exp(-3.2 * p) + 0.07 * Math.max(0, n) * (1 - p); break;
        default: target = 0.02; break;
      }
      target += this.residue * 0.5;
      if (this.phaseTime >= PHASES[this.phase].dur) this._enter((this.phaseIdx + 1) % ORDER.length);
      const fTarget = this.phase === 'exhaustion' ? smoothstep(0, 0.25, p) * (1 - smoothstep(0.7, 1, p)) : 0;
      this.fatigue += (fTarget - this.fatigue) * (1 - Math.exp(-dt / 1.5));
    } else {
      target = this.manual + this.residue + 0.02 * n;
      this.peak = Math.max(this.peak * Math.exp(-dt / 40), this.value);
      const fTarget = this.value < 0.25 && this.peak > 0.75 ? 0.85 : 0;
      this.fatigue += (fTarget - this.fatigue) * (1 - Math.exp(-dt / 3));
      if (fTarget === 0 && this.value < 0.1) this.peak *= Math.exp(-dt / 4);
    }
    this.target = Math.min(1, Math.max(0, target));

    // Asymmetric inertia: anger rises fast (τ ≈ 0.55 s) and fades slowly (τ ≈ 2.4 s).
    const prev = this.value;
    const tau = this.target > this.value ? 0.55 : 2.4;
    this.value += (this.target - this.value) * (1 - Math.exp(-dt / tau));
    this.trend = (this.value - prev) / Math.max(dt, 1e-3);

    // Crisis event (shock wave) — with hysteresis, once per crisis.
    if (this.crisisArmed && this.value > 0.9) {
      this.events.push('crisis');
      this.crisisArmed = false;
    } else if (!this.crisisArmed && this.value < 0.6) {
      this.crisisArmed = true;
    }
    if (this.mode === 'manual') this.phaseIdx = ORDER.indexOf(this._manualPhase());

    const p = this.params();
    this.beatPhase = (this.beatPhase + dt * p.bpm / 60) % 1;
    this.pulse = heartbeat(this.beatPhase);

    this.histAcc += dt;
    while (this.histAcc >= 0.1) {
      this.histAcc -= 0.1;
      this.history[this.histHead] = this.value;
      this.histHead = (this.histHead + 1) % this.history.length;
    }
  }

  _manualPhase() {
    const v = this.value, rising = this.trend > 0.02, falling = this.trend < -0.02;
    if (v >= 0.88) return 'crisis';
    if (v < 0.15) return this.fatigue > 0.3 ? 'exhaustion' : (rising ? 'trigger' : 'calm');
    if (falling) return 'recovery';
    return v < 0.4 ? 'trigger' : 'escalation';
  }

  // Anger level -> galactic parameters (ANALYSIS.md, section 5 table).
  params() {
    const A = this.value, F = this.fatigue;
    return {
      anger: A,
      fatigue: F,
      speed: (1 + 3.2 * Math.pow(A, 1.6)) * (1 - 0.45 * F),
      pitchDeg: 23 - 8 * A,
      contrast: 0.58 + 0.32 * A,
      heat: 1 + 2.2 * A * A,
      sf: (0.35 + 2.4 * Math.pow(A, 1.4)) * (1 - 0.6 * F),
      sfFrac: Math.min(1, 0.42 + 0.6 * A) * (1 - 0.5 * F),
      bpm: 64 + 88 * A - 8 * F,
      outflow: smoothstep(0.6, 0.95, A),
      snRate: 0.08 + 4.5 * A * A * A,
      coreFlare: 1 + 3 * A * A * A,
      shake: smoothstep(0.82, 1, A),
      exposure: 1 + 0.12 * A - 0.22 * F,
    };
  }
}
