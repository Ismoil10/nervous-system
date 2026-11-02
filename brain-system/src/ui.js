// HUD: status panel, collapsible dropdowns (vitals, live, dopamine, modulators on the left; body,
// interventions, stimulus, scenarios, time, brain systems, views, performance and settings on the
// right), the controls bar and the About dialog. main.js drives it through the Hud class below; the
// HUD calls a handler only in response to a user action, never on its own. The whole-body
// dropdowns live in ui-body.js and share this file's readout helpers and storage prefix.
// Nothing here touches the DOM at import time, so the module also loads outside a browser.

import { BodyHud, viewLabel, viewOrder, isBodyView, vitalTags, TAG_TITLES, formatEvent, formatClockTime } from './ui-body.js';

const $ = (id) => document.getElementById(id);
const clamp01 = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);
const DASH = '—';
const MINUS = '−';

// A finite number, or null for a missing or invalid value.
const num = (v) => {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const nonNeg = (v) => {
  const x = num(v);
  return x === null ? null : Math.max(0, x);
};

// Only write when the text changes: fewer DOM mutations and no repeated live-region chatter.
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// A text readout that is rewritten only when its quantized key changes, so update() formats a
// string only for values that actually moved. The formatter receives the key; null shows a dash.
const readout = (el) => ({ el, k: undefined });
function show(r, key, fmt) {
  if (key === r.k) return;
  r.k = key;
  r.el.textContent = key === null ? DASH : fmt(key);
}

// A bar fill (transform: scaleX) rewritten only when its quantized width changes.
const BAR_STEPS = 400;
const meter = (el, min = 0) => ({ el, k: -1, min });
function setMeter(m, x) {
  const k = Math.round(Math.max(m.min, clamp01(x)) * BAR_STEPS);
  if (k === m.k) return;
  m.k = k;
  m.el.style.transform = `scaleX(${k / BAR_STEPS})`;
}

// Shared with ui-body.js, so every dropdown formats and stores state the same way.
const KIT = { $, show, readout, setText, num, nonNeg, clamp01, DASH, MINUS };

// Formatters. Each takes the quantized key computed in update().
const nmKey = (v) => (v < 9.95 ? Math.round(v * 10) : 1000 + Math.round(v));   // one decimal under 10 nM
const nmText = (k) => (k < 1000 ? (k / 10).toFixed(1) : String(k - 1000));
const fmtNm = (k) => `${nmText(k)} nM`;
const RATIO_NONE = 999;
const fmtCore = (k) => {                                 // NAcc core: "34 nM · ×2.3"
  const r = k % 1000;
  const nm = fmtNm((k - r) / 1000);
  return r === RATIO_NONE ? nm : `${nm} · ×${(r / 10).toFixed(1)}`;
};
const fmtHz = (k) => `${(k / 10).toFixed(1)} Hz`;
const occKey = (p) => (p < 9.95 ? Math.round(p * 10) : 1000 + Math.round(p));  // p in percent
const fmtOcc = (k) => `${nmText(k)}%`;
const fmtSigned = (k) => (k === 0 ? '0.00' : `${k > 0 ? '+' : MINUS}${(Math.abs(k) / 100).toFixed(2)}`);
const fmt2 = (k) => (k / 100).toFixed(2);
const fmtGain = (k) => `×${(k / 100).toFixed(2)}`;
const fmtPct = (k) => `${k}%`;
const fmtBpm = (k) => `${k} bpm`;
const fmtRr = (k) => `${k} /min`;
const fmtBp = (k) => `${Math.floor(k / 1000)}/${k % 1000} mmHg`;
const fmtPulses = (k) => `${Math.floor(k / 10000)} / ${k % 10000}`;
const fmtFpsBadge = (k) => (k < 0 ? `${DASH} FPS` : `${k} FPS`);
const fmtInt = (k) => k.toLocaleString('en-US');
const fmtRes = (k) => `${Math.floor(k / 100000)}×${k % 100000}`;
const fmtMs = (k) => `${(k / 10).toFixed(1)} ms`;
// Vitals precision (§13.13): pupils 0.1 mm, skin conductance 0.1 µS, temperatures 0.1 °C,
// cortisol 0.1 µg/dL; heart rate, blood pressure, adrenaline and IL-6 whole numbers.
const tenth = (x) => Math.round(x * 10);
const fmtTenth = (unit) => (k) => `${(k / 10).toFixed(1)} ${unit}`;
const fmtPupil = (k) => `${(Math.floor(k / 1000) / 10).toFixed(1)} / ${((k % 1000) / 10).toFixed(1)} mm`;
const fmtCoreT = (k) => {                                // "37.8 °C · set 38.5"
  const set = k % 10000, core = (k - set) / 10000;
  return set === 9999 ? `${(core / 10).toFixed(1)} °C` : `${(core / 10).toFixed(1)} °C · set ${(set / 10).toFixed(1)}`;
};
const fmtWhole = (unit) => (k) => `${fmtInt(k)} ${unit}`;

const STORE_PREFIX = 'brain-system.drop.';

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
function readOpen(key) {
  try { return localStorage.getItem(STORE_PREFIX + key) === '1'; } catch { return false; }
}
function writeOpen(key, open) {
  try { localStorage.setItem(STORE_PREFIX + key, open ? '1' : '0'); } catch { /* ignore */ }
}

// Refractory duration slider: input 0..1000 mapped logarithmically onto 10 s .. 24 h.
const TREF_MIN = 10;
const TREF_MAX = 24 * 3600;
const TREF_STEPS = 1000;
const TREF_LOG = Math.log(TREF_MAX / TREF_MIN);
const trefFromInput = (v) => TREF_MIN * Math.exp((v / TREF_STEPS) * TREF_LOG);
const inputFromTref = (s) =>
  Math.round((TREF_STEPS * Math.log(Math.min(TREF_MAX, Math.max(TREF_MIN, s)) / TREF_MIN)) / TREF_LOG);

// Rounds a duration to the precision formatDuration shows, so the label and the value agree.
function roundDuration(s) {
  if (s < 59.5) return Math.max(1, Math.round(s));
  if (s < 600) return Math.round(s / 6) * 6;          // 0.1 min
  if (s < 3600) return Math.round(s / 60) * 60;       // 1 min
  if (s < 36000) return Math.round(s / 360) * 360;    // 0.1 h
  return Math.round(s / 3600) * 3600;                 // 1 h
}

// "40 s", "1.5 min", "15 min", "2.5 h", "24 h".
function formatDuration(seconds) {
  const s = roundDuration(seconds);
  const n = (x) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${n(s / 60)} min`;
  return `${n(s / 3600)} h`;
}

// Letter shortcuts stay quiet while the user is typing. A range slider or a checkbox is not
// typing, but a select is (letters jump between its options).
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color']);
function isTyping(t) {
  if (!t) return false;
  if (t instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(t.type);
  return t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || t.isContentEditable === true;
}
// Space keeps its native meaning on every focused control.
function spaceIsNative(t) {
  return t instanceof HTMLInputElement || t instanceof HTMLSelectElement ||
    t instanceof HTMLTextAreaElement || t instanceof HTMLButtonElement ||
    t?.isContentEditable === true;
}

// Dopamine sparkline: NAcc core concentration on a fixed 0–80 nM axis, tonic level 15 nM.
const SPARK_MAX = 80;
const SPARK_TONIC = 15;
const DASHED = [3, 3];
const SOLID = [];

// Terminal fields shown in nM (payload key, element id). NAcc core has its own row with the ratio.
const DA_FIELDS = [
  ['naccShell', 'da-nacc-shell'], ['dStriatum', 'da-dstr'], ['mPFC', 'da-mpfc'], ['amygdala', 'da-amy'],
  ['mpoa', 'da-mpoa'], ['pvn', 'da-pvn'], ['medEminence', 'da-me'], ['spinal', 'da-spinal'],
];
const FIRING = [['vta', 'fire-vta'], ['snc', 'fire-snc'], ['tida', 'fire-tida']];
// Modulators: payload key, element id and the payload value that fills the bar completely. The
// last four (§13.13) are relative to the relaxed waking state; their row shows once main.js sends them.
const MODULATORS = [
  ['prolactin', 'mod-prolactin', 1.5], ['serotonin', 'mod-serotonin', 1], ['gaba', 'mod-gaba', 1],
  ['opioid', 'mod-opioid', 1], ['oxytocin', 'mod-oxytocin', 1.4],
  ['noradrenaline', 'mod-noradrenaline', 2], ['acetylcholine', 'mod-acetylcholine', 2],
  ['histamine', 'mod-histamine', 2], ['orexin', 'mod-orexin', 2],
];
// The four DOPAMINE.md tints drawn when the payload does not name the active set.
const DEFAULT_TINTS = new Set(['prolactin', 'serotonin', 'gaba', 'opioid']);
// A prediction error beyond these bounds is tinted (amber positive, blue-grey negative).
const RPE_POS = 0.05;
const RPE_NEG = -0.05;
// The burst pill shows above BURST_ON and hides below BURST_OFF, so it never flickers.
const BURST_ON = 0.3;
const BURST_OFF = 0.15;
// Event log (B.9: 12 entries) and its polite announcements (§13.13: at most one per 2 s).
const EVENT_LOG_LENGTH = 12;
const ANNOUNCE_MS = 2000;
// Vitals rows beyond the legacy three: element suffix (row-*, tag-*, value id).
const VITAL_ROWS = ['hr', 'bp', 'rr', 'pupil', 'scl', 'tcore', 'tskin', 'motility', 'cortisol', 'adrenaline', 'il6', 'sickness'];

export class Hud {
  constructor(handlers) {
    this.h = handlers || {};
    this.el = {
      hud: $('hud'), status: $('status'), controls: $('controls'), right: document.querySelector('#hud .right'),
      phaseName: $('phase-name'), phaseDesc: $('phase-desc'), clock: $('clock'),
      arousalMeter: $('arousal-meter'), refractory: $('refractory'), refractoryVal: $('refractory-val'),
      spark: $('spark'), vtaBurst: $('vta-burst'), rpe: $('rpe'),
      tier: $('tier'), gpu: $('gpu'), gpuMsRow: $('gpu-ms-row'),
      stimulate: $('stimulate'), distract: $('distract'), pause: $('pause'), viewBtn: $('view-btn'),
      modeDemo: $('mode-demo'), modeManual: $('mode-manual'),
      level: $('stim-level'), levelVal: $('stim-val'),
      profile: $('profile'), tref: $('tref'), trefVal: $('tref-val'),
      view: $('view'), hypothesis: $('hypothesis'), quality: $('quality'), reset: $('reset'),
      info: $('info'), infoCard: $('info-card'), infoBtn: $('info-btn'), infoClose: $('info-close'),
      vitalsChip: $('vitals-chip'), pulsesRow: $('row-pulses'), bpRow: $('row-bp'),
      vitalsTrace: $('vitals-trace'), vitalsVar: $('vitals-var'), vitalsSpan: $('vitals-span'), vitalsSpark: $('vitals-spark'),
      eventLog: $('event-log'), eventAnnounce: $('event-announce'), liveNote: $('live-note'),
      livePathRow: $('live-path-row'), livePath: $('live-path'),
    };
    const r = (id) => readout($(id));
    this.r = {
      arousal: r('arousal-val'),
      pulses: r('pulses'),
      naccCore: r('da-nacc-core'), d1: r('occ-d1'), d2: r('occ-d2'), rpe: r('rpe'),
      gain: r('mod-gain'),
      fpsBadge: r('fps-badge'), fps: r('fps'), points: r('points'), res: r('res'), gpuMs: r('gpu-ms'),
      bodyPoints: r('body-points'), extraPoints: r('extra-points'), packets: r('packets'), kernelMs: r('kernel-ms'),
    };
    this.vit = Object.fromEntries(VITAL_ROWS.map((id) => [id, { row: $(`row-${id}`), tag: $(`tag-${id}`), r: r(id), tagText: '' }]));
    this.perfRows = { bodyPoints: $('body-points-row'), extraPoints: $('extra-points-row'), packets: $('packets-row'),
      kernelMs: $('kernel-ms-row'), clockLimited: $('clock-limited-row') };
    this.daRows = DA_FIELDS.map(([key, id]) => ({ key, r: r(id) }));
    this.fireRows = FIRING.map(([key, id]) => ({ key, r: r(id) }));
    this.modRows = MODULATORS.map(([key, id, full]) => {
      const el = $(id);
      const li = el.closest('li');
      return { key, full, li, dot: li.querySelector('.dot'), r: readout(el), bar: meter(li.querySelector('.nc-fill')) };
    });
    this.m = { arousal: meter($('arousal-bar'), 0.01), refractory: meter($('refractory-bar')) };

    this.sparkCtx = this.el.spark.getContext('2d');
    this.sparkGrad = null;
    this.sparkGradH = 0;
    this.vitalsCtx = this.el.vitalsSpark.getContext('2d');

    this.mode = 'demo';
    this.view = 'whole';
    this.lastTref = null;
    this.levelDragging = false;
    // Stimulation is held by a pointer on the button and/or a key; the handler sees one combined state.
    this.stim = { pointer: false, key: null, held: false };
    this.lastPhase = this.el.phaseName.textContent;
    this.arousalK = -1;
    this.refK = -1;
    this.refRemaining = null;
    this.rpeState = 0;
    this.burstOn = false;
    this.orgasm = null;          // the orgasm scenario is active: Stimulate, Distract, meters, Space and D
    this.paused = false;
    this.tintsKey = '';
    this.eventKey = '';
    this.eventFirst = '';
    this.announcedAt = -Infinity;
    this.last = null;            // latest payload, used to refresh a dropdown the moment it opens

    this._bindDropdowns();
    this.body = new BodyHud(this, KIT);
    this._bind();
    this._showView(this.el.view.value);
    this._setOrgasm(this.body.scenarioIsOrgasm);
  }

  // ---- Dropdowns ------------------------------------------------------------------------

  // Each dropdown is a section whose heading button toggles its body (aria-expanded). Every
  // dropdown starts closed unless its stored state says otherwise.
  _bindDropdowns() {
    const e = this.el;
    const drops = {};
    for (const root of e.hud.querySelectorAll('.drop')) {
      const d = {
        root, key: root.dataset.store,
        head: root.querySelector('.drop-head'), body: root.querySelector('.drop-body'),
        open: false, listeners: [],
      };
      drops[d.key] = d;
      d.head.addEventListener('click', () => this._setOpen(d, !d.open));
    }
    this.drops = drops;

    // A section that opens is refreshed at once from the latest payload (closed ones are skipped
    // by update()).
    for (const d of Object.values(drops)) {
      d.listeners.push((open) => { if (open && this.last) this._refresh(d.key); });
    }

    const bodyOverlap = (a, b) => {
      if (!a.open || !b.open) return false;
      const r = a.body.getBoundingClientRect(), s = b.body.getBoundingClientRect();
      return r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom;
    };

    // Every right-column dropdown becomes a popover on small screens. There, opening one always
    // closes the others; on any screen, when two bodies would overlap, the one just opened stays
    // open. A popover that would cover an open data dropdown follows the same rule.
    const narrow = window.matchMedia('(max-width: 760px)');
    this.narrow = narrow;
    const byRoot = (sel) => [...e.hud.querySelectorAll(sel)].map((root) => drops[root.dataset.store]);
    const popovers = byRoot('.right > .drop');
    const side = byRoot('.drops > .drop');
    this.popovers = popovers;
    let lastPopover = null;
    for (const d of popovers) {
      d.listeners.push((open) => {
        if (!open) return;
        lastPopover = d;
        for (const o of popovers) {
          if (o !== d && o.open && (narrow.matches || bodyOverlap(d, o))) this._setOpen(o, false);
        }
        for (const o of side) if (bodyOverlap(d, o)) this._setOpen(o, false);
      });
    }
    for (const d of side) {
      d.listeners.push((open) => {
        if (!open) return;
        for (const p of popovers) if (bodyOverlap(d, p)) this._setOpen(p, false);
      });
    }
    window.addEventListener('resize', () => {
      if (narrow.matches) {
        const open = popovers.filter((p) => p.open);
        const keep = open.includes(lastPopover) ? lastPopover : open[open.length - 1];
        for (const p of open) if (p !== keep) this._setOpen(p, false);
      }
      for (const p of popovers) if (side.some((d) => bodyOverlap(d, p))) this._setOpen(p, false);
    });

    // On small screens a pointer press outside an open popover closes it (but not while the
    // About dialog is open over it, so focus can return to the About button afterwards).
    document.addEventListener('pointerdown', (ev) => {
      if (!e.info.hidden || !narrow.matches) return;
      for (const p of popovers) if (p.open && !p.root.contains(ev.target)) this._setOpen(p, false);
    });

    // CSS positions the small-screen popovers from the live heights of the status panel
    // (--status-h), the row of popover buttons (--right-h) and the controls bar (--controls-h).
    if ('ResizeObserver' in window) {
      const track = (el, prop) => {
        if (!el) return;
        const set = () => e.hud.style.setProperty(prop, `${el.offsetHeight}px`);
        set();   // at once: observer callbacks wait for the next rendering step
        new ResizeObserver(set).observe(el);
      };
      track(e.status, '--status-h');
      track(e.right, '--right-h');
      track(e.controls, '--controls-h');
    }

    // Restore the stored states first, then run the listeners in document order, so a reload never
    // brings back two overlapping bodies.
    const all = Object.values(drops);
    for (const d of all) this._applyOpen(d, readOpen(d.key));
    for (const d of all) if (d.open) for (const fn of d.listeners) fn(true);
  }

  _applyOpen(d, open) {
    d.open = open;
    d.root.classList.toggle('open', open);
    d.head.setAttribute('aria-expanded', String(open));
    d.body.hidden = !open;
  }

  _setOpen(d, open) {
    if (d.open === open) return;
    this._applyOpen(d, open);
    writeOpen(d.key, open);
    for (const fn of d.listeners) fn(open);
  }

  // Closes a dropdown; focus inside it moves back to its heading button. Returns whether it was open.
  _close(d) {
    if (!d || !d.open) return false;
    const hadFocus = d.root.contains(document.activeElement);
    this._setOpen(d, false);
    if (hadFocus) d.head.focus();
    return true;
  }

  // The open dropdown whose body holds the element, or null.
  _dropOf(el) {
    for (const d of Object.values(this.drops)) if (d.open && d.root.contains(el)) return d;
    return null;
  }

  // ---- Controls and keyboard ------------------------------------------------------------

  _bind() {
    const e = this.el, h = this.h;

    e.modeDemo.addEventListener('click', () => this._userMode('demo'));
    e.modeManual.addEventListener('click', () => this._userMode('manual'));

    e.level.addEventListener('input', () => {
      const v = Number(e.level.value) / 100;
      this._showLevel(v);
      h.onLevel?.(v);
    });
    // While the user drags the slider, scripted setLevel() calls do not fight the thumb.
    e.level.addEventListener('pointerdown', () => { this.levelDragging = true; });
    const endDrag = () => { this.levelDragging = false; };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    e.profile.addEventListener('change', () => h.onProfile?.(e.profile.value));
    e.hypothesis.addEventListener('change', () => h.onHypothesis?.(e.hypothesis.value));
    e.quality.addEventListener('change', () => h.onQuality?.(e.quality.value));
    e.view.addEventListener('change', () => this._userView(e.view.value));
    e.tref.addEventListener('input', () => {
      const s = roundDuration(trefFromInput(Number(e.tref.value)));
      this._showTref(s);
      if (s === this.lastTref) return;
      this.lastTref = s;
      h.onTref?.(s);
    });
    e.reset.addEventListener('click', () => h.onReset?.());
    e.distract.addEventListener('click', () => { if (this.orgasm) h.onDistract?.(); });
    e.pause.addEventListener('click', () => h.onPause?.());
    e.viewBtn.addEventListener('click', () => this._cycleView());
    e.vitalsVar.addEventListener('change', () => { if (this.last) this._updateVitals(this.last); });

    // Stimulate is held. Touch input is implicitly captured by the button, so the capture is
    // released at once: sliding a finger off the button ends the hold, just like the mouse.
    const btn = e.stimulate;
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || !this.orgasm) return;
      if (btn.hasPointerCapture?.(ev.pointerId)) btn.releasePointerCapture(ev.pointerId);
      this._setStim('pointer', true);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
      btn.addEventListener(type, () => this._setStim('pointer', false));
    }
    // Safety net: a release anywhere ends a pointer hold (e.g. the HUD was hidden mid-press).
    window.addEventListener('pointerup', () => this._setStim('pointer', false));
    window.addEventListener('pointercancel', () => this._setStim('pointer', false));
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());

    // Losing focus or visibility never leaves stimulation stuck on.
    const releaseAll = () => { this._setStim('key', null); this._setStim('pointer', false); };
    this.releaseStim = releaseAll;
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    // The HUD is inert while it is hidden (H) or while the modal About dialog is open,
    // so keyboard focus cannot reach controls that are invisible or behind the backdrop.
    const syncInert = () => {
      e.hud.inert = e.hud.classList.contains('hidden') || !e.info.hidden;
    };

    let returnFocus = null;
    const toggleInfo = (show) => {
      if (show === !e.info.hidden) return;
      e.info.hidden = !show;
      syncInert();
      if (show) {
        releaseAll();
        this.body.cancelPicking();
        returnFocus = document.activeElement;
        // The dialog itself takes focus, so a long text opens at its top on small screens
        // instead of scrolling down to the Close button.
        e.infoCard.scrollTop = 0;
        e.infoCard.focus({ preventScroll: true });
      } else {
        if (returnFocus && returnFocus.isConnected && returnFocus !== document.body) returnFocus.focus();
        else e.infoCard.blur();
        returnFocus = null;
      }
    };
    e.infoBtn.addEventListener('click', () => toggleInfo(e.info.hidden));
    e.infoClose.addEventListener('click', () => toggleInfo(false));
    e.info.addEventListener('click', (ev) => { if (ev.target === e.info) toggleInfo(false); });

    const toggleFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {});
      else document.documentElement.requestFullscreen?.()?.catch(() => {});
    };

    window.addEventListener('keydown', (ev) => {
      // Leave browser shortcuts (Ctrl+F, Alt+F, ...) alone.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = ev.target;
      const modal = !e.info.hidden;

      // Escape is not typing, so it works even while a slider or a select has focus. In order it
      // closes the dialog, cancels site picking, clears the focused site list, closes the dropdown
      // holding focus, or closes an open small-screen popover.
      if (ev.key === 'Escape') {
        if (modal) { toggleInfo(false); return; }
        if (this.body.cancelPicking()) return;
        if (this.body.clearSiteIfFocused(t)) return;
        if (this._close(this._dropOf(t))) return;
        if (this.narrow.matches) for (const p of this.popovers) if (this._close(p)) return;
        return;
      }

      // The focused Stimulate button is held with Space or Enter, like a pointer.
      if (t === btn && (ev.key === ' ' || ev.key === 'Enter')) {
        ev.preventDefault();
        if (!ev.repeat && !modal && this.orgasm && this.stim.key === null) this._setStim('key', ev.key);
        return;
      }

      // Enter fires the stimulus while focus is inside the Stimulus dropdown.
      if (ev.key === 'Enter' && !modal && !ev.repeat && this.body.handleEnter(ev)) return;

      // Space stimulates only inside the orgasm scenario.
      if (ev.key === ' ') {
        if (spaceIsNative(t) || !this.orgasm) return;
        ev.preventDefault();
        if (!ev.repeat && !modal && this.stim.key === null) this._setStim('key', ' ');
        return;
      }

      if (ev.repeat || isTyping(t)) return;
      const k = ev.key.toLowerCase();
      if (k === 'd') { if (!modal && this.orgasm) h.onDistract?.(); }
      else if (k === 'p') h.onPause?.();
      else if (k === 'v') { if (!modal) this._cycleView(); }
      else if (k === 'h') {
        if (modal) return;
        e.hud.classList.toggle('hidden');
        syncInert();
      }
      else if (k === 'i') toggleInfo(!modal);
      else if (k === 'f') toggleFullscreen();
      else if (k === 'b') { if (!modal) this.body.toggleBodyMode(); }
      else if (k === 'l') { if (!modal) this.body.toggleTimeLock(); }
      else if (ev.key === '[') { if (!modal) this.body.stepRate(-1); }
      else if (ev.key === ']') { if (!modal) this.body.stepRate(1); }
    });

    window.addEventListener('keyup', (ev) => {
      if (this.stim.key === null || ev.key !== this.stim.key) return;
      if (ev.target === btn) ev.preventDefault();
      this._setStim('key', null);
    });
  }

  _setStim(source, value) {
    const s = this.stim;
    s[source] = value;
    const held = s.pointer || s.key !== null;
    if (held === s.held) return;
    s.held = held;
    // Stimulating during Demo hands control to the user: Manual mode with the slider at zero,
    // so the stimulation ends when the hold ends instead of continuing at the scripted level.
    if (held && this.mode === 'demo') {
      this._userMode('manual');
      this._showLevel(0);
      this.h.onLevel?.(0);
    }
    this.el.stimulate.classList.toggle('active', held);
    this.el.stimulate.setAttribute('aria-pressed', String(held));
    this.h.onStimulate?.(held);
  }

  // Stimulate, Distract, the arousal meter and the contractions row exist only in the orgasm scenario.
  _setOrgasm(on) {
    on = !!on;
    if (on === this.orgasm) return;
    this.orgasm = on;
    const e = this.el;
    e.stimulate.hidden = !on;
    e.distract.hidden = !on;
    e.arousalMeter.hidden = !on;
    if (!on) {
      e.refractory.hidden = true;
      e.pulsesRow.hidden = true;
      this.releaseStim?.();
    }
  }

  // The payload names the active scenario (B.10); a build without the scenario player runs the
  // orgasm scenario only.
  _orgasmActive(s) {
    if (typeof s.orgasm === 'boolean') return s.orgasm;
    if (s.scenario !== undefined) return !!(s.scenario && s.scenario.id === 'orgasm' && s.scenario.active);
    return this.body.scenarioIsOrgasm;
  }

  _showMode(mode) {
    const e = this.el;
    const manual = mode === 'manual';
    this.mode = manual ? 'manual' : 'demo';
    e.modeDemo.classList.toggle('active', !manual);
    e.modeManual.classList.toggle('active', manual);
    e.modeDemo.setAttribute('aria-pressed', String(!manual));
    e.modeManual.setAttribute('aria-pressed', String(manual));
    e.level.disabled = !manual;
  }

  _userMode(mode) {
    if (mode === this.mode) return;
    this._showMode(mode);
    this.h.onMode?.(mode);
  }

  _showLevel(v) {
    const pct = Math.round(clamp01(Number(v) || 0) * 100);
    if (Number(this.el.level.value) !== pct) this.el.level.value = String(pct);
    setText(this.el.levelVal, `${pct}%`);
  }

  _showTref(seconds) {
    const text = formatDuration(seconds);
    setText(this.el.trefVal, text);
    this.el.tref.setAttribute('aria-valuetext', text);
  }

  _showView(id) {
    const name = viewLabel(id);
    if (!name) return;
    this.view = id;
    const e = this.el;
    if (e.view.value !== id) e.view.value = id;
    e.viewBtn.title = `Cycle view (V key). Current: ${name}`;
  }

  _userView(id) {
    if (!viewLabel(id)) return;
    if (isBodyView(id) && this.body.bodyMode !== 'body') return;
    this._showView(id);
    this.h.onView?.(id);
  }

  // V cycles the views available in the current mode (B.10).
  _cycleView() {
    const order = viewOrder(this.body.bodyMode);
    const i = order.indexOf(this.view);
    this._userView(order[(i + 1) % order.length]);
  }

  // ---- API used by main.js ---------------------------------------------------------------

  // Shows the current settings without calling any handler. tref is in seconds; quality is
  // 'auto' or '0'..'3' (optional). The whole-body keys (bodyMode, nets, intervention, scenario,
  // kh, timeLock, arousalState, overlays, age, limbMotion, reducedMotion, sense) go to ui-body.js.
  syncSettings(o = {}) {
    const { mode, level, profile, tref, view, hypothesis, quality } = o;
    const e = this.el;
    if (mode != null) this._showMode(mode);
    if (level != null) this._showLevel(level);
    if (profile != null) e.profile.value = String(profile);
    if (hypothesis != null) e.hypothesis.value = String(hypothesis);
    if (quality != null) e.quality.value = String(quality);
    if (tref != null && Number.isFinite(Number(tref))) {
      const s = Number(tref);
      e.tref.value = String(inputFromTref(s));
      this._showTref(s);
      this.lastTref = roundDuration(s);
    }
    this.body.syncSettings(o);
    if (view != null) this._showView(String(view));
    // Before the first payload, a scenario chosen at load (e.g. ?scenario=orgasm) sets the controls.
    if (o.scenario !== undefined && !this.last) this._setOrgasm(this.body.scenarioIsOrgasm);
  }

  setPaused(paused) {
    this.paused = !!paused;
    setText(this.el.pause, paused ? 'Resume' : 'Pause');
    this.el.pause.setAttribute('aria-pressed', String(!!paused));
    this.body.setPaused(paused);
  }

  // Moves the stimulation slider to the scripted level (Demo mode) without calling onLevel.
  setLevel(v) {
    if (this.levelDragging && this.mode === 'manual') return;
    this._showLevel(v);
  }

  // During the climax the HUD fades to 25 % opacity over 0.6 s (instantly with reduced motion)
  // and back; the controls stay usable. main.js calls it only inside the orgasm scenario.
  setDimmed(dimmed) {
    this.el.hud.classList.toggle('dimmed', !!dimmed);
  }

  // Updates the view select and the View button without calling onView.
  setView(id) {
    this._showView(String(id));
  }

  // The site resolved from a pick or the keyboard list, { valid: false }, or null (ui-body.js).
  setSite(info) {
    this.body.setSite(info);
  }

  // Arms or disarms site picking without calling onPick.
  setPicking(armed) {
    this.body.setPicking(armed);
  }

  // Called about 8 times per second. Closed dropdowns are skipped; each opens with fresh values.
  update(s) {
    if (!s) return;
    this.last = s;
    const d = this.drops;
    this.body.update(s);
    this._setOrgasm(this._orgasmActive(s));
    this._updateStatus(s);
    this._updateVitalsChip(s);
    if (d.dopamine.open) this._updateDopamine(s);
    if (d.modulators.open) this._updateModulators(s);
    if (d.vitals.open) this._updateVitals(s);
    if (d.live.open) this._updateLive(s);
    this._updatePerf(s, d.perf.open);
  }

  _refresh(key) {
    const s = this.last;
    if (key === 'dopamine') this._updateDopamine(s);
    else if (key === 'modulators') this._updateModulators(s);
    else if (key === 'vitals') this._updateVitals(s);
    else if (key === 'live') this._updateLive(s);
    else if (key === 'perf') this._updatePerf(s, true);
    else this.body.refresh(key);
  }

  _updateStatus(s) {
    const e = this.el;
    if (s.phaseName !== this.lastPhase) {
      this.lastPhase = s.phaseName;
      e.phaseName.textContent = s.phaseName ?? '';
      // Restart the transform-only settle animation.
      e.phaseName.classList.remove('flash');
      void e.phaseName.offsetWidth;
      e.phaseName.classList.add('flash');
    }
    setText(e.clock, s.clock || DASH);
    if (!this.orgasm) return;

    const a = clamp01(Number(s.arousal) || 0);
    const ak = Math.round(a * 100);
    show(this.r.arousal, ak, fmtPct);
    setMeter(this.m.arousal, a);
    if (ak !== this.arousalK) {
      this.arousalK = ak;
      e.hud.style.setProperty('--arousal', String(ak / 100));
    }

    const r = s.refractory;
    const active = !!(r && r.active);
    if (e.refractory.hidden === active) e.refractory.hidden = !active;
    if (active) {
      const pct = clamp01(Number(r.pct) || 0);
      const k = Math.round(pct * 100);
      const remaining = r.remaining || null;
      if (k !== this.refK || remaining !== this.refRemaining) {
        this.refK = k;
        this.refRemaining = remaining;
        e.refractoryVal.textContent = remaining ? `${k}% · ${remaining} left` : `${k}%`;
      }
      setMeter(this.m.refractory, pct);
    }
  }

  _updateDopamine(s) {
    const e = this.el, d = s.dopamine;
    if (d) {
      const core = nonNeg(d.naccCore), ratio = nonNeg(d.ratioNacc);
      const rk = ratio === null ? RATIO_NONE : Math.min(RATIO_NONE - 1, Math.round(ratio * 10));
      show(this.r.naccCore, core === null ? null : nmKey(core) * 1000 + rk, fmtCore);
      for (const row of this.daRows) {
        const v = nonNeg(d[row.key]);
        show(row.r, v === null ? null : nmKey(v), fmtNm);
      }
      for (const row of this.fireRows) {
        const v = nonNeg(d[row.key]);
        show(row.r, v === null ? null : Math.round(v * 10), fmtHz);
      }
      const d1 = nonNeg(d.d1), d2 = nonNeg(d.d2);
      show(this.r.d1, d1 === null ? null : occKey(clamp01(d1) * 100), fmtOcc);
      show(this.r.d2, d2 === null ? null : occKey(clamp01(d2) * 100), fmtOcc);

      const delta = num(d.delta);
      show(this.r.rpe, delta === null ? null : Math.round(delta * 100), fmtSigned);
      const state = delta === null ? 0 : delta > RPE_POS ? 1 : delta < RPE_NEG ? -1 : 0;
      if (state !== this.rpeState) {
        this.rpeState = state;
        e.rpe.classList.toggle('pos', state === 1);
        e.rpe.classList.toggle('neg', state === -1);
      }

      const burst = nonNeg(d.burst) ?? 0;
      const on = this.burstOn ? burst > BURST_OFF : burst > BURST_ON;
      if (on !== this.burstOn) {
        this.burstOn = on;
        e.vtaBurst.hidden = !on;
      }
    }
    this._drawSpark(s.history, s.historyHead | 0);
  }

  // A row shows once its value arrives; the tint dot shows while that tint is drawn (≤ 4, §13.6).
  _updateModulators(s) {
    const m = s.modulators;
    if (!m) return;
    const tints = Array.isArray(s.tints) ? new Set(s.tints) : DEFAULT_TINTS;
    const tk = [...tints].join(',');
    const tintsChanged = tk !== this.tintsKey;
    this.tintsKey = tk;
    for (const row of this.modRows) {
      const has = m[row.key] !== undefined;
      if (row.li.hidden === has) row.li.hidden = !has;
      if (tintsChanged && row.dot) row.dot.hidden = !tints.has(row.key);
      if (!has) continue;
      const v = nonNeg(m[row.key]);
      show(row.r, v === null ? null : Math.round(v * 100), fmt2);
      setMeter(row.bar, v === null ? 0 : v / row.full);
    }
    const g = nonNeg(m.gain);
    show(this.r.gain, g === null ? null : Math.round(g * 100), fmtGain);
  }

  // The Vitals heading carries an "Intervention" chip while a preset is active (§13.10).
  _updateVitalsChip(s) {
    const id = s.intervention !== undefined
      ? (s.intervention && typeof s.intervention === 'object' ? s.intervention.id : s.intervention)
      : this.body.intervention;
    const on = !!id && id !== 'none';
    if (this.el.vitalsChip.hidden === on) this.el.vitalsChip.hidden = !on;
  }

  // One vitals row: hidden while the payload does not carry the value (undefined), "—" for null,
  // and a network-off tag (B.10) in front of the value.
  _vital(id, present, key, fmt, tag) {
    const v = this.vit[id];
    if (v.row.hidden === present) v.row.hidden = !present;
    if (!present) return;
    show(v.r, key, fmt);
    const t = tag || '';
    if (t !== v.tagText) {
      v.tagText = t;
      v.tag.hidden = !t;
      v.tag.textContent = t;
      v.tag.title = TAG_TITLES[t] ?? '';
    }
  }

  _updateVitals(s) {
    const v = s.vitals;
    const tags = { ...vitalTags(this.body.bodyMode, this.body.nets), ...(s.vitalTags || {}) };
    if (v) {
      const has = (...keys) => keys.some((k) => v[k] !== undefined);
      const hr = nonNeg(v.hr), rr = nonNeg(v.rr);
      const sys = nonNeg(v.sbp ?? v.sys), dia = nonNeg(v.dbp ?? v.dia), map = nonNeg(v.map);
      this._vital('hr', has('hr'), hr === null ? null : Math.round(hr), fmtBpm, tags.hr);
      this._vital('bp', has('sbp', 'sys'), sys === null || dia === null ? null : Math.round(sys) * 1000 + Math.min(999, Math.round(dia)), fmtBp, tags.bp);
      const mapTitle = map === null ? '' : `Mean arterial pressure ${Math.round(map)} mmHg`;
      if (this.el.bpRow.title !== mapTitle) this.el.bpRow.title = mapTitle;
      this._vital('rr', has('rr'), rr === null ? null : Math.round(rr), fmtRr, tags.rr);
      const pl = nonNeg(v.pupilL ?? v['pupilD.L']), pr = nonNeg(v.pupilR ?? v['pupilD.R']);
      this._vital('pupil', has('pupilL', 'pupilD.L'), pl === null || pr === null ? null : Math.min(999, tenth(pl)) * 1000 + Math.min(999, tenth(pr)), fmtPupil, tags.pupil);
      const scl = nonNeg(v.scl);
      this._vital('scl', has('scl'), scl === null ? null : tenth(scl), fmtTenth('µS'), tags.scl);
      // Core temperature shows the set point when the two differ by more than 0.1 °C (B.10).
      const tc = num(v.tCore), ts = num(v.tSet);
      const coreKey = tc === null ? null : Math.max(0, tenth(tc)) * 10000 + (ts !== null && Math.abs(ts - tc) > 0.1 ? Math.min(9998, Math.max(0, tenth(ts))) : 9999);
      this._vital('tcore', has('tCore'), coreKey, fmtCoreT, tags.tcore);
      const tsk = num(v.tSkin);
      this._vital('tskin', has('tSkin'), tsk === null ? null : Math.max(0, tenth(tsk)), fmtTenth('°C'), tags.tskin);
      const mot = nonNeg(v.motility);
      this._vital('motility', has('motility'), mot === null ? null : Math.round(mot), fmtPct, tags.motility);
      const cort = nonNeg(v.cortisol);
      this._vital('cortisol', has('cortisol'), cort === null ? null : tenth(cort), fmtTenth('µg/dL'), tags.cortisol);
      const adr = nonNeg(v.adrenaline);
      this._vital('adrenaline', has('adrenaline'), adr === null ? null : Math.round(adr), fmtWhole('pg/mL'), tags.adrenaline);
      const il6 = nonNeg(v.il6);
      this._vital('il6', has('il6'), il6 === null ? null : Math.round(il6), fmtWhole('pg/mL'), tags.il6);
      this._updateSickness(v, has('sickness'), tags.sickness);
    }
    const p = s.pulses;
    const showPulses = this.orgasm && p !== undefined;
    if (this.el.pulsesRow.hidden === showPulses) this.el.pulsesRow.hidden = !showPulses;
    if (showPulses) {
      const total = p ? nonNeg(p.total) : null;
      const done = p ? nonNeg(p.done) : null;
      show(this.r.pulses, total && done !== null ? Math.round(done) * 10000 + Math.min(9999, Math.round(total)) : null, fmtPulses);
    }
    this._updateVitalsTrace(s);
  }

  // Sickness behaviour (§10.7): the strongest component and its level.
  _updateSickness(v, present, tag) {
    const x = v.sickness;
    let key = null, name = '';
    if (typeof x === 'number' && Number.isFinite(x)) key = Math.round(clamp01(x) * 100);
    else if (x && typeof x === 'object') {
      let best = -1;
      for (const [c, val] of Object.entries(x)) if (Number.isFinite(val) && val > best) { best = val; name = c; }
      if (best >= 0) key = Math.round(clamp01(best) * 100);
    }
    this._vital('sickness', present, key === null ? null : `${name}|${key}`, (k) => {
      const [n, pct] = k.split('|');
      return n ? `${n} ${pct}%` : `${pct}%`;
    }, tag);
  }

  // 60-s screen-time trace of the selected vital, labelled with the human time it covers (§13.13).
  _updateVitalsTrace(s) {
    const e = this.el, hist = s.vitalsHistory;
    const has = !!hist && typeof hist === 'object';
    if (e.vitalsTrace.hidden === has) e.vitalsTrace.hidden = !has;
    if (!has) return;
    for (const opt of e.vitalsVar.options) opt.disabled = !hist[opt.value];
    const span = num(s.vitalsSpanH);
    setText(e.vitalsSpan, span === null ? DASH : `last ${formatClockTime(span)}`);
    this._drawVitalsSpark(hist[e.vitalsVar.value], s.vitalsHistoryHead | 0);
  }

  _drawVitalsSpark(hist, head) {
    const c = this.el.vitalsSpark, g = this.vitalsCtx;
    const w = c.clientWidth, h = c.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!hist || hist.length < 2) return;
    const n = hist.length;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = hist[i];
      if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    if (!(hi >= lo)) return;
    const pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.02, 1e-6);
    lo -= pad; hi += pad;
    g.font = '9px system-ui, sans-serif';
    g.fillStyle = 'rgba(152,162,182,0.75)';
    g.textBaseline = 'top';
    g.fillText(String(Number(hi.toPrecision(3))), 2, 1);
    g.textBaseline = 'bottom';
    g.fillText(String(Number(lo.toPrecision(3))), 2, h - 1);
    g.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = hist[(head + i) % n];
      if (!Number.isFinite(v)) { started = false; continue; }
      const x = (i / (n - 1)) * w, y = h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
      if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(195,202,216,0.85)';
    g.lineWidth = 1.4;
    g.setLineDash(SOLID);
    g.stroke();
  }

  // Live: stage text, last stimulus path and the event log (newest first, B.9; announced politely
  // at most once per 2 s, §13.13).
  _updateLive(s) {
    const e = this.el;
    setText(e.phaseDesc, s.phaseDesc ?? '');
    const path = s.lastPath ?? null;
    if (e.livePathRow.hidden === !!path) e.livePathRow.hidden = !path;
    if (path) setText(e.livePath, String(path));
    const ev = Array.isArray(s.events) ? s.events.slice(0, EVENT_LOG_LENGTH) : null;
    const has = !!ev && ev.length > 0;
    if (e.eventLog.hidden === has) e.eventLog.hidden = !has;
    if (e.liveNote.hidden === has) e.liveNote.hidden = !has;
    if (!has) return;
    const lines = ev.map(formatEvent);
    const key = `${ev[0].id ?? ''}|${lines.join('\n')}`;
    if (key === this.eventKey) return;
    this.eventKey = key;
    e.eventLog.replaceChildren(...lines.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }));
    const first = lines[0];
    const now = performance.now();
    if (first !== this.eventFirst && now - this.announcedAt >= ANNOUNCE_MS) {
      this.eventFirst = first;
      this.announcedAt = now;
      setText(e.eventAnnounce, first);
    }
  }

  _updatePerf(s, open) {
    const e = this.el;
    const fps = nonNeg(s.fps);
    const fk = fps ? Math.round(fps) : -1;
    show(this.r.fpsBadge, fk, fmtFpsBadge);
    if (!open) return;
    show(this.r.fps, fk < 0 ? null : fk, String);
    setText(e.tier, s.tierLabel ?? DASH);
    const pts = nonNeg(s.points);
    show(this.r.points, pts === null ? null : Math.round(pts), fmtInt);
    // Rows added by the whole-body build (B.10) show once main.js sends their values.
    const opt = (key, value, fmt) => {
      const present = value !== undefined;
      const row = this.perfRows[key];
      if (row.hidden === present) row.hidden = !present;
      if (present) { const x = nonNeg(value); show(this.r[key], x === null ? null : fmt === fmtMs ? Math.round(x * 10) : Math.round(x), fmt); }
    };
    opt('bodyPoints', s.bodyPoints, fmtInt);
    opt('extraPoints', s.extraPoints, fmtInt);
    opt('packets', s.packets, fmtInt);
    opt('kernelMs', s.kernelMs, fmtMs);
    const limited = s.clockLimited;
    const hasLimited = limited !== undefined;
    if (this.perfRows.clockLimited.hidden === hasLimited) this.perfRows.clockLimited.hidden = !hasLimited;
    if (hasLimited) setText($('clock-limited'), limited ? 'yes' : 'no');
    const w = nonNeg(s.width), h = nonNeg(s.height);
    show(this.r.res, w && h ? Math.round(w) * 100000 + Math.min(99999, Math.round(h)) : null, fmtRes);
    setText(e.gpu, s.gpu ?? DASH);
    if (s.gpuRaw != null && e.gpu.title !== s.gpuRaw) e.gpu.title = s.gpuRaw;
    const ms = nonNeg(s.gpuMs);
    const hasMs = ms !== null;
    if (e.gpuMsRow.hidden === hasMs) e.gpuMsRow.hidden = !hasMs;
    if (hasMs) show(this.r.gpuMs, Math.round(ms * 10), fmtMs);
  }

  // Sparkline of NAcc core dopamine: fixed 0–80 nM axis, faint grid every 20 nM and a dashed line
  // at the 15 nM tonic level. The ring buffer's oldest sample sits at head.
  _drawSpark(hist, head) {
    const c = this.el.spark, g = this.sparkCtx;
    if (!this.drops.dopamine.open || !hist || hist.length < 2) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const span = h - 4;
    const base = h - 2;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.setLineDash(SOLID);
    g.beginPath();
    for (let nm = 20; nm < SPARK_MAX; nm += 20) {
      const y = Math.round(base - (nm / SPARK_MAX) * span) + 0.5;
      g.moveTo(0, y); g.lineTo(w, y);
    }
    g.stroke();
    const yTonic = Math.round(base - (SPARK_TONIC / SPARK_MAX) * span) + 0.5;
    g.strokeStyle = 'rgba(232,236,244,0.22)';
    g.setLineDash(DASHED);
    g.beginPath(); g.moveTo(0, yTonic); g.lineTo(w, yTonic); g.stroke();
    g.setLineDash(SOLID);

    g.font = '9px system-ui, sans-serif';
    g.fillStyle = 'rgba(152,162,182,0.75)';
    g.textBaseline = 'top';
    g.fillText('80 nM', 2, 1);
    g.textBaseline = 'bottom';
    g.fillText('15', 2, yTonic - 1);

    // Warm gradient, bronze at rest to pale gold at the top; rebuilt only when the height changes.
    if (!this.sparkGrad || this.sparkGradH !== h) {
      const grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#9c7a3c');
      grad.addColorStop(0.55, '#f2c14e');
      grad.addColorStop(1, '#ffe2a0');
      this.sparkGrad = grad;
      this.sparkGradH = h;
    }
    const n = hist.length;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const v = hist[(head + i) % n];
      const t = v > 0 ? (v < SPARK_MAX ? v / SPARK_MAX : 1) : 0;
      const x = (i / (n - 1)) * w, y = base - t * span;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = this.sparkGrad;
    g.lineWidth = 1.6;
    g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    g.globalAlpha = 0.14;
    g.fillStyle = this.sparkGrad;
    g.fill();
    g.globalAlpha = 1;
  }
}
