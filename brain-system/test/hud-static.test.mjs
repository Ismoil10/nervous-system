// Static HUD checks (ANALYSIS.md B.14 hud-static): parses index.html without a DOM library and
// checks the dropdown heading rule (one title, at most one short chip, a chevron, nothing between
// the heading and the body), the A.7 titles, the B.10 element ids and their placement, and that no
// project text file contains Cyrillic or Uzbek-specific characters. It also loads ui.js and
// ui-body.js in Node (no DOM at import time) and checks their label tables and formatters.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

// ---- A minimal HTML tree builder (enough for this hand-written file) --------------------------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(src))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) {
      cur.children.push({ tag: '#text', text: m[5], parent: cur });
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const node = { tag, attrs: parseAttrs(m[3]), children: [], parent: cur };
      cur.children.push(node);
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        node.children.push({ tag: '#text', text: html.slice(re.lastIndex, end), parent: node });
        re.lastIndex = html.indexOf('>', end) + 1;
      } else if (!VOID.has(tag) && !m[4]) {
        cur = node;
      }
    } else if (m[1]) {
      const tag = m[1].toLowerCase();
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      assert.ok(n, `unmatched </${tag}>`);
      cur = n.parent;
    }
  }
  assert.equal(cur, root, `unclosed <${cur.tag}>`);
  return root;
}

const isEl = (n) => n.tag !== '#text';
const kids = (n) => n.children.filter(isEl);
const cls = (n) => (n.attrs?.class ?? '').split(/\s+/).filter(Boolean);
const has = (n, c) => cls(n).includes(c);
function* walk(n) {
  for (const c of n.children) {
    if (!isEl(c)) continue;
    yield c;
    yield* walk(c);
  }
}
const all = (n, pred) => [...walk(n)].filter(pred);
const text = (n) => (n.tag === '#text' ? n.text : n.children.map(text).join(''));
const clean = (s) => s.replace(/\s+/g, ' ').trim().replace(/&amp;/g, '&');
const contains = (a, b) => { for (let n = b; n; n = n.parent) if (n === a) return true; return false; };

const DOC = parse(HTML);
const byId = new Map();
for (const n of walk(DOC)) if (n.attrs.id) byId.set(n.attrs.id, [...(byId.get(n.attrs.id) || []), n]);
const el = (id) => {
  const list = byId.get(id);
  assert.ok(list, `missing element #${id}`);
  return list[0];
};
const drops = all(DOC, (n) => has(n, 'drop'));
const dropByStore = new Map(drops.map((d) => [d.attrs['data-store'], d]));
const titleOf = (d) => clean(text(all(d, (n) => has(n, 'drop-title'))[0]));

// A.7: the thirteen HUD dropdowns (titles only).
const A7_TITLES = ['Body', 'Interventions', 'Stimulus', 'Scenarios', 'Time', 'Brain systems', 'Vitals', 'Live',
  'Dopamine', 'Modulators', 'Views', 'Performance', 'Settings'];
// B.10: data on the left, controls on the right.
const LEFT = ['vitals', 'live', 'dopamine', 'modulators'];
const RIGHT = ['body', 'interventions', 'stimulus', 'scenarios', 'time', 'brainsys', 'views', 'perf', 'settings'];
const CHIP_MAX = 16;

test('index.html parses into a well-formed tree with unique ids', () => {
  const dups = [...byId].filter(([, list]) => list.length > 1).map(([id]) => id);
  assert.deepEqual(dups, []);
});

test('every dropdown heading holds one title, at most one short chip and a chevron', () => {
  assert.equal(drops.length, A7_TITLES.length);
  for (const d of drops) {
    const heads = all(d, (n) => has(n, 'drop-head'));
    assert.equal(heads.length, 1, `${d.attrs.id}: one .drop-head`);
    const head = heads[0];
    assert.equal(head.tag, 'button', `${d.attrs.id}: .drop-head is a button`);
    const parts = kids(head);
    const titles = parts.filter((n) => has(n, 'drop-title'));
    const chips = parts.filter((n) => has(n, 'pill') || has(n, 'badge'));
    const chevs = parts.filter((n) => has(n, 'chev'));
    assert.equal(titles.length, 1, `${d.attrs.id}: one .drop-title`);
    assert.ok(chips.length <= 1, `${d.attrs.id}: at most one chip`);
    assert.equal(chevs.length, 1, `${d.attrs.id}: one .chev`);
    assert.equal(parts.length, titles.length + chips.length + chevs.length, `${d.attrs.id}: nothing else in the heading`);
    assert.equal(kids(titles[0]).length, 0, `${d.attrs.id}: the title is plain text`);
    for (const c of chips) assert.ok(clean(text(c)).length <= CHIP_MAX, `${d.attrs.id}: chip "${clean(text(c))}" is short`);
    const stray = head.children.filter((n) => n.tag === '#text' && n.text.trim());
    assert.deepEqual(stray, [], `${d.attrs.id}: no loose text in the heading`);
  }
});

test('nothing sits between a dropdown heading and its body', () => {
  for (const d of drops) {
    const parts = kids(d);
    assert.equal(parts.length, 2, `${d.attrs.id}: heading and body only`);
    const [h, body] = parts;
    assert.ok(has(h, 'drop-h') && /^h[1-6]$/.test(h.tag), `${d.attrs.id}: first child is the .drop-h heading`);
    assert.ok(has(body, 'drop-body'), `${d.attrs.id}: second child is the .drop-body`);
    assert.equal(kids(h).length, 1, `${d.attrs.id}: the heading holds only its button`);
    const loose = d.children.filter((n) => n.tag === '#text' && n.text.trim());
    assert.deepEqual(loose, [], `${d.attrs.id}: no text between heading and body`);
    assert.ok('hidden' in body.attrs, `${d.attrs.id}: the body starts collapsed`);
    const head = all(h, (n) => has(n, 'drop-head'))[0];
    assert.equal(head.attrs['aria-controls'], body.attrs.id, `${d.attrs.id}: aria-controls names the body`);
    assert.equal(head.attrs['aria-expanded'], 'false');
  }
});

test('dropdown titles match A.7 and sit in the B.10 columns', () => {
  assert.deepEqual(drops.map(titleOf).sort(), [...A7_TITLES].sort());
  const stores = drops.map((d) => d.attrs['data-store']);
  assert.equal(new Set(stores).size, stores.length, 'unique data-store keys');
  assert.equal(titleOf(dropByStore.get('vitals')), 'Vitals', 'the vitals dropdown is titled Vitals (key kept)');
  assert.equal(titleOf(dropByStore.get('body')), 'Body', 'the new Body dropdown takes the key body');
  const left = all(DOC, (n) => has(n, 'drops'))[0], right = all(DOC, (n) => has(n, 'right'))[0];
  assert.deepEqual(kids(left).map((n) => n.attrs['data-store']), LEFT);
  assert.deepEqual(kids(right).map((n) => n.attrs['data-store']), RIGHT);
  for (const key of RIGHT) assert.equal(dropByStore.get(key).attrs.id, `drop-${key}`);
});

test('B.10 controls exist inside their dropdowns', () => {
  const inDrop = (store, ids) => {
    const d = dropByStore.get(store);
    for (const id of ids) assert.ok(contains(d, el(id)), `#${id} inside drop-${store}`);
  };
  inDrop('body', ['body-mode', 'body-mode-brain', 'body-mode-body', 'net-somatic', 'net-autonomic', 'net-enteric',
    'net-neuroendocrine', 'net-neuroimmune']);
  for (const id of ['net-somatic', 'net-autonomic', 'net-enteric', 'net-neuroendocrine', 'net-neuroimmune']) {
    assert.equal(el(id).attrs.role, 'switch');
    assert.ok(all(el(id), (n) => has(n, 'glyph')).length === 1, `#${id} has a pattern glyph`);
  }
  inDrop('interventions', ['intervention', 'sci-level', 'sci-type', 'sci-phase', 'nerve', 'nerve-day', 'vns']);
  inDrop('stimulus', ['sens-sense', 'sens-mode', 'sens-intensity', 'sens-duration', 'sens-side', 'sens-pick', 'sens-site',
    'sens-deliver', 'sens-site-info', 'sens-psi', 'sens-repeat', 'sens-interval', 'sens-clear']);
  inDrop('scenarios', ['scenario', 'scn-play', 'scn-stop', 'scn-restart', 'scn-repeat', 'scn-progress', 'scn-orgasm']);
  inDrop('time', ['time-auto', 'time-preset', 'time-rate', 'time-readout', 'time-human', 'time-pause']);
  inDrop('brainsys', ['arousal-state', 'ov-thalamocortical', 'ov-networks']);
  inDrop('views', ['view', 'view-skeleton', 'view-receptors', 'view-labels']);
  inDrop('perf', ['quality', 'kernel-ms', 'clock-limited', 'body-points', 'packets']);
  inDrop('settings', ['age', 'limb-motion', 'reset', 'info-btn']);
  inDrop('live', ['phase-desc', 'event-log']);
  assert.equal(el('scenario').attrs.role, 'radiogroup');
  assert.equal(el('scn-progress').attrs.role, 'slider');
});

test('the orgasm controls moved to Scenarios with their ids unchanged', () => {
  const block = el('scn-orgasm');
  for (const id of ['mode-demo', 'mode-manual', 'stim-level', 'stim-val', 'profile', 'tref', 'tref-val', 'hypothesis']) {
    assert.ok(contains(block, el(id)), `#${id} inside #scn-orgasm`);
  }
  // Stimulate and Distract appear only while the orgasm scenario runs (B.5); ui.js reveals them.
  assert.ok('hidden' in el('stimulate').attrs);
  assert.ok('hidden' in el('distract').attrs);
  assert.ok('hidden' in el('arousal-meter').attrs);
  for (const id of ['pause', 'view-btn']) assert.ok(!('hidden' in el(id).attrs));
});

test('every label and aria reference points to an element', () => {
  for (const n of walk(DOC)) {
    for (const attr of ['for', 'aria-controls', 'aria-labelledby', 'list']) {
      if (n.attrs[attr] && !(n.tag === 'input' && attr === 'for')) {
        for (const id of n.attrs[attr].split(/\s+/)) assert.ok(byId.has(id), `${attr}="${id}" resolves`);
      }
    }
  }
});

test('labels follow A.3.5, A.6 and §13.13', async () => {
  const ui = await import('../src/ui-body.js');
  const radioLabels = all(el('scenario'), (n) => has(n, 'radio')).map((n) => clean(text(n)));
  assert.deepEqual(radioLabels, ui.SCENARIOS.map((s) => s.label));
  assert.deepEqual(radioLabels.slice(0, 9), ['Touching a hot object', 'Sudden loud sound', 'Bright light', 'Knee jerk',
    'Standing up', 'Eating a meal', 'Acute stressor', 'Infection and fever', 'Orgasm – dopamine']);
  for (const s of ui.SCENARIOS) assert.equal(el(`scenario-${s.id}`).attrs.value, s.id);

  const senses = kids(el('sens-sense')).map((n) => n.attrs.value);
  assert.deepEqual(senses, ['vision', 'hearing', 'touch', 'pain', 'temperature', 'smell', 'taste', 'balance',
    'proprioception', 'interoception']);
  assert.deepEqual(ui.SENSES.map((s) => s.id), senses);
  assert.deepEqual(ui.sensesFor('brain'), ['vision', 'hearing', 'smell', 'taste', 'balance']);

  const interventions = kids(el('intervention')).map((n) => [n.attrs.value, clean(text(n))]);
  assert.deepEqual(interventions, ui.INTERVENTIONS.map((x) => [x.id, x.label]));

  const nets = ['somatic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune'];
  assert.deepEqual(ui.NETWORKS.map((n) => n.id), nets);
  for (const n of ui.NETWORKS) assert.equal(clean(text(all(el(`net-${n.id}`), (x) => has(x, 'sw-label'))[0])), n.label);
  assert.deepEqual(kids(el('body-mode')).map((n) => clean(text(n))), ['Brain only', 'Whole body']);

  const presets = kids(el('time-preset')).map((n) => [n.attrs['data-preset'], clean(text(n))]);
  assert.deepEqual(presets, ui.TIME_PRESETS.map(([id, label]) => [id, label]));
  assert.deepEqual(Object.fromEntries(ui.TIME_PRESETS.map(([id, , kh]) => [id, kh])),
    { reflex: 0.01, pain: 0.1, autonomic: 1, gut: 10, endocrine: 60, immune: 900, circadian: 3600 });   // A.4

  const views = all(el('view'), (n) => n.tag === 'option').map((n) => [n.attrs.value, clean(text(n))]);
  assert.deepEqual(views, [...ui.VIEWS.brain, ...ui.VIEWS.body]);
  const states = kids(el('arousal-state')).map((n) => n.attrs.value);
  assert.deepEqual(states, ui.AROUSAL_STATES.map(([id]) => id));
  for (const [id, label] of ui.OVERLAYS) {
    assert.ok(clean(text(el(`ov-${id}`))).startsWith(label));
  }
  assert.match(clean(text(el('ov-networks'))), /functional connectivity \(fMRI correlation\)/);   // A.8 #23
});

test('ui.js and ui-body.js load without a DOM; formatters follow A.4 and §13.13', async () => {
  const ui = await import('../src/ui-body.js');
  const hud = await import('../src/ui.js');
  assert.equal(typeof hud.Hud, 'function');
  assert.equal(typeof ui.BodyHud, 'function');

  assert.equal(ui.formatRate(0.01), '×1/100');
  assert.equal(ui.formatRate(1), '×1');
  assert.equal(ui.formatRate(3600), '×3,600');
  assert.equal(ui.formatRate(0.005), '×1/200');
  assert.equal(ui.formatClockTime(0.023), '23.0 ms');
  assert.equal(ui.formatClockTime(0.25), '250 ms');
  assert.equal(ui.formatClockTime(12.34), '12.3 s');
  assert.equal(ui.formatClockTime(3725), '1:02:05');
  assert.equal(ui.clockLabel(0.023, 0.01), 't 23.0 ms  ×1/100');
  assert.equal(ui.sourceLabel('user'), 'lock');
  assert.equal(ui.sourceLabel('delegate'), 'scenario');
  assert.equal(ui.sourceLabel('adaptive'), 'auto');

  // Log clock slider spans exactly the A.4 range.
  assert.equal(ui.khFromSlider(0), 0.005);
  assert.equal(ui.khFromSlider(1000), 3600);
  for (const kh of [0.01, 1, 60, 900]) assert.ok(Math.abs(Math.log10(ui.khFromSlider(ui.sliderFromKh(kh)) / kh)) < 0.004);
  // Scrubber: log10(tH) from 1 ms to the span.
  assert.ok(Math.abs(ui.tHFromFraction(0, 30) - 0.001) < 1e-12);
  assert.ok(Math.abs(ui.tHFromFraction(1, 30) - 30) < 1e-9);
  assert.ok(Math.abs(ui.fractionFromTH(ui.tHFromFraction(0.37, 300), 300) - 0.37) < 1e-9);

  // A model latency is never shown without its target range (§13.14 rule 3).
  const ev = { tH: 0.0234, station: 'S1 hand', fibre: 'Abeta', v: 65, simMs: 23.4 };
  assert.ok(!/model/.test(ui.formatEvent(ev)));
  assert.match(ui.formatEvent({ ...ev, targetMs: [19, 25] }), /model 23\.4 ms \(target 19–25 ms\)/);
  assert.match(ui.formatEvent(ev), /Aβ 65 m\/s/);

  // Network-off tags (B.10) and scenario availability (A.3.5, §12.16).
  const off = { somatic: true, autonomic: false, enteric: true, neuroendocrine: true, neuroimmune: true };
  assert.deepEqual(ui.vitalTags('body', off), { hr: 'intrinsic', pupil: 'fixed', scl: 'denervated', adrenaline: 'basal' });
  assert.deepEqual(ui.vitalTags('brain', off), {});
  assert.equal(ui.scenarioAvailability('hotObject', 'brain', off), 'Needs the body');
  assert.equal(ui.scenarioAvailability('loudSound', 'brain', off), '');
  assert.equal(ui.scenarioAvailability('orgasm', 'brain', off), '');
  assert.equal(ui.scenarioAvailability('coldFace', 'body', off), 'Needs the autonomic network');
});

test('stimulus tables follow §5.14 and never offer excluded sites (A.1)', async () => {
  const ui = await import('../src/ui-body.js');
  const heat = ui.modeOf('pain', 'heat').p;
  assert.deepEqual([heat.min, heat.max, heat.def], [42, 60, 50]);
  const gastric = ui.modeOf('interoception', 'gastricDistension').p;
  assert.deepEqual([gastric.min, gastric.max, gastric.def], [0, 800, 200]);
  const force = ui.modeOf('touch', 'press').p;
  assert.ok(force.log && force.min === 0.1 && force.max === 10000 && force.def === 50);
  for (const s of ui.SENSES) {
    for (const m of s.modes) {
      assert.ok(m.p.def >= m.p.min && m.p.def <= m.p.max, `${s.id}.${m.id} default in range`);
      if (m.dur.min != null) assert.ok(m.dur.def >= m.dur.min && m.dur.def <= m.dur.max, `${s.id}.${m.id} duration default in range`);
      if (m.p.log) assert.ok(Math.abs(ui.valueFromSlider(m.p, ui.sliderFromValue(m.p, m.p.def)) / m.p.def - 1) < 0.01);
    }
  }
  const ids = ui.SITE_GROUPS.flatMap((g) => g.sites.map((x) => x.id));
  for (const bad of ['dermatome.S3', 'dermatome.S4', 'dermatome.S5', 'pelvicFloor', 'perineum']) assert.ok(!ids.includes(bad));
  // Brain-only mode lists the special-sense sites only (§13.12).
  for (const s of ui.sensesFor('brain')) {
    for (const g of ui.sitesFor(s, null, 'brain')) assert.equal(g.label, 'Special senses');
  }
  assert.deepEqual(ui.sitesFor('touch', 'press', 'brain'), []);
  assert.deepEqual(ui.viewOrder('brain'), ['whole', 'cutaway', 'dopamine']);
});

test('no Cyrillic or Uzbek-specific characters in project text files', () => {
  // Raw captures (raw/) are third-party text and are excluded; so are node_modules and golden traces.
  const SKIP = new Set(['raw', 'node_modules', 'golden', '.git']);
  const EXT = new Set(['.js', '.mjs', '.html', '.css', '.md', '.json', '.bat', '.txt']);
  // Cyrillic (U+0400–U+052F) and the Uzbek okina/apostrophe letters (U+02BB, U+02BC), built from
  // code points so this file stays free of them.
  const cp = (x) => String.fromCodePoint(x);
  const BAD = new RegExp(`[${cp(0x400)}-${cp(0x52f)}${cp(0x2bb)}${cp(0x2bc)}]`, 'u');
  // The spec line that states this rule names the two characters; it is the only allowed use.
  const ALLOWED = (file, line) => file.startsWith('research/') && /Uzbek-specific/.test(line);
  const offenders = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!SKIP.has(name)) visit(p); continue; }
      if (!EXT.has(extname(name))) continue;
      const file = relative(ROOT, p).split(sep).join('/');
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => { if (BAD.test(line) && !ALLOWED(file, line)) offenders.push(`${file}:${i + 1}`); });
    }
  };
  visit(ROOT);
  assert.deepEqual(offenders, []);
});
