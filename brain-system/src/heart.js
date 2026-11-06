// @ts-check
// Heart beat (research/HEART.md §3–§5). The physiology simulation (sim/autonomic.js, the legacy
// orgasm envelope) sets the rate, its beat-to-beat variation and the contractility; this module
// turns them into beats: the sinus pacemaker's firings, the intervals of each beat, the atrial and
// ventricular volume curves (Wiggers), a schematic ECG for the HUD, and the uniforms of the body
// shader (BODY_VS uHeart*). Pure and DOM-free, so it also runs in Node tests.

import { PART, CONDUCTION, HEART_SECTION } from './body/heart-form.js';
import { PARAMS as SP } from './shaders.js';

export const HEART = {
  rest: 68,                       // §7.5 resting HR
  beatMaxHr: 150,                 // §13.9: per-beat drawing up to 2.5 Hz; above, a steady glow
  steadyRange: 0.15,              // §13.9 steady glow ∝ HR/rest within ±15 %
  pDur: [0.09, 0.08],             // P wave (s); the shorter value at RR < 0.4 s
  pr: [0.12, 0.05],               // PR = 0.12 + 0.05·clamp((RR − 1/3)/(2/3), 0, 1.5)
  qrs: 0.09,
  qtc: 0.40,                      // Fridericia: QT = 0.40·RR^(1/3)
  atrial: [0.6, 0.10],            // atrial systole from 0.6·P for 0.10 s
  ivc: [0.02, 0.07],              // isovolumic contraction after the QRS onset (s)
  ivr: 0.06,                      // isovolumic relaxation (s)
  fill: [0.11, 0.70, 0.25],       // rapid filling: duration (s), share of the stroke, diastasis time constant (s)
  kick: 0.15,                     // share of the stroke added by the atrial kick at rest
  ef: [0.60, 0.25, 0.50, 0.78],   // EF = clamp(0.60 + 0.25·(contractility − 1), 0.50, 0.78)
  efRef: 0.60,                    // the shader's wall motion is scaled to the resting stroke
  contrFromSbp: 120,              // with the legacy envelope: contractility 1 + (SBP − 115)/120
  ecg: { rate: 250, seconds: 4 }, // HUD trace samples per second and its length (the ECG and the arterial trace)
  art: { rise: 0.08, late: 0.75, notch: [0.03, 0.10], floor: 0.05 },   // arterial pressure wave (HEART.md §3.4)
  maxStars: 3000,                 // heart stars sampled for the energy-conserving wave mean
  focusTau: 0.3,                  // s: the heart's focus (Heart view, or the camera close to the heart) eases in and out
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const gauss = (t, c, s) => { const d = (t - c) / s; return Math.exp(-0.5 * d * d); };

// Intervals of one beat from its RR (s): rate-dependent PR and QT (HEART.md §3.1).
export function intervals(rr) {
  const H = HEART;
  return {
    rr,
    pDur: rr < 0.4 ? H.pDur[1] : H.pDur[0],
    pr: H.pr[0] + H.pr[1] * clamp((rr - 1 / 3) / (2 / 3), 0, 1.5),
    qrs: H.qrs,
    qt: H.qtc * Math.cbrt(rr),
  };
}
export const ejectionFraction = (contractility) => clamp(HEART.ef[0] + HEART.ef[1] * (contractility - 1), HEART.ef[2], HEART.ef[3]);

// Ventricular volume (fraction of the resting end-diastolic volume) at tV s after a QRS onset, for a
// beat that starts from `edv` and ejects `ef` of it; `kick` adds the atrial contribution at the end.
export function ventricularVolume(tV, iv, ef, edv = 1) {
  const H = HEART, esv = edv * (1 - ef);
  const ej0 = H.ivc[1], ej1 = Math.max(ej0 + 0.08, iv.qt - 0.02), ivr = ej1 + H.ivr, f1 = ivr + H.fill[0];
  if (tV < ej0) return edv;
  if (tV < ej1) { const x = (tV - ej0) / (ej1 - ej0); return edv - edv * ef * (1 - (1 - x) ** 2); }
  if (tV < ivr) return esv;
  const passive = 1 - H.kick;   // passive filling reaches 1 − kick of the resting EDV (diastasis)
  const vf = esv + (passive - esv) * H.fill[1] / passive;
  if (tV < f1) { const x = (tV - ivr) / (f1 - ivr); return esv + (vf - esv) * (1 - (1 - x) ** 2); }
  return vf + (passive - vf) * (1 - Math.exp(-(tV - f1) / H.fill[2]));
}
export function ventricularTimes(iv) {
  const ej0 = HEART.ivc[1], ej1 = Math.max(ej0 + 0.08, iv.qt - 0.02);
  return { ej0, ej1 };
}

// Schematic lead-II ECG of one beat at time t after its SA firing (mV-like units; R ≈ 1).
export function ecgBeat(t, iv) {
  return 0.15 * gauss(t, iv.pDur / 2, iv.pDur / 5)
    - 0.12 * gauss(t, iv.pr + 0.008, 0.006)
    + 1.0 * gauss(t, iv.pr + 0.035, 0.009)
    - 0.25 * gauss(t, iv.pr + 0.06, 0.008)
    + 0.32 * gauss(t, iv.pr + iv.qt - 0.1, 0.045);
}

// Arterial pressure wave, normalised (0 diastolic … 1 systolic), x s after the aortic valve opens,
// for an ejection of ejDur s and a beat of rr s: a fast upstroke, a late-systolic decline, the
// dicrotic notch at valve closure, then a diastolic run-off that reaches the floor at the next beat.
export function arterialWave(x, ejDur, rr) {
  const A = HEART.art;
  if (x < 0) return A.floor;
  if (x < A.rise) return Math.sin((Math.PI / 2) * (x / A.rise));
  if (x < ejDur) return 1 - (1 - A.late) * (x - A.rise) / Math.max(1e-3, ejDur - A.rise);
  const n = x - ejDur;
  if (n < A.notch[0]) return A.late - A.notch[1] * Math.sin(Math.PI * n / A.notch[0]);
  const tail = Math.max(0.05, rr - ejDur - A.notch[0]);
  return A.late * Math.exp(-(n - A.notch[0]) * Math.log(A.late / A.floor) / tail);
}

export class HeartBeat {
  constructor() {
    this.t = 0;                         // beat time (s; screen time, slowed by kh < 1)
    this.beats = [];                    // the last beats: { t0, iv, ef, edv }
    this.hr = HEART.rest; this.bpm = HEART.rest; this.ef = HEART.ef[0];
    this.mode = 1; this.steady = 1; this.motion = 1; this.focus = 0; this.section = 0; this.detailed = true;
    this.stars = null;                  // sampled heart stars for the wave mean: { tau, gain, sigma, flux }
    this.ecg = new Float32Array(HEART.ecg.rate * HEART.ecg.seconds);
    this.abp = new Float32Array(this.ecg.length).fill(80);   // arterial pressure (mmHg), same clock as the ECG
    this.sbp = 115; this.dbp = 75;
    this.ecgHead = 0; this._ecgAcc = 0;
    this.T = new Float32Array(4); this.M = new Float32Array(4); this.K = new Float32Array([1, 1, 1, 0]);
    this.V = new Float32Array([1, 0, 1, 0]);   // AV valves open, semilunar open, diastole
    this._fire(0, HEART.rest);
  }

  _fire(t0, hrNow) {
    const iv = intervals(60 / clamp(hrNow, 30, 220));
    const prev = this.beats[this.beats.length - 1];
    // The new beat fills from wherever the previous beat's ventricles are at its QRS onset.
    let edv = 1;
    if (prev) {
      const tq = t0 + iv.pr - (prev.t0 + prev.iv.pr);
      const passive = ventricularVolume(tq, prev.iv, prev.ef, prev.edv);
      edv = Math.min(1, passive + HEART.kick);
    }
    this.beats.push({ t0, iv, ef: this.ef, edv });
    if (this.beats.length > 3) this.beats.shift();
  }

  // Heart stars from the body buffer (generate.js records: τ in float 4, part in 5, flux in 3). Two
  // samples: every heart star (Detailed) and the parts the Stars style draws (no fine anatomy, §8.5).
  setStars(points, floats, count, organClass = 1) {
    const sample = (keep) => {
      const tau = [], gain = [], sigma = [], flux = [];
      for (let i = 0; i < count; i++) {
        const o = i * floats, part = Math.round(points[o + 5]);
        if (points[o + 11] !== organClass || part < 1 || !keep(part)) continue;
        const c = CONDUCTION.has(part);
        tau.push(points[o + 4]); flux.push(points[o + 3]);
        gain.push(points[o + 4] < 0 ? 0 : SP.heart.glow[c ? 0 : 1]); sigma.push(SP.heart.sigma[c ? 0 : 1]);
      }
      const step = Math.max(1, Math.ceil(tau.length / HEART.maxStars));
      const pick = (a) => Float32Array.from(a.filter((_, i) => i % step === 0));
      return tau.length ? { tau: pick(tau), gain: pick(gain), sigma: pick(sigma), flux: pick(flux) } : null;
    };
    this.allStars = sample(() => true);
    this.earlierStars = sample((part) => part < PART.TRABECULA);
    this.stars = this.detailed ? this.allStars : this.earlierStars;
  }

  // Activation time (s after the SA firing) of a star at τ, for a beat with intervals iv (BODY_VS).
  static activation(tau, iv) {
    if (tau < 1) return tau * iv.pDur;
    if (tau < 2) return iv.pDur + (tau - 1) * Math.max(0, iv.pr - 0.03 - iv.pDur);
    return iv.pr - 0.03 + (tau - 2) * (iv.qrs + 0.03);
  }
  // Flux-weighted mean of the wave gain over the heart stars at time T into the beat.
  meanWave(T, iv) {
    const S = this.stars;
    if (!S) return 0;
    let num = 0, den = 0;
    for (let i = 0; i < S.tau.length; i++) {
      den += S.flux[i];
      if (S.gain[i] === 0) continue;
      const d = (T - HeartBeat.activation(S.tau[i], iv)) / S.sigma[i];
      if (d > -4 && d < 4) num += S.flux[i] * S.gain[i] * Math.exp(-d * d);
    }
    return den > 0 ? num / den : 0;
  }

  // One display frame. dt: screen seconds; hr: beat-averaged rate (bpm, null = rest); rsa: the
  // kernel's hrInst / hr; contractility; kh: the clock factor (time compression never speeds the beat).
  // focus: the heart's focus target 0–1 (true = 1); section: the heart opened (HEART.md §8.4);
  // detailed: the body style, which picks the stars the wave mean is taken over.
  step(dt, { hr = null, rsa = 1, contractility = 1, kh = 1, paused = false, reducedMotion = false, focus = false, sbp = null, dbp = null,
    section = false, detailed = this.detailed } = {}) {
    if (detailed !== this.detailed) { this.detailed = detailed; if (this.allStars !== undefined) this.stars = detailed ? this.allStars : this.earlierStars; }
    if (Number.isFinite(sbp) && Number.isFinite(dbp) && sbp > dbp) { this.sbp = sbp; this.dbp = dbp; }
    this.hr = Number.isFinite(hr) && hr > 0 ? hr : HEART.rest;
    const hrNow = this.hr * (Number.isFinite(rsa) && rsa > 0 ? rsa : 1);
    this.ef = ejectionFraction(contractility);
    const dtB = paused ? 0 : dt * Math.min(1, Math.max(0, kh));
    this.t += dtB;
    let cur = this.beats[this.beats.length - 1];
    while (this.t - cur.t0 >= cur.iv.rr) { this._fire(cur.t0 + cur.iv.rr, hrNow); cur = this.beats[this.beats.length - 1]; }
    this.bpm = Math.round(this.hr);

    // Atria follow the current beat; the ventricles the latest beat whose QRS has begun.
    const T = this.t - cur.t0, iv = cur.iv;
    const xa = (T - HEART.atrial[0] * iv.pDur) / HEART.atrial[1];
    const atrial = xa > 0 && xa < 1 ? Math.sin(Math.PI * xa) : 0;
    let vb = cur;
    for (let i = this.beats.length - 1; i >= 0; i--) { if (this.t >= this.beats[i].t0 + this.beats[i].iv.pr) { vb = this.beats[i]; break; } }
    const tV = this.t - (vb.t0 + vb.iv.pr);
    const V = tV >= 0 ? ventricularVolume(tV, vb.iv, vb.ef, vb.edv) : 1;
    const { ej0, ej1 } = ventricularTimes(vb.iv);
    const xr = (tV - ej0) / (ej1 - ej0);
    const root = xr > 0 && xr < 1 ? Math.sin(Math.PI * xr) : 0;
    // Valves (HEART.md §3.2): the atrioventricular valves close at the start of the isovolumic
    // contraction and open at the end of the isovolumic relaxation; the semilunar ones are open
    // during ejection. Each moves over ≈ 30 ms.
    const ramp = (x) => smooth(x / 0.03);
    const avOpen = tV < 0 ? 1 : 1 - ramp(tV - HEART.ivc[0]) + ramp(tV - (ej1 + HEART.ivr));
    const slOpen = tV < 0 ? 0 : ramp(tV - ej0) - ramp(tV - ej1);

    this.mode = hrNow <= HEART.beatMaxHr ? 1 : 0;
    this.steady = clamp(this.hr / HEART.rest, 1 - HEART.steadyRange, 1 + HEART.steadyRange);
    this.motion = reducedMotion ? 0 : 1;
    const ease = Number.isFinite(dt) && dt > 0 ? 1 - Math.exp(-dt / HEART.focusTau) : 0;
    this.focus += (clamp(+focus || 0, 0, 1) - this.focus) * ease;
    if (Math.abs(this.focus - (+focus || 0)) < 1e-3) this.focus = clamp(+focus || 0, 0, 1);
    const sStep = Number.isFinite(dt) && dt > 0 ? dt / HEART_SECTION.seconds : 0;
    this.section = clamp(this.section + (section ? sStep : -sStep), 0, 1);
    this.T[0] = T; this.T[1] = iv.pr; this.T[2] = iv.qrs; this.T[3] = iv.pDur;
    this.M[0] = atrial; this.M[1] = (1 - V) / HEART.efRef; this.M[2] = root; this.M[3] = this.mode ? this.meanWave(T, iv) : 0;
    this.K[0] = this.mode; this.K[1] = this.steady; this.K[2] = this.motion; this.K[3] = this.focus;
    this.V[0] = clamp(avOpen, 0, 1); this.V[1] = clamp(slOpen, 0, 1); this.V[2] = this.V[0]; this.V[3] = this.section;

    // ECG trace at a fixed sample rate in beat time.
    this._ecgAcc += dtB * HEART.ecg.rate;
    while (this._ecgAcc >= 1) {
      this._ecgAcc -= 1;
      const ts = this.t - this._ecgAcc / HEART.ecg.rate;
      let v = 0, a = HEART.art.floor;
      for (const b of this.beats) {
        if (ts < b.t0) continue;
        v += ecgBeat(ts - b.t0, b.iv);
        const { ej0, ej1 } = ventricularTimes(b.iv), xo = ts - (b.t0 + b.iv.pr + ej0);
        if (xo >= 0) a = arterialWave(xo, ej1 - ej0, b.iv.rr);
      }
      this.ecg[this.ecgHead] = v;
      this.abp[this.ecgHead] = this.dbp + (this.sbp - this.dbp) * (a - HEART.art.floor) / (1 - HEART.art.floor);
      this.ecgHead = (this.ecgHead + 1) % this.ecg.length;
    }
    return this;
  }
  uniforms() { return [this.T, this.M, this.K, this.V]; }
}

export { PART };
