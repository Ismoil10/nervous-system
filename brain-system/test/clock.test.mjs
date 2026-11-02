// SimClock (research/ANALYSIS.md A.4, §11.7, B.4, B.13): presets, range, slew, source priority,
// the exempt delegate, keyframe and stimulus anticipation, time slicing and the HUD label.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SimClock, PRESETS, PARAMS, LogRamp, descentH, approachS, formatRate, formatTime } from '../src/clock.js';
import { LogRamp as ResponseLogRamp } from '../src/response.js';
import { mulberry32 } from '../src/anatomy.js';

const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

describe('constants and helpers', () => {
  test('A.4 presets, range and slew', () => {
    assert.deepEqual(PRESETS, { reflex: 0.01, pain: 0.1, autonomic: 1, gut: 10, endocrine: 60, immune: 900, circadian: 3600 });
    assert.equal(PARAMS.khMin, 0.005);
    assert.equal(PARAMS.khMax, 3600);
    assert.equal(PARAMS.slew, 1);
  });

  test('LogRamp is re-exported from response.js', () => {
    assert.equal(LogRamp, ResponseLogRamp);
  });

  test('descent sums reproduce the §11.17 figures', () => {
    // Descent 1 → 0.02 at 1 decade/s: 0.3785 / 0.4175 / 0.4236 human s at 10 / 60 / 240 fps, analytic 0.4256.
    assert.equal(descentH(1, 0.02, 1 / 10).toFixed(4), '0.3785');
    assert.equal(descentH(1, 0.02, 1 / 60).toFixed(4), '0.4175');
    assert.equal(descentH(1, 0.02, 1 / 240).toFixed(4), '0.4236');
    assert.equal(descentH(1, 0.02, 0).toFixed(4), '0.4256');
    // Descent 3,600 → 0.02: 1,534 human s at 60 fps (analytic 1,563), 5.27 screen s.
    assert.equal(Math.round(descentH(3600, 0.02, 1 / 60)), 1534);
    assert.equal(Math.round(descentH(3600, 0.02, 0)), 1563);
    assert.equal((Math.ceil(approachS(3600, 0.02) * 60) / 60).toFixed(2), '5.27');
    assert.equal(approachS(1, 0.02).toFixed(2), '1.70');
    assert.equal(descentH(0.02, 1, 1 / 60), 0, 'no descent when rising');
  });

  test('HUD formats (A.4)', () => {
    assert.equal(formatRate(0.01), '×1/100');
    assert.equal(formatRate(0.005), '×1/200');
    assert.equal(formatRate(0.35), '×1/2.86');
    assert.equal(formatRate(1), '×1');
    assert.equal(formatRate(60), '×60');
    assert.equal(formatRate(3600), '×3,600');
    assert.equal(formatTime(0.023), '23.0 ms');
    assert.equal(formatTime(4.5), '4.50 s');
    assert.equal(formatTime(90), '1.5 min');
    assert.equal(formatTime(5400), '1.50 h');
    const c = new SimClock({ kh: 0.01, tH: 0.023 });
    c.markEpoch(0);
    assert.equal(c.label(), 't 23.0 ms  ×1/100');
  });
});

describe('SimClock', () => {
  test('advance returns [t0H, t0H + h] with h = dtS·kh; a paused frame passes no time', () => {
    const c = new SimClock({ kh: 10, tH: 5 });
    const s = c.advance(0.02);
    assert.equal(s.t0H, 5);
    assert.ok(Object.is(s.h, 0.02 * s.kh));
    assert.equal(s.t1H, 5 + s.h);
    assert.equal(c.tH, s.t1H);
    const p = c.advance(0);
    assert.equal(p.h, 0);
    assert.equal(p.t1H, s.t1H);
    assert.equal(p.kh, s.kh);
  });

  test('every non-delegate change is slew-limited and clamped to the A.4 range', () => {
    const c = new SimClock({ kh: 1 });
    c.lock(1e6);
    assert.equal(c.locked, 3600);
    let prev = c.kh, frames = 0;
    while (c.kh < 3600 && frames < 10000) {
      const dt = frames % 7 === 3 ? 0.1 : 1 / 60;
      c.advance(dt);
      assert.ok(Math.log10(c.kh / prev) <= PARAMS.slew * dt + 1e-12, `frame ${frames}: slew exceeded`);
      prev = c.kh; frames++;
    }
    assert.ok(close(c.kh, 3600));
    c.lock(1e-9);
    assert.equal(c.locked, 0.005);
    for (let i = 0; i < 600; i++) c.advance(1 / 60);
    assert.ok(close(c.kh, 0.005));
  });

  test('source priority: user lock › delegate › keyframes › adaptive (A.4, §11.7)', () => {
    const c = new SimClock({ kh: 1 });
    c.setAdaptiveTarget(10);
    c.advance(1 / 60);
    assert.equal(c.source, 'adaptive');
    c.setKeyframes([{ tH0: -1, tH1: 1e6, kh: 0.1 }]);
    c.advance(1 / 60);
    assert.equal(c.source, 'scenario');
    let calls = 0;
    c.delegate(() => { calls++; return 12345; });   // exempt from slew and range (§11.14)
    const s = c.advance(0.05);
    assert.equal(c.source, 'delegate');
    assert.equal(s.kh, 12345);
    assert.ok(Object.is(s.h, 0.05 * 12345));
    c.lock(1);
    c.advance(1 / 60);
    assert.equal(c.source, 'user');
    assert.equal(calls, 2, 'the delegate is stepped even under a lock');
    c.lock(null);
    c.advance(1 / 60);
    assert.equal(c.source, 'delegate');
    c.delegate(null);
    c.advance(1 / 60);
    assert.equal(c.source, 'scenario');
    c.setKeyframes(null);
    c.advance(1 / 60);
    assert.equal(c.source, 'adaptive');
  });

  test('the delegate reproduces a legacy LogRamp verbatim, including the instant switch', () => {
    const legacy = new LogRamp(10), mirror = new LogRamp(10);
    const c = new SimClock();
    c.delegate((dt) => mirror.step(dt));
    for (let f = 0; f < 600; f++) {
      if (f === 100) { legacy.set(1, 0); mirror.set(1, 0); }       // ignition: instant ×1
      if (f === 300) { legacy.set(20, 1); mirror.set(20, 1); }     // 1 → 20 in 1 s (1.30 decades/s)
      const dt = 1 / 60 + (f % 5) * 1e-3;
      const kh = legacy.step(dt);
      const s = c.advance(dt);
      assert.ok(Object.is(s.kh, kh));
      assert.ok(Object.is(s.h, dt * kh));
    }
  });

  test('falling keyframes are anticipated: kh reaches the window value at its start, within one frame', () => {
    for (const [fps, jitter] of [[30, 0], [60, 0], [144, 0], [60, 0.3], [30, 0.3]]) {
      const r = mulberry32(fps);
      const c = new SimClock({ kh: 1, tH: 10 });
      const origin = c.tH + 3;                                       // 3 s pre-roll at ×1 (§12.4)
      c.setKeyframes([{ tH0: 0, tH1: 0.4, kh: 0.02 }, { tH0: 0.4, tH1: 1.2, kh: 0.35 }, { tH0: 1.2, tH1: 30, kh: 1 }], { originH: origin });
      let atOnset = null, waitFrames = 0, prevT = c.tH;
      let dt = 1 / fps;
      for (let f = 0; f < 60 * fps && c.tH < origin + 2; f++) {
        dt = (1 / fps) * (1 - jitter + 2 * jitter * r());
        const s = c.advance(dt);
        if (s.t1H < origin && close(s.kh, 0.02, 1e-6)) waitFrames++;
        if (atOnset == null && s.t0H >= origin) atOnset = s.kh;
        assert.ok(s.t0H === prevT); prevT = s.t1H;
      }
      assert.ok(atOnset <= 0.02 * Math.pow(10, PARAMS.slew * 1.3 / fps) * (1 + 1e-9), `${fps} fps, jitter ${jitter}: kh ${atOnset} at onset`);
      assert.ok(waitFrames <= 1, `${fps} fps, jitter ${jitter}: waited ${waitFrames} frames at the target before onset`);
    }
  });

  test('anticipate(): a click reaches k1 at onset and holds it until the hold window ends (§11.9)', () => {
    const dt = 1 / 60, k1 = 0.02;
    const c = new SimClock({ kh: 1 });
    for (let i = 0; i < 30; i++) c.advance(dt);
    const tOnset = c.tH + descentH(c.kh, k1, dt);
    const hold = 0.05;                                               // 2.5 screen s at ×1/50
    c.anticipate(tOnset, k1, tOnset + hold);
    let atOnset = null, minAfter = Infinity, waitFrames = 0;
    for (let f = 0; f < 600 && c.tH < tOnset + hold; f++) {
      const s = c.advance(dt);
      if (s.t1H < tOnset && close(s.kh, k1, 1e-6)) waitFrames++;
      if (atOnset == null && s.t0H >= tOnset) atOnset = s.kh;
      if (s.t0H >= tOnset) minAfter = Math.min(minAfter, s.kh);
      if (s.t0H >= tOnset && s.t1H < tOnset + hold) assert.ok(s.kh <= k1 * Math.pow(10, dt) * (1 + 1e-9), 'held at k1');
    }
    assert.ok(waitFrames <= 1, `waited ${waitFrames} frames before onset`);
    assert.ok(atOnset <= k1 * Math.pow(10, dt) * (1 + 1e-9), `kh ${atOnset} at onset`);
    assert.ok(close(minAfter, k1, 1e-6));
    for (let f = 0; f < 240; f++) c.advance(dt);
    assert.ok(close(c.kh, 1, 1e-6), 'released to the adaptive target after the hold');
    assert.equal(c.pending.length, 0);
  });

  test('commit(): time slicing lowers the effective kh, never past [t0H, t1H]; ignored under the delegate', () => {
    const c = new SimClock({ kh: 1, tH: 0 });
    const s = c.advance(0.1);
    assert.equal(c.commit(s.t0H + s.h / 2), s.t0H + s.h / 2);
    assert.ok(c.limited);
    assert.ok(close(c.khEff, s.kh / 2));
    const s2 = c.advance(0.1);
    assert.equal(s2.t0H, s.t0H + s.h / 2, 'the next frame starts at the committed time');
    assert.equal(c.commit(s2.t1H + 5), s2.t1H);
    assert.equal(c.commit(-1), s2.t0H, 'a commit before t0H is clamped to t0H');
    const d = new SimClock({ kh: 1 });
    d.delegate(() => 10);
    const s3 = d.advance(0.1);
    assert.equal(d.commit(s3.t0H), s3.t1H);
  });
});
