// Patient monitor (src/monitor.js, research/HEART.md §7): channels and alarm limits, the respiration
// trace in screen time, the arterial trace of the beat model, and the HUD's number formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MONITOR, RespTrace, CapnoTrace, SpO2Meter, isAlarm, monitorValues } from '../src/monitor.js';
import { HeartBeat, arterialWave } from '../src/heart.js';
import { monitorText } from '../src/ui-simple.js';

test('channels in the bedside colours, with adult alarm limits', () => {
  assert.deepEqual(Object.keys(MONITOR.channels), ['hr', 'art', 'ptt', 'spo2', 'rr', 'co2', 'temp', 'adr', 'cort']);
  assert.ok(isAlarm('spo2', 88) && !isAlarm('spo2', 97) && isAlarm('co2', 27) && !isAlarm('co2', 37));
  assert.ok(isAlarm('hr', 130) && isAlarm('hr', 45) && !isAlarm('hr', 68));
  assert.ok(isAlarm('art', 170) && !isAlarm('art', 115));
  assert.ok(isAlarm('rr', 30) && !isAlarm('rr', 14));
  assert.ok(isAlarm('temp', 38.5) && !isAlarm('temp', 37));
  assert.ok(!isAlarm('hr', null), 'no alarm without a value');
  assert.ok(isAlarm('adr', 160) && !isAlarm('adr', 40) && isAlarm('cort', 30) && !isAlarm('cort', 11));
  const v = monitorValues({ sbp: 120, dbp: 80, map: 93, rr: 14, tCore: 36.9, adrenaline: 40, cortisol: 11.2 }, 70, 163);
  assert.deepEqual(v, { hr: 70, sys: 120, dia: 80, map: 93, rr: 14, temp: 36.9, adr: 40, cort: 11.2, ptt: 163, spo2: null, co2: null });
  assert.deepEqual([monitorValues({}, 70, null, { spo2: 97, etco2: 37 }).spo2, monitorValues({}, 70, null, { spo2: 97, etco2: 37 }).co2], [97, 37]);
  assert.equal(monitorText('adr', 66.5), '67');
  assert.equal(monitorText('cort', 11.26), '11.3');
  assert.equal(monitorValues(null, null).hr, null, 'brain-only: no values');
  assert.equal(monitorText('temp', 36.94), '36.9');
  assert.equal(monitorText('hr', 67.6), '68');
  assert.equal(monitorText('sys', null), '--');
});

test('respiration trace: breaths at the simulated rate, in screen time', () => {
  const count = (rr, kh = 1) => {
    const r = new RespTrace(); let breaths = 0, last = r.phase;
    for (let i = 0; i < 60 * 60; i++) { r.step(1 / 60, { rr, kh }); if (r.phase < last) breaths++; last = r.phase; }
    return breaths;
  };
  assert.ok(Math.abs(count(14) - 14) <= 1 && Math.abs(count(24) - 24) <= 1);
  assert.equal(count(14, 300), count(14), 'time compression never speeds the trace');
  assert.ok(RespTrace.shape(0.4) > 0.99 && RespTrace.shape(0) < 0.01, 'inspiration up, expiration down');
});

test('arterial trace: systolic and diastolic from the vitals, with a dicrotic notch', () => {
  const h = new HeartBeat();
  for (let i = 0; i < 600; i++) h.step(1 / 60, { hr: 72, sbp: 130, dbp: 85 });
  const lo = Math.min(...h.abp), hi = Math.max(...h.abp);
  assert.ok(Math.abs(hi - 130) < 1.5 && Math.abs(lo - 85) < 3, `ART ${lo.toFixed(0)}–${hi.toFixed(0)}`);
  const ej = 0.3, rr = 0.83, at = (x) => arterialWave(x, ej, rr);
  assert.ok(at(ej + 0.015) < at(ej) && at(ej + 0.04) > at(ej + 0.015), 'the notch dips and recovers');
  assert.ok(at(rr - ej) < at(ej + 0.1), 'diastolic run-off');
});

test('SpO₂ reading: the lung-to-finger delay and the averaging window (LUNGS.md §4.1)', () => {
  const m = new SpO2Meter();
  for (let t = 0; t <= 40; t += 0.5) m.push(t, t < 30 ? 97.4 : 99.0);
  assert.equal(m.value(40), 97, 'the change has not reached the finger yet');
  for (let t = 40.5; t <= 60; t += 0.5) m.push(t, 99.0);
  assert.equal(m.value(60), 99, 'after the delay and the window');
  assert.ok(m.value(60) <= 100);
});

test('capnogram trace: CO₂ from the breath clock, in screen time', () => {
  const c = new CapnoTrace();
  c.step(1, 37, { kh: 10 });
  assert.equal(c.head, MONITOR.co2.rate, 'time compression never speeds the trace');
  assert.ok(Math.abs(c.trace[0] - 37 / MONITOR.co2.range) < 1e-6);
});
