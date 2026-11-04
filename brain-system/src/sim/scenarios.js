// Scenarios and the scenario player (research/ANALYSIS.md §12, A.3.5, A.4, A.6, B.4, B.12, B.15 phase 2).
// SCENARIOS holds the nine A.3.5 scenarios as plain data in the §12.2 format; ScenarioPlayer runs them
// on a Kernel (kernel.js) and a SimClock (clock.js); evaluate() runs their checkpoints headless (§12.20).
//
//   time      scenario tH = kernel t − onset; onset = kernel t at Play + lead (the pre-roll of §12.4, human s)
//   events    { t, stimulus } (A.6 record, delivered by sensory.js) or { t, control } (kernel event:
//             posture, an 'lps' bolus, …), t in scenario tH; scheduled at Play, tagged with the run
//   inputs    inputs(tH, k) → { stress?, stand?, cephalic?, eat?, … } through k.setInputs (§12.2): continuous
//             profiles only, pure functions of tH; the fields that mirror an A.6 record (sound, light,
//             heat, tap) describe the stimulus for readers and the display, the record drives receptors
//   clock     clockKeys → clock.setKeyframes(keys, { originH: onset }); the clock anticipates falling
//             windows (A.4), so the pre-roll approach needs no extra key
//   seek      kernel snapshots at Play and every 10 % of the span (§12.2), taken as the run passes them;
//             a seek restores the nearest one at or before the target and fast-forwards in ≤ 8-ms slices
//   repeat    n trials isi apart from the current state, no reset, so habituation is kept (§12.18)
//
// Availability (A.3.5 greying): a scenario runs when the kernel holds every plugin in `requires`
// (network modules: 'somatic', 'autonomic', 'enteric', 'endocrine', 'immune') and, in brain-only mode,
// when it has a central form. A checkpoint is evaluated when the kernel holds its `needs` plugins and
// its readout exists; otherwise it is skipped with the reason. Nothing here changes when those plugins
// are added: they are found through k.plugin(id) and their A.3.4 readouts through k.idx(name).
// Inputs never carry physiology (§12.3). The orgasm entry is run by the OrgasmAdapter (B.13); the
// player only reports it.

import { Kernel } from './kernel.js';
import { NET_IDS } from './graph.js';
import { makeStimulus } from './stimuli.js';

export const PARAMS = {
  defaultSeed: 1,          // §12.2 seed default [model]
  snapshotEvery: 0.1,      // fraction of the span between seek snapshots (§12.2)
  seekSliceMs: 8,          // ms per fast-forward slice (B.9, B.12)
  onsetDa: 0.1,            // onset threshold on NF nodes: Δa = 0.1 rmax above the value at onset, the kernel's
                           // packet and event-log threshold (§11.8)
  sampleDt: 0.0005,        // s; finest checkpoint sampling, the NF step (A.4)
  samplesPerWindow: 400,   // samples per checkpoint window when no dt is given [model]
  sampleEps: 1e-7,         // s; a sample at t includes the kernel items at t (packet, event, layer steps) [model]
  baselineLead: 1e-6,      // s; the baseline sample is taken this long before onset [model]
};

// Plugin id → network id (A.3.1): the five network modules (graph.js plugin contract).
export const MODULES = Object.freeze({ somatic: 'somatic', autonomic: 'autonomic', enteric: 'enteric', endocrine: 'neuroendocrine', immune: 'neuroimmune' });

const now = () => globalThis.performance?.now() ?? 0;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ramp = (t, t0, t1) => clamp((t - t0) / (t1 - t0), 0, 1);
const within = (t, t0, t1) => t >= t0 && t < t1;

// --- Data helpers ---
const stim = (t, rec) => ({ t, stimulus: makeStimulus({ ...rec, tOnset: 0 }) });
const ctrl = (t, control) => ({ t, control });
// Checkpoint: row = §12.20 row (or null for a §12.15 central-form readout), v = readout ('a:<node>' NF
// activation r/rmax, or 'var:<A.3.4 name>'), m = measure, w = window [t0, t1] s of scenario tH,
// range = pass band [lo, hi] in the readout's unit (s for times), needs = plugins, mode 'brain' | 'body',
// nets = switch set { net: bool } (default all on), status = §12.20 status when it is not a plain test.
const CP = (o) => ({ row: null, mode: 'body', nets: {}, needs: [], sign: 1, ...o });

// --- Scenario table (A.3.5; §12.3 inputs, §12.4 keyframes, §12.5–§12.12 timelines, §12.20 rows) ---
const LOUD = { sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, params: { riseMs: 0.5 } };   // rise < 1 ms: the A.6 minimum 0.5 ms
const LIGHT = { sense: 'vision', mode: 'step', side: 'R', intensity: 3, durationMs: 1000 };   // 1,000 cd/m² = 3 log; the 100 cd/m² background has no A.6 field yet (§12.3) [model]

const SCN = [
  {
    id: 'hotObject', label: 'Touching a hot object', brainOnly: 'unavailable', requires: ['somatic'], needs: [],
    spanH: 30, lead: 3, seed: 1,
    // 55 °C contact on the right palm and palmar fingers (§12.3). Contact ends when the index fingertip
    // has moved ≥ 5 mm, which the somatic module decides; the record carries the A.6 maximum [model].
    events: [stim(0, { sense: 'pain', mode: 'heat', site: 'palm', side: 'R', intensity: 55, durationMs: 5000 }),
      stim(0, { sense: 'pain', mode: 'heat', site: 'indexTip', side: 'R', intensity: 55, durationMs: 5000 })],
    inputs: (tH) => (tH >= 0 ? { heat: { site: 'palm', side: 'R', tempC: 55 } } : {}),
    clockKeys: [{ tH0: 0, tH1: 0.4, kh: 0.02 }, { tH0: 0.4, tH1: 1.2, kh: 0.35 }, { tH0: 1.2, tH1: 30, kh: 1 }],
    stages: [
      { tH: 0, name: 'Contact', text: 'Contact with a 55 °C object, right palm and fingers (model input, §12.3).' },
      { tH: 0.224, name: 'Transduction', text: 'Heat reaches the nociceptor terminals at 150 µm after ≈ 224 ms (model contact-heat run, §12.3).' },
      { tH: 0.293, name: 'Withdrawal reflex', text: 'Aδ volley drives the flexor reflex at C6–C8; EMG ≈ 293 ms after contact (prototype model, human target 250–350 ms, §6.11).' },
      { tH: 0.3, name: 'First pain', text: 'Aδ input reaches thalamus and cortex ≈ 300 ms after contact (prototype model, §12.5).' },
      { tH: 1.04, name: 'Second pain', text: 'C volley reaches the cord ≈ 1.04 s and insula ≈ 1.12 s after contact (prototype model, §12.5).' },
      { tH: 1.66, name: 'Autonomic signs', text: 'Palmar skin conductance ≈ 1.66 s; heart rate +6.1 bpm at 1.9 s (prototype model, paired control, §12.5).' },
    ],
    checkpoints: [
      CP({ id: 'withdrawalEmg', row: 50, label: 'Withdrawal EMG onset from contact', v: 'var:emg.biceps', m: 'onset', thr: 0.1, w: [0, 1], range: [0.25, 0.35], target: '§6.11', needs: ['somatic'] }),
      CP({ id: 'movementOnset', row: 51, label: 'Movement onset from contact', v: 'var:joint.elbow', m: 'onset', thr: 0.5, w: [0, 1], range: [0.28, 0.38], target: '§6.11', needs: ['somatic'] }),
      CP({ id: 'elbowBound', row: 8, label: 'Elbow flexion bound', v: 'var:joint.elbow', m: 'peakDelta', w: [0, 3], range: [0, 30], unit: 'deg', target: 'A.8 #22', needs: ['somatic'] }),
      // Contact state: somatic.js stamps som.contactBreak.R with the tH of the break (−1 before it); the
      // A.3.4 list has no contact-state name yet, so the module's own name is read.
      CP({ id: 'contactBroken', row: 7, label: 'Contact broken', v: 'var:som.contactBreak.R', m: 'stamp', w: [0, 3], range: [0, 0.5], target: '§6', needs: ['somatic'] }),
      CP({ id: 'cArrival', row: 9, label: 'C arrival at insula after transduction', open: 'needs a second-wave arrival readout (C volley) at insPost', target: '§5', needs: ['somatic'] }),
      CP({ id: 'ordering', row: 10, label: 'EMG < cortical Aδ < contact break < C at the cord', open: 'needs the contact-state and C-volley readouts', needs: ['somatic'] }),
      CP({ id: 'scr', row: 11, label: 'SCR latency, palm', v: 'var:scr', m: 'onset', thr: 0.05, w: [0, 5], range: [1, 3], target: '§7', needs: ['somatic', 'autonomic'] }),
      CP({ id: 'hrRise', row: 12, label: 'HR rise (paired)', v: 'var:hr', m: 'peakDelta', paired: true, w: [0, 10], range: [5, 15], unit: 'bpm', target: '§7', needs: ['somatic', 'autonomic'] }),
    ],
  },
  {
    id: 'loudSound', label: 'Sudden loud sound', brainOnly: 'central', requires: [], needs: [],
    spanH: 90, lead: 3, seed: 1, repeat: { n: 5, isi: 20 },
    events: [stim(0, LOUD)],
    variants: {   // PPI: 70 dB SPL noise, 20 ms, lead 120 ms (§12.3)
      ppi: { label: 'Prepulse inhibition', events: [stim(-0.12, { sense: 'hearing', mode: 'noise', side: 'both', intensity: 70, durationMs: 20, params: { riseMs: 0.5 } })] },
    },
    inputs: (tH) => (within(tH, 0, 0.05) ? { sound: { dB: 105, kind: 'noise' } } : {}),
    clockKeys: [{ tH0: 0, tH1: 0.06, kh: 0.005 }, { tH0: 0.06, tH1: 0.5, kh: 0.1 }, { tH0: 0.5, tH1: 15, kh: 1 }, { tH0: 15, tH1: 90, kh: 5 }],
    stages: [
      { tH: 0, name: 'Sound onset', text: 'Broadband noise, 105 dB SPL, 50 ms, both ears (model input, §12.3).' },
      { tH: 0.004, name: 'Auditory brainstem', text: 'Cochlear nucleus, superior olive and inferior colliculus respond within ≈ 7 ms (model rate graph; ABR wave V 5.6 ms, human, §5).' },
      { tH: 0.014, name: 'Startle command', text: 'PnC → facial motor nucleus: the blink command starts ≈ 24 ms after onset (model rate graph; human blink EMG 20–40 ms, §6).' },
      { tH: 0.1, name: 'LC phasic burst', text: 'Locus coeruleus burst ≈ 100 ms after onset (model value from §3); salience rises.' },
      { tH: 0.5, name: 'Autonomic signs', text: 'Skin conductance, pupil and heart rate need the autonomic network (prototype model: SCR 1.46 s, pupil +0.80 mm, §12.6).' },
      { tH: 15, name: 'Recovery', text: 'States return toward rest by their own kinetics.' },
    ],
    checkpoints: [
      // Central form (§12.15), brain-only mode.
      CP({ id: 'blinkCommand', row: 5, label: 'Blink command at the facial motor nucleus (central form; EMG upper bound)', mode: 'brain', v: 'a:n7m.R', m: 'onset', w: [0, 0.1], range: [0, 0.040], target: '§6', tolerance: '§12.20 row 5 as an upper bound: EMG = command + peripheral delay', status: 'calibrated' }),
      CP({ id: 'pncCommand', label: 'PnC startle command (central form)', mode: 'brain', v: 'a:pnc.R', m: 'onset', w: [0, 0.1], range: [0, 0.1], target: '§12.15' }),
      CP({ id: 'mgn', label: 'MGN responds (central form)', mode: 'brain', v: 'a:mgn.R', m: 'onset', w: [0, 0.1], range: [0, 0.1], target: '§12.15' }),
      CP({ id: 'a1', label: 'A1 responds (central form)', mode: 'brain', v: 'a:a1.R', m: 'onset', w: [0, 0.1], range: [0, 0.1], target: '§12.15' }),
      CP({ id: 'amygdala', label: 'Amygdala responds (central form)', mode: 'brain', v: 'a:amygdala.R', m: 'onset', w: [0, 0.1], range: [0, 0.1], target: '§12.15' }),
      CP({ id: 'limbCommand', label: 'Limb startle command at portRS, efference only (central form)', mode: 'brain', v: 'a:portRS.R', m: 'onset', w: [0, 0.1], range: [0, 0.1], target: '§12.15' }),
      CP({ id: 'lcBurst', label: 'LC phasic burst (central form)', mode: 'brain', v: 'var:lcPhasic', m: 'onset', thr: 0.01, w: [0, 0.3], range: [0, 0.3], target: '§12.15', status: 'inserted' }),
      CP({ id: 'habituation', row: 45, label: 'Repeat ×5: salience declines, g_hab 0.54 at trial 5 (central readout)', mode: 'brain', v: 'var:salience', m: 'trials', trial: 'peak', check: 'decline', w: [0, 0.2], range: [0.53, 0.55], target: '§12.18 (g_hab arithmetic, §4.9, §5.12)' }),
      CP({ id: 'lcHabituation', row: 45, label: 'Repeat ×5: LC phasic amplitude declines (central readout)', mode: 'brain', v: 'var:lcPhasic', m: 'trials', trial: 'peak', check: 'decline', w: [0, 0.3], range: [0.53, 0.55], target: '§12.18' }),
      CP({ id: 'abrStable', row: 44, label: 'Repeat ×5: brainstem auditory response unchanged (inferior colliculus)', mode: 'brain', v: 'a:ic.R', m: 'trials', trial: 'peakDelta', check: 'stable', w: [0, 0.06], range: [0, 0.05], target: '§12.18' }),
      // Whole body.
      CP({ id: 'blinkEmg', row: 5, label: 'Startle blink EMG', v: 'var:emg.orbicularisOculi', m: 'onset', thr: 0.1, w: [0, 0.1], range: [0.020, 0.040], target: '§6', needs: ['somatic'], status: 'calibrated' }),
      CP({ id: 'neckEmg', row: 6, label: 'Neck EMG (sternocleidomastoid)', v: 'var:emg.sternocleidomastoid', m: 'onset', thr: 0.1, w: [0, 0.5], range: [0.075, 0.121], target: '§6', needs: ['somatic'] }),
      CP({ id: 'legEmg', row: 6, label: 'Leg EMG (quadriceps)', v: 'var:emg.quadriceps', m: 'onset', thr: 0.1, w: [0, 0.5], range: [0.145, 0.395], target: '§6', needs: ['somatic'] }),
      CP({ id: 'scr', row: 11, label: 'SCR latency, palm', v: 'var:scr', m: 'onset', thr: 0.05, w: [0, 5], range: [1, 3], target: '§7', needs: ['autonomic'] }),
      CP({ id: 'defence', row: 13, label: 'Defence pattern (two accelerations)', open: 'the second acceleration awaits the §7 defence command (§12.22)', needs: ['autonomic'] }),
      CP({ id: 'pupil', row: 14, label: 'Pupil dilation', v: 'var:pupilD.R', m: 'peakDelta', w: [0, 5], range: [0.5, 1.0], unit: 'mm', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'blinkHabituation', row: 45, label: 'Repeat ×5: blink EMG declines', v: 'var:emg.orbicularisOculi', m: 'trials', trial: 'peakDelta', check: 'decline', w: [0, 0.2], range: [0, 1], target: '§4, §6', needs: ['somatic'] }),
      CP({ id: 'scrHabituation', row: 45, label: 'Repeat ×5: SCR declines', v: 'var:scr', m: 'trials', trial: 'peakDelta', check: 'decline', w: [0, 5], range: [0, 1], target: '§7', needs: ['autonomic'] }),
      CP({ id: 'dishabituation', row: 46, label: 'Dishabituation after a novel stimulus', open: 'no dishabituation term in the §4.9 trace (§12.20 row 46 open)' }),
    ],
  },
  {
    id: 'brightLight', label: 'Bright light', brainOnly: 'central', requires: [], needs: [],
    spanH: 15, lead: 3, seed: 1, repeat: { n: 5, isi: 20 },
    events: [stim(0, LIGHT)],
    inputs: (tH) => (within(tH, 0, 1) ? { light: { cdm2: 1000, eye: 'R', backgroundCdm2: 100 } } : {}),
    clockKeys: [{ tH0: 0, tH1: 0.04, kh: 0.005 }, { tH0: 0.04, tH1: 0.12, kh: 0.02 }, { tH0: 0.12, tH1: 2.5, kh: 0.2 }, { tH0: 2.5, tH1: 15, kh: 1 }],
    stages: [
      { tH: 0, name: 'Light step', text: '1,000 cd/m² for 1 s, right eye (model input, §12.3).' },
      { tH: 0.025, name: 'Retina and optic nerve', text: 'Retinal output ≈ 25 ms after onset (model transduction, §5).' },
      { tH: 0.04, name: 'Central visual stations', text: 'LGN, superior colliculus, pretectum and SCN respond; the pretectum drives both Edinger–Westphal nuclei (model rate graph, §12.7).' },
      { tH: 0.22, name: 'Light reflex', text: 'Pupil constriction needs the autonomic network (prototype model: onset 0.22 s, 4.00 → 3.30 mm, both eyes, §12.7).' },
      { tH: 1, name: 'Light off', text: 'Step ends at 1 s; redilation to 10 % of the change by ≈ 4.7 s (prototype model, §12.7).' },
    ],
    checkpoints: [
      CP({ id: 'lgn', label: 'LGN responds (central form)', mode: 'brain', v: 'a:lgn.R', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.15' }),
      CP({ id: 'v1', label: 'V1 responds (central form)', mode: 'brain', v: 'a:v1.R', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.15' }),
      CP({ id: 'sc', label: 'Superior colliculus responds (central form)', mode: 'brain', v: 'a:sc.R', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.15' }),
      CP({ id: 'scn', label: 'SCN responds (central form)', mode: 'brain', v: 'a:scn.R', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.15' }),
      CP({ id: 'ewCommand', label: 'EW command, right (efference only in the central form)', mode: 'brain', v: 'a:ew.R', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.15' }),
      CP({ id: 'ewCommandL', label: 'EW command, left (consensual)', mode: 'brain', v: 'a:ew.L', m: 'onset', w: [0, 0.5], range: [0, 0.5], target: '§12.7' }),
      CP({ id: 'ewEqual', label: 'Consensual EW drive: left and right commands equal', mode: 'brain', v: 'a:ew.R', v2: 'a:ew.L', m: 'maxAbsDiff', w: [0, 2], range: [0, 0.01], target: '§12.7', tolerance: 'Δa ≤ 0.01 [model]; the pupil form is row 17' }),
      CP({ id: 'habituation', label: 'Repeat ×5: salience declines, g_hab 0.54 at trial 5 (central readout)', mode: 'brain', v: 'var:salience', m: 'trials', trial: 'peak', check: 'decline', w: [0, 0.2], range: [0.53, 0.55], target: '§12.18' }),
      CP({ id: 'reflexOnset', row: 15, label: 'Light-reflex onset', v: 'var:pupilD.R', m: 'onset', sign: -1, thr: 0.05, w: [0, 1], range: [0.2, 0.3], target: '§7', needs: ['autonomic'], status: 'calibrated' }),
      CP({ id: 'constriction90', row: 16, label: '90 % of constriction', v: 'var:pupilD.R', m: 't90', sign: -1, w: [0, 1.5], range: [0.5, 1.0], target: '§7', needs: ['autonomic'] }),
      CP({ id: 'consensual', row: 17, label: 'Consensual equality', v: 'var:pupilD.R', v2: 'var:pupilD.L', m: 'maxAbsDiff', w: [0, 5], range: [0, 0.05], unit: 'mm', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'reflexStable', row: 44, label: 'Repeat ×5: light reflex unchanged', v: 'var:pupilD.R', m: 'trials', trial: 'peakDelta', sign: -1, check: 'stable', w: [0, 2], range: [0, 0.05], target: '§12.18', needs: ['autonomic'] }),
    ],
  },
  {
    id: 'kneeJerk', label: 'Knee jerk', brainOnly: 'unavailable', requires: ['somatic'], needs: [],
    spanH: 3, lead: 3, seed: 1,
    events: [stim(0, { sense: 'proprioception', mode: 'tendonTap', site: 'patellarTendon', side: 'R', intensity: 2 })],
    inputs: (tH) => (within(tH, 0, 0.01) ? { tap: { site: 'patellarTendon', side: 'R', mm: 2 } } : {}),
    clockKeys: [{ tH0: 0, tH1: 0.04, kh: 0.005 }, { tH0: 0.04, tH1: 0.5, kh: 0.05 }, { tH0: 0.5, tH1: 3, kh: 1 }],
    stages: [
      { tH: 0, name: 'Tendon tap', text: '2 mm stretch, right patellar tendon (model input, §12.3).' },
      { tH: 0.024, name: 'Stretch reflex', text: 'Ia → L4 α-motor neurons → quadriceps EMG ≈ 24 ms (prototype model; human 18–23 ms, §6.11).' },
      { tH: 0.154, name: 'Knee extension', text: '≈ 3.9° at 154 ms (prototype model, §12.8).' },
    ],
    checkpoints: [
      CP({ id: 'quadricepsEmg', row: 3, label: 'Quadriceps EMG', v: 'var:emg.quadriceps', m: 'onset', thr: 0.1, w: [0, 0.1], range: [0.016, 0.025], target: '§6.11', needs: ['somatic'] }),
      CP({ id: 'kneeBound', row: 8, label: 'Knee extension bound', v: 'var:joint.knee', m: 'peakDelta', w: [0, 1], range: [0, 15], unit: 'deg', target: 'A.8 #22', needs: ['somatic'] }),
    ],
  },
  {
    id: 'standUp', label: 'Standing up', brainOnly: 'unavailable', requires: ['autonomic'], needs: [],
    spanH: 300, lead: 5, seed: 1, init: { posture: 'supine' },
    // Active stand, supine → upright over 3 s, upright for 300 s (§12.3). The posture event marks the
    // start; `stand` is the ramp fraction (0–1) for the cardiovascular and somatic modules.
    events: [ctrl(0, { type: 'posture', value: 1 })],
    inputs: (tH) => (tH >= 0 ? { stand: ramp(tH, 0, 3), active: true } : {}),
    clockKeys: [{ tH0: 0, tH1: 60, kh: 1 }, { tH0: 60, tH1: 300, kh: 10 }],
    stages: [
      { tH: 0, name: 'Stand', text: 'Active stand, supine → upright over 3 s (model input, §12.3).' },
      { tH: 3, name: 'Initial fall', text: 'Preload and arterial pressure fall; the baroreflex withdraws vagal tone within a beat (§12.9).' },
      { tH: 10, name: 'Reflex tachycardia', text: 'HR peak +36 bpm at 10 s on the §7 equations (model; human target +20–30 at ≈ 12 s).' },
      { tH: 60, name: 'Upright steady state', text: '104/75 mmHg, HR ≈ 83 bpm at 60 s (model, §12.9).' },
    ],
    checkpoints: [
      CP({ id: 'mapNadir', row: 18, label: 'MAP nadir time', v: 'var:map', m: 'timeOfPeak', sign: -1, w: [0, 30], range: [4, 13], target: '§7', needs: ['autonomic'] }),
      CP({ id: 'hrPeak', row: 19, label: 'HR peak', v: 'var:hr', m: 'peakDelta', w: [0, 30], range: [15, 35], unit: 'bpm', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'hrPeakTime', row: 19, label: 'HR peak time', v: 'var:hr', m: 'timeOfPeak', w: [0, 30], range: [9, 15], target: '§7', needs: ['autonomic'] }),
      CP({ id: 'hrUpright60', row: 20, label: 'Upright HR at 60 s', v: 'var:hr', m: 'deltaAt', w: [0, 60], range: [5, 20], unit: 'bpm', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'hrUpright180', row: 20, label: 'Upright HR at 180 s', v: 'var:hr', m: 'deltaAt', w: [0, 180], range: [5, 20], unit: 'bpm', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'dbpUpright60', row: 20, label: 'Upright DBP at 60 s', v: 'var:dbp', m: 'deltaAt', w: [0, 60], range: [0, 15], unit: 'mmHg', target: '§7', needs: ['autonomic'] }),
      CP({ id: 'ratio3015', row: 21, label: '30:15 ratio', open: '§7 has not fixed the criterion (§12.20 row 21 open)', needs: ['autonomic'] }),
      CP({ id: 'ohSbp', row: 22, label: 'Orthostatic hypotension, SBP (autonomic off)', v: 'var:sbp', m: 'peakDelta', sign: -1, w: [0, 180], range: [20, Infinity], unit: 'mmHg', target: '§7', nets: { autonomic: false }, needs: ['autonomic'] }),
      CP({ id: 'ohDbp', row: 22, label: 'Orthostatic hypotension, DBP (autonomic off)', v: 'var:dbp', m: 'peakDelta', sign: -1, w: [0, 180], range: [10, Infinity], unit: 'mmHg', target: '§7', nets: { autonomic: false }, needs: ['autonomic'] }),
      CP({ id: 'ihr', row: 23, label: 'HR = IHR at age 30 (autonomic off)', v: 'var:hr', m: 'valueAt', w: [0, 0], range: [100.5, 101.5], unit: 'bpm', target: 'A.8 #11; §7', nets: { autonomic: false }, needs: ['autonomic'] }),
    ],
  },
  {
    id: 'meal', label: 'Eating a meal', brainOnly: 'unavailable', requires: ['enteric'], needs: [],
    spanH: 21600, lead: 0, seed: 1,
    // Cephalic phase 0–2 min: sight and smell of food (A.6 smell default, class food); ingestion 600 kcal
    // over 10 min from 2 min, 35 % of the energy in the liquid phase (§12.3). `eat` is the intake rate.
    events: [stim(0, { sense: 'smell', mode: 'odour', side: 'both', intensity: 2, durationMs: 10000, params: { cls: 'food' } }),
      stim(0, { sense: 'vision', mode: 'step', side: 'both', intensity: 2, durationMs: 2000 })],
    variants: { testMeal: { label: '255-kcal test meal (§12.10)', kcal: 255 } },
    kcal: 600, liquidShare: 0.35,
    inputs(tH) {
      const o = {};
      if (within(tH, 0, 120)) o.cephalic = 1;
      if (within(tH, 120, 720)) o.eat = { kcalPerMin: this.kcal / 10, liquidShare: this.liquidShare };
      return o;
    },
    clockKeys: [{ tH0: 0, tH1: 120, kh: 10 }, { tH0: 120, tH1: 720, kh: 30 }, { tH0: 720, tH1: 3600, kh: 120 }, { tH0: 3600, tH1: 21600, kh: 600 }],
    stages: [
      { tH: 0, name: 'Cephalic phase', text: 'Sight and smell of food for 2 min (model input, §12.3).' },
      { tH: 120, name: 'Ingestion', text: '600 kcal mixed meal over 10 min, 35 % of the energy liquid (model input, §12.3).' },
      { tH: 720, name: 'Gastric emptying', text: 'Retention 78/58/23 % at 1/2/4 h after ingestion (prototype lumped core, §12.10).' },
      { tH: 5100, name: 'Insulin peak', text: 'Insulin proxy peak ×6.99 at 85 min (prototype model, §12.10).' },
    ],
    checkpoints: [
      CP({ id: 'cck50', row: 29, label: 'CCK at 50 % of its plateau', v: 'var:cck', m: 't50', w: [0, 3600], range: [282, 882], target: '§8', tolerance: '§12.20 row 29: 9.7 min from meal start ±5 min', needs: ['enteric'] }),   // cck is declared and computed by enteric (A.3.4 owner §8)
      CP({ id: 'retentionTest', row: 28, label: 'Gastric retention 1/2/4 h (255-kcal test meal)', open: 'needs the test-meal variant and a retention readout (A.3.4 has gastricSolid and gastricLiquid only)', needs: ['enteric'] }),
      CP({ id: 'pph', row: 30, label: 'Postprandial SBP fall (autonomic off)', v: 'var:sbp', m: 'peakDelta', sign: -1, w: [1800, 3600], range: [20, Infinity], unit: 'mmHg', target: '§7', nets: { autonomic: false }, needs: ['enteric', 'autonomic'] }),
      CP({ id: 'entericOff', row: 31, label: 'Emptying stops (enteric off): solid retention ≥ 99 % at 4 h', v: 'var:gastricSolid', m: 'valueAt', w: [0, 14520], range: [0.99 * 0.65 * 600, Infinity], unit: 'kcal', target: 'A.5', nets: { enteric: false }, needs: ['enteric'] }),
    ],
  },
  {
    id: 'stressor', label: 'Acute stressor', brainOnly: 'central', requires: [], needs: [],
    spanH: 10800, lead: 0, seed: 1,
    // Psychosocial stressor for 15 min, 1-min onset and offset ramps inside the 15 min, at the §9
    // "pulsatile" drive level; u_stress 0–1 (§12.3, §9.4) [model: ramps placed inside the 15 min].
    events: [],
    inputs: (tH) => (within(tH, 0, 900) ? { stress: Math.min(ramp(tH, 0, 60), 1 - ramp(tH, 840, 900)) } : {}),
    clockKeys: [{ tH0: 0, tH1: 120, kh: 10 }, { tH0: 120, tH1: 1200, kh: 60 }, { tH0: 1200, tH1: 10800, kh: 180 }],
    stages: [
      { tH: 0, name: 'Stressor', text: 'Psychosocial stressor, 15 min with 1-min ramps (model input, TSST class, §12.3).' },
      { tH: 60, name: 'Sympatho-adrenal channel', text: 'Fast channel over seconds to minutes; adrenaline peak ×4.1 near 14 min (prototype model, §12.11).' },
      { tH: 900, name: 'HPA channel', text: 'ACTH peaks near the stressor end; cortisol later (prototype variant E: ×2.21 at 37 min, §12.11). In brain-only mode only the PVN CRH command is shown (§12.15).' },
      { tH: 5400, name: 'Recovery', text: 'Cortisol back below ×1.2 by ≈ 88 min in variant E (prototype model, §12.11).' },
    ],
    checkpoints: [
      CP({ id: 'crhCommand15', label: 'PVN CRH command at 15 min, cortisol clamped (central form)', mode: 'brain', v: 'var:crhRel', m: 'valueAt', w: [0, 900], range: [6.0, 8.5], unit: '×', target: '§12.15 (×6.0–×8.5 over the quoted drives)', needs: ['endocrine'] }),
      CP({ id: 'crhCommand30', label: 'PVN CRH command below ×1.6 by 30 min (central form)', mode: 'brain', v: 'var:crhRel', m: 'valueAt', w: [0, 1800], range: [0, 1.6], unit: '×', target: '§12.15', needs: ['endocrine'] }),
      CP({ id: 'cortisolPeak', row: 32, label: 'Cortisol peak', v: 'var:cortisolRel', m: 'peak', w: [0, 10800], range: [2, 3], unit: '×', target: '§9', needs: ['endocrine'] }),
      CP({ id: 'cortisolPeakTime', row: 32, label: 'Cortisol peak time', v: 'var:cortisolRel', m: 'timeOfPeak', w: [0, 10800], range: [600, 3000], target: '§9', needs: ['endocrine'] }),
      CP({ id: 'cortisolRecovery', row: 33, label: 'Cortisol back below ×1.2', v: 'var:cortisolRel', m: 'returnBelow', level: 1.2, w: [0, 10800], range: [2700, 6300], target: '§9', needs: ['endocrine'] }),
      CP({ id: 'acthPeakTime', row: 34, label: 'ACTH peak near the stressor end', v: 'var:acthRel', m: 'timeOfPeak', w: [0, 3600], range: [600, 1200], target: '§9', needs: ['endocrine'] }),
    ],
  },
  {
    id: 'infection', label: 'Infection and fever', brainOnly: 'unavailable', requires: ['immune'], needs: [],
    spanH: 28800, lead: 0, seed: 1,
    // Intravenous endotoxin, single bolus of 2 ng/kg at tH 0 (§12.3): a kernel event ('lps' is
    // dispatched to the immune module).
    events: [ctrl(0, { type: 'lps', dose: 2, unit: 'ng/kg', route: 'iv' })],
    inputs: () => ({}),
    clockKeys: [{ tH0: 0, tH1: 1800, kh: 60 }, { tH0: 1800, tH1: 28800, kh: 900 }],
    stages: [
      { tH: 0, name: 'Endotoxin bolus', text: 'Intravenous endotoxin, 2 ng/kg (model input, human dose class, §12.3).' },
      { tH: 3816, name: 'Cytokines', text: 'TNF peak 1.06 h, IL-6 peak 1.66 h (prototype model, §12.12).' },
      { tH: 9216, name: 'Fever', text: 'Set point +1.50 °C; HR peak +24.6 bpm at 2.56 h; core temperature +1.35 °C at 3.38 h (prototype model, §12.12).' },
    ],
    checkpoints: [
      CP({ id: 'tnfPeak', row: 35, label: 'TNF peak time', v: 'var:tnf', m: 'timeOfPeak', w: [0, 28800], range: [3600, 9000], target: '§10', needs: ['immune'] }),
      CP({ id: 'il6Peak', row: 36, label: 'IL-6 peak time', v: 'var:il6', m: 'timeOfPeak', w: [0, 28800], range: [5400, 9000], target: '§10', needs: ['immune'] }),
      CP({ id: 'fever', row: 37, label: 'Fever amplitude', v: 'var:tCore', m: 'peakDelta', w: [0, 28800], range: [1.0, 2.0], unit: '°C', target: '§10', needs: ['immune', 'autonomic'] }),   // heat balance: autonomic (§7.10, B.15 phase 5)
      CP({ id: 'feverTime', row: 37, label: 'Fever peak time', v: 'var:tCore', m: 'timeOfPeak', w: [0, 28800], range: [5400, 23400], target: '§10', needs: ['immune', 'autonomic'] }),
      CP({ id: 'hrRise', row: 38, label: 'HR rise, whole scenario', v: 'var:hr', m: 'peakDelta', w: [0, 28800], range: [18, 38], unit: 'bpm', target: '§10', needs: ['immune', 'autonomic'] }),
      CP({ id: 'neOff', row: 39, label: 'Cytokines higher with neuroendocrine off', open: 'a comparison across switch sets (direction); not yet in this evaluator', needs: ['immune', 'endocrine'] }),
      CP({ id: 'autOff', row: 40, label: 'TNF higher with autonomic off', open: 'a comparison across switch sets (direction); not yet in this evaluator', needs: ['immune', 'autonomic'] }),
      CP({ id: 'niOff', row: 41, label: 'No fever with neuroimmune off (ΔtSet = 0)', v: 'var:tSet', m: 'peakDelta', w: [0, 28800], range: [0, 0], unit: '°C', target: 'A.5', nets: { neuroimmune: false }, needs: ['immune'] }),
      CP({ id: 'hrPerDegree', row: 52, label: 'HR change per °C, autonomic off', open: 'a ratio of two readouts (Δhr / ΔtCore); not yet in this evaluator', needs: ['immune', 'autonomic'] }),
    ],
  },
  {
    // DOPAMINE.md owns this scenario; the OrgasmAdapter runs it with its own clock (B.13, §11.14).
    id: 'orgasm', label: 'Orgasm – dopamine', brainOnly: 'central', requires: [], needs: [], adapter: true, seek: false,
    spanH: 0, lead: 0, seed: 1, events: [], inputs: () => ({}), clockKeys: [], stages: [],
    checkpoints: [CP({ id: 'regression', row: 43, label: 'Orgasm regression R1–R3', open: 'run by orgasm-regression.test.mjs against the legacy path (§12.13)' })],
  },
];

const DEFAULTS = { requires: [], needs: [], init: {}, lead: 0, seed: PARAMS.defaultSeed, events: [], inputs: () => ({}), clockKeys: [], stages: [], checkpoints: [], seek: true, adapter: false };
export const SCENARIOS = Object.freeze(Object.fromEntries(SCN.map((s) => [s.id, Object.freeze({ ...DEFAULTS, ...s })])));
export const SCENARIO_IDS = Object.freeze(SCN.map((s) => s.id));

// Time of a checkpoint's tick on the HUD scrubber (B.12): the centre of a timing band, else the window end.
function tickOf(cp) {
  if (!cp.m || cp.m === 'trials') return null;
  const timed = ['onset', 'timeOfPeak', 't90', 't50', 'returnBelow', 'stamp'].includes(cp.m);
  const t = timed ? 0.5 * (cp.range[0] + cp.range[1]) : cp.w[1];
  return Number.isFinite(t) && t > 0 ? t : null;
}

// Why a scenario cannot run on this kernel in this mode and switch set ('' = available; A.3.5).
export function availability(sc, k) {
  if (typeof sc === 'string') sc = SCENARIOS[sc];
  if (!sc) return 'Unknown scenario';
  if (sc.adapter) return '';
  const missing = sc.requires.filter((p) => !k?.plugin(p));
  if (k && !k.bodyOn && sc.brainOnly === 'unavailable') return 'Needs the body';
  if (missing.length) return `Needs the ${missing.join(' and ')} module${missing.length > 1 ? 's' : ''} (not built yet)`;
  const off = sc.needs.filter((n) => k && k.get(`net.${n}`) === 0);
  if (off.length) return `Needs the ${off.join(' and ')} network${off.length > 1 ? 's' : ''}`;
  return '';
}

// Why a checkpoint cannot be evaluated on this plugin set ('' = evaluable).
export function checkpointSkip(cp, pluginIds) {
  const have = new Set(pluginIds);
  const missing = cp.needs.filter((p) => !have.has(p));
  if (missing.length) return `needs the ${missing.join(' and ')} module${missing.length > 1 ? 's' : ''} (kernel plugin${missing.length > 1 ? 's' : ''} ${missing.map((p) => `'${p}'`).join(', ')}, not loaded in this run)`;
  if (cp.open) return `open: ${cp.open}`;
  return '';
}

// --- Player ---
export class ScenarioPlayer {
  constructor({ kernel, clock = null, seed = null } = {}) {
    if (!kernel) throw new Error('ScenarioPlayer: a kernel is required');
    this.k = kernel;
    this.clock = clock;
    this.seedOverride = Number.isFinite(seed) ? seed : null;   // ?seed (B.12)
    this.id = null;
    this.variant = null;
    this.run = null;
    this.cpuMs = 0;
    this._runSeq = 0;
  }

  get scenario() { return this.id ? SCENARIOS[this.id] : null; }
  get seed() { return this.seedOverride ?? this.scenario?.seed ?? PARAMS.defaultSeed; }
  available(id = this.id) { return availability(id, this.k); }
  list() { return SCENARIO_IDS.map((id) => ({ id, label: SCENARIOS[id].label, brainOnly: SCENARIOS[id].brainOnly, why: availability(id, this.k) })); }

  // Select: stops a running scenario (B.12). Returns false for an unknown id.
  select(id, { variant = null } = {}) {
    this.stop();
    if (id != null && !SCENARIOS[id]) return false;
    this.id = id ?? null;
    this.variant = variant && this.scenario?.variants?.[variant] ? variant : null;
    this.run = null;
    return true;
  }

  // The selected scenario with its variant merged in.
  _spec() {
    const sc = this.scenario;
    const v = this.variant ? sc.variants[this.variant] : null;
    if (!v) return sc;
    const { label, events = [], ...rest } = v;
    return { ...sc, ...rest, label: `${sc.label} (${label})`, events: [...sc.events, ...events] };
  }

  // Play: reset to the cached resting state, seed the streams, schedule the run (B.12). Two Plays with
  // the same switches give bit-identical traces (A.8 #25).
  play() {
    const sc = this.scenario;
    if (!sc || sc.adapter || this.available()) return false;
    this.stop();
    const k = this.k;
    k.seed = this.seed;
    k.settle(sc.init ?? {});
    this._start({ trials: 1 });
    return true;
  }
  restart() { return this.play(); }   // same as Play: habituation reset (§12.18)

  // Repeat: n trials isi apart from the current state, without reset (§12.18, B.12).
  repeat() {
    const sc = this.scenario;
    if (!sc || !sc.repeat || this.available()) return false;
    this.stop();
    this._start({ trials: sc.repeat.n, isi: sc.repeat.isi });
    return true;
  }

  // Stop: inputs end, pending scenario events are withdrawn, the clock source is released; states
  // relax by their own dynamics (B.12).
  stop() {
    const run = this.run;
    if (!run || run.stopped) return;
    this._release(true);
    run.stopped = true;
  }

  _start({ trials = 1, isi = 0, withEvents = true } = {}) {
    const k = this.k, sc = this._spec();
    const t0 = k.t, onset = t0 + sc.lead;
    const span = (trials - 1) * isi + sc.spanH;
    const tag = `scn:${sc.id}:${++this._runSeq}`;
    const onsets = Array.from({ length: trials }, (_, i) => onset + i * isi);
    const run = { id: sc.id, spec: sc, tag, t0, onset, span, end: onset + span, onsets, isi, trials, stopped: false, done: false,
      marks: Array.from({ length: Math.round(1 / PARAMS.snapshotEvery) + 1 }, (_, i) => ({ t: onset + i * span * PARAMS.snapshotEvery, snap: null })),
      start: null };
    this.run = run;
    if (withEvents) for (const t1 of onsets) for (const e of sc.events) {
      const tH = t1 + e.t;
      if (e.stimulus) k.schedule({ type: 'stimulus', record: { ...e.stimulus, params: { ...e.stimulus.params }, tOnset: tH }, tH, scn: tag });
      else k.schedule({ ...e.control, tH, scn: tag });
    }
    run.start = k.snapshot();   // the state at Play, after scheduling (seek origin)
    this._arm();
    this._syncClock();
  }

  // Inputs and clock keyframes of the current run.
  _arm() {
    const run = this.run, sc = run.spec, k = this.k;
    k.setInputs((t, kk) => {
      let i = run.onsets.length - 1;
      while (i > 0 && t < run.onsets[i]) i--;
      return sc.inputs.call(sc, t - run.onsets[i], kk);
    });
    if (this.clock) {
      const keys = [];
      run.onsets.forEach((t1, i) => {
        const lim = i + 1 < run.onsets.length ? run.onsets[i + 1] - run.onset : Infinity;
        for (const w of sc.clockKeys) {
          const a = t1 - run.onset + w.tH0, b = Math.min(t1 - run.onset + w.tH1, lim);
          if (b > a) keys.push({ tH0: a, tH1: b, kh: w.kh });
        }
      });
      this.clock.setKeyframes(keys, { originH: run.onset });
      this.clock.markEpoch(run.onset);
    }
  }

  _release(withdraw) {
    const k = this.k, run = this.run;
    if (withdraw && run) for (let i = k.evq.length - 1; i >= 0; i--) if (k.evq[i].scn === run.tag) k.evq.splice(i, 1);
    k.setInputs(null);
    this.clock?.setKeyframes(null);
  }

  // The kernel's time is the truth: the clock follows it after a reset, restore or seek.
  _syncClock() {
    const c = this.clock;
    if (!c) return;
    c.tH = this.k.t;
    c.clearAnticipation?.();
  }

  get active() { const r = this.run; return !!r && !r.stopped && !r.done; }
  get tH() { const r = this.run; return r ? this.k.t - r.onset : 0; }
  get spanH() { return this.run ? this.run.span : (this.scenario?.spanH ?? 0); }
  get progress() { const r = this.run; return r && r.span > 0 ? clamp((this.k.t - r.onset) / r.span, 0, 1) : 0; }
  get stage() { return this._stage()?.name ?? ''; }
  get stageText() { return this._stage()?.text ?? ''; }
  _stage() {
    const r = this.run;
    if (!r) return null;
    if (this.k.t < r.onset) return { name: 'Rest', text: 'Resting steady state of the current switch set (model).' };
    let i = r.onsets.length - 1;
    while (i > 0 && this.k.t < r.onsets[i]) i--;
    const t = this.k.t - r.onsets[i];
    let cur = null;
    for (const s of r.spec.stages) if (s.tH <= t) cur = s;
    if (!cur) return null;
    return r.trials > 1 ? { ...cur, name: `${cur.name} · trial ${i + 1}/${r.trials}` } : cur;
  }

  // HUD payload (ui-body.js update(): scenario { id, active, tH, spanH, stage, stages, checkpoints, seed }).
  hud() {
    const sc = this.scenario;
    if (!sc) return null;
    const spanH = this.spanH, tH = clamp(this.tH, 0, spanH || 0);
    return {
      id: sc.id, label: this.run?.spec.label ?? sc.label, active: this.active, tH, spanH, stage: this.stage, stageText: this.stageText,
      stages: sc.stages.map((s) => ({ tH: s.tH, name: s.name })).filter((s) => s.tH >= 0 && s.tH <= spanH),
      checkpoints: sc.checkpoints.map(tickOf).filter((t) => t !== null && t <= spanH),
      seed: this.seed, available: this.available(), adapter: !!sc.adapter, seek: sc.seek !== false, repeat: !!sc.repeat,
    };
  }

  // Frame advance (B.6 step 4): the kernel advance, split at the snapshot marks and the end of the run.
  advance(h, budgetMs = Infinity) { return this.advanceTo(this.k.t + Math.max(0, h), budgetMs); }
  advanceTo(T, budgetMs = Infinity) {
    const k = this.k, t0 = now();
    if (!this.active) { k.advanceTo(T, budgetMs); this.cpuMs = now() - t0; return k.t; }
    while (k.t < T) {
      const b = this._nextBoundary();
      const target = Math.min(T, b);
      k.advanceTo(target, budgetMs === Infinity ? Infinity : Math.max(0, budgetMs - (now() - t0)));
      if (k.t < target) break;   // budget spent (§11.7)
      if (target === b) this._atBoundary(b);
      if (budgetMs !== Infinity && now() - t0 >= budgetMs) break;
    }
    this.cpuMs = now() - t0;
    return k.t;
  }
  // Catch up when the caller advanced the kernel directly: marks the run done at its end.
  update() { const r = this.run; if (r && this.active && this.k.t >= r.end) this._finish(); }

  _nextBoundary() {
    const r = this.run, t = this.k.t;
    for (const m of r.marks) if (m.t > t && !m.snap) return Math.min(m.t, r.end);
    return r.end > t ? r.end : Infinity;
  }
  _atBoundary(b) {
    const r = this.run;
    for (const m of r.marks) if (m.t === b && !m.snap) m.snap = this.k.snapshot();
    if (b >= r.end) this._finish();
  }
  _finish() { const r = this.run; if (!r || r.done) return; r.done = true; this._release(false); }

  // Seek to scenario tH (B.12): restore the nearest snapshot at or before the target, fast-forward
  // headless in ≤ 8-ms slices. Lands on the same state as playing to tH (snapshot/restore, §12.2).
  seek(tH) {
    const r = this.run, k = this.k;
    if (!r || r.spec.seek === false) return false;
    const T = clamp(r.onset + tH, r.t0, r.end);
    if (T < k.t || r.stopped) {
      let best = { t: r.t0, snap: r.start };
      for (const m of r.marks) if (m.snap && m.t <= T && m.t >= best.t) best = m;
      k.restore(best.snap);
      for (const m of r.marks) if (m.t > best.t) m.snap = null;   // retaken as the run passes them again
    }
    r.stopped = false; r.done = false;
    this._arm();
    const t0 = now();
    while (k.t < T) {
      const b = this._nextBoundary(), target = Math.min(T, b);
      while (k.t < target) k.advanceTo(target, PARAMS.seekSliceMs);
      if (target === b) this._atBoundary(b);
    }
    if (k.t >= r.end) this._finish();
    this.cpuMs = now() - t0;
    this._syncClock();
    return true;
  }

  // Headless checkpoints of the selected scenario on this kernel's graph and plugins (§12.20).
  evaluate(opts = {}) { return evaluate(this.id, { graph: this.k.graph, plugins: this.k.plugins, seed: this.seedOverride ?? undefined, variant: this.variant, ...opts }); }
}

// --- Headless checkpoint evaluation (§12.20, §12.21) ---
// Each group of checkpoints that share a mode, a switch set, a paired control and a repeat runs once on
// a fresh kernel; every readout is sampled on its window grid and reduced by its measure.
function reader(k, v) {
  if (!v) return null;
  const [kind, name] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
  if (kind === 'a') { const j = k.nfIndex(name); return j < 0 ? null : () => k.a(j); }
  if (kind === 'var') { const i = k.idx(name); return i < 0 ? null : () => k.vars[i]; }
  return null;
}

function grid(cp) {
  const [w0, w1] = cp.w;
  if (cp.m === 'valueAt' || cp.m === 'deltaAt') return [w1];
  const dt = cp.dt ?? Math.max(PARAMS.sampleDt, (w1 - w0) / PARAMS.samplesPerWindow);
  const n = Math.max(1, Math.round((w1 - w0) / dt));
  return Array.from({ length: n + 1 }, (_, i) => w0 + (i * (w1 - w0)) / n);
}

function runGroup(id, g, { graph, plugins, seed, variant }) {
  const sc = SCENARIOS[id];
  const k = new Kernel({ graph, plugins, seed: seed ?? sc.seed, settle: false });
  for (const [net, on] of Object.entries(g.nets)) k.set(`net.${net}`, on ? 1 : 0);
  if (g.mode === 'brain') k.set('bodyMode', 0);
  const p = new ScenarioPlayer({ kernel: k, seed: seed ?? null });
  p.select(id, { variant });
  k.seed = p.seed;
  k.settle(sc.init ?? {});
  if (g.repeat) p._start({ trials: sc.repeat.n, isi: sc.repeat.isi, withEvents: !g.control });
  else p._start({ trials: 1, withEvents: !g.control });
  const r = p.run;
  // Sample plan: kernel times → reads.
  const plan = new Map();
  const add = (t, fn) => { if (!plan.has(t)) plan.set(t, []); plan.get(t).push(fn); };
  const out = new Map();
  for (const cp of g.cps) {
    const rd = reader(k, cp.v), rd2 = cp.v2 ? reader(k, cp.v2) : null;
    if (!rd || (cp.v2 && !rd2)) { out.set(cp.id, { missing: !rd ? cp.v : cp.v2 }); continue; }
    const ts = grid(cp);
    const trials = r.onsets.map((on) => ({ on, base: NaN, t: ts, v: new Float64Array(ts.length), v2: rd2 ? new Float64Array(ts.length) : null }));
    out.set(cp.id, { trials });
    for (const tr of trials) {
      add(tr.on - PARAMS.baselineLead, () => { tr.base = rd(); });
      ts.forEach((t, i) => add(tr.on + t + PARAMS.sampleEps, () => { tr.v[i] = rd(); if (rd2) tr.v2[i] = rd2(); }));
    }
  }
  for (const t of [...plan.keys()].sort((a, b) => a - b)) { p.advanceTo(t); for (const fn of plan.get(t)) fn(); }
  return out;
}

function reduce(cp, tr) {
  const s = cp.sign, { t, v, v2, base } = tr, n = t.length;
  switch (cp.m) {
    case 'onset': {
      const thr = cp.thr ?? PARAMS.onsetDa;
      for (let i = 0; i < n; i++) if (s * (v[i] - base) >= thr) return t[i];
      return Infinity;
    }
    case 'peak': { let m = -Infinity; for (let i = 0; i < n; i++) m = Math.max(m, s * v[i]); return s * m; }
    case 'peakDelta': { let m = -Infinity; for (let i = 0; i < n; i++) m = Math.max(m, s * (v[i] - base)); return m; }
    case 'timeOfPeak': { let m = -Infinity, at = NaN; for (let i = 0; i < n; i++) if (s * v[i] > m) { m = s * v[i]; at = t[i]; } return at; }
    case 'valueAt': return v[n - 1];
    case 'stamp': return v[n - 1] >= 0 ? v[n - 1] - tr.on : Infinity;   // a kernel tH stamp (−1 before the event) → s after onset
    case 'deltaAt': return v[n - 1] - base;
    case 't90': case 't50': {
      const f = cp.m === 't90' ? 0.9 : 0.5;
      let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, s * (v[i] - base));
      for (let i = 0; i < n; i++) if (s * (v[i] - base) >= f * m && m > 0) return t[i];
      return Infinity;
    }
    case 'returnBelow': {
      let ip = 0; for (let i = 0; i < n; i++) if (v[i] > v[ip]) ip = i;
      for (let i = ip; i < n; i++) if (v[i] < cp.level) return t[i];
      return Infinity;
    }
    case 'maxAbsDiff': { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(v[i] - v2[i])); return m; }
    default: throw new Error(`scenarios: unknown measure '${cp.m}'`);
  }
}

// evaluate(id, { graph, plugins, seed, variant, only }) → [{ id, row, label, status, value, range, reason, trials? }]
// status: 'pass' | 'fail' | 'skipped' (needs, open or a missing readout); `kind` repeats the §12.20 status.
export function evaluate(id, { graph = null, plugins = [], seed, variant = null, only = null } = {}) {
  const sc = SCENARIOS[id];
  if (!sc) throw new Error(`scenarios: unknown scenario '${id}'`);
  const ids = plugins.map((p) => p.id);
  graph ??= new Kernel({ plugins, settle: false }).graph;
  const results = [], groups = new Map();
  for (const cp of sc.checkpoints) {
    if (only && !only.includes(cp.id)) continue;
    const res = { id: cp.id, row: cp.row, label: cp.label, kind: cp.status ?? null, range: cp.range ?? null, target: cp.target ?? null, needs: cp.needs, mode: cp.mode };
    results.push(res);
    const why = checkpointSkip(cp, ids);
    if (why) { Object.assign(res, { status: 'skipped', reason: why }); continue; }
    if (cp.mode === 'brain' && sc.brainOnly === 'unavailable') { Object.assign(res, { status: 'skipped', reason: 'no brain-only form (A.3.5)' }); continue; }
    const nets = Object.fromEntries(NET_IDS.map((n) => [n, cp.nets[n] ?? true]));
    const repeat = cp.m === 'trials';
    for (const control of cp.paired ? [false, true] : [false]) {
      const key = JSON.stringify({ mode: cp.mode, nets, repeat, control });
      if (!groups.has(key)) groups.set(key, { mode: cp.mode, nets, repeat, control, cps: [], key });
      groups.get(key).cps.push(cp);
    }
  }
  const data = new Map();
  for (const g of groups.values()) data.set(g.key, runGroup(id, g, { graph, plugins, seed, variant }));
  for (const res of results) {
    if (res.status) continue;
    const cp = sc.checkpoints.find((c) => c.id === res.id);
    const nets = Object.fromEntries(NET_IDS.map((n) => [n, cp.nets[n] ?? true]));
    const key = (control) => JSON.stringify({ mode: cp.mode, nets, repeat: cp.m === 'trials', control });
    const d = data.get(key(false)).get(cp.id);
    if (d.missing) { Object.assign(res, { status: 'skipped', reason: `readout '${d.missing}' is not declared by the plugins present` }); continue; }
    let trials = d.trials;
    if (cp.paired) {   // paired control: difference from the run without the stimulus (§12.1)
      const c = data.get(key(true)).get(cp.id).trials;
      trials = trials.map((tr, q) => ({ ...tr, base: tr.base - c[q].base, v: tr.v.map((x, i) => x - c[q].v[i]) }));
    }
    let value, ok;
    const [lo, hi] = cp.range;
    if (cp.m === 'trials') {
      const per = trials.map((tr) => reduce({ ...cp, m: cp.trial }, tr));
      res.trials = per;
      if (cp.check === 'decline') {
        value = per[per.length - 1] / per[0];
        ok = per.every((x, i) => i === 0 || x < per[i - 1]) && value >= lo && value <= hi;
      } else {
        value = Math.max(...per.map((x) => Math.abs(x / per[0] - 1)));
        ok = value >= lo && value <= hi;
      }
    } else {
      value = reduce(cp, trials[0]);
      ok = value >= lo && value <= hi;
    }
    Object.assign(res, { status: ok ? 'pass' : 'fail', value });
  }
  return results;
}
