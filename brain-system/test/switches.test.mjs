// Network switches (research/ANALYSIS.md A.5, §11.10, §11.11, §12.14, §12.21; B.11, B.14 phases 4–8).
// All seven plugins (brainnet, sensory and the five network modules) on one graph.
// 1. Every A.5 row on a probe stimulus: what turns off, what keeps running, what emerges.
// 2. Every cross-network AND edge of §11.11 in the graph: its mask and its kernel gate under each
//    single switch; the adrenal AND edge and the gut branch also functionally.
// 3. The §12.14 single-switch outcome matrix for hotObject, loudSound, brightLight, kneeJerk and
//    stressor ("=" is within ±1 % of all networks on; latencies within one sample).
// 4. All 32 switch sets settle to a bounded steady state (A.5, §12.21).
// Cells the modules do not reproduce yet are `todo` with the measured value and the owner.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Kernel } from '../src/sim/kernel.js';
import { buildGraph, NET, NET_IDS, BODY_BIT } from '../src/sim/graph.js';
import { makeStimulus } from '../src/sim/stimuli.js';
import { ScenarioPlayer, availability } from '../src/sim/scenarios.js';
import { plugin as brainnet } from '../src/sim/brainnet.js';
import { plugin as sensory } from '../src/sim/sensory.js';
import { plugin as somatic } from '../src/sim/somatic.js';
import { plugin as autonomic, ihr } from '../src/sim/autonomic.js';
import { plugin as enteric } from '../src/sim/enteric.js';
import { plugin as endocrine } from '../src/sim/endocrine.js';
import { plugin as immune } from '../src/sim/immune.js';

const PLUGINS = [brainnet, sensory, somatic, autonomic, enteric, endocrine, immune];
const GRAPH = buildGraph({ plugins: PLUGINS });
const IHR30 = 101.0;   // IHR at age 30 (A.8 #11; §7.5)

// A kernel settled under a switch set (the resting state of that set, §11.10 rule 5).
function kernel({ off = [], brain = false } = {}) {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, settle: false });
  for (const n of off) k.set(`net.${n}`, 0);
  if (brain) k.set('bodyMode', 0);
  k.settle({});
  return k;
}
const stim = (k, spec, tOnset) => k.schedule(makeStimulus({ ...spec, tOnset }));
const reader = (k, n) => (n.startsWith('a:') ? ((j) => () => k.a(j))(k.nfIndex(n.slice(2))) : () => k.get(n));
// Sample readouts from t0 to t1 (s of kernel time); returns { base, up, down, on } per readout, base
// taken at t0, `on` = first time |x − base| ≥ thr (s after t0).
function probe(k, names, t0, t1, { dt = 0.0025, thr = {}, advance = (t) => k.advanceTo(t) } = {}) {
  advance(t0);
  const rd = names.map((n) => reader(k, n)), base = rd.map((f) => f());
  const out = Object.fromEntries(names.map((n, i) => [n, { base: base[i], up: 0, down: 0, on: Infinity, last: base[i] }]));
  for (let t = t0 + dt; t <= t1 + 1e-12; t += dt) {
    advance(t + 1e-7);
    names.forEach((n, i) => {
      const o = out[n], x = rd[i](), d = x - base[i];
      o.up = Math.max(o.up, d); o.down = Math.min(o.down, d); o.last = x;
      if (o.on === Infinity && Math.abs(d) >= (thr[n] ?? 0.1)) o.on = t - t0;
    });
  }
  return out;
}
const THR = { scr: 0.05, 'pupilD.R': 0.05, 'pupilD.L': 0.05, hr: 1 };
// A §12 scenario under a switch set (or brain-only), played by the ScenarioPlayer; null when unavailable.
function scenario(id, { off = [], brain = false } = {}, names, span) {
  const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, settle: false });
  for (const n of off) k.set(`net.${n}`, 0);
  if (brain) k.set('bodyMode', 0);
  const p = new ScenarioPlayer({ kernel: k });
  p.select(id);
  if (!p.play()) return null;
  return probe(k, names, p.run.onset - 1e-6, p.run.onset + span, { thr: THR, advance: (t) => p.advanceTo(t) });
}
const same = (a, b, rel = 0.01, abs = 1e-6) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));

// --- 1. A.5 rows ---
describe('A.5 switch rows on probe stimuli', () => {
  test('master → brain only: body frozen, non-special afferent ports silent, special senses central only; rest restored on return', () => {
    const k = kernel();
    stim(k, { sense: 'pain', mode: 'heat', site: 'forearmDorsal', side: 'R', intensity: 55, durationMs: 5000 }, 1);
    k.advanceTo(1.6);
    const BODY = ['hr', 'sbp', 'map', 'pupilD.R', 'scr', 'tCore', 'paco2', 'emg.biceps', 'joint.elbow', 'cortisolRel', 'adrenalineRel', 'gastricSolid', 'tnf', 'tSet'];
    k.setBodyMode('brain', 1.6);
    k.advanceTo(1.6005);
    const frozen = Object.fromEntries(BODY.map((n) => [n, k.get(n)]));
    assert.ok(frozen['emg.biceps'] > 0.5, 'frozen mid-withdrawal');
    const r = probe(k, ['a:portDC.R', 'a:portSTT.L', 'a:portVisc.R', 'a:pnc.R', 'a:n7m.R', 'emg.orbicularisOculi', 'scr'], 3, 3.3);
    stim(k, { sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, params: { riseMs: 0.5 } }, 3.05);
    const s = probe(k, ['a:pnc.R', 'a:n7m.R', 'emg.orbicularisOculi', 'scr', 'pupilD.R'], 3.04, 3.5, { thr: THR });
    for (const n of BODY) assert.equal(k.get(n), frozen[n], `${n} frozen`);
    for (const p of ['portDC.R', 'portSTT.L', 'portVisc.R']) assert.ok(k.rate(p) < 5 && r[`a:${p}`].last < k.aRest(k.nfIndex(p)), `${p} silent: ${k.rate(p)} Hz`);
    assert.ok(s['a:pnc.R'].up > 0.1 && s['a:n7m.R'].up > 0.1, 'central startle command computed (efference only)');
    for (const n of ['emg.orbicularisOculi', 'scr', 'pupilD.R']) assert.equal(s[n].up - s[n].down, 0, `${n}: no body response`);
    // Blood-borne inputs at their basal or clamped values (life-support assumption).
    assert.ok(Math.abs(k.get('tCore') - 37) < 1e-6 && Math.abs(k.get('paco2') - 40) < 0.5, `tCore ${k.get('tCore')}, paco2 ${k.get('paco2')}`);
    assert.equal(availability('hotObject', k), 'Needs the body');
    k.setBodyMode('body', 4);
    k.advanceTo(4.0005);
    const rest = kernel();
    for (const n of ['hr', 'sbp', 'pupilD.R', 'emg.biceps', 'joint.elbow', 'cortisolRel', 'gastricSolid']) assert.ok(same(k.get(n), rest.get(n), 1e-9), `${n} back at rest: ${k.get(n)} vs ${rest.get(n)}`);
  });

  test('somatic off: no somatic reflex or body-surface arrival; startle is efference only; ventilation maintained', () => {
    const k = kernel({ off: ['somatic'] });
    stim(k, { sense: 'proprioception', mode: 'tendonTap', site: 'patellarTendon', side: 'R', intensity: 2 }, 1);
    const tap = probe(k, ['emg.quadriceps', 'joint.knee'], 0.999, 1.5);
    stim(k, { sense: 'touch', mode: 'press', site: 'indexTip', side: 'R', intensity: 50, durationMs: 50 }, 2);
    const touch = probe(k, ['a:cuneate.R', 'a:s1.hand.L', 'a:portDC.R'], 1.999, 2.2);
    const k2 = kernel({ off: ['somatic'] });   // a fresh kernel: the touch above still leaves an SCR (see the todo below)
    stim(k2, { sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, params: { riseMs: 0.5 } }, 1);
    const loud = probe(k2, ['a:n7m.R', 'emg.orbicularisOculi', 'emg.sternocleidomastoid', 'scr'], 0.999, 4, { thr: THR });
    assert.equal(tap['emg.quadriceps'].up, 0);
    assert.equal(tap['joint.knee'].up, 0);
    for (const n of ['a:cuneate.R', 'a:s1.hand.L', 'a:portDC.R']) assert.ok(touch[n].up < 0.01, `${n} silent`);
    assert.ok(loud['a:n7m.R'].up > 0.1, 'facial motor command computed');
    assert.equal(loud['emg.orbicularisOculi'].up, 0, 'no blink');
    assert.equal(loud['emg.sternocleidomastoid'].up, 0, 'no limb startle');
    assert.ok(loud.scr.on >= 1 && loud.scr.on <= 3, `startle reduces to autonomic signs: SCR at ${loud.scr.on} s`);
    assert.ok(k.get('rr') > 10 && Math.abs(k.get('paco2') - 40) <= 2, `ventilation maintained: rr ${k.get('rr')}, paco2 ${k.get('paco2')}`);
    assert.equal(k.get('shiver'), 0);
    assert.equal(k.get('emg.diaphragm'), 0, 'EMG/force 0');
  });

  test('somatic off: body-surface pain produces no autonomic response either (A.5)', { todo: 'brainnet/sensory: salience of a body-surface stimulus is not gated by g.somatic, so hotObject with somatic off still gives an SCR (+0.88 µS) and the defence-offset HR rise (§12.14 says none)' }, () => {
    const r = scenario('hotObject', { off: ['somatic'] }, ['scr', 'hr'], 5);
    assert.equal(r.scr.up, 0);
    assert.ok(r.hr.up < 0.5);
  });

  test('autonomic off: HR at intrinsic rate, pupils fixed at the denervated diameter, no SCR; central chemoreflex holds PaCO₂', () => {
    const k = kernel({ off: ['autonomic'] });
    assert.ok(Math.abs(k.get('hr') - ihr(30)) < 0.05 && Math.abs(k.get('hr') - IHR30) < 0.5, `hr ${k.get('hr')}`);
    assert.ok(Math.abs(k.get('pupilD.R') - 5) < 0.01 && Math.abs(k.get('pupilD.L') - 5) < 0.01, 'pupils 5.0 mm');
    assert.ok(Math.abs(k.get('paco2') - 40) <= 2, `paco2 ${k.get('paco2')}`);
    stim(k, { sense: 'vision', mode: 'step', side: 'R', intensity: 3, durationMs: 1000 }, 1);
    const light = probe(k, ['pupilD.R', 'pupilD.L', 'a:ew.R'], 0.999, 2.5, { thr: THR });
    stim(k, { sense: 'hearing', mode: 'noise', side: 'both', intensity: 105, durationMs: 50, params: { riseMs: 0.5 } }, 3);
    const loud = probe(k, ['scr', 'hr', 'emg.orbicularisOculi'], 2.999, 7, { thr: THR });
    assert.equal(light['pupilD.R'].down, 0, 'no light reflex');
    assert.ok(light['a:ew.R'].up > 0.5, 'EW still computes its command (efference only)');
    assert.equal(loud.scr.up, 0, 'no SCR');
    assert.ok(loud.hr.up < 1e-6 && loud.hr.down > -1e-6, 'HR flat (intrinsic)');
    assert.ok(loud['emg.orbicularisOculi'].up > 0.1, 'blink unaffected');
  });

  test('enteric off: motility index ≈ 0 (A.5)', () => {
    const on = kernel(), off = kernel({ off: ['enteric'] });
    on.advanceTo(600); off.advanceTo(600);
    assert.ok(on.get('ens.motility') > 1, `motility on ${on.get('ens.motility')}`);
    assert.ok(off.get('ens.motility') < 1e-6, `motility off ${off.get('ens.motility')}`);
  });

  // Stress input as in the stressor scenario (§12.3): u_stress = 1 for 15 min.
  const stress = (off) => {
    const k = kernel({ off });
    k.setInputs((t) => (t < 900 ? { stress: 1 } : {}));
    let cort = 0, adr = 0, crh = 0;
    for (let t = 60; t <= 1500; t += 60) { k.advanceTo(t); cort = Math.max(cort, k.get('cortisolRel')); adr = Math.max(adr, k.get('adrenalineRel')); crh = Math.max(crh, k.get('crhRel')); }
    return { cort, adr, crh };
  };
  test('neuroendocrine off: hormones held at basal (replacement, never zero); hypothalamic commands still computed', () => {
    const all = stress([]), ne = stress(['neuroendocrine']);
    assert.ok(all.cort > 1.5 && all.adr > 2, `all on: cortisol ×${all.cort}, adrenaline ×${all.adr}`);
    assert.ok(same(ne.cort, 1, 0.01) && same(ne.adr, 1, 0.01), `ne off: cortisol ×${ne.cort}, adrenaline ×${ne.adr}`);
    assert.ok(ne.crh > 1.5, `CRH command ×${ne.crh} (tints)`);
  });

  test('neuroimmune off: cytokines still rise and run higher; no fever (tSet flat at 37.0)', () => {
    const run = (off) => {
      const k = kernel({ off });
      k.schedule({ type: 'lps', dose: 2, unit: 'ng/kg', route: 'iv', tH: 10 });
      let tnf = 0, dSet = 0;
      for (let t = 600; t <= 5400; t += 600) { k.advanceTo(t); tnf = Math.max(tnf, k.get('tnf')); dSet = Math.max(dSet, Math.abs(k.get('tSet') - 37)); }
      return { tnf, dSet };
    };
    const all = run([]), ni = run(['neuroimmune']);
    assert.ok(all.dSet > 0.3, `all on: ΔtSet ${all.dSet}`);
    assert.equal(ni.dSet, 0, 'tSet flat');
    assert.ok(ni.tnf > all.tnf, `TNF peak ${ni.tnf} > ${all.tnf} (both brakes lost)`);
  });
});

// --- 2. Cross-network AND edges (§11.11) ---
describe('cross-network AND edges (§11.11, A.5)', () => {
  const E = (from, to) => GRAPH.edges.find((e) => e.fromId === from && e.toId === to);
  const AND = [
    ['adrenal adrenaline', 'adrenalMedulla.R', 'adrenaline', ['autonomic', 'neuroendocrine']],
    ['inflammatory-reflex efferent', 'portImmune.R', 'coeliac.R', ['autonomic', 'neuroimmune']],
    ['vagal immune sensing', 'immuneAff', 'portVisc.R', ['autonomic', 'neuroimmune']],
    ['cortisol on immune cells', 'cortisol', 'macrophages', ['neuroendocrine', 'neuroimmune']],
    ['cytokine → PVN', 'immuneCVO', 'pvn.R', ['neuroimmune']],
    ['gut branch of the inflammatory reflex', 'portVag.R', 'macrophages', ['autonomic', 'enteric', 'neuroimmune']],
    ['pupillary light reflex (efferent)', 'portPara.R', 'ciliaryGang.R', ['autonomic']],
    ['startle motor (blink)', 'n7m.R', 'orbicularisOculi.R', ['somatic']],
  ];
  for (const [label, from, to, nets] of AND) {
    test(`${label}: ${from} → ${to} needs ${nets.join(' ∧ ')}`, () => {
      const e = E(from, to);
      assert.ok(e, `edge ${from} → ${to}`);
      assert.equal(e.nets & ~BODY_BIT, nets.reduce((m, n) => m | NET[n], 0), `mask ${e.nets}`);
      assert.ok(e.nets & BODY_BIT, 'body edge');
    });
  }
  test('vagal motor to the gut wall needs autonomic ∧ enteric', () => {
    const es = GRAPH.edges.filter((e) => e.fromId === 'portVag.R' && /^gut\..*\.myenteric$/.test(e.toId));
    assert.ok(es.length > 0);
    for (const e of es) assert.equal(e.nets & ~BODY_BIT, NET.autonomic | NET.enteric, e.toId);
  });

  test('the kernel gate of each AND edge is 0 when any listed network is off and 1 when all are on', () => {
    const k = kernel();
    const edges = AND.map(([, a, b]) => E(a, b));
    let t = 1;
    for (const net of NET_IDS) {
      k.setNet(net, false, t); k.advanceTo(t + 1.1);
      for (let i = 0; i < AND.length; i++) assert.equal(k.edgeGate(edges[i].i), AND[i][3].includes(net) ? 0 : 1, `${AND[i][0]} with ${net} off`);
      k.setNet(net, true, t + 1.1); k.advanceTo(t + 2.2);
      for (const e of edges) assert.equal(k.edgeGate(e.i), 1);
      t += 2.2;
    }
    k.setBodyMode('brain', t); k.advanceTo(t + 0.01);
    for (const e of edges) assert.equal(k.edgeGate(e.i), 0, 'every body edge stops in brain-only mode');
  });

  test('adrenal AND edge, functionally: no adrenaline surge if autonomic or neuroendocrine is off; cortisol still rises with autonomic off', () => {
    const run = (off) => {
      const k = kernel({ off });
      k.setInputs((t) => (t < 900 ? { stress: 1 } : {}));
      let adr = 0, cort = 0;
      for (let t = 60; t <= 1800; t += 60) { k.advanceTo(t); adr = Math.max(adr, k.get('adrenalineRel')); cort = Math.max(cort, k.get('cortisolRel')); }
      return { adr, cort };
    };
    const all = run([]), aut = run(['autonomic']);
    assert.ok(all.adr > 2, `all on ×${all.adr}`);
    assert.ok(same(aut.adr, 1, 0.01), `autonomic off: adrenaline ×${aut.adr}`);
    assert.ok(aut.cort > 1.5, `autonomic off: cortisol ×${aut.cort} (HPA through blood)`);
  });
});

// --- 3. §12.14 switch-off matrix ---
describe('§12.14 switch-off outcome matrix', () => {
  const SETS = [['all', []], ...NET_IDS.map((n) => [n, [n]])];
  const run = (id, names, span) => Object.fromEntries(SETS.map(([key, off]) => [key, scenario(id, { off }, names, span)]));

  test('hotObject: somatic off no EMG or pain arrival; autonomic off EMG, contact break and pain =, no SCR, HR flat at 101, pupils 5.0; others =', () => {
    const r = run('hotObject', ['emg.biceps', 'som.contactBreak.R', 'a:insPost.L', 'scr', 'hr', 'pupilD.R'], 5);
    const a = r.all;
    assert.ok(a['emg.biceps'].on < 0.35 && a.scr.on < 3 && a['a:insPost.L'].on < 1, 'all on: the scenario responds');
    assert.equal(r.somatic['emg.biceps'].up, 0);
    assert.equal(r.somatic['a:insPost.L'].on, Infinity, 'no pain arrival');
    assert.equal(r.somatic['som.contactBreak.R'].up, 0, 'no withdrawal, no contact break');
    const au = r.autonomic;
    assert.equal(au['emg.biceps'].on, a['emg.biceps'].on);
    assert.equal(au['som.contactBreak.R'].on, a['som.contactBreak.R'].on);
    assert.equal(au['a:insPost.L'].on, a['a:insPost.L'].on);
    assert.equal(au.scr.up, 0);
    assert.ok(Math.abs(au.hr.base - IHR30) < 0.5 && au.hr.up < 1e-6, `HR flat at ${au.hr.base}`);
    assert.ok(Math.abs(au['pupilD.R'].base - 5) < 0.01);
    for (const key of ['enteric', 'neuroendocrine', 'neuroimmune']) {
      assert.equal(r[key]['emg.biceps'].on, a['emg.biceps'].on, `${key}: EMG =`);
      assert.ok(same(r[key].scr.up, a.scr.up) && same(r[key].hr.up, a.hr.up), `${key}: SCR and HR =`);
    }
  });

  test('loudSound: somatic off no blink (efference only), SCR and pupil =; autonomic off blink =, no SCR, pupils 5.0, HR 101; others =; brain only central form', () => {
    const names = ['emg.orbicularisOculi', 'a:n7m.R', 'scr', 'pupilD.R', 'hr'];
    const r = run('loudSound', names, 5), a = r.all;
    assert.ok(a['emg.orbicularisOculi'].on >= 0.02 && a['emg.orbicularisOculi'].on <= 0.04, `blink EMG ${a['emg.orbicularisOculi'].on}`);
    const so = r.somatic;
    assert.equal(so['emg.orbicularisOculi'].up, 0);
    assert.ok(so['a:n7m.R'].up > 0.1, 'efference only');
    assert.ok(same(so.scr.up, a.scr.up) && same(so['pupilD.R'].up, a['pupilD.R'].up) && same(so.hr.up, a.hr.up), 'SCR, pupil and HR =');
    const au = r.autonomic;
    assert.equal(au['emg.orbicularisOculi'].on, a['emg.orbicularisOculi'].on, 'blink =');
    assert.equal(au.scr.up, 0);
    assert.ok(Math.abs(au['pupilD.R'].base - 5) < 0.01 && au['pupilD.R'].up === 0);
    assert.ok(Math.abs(au.hr.base - IHR30) < 0.5 && au.hr.up < 1e-6);
    for (const key of ['enteric', 'neuroendocrine', 'neuroimmune']) for (const n of names) assert.ok(same(r[key][n].up, a[n].up), `${key}: ${n} =`);
    const b = scenario('loudSound', { brain: true }, names, 5);
    assert.ok(b['a:n7m.R'].up > 0.1, 'central form: the command is computed');
    for (const n of ['emg.orbicularisOculi', 'scr', 'pupilD.R', 'hr']) assert.equal(b[n].up - b[n].down, 0, `brain only: no ${n}`);
  });

  test('brightLight: autonomic off no light reflex, pupils fixed at 5.0, central =; somatic and the others =; brain only central form', () => {
    const names = ['pupilD.R', 'pupilD.L', 'a:lgn.R', 'a:ew.R'];
    const r = run('brightLight', names, 3), a = r.all;
    assert.ok(a['pupilD.R'].down < -0.5 && a['pupilD.L'].down < -0.5, 'consensual constriction');
    const au = r.autonomic;
    assert.equal(au['pupilD.R'].down, 0);
    assert.ok(Math.abs(au['pupilD.R'].base - 5) < 0.01 && Math.abs(au['pupilD.L'].base - 5) < 0.01);
    assert.equal(au['a:lgn.R'].on, a['a:lgn.R'].on, 'central =');
    assert.equal(au['a:ew.R'].on, a['a:ew.R'].on, 'EW command =');
    for (const key of ['somatic', 'enteric', 'neuroendocrine', 'neuroimmune']) for (const n of names) assert.ok(same(r[key][n].down, a[n].down) && same(r[key][n].up, a[n].up), `${key}: ${n} =`);
    const b = scenario('brightLight', { brain: true }, names, 3);
    assert.equal(b['a:lgn.R'].on, a['a:lgn.R'].on, 'central form =');
    assert.equal(b['pupilD.R'].down, 0, 'no pupil');
  });

  test('kneeJerk: somatic off no EMG, movement or S1 arrival; every other switch =; brain only unavailable', () => {
    const names = ['emg.quadriceps', 'joint.knee', 'a:s1.leg.L'];
    const r = run('kneeJerk', names, 1), a = r.all;
    assert.ok(a['emg.quadriceps'].on <= 0.025 && a['joint.knee'].up > 1);
    assert.equal(r.somatic['emg.quadriceps'].up, 0);
    assert.equal(r.somatic['joint.knee'].up, 0);
    assert.ok(r.somatic['a:s1.leg.L'].up < 0.01);
    for (const key of ['autonomic', 'enteric', 'neuroendocrine', 'neuroimmune']) {
      assert.equal(r[key]['emg.quadriceps'].on, a['emg.quadriceps'].on, `${key}: EMG =`);
      assert.ok(same(r[key]['joint.knee'].up, a['joint.knee'].up), `${key}: movement =`);
    }
    assert.equal(scenario('kneeJerk', { brain: true }, names, 1), null);
  });

  test('stressor: neuroendocrine off no adrenaline, ACTH or cortisol rise; autonomic off HR flat at 101 and no adrenaline, cortisol still rises', () => {
    const names = ['cortisolRel', 'acthRel', 'adrenalineRel', 'hr'];
    const one = (off) => {
      const k = new Kernel({ graph: GRAPH, plugins: PLUGINS, seed: 1, settle: false });
      for (const n of off) k.set(`net.${n}`, 0);
      const p = new ScenarioPlayer({ kernel: k }); p.select('stressor'); assert.ok(p.play());
      return probe(k, names, p.run.onset - 1e-6, p.run.onset + 3600, { dt: 30, advance: (t) => p.advanceTo(t) });
    };
    const a = one([]), ne = one(['neuroendocrine']), au = one(['autonomic']);
    assert.ok(a.cortisolRel.up > 1 && a.adrenalineRel.up > 1 && a.hr.up > 5, 'all on: the stress response');
    for (const n of ['cortisolRel', 'acthRel', 'adrenalineRel']) assert.ok(Math.abs(ne[n].up) < 0.01 * ne[n].base + 1e-6 || ne[n].up < 0.01, `ne off: no ${n} rise (${ne[n].up})`);
    assert.ok(ne.hr.up > 1, `ne off: neural HR rise remains (+${ne.hr.up})`);
    assert.ok(Math.abs(au.hr.base - IHR30) < 0.5 && au.hr.up < 0.5, `autonomic off: HR flat at ${au.hr.base} (+${au.hr.up})`);
    assert.ok(au.adrenalineRel.up < 0.01, 'autonomic off: no adrenaline');
    assert.ok(au.cortisolRel.up > 0.5, `autonomic off: cortisol rises (+${au.cortisolRel.up})`);
  });
});

// --- 4. Every switch set ---
describe('all 32 switch sets (A.5 composition, §12.21)', () => {
  test('each set settles to a bounded steady state with finite readouts', () => {
    const names = ['hr', 'sbp', 'dbp', 'map', 'rr', 'paco2', 'pupilD.R', 'tCore', 'tSet', 'cortisolRel', 'adrenalineRel', 'ens.motility', 'tnf'];
    for (let m = 0; m < 32; m++) {
      const off = NET_IDS.filter((_, b) => m & (1 << b));
      const k = kernel({ off });
      k.advanceTo(50);
      const v0 = names.map((n) => k.get(n));
      k.advanceTo(60);
      names.forEach((n, i) => {
        const x = k.get(n);
        assert.ok(Number.isFinite(x), `${off.join('+') || 'all on'}: ${n} = ${x}`);
        assert.ok(Math.abs(x - v0[i]) <= 1e-3 * Math.max(1, Math.abs(x)), `${off.join('+') || 'all on'}: ${n} drifts ${v0[i]} → ${x}`);
      });
      assert.ok(k.get('hr') > 40 && k.get('hr') < 120 && k.get('map') > 40 && k.get('map') < 120, `${off.join('+')}: hr ${k.get('hr')}, map ${k.get('map')}`);
      assert.ok(Math.abs(k.get('paco2') - 40) <= 2, `${off.join('+')}: paco2 ${k.get('paco2')}`);
    }
  });
});
