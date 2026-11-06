// Camera navigation maths (camera.js), the depth pick (view-pick.js) and the input mapping
// (camera-controls.js): orbit and pan, zoom towards the cursor and through the near limit, the
// pivot, focus and framing, the pole limit, the axis views, fly mode, keys, wheel kinds and drags.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCamera, PITCH_LIMIT, NAV, orbitDir } from '../src/camera.js';
import { pickStars } from '../src/view-pick.js';
import { keyAction, wheelKind, dragMode, isControl } from '../src/camera-controls.js';

const W = 800, H = 600, ASPECT = W / H;
const canvas = { clientHeight: H, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }) };
const cam = (o = {}) => {
  const c = new OrbitCamera(canvas, { distance: 10, yaw: -0.35, pitch: 0.1, target: [0, 0, -2], fov: 0.55, minDistance: 0.9, maxDistance: 45, spin: 0, ...o });
  c.update(0, ASPECT, 0);
  return c;
};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (a) => Math.hypot(...a);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const near = (a, b, eps, msg) => {
  if (Array.isArray(a)) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${msg ?? ''} [${i}] ${v} vs ${b[i]}`));
  else assert.ok(Math.abs(a - b) < eps, `${msg ?? ''} ${a} vs ${b}`);
};
// Client pixel of a world point through the camera's last view and projection.
const px = (c, q) => {
  const v = c.view, p = c.proj;
  const cx = v[0] * q[0] + v[4] * q[1] + v[8] * q[2] + v[12], cy = v[1] * q[0] + v[5] * q[1] + v[9] * q[2] + v[13];
  const w = -(v[2] * q[0] + v[6] * q[1] + v[10] * q[2] + v[14]);
  return [(p[0] * cx / w * 0.5 + 0.5) * W, (0.5 - p[5] * cy / w * 0.5) * H];
};
const settle = (c, s = 6) => { for (let i = 0; i < s * 60; i++) c.update(1 / 60, ASPECT, 0); };
const lookDir = (c) => sub(c.target, c.eye).map((v) => v / c.distance);

describe('orbit, pan and the poles', () => {
  test('the eye sits at target + d · dir(yaw, pitch) and looks at the pivot (screen centre)', () => {
    const c = cam();
    near(c.eye, c.target.map((t, i) => t + 10 * orbitDir(-0.35, 0.1)[i]), 1e-12);
    near(px(c, c.target), [W / 2, H / 2], 1e-3, 'pivot at the centre');
    c.orbit(0.4, 0.2);
    c.update(0, ASPECT, 0);
    near([c.yaw, c.pitch], [0.05, 0.3], 1e-12);
    near(norm(sub(c.eye, c.target)), 10, 1e-9, 'orbit keeps the distance');
  });
  test('a drag orbits with release inertia; pan slides the scene with the cursor', () => {
    const c = cam();
    c.dragging = true;
    c.drag(100, 0);
    near(c.yaw, -0.35 + 100 * NAV.orbitYaw, 1e-12);
    c.dragging = false;
    const y0 = c.yaw;
    c.update(1 / 60, ASPECT, 0);
    assert.ok(c.yaw > y0, 'inertia carries on after release');
    c.drag(2000, -2000);
    assert.deepEqual([c.velYaw, c.velPitch], [NAV.maxVel, -NAV.maxVel], 'a flick coasts at most 12 frames of the cap');
    const c2 = cam(), t0 = [...c2.target], [x0, yy0] = px(c2, t0);
    c2.pan(120, -40);
    c2.update(0, ASPECT, 0);
    const [x1, y1] = px(c2, t0);
    near([x1 - x0, y1 - yy0], [120, -40], 1e-3);
    near([c2.yaw, c2.pitch, c2.distance], [-0.35, 0.1, 10], 1e-12, 'pan changes neither angle nor distance');
  });
  test('the model follows the hand: the surface under the cursor moves with the drag (grab convention)', () => {
    // A point on the near side of the model, between the eye and the pivot, a little off centre.
    const front = (c) => { const r = c._rayDir(430, 320); return c.eye.map((e, i) => e + r[i] * c.distance * 0.8); };
    for (const [dx, dy] of [[40, 0], [-40, 0], [0, 30], [0, -30]]) {
      const c = cam(), q = front(c), [x0, y0] = px(c, q);
      c.drag(dx, dy);
      c.update(0, ASPECT, 0);
      const [x1, y1] = px(c, q);
      if (dx) assert.ok(Math.sign(x1 - x0) === Math.sign(dx), `drag ${dx} px: the front moved ${(x1 - x0).toFixed(1)} px`);
      if (dy) assert.ok(Math.sign(y1 - y0) === Math.sign(dy), `drag ${dy} px: the front moved ${(y1 - y0).toFixed(1)} px`);
    }
  });
  test('the pitch stops short of the poles and the view never flips over the top', () => {
    const c = cam();
    c.orbit(0, 10);
    c.update(0, ASPECT, 0);
    assert.equal(c.pitch, PITCH_LIMIT);
    const right = [c.view[0], c.view[4], c.view[8]];
    near(right, [-Math.cos(c.yaw), Math.sin(c.yaw), 0], 1e-6, 'right vector stays horizontal at the pole');
    c.orbit(0, -0.01);
    c.update(0, ASPECT, 0);
    assert.ok(dot(right, [c.view[0], c.view[4], c.view[8]]) > 0.999, 'no flip just below the pole');
    c.orbit(0, -20);
    assert.equal(c.pitch, -PITCH_LIMIT);
    for (let i = 0; i < 16; i++) assert.ok(Number.isFinite(c.view[i]));
  });
});

describe('zoom towards the cursor', () => {
  test('a zoom about a picked point keeps its pixel and draws the pivot towards it', () => {
    const c = cam();
    const ray = c._rayDir(250, 420), P = c.eye.map((e, i) => e + ray[i] * 7);   // a part 7 units away
    const dP0 = norm(sub(P, c.target));
    for (let i = 0; i < 4; i++) { c.zoomAt(0.7, 250, 420, P); c.update(0, ASPECT, 0); }
    near(px(c, P), [250, 420], 1e-3, 'pixel kept');
    near(c.distance, 10 * 0.7 ** 4, 1e-9);
    near(norm(sub(P, c.target)), dP0 * 0.7 ** 4, 1e-9, 'pivot moves towards the point');
    near(norm(sub(P, c.eye)), 7 * 0.7 ** 4, 1e-6, 'eye approaches the point by the factor');
  });
  test('at the near limit the camera dollies on along the ray; at the far limit zooming out stops', () => {
    const c = cam({ distance: 1 });
    const ray = c._rayDir(500, 200), P = c.eye.map((e, i) => e + ray[i] * 1.6);
    c.zoomAt(0.5, 500, 200, P);
    c.update(0, ASPECT, 0);
    near(c.distance, 0.9, 1e-12, 'distance held at the limit');
    near(norm(sub(P, c.eye)), 0.8, 1e-6, 'eye still approaches P by the factor');
    near(px(c, P), [500, 200], 1e-3, 'pixel kept while dollying');
    const far = cam({ distance: 45 }), t0 = [...far.target];
    assert.equal(far.zoomAt(1.2, 300, 300), false);
    near(far.target, t0, 1e-12);
  });
  test('without a pick the zoom point is on the pivot plane (as before)', () => {
    const c = cam();
    const q = c.planePoint(250, 420);
    const f = c.forward();
    near(dot(sub(q, c.target), f), 0, 1e-9, 'on the plane through the pivot');
    c.zoomAt(0.6, 250, 420);
    c.update(0, ASPECT, 0);
    near(px(c, q), [250, 420], 1e-3);
  });
  test('wheel zoom eases to the same result; reduced motion applies it at once', () => {
    const a = cam(), b = cam();
    const P = a.planePoint(300, 200);
    a.zoomSmooth(0.5, P);
    assert.equal(a.distance, 10, 'nothing before the next frame');
    settle(a, 2);
    b.zoomAbout(0.5, P);
    near(a.distance, b.distance, 1e-6);
    near(a.target, b.target, 1e-5);
    const rm = cam({ reducedMotion: true });
    rm.zoomSmooth(0.5, P);
    near(rm.distance, 5, 1e-12);
  });
});

describe('pivot, focus and framing', () => {
  test('focus slides the part to the centre at the new distance without turning', () => {
    const c = cam();
    const P = [0.4, 0.3, -2.5];
    c.focus(P, 4.5);
    settle(c);
    near(c.target, P, 1e-3);
    near([c.yaw, c.pitch], [-0.35, 0.1], 1e-3, 'angles kept');
    near(c.distance, 4.5, 1e-3);
    near(px(c, P), [W / 2, H / 2], 0.5);
    const lim = cam();
    lim.focus(P, 0.1);
    assert.equal(lim.goal.distance, 0.9, 'clamped to the near limit');
  });
  test('reduced motion: focus cuts at once and asks for the cross-fade', () => {
    let cut = 0;
    const c = cam({ reducedMotion: true, onCut: () => cut++ });
    c.focus([1, 0, -2], 3);
    assert.deepEqual([c.target, c.distance, c.goal, cut], [[1, 0, -2], 3, null, 1]);
  });
  test('the pivot can be set on any point: the eye stays and the view turns to it', () => {
    const c = cam();
    const e0 = [...c.eye], P = [1.2, -0.4, -1.1];
    c.pivotAt(P);
    settle(c);
    near(c.eye, e0, 1e-3, 'eye unchanged');
    near(c.target, P, 1e-3);
    near(c.distance, norm(sub(e0, P)), 1e-3);
    // Orbiting now turns about P: P stays at the centre and its distance from the eye holds.
    c.orbit(0.8, -0.2);
    c.update(0, ASPECT, 0);
    near(px(c, P), [W / 2, H / 2], 1e-3);
    near(norm(sub(c.eye, P)), norm(sub(e0, P)), 1e-6);
  });
  test('frame fits a sphere into the narrower field of view with the margin', () => {
    const c = cam();
    const d = c.frameDistance(0.75);
    near(Math.sin(0.55 / 2) * d, 0.75 * NAV.frameMargin, 1e-9, 'landscape: the vertical field is the narrower');
    c.frame([0, 0.1, -0.2], 0.75);
    settle(c);
    near(c.target, [0, 0.1, -0.2], 1e-3);
    near(c.distance, d, 1e-3);
    const portrait = new OrbitCamera(canvas, { fov: 0.55, maxDistance: 45 });
    portrait.update(0, 0.5, 0);
    const half = Math.atan(Math.tan(portrait.fovEff / 2) * 0.5);
    near(portrait.frameDistance(1), NAV.frameMargin / Math.sin(half), 1e-9, 'portrait: the horizontal field');
  });
});

describe('axis views and steps', () => {
  test('front, right and top look from +y, +x and above (A.2: the body faces +y, its right is +x)', () => {
    const want = { front: [0, 1, 0], back: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0] };
    for (const [name, dir] of Object.entries(want)) {
      const c = cam();
      c.setView(name);
      settle(c);
      near(sub(c.eye, c.target).map((v) => v / c.distance), dir, 1e-3, name);
      near(c.target, [0, 0, -2], 1e-3, `${name}: pivot kept`);
    }
    const top = cam();
    top.setView('top');
    settle(top);
    assert.ok(sub(top.eye, top.target)[2] / top.distance > 0.9999, 'top: from above');
    near([top.view[0], top.view[4], top.view[8]], [-1, 0, 0], 1e-3, 'top: the screen right is the body left, as in the front view');
    top.setView('opposite');
    settle(top);
    assert.ok(sub(top.eye, top.target)[2] / top.distance < -0.9999, 'opposite of top is bottom');
  });
  test('orbit steps add 15° to the goal; reduced motion steps at once without a cut', () => {
    const c = cam();
    c.orbitBy(NAV.stepAngle, 0);
    c.orbitBy(NAV.stepAngle, 0);
    assert.ok(Math.abs(c.goal.yaw - (-0.35 + 2 * NAV.stepAngle)) < 1e-12, 'a second press builds on the first');
    settle(c);
    near(c.yaw, -0.35 + 2 * NAV.stepAngle, 1e-3);
    let cut = 0;
    const rm = cam({ reducedMotion: true, onCut: () => cut++ });
    rm.orbitBy(0, -NAV.stepAngle);
    near(rm.pitch, 0.1 - NAV.stepAngle, 1e-12);
    assert.equal(cut, 0);
  });
});

describe('fly mode', () => {
  test('look turns about the eye; the keys move the eye along the view at a speed set by the distance', () => {
    const c = cam();
    c.setFly(true);
    const e0 = [...c.eye];
    c.drag(80, 30);
    c.update(0, ASPECT, 0);
    near(c.eye, e0, 1e-9, 'eye fixed while looking');
    assert.ok(c.yaw > -0.35 && c.pitch > 0.1, 'mouse right turns right, down looks down');
    const f = lookDir(c), e1 = [...c.eye];
    c.flyInput = [0, 1, 0];
    c.update(0.5, ASPECT, 0);
    near(sub(c.eye, e1), f.map((v) => v * NAV.flySpeed * 10 * 0.5), 1e-6, 'forward at 0.3 · d per second');
    c.flyInput = [0, 0, 1];
    c.flyFast = true;
    const e2 = [...c.eye];
    c.update(0.1, ASPECT, 0);
    near(sub(c.eye, e2), [0, 0, NAV.flySpeed * 10 * NAV.flyBoost * 0.1], 1e-6, 'E rises on the world vertical, Shift faster');
  });
  test('no auto-spin or inertia in fly mode; a preset ends it', () => {
    const c = cam();
    c.setFly(true);
    c.velYaw = 0.1;
    const y0 = c.yaw;
    c.update(1, ASPECT, 0);
    assert.equal(c.yaw, y0);
    c.flyTo({ yaw: 0, pitch: 0, distance: 3, target: [0, 0, 0] });
    assert.equal(c.fly, false);
  });
});

describe('depth pick (view-pick.js)', () => {
  // Stars in a slab at depth z0 along −z from an eye at the origin looking down −z.
  const slab = (z0, n, flux = 1, spread = 0.02) => {
    const a = new Float32Array(n * 12);
    for (let i = 0; i < n; i++) {
      const u = (i * 0.618034) % 1, v = (i * 0.414214) % 1, w = (i * 0.732051) % 1;
      a.set([(u - 0.5) * spread, (v - 0.5) * spread, -z0 + (w - 0.5) * 0.05, flux], i * 12);
    }
    return { data: a, stride: 12, count: n };
  };
  const pick = (sets, o = {}) => pickStars([0, 0, 0], [0, 0, -1], sets, { cone: 0.01, bin: 0.03, ...o });
  test('finds the depth of a layer under the ray', () => {
    const r = pick([slab(3, 200)]);
    near(r.t, 3, 0.03);
    near(r.point, [0, 0, -3], 0.03);
  });
  test('a sparse layer in front is passed for the dense structure behind it', () => {
    const r = pick([slab(2, 10), slab(4, 300)]);
    near(r.t, 4, 0.05, 'the dense layer');
    const front = pick([slab(2, 150), slab(4, 300)]);
    near(front.t, 2, 0.05, 'a substantial front layer wins');
  });
  test('nothing in the cone, behind the eye or cut away returns null', () => {
    assert.equal(pick([slab(-3, 200)]), null, 'behind the eye');
    assert.equal(pick([{ ...slab(3, 200), cutX: 1 }]), null, 'all on the removed side of the cut');
    const off = slab(3, 200);
    for (let i = 0; i < 200; i++) off.data[i * 12] += 1;
    assert.equal(pick([off]), null, 'outside the cone');
  });
});

describe('input mapping (camera-controls.js)', () => {
  const k = (code, key, mods = {}) => ({ code, key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });
  test('numpad views, the laptop Alt digits and Ctrl for the other side', () => {
    assert.equal(keyAction(k('Numpad1', '1')), 'view:front');
    assert.equal(keyAction(k('Numpad1', '1', { ctrlKey: true })), 'view:back');
    assert.equal(keyAction(k('Numpad3', 'PageDown')), 'view:right', 'NumLock off still maps by code');
    assert.equal(keyAction(k('Numpad7', '7', { ctrlKey: true })), 'view:bottom');
    assert.equal(keyAction(k('Digit1', '¡', { altKey: true })), 'view:front');
    assert.equal(keyAction(k('Digit3', '£', { altKey: true, shiftKey: true })), 'view:left');
    assert.equal(keyAction(k('Numpad9', '9')), 'view:opposite');
  });
  test('HUD keys are left alone: digits, P, Space, WASD; F is full screen in the full HUD', () => {
    for (const [code, key] of [['Digit1', '1'], ['Digit2', '2'], ['KeyP', 'p'], ['Space', ' '], ['KeyW', 'w'], ['KeyD', 'd'], ['KeyV', 'v']]) {
      assert.equal(keyAction(k(code, key)), null, key);
    }
    assert.equal(keyAction(k('KeyF', 'f')), 'frame:selected');
    assert.equal(keyAction(k('KeyF', 'f'), { simple: false }), null);
    assert.equal(keyAction(k('KeyF', 'F', { shiftKey: true }), { simple: false }), 'fly:toggle');
    assert.equal(keyAction(k('KeyF', 'f', { metaKey: true })), null, 'browser shortcuts');
  });
  test('steps, zoom, frame and help; arrows yield to sliders', () => {
    assert.equal(keyAction(k('ArrowLeft', 'ArrowLeft')), 'orbit:left');
    assert.equal(keyAction(k('ArrowUp', 'ArrowUp', { shiftKey: true })), 'pan:up');
    assert.equal(keyAction(k('ArrowLeft', 'ArrowLeft'), { control: true }), null);
    assert.equal(keyAction(k('Numpad4', '4'), { control: true }), 'orbit:left');
    assert.equal(keyAction(k('Equal', '=')), 'zoom:in');
    assert.equal(keyAction(k('Minus', '-')), 'zoom:out');
    assert.equal(keyAction(k('Home', 'Home')), 'frame:all');
    assert.equal(keyAction(k('NumpadDecimal', '.')), 'frame:selected');
    assert.equal(keyAction(k('Period', '.')), 'frame:selected');
    assert.equal(keyAction(k('Slash', '?', { shiftKey: true })), 'help');
    const el = (tag, role = null) => ({ tagName: tag, getAttribute: (a) => (a === 'role' ? role : null) });
    assert.equal(isControl(el('DIV', 'slider')), true);
    assert.equal(isControl(el('INPUT')), true);
    assert.equal(isControl(el('BUTTON')), false, 'a focused HUD button does not keep the arrows');
  });
  test('wheel kinds: pinch, trackpad scroll and a notched wheel', () => {
    assert.equal(wheelKind({ ctrlKey: true, deltaMode: 0, deltaY: 3 }), 'pinch');
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 2, deltaY: 5 }), 'trackpad');
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 0, deltaY: 4, wheelDeltaY: -12 }), 'trackpad', 'wheelDelta = −3 · delta');
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 0, deltaY: 4, wheelDeltaY: -120 }), 'mouse', 'a notch, scaled by the browser');
    assert.equal(wheelKind({ deltaMode: 1, deltaX: 0, deltaY: 3 }), 'mouse', 'lines (Firefox)');
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 0, deltaY: 100 }), 'mouse');
    const stream = { kind: 'trackpad', t: 1000 };
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 0, deltaY: 100, timeStamp: 1100 }, stream), 'trackpad', 'a stream keeps its kind');
    assert.equal(wheelKind({ deltaMode: 0, deltaX: 0, deltaY: 100, timeStamp: 1500 }, stream), 'mouse');
  });
  test('drags: Blender middle orbit, Shift + middle pan, Ctrl + middle zoom; right pans; touch orbits', () => {
    assert.equal(dragMode({ button: 0 }), 'orbit');
    assert.equal(dragMode({ button: 0, shiftKey: true }), 'pan');
    assert.equal(dragMode({ button: 0, ctrlKey: true }), 'pan');
    assert.equal(dragMode({ button: 1 }), 'orbit');
    assert.equal(dragMode({ button: 1, shiftKey: true }), 'pan');
    assert.equal(dragMode({ button: 1, ctrlKey: true }), 'zoom');
    assert.equal(dragMode({ button: 2 }), 'pan');
    assert.equal(dragMode({ button: 2, altKey: true }), 'zoom');
    assert.equal(dragMode({ button: 0, pointerType: 'touch', shiftKey: true }), 'orbit');
  });
});
