// @ts-check
// Simple HUD: the default interface (user decisions, 5 November 2026). The person's emotional
// state is kept apart from how the brain is shown:
//   1. emotion: Calm, Stress or Pleasure (the primary choice; it never moves the camera);
//   2. view: Brain, Cutaway, Dopamine system or Body (it never changes the emotion), and the style:
//      Detailed (dense, sharp stars in anatomical colours) or Stars (the earlier look, kept as a preset);
//   3. quality: Auto (adaptive, from the hardware and the measured frame time) or a fixed tier;
//   4. Pause.
// The readouts are a short story of what is happening and one meter with its percentage (stress
// hormones or dopamine); no other numbers.
// Every other control stays in the full HUD (ui.js, ui-body.js), opened with `?advanced=1`.
// Nothing here touches the DOM at import time, so the module also loads in Node tests.

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// The three emotional states and the model run behind each: Calm stops every scenario; Stress plays
// the acute psychosocial stressor (scenarios.js `stressor`); Pleasure plays the orgasm scenario in
// demo mode, the model's strongest dopamine release (DOPAMINE.md).
export const STATES = [
  { id: 'calm', label: 'Calm', hint: 'At rest', scenario: null },
  { id: 'stress', label: 'Stress', hint: 'Anxiety', scenario: 'stressor' },
  { id: 'dopamine', label: 'Pleasure', hint: 'Dopamine', scenario: 'orgasm' },
];
export const stateOf = (id) => STATES.find((s) => s.id === id) ?? null;
export const stateForScenario = (scenarioId) => STATES.find((s) => s.scenario === scenarioId)?.id ?? 'calm';

// Views (ui-body.js VIEWS keys). The cutaway shows the deep stress circuit at the midline; the
// dopamine view fades the cortex so the dopamine system and its wave stand out.
export const SIMPLE_VIEWS = [
  { id: 'whole', label: 'Brain' }, { id: 'cutaway', label: 'Cutaway' }, { id: 'dopamine', label: 'Dopamine' },
  { id: 'upperBody', label: 'Body', body: true }, { id: 'heart', label: 'Heart', body: true }, { id: 'lungs', label: 'Lungs', body: true },
];

// Quality: Auto keeps the adaptive tier of performance.js (hardware start, frame-time scaling);
// the others fix a tier (values are TIERS indices, as in the full HUD's Quality select).
import { isAlarm } from './monitor.js';
// Monitor numbers: integers; the temperature to 0.1 °C and cortisol to 0.1 µg/dL; "--" when unknown.
const MONITOR_KEYS = ['hr', 'sys', 'dia', 'map', 'ptt', 'spo2', 'rr', 'co2', 'temp', 'adr', 'cort'];
export function monitorText(k, v) {
  if (!Number.isFinite(v)) return '--';
  return k === 'temp' || k === 'cort' ? v.toFixed(1) : String(Math.round(v));
}
export const QUALITY = [['auto', 'Auto'], ['0', 'Low'], ['1', 'Medium'], ['2', 'High'], ['3', 'Ultra']];

// Visual style: Detailed (every body star, sharper, anatomical colours, a brighter nervous system) or
// Stars (the earlier look, kept as a preset).
export const STYLES = [['detailed', 'Detailed'], ['stars', 'Stars']];

// The stress circuit drawn in Stress (display only, through the brain-systems overlay of
// statetex.js): amygdala and bed nucleus, hypothalamic stress nuclei, the brainstem alarm and
// sympathetic centres, and the cortical salience areas (ANALYSIS.md §3, §7.6, §9.4).
export const STRESS_CIRCUIT = {
  regions: ['amygdala', 'cea', 'bnst', 'hypothalamus', 'pvn', 'lh', 'dmh', 'lc', 'pag', 'rvlm'],
  areas: ['insAnt', 'dacc', 'sgacc'],
};
// At full strength the circuit's stars are ×2.2 and the rest of the brain ×0.45, and the circuit
// takes the stress blue (also the HUD's Stress colour), distinct from the cool-white stars and the
// dopamine amber [model, display only].
export const STRESS_MEMBER = 2.2;
export const STRESS_OTHER = 0.45;
export const STRESS_RGB = [0x5c / 255, 0xb8 / 255, 0xff / 255];
// Overlay strength: the circuit engages at the stressor's start and grows with the hormones.
export const STRESS_OVERLAY_FLOOR = 0.45;
export const stressOverlay = (level) => clamp(STRESS_OVERLAY_FLOOR + (1 - STRESS_OVERLAY_FLOOR) * level, 0, 1);

// Meters on a log scale [model, display only]: dopamine is the accumbens core relative to its
// tonic baseline, full at ×4 (the climax reaches about ×3.5); stress is plasma adrenaline relative
// to its resting value, full at ×4 (the stressor peaks near ×4.1, §12.11).
export const DA_FULL_RATIO = 4;
export const STRESS_FULL_RATIO = 4;
const logLevel = (ratio, full) => {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return clamp(Math.log2(r) / Math.log2(full), 0, 1);
};
export const dopamineLevel = (ratio) => logLevel(ratio, DA_FULL_RATIO);
export const stressLevel = (ratio) => logLevel(ratio, STRESS_FULL_RATIO);

export const METERS = {
  stress: { label: 'Stress hormones', low: 'rest', high: 'high' },
  dopamine: { label: 'Dopamine', low: 'rest', high: 'peak' },
};

export const CALM_STORY = { scenario: '', stage: 'Calm', text: 'Brain and body at rest. Choose Stress or Dopamine below.' };

// Plain stage titles and one sentence each (the full HUD keeps the sourced texts of scenarios.js
// and response.js PHASES). Key: `<scenario id>:<stage name>`.
export const PLAIN_STAGES = {
  'orgasm:Baseline': ['Rest', 'The reward system is at rest.'],
  'orgasm:Excitement': ['Arousal builds', 'Dopamine begins to rise in the reward system.'],
  'orgasm:Plateau': ['High arousal', 'Dopamine stays above its resting level.'],
  'orgasm:Onset': ['Onset', 'Dopamine neurons in the midbrain fire faster.'],
  'orgasm:Orgasm': ['Climax', 'Rhythmic muscle contractions. Dopamine peaks in the reward system.'],
  'orgasm:Early resolution': ['Afterwards', 'Arousal falls and dopamine starts to come down.'],
  'orgasm:Late resolution': ['Settling', 'The hormone prolactin stays raised for a while.'],
  'orgasm:Recovery': ['Recovery', 'The body returns to its resting state.'],
  'orgasm:No climax': ['No climax', 'Arousal fades without a climax.'],
  'stressor:Stressor': ['Stress begins', 'The alarm circuit of the brain switches on.'],
  'stressor:Sympatho-adrenal channel': ['Adrenaline', 'Nerves tell the adrenal glands to release adrenaline. The heart speeds up.'],
  'stressor:HPA channel': ['Cortisol', 'The hypothalamus signals the pituitary, and cortisol follows more slowly.'],
  'stressor:Recovery': ['Recovery', 'Adrenaline and cortisol slowly fall back after the stress.'],
};

// First sentence of a sourced text, without parentheses and section marks (fallback only).
export function firstSentence(text) {
  const s = String(text ?? '').replace(/\s*\([^()]*\)/g, '').replace(/\s*§[\d.]+/g, '').trim();
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

// The story line of a playing stage: a plain title and sentence when one is known.
export function plainStage(scenarioId, name, text) {
  const base = String(name ?? '').replace(/\s*·\s*trial.*$/, '');
  const hit = PLAIN_STAGES[`${scenarioId}:${base}`];
  if (hit) return { stage: hit[0], text: hit[1] };
  return { stage: name ?? '', text: firstSentence(text) };
}

// ---- SimpleHud ---------------------------------------------------------------------------------
//
// Handlers: onState('calm' | 'stress' | 'dopamine'), onView(view id), onStyle('detailed' | 'stars'),
// onQuality('auto' | tier index), onPause().
// update() payload: { state, view, style, quality: { value, autoLabel }, paused, dimmed, story: { scenario, stage, text },
// meter: { kind: 'stress' | 'dopamine', level 0–1 } | null }. The meter shows one number, its percentage.

export class SimpleHud {
  /**
   * @param {Document} doc
   * @param {Record<string, Function>} h
   */
  constructor(doc, h) {
    this.doc = doc;
    this.h = h;
    const $ = (id) => /** @type {any} */ (doc.getElementById(id));
    this.el = {
      root: $('shud'), scenario: $('shud-scenario'), stage: $('shud-stage'), text: $('shud-text'),
      meter: $('shud-meter'), meterLabel: $('shud-meter-label'), meterBar: $('shud-meter-bar'), meterLow: $('shud-meter-low'),
      meterHigh: $('shud-meter-high'), meterValue: $('shud-meter-value'), views: $('shud-views'), styles: $('shud-style'), quality: $('shud-quality'),
      pause: $('shud-pause'), states: $('shud-states'), monitor: $('shud-monitor'), monEcg: $('mon-ecg'), monAbp: $('mon-abp'),
      monResp: $('mon-resp'), monPleth: $('mon-pleth'), monCapno: $('mon-capno'),
    };
    this.mon = Object.fromEntries(MONITOR_KEYS.map((k) => [k, $(`mon-${k}`)]));
    this.s = { state: null, view: null, style: null, paused: null, dimmed: false, story: null, meterKind: null, meterLevel: -1, quality: null, monitor: null };
    this.btn = { state: new Map(), view: new Map(), style: new Map() };
    this._build();
    this._bind();
  }

  _build() {
    const e = this.el;
    for (const st of STATES) {
      const b = this.doc.createElement('button');
      b.type = 'button';
      b.className = `shud-state is-${st.id}`;
      b.dataset.id = st.id;
      b.setAttribute('aria-pressed', 'false');
      const name = this.doc.createElement('span');
      name.className = 'shud-state-name';
      name.textContent = st.label;
      const hint = this.doc.createElement('span');
      hint.className = 'shud-state-hint';
      hint.textContent = st.hint;
      b.append(name, hint);
      e.states.append(b);
      this.btn.state.set(st.id, b);
    }
    for (const v of SIMPLE_VIEWS) {
      const b = this.doc.createElement('button');
      b.type = 'button';
      b.className = 'shud-view';
      b.dataset.id = v.id;
      b.textContent = v.label;
      b.setAttribute('aria-pressed', 'false');
      e.views.append(b);
      this.btn.view.set(v.id, b);
    }
    for (const [id, label] of STYLES) {
      const b = this.doc.createElement('button');
      b.type = 'button';
      b.className = 'shud-view';
      b.dataset.id = id;
      b.textContent = label;
      b.setAttribute('aria-pressed', 'false');
      e.styles.append(b);
      this.btn.style.set(id, b);
    }
    for (const [value, label] of QUALITY) {
      const o = this.doc.createElement('option');
      o.value = value;
      o.textContent = label;
      e.quality.append(o);
    }
  }

  _bind() {
    const e = this.el, h = this.h;
    e.states.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-state');
      if (b) h.onState?.(b.dataset.id);
    });
    e.views.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-view');
      if (b) h.onView?.(b.dataset.id);
    });
    e.styles.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-view');
      if (b) h.onStyle?.(b.dataset.id);
    });
    e.quality.addEventListener('change', () => h.onQuality?.(e.quality.value));
    e.pause.addEventListener('click', () => h.onPause?.());
    this.doc.defaultView?.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = /** @type {any} */ (ev.target);
      if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
      if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); h.onPause?.(); }
      else if (ev.key === '1' || ev.key === '2' || ev.key === '3') h.onState?.(STATES[Number(ev.key) - 1].id);
    });
  }

  setPaused(paused) {
    if (paused === this.s.paused) return;
    this.s.paused = paused;
    const b = this.el.pause;
    b.setAttribute('aria-pressed', String(!!paused));
    b.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    b.title = paused ? 'Resume (P)' : 'Pause (P)';
    b.classList.toggle('is-paused', !!paused);
  }

  setDimmed(dimmed) {
    if (dimmed === this.s.dimmed) return;
    this.s.dimmed = dimmed;
    this.el.root.classList.toggle('dimmed', !!dimmed);
  }

  // Patient monitor traces (monitor.js), drawn every frame while the monitor shows: sweep mode, as on
  // a bedside monitor. Each ring buffer maps to the width; the newest sample is at head − 1 and an
  // erase bar runs just ahead of it.
  drawMonitor(heart, resp, pulse = null, capno = null) {
    const e = this.el;
    if (!e.monitor || e.monitor.hidden) return;
    const art = [40, 180];
    this._sweep(e.monEcg, heart.ecg, heart.ecgHead, (v) => 0.66 - 0.5 * v);
    this._sweep(e.monAbp, heart.abp, heart.ecgHead, (v) => 0.92 - 0.84 * (v - art[0]) / (art[1] - art[0]));
    if (pulse) this._sweep(e.monPleth, pulse.pleth, pulse.head, (v) => 0.9 - 0.55 * v);   // PPG, 1 = the resting pulse (pulse.js)
    this._sweep(e.monResp, resp.trace, resp.head, (v) => 0.9 - 0.55 * v);
    if (capno) this._sweep(e.monCapno, capno.trace, capno.head, (v) => 0.92 - 0.84 * v);   // capnogram, 0–50 mmHg (monitor.js)
  }
  _sweep(c, ring, head, toY) {
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height, n = ring.length, gap = Math.ceil(n * 0.04);
    ctx.clearRect(0, 0, w, h);
    const colour = getComputedStyle(c).color || '#4dff88';
    ctx.lineWidth = Math.max(1.5, h / 30);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = h / 14;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < n; i++) {
      if ((i - head + n) % n < gap) { pen = false; continue; }
      const x = (i / (n - 1)) * w, y = h * Math.min(0.98, Math.max(0.02, toY(ring[i])));
      if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
    }
    ctx.stroke();
  }

  update(p) {
    const e = this.el, s = this.s;
    if (p.state && p.state !== s.state) {
      s.state = p.state;
      for (const [id, b] of this.btn.state) b.setAttribute('aria-pressed', String(id === p.state));
      e.root.dataset.state = p.state;
    }
    if (p.view && p.view !== s.view) {
      s.view = p.view;
      for (const [id, b] of this.btn.view) b.setAttribute('aria-pressed', String(id === p.view));
    }
    if (p.style && p.style !== s.style) {
      s.style = p.style;
      for (const [id, b] of this.btn.style) b.setAttribute('aria-pressed', String(id === p.style));
    }
    // Quality: the select shows the user's choice; Auto names the tier it is running now.
    const q = p.quality;
    const qKey = q ? `${q.value}|${q.autoLabel}` : null;
    if (q && qKey !== s.quality) {
      s.quality = qKey;
      e.quality.value = q.value;
      const auto = e.quality.querySelector('option[value="auto"]');
      if (auto) auto.textContent = q.autoLabel ? `Auto (${q.autoLabel})` : 'Auto';
    }
    if (p.paused !== undefined) this.setPaused(!!p.paused);
    if (p.dimmed !== undefined) this.setDimmed(!!p.dimmed);

    const st = p.story ?? CALM_STORY;
    const key = `${st.scenario}|${st.stage}|${st.text}`;
    if (key !== s.story) {
      s.story = key;
      e.scenario.textContent = st.scenario || '';
      e.scenario.hidden = !st.scenario;
      e.stage.textContent = st.stage || '';
      e.text.textContent = st.text || '';
      e.text.hidden = !st.text;
    }

    // Patient monitor (monitor.js): the numbers and their alarm colour; drawMonitor draws the traces.
    const m = p.monitor ?? null;
    const mKey = m ? MONITOR_KEYS.map((k) => monitorText(k, m[k])).join('|') : null;
    if (mKey !== s.monitor) {
      s.monitor = mKey;
      if (e.monitor) e.monitor.hidden = !m;
      if (m) {
        for (const k of MONITOR_KEYS) if (this.mon[k]) this.mon[k].textContent = monitorText(k, m[k]);
        const alarm = { hr: isAlarm('hr', m.hr), art: isAlarm('art', m.sys), rr: isAlarm('rr', m.rr), temp: isAlarm('temp', m.temp),
          adr: isAlarm('adr', m.adr), cort: isAlarm('cort', m.cort), spo2: isAlarm('spo2', m.spo2), co2: isAlarm('co2', m.co2) };
        for (const row of e.monitor?.querySelectorAll?.('[data-key]') ?? []) row.classList.toggle('is-alarm', !!alarm[row.dataset.key]);
      }
    }

    const kind = p.meter?.kind ?? null;
    if (kind !== s.meterKind) {
      s.meterKind = kind;
      s.meterLevel = -1;
      e.meter.hidden = !kind;
      if (kind) {
        const m = METERS[kind];
        e.meter.dataset.kind = kind;
        e.meterLabel.textContent = m.label;
        e.meterLow.textContent = m.low;
        e.meterHigh.textContent = m.high;
        e.meter.setAttribute('aria-label', m.label);
      }
    }
    if (kind) {
      const lvl = Math.round(clamp(p.meter.level ?? 0, 0, 1) * 100);
      if (lvl !== s.meterLevel) {
        s.meterLevel = lvl;
        e.meterBar.style.transform = `scaleX(${lvl / 100})`;
        e.meterValue.textContent = `${lvl}%`;
        e.meter.setAttribute('aria-valuenow', String(lvl));
        e.meter.setAttribute('aria-valuetext', lvl < 5 ? 'At rest' : `${lvl}% of the way to ${METERS[kind].high}`);
      }
    }

  }
}
