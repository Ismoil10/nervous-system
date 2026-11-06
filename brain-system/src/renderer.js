// HDR render pipeline: background → neuron stars and the extra brain nuclei → body → dopamine
// system → lantern glows → bloom (dual filter) → ACES tonemapping. Everything is additive light;
// nothing is opaque. Per-region state comes from the uState data texture (statetex.js); with the
// frame object of the first build (region, tint, da, pathHist arrays) the renderer composes it itself.

import { createProgram, createInterleavedVAO, deleteVAO, createTarget, deleteTarget, readPixelsAsync } from './gl-utils.js';
import * as S from './shaders.js';
import { StateTextures } from './statetex.js';
import { cctDuvRGB } from './color.js';
import { MM } from './anatomy.js';
import { HEART_LOD, PART as HPART } from './body/heart-form.js';

const LAYOUT = [{ loc: 0, size: 4 }, { loc: 1, size: 4 }, { loc: 2, size: 4 }];
const BODY_LAYOUT = [{ loc: 0, size: 4 }, { loc: 1, size: 4 }, { loc: 2, size: 4 }, { loc: 3, size: 4 }];
const REF = { neurons: 240000, axon: 16000, vari: 11000 };
const PREV_UNIT = 7;   // cross-fade source (units 2–6 hold the state textures)
const BONE = 3;        // tissue class index of the bone range (shaders.js TISSUE order)

// Body budgets per tissue class (order of shaders.js TISSUE): skin, organ, muscle, bone, cord,
// nerve, ganglion (autonomic chain, ganglia, splanchnic and vagal streams), enteric, vessel/immune.
export const PARAMS = {
  classRatio: [0.15, 0.38, 0.10, 0.08, 0.5, 0.30, 0.5, 0.2, 0.1],   // §13.3 flux × mean brain neuron-star flux
  classBudget: {                                                       // §13.4 points per tier
    low: [27000, 29333, 3000, 2250, 5000, 18000, 5000, 4000, 36000],
    medium: [48000, 58667, 6000, 4500, 10000, 36000, 10000, 8000, 72000],
    high: [78000, 96000, 10500, 7500, 15000, 60000, 16000, 14000, 120000],
    ultra: [120000, 154667, 15000, 10500, 22500, 90000, 24000, 20000, 192000],
  },
  refTier: 'high',          // B.5: per-class gains normalised to a reference tier, as REF above (renderer L56–60)
  tierExponent: 1,          // gain = (reference count / drawn count)^exponent, as the neuron and axon gains
  packetPool: { low: 128, medium: 192, high: 256, ultra: 256 },        // §13.4
  gammaBody: 1.0,           // §13.3 body zoom law (3.6/d)^γ_body
  brainBoost: 0.4,          // §13.3 brain flux factor 1 + 0.4·smoothstep(5, 8, d) …
  brainBoostD: [5, 8],      // … d in units (applied in proportion to the body fade)
  lodSpanPx: 150,           // §13.4 brain prefix when the brain spans < 150 px …
  lodFraction: 0.45,        // … draw 45 % of the shuffled neuron buffer, flux × 1/0.45
  brainLengthMm: 172,       // §13.11: 914 px at 3.6 units on a 1,080-px canvas (19.15/d px/mm)
  ghost: 0.08,              // §13.10, A.5 ghost flux
  fade: 0.8,                // A.5 display cross-fade and body fade-in (s tS, B.9)
  crossFade: 0.3,           // §13.11 reduced-motion camera cut
  twinkle: 0.10,            // §13.8 per-star twinkle ±10 % in shimmer
  reducedTwinkle: 0.5,      // §13.15 halved under reduced motion
  skinDim: [-0.10, 0.15],   // §13.7 distal skin: dilation ≤ +10 %, constriction dimming ≤ 15 %
  palette: {                // §13.5 [CCT K, Duv]
    afferent: [13000, 0], somEff: [6000, 0], symp: [10000, -0.020], para: [6000, 0.0125],
    enteric: [8500, 0.020], endocrine: [5500, -0.0175], immune: [13000, 0.015], structural: [7500, 0],
  },
  // B.7 display bits → palette role (visceral afferents use the afferent colour, §13.5) and switch (A.3.1).
  netRole: ['afferent', 'somEff', 'symp', 'para', 'afferent', 'enteric', 'endocrine', 'immune'],
  netSwitch: ['somatic', 'somatic', 'autonomic', 'autonomic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune'],
  monitorEvery: 6,          // [model] luminance-monitor readback every n frames
  // Body star styles of the simple HUD (user decision, 6 November 2026) [model]. Detailed draws every
  // generated star, sharper (point size × `size`), at `keep` × `boost` of the per-star flux: a class
  // carries `boost` × its earlier light, spread over 1 / keep × more stars. The skin is lifted most so
  // the silhouette reads as a dense surface of fine stars, and the nervous system (cord, nerves,
  // ganglia, enteric mesh) stands out with its travelling signals [browser check]. Stars draws a
  // random `keep` share of each class at full per-star flux: the earlier budgets (before the dense
  // model) and so the earlier look. Classes in TISSUE order.
  // The heart has its own share of the organ budget (HEART.md §6): `keep[1]` is the share of the
  // other organ stars (their earlier 17,600 of the 56,400 now at High, the lungs' third included,
  // LUNGS.md §7.1) and `keepHeart` that of the
  // heart (its earlier 2,400 of 39,600); in Detailed the heart's stars carry `heartGain` × the organ
  // star flux. The vascular tree (PULSE.md §9) is drawn in Detailed only (`keepTree` in Stars), and
  // there it replaces the earlier great-vessel stars; `keep[8]` is the share of the earlier vessel,
  // haze and immune stars (their earlier 5,000 of 7,500 at High).
  style: {
    keep: [1 / 3, 17600 / 56400, 2 / 3, 2 / 3, 2 / 5, 1 / 3, 1 / 2, 1 / 2, 2 / 3],
    keepHeart: 2400 / 39600,
    keepTree: 0,
    boost: [3.4, 1.6, 1.2, 1.2, 1.6, 2.0, 1.6, 1.4, 1.2],
    heartGain: 0.8,
    size: 0.8,
  },
};

export const PROGRAMS = {
  neuron: [S.NEURON_VS, S.STAR_FS],
  da: [S.DA_VS, S.STAR_FS],
  body: [S.BODY_VS, S.STAR_FS],
  lantern: [S.LANTERN_VS, S.LANTERN_FS],
  bg: [S.FULLSCREEN_VS, S.BG_FS],
  down: [S.FULLSCREEN_VS, S.DOWN_FS],
  up: [S.FULLSCREEN_VS, S.UP_FS],
  composite: [S.FULLSCREEN_VS, S.COMPOSITE_FS],
};

const RANGE_ALIASES = [
  ['skin'], ['organ', 'organs'], ['muscle', 'muscles'], ['bone', 'bones', 'skeleton'], ['cord', 'spinalCord'],
  ['nerve', 'nerves'], ['ganglion', 'ganglia', 'autonomic'], ['enteric', 'ens'], ['vessel', 'vessels', 'vascular', 'immune', 'blood'],
];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const toward = (x, target, step) => (x < target ? Math.min(target, x + step) : Math.max(target, x - step));
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1);

// Per-class [start, count] of a body buffer: from `ranges` (array by class or object by name), or
// from contiguous runs of the class id; null when the classes are interleaved.
export function bodyRanges(ranges, pts, count) {
  const out = new Array(9).fill(null);
  const pair = (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? [v[0], v[1]] : v && 'start' in v ? [v.start, v.count] : null);
  if (Array.isArray(ranges) && ranges.length >= 9 && ranges.every((v) => !v || pair(v))) {
    for (let c = 0; c < 9; c++) out[c] = pair(ranges[c]);
    return out;
  }
  if (ranges && typeof ranges === 'object' && !Array.isArray(ranges)) {
    let found = false;
    RANGE_ALIASES.forEach((names, c) => {
      for (const k of names) if (ranges[k]) { out[c] = pair(ranges[k]); found = true; break; }
    });
    if (found) return out;
  }
  let prev = -1;
  for (let i = 0; i < count; i++) {
    const c = clamp(Math.round(pts[i * 16 + 11]), 0, 8);
    if (c !== prev) {
      if (out[c]) return null;   // a class reappears: interleaved
      out[c] = [i, 0];
      prev = c;
    }
    out[c][1]++;
  }
  return out;
}

export class BrainRenderer {
  constructor(gl, hdr, brain, { body = null, statetex = null, safetyMonitor } = {}) {
    this.gl = gl;
    this.hdr = hdr;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    this.maxPoint = Math.min(range[1], 1024);
    this.progs = {};
    for (const [name, [vs, fs]] of Object.entries(PROGRAMS)) {
      if (name !== 'body') { this.progs[name] = createProgram(gl, vs, fs, name); continue; }
      // The body pass is optional: a failure leaves the brain-only renderer working.
      try { this.progs.body = createProgram(gl, vs, fs, 'body'); } catch (err) { console.warn('[brain] body shader disabled:', err.message); this.progs.body = null; }
    }
    this.state = statetex || new StateTextures(gl);
    this.emptyVAO = gl.createVertexArray();
    this.scene = null;
    this.prev = null;
    this.bloom = [];
    this.width = 0;
    this.height = 0;
    this.tier = null;
    this.counts = null;

    // Body display state.
    this.body = null;
    this.bodyVAO = null;
    this.bodyFade = 0;
    this.bodyFadeTarget = 0;
    this.bodyFadeRate = 1 / PARAMS.fade;
    this.netTarget = new Float32Array(8).fill(1);
    this.netGain = new Float32Array(8).fill(1);
    this.netRate = (1 - PARAMS.ghost) / PARAMS.fade;
    this.organs = new Float32Array(4 * 2 * S.ORGAN_SLOTS);
    this.detailed = false;    // body star style: Detailed (dense, sharp, anatomical colours) or Stars (PARAMS.style)
    this.keep = new Float32Array(12);   // per class: share of the stars drawn (BODY_VS uKeep)
    this.styleGain = new Float32Array(12);
    this.drawGain = new Float32Array(12);   // class gains as drawn (× styleGain in Detailed)
    // Heart beat (heart.js, BODY_VS uHeart*): timing, motion and wave, mode. Idle: a steady gain of 1.
    this.heartT = new Float32Array(4);
    this.heartM = new Float32Array(4);
    this.heartK = new Float32Array([0, 1, 1, 0]);
    this.heartV = new Float32Array([1, 0, 1, 0]);
    // Arterial pulse (pulse.js, BODY_VS uPulse): reduced time, amplitude G (0 = off), and the mean
    // brightening of the tree and of the earlier great arteries; the drawn style picks its mean.
    this.pulse = new Float32Array(4);
    this.pulseIn = new Float32Array(4);
    // Breathing (breath.js, BODY_VS uBreath/uAir, LUNGS.md §7.3–7.4): diaphragm excursion and rib-cage
    // expansion (units), Lungs view focus; airflow front (L), gain, mean gain, on.
    this.breath = new Float32Array(4);
    this.air = new Float32Array(4);
    // Heart close-up (HEART.md §8.1): the extra heart stars and their VAO, drawn in Detailed while the
    // camera is near the heart; heartNear is the px/mm (1,080-px reference) at the heart's near side.
    this.heartClose = null;
    this.heartNear = 0;
    // Focus region (research/CLOSEUP.md §3): the close-up stars round the camera's pivot and their VAO,
    // with the body buffer's stars inside the sphere (the heart left out); main.js sets the fade-in
    // weight and the focus slab's strength.
    this.region = null;
    this.focusWeight = 0;
    this.focusSlab = 0;
    this.focusU = new Float32Array(8);
    this.waveO = new Float32Array(4);                  // dopamine wave origin; w = 1 while a wave runs
    this.waves = new Float32Array(4 * S.WAVE_SLOTS);   // radius, amplitude, width, push per slot
    this.joints = new Float32Array(4 * 2 * S.JOINT_SLOTS);
    for (let k = 0; k < S.JOINT_SLOTS; k++) this.joints[k * 8 + 3] = 1;
    this.skinDim = 0;
    this.skeleton = true;   // Views "Skeleton" toggle (§13.13; main.js starts it off)
    this.motion = true;
    this.reducedMotion = false;
    this.senseFull = false;
    this.classGain = new Float32Array(12);
    this.classNorm = new Float32Array(12).fill(1);
    const rgb = (k) => cctDuvRGB(...PARAMS.palette[k]);
    this.netRGB = Float32Array.from(PARAMS.netRole.flatMap(rgb));
    this.structRGB = Float32Array.from(rgb('structural'));
    this.affRGB = Float32Array.from(rgb('afferent'));

    this.xfade = null;
    this.monitorOn = safetyMonitor ?? (typeof location !== 'undefined' && new URLSearchParams(location.search).get('safetyMonitor') === '1');
    this.luminance = null;
    this._monFrame = 0;
    this._monBusy = false;
    this._lastT = 0;
    this.replaceBrain(brain);
    if (body) this.replaceBody(body);
  }

  // A higher quality tier than the one generated for regenerates the populations. `extra` is the
  // separate buffer of new brain nuclei (12-float records like the neurons, B.5), drawn with the
  // neuron program; `brain.areas` / `extra.areas` are the area attributes (Uint8Array, 255 = none).
  replaceBrain(brain, extra = brain.extra) {
    const gl = this.gl;
    for (const v of [this.neuronVAO, this.extraVAO, this.daVAO, this.lanternVAO]) deleteVAO(gl, v);
    this.brain = brain;
    const n = brain.neuronCount;
    const areaOf = (a, count) => (a && a.length >= count ? a.subarray(0, count) : new Uint8Array(count).fill(255));
    const area = { loc: 3, size: 1, type: 'u8', int: true };
    this.neuronVAO = createInterleavedVAO(gl, brain.neurons.subarray(0, n * 12), [...LAYOUT, { ...area, data: areaOf(brain.areas, n) }]);
    this.extra = null;
    this.extraVAO = null;
    if (extra) {
      const data = ArrayBuffer.isView(extra) ? extra : extra.points || extra.neurons || extra.data;
      const count = Math.floor(ArrayBuffer.isView(extra) ? extra.length / 12 : extra.count ?? extra.neuronCount ?? data.length / 12);
      if (data && count > 0) {
        this.extra = { count };
        this.extraVAO = createInterleavedVAO(gl, data.subarray(0, count * 12), [...LAYOUT, { ...area, data: areaOf(extra.areas, count) }]);
      }
    }
    this.daVAO = createInterleavedVAO(gl, brain.da, LAYOUT);
    this.lanternVAO = createInterleavedVAO(gl, brain.lanterns, LAYOUT);
    // Mean neuron-star flux: the unit of the body flux ratios (§13.3).
    let sum = 0, k = 0;
    for (let i = 0; i < n; i += 7, k++) sum += brain.neurons[i * 12 + 3];
    this.meanFlux = k ? sum / k : 1;
    this._updateCounts();
  }

  // Body point buffer (B.7: 16 floats per point) from generateBody, or null for brain only.
  replaceBody(body) {
    const gl = this.gl;
    deleteVAO(gl, this.bodyVAO);
    this.bodyVAO = null;
    this.body = null;
    if (!body || !this.progs.body) { this._updateCounts(); return; }
    const pts = ArrayBuffer.isView(body) ? body : body.points || body.data;
    const count = Math.floor(ArrayBuffer.isView(body) ? body.length / 16 : body.count ?? (pts ? pts.length / 16 : 0));
    if (!pts || count <= 0) { this._updateCounts(); return; }
    this.bodyVAO = createInterleavedVAO(gl, pts.subarray(0, count * 16), BODY_LAYOUT);
    const ranges = bodyRanges(body.ranges, pts, count);
    // Mean flux per class, so the class ratios hold whatever flux scale the generator used.
    const sum = new Float64Array(9), num = new Float64Array(9);
    let heart = 0, heartEarlier = 0;   // heart stars, and those of the parts the Stars style draws (no fine anatomy)
    for (let i = 0; i < count; i++) {
      const c = clamp(Math.round(pts[i * 16 + 11]), 0, 8);
      sum[c] += pts[i * 16 + 3];
      num[c]++;
      const part = c === 1 ? Math.round(pts[i * 16 + 5]) : 0;
      if (part > 0) { heart++; if (part < HPART.TRABECULA) heartEarlier++; }
    }
    for (let c = 0; c < 9; c++) this.classNorm[c] = num[c] && sum[c] > 0 ? num[c] / sum[c] : 1;
    this.body = { count, ranges, classCount: Array.from(num), heart, heartEarlier };
    this._updateCounts();
  }

  // Close-up heart stars (generate.js generateHeartCloseUp: 16 floats per point), or null.
  setHeartCloseUp(closeUp) {
    const gl = this.gl;
    if (this.heartClose) deleteVAO(gl, this.heartClose.vao);
    this.heartClose = null;
    const count = closeUp ? Math.floor(closeUp.count ?? closeUp.points.length / 16) : 0;
    if (!closeUp || !(count + (closeUp.sectionCount ?? 0)) || !this.progs.body) return;
    const section = Math.max(0, Math.floor(closeUp.sectionCount ?? 0)), total = count + section;
    this.heartClose = { count, section, vao: createInterleavedVAO(gl, closeUp.points.subarray(0, total * 16), BODY_LAYOUT) };
  }

  // Focus region stars (generate.js generateFocusRegionChunks) and the body buffer's star count in
  // the same sphere, or null.
  setFocusRegion(region, baseCount = 0) {
    const gl = this.gl;
    if (this.region) deleteVAO(gl, this.region.vao);
    this.region = null;
    if (!region || !region.count || !(baseCount > 0) || !this.progs.body) return;
    this.region = { count: region.count, base: baseCount, c: region.centre.map((v) => v * MM), r: region.radius * MM,
      vao: createInterleavedVAO(gl, region.points.subarray(0, region.count * 16), BODY_LAYOUT) };
  }

  // Fade the body in or out (screen time; 0.8 s by default, B.9). Draw calls stop at 0.
  setBodyFade(target, duration = PARAMS.fade) {
    this.bodyFadeTarget = clamp(target, 0, 1);
    this.bodyFadeRate = duration > 0 ? 1 / duration : Infinity;
  }

  // Network switch display: cross-fade the network's bits to the 8 % desaturated ghost (A.5, §13.10).
  setNetwork(id, on, duration = PARAMS.fade) {
    PARAMS.netSwitch.forEach((net, i) => { if (net === id) this.netTarget[i] = on ? 1 : PARAMS.ghost; });
    this.netRate = (1 - PARAMS.ghost) / Math.max(1e-3, duration);
  }

  // Direct display gains per bit (8 values in 0.08–1), e.g. driven by the kernel's g.<net> ramps.
  setNetworkGains(gains) { this.netTarget.set(gains); this.netGain.set(gains); }

  // Heart beat state from heart.js (HeartBeat.uniforms): [T, PR, QRS, P], [atrial, ventricular,
  // root pulse, mean wave gain], [beat mode, steady gain, motion, Heart view focus], [AV valves open,
  // semilunar valves open, diastole].
  setHeart(t, m, k, v) { this.heartT.set(t); this.heartM.set(m); this.heartK.set(k); if (v) this.heartV.set(v); }

  // Arterial pulse from pulse.js (PulseWave.uniforms): [reduced time (s), amplitude G, mean of the
  // tree, mean of the earlier great arteries] (PULSE.md §8).
  setPulse(p) { this.pulseIn.set(p); }

  // Breathing from breath.js (LUNGS.md §7.3, §14.3): diaphragm excursion and rib-cage expansion as
  // drawn (mm), the Lungs view focus 0–1, and the air particles' displacement along their branches.
  setBreath({ excursionMm = 0, ribMm = 0, focus = 0, flow = 0 } = {}) {
    this.breath.set([excursionMm * MM, ribMm * MM, focus, 0]);
    this.air.set([flow, 1, 0, 0]);
  }

  // Dopamine waves (display only): origin [x, y, z] in mm and ≤ WAVE_SLOTS { radiusMm, amp, widthMm,
  // pushMm }; an empty list switches them off.
  setWaves(originMm, list = []) {
    const w = this.waves;
    w.fill(0);
    list.slice(0, S.WAVE_SLOTS).forEach((x, k) => w.set([x.radiusMm * MM, Math.max(0, x.amp), Math.max(1e-3, x.widthMm * MM), (x.pushMm ?? 0) * MM], k * 4));
    const on = list.some((x) => x.amp > 0);
    this.waveO.set(originMm ? [originMm[0] * MM, originMm[1] * MM, originMm[2] * MM, on ? 1 : 0] : [0, 0, 0, 0]);
  }

  // Organ geometry responses (§13.7), ≤ 8: { nodeId, centre: [x, y, z] mm, mode: 'scale' | 'shiftZ' |
  // 'iris', value (scale factor | shift mm), rest, inner, outer (iris radii mm) }.
  setOrgans(list = []) {
    const o = this.organs;
    o.fill(0);
    const modes = { scale: 1, shiftZ: 2, iris: 3 };
    list.slice(0, S.ORGAN_SLOTS).forEach((g, k) => {
      const c = g.centre || [0, 0, 0];
      o.set([g.nodeId, c[0] * MM, c[1] * MM, c[2] * MM], k * 8);
      const m = modes[g.mode] || 0;
      if (m === 1) o.set([1, g.value ?? 1, 0, 0], k * 8 + 4);
      else if (m === 2) o.set([2, (g.value ?? 0) * MM, 0, 0], k * 8 + 4);
      else if (m === 3) o.set([3, g.rest * MM, g.inner * MM, g.outer * MM], k * 8 + 4);
    });
  }

  // Rigid segment transform (§13.9): rotation q = [x, y, z, w] about a pivot (mm) plus an offset (mm).
  setJoint(seg, q, pivot, offset = [0, 0, 0]) {
    if (seg < 0 || seg >= S.JOINT_SLOTS) return;
    const [x, y, z, w] = q;
    const p = pivot.map((v) => v * MM);
    // v' = q·v·q⁻¹ for the pivot, so that p' = R·p + (pivot − R·pivot + offset).
    const tx = 2 * (y * p[2] - z * p[1]), ty = 2 * (z * p[0] - x * p[2]), tz = 2 * (x * p[1] - y * p[0]);
    const rp = [p[0] + w * tx + (y * tz - z * ty), p[1] + w * ty + (z * tx - x * tz), p[2] + w * tz + (x * ty - y * tx)];
    this.joints.set([x, y, z, w, p[0] - rp[0] + offset[0] * MM, p[1] - rp[1] + offset[1] * MM, p[2] - rp[2] + offset[2] * MM, 0], seg * 8);
  }

  setJoints(data) { this.joints.set(data.subarray ? data.subarray(0, this.joints.length) : data.slice(0, this.joints.length)); }
  setSkinDim(x) { this.skinDim = clamp(x, PARAMS.skinDim[0], PARAMS.skinDim[1]); }
  // Views "Skeleton" toggle (§13.13, off by default; §13.15 ribs only as irregular hints): the bone
  // class range is drawn only while it is on.
  setSkeleton(on) { this.skeleton = !!on; }
  setReducedMotion(on) { this.reducedMotion = !!on; this.motion = !on; }
  setLimbMotion(on) { this.motion = !!on && !this.reducedMotion; }
  setSenseOrgansFull(on) { this.senseFull = !!on; }

  // Cross-fade from the last frame over `seconds` (camera cut under reduced motion, §13.11).
  crossFade(seconds = PARAMS.crossFade) { if (this.scene) this.xfade = { t: 0, dur: Math.max(1e-3, seconds), pending: true }; }

  enableLuminanceMonitor(on) { this.monitorOn = !!on; if (!on) this.luminance = null; }

  // Quality tier: draw a prefix of each (shuffled or interleaved) range. Fewer points drawn means
  // each one is brighter, so surface brightness does not depend on the tier.
  setTier(tier) {
    this.tier = tier;
    this._updateCounts();
    this.state.setPacketPool(tier.packets ?? PARAMS.packetPool[tier.name] ?? 256);
    this.bloomLevels = tier.bloomLevels;
    this._allocBloom();
  }

  _updateCounts() {
    const tier = this.tier;
    if (!tier || !this.brain) return;
    const b = this.brain, r = b.daRanges;
    this.counts = {
      neurons: Math.min(b.neuronCount, tier.neurons),
      extra: this.extra ? Math.min(this.extra.count, tier.extra ?? this.extra.count) : 0,
      axon: Math.min(r.axon[1], tier.axon),
      vari: Math.min(r.vari[1], tier.vari),
      bodyClass: new Array(9).fill(0),
      body: 0,
    };
    this.gains = {
      neuron: REF.neurons / Math.max(1, this.counts.neurons),
      axon: REF.axon / Math.max(1, this.counts.axon),
      vari: Math.sqrt(REF.vari / Math.max(1, this.counts.vari)),
    };
    const body = this.body;
    if (!body) return;
    const budget = PARAMS.classBudget[tier.name];
    const scale = budget && tier.body ? tier.body / budget.reduce((s, v) => s + v, 0) : 1;
    const ref = PARAMS.classBudget[PARAMS.refTier];
    let total = 0;
    for (let c = 0; c < 9; c++) {
      const have = body.ranges ? (body.ranges[c] ? body.ranges[c][1] : 0) : body.classCount[c];
      const drawn = budget ? Math.min(have, Math.round(budget[c] * scale)) : have;
      this.counts.bodyClass[c] = body.ranges ? drawn : have;
      total += this.counts.bodyClass[c];
      this.classGain[c] = PARAMS.classRatio[c] * this.meanFlux * Math.pow(ref[c] / Math.max(1, drawn), PARAMS.tierExponent);
      this.styleGain[c] = PARAMS.style.keep[c] * PARAMS.style.boost[c];
    }
    this.counts.body = body.ranges ? total : body.count;
  }

  resize(width, height, scale) {
    const w = Math.max(16, Math.round(width * scale));
    const h = Math.max(16, Math.round(height * scale));
    if (w === this.width && h === this.height && this.scene) return;
    this.width = w;
    this.height = h;
    deleteTarget(this.gl, this.scene);
    deleteTarget(this.gl, this.prev);
    this.prev = null;
    this.xfade = null;
    this.scene = createTarget(this.gl, w, h, this.hdr);
    this._allocBloom();
  }

  _allocBloom() {
    const gl = this.gl;
    for (const t of this.bloom) deleteTarget(gl, t);
    this.bloom = [];
    if (!this.width) return;
    let w = this.width, h = this.height;
    for (let i = 0; i < (this.bloomLevels || 5); i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      if (w < 4 || h < 4) break;
      this.bloom.push(createTarget(gl, w, h, this.hdr));
    }
  }

  get bodyVisible() { return !!(this.body && this.bodyVAO && this.bodyFade > 0); }
  get extraPoints() { return this.counts ? this.counts.extra : 0; }
  get bodyPoints() {
    if (!this.counts || !this.bodyVisible) return 0;
    return this.counts.body - (this.skeleton || !this.body.ranges ? 0 : this.counts.bodyClass[BONE]);
  }
  get pointCount() {
    const c = this.counts;
    return c ? c.neurons + c.extra + c.axon + c.vari + this.bodyPoints : 0;
  }

  _common(p, f) {
    const gl = this.gl, u = p.uniforms;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.uView, false, f.view);
    gl.uniformMatrix4fv(u.uProj, false, f.proj);
    gl.uniform3fv(u.uEye, f.eye);
    gl.uniform1f(u.uPx, this.height / 1080);
    gl.uniform1f(u.uPxScale, (this.height / 2) / Math.tan(f.fov / 2));
    gl.uniform1f(u.uMaxPt, this.maxPoint);
    gl.uniform1f(u.uT, f.t);
    gl.uniform1f(u.uCut, f.cut);
    gl.uniform1f(u.uLambda, f.lambda);
    gl.uniform3fv(u.uAmber, f.amber);
  }

  _advance(dt) {
    if (this.bodyFade !== this.bodyFadeTarget) {
      this.bodyFade = this.bodyFadeRate === Infinity ? this.bodyFadeTarget : toward(this.bodyFade, this.bodyFadeTarget, dt * this.bodyFadeRate);
    }
    for (let i = 0; i < 8; i++) this.netGain[i] = toward(this.netGain[i], this.netTarget[i], dt * this.netRate);
    if (this.xfade && !this.xfade.pending) this.xfade.t += dt;
  }

  // Frame object: camera (view, proj, eye, fov, zoom, optional distance), t, cut, shell, deep, back,
  // lambda, colours, tune, exposure, bloomStrength; dt (screen s) for fades. Either `statetex`
  // (composed and uploaded by the caller, B.6) or the dopamine arrays (region, tint, da, pathHist)
  // or `dopamine`, with optional `brainnet`, `kernel`, `packets`.
  render(f) {
    const gl = this.gl, c = this.counts, P = this.progs, r = this.brain.daRanges;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const dt = f.dt ?? (this._lastT ? Math.min(0.1, (now - this._lastT) / 1000) : 0);
    this._lastT = now;
    this._advance(dt);
    const bodyOn = this.bodyVisible;
    const st = f.statetex || this.state;
    if (!f.statetex) {
      st.compose({ dopamine: f.dopamine || f, brainnet: f.brainnet, kernel: f.kernel, packets: f.packets, dtS: dt });
      st.upload({ body: bodyOn });
    }
    const dist = f.distance ?? 3.6 / Math.sqrt(Math.max(1e-9, f.zoom));

    if (this.xfade && this.xfade.pending) this._snapshot();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.useProgram(P.bg.program);
    gl.uniform1f(P.bg.uniforms.uAspect, this.width / this.height);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // 1. Neurons: cool-white stars, tinted warm where dopamine bathes them. With the body shown the
    // brain gains up to +40 % at body distances, and a small brain draws a 45 % prefix (§13.3, §13.4).
    this._common(P.neuron, f);
    st.bind(P.neuron);
    let u = P.neuron.uniforms;
    const boost = 1 + PARAMS.brainBoost * smoothstep(PARAMS.brainBoostD[0], PARAMS.brainBoostD[1], dist) * (bodyOn ? this.bodyFade : 0);
    let nNeurons = c.neurons, lodGain = 1;
    if (bodyOn) {
      const span = PARAMS.brainLengthMm * MM * (gl.drawingBufferHeight / 2) / Math.tan(f.fov / 2) / dist;
      if (span < PARAMS.lodSpanPx) { nNeurons = Math.max(1, Math.round(c.neurons * PARAMS.lodFraction)); lodGain = c.neurons / nNeurons; }
    }
    gl.uniform1f(u.uGain, f.tune.neurons * this.gains.neuron * boost * lodGain);
    gl.uniform1f(u.uZoom, f.zoom);
    gl.uniform1f(u.uShell, f.shell);
    gl.uniform1f(u.uDeep, f.deep);
    gl.uniform1f(u.uBack, f.back);
    gl.uniform1f(u.uDaGain, f.tune.bathing);
    gl.uniform3fv(u.uCool, f.cool);
    gl.uniform3fv(u.uWarm, f.warm);
    gl.uniform4fv(u.uWaveO, this.waveO);
    gl.uniform4fv(u.uWave, this.waves);
    gl.bindVertexArray(this.neuronVAO.vao);
    gl.drawArrays(gl.POINTS, 0, nNeurons);
    // New brain nuclei (§3): floor-stratified buffer, same per-star gain as the neurons.
    if (this.extraVAO && c.extra > 0) {
      gl.uniform1f(u.uGain, f.tune.neurons * this.gains.neuron * boost);
      gl.bindVertexArray(this.extraVAO.vao);
      gl.drawArrays(gl.POINTS, 0, c.extra);
    }

    // 2. Body (if visible), one draw per tissue-class prefix.
    if (bodyOn) this._drawBody(f, st, dist);

    // 3. Dopamine system: cell bodies, axon bundles with travelling packets, release sparks.
    this._common(P.da, f);
    st.bind(P.da);
    u = P.da.uniforms;
    gl.uniform1f(u.uZoom, f.zoom);
    gl.uniform3fv(u.uFibre, f.fibre);
    gl.uniform4fv(u.uWaveO, this.waveO);
    gl.uniform4fv(u.uWave, this.waves);
    gl.bindVertexArray(this.daVAO.vao);
    gl.uniform1f(u.uGain, f.tune.somata);
    gl.drawArrays(gl.POINTS, r.soma[0], r.soma[1]);
    gl.uniform1f(u.uGain, f.tune.axons * this.gains.axon);
    gl.drawArrays(gl.POINTS, r.axon[0], c.axon);
    gl.uniform1f(u.uGain, f.tune.release * this.gains.vari);
    gl.drawArrays(gl.POINTS, r.vari[0], c.vari);

    // 4. Lantern glows of the terminal fields.
    this._common(P.lantern, f);
    st.bind(P.lantern);
    gl.uniform1f(P.lantern.uniforms.uGain, f.tune.lanterns);
    gl.bindVertexArray(this.lanternVAO.vao);
    gl.drawArrays(gl.POINTS, 0, this.brain.lanternCount);

    this._bloom();
    this._monitor(f);
    this._composite(f);
    gl.bindVertexArray(null);
  }

  _drawBody(f, st, dist) {
    const gl = this.gl, p = this.progs.body, u = p.uniforms, b = this.body, c = this.counts;
    this._common(p, f);
    st.bind(p);
    gl.uniform1f(u.uGain, f.tune.neurons * (f.tune.body ?? 1));
    gl.uniform1f(u.uZoom, Math.pow(Math.max(1e-9, f.zoom), PARAMS.gammaBody / 2));   // f.zoom is the brain law (3.6/d)²
    gl.uniform1f(u.uFade, this.bodyFade);
    gl.uniform1f(u.uDist, dist);
    gl.uniform1f(u.uPxMm, (540 / Math.tan(f.fov / 2)) * MM / dist);
    gl.uniform1f(u.uSenseFull, f.senseOrgans === 'full' || this.senseFull ? 1 : 0);
    gl.uniform1f(u.uSkinDim, this.skinDim);
    gl.uniform1f(u.uMotion, this.motion ? 1 : 0);
    gl.uniform1f(u.uTwinkle, PARAMS.twinkle * (this.reducedMotion ? PARAMS.reducedTwinkle : 1));
    const D = this.detailed, K = PARAMS.style;
    for (let k = 0; k < 9; k++) this.keep[k] = D ? 1 : K.keep[k];
    if (!this.skeleton) this.keep[BONE] = 0;   // the base bone range is skipped then; this hides the region's bone stars
    // uKeep[2].y: heart stars. Stars draws no fine anatomy (HEART.md §8.5), so its share of the rest
    // keeps the earlier count.
    this.keep[9] = D ? 1 : Math.min(1, K.keepHeart * (b.heart > 0 && b.heartEarlier > 0 ? b.heart / b.heartEarlier : 1));
    this.keep[10] = D ? K.heartGain : 1;         // uKeep[2].z: heart star flux relative to the organ class
    this.keep[11] = D ? 1 : K.keepTree;          // uKeep[2].w: vascular tree stars
    for (let k = 0; k < 12; k++) this.drawGain[k] = this.classGain[k] * (D ? this.styleGain[k] : 1);
    gl.uniform4fv(u.uClassGain, this.drawGain);
    gl.uniform4fv(u.uClassNorm, this.classNorm);
    gl.uniform4fv(u.uKeep, this.keep);
    gl.uniform2f(u.uStyle, D ? 1 : 0, D ? K.size : 1);
    gl.uniform4fv(u.uHeartT, this.heartT);
    gl.uniform4fv(u.uHeartM, this.heartM);
    gl.uniform4fv(u.uHeartK, this.heartK);
    gl.uniform4fv(u.uHeartV, this.heartV);
    const P = this.pulseIn;
    this.pulse[0] = P[0]; this.pulse[1] = P[1]; this.pulse[2] = P[1] * (D ? P[2] : P[3]);
    // uPulse.w: the heart's close-up density cap D_max = 1 + drawn close-up / drawn heart stars (§8.1).
    const hc = this.heartClose, organShare = Math.min(1, b.classCount[1] > 0 ? c.bodyClass[1] / b.classCount[1] : 1);
    const nClose = D && hc && b.heart > 0 && this.heartNear > HEART_LOD.q0 * 0.9 ? Math.round(hc.count * organShare) : 0;
    this.pulse[3] = nClose > 0 ? 1 + nClose / Math.max(1, b.heart * organShare) : 1;
    // uFocus (CLOSEUP.md §3): the region's centre and radius, D_max = 1 + drawn region / drawn body
    // stars in it, the fade-in weight and the slab's strength.
    let have = 0, drawn = 0;
    for (let k = 0; k < 9; k++) { have += b.classCount[k]; drawn += c.bodyClass[k]; }
    const rg = this.region, share = have > 0 ? Math.min(1, drawn / have) : 1;
    const nRegion = D && rg && this.focusWeight > 0 ? Math.round(rg.count * share) : 0;
    if (nRegion > 0) this.focusU.set([rg.c[0], rg.c[1], rg.c[2], rg.r, 1 + nRegion / Math.max(1, rg.base * share), this.focusWeight, D ? this.focusSlab : 0, 0]);
    else this.focusU.set([0, 0, 0, 0, 1, 0, D ? this.focusSlab : 0, 0]);
    gl.uniform4fv(u.uFocus, this.focusU);
    gl.uniform4fv(u.uPulse, this.pulse);
    gl.uniform4fv(u.uBreath, this.breath);
    gl.uniform4fv(u.uAir, this.air);
    gl.uniform4fv(u.uNetGain, this.netGain);
    gl.uniform3fv(u.uNetRGB, this.netRGB);
    gl.uniform3fv(u.uStructRGB, this.structRGB);
    gl.uniform3fv(u.uAffRGB, this.affRGB);
    gl.uniform4fv(u.uOrgan, this.organs);
    gl.uniform4fv(u.uJoint, this.joints);
    gl.bindVertexArray(this.bodyVAO.vao);
    if (!b.ranges) gl.drawArrays(gl.POINTS, 0, b.count);
    else {
      for (let k = 0; k < 9; k++) {
        if (k === BONE && !this.skeleton) continue;
        if (b.ranges[k] && c.bodyClass[k] > 0) gl.drawArrays(gl.POINTS, b.ranges[k][0], c.bodyClass[k]);
      }
    }
    if (nClose > 0) { gl.bindVertexArray(hc.vao.vao); gl.drawArrays(gl.POINTS, 0, nClose); }
    if (nRegion > 0) { gl.bindVertexArray(rg.vao.vao); gl.drawArrays(gl.POINTS, 0, nRegion); }
    // The cut face (HEART.md §8.4) while the heart is open.
    if (D && hc && hc.section > 0 && this.heartV[3] > 0) {
      gl.bindVertexArray(hc.vao.vao);
      gl.drawArrays(gl.POINTS, hc.count, Math.round(hc.section * organShare));
    }
  }

  // Copy of the last scene for the cross-fade.
  _snapshot() {
    const gl = this.gl;
    if (!this.prev) this.prev = createTarget(gl, this.width, this.height, this.hdr);
    if (this.prev) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.scene.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.prev.fbo);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    this.xfade.pending = false;
    if (!this.prev) this.xfade = null;
  }

  // Asynchronous readback of the smallest bloom level as display relative luminance (0–1), for the
  // photosensitivity audit (`?safetyMonitor=1`, B.5).
  _monitor(f) {
    if (!this.monitorOn || this._monBusy || !this.bloom.length) return;
    this._monFrame = (this._monFrame + 1) % PARAMS.monitorEvery;
    if (this._monFrame !== 0) return;
    const gl = this.gl, t = this.bloom[this.bloom.length - 1];
    if (this.hdr && !gl.getExtension('EXT_color_buffer_float')) { this.monitorOn = false; return; }
    const n = t.width * t.height;
    const dst = this.hdr ? new Float32Array(n * 4) : new Uint8Array(n * 4);
    const exposure = f.exposure;
    this._monBusy = true;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fbo);
    readPixelsAsync(gl, 0, 0, t.width, t.height, gl.RGBA, this.hdr ? gl.FLOAT : gl.UNSIGNED_BYTE, dst).then((px) => {
      const lum = new Float32Array(n);
      const k = this.hdr ? 1 : 1 / 255;
      for (let i = 0; i < n; i++) lum[i] = aces((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) * k * exposure);
      this.luminance = { data: lum, width: t.width, height: t.height };
      this._monBusy = false;
    }, () => { this._monBusy = false; this.monitorOn = false; });
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }

  _bloom() {
    const gl = this.gl, P = this.progs;
    if (!this.bloom.length) return;
    gl.bindVertexArray(this.emptyVAO);
    gl.disable(gl.BLEND);
    gl.useProgram(P.down.program);
    let src = this.scene;
    for (const dst of this.bloom) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.width, dst.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(P.down.uniforms.uSrc, 0);
      gl.uniform2f(P.down.uniforms.uTexel, 1 / src.width, 1 / src.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.up.program);
    gl.uniform1f(P.up.uniforms.uWeight, 1.0);
    for (let i = this.bloom.length - 1; i > 0; i--) {
      const s = this.bloom[i], d = this.bloom[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo);
      gl.viewport(0, 0, d.width, d.height);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform1i(P.up.uniforms.uSrc, 0);
      gl.uniform2f(P.up.uniforms.uTexel, 0.5 / s.width, 0.5 / s.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  _composite(f) {
    const gl = this.gl, P = this.progs;
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(P.composite.program);
    const u = P.composite.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom.length ? this.bloom[0].tex : this.scene.tex);
    gl.uniform1i(u.uBloom, 1);
    let mix = 1;
    if (this.xfade && this.prev) {
      mix = Math.min(1, this.xfade.t / this.xfade.dur);
      gl.activeTexture(gl.TEXTURE0 + PREV_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, this.prev.tex);
      gl.uniform1i(u.uPrev, PREV_UNIT);
      if (mix >= 1) this.xfade = null;
    } else {
      gl.uniform1i(u.uPrev, 0);
    }
    gl.uniform1f(u.uMix, mix);
    gl.uniform1f(u.uExposure, f.exposure);
    gl.uniform1f(u.uBloomStr, this.bloom.length ? f.bloomStrength / this.bloom.length : 0);
    gl.uniform1f(u.uTime, f.t);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}
