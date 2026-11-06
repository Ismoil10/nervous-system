// @ts-check
// Patient monitor (research/HEART.md §7): the bedside-monitor panel of the simple HUD. Its channels,
// colours and alarm limits, the respiration trace, and the mapping from the simulation's vitals.
// Waveforms run in screen time like the heartbeat (heart.js): time compression never speeds them.
// DOM-free, so it also runs in Node tests.

// Channels in the conventional bedside colours: ECG green, arterial pressure red, respiration
// yellow, temperature white, blood values orange. Alarm limits are the common adult defaults; a
// value outside them is shown in the alarm colour (never flashing, §13.15).
export const MONITOR = {
  channels: {
    hr: { label: 'HR', unit: 'bpm', colour: '#4dff88', limits: [50, 120] },
    art: { label: 'ART', unit: 'mmHg', colour: '#ff5a5f', limits: [90, 160] },       // systolic limits
    // Fingertip plethysmograph trace and the pulse transit time (PULSE.md §10); SpO₂ from the model's
    // arterial saturation (Severinghaus 1979 on the kernel's PaO₂, research/LUNGS.md §4.2, §7.7).
    ptt: { label: 'PTT', unit: 'ms', colour: '#5ad8ff', limits: [0, 1000] },
    spo2: { label: 'SpO₂', unit: '%', colour: '#5ad8ff', limits: [90, 100] },
    rr: { label: 'RESP', unit: '/min', colour: '#ffe066', limits: [8, 25] },
    // Capnogram and end-tidal CO₂ from the kernel's PaCO₂ through the breath clock (LUNGS.md §4.3).
    co2: { label: 'CO₂', unit: 'mmHg', colour: '#e6e6e6', limits: [30, 50] },
    temp: { label: 'TEMP', unit: '°C', colour: '#e8f1ff', limits: [35.5, 38.0] },
    // Blood values from the model (endocrine.js units); in practice blood tests, not bedside sensors.
    adr: { label: 'ADR', unit: 'pg/mL', colour: '#ffb44d', limits: [0, 100] },      // plasma adrenaline, supine reference < ≈ 100
    cort: { label: 'CORT', unit: 'µg/dL', colour: '#ffb44d', limits: [5, 25] },     // plasma cortisol, daytime ≈ 5–25
  },
  alarmColour: '#ffcc00',
  resp: { rate: 50, seconds: 8, inspiration: 0.4, tauExp: 0.12, vtRest: 0.5 },   // trace samples/s, length, I share, expiry τ (× cycle), L
  // Capnogram trace (samples/s, length s, display range mmHg); SpO₂ reading: lung-to-finger delay and
  // the oximeter's averaging window, in simulated seconds (LUNGS.md §4.1) [model].
  co2: { rate: 50, seconds: 8, range: 50 },
  spo2: { delay: 20, average: 8 },
};

export const isAlarm = (key, v) => {
  const c = MONITOR.channels[key];
  return !!c && Number.isFinite(v) && (v < c.limits[0] || v > c.limits[1]);
};

// Values shown on the monitor, from Runtime.vitals() (HR from the beat model, so it matches the trace;
// PTT from the pulse model, pulse.js).
// gas = { spo2, etco2 }: the oximeter reading (SpO2Meter) and EtCO₂ (kernel, via the breath clock).
export function monitorValues(vitals, bpm, ptt = null, gas = null) {
  const v = vitals || {};
  const num = (x) => (Number.isFinite(x) ? x : null);
  return {
    hr: num(bpm), sys: num(v.sbp), dia: num(v.dbp), map: num(v.map), rr: num(v.rr), temp: num(v.tCore),
    adr: num(v.adrenaline), cort: num(v.cortisol), ptt: num(ptt), spo2: num(gas?.spo2), co2: num(gas?.etco2),
  };
}

// Respiration trace (impedance pneumography: chest expansion, inspiration up): a breath of the
// simulated rate and tidal volume, inspiration rising over `inspiration` of the cycle, expiration
// falling exponentially.
export class RespTrace {
  constructor() {
    const R = MONITOR.resp;
    this.phase = 0; this.rr = 14; this.vt = R.vtRest;
    this.trace = new Float32Array(R.rate * R.seconds);
    this.head = 0; this._acc = 0;
  }
  // Chest expansion (0–1 at the resting tidal volume) at phase φ ∈ [0, 1) of a breath.
  static shape(phi) {
    const R = MONITOR.resp;
    if (phi < R.inspiration) return 0.5 * (1 - Math.cos((Math.PI * phi) / R.inspiration));
    return Math.exp(-(phi - R.inspiration) / R.tauExp);
  }
  // With `volume` (L above FRC, from the breath clock, LUNGS.md §7.7) the trace draws the breath the
  // lungs draw, sighs and breath-holds included; without it, its own breath of rate rr and depth vt.
  step(dt, { rr = null, vt = null, kh = 1, paused = false, volume = null } = {}) {
    const R = MONITOR.resp;
    if (Number.isFinite(rr) && rr > 0) this.rr = rr;
    if (Number.isFinite(vt) && vt > 0) this.vt = vt;
    const d = paused ? 0 : dt * Math.min(1, Math.max(0, kh));
    this._acc += d * R.rate;
    while (this._acc >= 1) {
      this._acc -= 1;
      this.phase = (this.phase + this.rr / 60 / R.rate) % 1;
      this.trace[this.head] = Number.isFinite(volume) ? volume / R.vtRest : (this.vt / R.vtRest) * RespTrace.shape(this.phase);
      this.head = (this.head + 1) % this.trace.length;
    }
    return this;
  }
}

// Capnogram trace (LUNGS.md §4.3, §7.7): CO₂ at the mouth from the breath clock, 0–1 of the display
// range, in screen time like the other traces.
export class CapnoTrace {
  constructor() {
    const C = MONITOR.co2;
    this.trace = new Float32Array(C.rate * C.seconds);
    this.head = 0; this._acc = 0;
  }
  step(dt, co2, { kh = 1, paused = false } = {}) {
    const C = MONITOR.co2;
    const d = paused ? 0 : dt * Math.min(1, Math.max(0, kh));
    this._acc += d * C.rate;
    while (this._acc >= 1) {
      this._acc -= 1;
      this.trace[this.head] = Math.max(0, Number.isFinite(co2) ? co2 : 0) / C.range;
      this.head = (this.head + 1) % this.trace.length;
    }
    return this;
  }
}

// Pulse oximeter reading (LUNGS.md §4.1, §7.7): the model's arterial saturation reaches the finger
// after the lung-to-finger delay and is averaged over the oximeter's window (simulated seconds),
// shown as a whole per cent.
export class SpO2Meter {
  constructor() { this.t = []; this.v = []; }
  push(tH, sao2) {
    if (!Number.isFinite(tH) || !Number.isFinite(sao2)) return this;
    const n = this.t.length;
    if (n && tH < this.t[n - 1]) { this.t.length = 0; this.v.length = 0; }   // a reset or seek
    this.t.push(tH); this.v.push(sao2);
    const S = MONITOR.spo2, keep = tH - S.delay - S.average - 1;
    let i = 0;
    while (i < this.t.length - 1 && this.t[i] < keep) i++;
    if (i > 0) { this.t.splice(0, i); this.v.splice(0, i); }
    return this;
  }
  // The reading at tH: the mean over [tH − delay − average, tH − delay]; before enough history, the
  // oldest value.
  value(tH) {
    const n = this.t.length;
    if (!n) return null;
    const S = MONITOR.spo2, t1 = tH - S.delay, t0 = t1 - S.average;
    let a = 0, c = 0;
    for (let i = 0; i < n; i++) if (this.t[i] >= t0 && this.t[i] <= t1) { a += this.v[i]; c++; }
    const x = c ? a / c : this.v[0];
    return Math.round(Math.min(100, x));
  }
}
