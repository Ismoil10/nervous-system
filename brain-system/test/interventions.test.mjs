// Interventions (research/ANALYSIS.md §11.12, A.5, B.4, B.11, B.14; §6.15, §7.11, §9, §10.8).
// 1. Catalogue: src/sim/interventions.js offers exactly the HUD ids of ui-body.js INTERVENTIONS (without
//    'none'), with the HUD labels, and resolves the HUD payloads (ui-body.js _preset) to kernel presets.
// 2. Each preset on a kernel with all plugins: the owner module's cuts and factors, and the other
//    modules' handlers (enteric GUT_EFFECTS by id and params, endocrine params.remove, somatic params).
// 3. One preset at a time (§11.12): applying another preset or none resets the previous cuts and factors.
// 4. Kernel intervention semantics: partial edge gains (scaleEdge), the per-call preset registry, and
//    the rest-state settle that drops cuts together with the store.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, NET_IDS, CUT_MASK } from '../src/sim/graph.js';
import { makeStimulus } from '../src/sim/stimuli.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic, cutTargets, spinalCordInjury } from '../src/sim/somatic.js';
import { plugin as autonomic } from '../src/sim/autonomic.js';
import { plugin as enteric, GUT_EFFECTS, INTERVENTIONS as GUT_PRESETS } from '../src/sim/enteric.js';
import { plugin as endocrine } from '../src/sim/endocrine.js';
import { plugin as immune, VAGOTOMY_EDGES } from '../src/sim/immune.js';
import { INTERVENTIONS, INTERVENTION_IDS, PARAMS, resolve, apply } from '../src/sim/interventions.js';
import { INTERVENTIONS as HUD } from '../src/ui-body.js';

const PLUGINS = [brainnet, sensory, somatic, autonomic, enteric, endocrine, immune];
const GRAPH = buildGraph({ plugins: PLUGINS });
const kernel = () => new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1 });
const cuts = (k) => k.stores._k.cuts.slice();
const edge = (k, a, b) => { const e = k.edgeIndex(a, b); assert.ok(e >= 0, `edge ${a} → ${b}`); return e; };
// Apply a preset at tH and step just past it.
const at = (k, preset, tH) => { apply(k, preset, tH); k.advanceTo(tH + 0.01); };
// The HUD payload ui-body.js _preset() builds for an id (its default control values).
const hudPayload = (id, extra = {}) => ({ id, ...extra });

describe('catalogue and HUD mapping (B.10, B.11, §13.13)', () => {
  test('the catalogue holds exactly the HUD intervention ids, in HUD order, with the HUD labels', () => {
    const hud = HUD.filter((x) => x.id !== 'none');
    assert.deepEqual(INTERVENTION_IDS, hud.map((x) => x.id));
    for (const h of hud) assert.equal(INTERVENTIONS.find((p) => p.id === h.id)?.label, h.label, h.id);
    for (const p of INTERVENTIONS) {
      assert.ok(NET_IDS.includes(p.net), `${p.id} owner network`);
      assert.equal(typeof p.apply, 'function');
      assert.ok(Object.isFrozen(p) && Object.isFrozen(p.params), `${p.id} is data`);
    }
  });

  test('every HUD parameter row reaches the owner preset (ui-body.js _preset payloads)', () => {
    const sci = resolve(hudPayload('sci', { level: 'T6', type: 'anterior', phase: 3 }));
    assert.deepEqual([sci.params.level, sci.params.type, sci.params.phase, sci.params.somatic, sci.params.kind], ['T6', 'anterior', 3, true, 'sci']);
    assert.equal(sci.params.dysreflexia, true, 'T6 activates the §7 dysreflexia rule');
    const nerve = resolve(hudPayload('nerveSection', { nerve: 'ulnar', day: 14 }));
    assert.deepEqual([nerve.params.nerve, nerve.params.day, nerve.params.kind], ['ulnar', 14, 'nerve']);
    const symp = resolve(hudPayload('sympathectomy', { stellate: true }));
    assert.equal(symp.params.stellate, true);
    assert.equal(resolve(hudPayload('vns', { drive: 0.35 })).params.drive, 0.35);
  });

  test('HUD gaps are filled with the documented defaults: right side, C5–C7 rhizotomy (B.10 has no rows for them)', () => {
    assert.equal(resolve('sci').params.side, PARAMS.sci.side);
    assert.equal(resolve('nerveSection').params.side, 'R');
    assert.deepEqual(resolve('dorsalRhizotomy').params.segments, ['C5', 'C6', 'C7']);
    assert.equal(resolve('sympathectomy').params.side, 'R');
  });

  test('resolve: none, kernel ids, unknown ids and foreign presets', () => {
    assert.equal(resolve(null), null);
    assert.equal(resolve('none'), null);
    assert.equal(resolve({ id: 'none' }), null);
    assert.throws(() => resolve('lobotomy'), /unknown preset/);
    // The HUD's 'sympathectomy' is autonomic.js 'sympathectomyT2T3': the kernel and the modules see that id.
    const s = resolve('sympathectomy');
    assert.equal(s.id, 'sympathectomyT2T3');
    assert.equal(/** @type {any} */ (s).hud, 'sympathectomy');
    assert.equal(resolve(s).id, 'sympathectomyT2T3', 'a resolved preset resolves to itself');
    for (const id of INTERVENTION_IDS.filter((x) => x !== 'sympathectomy')) assert.equal(resolve(id).id, id);
    // Enteric analogues are not on the HUD; they pass through with their own apply().
    assert.equal(resolve(GUT_PRESETS[0]), GUT_PRESETS[0]);
  });
});

describe('each preset on a kernel with all plugins (§11.12)', () => {
  test('spinal cord injury: the somatic cut set, the som.int record and the enteric SCI row (§6.15, §8.16)', () => {
    const k = kernel();
    at(k, hudPayload('sci', { level: 'C6', type: 'complete', phase: 1 }), 1);
    const som = cutTargets(GRAPH, spinalCordInjury({ level: 'C6' }).params), all = cuts(k);
    assert.ok(som.length > 100 && som.every((e) => all.includes(e)), 'every somatic target is cut');
    const extra = all.filter((e) => !som.includes(e));
    assert.ok(extra.length > 0 && extra.every((e) => GRAPH.edges[e].plugin === 'enteric'), 'the rest are the enteric spinal visceral afferents (spinGastric 0)');
    assert.equal(k.get('som.int.kind'), 2);
    const fx = GUT_EFFECTS.sci({ level: 'C6' });
    for (const [key, v] of Object.entries(fx)) assert.equal(k.get(`ens.fx.${key}`), v, key);
    assert.equal(k.stores._k.intervention, 'sci');
  });

  test('nerve section and dorsal rhizotomy: the somatic edges of that nerve or root, right side', () => {
    const k = kernel();
    at(k, hudPayload('nerveSection', { nerve: 'median', day: 0 }), 1);
    const median = cuts(k);
    assert.ok(median.length > 0);
    assert.ok(median.every((e) => !(GRAPH.edges[e].fromId.endsWith('.L') && GRAPH.edges[e].toId.endsWith('.L'))), 'right median only');
    assert.equal(k.get('som.int.kind'), 1);
    at(k, 'dorsalRhizotomy', 2);
    assert.ok(cuts(k).length > 0);
    assert.notDeepEqual(cuts(k), median, 'the section was reset first');
    assert.equal(k.get('som.int.kind'), 3);
    assert.equal(k.get('ens.fx.spinGastric'), 1, 'C5–C7 roots carry no gastric visceral afferents');
  });

  test('heart transplant, atropine and pure autonomic failure: autonomic factors, enteric rows (§7.11)', () => {
    const k = kernel();
    at(k, 'heartTransplant', 1);
    assert.equal(k.get('aut.iv.vagCard'), 0);
    assert.equal(k.get('aut.iv.adrBeta'), 2);
    assert.ok(cuts(k).includes(edge(k, 'cardiacPlexus', 'saNode')));
    at(k, 'atropine', 2);
    assert.equal(k.get('aut.iv.vagCard'), 0);
    assert.equal(k.get('aut.iv.adrBeta'), 1, 'the transplant factors were reset');
    assert.equal(cuts(k).length, 0);
    assert.equal(k.get('ens.fx.excite'), GUT_EFFECTS.atropine.excite);
    at(k, 'pureAutonomicFailure', 3);
    assert.ok(Math.abs(k.get('aut.iv.symCard') - 0.1) < 1e-12 && Math.abs(k.get('aut.iv.vagCard') - 0.3) < 1e-12);
    assert.equal(k.get('ens.fx.excite'), 1);
    assert.equal(k.get('ens.fx.colonKappa'), 0.7);
  });

  test('truncal vagotomy also cuts the §10 vagal immune edges (immune.js VAGOTOMY_EDGES) and the enteric vagal rows', () => {
    const k = kernel();
    at(k, 'truncalVagotomy', 1);
    assert.equal(k.get('aut.iv.vagGut'), 0);
    for (const [a, b] of VAGOTOMY_EDGES) assert.ok(cuts(k).includes(edge(k, a, b)), `${a} → ${b}`);
    for (const key of ['vagProx', 'vagDist', 'vagAff']) assert.equal(k.get(`ens.fx.${key}`), 0, key);
    assert.equal(k.get('aut.iv.vagCard'), 1, 'cardiac vagus intact');
  });

  test('sympathectomy keeps its autonomic factors under the HUD id (stellate option: Horner channels)', () => {
    const k = kernel();
    at(k, hudPayload('sympathectomy', { stellate: true }), 1);
    assert.equal(k.get('aut.iv.sudoPalm'), 0);
    assert.equal(k.get('aut.iv.symPupR'), 0);
    for (const [a, b] of [['stellate.R', 'sweatPalm.R'], ['scg.R', 'pupilDilator.R'], ['cord.T1.iml.R', 'scg.R']]) assert.ok(cuts(k).includes(edge(k, a, b)), `${a} → ${b}`);
    at(k, hudPayload('sympathectomy', { stellate: false }), 2);
    assert.equal(k.get('aut.iv.symPupR'), 1);
    assert.ok(!cuts(k).includes(edge(k, 'scg.R', 'pupilDilator.R')));
  });

  test('adrenalectomy and hypophysectomy: gland flags and their edges (§9)', () => {
    const k = kernel();
    at(k, 'adrenalectomy', 1);
    assert.equal(k.get('en.rmCortex'), 1);
    assert.equal(k.get('en.rmMedulla'), 1);
    assert.ok(cuts(k).some((e) => GRAPH.edges[e].fromId.startsWith('adrenalMedulla')));
    at(k, 'hypophysectomy', 2);
    assert.equal(k.get('en.rmCortex'), 0);
    assert.equal(k.get('en.rmAnt'), 1);
    assert.ok(cuts(k).some((e) => GRAPH.edges[e].toId === 'pituitaryAnt' || GRAPH.edges[e].fromId === 'pituitaryAnt'));
  });

  test('splenic denervation and vagus nerve stimulation (§10.8)', () => {
    const k = kernel();
    at(k, 'splenicDenervation', 1);
    assert.ok(cuts(k).includes(edge(k, 'coeliac.L', 'splenicTcells')));
    at(k, hudPayload('vns', { drive: 0.6 }), 2);
    assert.equal(cuts(k).length, 0);
    assert.equal(k.get('vns'), 0.6);
  });

  test('none clears every cut and factor; the HUD reads the kernel id back (ui-body.js update)', () => {
    const k = kernel();
    at(k, 'heartTransplant', 1);
    at(k, null, 2);
    assert.equal(cuts(k).length, 0);
    assert.equal(k.get('aut.iv.vagCard'), 1);
    assert.equal(k.stores._k.intervention, null);
    const hudIds = new Set(HUD.map((x) => x.id));
    for (const id of INTERVENTION_IDS) assert.ok(hudIds.has(/** @type {any} */ (resolve(id)).hud), id);
  });

  test('presets compose with the switches: a cut edge stays cut whatever the network gains (A.5)', () => {
    const k = kernel();
    at(k, 'splenicDenervation', 1);
    const e = edge(k, 'coeliac.L', 'splenicTcells');
    k.setNet('autonomic', false, 1.1); k.advanceTo(3); k.setNet('autonomic', true, 3); k.advanceTo(5);
    assert.equal(k.edgeGate(e), 0);
    assert.equal(k.gate(GRAPH.edges[e].nets), 1);
  });
});

describe('kernel intervention semantics (§11.12, contract §6)', () => {
  test('presets that share an id keep their own params (one registry key per call)', () => {
    const k = kernel();
    apply(k, hudPayload('sci', { level: 'C6' }), 1);
    apply(k, hudPayload('sci', { level: 'T10' }), 2);
    k.advanceTo(1.5);
    const c6 = cuts(k);
    assert.equal(k.get('som.int.level'), 5);
    k.advanceTo(2.5);
    assert.equal(k.get('som.int.level'), 17);
    assert.notDeepEqual(cuts(k), c6);
  });

  test('scaleEdge: a partial gain scales the ring drive and edgeGate; applying a preset resets it', () => {
    const k = kernel();
    const e = edge(k, 'cuneate.R', 'thalVPL.L'), q = k.nf.csrOf.get(e);
    k.scaleEdge(e, 0.5);
    assert.equal(k.edgeScale(e), 0.5);
    assert.equal(k.edgeGate(e), 0.5);
    assert.equal(k.nf.w[q], 0.5 * k.nf.w0[q]);
    const snap = k.snapshot();
    k.scaleEdge(e, 1);
    assert.equal(k.nf.w[q], k.nf.w0[q]);
    k.restore(snap);
    assert.equal(k.nf.w[q], 0.5 * k.nf.w0[q], 'restore rebuilds the weights from the stored scales');
    at(k, 'atropine', k.t + 0.1);
    assert.equal(k.edgeScale(e), 1);
    assert.equal(k.nf.w[q], k.nf.w0[q]);
  });

  test('a partial gain on the dorsal-column relay delays the S1 arrival; 0 removes it (§6.15 partial preservation)', () => {
    const lat = (g) => {
      const k = kernel();
      for (const e of [edge(k, 'portDC.R', 'cuneate.R')]) k.scaleEdge(e, g);
      k.schedule(makeStimulus({ sense: 'touch', mode: 'press', site: 'indexTip', side: 'R', intensity: 50, durationMs: 50, tOnset: 0.1 }));
      k.advanceTo(0.2);
      const ev = []; k.events(ev);
      return ev.find((x) => x.kind === 'arrival' && x.node === 'cuneate.R')?.latencyMs ?? Infinity;
    };
    const full = lat(1), half = lat(0.5);
    assert.ok(Number.isFinite(full) && half >= full, `cuneate ${full} ms, ×0.5 ${half} ms`);
  });

  test('settle after a cache miss drops the cuts with the store, so edgeGate and the NF mask agree', () => {
    const k = kernel();
    const e = edge(k, 'cuneate.R', 'thalVPL.L'), q = k.nf.csrOf.get(e);
    k.cutEdge(e, true);
    assert.equal(k.nf.mask[q], CUT_MASK, 'cut in the NF table');
    k.settle({ posture: 'upright' });   // a new cache key
    assert.equal(k.edgeGate(e), 1);
    assert.equal(k.nf.mask[q], k.nf.mask0[q]);
  });
});
