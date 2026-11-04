// @ts-check
// Intervention presets (research/ANALYSIS.md §11.12, A.5, B.4, B.11): one catalogue, keyed by the ids
// the HUD offers (ui-body.js INTERVENTIONS), built only from the data each network module exports.
// The content of every preset belongs to its owner section (§6 somatic.js, §7 autonomic.js, §9
// endocrine.js, §10 immune.js); this file only composes them and resolves HUD payloads.
//
//   INTERVENTIONS            one InterventionPreset per HUD id (defaults in `params`); `kernelId` is
//                            the id the kernel and the modules see when it differs from the HUD id
//   resolve(preset)          HUD payload ({ id, level, … }), id string or catalogue entry →
//                            kernel-ready InterventionPreset (module ids and module params), or null
//   apply(kernel, preset, tH) kernel.setIntervention(resolve(preset), tH); null clears (one at a time)
//   hudId(id)                kernel or HUD id → HUD id (the read-back of the active preset), or null
//
// Kernel semantics (§11.12, contract §6 of graph.js): when a preset is applied every cut and partial
// edge gain is reset, preset.apply(k) runs, and 'intervention' is dispatched with the preset, so each
// module's handler sees the id and params it keys on (enteric GUT_EFFECTS by id and params.level or
// params.segments, endocrine params.remove, somatic params.somatic, autonomic its own ids).
// Enteric clinical analogues (enteric.js INTERVENTIONS: hirschsprung, achalasia, pseudoObstruction)
// are not offered by the HUD (§13.13); resolve() passes any preset object with an apply() through.

import { nerveSection, spinalCordInjury, dorsalRhizotomy, NERVE_SECTIONS } from './somatic.js';
import { INTERVENTIONS as AUTONOMIC, PRESET_PARAMS as AUT_PARAMS } from './autonomic.js';
import { INTERVENTIONS as ENDOCRINE } from './endocrine.js';
import { splenicDenervation, vns } from './immune.js';

/** @typedef {import('./contracts').InterventionPreset} InterventionPreset */
/** @typedef {import('./contracts').KernelApi} KernelApi */

export const PARAMS = {
  // HUD defaults. The HUD has no side selector for these presets (B.10), so the right side is used [model].
  sci: { level: 'C6', type: 'complete', side: 'R', phase: 1 },             // §6.15 (somatic.js spinalCordInjury)
  nerveSection: { nerve: 'median', side: 'R', day: 0 },                    // §6.15 (somatic.js nerveSection)
  // The HUD offers no segment or variant rows (§13.13): C5–C7 right, all fibres (somatic.js default).
  dorsalRhizotomy: { segments: ['C5', 'C6', 'C7'], side: 'R', variant: 'all' },
  sympathectomy: { ...AUT_PARAMS.sympathectomyT2T3 },                       // §7.11 (side R, stellate option off)
  vns: { drive: 1 },                                                       // §10.8 relative drive 0–1 (immune.js vns default)
};

// An autonomic.js preset with these params: its apply() reads `this.params` (applyPreset(id, params)).
const autonomic = (id, params = {}) => {
  const p = AUTONOMIC.find((x) => x.id === id);
  if (!p) throw new Error(`interventions: autonomic.js exports no '${id}' preset`);
  return { ...p, params: { ...p.params, ...params } };
};

// Catalogue rows: HUD id, label (as ui-body.js), owner network, kernel id, defaults, and build(params)
// → the module presets to apply plus any extra kernel action (§11.12 table).
/** @type {{ id: string, label: string, net: import('./contracts').NetId, kernelId: string, defaults: Record<string, any>, build(p: Record<string, any>): { presets: InterventionPreset[], extra?: (k: KernelApi) => void } }[]} */
const ROWS = [
  { id: 'sci', label: 'Spinal cord injury', net: 'somatic', kernelId: 'sci', defaults: PARAMS.sci,
    build: (p) => ({ presets: [spinalCordInjury({ level: p.level, type: p.type, side: p.side, phase: p.phase })] }) },
  { id: 'nerveSection', label: 'Nerve section', net: 'somatic', kernelId: 'nerveSection', defaults: PARAMS.nerveSection,
    build: (p) => ({ presets: [nerveSection({ nerve: p.nerve, side: p.side, day: p.day })] }) },
  { id: 'dorsalRhizotomy', label: 'Dorsal rhizotomy', net: 'somatic', kernelId: 'dorsalRhizotomy', defaults: PARAMS.dorsalRhizotomy,
    build: (p) => ({ presets: [dorsalRhizotomy({ segments: p.segments, side: p.side, variant: p.variant })] }) },
  { id: 'heartTransplant', label: 'Heart transplant', net: 'autonomic', kernelId: 'heartTransplant', defaults: AUT_PARAMS.heartTransplant,
    build: (p) => ({ presets: [autonomic('heartTransplant', p)] }) },
  { id: 'atropine', label: 'Atropine', net: 'autonomic', kernelId: 'atropine', defaults: AUT_PARAMS.atropine,
    build: (p) => ({ presets: [autonomic('atropine', p)] }) },
  // §11.12: abdominal cn10 edges go as well. immune.js cuts its own (VAGOTOMY_EDGES: the §10 vagal immune
  // afferent, the inflammatory-reflex efferent and the gut branch) on the 'intervention' event, so the
  // module preset alone gives the same cuts; enteric applies its own GUT_EFFECTS.
  { id: 'truncalVagotomy', label: 'Truncal vagotomy', net: 'autonomic', kernelId: 'truncalVagotomy', defaults: AUT_PARAMS.truncalVagotomy,
    build: (p) => ({ presets: [autonomic('truncalVagotomy', p)] }) },
  // HUD 'sympathectomy' is autonomic.js 'sympathectomyT2T3': autonomic keeps its factors only for its own ids.
  { id: 'sympathectomy', label: 'Sympathectomy T2–T3', net: 'autonomic', kernelId: 'sympathectomyT2T3', defaults: PARAMS.sympathectomy,
    build: (p) => ({ presets: [autonomic('sympathectomyT2T3', p)] }) },
  { id: 'pureAutonomicFailure', label: 'Pure autonomic failure', net: 'autonomic', kernelId: 'pureAutonomicFailure', defaults: AUT_PARAMS.pureAutonomicFailure,
    build: (p) => ({ presets: [autonomic('pureAutonomicFailure', p)] }) },
  { id: 'adrenalectomy', label: 'Adrenalectomy', net: 'neuroendocrine', kernelId: 'adrenalectomy', defaults: ENDOCRINE.adrenalectomy.params ?? {},
    build: () => ({ presets: [ENDOCRINE.adrenalectomy] }) },
  { id: 'hypophysectomy', label: 'Hypophysectomy', net: 'neuroendocrine', kernelId: 'hypophysectomy', defaults: ENDOCRINE.hypophysectomy.params ?? {},
    build: () => ({ presets: [ENDOCRINE.hypophysectomy] }) },
  { id: 'splenicDenervation', label: 'Splenic denervation', net: 'neuroimmune', kernelId: 'splenicDenervation', defaults: {},
    build: () => ({ presets: [splenicDenervation] }) },
  { id: 'vns', label: 'Vagus nerve stimulation', net: 'neuroimmune', kernelId: 'vns', defaults: PARAMS.vns,
    build: (p) => ({ presets: [vns(Number(p.drive))] }) },
];
const ROW = new Map(ROWS.map((r) => [r.id, r]));
const KERNEL_ROW = new Map(ROWS.map((r) => [r.kernelId, r]));

// Kernel-ready preset of a catalogue row with these params.
function compose(row, params) {
  const { presets, extra } = row.build(params);
  const own = Object.assign({}, ...presets.map((p) => p.params ?? {}));
  const p0 = presets[0];
  /** @type {InterventionPreset & Record<string, any>} */
  const out = {
    id: row.kernelId,
    label: row.label,
    net: row.net,
    hud: row.id,
    params: { ...params, ...own },
    apply(k) {
      for (const p of presets) p.apply(k);
      extra?.(k);
    },
  };
  // Data the owner module attaches (somatic SCI `partial`, autonomic `expected`, somatic targets(graph)).
  for (const key of ['partial', 'expected']) if (p0 && key in p0) out[key] = /** @type {any} */ (p0)[key];
  if (p0 && typeof (/** @type {any} */ (p0)).targets === 'function') out.targets = (/** @type {any} */ (p0)).targets.bind(p0);
  return out;
}

/** The §6, §7, §9 and §10 presets under the HUD ids (ui-body.js INTERVENTIONS, without 'none'). */
/** @type {ReadonlyArray<InterventionPreset & { kernelId: string }>} */
export const INTERVENTIONS = Object.freeze(ROWS.map((row) => Object.freeze({
  id: row.id,
  label: row.label,
  net: row.net,
  kernelId: row.kernelId,
  params: Object.freeze(structuredClone(row.defaults)),
  /** Applies the defaults; prefer apply(kernel, preset), which hands the kernel the module ids. */
  apply(k) { compose(row, structuredClone(row.defaults)).apply(k); },
})));
export const INTERVENTION_IDS = Object.freeze(ROWS.map((r) => r.id));
export { NERVE_SECTIONS };

const META = new Set(['id', 'label', 'net', 'params', 'apply', 'kernelId', 'hud', 'targets', 'partial', 'expected']);

/**
 * HUD payload, id or preset → the kernel-ready preset (null for none).
 * HUD payloads carry their parameters flat ({ id: 'sci', level, type, phase }, ui-body.js _preset);
 * a `params` object is merged over them. A preset object whose id is not in the catalogue and that has
 * its own apply() (e.g. an enteric.js analogue or a module preset) is returned unchanged.
 * @param {null | undefined | string | Record<string, any>} preset
 * @returns {InterventionPreset | null}
 */
export function resolve(preset) {
  if (preset == null || preset === 'none') return null;
  const src = typeof preset === 'string' ? { id: preset } : preset;
  if (src.id === 'none') return null;
  const row = ROW.get(src.id) ?? (src.hud ? ROW.get(src.hud) : undefined) ?? KERNEL_ROW.get(src.id);
  if (!row) {
    if (typeof src.apply === 'function') return /** @type {InterventionPreset} */ (src);
    throw new Error(`interventions: unknown preset '${src.id}'`);
  }
  const flat = Object.fromEntries(Object.entries(src).filter(([key]) => !META.has(key)));
  const params = { ...structuredClone(row.defaults), ...flat };
  // Only the row's own parameter names are taken from a resolved preset's params (module params such as
  // somatic's kind/dysreflexia are rebuilt by the owner's factory).
  if (src.params) for (const key of Object.keys(row.defaults)) if (key in src.params) params[key] = src.params[key];
  return compose(row, params);
}

/**
 * The HUD id of an active preset (B.10 round trip): the kernel records the module id
 * (`k.stores._k.intervention`, e.g. 'sympathectomyT2T3'), the HUD knows the catalogue id
 * ('sympathectomy'). Catalogue ids map to themselves; null, 'none' and unknown ids give null.
 * @param {null | undefined | string} id
 * @returns {string | null}
 */
export function hudId(id) {
  if (id == null || id === 'none') return null;
  return (ROW.get(id) ?? KERNEL_ROW.get(id))?.id ?? null;
}

/**
 * Applies one preset (or none) at tH (B.4): every cut and partial gain of the previous preset is reset
 * first (one preset at a time, §11.12). Returns the scheduled tH.
 * @param {KernelApi} kernel
 * @param {null | undefined | string | Record<string, any>} preset
 * @param {number} [tH]
 */
export function apply(kernel, preset, tH) {
  return kernel.setIntervention(resolve(preset), tH);
}
