// DOPAMINE.md §9.7 test suite on the ported model (response.js after the DOPAMINE.md §9.8 port, the
// closed-loop dopamine.js). Human-time runs drive ResponseModel.advanceHuman(Δ, S) directly with
// Δ = 0.05 s on the deterministic §6.9 reference ({ deterministic: true }: η = 0, q = 0.5, tail pulses
// at train times 10.47 and 13.47 s); seed statistics use the seeded stream of the constructor. §6.9:
// rows 1, 2, 4–9, 10 (both hypotheses), 14, 15, 18 and 20 within ±20 %; row 3 analytic to 3
// significant figures; row 19 as bounds; row 21 as the maximum over dopamine substeps, equal within
// ±0.5 nM at 10, 30, 60 and 240 fps. Demo-mode runs use the legacy update(dt) path in screen time.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResponseModel } from '../src/response.js';
import { DopamineModel, FIELDS, POPS, PARAMS } from '../src/dopamine.js';
import { R, REGION_COUNT } from '../src/anatomy.js';

const F = Object.fromEntries(FIELDS.map((f, i) => [f.id, i]));
const P = Object.fromEntries(POPS.map((p, i) => [p.id, i]));
const DELTA = 0.05;                     // §9.7: human-time step of the Node suite (s)
const STIM_ON = 60;                     // §6.9 reference: S = 1 from 60 s until the orgasm end
const near = (x, target, rel = 0.2) => Math.abs(x - target) <= rel * Math.abs(target);
const fmt = (x, n = 3) => Number(x).toFixed(n);

// --- Human-time driver ---

function humanRun({ seed = 1, deterministic = true, profile = 'single', hypothesis = 'sustained', T, S, hook = null, stop = null }) {
  const m = new ResponseModel({ seed, deterministic });
  m.setProfile(profile);
  m.setMode('manual');
  const d = new DopamineModel();
  d.setHypothesis(hypothesis);
  m.onStep = (h, prev) => d.step(h, m, prev);
  const tr = [], marks = {};
  let last = m.phase;
  for (let k = 0; k * DELTA < T; k++) {
    const t = k * DELTA;
    hook?.(t, m, marks, d);
    m.advanceHuman(DELTA, S(t, m, marks));
    if (m.phase !== last) { (marks[m.phase] ??= []).push(m.tHuman); last = m.phase; }
    tr.push({
      t: m.tHuman, phase: m.phase, C: Array.from(d.C), vtal: d.nu[P.VTAl], vtam: d.nu[P.VTAm], snc: d.nu[P.SNc],
      d1: d.th1[F.naccCore], d2: d.th2[F.naccCore], th: [...d.th1, ...d.th2], K: d.K[F.naccCore],
    });
    if (stop?.(m, marks)) break;
  }
  return { tr, marks, m, d };
}
const ratio = (s, id) => s.C[F[id]] / FIELDS[F[id]].C0;
const mean = (arr, fn) => arr.reduce((a, s) => a + fn(s), 0) / arr.length;
const at = (tr, t) => tr.find((s) => s.t >= t - 1e-9);
const argmax = (arr, fn) => arr.reduce((a, s) => (fn(s) > fn(a) ? s : a));
const argmin = (arr, fn) => arr.reduce((a, s) => (fn(s) < fn(a) ? s : a));

// §6.9 reference stimulus: S = 1 from 60 s until the orgasm end, then 0. Runs to baseline re-entry.
const refStim = (t, m, mk) => (t >= STIM_ON && !mk.resolutionEarly ? 1 : 0);
const memo = new Map();
function reference(hypothesis = 'sustained') {
  if (!memo.has(hypothesis)) {
    memo.set(hypothesis, humanRun({ hypothesis, T: 9000, S: refStim, stop: (m, mk) => !!mk.baseline }));
  }
  return memo.get(hypothesis);
}
const plateauOf = ({ tr, marks }) => tr.filter((s) => s.phase === 'plateau' && s.t < marks.onset[0]);

// Screen-time demo run (the legacy update(dt) path, frame dt fixed).
function demoRun({ fps, seconds, profile = 'single', seed = 1, deterministic = true, pulseLocked = false, reducedMotion = false, imaging = false, perFrame = null }) {
  const m = new ResponseModel({ seed, deterministic });
  m.setProfile(profile);
  const d = new DopamineModel();
  if (pulseLocked) d.setSwitch('pulseLocked', true);
  if (imaging) d.setSwitch('imaging', true);
  d.setReducedMotion(reducedMotion);
  m.onStep = (h, prev) => d.step(h, m, prev);
  const phases = [];
  let tS = 0, last = m.phase;
  const dt = 1 / fps;
  for (let k = 0; k < Math.round(seconds * fps); k++) {
    const clk = m.update(dt);
    tS += dt;
    m.events.length = 0;
    d.updateVisuals(dt, m, clk.kh);
    if (m.phase !== last) { phases.push({ phase: m.phase, tS, tH: m.tHuman }); last = m.phase; }
    perFrame?.(tS, m, d, dt);
  }
  return { phases, m, d };
}

// --- §6.9 rows on the deterministic reference ---

describe('DOPAMINE.md §6.9 rows (deterministic reference, human time, Δ = 0.05 s)', () => {
  test('row 1: tonic NAcc / dorsal striatum / PFC at rest (5–20 / 5–20 / 0.5–2 nM; model 15 / 20 / 2.0)', () => {
    const s = at(reference().tr, STIM_ON - DELTA);
    for (const [id, nM] of [['naccCore', 15], ['dStriatum', 20], ['mPFC', 2]]) {
      assert.ok(near(s.C[F[id]], nM, 0.01), `${id} ${fmt(s.C[F[id]], 2)} nM`);
    }
    assert.equal(s.phase, 'baseline');
  });

  test('row 2: NAcc core occupancy (rest D2 0.60 / D1 0.015; plateau 0.69 / 0.021; climax 0.81 / 0.050)', () => {
    const ref = reference();
    const s = at(ref.tr, STIM_ON - DELTA);
    assert.ok(s.d2 >= 0.5 && s.d2 <= 0.67, `D2 ${s.d2}`);
    assert.ok(s.d1 >= 0.01 && s.d1 <= 0.05, `D1 ${s.d1}`);
    assert.equal(s.d2.toFixed(2), '0.60');
    assert.equal(s.d1.toFixed(3), '0.015');
    const plat = plateauOf(ref);
    assert.ok(near(mean(plat, (x) => x.d2), 0.69), 'plateau D2');
    assert.ok(near(mean(plat, (x) => x.d1), 0.021), 'plateau D1');
    const cl = ref.tr.filter((x) => x.t >= ref.marks.onset[0] && x.t <= ref.marks.resolutionEarly[0]);
    assert.ok(near(Math.max(...cl.map((x) => x.d2)), 0.81), 'climax D2');
    assert.ok(near(Math.max(...cl.map((x) => x.d1)), 0.050), 'climax D1');
  });

  test('row 3: clearance half-times ln 2·τ_clear at C0 (3 significant figures)', () => {
    const d = new DopamineModel();
    const expected = { dStriatum: '0.0379', naccCore: '0.0591', naccShell: '0.122', mPFC: '0.697', amygdala: '0.880', MPOA: '2.31', PVN: '2.31', medEminence: '3.47' };
    FIELDS.forEach((f, j) => {
      if (f.Vmax > 0) {
        // K_m from the release scale q_j, set so that tonic firing gives C0 (§6.4 (7)).
        const drive = Object.entries(f.src).reduce((a, [id, w]) => a + w * POPS[P[id]].nu0, 0);
        const Km = f.Vmax * f.C0 / (d.q[j] * drive - f.kl * f.C0) - f.C0;
        assert.ok(Math.abs(Km - 200) < 1e-6, `${f.id}: Km ${Km}`);
      }
      if (!expected[f.id]) return;
      const tHalf = Math.LN2 / (f.Vmax / (200 + f.C0) + f.kl);
      assert.equal(tHalf.toPrecision(3), expected[f.id], f.id);
    });
  });

  test('row 4: onset transient in NAcc core (+23 nM, peak 38.3 nM at 0.6 s; VTA-l 10.7 Hz)', () => {
    const { tr } = reference();
    const win = tr.filter((s) => s.t > STIM_ON && s.t <= STIM_ON + 6);
    const pk = argmax(win, (s) => s.C[F.naccCore]);
    assert.ok(near(pk.C[F.naccCore], 38.3), `peak ${fmt(pk.C[F.naccCore], 2)} nM`);
    assert.ok(near(pk.t - STIM_ON, 0.6), `at +${fmt(pk.t - STIM_ON, 2)} s`);
    assert.ok(near(Math.max(...win.map((s) => s.vtal)), 10.7), 'VTA-l peak');
    const rise = pk.C[F.naccCore] - FIELDS[F.naccCore].C0;
    const back = tr.find((s) => s.t > pk.t && s.C[F.naccCore] < FIELDS[F.naccCore].C0 + rise / 2);
    assert.ok(back.t - pk.t < 1.5, `half decay ${fmt(back.t - pk.t, 2)} s`);
  });

  test('row 5: PFC and amygdala transients are smaller and later (+0.9 nM at 1.4 s; +2.2 nM at 1.5 s)', () => {
    const { tr } = reference();
    const win = tr.filter((s) => s.t > STIM_ON && s.t <= STIM_ON + 6);
    for (const [id, dC, tPk] of [['mPFC', 0.9, 1.4], ['amygdala', 2.2, 1.5]]) {
      const pk = argmax(win, (s) => s.C[F[id]]);
      assert.ok(near(pk.C[F[id]] - FIELDS[F[id]].C0, dC), `${id} +${fmt(pk.C[F[id]] - FIELDS[F[id]].C0, 2)} nM`);
      assert.ok(near(pk.t - STIM_ON, tPk), `${id} at +${fmt(pk.t - STIM_ON, 2)} s`);
    }
  });

  test('row 6: tonic rise during stimulation (core +29/+35/+42/+45/+46 % at 1/2/4/6/7 min; plateau 1.46×, dorsal striatum smaller)', () => {
    const ref = reference();
    const rows = { 1: 1.29, 2: 1.35, 4: 1.42, 6: 1.45, 7: 1.46 };
    for (const [min, x] of Object.entries(rows)) {
      const r = ratio(at(ref.tr, STIM_ON + 60 * min), 'naccCore');
      assert.ok(near(r - 1, x - 1), `+${min} min: ${fmt(r)}×`);
    }
    const plat = plateauOf(ref);
    const core = mean(plat, (s) => ratio(s, 'naccCore')), ds = mean(plat, (s) => ratio(s, 'dStriatum'));
    assert.ok(core >= 1.4 && core <= 2.0 && near(core, 1.46), `core ${fmt(core)}×`);
    assert.ok(near(mean(plat, (s) => ratio(s, 'naccShell')), 1.41), 'shell');
    assert.ok(near(ds, 1.33) && ds < core, `dorsal striatum ${fmt(ds)}×`);
    assert.ok(near(mean(plat, (s) => ratio(s, 'mPFC')), 1.41), 'PFC');
  });

  test('row 7: MPOA rises before and during the plateau (+43 % at 2 min, +54 % at 4 min; plateau 1.61×)', () => {
    const ref = reference();
    assert.ok(near(ratio(at(ref.tr, STIM_ON + 120), 'MPOA') - 1, 0.43), '2 min');
    assert.ok(near(ratio(at(ref.tr, STIM_ON + 240), 'MPOA') - 1, 0.54), '4 min');
    assert.ok(near(mean(plateauOf(ref), (s) => ratio(s, 'MPOA')), 1.61), 'plateau');
  });

  test('row 8: peak population rates (VTA-l 17.4, VTA-m 13.7, SNc 9.1 Hz), below the 20-Hz ceiling, SNc below the VTA', () => {
    const { tr } = reference();
    let vl = 0, vm = 0, sn = 0;
    for (const s of tr) { vl = Math.max(vl, s.vtal); vm = Math.max(vm, s.vtam); sn = Math.max(sn, s.snc); }
    assert.ok(near(vl, 17.4) && near(vm, 13.7) && near(sn, 9.1), `${fmt(vl, 1)} / ${fmt(vm, 1)} / ${fmt(sn, 1)} Hz`);
    assert.ok(vl < PARAMS.nuSat && sn < vm && sn < vl);
  });

  test('row 9: climax peaks set by the equations (core 53.3 nM 0.7 s after ignition, dorsal striatum 45.4, ripple ≤ 2.9 nM)', () => {
    const ref = reference();
    const ig = ref.marks.onset[0], te = ref.marks.resolutionEarly[0];
    const cl = ref.tr.filter((s) => s.t >= ig && s.t <= te);
    const pk = argmax(cl, (s) => s.C[F.naccCore]);
    assert.ok(near(pk.C[F.naccCore], 53.3), `core ${fmt(pk.C[F.naccCore], 2)} nM`);
    assert.ok(near(pk.t - ig, 0.7), `at +${fmt(pk.t - ig, 2)} s`);
    assert.ok(near(Math.max(...cl.map((s) => s.C[F.dStriatum])), 45.4), 'dorsal striatum');
    assert.ok(near(Math.max(...cl.map((s) => s.C[F.naccShell])), 46.8), 'shell');
    // Ripple: detrended peak-to-peak of the core within each regular contraction interval.
    const t0 = ref.marks.orgasm[0];
    const times = [0, 0.80, 1.60, 2.40, 3.26, 4.20, 5.21, 6.29, 7.47];
    for (let k = 0; k + 1 < times.length; k++) {
      const seg = ref.tr.filter((s) => s.t >= t0 + times[k] && s.t < t0 + times[k + 1]);
      const n = seg.length, a = seg[0].C[F.naccCore], b = seg[n - 1].C[F.naccCore];
      const dev = seg.map((s, i) => s.C[F.naccCore] - (a + (b - a) * i / Math.max(1, n - 1)));
      assert.ok(Math.max(...dev) - Math.min(...dev) <= 2.9, `interval ${k + 1}: ripple ${fmt(Math.max(...dev) - Math.min(...dev), 2)} nM`);
    }
  });

  const POST = {
    sustained: { 0.5: 1.28, 1: 1.25, 2: 1.18, 5: 1.11, 10: 1.07, 20: 1.04, 30: 1.02 },
    dip: { 0.5: 1.10, 1: 1.04, 2: 0.98, 5: 0.96, 10: 1.00, 20: 1.02 },
  };
  for (const hyp of ['sustained', 'dip']) {
    test(`row 10 (${hyp}): NAcc falls from its plateau level after the orgasm, on the §6.9 course`, () => {
      const ref = reference(hyp);
      const te = ref.marks.resolutionEarly[0];
      const plat = mean(plateauOf(ref), (s) => ratio(s, 'naccCore'));
      for (const [min, x] of Object.entries(POST[hyp])) {
        const r = ratio(at(ref.tr, te + 60 * min), 'naccCore');
        assert.ok(r < plat, `+${min} min below the plateau`);
        assert.ok(near(r, x), `+${min} min: ${fmt(r)}× (target ${x})`);
      }
      const post = ref.tr.filter((s) => s.t > te && s.t < te + 1800);
      const lo = argmin(post, (s) => ratio(s, 'naccCore'));
      if (hyp === 'sustained') assert.ok(ratio(lo, 'naccCore') >= 1, 'never below rest');
      else {
        assert.ok(near(ratio(lo, 'naccCore'), 0.955, 0.02), `minimum ${fmt(ratio(lo, 'naccCore'))}×`);
        assert.ok(near((lo.t - te) / 60, 3.5), `at +${fmt((lo.t - te) / 60, 2)} min`);
      }
    });
  }

  test('row 11: MPOA after the orgasm (0.81–0.83× at +0.5–2 min, 0.88× at +5 min, 1.0× by ~20 min)', () => {
    const ref = reference();
    const te = ref.marks.resolutionEarly[0];
    for (const [min, x] of [[0.5, 0.82], [2, 0.82], [5, 0.88], [20, 1.0]]) {
      const r = ratio(at(ref.tr, te + 60 * min), 'MPOA');
      assert.ok(near(r, x, 0.1), `+${min} min: ${fmt(r)}×`);
    }
  });

  test('row 12: median eminence (TIDA) dips to 0.42× at +17 s, then rebounds to 1.43–1.51× at 20–30 min', () => {
    const ref = reference();
    const te = ref.marks.resolutionEarly[0];
    const lo = argmin(ref.tr.filter((s) => s.t >= te && s.t <= te + 60), (s) => ratio(s, 'medEminence'));
    assert.ok(near(ratio(lo, 'medEminence'), 0.42), `trough ${fmt(ratio(lo, 'medEminence'))}×`);
    assert.ok(near(lo.t - te, 17), `at +${fmt(lo.t - te, 1)} s`);
    const rebound = mean(ref.tr.filter((s) => s.t >= te + 1200 && s.t <= te + 1800), (s) => ratio(s, 'medEminence'));
    assert.ok(rebound >= 1.43 * 0.98 && rebound <= 1.51 * 1.02, `20–30 min ${fmt(rebound)}×`);
  });

  test('row 13: spinal (A11) field ×2.4 at the end of the train and < 1.02× by ~20 min', () => {
    const ref = reference();
    const te = ref.marks.resolutionEarly[0];
    assert.ok(near(ratio(at(ref.tr, te), 'spinal'), 2.4), `te ${fmt(ratio(at(ref.tr, te), 'spinal'))}×`);
    assert.ok(ratio(at(ref.tr, te + 1200), 'spinal') < 1.03, '20 min');
  });

  test('row 14: a distraction cue 30 s into the plateau gives a partial, short pause (VTA-l 6.9 → 3.4 Hz, core 0.72× rest)', () => {
    let tCue = null;
    const { tr } = humanRun({
      T: STIM_ON + 900, S: (t) => (t >= STIM_ON ? 1 : 0),
      hook: (t, m, mk) => { if (tCue == null && mk.plateau && t >= mk.plateau[0] + 30) { tCue = t; m.distract(); } },
      stop: (m) => tCue != null && m.tHuman > tCue + 10,
    });
    const pre = tr.filter((s) => s.t <= tCue + 1e-9).at(-1);
    const win = tr.filter((s) => s.t > tCue && s.t <= tCue + 5);
    const vmin = Math.min(...win.map((s) => s.vtal));
    assert.ok(near(pre.vtal, 6.9) && near(vmin, 3.4), `VTA-l ${fmt(pre.vtal, 1)} → ${fmt(vmin, 1)} Hz`);
    const lo = argmin(win, (s) => ratio(s, 'naccCore'));
    assert.ok(near(ratio(lo, 'naccCore'), 0.72), `core ${fmt(ratio(lo, 'naccCore'))}×`);
    const below = win.filter((s) => ratio(s, 'naccCore') < 0.8).length * DELTA;
    assert.ok(near(below, 0.8, 0.35), `below 0.8× for ${fmt(below, 2)} s`);
  });

  test('row 15: withdrawing stimulation 30 s into the plateau (0.74× at +0.4 s, 1.22× at +30 s, 1.14× at +2 min)', () => {
    let tOff = null;
    const { tr } = humanRun({
      T: STIM_ON + 1200,
      S: (t, m, mk) => { if (mk.plateau && t >= mk.plateau[0] + 30) { tOff ??= t; return 0; } return t >= STIM_ON ? 1 : 0; },
      stop: (m) => tOff != null && m.tHuman > tOff + 330,
    });
    const lo = argmin(tr.filter((s) => s.t > tOff && s.t <= tOff + 10), (s) => ratio(s, 'naccCore'));
    assert.ok(near(ratio(lo, 'naccCore'), 0.74), `minimum ${fmt(ratio(lo, 'naccCore'))}×`);
    assert.ok(near(ratio(at(tr, tOff + 30), 'naccCore'), 1.22), '+30 s');
    assert.ok(near(ratio(at(tr, tOff + 120), 'naccCore'), 1.14), '+2 min');
    assert.ok(near(ratio(at(tr, tOff + 300), 'naccCore'), 1.05), '+5 min');
  });

  test('row 16: repeated orgasms with stimulation held (multiple profile): 10 orgasms in 2,000 s, ŵ 0.50 → 0.79, no runaway', () => {
    const { marks, d, tr } = humanRun({ profile: 'multiple', T: STIM_ON + 2000, S: (t) => (t >= STIM_ON ? 1 : 0) });
    assert.equal(marks.orgasm.length, 10);
    assert.ok(near(d.w, 0.79, 0.05), `ŵ ${fmt(d.w)}`);
    assert.ok(Math.max(...tr.map((s) => ratio(s, 'naccCore'))) < 4.0, 'no runaway');
  });

  test('row 18: κ-opioid brake 5–10 % in the plateau (F_K = 0.943)', () => {
    const fk = mean(plateauOf(reference()), (s) => 1 / (1 + s.K));
    assert.ok(near(1 - fk, 0.057) && fk >= 0.9 && fk <= 0.95, `F_K ${fmt(fk, 4)}`);
  });

  test('row 19: bounds: positive and finite, C/C0 within [0.42, 3.82], max D2 0.83, max D1 0.054; back to rest', () => {
    let lo = Infinity, hi = 0, d2 = 0, d1 = 0;
    for (const hyp of ['sustained', 'dip']) {
      for (const s of reference(hyp).tr) {
        s.C.forEach((c, j) => {
          assert.ok(Number.isFinite(c) && c > 0);
          lo = Math.min(lo, c / FIELDS[j].C0); hi = Math.max(hi, c / FIELDS[j].C0);
        });
        for (const th of s.th) assert.ok(th >= 0 && th <= 1);
        d2 = Math.max(d2, s.d2); d1 = Math.max(d1, s.d1);
      }
    }
    assert.ok(lo >= 0.42 - 0.01 && hi <= 3.82, `C/C0 in [${fmt(lo)}, ${fmt(hi)}]`);
    assert.ok(d2 <= 0.83 && d1 <= 0.054, `D2 ${fmt(d2)}, D1 ${fmt(d1, 4)}`);
    const { d } = reference();
    FIELDS.forEach((f, j) => assert.ok(Math.abs(d.C[j] / f.C0 - 1) < 0.15, `${f.id} ${fmt(d.C[j] / f.C0)}× at baseline re-entry`));
  });

  test('row 20: deterministic θ 8.12 min; baseline re-entered 94.4 min after the orgasm end; R(60 min) = 0.47', () => {
    const ref = reference();
    const te = ref.marks.resolutionEarly[0];
    assert.ok(near((ref.marks.onset[0] - STIM_ON) / 60, 8.12, 0.02), `θ ${fmt((ref.marks.onset[0] - STIM_ON) / 60)} min`);
    assert.ok(near((ref.marks.baseline[0] - te) / 60, 94.4, 0.02), `baseline +${fmt((ref.marks.baseline[0] - te) / 60, 2)} min`);
    assert.ok(near(ref.m._Rat(te + 3600), 0.47, 0.03), `R(60 min) ${fmt(ref.m._Rat(te + 3600))}`);
  });

  test('row 20: median time to θ over 20 seeds within ±20 % of the RESPONSE.md §7.4 target (7.4 min)', () => {
    const th = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { marks } = humanRun({ seed, deterministic: false, T: 1800, S: refStim, stop: (m, mk) => !!mk.onset });
      th.push((marks.onset[0] - STIM_ON) / 60);
    }
    th.sort((a, b) => a - b);
    const median = (th[9] + th[10]) / 2;
    assert.ok(near(median, 7.4), `median ${fmt(median, 2)} min`);
  });
});

// --- §9.7, second test: demo mode in screen time ---

describe('DOPAMINE.md §9.7 demo mode in screen time at 10, 30, 60 and 240 fps', () => {
  const runs = new Map();
  const demo = (fps) => {
    if (!runs.has(fps)) {
      let onsetPeak = 0, twinkle = 0, spark = 0;
      const prevPh = new Float32Array(REGION_COUNT * 2);
      const r = demoRun({
        fps, seconds: 140,
        perFrame: (tS, m, d, dt) => {
          if (tS <= 10) onsetPeak = Math.max(onsetPeak, d.Cmax[F.naccCore]);
          // Per-point twinkle frequency: phase advance per second × the shader's largest rate factor.
          for (let r = 0; r < REGION_COUNT; r++) {
            const a = (d.da[r * 4 + 1] - prevPh[r * 2] + 4096) % 4096, b = (d.da[r * 4 + 2] - prevPh[r * 2 + 1] + 4096) % 4096;
            twinkle = Math.max(twinkle, a / dt * PARAMS.somaKMax);
            spark = Math.max(spark, b / dt * PARAMS.sparkKMax);
            prevPh[r * 2] = d.da[r * 4 + 1]; prevPh[r * 2 + 1] = d.da[r * 4 + 2];
          }
        },
      });
      runs.set(fps, { ...r, onsetPeak, twinkle, spark });
    }
    return runs.get(fps);
  };

  test('ONSET lasts exactly 2.5 s on screen at every frame rate', () => {
    for (const fps of [10, 30, 60, 240]) {
      const { phases } = demo(fps);
      const a = phases.find((p) => p.phase === 'onset'), b = phases.find((p) => p.phase === 'orgasm');
      assert.ok(a && b, `${fps} fps: no climax`);
      assert.ok(Math.abs(b.tS - a.tS - 2.5) <= 1 / fps + 1e-9, `${fps} fps: ${fmt(b.tS - a.tS, 4)} s`);
    }
  });

  test('row 21: the onset peak (maximum over dopamine substeps) is 38.30 nM within ±0.5 nM at every frame rate', () => {
    for (const fps of [10, 30, 60, 240]) {
      const { onsetPeak } = demo(fps);
      assert.ok(Math.abs(onsetPeak - 38.3) <= 0.5, `${fps} fps: ${fmt(onsetPeak, 2)} nM`);
    }
  });

  test('§9.6 timeline at 60 fps: ignition at 51.7 s, orgasm end at 69.8 s, baseline at 131.3 s of screen time', () => {
    const { phases } = demo(60);
    const tOf = (ph) => phases.find((p) => p.phase === ph).tS;
    assert.ok(Math.abs(tOf('excitement') - 3.0) < 0.1);
    assert.ok(Math.abs(tOf('plateau') - 37.7) < 0.3);
    assert.ok(Math.abs(tOf('onset') - 51.7) < 0.3);
    assert.ok(Math.abs(tOf('resolutionEarly') - 69.8) < 0.3);
    assert.ok(Math.abs(tOf('resolutionLate') - 85.5) < 0.3);
    assert.ok(Math.abs(tOf('recovery') - 110.9) < 0.3);
    assert.ok(Math.abs(tOf('baseline') - 131.3) < 0.5);
  });

  test('lantern E varies by ≤ 0.025 within any contraction interval in both climax modes (§6.10)', () => {
    for (const pulseLocked of [false, true]) {
      const E = [];
      const { m } = demoRun({
        fps: 60, seconds: 75, pulseLocked,
        perFrame: (tS, mm, d) => { if (mm.phase === 'orgasm') E.push({ t: mm.train.t, core: d.vis.E[F.naccCore], ds: d.vis.E[F.dStriatum] }); },
      });
      const times = m.train.times;
      for (let k = 0; k + 1 < times.length && k < 8; k++) {
        const seg = E.filter((s) => s.t >= times[k] && s.t < times[k + 1]);
        if (seg.length < 2) continue;
        for (const key of ['core', 'ds']) {
          const n = seg.length, a = seg[0][key], b = seg[n - 1][key];
          const dev = seg.map((s, i) => s[key] - (a + (b - a) * i / (n - 1)));
          const pp = Math.max(...dev) - Math.min(...dev);
          assert.ok(pp <= 0.025, `${pulseLocked ? 'pulse-locked' : 'default'} ${key} interval ${k + 1}: ${fmt(pp, 4)}`);
        }
      }
    }
  });

  test('no single point twinkles faster than 2 Hz (somata and release sparks)', () => {
    for (const fps of [10, 30, 60, 240]) {
      const { twinkle, spark } = demo(fps);
      // The phases are stored in a Float32Array, so allow float32 rounding (< 0.5 %).
      assert.ok(twinkle <= PARAMS.hzMax * 1.005, `${fps} fps: soma ${fmt(twinkle)} Hz`);
      assert.ok(spark <= PARAMS.hzMax * 1.005, `${fps} fps: spark ${fmt(spark)} Hz`);
    }
  });

  test('prefers-reduced-motion halves the flare and imaging amplitudes and stops the tract flow (§10 rule 6)', () => {
    const peakE = (reducedMotion) => {
      let flare = 0, ofc = 1, flowVar = 0;
      demoRun({
        fps: 60, seconds: 60, reducedMotion, imaging: true,
        perFrame: (tS, m, d) => {
          const j = F.naccCore;
          flare = Math.max(flare, d.vis.E[j]);
          ofc = Math.min(ofc, d.region[R.ofc * 4]);
          for (const x of d.pathHist) flowVar = Math.max(flowVar, Math.abs(x - 0.5));
        },
      });
      return { flare, ofc, flowVar };
    };
    const on = peakE(true), off = peakE(false);
    assert.ok(on.flare < off.flare, `flare ${fmt(on.flare)} < ${fmt(off.flare)}`);
    assert.ok(Math.abs((1 - on.ofc) - 0.5 * (1 - off.ofc)) < 0.01, `imaging ${fmt(1 - on.ofc)} vs ${fmt(1 - off.ofc)}`);
    assert.equal(on.flowVar, 0, 'tract flow off');
    assert.ok(off.flowVar > 0);
  });

  test('rendered relative luminance changes by ≤ 0.1 per ⅓ s once a glow exceeds the area limit (§10 rule 2)', { todo: 'needs the composited frame (browser check; src/safety.js PhotoLimiter is unit-tested in safety.test.mjs)' });
  test('no concurrently changing pixel set > 0.006 sr in a 10° field flashes more than three times per second (§10 rule 1)', { todo: 'needs the composited frame (browser check; safety.test.mjs covers the per-cell rule on model output)' });
});

// --- §9.7, third test: multiple profile ---

describe('DOPAMINE.md §9.7 multiple profile in demo mode', () => {
  test('after the second peak the cycle passes RESOLUTION_EARLY → LATE → RECOVERY → BASELINE (≈ 165 s)', () => {
    const { phases } = demoRun({ fps: 60, seconds: 200, profile: 'multiple' });
    const orgasms = phases.map((p, i) => (p.phase === 'orgasm' ? i : -1)).filter((i) => i >= 0);
    assert.ok(orgasms.length >= 2, 'two peaks');
    assert.ok(Math.abs(phases[orgasms[1]].tS - phases[orgasms[0]].tS - 33.4) < 0.5, 'second peak 33.4 s later');
    const after = phases.slice(orgasms[1] + 1);
    assert.deepEqual(after.slice(0, 4).map((p) => p.phase), ['resolutionEarly', 'resolutionLate', 'recovery', 'baseline']);
    assert.ok(Math.abs(after[3].tS - 164.6) < 1, `baseline at ${fmt(after[3].tS, 1)} s`);
  });
});
