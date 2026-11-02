// HUD: phase, arousal meter, clocks, vitals, neurochemistry, performance and controls.
// main.js drives it through the Hud class below; the HUD never calls a handler on its own,
// only in response to a user action.

const $ = (id) => document.getElementById(id);
const clamp01 = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);

// Only write when the text changes: fewer DOM mutations and no repeated live-region chatter.
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

const STORE_PREFIX = 'orgasm-galaxy.drop.';

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
  const num = (x) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${num(s / 60)} min`;
  return `${num(s / 3600)} h`;
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
    t?.localName === 'summary' || t?.isContentEditable === true;
}

const NEURO = [
  ['D', 'nc-d'], ['O', 'nc-o'], ['R', 'nc-r'], ['N', 'nc-n'],
  ['Psi', 'nc-psi'], ['V', 'nc-v'], ['I', 'nc-i'],
];

export class Hud {
  constructor(handlers) {
    this.h = handlers || {};
    this.el = {
      hud: $('hud'), status: $('status'), controls: $('hud').querySelector('.controls'),
      phaseName: $('phase-name'), phaseDesc: $('phase-desc'),
      arousalVal: $('arousal-val'), arousalBar: $('arousal-bar'),
      clock: $('clock'), refractory: $('refractory'), spark: $('spark'),
      hr: $('hr'), rr: $('rr'), bp: $('bp'), pulses: $('pulses'),
      fps: $('fps'), fpsBadge: $('fps-badge'), tier: $('tier'), stars: $('stars'), res: $('res'), gpu: $('gpu'),
      stimulate: $('stimulate'), distract: $('distract'), pause: $('pause'),
      modeDemo: $('mode-demo'), modeManual: $('mode-manual'),
      level: $('stim-level'), levelVal: $('stim-val'),
      profile: $('profile'), tref: $('tref'), trefVal: $('tref-val'), envelope: $('envelope'),
      quality: $('quality'), reset: $('reset'),
      info: $('info'), infoBtn: $('info-btn'), infoClose: $('info-close'),
      dropVitals: $('drop-vitals'), dropNeuro: $('drop-neuro'),
      dropPerf: $('drop-perf'), dropSettings: $('drop-settings'),
    };
    this.nc = NEURO.map(([key, id]) => {
      const val = $(id);
      return { key, val, fill: val.parentElement.querySelector('.nc-fill') };
    });
    this.sparkCtx = this.el.spark.getContext('2d');
    this.mode = 'demo';
    this.lastTref = null;
    this.levelDragging = false;
    // Stimulation is held by a pointer on the button and/or a key; the handler sees one combined state.
    this.stim = { pointer: false, key: null, held: false };
    this.lastPhase = null;
    this.lastHistory = null;
    this.lastHead = 0;
    this._bindDropdowns();
    this._bind();
  }

  // ---- Dropdowns ------------------------------------------------------------------------

  // Every dropdown starts closed unless its stored state says otherwise.
  _bindDropdowns() {
    const e = this.el;
    for (const d of [e.dropVitals, e.dropNeuro, e.dropPerf, e.dropSettings]) {
      const key = d.dataset.store;
      d.open = readOpen(key);
      d.addEventListener('toggle', () => {
        writeOpen(key, d.open);
        if (d === e.dropVitals && d.open && this.lastHistory) this._drawSpark(this.lastHistory, this.lastHead);
      });
    }

    const bodyOf = (d) => d.querySelector('.drop-body');
    const overlap = (a, b) => {
      if (!a.open || !b.open) return false;
      const r = bodyOf(a).getBoundingClientRect(), s = bodyOf(b).getBoundingClientRect();
      return r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom;
    };

    // Performance and Settings are both popovers. On small screens opening one always closes
    // the other; on any screen, when their bodies would overlap (short windows), the one just
    // opened stays open. Toggle handlers also run for a restored open state, so a reload never
    // brings back two overlapping popovers.
    const narrow = window.matchMedia('(max-width: 760px)');
    const popovers = [e.dropPerf, e.dropSettings];
    for (const d of popovers) {
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        for (const other of popovers) {
          if (other !== d && other.open && (narrow.matches || overlap(d, other))) other.open = false;
        }
      });
    }

    // On the narrowest screens the Performance popover drops down over the left column.
    // When its body would overlap an open Vitals or Neurochemistry body, the one just opened
    // stays open and the other closes; if a resize makes them overlap, Performance gives way.
    const sideDrops = [e.dropVitals, e.dropNeuro];
    for (const d of sideDrops) {
      d.addEventListener('toggle', () => { if (overlap(d, e.dropPerf)) e.dropPerf.open = false; });
    }
    e.dropPerf.addEventListener('toggle', () => {
      for (const d of sideDrops) if (overlap(e.dropPerf, d)) d.open = false;
    });
    window.addEventListener('resize', () => {
      if (e.dropPerf.open && e.dropSettings.open && (narrow.matches || overlap(e.dropPerf, e.dropSettings))) {
        e.dropSettings.open = false;
      }
      if (sideDrops.some((d) => overlap(d, e.dropPerf))) e.dropPerf.open = false;
    });

    // A pointer press anywhere outside the Settings popover closes it (but not while the
    // About dialog is open over it, so focus can return to the About button afterwards).
    document.addEventListener('pointerdown', (ev) => {
      if (!e.info.hidden) return;
      if (e.dropSettings.open && !e.dropSettings.contains(ev.target)) e.dropSettings.open = false;
    });

    // CSS positions the popovers from the live heights of the status panel (--status-h: the
    // mobile Performance popover starts below it) and of the controls bar (--controls-h: the
    // Settings popover and the mobile Performance popover stop above it).
    if ('ResizeObserver' in window) {
      const track = (el, prop) => {
        if (!el) return;
        new ResizeObserver(() => e.hud.style.setProperty(prop, `${el.offsetHeight}px`)).observe(el);
      };
      track(e.status, '--status-h');
      track(e.controls, '--controls-h');
    }
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
    e.envelope.addEventListener('change', () => h.onEnvelope?.(e.envelope.value));
    e.quality.addEventListener('change', () => h.onQuality?.(e.quality.value));
    e.tref.addEventListener('input', () => {
      const s = roundDuration(trefFromInput(Number(e.tref.value)));
      this._showTref(s);
      if (s === this.lastTref) return;
      this.lastTref = s;
      h.onTref?.(s);
    });
    e.reset.addEventListener('click', () => h.onReset?.());
    e.distract.addEventListener('click', () => h.onDistract?.());
    e.pause.addEventListener('click', () => h.onPause?.());

    // Stimulate is held. Touch input is implicitly captured by the button, so the capture is
    // released at once: sliding a finger off the button ends the hold, just like the mouse.
    const btn = e.stimulate;
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
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
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    // The HUD is inert while it is hidden (H) or while the modal About dialog is open,
    // so keyboard focus cannot reach controls that are invisible or behind the backdrop.
    const syncInert = () => {
      e.hud.inert = e.hud.classList.contains('hidden') || !e.info.hidden;
    };
    const closeSettings = () => {
      const hadFocus = e.dropSettings.contains(document.activeElement);
      e.dropSettings.open = false;
      if (hadFocus) e.dropSettings.querySelector('summary').focus();
    };

    let returnFocus = null;
    const toggleInfo = (show) => {
      if (show === !e.info.hidden) return;
      e.info.hidden = !show;
      syncInert();
      if (show) {
        returnFocus = document.activeElement;
        e.infoClose.focus();
      } else if (returnFocus && returnFocus.isConnected) {
        returnFocus.focus();
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

      // Escape is not typing, so it works even while a slider or a select has focus.
      if (ev.key === 'Escape') {
        if (modal) toggleInfo(false);
        else if (e.dropSettings.open) closeSettings();
        return;
      }

      // The focused Stimulate button is held with Space or Enter, like a pointer.
      if (t === btn && (ev.key === ' ' || ev.key === 'Enter')) {
        ev.preventDefault();
        if (!ev.repeat && !modal && this.stim.key === null) this._setStim('key', ev.key);
        return;
      }

      if (ev.key === ' ') {
        if (spaceIsNative(t)) return;
        ev.preventDefault();
        if (!ev.repeat && !modal && this.stim.key === null) this._setStim('key', ' ');
        return;
      }

      if (ev.repeat || isTyping(t)) return;
      const k = ev.key.toLowerCase();
      if (k === 'd') { if (!modal) h.onDistract?.(); }
      else if (k === 'p') h.onPause?.();
      else if (k === 'h') {
        if (modal) return;
        e.hud.classList.toggle('hidden');
        syncInert();
      }
      else if (k === 'i') toggleInfo(!modal);
      else if (k === 'f') toggleFullscreen();
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
    this.el.stimulate.classList.toggle('active', held);
    this.el.stimulate.setAttribute('aria-pressed', String(held));
    this.h.onStimulate?.(held);
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

  // ---- API used by main.js ---------------------------------------------------------------

  // Shows the current settings without calling any handler. tref is in seconds.
  syncSettings({ mode, level, profile, tref, envelope } = {}) {
    const e = this.el;
    if (mode != null) this._showMode(mode);
    if (level != null) this._showLevel(level);
    if (profile != null) e.profile.value = String(profile);
    if (envelope != null) e.envelope.value = String(envelope);
    if (tref != null && Number.isFinite(Number(tref))) {
      const s = Number(tref);
      e.tref.value = String(inputFromTref(s));
      this._showTref(s);
      this.lastTref = roundDuration(s);
    }
  }

  setPaused(paused) {
    this.el.pause.textContent = paused ? 'Resume' : 'Pause';
    this.el.pause.setAttribute('aria-pressed', String(!!paused));
  }

  // Moves the stimulation slider to the scripted level (Demo mode).
  setLevel(v) {
    if (this.levelDragging && this.mode === 'manual') return;
    this._showLevel(v);
  }

  // During the orgasm phase the HUD fades to 25 % opacity (CSS) and back; controls stay usable.
  setDimmed(dimmed) {
    this.el.hud.classList.toggle('dimmed', !!dimmed);
  }

  update(s) {
    const e = this.el;

    if (s.phaseName !== this.lastPhase) {
      this.lastPhase = s.phaseName;
      e.phaseName.textContent = s.phaseName ?? '';
      // Restart the transform-only flash.
      e.phaseName.classList.remove('flash');
      void e.phaseName.offsetWidth;
      e.phaseName.classList.add('flash');
    }
    setText(e.phaseDesc, s.phaseDesc ?? '');

    const a = clamp01(Number(s.arousal) || 0);
    setText(e.arousalVal, `${Math.round(a * 100)}%`);
    e.arousalBar.style.transform = `scaleX(${Math.max(0.01, a).toFixed(3)})`;
    e.hud.style.setProperty('--arousal', a.toFixed(3));
    setText(e.clock, s.clock || '–');

    const r = s.refractory;
    const refActive = !!(r && r.active);
    if (e.refractory.hidden === refActive) e.refractory.hidden = !refActive;
    if (refActive) {
      const pct = Math.round(clamp01(Number(r.pct) || 0) * 100);
      setText(e.refractory, r.remaining
        ? `Refractory ${pct}% · about ${r.remaining} left (human time)`
        : `Refractory ${pct}%`);
    }

    const v = s.vitals;
    if (v) {
      setText(e.hr, `${Math.round(v.hr)} bpm`);
      setText(e.rr, `${Math.round(v.rr)} /min`);
      setText(e.bp, `${Math.round(v.sys)}/${Math.round(v.dia)} mmHg`);
    }
    const p = s.pulses;
    setText(e.pulses, p && p.total > 0 ? `${Math.round(p.done)} of ${Math.round(p.total)}` : '–');

    const n = s.neuro;
    if (n) {
      for (const c of this.nc) {
        const x = Number(n[c.key]) || 0;
        setText(c.val, x.toFixed(2));
        c.fill.style.transform = `scaleX(${clamp01(x).toFixed(3)})`;
      }
    }

    setText(e.fps, s.fps ? `${Math.round(s.fps)}${s.gpuMs != null ? ` · GPU ${s.gpuMs.toFixed(1)} ms` : ''}` : '–');
    setText(e.fpsBadge, `${s.fps ? Math.round(s.fps) : '–'} FPS`);
    setText(e.tier, s.tierLabel ?? '–');
    setText(e.stars, s.stars != null ? s.stars.toLocaleString('en-US') : '–');
    setText(e.res, s.width && s.height ? `${s.width}×${s.height}` : '–');
    setText(e.gpu, s.gpu ?? '–');
    if (s.gpuRaw != null && e.gpu.title !== s.gpuRaw) e.gpu.title = s.gpuRaw;

    this.lastHistory = s.history;
    this.lastHead = s.historyHead | 0;
    this._drawSpark(this.lastHistory, this.lastHead);
  }

  _drawSpark(hist, head) {
    const c = this.el.spark, g = this.sparkCtx;
    // Nothing to draw while the Vitals dropdown is closed or the canvas has no size.
    if (!this.el.dropVitals.open || !hist || hist.length < 2) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    for (const y of [0.25, 0.5, 0.75]) {
      g.beginPath(); g.moveTo(0, h * y); g.lineTo(w, h * y); g.stroke();
    }
    const n = hist.length;
    // Neutral warm gradient: bronze at rest, amber, pale gold at the top.
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#9c7a3c');
    grad.addColorStop(0.55, '#f2c14e');
    grad.addColorStop(1, '#ffe2a0');
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const v = clamp01(hist[(head + i) % n]);
      const x = (i / (n - 1)) * w, y = h - 2 - v * (h - 4);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = grad;
    g.lineWidth = 1.6;
    g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    g.globalAlpha = 0.14;
    g.fillStyle = grad;
    g.fill();
    g.globalAlpha = 1;
  }
}
