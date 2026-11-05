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
    // Fingertip plethysmograph trace and the pulse transit time (PULSE.md §10); no SpO₂ (not modelled).
    ptt: { label: 'PTT', unit: 'ms', colour: '#5ad8ff', limits: [0, 1000] },
    rr: { label: 'RESP', unit: '/min', colour: '#ffe066', limits: [8, 25] },
    temp: { label: 'TEMP', unit: '°C', colour: '#e8f1ff', limits: [35.5, 38.0] },
    // Blood values from the model (endocrine.js units); in practice blood tests, not bedside sensors.
    adr: { label: 'ADR', unit: 'pg/mL', colour: '#ffb44d', limits: [0, 100] },      // plasma adrenaline, supine reference < ≈ 100
    cort: { label: 'CORT', unit: 'µg/dL', colour: '#ffb44d', limits: [5, 25] },     // plasma cortisol, daytime ≈ 5–25
  },
  alarmColour: '#ffcc00',
  resp: { rate: 50, seconds: 8, inspiration: 0.4, tauExp: 0.12, vtRest: 0.5 },   // trace samples/s, length, I share, expiry τ (× cycle), L
};

export const isAlarm = (key, v) => {
  const c = MONITOR.channels[key];
  return !!c && Number.isFinite(v) && (v < c.limits[0] || v > c.limits[1]);
};

// Values shown on the monitor, from Runtime.vitals() (HR from the beat model, so it matches the trace;
// PTT from the pulse model, pulse.js).
export function monitorValues(vitals, bpm, ptt = null) {
  const v = vitals || {};
  const num = (x) => (Number.isFinite(x) ? x : null);
  return {
    hr: num(bpm), sys: num(v.sbp), dia: num(v.dbp), map: num(v.map), rr: num(v.rr), temp: num(v.tCore),
    adr: num(v.adrenaline), cort: num(v.cortisol), ptt: num(ptt),
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
  step(dt, { rr = null, vt = null, kh = 1, paused = false } = {}) {
    const R = MONITOR.resp;
    if (Number.isFinite(rr) && rr > 0) this.rr = rr;
    if (Number.isFinite(vt) && vt > 0) this.vt = vt;
    const d = paused ? 0 : dt * Math.min(1, Math.max(0, kh));
    this._acc += d * R.rate;
    while (this._acc >= 1) {
      this._acc -= 1;
      this.phase = (this.phase + this.rr / 60 / R.rate) % 1;
      this.trace[this.head] = (this.vt / R.vtRest) * RespTrace.shape(this.phase);
      this.head = (this.head + 1) % this.trace.length;
    }
    return this;
  }
}
