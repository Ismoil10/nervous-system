// Photosensitivity limiter (research/ANALYSIS.md §13.15, A.9). Adversarial light sources are
// replayed at 10, 30, 60 and 144 fps; an independent checker rebuilds every window's luminance
// from the applied amplitudes and verifies: ≤ 3 transitions (changes ≥ 10 % of maximum) in any
// 1 s, and ≤ 10 % change per ⅓ s. Also the stateless display rules.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PhotoLimiter, PARAMS, RateGate, TransitionCounter, fadeTime, rhythmMode, heartbeat, vasoDim, lanternK,
  isRedFlash, flashAreaPx,
} from '../src/safety.js';
import { blackbodyRGB, cctDuvRGB } from '../src/color.js';

const W = 960, H = 540, TILE = 88;
const FPS = [10, 30, 60, 144];

// Independent window geometry: 2 × 2 tiles of 88 CSS px sliding by one tile; discs as squares of
// equal area.
function windows() {
  const tx = Math.ceil(W / TILE), ty = Math.ceil(H / TILE), out = [];
  for (let j = 0; j < Math.max(1, ty - 1); j++) {
    for (let i = 0; i < Math.max(1, tx - 1); i++) {
      const x0 = i * TILE, y0 = j * TILE, x1 = Math.min(W, (i + 2) * TILE), y1 = Math.min(H, (j + 2) * TILE);
      out.push({ x0, y0, x1, y1, area: (x1 - x0) * (y1 - y0) });
    }
  }
  return out;
}
function levelsOf(sources, applied, wins) {
  return wins.map((w) => {
    let L = 0;
    sources.forEach((q, s) => {
      const hw = q.w !== undefined ? q.w / 2 : q.r * Math.sqrt(Math.PI) / 2, hh = q.h !== undefined ? q.h / 2 : hw;
      const ox = Math.min(q.x + hw, w.x1, W) - Math.max(q.x - hw, w.x0, 0);
      const oy = Math.min(q.y + hh, w.y1, H) - Math.max(q.y - hh, w.y0, 0);
      if (ox > 0 && oy > 0) L += applied[s] * ox * oy / w.area;
    });
    return L;
  });
}

// Runs a scenario: frame(t) → sources. Returns the per-window traces and any shimmer flags.
function run(frame, fps, seconds) {
  const lim = new PhotoLimiter({ width: W, height: H });
  const wins = windows();
  const dt = 1 / fps;
  const trace = wins.map(() => [{ t: 0, L: 0 }]);
  let shimmer = 0, t = 0, last = null;
  for (let k = 0; k < Math.round(seconds * fps); k++) {
    t += dt;
    const src = frame(t);
    lim.scale(src, dt);
    const applied = Array.from(lim.applied.subarray(0, src.length));
    shimmer += lim.shimmer.subarray(0, src.length).reduce((a, b) => a + b, 0);
    levelsOf(src, applied, wins).forEach((L, i) => trace[i].push({ t, L }));
    last = { src, applied, factor: Array.from(lim.factor.subarray(0, src.length)) };
  }
  return { trace, shimmer, last, lim };
}

function at(tr, t0) {
  if (t0 <= tr[0].t) return tr[0].L;
  for (let i = tr.length - 1; i > 0; i--) {
    if (tr[i - 1].t <= t0) { const a = tr[i - 1], b = tr[i]; return a.L + (b.L - a.L) * (t0 - a.t) / (b.t - a.t); }
  }
  return tr[0].L;
}

// Zigzag transitions ≥ 10 % of maximum; returns the worst count in any 1 s and the largest change
// within any ⅓ s.
function check(trace) {
  let worstCount = 0, worstSlew = 0;
  for (const tr of trace) {
    let ref = tr[0].L, dir = 0;
    const times = [];
    for (const { t, L } of tr) {
      const up = dir <= 0 && L >= ref + 0.1, down = dir >= 0 && L <= ref - 0.1;
      if (up || down) { dir = up ? 1 : -1; ref = L; times.push(t); }
      else if ((dir > 0 && L > ref) || (dir < 0 && L < ref)) ref = L;
    }
    // Any two levels within ⅓ s differ by ≤ 10 % (stricter than |L(t) − L(t − ⅓)|).
    for (let i = 0, j0 = 0; i < tr.length; i++) {
      const t = tr[i].t;
      while (tr[j0].t < t - 1 / 3) j0++;
      let mn = at(tr, t - 1 / 3), mx = mn;
      for (let j = j0; j <= i; j++) { mn = Math.min(mn, tr[j].L); mx = Math.max(mx, tr[j].L); }
      worstSlew = Math.max(worstSlew, mx - mn);
    }
    for (let i = 0; i < times.length; i++) {
      let n = 0;
      for (let j = 0; j <= i; j++) if (times[j] > times[i] - 1 + 1e-9) n++;
      worstCount = Math.max(worstCount, n);
    }
  }
  return { worstCount, worstSlew };
}

const SCENARIOS = {
  // A full-canvas field switched 0 ↔ 0.7 at 10 Hz (the most provocative band starts at 15 Hz).
  fullField: (t) => [{ id: 'field', x: W / 2, y: H / 2, w: W, h: H, amp: Math.floor(t * 20) % 2 ? 0.7 : 0 }],
  // 80 small points (each < 1 % of the flash area, so no regional low-pass) toggling together at 8 Hz.
  pointCluster: (t) => {
    const on = Math.floor(t * 16) % 2 ? 0.7 : 0, out = [];
    for (let i = 0; i < 80; i++) out.push({ id: 'p' + i, x: 300 + (i % 10) * 9, y: 250 + Math.floor(i / 10) * 9, r: 4.5, amp: on });
    return out;
  },
  // Organ-sized glows (≥ 1 % of the flash area) pulsing at 6 Hz with a 0.6 swing.
  organGlow: (t) => [0, 1, 2].map((k) => ({ id: 'o' + k, x: 200 + 250 * k, y: 270, r: 70, amp: 0.3 + 0.3 * Math.sin(2 * Math.PI * 6 * t + k) })),
  // Volleys: 12 packets per s travelling along a nerve, bright cores.
  packets: (t) => {
    const out = [];
    for (let k = Math.max(0, Math.floor((t - 2) * 12)); k <= Math.floor(t * 12); k++) {
      const x = 80 + (t - k / 12) * 400;
      if (x < W) out.push({ id: 'k' + k, x, y: 200, r: 5, amp: 1 });
    }
    return out;
  },
};

describe('PhotoLimiter (§13.15, A.9)', () => {
  for (const [name, frame] of Object.entries(SCENARIOS)) {
    for (const fps of FPS) {
      test(`${name} at ${fps} fps: ≤ 3 transitions per s per window, ≤ 10 % per ⅓ s`, () => {
        const { trace } = run(frame, fps, 4);
        const { worstCount, worstSlew } = check(trace);
        assert.ok(worstCount <= PARAMS.maxTransitions, `transitions ${worstCount}`);
        assert.ok(worstSlew <= PARAMS.slewDelta + 2e-3, `slew ${worstSlew.toFixed(4)}`);
      });
    }
  }

  test('the unlimited inputs would break both limits (the scenarios are adversarial)', () => {
    const wins = windows();
    for (const name of ['fullField', 'pointCluster']) {
      const trace = wins.map(() => [{ t: 0, L: 0 }]);
      for (let k = 1; k <= 240; k++) {
        const src = SCENARIOS[name](k / 60);
        levelsOf(src, src.map((q) => q.amp), wins).forEach((L, i) => trace[i].push({ t: k / 60, L }));
      }
      const { worstCount, worstSlew } = check(trace);
      assert.ok(worstCount > 3 && worstSlew > 0.1, `${name}: ${worstCount} ${worstSlew}`);
    }
  });

  test('a slow ramp passes almost untouched', () => {
    const { last } = run((t) => [{ id: 'ramp', x: 480, y: 270, r: 150, amp: Math.min(0.5, t * 0.05) }], 60, 12);
    assert.ok(last.factor[0] > 0.97, `factor ${last.factor[0]}`);
  });

  test('small moving packets are not dimmed', () => {
    const { last } = run(SCENARIOS.packets, 60, 3);
    assert.ok(last.factor.every((f) => f > 0.98), last.factor.join(' '));
  });

  test('a source that ends fades instead of vanishing when it would flash', () => {
    const lim = new PhotoLimiter({ width: W, height: H });
    const big = (amp) => [{ id: 'g', x: 480, y: 270, w: 400, h: 300, amp }];
    for (let k = 0; k < 240; k++) lim.scale(big(0.6), 1 / 60);
    lim.scale(big(0), 1 / 60);
    assert.ok(lim.applied[0] > 0.5, `held at ${lim.applied[0]}`);
  });

  test('flash area ≈ 176 × 176 CSS px at 60 cm and 96 px/in', () => {
    const a = flashAreaPx();
    assert.ok(Math.abs(a - 30900) / 30900 < 0.01, String(a));
    assert.ok(Math.abs(Math.sqrt(a) - 176) < 1);
    assert.equal(new PhotoLimiter({ width: W, height: H }).wx, Math.ceil(W / 88) - 1);
  });
});

describe('display rules', () => {
  test('toggle fades: max(0.8 s, ΔL / 0.3 s⁻¹)', () => {
    assert.equal(fadeTime(0.1), 0.8);
    assert.ok(Math.abs(fadeTime(0.6) - 2) < 1e-12);
  });

  test('rhythm rule: cycle by cycle only up to 1 Hz on screen (§13.9)', () => {
    assert.equal(rhythmMode(14 / 60, 4), 'cycle');
    assert.equal(rhythmMode(14 / 60, 4.5), 'envelope');
    assert.equal(rhythmMode(3 / 60, 20), 'cycle');
    assert.equal(rhythmMode(3 / 60, 21), 'envelope');
  });

  test('heartbeat ≤ 8 % per beat only at kh ≤ 1 and hr ≤ 150, else a steady glow within ±15 %', () => {
    assert.deepEqual(heartbeat({ kh: 1, hr: 120 }).swing, 0.08);
    assert.equal(heartbeat({ kh: 2, hr: 70 }).perBeat, false);
    assert.equal(heartbeat({ kh: 1, hr: 175 }).perBeat, false);
    assert.equal(heartbeat({ kh: 10, hr: 175 }).steady, 1.15);
  });

  test('vasoconstriction dimming ≤ 15 %, τ 2 s', () => {
    assert.ok(Math.abs(vasoDim(0, 1, 2) - 0.15 * (1 - Math.exp(-1))) < 1e-12);
    let x = 0;
    for (let i = 0; i < 2000; i++) x = vasoDim(x, 0.5, 0.05);
    assert.ok(Math.abs(x - 0.15) < 1e-9);
    assert.ok(vasoDim(0, -1, 100) >= -0.1 - 1e-12);
  });

  test('red flash test and lantern floor', () => {
    assert.equal(isRedFlash([1, 0, 0], [1, 1, 1]), true);
    assert.equal(isRedFlash(blackbodyRGB(2300), [1, 1, 1]), false);
    assert.equal(isRedFlash(cctDuvRGB(5500, -0.0175), cctDuvRGB(13000, 0)), false);
    assert.equal(lanternK(1800), 2200);
    assert.equal(lanternK(2300), 2300);
  });

  test('rate gate: ≤ 3 packets per s past a bundle point', () => {
    const g = new RateGate(3, 1);
    const ok = [0, 0.1, 0.2, 0.3, 0.9, 1.05, 1.15, 1.25].map((t) => g.allow('median', t));
    assert.deepEqual(ok, [true, true, true, false, false, true, true, true]);
  });

  test('transition counter needs the darker state below 0.8', () => {
    const c = new TransitionCounter(0.85);
    assert.equal(c.push(0.95, 0.1), false);
    assert.equal(c.push(0.6, 0.2), true);
    assert.equal(c.count(0.2), 1);
    assert.equal(c.count(1.3), 0);
  });
});
