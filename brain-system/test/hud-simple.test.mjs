// Simple HUD (src/ui-simple.js, the default interface; the full HUD opens with ?advanced=1):
// its markup in index.html, and its tables against the model they drive, so a renamed scenario
// stage, sense mode or view key fails here instead of silently falling back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as simple from '../src/ui-simple.js';
import { SCENARIOS as HUD_SCENARIOS, SENSES, VIEWS, NETWORKS, isBodyView, modeOf, siteById } from '../src/ui-body.js';
import { SCENARIOS as SIM_SCENARIOS } from '../src/sim/scenarios.js';
import { PHASES } from '../src/response.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const SHUD = HTML.slice(HTML.indexOf('<div id="shud"'), HTML.indexOf('<div id="info"'));

test('index.html holds the simple HUD beside the full one, simple by default', () => {
  assert.match(HTML, /<body class="hud-simple">/);
  assert.ok(HTML.indexOf('<div id="hud"') >= 0 && SHUD.length > 0, 'both HUDs are present');
  for (const id of ['shud-story', 'shud-scenario', 'shud-stage', 'shud-text', 'shud-da', 'shud-da-bar', 'shud-mode', 'shud-gear',
    'shud-settings', 'shud-nets', 'shud-nets-note', 'shud-about', 'shud-views', 'shud-tab-scn', 'shud-tab-sense', 'shud-rail-scn',
    'shud-rail-sense', 'shud-pause', 'shud-restart', 'shud-stop', 'shud-hint', 'shud-hint-text', 'shud-cancel']) {
    assert.match(SHUD, new RegExp(`id="${id}"`), `#${id}`);
  }
  const buttons = SHUD.match(/<button\b[^>]*>/g) ?? [];
  assert.ok(buttons.length >= 8);
  for (const b of buttons) assert.match(b, /type="button"/, `${b} has type="button"`);
  for (const id of ['shud-pause', 'shud-restart', 'shud-stop', 'shud-gear']) {
    assert.match(SHUD, new RegExp(`id="${id}"[^>]*aria-label="[^"]+"`), `#${id} has a name`);
  }
  assert.match(SHUD, /role="tablist"/);
  assert.match(SHUD, /id="shud-da"[^>]*role="meter"/);
  assert.match(SHUD, /id="shud-story"[^>]*aria-live="polite"/);
  assert.match(readFileSync(join(ROOT, 'style.css'), 'utf8'), /body\.hud-simple #hud \{ display: none; \}/);
});

test('scenarios, views and networks name what the model provides', () => {
  const hudIds = new Set(HUD_SCENARIOS.map((s) => s.id));
  for (const [id, label] of simple.SIMPLE_SCENARIOS) {
    assert.ok(hudIds.has(id), `${id} is a HUD scenario`);
    assert.ok(label.length <= 24, `${id}: short label`);
  }
  const viewIds = new Set([...VIEWS.brain, ...VIEWS.body].map(([v]) => v));
  for (const v of simple.SIMPLE_VIEWS) {
    assert.ok(viewIds.has(v.id), `${v.id} is a view`);
    assert.equal(!!v.body, isBodyView(v.id), `${v.id}: body flag`);
  }
  for (const [id, v] of Object.entries(simple.SCENARIO_VIEWS)) {
    assert.ok(hudIds.has(id), `${id} is a HUD scenario`);
    assert.ok(isBodyView(v), `${id} flies to a body view`);
  }
  assert.equal(simple.scenarioView('orgasm', 'body'), null, 'the orgasm scenario keeps its own fly-to');
  assert.equal(simple.scenarioView('loudSound', 'brain'), 'whole');
  assert.deepEqual(simple.SIMPLE_NETS.map((n) => n.id), NETWORKS.map((n) => n.id));
});

test('one-tap senses are valid A.6 records inside the stimulus ranges', () => {
  for (const s of simple.SIMPLE_SENSES) {
    const sense = SENSES.find((x) => x.id === s.record.sense);
    assert.ok(sense, `${s.id}: sense ${s.record.sense}`);
    const m = modeOf(sense, s.record.mode);
    assert.equal(m.id, s.record.mode, `${s.id}: mode ${s.record.mode}`);
    assert.ok(s.record.intensity >= m.p.min && s.record.intensity <= m.p.max, `${s.id}: intensity in range`);
    assert.equal(s.record.unit, m.p.unit, `${s.id}: unit`);
    const d = m.dur;
    if (d.fixed != null) assert.equal(s.record.durationMs, d.fixed, `${s.id}: fixed duration`);
    else if (d.min != null) assert.ok(s.record.durationMs >= d.min && s.record.durationMs <= d.max, `${s.id}: duration in range`);
    if (s.pick) {
      assert.equal(sense.sites, 'skin', `${s.id}: placed on the skin`);
      assert.equal(s.record.site, undefined);
    } else {
      assert.ok(sense.brainOnly, `${s.id}: works without the body`);
      assert.ok(siteById(s.record.site), `${s.id}: site ${s.record.site}`);
      assert.equal(s.record.side, 'both');
    }
  }
});

test('plain stage texts match the stage names of the scenarios and the orgasm phases', () => {
  const real = new Set();
  for (const sc of Object.values(SIM_SCENARIOS)) for (const st of sc.stages ?? []) real.add(`${sc.id}:${st.name}`);
  for (const ph of Object.values(PHASES)) real.add(`orgasm:${ph.name}`);
  for (const key of Object.keys(simple.PLAIN_STAGES)) assert.ok(real.has(key), `${key} is a real stage`);
  for (const key of real) assert.ok(simple.PLAIN_STAGES[key], `${key} has a plain text`);
  for (const [title, text] of Object.values(simple.PLAIN_STAGES)) {
    assert.ok(title.length <= 20, `title "${title}" is short`);
    assert.ok(!/§|\bmodel\b|≈/.test(text), `"${text}" is plain`);
    assert.match(text, /\.$/);
  }
  assert.deepEqual(simple.plainStage('kneeJerk', 'Stretch reflex · trial 2/5', ''), {
    stage: 'Reflex, trial 2/5', text: simple.PLAIN_STAGES['kneeJerk:Stretch reflex'][1] });
  assert.deepEqual(simple.plainStage('x', 'Unknown', 'First part (model, §1.2). Second part.'), { stage: 'Unknown', text: 'First part.' });
});

test('readout helpers', () => {
  assert.equal(simple.dopamineLevel(1), 0);
  assert.equal(simple.dopamineLevel(0.5), 0);
  assert.equal(simple.dopamineLevel(simple.DA_FULL_RATIO), 1);
  assert.equal(simple.dopamineLevel(100), 1);
  assert.ok(simple.dopamineLevel(2) > 0.4 && simple.dopamineLevel(2) < 0.6);
  assert.equal(simple.dopamineLevel(NaN), 0);

  const log = [
    { id: 9, event: 'arrival', station: 'unknownNode', tH: 0.02 },
    { id: 8, event: 'arrival', station: 's1.hand', tH: 0.0234 },
    { id: 7, event: 'stimulus', station: 'touch press', tH: 0 },
    { id: 3, event: 'arrival', station: 'a1', tH: 0.011 },
  ];
  assert.equal(simple.arrivalSentence(log), 'Reached the touch area of the cortex after 23.4 ms.');
  assert.equal(simple.arrivalSentence(log, 8), '');
  assert.equal(simple.arrivalSentence([{ id: 1, event: 'arrival', station: 'thalVPL', tH: 0.3 }]), 'Reached the thalamus after 300 ms.');
  assert.equal(simple.arrivalSentence(null), '');

  assert.equal(simple.plainSite('dermatome.C6', 'Thumb pad (C6)'), 'thumb pad');
  assert.equal(simple.plainSite('dermatome.T7'), 'abdomen');
  assert.equal(simple.plainSite('foreheadV1', 'Forehead (V1)'), 'forehead');
  assert.equal(simple.stationName('portCoch'), 'the inner ear');
  assert.equal(simple.stationName('nope'), null);
});
