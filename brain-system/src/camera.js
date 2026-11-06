// Orbit camera (z up) with a movable pivot, Blender-style navigation maths and an optional fly mode.
// Body views span a 10× range of distances (brain 3–3.6 units, whole body 35; research/ANALYSIS.md
// §13.11), so fly-to eases the distance in log space and the near plane grows with the distance.
//
// State: the pivot `target`, the turntable angles `yaw` and `pitch`, and the pivot `distance`; the
// eye sits at target + distance · dir(yaw, pitch) and always looks at the pivot, so the pivot is the
// screen centre. Input lives in camera-controls.js; this file holds only the maths, so it is tested
// without a browser (test/camera.test.mjs).

import { MM } from './anatomy.js';

// Just short of the poles: the right vector (−cos yaw, sin yaw, 0) stays defined, so the turntable
// never flips over the top or the bottom (Blender's turntable does the same).
export const PITCH_LIMIT = Math.PI / 2 - 0.002;

// Axis views (Blender numpad 1/3/7 with Ctrl for the opposite side). The body faces +y and its right
// side is +x (A.2; picking.js treats yaw π as the posterior view), so "front" puts the eye on +y.
export const VIEW_ANGLES = {
  front: { yaw: 0, pitch: 0 },
  back: { yaw: Math.PI, pitch: 0 },
  right: { yaw: Math.PI / 2, pitch: 0 },
  left: { yaw: -Math.PI / 2, pitch: 0 },
  top: { yaw: 0, pitch: PITCH_LIMIT },
  bottom: { yaw: 0, pitch: -PITCH_LIMIT },
};

// Navigation constants [model]. Orbit and look gains in rad per CSS pixel (the orbit gains are the
// pre-existing magnitudes; the direction follows the cursor, see dragAngles); zoom smoothing time
// constant; fly speed as a fraction of the pivot distance per second, so moving is as quick at the
// brain (3 units) as across the body (35); frame margin.
export const NAV = {
  orbitYaw: 0.0045, orbitPitch: 0.0035, look: 0.0035,
  zoomTau: 0.07, flySpeed: 0.3, flyBoost: 3, frameMargin: 1.12, stepAngle: Math.PI / 12,
  maxVel: 0.05,   // release inertia cap, rad per 60-Hz frame (it coasts 12 frames' worth: ≤ 0.6 rad)
};

const clampPitch = (p) => Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, p));

// Orbit angles for a drag of (dx, dy) CSS px, in the "grab" convention of Blender's turntable, Maya
// and 3ds Max tumble, three.js OrbitControls and Sketchfab: the surface under the cursor follows it.
// A drag to the right turns the model to the right (the eye swings left: yaw grows), a drag down
// tilts its front down (the eye rises: pitch grows). Before 6 November 2026 both signs were the other
// way round, so the model turned against the hand (user report).
export function dragAngles(dx, dy) {
  return [dx * NAV.orbitYaw, dy * NAV.orbitPitch];
}
const wrapPi = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function lookAt(out, eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz);
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

// Unit vector from the pivot to the eye.
export function orbitDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [cp * Math.sin(yaw), cp * Math.cos(yaw), Math.sin(pitch)];
}

export class OrbitCamera {
  constructor(canvas, { reducedMotion = false, yaw = -0.6, pitch = 0.95, distance = 2.55, target = [0, 0, 0],
    fov = 0.82, minDistance = 0.55, maxDistance = 6.0, spin = 0.012, near = 0.01, far = 150, nearRef = 4, onCut = null } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    // Near plane = near · max(1, d / nearRef) (§13.11: 0.01 · max(1, d/4)); far plane 150 (was 50).
    this.near = near;
    this.far = far;
    this.nearRef = nearRef;
    this.onCut = onCut;   // called when a reduced-motion fly-to cuts instead of easing (cross-fade, §13.11)
    this.onUpdate = null; // called at the end of every update (camera-controls.js: fly badge, pivot ring)
    this.aspect = 1;
    this.yaw = yaw;
    this.pitch = clampPitch(pitch);
    this.distance = distance;
    this.target = [...target];
    this.fov = fov;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.autoSpin = reducedMotion ? spin / 3 : spin;   // rad/s
    this.goal = null;
    this.zoomQueue = null;   // { log, point }: wheel zoom still to apply, eased over NAV.zoomTau
    this.fly = false;        // fly mode: drags turn the view about the eye, flyInput moves the eye
    this.flyInput = [0, 0, 0];   // right, forward, up in −1..1 (camera-controls.js sets it from WASD/QE)
    this.flyFast = false;
    this.fovEff = fov;
    this.velYaw = 0;
    this.velPitch = 0;
    this.dragging = false;
    this.shake = 0;
    this.view = new Float32Array(16);
    this.proj = new Float32Array(16);
    this.viewRot = new Float32Array(16);   // for background stars (at infinity: rotation only)
    this.eye = [0, 0, 0];
    this.lastInteraction = -1e9;
  }

  // Eye position from the current state (this.eye is the one of the last frame, with any shake).
  eyeNow() {
    const d = orbitDir(this.yaw, this.pitch);
    return this.target.map((t, i) => t + d[i] * this.distance);
  }

  // Unit view direction (eye to pivot).
  forward() { return orbitDir(this.yaw, this.pitch).map((v) => -v); }

  // Screen right and up in world axes for the current angles (right is horizontal: turntable).
  axes() {
    const f = this.forward();
    const right = [-Math.cos(this.yaw), Math.sin(this.yaw), 0];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    return { right, up, forward: f };
  }

  _clampD(d) { return Math.min(this.maxDistance, Math.max(this.minDistance, d)); }

  // --- Orbit and look ---

  // Turntable orbit about the pivot by angles (rad); the pitch stops short of the poles.
  orbit(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = clampPitch(this.pitch + dPitch);
    this.goal = null;
  }

  // A drag of (dx, dy) CSS px: orbits about the pivot with release inertia, or in fly mode turns the
  // view about the eye (mouse right turns right, down looks down, as in Unreal).
  drag(dx, dy) {
    if (this.fly) { this.look(dx * NAV.look, dy * NAV.look); return; }
    const [yaw, pitch] = dragAngles(dx, dy);
    this.orbit(yaw, pitch);
    this.setInertia(yaw, pitch);
  }

  // Release inertia in rad per 60-Hz frame, capped (camera-controls.js measures it over the last
  // moves of a drag, so a drag that stops before release does not coast).
  setInertia(yaw, pitch) {
    const c = (v) => Math.max(-NAV.maxVel, Math.min(NAV.maxVel, v));
    this.velYaw = c(yaw);
    this.velPitch = c(pitch);
  }

  // Turn the view about the eye: the eye stays put and the pivot swings round it.
  look(dYaw, dPitch) {
    const e = this.eyeNow();
    this.yaw += dYaw;
    this.pitch = clampPitch(this.pitch + dPitch);
    const d = orbitDir(this.yaw, this.pitch);
    for (let i = 0; i < 3; i++) this.target[i] = e[i] - d[i] * this.distance;
    this.goal = null;
  }

  // Orbit in a fixed step (numpad 4/6/8/2, arrow keys), eased like a preset; reduced motion steps at
  // once without the cross-fade, since a 15° step is not a cut.
  orbitBy(dYaw, dPitch) {
    const g = this.goal ?? { yaw: this.yaw, pitch: this.pitch, distance: this.distance, target: this.target };
    const next = { yaw: g.yaw + dYaw, pitch: clampPitch(g.pitch + dPitch), distance: g.distance, target: [...g.target] };
    if (this.reducedMotion) { this._set(next); return; }
    this.flyTo(next);
  }

  // --- Pan ---

  // Move the target with the cursor: a drag of (dx, dy) CSS px slides the scene by the same amount on
  // the plane through the target.
  pan(dx, dy) {
    const h = this.canvas.clientHeight || 1;
    const s = (2 * this.distance * Math.tan(this.fovEff / 2)) / h;
    const v = this.view;   // rows of the rotation: right (0, 4, 8), up (1, 5, 9)
    for (let i = 0; i < 3; i++) this.target[i] += (-v[i * 4] * dx + v[i * 4 + 1] * dy) * s;
    this.goal = null;
  }

  // --- Zoom ---

  zoom(factor) {
    this.distance = this._clampD(this.distance * factor);
    this.goal = null;
  }

  // Zoom by `factor` about the world point P (units): eye, pivot and distance scale about P, so P
  // keeps its pixel and the pivot drifts towards it. At the near limit the camera dollies on along
  // the ray to P instead (the pivot travels with the eye), so a structure can be approached and passed
  // through; at the far limit zooming out stops. Returns false when nothing moved.
  zoomAbout(factor, P) {
    const eye = this.eyeNow();
    const toP = [P[0] - eye[0], P[1] - eye[1], P[2] - eye[2]];
    const f = this.forward();
    if (toP[0] * f[0] + toP[1] * f[1] + toP[2] * f[2] <= 1e-6) P = [...this.target];   // behind the eye: zoom on the pivot
    const d0 = this.distance, want = d0 * factor, d1 = this._clampD(want);
    const k = d1 / d0;
    if (factor > 1 && k <= 1 + 1e-12) return false;
    for (let i = 0; i < 3; i++) this.target[i] = P[i] + (this.target[i] - P[i]) * k;
    this.distance = d1;
    if (want < d1) {
      const rest = 1 - want / d1, e = this.eyeNow();   // remaining approach, as a fraction of eye→P
      for (let i = 0; i < 3; i++) this.target[i] += (P[i] - e[i]) * rest;
    }
    this.goal = null;
    return true;
  }

  // Point under a client pixel on the plane through the pivot facing the camera (the zoom point when
  // nothing is drawn under the cursor).
  planePoint(clientX, clientY) {
    const ray = this._rayDir(clientX, clientY);
    const f = this.forward();
    const cos = ray[0] * f[0] + ray[1] * f[1] + ray[2] * f[2];
    if (cos <= 0.05) return [...this.target];
    const s = this.distance / cos;
    return this.eye.map((e, i) => e + ray[i] * s);
  }

  // Zoom keeping the point under the client pixel fixed on screen: `point` is the picked depth under
  // the cursor (camera-controls.js) or, without one, the point on the pivot plane.
  zoomAt(factor, clientX, clientY, point = null) {
    return this.zoomAbout(factor, point ?? this.planePoint(clientX, clientY));
  }

  // Wheel zoom eased over NAV.zoomTau (a mouse notch is a 12 % step); the point is updated with each
  // event of a stream. Under reduced motion the step applies at once.
  zoomSmooth(factor, point) {
    if (this.reducedMotion) { this.zoomAbout(factor, point); return; }
    const q = this.zoomQueue;
    this.zoomQueue = { log: (q ? q.log : 0) + Math.log(factor), point: [...point] };
    this.goal = null;
  }

  // --- Focus, pivot, framing and views ---

  // Bring the world point P to the screen centre as the new pivot at `distance` (default: the current
  // one), keeping the viewing angles: the view slides, it does not turn (double-click, F).
  focus(P, distance = this.distance) {
    this.setFly(false);
    this.flyTo({ yaw: this.yaw, pitch: this.pitch, distance: this._clampD(distance), target: [...P] });
  }

  // Make P the pivot without moving the eye: the view turns to face P and later orbits round it
  // (Alt+click, middle click; 3ds Max "orbit point of interest").
  pivotAt(P) {
    const e = this.eyeNow();
    const v = [e[0] - P[0], e[1] - P[1], e[2] - P[2]];
    const d = Math.hypot(...v);
    if (d < 1e-6) return;
    const pitch = clampPitch(Math.asin(Math.max(-1, Math.min(1, v[2] / d))));
    const yaw = Math.abs(Math.cos(pitch)) < 1e-9 ? this.yaw : Math.atan2(v[0], v[1]);
    this.setFly(false);
    const dist = this._clampD(d);
    const u = orbitDir(yaw, pitch);
    // At the near limit the eye backs off along the same line; otherwise it does not move.
    const target = dist === d ? [...P] : e.map((x, i) => x - u[i] * dist);
    this.flyTo({ yaw: this.yaw + wrapPi(yaw - this.yaw), pitch, distance: dist, target });
  }

  // Distance at which a sphere of `radius` fills the narrower field of view, with a margin.
  frameDistance(radius) {
    const tv = Math.tan(this.fovEff / 2), th = tv * this.aspect;
    const half = Math.atan(Math.min(tv, th));
    return (radius / Math.sin(half)) * NAV.frameMargin;
  }

  // Frame a sphere (Home: everything drawn; frame selected: the focused part), keeping the angles.
  frame(center, radius) {
    this.focus(center, this.frameDistance(radius));
  }

  // Axis view about the current pivot ('front', 'back', 'right', 'left', 'top', 'bottom', or
  // 'opposite' for the other side, Blender numpad 9).
  setView(name) {
    const g = this.goal ?? this;
    const a = name === 'opposite' ? { yaw: g.yaw + Math.PI, pitch: -g.pitch } : VIEW_ANGLES[name];
    if (!a) return;
    this.setFly(false);
    this.flyTo({ yaw: g.yaw + wrapPi(a.yaw - g.yaw), pitch: a.pitch, distance: g.distance, target: [...g.target] });
  }

  // Ease towards a preset view { yaw, pitch, distance, target } over about a second; under reduced
  // motion the view cuts at once and onCut lets the renderer cross-fade (0.3 s, §13.11).
  flyTo(goal) {
    if (this.fly) this.setFly(false);   // a preset or a framing ends fly mode
    this.velYaw = this.velPitch = 0;
    this.zoomQueue = null;
    if (this.reducedMotion) {
      this._set(goal);
      if (this.onCut) this.onCut();
      return;
    }
    this.goal = { ...goal, pitch: clampPitch(goal.pitch), target: [...goal.target] };
  }

  _set(goal) {
    this.yaw = goal.yaw;
    this.pitch = clampPitch(goal.pitch);
    this.distance = goal.distance;
    this.target = [...goal.target];
    this.goal = null;
  }

  // --- Fly mode ---

  setFly(on) {
    if (this.fly === !!on) return;
    this.fly = !!on;
    this.flyInput = [0, 0, 0];
    this.velYaw = this.velPitch = 0;
    this.goal = null;
  }

  // Move the eye (and the pivot with it) by `move` = [right, forward, up] at the fly speed for dt s.
  // Forward follows the view (fly, not walk); up is the world vertical (Unreal Q/E).
  flyStep(dt, move = this.flyInput) {
    const { right, forward } = this.axes();
    const v = NAV.flySpeed * this.distance * (this.flyFast ? NAV.flyBoost : 1) * dt;
    for (let i = 0; i < 3; i++) this.target[i] += (right[i] * move[0] + forward[i] * move[1] + (i === 2 ? move[2] : 0)) * v;
  }

  // Current near-plane distance (units).
  get nearPlane() { return this.near * Math.max(1, this.distance / this.nearRef); }

  // Ray through a client (CSS) pixel, in mm of the body frame (A.2): { origin, dir } with dir unit.
  unproject(clientX, clientY) {
    return { origin: this.eye.map((e) => e / MM), dir: this._rayDir(clientX, clientY) };
  }

  // Unit direction of the ray through a client pixel (world axes).
  _rayDir(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((clientY - r.top) / r.height) * 2;
    const t = Math.tan(this.fovEff / 2);
    const cx = nx * t * this.aspect, cy = ny * t;
    const v = this.view;   // rows of the rotation: right (0, 4, 8), up (1, 5, 9), back (2, 6, 10)
    const dx = v[0] * cx + v[1] * cy - v[2];
    const dy = v[4] * cx + v[5] * cy - v[6];
    const dz = v[8] * cx + v[9] * cy - v[10];
    const n = Math.hypot(dx, dy, dz);
    return [dx / n, dy / n, dz / n];
  }

  update(dt, aspect, time) {
    const q = this.zoomQueue;
    if (q) {
      const k = dt > 0 ? 1 - Math.exp(-dt / NAV.zoomTau) : 0;
      const done = Math.abs(q.log) < 1e-4;
      const step = done ? q.log : q.log * k;
      const moved = this.zoomAbout(Math.exp(step), q.point);
      q.log -= step;
      if (done || !moved) this.zoomQueue = null;
    }
    if (this.fly && (this.flyInput[0] || this.flyInput[1] || this.flyInput[2])) {
      this.flyStep(dt);
      this.lastInteraction = performance.now();
    }
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 3.5), g = this.goal;
      const dy = wrapPi(g.yaw - this.yaw);
      this.yaw += dy * k;
      this.pitch += (g.pitch - this.pitch) * k;
      // Log-space distance: a brain-to-body flight (ratio ≈ 10) changes scale evenly (§13.11).
      const ld = Math.log(this.distance);
      this.distance = Math.exp(ld + (Math.log(g.distance) - ld) * k);
      let dt3 = 0;
      for (let i = 0; i < 3; i++) {
        this.target[i] += (g.target[i] - this.target[i]) * k;
        dt3 = Math.max(dt3, Math.abs(g.target[i] - this.target[i]));
      }
      if (Math.abs(dy) < 1e-3 && Math.abs(Math.log(g.distance / this.distance)) < 1e-3
        && Math.abs(g.pitch - this.pitch) < 1e-3 && dt3 < 1e-3 * Math.max(1, this.distance)) this._set(g);   // land exactly
    }
    const idle = performance.now() - this.lastInteraction > 2500;
    if (idle && !this.goal && !this.fly) this.yaw += this.autoSpin * dt;
    // Inertia after release (while dragging, the angle changes directly).
    if (!this.dragging && !this.fly) {
      this.yaw += this.velYaw * dt * 60;
      this.pitch += this.velPitch * dt * 60;
      this.velYaw *= Math.exp(-dt * 5);
      this.velPitch *= Math.exp(-dt * 5);
    }
    this.pitch = clampPitch(this.pitch);

    // Optional very slight tremor (shake 0..1); unused in the brain view.
    const s = this.shake * 0.006;
    const jy = s * (Math.sin(time * 37.1) + Math.sin(time * 23.3) * 0.6);
    const jp = s * (Math.sin(time * 31.7 + 1.3) + Math.sin(time * 19.9) * 0.6);

    const d = orbitDir(this.yaw + jy, clampPitch(this.pitch + jp));
    for (let i = 0; i < 3; i++) this.eye[i] = this.target[i] + this.distance * d[i];
    lookAt(this.view, this.eye, this.target, [0, 0, 1]);
    // On narrow (portrait) screens the vertical field of view widens so the subject still fits across.
    this.fovEff = aspect < 1.2 ? Math.min(1.4, 2 * Math.atan(Math.tan(this.fov / 2) * 1.2 / aspect)) : this.fov;
    this.aspect = aspect;
    perspective(this.proj, this.fovEff, aspect, this.nearPlane, this.far);
    this.viewRot.set(this.view);
    this.viewRot[12] = this.viewRot[13] = this.viewRot[14] = 0;
    if (this.onUpdate) this.onUpdate();
  }
}
