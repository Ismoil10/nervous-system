// Short-lived galactic events: supernovae and the shock-wave ring during the crisis.

import { MODEL, omegaAt, crestOffset, ellipsePos } from './galaxy-model.js';
import { starColor } from './astro.js';
import { FX_MAX } from './renderer.js';

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const gauss = () => {
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export class GalacticEvents {
  constructor() {
    this.supernovae = [];
    this.ring = { r: 0, strength: 0, active: false, age: 0 };
    this.data = new Float32Array(FX_MAX * 8);
    this.count = 0;
    this.uniform = new Float32Array(3);
  }

  // Crisis: as in ring galaxies, a density wave racing outward from the center
  // ("like a stone dropped into a pond"); at its leading front gas is compressed and stars ignite.
  triggerRing() {
    this.ring = { r: 0.03, strength: 0, active: true, age: 0 };
  }

  _spawnSupernova(t, k, nearRing) {
    if (this.supernovae.length >= FX_MAX) return;
    let a, off;
    if (nearRing) {
      a = Math.max(0.05, this.ring.r + gauss() * 0.02);
      off = Math.random() * Math.PI * 2 - crestOffset(k);
    } else {
      // Massive stars are short-lived -> supernovae occur in the arms, slightly downstream of the crest.
      a = 0.14 + 0.95 * Math.pow(Math.random(), 1.3);
      off = (Math.random() < 0.5 ? 0 : Math.PI) + gauss() * 0.12;
    }
    this.supernovae.push({
      a, off,
      drift: Math.random() * 0.3,
      t0: t,
      age: 0,
      peak: 70 + 110 * Math.random(),
      rise: 0.18 + 0.15 * Math.random(),
      decay: 1.3 + 0.9 * Math.random(),
    });
  }

  update(dt, p, shape, t) {
    // Poisson process: snRate events per second on average.
    let lambda = p.snRate * dt;
    while (lambda > 0) {
      if (Math.random() < Math.min(1, lambda)) this._spawnSupernova(t, shape.k, false);
      lambda -= 1;
    }

    const ring = this.ring;
    if (ring.active) {
      ring.age += dt;
      ring.r += dt * 0.2;
      ring.strength = smoothstep(0, 0.4, ring.age) * (1 - smoothstep(0.85, 1.35, ring.r));
      if (Math.random() < ring.strength * dt * 6) this._spawnSupernova(t, shape.k, true);
      if (ring.r > 1.4) ring.active = false;
    }
    this.uniform[0] = ring.r;
    this.uniform[1] = ring.active ? ring.strength : 0;
    this.uniform[2] = 0.05 + 0.04 * ring.r;

    // Light curve: fast rise, exponential decay; the color cools from bluish-white to yellowish.
    let n = 0;
    this.supernovae = this.supernovae.filter((sn) => sn.age < sn.rise + sn.decay * 4.5);
    for (const sn of this.supernovae) {
      sn.age += dt;
      const L = sn.age < sn.rise
        ? sn.peak * smoothstep(0, sn.rise, sn.age)
        : sn.peak * Math.exp(-(sn.age - sn.rise) / sn.decay);
      const om = omegaAt(sn.a);
      const E = crestOffset(shape.k) + sn.off + (om - MODEL.OMEGA_P) * (sn.drift + (t - sn.t0));
      const [x, y] = ellipsePos(sn.a, E, t, shape.k, shape.ecc);
      const cool = Math.min(1, Math.max(0, (sn.age - sn.rise) / (sn.decay * 2.5)));
      const col = starColor(16000 - 10000 * cool);
      const o = n * 8;
      this.data[o] = x; this.data[o + 1] = y; this.data[o + 2] = 0;
      this.data[o + 3] = L;
      this.data[o + 4] = col[0]; this.data[o + 5] = col[1]; this.data[o + 6] = col[2];
      this.data[o + 7] = 7 + 4 * Math.log2(1 + L / 20);
      n++;
    }
    this.count = n;
  }
}
