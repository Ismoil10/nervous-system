// Breath clock (research/LUNGS.md §3, §7): excursion and rib laws, screen-time breaths, sighs,
// breath-holds, the airflow front and the capnogram.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BREATH, BreathClock, excursion, ribExpansion, frontBand, frontMean } from '../src/breath.js';

const run = (c, seconds, o, dt = 1 / 60) => { const out = []; for (let t = 0; t < seconds; t += dt) { c.step(dt, o); out.push({ t, v: c.volume, co2: c.co2, front: c.front, insp: c.inspiring }); } return out; };

describe('breath laws (LUNGS.md §3.3–3.5)', () => {
  test('diaphragm excursion: 15 mm at 0.5 L, ≈ 69 mm at 3 L (Boussuges et al. 2009 means)', () => {
    assert.equal(excursion(0.5), 15);
    assert.ok(Math.abs(excursion(3) - 68.7) < 1, `${excursion(3)}`);
    assert.equal(excursion(0), 0);
  });
  test('rib cage: < 1 mm at rest, several mm for a deep breath', () => {
    assert.ok(ribExpansion(0.5) > 0.6 && ribExpansion(0.5) < 1.1, `${ribExpansion(0.5)}`);
    assert.ok(ribExpansion(3) > 6 && ribExpansion(3) < 9, `${ribExpansion(3)}`);
  });
});

describe('BreathClock', () => {
  test('14/min × 0.5 L: the volume peaks at VT and the breath count follows the rate', () => {
    const c = new BreathClock({ seed: 3 });
    const tr = run(c, 60, { rr: 14, vt: 0.5, sighRate: 0 });
    const peak = Math.max(...tr.map((x) => x.v));
    assert.ok(Math.abs(peak - 0.5) < 0.005, `peak ${peak}`);
    assert.ok(c.breaths >= 13 && c.breaths <= 15, `${c.breaths} breaths`);
  });
  test('screen time: kh > 1 never speeds the breath, kh < 1 slows it, pause stops it', () => {
    const a = new BreathClock(), b = new BreathClock(), s = new BreathClock(), p = new BreathClock();
    run(a, 60, { rr: 14, vt: 0.5, sighRate: 0, kh: 1 });
    run(b, 60, { rr: 14, vt: 0.5, sighRate: 0, kh: 50 });
    run(s, 60, { rr: 14, vt: 0.5, sighRate: 0, kh: 0.5 });
    run(p, 60, { rr: 14, vt: 0.5, sighRate: 0, paused: true });
    assert.equal(a.breaths, b.breaths);
    assert.ok(Math.abs(s.breaths - a.breaths / 2) <= 1, `${s.breaths} vs ${a.breaths}`);
    assert.equal(p.breaths, 0);
  });
  test('sighs: ≈ 12 per hour at rest, more in stress; a sigh is ≈ 2.5 × VT', () => {
    const rest = new BreathClock({ seed: 7 }), stress = new BreathClock({ seed: 7 });
    let peak = 0;
    for (let t = 0; t < 3600; t += 0.05) { rest.step(0.05, { rr: 14, vt: 0.5, sighRate: 12 }); if (rest.sigh) peak = Math.max(peak, rest.volume); }
    run(stress, 3600, { rr: 18, vt: 0.43, sighRate: 24 }, 0.05);
    assert.ok(rest.sighs >= 5 && rest.sighs <= 22, `${rest.sighs} sighs/h at rest`);
    assert.ok(stress.sighs > rest.sighs, `${stress.sighs} in stress vs ${rest.sighs}`);
    assert.ok(Math.abs(peak - 0.5 * BREATH.sigh.vt) < 0.02, `sigh peak ${peak}`);
  });
  test('breath-hold (rr 0): the volume holds', () => {
    const c = new BreathClock();
    run(c, 1, { rr: 14, vt: 0.5, sighRate: 0 });
    const v = c.volume;
    run(c, 3, { rr: 0, vt: 0.5, sighRate: 0 });
    assert.equal(c.volume, v); assert.ok(c.holding);
  });
  test('capnogram: zero in inspiration, the alveolar plateau after the dead space, EtCO₂ at the end', () => {
    const c = new BreathClock({ seed: 2 });
    run(c, 20, { rr: 14, vt: 0.5, sighRate: 0, etco2: 37 });
    const tr = run(c, 60 / 14, { rr: 14, vt: 0.5, sighRate: 0, etco2: 37 }, 0.005);
    const insp = tr.filter((x) => x.insp && x.t > 0.3 && x.t < 1.4);
    assert.ok(insp.every((x) => x.co2 < 0.5), 'phase I baseline in inspiration');
    const maxCo2 = Math.max(...tr.map((x) => x.co2));
    assert.ok(maxCo2 > 36 && maxCo2 <= 37.0001, `EtCO₂ ${maxCo2}`);
  });
  test('airflow front: in with the inspired volume, out to the mouth once the dead space is exhaled', () => {
    const c = new BreathClock({ seed: 2 });
    run(c, 20, { rr: 14, vt: 0.5, sighRate: 0 });
    const tr = run(c, 60 / 14, { rr: 14, vt: 0.5, sighRate: 0 }, 0.005);
    assert.ok(tr.filter((x) => x.insp).every((x) => Math.abs(x.front - x.v) < 1e-12));
    assert.ok(Math.min(...tr.map((x) => x.front)) < 0, 'the interface leaves the mouth in expiration');
    assert.ok(Math.max(...tr.map((x) => x.front)) > BREATH.vd, 'it passes the dead space into the acini');
  });
  test('energy-conserving band: the flux-weighted mean M makes Σ w (b − M) vanish', () => {
    const s = new Float32Array(64), w = new Float32Array(64);
    for (let i = 0; i < 64; i++) { s[i] = 0.02 + i * 0.006; w[i] = 1 + (i % 5); }
    for (const sf of [0.05, 0.12, 0.2, 0.3]) for (const dir of [1, -1]) {
      const M = frontMean({ s, w }, sf, dir);
      let acc = 0, tot = 0;
      for (let i = 0; i < 64; i++) { acc += w[i] * (frontBand(s[i], sf, dir) - M); tot += w[i]; }
      assert.ok(Math.abs(acc / tot) < 1e-6 && Math.abs(M) < 0.2, `sf ${sf} dir ${dir}: M ${M}`);
    }
  });
  test('the trailing band keeps a stretch of airway within the 8 % swing (LUNGS.md §7.4)', () => {
    // The trachea's stars, uniform over its volume coordinate (50–80 mL of 240 mL, × VD 0.15 L), at
    // the main.js gain 0.6, as the front sweeps in and out.
    const n = 400, s = Array.from({ length: n }, (_, i) => (0.15 * (50 + (30 * (i + 0.5)) / n)) / 240);
    let worst = 0;
    for (let sf = -0.02; sf <= 0.1; sf += 0.0005) for (const dir of [1, -1]) {
      const light = s.reduce((a, x) => a + Math.max(0, 1 + 0.6 * frontBand(x, sf, dir)), 0) / n;
      worst = Math.max(worst, Math.abs(light - 1));
    }
    assert.ok(worst <= 0.08, `trachea swing ${(100 * worst).toFixed(1)} %`);
  });
});
