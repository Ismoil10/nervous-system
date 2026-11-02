// Brain part of the geometry tests (research/ANALYSIS.md B.14 `geometry.test.mjs`, phase 1, B.15):
// the generateBrain buffer stays bit-identical per tier (seed 1848); the appended region ids,
// PARENT and the relabels are consistent; the extra buffer is floor-stratified; the new
// structures lie inside the brain and overlap only where §3.16 says real borders interdigitate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  REGION_IDS, REGION_COUNT, LEGACY_REGION_COUNT, REGION_ALIASES, R, KIND, NUCLEI, BRAINSTEM, PARENT, NUCLEI_V2, V2,
  RELABEL, AREAS, AREA_NONE, BRAIN_TRACTS, PORTS, CN_ATTACH, BRAIN_PARAMS, MIDLINE, nodePos, portPos,
  sdCerebrum, sdCerebellum, spline, len3, mulberry32, MM,
} from '../src/anatomy.js';
import { generateBrain, generateBrainExtra, applyRelabel, areaIds, FLOATS, EXTRA_PARAMS } from '../src/brain.js';

// Tier sizes of src/performance.js TIERS (B.8) and the dopamine budget of main.js daBudget.
const TIERS = [
  { name: 'low', neurons: 60000, axon: 6000, vari: 4000, extra: 3000 },
  { name: 'medium', neurons: 130000, axon: 10000, vari: 7000, extra: 5850 },
  { name: 'high', neurons: 240000, axon: 16000, vari: 11000, extra: 10800 },
  { name: 'ultra', neurons: 400000, axon: 24000, vari: 16000, extra: 18000 },
];
const daBudget = (t) => ({ soma: 3500, axon: t.axon, vari: t.vari, total: 3500 + t.axon + t.vari });

// SHA-256 of the generateBrain output (seed 1848), recorded from the code before the
// brain-system additions (Node 24.15). Any change here means the legacy buffer moved.
const GOLDEN = {
  low: { neurons: '0a97cac7969f4645b49b075bae8d4a6adb0804d787dca2238c32a46fc31a048c', da: 'f1ac1fee42e5dc68aa32f930d8ea592b86ee1a35ba8924e4dbd6952512223344', lanterns: '59002a58139605dc3be9ca31b16c19c12223d2fde564e5d608a326b46b36c5a4', daCount: 13500 },
  medium: { neurons: 'c9d547d7bb9e789775b956b348d2a014ea28bb4e393fb51cc2023d0e9b133415', da: 'd3c9a79064c13cd21bc16160728887311163860afe8bccd4c670f1c2e44856cf', lanterns: '24f883018ff81550fcf62d5694a296f4908280a401f5a6b1012a6b250d4c8b5f', daCount: 20500 },
  high: { neurons: 'e77450df4c2a7645bc4361c201eed4b2ef909c9806856f490634b3806c9bee65', da: '333133f13816e01d11901e22bfeeee331ebba501c7c86c4a2ed13671ea39b219', lanterns: 'cd76797ccd153d2ee7c136c278e02498b6ad9d300a18610dbfa0e43476ea35f4', daCount: 30500 },
  ultra: { neurons: '0903516cdbefe2a2802e514fa7fd3f60f575c48f49be009dd63f6a67b4a74e8e', da: 'dc65fc06ca39d6207de7fb9304d772d93caac23bf823ab44e80771f9d5836664', lanterns: '78801015c5d62cb7478c0adfce932260dfafef89de8f45b3da99ea6213a4eb31', daCount: 43500 },
};
const sha = (a) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');

const LEGACY_IDS = [
  'cortex', 'frontal', 'pfc', 'ofc', 'acc', 'insula', 'parietal', 'temporal', 'occipital',
  'cerebellum', 'dentate', 'thalamus', 'dorsalStriatum', 'naccCore', 'naccShell', 'pallidum',
  'amygdala', 'hippocampus', 'hypothalamus', 'mpoa', 'pvn', 'arcuate', 'pituitary', 'vta', 'snc',
  'zonaIncerta', 'a11', 'rmtg', 'raphe', 'pag', 'brainstem', 'spinal', 'whiteMatter',
];
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

test('generateBrain is bit-identical per tier (seed 1848)', () => {
  for (const t of TIERS) {
    const b = generateBrain({ neurons: t.neurons, da: daBudget(t) });
    const g = GOLDEN[t.name];
    assert.equal(b.neuronCount, t.neurons, `${t.name} neuron count`);
    assert.equal(sha(b.neurons), g.neurons, `${t.name} neuron buffer`);
    assert.equal(b.daCount, g.daCount, `${t.name} dopamine count`);
    assert.equal(sha(b.da), g.da, `${t.name} dopamine buffer`);
    assert.equal(sha(b.lanterns), g.lanterns, `${t.name} lanterns`);
    if (t.name === 'medium') mediumBrain = { ...b, neurons: b.neurons.slice() };
  }
});

test('region ids: indices 0–32 unchanged, the 89 A.3.3 ids appended, aliases on the old ids', () => {
  assert.deepEqual(REGION_IDS.slice(0, LEGACY_REGION_COUNT), LEGACY_IDS);
  LEGACY_IDS.forEach((id, i) => assert.equal(R[id], i));
  const added = Object.values(A33).flat();
  assert.equal(added.length, 89);
  assert.deepEqual(REGION_IDS.slice(LEGACY_REGION_COUNT), added);
  assert.equal(REGION_COUNT, 122);
  assert.equal(REGION_COUNT, REGION_IDS.length);
  assert.equal(new Set(REGION_IDS).size, REGION_COUNT, 'ids unique');
  assert.equal(R.gpe, R.pallidum);
  assert.equal(R.dr, R.raphe);
  assert.equal(R.pituitaryAnt, R.pituitary);
  for (const alias of Object.keys(REGION_ALIASES)) assert.ok(!REGION_IDS.includes(alias), `${alias} is an alias, not a new id`);
  for (const id of REGION_IDS) assert.match(id, /^[a-z][A-Za-z0-9]*$/, 'camelCase ASCII (A.3.2)');
});

test('PARENT: one legacy parent per region, identity on 0–32, relabel targets inherit their source', () => {
  assert.equal(PARENT.length, REGION_COUNT);
  for (let r = 0; r < REGION_COUNT; r++) {
    assert.ok(PARENT[r] < LEGACY_REGION_COUNT, `${REGION_IDS[r]} has a legacy parent`);
    if (r < LEGACY_REGION_COUNT) assert.equal(PARENT[r], r);
  }
  for (const id of THAL_SUB) assert.equal(PARENT[R[id]], R.thalamus, id);
  assert.equal(PARENT[R.gpi], R.pallidum);
  assert.equal(PARENT[R.mnr], R.raphe);
  assert.equal(PARENT[R.pituitaryPost], R.pituitary);
  for (const rule of RELABEL) {
    const targets = rule.rule === 'plane' ? [rule.above, rule.below] : [...rule.to, ...(rule.shell ? [rule.shell.id] : [])];
    for (const id of targets) assert.equal(PARENT[R[id]], rule.from, `${id} inherits from ${REGION_IDS[rule.from]}`);
  }
});

test('applyRelabel rewrites only the region float of pallidum, raphe, pituitary and thalamus stars', () => {
  const b = freshMedium(), before = b.neurons.slice();
  const res = applyRelabel(b);
  assert.ok(res.relabelled > 0);
  const moved = new Map();
  for (let i = 0; i < b.neuronCount; i++) {
    const o = i * FLOATS;
    for (let k = 0; k < FLOATS; k++) if (k !== 8) assert.ok(Object.is(before[o + k], b.neurons[o + k]), `record ${i} field ${k} changed`);
    const from = before[o + 8], to = b.neurons[o + 8];
    if (from !== to) moved.set(`${REGION_IDS[from]}>${REGION_IDS[to]}`, (moved.get(`${REGION_IDS[from]}>${REGION_IDS[to]}`) || 0) + 1);
    if (to === R.pituitary) assert.ok(b.neurons[o + 1] / MM > BRAIN_PARAMS.pituitarySplitY - 1e-4, 'anterior lobe: y > −2');
    if (to === R.pituitaryPost) assert.ok(b.neurons[o + 1] / MM <= BRAIN_PARAMS.pituitarySplitY + 1e-4, 'posterior lobe: y ≤ −2');
  }
  const allowed = new Set(['pallidum>gpi', 'raphe>mnr', 'pituitary>pituitaryPost', ...THAL_SUB.map((id) => `thalamus>${id}`)]);
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
  // Small and empty budgets.
  const small = generateBrainExtra({ neurons: 500 });
  const sc = small.structures.map((s) => s.counts.reduce((x, y) => x + y, 0));
  assert.ok(Math.max(...sc) - Math.min(...sc) <= 1, 'a short budget is split evenly');
  assert.equal(generateBrainExtra({ neurons: 0 }).neuronCount, 0);
  assert.equal(applyRelabel(a).relabelled, 0, 'the extra buffer is never relabelled');
});

test('extra stars lie inside their structure; the insula extension fills the new ribbon only', () => {
  const ex = generateBrainExtra({ neurons: 10800 });
  const byRegion = new Map(NUCLEI_V2.filter((d) => d.stars).map((d) => [d.region, d]));
  const tubeSamples = new Map();
  for (let i = 0; i < ex.neuronCount; i++) {
    const o = i * FLOATS, r = ex.neurons[o + 8];
    const p = [ex.neurons[o] / MM, ex.neurons[o + 1] / MM, ex.neurons[o + 2] / MM];
    if (ex.neurons[o + 11] === KIND.CORTEX) {
      const { c, r: rr } = EXTRA_PARAMS.insula, oc = EXTRA_PARAMS.insulaCoded;
      assert.equal(r, R.insula);
      assert.ok(((p[1] - oc.c[1]) / oc.r[1]) ** 2 + ((p[2] - oc.c[2]) / oc.r[2]) ** 2 > 1 - 1e-4, 'outside the coded footprint');
      assert.ok(p[1] >= c[1] - rr[1] - 0.01 && p[1] <= c[1] + rr[1] + 0.01 && Math.abs(p[0]) <= c[0] + rr[0] + 0.01);
      continue;
    }
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
  if (d.type === 'e') return ((Math.abs(p[0]) - d.c[0]) / d.r[0]) ** 2 + ((p[1] - d.c[1]) / d.r[1]) ** 2 + ((p[2] - d.c[2]) / d.r[2]) ** 2 <= 1;
  const f = spline(d.pts);
  for (let k = 0; k <= 200; k++) { const s = f(k / 200); if (len3(Math.abs(p[0]) - s[0], p[1] - s[1], p[2] - s[2]) <= s[3]) return true; }
  return false;
});

test('new structures lie inside the brain', () => {
  // The longitudinal fissure is a 1-mm modelling gap, so midline points are tested 2 mm off the midline.
  const hull = (p) => sdCerebrum(Math.max(Math.abs(p[0]), 2), p[1], p[2], 1);
  // §3.16: the olfactory bulb sits 2 mm below the frontal hull. The mammillary bodies and the TMN
  // lie on the ventral surface of the diencephalon, behind the coded hypothalamus ellipsoid.
  const OUTSIDE = { olfBulb: [0, 4], mammillary: [0, 6], tmn: [0, 6] };
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
  // Brainstem centres inside the BRAINSTEM tube at r² ≤ 0.93 (§3.16); cochNuc protrudes laterally
  // (1.22) and ic sits on the dorsal boundary as a tectal bump.
  const LIMIT = { cochNuc: 1.25, ic: 1.05 };
  for (const d of NUCLEI_V2.filter((n) => (n.group === 'bs' || n.group === 'raphe'))) {
    assert.ok(tubeR2(nodePos(d.id)) <= (LIMIT[d.id] ?? 0.95), `${d.id} inside the brainstem tube (${tubeR2(nodePos(d.id)).toFixed(2)})`);
  }
  // Relay nuclei outside, subnuclei inside or on the edge of the coded thalamus (§3.17).
  const th = NUCLEI.find((n) => n.id === 'thalamus');
  const thR2 = (p) => ((p[0] - th.c[0]) / th.r[0]) ** 2 + ((p[1] - th.c[1]) / th.r[1]) ** 2 + ((p[2] - th.c[2]) / th.r[2]) ** 2;
  for (const id of ['lgn', 'mgn', 'habenula']) assert.ok(thR2(nodePos(id)) > 1.3, `${id} outside the thalamus`);
  for (const id of THAL_SUB) assert.ok(thR2(nodePos(id)) <= 1.25, `${id} inside the thalamus`);
  const pal = NUCLEI.find((n) => n.id === 'pallidum');
  for (const id of ['gpe', 'gpi']) {
    const c = V2[id].c;
    assert.ok(((c[0] - pal.c[0]) / pal.r[0]) ** 2 + ((c[1] - pal.c[1]) / pal.r[1]) ** 2 + ((c[2] - pal.c[2]) / pal.r[2]) ** 2 < 1, `${id} centre in the pallidum`);
  }
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
  const ex = generateBrainExtra({ neurons: 5850 });
  const exIds = areaIds(ex);
  assert.ok(exIds.some((v) => v === AREAS.findIndex((a) => a.id === 'insAnt')), 'the insula extension carries insAnt');
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
  const mid = ['pituitary', 'pituitaryPost', 'pag', 'raphe', 'mnr', 'rmg', 'rpa', 'rob', 'mnpo', 'ovlt', 'sfo', 'areaPostrema', 'medianEminence', 'pineal', 'nodulus'];
  for (let r = 0; r < REGION_COUNT; r++) assert.equal(MIDLINE[r], mid.includes(REGION_IDS[r]) ? 1 : 0, REGION_IDS[r]);
});

test('nodePos resolves every new region id', () => {
  for (const id of [...REGION_IDS.slice(LEGACY_REGION_COUNT), ...Object.keys(REGION_ALIASES)]) {
    const p = nodePos(id);
    assert.ok(p && p.length === 3 && p.every(Number.isFinite), id);
  }
  assert.ok(nodePos('pituitaryAnt')[1] > BRAIN_PARAMS.pituitarySplitY && nodePos('pituitaryPost')[1] <= BRAIN_PARAMS.pituitarySplitY);
});
