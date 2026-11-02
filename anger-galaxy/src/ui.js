// HUD: phase, anger meter, physiological readouts, performance and controls.

import { MODEL } from './galaxy-model.js';

const $ = (id) => document.getElementById(id);

const STORE_PREFIX = 'galaxy.drop.';

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
function readOpen(key) {
  try { return localStorage.getItem(STORE_PREFIX + key) === '1'; } catch { return false; }
}
function writeOpen(key, open) {
  try { localStorage.setItem(STORE_PREFIX + key, open ? '1' : '0'); } catch { /* ignore */ }
}

// Camera shake follows the stored choice; without one it is off for people who asked
// the OS for reduced motion and on for everyone else.
const SHAKE_KEY = 'galaxy.shake';
function readShake() {
  try {
    const v = localStorage.getItem(SHAKE_KEY);
    if (v !== null) return v === '1';
  } catch { /* fall through to the default */ }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function writeShake(on) {
  try { localStorage.setItem(SHAKE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export class Hud {
  constructor(handlers) {
    this.el = {
      hud: $('hud'), phaseName: $('phase-name'), phaseDesc: $('phase-desc'),
      angerVal: $('anger-val'), angerBar: $('anger-bar'), spark: $('spark'),
      bpm: $('bpm'), speed: $('speed'), sf: $('sf'), pitch: $('pitch'), timescale: $('timescale'),
      fps: $('fps'), fpsBadge: $('fps-badge'), tier: $('tier'), stars: $('stars'), res: $('res'), gpu: $('gpu'),
      modeAuto: $('mode-auto'), modeManual: $('mode-manual'), slider: $('anger-slider'), shake: $('shake-toggle'),
      provoke: $('provoke'), pause: $('pause'), quality: $('quality'),
      info: $('info'), infoBtn: $('info-btn'), infoClose: $('info-close'),
      dropLive: $('drop-live'), dropPerf: $('drop-perf'), dropSettings: $('drop-settings'),
    };
    this.sparkCtx = this.el.spark.getContext('2d');
    this.lastPhase = null;
    this.lastHistory = null;
    this.lastHead = 0;
    this._bindDropdowns();
    this._bind(handlers);
  }

  // Every dropdown starts closed unless its stored state says otherwise.
  _bindDropdowns() {
    const e = this.el;
    for (const d of [e.dropLive, e.dropPerf, e.dropSettings]) {
      const key = d.dataset.store;
      d.open = readOpen(key);
      d.addEventListener('toggle', () => {
        writeOpen(key, d.open);
        if (d === e.dropLive && d.open && this.lastHistory) this._drawSpark(this.lastHistory, this.lastHead);
      });
    }

    // On small screens Performance and Settings are both popovers that can overlap,
    // so opening one closes the other. Toggle handlers also run for a restored open
    // state, so a reload never brings back two overlapping dropdowns.
    const narrow = window.matchMedia('(max-width: 760px)');
    const popovers = [e.dropPerf, e.dropSettings];
    for (const d of popovers) {
      d.addEventListener('toggle', () => {
        if (!d.open || !narrow.matches) return;
        for (const other of popovers) if (other !== d) other.open = false;
      });
    }

    // On the narrowest screens the Performance popover drops down over the "Live data"
    // column. When their bodies would overlap, the one just opened stays open and the other
    // closes; if a resize makes them overlap, the Performance popover gives way.
    const liveBody = e.dropLive.querySelector('.drop-body');
    const perfBody = e.dropPerf.querySelector('.drop-body');
    const liveUnderPerf = () => {
      if (!narrow.matches || !e.dropLive.open || !e.dropPerf.open) return false;
      const a = liveBody.getBoundingClientRect(), b = perfBody.getBoundingClientRect();
      return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    };
    for (const [d, other] of [[e.dropLive, e.dropPerf], [e.dropPerf, e.dropLive]]) {
      d.addEventListener('toggle', () => { if (liveUnderPerf()) other.open = false; });
    }
    window.addEventListener('resize', () => { if (liveUnderPerf()) e.dropPerf.open = false; });

    // A pointer press anywhere outside the Settings popover closes it (but not while the
    // About dialog is open over it, so focus can return to the About button afterwards).
    document.addEventListener('pointerdown', (ev) => {
      if (!e.info.hidden) return;
      if (e.dropSettings.open && !e.dropSettings.contains(ev.target)) e.dropSettings.open = false;
    });

    // The mobile Performance popover opens below the status panel; CSS reads its height from --status-h.
    const status = e.hud.querySelector('.status');
    if (status && 'ResizeObserver' in window) {
      new ResizeObserver(() => {
        e.hud.style.setProperty('--status-h', `${status.offsetHeight}px`);
      }).observe(status);
    }
  }

  _bind(h) {
    const e = this.el;
    const setMode = (mode) => {
      e.modeAuto.classList.toggle('active', mode === 'auto');
      e.modeManual.classList.toggle('active', mode === 'manual');
      e.modeAuto.setAttribute('aria-pressed', mode === 'auto');
      e.modeManual.setAttribute('aria-pressed', mode === 'manual');
      e.slider.disabled = mode !== 'manual';
      h.onMode(mode);
    };
    e.modeAuto.addEventListener('click', () => setMode('auto'));
    e.modeManual.addEventListener('click', () => setMode('manual'));
    e.slider.addEventListener('input', () => h.onSlider(e.slider.value / 100));
    e.provoke.addEventListener('click', () => h.onProvoke());
    e.pause.addEventListener('click', () => h.onPause());
    e.quality.addEventListener('change', () => h.onQuality(e.quality.value));

    const setShake = (on) => {
      e.shake.checked = on;
      writeShake(on);
      h.onShake?.(on);
    };
    e.shake.checked = readShake();
    h.onShake?.(e.shake.checked);
    e.shake.addEventListener('change', () => setShake(e.shake.checked));

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

    window.addEventListener('keydown', (ev) => {
      const t = ev.target;
      // Leave browser shortcuts (Ctrl+F, Alt+F, ...) alone.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      // Escape is not typing, so it works even while the slider or the quality select has focus.
      if (ev.key === 'Escape') {
        if (!e.info.hidden) toggleInfo(false);
        else if (e.dropSettings.open) closeSettings();
        return;
      }
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement ||
          t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
      const k = ev.key.toLowerCase();
      if (k === ' ') {
        // Space on a focused button or summary keeps its native activation.
        if (t instanceof HTMLButtonElement || t?.localName === 'summary') return;
        ev.preventDefault();
        h.onPause();
      }
      else if (k === 'g') h.onProvoke();
      else if (k === 's') setShake(!e.shake.checked);
      else if (k === 'h') {
        e.hud.classList.toggle('hidden');
        syncInert();
      }
      else if (k === 'i') toggleInfo(e.info.hidden);
      else if (k === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    });
  }

  setPaused(paused) {
    this.el.pause.textContent = paused ? 'Resume' : 'Pause';
    this.el.pause.setAttribute('aria-pressed', paused);
  }

  setSlider(v) {
    this.el.slider.value = Math.round(v * 100);
  }

  update(s) {
    const e = this.el, p = s.params;
    if (s.phaseName !== this.lastPhase) {
      this.lastPhase = s.phaseName;
      e.phaseName.textContent = s.phaseName;
      e.phaseDesc.textContent = s.phaseDesc;
      e.phaseName.classList.remove('flash');
      void e.phaseName.offsetWidth;
      e.phaseName.classList.add('flash');
    }
    const pct = Math.round(p.anger * 100);
    e.angerVal.textContent = `${pct}%`;
    e.angerBar.style.transform = `scaleX(${Math.max(0.01, p.anger)})`;
    e.hud.style.setProperty('--anger', p.anger.toFixed(3));
    e.bpm.textContent = `${Math.round(p.bpm)} bpm`;
    e.speed.textContent = `×${p.speed.toFixed(1)}`;
    e.sf.textContent = `×${(p.sf / 0.35).toFixed(1)}`;
    e.pitch.textContent = `${p.pitchDeg.toFixed(0)}°`;
    const myr = MODEL.BASE_SPEED * p.speed * MODEL.MYR_PER_UNIT;
    e.timescale.textContent = `1 s ≈ ${myr.toFixed(1)} Myr`;

    e.fps.textContent = s.fps ? `${Math.round(s.fps)}${s.gpuMs != null ? ` · GPU ${s.gpuMs.toFixed(1)} ms` : ''}` : '–';
    e.fpsBadge.textContent = `${s.fps ? Math.round(s.fps) : '–'} FPS`;
    e.tier.textContent = s.tierLabel;
    e.stars.textContent = s.stars.toLocaleString('en-US');
    e.res.textContent = `${s.width}×${s.height}`;
    e.gpu.textContent = s.gpu;
    e.gpu.title = s.gpuRaw;

    this.lastHistory = s.history;
    this.lastHead = s.historyHead;
    this._drawSpark(s.history, s.historyHead);
  }

  _drawSpark(hist, head) {
    const c = this.el.spark, g = this.sparkCtx;
    // Nothing to draw while the "Live data" dropdown is closed or the canvas has no size.
    if (!this.el.dropLive.open) return;
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
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#f2c14e');
    grad.addColorStop(0.6, '#ff6a3d');
    grad.addColorStop(1, '#ff2d55');
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const v = hist[(head + i) % n];
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
