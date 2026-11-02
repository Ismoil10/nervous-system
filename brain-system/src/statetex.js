// Per-frame model state for the shaders as data textures (research/ANALYSIS.md §11.15, B.7).
// The vec4 uniform arrays of the first build (uRegion, uTint, uDA, uPathHist) cannot hold the
// ≈ 122 regions of A.3.3 within the 256 guaranteed vertex uniform vectors, so every per-region,
// per-node, per-path and per-packet value travels in float textures read with texelFetch.
//
//   uState (RGBA32F, W × 5)   column 2·r + s (s = 0 for x ≥ 0, 1 for x < 0; §11.15)
//     row 0  activity (dopamine.region[PARENT[r]] × BrainNet, 1 at rest), dopamine glow E, spread, modulator
//     row 1  modulator tint rgb, substitution amount m (§13.6; 0 keeps the additive DOPAMINE.md tint)
//     row 2  firing level ν/ν₀, spike phase, release phase, brain-systems overlay factor (1 = none)
//     row 3  pathway firing history, 4 samples per texel (PATH_HIST per pathway, newest first)
//     row 4  sided cortical area 2·area + s: activity (1 at rest), overlay factor
//   uBodyState (RGBA16F, 512 × n)  per body graph node: activity (1 at rest), ghost, response, network
//   uEdgeAct (RGBA32F, 64 × n)     per drawn path: ā, efference-only flag, ghost, packet run (16·first + count, −1 none)
//   uPackets (RGBA32F, 256 × 2)    row 0: pathId, uHead, σu, gain · row 1: fibre, direction (−1 afferent), age, efference only
//   uGut (RGBA16F, 256 × n)        per gut segment: contraction, slow-wave phase, excitability, bolus (rendering deferred to §8 phase 7)
//
// Assumption (B.4 is silent): the kernel hands display state over as `kernel.display = { nodes,
// paths, gut }` (Float32Array, 4 values per texel in the layout above) and `kernel.packets(out)`
// records { pathId, uHead, sigmaU, gain, fibre, dir }, where pathId is the body buffer's path id.

import * as A from './anatomy.js';
import { createDataTexture, updateDataTexture, deleteDataTexture } from './gl-utils.js';

export const BODY_TEX_W = 512;     // B.7
export const EDGE_TEX_W = 64;      // B.7
export const PACKET_CAP = 256;     // B.7; display pool per tier ≤ this (§13.4)
export const GUT_TEX_W = 256;      // B.7
export const STATE_ROWS = 5;
export const ROW = { REGION: 0, TINT: 1, DA: 2, PATH: 3, AREA: 4 };
// Texture units 0–1 belong to the bloom and composite passes.
export const UNITS = { uState: 2, uBodyState: 3, uEdgeAct: 4, uPackets: 5, uGut: 6 };
export const FIBRES = ['Ia', 'Ib', 'II', 'Abeta', 'Adelta', 'C', 'CT', 'Cmi', 'Agamma', 'Aalpha', 'B', 'Cpost', 'cns'];   // A.3.2

export const PARAMS = {
  packetPeak: 0.6,          // §13.8 peak gain: +60 % of the resting stream flux at a full volley, × tanh(volley size)
  classGain: { Ia: 1, Ib: 1, II: 1, Abeta: 1, Aalpha: 1, Adelta: 0.8, Agamma: 0.8, B: 0.7, C: 0.6, Cpost: 0.6, CT: 0.6, Cmi: 0.6, cns: 1 },   // §13.8 (cns tracts [model] 1)
  classSigma: { C: 1.5, Cpost: 1.5, CT: 1.5, Cmi: 1.5 },   // §13.8 C classes: σ × 1.5; others 1
  efferenceGain: 0.5,       // §13.8 efference-only packets: 50 % gain, desaturated
  perVertex: 8,             // §13.8 packets evaluated per vertex
  edgeTau: 0.3,             // §13.8 shimmer: ā low-passed with τ ≥ 0.3 s (tS)
  overlayFade: 0.8,         // §13.15 toggle and overlay fade (minimum, s tS)
  overlayMember: 1.6,       // §13.10 brain-systems overlay: member flux × 1.6
  overlayOther: 0.7,        // §13.10 non-member flux × 0.7
  areas: 64,                // ≥ the ≈ 46 cortical areas of A.3.3 (B.7); sided ids 2·area + s stay < 255
  bodyNodes: 1024,          // §11.15 (740 nodes, dynamic skin sites, 20 % margin)
  edges: 4096,              // §11.15 (≥ 2,660 edges)
  gutSegments: 256,         // B.7
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function countOf(x, fallback) {
  if (Array.isArray(x)) return x.length;
  if (x && typeof x === 'object') return Object.keys(x).length;
  return fallback;
}

// PARENT may be an index array or a map { id: parentId }; regions without a parent use their own channels.
function resolveParent(parent, regions) {
  const out = new Int32Array(regions);
  for (let r = 0; r < regions; r++) out[r] = r;
  if (!parent) return out;
  const idx = (v) => (typeof v === 'string' ? A.R[v] : v);
  if (Array.isArray(parent) || ArrayBuffer.isView(parent)) {
    for (let r = 0; r < Math.min(regions, parent.length); r++) {
      const p = idx(parent[r]);
      if (Number.isInteger(p) && p >= 0 && p < regions) out[r] = p;
    }
  } else {
    for (const [k, v] of Object.entries(parent)) {
      const r = idx(k), p = idx(v);
      if (Number.isInteger(r) && Number.isInteger(p) && r >= 0 && r < regions && p >= 0 && p < regions) out[r] = p;
    }
  }
  return out;
}

function resolveMidline(midline, regions) {
  const out = new Uint8Array(regions);
  if (!midline) return out;
  if (midline instanceof Uint8Array && midline.length === regions) return midline.slice();
  for (const v of midline) {
    const r = typeof v === 'string' ? A.R[v] : v;
    if (Number.isInteger(r) && r >= 0 && r < regions) out[r] = 1;
  }
  return out;
}

// Linear ramp between two factor vectors (toggle fades, §13.15).
class Ramp {
  constructor(n) { this.v = new Float32Array(n).fill(1); this.from = this.v.slice(); this.to = this.v.slice(); this.t = 1; this.dur = 1; }
  set(target, dur) {
    this.from.set(this.v);
    this.to.fill(1);
    if (target) this.to.set(target.subarray ? target.subarray(0, this.to.length) : target.slice(0, this.to.length));
    this.t = 0;
    this.dur = Math.max(1e-6, dur);
  }
  step(dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.dur);
    for (let i = 0; i < this.v.length; i++) this.v[i] = this.from[i] + (this.to[i] - this.from[i]) * this.t;
    return true;
  }
}

export class StateTextures {
  // gl may be null: the composition then runs on the CPU only (headless tests).
  constructor(gl, { regions = A.REGION_COUNT, areas = Math.max(PARAMS.areas, countOf(A.AREAS, 0)), bodyNodes = PARAMS.bodyNodes,
    edges = PARAMS.edges, packets = PACKET_CAP, gutSegments = PARAMS.gutSegments, parent = A.PARENT, midline = A.MIDLINE } = {}) {
    this.gl = gl;
    this.regions = regions;
    this.areas = areas;
    this.parent = resolveParent(parent, regions);
    this.midline = resolveMidline(midline, regions);
    const pathTexels = Math.ceil((A.PATHWAYS.length + 1) * 16 / 4);   // + 1: slMFB (DOPAMINE.md §7.6)
    this.width = 128 * Math.ceil(Math.max(2 * regions, 2 * areas, pathTexels, 1) / 128);
    this.nodeCap = BODY_TEX_W * Math.ceil(Math.max(1, bodyNodes) / BODY_TEX_W);
    this.pathCap = EDGE_TEX_W * Math.ceil(Math.max(1, edges) / EDGE_TEX_W);
    this.gutCap = GUT_TEX_W * Math.ceil(Math.max(1, gutSegments) / GUT_TEX_W);
    this.packetPool = Math.min(PACKET_CAP, packets);
    this.packetCount = 0;

    this.brainData = new Float32Array(this.width * STATE_ROWS * 4);
    this.bodyData = new Float32Array(this.nodeCap * 4);
    this.edgeData = new Float32Array(this.pathCap * 4);
    this.packetData = new Float32Array(PACKET_CAP * 2 * 4);
    this.gutData = new Float32Array(this.gutCap * 4);
    for (let i = 0; i < this.nodeCap; i++) this.bodyData.set([1, 1, 0, 0], i * 4);
    for (let i = 0; i < this.pathCap; i++) this.edgeData.set([0, 0, 1, -1], i * 4);
    this.pathAct = new Float32Array(this.pathCap);
    this.overlay = { region: new Ramp(2 * regions), area: new Ramp(2 * areas) };
    this._runs = [];                // paths whose packet run was written last frame
    this._pkOut = [];
    this._order = [];
    this._last = null;
    this.dirty = { body: true, edge: true, packet: true, gut: true };
    this._compose(null, null, 0);

    if (gl) {
      const mk = (width, height, internalFormat, data) => createDataTexture(gl, { width, height, internalFormat, data });
      this.tex = {
        uState: mk(this.width, STATE_ROWS, 'RGBA32F', this.brainData),
        uBodyState: mk(BODY_TEX_W, this.nodeCap / BODY_TEX_W, 'RGBA16F', this.bodyData),
        // RGBA32F rather than B.7's RGBA16F: the packet run index must be exact above 2,048.
        uEdgeAct: mk(EDGE_TEX_W, this.pathCap / EDGE_TEX_W, 'RGBA32F', this.edgeData),
        uPackets: mk(PACKET_CAP, 2, 'RGBA32F', this.packetData),
        uGut: mk(GUT_TEX_W, this.gutCap / GUT_TEX_W, 'RGBA16F', this.gutData),
      };
    }
  }

  // Visible packet pool of the current tier (§13.4).
  setPacketPool(n) { this.packetPool = clamp(Math.floor(n), 0, PACKET_CAP); }

  // Brain-systems overlay targets (display only, A.5): per region or per column, and per area or
  // per sided area; null restores 1. Fades over max(0.8 s, given duration) of screen time.
  setOverlay({ region = null, area = null } = {}, duration = PARAMS.overlayFade) {
    const dur = Math.max(PARAMS.overlayFade, duration);
    const sided = (src, n) => {
      if (!src) return null;
      if (src.length >= 2 * n) return Float32Array.from(src.slice(0, 2 * n));
      const out = new Float32Array(2 * n).fill(1);
      for (let i = 0; i < Math.min(n, src.length); i++) out[2 * i] = out[2 * i + 1] = src[i];
      return out;
    };
    this.overlay.region.set(sided(region, this.regions), dur);
    this.overlay.area.set(sided(area, this.areas), dur);
  }

  // Factor vectors for a set of member regions and areas (§13.10).
  overlayTargets({ regions = [], areas = [] } = {}) {
    const region = new Float32Array(this.regions).fill(PARAMS.overlayOther);
    const area = new Float32Array(this.areas).fill(PARAMS.overlayOther);
    for (const r of regions) { const i = typeof r === 'string' ? A.R[r] : r; if (i >= 0 && i < this.regions) region[i] = PARAMS.overlayMember; }
    for (const a of areas) if (a >= 0 && a < this.areas) area[a] = PARAMS.overlayMember;
    return { region, area };
  }

  // B.4: activity = dopamine.region[PARENT[r]·4] × brainnet.activity[r]. `dopamine` is anything
  // with the DopamineModel arrays (region, tint, da, pathHist), including the legacy frame object.
  compose({ dopamine = null, brainnet = null, kernel = null, packets = null, dtS } = {}) {
    let dt = dtS;
    if (dt === undefined) {
      const now = performance.now();
      dt = this._last === null ? 0 : Math.min(0.1, (now - this._last) / 1000);
      this._last = now;
    }
    this._compose(dopamine, brainnet, dt);
    this._composeBody(kernel, packets, dt);
  }

  _compose(dopamine, brainnet, dt) {
    const W = this.width, d = this.brainData, R = this.regions;
    this.overlay.region.step(dt);
    this.overlay.area.step(dt);
    const reg = dopamine && dopamine.region, tint = dopamine && dopamine.tint, da = dopamine && dopamine.da;
    const act = brainnet && brainnet.activity, sidedAct = !!act && act.length >= 2 * R;
    const bt = brainnet && brainnet.tint, sidedTint = !!bt && bt.length >= 8 * R;
    const ov = this.overlay.region.v;
    for (let r = 0; r < R; r++) {
      const pr = this.parent[r] * 4;
      const hasReg = reg && pr + 3 < reg.length, hasTint = tint && pr + 3 < tint.length, hasDa = da && pr + 3 < da.length;
      for (let s = 0; s < 2; s++) {
        const col = 2 * r + s;
        const o0 = col * 4, o1 = (W + col) * 4, o2 = (2 * W + col) * 4;
        let a = hasReg ? reg[pr] : 1;
        if (act) {
          let m = sidedAct ? act[col] : act[r];
          // Midline regions have one node (s = 0, §11.15): both columns carry it.
          if (sidedAct && s === 1 && (this.midline[r] || !Number.isFinite(m))) m = act[2 * r];
          if (Number.isFinite(m)) a *= m;
        }
        d[o0] = a;
        d[o0 + 1] = hasReg ? reg[pr + 1] : 0;
        d[o0 + 2] = hasReg ? reg[pr + 2] : 0;
        d[o0 + 3] = hasReg ? reg[pr + 3] : 0;
        d[o1] = hasTint ? tint[pr] : 0;
        d[o1 + 1] = hasTint ? tint[pr + 1] : 0;
        d[o1 + 2] = hasTint ? tint[pr + 2] : 0;
        d[o1 + 3] = 0;
        if (bt) {
          // BrainNet modulators (NE, ACh, HA, OX) use the chromaticity substitution of §13.6.
          const bi = (sidedTint ? col : r) * 4;
          if (bt[bi + 3] > 0) {
            d[o1] = bt[bi]; d[o1 + 1] = bt[bi + 1]; d[o1 + 2] = bt[bi + 2]; d[o1 + 3] = Math.min(1, bt[bi + 3]);
            d[o0 + 3] = 0;
          }
        }
        d[o2] = hasDa ? da[pr] : 0;
        d[o2 + 1] = hasDa ? da[pr + 1] : 0;
        d[o2 + 2] = hasDa ? da[pr + 2] : 0;
        d[o2 + 3] = ov[col];
      }
    }
    const o3 = ROW.PATH * W * 4;
    const ph = dopamine && dopamine.pathHist;
    if (ph) d.set(ph.length > W * 4 ? ph.subarray(0, W * 4) : ph, o3);
    const aa = brainnet && brainnet.areaActivity, sidedArea = !!aa && aa.length >= 2 * this.areas;
    const ao = this.overlay.area.v;
    for (let c = 0; c < 2 * this.areas; c++) {
      const o4 = (ROW.AREA * W + c) * 4;
      let a = 1;
      if (aa) { const m = sidedArea ? aa[c] : aa[c >> 1]; if (Number.isFinite(m)) a = m; }
      d[o4] = a;
      d[o4 + 1] = ao[c];
      d[o4 + 2] = 0;
      d[o4 + 3] = 0;
    }
  }

  _composeBody(kernel, packets, dt) {
    const disp = kernel && kernel.display;
    if (disp && disp.nodes) {
      const n = Math.min(disp.nodes.length, this.bodyData.length);
      this.bodyData.set(disp.nodes.length > n ? disp.nodes.subarray(0, n) : disp.nodes);
      this.dirty.body = true;
    }
    if (disp && disp.paths) {
      const e = this.edgeData, src = disp.paths;
      const k = dt > 0 ? 1 - Math.exp(-dt / PARAMS.edgeTau) : 0;
      const n = Math.min(this.pathCap, src.length >> 2);
      for (let i = 0; i < n; i++) {
        this.pathAct[i] += (src[i * 4] - this.pathAct[i]) * k;
        e[i * 4] = this.pathAct[i];
        e[i * 4 + 1] = src[i * 4 + 1];
        e[i * 4 + 2] = src[i * 4 + 2];
      }
      this.dirty.edge = true;
    }
    if (disp && disp.gut) {
      const n = Math.min(disp.gut.length, this.gutData.length);
      this.gutData.set(disp.gut.length > n ? disp.gut.subarray(0, n) : disp.gut);
      this.dirty.gut = true;
    }
    let list = packets;
    if (!list && kernel && typeof kernel.packets === 'function') {
      this._pkOut.length = 0;
      const r = kernel.packets(this._pkOut);
      list = Array.isArray(r) ? r : this._pkOut;
    }
    if (list || this._runs.length) this._packPackets(list || []);
  }

  // Sort by path, keep ≤ 8 per path (the shader's loop) and ≤ the tier pool, and write each path's
  // run (16·first + count) into the w channel of its edge texel.
  _packPackets(list) {
    const e = this.edgeData, pk = this.packetData;
    for (const p of this._runs) e[p * 4 + 3] = -1;
    this._runs.length = 0;
    const order = this._order;
    order.length = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i].pathId;
      if (Number.isInteger(p) && p >= 0 && p < this.pathCap) order.push(i);
    }
    order.sort((a, b) => list[a].pathId - list[b].pathId);   // stable: ties keep emission order
    let n = 0, runPath = -1, runStart = 0, runCount = 0;
    const close = () => { if (runPath >= 0 && runCount > 0) { e[runPath * 4 + 3] = runStart * 16 + runCount; this._runs.push(runPath); } };
    for (const i of order) {
      if (n >= this.packetPool) break;
      const q = list[i];
      if (q.pathId !== runPath) { close(); runPath = q.pathId; runStart = n; runCount = 0; }
      if (runCount >= PARAMS.perVertex) continue;
      const fibre = typeof q.fibre === 'number' ? FIBRES[q.fibre] : q.fibre;
      const eff = !!(q.effOnly || q.efferenceOnly);
      const dir = (typeof q.dir === 'string' ? /^aff/.test(q.dir) : q.dir < 0) ? -1 : 1;
      const gain = PARAMS.packetPeak * (PARAMS.classGain[fibre] ?? 1) * Math.tanh(Math.max(0, q.gain ?? 1))
        * (eff ? PARAMS.efferenceGain : 1) * (q.scale ?? 1);
      pk[n * 4] = q.pathId;
      pk[n * 4 + 1] = q.uHead;
      pk[n * 4 + 2] = Math.max(1e-5, (q.sigmaU ?? 0.01) * (PARAMS.classSigma[fibre] ?? 1));
      pk[n * 4 + 3] = gain;
      const o = (PACKET_CAP + n) * 4;
      pk[o] = Math.max(0, FIBRES.indexOf(fibre));
      pk[o + 1] = dir;
      pk[o + 2] = q.age ?? 0;
      pk[o + 3] = eff ? 1 : 0;
      n++;
      runCount++;
    }
    close();
    this.packetCount = n;
    this.dirty.edge = this.dirty.packet = true;
  }

  // Brain state every frame; body textures only when something changed and the body is drawn.
  upload({ body = true } = {}) {
    const gl = this.gl;
    if (!gl) return;
    updateDataTexture(gl, this.tex.uState, this.brainData);
    if (!body) return;
    if (this.dirty.body) updateDataTexture(gl, this.tex.uBodyState, this.bodyData);
    if (this.dirty.edge) updateDataTexture(gl, this.tex.uEdgeAct, this.edgeData);
    if (this.dirty.packet) updateDataTexture(gl, this.tex.uPackets, this.packetData);
    if (this.dirty.gut) updateDataTexture(gl, this.tex.uGut, this.gutData);
    this.dirty.body = this.dirty.edge = this.dirty.packet = this.dirty.gut = false;
  }

  // Binds the textures used by `program` ({ program, uniforms } from createProgram, already in use).
  bind(program) {
    const gl = this.gl;
    if (!gl) return;
    const u = program.uniforms;
    for (const [name, unit] of Object.entries(UNITS)) {
      if (!(name in u)) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[name].tex);
      gl.uniform1i(u[name], unit);
    }
    if ('uNodeCap' in u) gl.uniform1i(u.uNodeCap, this.nodeCap);
    if ('uPathCap' in u) gl.uniform1i(u.uPathCap, this.pathCap);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose() {
    if (!this.gl || !this.tex) return;
    for (const t of Object.values(this.tex)) deleteDataTexture(this.gl, t);
    this.tex = null;
  }
}
