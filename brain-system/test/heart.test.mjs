// Heart (research/HEART.md): the anatomy of the heart stars, the beat's intervals and volume curves,
// the beat clock driven by the simulated rate, the energy-conserving activation wave, and the shader
// and HUD hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HEART, HeartBeat, intervals, ejectionFraction, ventricularVolume, ecgBeat } from '../src/heart.js';
import { HEART_FORM, PART, CONDUCTION, axialOf, lvInside, rvInside } from '../src/body/heart-form.js';
import { generateBody } from '../src/body/generate.js';
import { BODY_VS, uniformSlots } from '../src/shaders.js';
import { SIMPLE_VIEWS } from '../src/ui-simple.js';
import { isBodyView } from '../src/ui-body.js';

const body = generateBody({ budget: 'medium' }, 1848);
const heartStars = (() => {
  const out = [];
  for (let i = 0; i < body.count; i++) {
    const o = i * body.floats, part = Math.round(body.points[o + 5]);
    if (body.points[o + 11] === 1 && part > 0) out.push({ p: [0, 1, 2].map((k) => body.points[o + k] / 0.01), tau: body.points[o + 4], part });
  }
  return out;
})();

test('heart stars: every part present, conduction system included, inside the chest', () => {
  const byPart = new Map();
  for (const s of heartStars) byPart.set(s.part, (byPart.get(s.part) || 0) + 1);
  for (const id of Object.values(PART)) assert.ok(byPart.get(id) > 0, `part ${id} has stars`);
  const conduction = heartStars.filter((s) => CONDUCTION.has(s.part)).length;
  assert.ok(conduction / heartStars.length > 0.08, 'the conduction system is a visible share');
  for (const s of heartStars) {   // the heart and the roots of its great vessels
    assert.ok(s.p[2] < -250 && s.p[2] > -410 && s.p[0] > -100 && s.p[0] < 60, `within the mediastinum ${s.p.map(Math.round)}`);
  }
  assert.ok(heartStars.length > 20000, 'a dense heart (HEART.md §6)');
  const apexward = heartStars.filter((s) => s.part === PART.LV && axialOf(s.p) < 0.1).length;
  assert.ok(apexward > 0, 'the LV reaches the apex');
});

test('activation order: SA node, atria, AV node, His–Purkinje, ventricles', () => {
  const mean = (part) => { const t = heartStars.filter((s) => s.part === part).map((s) => s.tau); return t.reduce((a, b) => a + b, 0) / t.length; };
  const order = [PART.SA, PART.RA, PART.LA, PART.AV, PART.HIS, PART.PURKINJE, PART.LV].map(mean);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `step ${i}: ${order[i - 1].toFixed(2)} → ${order[i].toFixed(2)}`);
  const inert = [PART.VALVE, PART.ROOT, PART.LEAFLET, PART.CHORDAE, PART.CORONARY_A, PART.CORONARY_V];
  for (const s of heartStars) if (inert.includes(s.part)) assert.ok(s.tau < 0, 'valves, leaflets, chordae, roots and coronaries do not depolarise');
});

test('intervals follow the rate: PR and QT shorten, Fridericia QT', () => {
  const r60 = intervals(1), r120 = intervals(0.5), r180 = intervals(1 / 3);
  assert.ok(Math.abs(r60.pr - 0.17) < 0.005 && Math.abs(r120.pr - 0.1325) < 0.005 && Math.abs(r180.pr - 0.12) < 0.005);
  assert.ok(Math.abs(r60.qt - 0.40) < 1e-9 && r120.qt < r60.qt && r180.qt < r120.qt);
  assert.equal(r60.qrs, 0.09);
});

test('Wiggers volume curve: EF ejected, then filled; stronger contraction ejects more', () => {
  const iv = intervals(60 / 68), ef = ejectionFraction(1);
  assert.equal(ef, 0.6);
  assert.ok(ejectionFraction(1.4) > 0.68 && ejectionFraction(3) === HEART.ef[3]);
  assert.equal(ventricularVolume(0, iv, ef), 1, 'isovolumic contraction keeps the volume');
  const esv = ventricularVolume(iv.qt, iv, ef);
  assert.ok(Math.abs(esv - 0.4) < 1e-9, 'end-systole at 1 − EF');
  assert.ok(ventricularVolume(iv.qt + 0.3, iv, ef) > 0.75, 'refilled in diastole');
  // ECG: R is the tallest wave, after the PR interval.
  let best = 0, at = 0;
  for (let t = 0; t < iv.rr; t += 0.002) { const v = ecgBeat(t, iv); if (v > best) { best = v; at = t; } }
  assert.ok(Math.abs(at - (iv.pr + 0.035)) < 0.005 && best > 0.9);
});

test('the beat clock follows the simulated rate, its respiratory variation and the emotion inputs', () => {
  const run = (inputs, seconds = 60) => {
    const h = new HeartBeat(); h.setStars(body.points, body.floats, body.count);
    let beats = 0, last = h.beats.at(-1).t0, maxC = 0;
    for (let i = 0; i < seconds * 60; i++) {
      h.step(1 / 60, typeof inputs === 'function' ? inputs(i / 60) : inputs);
      if (h.beats.at(-1).t0 !== last) { beats++; last = h.beats.at(-1).t0; }
      maxC = Math.max(maxC, h.M[1]);
    }
    return { beats, maxC, h };
  };
  const calm = run({ hr: 68 }), stress = run({ hr: 104, contractility: 1.4 }), pleasure = run({ hr: 125, contractility: 1.3 });
  assert.ok(Math.abs(calm.beats - 68) <= 1 && Math.abs(stress.beats - 104) <= 1 && Math.abs(pleasure.beats - 125) <= 1);
  assert.ok(stress.maxC > calm.maxC * 1.1, 'stress: a stronger stroke');
  const rsa = run((t) => ({ hr: 68, rsa: 1 + 0.07 * Math.sin(2 * Math.PI * t / 4.3) }));
  const rr = rsa.h.beats.map((b) => b.iv.rr);
  assert.ok(Math.max(...rr) - Math.min(...rr) > 0.02, 'beat-to-beat variation with breathing');
  // Time compression never speeds the beat; slow motion slows it; pause stops it.
  assert.equal(run({ hr: 68, kh: 600 }).beats, calm.beats);
  assert.ok(run({ hr: 68, kh: 0.25 }).beats < 20);
  assert.equal(run({ hr: 68, paused: true }).beats, 0);
});

test('above 150 bpm a steady glow; reduced motion keeps the wave but not the motion', () => {
  const h = new HeartBeat();
  h.step(1 / 60, { hr: 170 });
  assert.equal(h.K[0], 0, 'steady glow mode');
  assert.ok(h.K[1] <= 1 + HEART.steadyRange && h.K[1] > 1);
  h.step(1 / 60, { hr: 70, reducedMotion: true });
  assert.equal(h.K[0], 1);
  assert.equal(h.K[2], 0, 'no motion');
});

test('the activation wave is energy-conserving: the heart\'s total light does not pulse', () => {
  const h = new HeartBeat(); h.setStars(body.points, body.floats, body.count);
  for (const hr of [68, 120]) {
    const iv = intervals(60 / hr);
    let lo = Infinity, hi = -Infinity, maxMean = 0;
    for (let T = 0; T < iv.rr; T += 0.004) {
      const M = h.meanWave(T, iv);
      maxMean = Math.max(maxMean, M);
      // Σ flux·(1 + g·wave − M) / Σ flux over the sampled stars
      const S = h.stars; let num = 0, den = 0;
      for (let i = 0; i < S.tau.length; i++) {
        const d = (T - HeartBeat.activation(S.tau[i], iv)) / S.sigma[i];
        num += S.flux[i] * Math.max(0, 1 + (S.gain[i] ? S.gain[i] * Math.exp(-d * d) : 0) - M); den += S.flux[i];
      }
      lo = Math.min(lo, num / den); hi = Math.max(hi, num / den);
    }
    assert.ok(hi - lo <= 0.08, `${hr} bpm: luminance swing ${(hi - lo).toFixed(3)} ≤ 8 % (§13.9)`);
    assert.ok(maxMean < 0.3, `${hr} bpm: the rest of the heart dims at most ${maxMean.toFixed(2)}`);
  }
});

test('shader and HUD hooks: uniforms, Heart view, the heart stays a body view', () => {
  for (const u of ['uHeartT', 'uHeartM', 'uHeartK']) assert.ok(uniformSlots(BODY_VS).names.includes(u), u);
  assert.ok(uniformSlots(BODY_VS).slots <= 110);
  assert.ok(SIMPLE_VIEWS.some((v) => v.id === 'heart' && v.body), 'a Heart view in the simple HUD');
  assert.ok(isBodyView('heart'));
  assert.ok(HEART_FORM.length > 100 && HEART_FORM.length < 130, 'heart length ≈ 11 cm');
});

test('realistic anatomy: coronaries on the surface, leaflets in their rings, venous vessels marked', () => {
  const coronary = heartStars.filter((s) => s.part === PART.CORONARY_A || s.part === PART.CORONARY_V);
  assert.ok(coronary.length > 500);
  const outside = coronary.filter((s) => !lvInside(s.p, -1) && !rvInside(s.p, -1)).length;
  assert.ok(outside / coronary.length > 0.9, 'coronary vessels lie on the epicardium');
  const leaflets = heartStars.filter((s) => s.part === PART.LEAFLET);
  for (const s of leaflets) assert.ok(s.tau <= -2 && s.tau >= -5, 'a leaflet names its valve');
  for (let i = 0; i < HEART_FORM.valves.length; i++) {
    const v = HEART_FORM.valves[i], mine = leaflets.filter((s) => s.tau === -(2 + i));
    assert.ok(mine.length > 50, `${v.id}: leaflets`);
    for (const s of mine) assert.ok(Math.hypot(...s.p.map((x, k) => x - v.c[k])) < v.r + 6, `${v.id}: within its ring`);
  }
  assert.ok(heartStars.some((s) => s.part === PART.ROOT && s.tau === -2) && heartStars.some((s) => s.part === PART.ROOT && s.tau === -1),
    'arterial and venous roots');
});

test('valves open and close with the cycle', () => {
  const h = new HeartBeat();
  let avClosed = false, slOpen = false, bothOpen = false;
  for (let i = 0; i < 240; i++) {
    h.step(1 / 120, { hr: 68 });
    if (h.V[0] < 0.05) avClosed = true;
    if (h.V[1] > 0.95) slOpen = true;
    if (h.V[0] > 0.5 && h.V[1] > 0.5) bothOpen = true;
  }
  assert.ok(avClosed && slOpen, 'AV valves close in systole, semilunar valves open in ejection');
  assert.ok(!bothOpen, 'never both open: no shunt through the ventricle');
  assert.equal(h.uniforms().length, 4);
});
