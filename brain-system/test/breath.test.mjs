// Breath clock (research/LUNGS.md §3, §7): excursion and rib laws, screen-time breaths, sighs,
// breath-holds, the airflow front and the capnogram.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BREATH, BreathClock, excursion, ribExpansion } from '../src/breath.js';

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
  test('air particles: the displacement runs 0 → 1 → 0 each breath, 2.5 for a sigh (LUNGS.md §14.3)', () => {
    const c = new BreathClock({ seed: 2 });
    run(c, 20, { rr: 14, vt: 0.5, sighRate: 0 });
    const tr = []; for (let t = 0; t < 60 / 14; t += 0.01) { c.step(0.01, { rr: 14, vt: 0.5, sighRate: 0 }); tr.push(c.drift); }
    assert.ok(Math.max(...tr) > 0.99 && Math.max(...tr) < 1.01 && Math.min(...tr) < 0.02, `flow ${Math.min(...tr)}–${Math.max(...tr)}`);
    const s2 = new BreathClock({ seed: 7 });
    let peak = 0;
    for (let t = 0; t < 3600; t += 0.05) { s2.step(0.05, { rr: 14, vt: 0.5, sighRate: 12 }); if (s2.sigh) peak = Math.max(peak, s2.drift); }
    assert.ok(Math.abs(peak - BREATH.sigh.vt) < 0.05, `sigh flow ${peak}`);
  });
  test('the motion is drawn × 3 (user decision); the model keeps true scale', () => {
    assert.equal(BREATH.display, 3);
    assert.equal(excursion(0.5), 15);
  });
});
