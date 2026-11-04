// Orbit camera (z up): mouse/touch control, slow automatic rotation, inertia and eased presets.
// Body views span a 10× range of distances (brain 3–3.6 units, whole body 35; research/ANALYSIS.md
// §13.11), so fly-to eases the distance in log space and the near plane grows with the distance.

import { MM } from './anatomy.js';

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
    this.aspect = 1;
    this.yaw = yaw;
    this.pitch = pitch;
    this.distance = distance;
    this.target = [...target];
    this.fov = fov;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.autoSpin = reducedMotion ? spin / 3 : spin;   // rad/s
    this.goal = null;
    this.fovEff = fov;
    this.velYaw = 0;
    this.velPitch = 0;
    this.shake = 0;
    this.view = new Float32Array(16);
    this.proj = new Float32Array(16);
    this.viewRot = new Float32Array(16);   // for background stars (at infinity: rotation only)
    this.eye = [0, 0, 0];
    this.lastInteraction = -1e9;
    this._bind();
  }

  // Left drag orbits; right or middle drag, or Shift/Ctrl + left drag, pans; the wheel and a pinch zoom
  // towards the point under the cursor; a two-finger drag pans; a double click flies halfway in
  // towards the clicked point. So any part of the body can be brought to the centre and examined.
  _bind() {
    const c = this.canvas;
    const pointers = new Map();
    let pinchDist = 0, mid = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey });
      this.lastInteraction = performance.now();
      this.goal = null;
      this.velYaw = this.velPitch = 0;
      if (pointers.size === 2) mid = null;
    });
    c.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        if (p.pan) this.pan(dx, dy);
        else {
          this.velYaw = -dx * 0.0045;
          this.velPitch = -dy * 0.0035;
          this.yaw += this.velYaw;
          this.pitch += this.velPitch;
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinchDist && d > 0) this.zoomAt(pinchDist / d, m.x, m.y);
        if (mid) this.pan(m.x - mid.x, m.y - mid.y);
        pinchDist = d;
        mid = m;
      }
      this.lastInteraction = performance.now();
    });
    c.addEventListener('pointerdown', () => { this.dragging = true; });
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) { pinchDist = 0; mid = null; }
      this.dragging = pointers.size > 0;
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('contextmenu', (e) => e.preventDefault());   // right drag pans
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(Math.exp(e.deltaY * 0.0011), e.clientX, e.clientY);
      this.lastInteraction = performance.now();
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      const goal = this._zoomGoal(0.5, e.clientX, e.clientY);
      this.flyTo({ yaw: this.yaw, pitch: this.pitch, ...goal });
      this.lastInteraction = performance.now();
    });
  }

  zoom(factor) {
    this.distance = Math.min(this.maxDistance, Math.max(this.minDistance, this.distance * factor));
    this.goal = null;
  }

  // Zoom by `factor` keeping the point under the client pixel fixed on screen: eye and target both
  // move towards that point (on the plane through the target facing the camera).
  zoomAt(factor, clientX, clientY) {
    const g = this._zoomGoal(factor, clientX, clientY);
    this.distance = g.distance;
    this.target = g.target;
    this.goal = null;
  }

  _zoomGoal(factor, clientX, clientY) {
    const d0 = this.distance;
    const d1 = Math.min(this.maxDistance, Math.max(this.minDistance, d0 * factor));
    const target = [...this.target];
    const ray = this._rayDir(clientX, clientY);
    const fwd = [0, 1, 2].map((i) => (this.target[i] - this.eye[i]) / d0);
    const cos = ray[0] * fwd[0] + ray[1] * fwd[1] + ray[2] * fwd[2];
    if (cos > 0.05) {
      const k = 1 - d1 / d0, s = d0 / cos;
      for (let i = 0; i < 3; i++) target[i] += (this.eye[i] + ray[i] * s - target[i]) * k;
    }
    return { distance: d1, target };
  }

  // Move the target with the cursor: a drag of (dx, dy) CSS px slides the scene by the same amount on
  // the plane through the target.
  pan(dx, dy) {
    const h = this.canvas.clientHeight || 1;
    const s = (2 * this.distance * Math.tan(this.fovEff / 2)) / h;
    const v = this.view;   // rows of the rotation: right (0, 4, 8), up (1, 5, 9)
    for (let i = 0; i < 3; i++) this.target[i] += (-v[i * 4] * dx + v[i * 4 + 1] * dy) * s;
    this.goal = null;
  }

  // Ease towards a preset view { yaw, pitch, distance, target } over about a second; under reduced
  // motion the view cuts at once and onCut lets the renderer cross-fade (0.3 s, §13.11).
  flyTo(goal) {
    this.velYaw = this.velPitch = 0;
    if (this.reducedMotion) {
      this.yaw = goal.yaw;
      this.pitch = goal.pitch;
      this.distance = goal.distance;
      this.target = [...goal.target];
      this.goal = null;
      if (this.onCut) this.onCut();
      return;
    }
    this.goal = { ...goal, target: [...goal.target] };
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
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 3.5), g = this.goal;
      let dy = g.yaw - this.yaw;
      dy -= 2 * Math.PI * Math.round(dy / (2 * Math.PI));
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
        && Math.abs(g.pitch - this.pitch) < 1e-3 && dt3 < 1e-3 * Math.max(1, this.distance)) this.goal = null;
    }
    const idle = performance.now() - this.lastInteraction > 2500;
    if (idle && !this.goal) this.yaw += this.autoSpin * dt;
    // Inertia after release (while dragging, the angle changes directly).
    if (!this.dragging) {
      this.yaw += this.velYaw * dt * 60;
      this.pitch += this.velPitch * dt * 60;
      this.velYaw *= Math.exp(-dt * 5);
      this.velPitch *= Math.exp(-dt * 5);
    }
    this.pitch = Math.min(1.53, Math.max(-1.53, this.pitch));

    // Optional very slight tremor (shake 0..1); unused in the brain view.
    const s = this.shake * 0.006;
    const jy = s * (Math.sin(time * 37.1) + Math.sin(time * 23.3) * 0.6);
    const jp = s * (Math.sin(time * 31.7 + 1.3) + Math.sin(time * 19.9) * 0.6);

    const yaw = this.yaw + jy, pitch = this.pitch + jp;
    const cp = Math.cos(pitch);
    this.eye[0] = this.target[0] + this.distance * cp * Math.sin(yaw);
    this.eye[1] = this.target[1] + this.distance * cp * Math.cos(yaw);
    this.eye[2] = this.target[2] + this.distance * Math.sin(pitch);
    lookAt(this.view, this.eye, this.target, [0, 0, 1]);
    // On narrow (portrait) screens the vertical field of view widens so the subject still fits across.
    this.fovEff = aspect < 1.2 ? Math.min(1.4, 2 * Math.atan(Math.tan(this.fov / 2) * 1.2 / aspect)) : this.fov;
    this.aspect = aspect;
    perspective(this.proj, this.fovEff, aspect, this.nearPlane, this.far);
    this.viewRot.set(this.view);
    this.viewRot[12] = this.viewRot[13] = this.viewRot[14] = 0;
  }
}
