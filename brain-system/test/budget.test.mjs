// Kernel CPU cost per frame at each A.4 clock preset (research/ANALYSIS.md B.14, B.9, §11.7, §11.17).
// Reported with t.diagnostic against the §11 budget (≤ 1 ms per frame desktop, ≤ 2 ms low tier); not
// gating. Two conditions per preset, 60 frames at 60 fps (h = kh / 60 human s per frame), brain plugins
// (brainnet, sensory), whole body: rest, and the loudSound scenario from its onset (frames advanced
// through ScenarioPlayer, so the 10 % seek snapshots it takes on the way are included). Each condition
// runs unbounded (the true cost) and with the 1-ms budget (time slicing: the effective kh it reaches).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph } from '../src/sim/graph.js';
import { PRESETS } from '../src/clock.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { ScenarioPlayer } from '../src/sim/scenarios.js';

const PLUGINS = [brainnet, sensory];
const GRAPH = buildGraph({ plugins: PLUGINS });
const FPS = 60, FRAMES = 60, BUDGET_MS = 1;   // §11.7 desktop budget

function run(kh, scenario, budgetMs) {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1 });
  const p = new ScenarioPlayer({ kernel: k });
  if (scenario) { p.select('loudSound'); p.play(); p.advanceTo(p.run.onset); }
  const h = kh / FPS, ms = [];
  const t0 = k.t;
  let target = k.t;
  for (let f = 0; f < FRAMES; f++) {
    target += h;
    p.advanceTo(target, budgetMs);   // the kernel carries any remainder into the next frame (B.6)
    ms.push(p.cpuMs);
  }
  ms.sort((a, b) => a - b);
  const mean = ms.reduce((s, x) => s + x, 0) / ms.length;
  return { mean, p95: ms[Math.floor(0.95 * (ms.length - 1))], max: ms[ms.length - 1], khEff: (k.t - t0) / (FRAMES / FPS), reached: k.t - t0 };
}

describe('kernel ms per frame at the A.4 presets (B.14 budget.test.mjs; reported, not gating)', () => {
  for (const [name, kh] of Object.entries(PRESETS)) {
    test(`${name} ×${kh}`, (t) => {
      for (const scenario of [false, true]) {
        const free = run(kh, scenario, Infinity);
        const sliced = run(kh, scenario, BUDGET_MS);
        const what = scenario ? 'loudSound' : 'rest';
        t.diagnostic(`${what}: mean ${free.mean.toFixed(3)} ms, p95 ${free.p95.toFixed(3)} ms, max ${free.max.toFixed(3)} ms per frame `
          + `(${(kh / FPS).toPrecision(3)} human s per frame); with the ${BUDGET_MS}-ms budget: max ${sliced.max.toFixed(3)} ms, effective kh ${sliced.khEff.toPrecision(3)}`);
        assert.ok(Math.abs(free.reached - kh * FRAMES / FPS) < 1e-6, 'unbounded runs reach every frame target');
      }
    });
  }
});
