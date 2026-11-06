// Simple HUD (src/ui-simple.js, the default interface; the full HUD opens with ?advanced=1):
// four controls (emotion: Calm / Stress / Pleasure; view; quality; Pause), checked against the
// model they drive, so a renamed scenario, stage, view key, tier or brain region fails here
// instead of silently falling back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as simple from '../src/ui-simple.js';
import { VIEWS, isBodyView } from '../src/ui-body.js';
import { SCENARIOS as SIM_SCENARIOS } from '../src/sim/scenarios.js';
import { PHASES } from '../src/response.js';
import { R, AREAS } from '../src/anatomy.js';
import { ORGAN_SHARES } from '../src/body/geometry.js';
const HEART_SHARE = ORGAN_SHARES.heart / 100;
import { NEURON_VS, DA_VS, BODY_VS, WAVE_SLOTS, uniformSlots } from '../src/shaders.js';
import { TIERS } from '../src/performance.js';
import { BrainRenderer, PARAMS as RP, PROGRAMS } from '../src/renderer.js';
import { PARAMS as GEN } from '../src/body/generate.js';
import { TISSUE_NAMES } from '../src/body/geometry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const CSS = readFileSync(join(ROOT, 'style.css'), 'utf8');
const SHUD = HTML.slice(HTML.indexOf('<div id="shud"'), HTML.indexOf('<div id="info"'));

test('index.html holds the simple HUD beside the full one; main.js chooses which shows', () => {
  assert.match(HTML, /<body>/, 'no HUD class in the markup: a stale cached script keeps the full HUD working');
  assert.match(CSS, /#shud \{ display: none; \}/);
  assert.match(CSS, /body\.hud-simple #shud \{ display: grid; \}/);
  assert.match(CSS, /body\.hud-simple #hud \{ display: none; \}/);
  for (const id of ['shud-story', 'shud-scenario', 'shud-stage', 'shud-text', 'shud-meter', 'shud-meter-label', 'shud-meter-bar',
    'shud-meter-low', 'shud-meter-high', 'shud-meter-value', 'shud-views', 'shud-style', 'shud-quality', 'shud-pause', 'shud-states', 'shud-monitor', 'mon-ecg', 'mon-abp', 'mon-resp', 'mon-capno', 'mon-hr', 'mon-sys', 'mon-dia', 'mon-map', 'mon-rr', 'mon-spo2', 'mon-co2', 'mon-ptt',
    'mon-temp', 'mon-adr', 'mon-cort']) {
    assert.match(SHUD, new RegExp(`id="${id}"`), `#${id}`);
  }
  const buttons = SHUD.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2, 'Pause and camera controls in the markup; the views and the three states are built by ui-simple.js');
  for (const b of buttons) assert.match(b, /type="button"/, `${b} has type="button"`);
  assert.match(SHUD, /id="shud-pause"[^>]*aria-label="Pause"/);
  assert.match(SHUD, /id="nav-help-btn"[^>]*aria-controls="nav-help"[^>]*aria-label="Camera controls"/);
  assert.match(SHUD, /id="shud-meter"[^>]*role="meter"/);
  assert.match(SHUD, /id="shud-story"[^>]*aria-live="polite"/);
  assert.equal((SHUD.match(/<select/g) ?? []).length, 1, 'one form field: Quality');
  assert.ok(!/<input/.test(SHUD));
  assert.ok(SHUD.indexOf('id="shud-views"') < SHUD.indexOf('id="shud-states"'), 'view and emotion are separate groups');
});

test('three states, each running a scenario the model has', () => {
  assert.deepEqual(simple.STATES.map((s) => s.id), ['calm', 'stress', 'dopamine']);
  for (const s of simple.STATES) {
    assert.ok(s.label.length <= 10 && s.hint.length <= 10, `${s.id}: short labels for a 375-px screen`);
    if (s.scenario) assert.ok(SIM_SCENARIOS[s.scenario], `${s.id}: scenario ${s.scenario}`);
  }
  assert.equal(simple.stateForScenario('stressor'), 'stress');
  assert.equal(simple.stateForScenario('orgasm'), 'dopamine');
  assert.equal(simple.stateForScenario('kneeJerk'), 'calm');
  assert.equal(simple.stateForScenario(null), 'calm');
});

test('views and quality name what the renderer has; emotions carry no view', () => {
  const viewIds = new Set([...VIEWS.brain, ...VIEWS.body].map(([v]) => v));
  for (const v of simple.SIMPLE_VIEWS) {
    assert.ok(viewIds.has(v.id), `${v.id} is a view`);
    assert.equal(!!v.body, isBodyView(v.id), `${v.id}: body flag`);
  }
  for (const s of simple.STATES) assert.ok(!('view' in s), `${s.id}: an emotion never names a view`);
  assert.equal(simple.QUALITY[0][0], 'auto');
  assert.deepEqual(simple.STYLES.map(([id]) => id), ['detailed', 'stars'], 'the earlier look stays as the Stars preset');
  assert.deepEqual(simple.QUALITY.slice(1).map(([v, label]) => [Number(v), label]), TIERS.map((t, i) => [i, t.label]));
});

test('the stress circuit names real brain regions and areas', () => {
  for (const id of simple.STRESS_CIRCUIT.regions) assert.ok(R[id] !== undefined, `region ${id}`);
  const areas = AREAS.map((a) => a.id);
  for (const id of simple.STRESS_CIRCUIT.areas) assert.ok(areas.includes(id), `area ${id}`);
  assert.ok(simple.STRESS_MEMBER > 1 && simple.STRESS_OTHER < 1);
  assert.equal(simple.STRESS_RGB.length, 3);
  assert.equal(simple.stressOverlay(0), simple.STRESS_OVERLAY_FLOOR, 'the circuit shows as soon as Stress starts');
  assert.equal(simple.stressOverlay(1), 1);
});

test('plain stage texts match the stages of the two scenarios behind Stress and Dopamine', () => {
  const real = new Set();
  for (const st of SIM_SCENARIOS.stressor.stages) real.add(`stressor:${st.name}`);
  for (const ph of Object.values(PHASES)) real.add(`orgasm:${ph.name}`);
  for (const key of Object.keys(simple.PLAIN_STAGES)) assert.ok(real.has(key), `${key} is a real stage`);
  for (const key of real) assert.ok(simple.PLAIN_STAGES[key], `${key} has a plain text`);
  for (const [title, text] of Object.values(simple.PLAIN_STAGES)) {
    assert.ok(title.length <= 20, `title "${title}" is short`);
    assert.ok(!/§|\bmodel\b|≈/.test(text), `"${text}" is plain`);
    assert.match(text, /\.$/);
  }
  assert.deepEqual(simple.plainStage('x', 'Unknown', 'First part (model, §1.2). Second part.'), { stage: 'Unknown', text: 'First part.' });
});

test('meters', () => {
  for (const f of [simple.dopamineLevel, simple.stressLevel]) {
    assert.equal(f(1), 0);
    assert.equal(f(0.5), 0);
    assert.equal(f(4), 1);
    assert.equal(f(100), 1);
    assert.ok(f(2) > 0.4 && f(2) < 0.6);
    assert.equal(f(NaN), 0);
  }
  assert.deepEqual(Object.keys(simple.METERS).sort(), ['dopamine', 'stress']);
});

test('the dopamine wave: neurons and the dopamine system share it; the renderer packs it', () => {
  for (const src of [NEURON_VS, DA_VS]) {
    assert.match(src, /uniform vec4 uWaveO;/);
    assert.match(src, new RegExp(`uniform vec4 uWave\\[${WAVE_SLOTS}\\];`));
    assert.match(src, /float wv = waveAt\(p\);/);
    assert.ok(uniformSlots(src).names.includes('uWave'));
  }
  const fake = { waves: new Float32Array(4 * WAVE_SLOTS), waveO: new Float32Array(4) };
  BrainRenderer.prototype.setWaves.call(fake, [0, -17, -14], [{ radiusMm: 50, amp: 0.8, widthMm: 9, pushMm: 1.6 }]);
  assert.deepEqual([...fake.waveO].map((x) => +x.toFixed(4)), [0, -0.17, -0.14, 1]);
  assert.deepEqual([...fake.waves.slice(0, 4)].map((x) => +x.toFixed(4)), [0.5, 0.8, 0.09, 0.016]);
  assert.equal(fake.waves[5], 0, 'unused slots stay empty');
  BrainRenderer.prototype.setWaves.call(fake, [0, -17, -14], []);
  assert.equal(fake.waveO[3], 0, 'no wave: off');
  assert.ok(fake.waves.every((x) => x === 0));
});

test('body star styles: Detailed draws every star, Stars the earlier share at the earlier flux', () => {
  // The dense model raised each budget group by 1 / keep; the Stars style draws that share again.
  const before = { skin: 26000, organ: 20000, muscle: 7000, bone: 5000, cord: 6000, nerve: 20000, ganglion: 8000, enteric: 7000, vessel: 5000 };
  const K = RP.style;
  TISSUE_NAMES.forEach((name, c) => {
    // The organ class splits into the heart (ORGAN_SHARES.heart %) and the rest, each with its own share.
    // The vessel class splits into the vascular tree (PULSE.md §9) and the earlier stars.
    const drawn = name === 'organ' ? GEN.budgets.high.organ * ((1 - HEART_SHARE) * K.keep[c] + HEART_SHARE * K.keepHeart)
      : name === 'vessel' ? GEN.budgets.high.vessel * ((1 - GEN.treeShare) * K.keep[c] + GEN.treeShare * K.keepTree)
      : GEN.budgets.high[name] * K.keep[c];
    assert.ok(Math.abs(drawn - before[name]) < 1, `${name}: high-tier budget × keep = the earlier budget`);
    assert.equal(RP.classBudget.high[c], GEN.budgets.high[name], `${name}: renderer and generator budgets agree`);
  });
  for (const name of ['cord', 'nerve', 'ganglion', 'enteric']) assert.ok(K.boost[TISSUE_NAMES.indexOf(name)] > 1, `${name}: brighter in Detailed`);
  assert.ok(K.boost[TISSUE_NAMES.indexOf('skin')] > 1, 'the skin silhouette reads as a dense surface');
  assert.ok(K.size > 0.5 && K.size < 1, 'Detailed stars are smaller (sharper) at the same energy');
  assert.match(BODY_VS, /uniform vec4 uKeep\[3\];/);
  assert.match(BODY_VS, /uniform vec2 uStyle;/);   // anatomical colours and point size, packed (PULSE.md §9)
  assert.match(BODY_VS, /const vec3 ANAT\[9\] = vec3\[9\]\(/);
  assert.ok(!('glass' in PROGRAMS), 'the glass shells are gone');
});
