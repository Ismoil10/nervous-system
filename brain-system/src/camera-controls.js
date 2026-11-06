// Camera input: mouse, trackpad, touch and keyboard navigation in the conventions of Blender, Unreal
// Engine and 3ds Max, mapped onto the orbit camera (camera.js). Pure helpers (dragMode, wheelKind,
// keyAction) are exported for the tests; CameraControls binds them to the canvas and the window.
//
// Mouse:     left or middle drag orbits, the model following the hand (Blender MMB; left for mice
//            without a middle button and for trackpads); right drag, Shift + drag or Shift + middle drag pans; the wheel zooms towards
//            the point under the cursor; Ctrl + middle drag (Blender) or Alt + right drag (3ds Max,
//            Maya) zooms on the pivot.
// Focus:     double-click flies the clicked part to the centre and closer; Alt + click or a middle
//            click makes the clicked point the pivot without moving the eye.
// Trackpad:  two-finger scroll pans, a pinch zooms towards the fingers (Ctrl + wheel events, Safari
//            gesture events).
// Touch:     one finger orbits; two fingers pan and pinch; a double tap focuses.
// Keys:      numpad 1/3/7 front/right/top, Ctrl for the opposite side, or Alt + 1/3/7 on keyboards
//            without a numpad; numpad 4/6/8/2 or the arrows orbit in 15° steps, Shift + arrows pan,
//            numpad 9 the opposite side, + and − zoom; Home frames everything, F (simple HUD) or
//            . / numpad . the focused part; Shift + F flies (W A S D, Q/E down and up, Shift faster,
//            drag to look, Esc to leave); ? shows the controls.
// The keyboard handler runs in the capture phase and claims only its own keys, so the HUD keys
// (P, 1–3, Space, V, H, I, F full screen in the full HUD) keep working; nothing is taken while a field
// has focus or a dialog is open.

import { NAV, dragAngles } from './camera.js';

export const CLICK = { movePx: 6, holdMs: 500, doubleMs: 350, tapPx: 24, streamMs: 300, streamPx: 40, flickMs: 80 };
export const FOCUS = { zoom: 0.45, ringMs: 900, hintMs: 9000, hintShows: 3 };
const WHEEL = { mouse: 0.0011, pinch: 0.01, line: 33, page: 400 };
const HINT = {
  mouse: 'Drag to turn · Right-drag to move · Scroll to zoom · Double-click to focus · ? for all controls',
  touch: 'One finger turns · Two fingers move and zoom · Double-tap to focus',
  fly: 'Fly mode · W A S D move · Q E down and up · Shift faster · Drag to look · Esc to leave',
};
const HINT_KEY = 'brain-system.nav-hint';
const FLY_KEYS = {
  KeyW: [0, 1, 0], KeyS: [0, -1, 0], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], KeyE: [0, 0, 1], KeyQ: [0, 0, -1],
  ArrowUp: [0, 1, 0], ArrowDown: [0, -1, 0], ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0],
};
const NUMPAD_VIEWS = { Numpad1: ['front', 'back'], Numpad3: ['right', 'left'], Numpad7: ['top', 'bottom'] };
const DIGIT_VIEWS = { Digit1: ['front', 'back'], Digit3: ['right', 'left'], Digit7: ['top', 'bottom'] };
const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const NUMPAD_ORBIT = { Numpad4: 'left', Numpad6: 'right', Numpad8: 'up', Numpad2: 'down' };
// Widgets whose own keys include the arrows and + / −.
const CONTROL_ROLES = new Set(['slider', 'spinbutton', 'listbox', 'option', 'menu', 'menuitem', 'radiogroup', 'radio',
  'tablist', 'tab', 'combobox', 'scrollbar', 'tree', 'grid']);

const now = () => performance.now();

export function isTyping(t) {
  return !!t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || ''));
}
export function isControl(t) {
  return isTyping(t) || (!!t && typeof t.getAttribute === 'function' && CONTROL_ROLES.has(t.getAttribute('role')));
}

// What a press drags: 'orbit', 'pan' or 'zoom'.
export function dragMode({ button = 0, shiftKey = false, ctrlKey = false, altKey = false, pointerType = 'mouse' } = {}) {
  if (pointerType === 'touch') return 'orbit';
  if (button === 1) return shiftKey ? 'pan' : ctrlKey ? 'zoom' : 'orbit';
  if (button === 2) return altKey ? 'zoom' : 'pan';
  return shiftKey || ctrlKey ? 'pan' : 'orbit';
}

// Wheel source: 'pinch' (trackpad pinch: Ctrl + wheel, also a Ctrl + mouse wheel), 'trackpad'
// (two-finger scroll: pans) or 'mouse' (notched wheel: zooms). Chrome and Safari report a trackpad
// with wheelDeltaY = −3 · deltaY exactly, a notched wheel in steps of 120; a horizontal component also
// means a trackpad. A stream keeps its kind while events follow within CLICK.streamMs.
export function wheelKind(e, last = null) {
  if (e.ctrlKey) return 'pinch';
  if (e.deltaMode !== 0) return 'mouse';
  const t = e.timeStamp ?? 0;
  if (last && last.kind !== 'pinch' && t - last.t < CLICK.streamMs) return last.kind;
  if (e.deltaX) return 'trackpad';
  const wd = e.wheelDeltaY;
  if (typeof wd === 'number' && wd !== 0 && e.deltaY) return Math.abs(wd + 3 * e.deltaY) < 1e-6 ? 'trackpad' : 'mouse';
  return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50 ? 'mouse' : 'trackpad';
}

// The camera action of a key, or null (the key then goes on to the HUD). `simple`: the simple HUD is
// shown (F frames there; the full HUD keeps F for full screen). `control`: focus is on a widget whose
// own keys are the arrows and + / −.
export function keyAction(e, { simple = true, control = false } = {}) {
  const { code = '', key = '' } = e;
  if (e.metaKey) return null;
  if (NUMPAD_VIEWS[code] && !e.altKey) return `view:${NUMPAD_VIEWS[code][e.ctrlKey ? 1 : 0]}`;
  if (DIGIT_VIEWS[code] && e.altKey) return `view:${DIGIT_VIEWS[code][e.ctrlKey || e.shiftKey ? 1 : 0]}`;
  if (code === 'Digit9' && e.altKey) return 'view:opposite';
  if (e.ctrlKey || e.altKey) return null;
  if (code === 'Numpad9') return 'view:opposite';
  if (NUMPAD_ORBIT[code]) return `orbit:${NUMPAD_ORBIT[code]}`;
  if (code === 'NumpadAdd') return 'zoom:in';
  if (code === 'NumpadSubtract') return 'zoom:out';
  if (code === 'NumpadDecimal') return 'frame:selected';
  if (code === 'Home') return 'frame:all';
  if (!control) {
    if (ARROWS[code]) return `${e.shiftKey ? 'pan' : 'orbit'}:${ARROWS[code]}`;
    if (key === '+' || key === '=') return 'zoom:in';
    if (key === '-' || key === '_') return 'zoom:out';
  }
  if (key === '.') return 'frame:selected';
  if (key === 'f' || key === 'F') return e.shiftKey ? 'fly:toggle' : simple ? 'frame:selected' : null;
  if (key === '?') return 'help';
  return null;
}

export class CameraControls {
  // pickAt(clientX, clientY) → world point (units) under the pixel or null; frameAll() → { center,
  // radius } of everything drawn; framePreset() re-applies the current view (frame selected with no
  // selection); blocked() → true while a modal dialog is open; simpleHud() → the simple HUD is shown.
  constructor(canvas, camera, { pickAt = null, frameAll = null, framePreset = null, blocked = null, simpleHud = null,
    doc = typeof document !== 'undefined' ? document : null, storage = null } = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.pickAt = pickAt;
    this.frameAll = frameAll;
    this.framePreset = framePreset;
    this.blocked = blocked;
    this.simpleHud = simpleHud;
    this.doc = doc;
    this.storage = storage;
    this.pointers = new Map();
    this.pinch = null;
    this.wheel = null;
    this.gesture = null;
    this.lastTap = null;
    this.lastTouch = -1e9;
    this.selection = null;   // { center, distance }: the part last focused, for frame selected
    this.held = new Set();
    this.helpOpen = false;
    this._flyShown = false;
    this._ringTimer = 0;
    this._hintTimer = 0;
    const id = (k) => doc?.getElementById?.(k) ?? null;
    this.el = { help: id('nav-help'), helpBtn: id('nav-help-btn'), hint: id('nav-hint'), ring: id('nav-pivot') };
    camera.onUpdate = () => { if (camera.fly !== this._flyShown) this._syncFly(); };
    this._bind();
    this._showHint();
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', (e) => this._up(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());   // right drag pans
    c.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    c.addEventListener('dblclick', (e) => {
      if (now() - this.lastTouch < 800) return;   // a double tap was already handled
      this.focusAt(e.clientX, e.clientY);
    });
    // Safari reports a trackpad pinch as gesture events instead of Ctrl + wheel.
    c.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      this.gesture = { scale: 1, ratio: this.pointers.size ? null : this._depthRatio(e.clientX, e.clientY) };
    });
    c.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      const g = this.gesture;
      if (!g || this.pointers.size >= 2 || !(e.scale > 0)) return;
      this.camera.zoomAt(g.scale / e.scale, e.clientX, e.clientY, this._pointAt(e.clientX, e.clientY, g.ratio));
      g.scale = e.scale;
      this._touched();
    });
    c.addEventListener('gestureend', (e) => { e.preventDefault(); this.gesture = null; });
    const win = this.doc?.defaultView;
    if (win) {
      win.addEventListener('keydown', (e) => this._key(e), true);
      win.addEventListener('keyup', (e) => this._keyUp(e), true);
      win.addEventListener('blur', () => this._releaseKeys());
    }
    this.el.helpBtn?.addEventListener('click', () => this.toggleHelp());
    this.el.help?.addEventListener('click', (e) => {
      const b = /** @type {any} */ (e.target).closest?.('[data-nav]');
      if (b) this.run(b.dataset.nav);
    });
  }

  // --- Pointer ---

  _down(e) {
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    this._blurHud();
    this._dismissHint();
    if (e.button === 1) e.preventDefault();   // no middle-click autoscroll
    const cam = this.camera;
    cam.goal = null;
    cam.zoomQueue = null;
    cam.velYaw = cam.velPitch = 0;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: now(),
      mode: dragMode(e), type: e.pointerType, button: e.button, alt: e.altKey, moved: false, trail: [] });
    cam.dragging = true;
    if (this.pointers.size === 2) this._pinchStart();
    this._touched();
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > CLICK.movePx) p.moved = true;
    const cam = this.camera;
    if (this.pointers.size === 1) {
      if (p.mode === 'pan') cam.pan(dx, dy);
      else if (p.mode === 'zoom') cam.zoomAbout(Math.exp((dy - dx) * 0.006), cam.target);
      else {
        cam.drag(dx, dy);
        const t = now();
        p.trail.push({ t, dx, dy });
        while (p.trail.length && t - p.trail[0].t > CLICK.flickMs) p.trail.shift();
      }
      if (p.moved && !cam.fly) this._ring();
    } else if (this.pointers.size === 2) this._pinchMove();
    this._touched();
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (p && this.pointers.size === 1 && p.mode === 'orbit') this._coast(p);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.camera.dragging = this.pointers.size > 0;
    if (!p || p.moved || e.type === 'pointercancel' || now() - p.t0 > CLICK.holdMs) return;
    if (p.type === 'touch') {
      this.lastTouch = now();
      if (this.pointers.size) return;
      const l = this.lastTap;
      if (l && now() - l.t < CLICK.doubleMs && Math.hypot(l.x - e.clientX, l.y - e.clientY) < CLICK.tapPx) {
        this.lastTap = null;
        this.focusAt(e.clientX, e.clientY);
      } else this.lastTap = { t: now(), x: e.clientX, y: e.clientY };
      return;
    }
    if (p.button === 1 || (p.button === 0 && p.alt)) this.pivotAt(e.clientX, e.clientY);
  }

  // Release inertia from the drag speed over the last CLICK.flickMs (none if the pointer had stopped).
  _coast(p) {
    const cam = this.camera, t = now();
    const recent = p.trail.filter((s) => t - s.t < CLICK.flickMs);
    if (!recent.length || cam.fly) { cam.setInertia(0, 0); return; }
    const span = Math.max(1000 / 60, t - recent[0].t + 1000 / 60);   // ms, at least one frame
    const per = (1000 / 60) / span;
    let dx = 0, dy = 0;
    for (const s of recent) { dx += s.dx; dy += s.dy; }
    const [yaw, pitch] = dragAngles(dx * per, dy * per);
    cam.setInertia(yaw, pitch);
  }

  _pinchStart() {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid, ratio: this._depthRatio(mid.x, mid.y) };
  }

  _pinchMove() {
    const pc = this.pinch;
    if (!pc) return;
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pc.dist > 0 && d > 0) this.camera.zoomAt(pc.dist / d, m.x, m.y, this._pointAt(m.x, m.y, pc.ratio));
    this.camera.pan(m.x - pc.mid.x, m.y - pc.mid.y);
    pc.dist = d;
    pc.mid = m;
  }

  // --- Wheel ---

  _wheel(e) {
    e.preventDefault();
    const cam = this.camera, t = e.timeStamp ?? now(), w = this.wheel;
    const kind = wheelKind(e, w);
    if (!w || t - w.t > CLICK.streamMs || kind !== w.kind || Math.hypot(e.clientX - w.x, e.clientY - w.y) > CLICK.streamPx) {
      this.wheel = { kind, t, x: e.clientX, y: e.clientY, ratio: kind === 'trackpad' ? null : this._depthRatio(e.clientX, e.clientY) };
    }
    this.wheel.t = t;
    if (kind === 'trackpad' && !cam.fly) cam.pan(-e.deltaX, -e.deltaY);
    else {
      const unit = e.deltaMode === 1 ? WHEEL.line : e.deltaMode === 2 ? WHEEL.page : 1;
      const f = Math.exp(e.deltaY * unit * (kind === 'pinch' ? WHEEL.pinch : WHEEL.mouse));
      const P = this._pointAt(e.clientX, e.clientY, this.wheel.ratio) ?? cam.planePoint(e.clientX, e.clientY);
      if (kind === 'mouse') cam.zoomSmooth(f, P);
      else cam.zoomAbout(f, P);
    }
    this._dismissHint();
    this._touched();
  }

  // Depth of the drawn scene under a pixel as a multiple of the pivot distance (null: nothing there).
  _depthRatio(x, y) {
    const P = this.pickAt?.(x, y);
    if (!P) return null;
    const e = this.camera.eye;
    return Math.hypot(P[0] - e[0], P[1] - e[1], P[2] - e[2]) / this.camera.distance;
  }

  _pointAt(x, y, ratio) {
    if (ratio == null) return null;
    const cam = this.camera, r = cam._rayDir(x, y), s = ratio * cam.distance;
    return cam.eye.map((v, i) => v + r[i] * s);
  }

  // --- Focus and pivot ---

  // Double-click / double tap: fly the part under the pixel to the centre and closer.
  focusAt(x, y) {
    const cam = this.camera;
    const P = this.pickAt?.(x, y) ?? cam.planePoint(x, y);
    cam.focus(P, cam.distance * FOCUS.zoom);
    this.selection = { center: P, distance: cam.goal?.distance ?? cam.distance };
    this._ring();
    this._touched();
  }

  // Alt + click / middle click: orbit round the point under the pixel from where the eye is.
  pivotAt(x, y) {
    const P = this.pickAt?.(x, y);
    if (!P) return;
    this.camera.pivotAt(P);
    this.selection = { center: P, distance: this.camera.goal?.distance ?? this.camera.distance };
    this._ring();
    this._touched();
  }

  // --- Keyboard ---

  _key(e) {
    const cam = this.camera, t = e.target;
    if (isTyping(t) || this.blocked?.()) return;
    if (e.key === 'Escape') {
      if (this.helpOpen) { this.toggleHelp(false); stop(e); }
      else if (cam.fly) { this.setFly(false); stop(e); }
      return;
    }
    if (e.key === 'Shift') cam.flyFast = true;
    if (cam.fly && !e.ctrlKey && !e.metaKey && !e.altKey && FLY_KEYS[e.code]) {
      this.held.add(e.code);
      cam.flyFast = e.shiftKey;
      this._flyInput();
      stop(e);
      return;
    }
    const a = keyAction(e, { simple: this.simpleHud ? this.simpleHud() : true, control: isControl(t) });
    if (!a) return;
    stop(e);
    if (e.repeat && !/^(orbit|pan|zoom)/.test(a)) return;
    this.run(a);
  }

  _keyUp(e) {
    if (e.key === 'Shift') this.camera.flyFast = false;
    if (this.held.delete(e.code)) { this._flyInput(); stop(e); }
  }

  _releaseKeys() {
    this.held.clear();
    this.camera.flyFast = false;
    this._flyInput();
  }

  _flyInput() {
    const m = [0, 0, 0];
    for (const k of this.held) { const v = FLY_KEYS[k]; for (let i = 0; i < 3; i++) m[i] += v[i]; }
    this.camera.flyInput = m.map((v) => Math.max(-1, Math.min(1, v)));
  }

  // Run a named action ('view:front', 'orbit:left', 'pan:up', 'zoom:in', 'frame:all',
  // 'frame:selected', 'fly:toggle', 'help'); also the buttons of the help panel (data-nav).
  run(action) {
    const cam = this.camera, [kind, arg] = String(action).split(':');
    const s = NAV.stepAngle, h = this.canvas.clientHeight || 600, p = 0.08 * h;
    if (kind === 'view') { cam.setView(arg); this._ring(); }
    else if (kind === 'orbit') {
      // Like a short drag in that direction: Left turns the model left, Up tilts its front up.
      const m = { left: [-s, 0], right: [s, 0], up: [0, -s], down: [0, s] }[arg];
      if (m) cam.orbitBy(m[0], m[1]);
    } else if (kind === 'pan') {
      const m = { left: [p, 0], right: [-p, 0], up: [0, p], down: [0, -p] }[arg];
      if (m) cam.pan(m[0], m[1]);
    } else if (kind === 'zoom') cam.zoomSmooth(arg === 'in' ? 0.8 : 1.25, cam.target);
    else if (kind === 'frame') {
      if (arg === 'all') { const b = this.frameAll?.(); if (b) cam.frame(b.center, b.radius); }
      else if (this.selection) cam.focus(this.selection.center, this.selection.distance);
      else this.framePreset?.();
      this._ring();
    } else if (kind === 'fly') this.setFly(!cam.fly);
    else if (kind === 'help') this.toggleHelp();
    else return;
    this._dismissHint();
    this._touched();
  }

  setFly(on) {
    this.camera.setFly(on);
    this.held.clear();
    this._flyInput();
    this._syncFly();
  }

  // --- On-screen help, hint and pivot ring ---

  toggleHelp(open = !this.helpOpen) {
    this.helpOpen = !!open;
    if (this.el.help) this.el.help.hidden = !this.helpOpen;
    this.el.helpBtn?.setAttribute('aria-expanded', String(this.helpOpen));
    if (this.helpOpen) this._dismissHint();
  }

  _showHint() {
    const el = this.el.hint;
    if (!el) return;
    let shown = 0;
    try { shown = Number(this.storage?.getItem(HINT_KEY)) || 0; } catch { shown = 0; }
    if (shown >= FOCUS.hintShows) return;
    try { this.storage?.setItem(HINT_KEY, String(shown + 1)); } catch { /* private window */ }
    const coarse = this.doc?.defaultView?.matchMedia?.('(pointer: coarse)')?.matches;
    el.textContent = coarse ? HINT.touch : HINT.mouse;
    el.classList.remove('is-fly');
    el.hidden = false;
    this._hintTimer = setTimeout(() => this._dismissHint(), FOCUS.hintMs);
  }

  _dismissHint() {
    const el = this.el.hint;
    if (!el || this.camera.fly || el.hidden) return;
    clearTimeout(this._hintTimer);
    el.hidden = true;
  }

  _syncFly() {
    const on = this.camera.fly, el = this.el.hint;
    this._flyShown = on;
    if (!on) this.held.clear();
    if (!el) return;
    if (on) { el.textContent = HINT.fly; el.classList.add('is-fly'); el.hidden = false; clearTimeout(this._hintTimer); }
    else if (el.classList.contains('is-fly')) { el.classList.remove('is-fly'); el.hidden = true; }
  }

  // The pivot is the screen centre; a ring marks it while orbiting and after a focus.
  _ring() {
    const el = this.el.ring;
    if (!el) return;
    el.classList.add('show');
    clearTimeout(this._ringTimer);
    this._ringTimer = setTimeout(() => el.classList.remove('show'), FOCUS.ringMs);
  }

  _touched() { this.camera.lastInteraction = now(); }

  // A click on the scene hands the keyboard back to it: a HUD button that kept focus would otherwise
  // take the arrow keys and Space.
  _blurHud() {
    const a = /** @type {any} */ (this.doc?.activeElement);
    if (a && a !== this.doc.body && a !== this.canvas && typeof a.blur === 'function') a.blur();
  }
}

function stop(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
}
