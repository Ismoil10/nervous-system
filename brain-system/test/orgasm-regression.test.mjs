// Orgasm scenario regression (research/ANALYSIS.md A.8 #21, §11.14, §12.13, B.13, B.14).
//
// 1. Golden traces: the legacy ResponseModel.update(dt) path, with its seeded stream, reproduces
//    test/golden/orgasm-legacy.json bit for bit. The golden file was recorded from response.js as
//    it was before the Phase 0 refactor, with Math.random replaced by mulberry32(seed), so this
//    proves that injecting the stream and extracting stimulusFor/advanceHuman changed nothing.
//    After an intentional change (the DOPAMINE.md §9.8 port) re-record with
//    UPDATE_GOLDEN=1 node --test test/orgasm-regression.test.mjs
// 2. Legacy vs adapter: SimClock (delegate) + OrgasmAdapter against update(dt), same frame-time
//    sequence and seed, identical ResponseModel and DopamineModel state at every human substep.
// 3. Adapter semantics: command ring, climax flag, dormancy, stop(), vitals pass-through, the
//    brain-only and neuroendocrine-off forms, and a user lock replacing the delegate.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { mulberry32 } from '../src/anatomy.js';
import { ResponseModel, PROFILES } from '../src/response.js';
import { DopamineModel } from '../src/dopamine.js';
import { SimClock } from '../src/clock.js';
import { OrgasmAdapter } from '../src/sim/orgasm-adapter.js';

const GOLDEN = new URL('./golden/orgasm-legacy.json', import.meta.url);

// --- Trace harness (the recorder of the golden file used the same code) ---

// Frame times jittered around 1/fps, with paused frames (dt 0) and hitches clamped at 0.1 s as in main.js.
function frameTimes(n, fps, seed) {
  const r = mulberry32(seed), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let dt = (1 / fps) * (0.7 + 0.6 * r());
    if (i % 97 === 50) dt = 0;
    else if (i % 211 === 105) dt = 0.25;
    out[i] = Math.min(0.1, Math.max(0, dt));
  }
  return out;
}

// Every own data field of both models, walked in sorted key order (functions and the stream skipped).
const SKIP = new Set(['onStep', 'rand', 'seed']);
const VIS_KEYS = new Set(['region', 'tint', 'da', 'pathHist', 'histAcc', 'vis']);   // screen-time state of DopamineModel
const M_UNDEF = -7.77e300, M_NULL = -8.88e300, M_STR = -9.99e300, M_ARR = -6.66e300, M_OBJ = -5.55e300;
function walk(v, out) {
  if (typeof v === 'number') out.push(v);
  else if (typeof v === 'boolean') out.push(v ? 1 : 0);
  else if (v === undefined) out.push(M_UNDEF);
  else if (v === null) out.push(M_NULL);
  else if (typeof v === 'string') { out.push(M_STR, v.length); for (let i = 0; i < v.length; i++) out.push(v.charCodeAt(i)); }
  else if (typeof v === 'function') { /* behaviour, not state */ }
  else if (Array.isArray(v) || ArrayBuffer.isView(v)) { out.push(M_ARR, v.length); for (let i = 0; i < v.length; i++) walk(v[i], out); }
  else walkObj(v, out, null, null);
}
function walkObj(o, out, only, except) {
  const keys = Object.keys(o).filter((k) => !SKIP.has(k) && typeof o[k] !== 'function'
    && (!only || only.has(k)) && (!except || !except.has(k))).sort();
  out.push(M_OBJ, keys.length);
  for (const k of keys) { walk(k, out); walk(o[k], out); }
}
function humanState(model, dopamine) {
  const out = [];
  walkObj(model, out, null, null);
  walkObj(dopamine, out, null, VIS_KEYS);
  return out;
}
// Screen-time state. The golden form keeps only the 33 regions of the original REGION_IDS: indices
// 0-32 never change (B.5), while REGION_COUNT grows with the A.3.3 additions.
const LEGACY_REGIONS = 33;
function visualState(model, dopamine, kh, full = false) {
  const out = [kh];
  if (full) walkObj(dopamine, out, VIS_KEYS, null);
  else {
    const n = LEGACY_REGIONS * 4, v = dopamine.vis;
    walk(dopamine.region.subarray(0, n), out);
    walk(dopamine.tint.subarray(0, n), out);
    walk(dopamine.da.subarray(0, n), out);
    walk(dopamine.pathHist, out);
    walk(dopamine.histAcc, out);
    walk({ E: v.E, spread: v.spread, fire: v.fire, act: v.act.subarray(0, LEGACY_REGIONS), omega: v.omega }, out);
  }
  walk(model.vitals(), out);
  return out;
}

// 64-bit hash over the IEEE-754 bits of every number (so -0, +0 and every last bit count).
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
class Hasher {
  constructor() { this.h1 = 0xdeadbeef | 0; this.h2 = 0x41c6ce57 | 0; this.n = 0; }
  add(x) {
    f64[0] = x;
    this.h1 = Math.imul(this.h1 ^ u32[0], 2654435761); this.h2 = Math.imul(this.h2 ^ u32[0], 1597334677);
    this.h1 = Math.imul(this.h1 ^ u32[1], 2654435761); this.h2 = Math.imul(this.h2 ^ u32[1], 1597334677);
    this.n++;
  }
  addAll(a) { for (let i = 0; i < a.length; i++) this.add(a[i]); }
  hex() {
    let h1 = this.h1, h2 = this.h2;
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
}

// Scripted manual inputs (screen seconds -> action), applied identically on every path.
const MANUAL_SCRIPT = [
  [1, (m) => m.setLevel(0.5)],
  [10, (m) => m.setHeld(true)],
  [30, (m) => m.distract()],
  [60, (m) => { m.setHeld(false); m.setLevel(0); }],
  [70, (m) => m.setLevel(0.8)],
];
const RUNS = [
  { id: 'demo-single', seed: 1, fps: 60, seconds: 145, mode: 'demo', profile: 'single', hypothesis: 'satiety', jitter: 11 },
  { id: 'demo-multiple', seed: 2, fps: 30, seconds: 90, mode: 'demo', profile: 'multiple', hypothesis: 'sustained', jitter: 12 },
  { id: 'manual-single', seed: 3, fps: 144, seconds: 80, mode: 'manual', profile: 'single', hypothesis: 'satiety', jitter: 13, script: true },
  { id: 'demo-noclimax', seed: 5, fps: 60, seconds: 100, mode: 'demo', profile: 'noclimax', hypothesis: 'satiety', jitter: 15 },
];
const WINDOW_S = 2;
const SNAP_EVERY = 5;

function scriptFrames(run) {
  const map = new Map();
  if (run.script) for (const [s, fn] of MANUAL_SCRIPT) map.set(Math.round(s * run.fps), fn);
  return map;
}

function snap(model, dopamine) {
  return {
    phase: model.phase, tHuman: model.tHuman, A: model.A, eta: model.eta, G: model.G, D: model.D,
    sigma: model.sigma, I: model.I, R: model.R, O: model.O, Omega: model.Omega, kh: model.kh.value,
    C: Array.from(dopamine.C), nu: Array.from(dopamine.nu), w: dopamine.w,
  };
}

function legacyModels(run) {
  const model = new ResponseModel({ seed: run.seed });
  model.setProfile(run.profile);
  model.setMode(run.mode);
  const dopamine = new DopamineModel();
  dopamine.setHypothesis(run.hypothesis);
  return { model, dopamine };
}

// The legacy frame loop in main.js order (L174-L176): update, clear events, screen-time visuals.
function traceLegacy(run, model, dopamine) {
  const n = Math.round(run.seconds * run.fps);
  const dts = frameTimes(n, run.fps, run.jitter);
  const script = scriptFrames(run);
  const sub = new Hasher(), vis = new Hasher();
  model.onStep = (h) => { dopamine.step(h, model); sub.addAll(humanState(model, dopamine)); };
  const win = Math.round(WINDOW_S * run.fps), windows = [];
  for (let f = 0; f < n; f++) {
    script.get(f)?.(model);
    const clk = model.update(dts[f]);
    model.events.length = 0;
    dopamine.updateVisuals(dts[f], model, clk.kh);
    vis.addAll(visualState(model, dopamine, clk.kh));
    if ((f + 1) % win === 0 || f === n - 1) {
      // Hashes are cumulative from frame 0; a readable snapshot every SNAP_EVERY windows and at the end.
      const w = { f: f + 1, n: sub.n, sub: sub.hex(), vis: vis.hex() };
      if (windows.length % SNAP_EVERY === 0 || f === n - 1) w.snap = snap(model, dopamine);
      windows.push(w);
    }
  }
  const dh = new Hasher(); dh.addAll(dts);
  return { id: run.id, frames: n, dtHash: dh.hex(), windows };
}

function diffSnap(a, b) {
  return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${k}: golden ${JSON.stringify(a[k])} vs now ${JSON.stringify(b[k])}`).join('; ');
}

// --- 1. Golden traces ---

describe('legacy update(dt) reproduces the pre-refactor golden traces bit for bit', () => {
  if (process.env.UPDATE_GOLDEN === '1') {
    test('re-record test/golden/orgasm-legacy.json from the current update(dt)', () => {
      const out = { format: 1, recordedFrom: `current src/response.js update(dt), re-recorded ${new Date().toISOString().slice(0, 10)}`, windowS: WINDOW_S, runs: [] };
      for (const run of RUNS) {
        const { model, dopamine } = legacyModels(run);
        out.runs.push({ ...run, script: !!run.script, ...traceLegacy(run, model, dopamine) });
      }
      writeFileSync(GOLDEN, JSON.stringify(out) + '\n');
    });
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  for (const run of RUNS) {
    test(run.id, () => {
      const g = golden.runs.find((r) => r.id === run.id);
      assert.ok(g, `golden run ${run.id} missing`);
      const { model, dopamine } = legacyModels(run);
      const tr = traceLegacy(run, model, dopamine);
      assert.equal(tr.dtHash, g.dtHash, 'frame-time generator changed');
      assert.equal(tr.windows.length, g.windows.length);
      for (let i = 0; i < g.windows.length; i++) {
        const a = g.windows[i], b = tr.windows[i];
        if (a.sub !== b.sub || a.vis !== b.vis || a.n !== b.n) {
          assert.fail(`${run.id}: first divergence in window ${i} (frames up to ${a.f}, ${i * WINDOW_S}-${(i + 1) * WINDOW_S} s): `
            + `${a.sub !== b.sub || a.n !== b.n ? 'human-time state' : 'screen-time state'} differs. `
            + (a.snap && b.snap ? diffSnap(a.snap, b.snap) : `n ${a.n} vs ${b.n}`));
        }
      }
    });
  }
  test('negative control: another seed diverges from the golden trace', () => {
    const run = { ...RUNS[0], seconds: 10 };
    const g = golden.runs.find((r) => r.id === run.id);
    const { model, dopamine } = legacyModels({ ...run, seed: run.seed + 1 });
    const tr = traceLegacy(run, model, dopamine);
    assert.notEqual(tr.windows[tr.windows.length - 1].sub, g.windows[tr.windows.length - 1].sub);
  });
});

// --- 2. Legacy path vs adapter path ---

function firstDiff(a, b) {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return `element ${i}: ${a[i]} vs ${b[i]}`;
  return null;
}

describe('adapter path equals the legacy path at every human substep (A.8 #21, B.13)', () => {
  for (const run of RUNS) {
    test(run.id, () => {
      const n = Math.round(run.seconds * run.fps);
      const dts = frameTimes(n, run.fps, run.jitter);
      const script = scriptFrames(run);

      const { model: mL, dopamine: dL } = legacyModels(run);
      let subL = [];
      mL.onStep = (h) => { dL.step(h, mL); subL.push(humanState(mL, dL)); };

      // Constructed with another seed and the default profile: start() must reseed and reconfigure.
      const mA = new ResponseModel({ seed: 987 });
      const dA = new DopamineModel();
      const adapter = new OrgasmAdapter(mA, dA);
      const clock = new SimClock({ tH: 1234.5 });
      let subA = [];
      adapter.onSubstep = () => subA.push(humanState(mA, dA));
      adapter.start({ mode: run.mode, profile: run.profile, hypothesis: run.hypothesis, seed: run.seed });
      clock.delegate(adapter.clock);

      let substeps = 0;
      for (let f = 0; f < n; f++) {
        const fn = script.get(f);
        if (fn) { fn(mL); fn(mA); }
        const clk = mL.update(dts[f]);
        const s = clock.advance(dts[f]);
        adapter.advance(dts[f], s.t0H, s.h);
        assert.ok(Object.is(s.kh, clk.kh), `frame ${f}: kh ${s.kh} vs legacy ${clk.kh}`);
        assert.equal(clock.source, 'delegate');
        assert.equal(subA.length, subL.length, `frame ${f}: substep count`);
        for (let k = 0; k < subL.length; k++) {
          const d = firstDiff(subL[k], subA[k]);
          if (d) assert.fail(`${run.id}: frame ${f}, substep ${k}, phase ${mL.phase}: ${d}`);
        }
        substeps += subL.length;
        subL = []; subA = [];
        mL.events.length = 0; mA.events.length = 0;
        dL.updateVisuals(dts[f], mL, clk.kh);
        dA.updateVisuals(dts[f], mA, s.kh);
        const d = firstDiff(visualState(mL, dL, clk.kh, true), visualState(mA, dA, s.kh, true));
        if (d) assert.fail(`${run.id}: frame ${f}, screen-time state: ${d}`);
      }
      assert.equal(adapter.commands.written, substeps, 'one command record per substep');
    });
  }
});

// --- 3. Adapter semantics ---

function makeAdapter(opts = {}) {
  const response = new ResponseModel();
  const dopamine = new DopamineModel();
  const adapter = new OrgasmAdapter(response, dopamine);
  const clock = new SimClock({ tH: 100 });
  adapter.start({ mode: 'demo', profile: 'single', seed: 1, ...opts });
  clock.delegate(adapter.clock);
  const frame = (dt = 1 / 60) => { const s = clock.advance(dt); adapter.advance(dt, s.t0H, s.h); response.events.length = 0; return s; };
  return { response, dopamine, adapter, clock, frame };
}

describe('OrgasmAdapter semantics (§11.14, B.4, B.13)', () => {
  test('command ring: one record per substep, tH monotone, last record at t1H, zero-order hold', () => {
    const { adapter, response, frame } = makeAdapter();
    let prevWritten = 0;
    for (let f = 0; f < 600; f++) {
      const s = frame(f % 50 === 7 ? 0 : 1 / 60);
      const ring = adapter.commands;
      assert.ok(ring.written > prevWritten, 'each frame writes at least one record');
      const last = ring.latest();
      assert.equal(last.tH, s.t1H);
      const d = response.drive();
      assert.equal(last.cmdSym, d.h);
      assert.equal(last.cmdVag, d.h);
      assert.equal(last.cmdSacral, response.G);
      assert.equal(last.apnoea, d.hold);
      assert.equal(last.omega, response.Omega);
      prevWritten = ring.written;
    }
    const ring = adapter.commands;
    for (let i = 1; i < ring.size; i++) assert.ok(ring.get(i).tH >= ring.get(i - 1).tH);
    const mid = ring.get(Math.floor(ring.size / 2));
    assert.equal(ring.sample(mid.tH).tH, mid.tH);
    assert.equal(ring.sample(mid.tH + 1e-9).tH <= mid.tH + 1e-9, true);
    assert.equal(ring.sample(ring.get(0).tH - 1), null);
    assert.deepEqual(ring.sample(1e12), ring.latest());
  });

  test('ring keeps the newest records when it wraps', () => {
    const { adapter, frame } = makeAdapter();
    const ring = adapter.commands;
    while (ring.written <= ring.capacity + 10) frame(0.1);
    assert.equal(ring.size, ring.capacity);
    for (let i = 1; i < ring.size; i++) assert.ok(ring.get(i).tH >= ring.get(i - 1).tH);
  });

  test('climax is true only in inevitability and orgasm while active', () => {
    const { adapter, response, frame } = makeAdapter();
    const seen = new Set();
    for (let f = 0; f < 80 * 60; f++) {
      frame();
      const inClimax = response.phase === 'inevitability' || response.phase === 'orgasm';
      assert.equal(adapter.climax, inClimax);
      if (inClimax) seen.add(response.phase);
    }
    assert.deepEqual([...seen].sort(), ['inevitability', 'orgasm']);
    adapter.stop();
    assert.equal(adapter.climax, false);
  });

  test('dormant when inactive; stop() sets manual mode, level 0 and rest', () => {
    const { adapter, response, dopamine, frame } = makeAdapter();
    for (let f = 0; f < 1200; f++) frame();
    assert.notEqual(response.phase, 'baseline');
    adapter.stop();
    assert.equal(adapter.active, false);
    assert.equal(response.mode, 'manual');
    assert.equal(response.level, 0);
    assert.equal(response.phase, 'baseline');
    assert.equal(response.tHuman, 0);
    assert.equal(adapter.commands.size, 0);
    const before = JSON.stringify([response.A, response.tHuman, Array.from(dopamine.C)]);
    const written = adapter.commands.written;
    for (let f = 0; f < 120; f++) frame();
    assert.equal(JSON.stringify([response.A, response.tHuman, Array.from(dopamine.C)]), before, 'no integration while dormant');
    assert.equal(adapter.commands.written, written, 'no records while dormant');
  });

  test('vitals pass through the legacy vitals() with A.3.4 names; null in brain-only mode', () => {
    const { adapter, response, frame } = makeAdapter();
    for (let f = 0; f < 70 * 60; f += 1) {
      frame();
      if (f % 300 !== 0) continue;
      const v = response.vitals(), a = adapter.vitals();
      assert.deepEqual(a, { hr: v.hr, rr: v.rr, sbp: v.sys, dbp: v.dia });
    }
    adapter.setBodyMode('brain');
    assert.equal(adapter.vitals(), null);
  });

  test('brain-only form removes the κ coupling; body mode restores the profile value', () => {
    const { adapter, response, frame } = makeAdapter();
    const ref = makeAdapter();
    adapter.setBodyMode('brain');
    assert.equal(response.p.kappa, 0);
    for (let f = 0; f < 30 * 60; f++) { frame(); ref.frame(); }
    assert.notEqual(response.A, ref.response.A, 'central arousal differs without the κ coupling');
    response.setProfile('rapid');            // a HUD profile change during brain-only mode
    frame();
    assert.equal(response.p.kappa, 0);
    adapter.setBodyMode('body');
    assert.equal(response.p.kappa, PROFILES.rapid.kappa);
  });

  test('neuroendocrine off clamps prolactin and oxytocin at basal; other switches leave the central models unchanged', () => {
    const off = makeAdapter(), on = makeAdapter(), auto = makeAdapter();
    off.adapter.setNet('neuroendocrine', false);
    auto.adapter.setNet('autonomic', false);
    auto.adapter.setNet('somatic', false);
    let maxR = 0;
    for (let f = 0; f < 90 * 60; f++) {
      off.frame(); on.frame(); auto.frame();
      assert.equal(off.response.R, 0);
      assert.equal(off.response.O, 0);
      maxR = Math.max(maxR, on.response.R);
    }
    assert.ok(maxR > 0.2, 'prolactin surges with the network on');
    assert.equal(JSON.stringify(Array.from(auto.dopamine.C)), JSON.stringify(Array.from(on.dopamine.C)));
    assert.equal(auto.response.A, on.response.A);
  });

  test('a user lock replaces the delegate; the scenario clock keeps stepping', () => {
    const { adapter, response, clock, frame } = makeAdapter();
    for (let f = 0; f < 60; f++) frame();
    const t0 = response.kh.t;
    clock.lock(1);
    for (let f = 0; f < 120; f++) frame();
    assert.equal(clock.source, 'user');
    assert.ok(response.kh.t > t0, 'delegate still stepped under the lock');
    assert.ok(Math.abs(clock.kh - 1) < 1e-9, 'kh slewed to the locked value');
    clock.lock(null);
    frame();
    assert.equal(clock.source, 'delegate');
    assert.ok(adapter.active);
  });
});
