// Orbit camera: mouse/touch control, slow automatic rotation and inertia.

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
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.yaw = -0.6;
    this.pitch = 0.95;          // ~54° tilt: the spiral structure and the disk thickness are visible together
    this.distance = 2.55;
    this.target = [0, 0, 0];
    this.fov = 0.82;
    this.autoSpin = reducedMotion ? 0.004 : 0.012;   // rad/s
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

  _bind() {
    const c = this.canvas;
    const pointers = new Map();
    let pinchDist = 0;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastInteraction = performance.now();
    });
    c.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        this.velYaw = -dx * 0.0045;
        this.velPitch = -dy * 0.0035;
        this.yaw += this.velYaw;
        this.pitch += this.velPitch;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) this.zoom(pinchDist / d);
        pinchDist = d;
      }
      this.lastInteraction = performance.now();
    });
    c.addEventListener('pointerdown', () => { this.dragging = true; });
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      this.dragging = pointers.size > 0;
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0011));
      this.lastInteraction = performance.now();
    }, { passive: false });
  }

  zoom(factor) {
    this.distance = Math.min(6.0, Math.max(0.55, this.distance * factor));
  }

  update(dt, aspect, time) {
    const idle = performance.now() - this.lastInteraction > 2500;
    if (idle) this.yaw += this.autoSpin * dt;
    // Inertia after release (while dragging, the angle changes directly).
    if (!this.dragging) {
      this.yaw += this.velYaw * dt * 60;
      this.pitch += this.velPitch * dt * 60;
      this.velYaw *= Math.exp(-dt * 5);
      this.velPitch *= Math.exp(-dt * 5);
    }
    this.pitch = Math.min(1.53, Math.max(-1.53, this.pitch));

    // Very slight tremor at the peak of anger (shake 0..1).
    const s = this.shake * 0.006;
    const jy = s * (Math.sin(time * 37.1) + Math.sin(time * 23.3) * 0.6);
    const jp = s * (Math.sin(time * 31.7 + 1.3) + Math.sin(time * 19.9) * 0.6);

    const yaw = this.yaw + jy, pitch = this.pitch + jp;
    const cp = Math.cos(pitch);
    this.eye[0] = this.target[0] + this.distance * cp * Math.sin(yaw);
    this.eye[1] = this.target[1] + this.distance * cp * Math.cos(yaw);
    this.eye[2] = this.target[2] + this.distance * Math.sin(pitch);
    lookAt(this.view, this.eye, this.target, [0, 0, 1]);
    perspective(this.proj, this.fov, aspect, 0.01, 50);
    this.viewRot.set(this.view);
    this.viewRot[12] = this.viewRot[13] = this.viewRot[14] = 0;
  }
}
