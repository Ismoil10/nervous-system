// @ts-check
// Arterial pulse (research/PULSE.md): the pressure wave each heartbeat sends from the aortic valve
// through the arterial tree. It reads the beat from heart.js (each beat's aortic valve opening,
// ejection and RR), the pressures and the rate from the vitals, scales the tree's arrival delays
// (body/vessel-tree.js) by the state's pulse wave velocity, and gives the body shader its uniform
// (BODY_VS uPulse) with the energy-conserving mean, and the patient monitor a fingertip
// plethysmograph trace and the pulse transit time. Pure and DOM-free, so it also runs in Node tests.

import { HEART, arterialWave, ventricularTimes } from './heart.js';
import { PARAMS as SP } from './shaders.js';
import { VPART, pulseSite } from './body/vessel-tree.js';

export const PULSE = {
  map0: 75 + 40 / 3,              // resting mean arterial pressure (mmHg) of 115/75 (PULSE.md §2)
  hr0: HEART.rest,                // resting rate (bpm)
  pp0: 40,                        // resting pulse pressure (mmHg) (§7)
  kMap: 0.008,                    // PWV +0.8 % per mmHg of MAP (§2)
  kHr: 0.003,                     // PWV +0.3 % per bpm (§2)
  kRange: [0.65, 1.1],            // clamp of the delay scale k
  gRange: [0.6, 1.6],             // clamp of the beat amplitude G = PP / PP₀ (§7)
  ppg: { tau: 0.06, sbf0: 0.25, exp: 0.8, range: [0.45, 1.4] },   // fingertip PPG low-pass (s); amplitude (sbf/sbf0)^exp (§7)
  rWave: 0.035,                   // the R peak after the QRS onset (heart.js ecgBeat)
  bin: 0.002, maxDelay: 0.5,      // delay histogram of all pulsing stars for the energy-conserving mean (s)
  noBeat: 10,                     // reduced time before the first valve opening (no wave)
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Delay scale k = PWV(rest) / PWV(state): shorter delays at higher mean pressure and rate (§2).
export function delayScale(sbp, dbp, hr) {
  const P = PULSE;
  if (!(Number.isFinite(sbp) && Number.isFinite(dbp) && sbp > dbp)) return 1;
  const map = dbp + (sbp - dbp) / 3, h = Number.isFinite(hr) ? hr : P.hr0;
  return clamp(1 / (1 + P.kMap * (map - P.map0) + P.kHr * (h - P.hr0)), P.kRange[0], P.kRange[1]);
}
// Beat amplitude G from the pulse pressure (§7).
export function pulseAmplitude(sbp, dbp) {
  if (!(Number.isFinite(sbp) && Number.isFinite(dbp) && sbp > dbp)) return 1;
  return clamp((sbp - dbp) / PULSE.pp0, PULSE.gRange[0], PULSE.gRange[1]);
}
// Brightening of a star of amplitude 1 at reduced time x after its arrival (BODY_VS, §8).
export function pulseKernel(x) {
  const P = SP.pulse, d = (x - P.x0) / P.sigma;
  return Math.abs(d) < P.cut ? P.gain * Math.exp(-d * d) : 0;
}

export class PulseWave {
  constructor() {
    this.tau = PULSE.noBeat;           // reduced time since the last aortic valve opening (s ÷ k)
    this.x = PULSE.noBeat;             // the same in beat time (s)
    this.k = 1; this.g = 0;
    this.mean = [0, 0];                // mean brightening of the tree and of the earlier great arteries
    this.u = new Float32Array(4);      // [τ, G, mean tree, mean earlier] (renderer.setPulse)
    this.stars = null;                 // pulsing stars as delay histograms: { tree, earlier } of { h (Σ w·A per bin), W (Σ w) }
    this.finger = pulseSite('finger').delay;   // aortic valve → index fingertip at rest (s)
    this.pleth = new Float32Array(HEART.ecg.rate * HEART.ecg.seconds);   // fingertip PPG, same clock as the ECG
    this.head = 0; this._lp = 0; this.ppgAmp = 1;
    this.ptt = Math.round(1000 * (ventricularTimes({ qt: 0.39 }).ej0 - PULSE.rWave + this.finger));
  }

  // Pulsing vessel stars from the body buffer (generate.js records: delay in float 4, part in 5,
  // amplitude in 6, flux in 3, class in 11).
  // Every pulsing star goes into a delay histogram (flux × part gain × amplitude per 2-ms bin), so the
  // mean is exact up to the bin width and costs one kernel per bin.
  setStars(points, floats, count, vesselClass = 8) {
    const n = Math.ceil(PULSE.maxDelay / PULSE.bin), mk = () => ({ h: new Float64Array(n), W: 0 });
    const sets = { tree: mk(), earlier: mk() };
    for (let i = 0; i < count; i++) {
      const o = i * floats;
      if (points[o + 11] !== vesselClass || !(points[o + 4] >= 0)) continue;
      const part = Math.round(points[o + 5]);
      const set = part === VPART.ARTERY || part === VPART.ARTERY_TWIG || part === VPART.PULM_ARTERY ? sets.tree : part === VPART.EARLIER_ARTERY ? sets.earlier : null;
      if (!set) continue;
      const w = points[o + 3] * (set === sets.tree ? SP.pulse.partGain[part - 1] : 1);
      set.h[Math.min(n - 1, Math.floor(points[o + 4] / PULSE.bin))] += w * points[o + 6];
      set.W += w;
    }
    this.stars = { tree: sets.tree.W > 0 ? sets.tree : null, earlier: sets.earlier.W > 0 ? sets.earlier : null };
  }

  // Flux-weighted mean brightening (per unit G) of a star set at reduced time tau.
  static meanAt(tau, S) {
    if (!S) return 0;
    let num = 0;
    for (let i = 0; i < S.h.length; i++) if (S.h[i]) num += S.h[i] * pulseKernel(tau - (i + 0.5) * PULSE.bin);
    return num / S.W;
  }

  // One display frame, after heart.step: the latest aortic valve opening, the state's delay scale and
  // amplitude, the means, and the new PPG samples on the ECG clock. sbf: the kernel's skin blood flow
  // (L/min), for the fingertip amplitude (vasoconstriction under stress).
  step(heart, { sbf = null } = {}) {
    this.k = delayScale(heart.sbp, heart.dbp, heart.hr);
    let x = null;
    for (let i = heart.beats.length - 1; i >= 0; i--) {
      const b = heart.beats[i], open = b.t0 + b.iv.pr + ventricularTimes(b.iv).ej0;
      if (heart.t >= open) { x = heart.t - open; break; }
    }
    this.x = x ?? PULSE.noBeat;
    this.tau = x === null ? PULSE.noBeat : x / this.k;
    this.g = x === null || !heart.mode ? 0 : pulseAmplitude(heart.sbp, heart.dbp);
    const S = this.stars;
    this.mean[0] = this.g ? PulseWave.meanAt(this.tau, S && S.tree) : 0;
    this.mean[1] = this.g ? PulseWave.meanAt(this.tau, S && S.earlier) : 0;
    this.u[0] = this.tau; this.u[1] = this.g; this.u[2] = this.mean[0]; this.u[3] = this.mean[1];

    // Fingertip PPG (PULSE.md §5, §10): the arterial wave at the finger's delay, low-passed into a
    // volume pulse, its amplitude following the skin blood flow.
    const Q = PULSE.ppg;
    if (Number.isFinite(sbf) && sbf > 0) this.ppgAmp = clamp((sbf / Q.sbf0) ** Q.exp, Q.range[0], Q.range[1]);
    this.ptt = Math.round(1000 * (ventricularTimes(heart.beats[heart.beats.length - 1].iv).ej0 - PULSE.rWave + this.k * this.finger));
    const len = this.pleth.length, rate = HEART.ecg.rate, n = Math.min(len, (heart.ecgHead - this.head + len) % len);
    const alpha = 1 - Math.exp(-1 / (rate * Q.tau)), floor = HEART.art.floor, lag = this.k * this.finger;
    for (let m = 0; m < n; m++) {
      const ts = heart.t - (heart._ecgAcc + (n - 1 - m)) / rate;
      let a = floor;
      for (const b of heart.beats) {
        const { ej0, ej1 } = ventricularTimes(b.iv), xo = ts - (b.t0 + b.iv.pr + ej0) - lag;
        if (xo >= 0) a = arterialWave(xo, ej1 - ej0, b.iv.rr);
      }
      this._lp += (a - this._lp) * alpha;
      this.pleth[this.head] = this.ppgAmp * Math.max(0, this._lp - floor) / (1 - floor);
      this.head = (this.head + 1) % len;
    }
    this.head = heart.ecgHead;
    return this;
  }
  uniforms() { return this.u; }
}
