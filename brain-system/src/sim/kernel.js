// Simulation kernel (§11.6–§11.10; A.4, A.5): one deterministic multi-rate integrator in human time.
// Layers run on fixed grids (EV exact, NF 0.5 ms, CV 10 ms, GI 100 ms, EN 1 s, IM 10 s, CR 60 s); every
// trajectory is a function of tH and the event log only, so traces do not depend on frame rate or kh.
// The NF layer is the generic rate graph of graph.js (exponential Euler on τ dr/dt = −r + F(x), §4.13)
// with per-source history rings, an active set with a timing wheel, and state-driven striding.
// Network modules plug in through the contract documented at the top of graph.js.
//
//   NF input   x_i = bias_i·g(portNets_i) + ext_i + G_drive·Σ_e w_e·g_e·a_src(t − d_e) + pulses
//   transfer   F = rmax / (1 + exp(−G_slope·(x − θ)/κ))   or F = ext (Hz) for 'direct' receptor nodes
//   step       r ← F + (r − F)·exp(−h/τ)
//   gains      g.k(tH) piecewise linear, slope ±1 per s of tH; 0 for every network in brain-only mode
//
// Ordering at equal times: packet, then event, then layer steps NF, CV, GI, EN, IM, CR (§11.6).
// Units: human seconds, mm, m/s; rates in Hz, drives dimensionless.

import { buildGraph, NET, NET_IDS, BODY_BIT, CUT_MASK, MASKS, LAYERS } from './graph.js';

export const PARAMS = {
  h: { NF: 0.0005, CV: 0.01, GI: 0.1, EN: 1, IM: 10, CR: 60 },   // layer steps, s (A.4; §11.6)
  ringMin: 8, ringMax: 8192,      // NF history ring per source, samples (§11.6)
  wheel: 16384,                   // timing wheel, NF steps; ≥ 8,192 (§11.6), doubled so a full-ring delay never hits the current slot [model]
  sleepEps: 1e-6,                 // NF sleep threshold, fraction of rmax (§11.6)
  elevated: 0.1,                  // a node stays awake while r − r_rest > 0.1 rmax (§11.6)
  quasiStatic: 1e-3,              // quasi-static stride: max |Δa| over 1 s (§11.6)
  emitThreshold: 0.1,             // packet emission threshold: rest + 0.1 rmax (§11.8)
  emitInterval: 0.05,             // s between packets per edge, ≤ 20 per s (§11.8)
  ampJitter: 0.1,                 // packet amplitude × U(0.9, 1.1) (§11.8)
  dispersionFast: 0.1,            // c_disp for Ia, Ib, Aβ, α-motor (§4.4)
  dispersionSlow: 0.3,            // c_disp for Aδ and the C classes (§4.4)
  deliverSigmaMin: 0.001,         // s; event-edge delivery Gaussian σ = max(1 ms, σ_t), truncated at ±3σ (§11.8)
  emitWindow: 0.05,               // s; area of a delivered packet = amp × emission interval (§4.13 Level B) [model]
  rampRate: 1.0,                  // network gain ramp, per s of tH (1.0-s ramp, A.5; §11.10)
  settleNF: 3,                    // s of tH of full NF update at rest settling (§11.6)
  cvQuietS: 10,                   // CV coarse 1-s steps after ≥ 10 s of quiescence (§11.6)
  sliceEvery: 16,                 // scheduler iterations between time-slice checks (§11.7)
  khMin: 0.005, khMax: 3600,      // clock range (A.4)
  transitScreen: 2.5,             // screen s a leading volley should stay in flight (A.4)
  logCap: 64,                     // event-log ring (B.9 shows 12) [model]
  logPerEpisode: 24,              // first-crossing entries logged per stimulus episode [model]
  spareVars: 512,                 // capacity for k.ref() fallbacks [model]
  defaults: { age: 30, posture: 0, timeOfDay: 10 * 3600 },   // A.3.4 age 30 y; posture 0 = supine, 1 = upright; clock 10:00 [model]
};

const HNF = PARAMS.h.NF;
const TICKS = [1, 20, 200, 2000, 20000, 120000];            // layer steps in NF ticks: NF, CV, GI, EN, IM, CR
const TICKS_PER_S = 2000;
const NFL = 0, CVL = 1, GIL = 2;
const LIDX = Object.fromEntries(LAYERS.map((L, i) => [L, i]));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const now = () => globalThis.performance?.now() ?? 0;
const SLOW_FIBRES = new Set(['Adelta', 'C', 'CT', 'Cmi', 'Cpost']);

// mulberry32 (the anatomy.js algorithm) on explicit state, so snapshots include the streams.
function rngNext(st, i) {
  const s = (st[i] + 0x6D2B79F5) | 0; st[i] = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Binary heap of packets ordered by (t, edge, seq) (§11.6).
const pless = (x, y) => x.t < y.t || (x.t === y.t && (x.edge < y.edge || (x.edge === y.edge && x.seq < y.seq)));
function heapPush(a, e) {
  a.push(e); let i = a.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (!pless(e, a[p])) break; a[i] = a[p]; i = p; }
  a[i] = e;
}
function heapPop(a) {
  const top = a[0], last = a.pop();
  if (a.length) {
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i, mv = last;
      if (l < a.length && pless(a[l], mv)) { m = l; mv = a[l]; }
      if (r < a.length && pless(a[r], mv)) m = r;
      if (m === i) break;
      a[i] = a[m]; i = m;
    }
    a[i] = last;
  }
  return top;
}

// Abramowitz–Stegun 7.1.26 (|error| < 1.5e-7); used for the event-edge delivery normaliser.
export function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}

// ---------------------------------------------------------------------------------------------------
// NF rate graph
// ---------------------------------------------------------------------------------------------------
class RateNet {
  constructor(graph) {
    const nodes = graph.nodes;
    this.map = new Int32Array(nodes.length).fill(-1);
    const list = [];
    nodes.forEach((n, i) => { if (n.layer === 'NF') { this.map[i] = list.length; list.push(n); } });
    const N = this.N = list.length;
    this.list = list;
    this.nodeOf = Int32Array.from(list, (n) => n.i);
    this.decay = Float64Array.from(list, (n) => (n.tau > 0 ? Math.exp(-HNF / n.tau) : 0));
    this.theta = Float64Array.from(list, (n) => n.theta);
    this.kappa = Float64Array.from(list, (n) => n.kappa);
    this.rmax = Float64Array.from(list, (n) => n.rmax);
    this.rSpont = Float64Array.from(list, (n) => clamp(n.rSpont, 0, n.rmax));
    this.direct = Uint8Array.from(list, (n) => (n.xfer === 'direct' ? 1 : 0));
    this.isBody = Uint8Array.from(list, (n) => (n.body ? 1 : 0));
    this.logs = Uint8Array.from(list, (n) => (n.log ? 1 : 0));
    this.biasMask = Uint8Array.from(list, (n) => (n.portDir === 'aff' ? n.portNets : 0));
    this.driveVar = new Int32Array(N);   // var index of the drive gain (filled by the kernel)
    this.slopeVar = new Int32Array(N);

    // Ring edges (NF → NF), CSR by target; wake lists by source.
    const E = graph.edges.filter((e) => e.transport === 'ring' && this.map[e.from] >= 0 && this.map[e.to] >= 0);
    // Ring length from the longest delay over every edge leaving an NF source (ring, event ≤ 4.096 s and
    // layer edges, so other layers can read delayed source values).
    const maxOut = new Float64Array(N);
    for (const e of graph.edges) {
      const j = this.map[e.from];
      if (j >= 0 && e.delay / HNF + 3 <= PARAMS.ringMax) maxOut[j] = Math.max(maxOut[j], e.delay);
    }
    this.len = new Int32Array(N); this.base = new Int32Array(N);
    let tot = 0;
    for (let i = 0; i < N; i++) {
      const need = Math.ceil(maxOut[i] / HNF) + 3;
      let L = PARAMS.ringMin; while (L < need) L <<= 1;
      this.len[i] = Math.min(L, PARAMS.ringMax); this.base[i] = tot; tot += this.len[i];
    }
    this.hist = new Float64Array(tot);
    const byT = Array.from({ length: N }, () => []), byS = Array.from({ length: N }, () => []);
    for (const e of E) { byT[this.map[e.to]].push(e); byS[this.map[e.from]].push(e); }
    const M = E.length;
    this.off = new Int32Array(N + 1); this.src = new Int32Array(M); this.w = new Float64Array(M);
    this.dI = new Int32Array(M); this.dF = new Float64Array(M); this.mask = new Uint8Array(M); this.mask0 = new Uint8Array(M);
    this.csrEdge = new Int32Array(M);
    this.csrOf = new Map();                // graph edge index → CSR slot
    let k = 0;
    for (let i = 0; i < N; i++) {
      this.off[i] = k;
      for (const e of byT[i]) {
        const ds = Math.max(1, e.delay / HNF);
        this.src[k] = this.map[e.from]; this.w[k] = e.w; this.dI[k] = Math.floor(ds); this.dF[k] = ds - Math.floor(ds);
        this.mask[k] = this.mask0[k] = e.nets; this.csrEdge[k] = e.i; this.csrOf.set(e.i, k); k++;
      }
    }
    this.off[N] = k;
    this.soff = new Int32Array(N + 1); this.stgt = new Int32Array(M); this.sdel = new Int32Array(M);
    k = 0;
    for (let i = 0; i < N; i++) {
      this.soff[i] = k;
      for (const e of byS[i]) { this.stgt[k] = this.map[e.to]; this.sdel[k] = Math.floor(Math.max(1, e.delay / HNF)); k++; }
    }
    this.soff[N] = k;
    // Emitting edges per source: axon/tract ≥ 50 mm (display, clock, log) and every 'event' edge (drive).
    const em = Array.from({ length: N }, () => []);
    for (const e of graph.edges) {
      const j = this.map[e.from];
      if (j >= 0 && (e.emits || e.transport === 'event')) em[j].push(e.i);
    }
    this.eoff = new Int32Array(N + 1); let ne = 0;
    for (let i = 0; i < N; i++) { this.eoff[i] = ne; ne += em[i].length; }
    this.eoff[N] = ne; this.eedge = Int32Array.from(em.flat());
    // Targets to keep awake during a gain ramp, per network bit (in-edges or port bias gated by it).
    this.netTargets = NET_IDS.map((net) => {
      const bit = NET[net], set = new Set();
      for (let q = 0; q < M; q++) if (this.mask0[q] & bit) set.add(this.findTarget(q));
      for (let i = 0; i < N; i++) if (this.biasMask[i] & bit) set.add(i);
      return Int32Array.from([...set].sort((a, b) => a - b));
    });
    this.bodyTargets = (() => {
      const set = new Set();
      for (let q = 0; q < M; q++) if (this.mask0[q] & BODY_BIT) set.add(this.findTarget(q));
      for (let i = 0; i < N; i++) if (this.biasMask[i]) set.add(i);
      return Int32Array.from([...set].sort((a, b) => a - b));
    })();

    // Dynamic state (snapshotted by the kernel).
    this.r = new Float64Array(N); this.rest = new Float64Array(N); this.ext = new Float64Array(N); this.bias = new Float64Array(N);
    this.val = new Float64Array(N); this.quietFrom = new Float64Array(N); this.awake = new Uint8Array(N);
    this.active = new Int32Array(N); this.next = new Int32Array(N); this.na = 0;
    this.above = new Uint8Array(N); this.logged = new Uint8Array(N); this.lastSched = new Float64Array(N).fill(-1);
    this.lastEmit = new Float64Array(graph.edges.length).fill(-1e9);
    this.imp = new Float64Array(N);
    this.W = PARAMS.wheel; this.wheel = Array.from({ length: this.W }, () => []); this.pending = 0;
    this.maxDelta = 0; this.qs = 0;
  }
  findTarget(q) { let lo = 0, hi = this.N - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.off[mid] <= q) lo = mid; else hi = mid - 1; } return lo; }
  // Node i is computed at step n; history slots it skipped while asleep are back-filled.
  wake(i, n, frozen) {
    if (this.awake[i] || (frozen && this.isBody[i])) return;
    this.awake[i] = 1; this.active[this.na++] = i;
    const L = this.len[i], b = this.base[i], v = this.val[i];
    for (let m = Math.max(this.quietFrom[i], n - L); m < n; m++) this.hist[b + (m & (L - 1))] = v;
  }
  sleep(i, n) { this.awake[i] = 0; this.val[i] = this.r[i] / this.rmax[i]; this.quietFrom[i] = n; }
  // a(t − d) at step n for a delay of d seconds (linear interpolation of fractional delays).
  readDelayed(j, n, d) {
    const ds = Math.max(0, d / HNF), dI = Math.floor(ds), f = ds - dI, m = n - dI;
    const L1 = this.len[j] - 1, b = this.base[j];
    const rd = (mm) => ((!this.awake[j] && mm >= this.quietFrom[j]) || mm > n ? this.val[j] : this.hist[b + (mm & L1)]);
    if (!this.awake[j] && m - 1 >= this.quietFrom[j]) return this.val[j];
    if (dI === 0 && this.awake[j]) return this.r[j] / this.rmax[j];
    const a0 = rd(m), a1 = rd(m - 1);
    return a0 + (a1 - a0) * f;
  }
}

// ---------------------------------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------------------------------
export class Kernel {
  constructor({ graph, plugins = [], seed = 1, age = PARAMS.defaults.age, settle = true, probe = false, options = {} } = {}) {
    this.plugins = plugins.map((p, i) => ({ p, i })).sort((a, b) => (a.p.order ?? 100) - (b.p.order ?? 100) || a.i - b.i).map((x) => x.p);
    this.graph = graph ?? buildGraph({ plugins: this.plugins, options });
    this.seed = seed;
    this.isProbe = probe;
    this.cpuMs = 0;
    this.t = 0;
    this.nf = new RateNet(this.graph);
    this.n = new Float64Array(6); this.due = new Float64Array(6).fill(1);
    this.rng = Int32Array.from([0, 1, 2, 3, 4, 5], (i) => (seed * 1000 + i + 1) | 0);   // §11.6 stream seeds
    this.gt = new Float64Array(MASKS); this._gtT = NaN;
    this.heap = []; this.pseq = 0; this.evq = []; this.evSeq = 0;
    this.logRing = []; this.logSeq = 0;
    this._ctx = 'idle'; this._ctxTick = 0; this._lastNF = -1;
    this._replay = [];
    this._hooks = LAYERS.map(() => []);
    this._quiet = LAYERS.map(() => []);
    this._handlers = new Map();
    this._stim = []; this._khVotes = [];
    this._cache = new Map();
    this._inputs = null; this._inT = NaN; this._inV = {};
    this._cmd = null;
    this._settleRequest = 0;

    // Storage declarations (finalised after create()).
    this._names = []; this._init = []; this._meta = []; this.varIndex = new Map();
    this._arrDecl = []; this._storeDecl = [];
    this.stores = {};
    this._owner = 'kernel'; this._scope = 'brain';
    this.declare('age', age, { unit: 'y' });
    this.declare('posture', PARAMS.defaults.posture);
    this.declare('timeOfDay', PARAMS.defaults.timeOfDay, { unit: 's' });
    this.declare('bodyMode', 1);                              // 1 = 'body', 0 = 'brain'
    this.declare('_one', 1);
    for (const net of NET_IDS) { this.declare(`net.${net}`, 1); this.declare(`_g0.${net}`, 1); this.declare(`_t0.${net}`, 0); this.declare(`_dir.${net}`, 0); }
    this.declare('_cvQuietSince', -1);
    this.declare('_episodeT0', -1);
    this.declare('_episodeLogged', 0);
    this.declareStore('_k', () => ({ holds: {}, cuts: [], intervention: null, pulses: [] }));

    // Plugins: create (declarations and hooks), finalise storage, init (links).
    this.instances = new Map();
    for (const p of this.plugins) {
      this._owner = p.id; this._scope = p.scope ?? 'body';
      const inst = p.create ? p.create(this) : null;
      this.instances.set(p.id, inst ?? {});
    }
    this._owner = 'kernel'; this._scope = 'brain';
    this._finalize();
    for (const p of this.plugins) this.instances.get(p.id).init?.(this);
    this._linked = true;
    if (settle) this.settle({});
  }

  // --- Storage (contract §2) ---
  declare(name, init = 0, opts = {}) {
    if (this.vars) throw new Error(`kernel: declare('${name}') after create(); use ref()`);
    if (this.varIndex.has(name)) throw new Error(`kernel: variable '${name}' declared twice`);
    const i = this._names.length;
    this._names.push(name); this._init.push(init);
    this._meta.push({ owner: this._owner, body: opts.body ?? (this._scope === 'body'), unit: opts.unit ?? null, basal: opts.basal ?? init });
    this.varIndex.set(name, i);
    return i;
  }
  declareArray(name, length, init = 0) {
    if (this.vars) throw new Error(`kernel: declareArray('${name}') after create()`);
    this._arrDecl.push({ name, length, init, owner: this._owner, body: this._scope === 'body' });
  }
  declareStore(name, factory) {
    if (name in this.stores) throw new Error(`kernel: store '${name}' declared twice`);
    this._storeDecl.push({ name, factory, owner: this._owner, body: this._scope === 'body' });
    this.stores[name] = factory();
  }
  array(name) { const a = this._arrays.get(name); if (!a) throw new Error(`kernel: unknown array '${name}'`); return a.view; }
  idx(name) { return this.varIndex.get(name) ?? -1; }
  ref(name, fallback = 0) {
    const i = this.varIndex.get(name);
    if (i !== undefined) return i;
    const j = this._names.length;
    if (j >= this.vars.length) throw new Error('kernel: out of spare variables for ref()');
    this._names.push(name); this._init.push(fallback);
    this._meta.push({ owner: 'fallback', body: false, unit: null, basal: fallback });
    this.varIndex.set(name, j); this.vars[j] = fallback; this._state = null;
    return j;
  }
  get(name) { const i = this.varIndex.get(name); return i === undefined ? undefined : this.vars[i]; }
  set(name, v) { const i = this.varIndex.get(name); if (i === undefined) throw new Error(`kernel: unknown variable '${name}'`); this.vars[i] = v; }
  // Named view for the HUD and tests: k.state.hr, k.state['pupilD.L'], k.state.r (NF rates by NF index).
  get state() {
    if (this._state) return this._state;
    const s = {}, vars = this.vars;
    this._names.forEach((name, i) => Object.defineProperty(s, name, { enumerable: true, get: () => vars[i], set: (v) => { vars[i] = v; } }));
    for (const [name, a] of this._arrays) Object.defineProperty(s, name, { enumerable: true, get: () => a.view });
    Object.defineProperty(s, 'r', { get: () => this.nf.r });
    return (this._state = s);
  }
  _finalize() {
    this.vars = new Float64Array(this._names.length + PARAMS.spareVars);
    this._names.forEach((_, i) => { this.vars[i] = this._init[i]; });
    let tot = 0; for (const d of this._arrDecl) tot += d.length;
    this.pool = new Float64Array(tot);
    this._arrays = new Map(); let off = 0;
    for (const d of this._arrDecl) {
      if (this._arrays.has(d.name)) throw new Error(`kernel: array '${d.name}' declared twice`);
      const view = this.pool.subarray(off, off + d.length); view.fill(d.init);
      this._arrays.set(d.name, { view, off, length: d.length, init: d.init, body: d.body }); off += d.length;
    }
    // Gain groups named by nodes (gain: { drive, slope }); undeclared names default to a constant 1.
    const nf = this.nf, one = this.varIndex.get('_one');
    nf.list.forEach((n, j) => {
      nf.driveVar[j] = n.gain?.drive ? this._gainVar(n.gain.drive) : one;
      nf.slopeVar[j] = n.gain?.slope ? this._gainVar(n.gain.slope) : one;
    });
    this._gainMembers = new Map();
    nf.list.forEach((n, j) => {
      for (const g of [n.gain?.drive, n.gain?.slope]) if (g) { if (!this._gainMembers.has(g)) this._gainMembers.set(g, []); this._gainMembers.get(g).push(j); }
    });
    this._varsDeclared = this._names.length;
    this._netVar = NET_IDS.map((net) => ({ on: this.varIndex.get(`net.${net}`), g0: this.varIndex.get(`_g0.${net}`), t0: this.varIndex.get(`_t0.${net}`), dir: this.varIndex.get(`_dir.${net}`) }));
    this._vBody = this.varIndex.get('bodyMode');
  }
  _gainVar(name) {
    const key = `gain.${name}`;
    let i = this.varIndex.get(key);
    if (i === undefined) { i = this._names.length; this._names.push(key); this._init.push(1); this._meta.push({ owner: 'kernel', body: false, unit: null, basal: 1 }); this.varIndex.set(key, i); this.vars[i] = 1; }
    return i;
  }

  // --- Hooks (contract §4–§8) ---
  onLayer(layer, fn, { always = false } = {}) {
    const L = LIDX[layer]; if (L === undefined) throw new Error(`kernel: unknown layer '${layer}'`);
    this._hooks[L].push({ fn, always: always || this._scope === 'brain', owner: this._owner });
  }
  onQuiet(layer, fn) { this._quiet[LIDX[layer]].push(fn); }
  on(type, fn) { if (!this._handlers.has(type)) this._handlers.set(type, []); this._handlers.get(type).push(fn); }
  dispatch(type, payload) { const hs = this._handlers.get(type); if (hs) for (const f of hs) f(payload, this); }
  onStimulus(fn) { this._stim.push(fn); }
  onKhVote(fn) { this._khVotes.push(fn); }
  plugin(id) { return this.instances.get(id); }

  // --- Readers ---
  get tH() { return this.t; }
  get bodyOn() { return this.vars[this._vBody] === 1; }
  get bodyMode() { return this.bodyOn ? 'body' : 'brain'; }
  nodeIndex(id) { return this.graph.index.get(id) ?? -1; }
  nfIndex(id) { const i = this.graph.index.get(id); return i === undefined ? -1 : this.nf.map[i]; }
  r(j) { return this.nf.r[j]; }
  a(j) { return this.nf.r[j] / this.nf.rmax[j]; }
  aRest(j) { return this.nf.rest[j] / this.nf.rmax[j]; }
  rate(id) { const j = this.nfIndex(id); return j < 0 ? NaN : this.nf.r[j]; }
  readDelayed(j, d) { return this.nf.readDelayed(j, this.n[NFL], d); }
  edgeIndex(fromId, toId) { const a = this.nodeIndex(fromId), b = this.nodeIndex(toId); if (a < 0 || b < 0) return -1; const g = this.graph; for (let q = g.outOff[a]; q < g.outOff[a + 1]; q++) if (g.edges[g.outEdge[q]].to === b) return g.outEdge[q]; return -1; }
  rand(layer) { return rngNext(this.rng, LIDX[layer]); }
  command(t = this.t) {
    const c = this._cmd?.commands; if (!c || !c.length) return null;
    let lo = 0, hi = c.length - 1; if (c[0].tH > t) return null;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m].tH <= t) lo = m; else hi = m - 1; }
    return c[lo];
  }
  input(t = this.t) { if (t !== this._inT) { this._inT = t; this._inV = this._inputs ? (this._inputs(t, this) ?? {}) : {}; } return this._inV; }

  // --- Gains (§11.10) ---
  g(net, t = this.t) { return this._g(NET_IDS.indexOf(net), t); }
  _g(b, t) {
    if (this.vars[this._vBody] !== 1) return 0;
    const v = this._netVar[b], vars = this.vars, dir = vars[v.dir];
    return dir === 0 ? vars[v.g0] : clamp(vars[v.g0] + dir * PARAMS.rampRate * (t - vars[v.t0]));
  }
  _rampEnd(b) { const v = this._netVar[b], vars = this.vars, dir = vars[v.dir]; if (dir === 0) return -Infinity; return vars[v.t0] + (dir > 0 ? 1 - vars[v.g0] : vars[v.g0]) / PARAMS.rampRate; }
  _rampActive(t) { for (let b = 0; b < 5; b++) if (this.vars[this._netVar[b].dir] !== 0 && t <= this._rampEnd(b) + HNF) return true; return false; }
  gate(mask, t = this.t) {
    if (mask === CUT_MASK) return 0;
    let p = (mask & BODY_BIT) ? (this.bodyOn ? 1 : 0) : 1;
    for (let b = 0; b < 5 && p > 0; b++) if (mask & (1 << b)) p *= this._g(b, t);
    return p;
  }
  edgeGate(e, t = this.t) { return this.stores._k.cuts.includes(e) ? 0 : this.gate(this.graph.edges[e].nets, t); }
  _gates(t) {
    if (t === this._gtT) return this.gt;
    const gv = [0, 1, 2, 3, 4].map((b) => this._g(b, t)), body = this.bodyOn ? 1 : 0, gt = this.gt;
    for (let m = 0; m < 64; m++) {
      let p = (m & BODY_BIT) ? body : 1;
      for (let b = 0; b < 5; b++) if (m & (1 << b)) p *= gv[b];
      gt[m] = p;
    }
    gt[CUT_MASK] = 0; this._gtT = t;
    return gt;
  }

  // --- Drives (contract §4) ---
  setExt(j, v) { if (this.nf.ext[j] !== v) { this.nf.ext[j] = v; this._wakeExt(j); } }
  setGain(name, v) {
    const i = this._gainVar(name);
    if (Math.abs(this.vars[i] - v) <= 1e-9) return;
    this.vars[i] = v;
    for (const j of this._gainMembers.get(name) ?? []) this._wakeExt(j);
  }
  holdNF(id, on) {
    const h = this.stores._k.holds;
    if (on) { if (!h[id]) { h[id] = true; this._poke(); } } else delete h[id];
  }
  cutEdge(e, cut = true) {
    const cuts = this.stores._k.cuts, k = cuts.indexOf(e);
    if (cut && k < 0) { cuts.push(e); cuts.sort((a, b) => a - b); } else if (!cut && k >= 0) cuts.splice(k, 1);
    const q = this.nf.csrOf.get(e);
    if (q !== undefined) { this.nf.mask[q] = cut ? CUT_MASK : this.nf.mask0[q]; this._wakeExt(this.nf.findTarget(q)); }
  }
  // Wake an NF node from outside the NF update (hooks of other layers, events, packets).
  _wakeExt(j) {
    const frozen = !this.bodyOn;
    if (this._ctx === 'NF') { this.nf.wake(j, this.n[NFL], frozen); return; }
    this._poke();
    this.nf.wake(j, this.n[NFL] + 1, frozen);
  }
  // Retarget a pending NF stride so the next NF step follows the current item (§11.6 lazy striding).
  _poke() {
    if (this._ctx === 'NF') return;
    const tick = this._ctx === 'idle' ? Math.max(Math.ceil(this.t / HNF - 1e-9), this._lastNF + 1) : this._ctxTick;
    const upTo = this._ctx === 'layer' ? tick : tick - 1;   // a layer step at T follows the NF step at T
    if (this.n[NFL] + this.due[NFL] > upTo + 1) { this._nfCatchUp(upTo); this.due[NFL] = 1; }
  }
  _nfCatchUp(toTick) {
    const nf = this.nf;
    if (toTick <= this.n[NFL]) return;
    if (nf.na) for (let ai = 0; ai < nf.na; ai++) {   // quasi-static stride: awake values held constant
      const i = nf.active[ai], L = nf.len[i], b = nf.base[i], a = nf.r[i] / nf.rmax[i];
      for (let m = Math.max(this.n[NFL] + 1, toTick - L + 1); m <= toTick; m++) nf.hist[b + (m & (L - 1))] = a;
    }
    this.n[NFL] = toTick; this._lastNF = toTick;
  }

  // --- Packets and log (contract §7) ---
  emitPacket(e, { amp = 1, lead = false, tEmit = this.t, efference = false } = {}) {
    const ed = this.graph.edges[e];
    const cond = ed.len / ed.v / 1000;
    const sig = Math.max(PARAMS.deliverSigmaMin, (SLOW_FIBRES.has(ed.fibre) ? PARAMS.dispersionSlow : PARAMS.dispersionFast) * cond);
    const tArr = tEmit + ed.delay;
    const drive = ed.transport === 'event' && !efference;
    heapPush(this.heap, { t: drive ? tArr - 3 * sig : tArr, tArr, edge: e, seq: this.pseq++, tEmit, amp, lead, eff: efference, sig: drive ? sig : 0 });
  }
  log(entry) {
    const e = { seq: ++this.logSeq, tH: this.t, ...entry };
    this.logRing.push(e); if (this.logRing.length > PARAMS.logCap) this.logRing.shift();
    return e;
  }
  // Event-log entries newer than `since` (seq); returns the newest seq.
  events(out = [], since = 0) { out.length = 0; for (const e of this.logRing) if (e.seq > since) out.push(e); return this.logSeq; }
  // Visible packets: { edge, pathId, uHead (0 at the source, 1 at the target), sigmaU, gain, amp, fibre, dir, lead, efference }.
  packets(out = []) {
    const g = this.graph, cuts = this.stores._k.cuts, t = this.t;
    const list = this.heap.slice().sort((a, b) => a.seq - b.seq);
    out.length = 0;
    for (const p of list) {
      const e = g.edges[p.edge], span = p.tArr - p.tEmit;
      if (t < p.tEmit) continue;
      const cond = e.len / e.v / 1000;
      out.push({ edge: p.edge, pathId: typeof e.path === 'string' ? e.path : null, from: e.fromId, to: e.toId,
        uHead: span > 0 ? clamp((t - p.tEmit) / span) : 1,
        sigmaU: span > 0 ? ((SLOW_FIBRES.has(e.fibre) ? PARAMS.dispersionSlow : PARAMS.dispersionFast) * cond) / span : 0,
        gain: p.eff || cuts.includes(p.edge) ? 0 : this.gate(e.nets, t), amp: p.amp, fibre: e.fibre, dir: e.dir, lead: p.lead, efference: p.eff });
    }
    return out;
  }
  // Clock target from layer activity (A.4, refined in §11.7): leading packets on extracerebral edges
  // ≥ 50 mm give clamp(transit / 2.5 s, 0.005, 1); module votes add their ceilings. Infinity = no target.
  khTarget() {
    let k = Infinity;
    for (const p of this.heap) {
      if (!p.lead || p.eff) continue;
      const e = this.graph.edges[p.edge];
      if ((e.nets & BODY_BIT) && e.len >= 50) k = Math.min(k, clamp((p.tArr - p.tEmit) / PARAMS.transitScreen, PARAMS.khMin, 1));
    }
    for (const f of this._khVotes) k = Math.min(k, f());
    return k;
  }

  // --- External control (B.4) ---
  setBodyMode(mode, tH) { return this.schedule({ type: 'body', mode, tH }); }
  setNet(id, on, tH) { if (!(id in NET)) throw new Error(`kernel: unknown network '${id}'`); return this.schedule({ type: 'net', net: id, on: !!on, tH }); }
  // Presets carry functions, so events keep only the id; the object lives in a registry (snapshot-safe).
  setIntervention(preset, tH) {
    const id = preset ? (preset.id ?? 'custom') : null;
    if (preset) (this._presets ??= new Map()).set(id, preset);
    return this.schedule({ type: 'intervention', presetId: id, tH });
  }
  setPosture(p, tH) { return this.schedule({ type: 'posture', value: p === 'upright' || p === 1 ? 1 : 0, tH }); }
  setArousalState(s, tH) { return this.schedule({ type: 'arousal', state: s, tH }); }
  setAge(age, tH) { return this.schedule({ type: 'age', value: age, tH }); }
  setExternalCommands(src) { this._cmd = src ?? null; }
  setInputs(fn) { this._inputs = fn ?? null; this._inT = NaN; }
  at(tH, type, payload) { return this.schedule({ type: 'internal', name: type, payload, tH, internal: true }); }
  replayLog() { return this._replay.slice(); }

  // Schedule an A.6 stimulus record (tOnset in tH) or a control event; snapped up to the NF grid (§11.6).
  schedule(rec) {
    const ev = rec.type ? { ...rec } : { type: 'stimulus', record: { ...rec } };
    const tH = ev.tH ?? ev.record?.tOnset ?? this.t;
    let minTick = Math.max(Math.ceil(this.t / HNF - 1e-9), this._lastNF + 1);
    if (this._ctx === 'event') minTick = Math.max(Math.ceil(this.t / HNF - 1e-9), this._lastNF + 1);
    if (this._ctx === 'layer' || this._ctx === 'NF') minTick = Math.max(minTick, this._ctxTick + 1);
    const tick = Math.max(Math.ceil(tH / HNF - 1e-9), minTick);
    ev.tick = tick; ev.tH = tick * HNF; ev.seq = this.evSeq++;
    if (ev.record) ev.record.tOnset = ev.tH;
    let i = this.evq.length;
    while (i > 0 && (this.evq[i - 1].tick > tick)) i--;
    this.evq.splice(i, 0, ev);
    for (const L of [NFL, CVL, GIL]) {
      const nextTick = (this.n[L] + this.due[L]) * TICKS[L];
      if (nextTick > tick) this.due[L] = Math.max(1, Math.ceil(tick / TICKS[L]) - this.n[L]);
    }
    if (!ev.internal) this._replay.push(ev.record ? { type: 'stimulus', tH: ev.tH, record: { ...ev.record } } : { ...ev });
    return ev.tH;
  }

  // --- Advance (B.6; §11.7 time slicing) ---
  advance(h, budgetMs = Infinity) { return this.advanceTo(this.t + Math.max(0, h), budgetMs); }
  advanceTo(T, budgetMs = Infinity) {
    const t0 = now(); let it = 0;
    if (!(T > this.t)) { this.cpuMs = 0; return this.t; }
    const hasBudget = budgetMs < Infinity;
    for (;;) {
      if (hasBudget && (++it % PARAMS.sliceEvery) === 0 && now() - t0 > budgetMs) { this.cpuMs = now() - t0; this._ctx = 'idle'; return this.t; }
      let L0 = 0, tk = Infinity;
      for (let L = 0; L < 6; L++) { const k = (this.n[L] + this.due[L]) * TICKS[L]; if (k < tk) { tk = k; L0 = L; } }
      const ev = this.evq.length ? this.evq[0] : null;
      const tev = ev ? ev.tick : Infinity;
      const pk = this.heap.length ? this.heap[0] : null;
      const tp = pk ? pk.t : Infinity, tEv = tev * HNF, tLay = tk * HNF;
      let kind, time;
      if (tp <= tEv && tp <= tLay) { kind = 0; time = tp; } else if (tev <= tk) { kind = 1; time = tEv; } else { kind = 2; time = tLay; }
      if (!(time < T)) break;
      if (time > this.t) this.t = time;
      if (kind === 0) { this._ctx = 'packet'; this._ctxTick = Math.ceil(time / HNF - 1e-9); this._deliver(heapPop(this.heap)); }
      else if (kind === 1) { this._ctx = 'event'; this._ctxTick = tev; this._apply(this.evq.shift()); }
      else this._step(L0, tk);
    }
    this._ctx = 'idle';
    this.t = T;
    this.cpuMs = now() - t0;
    return this.t;
  }

  _step(L, tick) {
    const t = tick * HNF;
    if (L === NFL) {
      this._ctx = 'NF'; this._ctxTick = tick;
      if (this.due[NFL] > 1) this._nfCatchUp(tick - 1);
      this.n[NFL] = tick; this._lastNF = tick;
      const gt = this._gates(t);
      if (this._rampActive(t)) {
        for (let b = 0; b < 5; b++) if (this.vars[this._netVar[b].dir] !== 0 && t <= this._rampEnd(b) + HNF) for (const j of this.nf.netTargets[b]) this.nf.wake(j, tick, !this.bodyOn);
      }
      for (const hk of this._hooks[NFL]) if (hk.always || this.bodyOn) hk.fn(t, HNF);
      this._nfStep(tick, t, gt, false);
      this.due[NFL] = this._nextNFStride(tick);
      return;
    }
    this._ctx = 'layer'; this._ctxTick = tick;
    const steps = this.due[L], h = steps * PARAMS.h[LAYERS[L]];
    this.n[L] += steps;
    for (const hk of this._hooks[L]) if (hk.always || this.bodyOn) hk.fn(t, h);
    this.due[L] = L === CVL ? this._nextCVStride(t) : L === GIL ? this._nextGIStride() : 1;
  }

  _nfStep(n, t, gt, settling) {
    const nf = this.nf, vars = this.vars;
    const W = nf.W - 1, slot = nf.wheel[n & W], frozen = !this.bodyOn;
    if (slot.length) { for (let q = 0; q < slot.length; q++) nf.wake(slot[q], n, frozen); nf.pending -= slot.length; slot.length = 0; }
    const pulses = this.stores._k.pulses;
    if (pulses.length) this._pulses(t, pulses);
    const { off, src, w, dI, dF, mask, hist, base, len, awake, quietFrom, val, r, ext, bias, biasMask, decay, theta, kappa, rmax,
      direct, soff, stgt, sdel, active, next, rest, lastSched, imp, driveVar, slopeVar, above } = nf;
    const na = nf.na; let nn = 0, maxD = nf.maxDelta;
    const eps = PARAMS.sleepEps, elev = PARAMS.elevated, thr = PARAMS.emitThreshold;
    for (let ai = 0; ai < na; ai++) {
      const i = active[ai];
      let F;
      if (direct[i]) F = clamp(ext[i], 0, rmax[i]);
      else {
        let x = 0;
        for (let q = off[i], q1 = off[i + 1]; q < q1; q++) {
          const gm = gt[mask[q]]; if (gm === 0) continue;
          const j = src[q], m = n - dI[q]; let a0, a1;
          if (awake[j] === 0 && m - 1 >= quietFrom[j]) { a0 = val[j]; a1 = a0; }
          else {
            const L1 = len[j] - 1, bs = base[j];
            a0 = (awake[j] === 0 && m >= quietFrom[j]) ? val[j] : hist[bs + (m & L1)];
            a1 = hist[bs + ((m - 1) & L1)];
          }
          x += w[q] * gm * (a0 + (a1 - a0) * dF[q]);
        }
        x = x * vars[driveVar[i]] + bias[i] * gt[biasMask[i]] + ext[i] + imp[i];
        F = rmax[i] / (1 + Math.exp(-vars[slopeVar[i]] * (x - theta[i]) / kappa[i]));
      }
      const r0 = r[i], r1 = F + (r0 - F) * decay[i], rm = rmax[i];
      r[i] = r1;
      const a1n = r1 / rm;
      hist[base[i] + (n & (len[i] - 1))] = a1n;
      const d = Math.abs(r1 - r0);
      if (d / rm > maxD) maxD = d / rm;
      const changing = d > eps * rm || Math.abs(F - r1) > eps * rm;
      if (!settling) {
        if (changing) for (let q = soff[i], q1 = soff[i + 1]; q < q1; q++) {
          const tg = stgt[q], st = n + sdel[q];
          if (lastSched[tg] !== st) { lastSched[tg] = st; nf.wheel[st & W].push(tg); nf.pending++; }
        }
        const up = r1 - rest[i] > thr * rm;
        if (up) {
          if (!above[i] && nf.logs[i]) this._logCrossing(i, t);
          if (nf.eoff[i + 1] > nf.eoff[i]) this._emit(i, t, a1n, !above[i], gt);
        }
        above[i] = up ? 1 : 0;
      }
      imp[i] = 0;
      if (settling || changing || r1 - rest[i] > elev * rm || this._hasPulse(i)) next[nn++] = i;
      else { awake[i] = 0; val[i] = a1n; quietFrom[i] = n + 1; above[i] = 0; }
    }
    for (let ai = na; ai < nf.na; ai++) next[nn++] = active[ai];   // woken during this step
    nf.active = next; nf.next = active; nf.na = nn; nf.maxDelta = maxD;
  }
  _hasPulse(i) { const p = this.stores._k.pulses; for (let k = 0; k < p.length; k++) if (p[k].tgt === i) return true; return false; }
  // Area-preserving truncated Gaussian deliveries of event-edge packets (§11.8).
  _pulses(t, pulses) {
    const imp = this.nf.imp, Z = 1 - erfc(3 / Math.SQRT2);
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      if (t > p.tc + 3 * p.sig) { pulses.splice(k, 1); continue; }
      if (t < p.tc - 3 * p.sig) continue;
      const z = (t - p.tc) / p.sig;
      imp[p.tgt] += p.area * Math.exp(-0.5 * z * z) / (p.sig * Math.sqrt(2 * Math.PI) * Z);
    }
  }
  _emit(i, t, a, lead, gt) {
    const nf = this.nf, edges = this.graph.edges;
    for (let q = nf.eoff[i]; q < nf.eoff[i + 1]; q++) {
      const e = nf.eedge[q];
      if (t - nf.lastEmit[e] < PARAMS.emitInterval - 1e-9) continue;
      const ed = edges[e], cut = this.stores._k.cuts.includes(e);
      const gm = cut ? 0 : gt[ed.nets];
      if (gm === 0 && !ed.efferent) continue;
      nf.lastEmit[e] = t;
      const amp = a * (1 - PARAMS.ampJitter + 2 * PARAMS.ampJitter * this.rand('NF'));
      this.emitPacket(e, { amp, lead, tEmit: t, efference: gm === 0 });
    }
  }
  _deliver(p) {
    if (p.eff) return;
    const e = this.graph.edges[p.edge];
    const g = this.stores._k.cuts.includes(p.edge) ? 0 : this.gate(e.nets, p.tArr);
    if (g === 0) { this._dropped = (this._dropped ?? 0) + 1; return; }
    if (p.sig > 0) {
      const tgt = this.nf.map[e.to];
      if (tgt >= 0) {
        this.stores._k.pulses.push({ tgt, tc: p.tArr, sig: p.sig, area: e.w * g * p.amp * PARAMS.emitWindow });
        this._wakeExt(tgt);
      }
    }
  }
  _logCrossing(i, t) {
    const vars = this.vars, iT0 = this.varIndex.get('_episodeT0'), iN = this.varIndex.get('_episodeLogged');
    if (vars[iT0] < 0 || this.nf.logged[i] || vars[iN] >= PARAMS.logPerEpisode) return;
    this.nf.logged[i] = 1; vars[iN] += 1;
    const node = this.nf.list[i], g = this.graph;
    let fibre = 'cns', v = null;   // the first non-CNS input edge, else the first input edge
    for (let q = g.inOff[node.i]; q < g.inOff[node.i + 1]; q++) { const e = g.edges[g.inEdge[q]]; if (v === null || (fibre === 'cns' && e.fibre !== 'cns')) { fibre = e.fibre; v = e.v; } }
    this.log({ kind: 'arrival', node: node.id, label: node.label ?? node.id, fibre, v, latencyMs: (t - vars[iT0]) * 1000 });
  }

  // --- Striding (§11.6) ---
  _holds() { for (const _ in this.stores._k.holds) return true; return false; }
  _nextNFStride(n) {
    const nf = this.nf;
    const boundary = n % TICKS_PER_S === 0;
    const clean = nf.pending === 0 && this.stores._k.pulses.length === 0 && !this._holds() && !this._rampActive(n * HNF);
    let qs = false;
    if (nf.na > 0) {
      if (!(boundary && clean && this.heap.length === 0 && nf.maxDelta < PARAMS.quasiStatic)) { if (boundary) nf.maxDelta = 0; return 1; }
      qs = true;
    } else if (!clean) { if (boundary) nf.maxDelta = 0; return 1; }
    if (boundary) nf.maxDelta = 0;
    let tgt = (Math.floor(n / TICKS_PER_S) + 1) * TICKS_PER_S;
    if (this.evq.length) tgt = Math.min(tgt, this.evq[0].tick);
    if (this.heap.length) {
      let tmin = Infinity; for (const p of this.heap) if (p.sig > 0 && p.t < tmin) tmin = p.t;   // drive-carrying packets only
      if (tmin < Infinity) tgt = Math.min(tgt, Math.ceil(tmin / HNF - 1e-9));
    }
    for (let b = 0; b < 5; b++) { const te = this._rampEnd(b); if (te > n * HNF) tgt = Math.min(tgt, Math.ceil(te / HNF - 1e-9)); }
    nf.qs = qs ? 1 : 0;
    return Math.max(1, tgt - n);
  }
  _nextCVStride(t) {
    const n = this.n[CVL];
    if (n % 100 !== 0) return 1;
    const iq = this.varIndex.get('_cvQuietSince');
    const quiet = this._quiet[CVL].every((f) => f());
    if (!quiet) { this.vars[iq] = -1; return 1; }
    if (this.vars[iq] < 0) this.vars[iq] = t;
    if (t - this.vars[iq] < PARAMS.cvQuietS || this.nf.na > 0 || this.nf.pending > 0 || this.heap.length || this._holds() || this._rampActive(t)) return 1;
    let tgt = n + 100;
    if (this.evq.length) tgt = Math.min(tgt, Math.ceil(this.evq[0].tick / TICKS[CVL]));
    return Math.max(1, tgt - n);
  }
  _nextGIStride() {
    const n = this.n[GIL];
    if (n % 10 !== 0 || !this._quiet[GIL].length || !this._quiet[GIL].every((f) => f())) return 1;
    let tgt = n + 10;
    if (this.evq.length) tgt = Math.min(tgt, Math.ceil(this.evq[0].tick / TICKS[GIL]));
    return Math.max(1, tgt - n);
  }

  // --- Events (§11.10–§11.12) ---
  _apply(ev) {
    const t = ev.tH, vars = this.vars;
    switch (ev.type) {
      case 'stimulus': {
        vars[this.varIndex.get('_episodeT0')] = t; vars[this.varIndex.get('_episodeLogged')] = 0;
        this.nf.logged.fill(0);
        const rec = ev.record;
        this.log({ kind: 'stimulus', node: rec.site ?? null, label: `${rec.sense} ${rec.mode ?? ''}`.trim(), sense: rec.sense, side: rec.side ?? null });
        for (const f of this._stim) f(rec, this);
        this.dispatch('stimulus', rec);
        break;
      }
      case 'net': {
        const b = NET_IDS.indexOf(ev.net), v = this._netVar[b];
        vars[v.on] = ev.on ? 1 : 0;
        if (this.bodyOn) { vars[v.g0] = this._g(b, t); vars[v.t0] = t; vars[v.dir] = ev.on ? 1 : -1; }
        else { vars[v.g0] = ev.on ? 1 : 0; vars[v.dir] = 0; }
        this._gtT = NaN;
        for (const j of this.nf.netTargets[b]) this._wakeExt(j);
        this.log({ kind: 'switch', node: ev.net, label: `${ev.net} ${ev.on ? 'on' : 'off'}` });
        this.dispatch('net', { net: ev.net, on: ev.on, tH: t });
        break;
      }
      case 'body': {
        const toBody = ev.mode === 'body';
        if (toBody === this.bodyOn) break;
        if (!toBody) {
          vars[this._vBody] = 0; this._gtT = NaN;
          const nf = this.nf;   // freeze body nodes at their current values
          for (let ai = nf.na - 1; ai >= 0; ai--) { const i = nf.active[ai]; if (nf.isBody[i]) { nf.sleep(i, this.n[NFL] + 1); nf.active[ai] = nf.active[--nf.na]; } }
          for (const j of nf.bodyTargets) this._wakeExt(j);
        } else {
          vars[this._vBody] = 1;
          for (let b = 0; b < 5; b++) { const v = this._netVar[b]; vars[v.g0] = vars[v.on]; vars[v.dir] = 0; }
          this._gtT = NaN;
          this._restoreBodyRest();
          for (const j of this.nf.bodyTargets) this._wakeExt(j);
        }
        this.log({ kind: 'switch', node: 'bodyMode', label: toBody ? 'Whole body' : 'Brain only' });
        this.dispatch('body', { mode: toBody ? 'body' : 'brain', tH: t });
        break;
      }
      case 'intervention': {
        const k = this.stores._k, preset = ev.presetId ? this._presets?.get(ev.presetId) ?? null : null;
        for (const e of k.cuts.slice()) this.cutEdge(e, false);
        k.intervention = ev.presetId ?? null;
        preset?.apply?.(this);
        this.log({ kind: 'intervention', node: null, label: k.intervention ?? 'none' });
        this.dispatch('intervention', preset);
        break;
      }
      case 'posture': vars[this.varIndex.get('posture')] = ev.value; this.dispatch('posture', ev.value); break;
      case 'age': vars[this.varIndex.get('age')] = ev.value; this.dispatch('age', ev.value); break;
      case 'arousal': this.dispatch('arousal', ev.state); break;
      case 'internal': this.dispatch(ev.name, ev.payload); break;
      default: this.dispatch(ev.type, ev);
    }
  }

  // --- Rest state (§11.6, §11.10) ---
  settle(init = {}) {
    const vars = this.vars;
    if (init.posture !== undefined) vars[this.varIndex.get('posture')] = init.posture === 'upright' || init.posture === 1 ? 1 : 0;
    if (init.timeOfDay !== undefined) vars[this.varIndex.get('timeOfDay')] = init.timeOfDay;
    if (init.age !== undefined) vars[this.varIndex.get('age')] = init.age;
    const key = JSON.stringify({ ...init, nets: NET_IDS.map((n) => vars[this.varIndex.get(`net.${n}`)]), body: this.bodyOn, age: vars[this.varIndex.get('age')],
      posture: vars[this.varIndex.get('posture')], tod: vars[this.varIndex.get('timeOfDay')], seed: this.seed });
    const hit = this._cache.get(key);
    if (hit) { this.restore(hit); return this; }

    // Reset dynamics; keep configuration (age, posture, clock, switches, body mode).
    const keep = new Set(['age', 'posture', 'timeOfDay', 'bodyMode', ...NET_IDS.map((n) => `net.${n}`)]);
    for (let i = 0; i < this._varsDeclared; i++) if (!keep.has(this._names[i])) vars[i] = this._init[i];
    for (const a of this._arrays.values()) a.view.fill(a.init);
    for (const d of this._storeDecl) this._replaceStore(d.name, d.factory());
    for (let b = 0; b < 5; b++) { const v = this._netVar[b]; vars[v.g0] = vars[v.on]; vars[v.dir] = 0; vars[v.t0] = 0; }
    this.t = 0; this.n.fill(0); this.due.fill(1); this._lastNF = -1;
    this.heap.length = 0; this.evq.length = 0; this.logRing.length = 0; this._gtT = NaN;
    this.rng = Int32Array.from([0, 1, 2, 3, 4, 5], (i) => (this.seed * 1000 + i + 1) | 0);
    this._settleNF(init);
    this._settleRequest = 0;
    for (const p of this.plugins) { const inst = this.instances.get(p.id); inst.settle?.(init, this); this._settleRequest = Math.max(this._settleRequest, inst.settleSeconds ?? 0); }
    if (this._settleRequest > 0) {
      this.advanceTo(this._settleRequest);
      this._rebase();
    }
    this._cache.set(key, this.snapshot());
    return this;
  }
  // NF rest: tonic drives solved for the reference rest (whole body, all networks on; Table 4.8e),
  // then 3 s of full update under the current switches (§11.6).
  _settleNF(init = {}) {
    const nf = this.nf, N = nf.N, vars = this.vars, one = this.varIndex.get('_one');
    for (let i = 0; i < N; i++) {
      if (nf.direct[i]) { nf.ext[i] = nf.rSpont[i]; nf.bias[i] = 0; continue; }
      const rm = nf.rmax[i], r = clamp(nf.rSpont[i], 1e-4 * rm, (1 - 1e-4) * rm);
      let input = 0;
      for (let q = nf.off[i]; q < nf.off[i + 1]; q++) { const j = nf.src[q]; input += nf.w[q] * (nf.rSpont[j] / nf.rmax[j]); }
      // Reference gains are 1 (wakeRelaxed, no phasic gain): the solved drive is state-independent.
      nf.bias[i] = nf.theta[i] + nf.kappa[i] * Math.log(r / (rm - r)) / vars[one] - input * vars[one];
      nf.ext[i] = 0;
    }
    for (const p of this.plugins) this.instances.get(p.id).preSettle?.(init, this);
    for (let i = 0; i < N; i++) { nf.r[i] = nf.rSpont[i]; nf.rest[i] = nf.rSpont[i]; }
    nf.hist.fill(0);
    for (let i = 0; i < N; i++) { const L = nf.len[i], b = nf.base[i]; nf.hist.fill(nf.rSpont[i] / nf.rmax[i], b, b + L); }
    nf.awake.fill(1); nf.na = N; for (let i = 0; i < N; i++) nf.active[i] = i;
    nf.quietFrom.fill(0); nf.pending = 0; for (const s of nf.wheel) s.length = 0; nf.lastSched.fill(-1);
    nf.above.fill(0); nf.logged.fill(0); nf.lastEmit.fill(-1e9); nf.imp.fill(0); nf.maxDelta = 0; nf.qs = 0;
    const steps = Math.round(PARAMS.settleNF / HNF), saved = this._ctx;
    this._ctx = 'NF';
    for (let n = 1; n <= steps; n++) {
      const t = n * HNF; this._ctxTick = n; this.n[NFL] = n;
      const gt = this._gates(t);
      for (const hk of this._hooks[NFL]) if (hk.always || this.bodyOn) hk.fn(t, HNF);
      this._nfStep(n, t, gt, true);
    }
    this._ctx = saved;
    this._sleepAll();
    this.n[NFL] = 0;
  }
  _sleepAll() {
    const nf = this.nf;
    for (let i = 0; i < nf.N; i++) {
      nf.rest[i] = nf.r[i]; nf.awake[i] = 0; nf.val[i] = nf.r[i] / nf.rmax[i]; nf.quietFrom[i] = 0;
      const L = nf.len[i], b = nf.base[i]; nf.hist.fill(nf.val[i], b, b + L);
    }
    nf.na = 0; nf.pending = 0; for (const s of nf.wheel) s.length = 0; nf.lastSched.fill(-1); nf.above.fill(0); nf.maxDelta = 0; nf.qs = 0;
  }
  // After a headless pre-roll: keep every state, restart the clock at tH = 0.
  _rebase() {
    this._sleepAll();
    this.t = 0; this.n.fill(0); this.due.fill(1); this._lastNF = -1;
    this.heap.length = 0; this.evq.length = 0; this.logRing.length = 0; this.stores._k.pulses.length = 0;
    this.vars[this.varIndex.get('_cvQuietSince')] = -1;
    this._gtT = NaN;
  }
  // Master switch back to whole body: body state from the resting-state cache of the current switch
  // set (§11.10 rule 5), computed lazily by a headless probe kernel.
  _restoreBodyRest() {
    const vars = this.vars;
    const key = JSON.stringify({ nets: NET_IDS.map((n) => vars[this.varIndex.get(`net.${n}`)]), age: vars[this.varIndex.get('age')], posture: vars[this.varIndex.get('posture')] });
    this._bodyRest ??= new Map();
    let s = this._bodyRest.get(key);
    if (!s) {
      const probe = new Kernel({ graph: this.graph, plugins: this.plugins, seed: this.seed, settle: false, probe: true });
      for (const name of ['age', 'posture', 'timeOfDay', ...NET_IDS.map((n) => `net.${n}`)]) probe.set(name, this.get(name));
      probe.settle({});
      s = probe.snapshot();
      this._bodyRest.set(key, s);
    }
    for (let i = 0; i < this._varsDeclared; i++) if (this._meta[i].body) vars[i] = s.vars[i];
    for (const a of this._arrays.values()) if (a.body) a.view.set(s.pool.subarray(a.off, a.off + a.length));
    for (const d of this._storeDecl) if (d.body) this._replaceStore(d.name, structuredClone(s.stores[d.name]));
    const nf = this.nf;
    for (let i = 0; i < nf.N; i++) if (nf.isBody[i]) {
      nf.r[i] = s.nf.r[i]; nf.rest[i] = s.nf.rest[i]; nf.ext[i] = s.nf.ext[i];
      nf.val[i] = nf.r[i] / nf.rmax[i]; nf.quietFrom[i] = this.n[NFL] + 1; nf.above[i] = 0;
      const L = nf.len[i], b = nf.base[i]; nf.hist.fill(nf.val[i], b, b + L);
    }
  }
  _replaceStore(name, value) {
    const s = this.stores[name];
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, value);
  }

  // --- Snapshot (seek, §12.2; resting-state cache) ---
  snapshot() {
    const nf = this.nf;
    return structuredClone({
      t: this.t, n: this.n, due: this.due, rng: this.rng, lastNF: this._lastNF, pseq: this.pseq, evSeq: this.evSeq, logSeq: this.logSeq,
      vars: this.vars, pool: this.pool, stores: this.stores, heap: this.heap, events: this.evq, logRing: this.logRing,
      nf: { r: nf.r, rest: nf.rest, ext: nf.ext, bias: nf.bias, val: nf.val, quietFrom: nf.quietFrom, awake: nf.awake, active: nf.active, na: nf.na,
        above: nf.above, logged: nf.logged, lastSched: nf.lastSched, lastEmit: nf.lastEmit, hist: nf.hist, imp: nf.imp, mask: nf.mask,
        wheel: nf.wheel, pending: nf.pending, maxDelta: nf.maxDelta, qs: nf.qs },
    });
  }
  restore(s) {
    const nf = this.nf, c = structuredClone(s);
    this.t = c.t; this.n.set(c.n); this.due.set(c.due); this.rng.set(c.rng); this._lastNF = c.lastNF;
    this.pseq = c.pseq; this.evSeq = c.evSeq; this.logSeq = c.logSeq;
    this.vars.set(c.vars); this.pool.set(c.pool);
    for (const name of Object.keys(c.stores)) if (this.stores[name]) this._replaceStore(name, c.stores[name]);
    this.heap = c.heap; this.evq = c.events; this.logRing = c.logRing;
    for (const k of ['r', 'rest', 'ext', 'bias', 'val', 'quietFrom', 'awake', 'above', 'logged', 'lastSched', 'lastEmit', 'hist', 'imp', 'mask']) nf[k].set(c.nf[k]);
    nf.active.set(c.nf.active); nf.na = c.nf.na; nf.pending = c.nf.pending; nf.maxDelta = c.nf.maxDelta; nf.qs = c.nf.qs;
    for (let i = 0; i < nf.W; i++) { nf.wheel[i].length = 0; for (const x of c.nf.wheel[i]) nf.wheel[i].push(x); }
    this._gtT = NaN; this._inT = NaN; this._ctx = 'idle';
  }
  get dropped() { return this._dropped ?? 0; }
}
