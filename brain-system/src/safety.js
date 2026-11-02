// Photosensitivity limiter and display-rate rules (research/ANALYSIS.md §13.15, A.9).
//
// The canvas is divided into tiles of 88 CSS px; a window is 2 × 2 tiles (≈ the 0.006 sr flash
// area at 60 cm) and windows slide by one tile. Every frame each light source that can change
// (packets, organ glows, network fades, lanterns) is handed in with its projected rectangle or
// disc in CSS px and its requested luminance amplitude as a fraction of maximum relative
// luminance. The limiter computes each window's mean level and holds it inside two limits:
//   • transitions: a window may register at most 3 changes of ≥ 10 % of maximum in any 1 s;
//   • slew: a window changes by at most 10 % of maximum per ⅓ s.
// When a window would break a limit, the sources in it are scaled, the most recent first; a
// window that still cannot be held flags its sources for shimmer (the caller draws them steady).
// Sources of ≥ 1 % of the flash area are low-passed with τ 0.3 s, and the frame mean with τ 0.5 s.
// The cost depends on the number of windows and sources, never on point counts.

import { redRatio } from './color.js';

export const PARAMS = {
  maxTransitions: 3,        // §13.15 limiter: ≤ 3 transitions per s per window (W3C SC 2.3.1: ≤ 3 flashes per s)
  windowS: 1,               // §13.15 1 s luminance history per window
  flashDelta: 0.10,         // §13.15 general flash: opposing changes of ≥ 10 % of maximum relative luminance
  darkLimit: 0.80,          // §13.15 … with the darker state < 0.80
  slewDelta: 0.10,          // §13.15 large-area slew: ≤ 10 % of maximum …
  slewS: 1 / 3,             // §13.15 … per ⅓ s
  tauRegional: 0.3,         // §13.15 regional low-pass for sources ≥ 1 % of the flash area
  regionalMinArea: 0.01,    // §13.15 (fraction of the flash area)
  tauGlobal: 0.5,           // §13.15 global (frame-mean) low-pass
  globalDeadband: 0.002,    // [model] frame-mean change per frame exempt from the global low-pass (moving packets)
  tilePx: 88,               // §13.15 limiter grid: tiles of 88 CSS px, windows of 2 × 2 tiles sliding by one tile
  flashSr: 0.006,           // §13.15 flash area 0.006 sr = 25 % of a 10° field
  viewMm: 600,              // §13.15 viewing distance 60 cm
  cssPxPerIn: 96,           // §13.15
  fadeMin: 0.8,             // §13.15 toggle fade t = max(0.8 s, ΔL_max ÷ 0.3 s⁻¹)
  fadeRate: 0.3,            // §13.15
  ghost: 0.08,              // §13.15, A.5 ghost at 8 % flux
  heartSwing: 0.08,         // §13.9, A.9 heartbeat ≤ 8 % of maximum
  heartMaxKh: 1,            // §13.9 per-beat display only at kh ≤ 1 …
  heartMaxBpm: 150,         // §13.9 … and hr ≤ 150 bpm
  heartBand: 0.15,          // §13.9 otherwise a steady glow ∝ hr/rest within ±15 %, τ ≥ 2 s
  heartTau: 2,              // §13.9
  heartBeatMinS: 0.15,      // §13.9 beat shape: raised cosine ≥ 150 ms
  vasoMax: 0.15,            // §13.15 vasoconstriction dimming ≤ 15 % …
  vasoTau: 2,               // §13.15 … with τ ≥ 2 s
  dilationMax: 0.10,        // §13.7 dilation ≤ +10 %
  packetRate: 3,            // §13.15 packets ≤ 3 per s past any bundle point and per window
  pointHz: 2,               // §13.15 single points ≤ 2 Hz
  rhythmHz: 1,              // §13.9 rhythm rule: cycle-by-cycle only while f × kh ≤ 1 Hz
  lanternMinK: 2200,        // §13.15 lantern colour ≥ 2,200 K
  redRatioLantern: 0.75,    // §13.15 displayed lantern red ratio ≤ 0.75
  redRatioBody: 0.42,       // §13.5 body colours (maximum 0.411)
  redRatioTint: 0.50,       // §13.6 modulator tints (maximum 0.46)
  redFlashRatio: 0.8,       // §13.15 red flash: to or from R/(R+G+B) ≥ 0.8 …
  redFlashUV: 0.2,          // §13.15 … with a chromaticity change > 0.2 in CIE 1976 UCS
  reducedMotionGain: 0.5,   // §13.15 reduced motion halves shimmer and twinkle
  historyN: 128,            // [model] samples kept per window for the slew reference
};

const EPS = 1e-6;

// --- Stateless rules ---

// Toggle and overlay fade duration for a largest regional change ΔL (fraction of maximum).
export function fadeTime(dLmax) { return Math.max(PARAMS.fadeMin, Math.abs(dLmax) / PARAMS.fadeRate); }

// Rhythm rule (§13.9): draw cycle by cycle only while the screen frequency is ≤ 1 Hz.
export function rhythmMode(freqHz, kh) { return freqHz * kh <= PARAMS.rhythmHz ? 'cycle' : 'envelope'; }

// Heartbeat display (§13.9): per-beat swing only at kh ≤ 1 and hr ≤ 150, else a steady glow.
export function heartbeat({ kh, hr, rest = 68 }) {
  const perBeat = kh <= PARAMS.heartMaxKh && hr <= PARAMS.heartMaxBpm;
  return { perBeat, swing: perBeat ? PARAMS.heartSwing : 0, steady: Math.min(1 + PARAMS.heartBand, Math.max(1 - PARAMS.heartBand, hr / rest)), tau: PARAMS.heartTau };
}

// Vasoconstriction dimming of distal skin, low-passed (τ ≥ 2 s) and clamped (−10 % … +15 %).
export function vasoDim(current, target, dtS) {
  const t = Math.min(PARAMS.vasoMax, Math.max(-PARAMS.dilationMax, target));
  return current + (t - current) * (1 - Math.exp(-Math.max(0, dtS) / PARAMS.vasoTau));
}

export function lanternK(T) { return Math.max(PARAMS.lanternMinK, T); }

// CIE 1976 u′v′ of a linear sRGB colour.
export function uvPrime(rgb) {
  const [r, g, b] = rgb;
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const d = Math.max(1e-12, X + 15 * Y + 3 * Z);
  return [4 * X / d, 9 * Y / d];
}

// Red flash test between two displayed colours (§13.15).
export function isRedFlash(a, b) {
  const red = redRatio(a) >= PARAMS.redFlashRatio || redRatio(b) >= PARAMS.redFlashRatio;
  const [u1, v1] = uvPrime(a), [u2, v2] = uvPrime(b);
  return red && Math.hypot(u1 - u2, v1 - v2) > PARAMS.redFlashUV;
}

// Flash area in CSS px² (0.006 sr at 60 cm, 96 CSS px per inch): ≈ 176 × 176.
export function flashAreaPx({ viewMm = PARAMS.viewMm, cssPxPerIn = PARAMS.cssPxPerIn } = {}) {
  const pxPerMm = cssPxPerIn / 25.4;
  return PARAMS.flashSr * (viewMm * pxPerMm) ** 2;
}

// At most `max` events per `windowS` seconds per key (packets past a bundle point, point flashes).
export class RateGate {
  constructor(max = PARAMS.packetRate, windowS = 1) { this.max = max; this.windowS = windowS; this.events = new Map(); }
  allow(key, t) {
    let q = this.events.get(key);
    if (!q) { q = []; this.events.set(key, q); }
    while (q.length && q[0] <= t - this.windowS) q.shift();
    if (q.length >= this.max) return false;
    q.push(t);
    return true;
  }
  reset() { this.events.clear(); }
}

// --- Window state: zigzag transition counter (changes ≥ δ from the last extremum) and history ---
export class TransitionCounter {
  constructor(level = 0, delta = PARAMS.flashDelta) { this.ref = level; this.dir = 0; this.delta = delta; this.times = []; }
  // Would `level` register a transition? (darker state must be < darkLimit, §13.15)
  wouldRegister(level) {
    const d = this.delta;
    const dark = Math.min(level, this.ref) < PARAMS.darkLimit;
    if (!dark) return false;
    if (this.dir >= 0 && level <= this.ref - d) return true;
    if (this.dir <= 0 && level >= this.ref + d) return true;
    return false;
  }
  push(level, t) {
    const reg = this.wouldRegister(level);
    if (reg) { this.dir = level > this.ref ? 1 : -1; this.ref = level; this.times.push(t); }
    else if ((this.dir > 0 && level > this.ref) || (this.dir < 0 && level < this.ref)) this.ref = level;
    return reg;
  }
  count(t, windowS = PARAMS.windowS) {
    while (this.times.length && this.times[0] <= t - windowS + EPS) this.times.shift();
    return this.times.length;
  }
  // Levels that would not register a transition.
  band() {
    const d = this.delta - EPS;
    return [this.dir >= 0 ? this.ref - d : -Infinity, this.dir <= 0 ? this.ref + d : Infinity];
  }
}

class History {
  constructor(n, level) { this.t = new Float64Array(n).fill(-1e9); this.l = new Float32Array(n).fill(level); this.head = 0; this.n = n; this.t[0] = 0; this.count = 1; }
  push(t, l) {
    const last = this.t[this.head];
    if (t - last < PARAMS.slewS / 100 && this.count > 1) { this.l[this.head] = l; return; }   // keep spacing
    this.head = (this.head + 1) % this.n;
    this.t[this.head] = t;
    this.l[this.head] = l;
    this.count = Math.min(this.n, this.count + 1);
  }
  // Level at time t0 (linear interpolation; the oldest sample before the history starts).
  at(t0) {
    let i = this.head, newer = -1;
    for (let k = 0; k < this.count; k++) {
      if (this.t[i] <= t0) {
        if (newer < 0) return this.l[i];
        const a = this.t[i], b = this.t[newer];
        return this.l[i] + (this.l[newer] - this.l[i]) * ((t0 - a) / Math.max(1e-9, b - a));
      }
      newer = i;
      i = (i - 1 + this.n) % this.n;
    }
    return this.l[newer < 0 ? this.head : newer];
  }
  // [min, max] of the level over [t0, now], including the interpolated value at t0.
  span(t0) {
    let lo = this.at(t0), hi = lo, i = this.head;
    for (let k = 0; k < this.count && this.t[i] > t0; k++) {
      lo = Math.min(lo, this.l[i]);
      hi = Math.max(hi, this.l[i]);
      i = (i - 1 + this.n) % this.n;
    }
    return [lo, hi];
  }
}

export class PhotoLimiter {
  constructor({ width = 1280, height = 720, dpr = 1 } = {}) {
    this.t = 0;
    this.src = new Map();         // id → { a (applied amplitude), t0 (first seen) }
    this.factor = new Float32Array(0);
    this.applied = new Float32Array(0);
    this.shimmer = new Uint8Array(0);
    this.audit = { violations: 0, frames: 0 };
    this.resize(width, height, dpr);
  }

  get flashArea() { return flashAreaPx(); }

  resize(width, height, dpr = 1) {
    if (width === this.width && height === this.height && this.win) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = dpr;
    const T = PARAMS.tilePx;
    this.tx = Math.max(1, Math.ceil(this.width / T));
    this.ty = Math.max(1, Math.ceil(this.height / T));
    this.wx = Math.max(1, this.tx - 1);
    this.wy = Math.max(1, this.ty - 1);
    const n = this.wx * this.wy;
    this.base = new Float32Array(this.tx * this.ty);
    this.win = [];
    for (let j = 0; j < this.wy; j++) {
      for (let i = 0; i < this.wx; i++) {
        const x0 = i * T, y0 = j * T, x1 = Math.min(this.width, (i + 2) * T), y1 = Math.min(this.height, (j + 2) * T);
        this.win.push({ x0, y0, x1, y1, area: Math.max(1, (x1 - x0) * (y1 - y0)), level: 0,
          tc: new TransitionCounter(0), hist: new History(PARAMS.historyN, 0), src: [], gf: 0 });
      }
    }
    this.levels = new Float32Array(n);
    this.gMean = 0;
    this.gFilt = 0;
  }

  // Optional measured base luminance per tile (0–1), e.g. from the renderer's luminance monitor.
  setBase(tiles) { if (tiles && tiles.length === this.base.length) this.base.set(tiles); }

  _windowBase(w) {
    const T = PARAMS.tilePx;
    let s = 0;
    for (let ty = Math.floor(w.y0 / T); ty < Math.ceil(w.y1 / T); ty++) {
      for (let tx = Math.floor(w.x0 / T); tx < Math.ceil(w.x1 / T); tx++) {
        const ax = Math.min(w.x1, (tx + 1) * T) - Math.max(w.x0, tx * T);
        const ay = Math.min(w.y1, (ty + 1) * T) - Math.max(w.y0, ty * T);
        if (ax > 0 && ay > 0) s += this.base[ty * this.tx + tx] * ax * ay;
      }
    }
    return s / w.area;
  }

  // sources: [{ id, x, y, r } or { id, x, y, w, h }] in CSS px (centre), amp = requested luminance
  // amplitude (fraction of maximum relative luminance over the source's own area; may be negative
  // for dimming). Returns amplitude factors (applied / requested); `applied` and `shimmer` hold the
  // applied amplitudes and the shimmer flags, in the same order.
  scale(sources, dtS) {
    const dt = Math.max(0, dtS || 0);
    this.t += dt;
    const P = PARAMS, n = sources.length, W = this.win, T = P.tilePx, flash = this.flashArea;
    if (this.factor.length < n) {
      this.factor = new Float32Array(n);
      this.applied = new Float32Array(n);
      this.shimmer = new Uint8Array(n);
    }
    for (const w of W) w.src.length = 0;
    const req = new Float64Array(n), lo = new Float64Array(n), hi = new Float64Array(n), a = new Float64Array(n), prev = new Float64Array(n);
    const t0 = new Float64Array(n);
    const kReg = 1 - Math.exp(-dt / P.tauRegional);
    for (let s = 0; s < n; s++) {
      const q = sources[s];
      const hw = q.w !== undefined ? q.w / 2 : (q.r || 0) * Math.sqrt(Math.PI) / 2;   // a disc as the square of equal area
      const hh = q.h !== undefined ? q.h / 2 : hw;
      const area = 4 * hw * hh;
      let st = this.src.get(q.id);
      if (!st) { st = { a: 0, t0: this.t }; this.src.set(q.id, st); }
      st.seen = this.t;
      prev[s] = st.a;
      t0[s] = st.t0;
      let r = q.amp;
      if (area >= P.regionalMinArea * flash) r = st.a + (r - st.a) * kReg;
      req[s] = r;
      a[s] = r;
      lo[s] = Math.min(0, r, st.a);
      hi[s] = Math.max(0, r, st.a);
      // Overlap with every window it touches.
      const x0 = Math.max(0, q.x - hw), x1 = Math.min(this.width, q.x + hw);
      const y0 = Math.max(0, q.y - hh), y1 = Math.min(this.height, q.y + hh);
      if (x1 <= x0 || y1 <= y0) continue;
      const i0 = Math.max(0, Math.floor(x0 / T) - 1), i1 = Math.min(this.wx - 1, Math.floor(x1 / T));
      const j0 = Math.max(0, Math.floor(y0 / T) - 1), j1 = Math.min(this.wy - 1, Math.floor(y1 / T));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const w = W[j * this.wx + i];
          const ox = Math.min(x1, w.x1) - Math.max(x0, w.x0), oy = Math.min(y1, w.y1) - Math.max(y0, w.y0);
          if (ox > 0 && oy > 0) w.src.push(s, (ox * oy) / w.area);
        }
      }
    }
    // Newest sources are scaled first (§13.15).
    const newer = (x, y) => (t0[y] - t0[x]) || (y - x);

    const level = (w) => { let L = w.base; for (let k = 0; k < w.src.length; k += 2) L += a[w.src[k]] * w.src[k + 1]; return L; };
    const bands = [];
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      w.base = this._windowBase(w);
      // Any change within ⅓ s stays ≤ 10 %: the band [max − δ, min + δ] over the last ⅓ s always
      // contains the previous level, so holding every source is always allowed.
      const [mn, mx] = w.hist.span(this.t - P.slewS);
      let blo = mx - P.slewDelta + EPS, bhi = mn + P.slewDelta - EPS;
      w.capped = w.tc.count(this.t) >= P.maxTransitions;
      if (w.capped) { const [tl, th] = w.tc.band(); blo = Math.max(blo, tl); bhi = Math.min(bhi, th); }
      if (blo > bhi) blo = bhi = Math.min(Math.max(w.level, mx - P.slewDelta), mn + P.slewDelta);
      bands.push(blo, bhi);
      if (w.src.length > 2) {
        const pairs = [];
        for (let k = 0; k < w.src.length; k += 2) pairs.push([w.src[k], w.src[k + 1]]);
        pairs.sort((p, q) => newer(p[0], q[0]));
        w.src.length = 0;
        for (const [s, c] of pairs) w.src.push(s, c);
      }
    }
    const violation = (i, L) => L > bands[2 * i + 1] + 1e-9 || L < bands[2 * i] - 1e-9;
    // Scale the newest sources of each violating window until it fits (a few relaxation passes).
    for (let pass = 0; pass < 6; pass++) {
      let any = false;
      for (let i = 0; i < W.length; i++) {
        const w = W[i];
        const L = level(w);
        if (!violation(i, L)) continue;
        any = true;
        let E = L > bands[2 * i + 1] ? L - bands[2 * i + 1] : L - bands[2 * i];
        for (let k = 0; k < w.src.length && Math.abs(E) > 1e-12; k += 2) {
          const s = w.src[k], c = w.src[k + 1];
          const room = E > 0 ? a[s] - lo[s] : hi[s] - a[s];
          if (room <= 0) continue;
          const da = Math.min(room, Math.abs(E) / c);
          a[s] += E > 0 ? -da : da;
          E -= Math.sign(E) * da * c;
        }
      }
      if (!any) break;
    }
    // Windows that still break a limit hold every source at its previous amplitude and flag shimmer.
    const sh = this.shimmer;
    sh.fill(0, 0, n);
    for (let guard = 0; guard < 8; guard++) {
      let changed = false;
      for (let i = 0; i < W.length; i++) {
        const w = W[i];
        if (!violation(i, level(w))) continue;
        for (let k = 0; k < w.src.length; k += 2) {
          const s = w.src[k];
          if (Math.abs(a[s] - prev[s]) > 1e-12 || !sh[s]) changed = true;
          a[s] = Math.min(hi[s], Math.max(lo[s], prev[s]));
          sh[s] = 1;
        }
      }
      if (!changed) break;
    }
    // Global (frame-mean) low-pass with a small dead band.
    let G = 0;
    for (const w of W) G += level(w);
    G /= W.length;
    const gTarget = this.gFilt + (G - this.gFilt) * (1 - Math.exp(-dt / P.tauGlobal));
    const allowed = Math.max(Math.abs(gTarget - this.gMean), P.globalDeadband);
    if (Math.abs(G - this.gMean) > allowed) {
      const kg = allowed / Math.abs(G - this.gMean);
      for (let s = 0; s < n; s++) a[s] = prev[s] + (a[s] - prev[s]) * kg;
      G = this.gMean + (G - this.gMean) * kg;
    }
    this.gFilt = gTarget;
    this.gMean = G;
    // Commit.
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      w.level = level(w);
      this.levels[i] = w.level;
      w.tc.push(w.level, this.t);
      w.hist.push(this.t, w.level);
    }
    for (let s = 0; s < n; s++) {
      const q = sources[s];
      this.src.get(q.id).a = a[s];
      this.applied[s] = a[s];
      this.factor[s] = Math.abs(q.amp) > 1e-9 ? a[s] / q.amp : 1;
    }
    for (const [id, st] of this.src) if (st.seen !== this.t) this.src.delete(id);
    return this.factor.subarray(0, n);
  }

  // Audit of a measured luminance image (luminance monitor, `?safetyMonitor=1`): relative luminance
  // per pixel (0–1, already tone-mapped), w × h covering the canvas. Counts window violations.
  observe(lum, w, h, dtS) {
    const P = PARAMS;
    this.audit.frames++;
    if (!this._obs || this._obs.length !== this.win.length) {
      this._obs = this.win.map(() => ({ tc: new TransitionCounter(0), hist: new History(P.historyN, 0), t: 0 }));
      this._obsT = 0;
    }
    this._obsT += Math.max(0, dtS || 0);
    const sx = w / this.width, sy = h / this.height;
    this.win.forEach((win, i) => {
      const o = this._obs[i];
      let s = 0, c = 0;
      for (let y = Math.floor(win.y0 * sy); y < Math.max(Math.floor(win.y0 * sy) + 1, Math.ceil(win.y1 * sy)) && y < h; y++) {
        for (let x = Math.floor(win.x0 * sx); x < Math.max(Math.floor(win.x0 * sx) + 1, Math.ceil(win.x1 * sx)) && x < w; x++) { s += lum[y * w + x]; c++; }
      }
      const L = c ? s / c : 0;
      const old = o.hist.at(this._obsT - P.slewS);
      if (Math.abs(L - old) > P.slewDelta + 1e-3) this.audit.violations++;
      if (o.tc.push(L, this._obsT) && o.tc.count(this._obsT) > P.maxTransitions) this.audit.violations++;
      o.hist.push(this._obsT, L);
    });
    return this.audit;
  }
}
