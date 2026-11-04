// @ts-check
// Simulation graph: schema constants (A.3.2), the network plugin contract and buildGraph (§11.3–§11.5).
// The graph is a static table of nodes and edges. Every network module contributes its own fragment;
// buildGraph merges the fragments, resolves ids, computes lengths and delays from polylines and the
// conduction table (§4.4) and returns flat arrays plus CSR indices. Nothing here integrates time:
// the kernel (kernel.js) owns state and stepping.
//
//   delay d_e = len_mm / v_mps / 1000 + nSyn · t_syn + (target is a muscle ? NMJ + EMG spread : 0)   §11.4
//   nets      5-bit AND mask: somatic 1, autonomic 2, enteric 4, neuroendocrine 8, neuroimmune 16   §11.3
//             bit 32 (BODY) marks an edge that runs only in whole-body mode (tissue edges and every
//             edge that touches a body node); an edge runs only when every listed bit is on.
//
// Units: mm, m/s (= mm/ms), human seconds.

/**
 * NETWORK PLUGIN CONTRACT (§11; Appendix B.4). Binding for brainnet.js, sensory.js and the five
 * network modules (somatic, autonomic, enteric, endocrine, immune). A plugin is a plain object (or a
 * class instance) with these members:
 *
 *   export const plugin = {
 *     id: 'autonomic',        // unique; network modules use their A.3.1 network id
 *     scope: 'body',          // 'brain' (cns/special: brainnet, sensory) or 'body' (all five networks)
 *     order: 30,              // ascending order of fragment building and of steps inside each layer:
 *                             // brainnet 0, sensory 10, somatic 20, autonomic 30, enteric 40,
 *                             // endocrine 50, immune 60 (ties keep the plugin list order)
 *     fragment(ctx) { return { nodes, edges, paths }; },   // optional; graph build time
 *     create(k) { ...; return instance; },                  // optional; once per Kernel instance
 *   };
 *
 * 1. FRAGMENT (graph build time; pure data, no state).
 *    fragment(ctx) returns { nodes: NodeSpec[], edges: EdgeSpec[], paths?: { [pathId]: [[x,y,z], …] } }.
 *    Fragments are built in `order`; ctx.has(id) / ctx.pos(id) / ctx.node(id) see the nodes of every
 *    earlier fragment (the brain fragment comes first, so ports and nuclei always exist for body
 *    fragments). Helpers: ctx.mask(['autonomic', …]) → bitmask; ctx.sided(id, 'R') → 'id.R';
 *    ctx.mirror([x,y,z]) → [−x,y,z]; ctx.polyLength(pts) → mm; ctx.fibreV, ctx.tractV (§4.4 tables);
 *    ctx.options (the per-plugin options object passed to buildGraph as options[plugin.id]).
 *    NodeSpec: { id, kind, owner, layer?, pos:[x,y,z] mm, side?: 'R'|'L'|null, label?, log?,
 *                tau? s, theta?, kappa?, rmax? Hz, rSpont? Hz, xfer?: 'logistic'|'direct',
 *                gain?: { drive?: name, slope?: name }, portDir?: 'aff'|'eff', portNets?: string[]|int,
 *                region?, area?, site?, cls?, muscle?: bool, shared?: bool }
 *      - id follows A.3.2 (camelCase, sided `id.R`/`id.L`, sub-parts with dots); kind ∈ NODE_KINDS;
 *        owner ∈ OWNERS keys (a sub-network id from A.3.1, or 'cns', 'special', 'tissue').
 *      - A node's network bits and its body flag follow from `owner`: every owner other than 'cns' and
 *        'special' is a body node (frozen in brain-only mode, reset to rest when the body returns).
 *      - layer defaults by kind (KIND_LAYER). Nodes on 'NF' are generic rate units integrated by the
 *        kernel: τ dr/dt = −r + F(x), F logistic (§4.8) or 'direct' (F = the external drive in Hz;
 *        used for receptors, whose transduction sensory.js computes). Defaults per kind: KIND_DEFAULTS.
 *      - rSpont is the resting rate in the reference rest state (whole body, all networks on): the
 *        kernel solves each node's tonic drive so that F gives rSpont at rest (Table 4.8e).
 *      - portNets (afferent ports only) gates the port's tonic drive: a port whose networks are off,
 *        or every non-special afferent port in brain-only mode, goes silent (A.5).
 *      - A node id is declared by exactly one fragment. A node several optional modules may need
 *        (e.g. `nodoseGang`) is declared with `shared: true` by each; the first declaration wins and
 *        later shared declarations are ignored.
 *    EdgeSpec: { from, to, kind?, fibre?, nets?: string[]|int, path?: pathId | [[x,y,z], …],
 *                len? mm, v? m/s, tract?: key of TRACT_V, nSyn? (default 1), w? (default sign · 1),
 *                sign? ±1, transmitter?, transport?: 'ring'|'event'|'layer', optional?: bool, label? }
 *      - from/to are node ids; they may name nodes of any fragment. An unresolved id throws unless the
 *        edge is `optional: true` (then it is dropped and listed in graph.dropped).
 *      - nets: the networks the edge needs (AND, §11.3, §11.11): an axon belongs to the network of its
 *        neuron; a humoral edge to the network whose distant action it carries. cns and special
 *        edges list none. The BODY bit is added automatically for every edge touching a body node.
 *      - len: given, else the polyline length of `path`, else 1.2 × the centre distance (§3.15).
 *      - v: given, else TRACT_V[tract], else FIBRE_V[fibre] (§4.4; never rescaled, A.4).
 *      - transport: 'ring' (NF → NF, read from the source's history ring), 'event' (drive carried by
 *        packets; NF → NF delays > 4.096 s), 'layer' (any edge touching a non-NF node: blood, portal,
 *        volume, effector edges; the owning plugin reads it in its own layer step). Default inferred.
 *      - w is dimensionless drive per unit source activation a = r/rmax (Table 4.8e). buildGraph does
 *        not rescale weights: each fragment owns the weights of its own edges.
 *    Paths: named polylines (mm) used by edges (`path: 'tractML'`) and by the renderer (pathId).
 *
 * 2. STATE (create time). All dynamic state lives in kernel storage, so snapshot/restore, the
 *    resting-state cache and replay identity work for every module without module code:
 *      k.declare(name, init, { unit, basal, body }) → index   scalar in k.vars (Float64Array); A.3.4 names
 *      k.declareArray(name, length, init)                     Float64Array view, fetched with k.array(name)
 *      k.declareStore(name, () => object)                     JSON-cloneable object, k.stores[name]
 *    Declared names are visible to the HUD as k.state.<name>. Cache an index, a view or a store object,
 *    never a nested object inside a store (restore replaces store contents in place). Plugin objects and
 *    instances may hold constants and indices only. `body: true` marks a variable that belongs to the
 *    body (restored from the resting-state cache when the master switch returns to whole body); it is
 *    the default for plugins of scope 'body'.
 *
 * 3. LIFECYCLE. new Kernel({ graph, plugins }): (a) the NF rate graph is built from the graph;
 *    (b) create(k) runs for every plugin in order (declare state, register hooks; return the instance);
 *    (c) storage is finalised; (d) instance.init?.(k) runs for every plugin (link phase: resolve other
 *    modules' state with k.ref, fetch views with k.array); (e) k.settle(init) establishes the rest
 *    state: variables, arrays and stores return to their declared initial values, the NF tonic drives
 *    are solved, instance.preSettle?.(init, k) sets resting external drives (k.setExt, k.setGain), the
 *    NF graph settles for 3 s of tH, then instance.settle?.(init, k) runs. A plugin that needs a headless
 *    pre-roll to reach its steady state sets instance.settleSeconds (s of tH; the kernel runs the
 *    longest one requested, e.g. 300 s for the cardiovascular loop, §11.10).
 *
 * 4. LAYER STEPS. k.onLayer(layer, fn, { always = false }) registers fn(t, h) for 'NF', 'CV', 'GI',
 *    'EN', 'IM' or 'CR'. t is the step's end time (tH, s), h the time since that layer's previous step
 *    (the nominal step, or longer after a stride). NF hooks run before the rate update of each executed
 *    0.5-ms step, so they must be cheap; they set drives with k.setExt(j, x). Steps of 'body' plugins
 *    are skipped while bodyMode = 'brain' unless registered with always: true. Striding votes:
 *    k.onQuiet(layer, fn) → fn() returns true when the module's deterministic core is quiescent
 *    (CV, GI); a layer strides only when every vote is quiet (§11.6). While a module must see every NF
 *    step (an active stimulus, a running burst), it holds NF with k.holdNF(id, true) and releases it
 *    with k.holdNF(id, false).
 *
 * 5. READING OTHER MODULES. At init, k.ref(name, fallback) returns the index of a variable another
 *    module declared; if that module is absent the kernel creates a constant with the fallback value,
 *    which must be the basal or clamped value of A.5 (cortisol basal, tCore 37.0, paco2 40, pao2 95, …).
 *    Read and write with k.vars[i]. NF rates: k.nfIndex(id) → j (−1 if absent), k.r(j) Hz, k.a(j) =
 *    r/rmax, k.aRest(j), k.readDelayed(j, d) = a(t − d) from the history ring. Adapter commands
 *    (B.13, §11.14): k.command(t) returns the latest record { tH, cmdSym, cmdVag, cmdSacral, apnoea,
 *    omega } with tH ≤ t (zero-order hold), or null. Scenario inputs: k.input(t) returns the object of
 *    the §12.2 inputs(tH) function (or {}). Cross-module notifications inside a step or event use
 *    k.on(type, fn) and k.dispatch(type, payload) (synchronous, in registration order).
 *
 * 6. GATING (A.5, §11.10–§11.11). Network gains g.<net>(tH) ramp linearly over 1.0 s of tH and are all
 *    0 in brain-only mode: k.g('autonomic') at the current step time, k.gate(mask) = Π g over the
 *    mask, k.edgeGate(e) for one edge (0 when an intervention cut it). NF ring and event edges are
 *    gated by the kernel itself. A plugin applies gains in its own equations exactly in the §11.13
 *    forms: an efferent tone relaxes toward g(t)·command(t − D) (gate after the dead time); a hormone
 *    relaxes toward g·h_cmd + (1 − g) (basal replacement); AND edges multiply every listed gain.
 *    Brain nodes always compute their commands. k.bodyOn is false in brain-only mode; the kernel
 *    dispatches 'net' { net, on, tH } and 'body' { mode, tH } when a switch is applied.
 *    Interventions: k.cutEdge(e, cut) removes an edge, k.scaleEdge(e, g) keeps a fraction g of its
 *    drive (§6.15 partial preservation); a preset object { id, apply(k) } passed to
 *    k.setIntervention calls apply after all cuts are reset, and 'intervention' is dispatched.
 *
 * 7. PACKETS AND EVENTS (§11.8). The kernel emits packets on NF axon and tract edges ≥ 50 mm by itself
 *    (leading packet at the 0.1-rmax crossing, then every 50 ms per edge). A plugin may emit display
 *    packets on its own edges with k.emitPacket(e, { amp, lead, tEmit }); on 'event' edges the packet
 *    also carries drive to the NF target. Event-log entries: k.log({ kind, node, label, fibre, v }).
 *    The kernel logs stimulus deliveries, switches, state changes and the first threshold crossing of
 *    every node with `log: true` in each stimulus episode.
 *
 * 8. STIMULI AND KERNEL EVENTS. k.schedule(record) applies an A.6 stimulus record at tOnset (snapped up
 *    to the NF grid); handlers registered with k.onStimulus(fn) run in order, and sensory.js drives
 *    every receptor node whose `site` matches. Internal timed events: k.at(tH, type, payload) dispatches
 *    `type` at that time (deterministic, retargets strides). Clock votes (A.4): k.onKhVote(fn) → fn()
 *    returns a kh ceiling (e.g. 1 during a cardiac transient, 60 while HPA is active) or Infinity.
 *
 * 9. DETERMINISM. No Math.random, no wall-clock time, no dependence on frame rate or kh. Random draws
 *    only inside steps, from the layer's seeded stream: k.rand(layer) ∈ [0, 1) (mulberry32,
 *    seeded scenarioSeed × 1000 + layerIndex + 1, §11.6). Iterate arrays in index order.
 */

// --- Schema constants (A.3.1–A.3.2, §11.3) ---
export const NET = Object.freeze({ somatic: 1, autonomic: 2, enteric: 4, neuroendocrine: 8, neuroimmune: 16 });
export const NET_IDS = Object.freeze(['somatic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune']);
export const BODY_BIT = 32;      // runs only in whole-body mode (§11.3 rule 2: tissue edges)
export const CUT_MASK = 64;      // reserved gate index: an edge removed by an intervention (gate 0)
export const MASKS = 65;         // size of the kernel's gate table

export const NODE_KINDS = Object.freeze(['receptor', 'ganglion', 'segment', 'nucleus', 'area', 'port',
  'effector', 'organ', 'gland', 'pool', 'oscillator']);
export const EDGE_KINDS = Object.freeze(['axon', 'tract', 'portal', 'blood', 'volume']);
export const FIBRES = Object.freeze(['Ia', 'Ib', 'II', 'Abeta', 'Adelta', 'C', 'CT', 'Cmi', 'Agamma',
  'Aalpha', 'B', 'Cpost', 'cns']);
export const LAYERS = Object.freeze(['NF', 'CV', 'GI', 'EN', 'IM', 'CR']);
export const TRANSPORTS = Object.freeze(['ring', 'event', 'layer']);

// Owner → network (A.3.1 sub-network ids). null: never switched (cns, special) or tissue.
export const OWNERS = Object.freeze({
  cns: null, special: null, tissue: null,
  'som.aff': 'somatic', 'som.motor': 'somatic', 'som.tract': 'somatic',
  'ans.symp': 'autonomic', 'ans.para': 'autonomic', 'ans.vaff': 'autonomic',
  'ens.myenteric': 'enteric', 'ens.submucosal': 'enteric',
  'ne.hpa': 'neuroendocrine', 'ne.sam': 'neuroendocrine', 'ne.post': 'neuroendocrine',
  'ne.raas': 'neuroendocrine', 'ne.gut': 'neuroendocrine', 'ne.scalar': 'neuroendocrine',
  'ni.route': 'neuroimmune', 'ni.reflex': 'neuroimmune', 'ni.fever': 'neuroimmune', 'ni.sickness': 'neuroimmune',
});
export const isBodyOwner = (owner) => owner !== 'cns' && owner !== 'special';

export const PARAMS = {
  // Peripheral fibre classes, m/s (§4.4a, A.9; Agamma 25 per §4.4a, which supersedes A.9's 15).
  fibreV: { Ia: 65, Ib: 65, II: 45, Abeta: 65, Adelta: 15, C: 1.0, CT: 0.9, Cmi: 0.5, Agamma: 25,
    Aalpha: 55, B: 8, Cpost: 1.0, cns: 20 },
  // CNS tract classes, m/s (§4.4b): dorsal column, medial lemniscus, lemniscal thalamocortical,
  // spinothalamic Aδ- / C-related, corticospinal, optic, LC axons, bulbospinal autonomic, other CNS.
  tractV: { dc: 55, ml: 45, tc: 35, sttAd: 10, sttC: 2.2, cst: 60, optic: 8, lc: 0.5, bulbospinal: 3, cns: 20 },
  tSyn: 0.0006,          // s per fast chemical synapse (Table 4.3a)
  nmj: 0.0007,           // s, NMJ delay (Table 4.3a)
  emgSpread: 0.0005,     // s, endplate to recording territory (Table 4.3a)
  routeFactor: 1.2,      // unrouted edge length = 1.2 × centre distance (§3.15)
  ringMaxDelay: 4.096,   // s; NF history ring capacity, 8,192 × 0.5 ms (§11.6)
  packetMinLen: 50,      // mm; only axon and tract edges this long emit packets (§11.8)
  theta: 0.5, kappa: 0.12,   // logistic defaults (Table 4.8a)
};
export const FIBRE_V = PARAMS.fibreV;
export const TRACT_V = PARAMS.tractV;

// Default layer per node kind (A.4, §11.4): neural kinds on the fast rate graph.
export const KIND_LAYER = Object.freeze({ receptor: 'NF', ganglion: 'NF', segment: 'NF', nucleus: 'NF',
  area: 'NF', port: 'NF', effector: 'NF', oscillator: 'NF', organ: 'CV', gland: 'EN', pool: 'CV' });

// Default rate-unit parameters per kind: τ (s, Table 4.13a), rmax (Hz, Table 4.8b), resting rate (Hz,
// [model] low fraction of rmax so rest sits on the foot of the sigmoid) and transfer form (Table 4.8d).
export const KIND_DEFAULTS = Object.freeze({
  receptor: { tau: 0.0005, rmax: 300, rSpont: 0, xfer: 'direct' },     // receptor output stage
  ganglion: { tau: 0.003, rmax: 50, rSpont: 1, xfer: 'logistic' },     // autonomic ganglion
  segment: { tau: 0.0015, rmax: 200, rSpont: 2, xfer: 'logistic' },    // spinal interneuron pool
  nucleus: { tau: 0.02, rmax: 50, rSpont: 1, xfer: 'logistic' },       // limbic / hypothalamic default
  area: { tau: 0.01, rmax: 100, rSpont: 2, xfer: 'logistic' },         // cortical area
  port: { tau: 0.0006, rmax: 300, rSpont: 3, xfer: 'logistic' },       // fast relay
  effector: { tau: 0.0006, rmax: 50, rSpont: 0, xfer: 'logistic' },    // α-MN pool display ceiling
  oscillator: { tau: 0.0015, rmax: 100, rSpont: 2, xfer: 'logistic' },
  organ: { tau: 0, rmax: 1, rSpont: 0, xfer: 'logistic' },
  gland: { tau: 0, rmax: 1, rSpont: 0, xfer: 'logistic' },
  pool: { tau: 0, rmax: 1, rSpont: 0, xfer: 'logistic' },
});

// --- Helpers ---
export function netMask(nets) {
  if (nets == null) return 0;
  if (typeof nets === 'number') return nets & 63;
  let m = 0;
  for (const n of nets) {
    if (n === 'body') { m |= BODY_BIT; continue; }
    if (n === 'special' || n === 'cns' || n === 'tissue') continue;
    if (!(n in NET)) throw new Error(`graph: unknown network '${n}'`);
    m |= NET[n];
  }
  return m;
}
export const maskNets = (m) => NET_IDS.filter((n) => m & NET[n]);
export const mirror = (p) => [-p[0], p[1], p[2]];
export const sided = (id, side) => (side ? `${id}.${side}` : id);
export function dist3(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
export function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist3(pts[i - 1], pts[i]); return L; }

// Edge delay in s (§11.4).
export function edgeDelay(len, v, nSyn, toMuscle) {
  return len / v / 1000 + nSyn * PARAMS.tSyn + (toMuscle ? PARAMS.nmj + PARAMS.emgSpread : 0);
}

// --- Builder ---
// buildGraph({ brain, body, plugins, options }) → { nodes, edges, index, paths, inOff, inEdge, outOff,
// outEdge, dropped, plugins }. `plugins` are the plugin objects above; `body: false` skips the
// fragments of 'body' plugins (brain-only graph), `brain: false` skips 'brain' fragments (tests).
export function buildGraph({ brain = true, body = true, plugins = [], options = {} } = {}) {
  const list = plugins.map((p, i) => ({ p, i }))
    .filter(({ p }) => ((p.scope ?? 'body') === 'brain' ? brain : body))
    .sort((a, b) => (a.p.order ?? 100) - (b.p.order ?? 100) || a.i - b.i)
    .map(({ p }) => p);

  const nodes = [], index = new Map(), paths = new Map(), edgeSpecs = [];
  const ctx = {
    has: (id) => index.has(id),
    node: (id) => nodes[index.get(id)],
    pos: (id) => nodes[index.get(id)]?.pos,
    mask: netMask, mirror, sided, polyLength, fibreV: FIBRE_V, tractV: TRACT_V,
    options: {},
  };

  for (const p of list) {
    if (!p.fragment) continue;
    ctx.options = options[p.id] ?? {};
    const frag = p.fragment(ctx) ?? {};
    for (const [pid, pts] of Object.entries(frag.paths ?? {})) {
      if (paths.has(pid)) throw new Error(`graph: duplicate path '${pid}' (${p.id})`);
      paths.set(pid, { id: pid, pts, len: polyLength(pts) });
    }
    for (const spec of frag.nodes ?? []) {
      if (index.has(spec.id)) {
        if (spec.shared) continue;
        throw new Error(`graph: duplicate node '${spec.id}' (${p.id})`);
      }
      const n = makeNode(spec, p.id, nodes.length);
      index.set(n.id, n.i);
      nodes.push(n);
    }
    for (const spec of frag.edges ?? []) edgeSpecs.push({ spec, plugin: p.id });
  }

  const edges = [], dropped = [];
  for (const { spec, plugin } of edgeSpecs) {
    const fi = index.get(spec.from), ti = index.get(spec.to);
    if (fi === undefined || ti === undefined) {
      if (spec.optional) { dropped.push(spec); continue; }
      throw new Error(`graph: edge ${spec.from} → ${spec.to} (${plugin}) names an unknown node`);
    }
    edges.push(makeEdge(spec, plugin, nodes[fi], nodes[ti], paths, edges.length));
  }

  // CSR indices by target and by source (edge indices, in edge order).
  const N = nodes.length, M = edges.length;
  const inOff = new Int32Array(N + 1), outOff = new Int32Array(N + 1);
  for (const e of edges) { inOff[e.to + 1]++; outOff[e.from + 1]++; }
  for (let i = 0; i < N; i++) { inOff[i + 1] += inOff[i]; outOff[i + 1] += outOff[i]; }
  const inEdge = new Int32Array(M), outEdge = new Int32Array(M);
  const ci = inOff.slice(0, N), co = outOff.slice(0, N);
  for (const e of edges) { inEdge[ci[e.to]++] = e.i; outEdge[co[e.from]++] = e.i; }

  return { nodes, edges, index, paths, inOff, inEdge, outOff, outEdge, dropped, plugins: list.map((p) => p.id) };
}

function makeNode(s, plugin, i) {
  if (!NODE_KINDS.includes(s.kind)) throw new Error(`graph: node '${s.id}' has unknown kind '${s.kind}'`);
  const owner = s.owner ?? 'cns';
  if (!(owner in OWNERS)) throw new Error(`graph: node '${s.id}' has unknown owner '${owner}'`);
  const d = KIND_DEFAULTS[s.kind];
  const net = OWNERS[owner];
  return {
    i, id: s.id, kind: s.kind, owner, plugin, net, nets: net ? NET[net] : 0,
    body: isBodyOwner(owner),
    layer: s.layer ?? KIND_LAYER[s.kind],
    pos: s.pos ?? [0, 0, 0],
    side: s.side ?? null,
    label: s.label ?? null,
    log: !!s.log,
    tau: s.tau ?? d.tau, theta: s.theta ?? PARAMS.theta, kappa: s.kappa ?? PARAMS.kappa,
    rmax: s.rmax ?? d.rmax, rSpont: s.rSpont ?? d.rSpont,
    xfer: s.xfer ?? d.xfer,
    gain: s.gain ?? null,
    portDir: s.portDir ?? null,
    portNets: netMask(s.portNets ?? 0),
    region: s.region ?? null, area: s.area ?? null,
    site: s.site ?? null, cls: s.cls ?? null,
    muscle: !!s.muscle,
  };
}

function makeEdge(s, plugin, a, b, paths, i) {
  const kind = s.kind ?? (a.body || b.body ? 'axon' : 'tract');
  if (!EDGE_KINDS.includes(kind)) throw new Error(`graph: edge ${a.id} → ${b.id} has unknown kind '${kind}'`);
  const fibre = s.fibre ?? 'cns';
  if (!FIBRES.includes(fibre)) throw new Error(`graph: edge ${a.id} → ${b.id} has unknown fibre '${fibre}'`);
  let nets = netMask(s.nets);
  if (a.body || b.body || nets) nets |= BODY_BIT;

  let pathId = null, len = s.len;
  if (typeof s.path === 'string') {
    const p = paths.get(s.path);
    if (!p) throw new Error(`graph: edge ${a.id} → ${b.id} names unknown path '${s.path}'`);
    pathId = s.path; len ??= p.len;
  } else if (Array.isArray(s.path)) {
    len ??= polyLength(s.path);
  }
  len ??= PARAMS.routeFactor * dist3(a.pos, b.pos);
  const v = s.v ?? (s.tract ? TRACT_V[s.tract] : FIBRE_V[fibre]);
  if (!(v > 0)) throw new Error(`graph: edge ${a.id} → ${b.id} has no velocity`);
  const nSyn = s.nSyn ?? 1;
  const delay = edgeDelay(len, v, nSyn, b.muscle);
  const sign = s.sign ?? (s.w !== undefined ? Math.sign(s.w) || 1 : 1);
  const w = s.w ?? sign;
  const bothNF = a.layer === 'NF' && b.layer === 'NF';
  const transport = s.transport ?? (bothNF ? (delay <= PARAMS.ringMaxDelay ? 'ring' : 'event') : 'layer');
  if (!TRANSPORTS.includes(transport)) throw new Error(`graph: edge ${a.id} → ${b.id} has unknown transport '${transport}'`);
  const dir = a.body && !b.body ? 'aff' : !a.body && b.body ? 'eff' : (a.portDir === 'eff' ? 'eff' : 'int');
  return {
    i, from: a.i, to: b.i, fromId: a.id, toId: b.id, plugin, kind, fibre, nets, len, v, nSyn, delay, w, sign,
    transmitter: s.transmitter ?? null, transport, path: pathId ?? (Array.isArray(s.path) ? s.path : null),
    dir, efferent: dir === 'eff' || a.portDir === 'eff',
    emits: (kind === 'axon' || kind === 'tract') && len >= PARAMS.packetMinLen && transport !== 'layer',
    label: s.label ?? null,
  };
}
