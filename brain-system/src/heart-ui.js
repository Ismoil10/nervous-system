// @ts-check
// Heart close-up interface (research/HEART.md §8.4, §8.6): the name of the structure under the mouse,
// and the button that opens the heart along the four-chamber plane. Display only.
//
// The name comes from the heart stars of the body buffer (rest positions; the beat moves them by a
// few millimetres at most): those inside a narrow cone round the cursor ray are weighted as the body
// shader draws them (flux, depth cue, section, the pericardium's facing law) and by how near the
// front they lie, and the structure with the largest weight wins. Stars hidden by the section and,
// in the Stars style, the fine anatomy it does not draw, are skipped.

import { MM } from './anatomy.js';
import { HEART_DEPTH, HEART_SECTION, HEART_FORM, PART, labelOf } from './body/heart-form.js';

// front: mm of the front-most bias; press*: the touch long press (hold, slop, label lift above the
// finger, how long the name stays).
export const HEART_PICK = { conePx: 8, front: 30, minWeight: 0.12, everyMs: 120, minQ: 2.5, pressMs: 550, pressMovePx: 10, pressLiftPx: 44, pressShowS: 2.5 };
const STRIDE = 6;   // x, y, z (render units), label, part, flux

// Heart stars of a body buffer (generate.js: 16 floats per point, organ class 1, part in float 5,
// label in float 10 as id / LABEL_SCALE) as a compact index for picking.
export function heartLabelIndex(points, floats, count) {
  let n = 0;
  for (let i = 0; i < count; i++) if (points[i * floats + 11] === 1 && points[i * floats + 5] >= 0.5) n++;
  const data = new Float32Array(n * STRIDE);
  for (let i = 0, k = 0; i < count; i++) {
    const o = i * floats;
    if (points[o + 11] !== 1 || points[o + 5] < 0.5) continue;
    data.set([points[o], points[o + 1], points[o + 2], labelOf(points[o + 10]), points[o + 5], points[o + 3]], k);
    k += STRIDE;
  }
  return { data, count: n };
}

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// Label id under the ray (origin: the eye, render units; dir: unit vector), or 0. section: the
// section amount 0–1; detailed: the body style.
export function pickHeartLabel(origin, dir, index, { cone = 0.006, near = 0.01, section = 0, detailed = true } = {}) {
  if (!index || !index.count) return 0;
  const { data, count } = index, [ox, oy, oz] = origin, [dx, dy, dz] = dir, tc2 = Math.tan(cone) ** 2;
  const C = HEART_DEPTH.c.map((v) => v * MM), hx = C[0] - ox, hy = C[1] - oy, hz = C[2] - oz, hl = Math.hypot(hx, hy, hz) || 1;
  const t0 = HEART_DEPTH.t0 * MM, mixL = (k) => (HEART_DEPTH.lambda[k] + (HEART_DEPTH.lambdaOpen[k] - HEART_DEPTH.lambda[k]) * section) * MM;
  const lamW = mixL(0), lamI = mixL(1);
  const S = HEART_SECTION, sp = S.p.map((v) => v * MM), sn = S.n;
  const side = (ox - sp[0]) * sn[0] + (oy - sp[1]) * sn[1] + (oz - sp[2]) * sn[2] >= 0 ? 1 : -1, open = S.open * MM * (1 - smooth(section));
  const E = HEART_DEPTH.envelope.map((r) => (r * MM) ** 2), FW = HEART_FORM.w, FA = HEART_FORM.ant, FR = HEART_FORM.right;
  const ts = [], ws = [], ls = [];
  for (let i = 0, o = 0; i < count; i++, o += STRIDE) {
    const part = data[o + 4];
    if (!detailed && part >= PART.TRABECULA - 0.5) continue;
    const x = data[o] - ox, y = data[o + 1] - oy, z = data[o + 2] - oz, t = x * dx + y * dy + z * dz;
    if (t <= near) continue;
    const lim = t * t * tc2, r2 = x * x + y * y + z * z - t * t;
    if (r2 > lim) continue;
    const sd = side * ((data[o] - sp[0]) * sn[0] + (data[o + 1] - sp[1]) * sn[1] + (data[o + 2] - sp[2]) * sn[2]);
    if (section > 0 && sd > open) continue;
    let w = data[o + 5] * (1 - 0.7 * r2 / lim);
    const hp = Math.round(part);
    if (detailed) {
      const inner = hp === PART.VALVE || (hp >= PART.SA && hp <= PART.PURKINJE) || hp === PART.LEAFLET || hp === PART.CHORDAE || hp === PART.ATRIAL_FIBROUS;
      const th = (((data[o] - C[0]) * hx + (data[o + 1] - C[1]) * hy + (data[o + 2] - C[2]) * hz) / hl - t0) * (1 - section) - sd * section;
      w *= Math.exp(-Math.max(0, th) / (inner ? lamI : lamW));
    }
    if (hp === PART.PERICARDIUM) {   // the sac's facing law (BODY_VS)
      const qx = data[o] - C[0], qy = data[o + 1] - C[1], qz = data[o + 2] - C[2];
      const a = (qx * FW[0] + qy * FW[1] + qz * FW[2]) / E[0], b = (qx * FA[0] + qy * FA[1] + qz * FA[2]) / E[1], c = (qx * FR[0] + qy * FR[1] + qz * FR[2]) / E[2];
      const n = [FW[0] * a + FA[0] * b + FR[0] * c, FW[1] * a + FA[1] * b + FR[1] * c, FW[2] * a + FA[2] * b + FR[2] * c];
      const nl = Math.hypot(...n) || 1, vl = Math.hypot(x, y, z) || 1, nv = 1 - Math.abs((n[0] * x + n[1] * y + n[2] * z) / (nl * vl));
      w *= 0.12 + 0.88 * nv * nv;
    }
    ts.push(t); ws.push(w); ls.push(data[o + 3]);
  }
  if (!ts.length) return 0;
  const tMin = Math.min(...ts), front = HEART_PICK.front * MM, score = new Map();
  let total = 0;
  for (let i = 0; i < ts.length; i++) {
    const w = ws[i] * Math.exp(-(ts[i] - tMin) / front);
    total += w;
    score.set(ls[i], (score.get(ls[i]) || 0) + w);
  }
  if (total < HEART_PICK.minWeight) return 0;
  let best = 0, bestW = 0;
  for (const [id, w] of score) if (w > bestW && id > 0) { best = id; bestW = w; }
  return Math.round(best);
}

// The tooltip and the section button (the button sits in the simple HUD's corner, when there is one).
export class HeartUi {
  constructor(doc, { onSection = null } = {}) {
    this.doc = doc;
    const tip = doc.createElement('div');
    tip.id = 'heart-label';
    tip.className = 'heart-label';
    tip.setAttribute('aria-hidden', 'true');   // a pointer aid; the structure names are in the About notes
    tip.hidden = true;
    doc.body.appendChild(tip);
    this.tip = tip;
    this.btn = null;
    const corner = doc.querySelector('.shud-corner');
    if (corner) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.id = 'heart-section-btn';
      b.className = 'shud-icon heart-section-btn';
      b.hidden = true;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Open the heart');
      b.title = 'Open the heart (C)';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z"/><path d="M12 4v17.5" stroke-dasharray="2 2.2"/></svg>';
      b.addEventListener('click', () => onSection?.());
      corner.insertBefore(b, corner.firstChild);
      this.btn = b;
    }
  }
  // The button shows while the heart is in focus.
  setAvailable(on) { if (this.btn && this.btn.hidden === !!on) this.btn.hidden = !on; }
  setSection(on) {
    const b = this.btn, v = String(!!on);
    if (!b || b.getAttribute('aria-pressed') === v) return;
    b.setAttribute('aria-pressed', v);
    b.setAttribute('aria-label', on ? 'Close the heart' : 'Open the heart');
    b.title = on ? 'Close the heart (C)' : 'Open the heart (C)';
  }
  showLabel(text, x, y) {
    const t = this.tip;
    if (t.textContent !== text) t.textContent = text;
    t.hidden = false;
    const w = t.offsetWidth || 0, vw = this.doc.defaultView?.innerWidth ?? 1e9;
    const left = x + 16 + w > vw - 8 ? x - 12 - w : x + 16;
    t.style.transform = `translate(${Math.round(Math.max(8, left))}px, ${Math.round(y + 18)}px)`;
  }
  hideLabel() { if (!this.tip.hidden) this.tip.hidden = true; }
}
