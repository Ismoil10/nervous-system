// Display wiring between the simulation kernel and the drawn scene (research/ANALYSIS.md B.6 steps
// 6–9, B.7, §11.8, §13.8–§13.10, §13.15). Nothing here touches the DOM, so the module loads in Node.
//
//   PacketMap        kernel packets (graph edges and graph paths, §11.8) → records on the body
//                    buffer's geometry paths (geometry.js PATHS index and arc parameter u, B.7), the
//                    form statetex.js packs into uPackets
//   NetGhost         per display bit (B.7), the network ghost factor that follows g.<net>(tH),
//                    rate-limited to the §13.15 fade (A.5, §13.10)
//   jointPose        somatic joint angles (deg) → rigid segment transforms for the body shader (§13.9)
//   OVERLAYS         Brain systems overlay members (display only, A.5, §13.10)
//   projectCss       a point in render units → CSS px on the canvas (PhotoLimiter sources, §13.15)
//
// The kernel names its routes by graph path (graph.js `paths`, e.g. 'som.aff.indexTip.C7.R'), while
// every body point carries the index of a geometry path ('median.R', 'root.C7.R', …). A graph path
// is drawn over the body paths it runs along: each graph path is resampled once into a lookup table
// (graph u → nearest body path and its u), chosen among the few body paths that lie along it.
// Brain-internal routes (tracts inside the skull) have no body path and are not drawn here.

import { PATHS, RIGID, pathSamples, pathAt, nearestOnPolyline } from './body/geometry.js';
import { MM, REGION_IDS } from './anatomy.js';

export const PARAMS = {
  maxOffMm: 15,        // [model] a packet head farther than this from every candidate body path is not drawn
  probes: 12,          // [model] probe points per graph path when choosing its candidate body paths
  candidates: 4,       // [model] body paths kept per graph path (nerve, root, cord segment, …)
  steps: 48,           // [model] lookup-table steps along a graph path
  cellMm: 20,          // [model] hash-grid cell of the body path samples
  ghost: 0.08,         // A.5, §13.10 ghost flux
  fade: 0.8,           // §13.15 t_fade ≥ 0.8 s (tS)
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------------------------------------------------------------------------------------------
// PacketMap
// ---------------------------------------------------------------------------------------------
export class PacketMap {
  constructor(graph, { paths = PATHS } = {}) {
    this.graph = graph;
    this.paths = paths;
    this._grid = null;
    this._tables = new Map();   // key → table or null
    this._arc = null;
  }

  // Body path samples in a coarse hash grid (path indices per cell).
  _buildGrid() {
    const C = PARAMS.cellMm, grid = new Map();
    const add = (q, pi) => {
      const key = `${Math.floor(q[0] / C)},${Math.floor(q[1] / C)},${Math.floor(q[2] / C)}`;
      let set = grid.get(key);
      if (!set) grid.set(key, (set = new Set()));
      set.add(pi);
    };
    this._arc = new Float64Array(this.paths.length);
    this.paths.forEach((p, pi) => {
      const S = pathSamples(p);
      this._arc[pi] = S.arcLen;
      for (let i = 0; i < S.pts.length; i++) {
        add(S.pts[i], pi);
        if (i + 1 < S.pts.length) {   // fill long segments so every cell they cross knows the path
          const a = S.pts[i], b = S.pts[i + 1], n = Math.floor(dist(a, b) / (0.5 * C));
          for (let k = 1; k < n; k++) { const f = k / n; add([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], pi); }
        }
      }
    });
    this._grid = grid;
  }

  _near(q) {
    const C = PARAMS.cellMm, out = new Set();
    const cx = Math.floor(q[0] / C), cy = Math.floor(q[1] / C), cz = Math.floor(q[2] / C);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const set = this._grid.get(`${x},${y},${z}`);
      if (set) for (const pi of set) out.add(pi);
    }
    return out;
  }

  // The edge's route in mm, oriented from its source node to its target node (uHead 0 → 1).
  _route(e) {
    const g = this.graph;
    let pts = null;
    if (typeof e.path === 'string') pts = g.paths.get(e.path)?.pts ?? null;
    else if (Array.isArray(e.path)) pts = e.path;
    const a = g.nodes[e.from]?.pos, b = g.nodes[e.to]?.pos;
    if (!pts || pts.length < 2) pts = a && b ? [a, b] : null;
    if (!pts) return null;
    if (a && dist(pts[0], a) > dist(pts[pts.length - 1], a)) pts = pts.slice().reverse();
    return pts;
  }

  _table(e) {
    const key = typeof e.path === 'string' ? `${e.path}|${e.from}` : `e${e.i}`;
    if (this._tables.has(key)) return this._tables.get(key);
    if (!this._grid) this._buildGrid();
    let table = null;
    const pts = this._route(e);
    if (pts) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
      const L = cum[cum.length - 1];
      const at = (u) => {
        const s = clamp(u) * L;
        let i = 1;
        while (i < cum.length - 1 && cum[i] < s) i++;
        const f = (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        const p = pts[i - 1], q = pts[i];
        return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
      };
      // Candidate body paths: those passing within maxOff of the most probe points.
      const votes = new Map();
      for (let j = 0; j <= PARAMS.probes; j++) {
        const q = at(j / PARAMS.probes);
        for (const pi of this._near(q)) {
          if (nearestOnPolyline(pathSamples(this.paths[pi]).pts, q).off <= PARAMS.maxOffMm) votes.set(pi, (votes.get(pi) ?? 0) + 1);
        }
      }
      const cand = [...votes.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, PARAMS.candidates).map(([pi]) => pi);
      if (cand.length && L > 0) {
        const n = PARAMS.steps, pi = new Int32Array(n + 1).fill(-1), u = new Float32Array(n + 1);
        for (let j = 0; j <= n; j++) {
          const q = at(j / n);
          let best = -1, bu = 0, off = PARAMS.maxOffMm;
          for (const c of cand) {
            const r = nearestOnPolyline(pathSamples(this.paths[c]).pts, q);
            if (r.off <= off) { off = r.off; best = c; bu = this._arc[c] > 0 ? r.along / this._arc[c] : 0; }
          }
          pi[j] = best; u[j] = bu;
        }
        // Travel direction on the body: u is 0 at the CNS end (A.2), so a packet whose u falls is
        // afferent; the graph's own `dir` marks ports only, so it is the fallback.
        const first = pi.findIndex((x) => x >= 0), last = pi.length - 1 - [...pi].reverse().findIndex((x) => x >= 0);
        const aff = first < last && pi[first] === pi[last] ? u[first] > u[last] : e.dir === 'aff';
        if (first >= 0) table = { n, pi, u, len: L, aff };
      }
    }
    this._tables.set(key, table);
    return table;
  }

  // kernel.packets() records → body-path records { seq, pathId (geometry index), uHead (body u),
  // sigmaU, gain, fibre, dir, efference, edge }. Efference-only packets keep their volley size so
  // statetex can draw them at half gain, desaturated (§13.8); packets on cut edges carry gain 0.
  map(list, out = []) {
    out.length = 0;
    const edges = this.graph.edges;
    for (const q of list) {
      const e = edges[q.edge];
      if (!e) continue;
      const T = this._table(e);
      if (!T) continue;
      const x = clamp(q.uHead) * T.n, j0 = Math.floor(x), j1 = Math.min(T.n, j0 + 1), f = x - j0;
      const j = f < 0.5 ? j0 : j1, pi = T.pi[j];
      if (pi < 0) continue;
      const u = T.pi[j0] === pi && T.pi[j1] === pi ? T.u[j0] + (T.u[j1] - T.u[j0]) * f : T.u[j];
      const arc = this._arc[pi] || 1;
      out.push({ seq: q.seq, edge: q.edge, pathId: pi, uHead: u, sigmaU: Math.max(1e-5, (q.sigmaU ?? 0) * T.len / arc),
        gain: (q.efference ? 1 : q.gain ?? 0) * (q.amp ?? 1), fibre: q.fibre, dir: T.aff ? 'aff' : 'eff', efference: !!q.efference, scale: 1 });
    }
    return out;
  }

  // Head position of a mapped record, in mm of the body frame.
  positionMm(rec) { return pathAt(this.paths[rec.pathId], rec.uHead).p; }
}

// ---------------------------------------------------------------------------------------------
// Network ghost factors (A.5, §13.10)
// ---------------------------------------------------------------------------------------------
// bitNets: the switch of each display bit (renderer.js PARAMS.netSwitch). Each factor follows
// ghost + (1 − ghost)·g.<net>(tH) and never moves faster than (1 − ghost)/t_fade per screen second,
// so the display never claims a network is off while the model still delivers its packets.
export class NetGhost {
  constructor(bitNets) {
    this.bitNets = bitNets;
    this.gains = new Float32Array(bitNets.length).fill(1);
  }
  update(kernel, dtS) {
    if (!kernel.bodyOn) return this.gains;   // frozen with the body (A.5); they return as they left
    const rate = (1 - PARAMS.ghost) / PARAMS.fade, step = Math.max(0, dtS) * rate;
    this.bitNets.forEach((net, i) => {
      const target = PARAMS.ghost + (1 - PARAMS.ghost) * kernel.g(net);
      const x = this.gains[i];
      this.gains[i] = x < target ? Math.min(target, x + step) : Math.max(target, x - step);
    });
    return this.gains;
  }
}

// ---------------------------------------------------------------------------------------------
// Limb motion (§13.9, A.8 #22): somatic joint angles → rigid segment transforms
// ---------------------------------------------------------------------------------------------
// The body shader applies one transform per vertex (its own segment), so a child segment carries
// the composition of every joint above it. Axes in the body frame (A.2: +x right, +y anterior,
// +z up); positive angles as somatic.js JOINTS (agonist − antagonist): elbow flexion, wrist
// extension, knee extension, shoulder abduction, neck flexion. Directions [model].
const SEG = Object.fromEntries(RIGID.map((r, i) => [r.id, i]));
const JOINT_DRIVE = [
  { v: 'joint.shoulder.R', seg: 'upperArm.R', axis: [0, 1, 0], sign: -1 },
  { v: 'joint.elbow.R', seg: 'forearm.R', axis: [1, 0, 0], sign: 1 },
  { v: 'joint.wrist.R', seg: 'hand.R', axis: [1, 0, 0], sign: -1 },
  { v: 'joint.shoulder.L', seg: 'upperArm.L', axis: [0, 1, 0], sign: 1 },
  { v: 'joint.elbow.L', seg: 'forearm.L', axis: [1, 0, 0], sign: 1 },
  { v: 'joint.wrist.L', seg: 'hand.L', axis: [1, 0, 0], sign: -1 },
  { v: 'joint.knee.R', seg: 'leg.R', axis: [1, 0, 0], sign: 1 },
  { v: 'joint.knee.L', seg: 'leg.L', axis: [1, 0, 0], sign: 1 },
  { v: 'joint.neck', seg: 'head', axis: [1, 0, 0], sign: -1 },
];
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
function qRot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

// → [{ seg, q, pivot (mm), offset (mm) }] for renderer.setJoint, every rigid segment (identity when still).
export function jointPose(kernel) {
  const local = RIGID.map(() => [0, 0, 0, 1]);
  for (const d of JOINT_DRIVE) {
    const deg = kernel.get(d.v);
    if (!Number.isFinite(deg) || deg === 0) continue;
    const h = (d.sign * deg * Math.PI) / 360, s = Math.sin(h);
    local[SEG[d.seg]] = [d.axis[0] * s, d.axis[1] * s, d.axis[2] * s, Math.cos(h)];
  }
  // World transform of each segment: p' = R (p − pivot) + pivot + offset; a child's pivot moves
  // with its parent, so offset_child = T_parent(pivot_child) − pivot_child.
  const world = [];
  RIGID.forEach((r, i) => {
    const pivot = r.pivot ?? [0, 0, 0];
    if (r.parent < 0) { world.push({ seg: i, q: local[i], pivot, offset: [0, 0, 0] }); return; }
    const P = world[r.parent];
    const moved = qRot(P.q, [pivot[0] - P.pivot[0], pivot[1] - P.pivot[1], pivot[2] - P.pivot[2]]);
    const at = [moved[0] + P.pivot[0] + P.offset[0], moved[1] + P.pivot[1] + P.offset[1], moved[2] + P.pivot[2] + P.offset[2]];
    world.push({ seg: i, q: qMul(P.q, local[i]), pivot, offset: [at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]] });
  });
  return world;
}

// ---------------------------------------------------------------------------------------------
// Brain systems overlays (display only, A.5; member flux × 1.6, others × 0.7, §13.10)
// ---------------------------------------------------------------------------------------------
// Members per overlay (anatomy.js region ids; cortical areas by AREAS id), [model] from §3.
const THAL = REGION_IDS.filter((id) => id.startsWith('thal') || id === 'thalamus' || id === 'lgn' || id === 'mgn');
export const OVERLAYS = {
  thalamocortical: { regions: [...THAL, 'cortex', 'frontal', 'pfc', 'ofc', 'acc', 'insula', 'parietal', 'temporal', 'occipital'], areas: 'all' },
  basalGanglia: { regions: ['dorsalStriatum', 'caudate', 'naccCore', 'naccShell', 'pallidum', 'gpi', 'vp', 'stn', 'snc', 'snr', 'thalVA', 'thalVL', 'thalCM'] },
  cerebellar: { regions: ['cerebellum', 'dentate', 'fastigial', 'interposed', 'flocculus', 'nodulus', 'pontineNuc', 'io', 'redNucleus', 'thalVL'] },
  limbic: { regions: ['amygdala', 'cea', 'bnst', 'hippocampus', 'acc', 'mammillary', 'thalAnt', 'habenula', 'msdb', 'hdb', 'nbm', 'olfTubercle', 'naccShell'],
    areas: ['dacc', 'sgacc', 'pgacc', 'pcc', 'rsc', 'entorhinal', 'parahipp', 'insAnt'] },
  hypothalamus: { regions: ['hypothalamus', 'mpoa', 'pvn', 'arcuate', 'scn', 'son', 'vlpo', 'lh', 'tmn', 'dmh', 'vmh', 'mammillary', 'mnpo', 'ovlt', 'sfo',
    'medianEminence', 'pituitaryGland', 'pituitaryPost', 'zonaIncerta', 'a11', 'a14'] },
  brainstem: { regions: ['brainstem', 'pag', 'raphe', 'mnr', 'rmg', 'rpa', 'rob', 'lc', 'ppn', 'ldt', 'pbn', 'pno', 'pnc', 'gi', 'mrf', 'vestNuc', 'ntsGust',
    'ntsVisc', 'dmv', 'nAmbMotor', 'nAmbVagal', 'rvlm', 'cvlm', 'preBotC', 'rtn', 'io', 'gracile', 'cuneate', 'spV', 'prV', 'mesV', 'motV', 'cochNuc',
    'soc', 'ic', 'sc', 'opn', 'ew', 'n3', 'n4', 'n6', 'n7m', 'n12', 'ssn', 'isn', 'barrington', 'redNucleus', 'areaPostrema', 'vta', 'vtaMedial', 'rmtg', 'snc'] },
  // Large-scale networks (functional connectivity, A.8 #23): default-mode and salience-network areas.
  networks: { regions: [], areas: ['mpfc', 'pcc', 'precuneus', 'angular', 'tpj', 'dacc', 'insAnt', 'dlpfc', 'ips'] },
};

// Union of the members of the overlays that are on → { regions, areas } (ids and AREAS indices),
// or null when none is on.
export function overlayMembers(on, areaIds) {
  const regions = new Set(), areas = new Set();
  let any = false;
  for (const [id, set] of Object.entries(OVERLAYS)) {
    if (!on[id]) continue;
    any = true;
    for (const r of set.regions) regions.add(r);
    if (set.areas === 'all') areaIds.forEach((_, i) => areas.add(i));
    else for (const a of set.areas ?? []) { const i = areaIds.indexOf(a); if (i >= 0) areas.add(i); }
  }
  return any ? { regions: [...regions], areas: [...areas] } : null;
}

// ---------------------------------------------------------------------------------------------
// Projection (PhotoLimiter sources, §13.15)
// ---------------------------------------------------------------------------------------------
// A point in render units → [x, y] in CSS px of a w × h canvas, or null behind the eye.
export function projectCss(view, proj, p, w, h) {
  const x = p[0], y = p[1], z = p[2];
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const cx = proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12];
  const cy = proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13];
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15];
  if (!(cw > 1e-6)) return null;
  return [(cx / cw * 0.5 + 0.5) * w, (1 - (cy / cw * 0.5 + 0.5)) * h];
}
export const mmToUnits = (p) => [p[0] * MM, p[1] * MM, p[2] * MM];
