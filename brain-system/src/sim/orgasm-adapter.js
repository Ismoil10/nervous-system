// Orgasm scenario adapter (research/ANALYSIS.md §11.14, B.4, B.13): wraps the legacy ResponseModel
// and DopamineModel so that the orgasm scenario runs inside the Brain System frame loop.
//
//   clock(dtS)            the SimClock delegate: the legacy LogRamp kh of this frame, verbatim
//   advance(dtS, t0H, h)  the legacy update() body over the clock's [t0H, t0H + h]: S from the
//                         demo script (screen dt) or the manual level, then advanceHuman(h, S)
//
// With all networks on, every ResponseModel and DopamineModel state equals the legacy update(dt)
// path at every human substep for the same frame times and seed (A.8 #21;
// test/orgasm-regression.test.mjs). After each substep the adapter steps the dopamine layer (the
// onStep wiring of main.js L90 moves here, B.5) and appends one command record
// { tH, cmdSym, cmdVag, cmdSacral, apnoea, omega } to `commands`, which the kernel's CV layer reads
// zero-order hold by tH (B.6). Outside the scenario both models stay at rest (B.13).
// Assumption (B.4 is silent on the ring API): CommandRing.sample(tH) returns the latest record with
// record.tH ≤ tH (or null), get(i) reads the i-th oldest record, and `written` counts every push.

import { PROFILES } from '../response.js';

export const PARAMS = {
  // Records kept. One frame needs ceil(h / 0.5 s) records: ≤ 1,080 at the 0.1-s frame clamp and the
  // largest legacy recovery kh (30 h / 20 s = 5,400); the rest is room for a kernel backlog (§11.14) [model].
  ringCapacity: 4096,
  // Phase ids for which `climax` is true (B.13; 'onset' after the DOPAMINE.md §9.8 port).
  climaxPhases: ['inevitability', 'orgasm', 'onset'],
  // Basal values while neuroendocrine is off: prolactin R and oxytocin O are relative surges, 0 at rest (§11.14).
  basalR: 0,
  basalO: 0,
};

const NETS = ['somatic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune'];   // A.3.1

// Fixed-capacity ring of command records in columns (no allocation per substep).
export class CommandRing {
  constructor(capacity = PARAMS.ringCapacity) {
    this.capacity = capacity;
    this.tH = new Float64Array(capacity);
    this.cmdSym = new Float64Array(capacity);
    this.cmdVag = new Float64Array(capacity);
    this.cmdSacral = new Float64Array(capacity);
    this.apnoea = new Uint8Array(capacity);
    this.omega = new Float64Array(capacity);
    this.head = 0;      // next write slot
    this.size = 0;      // records held
    this.written = 0;   // records ever pushed (a reader compares it to detect overruns)
  }

  clear() { this.head = 0; this.size = 0; }

  push(tH, cmdSym, cmdVag, cmdSacral, apnoea, omega) {
    const k = this.head;
    this.tH[k] = tH; this.cmdSym[k] = cmdSym; this.cmdVag[k] = cmdVag;
    this.cmdSacral[k] = cmdSacral; this.apnoea[k] = apnoea ? 1 : 0; this.omega[k] = omega;
    this.head = (k + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
    this.written++;
  }

  _slot(i) { return (this.head - this.size + i + this.capacity) % this.capacity; }

  // The i-th oldest record (0 ≤ i < size).
  get(i, out = {}) {
    const k = this._slot(i);
    out.tH = this.tH[k]; out.cmdSym = this.cmdSym[k]; out.cmdVag = this.cmdVag[k];
    out.cmdSacral = this.cmdSacral[k]; out.apnoea = this.apnoea[k] === 1; out.omega = this.omega[k];
    return out;
  }

  latest(out = {}) { return this.size ? this.get(this.size - 1, out) : null; }

  // Zero-order hold: the latest record with record.tH ≤ tH, or null if every record is later.
  sample(tH, out = {}) {
    if (!this.size || this.tH[this._slot(0)] > tH) return null;
    let lo = 0, hi = this.size - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.tH[this._slot(mid)] <= tH) lo = mid; else hi = mid - 1;
    }
    return this.get(lo, out);
  }
}

export class OrgasmAdapter {
  constructor(response, dopamine) {
    this.response = response;
    this.dopamine = dopamine;
    this.commands = new CommandRing();
    this.active = false;
    this.bodyMode = 'body';                                   // 'body' | 'brain' (A.3.1 master switch)
    this.nets = Object.fromEntries(NETS.map((id) => [id, true]));
    this.onSubstep = null;                                    // optional (h) => void after each substep
    this._t = 0;                                              // tH stamp of the next record
    this.clock = this.clock.bind(this);                       // handed to SimClock.delegate as a bare function
    response.onStep = (h) => this._substep(h);
  }

  // B.13: reset both models with the seeded stream and apply the scn-orgasm settings.
  start({ mode, profile, tref, hypothesis, seed = 1 } = {}) {
    const r = this.response, d = this.dopamine;
    r.setSeed(seed);
    r.reset();
    d.reset();
    if (profile) r.setProfile(profile);
    if (tref != null) r.setTref(tref);
    if (mode) r.setMode(mode);
    if (hypothesis) d.setHypothesis(hypothesis);
    this._applyBodyMode();
    this.commands.clear();
    this.active = true;
  }

  // B.13: manual mode, level 0, both models back at rest and dormant. The caller releases the
  // clock delegate (clock.delegate(null)).
  stop() {
    const r = this.response;
    this.active = false;
    r.setMode('manual');
    r.setLevel(0);
    r.reset();
    this.dopamine.reset();
    this.commands.clear();
  }

  // The SimClock delegate: the legacy LogRamp step of this frame (response.js update(), first line).
  clock(dtS) { return this.response.kh.step(dtS); }

  // The legacy update() body over [t0H, t0H + h]; dormant while the scenario is inactive.
  advance(dtS, t0H, h) {
    if (!this.active) return;
    const r = this.response;
    this._applyBodyMode();
    this._t = t0H;
    const S = r.stimulusFor(dtS);
    r.advanceHuman(h, S);
    r.phaseT += dtS;
    // Every frame writes at least one record; stamp the last one exactly at the frame's end time.
    if (this.commands.size) this.commands.tH[this.commands._slot(this.commands.size - 1)] = t0H + h;
  }

  get climax() { return this.active && PARAMS.climaxPhases.includes(this.response.phase); }

  // Master switch (A.5). Brain only runs the central form: the κ coupling of arousal to peripheral
  // vasocongestion is removed (§11.14). The kernel and HUD handle the body and the "—" readouts.
  setBodyMode(mode) {
    this.bodyMode = mode === 'brain' ? 'brain' : 'body';
    this._applyBodyMode();
  }

  // Network switch (A.5). Only neuroendocrine acts on the central models here (§11.14: prolactin and
  // oxytocin clamped at basal, which freezes the TIDA short loop); somatic and autonomic leave A, D
  // and dopamine unchanged and act through the kernel's CV layer.
  setNet(id, on) { if (id in this.nets) this.nets[id] = !!on; }

  // Vitals passed through from the legacy algebra while all networks are on (§11.14), named as
  // A.3.4; null in brain-only mode (A.8 #10).
  vitals() {
    if (this.bodyMode === 'brain') return null;
    const v = this.response.vitals();
    return { hr: v.hr, rr: v.rr, sbp: v.sys, dbp: v.dia };
  }

  _applyBodyMode() {
    const r = this.response;
    if (this.bodyMode === 'brain') r.p.kappa = 0;
    else if (r.p.kappa !== PROFILES[r.profileId].kappa) r.p.kappa = PROFILES[r.profileId].kappa;
  }

  _substep(h) {
    const r = this.response;
    if (!this.nets.neuroendocrine) { r.R = PARAMS.basalR; r.O = PARAMS.basalO; }
    this.dopamine.step(h, r);
    this._t += h;
    const d = r.drive();
    this.commands.push(this._t, d.h, d.h, r.G, d.hold, r.Omega);
    this.onSubstep?.(h);
  }
}
