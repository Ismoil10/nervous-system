// Brain System runtime (research/ANALYSIS.md B.6, B.9–B.13, §11.7, §11.10, §11.14): the DOM-free part
// of the frame loop. One Runtime owns the clock, the orgasm adapter with its two legacy models, the
// kernel with all seven network plugins and the scenario player, and turns HUD actions into model
// actions. main.js adds rendering, the camera and the HUD; the headless tests drive the same object.
//
// Frame (B.6 steps 1–6). The first three calls are the per-tick contract of the orgasm scenario and
// keep the order of the post-port app (orgasm-regression.test.mjs): the clock proposes [t0H, t0H + h],
// the adapter runs the legacy substeps over it and settles the delegate, the dopamine layer filters in
// screen time. The kernel then follows on the same tH axis through the scenario player (snapshot
// marks, run end), within its CPU budget (§11.7 time slicing), and the clock commits the tH reached.
// While the orgasm delegate holds the clock the kernel carries any unfinished remainder into the next
// frame; once that backlog exceeds one frame it runs past its budget instead of falling further
// behind (§11.14, B.6 step 5).
//
// Assumptions where the spec is silent ([model]): a scenario chosen by URL plays at load; the master
// switch to brain only stops a running scenario only when it is unavailable without the body (the
// central forms keep running); an active intervention is re-applied after Play (the kernel's settle
// clears it); manual stimuli open an episode (clock epoch at onset) only while no scenario plays.

import { Kernel } from './kernel.js';
import { buildGraph, NET_IDS, BODY_BIT } from './graph.js';
import { plugin as brainnet } from './brainnet.js';
import { plugin as sensory } from './sensory.js';
import { plugin as somatic } from './somatic.js';
import { plugin as autonomic } from './autonomic.js';
import { plugin as enteric } from './enteric.js';
import { plugin as endocrine } from './endocrine.js';
import { plugin as immune } from './immune.js';
import { ScenarioPlayer, SCENARIOS, SCENARIO_IDS } from './scenarios.js';
import { OrgasmAdapter } from './orgasm-adapter.js';
import * as interventions from './interventions.js';
import { makeStimulus, resolveSite } from './stimuli.js';
import { SimClock, PARAMS as CLOCK, PRESETS, descentH } from '../clock.js';
import { ResponseModel, PHASES } from '../response.js';
import { DopamineModel } from '../dopamine.js';

// Plugin order as test/orgasm-switched.test.mjs (the kernel sorts by each plugin's `order`).
export const PLUGINS = [brainnet, sensory, somatic, autonomic, enteric, endocrine, immune];

export const PARAMS = {
  eventLog: 50,            // B.9, §13.13 ≤ 50 entries, newest first
  vitalsEvery: 0.1,        // B.9 sparkline: one sample per 0.1 s (tS) …
  vitalsSamples: 600,      // … 600 samples (60 s)
  k1Default: CLOCK.khAnticipate,   // [model] descent target when the site has no packet edge ≥ 50 mm (special senses)
  firstEdgeHops: 4,        // [model] hops searched from the receptor for the first packet edge (B.11 step 4)
  minPacketEdgeMm: 50,     // A.4: packet edges ≥ 50 mm
  transitScreen: 2.5,      // A.4: a leading volley stays ≥ 2.5 screen s in flight
  holdH: 0.005,            // [model] s of tH the descent target is held after onset, until the first packets vote (§11.7)
  transientWindowH: 60,    // [model] s of tH after a switch toggle during which the BP tag may show
  transientSlope: 0.5,     // §11.10: "switch transient (model)" while |dMAP/dt| > 0.5 mmHg/s after a toggle
  sicknessMin: 0.01,       // [model] sickness components shown from 1 %
};

// Vitals rows (B.10) and their kernel variables (A.3.4; display units from the owners).
const VITAL_VARS = { hr: 'hr', sbp: 'sbp', dbp: 'dbp', map: 'map', rr: 'rr', pupilL: 'pupilD.L', pupilR: 'pupilD.R', scl: 'scl',
  tCore: 'tCore', tSet: 'tSet', tSkin: 'tSkin', motility: 'ens.motility', cortisol: 'cortisol', adrenaline: 'adrenaline', il6: 'il6' };
const SICKNESS = ['hyperalgesia', 'anorexia', 'lethargy', 'sleepiness', 'concentration', 'mood', 'anxiety', 'malaise', 'grooming'];
// Sparkline variables (index.html #vitals-var).
const TRACE = ['hr', 'map', 'rr', 'pupil', 'scl', 'tCore', 'cortisol', 'il6'];
const STATES = ['wakeAlert', 'wakeRelaxed', 'n1', 'n2', 'n3', 'rem'];   // BrainNet.STATES order (A.3.4)

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// §11.14 HUD vitals (as test/orgasm-switched.test.mjs hudVitals): pass-through from vitals() with every
// network on, the kernel's CV readouts with a network off, null in brain-only mode.
export function hudVitals(adapter, k) {
  if (!k.bodyOn || adapter.bodyMode === 'brain') return null;
  const switched = NET_IDS.some((n) => k.get(`net.${n}`) === 0);
  if (!switched) return adapter.vitals();
  return { hr: k.get('hr'), rr: k.get('rr'), sbp: k.get('sbp'), dbp: k.get('dbp') };
}

export class Runtime {
  // bodyMode 'body' | 'brain'; nets { id: bool } (missing ids on); seed: ?seed (null = scenario seeds).
  constructor({ seed = null, bodyMode = 'body', nets = {}, graph = null } = {}) {
    const s = Number.isFinite(seed) ? seed : 1;
    this.seed = s;
    this.graph = graph ?? buildGraph({ plugins: PLUGINS });
    const k = this.kernel = new Kernel({ graph: this.graph, plugins: PLUGINS, seed: s, settle: false });
    this.bodyMode = bodyMode === 'brain' ? 'brain' : 'body';
    this.nets = Object.fromEntries(NET_IDS.map((n) => [n, nets[n] !== false]));
    for (const n of NET_IDS) if (!this.nets[n]) k.set(`net.${n}`, 0);
    if (this.bodyMode === 'brain') k.set('bodyMode', 0);
    k.settle({});

    this.model = new ResponseModel({ seed: s });
    this.dopamine = new DopamineModel();
    this.adapter = new OrgasmAdapter(this.model, this.dopamine);
    this.adapter.setBodyMode(this.bodyMode);
    for (const n of NET_IDS) this.adapter.setNet(n, this.nets[n]);
    k.setExternalCommands(this.adapter);
    this.clock = new SimClock({ tH: k.t });
    this.player = new ScenarioPlayer({ kernel: k, clock: this.clock, seed: Number.isFinite(seed) ? seed : null });
    this.brainnet = k.plugin('brainnet');

    this.scenarioId = null;
    this.orgasmMode = this.model.mode;   // the scn-orgasm mode chosen in the HUD (restored on start, B.13)
    this.intervention = null;            // HUD preset payload or null
    this.kernelMs = 0;
    this.overBudget = false;
    this.lastStimulus = null;
    this._log = [];
    this._logSince = 0;
    this._logBuf = [];
    this._toggleH = -Infinity;
    this._mapPrev = { tH: k.t, map: k.get('map') };
    this.trace = Object.fromEntries(TRACE.map((v) => [v, new Float32Array(PARAMS.vitalsSamples).fill(NaN)]));
    this.traceTH = new Float64Array(PARAMS.vitalsSamples).fill(NaN);
    this.traceHead = 0;
    this._traceAcc = 0;
  }

  // ---- Frame (B.6) --------------------------------------------------------------------------------
  frame(sdt, { budgetMs = Infinity } = {}) {
    const { clock, adapter, model, dopamine, kernel: k, player } = this;
    // A.4 adaptive target from the kernel's layer activity (Infinity = no layer active → the idle ×1).
    const kt = k.khTarget();
    clock.setAdaptiveTarget(Number.isFinite(kt) ? kt : CLOCK.khIdle);

    const s = clock.advance(sdt);
    clock.settleDelegate(adapter.advance(sdt, s.t0H, s.h, s.source), adapter.kh);
    model.events.length = 0;
    dopamine.updateVisuals(sdt, model, clock.kh);

    // B.6 steps 4–5: the kernel follows on the same tH axis, then the clock commits the tH reached.
    const T = clock.tH;
    const behind = T - k.t > s.h * (1 + 1e-9) + 1e-12;
    const tR = player.advanceTo(T, behind ? Infinity : budgetMs);
    clock.commit(tR);
    this.kernelMs = player.cpuMs;
    this.overBudget = Number.isFinite(budgetMs) && this.kernelMs > budgetMs;
    this.brainnet.updateVisuals(sdt);   // B.6 step 6 (screen time)
    this._sampleTrace(sdt);
    return s;
  }

  // ---- Scenarios (B.12, B.13) ------------------------------------------------------------------------
  get orgasmActive() { return this.adapter.active; }
  get playing() { return this.adapter.active || this.player.active; }

  select(id) {
    const next = id && SCENARIOS[id] ? id : null;
    if (next === this.scenarioId) return true;
    this.stop();
    this.scenarioId = next;
    this.player.select(next);
    if (next === 'orgasm') this._startOrgasm();   // choosing the orgasm scenario starts it (B.13)
    return true;
  }

  play(id = this.scenarioId) {
    if (id !== this.scenarioId) this.select(id);
    if (!this.scenarioId) return false;
    if (this.scenarioId === 'orgasm') { this._startOrgasm(); return true; }
    if (!this.player.play()) return false;
    this._afterReset();
    return true;
  }

  restart() { return this.play(); }

  repeat() { return this.scenarioId && this.scenarioId !== 'orgasm' ? this.player.repeat() : false; }

  stop() {
    if (this.adapter.active) {
      this.adapter.stop();          // manual mode, level 0, both models at rest (B.13)
      this.clock.delegate(null);    // the adaptive rule applies again (B.12 Stop)
    }
    this.player.stop();
  }

  seek(tH) {
    if (!this.scenarioId || this.scenarioId === 'orgasm') return false;
    const ok = this.player.seek(tH);
    if (ok) { this._resetLog(); this.clearTrace(); }
    return ok;
  }

  _startOrgasm() {
    this.player.stop();
    const { model, dopamine } = this;
    this.adapter.start({ mode: this.orgasmMode, profile: model.profileId, hypothesis: dopamine.hypothesis, seed: this.seed });
    this.clock.delegate(this.adapter.clock);
    this.clock.markEpoch();
  }

  // Settings › Reset [model]: the selected scenario restarts; with none selected the kernel returns to
  // the resting steady state of the current switch set (the intervention is kept).
  reset() {
    if (this.scenarioId) return this.restart();
    const k = this.kernel;
    k.settle({});
    this.clock.tH = k.t;
    this.clock.clearAnticipation();
    this.clock.markEpoch();
    this._afterReset();
    return true;
  }

  // After a Play: the kernel was reset to its cached rest, which clears the intervention and the log.
  _afterReset() {
    if (this.intervention) interventions.apply(this.kernel, this.intervention);
    this._resetLog();
    this.clearTrace();
  }

  // Why each scenario cannot run now; the HUD greys those entries (A.3.5). `ids` may name HUD entries
  // the simulation does not provide (the optional scenarios of §12.16), which are reported too.
  unavailable(ids = SCENARIO_IDS) {
    const out = {};
    for (const id of ids) {
      const sc = SCENARIOS[id];
      if (!sc) { out[id] = 'Not available in this build'; continue; }
      let why = '';
      if (sc.adapter) why = '';
      else if (this.bodyMode === 'brain' && sc.brainOnly === 'unavailable') why = 'Needs the body';
      else {
        const off = (sc.needs ?? []).filter((n) => !this.nets[n]);
        if (off.length) why = `Needs the ${off.join(' and ')} network${off.length > 1 ? 's' : ''}`;
        else if (sc.requires?.some((p) => !this.kernel.plugin(p))) why = 'Not available in this build';
      }
      if (why) out[id] = why;
    }
    return out;
  }

  // HUD scenario payload (ui-body.js update()).
  scenarioHud() {
    const id = this.scenarioId;
    if (!id) return null;
    if (id === 'orgasm') {
      return { id, label: SCENARIOS.orgasm.label, active: this.adapter.active, tH: this.clock.tH - this.clock.epochH, spanH: 0,
        stage: this.adapter.active ? PHASES[this.model.phase].name : '', stages: [], checkpoints: [], seed: this.seed, adapter: true, seek: false, repeat: false };
    }
    return this.player.hud();
  }

  // Status header: stage name ('Rest' when nothing plays) and the Live stage text (B.10, B.12).
  stage() {
    if (this.adapter.active) return { name: PHASES[this.model.phase].name, text: PHASES[this.model.phase].desc };
    if (this.player.active) return { name: this.player.stage || this.scenarioLabel(), text: this.player.stageText || '' };
    return { name: 'Rest', text: '' };
  }
  scenarioLabel() { return this.scenarioId ? SCENARIOS[this.scenarioId].label : ''; }

  // ---- Switches and interventions (A.5, B.11) ----------------------------------------------------------
  setBodyMode(mode) {
    const m = mode === 'brain' ? 'brain' : 'body';
    if (m === this.bodyMode) return;
    this.bodyMode = m;
    this.kernel.setBodyMode(m);
    this.adapter.setBodyMode(m);
    this._toggleH = this.kernel.t;
    if (m === 'brain' && this.player.active && SCENARIOS[this.scenarioId]?.brainOnly === 'unavailable') this.player.stop();
  }

  setNet(id, on) {
    if (!(id in this.nets)) return;
    this.nets[id] = !!on;
    this.kernel.setNet(id, !!on);
    this.adapter.setNet(id, !!on);
    this._toggleH = this.kernel.t;
    const sc = this.scenarioId ? SCENARIOS[this.scenarioId] : null;
    if (!on && this.player.active && sc?.needs?.includes(id)) this.player.stop();
  }

  // One preset at a time (§11.12): a HUD payload ({ id, … }) or null.
  setIntervention(preset) {
    const p = preset && preset.id !== 'none' ? preset : null;
    interventions.apply(this.kernel, p);
    this.intervention = p;
  }

  // HUD id of the active preset (the kernel's record, or the requested one while its event is pending).
  interventionId() {
    const k = this.kernel;
    if (k.evq.some((e) => e.type === 'intervention')) return this.intervention?.id ?? null;
    return interventions.hudId(k.stores._k.intervention);
  }

  setArousalState(id) { if (STATES.includes(id)) this.kernel.setArousalState(id); }
  arousalState() { return STATES[this.kernel.get('arousalState') | 0] ?? null; }
  setAge(y) { if (Number.isFinite(y)) this.kernel.setAge(y); }

  // ---- Clock (A.4) ------------------------------------------------------------------------------------
  lockPreset(name) { if (PRESETS[name]) this.clock.lockPreset(name); }
  lock(kh) { this.clock.lock(kh == null ? null : kh); }

  // ---- Stimuli (B.11, §11.9) -------------------------------------------------------------------------
  // record: the ui-body.js draft { sense, mode, site, side, intensity, durationMs, params, repeat }.
  // Returns { tOnset, k1, records } or null when the record is not valid in this mode.
  deliver(record) {
    const k = this.kernel, c = this.clock;
    const base = { sense: record.sense, mode: record.mode, site: record.site ?? undefined, side: record.side ?? undefined,
      intensity: record.intensity, durationMs: record.durationMs ?? undefined, params: { ...(record.params ?? {}) } };
    let first;
    try { first = makeStimulus({ ...base, tOnset: 0 }); } catch { return null; }
    if (!resolveSite(first.site, { sense: first.sense, mode: first.mode, side: first.side, bodyMode: this.bodyMode })) return null;
    const k1 = this.firstPacketKh(first);
    // tOnset = tH_now + H_desc(kh_now, k1), the stepwise descent sum at the current frame step (§11.7).
    const tOnset = c.tH + descentH(c.kh, k1, c.lastDtS);
    const n = Math.max(1, Math.round(record.repeat?.count ?? 1)), isi = Math.max(0, record.repeat?.intervalS ?? 0);
    const records = [];
    for (let i = 0; i < n; i++) {
      const t = tOnset + i * isi;
      const rec = makeStimulus({ ...base, tOnset: t });
      const tAt = k.schedule(rec);
      c.anticipate(tAt, k1, tAt + PARAMS.holdH);
      records.push(rec);
    }
    if (!this.playing) c.markEpoch(records[0].tOnset);
    this.lastStimulus = records[0];
    return { tOnset: records[0].tOnset, k1, records };
  }

  // k1 of B.11 step 4: the A.4 target of the first packet edge of the picked site, clamp(transit /
  // 2.5 s, 0.005, 1), from the site's receptors over at most a few hops.
  firstPacketKh(rec) {
    const g = this.graph;
    const res = resolveSite(rec.site, { sense: rec.sense, mode: rec.mode, side: rec.side, bodyMode: 'body' });
    if (!res) return PARAMS.k1Default;
    let frontier = g.nodes.filter((n) => n.kind === 'receptor' && n.site === rec.site && res.sides.includes(n.side ?? null)).map((n) => n.i);
    const seen = new Set(frontier);
    for (let hop = 0; hop < PARAMS.firstEdgeHops && frontier.length; hop++) {
      let best = Infinity;
      const next = [];
      for (const u of frontier) {
        for (let q = g.outOff[u]; q < g.outOff[u + 1]; q++) {
          const e = g.edges[g.outEdge[q]];
          if (e.transport === 'layer') continue;
          if ((e.nets & BODY_BIT) && e.len >= PARAMS.minPacketEdgeMm && (e.kind === 'axon' || e.kind === 'tract')) best = Math.min(best, e.len / e.v / 1000);
          if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to); }
        }
      }
      if (best < Infinity) return clamp(best / PARAMS.transitScreen, CLOCK.khMin, 1);
      frontier = next;
    }
    return PARAMS.k1Default;
  }

  // ---- Readouts (B.10) --------------------------------------------------------------------------------
  // Every Vitals row; null values read "—" (brain only, A.8 #10).
  vitals() {
    const k = this.kernel;
    const out = {};
    if (!k.bodyOn || this.bodyMode === 'brain') {
      for (const key of Object.keys(VITAL_VARS)) out[key] = null;
      out.sickness = null;
      return out;
    }
    for (const [key, name] of Object.entries(VITAL_VARS)) { const v = k.get(name); out[key] = Number.isFinite(v) ? v : null; }
    const sick = {};
    for (const c of SICKNESS) { const v = k.get(`sickness.${c}`); if (v >= PARAMS.sicknessMin) sick[c] = v; }
    out.sickness = Object.keys(sick).length ? sick : 0;
    if (this.adapter.active) {
      const v = hudVitals(this.adapter, k);
      if (v) { Object.assign(out, v); out.map = v.dbp + (v.sbp - v.dbp) / 3; }
    }
    return out;
  }

  // Tags beyond ui-body.js vitalTags (B.10): the BP switch transient and the central chemoreflex.
  vitalTags() {
    const k = this.kernel, t = {};
    if (!k.bodyOn) return t;
    const map = k.get('map'), dt = k.t - this._mapPrev.tH;
    if (dt > 0) {
      const slope = Math.abs(map - this._mapPrev.map) / dt;
      this._mapPrev = { tH: k.t, map };
      this._slope = slope;
    }
    if (k.t - this._toggleH < PARAMS.transientWindowH && (this._slope ?? 0) > PARAMS.transientSlope) t.bp = 'switch transient (model)';
    if (!this.nets.autonomic && this.nets.somatic) t.rr = 'central chemoreflex only';
    return t;
  }

  _sampleTrace(sdt) {
    this._traceAcc += sdt;
    if (this._traceAcc < PARAMS.vitalsEvery) return;
    const v = this.vitals();
    while (this._traceAcc >= PARAMS.vitalsEvery) {
      this._traceAcc -= PARAMS.vitalsEvery;
      const i = this.traceHead;
      const val = { ...v, pupil: v.pupilL == null ? null : 0.5 * (v.pupilL + v.pupilR) };
      for (const key of TRACE) this.trace[key][i] = val[key] == null ? NaN : val[key];
      this.traceTH[i] = this.kernel.t;
      this.traceHead = (i + 1) % PARAMS.vitalsSamples;
    }
  }
  // Human time covered by the sparklines (§13.13: labelled with the tH span).
  traceSpanH() {
    let lo = Infinity, hi = -Infinity;
    for (const t of this.traceTH) if (Number.isFinite(t)) { if (t < lo) lo = t; if (t > hi) hi = t; }
    return hi >= lo ? hi - lo : null;
  }
  clearTrace() {
    for (const a of Object.values(this.trace)) a.fill(NaN);
    this.traceTH.fill(NaN);
  }

  // Event log from kernel.events() (B.6 step 11, B.9 ≤ 50 entries, newest first), as ui-body.js
  // formatEvent records. Arrivals carry their latency from stimulus onset; other entries the time
  // since the clock epoch.
  events() {
    const k = this.kernel;
    if (k.logSeq < this._logSince) this._resetLog();
    this._logSince = k.events(this._logBuf, this._logSince);
    for (const e of this._logBuf) {
      const arrival = e.kind === 'arrival';
      this._log.unshift({ id: e.seq, tH: arrival ? e.latencyMs / 1000 : e.tH - this.clock.epochH, station: e.label ?? e.node ?? '',
        event: e.kind, fibre: arrival && e.fibre && e.fibre !== 'cns' ? e.fibre : null, v: arrival ? e.v : null });
    }
    if (this._log.length > PARAMS.eventLog) this._log.length = PARAMS.eventLog;
    return this._log;
  }
  _resetLog() { this._log.length = 0; this._logSince = this.kernel.logSeq; }
}
