// Simulation clock (research/ANALYSIS.md A.4, §11.7, B.4): the sole owner of kh, the clock rate in
// human seconds per screen second. Sources in priority order: user lock › scenario delegate (the
// orgasm scenario's own clock, used verbatim and exempt from slew and range, §11.14, B.13) ›
// scenario keyframes (§12.4) › adaptive rule (A.4). Every other source moves kh in log space at no
// more than PARAMS.slew decades per screen second (a LogRamp, so log-time playback emerges), and a
// falling target (a keyframe window or an anticipated stimulus) is approached so that kh lands on
// it at its tH boundary (§11.7, §11.9). The CPU budget acts by time slicing: the kernel stops at a step boundary and
// the clock commits the tH it reached, which lowers the effective kh but never a step size (A.4).
// Assumptions (B.4 is silent): keyframe windows are relative to the tH at setKeyframes() (option
// originH); anticipate() takes optional k1 and hold-end arguments; commit() is ignored while the
// delegate holds the clock, because the adapter's tH is then the truth and the kernel carries its
// backlog (§11.14).

import { LogRamp } from './response.js';

export { LogRamp };

export const PARAMS = {
  khMin: 0.005,          // A.4: kh range, low end (human s per screen s)
  khMax: 3600,           // A.4: kh range, high end
  slew: 1,               // A.4: decades per screen second in log space
  khIdle: 1,             // adaptive target while no layer reports activity; ×1 is the 'autonomic' preset (A.4) [model]
  khAnticipate: 0.01,    // k1 of anticipate() when the caller passes none: the 'reflex' preset (A.4) [model]
  dtGuessS: 1 / 60,      // screen step assumed by the descent sum before the first frame (§11.7) [model]
};

// A.4 presets: human seconds per screen second.
export const PRESETS = { reflex: 0.01, pain: 0.1, autonomic: 1, gut: 10, endocrine: 60, immune: 900, circadian: 3600 };

const clampKh = (k) => Math.min(PARAMS.khMax, Math.max(PARAMS.khMin, k));

// Human seconds that pass while kh descends from k to k1 at the slew limit with screen step dtS:
// H_desc = Δt·Σ_{j=1..J} max(k1, k·10^(−j·s·Δt)), J = ⌈log10(k/k1)/(s·Δt)⌉ (§11.7). With dtS = 0 it
// returns the headless limit (k − k1)/(s·ln 10).
export function descentH(k, k1, dtS = PARAMS.dtGuessS, slew = PARAMS.slew) {
  if (!(k > k1) || !(k1 > 0)) return 0;
  if (!(dtS > 0)) return (k - k1) / (slew * Math.LN10);
  const d = slew * dtS;
  const J = Math.ceil(Math.log10(k / k1) / d);
  let H = 0;
  for (let j = 1; j <= J; j++) H += Math.max(k1, k * Math.pow(10, -j * d));
  return H * dtS;
}

// Screen seconds of a slew-limited change from k0 to k1 (the approach of a manual click, §11.7).
export function approachS(k0, k1, slew = PARAMS.slew) {
  return Math.abs(Math.log10(k0 / k1)) / slew;
}

// HUD formats (A.4: 't 23.0 ms  ×1/100'; precision is a B.1 [model] choice).
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function fmtNum(x) {
  if (x >= 100) return group(Math.round(x));
  return String(Number(x.toFixed(x >= 10 ? 1 : 2)));
}
export function formatRate(kh) {
  if (!(kh > 0)) return '×0';
  return kh >= 1 ? `×${fmtNum(kh)}` : `×1/${fmtNum(1 / kh)}`;
}
export function formatTime(t) {
  const a = Math.abs(t);
  if (a < 1) return `${(t * 1e3).toFixed(1)} ms`;
  if (a < 60) return `${t.toFixed(a < 10 ? 2 : 1)} s`;
  if (a < 3600) return `${(t / 60).toFixed(1)} min`;
  return `${(t / 3600).toFixed(2)} h`;
}

export class SimClock {
  constructor({ kh = PARAMS.khIdle, tH = 0 } = {}) {
    this.tH = tH;                 // human time (s)
    this.tS = 0;                  // screen time (s)
    this.kh = clampKh(kh);
    this.source = 'adaptive';     // 'user' | 'delegate' | 'scenario' | 'adaptive'
    this.ramp = new LogRamp(this.kh);
    this.locked = null;           // user lock (kh) or null
    this.keys = null;             // scenario keyframes { windows, originH, armed }
    this.delegateFn = null;       // (dtS) => kh, or null
    this.adaptive = PARAMS.khIdle;
    this.pending = [];            // anticipated onsets { tOnsetH, k1, holdH, armed }
    this.epochH = tH;             // origin of the time shown by label() (episode or scenario start)
    this.limited = false;         // the CPU budget held the kernel below the proposed tH
    this.khEff = this.kh;         // kh actually realised this frame (after commit)
    this.lastDtS = PARAMS.dtGuessS;
    this._t0H = tH; this._dtS = 0;
  }

  // User lock, priority 1 (A.4); null releases it.
  lock(kh) { this.locked = kh == null ? null : clampKh(kh); }
  lockPreset(name) { if (PRESETS[name]) this.lock(PRESETS[name]); }

  // Scenario keyframes, §12.2 `clockKeys` [{ tH0, tH1, kh }] with times relative to originH; null clears.
  setKeyframes(schedule, { originH = this.tH } = {}) {
    this.keys = schedule && schedule.length
      ? { windows: [...schedule].sort((a, b) => a.tH0 - b.tH0), originH, armed: -1 }
      : null;
  }

  // Exempt source used verbatim (orgasm scenario only, B.13); null releases it.
  delegate(fn) { this.delegateFn = typeof fn === 'function' ? fn : null; }

  // Target from the kernel's layer activity (A.4 adaptive rule).
  setAdaptiveTarget(kh) { this.adaptive = clampKh(kh); }

  // Pull kh down to k1 ahead of a stimulus at tOnsetH and hold it there until holdUntilH (A.4, §11.7, §11.9).
  anticipate(tOnsetH, k1 = PARAMS.khAnticipate, holdUntilH = tOnsetH) {
    this.pending.push({ tOnsetH, k1: clampKh(k1), holdH: Math.max(tOnsetH, holdUntilH), armed: false });
  }
  clearAnticipation() { this.pending.length = 0; }

  // Restart the time shown by label() (episode or scenario start).
  markEpoch(tH = this.tH) { this.epochH = tH; }

  // Keyframe target at tH, including the anticipated descent into the next falling window; null
  // when no window applies (the adaptive rule then decides).
  _keyTarget(tH, dtS) {
    const K = this.keys;
    if (!K) return null;
    const rel = tH - K.originH, ws = K.windows;
    let cur = null, nextIdx = -1;
    for (let i = 0; i < ws.length; i++) {
      if (rel >= ws[i].tH0 && rel < ws[i].tH1) cur = ws[i];
      else if (ws[i].tH0 > rel && nextIdx < 0) nextIdx = i;
    }
    if (nextIdx >= 0) {
      const next = ws[nextIdx];
      if (K.armed !== nextIdx && this._mustDescend(next.tH0 - rel, next.kh, dtS)) K.armed = nextIdx;
      if (K.armed === nextIdx && (!cur || next.kh < cur.kh)) return { kh: next.kh, onsetH: K.originH + next.tH0 };
    }
    return cur ? { kh: cur.kh, onsetH: null } : null;
  }

  _adaptiveTarget(tH, dtS) {
    let kh = this.adaptive, onsetH = null;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (tH >= p.holdH) { this.pending.splice(i, 1); continue; }
      if (!p.armed && this._mustDescend(p.tOnsetH - tH, p.k1, dtS)) p.armed = true;
      if (p.armed && p.k1 < kh) { kh = p.k1; onsetH = p.tOnsetH; }
    }
    return { kh, onsetH };
  }

  // True when a descent to k1 must start now: after one more frame at the current kh, the rest of
  // a slew-limited descent would end after the onset, R human seconds ahead (§11.7).
  _mustDescend(R, k1, dtS) {
    return k1 < this.kh && R - dtS * this.kh < descentH(this.kh, k1, 0);
  }

  // One frame of an anticipated descent toward k1, R human seconds before the onset: the kh
  // x ∈ [kh·10^(−s·dt), kh] for which dt·x + H(x) = R, re-solved every frame. H is the continuous
  // descent time (k − k1)/(s·ln 10), an upper bound of the stepwise sum H_desc for any frame time,
  // so frame-time jitter cannot make the descent late and the feedback removes the early-arrival
  // wait (§11.7, §11.9). A click whose onset was fixed with H_desc descends at the slew limit from
  // its first frame. Late or past onsets also descend at the slew limit.
  _descentStep(R, k1, dt) {
    const k = this.kh;
    if (!(dt > 0)) return k;
    const lo = Math.max(k1, k * Math.pow(10, -PARAMS.slew * dt));
    const f = (x) => dt * x + descentH(x, k1, 0);
    let x;
    if (!(R > 0) || f(lo) >= R) x = lo;
    else if (f(k) <= R) x = k;
    else {
      let a = Math.log10(lo), b = Math.log10(k);
      for (let i = 0; i < 48; i++) { const m = 0.5 * (a + b); if (f(10 ** m) > R) b = m; else a = m; }
      x = 10 ** a;
    }
    this.ramp = new LogRamp(x);
    return x;
  }

  // Advance one frame of dtS screen seconds; returns the human interval [t0H, t1H] = [t0H, t0H + h].
  advance(dtS, { cpuOver = false } = {}) {
    const dt = dtS > 0 ? dtS : 0;
    const t0H = this.tH;
    const dts = dt > 0 ? dt : this.lastDtS;
    // The delegate is stepped every frame, even under a user lock, so the scenario clock keeps its
    // own state; its value is used only without a lock.
    const dk = this.delegateFn ? this.delegateFn(dt) : null;
    let kh;
    if (this.locked == null && dk != null) {
      kh = dk;
      this.source = 'delegate';
      if (kh > 0) this.ramp = new LogRamp(kh);   // release continues from here at the slew limit
    } else {
      let target;
      if (this.locked != null) { target = { kh: this.locked, onsetH: null }; this.source = 'user'; }
      else {
        target = this._keyTarget(t0H, dts);
        if (target) this.source = 'scenario';
        else { target = this._adaptiveTarget(t0H, dts); this.source = 'adaptive'; }
      }
      if (target.onsetH != null && this.kh > target.kh) kh = this._descentStep(target.onsetH - t0H, target.kh, dt);
      else {
        this.ramp.set(target.kh, Math.abs(Math.log10(target.kh) - this.ramp.value) / PARAMS.slew);
        kh = this.ramp.step(dt);
      }
    }
    const h = dt * kh;                 // the same product as the legacy update(dt)
    this.kh = kh;
    this.tH = t0H + h;
    this.tS += dt;
    if (dt > 0) this.lastDtS = dt;
    this.limited = !!cpuOver;
    this.khEff = kh;
    this._t0H = t0H; this._dtS = dt;
    return { t0H, t1H: this.tH, h, kh, source: this.source };
  }

  // The delegate's own end of frame (B.13, DOPAMINE.md §9.3): after the DOPAMINE.md §9.8 port a
  // transition into ONSET runs the rest of the frame at the ONSET clock, so the scenario reaches
  // less human time than dt·kh and ends the frame at another kh. The adapter reports both; this
  // frame's tH and kh become the scenario's. Ignored unless the delegate holds the clock.
  settleDelegate(tReachedH, khEnd = this.kh) {
    if (this.source !== 'delegate') return this.tH;
    this.tH = Math.max(this._t0H, tReachedH);
    this.kh = this.khEff = khEnd;
    if (khEnd > 0) this.ramp = new LogRamp(khEnd);
    return this.tH;
  }

  // Time slicing (§11.7): commit the tH the kernel reached this frame. Returns the committed tH.
  commit(tReached) {
    if (this.source === 'delegate') return this.tH;
    const t = Math.min(this.tH, Math.max(this._t0H, tReached));
    if (t < this.tH) {
      this.tH = t;
      this.limited = true;
      this.khEff = this._dtS > 0 ? (t - this._t0H) / this._dtS : this.kh;
    }
    return this.tH;
  }

  // HUD line, e.g. 't 23.0 ms  ×1/100' (A.4).
  label() { return `t ${formatTime(this.tH - this.epochH)}  ${formatRate(this.kh)}`; }
}
