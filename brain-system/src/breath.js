// @ts-check
// Breath clock (research/LUNGS.md §3, §7): one breath at a time, in screen time, from the kernel's
// respiration (rr, vt, the sigh rate, EtCO₂). It gives the lung volume above FRC, the diaphragm
// excursion and the rib-cage expansion for the breathing motion, the airflow front for the airway
// stars and the capnogram for the monitor, so the lungs, the RESP and CO₂ traces share one signal.
// Like the heartbeat (HEART.md §5) the breath runs at the model rate in screen seconds: time
// compression (kh > 1) never speeds it up, slow motion (kh < 1) slows it. DOM-free (Node tests).

export const BREATH = {
  ti: 0.4,              // Ti/Ttot (LUNGS.md §3.2; the RESP trace's inspiration share)
  tauExp: 0.12,         // expiratory decay, × cycle (as MONITOR.resp.tauExp)
  vd: 0.15,             // anatomical dead space, L, mouth to the terminal bronchioles (kernel PARAMS.resp.vd)
  // Diaphragm excursion e(ΔV) = 15 mm · (ΔV / 0.5 L)^0.85 (LUNGS.md §3.3, Boussuges et al. 2009 means).
  excursion: { mm: 15, v: 0.5, exp: 0.85 },
  // Rib-cage share of ΔV, 0.30 at rest rising to 0.45 at 3 L, spread over ≈ 1,760 cm² of chest wall
  // (LUNGS.md §3.4–3.5) [model].
  rib: { share0: 0.30, share1: 0.45, v1: 3.0, areaMm2: 1.76e5 },
  // Sighs (LUNGS.md §5.1): ≈ 2.5 × VT, the inspiration 1.6 × longer, then a post-sigh pause; the
  // sigh breath lasts 2.2 cycles in all [model].
  sigh: { vt: 2.5, ti: 1.6, cycles: 2.2 },
  // Capnogram (LUNGS.md §4.3): phase II spread ± 0.04 L about the dead space (Taylor dispersion),
  // phase III rising 2 mmHg to EtCO₂, the inspiratory downstroke over the first 5 % of inspiration.
  capno: { spread: 0.04, slope: 2, down: 0.05 },
  // Airflow front (LUNGS.md §7.4): a band of relative width 0.03 in the volume coordinate (≈ 1.2 mL,
  // a ring ≈ 5 mm deep in the trachea), followed by a dim trail `trail` σ behind it (towards where the
  // gas came from), so any stretch of airway longer than the band keeps its light (local energy
  // conservation; the trachea swings ≤ 8 %); the acini take the diffusion front over the 0.3 L beyond
  // the dead space.
  front: { sigmaRel: 0.03, sigmaMin: 0.001, trail: 1.5, acinar: 0.3 },
  minRate: 0.5,         // below this rate (1/min) the breath holds (apnoea, breath-hold)
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Diaphragm excursion (mm) for a volume ΔV (L) above FRC.
export function excursion(dv) {
  const E = BREATH.excursion;
  return dv > 0 ? E.mm * Math.pow(dv / E.v, E.exp) : 0;
}

// Outward rib-cage displacement (mm) for a volume ΔV (L) above FRC.
export function ribExpansion(dv) {
  const R = BREATH.rib;
  if (!(dv > 0)) return 0;
  const share = R.share0 + (R.share1 - R.share0) * clamp((dv - BREATH.excursion.v) / (R.v1 - BREATH.excursion.v), 0, 1);
  return (share * dv * 1e6) / R.areaMm2;
}

// Gain of the airflow band at volume coordinate s (L from the mouth) for a front at sf (L) moving in
// direction dir (+1 inspiration, −1 expiration): the bright band minus its trail; dir 0, the band alone.
export function frontBand(s, sf, dir = 0) {
  const F = BREATH.front, sg = Math.max(F.sigmaMin, F.sigmaRel * Math.max(s, sf));
  const g = (x) => { const d = (s - x) / sg; return Math.exp(-d * d); };
  return dir ? g(sf) - g(sf - dir * F.trail * sg) : g(sf);
}

// Flux-weighted mean of the band over the airway and acinus stars, for the energy-conserving gain
// 1 + G·b − G·M (as the pulse, PULSE.md §8). `hist` is { s: Float32Array (bin centres, L), w: weights }.
export function frontMean(hist, sf, dir = 0) {
  if (!hist || !hist.s.length) return 0;
  let a = 0, b = 0;
  for (let i = 0; i < hist.s.length; i++) { a += hist.w[i] * frontBand(hist.s[i], sf, dir); b += hist.w[i]; }
  return b > 0 ? a / b : 0;
}

// Seeded generator (mulberry32) for the sighs: deterministic per seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BreathClock {
  constructor({ seed = 1, vd = BREATH.vd } = {}) {
    this.rand = rng(seed);
    this.vd = vd;
    this.phase = 0;            // φ ∈ [0, 1) of the current breath
    this.period = 60 / 14;     // s, latched at the breath start
    this.vtNow = 0.5;          // L, this breath's tidal volume (a sigh's is larger)
    this.tiNow = BREATH.ti;    // this breath's inspiratory share
    this.tauNow = BREATH.tauExp;
    this.sigh = false;
    this.volume = 0;           // L above FRC
    this.flow = 0;             // L/s, + inspiration
    this.peak = 0;             // volume reached at the end of this inspiration
    this.co2 = 0;              // mmHg at the mouth (capnogram)
    this.co2Last = 0;          // last expiratory CO₂ (the start of the inspiratory downstroke)
    this.etco2 = 37;
    this.breaths = 0; this.sighs = 0;
    this.holding = false;
    this.rr = 14; this.vt = 0.5; this.sighRate = 12;
  }

  // Volume (fraction of this breath's VT) at phase φ.
  shape(phi) {
    if (phi < this.tiNow) return 0.5 * (1 - Math.cos((Math.PI * phi) / this.tiNow));
    return Math.exp(-(phi - this.tiNow) / this.tauNow);
  }

  _startBreath() {
    const rr = Math.max(this.rr, BREATH.minRate);
    const T = 60 / rr;
    // Sigh probability per breath = sighs per minute ÷ breaths per minute.
    const p = clamp(this.sighRate / 60 / rr, 0, 0.5);
    this.sigh = this.rand() < p;
    const S = BREATH.sigh;
    if (this.sigh) {
      this.sighs++;
      this.period = T * S.cycles;
      this.vtNow = this.vt * S.vt;
      this.tiNow = (BREATH.ti * S.ti) / S.cycles;
      this.tauNow = BREATH.tauExp / S.cycles;
    } else {
      this.period = T; this.vtNow = this.vt; this.tiNow = BREATH.ti; this.tauNow = BREATH.tauExp;
    }
    this.breaths++;
  }

  // Advance by dtS screen seconds. rr (1/min), vt (L), sighRate (1/h) and etco2 (mmHg) come from
  // the kernel; kh is the time compression (only kh < 1 slows the breath); paused stops it.
  step(dtS, { rr = null, vt = null, sighRate = null, etco2 = null, kh = 1, paused = false } = {}) {
    if (Number.isFinite(rr)) this.rr = Math.max(0, /** @type {number} */ (rr));
    if (Number.isFinite(vt) && /** @type {number} */ (vt) > 0) this.vt = /** @type {number} */ (vt);
    if (Number.isFinite(sighRate)) this.sighRate = Math.max(0, /** @type {number} */ (sighRate));
    if (Number.isFinite(etco2)) this.etco2 = /** @type {number} */ (etco2);
    const d = paused ? 0 : Math.max(0, dtS) * Math.min(1, Math.max(0, kh));
    this.holding = this.rr < BREATH.minRate;
    const v0 = this.volume;
    if (!this.holding && d > 0) {
      let phi = this.phase + d / this.period;
      while (phi >= 1) { phi -= 1; this._startBreath(); }
      this.phase = phi;
      this.volume = this.vtNow * this.shape(phi);
      if (phi < this.tiNow) this.peak = this.volume;
    }
    this.flow = d > 0 ? (this.volume - v0) / d : 0;
    this.co2 = this._capno();
    return this;
  }

  get inspiring() { return !this.holding && this.phase < this.tiNow; }
  // Direction of the gas: +1 in, −1 out, 0 while the breath is held.
  get direction() { return this.holding ? 0 : this.inspiring ? 1 : -1; }

  // Airflow front (LUNGS.md §7.4): the interface between inspired and alveolar gas, as a volume
  // coordinate from the mouth (L). Inspiration carries it in with the inspired volume (past the dead
  // space it becomes the acinar diffusion front); expiration carries it back out from the end of the
  // conducting airways, so it reaches the mouth once the dead space is exhaled.
  get front() {
    if (this.inspiring) return this.volume;
    const ex = this.peak - this.volume;
    return Math.min(this.peak, this.vd) - ex;
  }

  // CO₂ at the mouth (mmHg): phase I dead-space gas, phase II mixing, phase III the alveolar plateau
  // rising to EtCO₂, the downstroke at the start of inspiration (Bhavani-Shankar et al. 1992).
  _capno() {
    const C = BREATH.capno;
    if (this.holding) return 0;
    if (this.inspiring) {
      return this.co2Last * (1 - smooth(0, C.down, this.phase / Math.max(1e-6, this.tiNow)));
    }
    const ex = this.peak - this.volume, dead = Math.min(this.peak, this.vd);
    const x = (this.phase - this.tiNow) / Math.max(1e-6, 1 - this.tiNow);
    const v = smooth(dead - C.spread, dead + C.spread, ex) * (this.etco2 - C.slope * (1 - x));
    this.co2Last = v;
    return v;
  }

  // Display quantities for the shader (LUNGS.md §3.3–3.5): excursion and rib expansion, mm.
  get excursion() { return excursion(this.volume); }
  get ribs() { return ribExpansion(this.volume); }
}
