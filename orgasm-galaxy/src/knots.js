// Jet knots: internal shocks ejected into the relativistic jet, as in M87 and 3C 120 (disk–jet
// coupling). One pair is launched per contraction pulse, so the train of knots records the pulse
// train itself: later knots are fainter and further apart (research/ANALYSIS.md §9.3).
// Knots move in astrophysical time at β = 0.8: at the climax clock (1 kyr per screen second) a
// knot covers ≈ 0.25 kpc per second and knots launched 0.8 s apart land ≈ 0.2 kpc apart.

import { FX_MAX } from './renderer.js';
import { synchrotronRGB } from './astro.js';
import { MODEL } from './galaxy-model.js';

const BETA = 0.8, GAMMA = 1 / Math.sqrt(1 - BETA * BETA), ALPHA = 0.7;
const UNITS_PER_YEAR = BETA / MODEL.LY_PER_UNIT;
const KPC = 1 / 15;   // model units per kpc

export class JetKnots {
  constructor() {
    this.knots = [];
    this.data = new Float32Array(FX_MAX * 8);
    this.count = 0;
    this.color = synchrotronRGB(ALPHA);
  }

  eject(amplitude) {
    for (const side of [1, -1]) {
      if (this.knots.length >= FX_MAX) this.knots.shift();
      this.knots.push({ side, dist: 0, age: 0, amp: amplitude, relic: 0 });
    }
  }

  // dt: screen seconds; years: astrophysical years elapsed this frame; relicTau: e-folding (screen s)
  // of knots once the train is over (2 s + 6 s·Ψ); trainOver: true after the last pulse.
  update(dt, years, axis, eye, relicTau, trainOver) {
    let n = 0;
    for (const k of this.knots) {
      k.age += dt;
      k.dist += years * UNITS_PER_YEAR;
      if (trainOver) k.relic += dt;
    }
    this.knots = this.knots.filter((k) => k.dist < MODEL.JET_LEN * 1.6 && Math.exp(-k.relic / relicTau) > 0.01);
    for (const k of this.knots) {
      const x = axis[0] * k.side * k.dist, y = axis[1] * k.side * k.dist, z = axis[2] * k.side * k.dist;
      const ex = eye[0] - x, ey = eye[1] - y, ez = eye[2] - z;
      const mu = (axis[0] * ex + axis[1] * ey + axis[2] * ez) * k.side / Math.hypot(ex, ey, ez);
      const doppler = Math.pow(1 / (GAMMA * (1 - BETA * mu)), 2 + ALPHA);
      const form = Math.min(1, k.age / 0.12);   // the shock forms over ≈ 0.1 s: never a flash
      const L = 60 * k.amp * form * Math.exp(-k.dist / (0.8 * KPC)) * Math.exp(-k.relic / relicTau) * doppler;
      const o = n * 8;
      this.data[o] = x; this.data[o + 1] = y; this.data[o + 2] = z;
      this.data[o + 3] = L;
      this.data[o + 4] = this.color[0]; this.data[o + 5] = this.color[1]; this.data[o + 6] = this.color[2];
      this.data[o + 7] = 0.002 + 0.006 * Math.min(1, k.dist / MODEL.JET_LEN);   // 30 pc → 150 pc
      n++;
    }
    this.count = n;
  }
}
