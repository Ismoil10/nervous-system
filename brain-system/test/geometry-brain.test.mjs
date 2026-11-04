// Brain part of the geometry tests (research/ANALYSIS.md B.14 `geometry.test.mjs`, phase 1, B.15):
// the post-port generateBrain buffer (DOPAMINE.md §7.3 and §9.8 applied, Phase 0a) stays
// bit-identical per tier (seed 1848); the dopamine records match their allocations exactly
// (DOPAMINE.md §9.7, fourth test); the §7.3 Monte Carlo checks hold; the appended region ids,
// PARENT and the relabels are consistent; the extra buffer is floor-stratified; the new
// structures lie inside the brain and overlap only where §3.16 says real borders interdigitate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  REGION_IDS, REGION_COUNT, LEGACY_REGION_COUNT, REGION_ALIASES, OWN_CHANNEL_IDS, R, KIND, NUCLEI, DA_GROUPS, BRAINSTEM, CRUS,
  PATHWAYS, TERMINALS, SPINAL_Z, PARENT, NUCLEI_V2, V2, RELABEL, AREAS, AREA_NONE, BRAIN_TRACTS, PORTS, CN_ATTACH, BRAIN_PARAMS,
  MIDLINE, nodePos, portPos, ellipsoidR2, ellipsoidPoint, sdCerebrum, sdCerebellum, spline, len3, mulberry32, MM,
} from '../src/anatomy.js';
import {
  generateBrain, generateBrainExtra, applyRelabel, areaIds, FLOATS, EXTRA_PARAMS, BUILD_PARAMS, DA_KIND,
  releaseAllocation, bathingWeight,
} from '../src/brain.js';

// Tier sizes of src/performance.js TIERS (B.8) and the dopamine budget of main.js daBudget.
const TIERS = [
  { name: 'low', neurons: 60000, axon: 6000, vari: 4000, extra: 3000 },
  { name: 'medium', neurons: 130000, axon: 10000, vari: 7000, extra: 5850 },
  { name: 'high', neurons: 240000, axon: 16000, vari: 11000, extra: 10800 },
  { name: 'ultra', neurons: 400000, axon: 24000, vari: 16000, extra: 18000 },
];
const daBudget = (t) => ({ soma: 3500, axon: t.axon, vari: t.vari, total: 3500 + t.axon + t.vari });

// SHA-256 of the generateBrain output (seed 1848). Re-recorded from the post-port generator
// (Phase 0a: DOPAMINE.md §7.3 geometry and §9.8 construction details; Node 26), which is the
// "bit-identical" reference of research/ANALYSIS.md from here on (B.5). Any change here means the
// post-port buffer moved. daCount is the sum of the soma, axon and release-site allocations.
const GOLDEN = {
  low: { neurons: 'ceb03076112f54292e0c12f3310c611b1b01a7e68541827e565827890defb848', da: 'a36d6be9d0a4f7e456eb044ff5e9bb30cfe8a265452759e77b15189949cc92a3', lanterns: 'ff314df31743dd0342afe7d5a3a6d3307f743e27806e5396d677c9d6dec98eeb', daCount: 13500 },
  medium: { neurons: '327496625d676900a2a4c40272cc47f1ee256ad8d5eaf1955b80e5a89e0c7943', da: 'f2c0e3fc8e750f05dcc2c0b4a86a72cd77e9112f4f7d0ec066232d08927be256', lanterns: '36acb1f7880d8f9a943948e406c98d589686c25c127a0e7a02803dfe564e7800', daCount: 20499 },
  high: { neurons: 'e13408e36ace815c6d27f54d3edc1940c57d789d6e6deccca3e2691a36d71023', da: '36ffc85bfb2c3aee6fcbe5f23a2b244a53adb47c88c203196c7e50ecc48caab5', lanterns: 'fe06b24a6c7d8fb909ef750266e2210e4283e5f61ba97239a0df3b741cdc6f9a', daCount: 30500 },
  ultra: { neurons: '58043f36cd85bda72f0396ea755b0f3938dfb7fe462ce74846f1ad71da76883a', da: 'ff13cc39f991fe52c16cadc5d3980cb7a4ecd0e614962bdd37dcc7f7ef8fb0ac', lanterns: '6bd630d423d2042b7cbeb5f8dd727a9ce9bbd61b30298aa7856e0620bc48f0b4', daCount: 43501 },
};
const sha = (a) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');

const LEGACY_IDS = [
  'cortex', 'frontal', 'pfc', 'ofc', 'acc', 'insula', 'parietal', 'temporal', 'occipital',
  'cerebellum', 'dentate', 'thalamus', 'dorsalStriatum', 'naccCore', 'naccShell', 'pallidum',
  'amygdala', 'hippocampus', 'hypothalamus', 'mpoa', 'pvn', 'arcuate', 'pituitaryGland', 'vta', 'snc',
  'zonaIncerta', 'a11', 'rmtg', 'raphe', 'pag', 'brainstem', 'spinal', 'whiteMatter',
];
const POST_PORT = ['vtaMedial', 'a14', 'caudate'];   // DOPAMINE.md §8.1, §9.1 (appended after A.3.3)
const THAL_SUB = ['thalAnt', 'thalMD', 'thalVA', 'thalVL', 'thalVPL', 'thalVPM', 'thalVPMpc', 'thalVMpo', 'thalCM', 'thalPulv', 'thalRet'];
// A.3.3 groups (89 new ids).
const A33 = {
  thalamus: [...THAL_SUB, 'lgn', 'mgn'],
  forebrain: ['stn', 'snr', 'vp', 'nbm', 'msdb', 'hdb', 'bnst', 'habenula', 'cea'],
  hypothalamus: ['scn', 'son', 'vlpo', 'lh', 'tmn', 'dmh', 'vmh', 'mammillary', 'mnpo', 'ovlt', 'sfo', 'areaPostrema', 'medianEminence', 'pineal'],
  brainstem: ('lc ppn ldt pbn pno pnc gi mrf vestNuc ntsGust ntsVisc dmv nAmbMotor nAmbVagal rvlm cvlm preBotC rtn io gracile cuneate spV prV mesV '
    + 'motV cochNuc soc ic sc opn ew n3 n4 n6 n7m n12 ssn isn barrington redNucleus pontineNuc fastigial interposed flocculus nodulus olfBulb olfTubercle').split(' '),
  splits: ['gpi', 'mnr', 'rmg', 'rpa', 'rob', 'pituitaryPost'],
};

// Medium-tier brain kept from the golden test (unmodified copy) for the relabel and area tests.
let mediumBrain = null;
const freshMedium = () => {
  mediumBrain ??= generateBrain({ neurons: TIERS[1].neurons, da: daBudget(TIERS[1]) });
  return { ...mediumBrain, neurons: mediumBrain.neurons.slice() };
};

// One post-port build per tier, shared by the tests below.
const built = new Map();
const brainAt = (t) => { if (!built.has(t.name)) built.set(t.name, generateBrain({ neurons: t.neurons, da: daBudget(t) })); return built.get(t.name); };

test('generateBrain is bit-identical per tier (seed 1848)', () => {
  for (const t of TIERS) {
    const b = brainAt(t);
    const g = GOLDEN[t.name];
    assert.equal(b.neuronCount, t.neurons, `${t.name} neuron count`);
    assert.equal(sha(b.neurons), g.neurons, `${t.name} neuron buffer`);
    assert.equal(b.daCount, g.daCount, `${t.name} dopamine count`);
    assert.equal(sha(b.da), g.da, `${t.name} dopamine buffer`);
    assert.equal(sha(b.lanterns), g.lanterns, `${t.name} lanterns`);
    if (t.name === 'medium') mediumBrain = { ...b, neurons: b.neurons.slice() };
  }
});

// --- Post-port dopamine records (DOPAMINE.md §9.7, fourth test; §7.5, §7.6, §9.8) ---
test('every tier writes exactly the allocated dopamine records; da.total equals the records written', () => {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum(PATHWAYS.map((p) => p.share)) - 1) < 1e-9, 'axon shares sum to 1.000 (§7.6)');
  const somaWant = DA_GROUPS.map((g) => Math.round(3500 * g.share));
  assert.deepEqual(somaWant, [570, 130, 2000, 300, 125, 125, 125, 125], 'the 3,500-soma split of §7.5');
  const spinal = TERMINALS.findIndex((t) => t.region === R.spinal);
  for (const t of TIERS) {
    const b = brainAt(t);
    const axonWant = PATHWAYS.map((pw) => Math.round(t.axon * pw.share));
    const variWant = releaseAllocation(t.vari);
    assert.ok(Math.abs(sum(axonWant) - t.axon) <= PATHWAYS.length / 2, `${t.name} axon allocation ≈ budget`);
    assert.ok(Math.abs(sum(variWant) - t.vari) <= TERMINALS.length / 2, `${t.name} release allocation ≈ budget`);
    assert.deepEqual(b.daAlloc, { soma: somaWant, axon: axonWant, vari: variWant });
    const axonGot = new Array(PATHWAYS.length).fill(0), variGot = new Map(), somaGot = new Map();
    let soma = 0;
    for (let i = 0; i < b.daCount; i++) {
      const o = i * FLOATS, kind = b.da[o + 11], region = b.da[o + 8];
      if (kind === DA_KIND.AXON) axonGot[b.da[o + 4]]++;
      else if (kind === DA_KIND.VARICOSITY) variGot.set(region, (variGot.get(region) || 0) + 1);
      else if (kind === DA_KIND.SOMA) { soma++; somaGot.set(region, (somaGot.get(region) || 0) + 1); }
      else assert.fail(`record ${i}: unknown kind ${kind}`);
    }
    PATHWAYS.forEach((pw, k) => assert.equal(axonGot[k], axonWant[k], `${t.name} ${pw.id}: round(axon·share) points`));
    TERMINALS.forEach((f, k) => assert.equal(variGot.get(f.region) || 0, variWant[k], `${t.name} ${REGION_IDS[f.region]}: allocated release sites`));
    assert.ok(variWant[spinal] > 0 && variGot.get(R.spinal) === variWant[spinal], `${t.name} spinal field complete`);
    assert.equal(soma, 3500);
    assert.equal(b.daCount, sum(somaWant) + sum(axonWant) + sum(variWant), `${t.name} da.total = records written`);
    assert.equal(b.daTotal, b.daCount);
    assert.equal(b.da.length, b.daCount * FLOATS);
    assert.deepEqual(b.daRanges, { soma: [0, 3500], axon: [3500, sum(axonWant)], vari: [3500 + sum(axonWant), sum(variWant)] });
    // Somata by region: A8 pooled with the SNc, A10 split into VTA-l and VTA-m, A14 on its own id.
    assert.equal(somaGot.get(R.snc), 2300);
    assert.equal((somaGot.get(R.vta) || 0) + somaGot.get(R.vtaMedial), 700);
    for (const r of [R.a11, R.arcuate, R.zonaIncerta, R.a14]) assert.equal(somaGot.get(r), 125, REGION_IDS[r]);
    assert.ok(!somaGot.has(R.pvn), 'A14 no longer on pvn');
  }
  // VTA somata: vtaMedial within 3.5 mm of the midline (incl. the midline column), vta beyond (§8.1).
  const b = brainAt(TIERS[0]);
  for (let i = 0; i < b.daRanges.soma[1]; i++) {
    const o = i * FLOATS, r = b.da[o + 8], ax = Math.abs(b.da[o]) / MM;
    if (r === R.vta) assert.ok(ax >= 3.5 - 1e-4, 'VTA-l soma lateral to 3.5 mm');
    if (r === R.vtaMedial) assert.ok(ax < 3.5 + 1e-4, 'VTA-m soma within 3.5 mm');
  }
});

// Independent volume tests from the DOPAMINE.md numbers (swept discs with flat caps for tubes).
const lumen = (x, y, z) => {   // third-ventricle lumen with the sloping floor (§2.4, §7.3)
  if (Math.abs(x) >= 2 || y > 4 || y < -20 || z > 8) return false;
  return z > (y >= -6 ? -14 : -14 + (-6 - y) * 10 / 14);
};
const LATERAL_VENTRICLES = [[[6, 14, 16], [3, 8, 5]], [[9, -10, 23], [4, 14, 3]], [[28, -40, 12], [4, 5, 4]], [[36, -20, -8.5], [1.5, 9, 2]]];
const inLateralVentricle = (x, y, z) => LATERAL_VENTRICLES.some(([c, r]) => ellipsoidR2({ c, r }, Math.abs(x), y, z) <= 1);
function tubeIn(pts) {
  const f = spline(pts), n = 1600, S = [];
  for (let k = 0; k <= n; k++) {
    const p = f(k / n), q = f(Math.min(1, k / n + 1e-3)), o = f(Math.max(0, k / n - 1e-3));
    const t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], l = len3(...t);
    S.push([p, t.map((v) => v / l)]);
  }
  let len = 0;
  for (let k = 1; k <= n; k++) len += len3(S[k][0][0] - S[k - 1][0][0], S[k][0][1] - S[k - 1][0][1], S[k][0][2] - S[k - 1][0][2]);
  const ds = len / n;
  return (x, y, z) => {
    let best = Infinity, b = null;
    for (const s of S) { const d = (x - s[0][0]) ** 2 + (y - s[0][1]) ** 2 + (z - s[0][2]) ** 2; if (d < best) { best = d; b = s; } }
    const d = [x - b[0][0], y - b[0][1], z - b[0][2]], along = d[0] * b[1][0] + d[1] * b[1][1] + d[2] * b[1][2];
    return Math.abs(along) <= ds && best - along * along <= b[0][3] ** 2;
  };
}
const nuc = (id) => NUCLEI.find((d) => d.id === id), grp = (id) => DA_GROUPS.find((d) => d.id === id);
// Share of volume `d` (ellipsoid) for which `inside` holds (Monte Carlo, right side).
function share(d, inside, N = 40000, seed = 11) {
  const rnd = mulberry32(seed);
  let hit = 0;
  for (let k = 0; k < N;) {
    const x = 2 * rnd() - 1, y = 2 * rnd() - 1, z = 2 * rnd() - 1;
    if (x * x + y * y + z * z > 1) continue;
    k++;
    if (inside(...ellipsoidPoint(d, x, y, z))) hit++;
  }
  return hit / N;
}

test('§7.3 checks: third-ventricle lumen and voids, A11/A13 tissue, overlaps (Monte Carlo)', () => {
  const b = brainAt(TIERS[2]);
  const lumenStars = new Map();
  for (let i = 0; i < b.neuronCount; i++) {
    const o = i * FLOATS, p = [b.neurons[o] / MM, b.neurons[o + 1] / MM, b.neurons[o + 2] / MM], kind = b.neurons[o + 11];
    if ([KIND.CORTEX, KIND.BRAINSTEM, KIND.WHITE].includes(kind)) {
      assert.ok(!lumen(...p) && !inLateralVentricle(...p), `void holds a ${kind} star at ${p.map((v) => v.toFixed(1))}`);
    } else if (lumen(...p)) lumenStars.set(REGION_IDS[b.neurons[o + 8]], (lumenStars.get(REGION_IDS[b.neurons[o + 8]]) || 0) + 1);
  }
  // Only protected thalamic stars at the medial edge of the yawed thalamus (§7.3: ≈ 2 at 240 k).
  assert.deepEqual([...lumenStars.keys()].filter((k) => k !== 'thalamus'), [], 'no other nucleus star in the lumen');
  assert.ok((lumenStars.get('thalamus') || 0) <= 20);
  for (let i = 0; i < b.daRanges.soma[1]; i++) {
    const o = i * FLOATS;
    assert.ok(!lumen(b.da[o] / MM, b.da[o + 1] / MM, b.da[o + 2] / MM), 'no dopamine soma in the lumen');
  }
  // A11 and A13 somata sit in drawn tissue (§7.3: 99.9 % in the posterior hypothalamic and the
  // rostromedial ZI ellipsoids).
  const post = nuc('hypothalamusPost'), rm = nuc('zonaIncertaRm');
  let a11 = 0, a13 = 0;
  for (let i = 0; i < b.daRanges.soma[1]; i++) {
    const o = i * FLOATS, p = [Math.abs(b.da[o]) / MM, b.da[o + 1] / MM, b.da[o + 2] / MM];
    if (b.da[o + 8] === R.a11 && ellipsoidR2(post, ...p) <= 1) a11++;
    if (b.da[o + 8] === R.zonaIncerta && ellipsoidR2(rm, ...p) <= 1) a13++;
  }
  assert.ok(a11 >= 0.99 * 125 && a13 >= 0.99 * 125, `A11 ${a11}/125, A13 ${a13}/125 in tissue`);
  assert.ok(share(grp('a11'), (x, y, z) => ellipsoidR2(post, x, y, z) <= 1) > 0.99);
  assert.ok(share(grp('a13'), (x, y, z) => ellipsoidR2(rm, x, y, z) <= 1) > 0.99);
  // Periventricular placement: no group or hypothalamic nucleus inside the lumen (§7.3).
  for (const d of [grp('a11'), grp('a12'), grp('a14'), grp('vta'), grp('midline'), nuc('arcuate'), nuc('pvn'), nuc('mpoa'), nuc('hypothalamus'), post, rm]) {
    assert.equal(share(d, lumen, 20000), 0, `${d.id} clear of the lumen`);
  }
  assert.ok(share(nuc('thalamus'), lumen) < 0.001, 'thalamus 0.02 % in the lumen');
  // Overlaps (§7.3 values in brackets).
  const inE = (d) => (x, y, z) => ellipsoidR2(d, x, y, z) <= 1;
  const amyHip = share(nuc('amygdala'), tubeIn(nuc('hippocampus').pts), 20000);
  assert.ok(amyHip < 0.03, `amygdala inside the hippocampus ${amyHip} (1.3 %)`);
  assert.ok(share(nuc('pallidum'), inE(nuc('putamen'))) < 0.03, 'pallidum inside the putamen (1 %)');
  assert.ok(share(nuc('zonaIncerta'), inE(nuc('thalamus'))) < 0.03, 'ZI inside the thalamus (1.7 %)');
  assert.equal(share(nuc('thalamus'), inE(nuc('pallidum'))), 0, 'internal capsule kept between thalamus and pallidum');
  for (const id of ['thalamus', 'hypothalamus', 'zonaIncerta']) assert.equal(share(rm, inE(nuc(id))), 0, `rostromedial ZI clear of ${id}`);
  for (const d of [nuc('hypothalamus'), nuc('thalamus'), nuc('pvn'), grp('vta')]) assert.equal(share(post, inE(d)), 0, `posterior hypothalamic ellipsoid clear of ${d.id}`);
  const snc = grp('snc');
  assert.ok(share(snc, inE(CRUS)) < 0.03, 'SNc ≈ 1 % inside the crus');
  assert.ok(share(snc, inE(grp('vta'))) < 0.005, 'SNc clear of the VTA');
  assert.equal(share(snc, inE(nuc('amygdala'))), 0, 'SNc clear of the amygdala');
  // SNc tips and the STN distance (§7.3).
  const tip = (sgn) => ellipsoidPoint(snc, 0, sgn, 0);   // the long axis points caudally: −1 is the rostral tip
  assert.ok(len3(...tip(-1).map((v, k) => v - [13.7, -11.6, -9.2][k])) < 0.1 && len3(...tip(1).map((v, k) => v - [7.3, -25.4, -16.8][k])) < 0.1, 'SNc tips');
  assert.ok(Math.abs(len3(...tip(-1).map((v, k) => v - [12, -13, -5][k])) - 4.75) < 0.1, 'rostral SNc tip 4.75 mm from the STN centre');
});

test('§7.2 hulls: cerebrum ≈ 1,386 cm³; cerebellum ≈ 137 cm³, down to z −65, clear of the cerebrum (Monte Carlo)', () => {
  const rnd = mulberry32(5);
  let cer = 0, cb = 0, both = 0, zMin = 0;
  const N = 300000, box = [[-70, 70], [-105, 71], [-70, 78]], V = box.reduce((v, [a, c]) => v * (c - a), 1);
  for (let k = 0; k < N; k++) {
    const x = box[0][0] + 140 * rnd(), y = box[1][0] + 176 * rnd(), z = box[2][0] + 148 * rnd();
    const s = x < 0 ? -1 : 1, inC = sdCerebrum(x, y, z, s) < 0, inB = sdCerebellum(x, y, z) < 0;
    if (inC) cer++;
    if (inB) { cb++; zMin = Math.min(zMin, z); }
    if (inC && inB) both++;
  }
  const cm3 = (c) => c / N * V / 1000;
  assert.ok(Math.abs(cm3(cer) - 1386) < 40, `cerebrum ${cm3(cer).toFixed(0)} cm³`);
  assert.ok(Math.abs(cm3(cb) - 137) < 8, `cerebellum ${cm3(cb).toFixed(0)} cm³`);
  assert.equal(both, 0, 'tentorial gap: no cerebrum–cerebellum overlap');
  assert.ok(zMin < -63 && zMin > -66, `cerebellar base at z ${zMin.toFixed(1)}`);
});

test('§9.8 construction details: folia, flux, spinal label and tube, bathing, pituitary split, vtaOther block', () => {
  const P = BUILD_PARAMS;
  assert.equal(P.cerebellum.foliaPeriod, 2.2);
  assert.ok((1 - P.cerebellum.grooveReject) * (1 - P.cerebellum.grooveDim) >= 0.70, 'groove drop and dim ≤ 30 % combined');
  assert.equal(P.cortex.sulcalDim, 6);
  assert.equal(P.lumNucleus, 0.85);
  assert.equal(SPINAL_Z, -72);
  assert.deepEqual(BRAINSTEM[0], [0, -24, -4, 12, 8]);
  const cord = TERMINALS.find((t) => t.region === R.spinal);
  assert.deepEqual(cord.pts, [[2.5, -45.5, -74, 3], [2.5, -47.5, -88, 3]]);
  // The spinal proxy lies ≈ 97 % inside the cord part of the brainstem tube (§7.3).
  const f = spline(cord.pts), rnd = mulberry32(9);
  let inside = 0;
  for (let k = 0; k < 2000; k++) {
    const p = f(rnd()), r = 3 * Math.sqrt(rnd()), a = 2 * Math.PI * rnd();
    // Cross-section ⟂ the tube axis (0, −2, −14)/|·|: spanned by x and (0, 0.99, −0.14).
    if (tubeR2([p[0] + r * Math.cos(a), p[1] + 0.99 * r * Math.sin(a), p[2] - 0.14 * r * Math.sin(a)]) <= 1) inside++;
  }
  assert.ok(inside / 2000 > 0.9, `spinal proxy inside the cord ${(inside / 20).toFixed(1)} %`);
  assert.equal(PATHWAYS.find((p) => p.id === 'tuberoinfundibular').to, R.medianEminence);
  assert.ok(TERMINALS.some((t) => t.region === R.medianEminence) && !TERMINALS.some((t) => t.region === R.pituitaryGland));
  for (const id of ['pituitaryGland', 'raphe', 'rmtg', 'vta', 'vtaMedial', 'pag', 'arcuate', 'cerebellum']) assert.equal(bathingWeight(R[id]), 0, id);
  for (const id of ['frontal', 'pfc', 'medianEminence', 'naccShell', 'caudate', 'spinal']) assert.equal(bathingWeight(R[id]), 1, id);

  const expectLead = Math.round(0.35 / 0.65 * 700);
  for (const t of TIERS) {
    const b = brainAt(t);
    assert.equal(b.leadCount, expectLead, `${t.name}: ${expectLead} non-DA VTA stars in the leading block`);
    let otherVta = 0;
    for (let i = 0; i < b.neuronCount; i++) {
      const o = i * FLOATS, r = b.neurons[o + 8], kind = b.neurons[o + 11], z = b.neurons[o + 2] / MM, daW = b.neurons[o + 9];
      const ax = Math.abs(b.neurons[o]) / MM;
      if (i < b.leadCount) {
        assert.ok(kind === KIND.NUCLEUS && daW === 0 && (r === R.vta || r === R.vtaMedial), 'leading block: non-DA VTA stars');
        assert.equal(r, ax < 3.5 ? R.vtaMedial : R.vta, 'vtaMedial within 3.5 mm of the midline');
      } else if (r === R.vta || r === R.vtaMedial) otherVta++;
      if (t.name !== 'medium') continue;
      if (kind === KIND.BRAINSTEM) assert.equal(r === R.spinal, z < SPINAL_Z, 'spinal label below z −72');
      if (r === R.pituitaryGland || r === R.medianEminence) assert.equal(kind, KIND.GLAND, 'gland haze');
      if (kind === KIND.GLAND) assert.ok(r === R.pituitaryGland || r === R.medianEminence);
      if (bathingWeight(r) === 0 || kind === KIND.WHITE) assert.equal(daW, 0, `${REGION_IDS[r]} unbathed`);
      else assert.ok(daW >= 0.75 - 1e-6 && daW <= 1.25 + 1e-6, `${REGION_IDS[r]} d_point ${daW}`);
    }
    assert.equal(otherVta, 0, 'every non-DA VTA star is in the leading block');
    assert.ok(Math.abs(b.leadCount / (b.leadCount + 700) - 0.35) < 0.001, '35 % of the VTA stars are non-dopaminergic');
  }
});

test('§7.2 item 3 cortical ribbon: nothing in deep volumes, nothing on the medial notch window', () => {
  const b = brainAt(TIERS[2]);
  const ells = [...NUCLEI.filter((d) => d.type === 'e'), ...DA_GROUPS, CRUS];
  let cortex = 0, temporalNotch = 0;
  for (let i = 0; i < b.neuronCount; i++) {
    const o = i * FLOATS;
    if (b.neurons[o + 11] !== KIND.CORTEX || b.neurons[o + 8] === R.insula) continue;
    cortex++;
    const x = Math.abs(b.neurons[o]) / MM, y = b.neurons[o + 1] / MM, z = b.neurons[o + 2] / MM;
    for (const d of ells) assert.ok(ellipsoidR2(d, x, y, z) > 1, `cortical star inside ${d.id}`);
    if (x <= 18 && y > -52 && y < -8 && z < 5 && z > -95) assert.ok(tubeR2([x, y, z]) > 0.9, 'cortical star inside the brainstem tube');
    // Medial notch window (−45 < y ≤ +8 at |x| ≤ 15): the diencephalon and midbrain emerge there.
    assert.ok(!(x <= 12 && y > -40 && y <= 4 && z < -10), `cortical star on the medial notch window at ${[x, y, z].map((v) => v.toFixed(1))}`);
    if (x > 15 && Math.abs(len3((x - 0) / 23, (y + 22) / 40, (z + 43) / 36) - 1) < 0.02 && b.neurons[o + 8] === R.temporal) temporalNotch++;
  }
  assert.ok(cortex > 0.58 * b.neuronCount);
  assert.ok(temporalNotch > 0, 'lateral notch surface (uncus, parahippocampal gyrus) labelled temporal');
});

test('region ids: indices 0–32 unchanged, the 89 A.3.3 and 3 post-port ids appended, aliases on the old ids', () => {
  assert.deepEqual(REGION_IDS.slice(0, LEGACY_REGION_COUNT), LEGACY_IDS);
  LEGACY_IDS.forEach((id, i) => assert.equal(R[id], i));
  const added = Object.values(A33).flat();
  assert.equal(added.length, 89);
  assert.deepEqual(REGION_IDS.slice(LEGACY_REGION_COUNT), [...added, ...POST_PORT]);
  assert.equal(REGION_COUNT, 125);
  assert.ok(REGION_COUNT <= 128, 'the state texture holds 128 sided regions');
  assert.equal(REGION_COUNT, REGION_IDS.length);
  assert.equal(new Set(REGION_IDS).size, REGION_COUNT, 'ids unique');
  assert.equal(R.gpe, R.pallidum);
  assert.equal(R.dr, R.raphe);
  assert.equal(R.pituitary, 22, 'the pre-split name keeps index 22');
  assert.equal(R.pituitaryGland, 22);
  assert.equal(R.pituitaryAnt, R.pituitaryGland);
  for (const alias of Object.keys(REGION_ALIASES)) assert.ok(!REGION_IDS.includes(alias), `${alias} is an alias, not a new id`);
  for (const id of REGION_IDS) assert.match(id, /^[a-z][A-Za-z0-9]*$/, 'camelCase ASCII (A.3.2)');
});

test('PARENT: a legacy parent per region, identity on 0–32 and on the own-channel ids, relabel targets inherit their source', () => {
  assert.equal(PARENT.length, REGION_COUNT);
  assert.deepEqual(OWN_CHANNEL_IDS, ['medianEminence', ...POST_PORT]);
  for (let r = 0; r < REGION_COUNT; r++) {
    if (OWN_CHANNEL_IDS.includes(REGION_IDS[r])) assert.equal(PARENT[r], r, `${REGION_IDS[r]} has dopamine channels of its own`);
    else assert.ok(PARENT[r] < LEGACY_REGION_COUNT, `${REGION_IDS[r]} has a legacy parent`);
    if (r < LEGACY_REGION_COUNT) assert.equal(PARENT[r], r);
  }
  for (const id of THAL_SUB) assert.equal(PARENT[R[id]], R.thalamus, id);
  assert.equal(PARENT[R.gpi], R.pallidum);
  assert.equal(PARENT[R.mnr], R.raphe);
  assert.equal(PARENT[R.pituitaryPost], R.pituitaryGland);
  for (const rule of RELABEL) {
    const targets = rule.rule === 'plane' ? [rule.above, rule.below] : [...rule.to, ...(rule.shell ? [rule.shell.id] : [])];
    for (const id of targets) assert.equal(PARENT[R[id]], rule.from, `${id} inherits from ${REGION_IDS[rule.from]}`);
  }
});

test('applyRelabel rewrites only the region float of pallidum, raphe, pituitary-gland and thalamus stars', () => {
  const b = freshMedium(), before = b.neurons.slice();
  const res = applyRelabel(b);
  assert.ok(res.relabelled > 0);
  const moved = new Map();
  for (let i = 0; i < b.neuronCount; i++) {
    const o = i * FLOATS;
    for (let k = 0; k < FLOATS; k++) if (k !== 8) assert.ok(Object.is(before[o + k], b.neurons[o + k]), `record ${i} field ${k} changed`);
    const from = before[o + 8], to = b.neurons[o + 8];
    if (from !== to) moved.set(`${REGION_IDS[from]}>${REGION_IDS[to]}`, (moved.get(`${REGION_IDS[from]}>${REGION_IDS[to]}`) || 0) + 1);
    if (to === R.pituitaryGland) assert.ok(b.neurons[o + 1] / MM > BRAIN_PARAMS.pituitarySplitY - 1e-4, 'anterior lobe: y > −2');
    if (to === R.pituitaryPost) assert.ok(b.neurons[o + 1] / MM <= BRAIN_PARAMS.pituitarySplitY + 1e-4, 'posterior lobe: y ≤ −2');
  }
  const allowed = new Set(['pallidum>gpi', 'raphe>mnr', 'pituitaryGland>pituitaryPost', ...THAL_SUB.map((id) => `thalamus>${id}`)]);
  for (const key of moved.keys()) assert.ok(allowed.has(key), `unexpected relabel ${key}`);
  for (const key of allowed) assert.ok(moved.get(key) > 0, `${key} receives stars`);
  assert.ok(!Object.hasOwn(res.byRegion, 'thalamus'), 'every thalamus star goes to a subnucleus');
  // gpe/gpi by the nearer centre (§3.17).
  for (let i = 0; i < b.neuronCount; i++) {
    const o = i * FLOATS, r = b.neurons[o + 8];
    if (r !== R.gpe && r !== R.gpi) continue;
    const p = [Math.abs(b.neurons[o]) / MM, b.neurons[o + 1] / MM, b.neurons[o + 2] / MM];
    const d = (c) => len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
    assert.equal(r, d(V2.gpe.c) <= d(V2.gpi.c) ? R.gpe : R.gpi);
  }
  const again = b.neurons.slice();
  assert.equal(applyRelabel(b).relabelled, 0, 'idempotent');
  assert.deepEqual(b.neurons, again);
});

test('generateBrainExtra: deterministic, sized, floor-stratified', () => {
  const q = EXTRA_PARAMS.insulaShare, levels = [...new Set(EXTRA_PARAMS.floors)].sort((a, b) => a - b);
  const S = NUCLEI_V2.filter((d) => d.stars).length;
  const a = generateBrainExtra({ neurons: 18000 }), b = generateBrainExtra({ neurons: 18000 });
  assert.deepEqual(a.neurons, b.neurons, 'same seed, same buffer');
  assert.notDeepEqual(generateBrainExtra({ neurons: 2000 }, 7).neurons, generateBrainExtra({ neurons: 2000 }).neurons.slice(), 'seed matters');
  assert.equal(a.neuronCount, 18000);
  assert.equal(a.neurons.length, 18000 * FLOATS);
  assert.equal(a.structures.length, S);
  assert.equal(a.strata.reduce((s, st) => s + st.count, 0), 18000);
  const sum = a.structures.reduce((s, st) => s + st.counts.reduce((x, c) => x + c, 0), 0) + a.insulaCount;
  assert.equal(sum, 18000);
  const valid = new Set([R.insula, ...NUCLEI_V2.filter((d) => d.stars).map((d) => d.region)]);
  for (let i = 0; i < a.neuronCount; i++) {
    const o = i * FLOATS;
    for (let k = 0; k < FLOATS; k++) assert.ok(Number.isFinite(a.neurons[o + k]));
    assert.ok(valid.has(a.neurons[o + 8]), 'region of a drawn structure');
    assert.ok([KIND.NUCLEUS, KIND.GLAND, KIND.CORTEX].includes(a.neurons[o + 11]));
  }
  // Full strata top every nucleus up to its floor.
  let cum = new Array(S).fill(0);
  a.strata.forEach((st, k) => {
    a.structures.forEach((s, i) => { cum[i] += s.counts[k]; });
    if (st.floor !== null) assert.ok(cum.every((c) => c === st.floor), `stratum ${k} reaches floor ${st.floor}`);
  });
  // Any prefix holds each nucleus in proportion: it meets every floor whose stratum it contains,
  // and inside a stratum each nucleus is within one star of its share.
  const countPrefix = (ex, L) => {
    const m = new Map();
    for (let i = 0; i < L; i++) { const o = i * FLOATS; if (ex.neurons[o + 11] !== KIND.CORTEX) m.set(ex.neurons[o + 8], (m.get(ex.neurons[o + 8]) || 0) + 1); }
    return a.structures.map((s) => m.get(s.region) || 0);
  };
  for (const t of TIERS.slice(0, 3)) {
    const c = countPrefix(a, t.extra);
    let end = 0, met = 0;
    for (const st of a.strata) { end += st.count; if (end <= t.extra && st.floor !== null) met = st.floor; }
    assert.ok(Math.min(...c) >= met, `${t.name} prefix meets floor ${met}`);
    const share = Math.floor(t.extra * (1 - q) / S);
    assert.ok(Math.min(...c) >= Math.min(share, levels[levels.length - 1]) - 2, `${t.name} prefix balanced (${Math.min(...c)} vs ${share})`);
  }
  // With the B.8 budgets the high-tier floor holds; the low and medium floors need more stars
  // than TIERS.extra gives for 77 nuclei (reported, see EXTRA_PARAMS).
  assert.ok(Math.min(...countPrefix(a, 10800)) >= 120);
  // Since Phase 0a generateBrain draws the whole §7.3 insula, so the extension is empty.
  assert.equal(a.insulaCount, 0);
  // Small and empty budgets.
  const small = generateBrainExtra({ neurons: 500 });
  const sc = small.structures.map((s) => s.counts.reduce((x, y) => x + y, 0));
  assert.ok(Math.max(...sc) - Math.min(...sc) <= 1, 'a short budget is split evenly');
  assert.equal(generateBrainExtra({ neurons: 0 }).neuronCount, 0);
  assert.equal(applyRelabel(a).relabelled, 0, 'the extra buffer is never relabelled');
});

test('extra stars lie inside their structure; no insula extension after the port', () => {
  const ex = generateBrainExtra({ neurons: 10800 });
  const byRegion = new Map(NUCLEI_V2.filter((d) => d.stars).map((d) => [d.region, d]));
  const tubeSamples = new Map();
  for (let i = 0; i < ex.neuronCount; i++) {
    const o = i * FLOATS, r = ex.neurons[o + 8];
    const p = [ex.neurons[o] / MM, ex.neurons[o + 1] / MM, ex.neurons[o + 2] / MM];
    assert.notEqual(ex.neurons[o + 11], KIND.CORTEX, 'no insula-extension stars');
    const d = byRegion.get(r);
    const x = d.mid ? p[0] : Math.abs(p[0]);
    if (d.type === 'e') {
      const q2 = ((x - d.c[0]) / d.r[0]) ** 2 + ((p[1] - d.c[1]) / d.r[1]) ** 2 + ((p[2] - d.c[2]) / d.r[2]) ** 2;
      assert.ok(q2 <= 1 + 1e-3, `${d.id} star inside its ellipsoid (${q2.toFixed(3)})`);
    } else {
      if (!tubeSamples.has(d.id)) { const f = spline(d.pts); tubeSamples.set(d.id, Array.from({ length: 401 }, (_, k) => f(k / 400))); }
      const near = Math.min(...tubeSamples.get(d.id).map((s) => len3(x - s[0], p[1] - s[1], p[2] - s[2]) - s[3]));
      assert.ok(near <= 0.3, `${d.id} star inside its tube (${near.toFixed(2)})`);
    }
  }
});

// Normalised r² in the BRAINSTEM tube cross-section at the nearest centreline point.
const bsTube = spline(BRAINSTEM);
const bsSamples = Array.from({ length: 2001 }, (_, k) => bsTube(k / 2000));
function tubeR2(p) {
  let bu = 0, best = Infinity;
  bsSamples.forEach((s, k) => { const d = len3(p[0] - s[0], p[1] - s[1], p[2] - s[2]); if (d < best) { best = d; bu = k / 2000; } });
  const q = bsTube(bu), a = bsTube(Math.min(1, bu + 0.001)), b = bsTube(Math.max(0, bu - 0.001));
  let tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2];
  const tl = len3(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
  let ax = 1 - tx * tx, ay = -tx * ty, az = -tx * tz;
  const al = len3(ax, ay, az); ax /= al; ay /= al; az /= al;
  const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
  const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
  return ((dx * ax + dy * ay + dz * az) / q[3]) ** 2 + ((dx * bx + dy * by + dz * bz) / q[4]) ** 2;
}
const inLegacyNucleus = (p) => NUCLEI.some((d) => {
  if (d.type === 'e') return ellipsoidR2(d, Math.abs(p[0]), p[1], p[2]) <= 1;
  const f = spline(d.pts);
  for (let k = 0; k <= 200; k++) { const s = f(k / 200); if (len3(Math.abs(p[0]) - s[0], p[1] - s[1], p[2] - s[2]) <= s[3]) return true; }
  return false;
});

test('new structures lie inside the brain', () => {
  // The longitudinal fissure is a 1-mm modelling gap, so midline points are tested 2 mm off the midline.
  const hull = (p) => sdCerebrum(Math.max(Math.abs(p[0]), 2), p[1], p[2], 1);
  // §3.16: the olfactory bulb sits 2 mm below the frontal hull. The mammillary bodies and the TMN
  // lie on the ventral surface of the diencephalon, behind the hypothalamus ellipsoid; with the
  // post-port first BRAINSTEM point they sit on the anterior surface of the midbrain tube.
  const OUTSIDE = { olfBulb: [0, 4] };
  for (const id of ['mammillary', 'tmn']) {
    const r2 = tubeR2(nodePos(id));
    assert.ok(r2 > 1 && r2 <= 1.25, `${id} on the anterior surface of the brainstem tube (${r2.toFixed(2)})`);
  }
  for (const d of NUCLEI_V2) {
    const p = nodePos(d.id);
    const inside = hull(p) < 0 || sdCerebellum(p[0], p[1], p[2]) < 0 || tubeR2(p) <= 1.25 || inLegacyNucleus(p);
    if (OUTSIDE[d.id]) {
      assert.ok(!inside, `${d.id} is expected outside the coded envelope`);
      const h = hull(p);
      assert.ok(h > OUTSIDE[d.id][0] && h <= OUTSIDE[d.id][1], `${d.id} within ${OUTSIDE[d.id][1]} mm of the hull (${h.toFixed(1)})`);
    } else assert.ok(inside, `${d.id} inside the brain`);
  }
  // Cerebellar nuclei inside the cerebellum (§3.16: 2.1–7.9 mm).
  for (const id of ['fastigial', 'interposed', 'flocculus', 'nodulus']) assert.ok(sdCerebellum(...V2[id].c) < -2, id);
  // Brainstem centres inside the post-port BRAINSTEM tube at r² ≤ 0.93 (§3.16); cochNuc protrudes
  // laterally (1.22), sc (1.17) and ic (1.04) sit on the dorsal boundary as tectal bumps.
  const LIMIT = { cochNuc: 1.25, ic: 1.05, sc: 1.2 };
  for (const d of NUCLEI_V2.filter((n) => (n.group === 'bs' || n.group === 'raphe'))) {
    assert.ok(tubeR2(nodePos(d.id)) <= (LIMIT[d.id] ?? 0.95), `${d.id} inside the brainstem tube (${tubeR2(nodePos(d.id)).toFixed(2)})`);
  }
  // Relay nuclei outside, subnuclei inside or on the edge of the post-port (15°-yawed) thalamus
  // (§3.16: thalAnt 0.82, thalVMpo 1.01, thalRet 0.99; lgn 3.31, mgn 2.52, habenula 1.62).
  const th = NUCLEI.find((n) => n.id === 'thalamus');
  const thR2 = (p) => ellipsoidR2(th, ...p);
  for (const id of ['lgn', 'mgn', 'habenula']) assert.ok(thR2(nodePos(id)) > 1.3, `${id} outside the thalamus`);
  for (const id of THAL_SUB) assert.ok(thR2(nodePos(id)) <= 1.25, `${id} inside the thalamus`);
  assert.ok(Math.abs(thR2(nodePos('thalAnt')) - 0.82) < 0.02, `thalAnt r² ${thR2(nodePos('thalAnt')).toFixed(3)} (§3.16: 0.82)`);
  // gpe/gpi centres in or on the lateral edge of the post-port pallidum (gpe r² 1.16).
  const pal = NUCLEI.find((n) => n.id === 'pallidum');
  for (const id of ['gpe', 'gpi']) assert.ok(ellipsoidR2(pal, ...V2[id].c) < 1.2, `${id} centre at the pallidum`);
});

test('new nuclei overlap only where §3.16 accepts it', () => {
  const ells = NUCLEI_V2.filter((d) => d.stars && d.type === 'e');
  const inE = (p, d) => ((p[0] - d.c[0]) / d.r[0]) ** 2 + ((p[1] - d.c[1]) / d.r[1]) ** 2 + ((p[2] - d.c[2]) / d.r[2]) ** 2 <= 1;
  for (const a of ells) for (const b of ells) if (a !== b) assert.ok(!inE(a.c, b), `centre of ${a.id} inside ${b.id}`);
  // Share of the smaller volume (Monte Carlo). §3.16 lists the adjacent groups ≥ 10 %; lh–vmh and
  // lh–dmh (≈ 11 %) are hypothalamic neighbours inside the lateral-hypothalamic field.
  const ALLOWED = { 'cochNuc|vestNuc': 0.30, 'dmv|ntsVisc': 0.20, 'pbn|prV': 0.16, 'cvlm|io': 0.16, 'nAmbMotor|nAmbVagal': 0.15,
    'ic|mrf': 0.14, 'motV|pbn': 0.13, 'lh|vmh': 0.15, 'dmh|lh': 0.15 };
  const rnd = mulberry32(7);
  for (let i = 0; i < ells.length; i++) for (let j = i + 1; j < ells.length; j++) {
    const a = ells[i], b = ells[j];
    if ([0, 1, 2].some((k) => Math.abs(a.c[k] - b.c[k]) > a.r[k] + b.r[k])) continue;
    const [s, l] = a.r[0] * a.r[1] * a.r[2] <= b.r[0] * b.r[1] * b.r[2] ? [a, b] : [b, a];
    let hit = 0;
    const N = 20000;
    for (let k = 0; k < N;) {
      const x = 2 * rnd() - 1, y = 2 * rnd() - 1, z = 2 * rnd() - 1;
      if (x * x + y * y + z * z > 1) continue;
      k++;
      if (inE([s.c[0] + x * s.r[0], s.c[1] + y * s.r[1], s.c[2] + z * s.r[2]], l)) hit++;
    }
    const key = [a.id, b.id].sort().join('|'), f = hit / N;
    if (ALLOWED[key] !== undefined) assert.ok(f <= ALLOWED[key], `${key} overlap ${f.toFixed(3)}`);
    else assert.ok(f < 0.10, `${key} overlap ${f.toFixed(3)} not accepted by §3.16`);
  }
});

test('cortical areas: 46 patches inside the cerebrum; areaIds tags cortical stars only, every area gets stars', () => {
  assert.equal(AREAS.length, 46);
  assert.equal(new Set(AREAS.map((a) => a.id)).size, 46);
  assert.ok(AREAS.length < AREA_NONE);
  for (const a of AREAS) {
    const d = sdCerebrum(Math.max(a.c[0], 2), a.c[1], a.c[2], 1);
    assert.ok(d < -0.3 && d > -28, `${a.id} centre 0.4–27.7 mm inside the hull (${(-d).toFixed(1)})`);
  }
  const b = freshMedium();
  applyRelabel(b);
  const ids = areaIds(b);
  assert.equal(ids.length, b.neuronCount);
  const per = new Array(AREAS.length).fill(0);
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === AREA_NONE) continue;
    assert.equal(b.neurons[i * FLOATS + 11], KIND.CORTEX, 'only cortical stars carry an area');
    per[ids[i]]++;
  }
  AREAS.forEach((a, i) => assert.ok(per[i] >= 20, `${a.id} has stars (${per[i]})`));
  // The anterior insula is drawn by generateBrain since the §7.3 ribbon (y up to +23).
  const insAnt = AREAS.findIndex((a) => a.id === 'insAnt');
  let ant = 0;
  for (let i = 0; i < ids.length; i++) if (ids[i] === insAnt && b.neurons[i * FLOATS + 8] === R.insula && b.neurons[i * FLOATS + 1] / MM > 8) ant++;
  assert.ok(ant >= 20, `generateBrain insula stars in front of y +8 carry insAnt (${ant})`);
});

test('BRAIN_TRACTS reproduce the §3.16 route lengths and end at their nodes', () => {
  const plen = (pts) => pts.slice(1).reduce((s, p, i) => s + len3(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
  const close = (p, q) => len3(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9;
  assert.equal(BRAIN_TRACTS.length, 18);
  for (const t of BRAIN_TRACTS) {
    for (const route of [t, ...(t.alt || []), ...(t.branches || [])]) {
      assert.ok(Math.abs(plen(route.pts) - route.len) <= 0.1, `${t.id} length ${plen(route.pts).toFixed(2)} vs ${route.len}`);
    }
    const first = t.pts[0], last = t.pts[t.pts.length - 1];
    if (t.from === 'junction') assert.equal(first[2], BRAIN_PARAMS.junction[2]);
    else if (t.from === 'lc') assert.ok(V2.lc.pts.some((p) => close(p, first)), 'tractDNB starts on the LC tube');
    else assert.ok(close(first, nodePos(t.from)), `${t.id} starts at ${t.from}`);
    if (t.to === 'junction') assert.equal(last[2], BRAIN_PARAMS.junction[2]);
    else if (t.to === 'cerebellum') assert.ok(sdCerebellum(...last) < 0);
    else if (t.to === 'pfc') assert.ok(sdCerebrum(last[0], last[1], last[2], 1) < 0);
    else {
      const q = nodePos(t.to);
      assert.ok(close(last, t.crossed ? [-q[0], q[1], q[2]] : q), `${t.id} ends at ${t.crossed ? 'contralateral ' : ''}${t.to}`);
    }
    if (t.crossed) assert.ok(last[0] < 0, `${t.id} crosses`);
  }
});

test('PORTS: the 21 ports of A.3.3 with networks, brain-side nodes and positions', () => {
  const AFF = ['portDC', 'portSTT', 'portTrig', 'portVisc', 'portGust', 'portSpinoVisc', 'portCVO', 'portVest', 'portCoch', 'portRetina', 'portOlf'];
  const EFF = ['portCST', 'portRS', 'portCranMotor', 'portSymp', 'portVag', 'portPara', 'portSacral', 'portPortal', 'portNeurohyp', 'portImmune'];
  assert.deepEqual(PORTS.filter((p) => p.dir === 'aff').map((p) => p.id), AFF);
  assert.deepEqual(PORTS.filter((p) => p.dir === 'eff').map((p) => p.id), EFF);
  const NETS = new Set(['somatic', 'autonomic', 'enteric', 'neuroendocrine', 'neuroimmune']);
  const known = new Set([...REGION_IDS, ...Object.keys(REGION_ALIASES), ...AREAS.map((a) => a.id), 's1', 'm1', 'n11']);
  for (const p of PORTS) {
    assert.ok(p.channels.length >= 1);
    for (const c of p.channels) for (const n of c.nets) assert.ok(NETS.has(n), `${p.id}: ${n}`);
    for (const n of p.nodes) assert.ok(known.has(n), `${p.id}: unknown node ${n}`);
    const pos = portPos(p.id);
    assert.ok(pos && pos.length === 3 && pos.every(Number.isFinite), `${p.id} position`);
    if (p.at.attach) for (const a of p.at.attach) assert.ok(a in CN_ATTACH);
  }
  // Special senses are always on (A.8 #5); the somatic and autonomic gates follow §3.14.
  for (const id of ['portGust', 'portVest', 'portCoch', 'portRetina', 'portOlf']) assert.deepEqual(PORTS.find((p) => p.id === id).channels[0].nets, []);
  assert.deepEqual(PORTS.find((p) => p.id === 'portImmune').channels[0].nets, ['autonomic', 'neuroimmune']);
});

test('MIDLINE flags the single midline structures (A.2)', () => {
  assert.equal(MIDLINE.length, REGION_COUNT);
  const mid = ['pituitaryGland', 'pituitaryPost', 'pag', 'raphe', 'mnr', 'rmg', 'rpa', 'rob', 'mnpo', 'ovlt', 'sfo', 'areaPostrema', 'medianEminence', 'pineal', 'nodulus'];
  for (let r = 0; r < REGION_COUNT; r++) assert.equal(MIDLINE[r], mid.includes(REGION_IDS[r]) ? 1 : 0, REGION_IDS[r]);
});

test('nodePos resolves every new region id', () => {
  for (const id of [...REGION_IDS.slice(LEGACY_REGION_COUNT), ...Object.keys(REGION_ALIASES)]) {
    const p = nodePos(id);
    assert.ok(p && p.length === 3 && p.every(Number.isFinite), id);
  }
  assert.ok(nodePos('pituitaryAnt')[1] > BRAIN_PARAMS.pituitarySplitY && nodePos('pituitaryPost')[1] <= BRAIN_PARAMS.pituitarySplitY);
});
