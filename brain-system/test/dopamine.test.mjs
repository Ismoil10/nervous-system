// DOPAMINE.md §9.7 test suite, run on the current code: response.js before the DOPAMINE.md §9.8
// port (pre-correction galaxy equations, 0.5-s substeps, no ONSET phase, no { deterministic }
// option) and dopamine.js unchanged. Where the current code can be held to a §6.9 row, the row's
// literature target (or the stated analytic value) is asserted; the model-result columns of §6.9
// and §9.6 describe the ported model and wait for the port, so those cases are marked todo with the
// reason. Human-time runs drive ResponseModel.advanceHuman(Δ, S) directly with Δ = 0.05 s (§9.7);
// every run is seeded (mulberry32 through the ResponseModel constructor).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResponseModel, CLOCK } from '../src/response.js';
import { DopamineModel, FIELDS, POPS } from '../src/dopamine.js';

const F = Object.fromEntries(FIELDS.map((f, i) => [f.id, i]));
const P = Object.fromEntries(POPS.map((p, i) => [p.id, i]));
const DELTA = 0.05;                     // §9.7: human-time step of the Node suite (s)
const STIM_ON = 60;                     // §6.9 reference: S = 1 from 60 s until the orgasm end
const PORT = 'waits for the DOPAMINE.md §9.8 port';

// --- Human-time driver ---

function humanRun({ seed = 1, profile = 'single', hypothesis = 'satiety', T, S, hook = null, stop = null }) {
  const m = new ResponseModel({ seed });
  m.setProfile(profile);
  m.setMode('manual');
  const d = new DopamineModel();
  d.setHypothesis(hypothesis);
  m.onStep = (h) => d.step(h, m);
  const tr = [], marks = {};
  let last = m.phase;
  for (let k = 0; k * DELTA < T; k++) {
    const t = k * DELTA;
    hook?.(t, m, marks);
    m.advanceHuman(DELTA, S(t, m, marks));
    if (m.phase !== last) { (marks[m.phase] ??= []).push(m.tHuman); last = m.phase; }
    tr.push({
      t: m.tHuman, phase: m.phase, C: Array.from(d.C), vtal: d.nu[P.VTAl],
      d1: d.th1[F.naccCore], d2: d.th2[F.naccCore], th: [...d.th1, ...d.th2],
    });
    if (stop?.(m, marks)) break;
  }
  return { tr, marks, m, d };
}
const ratio = (s, id) => s.C[F[id]] / FIELDS[F[id]].C0;
const mean = (arr, fn) => arr.reduce((a, s) => a + fn(s), 0) / arr.length;
const at = (tr, t) => tr.find((s) => s.t >= t);

// §6.9 reference stimulus on the current model: S = 1 from 60 s until the orgasm end, then 0.
const refStim = (t, m, mk) => (t >= STIM_ON && !mk.resolutionEarly ? 1 : 0);
const memo = new Map();
function reference(hypothesis = 'satiety') {
  if (!memo.has(hypothesis)) {
    memo.set(hypothesis, humanRun({
      hypothesis, T: 4000, S: refStim,
      stop: (m, mk) => mk.resolutionEarly && m.tHuman > mk.resolutionEarly[0] + 31 * 60,
    }));
  }
  return memo.get(hypothesis);
}

// Screen-time demo run (the legacy update(dt) path, frame dt fixed).
function demoRun({ fps, seconds, profile = 'single', seed = 1 }) {
  const m = new ResponseModel({ seed });
  m.setProfile(profile);
  const d = new DopamineModel();
  m.onStep = (h) => d.step(h, m);
  const phases = [];
  let tS = 0, last = m.phase;
  for (let k = 0; k < Math.round(seconds * fps); k++) {
    const dt = 1 / fps;
    const clk = m.update(dt);
    tS += dt;
    m.events.length = 0;
    d.updateVisuals(dt, m, clk.kh);
    if (m.phase !== last) { phases.push({ phase: m.phase, tS, tH: m.tHuman }); last = m.phase; }
  }
  return { phases, m, d };
}

// --- §6.9 rows ---

describe('DOPAMINE.md §6.9 rows on the current code (human time, Δ = 0.05 s)', () => {
  const rest = () => humanRun({ T: 600, S: () => 0 });

  test('row 1: tonic NAcc / dorsal striatum / PFC at rest (5–20 / 5–20 / 0.5–2 nM; model 15 / 20 / 2.0)', () => {
    const s = rest().tr.at(-1);
    for (const [id, nM] of [['naccCore', 15], ['dStriatum', 20], ['mPFC', 2]]) {
      const c = s.C[F[id]];
      assert.ok(Math.abs(c - nM) <= 0.2 * nM, `${id} ${c.toFixed(2)} nM`);
    }
    assert.equal(s.phase, 'baseline');
  });

  test('row 2: NAcc core receptor occupancy at rest (D2 0.5–0.67, D1 0.01–0.05; model 0.60 / 0.015)', () => {
    const s = rest().tr.at(-1);
    assert.ok(s.d2 >= 0.5 && s.d2 <= 0.67, `D2 ${s.d2}`);
    assert.ok(s.d1 >= 0.01 && s.d1 <= 0.05, `D1 ${s.d1}`);
    assert.equal(s.d2.toFixed(2), '0.60');
    assert.equal(s.d1.toFixed(3), '0.015');
  });

  test('row 3: clearance half-times ln 2·τ_clear at C0 (3 significant figures)', () => {
    // K_m is not exported by dopamine.js; recover it from the release scale q_j, which is set so that
    // tonic firing gives C0: q_j·Σπν0 = Vmax·C0/(Km + C0) + k_l·C0 (DOPAMINE.md §6.4).
    const d = new DopamineModel();
    const expected = { dStriatum: '0.0379', naccCore: '0.0591', naccShell: '0.122', mPFC: '0.697', amygdala: '0.880', MPOA: '2.31', PVN: '2.31', medEminence: '3.47' };
    FIELDS.forEach((f, j) => {
      if (f.Vmax > 0) {
        const drive = Object.entries(f.src).reduce((a, [id, w]) => a + w * POPS[P[id]].nu0, 0);
        const Km = f.Vmax * f.C0 / (d.q[j] * drive - f.kl * f.C0) - f.C0;
        assert.ok(Math.abs(Km - 200) < 1e-6, `${f.id}: Km ${Km}`);   // DOPAMINE.md §3.7, §6.5
      }
      if (!expected[f.id]) return;
      const tHalf = Math.LN2 / (f.Vmax / (200 + f.C0) + f.kl);
      assert.equal(tHalf.toPrecision(3), expected[f.id], f.id);
    });
  });

  test('row 4: onset transient in NAcc core: tens of nM, rise within 1 s, decay to half < 1.5 s', () => {
    const { tr } = reference();
    const win = tr.filter((s) => s.t >= STIM_ON && s.t <= STIM_ON + 6);
    const pk = win.reduce((a, s) => (s.C[F.naccCore] > a.C[F.naccCore] ? s : a));
    const rise = pk.C[F.naccCore] - FIELDS[F.naccCore].C0;
    assert.ok(rise >= 10 && rise < 100, `rise ${rise.toFixed(1)} nM`);
    assert.ok(pk.t - STIM_ON <= 1, `peak at +${(pk.t - STIM_ON).toFixed(2)} s`);
    const half = FIELDS[F.naccCore].C0 + rise / 2;
    const back = tr.find((s) => s.t > pk.t && s.C[F.naccCore] < half);
    assert.ok(back.t - pk.t < 1.5, `half decay ${(back.t - pk.t).toFixed(2)} s`);
  });

  test('row 6: tonic rise during stimulation +40–100 % (NAcc core plateau mean), dorsal striatum smaller', () => {
    const { tr, marks } = reference();
    const plat = tr.filter((s) => s.phase === 'plateau' && s.t < marks.inevitability[0]);
    const core = mean(plat, (s) => ratio(s, 'naccCore')), ds = mean(plat, (s) => ratio(s, 'dStriatum'));
    assert.ok(core >= 1.4 && core <= 2.0, `core ${core.toFixed(2)}×`);
    assert.ok(ds < core, `dorsal striatum ${ds.toFixed(2)}× vs core ${core.toFixed(2)}×`);
  });

  test('row 7: MPOA dopamine rises before and during the plateau', () => {
    const { tr, marks } = reference();
    const exc = mean(tr.filter((s) => s.phase === 'excitement' && s.t > STIM_ON + 60), (s) => ratio(s, 'MPOA'));
    const plat = mean(tr.filter((s) => s.phase === 'plateau' && s.t < marks.inevitability[0]), (s) => ratio(s, 'MPOA'));
    assert.ok(exc > 1.1, `excitement ${exc.toFixed(2)}×`);
    assert.ok(plat > 1.2, `plateau ${plat.toFixed(2)}×`);
  });

  for (const hyp of ['satiety', 'sustained']) {
    test(`row 10 (${hyp}): NAcc falls from its copulation (plateau) level after the orgasm`, () => {
      const { tr, marks } = reference(hyp);
      const te = marks.resolutionEarly[0];
      const plat = mean(tr.filter((s) => s.phase === 'plateau' && s.t < marks.inevitability[0]), (s) => ratio(s, 'naccCore'));
      for (const min of [1, 2, 5, 10]) assert.ok(ratio(at(tr, te + 60 * min), 'naccCore') < plat, `+${min} min`);
    });
  }

  test('row 12: median eminence (TIDA) dips after the orgasm, then rebounds through the prolactin short loop', () => {
    const { tr, marks } = reference();
    const te = marks.resolutionEarly[0];
    const trough = Math.min(...tr.filter((s) => s.t >= te && s.t <= te + 60).map((s) => ratio(s, 'medEminence')));
    const rebound = mean(tr.filter((s) => s.t >= te + 1200 && s.t <= te + 1800), (s) => ratio(s, 'medEminence'));
    assert.ok(trough < 0.7, `trough ${trough.toFixed(2)}×`);
    assert.ok(rebound > 1.2, `20–30 min ${rebound.toFixed(2)}×`);
  });

  test('row 13: spinal (A11) field rises over the contraction train and returns toward rest', () => {
    const { tr, marks } = reference();
    const te = marks.resolutionEarly[0];
    assert.ok(ratio(at(tr, te), 'spinal') > 1.5);
    assert.ok(ratio(at(tr, te + 1800), 'spinal') < 1.1);
  });

  test('row 14: a distraction cue gives a partial, short pause (negative prediction error)', () => {
    let tCue = null;
    const { tr } = humanRun({
      T: STIM_ON + 600, S: (t) => (t >= STIM_ON ? 1 : 0),
      hook: (t, m, mk) => { if (tCue == null && mk.plateau && t >= mk.plateau[0] + 30) { tCue = t; m.distract(); } },
      stop: (m) => tCue != null && m.tHuman > tCue + 10,
    });
    const pre = tr.filter((s) => s.t <= tCue).at(-1);
    const win = tr.filter((s) => s.t > tCue && s.t <= tCue + 5);
    const vmin = Math.min(...win.map((s) => s.vtal));
    assert.ok(vmin < 0.7 * pre.vtal && vmin > 0, `VTA-l ${pre.vtal.toFixed(1)} → ${vmin.toFixed(1)} Hz (partial pause)`);
    const below = win.filter((s) => ratio(s, 'naccCore') < 0.8).length * DELTA;
    assert.ok(below > 0 && below < 2, `below 0.8× rest for ${below.toFixed(2)} s (short)`);
  });

  test('row 15: withdrawing stimulation 30 s into the plateau gives a bounded, brief dip', () => {
    let tOff = null;
    const { tr } = humanRun({
      T: STIM_ON + 600,
      S: (t, m, mk) => { if (mk.plateau && t >= mk.plateau[0] + 30) { tOff ??= t; return 0; } return t >= STIM_ON ? 1 : 0; },
      stop: (m) => tOff != null && m.tHuman > tOff + 15,
    });
    const win = tr.filter((s) => s.t > tOff && s.t <= tOff + 10);
    const lo = Math.min(...win.map((s) => ratio(s, 'naccCore')));
    const below = win.filter((s) => ratio(s, 'naccCore') < 0.8).length * DELTA;
    assert.ok(lo > 0.42, `minimum ${lo.toFixed(2)}× (row 19 lower bound)`);
    assert.ok(below < 3, `below 0.8× for ${below.toFixed(2)} s`);
  });

  test('row 19: bounds: positive and finite, occupancies in [0, 1], back to rest at baseline re-entry', () => {
    for (const hyp of ['satiety', 'sustained']) {
      for (const s of reference(hyp).tr) {
        for (const c of s.C) assert.ok(Number.isFinite(c) && c > 0);
        for (const th of s.th) assert.ok(th >= 0 && th <= 1);
      }
    }
    const { phases, d } = demoRun({ fps: 60, seconds: 134 });
    assert.equal(phases.at(-1).phase, 'baseline', 'the demo cycle returns to baseline');
    FIELDS.forEach((f, j) => assert.ok(Math.abs(d.C[j] / f.C0 - 1) < 0.15, `${f.id} ${(d.C[j] / f.C0).toFixed(3)}× at baseline re-entry`));
  });

  test('row 20: median time to θ over 20 seeds within ±20 % of the RESPONSE.md §7.4 target (7.4 min)', () => {
    const th = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { marks } = humanRun({ seed, T: 1800, S: refStim, stop: (m, mk) => !!mk.inevitability });
      th.push((marks.inevitability[0] - STIM_ON) / 60);
    }
    th.sort((a, b) => a - b);
    const median = (th[9] + th[10]) / 2;
    assert.ok(Math.abs(median - 7.4) <= 0.2 * 7.4, `median ${median.toFixed(2)} min`);
  });

  test('rows 1–20, model-result columns on the deterministic reference ({ deterministic: true }: η = 0, q = 0.5, tail at 10.47 and 13.47 s)', { todo: `${PORT}: the constructor option and the corrected galaxy equations (§9.1, §6.7)` });
  test('row 8: peak population rates 12–20 Hz, never at the ceiling, SNc below the VTA', { todo: `${PORT}: the current firing law clamps at 30 Hz and the climax reaches it (soft ceiling 20 Hz, β 25 / 10 / 6 s)` });
  test('row 9: climax peaks set by the equations (core 53.3 nM, ripple ≤ 2.9 nM per contraction interval)', { todo: `${PORT}: the current pulse-locked default drives the core to ≈ 88 nM at the 30-Hz clamp` });
  test('row 18: κ-opioid brake 5–10 % in plateau (F_K = 0.943)', { todo: `${PORT}: g_K = 0.2, τ_K = 300 s; the current k_K = 1, τ_K = 120 s brake is < 1 %` });
  test('row 19: C/C0 within [0.42, 3.82], max D2 0.83, max D1 0.054', { todo: `${PORT}: the current climax reaches ≈ 5.9× in NAcc core and 6.1× in dorsal striatum` });
  test('row 20: stimulation resumed at T_ref, baseline re-entered 94.4 min after the orgasm end, R(60 min) = 0.47', { todo: `${PORT}: the current recovery returns to baseline ≈ 70 min after the orgasm end` });
});

// --- §9.7, second test: demo mode in screen time ---

describe('DOPAMINE.md §9.7 demo mode in screen time at 10, 30, 60 and 240 fps', () => {
  test('the climax window (`inevitability`, ONSET after the port) lasts 2.5 s on screen within the legacy one-frame error', () => {
    for (const fps of [10, 30, 60, 240]) {
      const { phases } = demoRun({ fps, seconds: 80 });
      const a = phases.find((p) => p.phase === 'inevitability'), b = phases.find((p) => p.phase === 'orgasm');
      assert.ok(a && b, `${fps} fps: no climax`);
      // Legacy: the frame of ignition finishes at the plateau kh (×10), so up to one frame of human
      // time at that kh counts toward the 2.5-s window; the end is quantised to one frame.
      const dt = 1 / fps, tol = dt * (CLOCK.plateau + 1) + 1e-9;
      assert.ok(Math.abs(b.tS - a.tS - 2.5) <= tol, `${fps} fps: ${(b.tS - a.tS).toFixed(3)} s`);
    }
  });

  test('ONSET lasts exactly 2.5 s on screen at every frame rate', { todo: `${PORT}: on a transition into ONSET the rest of the frame runs at the new kh (§9.1, §9.3)` });
  test('row 21: the onset peak (maximum over dopamine substeps) is equal within ±0.5 nM at every frame rate (38.30 nM)', { todo: `${PORT}: input interpolation and the 0.05-s step cap (§6.8); the current peak is 36.6–49.2 nM between 10 and 240 fps` });
  test('rendered relative luminance changes by ≤ 0.1 per ⅓ s once a glow exceeds the area limit (§10 rule 2)', { todo: 'needs the composited frame and the large-area slew limiter (renderer, safety.test.mjs)' });
  test('no concurrently changing pixel set > 0.006 sr in a 10° field flashes more than three times per second (§10 rule 1)', { todo: 'needs the composited frame (renderer, safety.test.mjs)' });
  test('lantern E varies by ≤ 0.025 within any contraction interval in both climax modes (§6.10)', { todo: `${PORT}: the current pulse-locked default swings lantern E by ≈ 0.37 per interval; alpha envelope and τ_vis ≥ 2 s rule` });
  test('no single point twinkles faster than 2 Hz', { todo: `${PORT}: the current soma spike rate reaches min(3, 0.4·ν)·k ≈ 4.2 Hz (§9.8 twinkle row)` });
  test('prefers-reduced-motion halves twinkle, flare and imaging amplitudes, stops the auto-orbit and the tract flow (§10 rule 6)', { todo: 'only the auto-orbit stop exists today (§9.8 reduced-motion row)' });
});

// --- §9.7, third test: multiple profile ---

describe('DOPAMINE.md §9.7 multiple profile in demo mode', () => {
  test('after the second peak the cycle passes RESOLUTION_EARLY → LATE → RECOVERY → BASELINE', () => {
    const { phases } = demoRun({ fps: 60, seconds: 200, profile: 'multiple' });
    const orgasms = phases.map((p, i) => (p.phase === 'orgasm' ? i : -1)).filter((i) => i >= 0);
    assert.ok(orgasms.length >= 2, 'two peaks');
    const after = phases.slice(orgasms[1] + 1).map((p) => p.phase);
    assert.deepEqual(after.slice(0, 4), ['resolutionEarly', 'resolutionLate', 'recovery', 'baseline']);
  });
});
