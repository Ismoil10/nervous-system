// @ts-check
// Simple HUD: the default interface (user decision, 5 November 2026). It keeps only the controls
// that change what the brain and body show: a scenario rail with Pause, Restart and Stop; five
// one-tap senses; Brain or Body; four views; the five body networks. A short story of what is
// happening and, in the orgasm scenario, one dopamine meter are the only readouts. Every other
// control stays in the full HUD (ui.js, ui-body.js), opened with `?advanced=1`.
// Nothing here touches the DOM at import time, so the module also loads in Node tests.

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// Scenario rail: ids of ui-body.js SCENARIOS with short, plain labels.
export const SIMPLE_SCENARIOS = [
  ['hotObject', 'Hot object'], ['loudSound', 'Loud sound'], ['brightLight', 'Bright light'],
  ['kneeJerk', 'Knee jerk'], ['standUp', 'Standing up'], ['meal', 'A meal'], ['stressor', 'Stress'],
  ['infection', 'Infection'], ['orgasm', 'Orgasm'], ['valsalva', 'Straining'], ['coldFace', 'Cold water on the face'],
  ['sleepSound', 'Noise during sleep'],
];
export const scenarioLabel = (id) => SIMPLE_SCENARIOS.find(([s]) => s === id)?.[1] ?? null;

// Where the camera goes when a scenario starts, so the part that reacts is in view [model]. In
// brain-only mode the brain-level scenarios use the whole-brain view; the orgasm scenario flies to
// the dopamine system itself (main.js, B.13).
export const SCENARIO_VIEWS = {
  hotObject: 'rightArm', loudSound: 'headNeck', brightLight: 'headNeck', kneeJerk: 'rightLeg', standUp: 'wholeBody',
  meal: 'abdomen', stressor: 'upperBody', infection: 'upperBody', valsalva: 'thorax', coldFace: 'headNeck', sleepSound: 'headNeck',
};
export const scenarioView = (id, bodyMode) => (id === 'orgasm' ? null : bodyMode === 'body' ? SCENARIO_VIEWS[id] ?? null : 'whole');

// One-tap senses: a fixed A.6 record each (values inside the ui-body.js SENSES ranges). `pick`:
// the user clicks the skin to place it; otherwise it goes to both eyes or both ears at once.
export const SIMPLE_SENSES = [
  { id: 'touch', label: 'Touch', pick: true, record: { sense: 'touch', mode: 'press', intensity: 50, unit: 'mN', durationMs: 1000 } },
  { id: 'pain', label: 'Pinprick', pick: true, record: { sense: 'pain', mode: 'pinprick', intensity: 256, unit: 'mN', durationMs: 20 } },
  { id: 'heat', label: 'Heat', pick: true, record: { sense: 'pain', mode: 'heat', intensity: 48, unit: '°C', durationMs: 1000 } },
  { id: 'sound', label: 'Sound', record: { sense: 'hearing', mode: 'click', intensity: 90, unit: 'dB SPL', durationMs: 0.1, site: 'cochlea', side: 'both' } },
  { id: 'light', label: 'Light', record: { sense: 'vision', mode: 'flash', intensity: 3, unit: 'log₁₀ cd/m²', durationMs: 10, site: 'retina', side: 'both' } },
];
export const senseOf = (id) => SIMPLE_SENSES.find((s) => s.id === id) ?? null;

// Views: three of the brain, two of the body (ui-body.js VIEWS keys).
export const SIMPLE_VIEWS = [
  { id: 'whole', label: 'Brain' }, { id: 'cutaway', label: 'Cutaway' }, { id: 'dopamine', label: 'Dopamine' },
  { id: 'upperBody', label: 'Upper body', body: true }, { id: 'wholeBody', label: 'Whole body', body: true },
];

// Body networks (A.3.1 ids) named by what they reach.
export const SIMPLE_NETS = [
  { id: 'somatic', label: 'Skin and muscle nerves', title: 'Somatic network' },
  { id: 'autonomic', label: 'Heart, lungs and glands', title: 'Autonomic network' },
  { id: 'enteric', label: 'Gut nerves', title: 'Enteric network' },
  { id: 'neuroendocrine', label: 'Hormones', title: 'Neuroendocrine network' },
  { id: 'neuroimmune', label: 'Immune signals', title: 'Neuroimmune network' },
];

// Dopamine meter: accumbens core concentration relative to its tonic baseline, on a log scale.
// Rest (ratio 1) is empty; a fourfold rise fills the bar [model, display only].
export const DA_FULL_RATIO = 4;
export function dopamineLevel(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return clamp(Math.log2(r) / Math.log2(DA_FULL_RATIO), 0, 1);
}

// Plain names of the stations a signal passes (graph node ids of the kernel event log); a prefix
// entry ends in '*'. Stations not listed here are skipped in the story.
const STATIONS = {
  portCoch: 'the inner ear', cochNuc: 'the brainstem', soc: 'the brainstem', ic: 'the midbrain', mgn: 'the thalamus',
  a1: 'the hearing cortex', portRetina: 'the retina', lgn: 'the thalamus', sc: 'the midbrain', pt: 'the midbrain',
  v1: 'the visual cortex', mt: 'the motion area of the cortex', amygdala: 'the amygdala', 's1*': 'the touch area of the cortex',
  's2*': 'the touch area of the cortex', 'thal*': 'the thalamus', 'ins*': 'the insula', dacc: 'the cingulate cortex',
  lc: 'the brainstem', pivc: 'the cortex', 'dh*': 'the spinal cord', 'cord*': 'the spinal cord',
};
export function stationName(id) {
  const s = String(id ?? '');
  if (STATIONS[s]) return STATIONS[s];
  for (const [k, v] of Object.entries(STATIONS)) if (k.endsWith('*') && s.startsWith(k.slice(0, -1))) return v;
  return null;
}

// The newest arrival with a plain station name in a runtime.js event log (newest first), counting
// only entries after `since` (an event id), as one sentence.
export function arrivalSentence(events, since = -Infinity) {
  if (!Array.isArray(events)) return '';
  for (const e of events) {
    if (!e || e.event !== 'arrival' || !(e.id > since)) continue;
    const where = stationName(e.station);
    if (!where) continue;
    const ms = Number(e.tH) * 1000;
    const t = !Number.isFinite(ms) ? '' : ms < 100 ? ` after ${ms.toFixed(1)} ms` : ms < 1000 ? ` after ${Math.round(ms)} ms` : ` after ${(ms / 1000).toFixed(1)} s`;
    return `Reached ${where}${t}.`;
  }
  return '';
}

// A skin site in everyday words: the HUD label without its segment, or the body region of a
// dermatome (A.3.3 ids such as 'dermatome.T7').
const DERMATOME_REGION = {
  C2: 'back of the head', C3: 'neck', C4: 'shoulder', C5: 'outer arm', C6: 'thumb side of the forearm', C7: 'middle finger',
  C8: 'little-finger side of the hand', T1: 'inner arm', T2: 'chest', T3: 'chest', T4: 'chest', T5: 'chest', T6: 'chest',
  T7: 'abdomen', T8: 'abdomen', T9: 'abdomen', T10: 'abdomen', T11: 'abdomen', T12: 'abdomen', L1: 'hip', L2: 'thigh',
  L3: 'knee', L4: 'shin', L5: 'top of the foot', S1: 'outer edge of the foot', S2: 'back of the thigh',
};
export function plainSite(id, hudLabel) {
  if (hudLabel) {
    const s = String(hudLabel).replace(/\s*\([^()]*\)/g, '').trim();
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  const m = String(id ?? '').match(/^dermatome\.([CTLS]\d+)$/);
  if (m && DERMATOME_REGION[m[1]]) return DERMATOME_REGION[m[1]];
  return String(id ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\./g, ' ').toLowerCase();
}

export const REST_STORY = { scenario: '', stage: 'At rest', text: 'Choose a scenario below, or try a sense.' };

// Plain stage titles and one sentence each, for the story (the full HUD keeps the sourced texts of
// scenarios.js and response.js PHASES). Key: `<scenario id>:<stage name>`.
export const PLAIN_STAGES = {
  'orgasm:Baseline': ['Rest', 'The reward system is at rest.'],
  'orgasm:Excitement': ['Arousal builds', 'Dopamine begins to rise in the reward system.'],
  'orgasm:Plateau': ['High arousal', 'Dopamine stays above its resting level.'],
  'orgasm:Onset': ['Onset', 'Dopamine neurons in the midbrain fire faster.'],
  'orgasm:Orgasm': ['Climax', 'Rhythmic muscle contractions. Dopamine peaks in the reward system.'],
  'orgasm:Early resolution': ['Afterwards', 'Arousal falls and dopamine starts to come down.'],
  'orgasm:Late resolution': ['Settling', 'The hormone prolactin stays raised for a while.'],
  'orgasm:Recovery': ['Recovery', 'The body returns to its resting state.'],
  'orgasm:No climax': ['No climax', 'Arousal fades without a climax.'],
  'hotObject:Contact': ['Contact', 'The hand touches a hot object.'],
  'hotObject:Transduction': ['Heat sensed', 'Heat sensors in the skin start firing.'],
  'hotObject:Withdrawal reflex': ['Pull away', 'The spinal cord pulls the hand away before the brain knows.'],
  'hotObject:First pain': ['Sharp pain', 'Fast nerve fibres bring a sharp pain to the brain.'],
  'hotObject:Second pain': ['Burning pain', 'Slower fibres bring a dull, burning second pain.'],
  'hotObject:Autonomic signs': ['Body reacts', 'The palm sweats a little and the heart speeds up.'],
  'loudSound:Sound onset': ['A loud noise', 'A sudden noise reaches both ears.'],
  'loudSound:Auditory brainstem': ['Heard', 'The brainstem picks up the sound within milliseconds.'],
  'loudSound:Startle command': ['Startle', 'A startle reflex makes the eyes blink.'],
  'loudSound:LC phasic burst': ['Alert', 'An alerting centre in the brainstem fires a burst.'],
  'loudSound:Autonomic signs': ['Body reacts', 'The pupils widen, the skin sweats and the heart speeds up.'],
  'loudSound:Recovery': ['Settling', 'Everything returns to rest.'],
  'brightLight:Light step': ['Bright light', 'A bright light shines into the right eye.'],
  'brightLight:Retina and optic nerve': ['Eye to brain', 'The retina turns light into signals in the optic nerve.'],
  'brightLight:Central visual stations': ['Seen', 'Visual centres in the brain respond.'],
  'brightLight:Light reflex': ['Pupils narrow', 'Both pupils narrow to let in less light.'],
  'brightLight:Light off': ['Light off', 'The light goes off and the pupils widen again.'],
  'kneeJerk:Tendon tap': ['Tap', 'A tap below the kneecap stretches the thigh muscle.'],
  'kneeJerk:Stretch reflex': ['Reflex', 'The spinal cord answers in about 20 milliseconds, without the brain.'],
  'kneeJerk:Knee extension': ['Kick', 'The thigh muscle contracts and the lower leg kicks.'],
  'standUp:Stand': ['Standing up', 'The person stands up from lying down.'],
  'standUp:Initial fall': ['Pressure dips', 'Blood pools in the legs and blood pressure dips.'],
  'standUp:Reflex tachycardia': ['Heart speeds up', 'Pressure sensors make the heart beat faster.'],
  'standUp:Upright steady state': ['Steady', 'Heart rate and blood pressure settle at new levels.'],
  'meal:Cephalic phase': ['Anticipation', 'The sight and smell of food prepare the gut.'],
  'meal:Ingestion': ['Eating', 'The meal fills the stomach.'],
  'meal:Gastric emptying': ['Digestion', 'The stomach slowly empties into the intestine.'],
  'meal:Insulin peak': ['Insulin', 'Insulin rises to handle the sugar from the meal.'],
  'stressor:Stressor': ['Stress begins', 'A stressful task starts.'],
  'stressor:Sympatho-adrenal channel': ['Adrenaline', 'Adrenaline rises within minutes.'],
  'stressor:HPA channel': ['Stress hormones', 'The brain signals the adrenal glands, and cortisol follows.'],
  'stressor:Recovery': ['Recovery', 'Cortisol slowly falls back after the task.'],
  'infection:Endotoxin bolus': ['Infection', 'A bacterial toxin enters the blood.'],
  'infection:Cytokines': ['Immune alarm', 'Immune cells release signalling molecules.'],
  'infection:Fever': ['Fever', 'The brain raises the body temperature set point.'],
};

// First sentence of a sourced text, without parentheses and section marks (fallback only).
export function firstSentence(text) {
  const s = String(text ?? '').replace(/\s*\([^()]*\)/g, '').replace(/\s*§[\d.]+/g, '').trim();
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

// The story line of a playing stage: a plain title and sentence when one is known.
export function plainStage(scenarioId, name, text) {
  const base = String(name ?? '').replace(/\s*·\s*trial.*$/, '');
  const trial = String(name ?? '').match(/·\s*(trial.*)$/)?.[1];
  const hit = PLAIN_STAGES[`${scenarioId}:${base}`];
  if (hit) return { stage: trial ? `${hit[0]}, ${trial}` : hit[0], text: hit[1] };
  return { stage: name ?? '', text: firstSentence(text) };
}

// ---- SimpleHud ---------------------------------------------------------------------------------
//
// Handlers: onScenario(id), onPause(), onRestart(), onStop(), onBodyMode('brain' | 'body'),
// onView(id), onNet(id, on), onSense(id | null), onAbout().
// update() payload: { story: { scenario, stage, text }, dopamine: number | null (0–1),
// scenario: { id, active, progress | null } | null, unavailable: { id: reason }, bodyMode, nets,
// view, paused, armed, hint, dimmed }.

export class SimpleHud {
  /**
   * @param {Document} doc
   * @param {Record<string, Function>} h
   */
  constructor(doc, h) {
    this.doc = doc;
    this.h = h;
    const $ = (id) => /** @type {any} */ (doc.getElementById(id));
    this.el = {
      root: $('shud'), scenarioName: $('shud-scenario'), stage: $('shud-stage'), text: $('shud-text'),
      da: $('shud-da'), daBar: $('shud-da-bar'), mode: $('shud-mode'), gear: $('shud-gear'), settings: $('shud-settings'),
      nets: $('shud-nets'), netsNote: $('shud-nets-note'), about: $('shud-about'), views: $('shud-views'),
      tabScn: $('shud-tab-scn'), tabSense: $('shud-tab-sense'), railScn: $('shud-rail-scn'), railSense: $('shud-rail-sense'),
      pause: $('shud-pause'), restart: $('shud-restart'), stop: $('shud-stop'), hint: $('shud-hint'), hintText: $('shud-hint-text'),
      cancel: $('shud-cancel'),
    };
    this.s = { story: null, da: -1, scenario: null, active: false, progress: -1, bodyMode: null, view: null, paused: null,
      armed: null, hint: null, nets: {}, unavailable: {}, dimmed: false, tab: 'scn' };
    this.btn = { scn: new Map(), sense: new Map(), view: new Map(), net: new Map(), mode: new Map() };
    this._build();
    this._bind();
  }

  _make(tag, cls, text) {
    const n = this.doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  _build() {
    const e = this.el;
    for (const [id, label] of SIMPLE_SCENARIOS) {
      const b = this._make('button', 'shud-pill', label);
      b.type = 'button';
      b.dataset.id = id;
      b.setAttribute('aria-pressed', 'false');
      const track = this._make('span', 'shud-progress');
      track.setAttribute('aria-hidden', 'true');
      b.append(track);
      e.railScn.append(b);
      this.btn.scn.set(id, b);
    }
    for (const s of SIMPLE_SENSES) {
      const b = this._make('button', 'shud-pill shud-sense', s.label);
      b.type = 'button';
      b.dataset.id = s.id;
      b.setAttribute('aria-pressed', 'false');
      b.title = s.pick ? `${s.label}: then click a point on the skin` : `${s.label}: delivered to both ${s.id === 'sound' ? 'ears' : 'eyes'}`;
      e.railSense.append(b);
      this.btn.sense.set(s.id, b);
    }
    for (const v of SIMPLE_VIEWS) {
      const b = this._make('button', 'shud-view', v.label);
      b.type = 'button';
      b.dataset.id = v.id;
      b.setAttribute('aria-pressed', 'false');
      e.views.append(b);
      this.btn.view.set(v.id, b);
    }
    for (const n of SIMPLE_NETS) {
      const li = this._make('li');
      const b = this._make('button', 'shud-switch');
      b.type = 'button';
      b.dataset.id = n.id;
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', 'true');
      b.title = n.title;
      b.append(this._make('span', 'shud-switch-label', n.label));
      const track = this._make('span', 'shud-switch-track');
      track.setAttribute('aria-hidden', 'true');
      b.append(track);
      li.append(b);
      e.nets.append(li);
      this.btn.net.set(n.id, b);
    }
    for (const b of e.mode.querySelectorAll('button')) this.btn.mode.set(b.dataset.mode, b);
  }

  _bind() {
    const e = this.el, h = this.h;
    e.railScn.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-pill');
      if (b && !b.disabled) h.onScenario?.(b.dataset.id);
    });
    e.railSense.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-pill');
      if (!b || b.disabled) return;
      const id = b.dataset.id;
      h.onSense?.(this.s.armed === id ? null : id);
    });
    e.views.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-view');
      if (b) h.onView?.(b.dataset.id);
    });
    e.nets.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('.shud-switch');
      if (!b || b.disabled) return;
      h.onNet?.(b.dataset.id, b.getAttribute('aria-checked') !== 'true');
    });
    e.mode.addEventListener('click', (ev) => {
      const b = /** @type {any} */ (ev.target).closest('button');
      if (b) h.onBodyMode?.(b.dataset.mode);
    });
    e.pause.addEventListener('click', () => h.onPause?.());
    e.restart.addEventListener('click', () => h.onRestart?.());
    e.stop.addEventListener('click', () => h.onStop?.());
    e.cancel.addEventListener('click', () => h.onSense?.(null));
    e.about.addEventListener('click', () => { this.openSettings(false); h.onAbout?.(); });
    e.gear.addEventListener('click', () => this.openSettings(e.settings.hidden));
    for (const [tab, name] of [[e.tabScn, 'scn'], [e.tabSense, 'sense']]) tab.addEventListener('click', () => this.setTab(name));
    e.tabScn.parentElement.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      this.setTab(this.s.tab === 'scn' ? 'sense' : 'scn');
      (this.s.tab === 'scn' ? e.tabScn : e.tabSense).focus();
    });
    this.doc.addEventListener('pointerdown', (ev) => {
      if (e.settings.hidden) return;
      const t = /** @type {any} */ (ev.target);
      if (!e.settings.contains(t) && !e.gear.contains(t)) this.openSettings(false);
    });
    this.doc.defaultView?.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = /** @type {any} */ (ev.target);
      if (ev.key === 'Escape') {
        if (!e.settings.hidden) { this.openSettings(false); e.gear.focus(); return; }
        if (this.s.armed) h.onSense?.(null);
        return;
      }
      const typing = t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));
      if (typing) return;
      if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); h.onPause?.(); }
    });
  }

  setTab(name) {
    const e = this.el, scn = name !== 'sense';
    this.s.tab = scn ? 'scn' : 'sense';
    e.tabScn.setAttribute('aria-selected', String(scn));
    e.tabSense.setAttribute('aria-selected', String(!scn));
    e.tabScn.tabIndex = scn ? 0 : -1;
    e.tabSense.tabIndex = scn ? -1 : 0;
    e.railScn.hidden = !scn;
    e.railSense.hidden = scn;
    if (scn && this.s.armed) this.h.onSense?.(null);
  }

  openSettings(open) {
    const e = this.el;
    e.settings.hidden = !open;
    e.gear.setAttribute('aria-expanded', String(!!open));
    if (open) /** @type {any} */ (e.settings.querySelector('button:not([disabled])'))?.focus();
  }

  setPaused(paused) {
    if (paused === this.s.paused) return;
    this.s.paused = paused;
    const b = this.el.pause;
    b.setAttribute('aria-pressed', String(!!paused));
    b.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    b.title = paused ? 'Resume (P)' : 'Pause (P)';
    b.classList.toggle('is-paused', !!paused);
  }

  setDimmed(dimmed) {
    if (dimmed === this.s.dimmed) return;
    this.s.dimmed = dimmed;
    this.el.root.classList.toggle('dimmed', !!dimmed);
  }

  update(p) {
    const e = this.el, s = this.s;
    // Story.
    const st = p.story ?? REST_STORY;
    const key = `${st.scenario}|${st.stage}|${st.text}`;
    if (key !== s.story) {
      s.story = key;
      e.scenarioName.textContent = st.scenario || '';
      e.scenarioName.hidden = !st.scenario;
      e.stage.textContent = st.stage || '';
      e.text.textContent = st.text || '';
      e.text.hidden = !st.text;
    }
    // Dopamine meter (orgasm scenario only).
    const da = p.dopamine == null ? -1 : Math.round(clamp(p.dopamine, 0, 1) * 100);
    if (da !== s.da) {
      s.da = da;
      e.da.hidden = da < 0;
      if (da >= 0) {
        e.daBar.style.transform = `scaleX(${da / 100})`;
        e.da.setAttribute('aria-valuenow', String(da));
        e.da.setAttribute('aria-valuetext', da < 5 ? 'At rest' : da > 95 ? 'At peak' : `${da}% of the way to peak`);
      }
    }
    // Scenario rail.
    const sc = p.scenario;
    const id = sc?.id ?? null, active = !!sc?.active;
    if (id !== s.scenario || active !== s.active) {
      s.scenario = id;
      s.active = active;
      for (const [sid, b] of this.btn.scn) {
        const on = sid === id && active;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('is-playing', on);
      }
      e.restart.disabled = !id;
      e.stop.disabled = !active;
    }
    const prog = sc && active && sc.progress != null ? Math.round(clamp(sc.progress, 0, 1) * 1000) / 1000 : -1;
    if (prog !== s.progress) {
      s.progress = prog;
      const b = id ? this.btn.scn.get(id) : null;
      for (const x of this.btn.scn.values()) x.classList.toggle('has-progress', x === b && prog >= 0);
      if (b && prog >= 0) /** @type {any} */ (b.querySelector('.shud-progress')).style.transform = `scaleX(${prog})`;
    }
    // Availability: networks switched off can make a scenario impossible; "Needs the body" is not a
    // block here, because choosing such a scenario turns the body on.
    const un = p.unavailable ?? {};
    const unKey = JSON.stringify(un);
    if (unKey !== s.unavailableKey) {
      s.unavailableKey = unKey;
      for (const [sid, b] of this.btn.scn) {
        const why = un[sid] && un[sid] !== 'Needs the body' ? un[sid] : '';
        b.disabled = !!why;
        b.hidden = why === 'Not available in this build';
        b.title = why || (un[sid] === 'Needs the body' ? 'Turns the body on and plays' : '');
      }
    }
    // Brain or body.
    if (p.bodyMode && p.bodyMode !== s.bodyMode) {
      s.bodyMode = p.bodyMode;
      for (const [m, b] of this.btn.mode) b.setAttribute('aria-pressed', String(m === p.bodyMode));
      const body = p.bodyMode === 'body';
      for (const [, b] of this.btn.net) b.disabled = !body;
      e.netsNote.hidden = body;
      for (const v of SIMPLE_VIEWS) if (v.body) this.btn.view.get(v.id).title = body ? '' : 'Turns the body on';
    }
    const netKey = JSON.stringify(p.nets ?? {});
    if (netKey !== s.netKey) {
      s.netKey = netKey;
      for (const [nid, b] of this.btn.net) b.setAttribute('aria-checked', String(p.nets?.[nid] !== false));
    }
    if (p.view && p.view !== s.view) {
      s.view = p.view;
      for (const [vid, b] of this.btn.view) b.setAttribute('aria-pressed', String(vid === p.view));
    }
    if (p.paused !== undefined) this.setPaused(!!p.paused);
    // Armed sense and its hint.
    if ((p.armed ?? null) !== s.armed) {
      s.armed = p.armed ?? null;
      for (const [sid, b] of this.btn.sense) b.setAttribute('aria-pressed', String(sid === s.armed));
      this.doc.body.classList.toggle('picking', !!s.armed);
    }
    const hint = p.hint ?? null;
    if (hint !== s.hint) {
      s.hint = hint;
      e.hint.hidden = !hint;
      e.hintText.textContent = hint || '';
      e.cancel.hidden = !s.armed;
    }
    if (p.dimmed !== undefined) this.setDimmed(!!p.dimmed);
  }
}
