// @ts-check
// Sensory plugin (research/ANALYSIS.md §5; filter forms §4.7, Naka–Rushton §4.8, psychophysics §4.10;
// stimulus pipeline §11.9; B.4): receptor transduction, adaptation and the perceived magnitude `psi`.
// Plugin contract: graph.js header. Scope 'brain', order 10, so its fragment sees the brain ports.
//
//   drive      x = ((I − I0)/I0)^(a/n) · envelope(t)               a = the mode's Stevens exponent (§4.10)
//   adapt      τA·dA/dt = x − A  (A = mean of the time scales, exact exponential step)        §4.7
//              SA: u = max(0, x − kA·A)      RA: u = |x − A|
//   output     r = r0 + (rmax − r0) · u^n / (u^n + x50^n),  x50 at the geometric centre of [I0, Imax]  §4.8, §5.1
//   canal      c = ω − LP_τHP(ω) (afferent high-pass, τ 5 s); velocity storage at vestNuc
//              ds/dt = −s/τVS + (1/τHP − 1/τVS)·c, so c + s decays with τVS = 15 s (A.8 #15)
//              r = r0 ± gain·c (push–pull for yaw)
//   psi        ((I − I0)/I0)^a on the mode's continuum (k = I0^(−a)) [model]; psiN = log10(1 + psi) /
//              log10(1 + psi(Imax)), the perceived magnitude on the modality range used by salience (§3.12) [model]
//
// Special senses (vision, hearing, balance, smell, taste) have receptor nodes in this fragment (owner
// 'special', so they run in brain-only mode, A.5) wired to their brain ports. Body senses (touch, pain,
// temperature, proprioception) are declared in stimuli.js RECEPTORS: a body fragment that adds nodes
// { kind: 'receptor', site, cls, side } is driven by the same code without changes here.

import { mirror } from './graph.js';
import { RECEPTORS, SPECIAL_CLASSES, SENSES, SENSE_IDS, SENSE_ORGANS, continuum, classIntensity, tRec, salienceClass, resolveSite, psiExponent } from './stimuli.js';

export const PARAMS = {
  receptorTau: 0.0005,      // s, receptor output stage after the adaptation filter (Table 4.13a)
  // s; shortest receptor drive. A click (0.1 ms) is shorter than the 0.5-ms NF step; its auditory-nerve
  // response lasts several ms (cochlear filter ringing and the onset burst), 5 ms [model].
  minDuration: 0.005,
  rise: { smell: 0.01, taste: 0.01, balance: 0.1 },   // s, onset/offset ramps of sniff, sip and linear/tilt stimuli [model]
  rotationRamp: 1,          // s, ramp to the peak angular velocity (A.6)
  rotationStop: 0.1,        // s, deceleration at the stop [model]
  verticalCanal: 0.5,       // pitch/roll: both sides, relative gain [model]
  raDoneFrac: 1e-3,         // an RA record ends when A < 1e-3 of its peak drive [model]
  canalDoneDegS: 0.5,       // deg/s; a canal record ends below the yaw threshold (§5.9: 0.5–1.5) [model]
  vsWeight: 2,              // velocity-storage drive on vestNuc in units of canal Δa (= the canal port weight) [model]
};

// --- psi (§4.10, §5.13) ---
export function psi(rec) {
  const { I, I0, Imax, a } = continuum(rec);
  if (!(I > I0) || !Number.isFinite(I0)) return { psi: 0, psiN: 0 };
  const p = ((I - I0) / I0) ** a, pMax = ((Imax - I0) / I0) ** a;
  return { psi: p, psiN: Math.min(1, Math.log10(1 + p) / Math.log10(1 + pMax)) };
}

// Steady receptor output for drive x (no adaptation), for tests and the HUD readout.
export function receptorRate(cls, I, a = 1) {
  const C = RECEPTORS[cls];
  if (!(I > C.I0)) return C.rSpont;
  const x = ((I - C.I0) / C.I0) ** (a / C.n), x50 = ((Math.sqrt(C.I0 * C.Imax) - C.I0) / C.I0) ** (a / C.n);
  return C.rSpont + (C.rmax - C.rSpont) * x ** C.n / (x ** C.n + x50 ** C.n);
}

// --- Fragment: receptor nodes of the special senses and their nerves (§5.2–§5.9, §2.3) ---
// Velocities: optic nerve 8 m/s (Table 4.4b); VIII afferent 20 m/s [model] (Table 4.11 startle row);
// olfactory fila C 1.0 m/s; gustatory afferents Aδ 15 m/s [model]. The first central synapse sits on
// the port → nucleus edge (§3.14), so the nerve edge has nSyn 0.
const NERVE_V = { retina: { tract: 'optic' }, cochlea: { v: 20 }, vestLabyrinth: { v: 20 } };
function fragment() {
  const nodes = [], edges = [], paths = {};
  for (const site of Object.keys(SENSE_ORGANS)) {
    const org = SENSE_ORGANS[site];
    for (const side of ['R', 'L']) {
      const pathId = `nerve.${site}.${side}`;
      paths[pathId] = side === 'R' ? org.route.map((p) => [...p]) : org.route.map(mirror);
      for (const cls of SPECIAL_CLASSES) {
        const C = RECEPTORS[cls];
        const sites = Array.isArray(C.site) ? C.site : [C.site];
        if (!sites.includes(site)) continue;
        const id = `rec.${site}.${cls}.${side}`;
        nodes.push({ id, kind: 'receptor', owner: 'special', pos: side === 'R' ? [...org.pos] : mirror(org.pos), side, site, cls,
          tau: PARAMS.receptorTau, rmax: C.rmax, rSpont: C.rSpont, xfer: 'direct', label: `${site} ${cls}` });
        const nv = NERVE_V[site] ?? {};
        edges.push({ from: id, to: `${org.port}.${side}`, kind: 'axon', fibre: C.fibre ?? 'cns', path: pathId, nSyn: 0, w: C.w,
          ...(nv.tract ? { tract: nv.tract } : {}), ...(nv.v ? { v: nv.v } : {}), transmitter: 'Glu', label: `${org.nerve} (${cls})` });
      }
    }
  }
  return { nodes, edges, paths };
}

// --- Instance ---
class Sensory {
  constructor(k) {
    this.k = k;
    this.rec = k.graph.nodes.filter((n) => n.kind === 'receptor' && n.cls in RECEPTORS)
      .map((n) => ({ i: n.i, id: n.id, cls: n.cls, site: n.site, side: n.side, body: n.body, j: -1 }));
    const n = this.rec.length;
    this.vPsi = k.declare('psi', 0, { unit: 'a.u.' });
    this.vPsiN = k.declare('psiN', 0);
    k.declareArray('sens.A', 2 * Math.max(1, n), 0);     // adaptation states, two time scales per receptor
    k.declareArray('sens.tA', Math.max(1, n), 0);        // tH of the last adaptation update per receptor
    k.declareStore('sensory', () => ({ active: [] }));
    k.onStimulus((rec) => this.onStimulus(rec));
    k.on('somatic.contactBroken', (p) => this.onContactBroken(p));
    k.onLayer('NF', (t, h) => this.step(t, h));
  }

  init(k) {
    for (const r of this.rec) r.j = k.nfIndex(r.id);
    this.vest = { R: k.nfIndex('vestNuc.R'), L: k.nfIndex('vestNuc.L') };
    this.A = k.array('sens.A');
    this.tA = k.array('sens.tA');
    this.st = k.stores.sensory;
  }

  onStimulus(rec) {
    const k = this.k, t = rec.tOnset, st = this.st;
    const S = SENSES[rec.sense];
    if (!S || !S.modes[rec.mode]) { k.log({ kind: 'stimulus-invalid', node: rec.site ?? null, label: `${rec.sense} ${rec.mode}` }); return; }
    const res = resolveSite(rec.site, { sense: rec.sense, mode: rec.mode, side: rec.side, bodyMode: k.bodyMode });
    const a = psiExponent(rec);
    let driven = 0, tStart = Infinity;
    if (res) for (let ri = 0; ri < this.rec.length; ri++) {
      const r = this.rec[ri];
      if (r.site !== rec.site || !res.sides.includes(r.side ?? null) || r.j < 0) continue;
      if (r.body && !k.bodyOn) continue;
      const C = RECEPTORS[r.cls], I = classIntensity(r.cls, rec);
      if (I === null || (C.form === 'canal' ? I === 0 : !(I > C.I0))) continue;
      const t0 = t + tRec(r.cls, rec), dur = Math.max(PARAMS.minDuration, rec.durationMs / 1000);
      if (!Number.isFinite(t0)) continue;   // contact heat that never reaches the terminal threshold (§11.9)
      const rise = rec.sense === 'hearing' ? (rec.params?.riseMs ?? 0) / 1000 : (PARAMS.rise[rec.sense] ?? 0);
      const s = { ri, j: r.j, cls: r.cls, t0, t1: t0 + dur, rise, started: 0 };
      if (C.form === 'canal') {
        const axis = rec.params?.axis ?? 'yaw';
        Object.assign(s, { peak: I, sign: axis === 'yaw' ? (r.side === 'L' ? -1 : 1) : PARAMS.verticalCanal, lp: 0, vs: 0, side: r.side,
          t1: t0 + Math.max(dur, PARAMS.rotationRamp) });
      } else {
        const x50 = ((Math.sqrt(C.I0 * C.Imax) - C.I0) / C.I0) ** (a / C.n);
        Object.assign(s, { xPeak: ((I - C.I0) / C.I0) ** (a / C.n), x50 });
      }
      for (let q = st.active.length - 1; q >= 0; q--) if (st.active[q].ri === ri) { this._finish(st.active[q], t); st.active.splice(q, 1); }   // a new stimulus replaces one in progress
      st.active.push(s);
      driven++; tStart = Math.min(tStart, t0);
    }
    const p = psi(rec);
    k.vars[this.vPsi] = driven ? p.psi : 0;
    k.vars[this.vPsiN] = driven ? p.psiN : 0;
    if (driven) k.holdNF('sensory', true);
    const sc = salienceClass(rec);
    k.dispatch('sense', { sense: rec.sense, idx: SENSE_IDS.indexOf(rec.sense), mode: rec.mode, site: rec.site, side: rec.side ?? null,
      psi: driven ? p.psi : 0, psiN: driven ? p.psiN : 0, c: sc.c, valence: sc.valence, tOnset: t, tStart: driven ? tStart : t, driven });
  }

  // The hand has left the object (§12.3; dispatched by somatic.js): records driving receptors at those
  // sites on that side end at tH, the way a record ends at t1 (_finish), so the heat input stops.
  /** @param {{ side?: 'R' | 'L' | null, tH?: number, sites?: string[] }} [p] */
  onContactBroken({ side, tH, sites } = {}) {
    const act = this.st.active, at = new Set(sites ?? []);
    let removed = false;
    for (let q = act.length - 1; q >= 0; q--) {
      const s = act[q], r = this.rec[s.ri];
      if (!at.has(r.site) || (r.side ?? null) !== (side ?? null)) continue;
      this._finish(s, tH ?? this.k.t); act.splice(q, 1); removed = true;
    }
    if (removed && !act.length) this.k.holdNF('sensory', false);
  }

  // Exponential decay of a receptor's adaptation states from its last update to time t (§4.7).
  _decayTo(ri, t) {
    const C = RECEPTORS[this.rec[ri].cls], dt = t - this.tA[ri];
    if (dt > 0) for (let m = 0; m < C.tauA.length; m++) this.A[2 * ri + m] *= Math.exp(-dt / C.tauA[m]);
    this.tA[ri] = t;
  }

  _finish(s, t) {
    const k = this.k, C = RECEPTORS[s.cls];
    k.setExt(s.j, C.rSpont);
    if (C.form === 'canal') { const v = this.vest[s.side]; if (v >= 0) k.setExt(v, 0); }
    else this.tA[s.ri] = Math.max(this.tA[s.ri], t);
  }

  _envelope(s, t) {
    if (t < s.t0) return 0;
    const r = s.rise;
    if (t < s.t0 + r) return (t - s.t0) / r;
    if (t <= s.t1) return 1;
    if (r > 0 && t < s.t1 + r) return 1 - (t - s.t1) / r;
    return 0;
  }

  _omega(s, t) {   // A.6 rotation: 1-s ramp, hold, stop
    if (t < s.t0) return 0;
    const ramp = PARAMS.rotationRamp, stop = PARAMS.rotationStop;
    if (t < s.t0 + ramp) return s.peak * (t - s.t0) / ramp;
    if (t <= s.t1) return s.peak;
    if (t < s.t1 + stop) return s.peak * (1 - (t - s.t1) / stop);
    return 0;
  }

  step(t, h) {
    const act = this.st.active;
    if (!act.length) return;
    const k = this.k;
    let removed = false;
    for (let q = 0; q < act.length; q++) {
      const s = act[q];
      if (t < s.t0) continue;
      const C = RECEPTORS[s.cls];
      if (C.form === 'canal') {
        const w = this._omega(s, t);
        s.lp = w + (s.lp - w) * Math.exp(-h / C.tauHP);
        const c = w - s.lp;
        const g = 1 / C.tauHP - 1 / C.tauVS;
        s.vs = s.vs * Math.exp(-h / C.tauVS) + g * c * C.tauVS * (1 - Math.exp(-h / C.tauVS));
        k.setExt(s.j, Math.min(C.rmax, Math.max(0, C.rSpont + C.gain * s.sign * c)));
        const v = this.vest[s.side];
        if (v >= 0) k.setExt(v, PARAMS.vsWeight * C.gain * s.sign * s.vs / C.rmax);
        if (t > s.t1 + PARAMS.rotationStop && Math.abs(c) < PARAMS.canalDoneDegS && Math.abs(s.vs) < PARAMS.canalDoneDegS) { s.done = 1; removed = true; }
        continue;
      }
      if (!s.started) { this._decayTo(s.ri, t - h); s.started = 1; }
      const x = this._envelope(s, t) * s.xPeak;
      let Asum = 0;
      const base = 2 * s.ri, nT = C.tauA.length;
      for (let m = 0; m < nT; m++) { const A = this.A[base + m]; this.A[base + m] = x + (A - x) * Math.exp(-h / C.tauA[m]); Asum += this.A[base + m]; }
      this.tA[s.ri] = t;
      const A = Asum / nT;
      const u = C.form === 'RA' ? Math.abs(x - A) : Math.max(0, x - C.kA * A);
      const un = u ** C.n;
      k.setExt(s.j, C.rSpont + (C.rmax - C.rSpont) * (un / (un + s.x50 ** C.n)));
      if (t > s.t1 + s.rise && (C.form !== 'RA' || A < PARAMS.raDoneFrac * s.xPeak)) { s.done = 1; removed = true; }
    }
    if (removed) {
      for (let q = act.length - 1; q >= 0; q--) if (act[q].done) { this._finish(act[q], t); act.splice(q, 1); }
      if (!act.length) k.holdNF('sensory', false);
    }
  }
}

/** @type {import('./contracts').Plugin} */
export const plugin = {
  id: 'sensory',
  scope: 'brain',
  order: 10,
  fragment,
  create: (k) => new Sensory(k),
};
export { Sensory };
