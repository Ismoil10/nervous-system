// Type contracts of the Brain System simulation (research/ANALYSIS.md A.3–A.6, §11, §12, B.4).
// Type checking only: the browser never loads this file, nothing is compiled, and the app stays
// plain ES modules served as they are. Files with `// @ts-check` import these types through JSDoc,
// e.g. `/** @typedef {import('./contracts').Plugin} Plugin */`. Run `npm run typecheck` (needs `tsc`
// on PATH) from brain-system/.
//
// The prose contract for network modules is the comment at the top of src/sim/graph.js; these
// types state the same thing in checkable form. Units: mm, m/s, human seconds (tH), Hz.

// ---------------------------------------------------------------------------------------------
// Names (A.3)
// ---------------------------------------------------------------------------------------------

/** A.3.1 network ids, bits 1, 2, 4, 8, 16 of an edge mask (graph.js NET). */
export type NetId = 'somatic' | 'autonomic' | 'enteric' | 'neuroendocrine' | 'neuroimmune';
/** Kernel layers (A.4, §11.6). */
export type Layer = 'NF' | 'CV' | 'GI' | 'EN' | 'IM' | 'CR';
export type NodeKind = 'receptor' | 'ganglion' | 'segment' | 'nucleus' | 'area' | 'port' | 'effector'
  | 'organ' | 'gland' | 'pool' | 'oscillator' | (string & {});
export type EdgeKind = 'axon' | 'tract' | 'portal' | 'blood' | 'volume';
export type Transport = 'ring' | 'event' | 'layer';
export type Side = 'R' | 'L' | null;
export type BodyMode = 'body' | 'brain';
/** Plugin scope: brain plugins run in brain-only mode, body plugins only in whole-body mode. */
export type Scope = 'brain' | 'body';
/** A network list (AND) or a ready bitmask (graph.js netMask). */
export type Nets = NetId[] | number;
export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------------------------
// Graph fragments (graph.js, §11.3–§11.5)
// ---------------------------------------------------------------------------------------------

export interface NodeSpec {
  id: string;                      // A.3.2: camelCase, sided `id.R` / `id.L`, sub-parts with dots
  kind: NodeKind;
  owner: string;                   // an OWNERS key: a sub-network of A.3.1, or 'cns', 'special', 'tissue'
  layer?: Layer;                   // defaults by kind (KIND_LAYER)
  pos: Vec3;                       // mm, body frame (A.2)
  side?: Side;
  label?: string;
  log?: boolean;                   // log the first threshold crossing in each stimulus episode
  tau?: number;                    // s
  theta?: number;
  kappa?: number;
  rmax?: number;                   // Hz
  rSpont?: number;                 // Hz, resting rate in the reference rest state (Table 4.8e)
  xfer?: 'logistic' | 'direct';
  gain?: { drive?: string; slope?: string };
  portDir?: 'aff' | 'eff';
  portNets?: Nets;
  region?: string;                 // anatomy.js REGION_IDS entry
  area?: number;
  site?: string;
  cls?: string;
  muscle?: boolean;
  shared?: boolean;                // several optional modules may declare it; the first wins
}

export interface EdgeSpec {
  from: string;
  to: string;
  kind?: EdgeKind;
  fibre?: string;                  // graph.js FIBRES
  nets?: Nets;                     // AND: every listed network must be on
  path?: string | Vec3[];
  len?: number;                    // mm
  v?: number;                      // m/s
  tract?: string;                  // key of TRACT_V
  nSyn?: number;
  w?: number;                      // drive per unit source activation a = r/rmax
  sign?: 1 | -1;
  transmitter?: string;
  transport?: Transport;
  optional?: boolean;              // dropped (and listed in graph.dropped) when an end is missing
  label?: string;
}

export interface Fragment {
  nodes?: NodeSpec[];
  edges?: EdgeSpec[];
  paths?: Record<string, Vec3[]>;
}

export interface FragmentContext {
  has(id: string): boolean;
  pos(id: string): Vec3;
  node(id: string): GraphNode;
  mask(nets: Nets): number;
  sided(id: string, side: 'R' | 'L'): string;
  mirror(p: Vec3): Vec3;
  polyLength(pts: Vec3[]): number;
  fibreV: Record<string, number>;
  tractV: Record<string, number>;
  options: Record<string, unknown>;
}

/** A resolved node of the built graph (buildGraph output). */
export interface GraphNode extends NodeSpec {
  i: number;                       // index in graph.nodes
  plugin: string;
  layer: Layer;
  side: Side;
  nets: number;
  body: boolean;
  [key: string]: unknown;
}

/** A resolved edge (indices, not ids). */
export interface GraphEdge {
  i: number;                       // index in graph.edges
  fromId: string;
  toId: string;
  from: number;
  to: number;
  kind: EdgeKind;
  fibre: string | null;
  nets: number;
  len: number;                     // mm
  v: number;                       // m/s
  delay: number;                   // s (§11.4)
  nSyn: number;
  w: number;
  sign: 1 | -1;
  transport: Transport;
  pathId: string | null;
  [key: string]: unknown;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  index: Map<string, number>;
  outOff: Int32Array | number[];
  outEdge: Int32Array | number[];
  inOff: Int32Array | number[];
  inEdge: Int32Array | number[];
  paths: Map<string, Vec3[]>;      // named polylines by pathId
  dropped: EdgeSpec[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------------------------
// Plugins (graph.js contract §1–§9)
// ---------------------------------------------------------------------------------------------

/** What a plugin's create(k) returns: lifecycle hooks plus the module's own constants and indices. */
export interface PluginInstance {
  init?(k: KernelApi): void;
  preSettle?(init: SettleInit, k: KernelApi): void;
  settle?(init: SettleInit, k: KernelApi): void;
  /** Headless pre-roll needed to reach the steady state (s of tH). */
  settleSeconds?: number;
}

export interface Plugin {
  id: string;                      // network modules use their A.3.1 id
  scope: Scope;
  order: number;                   // brainnet 0, sensory 10, somatic 20, autonomic 30, enteric 40, endocrine 50, immune 60
  fragment?(ctx: FragmentContext): Fragment;
  create?(k: KernelApi): PluginInstance | void;
}

export interface SettleInit {
  posture?: 'supine' | 'seated' | 'standing' | (string & {});
  timeOfDay?: number;
  fed?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------------------------
// Kernel (kernel.js, B.4)
// ---------------------------------------------------------------------------------------------

export interface DeclareOptions { unit?: string; basal?: number; body?: boolean }

/** Command record of the orgasm scenario adapter (§11.14), read zero-order hold by tH. */
export interface CommandRecord { tH: number; cmdSym: number; cmdVag: number; cmdSacral: number; apnoea: boolean; omega: number }
export interface CommandSource { commands: { sample(tH: number, out?: object): CommandRecord | null } | CommandRecord[] }

export interface LogEntry { kind: string; node?: string | null; label?: string; fibre?: string; v?: number; tH?: number; [key: string]: unknown }
export interface Packet { edge: number; seq: number; pathId: string | number | null; uHead: number; sigmaU: number; gain: number; amp: number;
  fibre: string | null; dir: 1 | -1; lead: boolean; efference: boolean }

export type LayerHook = (t: number, h: number) => void;

/** The public kernel surface that plugins, the scenario player and main.js use. */
export interface KernelApi {
  readonly graph: Graph;
  readonly t: number;
  readonly tH: number;
  readonly bodyOn: boolean;
  readonly bodyMode: BodyMode;
  readonly vars: Float64Array;
  readonly stores: Record<string, any>;
  /** Declared scalars by A.3.4 name (k.state.<name>), plus `r`, the NF rate array (Hz). */
  readonly state: Record<string, any>;
  readonly cpuMs: number;
  /** Per-plugin options by plugin id (KernelOptions.options; the same object buildGraph receives). */
  readonly options: Record<string, Record<string, unknown>>;

  // State (contract §2)
  declare(name: string, init?: number, opts?: DeclareOptions): number;
  /** Returns nothing: storage is allocated after every create(); fetch the view in init() with array(name). */
  declareArray(name: string, length: number, init?: number): void;
  declareStore(name: string, factory: () => object): void;
  array(name: string): Float64Array;
  idx(name: string): number;
  /** True when a module declared `name`; false for a ref() fallback constant or an unknown name. */
  declared(name: string): boolean;
  ref(name: string, fallback?: number): number;
  get(name: string): number;
  set(name: string, v: number): void;

  // Hooks (contract §4, §5, §8)
  onLayer(layer: Layer, fn: LayerHook, opts?: { always?: boolean }): void;
  onQuiet(layer: Layer, fn: () => boolean): void;
  on(type: string, fn: (payload: any) => void): void;
  dispatch(type: string, payload?: unknown): void;
  onStimulus(fn: (rec: StimulusRecord) => void): void;
  onKhVote(fn: () => number): void;
  plugin(id: string): PluginInstance | undefined;

  // NF rate units (contract §5)
  nodeIndex(id: string): number;
  nfIndex(id: string): number;
  r(j: number): number;
  a(j: number): number;
  aRest(j: number): number;
  rate(id: string): number;
  readDelayed(j: number, d: number): number;
  edgeIndex(fromId: string, toId: string): number;
  setExt(j: number, v: number): void;
  setGain(name: string, v: number): void;
  holdNF(id: string, on: boolean): void;
  rand(layer: Layer): number;
  command(t?: number): CommandRecord | null;
  input(t?: number): Record<string, unknown>;

  // Gating (contract §6)
  g(net: NetId, t?: number): number;
  gate(mask: number, t?: number): number;
  edgeGate(e: number, t?: number): number;
  cutEdge(e: number, cut?: boolean): void;
  /** Partial edge gain g ∈ [0, 1] (§11.12; §6.15 partial preservation); 1 removes it. Reset with the cuts. */
  scaleEdge(e: number, g?: number): void;
  edgeScale(e: number): number;

  // Packets and events (contract §7)
  emitPacket(e: number, opts?: { amp?: number; lead?: boolean; tEmit?: number; efference?: boolean }): void;
  /** Appends to the log ring and returns the stored entry (with seq and tH). */
  log(entry: LogEntry): LogEntry;
  /** Fills `out` with entries newer than `since` (seq) and returns the newest seq. */
  events(out?: LogEntry[], since?: number): number;
  packets(out?: Packet[]): Packet[];

  // Switches, inputs and scheduling (A.5, §11.9, §11.10)
  setBodyMode(mode: BodyMode, tH?: number): void;
  setNet(id: NetId, on: boolean, tH?: number): void;
  setIntervention(preset: InterventionPreset | null, tH?: number): void;
  setPosture(p: string, tH?: number): void;
  setArousalState(s: string, tH?: number): void;
  setAge(age: number, tH?: number): void;
  setExternalCommands(src: CommandSource | null): void;
  setInputs(fn: ((tH: number, k: KernelApi) => Record<string, unknown>) | null): void;
  at(tH: number, type: string, payload?: unknown): void;
  /** Snaps to the NF grid and returns the scheduled tH. */
  schedule(rec: StimulusRecord | { type: string; tH?: number; [key: string]: unknown }): number;
  khTarget(): number;

  // Time (§11.7): advance stops at a step boundary once budgetMs is spent; returns tH reached.
  advance(h: number, budgetMs?: number): number;
  advanceTo(T: number, budgetMs?: number): number;
  settle(init?: SettleInit): void;
  snapshot(): KernelSnapshot;
  restore(s: KernelSnapshot): void;
}

export interface KernelSnapshot { vars: Float64Array | number[]; [key: string]: unknown }

export interface KernelOptions {
  graph?: Graph;
  plugins?: Plugin[];
  seed?: number;
  age?: number;
  settle?: boolean;
  probe?: boolean;
  options?: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------------------------
// Stimuli (stimuli.js, A.6, §4, §5)
// ---------------------------------------------------------------------------------------------

export type SenseId = 'vision' | 'hearing' | 'balance' | 'taste' | 'smell' | 'touch' | 'vibration' | 'pain'
  | 'temperature' | 'proprioception' | 'interoception' | (string & {});
/** Side argument of a stimulus: one side, both, or none (midline sites). */
export type StimulusSide = 'R' | 'L' | 'both' | null;

/** A.6 stimulus record, as makeStimulus returns it and Kernel.schedule takes it. */
export interface StimulusRecord {
  type?: 'stimulus';
  sense: SenseId;
  mode: string;
  site: string;
  side: StimulusSide;
  intensity: number;
  durationMs: number;
  tOnset: number;                  // tH, snapped up to the NF grid by the kernel
  params: Record<string, unknown>;
  [key: string]: unknown;
}

/** Input of makeStimulus: everything optional except the sense; §5.14 defaults fill the rest. */
export interface StimulusSpec {
  sense: SenseId;
  mode?: string;
  site?: string;
  side?: StimulusSide;
  intensity?: number;
  durationMs?: number;
  tOnset?: number;
  params?: Record<string, unknown>;
}

export interface SiteQuery { sense?: SenseId | null; mode?: string | null; side?: StimulusSide; bodyMode?: BodyMode }

export interface SiteResolution {
  site: string;
  kind: 'special' | 'skin' | 'muscle' | 'visceral' | (string & {});
  side: StimulusSide;
  sides: Side[];
  special: boolean;
  nerve: string | null;
  ports: string[];
  pos: Vec3 | null;
  classes: unknown;
}

// ---------------------------------------------------------------------------------------------
// Scenarios (§12.2) and interventions (§11.12, B.4)
// ---------------------------------------------------------------------------------------------

export type ScenarioId = 'hotObject' | 'kneeJerk' | 'loudSound' | 'brightLight' | 'standUp' | 'stressor'
  | 'meal' | 'infection' | 'orgasm' | (string & {});

export interface ClockKey { tH0: number; tH1: number; kh: number }
export interface ScenarioStage { tH: number; name: string; text: string }
/** One scheduled input at t (tH relative to the scenario start; negative = before it): a stimulus spec,
 *  or a control event passed to Kernel.schedule (posture, lps, …). */
export type ScenarioEvent =
  | { t: number; stimulus: StimulusSpec & { unit?: string }; control?: undefined }
  | { t: number; control: { type: string; [key: string]: unknown }; stimulus?: undefined };

/** A §12 checkpoint, evaluated by scenarios.js `evaluate` on a kernel run. */
export interface Checkpoint {
  id: string;
  row: number | null;              // §12.20 row, or null for an unnumbered check
  label: string;
  mode: BodyMode;
  nets: Partial<Record<NetId, boolean>>;
  needs: string[];                 // plugin ids; missing ones turn the check into a todo
  sign: 1 | -1;
  v: string;                       // 'a:<node>' (activation), 'var:<name>' (kernel scalar), …
  m: 'onset' | 'peak' | 'value' | (string & {});
  w?: [number, number];            // evaluation window (s of tH)
  range?: [number, number];        // target range
  thr?: number;
  target?: string;                 // § owning the target
  tolerance?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  seed: number;
  spanH: number;                   // human seconds
  lead: number;                    // s of tH run before t = 0 (settled lead-in)
  /** Plugin ids the scenario needs to play at all; missing ones make it unavailable (A.3.5 greying). */
  requires: string[];
  /** Plugin ids its body forms need (checkpoints list their own `needs`). */
  needs: string[];
  /** 'central' when a brain-only form exists, 'unavailable' otherwise. */
  brainOnly: 'central' | 'unavailable' | (string & {});
  /** True for the orgasm entry: the OrgasmAdapter runs it, the player refuses play and seek. */
  adapter: boolean;
  seek: boolean;
  init: SettleInit;
  events: ScenarioEvent[];
  inputs(tH: number, k: KernelApi): Record<string, unknown>;
  clockKeys: ClockKey[];
  stages: ScenarioStage[];
  checkpoints: Checkpoint[];
  repeat?: { n: number; isi: number };
  variants?: Record<string, { label: string; events?: ScenarioEvent[]; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** What the HUD reads (ui-body.js update): `scenario` in the payload (ScenarioPlayer.hud()). */
export interface ScenarioState { id: ScenarioId | null; active: boolean; tH: number; spanH: number; stage: string; seed?: number; checkpoints?: number[]; [key: string]: unknown }

/** An intervention preset: apply(k) runs after all cuts are reset (contract §6). */
export interface InterventionPreset {
  id: string;
  label?: string;
  net?: NetId;
  params?: Record<string, unknown>;
  apply(k: KernelApi): void;
}
