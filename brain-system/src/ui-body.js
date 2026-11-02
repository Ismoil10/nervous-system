// HUD extension for the whole-body model (ANALYSIS.md §13.13, B.10–B.12): the Body, Interventions,
// Stimulus, Scenarios, Time, Brain systems and Views dropdowns, and the age, limb-motion and
// reduced-motion rows of Settings. Hud (ui.js) owns one BodyHud and hands it the shared readout
// helpers, so every dropdown uses the same storage prefix and show(). A handler is called only in
// response to a user action. Nothing here touches the DOM at import time, so the module also loads
// in Node tests.
// Assumptions where B.4 is silent: body view keys are camelCase ('wholeBody', 'upperBody', ...);
// intervention ids are those of INTERVENTIONS; the payload fields read by update() and the handler
// signatures are listed above BodyHud.

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const MINUS = '−';
const DASH = '—';

// Every visual or physiological constant of this module, with its owner section.
export const PARAMS = {
  khMin: 0.005,                          // A.4 clock range, human s per screen s
  khMax: 3600,                           // A.4
  rateSteps: 1000,                       // [model] B.10 resolution of the log clock slider
  rateDecade: 10,                        // §13.13 one key press moves the clock by one decade
  scrubMinH: 0.001,                      // §13.13 scrubber axis log10(tH) starts at 1 ms
  scrubKeyStep: 0.05,                    // [model] B.12 keyboard seek step, fraction of the axis
  repeatCounts: [1, 2, 3, 5, 10],        // §12.18 repeat counts (scenario repeat n = 5) [model]
  repeatIntervalsS: [5, 10, 20, 30, 60], // §12.18 inter-stimulus interval choices [model]
  repeatIntervalS: 20,                   // §12.18 isi 20 s
  intensitySteps: 1000,                  // [model] B.10 slider positions of a logarithmic parameter
  durationLogRatio: 20,                  // [model] B.10 a duration slider is logarithmic when max/min ≥ 20
  ageMin: 18,                            // [model] age slider range
  ageMax: 90,                            // [model]
  ageDefault: 30,                        // A.3.4 default age 30 y
  nerveDayMax: 365,                      // §6.15 day slider 0–365 d
  vnsDefault: 50,                        // §11.12 vagus nerve stimulation slider, relative drive % [model]
  sciLevelDefault: 'C6',                 // §6.15 default lesion level
  sciPhaseDefault: 3,                    // [model] B.11 default phase (1–4 weeks)
  arousalDefault: 'wakeRelaxed',         // §3.11 reference state
  psiDigits: 2,                          // §13.14 rule 2: at most two significant figures
};

// ---- Names and labels (A.3, §13.13) -----------------------------------------------------------

export const BODY_MODES = [['brain', 'Brain only'], ['body', 'Whole body']];   // A.3.1

export const NETWORKS = [                                                      // A.3.1
  { id: 'somatic', label: 'Somatic' },
  { id: 'autonomic', label: 'Autonomic' },
  { id: 'enteric', label: 'Enteric' },
  { id: 'neuroendocrine', label: 'Neuroendocrine' },
  { id: 'neuroimmune', label: 'Neuroimmune' },
];

// A.3.5 core scenarios, then the §12.16 optional ones. repeat: offered for Repeat (§12.18);
// seek: false for the orgasm scenario, which has only Restart (§12.2); needs: networks without
// which the scenario cannot run (§12.16).
export const SCENARIOS = [
  { id: 'hotObject', label: 'Touching a hot object', brainOnly: 'unavailable' },
  { id: 'loudSound', label: 'Sudden loud sound', brainOnly: 'central', repeat: true },
  { id: 'brightLight', label: 'Bright light', brainOnly: 'central', repeat: true },
  { id: 'kneeJerk', label: 'Knee jerk', brainOnly: 'unavailable' },
  { id: 'standUp', label: 'Standing up', brainOnly: 'unavailable' },
  { id: 'meal', label: 'Eating a meal', brainOnly: 'unavailable' },
  { id: 'stressor', label: 'Acute stressor', brainOnly: 'central' },
  { id: 'infection', label: 'Infection and fever', brainOnly: 'unavailable' },
  { id: 'orgasm', label: 'Orgasm – dopamine', brainOnly: 'central', seek: false },
  { id: 'valsalva', label: 'Valsalva manoeuvre', brainOnly: 'unavailable', needs: ['somatic'], optional: true },
  { id: 'coldFace', label: 'Cold face immersion', brainOnly: 'unavailable', needs: ['somatic', 'autonomic'], optional: true },
  { id: 'sleepSound', label: 'Sound during sleep', brainOnly: 'central', repeat: true, optional: true },
];
const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

// §13.13 interventions, one at a time (§11.12). params: the parameter rows shown for the preset.
export const INTERVENTIONS = [
  { id: 'none', label: 'None' },
  { id: 'sci', label: 'Spinal cord injury', params: ['sci-level', 'sci-type', 'sci-phase'] },
  { id: 'nerveSection', label: 'Nerve section', params: ['nerve', 'nerve-day'] },
  { id: 'dorsalRhizotomy', label: 'Dorsal rhizotomy' },
  { id: 'heartTransplant', label: 'Heart transplant' },
  { id: 'atropine', label: 'Atropine' },
  { id: 'truncalVagotomy', label: 'Truncal vagotomy' },
  { id: 'sympathectomy', label: 'Sympathectomy T2–T3', params: ['symp-stellate'] },
  { id: 'pureAutonomicFailure', label: 'Pure autonomic failure' },
  { id: 'adrenalectomy', label: 'Adrenalectomy' },
  { id: 'hypophysectomy', label: 'Hypophysectomy' },
  { id: 'splenicDenervation', label: 'Splenic denervation' },
  { id: 'vns', label: 'Vagus nerve stimulation', params: ['vns'] },
];
export const SCI_LEVELS = ['C2', 'C4', 'C6', 'T1', 'T6', 'T10', 'L2', 'S2'];          // §6.15
export const SCI_TYPES = [['complete', 'Complete'], ['brownSequard', 'Brown-Séquard'],  // §6.15
  ['central', 'Central cord'], ['anterior', 'Anterior cord']];
export const SCI_CERVICAL = new Set(['C2', 'C4', 'C6']);                              // §6.15 central cord: cervical presets
export const SCI_PHASES = [[1, 'Phase 1 · 0–1 d'], [2, 'Phase 2 · 1–3 d'],              // §6.15 (Ditunno et al. 2004)
  [3, 'Phase 3 · 1–4 wk'], [4, 'Phase 4 · 1–12 mo']];
export const NERVES = [['radial', 'Radial'], ['median', 'Median'], ['ulnar', 'Ulnar'],  // §6.15
  ['axillary', 'Axillary'], ['musculocutaneous', 'Musculocutaneous'], ['femoral', 'Femoral'],
  ['obturator', 'Obturator'], ['sciatic', 'Sciatic'], ['tibial', 'Tibial'],
  ['commonFibular', 'Common fibular'], ['phrenic', 'Phrenic'], ['cn7.motor', 'Facial (motor)']];

export const TIME_PRESETS = [                                                  // A.4 presets
  ['reflex', 'Reflex', 0.01], ['pain', 'Pain', 0.1], ['autonomic', 'Autonomic', 1], ['gut', 'Gut', 10],
  ['endocrine', 'Endocrine', 60], ['immune', 'Immune', 900], ['circadian', 'Circadian', 3600],
];

export const OVERLAYS = [                                                      // §13.13 Brain systems
  ['thalamocortical', 'Thalamocortical'], ['basalGanglia', 'Basal ganglia loops'],
  ['cerebellar', 'Cerebellar loops'], ['limbic', 'Limbic'], ['hypothalamus', 'Hypothalamus'],
  ['brainstem', 'Brainstem centres'], ['networks', 'Networks'],
];
export const VIEW_TOGGLES = [['skeleton', 'Skeleton'], ['receptors', 'Touch receptors'], ['labels', 'Labels']]; // §13.13, all off

export const AROUSAL_STATES = [                                                // A.3.4, §3.11
  ['wakeAlert', 'Awake, alert'], ['wakeRelaxed', 'Awake, relaxed'], ['n1', 'N1 sleep'],
  ['n2', 'N2 sleep'], ['n3', 'N3 sleep'], ['rem', 'REM sleep'],
];

export const VIEWS = {                                                         // §13.11, §13.13
  brain: [['whole', 'Whole brain'], ['cutaway', 'Cutaway'], ['dopamine', 'Dopamine system']],
  body: [['wholeBody', 'Whole body'], ['upperBody', 'Upper body'], ['headNeck', 'Head & neck'],
    ['thorax', 'Thorax'], ['abdomen', 'Abdomen'], ['torso', 'Torso'], ['spine', 'Spine'],
    ['rightArm', 'Right arm'], ['rightLeg', 'Right leg']],
};
const VIEW_LABEL = new Map([...VIEWS.brain, ...VIEWS.body]);
export const viewLabel = (id) => VIEW_LABEL.get(id) ?? null;
export const isBodyView = (id) => VIEWS.body.some(([v]) => v === id);
// V cycles the views available in the current mode (B.10).
export const viewOrder = (bodyMode) =>
  (bodyMode === 'body' ? [...VIEWS.body, ...VIEWS.brain] : VIEWS.brain).map(([v]) => v);

// ---- Stimuli (A.6, final values §5.14) ----------------------------------------------------------

// A parameter: label, unit, range, default; log: logarithmic slider; marks: §5 markers.
const P = (label, unit, min, max, def, opt = {}) => ({ label, unit, min, max, def, step: 1, ...opt });
const D = (min, max, def) => ({ min, max, def });

const LUMINANCE = P('Luminance', 'log₁₀ cd/m²', -6, 5, 3, { step: 0.1, marks: [-6, -3, -2, 2] });
const LEVEL = P('Level', 'dB SPL', 0, 130, 70, { marks: [0, 85, 90, 110, 120, 130] });
const RISE = { key: 'riseMs', label: 'Rise', unit: 'ms', min: 0.5, max: 20, def: 5, step: 0.5 };
const SKIN_T = [25, 28, 30, 32, 36];                                 // §5.14 TRPM8, neutral zone, baseline
const PATCH_DUR = D(10000, 300000, 60000);                           // §5.14 distensions and fills

// sites: a list of site ids, or a site kind ('skin', 'joint', 'tendon'); sides: Side options for
// sites without their own list; siteFree: the mode needs no site (§13.12).
export const SENSES = [
  { id: 'vision', label: 'Vision', brainOnly: true, sites: ['retina'], modes: [
    { id: 'flash', label: 'Flash', p: LUMINANCE, dur: D(10, 100, 10) },
    { id: 'step', label: 'Step', p: LUMINANCE, dur: D(100, 2000, 1000) },
  ] },
  { id: 'hearing', label: 'Hearing', brainOnly: true, sites: ['cochlea'], modes: [
    { id: 'click', label: 'Click', p: LEVEL, dur: { fixed: 0.1 } },
    { id: 'tone', label: 'Tone', p: LEVEL, dur: D(10, 2000, 200),
      extra: [{ key: 'freqHz', label: 'Frequency', unit: 'Hz', min: 125, max: 8000, def: 1000, log: true }, RISE] },
    { id: 'noise', label: 'Noise', p: LEVEL, dur: D(10, 2000, 200), extra: [RISE] },
  ] },
  { id: 'touch', label: 'Touch', sites: 'skin', modes: [
    { id: 'press', label: 'Press', p: P('Force', 'mN', 0.1, 10000, 50, { log: true, marks: [0.7] }), dur: D(50, 5000, 1000) },
    { id: 'vibration', label: 'Vibration', p: P('Amplitude', 'µm', 0.1, 1000, 10, { log: true }), dur: D(100, 5000, 1000),
      extra: [{ key: 'freqHz', label: 'Frequency', unit: 'Hz', min: 5, max: 400, def: 250, step: 1 }] },
    { id: 'stroke', label: 'Stroke', p: P('Velocity', 'cm/s', 0.3, 30, 3, { step: 0.1, marks: [1, 10] }), dur: D(500, 5000, 2000) },
  ] },
  { id: 'pain', label: 'Pain', sites: 'skin', modes: [
    { id: 'heat', label: 'Heat', p: P('Temperature', '°C', 42, 60, 50, { step: 0.5, marks: [43, 46, 47, 53] }), dur: D(100, 5000, 1000) },
    { id: 'cold', label: 'Cold', p: P('Temperature', '°C', 0, 15, 5, { step: 0.5, marks: [5, 15] }), dur: D(1000, 30000, 5000) },
    { id: 'pinprick', label: 'Pinprick', p: P('Force', 'mN', 8, 512, 256, { marks: [30, 130] }), dur: D(10, 100, 20) },
    { id: 'pressure', label: 'Pressure', p: P('Pressure', 'kPa', 100, 800, 500, { step: 10, marks: [300, 500] }), dur: D(1000, 10000, 3000) },
    { id: 'itch', label: 'Itch', p: P('Strength', 'relative', 0, 1, 0.5, { step: 0.05 }), dur: { fixed: null, text: 'Single event' } },
  ] },
  { id: 'temperature', label: 'Temperature', sites: 'skin', modes: [
    { id: 'warm', label: 'Warm', p: P('Contact', '°C', 15, 45, 40, { step: 0.5, marks: SKIN_T }), dur: D(1000, 60000, 10000),
      extra: [{ key: 'rampCps', label: 'Ramp', unit: '°C/s', min: 0.5, max: 5, def: 1, step: 0.5 }] },
    { id: 'cool', label: 'Cool', p: P('Contact', '°C', 15, 45, 25, { step: 0.5, marks: SKIN_T }), dur: D(1000, 60000, 10000),
      extra: [{ key: 'rampCps', label: 'Ramp', unit: '°C/s', min: 0.5, max: 5, def: 1, step: 0.5 }] },
  ] },
  { id: 'smell', label: 'Smell', brainOnly: true, sites: ['olfEpith'], modes: [
    { id: 'odour', label: 'Odour', p: P('Concentration', 'log₁₀ × threshold', 0, 8, 2, { step: 0.1, marks: [0, 4] }), dur: D(200, 10000, 2000),
      extra: [{ key: 'class', label: 'Odour class', options: [['food', 'Food'], ['neutral', 'Neutral'], ['aversive', 'Aversive']], def: 'food' }] },
  ] },
  { id: 'taste', label: 'Taste', brainOnly: true, sites: ['tongueAnt', 'tonguePost'], modes: ['sweet', 'salty', 'sour', 'bitter', 'umami']
    .map((q) => ({ id: q, label: q[0].toUpperCase() + q.slice(1),
      p: P('Concentration', '× threshold', 0, 100, 10, { step: 0.5, marks: [1] }), dur: D(500, 10000, 2000) })) },
  { id: 'balance', label: 'Balance', brainOnly: true, sites: ['vestLabyrinth'], modes: [
    { id: 'rotation', label: 'Rotation', p: P('Peak angular velocity', 'deg/s', 0, 300, 60, { marks: [1.5] }), dur: D(1000, 60000, 10000),
      extra: [{ key: 'axis', label: 'Axis', options: [['yaw', 'Yaw'], ['pitch', 'Pitch'], ['roll', 'Roll']], def: 'yaw' }] },
    { id: 'linear', label: 'Linear', p: P('Acceleration', 'm/s²', 0, 10, 1, { step: 0.05, marks: [0.1] }), dur: D(200, 5000, 1000) },
    { id: 'tilt', label: 'Tilt', p: P('Angle', 'deg', 0, 30, 10, { step: 0.5, marks: [1.5] }), dur: D(1000, 60000, 10000) },
  ] },
  { id: 'proprioception', label: 'Proprioception', modes: [
    { id: 'imposedMovement', label: 'Imposed movement', sites: 'joint', p: P('Movement', 'deg', 0, 30, 5, { step: 0.5, marks: [1] }),
      dur: { derived: true, text: 'Set by angle and velocity' },
      extra: [{ key: 'velDps', label: 'Velocity', unit: 'deg/s', min: 1, max: 100, def: 10, log: true }] },
    { id: 'tendonTap', label: 'Tendon tap', sites: 'tendon', p: P('Stretch', 'mm', 0.5, 5, 2, { step: 0.1 }), dur: { fixed: 10 } },
  ] },
  { id: 'interoception', label: 'Interoception', modes: [
    { id: 'baroStep', label: 'Baroreceptor step', sites: ['carotidSinus', 'aorticArch'],
      p: P('Pressure step', 'mmHg', -40, 40, 20, { signed: true }), dur: D(1000, 60000, 10000) },
    { id: 'lungInflation', label: 'Lung inflation', sites: ['lungStretch'], p: P('Volume', 'L', 0, 3, 1, { step: 0.1 }), dur: PATCH_DUR },
    { id: 'gastricDistension', label: 'Gastric distension', sites: ['stomachWall'], p: P('Volume', 'mL', 0, 800, 200, { step: 10 }), dur: PATCH_DUR },
    { id: 'duodenalLipid', label: 'Duodenal lipid', sites: ['duodenum'], p: P('Load', 'kcal', 0, 100, 30), dur: PATCH_DUR },
    { id: 'colorectalDistension', label: 'Colorectal distension', sites: ['colonRectum'], p: P('Volume', 'mL', 0, 300, 100, { step: 5 }), dur: PATCH_DUR },
    { id: 'bladderFill', label: 'Bladder filling', sites: ['bladder'], p: P('Volume', 'mL', 0, 600, 300, { step: 10 }), dur: PATCH_DUR },
    { id: 'co2', label: 'Arterial CO₂ rise', siteFree: true, p: P('ΔPaCO₂', 'mmHg', 0, 20, 5, { step: 0.5 }), dur: D(30000, 600000, 120000) },
  ] },
];
const SENSE_BY_ID = new Map(SENSES.map((s) => [s.id, s]));
export const senseById = (id) => SENSE_BY_ID.get(id) ?? null;
// Brain-only mode offers vision, hearing, smell, taste and balance only (A.6).
export const sensesFor = (bodyMode) => SENSES.filter((s) => bodyMode === 'body' || s.brainOnly).map((s) => s.id);

const LR = ['R', 'L'];
const BOTH_LR = ['both', 'R', 'L'];
export const SIDE_LABELS = { both: 'Both', R: 'Right', L: 'Left' };
const S = (id, label, sides = LR) => ({ id, label, sides });

// The keyboard site list of §13.12 (A.3.3 ids). S4–S5, perineal and pelvic-floor sites never appear
// (A.1); dermatome.S3 is pickable only from behind, so it is not listed.
export const SITE_GROUPS = [
  { label: 'Skin, upper limb and neck', kind: 'skin', sites: [
    S('indexTip', 'Index fingertip'), S('dermatome.C6', 'Thumb pad (C6)'), S('dermatome.C7', 'Middle-finger pad (C7)'),
    S('dermatome.C8', 'Little-finger pad (C8)'), S('palm', 'Palm'), S('forearmDorsal', 'Dorsal forearm'),
    S('dermatome.C5', 'Lateral elbow crease (C5)'), S('dermatome.T1', 'Medial elbow crease (T1)'),
    S('dermatome.C4', 'Acromioclavicular joint (C4)'), S('dermatome.C3', 'Supraclavicular fossa (C3)'),
    S('dermatome.C2', 'Occipital protuberance (C2)')] },
  { label: 'Skin, face and trunk', kind: 'skin', sites: [
    S('foreheadV1', 'Forehead (V1)'), S('cheekV2', 'Cheek (V2)'), S('chinV3', 'Chin (V3)'),
    S('dermatome.T4', 'Upper chest (T4)'), S('dermatome.T6', 'Xiphoid level (T6)'), S('umbilicus', 'Umbilicus (T10)', []),
    S('dermatome.T12', 'Lower abdomen (T12)'), S('dermatome.T6.posterior', 'Posterior thorax (T6)')] },
  { label: 'Skin, lower limb', kind: 'skin', sites: [
    S('dermatome.L2', 'Anterior thigh (L2)'), S('dermatome.L3', 'Medial knee (L3)'), S('dermatome.L4', 'Medial malleolus (L4)'),
    S('dermatome.L5', 'Dorsum of foot (L5)'), S('heel', 'Heel'), S('footSole', 'Sole of foot'), S('bigToe', 'Big toe'),
    S('dermatome.S2', 'Popliteal fossa (S2)')] },
  { label: 'Tendons', kind: 'tendon', sites: [
    S('bicepsTendon', 'Biceps tendon'), S('tricepsTendon', 'Triceps tendon'), S('patellarTendon', 'Patellar tendon'),
    S('achillesTendon', 'Achilles tendon')] },
  { label: 'Joints', kind: 'joint', sites: [
    S('shoulder', 'Shoulder'), S('elbow', 'Elbow'), S('wrist', 'Wrist'), S('finger', 'Finger'), S('hip', 'Hip'),
    S('knee', 'Knee'), S('ankle', 'Ankle')] },
  { label: 'Special senses', kind: 'special', sites: [
    S('retina', 'Eye', BOTH_LR), S('cochlea', 'Ear', BOTH_LR), S('olfEpith', 'Nose', BOTH_LR),
    S('tongueAnt', 'Tongue, anterior'), S('tonguePost', 'Tongue, posterior'), S('vestLabyrinth', 'Head (labyrinths)', [])] },
  { label: 'Interoception', kind: 'organ', sites: [
    S('carotidSinus', 'Carotid sinus', BOTH_LR), S('aorticArch', 'Aortic arch', []), S('lungStretch', 'Lung stretch receptors', []),
    S('stomachWall', 'Stomach wall', []), S('duodenum', 'Duodenum', []), S('colonRectum', 'Colon and rectum', []),
    S('bladder', 'Bladder', [])] },
];
const SITE_BY_ID = new Map();
for (const g of SITE_GROUPS) for (const s of g.sites) SITE_BY_ID.set(s.id, { ...s, group: g.label, kind: g.kind });
export const siteById = (id) => SITE_BY_ID.get(id) ?? null;

export function modeOf(sense, modeId) {
  const s = typeof sense === 'string' ? senseById(sense) : sense;
  if (!s) return null;
  return s.modes.find((m) => m.id === modeId) ?? s.modes[0];
}

// Valid keyboard sites for a sense and mode, grouped as in §13.12. In brain-only mode body picking
// is disabled and only the special-sense entries remain (§13.12).
export function sitesFor(senseId, modeId, bodyMode) {
  const s = senseById(senseId);
  const m = modeOf(s, modeId);
  if (!s || !m || m.siteFree) return [];
  const spec = m.sites ?? s.sites;
  const out = [];
  for (const g of SITE_GROUPS) {
    if (bodyMode !== 'body' && g.kind !== 'special') continue;
    const sites = typeof spec === 'string' ? (g.kind === spec ? g.sites : []) : g.sites.filter((x) => spec.includes(x.id));
    if (sites.length) out.push({ label: g.label, sites });
  }
  return out;
}

// ---- Pure helpers (also used by the tests) ---------------------------------------------------

const fmtThousands = (x) => Math.round(x).toLocaleString('en-US');
const trim1 = (x) => x.toFixed(1).replace(/\.0$/, '');

// Clock rate in the A.4 format: ×1/100 below 1, ×n above.
export function formatRate(kh) {
  const k = Number(kh);
  if (!Number.isFinite(k) || k <= 0) return DASH;
  if (Math.abs(k - 1) < 1e-9) return '×1';
  if (k > 1) return `×${k >= 10 ? fmtThousands(k) : trim1(k)}`;
  const n = 1 / k;
  return `×1/${n >= 10 ? fmtThousands(n) : trim1(n)}`;
}

// Human time in the §13.13 units: ms with one decimal below 100 ms, whole ms to 1 s, s with one
// decimal to 60 s, minutes to 60 min, h:mm:ss from 1 h.
export function formatClockTime(tH) {
  const t = Number(tH);
  if (!Number.isFinite(t)) return DASH;
  const a = Math.abs(t), sign = t < 0 ? MINUS : '';
  let s;
  if (a < 0.1) s = `${(a * 1000).toFixed(1)} ms`;
  else if (a < 1) s = `${Math.round(a * 1000)} ms`;
  else if (a < 60) s = `${a.toFixed(1)} s`;
  else if (a < 3600) s = `${a < 600 ? trim1(a / 60) : Math.round(a / 60)} min`;
  else {
    const r = Math.round(a), h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), sec = r % 60;
    s = `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return sign + s;
}

// The A.4 clock label, e.g. "t 23.0 ms  ×1/100".
export const clockLabel = (tH, kh) => `t ${formatClockTime(tH)}  ${formatRate(kh)}`;

// Clock source as the HUD names it (§13.13): a user lock, a scenario (keyframes or delegate) or auto.
export function sourceLabel(source) {
  if (source === 'user' || source === 'lock') return 'lock';
  if (source === 'scenario' || source === 'delegate') return 'scenario';
  if (source === 'adaptive' || source === 'auto') return 'auto';
  return '';
}

const roundSig = (x, n) => (x === 0 ? 0 : Number(x.toPrecision(n)));

// Log clock slider over the A.4 range.
export function khFromSlider(v) {
  const f = clamp(Number(v) / PARAMS.rateSteps, 0, 1);
  return roundSig(PARAMS.khMin * Math.pow(PARAMS.khMax / PARAMS.khMin, f), 3);
}
export function sliderFromKh(kh) {
  const k = clamp(Number(kh) || 1, PARAMS.khMin, PARAMS.khMax);
  return Math.round((PARAMS.rateSteps * Math.log(k / PARAMS.khMin)) / Math.log(PARAMS.khMax / PARAMS.khMin));
}
export const clampKh = (kh) => clamp(kh, PARAMS.khMin, PARAMS.khMax);

// Scrubber axis: log10(tH) from 1 ms to the scenario span (§13.13).
export function tHFromFraction(f, spanH) {
  const lo = Math.log10(PARAMS.scrubMinH), hi = Math.log10(Math.max(spanH, PARAMS.scrubMinH * 10));
  return Math.pow(10, lo + clamp(f, 0, 1) * (hi - lo));
}
export function fractionFromTH(tH, spanH) {
  if (!(tH > PARAMS.scrubMinH)) return 0;
  const lo = Math.log10(PARAMS.scrubMinH), hi = Math.log10(Math.max(spanH, PARAMS.scrubMinH * 10));
  return clamp((Math.log10(tH) - lo) / (hi - lo), 0, 1);
}

// Slider position <-> physical value of a stimulus parameter (linear, or logarithmic over
// PARAMS.intensitySteps positions).
export function valueFromSlider(p, v) {
  if (!p.log) return Number(v);
  const f = clamp(Number(v) / PARAMS.intensitySteps, 0, 1);
  return roundSig(p.min * Math.pow(p.max / p.min, f), 3);
}
export function sliderFromValue(p, x) {
  if (!p.log) return x;
  return Math.round((PARAMS.intensitySteps * Math.log(clamp(x, p.min, p.max) / p.min)) / Math.log(p.max / p.min));
}

export function formatNumber(x, signed = false) {
  const a = Math.abs(x);
  let s;
  if (a >= 100) s = fmtThousands(a);
  else if (a >= 1) s = trim1(a);
  else if (a === 0) s = '0';
  else s = String(roundSig(a, 2));
  if (x < 0) return MINUS + s;
  return signed && x > 0 ? `+${s}` : s;
}
export const formatQuantity = (x, unit, signed) => `${formatNumber(x, signed)} ${unit}`;

export function formatDurationMs(ms) {
  if (ms == null) return DASH;
  if (ms < 10) return `${trim1(ms)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${trim1(ms / 1000)} s`;
  return `${trim1(ms / 60000)} min`;
}

const FIBRES = { Abeta: 'Aβ', Adelta: 'Aδ', Agamma: 'Aγ', Aalpha: 'Aα', Cpost: 'C (postganglionic)', Cmi: 'C (itch)', cns: 'CNS' };
export const fibreLabel = (f) => FIBRES[f] ?? String(f);

// One event-log line: "23.4 ms · S1 hand · arrival · Aβ 65 m/s · model 23.4 ms (target 19–25 ms)".
// A model latency appears only next to its target range (§13.14 rule 3).
export function formatEvent(e) {
  if (!e) return '';
  const parts = [formatClockTime(e.tH)];
  if (e.station) parts.push(String(e.station));
  if (e.event) parts.push(String(e.event));
  if (e.fibre) parts.push(`${fibreLabel(e.fibre)}${Number.isFinite(e.v) ? ` ${formatNumber(e.v)} m/s` : ''}`);
  const t = e.targetMs;
  if (Number.isFinite(e.simMs) && Array.isArray(t) && t.length === 2) {
    const ana = Number.isFinite(e.anaMs) ? `, analytic ${formatNumber(e.anaMs)}` : '';
    parts.push(`model ${formatNumber(e.simMs)} ms${ana} (target ${formatNumber(t[0])}–${formatNumber(t[1])} ms)`);
  }
  if (e.species) parts.push(String(e.species));
  return parts.join(' · ');
}

// Vitals tags when a network is off (B.10; A.5). Brain-only rows read "—" and carry no tag.
export function vitalTags(bodyMode, nets) {
  if (bodyMode !== 'body' || !nets) return {};
  const t = {};
  if (nets.autonomic === false) { t.hr = 'intrinsic'; t.pupil = 'fixed'; t.scl = 'denervated'; }
  if (nets.somatic === false) t.rr = 'maintained';
  if (nets.enteric === false) t.motility = '≈ 0';
  if (nets.neuroendocrine === false) t.cortisol = 'basal';
  if (nets.neuroendocrine === false || nets.autonomic === false) t.adrenaline = 'basal';
  return t;
}
// Long forms shown as tooltips (§13.10, A.8 #8).
export const TAG_TITLES = {
  intrinsic: 'Intrinsic sinoatrial rate: autonomic network off',
  maintained: 'Ventilation maintained (model assumption)',
  fixed: 'Pupils fixed at the denervated diameter',
  denervated: 'Sweat glands denervated',
  basal: 'Plasma level clamped at basal (replacement)',
  clamped: 'Clamped at basal (life-support assumption)',
  '≈ 0': 'Enteric network off: motility index near zero',
};

// Why a scenario is unavailable, or '' (§13.10 "Needs the body"; §12.16).
export function scenarioAvailability(id, bodyMode, nets) {
  const sc = SCENARIO_BY_ID.get(id);
  if (!sc) return 'Unknown scenario';
  if (bodyMode !== 'body' && sc.brainOnly === 'unavailable') return 'Needs the body';
  const off = (sc.needs || []).filter((n) => nets && nets[n] === false);
  if (bodyMode === 'body' && off.length) {
    const names = off.map((n) => NETWORKS.find((x) => x.id === n).label.toLowerCase());
    return `Needs the ${names.join(' and ')} network${off.length > 1 ? 's' : ''}`;
  }
  return '';
}
export const scenarioById = (id) => SCENARIO_BY_ID.get(id) ?? null;

// ---- BodyHud ---------------------------------------------------------------------------------
//
// Handlers (all optional; a control stays disabled while main.js does not pass its handler):
//   onBodyMode('brain' | 'body'), onNet(id, on), onIntervention(preset | null) with preset
//   { id, level?, type?, phase?, nerve?, day?, stellate?, drive? }, onSense(draft), onPick(armed, siteId?, side?),
//   onDeliver(record) with the A.6 record { sense, mode, site, side, intensity, unit, durationMs }
//   plus params and repeat { count, intervalS } (tOnset is added by main.js), onScenario(id),
//   onPlay(id), onStop(), onRestart(), onRepeat(), onSeek(tH), onTimePreset(name), onTimeLock(kh | null),
//   onTimeRate(kh), onOverlay(id, on) (Brain systems overlays and the Views toggles),
//   onArousalState(id), onAge(years), onLimbMotion(on), onReducedMotion('system' | 'on'),
//   onPause() and onView(id) (existing).
// Payload fields read by update() (all optional): bodyMode; nets {id: bool}; intervention (id or
//   null); scenario { id, active, tH, spanH, stage, stages [{ tH, name }], checkpoints [tH], seed };
//   kh; clockSource ('user' | 'scenario' | 'delegate' | 'adaptive'); clock (label); timeHuman (s);
//   arousalState; psi.

export class BodyHud {
  constructor(host, kit) {
    this.host = host;
    this.h = host.h;
    this.k = kit;
    const h = this.h, $ = kit.$;
    const has = (name) => typeof h[name] === 'function';
    this.caps = {
      body: has('onBodyMode'), net: has('onNet'), intervention: has('onIntervention'),
      stimulus: has('onDeliver'), pick: has('onPick'), scenario: has('onScenario'), play: has('onPlay'),
      stop: has('onStop'), restart: has('onRestart'), repeat: has('onRepeat'), seek: has('onSeek'),
      preset: has('onTimePreset'), lock: has('onTimeLock'), rate: has('onTimeRate'), pause: has('onPause'),
      overlay: has('onOverlay'), arousal: has('onArousalState'), age: has('onAge'), limb: has('onLimbMotion'),
      reduced: has('onReducedMotion'),
    };

    // The A.7 defaults apply once main.js handles the body; before that the app is brain only and
    // the orgasm scenario is the one that runs.
    this.bodyMode = this.caps.body ? 'body' : 'brain';
    this.nets = Object.fromEntries(NETWORKS.map((n) => [n.id, true]));
    this.intervention = 'none';
    this.scenarioId = this.caps.scenario ? null : 'orgasm';
    this.scn = { active: !this.caps.scenario, tH: 0, spanH: 0, stage: '', ticksKey: '', fillK: -1 };
    this.paused = false;
    this.time = { locked: false, kh: 1, source: 'adaptive', dragging: false };
    this.overlays = Object.fromEntries([...OVERLAYS, ...VIEW_TOGGLES].map(([id]) => [id, false]));
    this.arousal = PARAMS.arousalDefault;
    this.stim = { sense: this.bodyMode === 'body' ? 'touch' : 'vision', mode: null, site: null, side: null,
      picking: false, reopen: false };
    this.age = PARAMS.ageDefault;
    this.limbMotion = true;
    this.reduced = 'system';

    const q = (sel) => [...document.querySelectorAll(sel)];
    this.el = {
      scene: $('scene'),
      bodyChip: $('body-chip'), modeBrain: $('body-mode-brain'), modeBody: $('body-mode-body'),
      nets: Object.fromEntries(NETWORKS.map((n) => [n.id, $(`net-${n.id}`)])),
      intervention: $('intervention'), intChip: $('intervention-chip'), intPanel: $('interventions-panel'),
      sciLevel: $('sci-level'), sciType: $('sci-type'), sciPhase: $('sci-phase'), nerve: $('nerve'),
      nerveDay: $('nerve-day'), nerveDayVal: $('nerve-day-val'), stellate: $('symp-stellate'),
      vns: $('vns'), vnsVal: $('vns-val'),
      sense: $('sens-sense'), mode: $('sens-mode'), intensity: $('sens-intensity'),
      intensityLabel: $('sens-intensity-label'), intensityVal: $('sens-intensity-val'), marks: $('sens-marks'),
      params: $('sens-params'), duration: $('sens-duration'), durationVal: $('sens-duration-val'),
      side: $('sens-side'), sideField: $('sens-side-field'), site: $('sens-site'), siteField: $('sens-site-field'),
      pick: $('sens-pick'), siteInfo: $('sens-site-info'), psi: $('sens-psi'), psiRow: $('sens-psi-row'),
      repeat: $('sens-repeat'), interval: $('sens-interval'), deliver: $('sens-deliver'), clear: $('sens-clear'),
      info: {
        site: $('sens-info-site'), dermatome: $('sens-info-dermatome'), nerve: $('sens-info-nerve'),
        segment: $('sens-info-segment'), path: $('sens-info-path'), predicted: $('sens-info-predicted'),
      },
      scnChip: $('scn-chip'), radios: Object.fromEntries(SCENARIOS.map((s) => [s.id, $(`scenario-${s.id}`)])),
      play: $('scn-play'), stop: $('scn-stop'), restart: $('scn-restart'), repeatBtn: $('scn-repeat'),
      scrub: $('scn-scrub'), progress: $('scn-progress'), fill: $('scn-fill'), ticks: $('scn-ticks'),
      stage: $('scn-stage'), scnTime: $('scn-time'), seed: $('scn-seed'), orgasm: $('scn-orgasm'),
      timeReadout: $('time-readout'), timeHuman: $('time-human'), presets: q('#time-preset button[data-preset]'),
      rate: $('time-rate'), rateVal: $('time-rate-val'), auto: $('time-auto-auto'), lock: $('time-auto-lock'),
      timePause: $('time-pause'),
      arousal: $('arousal-state'),
      overlays: Object.fromEntries(OVERLAYS.map(([id]) => [id, $(`ov-${id}`)])),
      viewToggles: Object.fromEntries(VIEW_TOGGLES.map(([id]) => [id, $(`view-${id}`)])),
      viewBody: $('view-body'),
      age: $('age'), ageVal: $('age-val'), limb: $('limb-motion'),
      rmSystem: $('reduced-motion-system'), rmOn: $('reduced-motion-on'),
    };
    this.rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.announceAt = 0;

    this._bindBody();
    this._bindInterventions();
    this._bindStimulus();
    this._bindScenarios();
    this._bindTime();
    this._bindBrainsys();
    this._bindSettings();
    this._applyCaps();

    this._fillSense(this.stim.sense);
    this._showBodyMode(this.bodyMode);
    this._showScenario(this.scenarioId);
    this._showInterventionParams();
    this._showTime();
    this._showAge(this.age);
    this._showLimb();
  }

  // ---- Body: master switch and network switches (A.5, B.11) ---------------------------------

  _bindBody() {
    const e = this.el;
    e.modeBrain.addEventListener('click', () => this._userBodyMode('brain'));
    e.modeBody.addEventListener('click', () => this._userBodyMode('body'));
    for (const n of NETWORKS) e.nets[n.id].addEventListener('click', () => this._userNet(n.id));
  }

  _userBodyMode(mode) {
    if (!this.caps.body || mode === this.bodyMode) return;
    this._showBodyMode(mode);
    this.h.onBodyMode(mode);
  }

  toggleBodyMode() {
    this._userBodyMode(this.bodyMode === 'body' ? 'brain' : 'body');
  }

  _showBodyMode(mode) {
    const body = mode === 'body';
    const e = this.el;
    this.bodyMode = body ? 'body' : 'brain';
    for (const [btn, on] of [[e.modeBrain, !body], [e.modeBody, body]]) {
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    // In brain-only mode the network switches are greyed but keep their state (A.7).
    for (const n of NETWORKS) {
      const sw = e.nets[n.id];
      const off = !body || !this.caps.net;
      sw.setAttribute('aria-disabled', String(off));
      sw.title = body ? '' : 'Needs the body';
    }
    // Interventions are greyed in brain-only mode (B.10).
    e.intPanel.classList.toggle('greyed', !body);
    this._showInterventionParams();
    // Body views are hidden in brain-only mode (§13.11, §13.13).
    if (e.viewBody) { e.viewBody.hidden = !body; e.viewBody.disabled = !body; }
    if (e.scene) {
      e.scene.setAttribute('aria-label', body
        ? 'Human brain and body drawn as points: neurons, nerves, organs and the signals travelling along the networks'
        : 'Human brain drawn as neuron points, with released dopamine shown as amber glow');
    }
    if (!body && this.stim.picking) this._setPicking(false, true);
    this._fillSense(this.stim.sense, true);
    this._applyScenarioAvailability();
    this._showBodyChip();
  }

  _userNet(id) {
    if (!this.caps.net || this.bodyMode !== 'body') return;
    this._showNet(id, !this.nets[id]);
    this.h.onNet(id, this.nets[id]);
  }

  _showNet(id, on) {
    if (!(id in this.nets)) return;
    this.nets[id] = !!on;
    this.el.nets[id].setAttribute('aria-checked', String(!!on));
    this._applyScenarioAvailability();
    this._showBodyChip();
  }

  _showBodyChip() {
    const c = this.el.bodyChip;
    const n = NETWORKS.filter((x) => this.nets[x.id]).length;
    const text = this.bodyMode !== 'body' ? 'Brain only' : n < NETWORKS.length ? `${n}/${NETWORKS.length} on` : '';
    this.k.setText(c, text);
    c.hidden = !text;
  }

  // ---- Interventions (§11.12, §6.15) ----------------------------------------------------------

  _bindInterventions() {
    const e = this.el;
    e.intervention.addEventListener('change', () => {
      this.intervention = e.intervention.value;
      this._showInterventionParams();
      this._emitIntervention();
    });
    e.sciLevel.addEventListener('change', () => { this._showInterventionParams(); this._emitIntervention(); });
    for (const el of [e.sciType, e.sciPhase, e.nerve, e.stellate]) el.addEventListener('change', () => this._emitIntervention());
    e.nerveDay.addEventListener('input', () => this.k.setText(e.nerveDayVal, `${e.nerveDay.value} d`));
    e.nerveDay.addEventListener('change', () => this._emitIntervention());
    e.vns.addEventListener('input', () => this.k.setText(e.vnsVal, `${e.vns.value}%`));
    e.vns.addEventListener('change', () => this._emitIntervention());
    this.k.setText(e.nerveDayVal, `${e.nerveDay.value} d`);
    this.k.setText(e.vnsVal, `${e.vns.value}%`);
  }

  _preset() {
    const e = this.el, id = this.intervention;
    if (id === 'none') return null;
    if (id === 'sci') return { id, level: e.sciLevel.value, type: e.sciType.value, phase: Number(e.sciPhase.value) };
    if (id === 'nerveSection') return { id, nerve: e.nerve.value, day: Number(e.nerveDay.value) };
    if (id === 'sympathectomy') return { id, stellate: e.stellate.checked };
    if (id === 'vns') return { id, drive: Number(e.vns.value) / 100 };
    return { id };
  }

  _emitIntervention() {
    if (!this.caps.intervention || this.bodyMode !== 'body') return;
    this.h.onIntervention(this._preset());
  }

  _showInterventionParams() {
    const e = this.el;
    const def = INTERVENTIONS.find((x) => x.id === this.intervention) ?? INTERVENTIONS[0];
    const shown = new Set(def.params || []);
    for (const row of e.intPanel.querySelectorAll('[data-param]')) row.hidden = !shown.has(row.dataset.param);
    // Central cord is offered for the cervical presets only (§6.15).
    const central = e.sciType.querySelector('option[value="central"]');
    const cervical = SCI_CERVICAL.has(e.sciLevel.value);
    central.disabled = !cervical;
    if (!cervical && e.sciType.value === 'central') e.sciType.value = 'complete';
    const off = this.bodyMode !== 'body' || !this.caps.intervention;
    for (const el of e.intPanel.querySelectorAll('select, input')) el.disabled = off;
    const active = this.intervention !== 'none';
    this.k.setText(e.intChip, active ? 'Active' : '');
    e.intChip.hidden = !active;
  }

  // ---- Stimulus (A.6, B.11, §13.12) ------------------------------------------------------------

  _bindStimulus() {
    const e = this.el, k = this.k;
    e.sense.addEventListener('change', () => { this._fillSense(e.sense.value); this._notifySense(); });
    e.mode.addEventListener('change', () => { this._fillMode(e.mode.value); this._notifySense(); });
    e.intensity.addEventListener('input', () => {
      this._showIntensity();
      if (this._mode().dur.derived) this._showDuration();
    });
    // Imposed movement: the duration follows the velocity field (§5.14).
    e.params.addEventListener('input', () => { if (this._mode().dur.derived) this._showDuration(); });
    e.duration.addEventListener('input', () => this._showDuration());
    e.side.addEventListener('change', () => {
      this.stim.side = e.side.value || null;
      if (this.stim.site) this._renderSiteInfo({ id: this.stim.site });
      if (this.stim.site && this.caps.pick) this.h.onPick(false, this.stim.site, this.stim.side);
    });
    e.site.addEventListener('change', () => this._userSite(e.site.value || null));
    e.pick.addEventListener('click', () => this._setPicking(!this.stim.picking, true));
    e.deliver.addEventListener('click', () => this._deliver());
    e.clear.addEventListener('click', () => this._clearSite(true));
    for (const n of PARAMS.repeatCounts) e.repeat.append(new Option(n === 1 ? 'Once' : `${n} times`, String(n)));
    for (const s of PARAMS.repeatIntervalsS) e.interval.append(new Option(`every ${s} s`, String(s)));
    e.repeat.value = '1';
    e.interval.value = String(PARAMS.repeatIntervalS);
    e.repeat.addEventListener('change', () => { e.interval.disabled = e.repeat.value === '1' || !this.caps.stimulus; });
    e.interval.disabled = true;
    k.setText(e.psi, DASH);
  }

  _sense() { return senseById(this.stim.sense); }
  _mode() { return modeOf(this._sense(), this.stim.mode); }

  // Rebuilds the sense, mode, parameter and site controls. keepSite keeps a still-valid site.
  _fillSense(senseId, keepSite = false) {
    const e = this.el;
    const allowed = sensesFor(this.bodyMode);
    const id = allowed.includes(senseId) ? senseId : allowed[0];
    for (const opt of e.sense.options) opt.disabled = !allowed.includes(opt.value);
    const changed = id !== this.stim.sense;
    this.stim.sense = id;
    if (e.sense.value !== id) e.sense.value = id;
    const s = this._sense();
    e.mode.replaceChildren(...s.modes.map((m) => new Option(m.label, m.id)));
    const modeId = !changed && s.modes.some((m) => m.id === this.stim.mode) ? this.stim.mode : s.modes[0].id;
    e.mode.disabled = s.modes.length < 2 || !this.caps.stimulus;
    this._fillMode(modeId, keepSite && !changed);
  }

  _fillMode(modeId, keepSite = false) {
    const e = this.el, k = this.k;
    const m = modeOf(this._sense(), modeId);
    this.stim.mode = m.id;
    if (e.mode.value !== m.id) e.mode.value = m.id;

    // Main parameter: a range input with the §5 markers as datalist ticks.
    const p = m.p;
    k.setText(e.intensityLabel, `${p.label} (${p.unit})`);
    e.intensity.min = String(p.log ? 0 : p.min);
    e.intensity.max = String(p.log ? PARAMS.intensitySteps : p.max);
    e.intensity.step = String(p.log ? 1 : p.step);
    e.intensity.value = String(sliderFromValue(p, p.def));
    e.marks.replaceChildren(...(p.marks || [])
      .filter((x) => x >= p.min && x <= p.max)
      .map((x) => new Option('', String(sliderFromValue(p, x)))));
    this._showIntensity();

    // Secondary parameters (frequency, rise, class, axis, ramp, velocity).
    e.params.replaceChildren(...(m.extra || []).map((x) => this._extraField(x)));

    // Duration: a fixed value, a derived one, or a range (logarithmic when wide).
    const d = m.dur;
    const ranged = d.min != null;
    e.duration.disabled = !ranged || !this.caps.stimulus;
    if (ranged) {
      const lp = { min: d.min, max: d.max, log: d.max / d.min >= PARAMS.durationLogRatio, step: d.min < 100 ? 1 : 10 };
      this.durSpec = lp;
      e.duration.min = String(lp.log ? 0 : lp.min);
      e.duration.max = String(lp.log ? PARAMS.intensitySteps : lp.max);
      e.duration.step = String(lp.log ? 1 : lp.step);
      e.duration.value = String(sliderFromValue(lp, d.def));
    } else {
      this.durSpec = null;
    }
    this._showDuration();
    this._fillSites(keepSite);
  }

  _extraField(x) {
    const k = this.k;
    const field = document.createElement('div');
    field.className = 'field';
    const id = `sens-x-${x.key}`;
    const head = document.createElement('div');
    head.className = 'field-head';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = x.unit ? `${x.label} (${x.unit})` : x.label;
    head.append(label);
    let input;
    if (x.options) {
      input = document.createElement('select');
      for (const [v, t] of x.options) input.append(new Option(t, v));
      input.value = x.def;
      field.append(head, input);
    } else {
      const val = document.createElement('span');
      val.className = 'field-val';
      head.append(val);
      input = document.createElement('input');
      input.type = 'range';
      input.min = String(x.log ? 0 : x.min);
      input.max = String(x.log ? PARAMS.intensitySteps : x.max);
      input.step = String(x.log ? 1 : x.step ?? 1);
      input.value = String(sliderFromValue(x, x.def));
      const showVal = () => {
        const text = formatQuantity(valueFromSlider(x, input.value), x.unit);
        k.setText(val, text);
        input.setAttribute('aria-valuetext', text);
      };
      input.addEventListener('input', showVal);
      showVal();
      field.append(head, input);
    }
    input.id = id;
    input.dataset.key = x.key;
    input.dataset.log = x.log ? '1' : '';
    input.disabled = !this.caps.stimulus;
    return field;
  }

  _showIntensity() {
    const e = this.el, p = this._mode().p;
    const text = formatQuantity(valueFromSlider(p, e.intensity.value), p.unit, p.signed || p.min < 0);
    this.k.setText(e.intensityVal, text);
    e.intensity.setAttribute('aria-valuetext', text);
  }

  _durationMs() {
    const m = this._mode(), d = m.dur;
    if (this.durSpec) return valueFromSlider(this.durSpec, this.el.duration.value);
    if (d.derived) {                       // imposed movement: angle ÷ velocity (§5.14)
      const vel = this.el.params.querySelector('[data-key="velDps"]');
      const v = vel ? valueFromSlider(m.extra.find((x) => x.key === 'velDps'), vel.value) : 10;
      return Math.round((1000 * valueFromSlider(m.p, this.el.intensity.value)) / Math.max(1e-6, v));
    }
    return d.fixed ?? null;
  }

  _showDuration() {
    const e = this.el, d = this._mode().dur;
    const text = this.durSpec || d.fixed != null ? formatDurationMs(this._durationMs()) : d.text;
    this.k.setText(e.durationVal, text);
    e.duration.setAttribute('aria-valuetext', text);
  }

  // Keyboard site list for the sense and mode (§13.12); a single valid site is chosen at once.
  _fillSites(keepSite) {
    const e = this.el, m = this._mode();
    const groups = sitesFor(this.stim.sense, m.id, this.bodyMode);
    const placeholder = new Option(m.siteFree ? 'Whole body (no site)' : 'Choose a site', '');
    const nodes = [placeholder];
    for (const g of groups) {
      const og = document.createElement('optgroup');
      og.label = g.label;
      for (const s of g.sites) og.append(new Option(s.label, s.id));
      nodes.push(og);
    }
    e.site.replaceChildren(...nodes);
    const ids = groups.flatMap((g) => g.sites.map((s) => s.id));
    let site = keepSite && ids.includes(this.stim.site) ? this.stim.site : null;
    if (!site && ids.length === 1) site = ids[0];
    e.site.disabled = m.siteFree || !this.caps.stimulus;
    // Picking on the figure needs the body and a site-bound mode (§13.12).
    const canPick = this.caps.pick && this.bodyMode === 'body' && groups.length > 0;
    e.pick.disabled = !canPick;
    if (!canPick && this.stim.picking) this._setPicking(false, true);
    this._selectSite(site);
  }

  _selectSite(id) {
    const e = this.el;
    this.stim.site = id;
    if (id && ![...e.site.options].some((o) => o.value === id)) {
      // A site picked on the figure that is not in the keyboard list.
      e.site.insertBefore(new Option(siteById(id)?.label ?? id, id), e.site.options[1] ?? null);
    }
    e.site.value = id ?? '';
    this._fillSides();
    this._renderSiteInfo(id ? { id } : null);
    this._showDeliver();
  }

  _fillSides() {
    const e = this.el;
    const site = siteById(this.stim.site);
    const sides = site ? site.sides : [];
    e.side.replaceChildren(...sides.map((s) => new Option(SIDE_LABELS[s], s)));
    this.stim.side = sides.length ? (sides.includes(this.stim.side) ? this.stim.side : sides[0]) : null;
    if (this.stim.side) e.side.value = this.stim.side;
    e.sideField.hidden = sides.length === 0;
    e.side.disabled = !this.caps.stimulus;
  }

  _userSite(id) {
    this._selectSite(id);
    if (this.caps.pick) this.h.onPick(false, id, this.stim.side);
  }

  _clearSite(notify) {
    if (this.stim.picking) this._setPicking(false, notify);
    const m = this._mode();
    const ids = sitesFor(this.stim.sense, m.id, this.bodyMode).flatMap((g) => g.sites.map((s) => s.id));
    this._selectSite(ids.length === 1 ? ids[0] : null);
    this.k.setText(this.el.psi, DASH);
    if (notify && this.caps.pick) this.h.onPick(false, this.stim.site, this.stim.side);
  }

  // Readout lines of §13.12: Site, Dermatome, Nerve, Segment, Path, Predicted. Fields the caller
  // does not provide stay hidden.
  _renderSiteInfo(info) {
    const e = this.el, k = this.k, I = e.info;
    const row = (el, text) => {
      const has = text != null && text !== '';
      el.parentElement.hidden = !has;
      if (has) k.setText(el, text);
    };
    if (!info) {
      e.siteInfo.hidden = true;
      return;
    }
    e.siteInfo.hidden = false;
    if (info.valid === false) {
      row(I.site, 'No valid site');
      for (const key of ['dermatome', 'nerve', 'segment', 'path', 'predicted']) row(I[key], null);
      return;
    }
    const s = siteById(info.id);
    const label = info.label ?? s?.label ?? info.id;
    const side = this.stim.side ? ` · ${SIDE_LABELS[this.stim.side]}` : '';
    row(I.site, `${label}${side}`);
    row(I.dermatome, info.dermatome);
    row(I.nerve, info.nerve);
    row(I.segment, info.segment);
    row(I.path, Number.isFinite(info.pathMm) ? `${fmtThousands(info.pathMm)} mm` : null);
    const pr = info.predicted;
    // A model latency is shown only next to its target range (§13.14 rule 3).
    const ok = pr && Number.isFinite(pr.ms) && Array.isArray(pr.targetMs) && pr.targetMs.length === 2;
    row(I.predicted, ok
      ? `${formatNumber(pr.ms)} ms${pr.station ? ` at ${pr.station}` : ''} (target ${formatNumber(pr.targetMs[0])}–${formatNumber(pr.targetMs[1])} ms)`
      : null);
  }

  // Pick-on-body mode. On small screens the Stimulus popover steps aside so the figure can be
  // clicked, and comes back with the readout once main.js reports the site (setSite).
  _setPicking(on, notify) {
    const armed = !!on && this.bodyMode === 'body' && !this.el.pick.disabled;
    const host = this.host, d = host.drops.stimulus;
    const changed = armed !== this.stim.picking;
    this.stim.picking = armed;
    this.el.pick.classList.toggle('active', armed);
    this.el.pick.setAttribute('aria-pressed', String(armed));
    document.body.classList.toggle('picking', armed);
    if (armed && host.narrow.matches && d && d.open) {
      this.stim.reopen = true;
      host._setOpen(d, false);
    } else if (!armed && this.stim.reopen) {
      this.stim.reopen = false;
      if (d && !d.open) host._setOpen(d, true);
    }
    if (notify && changed && this.caps.pick) this.h.onPick(armed);
  }

  // Esc cancels picking first (B.10). Returns whether it did.
  cancelPicking() {
    if (!this.stim.picking) return false;
    this._setPicking(false, true);
    return true;
  }

  // Esc inside the site list clears the site (§13.12).
  clearSiteIfFocused(target) {
    if (target !== this.el.site || !this.stim.site) return false;
    this._clearSite(true);
    return true;
  }

  // Enter fires the stimulus while focus is inside the Stimulus dropdown (B.10); buttons keep
  // their native Enter.
  handleEnter(ev) {
    const d = this.host.drops.stimulus;
    const t = ev.target;
    if (!d || !d.open || !d.body.contains(t) || t instanceof HTMLButtonElement) return false;
    ev.preventDefault();
    this._deliver();
    return true;
  }

  _draft() {
    const e = this.el, m = this._mode();
    const params = {};
    for (const x of m.extra || []) {
      const input = e.params.querySelector(`[data-key="${x.key}"]`);
      if (input) params[x.key] = x.options ? input.value : valueFromSlider(x, input.value);
    }
    return {
      sense: this.stim.sense, mode: m.id, site: m.siteFree ? null : this.stim.site, side: this.stim.side,
      intensity: valueFromSlider(m.p, e.intensity.value), unit: m.p.unit, durationMs: this._durationMs(), params,
    };
  }

  _notifySense() {
    if (this.caps.stimulus && typeof this.h.onSense === 'function') this.h.onSense(this._draft());
  }

  _canDeliver() {
    const m = this._mode();
    return this.caps.stimulus && sensesFor(this.bodyMode).includes(this.stim.sense) && (m.siteFree || !!this.stim.site);
  }

  _showDeliver() {
    const ok = this._canDeliver();
    this.el.deliver.disabled = !ok;
    this.el.clear.disabled = !this.caps.stimulus;
  }

  _deliver() {
    if (!this._canDeliver()) return;
    const e = this.el;
    const record = { ...this._draft(), repeat: { count: Number(e.repeat.value), intervalS: Number(e.interval.value) } };
    this.h.onDeliver(record);
  }

  // ---- Scenarios (B.12, §12.2) ------------------------------------------------------------------

  _bindScenarios() {
    const e = this.el;
    for (const sc of SCENARIOS) {
      e.radios[sc.id].addEventListener('change', () => { if (e.radios[sc.id].checked) this._userScenario(sc.id); });
    }
    e.play.addEventListener('click', () => {
      if (this.scn.active) { if (this.caps.pause) this.h.onPause(); }
      else if (this.scenarioId && this.caps.play) this.h.onPlay(this.scenarioId);
    });
    e.stop.addEventListener('click', () => { if (this.caps.stop) this.h.onStop(); });
    e.restart.addEventListener('click', () => { if (this.caps.restart) this.h.onRestart(); });
    e.repeatBtn.addEventListener('click', () => { if (this.caps.repeat) this.h.onRepeat(); });

    // The scrubber seeks on press and with the arrow keys; seeking replays deterministically (§12.2).
    const p = e.progress;
    p.addEventListener('pointerdown', (ev) => {
      if (!this._canSeek() || ev.button !== 0) return;
      ev.preventDefault();
      const r = p.getBoundingClientRect();
      this._userSeek((ev.clientX - r.left) / Math.max(1, r.width));
    });
    p.addEventListener('keydown', (ev) => {
      if (!this._canSeek()) return;
      const f = fractionFromTH(this.scn.tH, this.scn.spanH);
      let to = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') to = f + PARAMS.scrubKeyStep;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') to = f - PARAMS.scrubKeyStep;
      else if (ev.key === 'Home') to = 0;
      else if (ev.key === 'End') to = 1;
      if (to === null) return;
      ev.preventDefault();
      this._userSeek(clamp(to, 0, 1));
    });
  }

  _userScenario(id) {
    if (!this.caps.scenario || id === this.scenarioId) return;
    this._showScenario(id);
    this.h.onScenario(id);
  }

  _canSeek() {
    const sc = scenarioById(this.scenarioId);
    return this.caps.seek && !!sc && sc.seek !== false && this.scn.spanH > 0;
  }

  _userSeek(f) {
    const tH = tHFromFraction(f, this.scn.spanH);
    this.scn.tH = tH;
    this._showProgress();
    this.h.onSeek(tH);
  }

  _showScenario(id) {
    const e = this.el;
    this.scenarioId = id && SCENARIO_BY_ID.has(id) ? id : null;
    for (const sc of SCENARIOS) {
      const r = e.radios[sc.id];
      if (r.checked !== (sc.id === this.scenarioId)) r.checked = sc.id === this.scenarioId;
    }
    const sc = scenarioById(this.scenarioId);
    e.orgasm.hidden = this.scenarioId !== 'orgasm';
    e.repeatBtn.hidden = !(sc && sc.repeat);
    this._applyScenarioAvailability();
    this._showScenarioControls();
  }

  // Greys entries that cannot run in the current mode or switch set (A.3.5, §13.10, §12.16).
  _applyScenarioAvailability() {
    const e = this.el;
    for (const sc of SCENARIOS) {
      const r = e.radios[sc.id];
      let why = scenarioAvailability(sc.id, this.bodyMode, this.nets);
      if (!why && !this.caps.scenario && sc.id !== this.scenarioId) why = 'Not available in this build';
      r.disabled = !!why;
      r.closest('label').title = why;
    }
    this._showScenarioControls();
  }

  _showScenarioControls() {
    const e = this.el, k = this.k;
    const sc = scenarioById(this.scenarioId);
    const available = !!sc && !scenarioAvailability(sc.id, this.bodyMode, this.nets);
    const active = this.scn.active;
    k.setText(e.play, active ? (this.paused ? 'Resume' : 'Pause') : 'Play');
    e.play.setAttribute('aria-pressed', String(active && !this.paused));
    e.play.disabled = active ? !this.caps.pause : !(available && this.caps.play);
    e.stop.disabled = !(active && this.caps.stop);
    e.restart.disabled = !(available && this.caps.restart);
    e.repeatBtn.disabled = !(available && this.caps.repeat);
    const chip = active ? (this.paused ? 'paused' : 'playing') : '';
    k.setText(e.scnChip, chip);
    e.scnChip.hidden = !chip;
    const seekable = !!sc && sc.seek !== false && this.scn.spanH > 0;
    e.scrub.hidden = !seekable;
    e.progress.setAttribute('aria-disabled', String(!this._canSeek()));
  }

  _showProgress() {
    const e = this.el, s = this.scn;
    const f = fractionFromTH(s.tH, s.spanH);
    const fk = Math.round(f * 1000);
    if (fk !== s.fillK) {
      s.fillK = fk;
      e.fill.style.transform = `scaleX(${fk / 1000})`;
      e.progress.setAttribute('aria-valuenow', String(fk));
      e.progress.setAttribute('aria-valuetext', `${formatClockTime(s.tH)} of ${formatClockTime(s.spanH)}`);
    }
  }

  // Stage markers and checkpoint ticks on the log axis, rebuilt only when the scenario changes.
  _showTicks(sc) {
    const s = this.scn;
    const stages = Array.isArray(sc?.stages) ? sc.stages : [];
    const checks = Array.isArray(sc?.checkpoints) ? sc.checkpoints : [];
    const key = `${sc?.id}|${s.spanH}|${stages.length}|${checks.length}`;
    if (key === s.ticksKey) return;
    s.ticksKey = key;
    const make = (tH, cls, title) => {
      const t = document.createElement('span');
      t.className = cls;
      t.style.left = `${(fractionFromTH(tH, s.spanH) * 100).toFixed(2)}%`;
      if (title) t.title = title;
      return t;
    };
    this.el.ticks.replaceChildren(
      ...checks.filter(Number.isFinite).map((tH) => make(tH, 'scrub-tick', '')),
      ...stages.filter((x) => Number.isFinite(x?.tH)).map((x) => make(x.tH, 'scrub-stage', x.name ? `${x.name} · ${formatClockTime(x.tH)}` : '')),
    );
  }

  // ---- Time (A.4, §13.13) ---------------------------------------------------------------------

  _bindTime() {
    const e = this.el;
    for (const b of e.presets) {
      b.addEventListener('click', () => {
        if (!this.caps.preset) return;
        const p = TIME_PRESETS.find(([id]) => id === b.dataset.preset);
        this.time.locked = true;
        this.time.kh = p[2];
        this._showTime();
        this.h.onTimePreset(p[0]);
      });
    }
    e.rate.addEventListener('input', () => {
      if (!this.caps.rate) return;
      const kh = khFromSlider(e.rate.value);
      if (kh === this.time.kh && this.time.locked) return;
      this.time.locked = true;
      this.time.kh = kh;
      this._showTime(true);
      this.h.onTimeRate(kh);
    });
    e.rate.addEventListener('pointerdown', () => { this.time.dragging = true; });
    const end = () => { this.time.dragging = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    e.auto.addEventListener('click', () => this._userLock(false));
    e.lock.addEventListener('click', () => this._userLock(true));
    e.timePause.addEventListener('click', () => { if (this.caps.pause) this.h.onPause(); });
  }

  _userLock(lock) {
    if (!this.caps.lock || lock === this.time.locked) return;
    this.time.locked = lock;
    this._showTime();
    this.h.onTimeLock(lock ? this.time.kh : null);
  }

  // L key.
  toggleTimeLock() {
    this._userLock(!this.time.locked);
  }

  // [ and ] keys: one decade down or up (§13.13).
  stepRate(dir) {
    if (!this.caps.rate) return;
    const kh = clampKh(this.time.kh * Math.pow(PARAMS.rateDecade, dir < 0 ? -1 : 1));
    if (kh === this.time.kh && this.time.locked) return;
    this.time.locked = true;
    this.time.kh = kh;
    this._showTime();
    this.h.onTimeRate(kh);
  }

  _showTime(fromSlider = false) {
    const e = this.el, t = this.time, k = this.k;
    if (!fromSlider && !t.dragging) {
      const v = String(sliderFromKh(t.kh));
      if (e.rate.value !== v) e.rate.value = v;
    }
    const rate = formatRate(t.kh);
    k.setText(e.rateVal, rate);
    e.rate.setAttribute('aria-valuetext', rate);
    for (const [btn, on] of [[e.auto, !t.locked], [e.lock, t.locked]]) {
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    for (const b of e.presets) {
      const p = TIME_PRESETS.find(([id]) => id === b.dataset.preset);
      const on = t.locked && Math.abs(Math.log10(t.kh / p[2])) < 0.01;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  // ---- Brain systems and Views (display overlays, A.5) -------------------------------------------

  _bindBrainsys() {
    const e = this.el;
    const sw = (btn, id) => btn.addEventListener('click', () => {
      if (!this.caps.overlay) return;
      this.overlays[id] = !this.overlays[id];
      btn.setAttribute('aria-checked', String(this.overlays[id]));
      this.h.onOverlay(id, this.overlays[id]);
    });
    for (const [id] of OVERLAYS) sw(e.overlays[id], id);
    for (const [id] of VIEW_TOGGLES) sw(e.viewToggles[id], id);
    e.arousal.value = this.arousal;
    e.arousal.addEventListener('change', () => {
      this.arousal = e.arousal.value;
      if (this.caps.arousal) this.h.onArousalState(this.arousal);
    });
  }

  // ---- Settings: age, limb motion, reduced motion ---------------------------------------------------

  _bindSettings() {
    const e = this.el;
    e.age.min = String(PARAMS.ageMin);
    e.age.max = String(PARAMS.ageMax);
    e.age.addEventListener('input', () => {
      const y = Math.round(Number(e.age.value));
      if (y === this.age) return;
      this._showAge(y);
      if (this.caps.age) this.h.onAge(y);
    });
    e.limb.addEventListener('click', () => {
      if (!this.caps.limb || this._reducedMotion()) return;
      this.limbMotion = !this.limbMotion;
      this._showLimb();
      this.h.onLimbMotion(this.limbMotion);
    });
    const rm = (v) => {
      if (!this.caps.reduced || v === this.reduced) return;
      this.reduced = v;
      this._showLimb();
      this.h.onReducedMotion(v);
    };
    e.rmSystem.addEventListener('click', () => rm('system'));
    e.rmOn.addEventListener('click', () => rm('on'));
    this.rmQuery.addEventListener?.('change', () => this._showLimb());
  }

  _reducedMotion() {
    return this.reduced === 'on' || this.rmQuery.matches;
  }

  _showAge(y) {
    this.age = y;
    const e = this.el;
    if (Number(e.age.value) !== y) e.age.value = String(y);
    const text = `${y} y`;
    this.k.setText(e.ageVal, text);
    e.age.setAttribute('aria-valuetext', `${y} years`);
  }

  // Limb motion is forced off under reduced motion (A.8 #22); the stored choice returns after.
  _showLimb() {
    const e = this.el;
    const forced = this._reducedMotion();
    e.limb.setAttribute('aria-checked', String(this.limbMotion && !forced));
    e.limb.setAttribute('aria-disabled', String(forced || !this.caps.limb));
    e.limb.title = forced ? 'Off under reduced motion' : '';
    for (const [btn, on] of [[e.rmSystem, this.reduced === 'system'], [e.rmOn, this.reduced === 'on']]) {
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }

  // Controls whose handler main.js does not pass yet stay disabled, so the HUD never offers an
  // action that does nothing.
  _applyCaps() {
    const e = this.el, c = this.caps;
    e.modeBrain.disabled = e.modeBody.disabled = !c.body;
    e.intervention.disabled = !c.intervention;
    for (const el of [e.sense, e.intensity, e.repeat]) el.disabled = !c.stimulus;
    e.pick.disabled = !c.pick;
    for (const b of e.presets) b.disabled = !c.preset;
    e.rate.disabled = !c.rate;
    e.auto.disabled = e.lock.disabled = !c.lock;
    e.timePause.disabled = !c.pause;
    for (const b of [...Object.values(e.overlays), ...Object.values(e.viewToggles)]) b.setAttribute('aria-disabled', String(!c.overlay));
    e.arousal.disabled = !c.arousal;
    e.age.disabled = !c.age;
    e.rmSystem.disabled = e.rmOn.disabled = !c.reduced;
  }

  // ---- API used by Hud ------------------------------------------------------------------------------

  setPaused(paused) {
    this.paused = !!paused;
    this.k.setText(this.el.timePause, this.paused ? 'Resume' : 'Pause');
    this.el.timePause.setAttribute('aria-pressed', String(this.paused));
    this._showScenarioControls();
  }

  // Shows settings without calling any handler (URL parameters, resets, external changes).
  syncSettings(o = {}) {
    if (o.bodyMode != null) this._showBodyMode(o.bodyMode);
    if (o.nets) for (const [id, on] of Object.entries(o.nets)) this._showNet(id, on);
    if (o.intervention !== undefined) {
      const id = o.intervention && typeof o.intervention === 'object' ? o.intervention.id : o.intervention;
      this.intervention = INTERVENTIONS.some((x) => x.id === id) ? id : 'none';
      this.el.intervention.value = this.intervention;
      this._showInterventionParams();
    }
    if (o.scenario !== undefined) this._showScenario(o.scenario);
    if (o.kh != null || o.timeLock !== undefined) {
      if (o.kh != null && Number.isFinite(Number(o.kh))) this.time.kh = clampKh(Number(o.kh));
      if (o.timeLock !== undefined) {
        this.time.locked = o.timeLock != null && o.timeLock !== false;
        if (typeof o.timeLock === 'number') this.time.kh = clampKh(o.timeLock);
      }
      this._showTime();
    }
    if (o.arousalState != null) { this.arousal = String(o.arousalState); this.el.arousal.value = this.arousal; }
    if (o.overlays) {
      for (const [id, on] of Object.entries(o.overlays)) {
        if (!(id in this.overlays)) continue;
        this.overlays[id] = !!on;
        (this.el.overlays[id] ?? this.el.viewToggles[id]).setAttribute('aria-checked', String(!!on));
      }
    }
    if (o.age != null && Number.isFinite(Number(o.age))) this._showAge(Math.round(Number(o.age)));
    if (o.limbMotion != null) { this.limbMotion = !!o.limbMotion; this._showLimb(); }
    if (o.reducedMotion != null) { this.reduced = o.reducedMotion === 'on' ? 'on' : 'system'; this._showLimb(); }
    if (o.sense != null) { this._fillSense(String(o.sense)); }
  }

  // main.js reports the site resolved from a pick or from the keyboard list (B.11 step 3):
  // { id, label?, dermatome?, nerve?, segment?, pathMm?, predicted? { ms, station?, targetMs [lo, hi] } },
  // { valid: false } for a click with no valid site, or null to clear.
  setSite(info) {
    const wasPicking = this.stim.picking;
    if (wasPicking) this._setPicking(false, false);
    if (!info) { this._selectSite(null); return; }
    if (info.valid === false) { this._renderSiteInfo(info); return; }
    if (info.side && SIDE_LABELS[info.side]) this.stim.side = info.side;
    if (info.id !== this.stim.site) this._selectSite(info.id);
    this._renderSiteInfo(info);
  }

  // main.js arms or disarms picking without a handler call (e.g. after a pick).
  setPicking(armed) {
    this._setPicking(armed, false);
  }

  get scenarioIsOrgasm() {
    return this.scenarioId === 'orgasm';
  }

  // Head chips and state echoes run every update; dropdown bodies only while open.
  update(s) {
    const d = this.host.drops, k = this.k;
    if (s.bodyMode && s.bodyMode !== this.bodyMode) this._showBodyMode(s.bodyMode);
    if (s.nets) for (const n of NETWORKS) if (n.id in s.nets && !!s.nets[n.id] !== this.nets[n.id]) this._showNet(n.id, s.nets[n.id]);
    if (s.intervention !== undefined) {
      const id = s.intervention && typeof s.intervention === 'object' ? s.intervention.id : (s.intervention ?? 'none');
      if (id !== this.intervention && INTERVENTIONS.some((x) => x.id === id)) {
        this.intervention = id;
        this.el.intervention.value = id;
        this._showInterventionParams();
      }
    }

    const sc = s.scenario;
    if (sc !== undefined) {
      const id = sc ? sc.id ?? null : null;
      if (id !== this.scenarioId) this._showScenario(id);
      const active = !!(sc && sc.active);
      const spanH = sc && Number.isFinite(sc.spanH) ? sc.spanH : 0;
      if (active !== this.scn.active || spanH !== this.scn.spanH) {
        this.scn.active = active;
        this.scn.spanH = spanH;
        this._showScenarioControls();
      }
      this.scn.tH = sc && Number.isFinite(sc.tH) ? sc.tH : 0;
      this.scn.stage = sc?.stage ?? '';
    }
    if (s.kh != null && Number.isFinite(Number(s.kh))) this.time.kh = Number(s.kh);
    if (s.clockSource) this.time.locked = sourceLabel(s.clockSource) === 'lock';

    if (d.scenarios?.open && sc !== undefined) {
      this._showProgress();
      this._showTicks(sc);
      k.setText(this.el.stage, this.scn.stage || DASH);
      k.setText(this.el.scnTime, sc && this.scn.spanH > 0 ? `${formatClockTime(this.scn.tH)} / ${formatClockTime(this.scn.spanH)}` : '');
      const seed = sc && Number.isFinite(sc.seed) ? `model run, seed ${sc.seed}` : '';
      k.setText(this.el.seed, seed);
      this.el.seed.hidden = !seed;
    }
    if (d.time?.open) {
      const src = sourceLabel(s.clockSource);
      const label = s.clock ?? (s.timeHuman != null ? clockLabel(s.timeHuman, this.time.kh) : DASH);
      k.setText(this.el.timeReadout, src ? `${label}  ${src}` : label);
      k.setText(this.el.timeHuman, s.timeHuman != null ? formatClockTime(s.timeHuman) : DASH);
      this._showTime();
    }
    if (d.brainsys?.open && s.arousalState && s.arousalState !== this.arousal && document.activeElement !== this.el.arousal) {
      this.arousal = s.arousalState;
      this.el.arousal.value = this.arousal;
    }
    if (d.stimulus?.open && s.psi !== undefined) {
      const psi = s.psi;
      this.el.psiRow.hidden = false;
      k.setText(this.el.psi, Number.isFinite(psi) ? `${Number(psi.toPrecision(PARAMS.psiDigits))} a.u.` : DASH);
    }
  }

  refresh(key) {
    if (this.host.last && ['scenarios', 'time', 'brainsys', 'stimulus'].includes(key)) this.update(this.host.last);
  }
}
