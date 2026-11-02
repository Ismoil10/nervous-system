// Shaders and the render data path (research/ANALYSIS.md B.3, B.5, B.7, §11.15, §13): uniform
// budgets per program, the uState texel accessors replacing the uniform arrays, declared and used
// names, the StateTextures packing (brain-only values unchanged, PARENT inheritance, sides,
// packets), the §13.5 palette, body ranges and the camera ray.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/shaders.js';
import { PROGRAMS, PARAMS as RP, bodyRanges } from '../src/renderer.js';
import { StateTextures, PACKET_CAP, ROW, UNITS } from '../src/statetex.js';
import { cctDuvRGB, rgbToHex, redRatio, blackbodyRGB } from '../src/color.js';
import { OrbitCamera } from '../src/camera.js';
import { REGION_COUNT, PATHWAYS, R, MM } from '../src/anatomy.js';

const strip = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const VS = Object.fromEntries(Object.entries(PROGRAMS).map(([k, [vs]]) => [k, vs]));
const FS = Object.fromEntries(Object.entries(PROGRAMS).map(([k, [, fs]]) => [k, fs]));

describe('uniform budgets (B.3, B.7)', () => {
  test('every program stays below 256 vec4 slots per stage', () => {
    for (const [name, [vs, fs]] of Object.entries(PROGRAMS)) {
      const a = S.uniformSlots(vs), b = S.uniformSlots(fs);
      assert.ok(a.slots < 256, `${name}.vs ${a.slots} slots`);
      assert.ok(b.slots < 256, `${name}.fs ${b.slots} slots`);
      assert.ok(a.samplers + b.samplers <= 16, `${name} samplers`);
      assert.ok(a.samplers <= 5, `${name}: vertex textures ≤ 5 of 16 (B.7)`);
    }
  });

  test('the neuron and dopamine programs no longer grow with REGION_COUNT', () => {
    // B.3: ≈ 24 + 2R and ≈ 67 + 2R slots before the move; with R = 122 that was 268 and 311.
    assert.ok(S.uniformSlots(VS.neuron).slots <= 32);
    assert.ok(S.uniformSlots(VS.da).slots <= 32);
    assert.ok(S.uniformSlots(VS.body).slots <= 110, 'body ≈ 74 slots plus the common block (B.7)');
  });

  test('the slot counter counts arrays, matrices and samplers', () => {
    const r = S.uniformSlots('uniform mat4 a; uniform vec4 b[16]; uniform highp sampler2D c; // uniform vec4 d[99];\nuniform float e;');
    assert.deepEqual([r.slots, r.samplers], [4 + 16 + 1, 1]);
  });
});

describe('shader sources', () => {
  test('header, balanced brackets and unique attribute locations', () => {
    for (const [name, src] of [...Object.entries(VS).map(([k, v]) => [k + '.vs', v]), ...Object.entries(FS).map(([k, v]) => [k + '.fs', v])]) {
      assert.ok(src.startsWith('#version 300 es\n'), name);
      const s = strip(src);
      for (const [o, c] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(s.split(o).length, s.split(c).length, `${name} ${o}${c}`);
      const locs = [...s.matchAll(/layout\(location = (\d+)\) in/g)].map((m) => m[1]);
      assert.equal(new Set(locs).size, locs.length, `${name} locations`);
      assert.ok(!/\$\{|undefined|NaN/.test(s), `${name} template residue`);
    }
  });

  test('per-region uniform arrays are replaced by uState accessors (B.5)', () => {
    for (const k of ['neuron', 'da', 'lantern', 'body']) {
      const s = strip(VS[k]);
      assert.ok(!/uniform\s+vec4\s+(uRegion|uTint|uDA|uPathHist)\b/.test(s), k);
      assert.ok(/uniform highp sampler2D uState;/.test(s), k);
      for (const fn of ['regionState', 'regionTint', 'daState', 'pathHistAt', 'areaState']) assert.ok(s.includes(`${fn}(`), `${k} ${fn}`);
    }
    assert.ok(/layout\(location = 3\) in uint aArea;/.test(VS.neuron));
    assert.ok(/regionState\(r, s\)/.test(VS.neuron) && /regionTint\(r, s\)/.test(VS.neuron) && /areaState\(aArea\)/.test(VS.neuron));
    assert.ok(/pathHistAt\(/.test(VS.da) && /daState\(g, s\)/.test(VS.da));
  });

  test('brain shading keeps its legacy terms', () => {
    const s = strip(VS.neuron);
    assert.ok(s.includes('float tw = 1.0 + 0.10 * sin(uT * (1.3 + 2.4 * aNrm.w) + aNrm.w * 40.0);'));
    assert.ok(s.includes('vColor = base * flux + uAmber * da + T.rgb * (R.w * aPos.w * 0.6 * att);'));
    assert.ok(s.includes('float flux = aPos.w * R.x * Ar.x * over * tw * facing * att * shell;'));
    assert.ok(s.includes('float att = exp(-tissuePath(p) / uLambda);'));
    assert.ok(strip(VS.lantern).includes('float lit = 1.0 - smoothstep(R.z - 0.12, R.z + 0.12, aA.y);'));
  });

  test('every u-name used is declared, and every program-specific uniform is used', () => {
    const common = new Set(S.uniformSlots(S.NEURON_VS).names.filter((n) => S.uniformSlots(S.DA_VS).names.includes(n)));
    for (const [name, src] of [...Object.entries(VS), ...Object.entries(FS)]) {
      const s = strip(src);
      const declared = new Set(S.uniformSlots(s).names);
      const used = new Set([...s.matchAll(/\bu[A-Z]\w*/g)].map((m) => m[0]));
      for (const u of used) assert.ok(declared.has(u), `${name}: ${u} used but not declared`);
      for (const u of declared) {
        if (common.has(u)) continue;
        const n = s.split(new RegExp(`\\b${u}\\b`)).length - 1;
        assert.ok(n >= 2, `${name}: ${u} declared but unused`);
      }
    }
  });

  test('vertex outputs match the fragment inputs of each program', () => {
    for (const [name, [vs, fs]] of Object.entries(PROGRAMS)) {
      const outs = [...strip(vs).matchAll(/^out (\w+) (\w+);/gm)].map((m) => m[1] + ' ' + m[2]).sort();
      const ins = [...strip(fs).matchAll(/^in (\w+) (\w+);/gm)].map((m) => m[1] + ' ' + m[2]).sort();
      assert.deepEqual(ins.filter((x) => !outs.includes(x)), [], name);
    }
  });

  test('no smoothstep with constant edges in the wrong order (undefined in GLSL)', () => {
    for (const [name, src] of Object.entries(VS)) {
      for (const m of strip(src).matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)) assert.ok(Number(m[1]) < Number(m[2]), `${name}: ${m[0]}`);
    }
  });

  test('body vertex record and §13 constants', () => {
    const s = strip(S.BODY_VS);
    for (const l of [0, 1, 2, 3]) assert.ok(new RegExp(`layout\\(location = ${l}\\) in vec4 a\\w+;`).test(s), `location ${l}`);
    assert.equal(S.BODY_FLOATS, 16);
    assert.ok(s.includes(`uniform vec4 uOrgan[16];`) && s.includes(`uniform vec4 uJoint[40];`), 'B.7 uOrgan[16], uJoint[40]');
    assert.equal(S.PARAMS.ghost, 0.08);
    assert.equal(S.PARAMS.lambdaBody, 150);
    assert.deepEqual(S.PARAMS.torso, { cy: -15, a: 160, b: 120, z0: -835, z1: -185 });
    assert.ok(s.includes(`${(150 * MM).toFixed(5)}`), 'λ_body in units');
    assert.ok(s.includes('texelFetch(uPackets') && s.includes('texelFetch(uEdgeAct') && s.includes('texelFetch(uBodyState'));
  });
});

describe('StateTextures (headless)', () => {
  const legacy = () => {
    const region = new Float32Array(REGION_COUNT * 4), tint = new Float32Array(REGION_COUNT * 4), da = new Float32Array(REGION_COUNT * 4);
    for (let i = 0; i < region.length; i++) { region[i] = 0.5 + ((i * 37) % 11) / 7; tint[i] = ((i * 13) % 5) / 5; da[i] = ((i * 7) % 9) * 1.25; }
    const pathHist = Float32Array.from({ length: Math.ceil(PATHWAYS.length * S.PATH_HIST / 4) * 4 }, (_, i) => (i % 17) / 16);
    return { region, tint, da, pathHist };
  };
  const texel = (st, row, col) => Array.from(st.brainData.subarray((row * st.width + col) * 4, (row * st.width + col) * 4 + 4));

  test('legacy dopamine arrays land unchanged in both columns of each region', () => {
    const st = new StateTextures(null, { parent: null });
    const d = legacy();
    st.compose({ dopamine: d, dtS: 0.016 });
    assert.ok(st.width >= 2 * REGION_COUNT && st.width % 128 === 0);
    for (let r = 0; r < REGION_COUNT; r++) {
      for (const s of [0, 1]) {
        const c = 2 * r + s;
        assert.deepEqual(texel(st, ROW.REGION, c), Array.from(d.region.subarray(r * 4, r * 4 + 4)));
        assert.deepEqual(texel(st, ROW.TINT, c), [...Array.from(d.tint.subarray(r * 4, r * 4 + 3)), 0]);
        assert.deepEqual(texel(st, ROW.DA, c), [...Array.from(d.da.subarray(r * 4, r * 4 + 3)), 1]);
      }
    }
    const ph = Array.from(st.brainData.subarray(ROW.PATH * st.width * 4, ROW.PATH * st.width * 4 + d.pathHist.length));
    assert.deepEqual(ph, Array.from(d.pathHist));
    assert.deepEqual(texel(st, ROW.AREA, 0), [1, 1, 0, 0], 'areas neutral at rest');
  });

  test('PARENT inheritance and BrainNet activity (B.4)', () => {
    const parent = Array.from({ length: REGION_COUNT }, (_, i) => i);
    parent[R.pallidum] = R.thalamus;   // a split id inherits its parent's channels
    const st = new StateTextures(null, { parent, midline: [R.pag] });
    const d = legacy();
    const act = new Float32Array(2 * REGION_COUNT).fill(1);
    act[2 * R.thalamus + 1] = 2;       // left thalamus doubled
    act[2 * R.pag] = 3; act[2 * R.pag + 1] = NaN;   // midline node lives in column 2r
    st.compose({ dopamine: d, brainnet: { activity: act }, dtS: 0.016 });
    assert.deepEqual(texel(st, ROW.REGION, 2 * R.pallidum).slice(1), Array.from(d.region.subarray(R.thalamus * 4 + 1, R.thalamus * 4 + 4)));
    assert.ok(Math.abs(texel(st, ROW.REGION, 2 * R.pallidum)[0] - d.region[R.thalamus * 4]) < 1e-6);
    assert.ok(Math.abs(texel(st, ROW.REGION, 2 * R.thalamus + 1)[0] - 2 * d.region[R.thalamus * 4]) < 1e-6);
    assert.ok(Math.abs(texel(st, ROW.REGION, 2 * R.thalamus)[0] - d.region[R.thalamus * 4]) < 1e-6);
    for (const s of [0, 1]) assert.ok(Math.abs(texel(st, ROW.REGION, 2 * R.pag + s)[0] - 3 * d.region[R.pag * 4]) < 1e-5);
  });

  test('substitution tints from BrainNet replace the additive channel (§13.6)', () => {
    const st = new StateTextures(null, { parent: null });
    const d = legacy();
    const tint = new Float32Array(REGION_COUNT * 4);
    tint.set([0.6, 0.85, 1.0, 0.5], R.brainstem * 4);
    st.compose({ dopamine: d, brainnet: { tint }, dtS: 0 });
    assert.deepEqual(texel(st, ROW.TINT, 2 * R.brainstem + 1).map((x) => +x.toFixed(4)), [0.6, 0.85, 1, 0.5]);
    assert.equal(texel(st, ROW.REGION, 2 * R.brainstem)[3], 0);
  });

  test('overlay fades over ≥ 0.8 s with member 1.6 and non-member 0.7 (§13.10, §13.15)', () => {
    const st = new StateTextures(null, { parent: null });
    st.setOverlay(st.overlayTargets({ regions: ['thalamus'] }), 0.1);
    st.compose({ dtS: 0.4 });
    const mid = texel(st, ROW.DA, 2 * R.thalamus)[3];
    assert.ok(mid > 1 && mid < 1.6, `half-way ${mid}`);
    st.compose({ dtS: 0.5 });
    assert.ok(Math.abs(texel(st, ROW.DA, 2 * R.thalamus)[3] - 1.6) < 1e-6);
    assert.ok(Math.abs(texel(st, ROW.DA, 2 * R.cortex + 1)[3] - 0.7) < 1e-6);
  });

  test('packets: sorted by path, ≤ 8 per path, ≤ the tier pool, run index exact (B.7, §13.8)', () => {
    const st = new StateTextures(null, { parent: null });
    st.setPacketPool(PACKET_CAP);
    const list = [];
    for (let i = 0; i < 20; i++) list.push({ pathId: 3000, uHead: i / 20, sigmaU: 0.02, gain: 1, fibre: 'C', dir: -1 });
    list.push({ pathId: 7, uHead: 0.5, sigmaU: 0.01, gain: 1, fibre: 'Abeta', dir: 1 });
    list.push({ pathId: 7, uHead: 0.4, sigmaU: 0.01, gain: 0.5, fibre: 'Adelta', dir: 'aff', effOnly: true });
    list.push({ pathId: -1, uHead: 0, sigmaU: 0.01, gain: 1, fibre: 'C', dir: 1 });
    st.compose({ packets: list, dtS: 0.016 });
    assert.equal(st.packetCount, 2 + 8);
    const run = (p) => st.edgeData[p * 4 + 3];
    assert.equal(run(7), 0 * 16 + 2);
    assert.equal(run(3000), 2 * 16 + 8);
    assert.equal(st.packetData[0], 7);
    assert.ok(Math.abs(st.packetData[3] - 0.6 * Math.tanh(1)) < 1e-6, 'Aβ: 0.6 × tanh(gain)');
    assert.ok(Math.abs(st.packetData[7] - 0.6 * 0.8 * Math.tanh(0.5) * 0.5) < 1e-6, 'Aδ 0.8, efference only 0.5');
    assert.ok(Math.abs(st.packetData[2 * 4 + 2] - 0.02 * 1.5) < 1e-7, 'C: σ × 1.5');
    assert.equal(st.packetData[(PACKET_CAP + 1) * 4 + 1], -1, 'afferent direction');
    assert.equal(st.packetData[(PACKET_CAP + 1) * 4 + 3], 1, 'efference-only flag');
    // Next frame without packets clears the runs.
    st.compose({ packets: [], dtS: 0.016 });
    assert.equal(run(7), -1);
    assert.equal(run(3000), -1);
    st.setPacketPool(5);
    st.compose({ packets: list, dtS: 0.016 });
    assert.equal(st.packetCount, 5);
  });

  test('kernel display hand-off and edge low-pass (τ 0.3 s)', () => {
    const st = new StateTextures(null, { parent: null, bodyNodes: 600, edges: 100 });
    assert.equal(st.nodeCap % 512, 0);
    assert.deepEqual(Array.from(st.bodyData.subarray(0, 4)), [1, 1, 0, 0]);
    assert.deepEqual(Array.from(st.edgeData.subarray(0, 4)), [0, 0, 1, -1]);
    const paths = new Float32Array(400);
    paths[4 * 5] = 1;
    paths[4 * 5 + 2] = 0.08;
    st.compose({ kernel: { display: { paths } }, dtS: 0.3 });
    assert.ok(Math.abs(st.edgeData[4 * 5] - (1 - Math.exp(-1))) < 1e-6);
    assert.equal(st.edgeData[4 * 5 + 2], Math.fround(0.08));
    assert.deepEqual(Object.values(UNITS).sort(), [2, 3, 4, 5, 6]);
  });
});

describe('body palette (§13.5) and colour rules', () => {
  const table = [[13000, 0, '#bccdff'], [6000, 0, '#fff4f1'], [10000, -0.020, '#e0c3ff'], [6000, 0.0125, '#f2ffe5'],
    [8500, 0.020, '#c7feff'], [5500, -0.0175, '#ffd2e6'], [13000, 0.015, '#a5dcff'], [7500, 0, '#ebecff']];
  test('cctDuvRGB reproduces the sRGB swatches', () => {
    for (const [T, duv, hex] of table) assert.equal(rgbToHex(cctDuvRGB(T, duv)), hex, `${T} K ${duv}`);
  });
  test('red ratios: body ≤ 0.42, lantern 2,300 K ≤ 0.75; Duv 0 equals the Planck colour', () => {
    for (const [T, duv] of table) assert.ok(redRatio(cctDuvRGB(T, duv)) <= 0.42);
    assert.ok(redRatio(blackbodyRGB(2300)) <= 0.75);
    const a = cctDuvRGB(7000, 0), b = blackbodyRGB(7000);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 2e-3);
  });
  test('renderer palette roles follow the B.7 bit order', () => {
    assert.deepEqual(RP.netRole, ['afferent', 'somEff', 'symp', 'para', 'afferent', 'enteric', 'endocrine', 'immune']);
    assert.deepEqual(Object.keys(S.NET_BIT), ['somAff', 'somEff', 'symp', 'para', 'visAff', 'enteric', 'endocrine', 'immune']);
    const sum = (t) => RP.classBudget[t].reduce((a, b) => a + b, 0);
    assert.deepEqual(['low', 'medium', 'high', 'ultra'].map(sum), [32500, 63000, 104000, 158000], '§13.4 body totals');
  });
});

describe('body ranges', () => {
  const pts = (classes) => { const a = new Float32Array(classes.length * 16); classes.forEach((c, i) => { a[i * 16 + 11] = c; a[i * 16 + 3] = 1; }); return a; };
  test('object, array and scanned forms', () => {
    const p = pts([0, 0, 1, 5, 5, 5]);
    assert.deepEqual(bodyRanges({ skin: [0, 2], organs: [2, 1], nerves: [3, 3] }, p, 6).slice(0, 6), [[0, 2], [2, 1], null, null, null, [3, 3]]);
    assert.deepEqual(bodyRanges(null, p, 6).slice(0, 6), [[0, 2], [2, 1], null, null, null, [3, 3]]);
    assert.equal(bodyRanges(null, pts([0, 1, 0]), 3), null, 'interleaved classes draw in one call');
  });
});

describe('camera (§13.11)', () => {
  const canvas = { addEventListener() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  test('near plane 0.01 · max(1, d/4), far 150', () => {
    const cam = new OrbitCamera(canvas, { distance: 35, maxDistance: 45, fov: 0.55 });
    cam.update(0, 800 / 600, 0);
    assert.ok(Math.abs(cam.nearPlane - 0.01 * 35 / 4) < 1e-12);
    const near = cam.proj[14] / (cam.proj[10] - 1), far = cam.proj[14] / (cam.proj[10] + 1);
    assert.ok(Math.abs(near - 0.0875) < 1e-6 && Math.abs(far - 150) < 0.05, `${near} ${far}`);   // Float32 matrix
  });
  test('unproject: the centre pixel looks at the target, rays in mm', () => {
    const cam = new OrbitCamera(canvas, { distance: 13.6, yaw: -0.35, pitch: 0.1, target: [0, 0, -2.46], fov: 0.55, maxDistance: 45 });
    cam.update(0, 800 / 600, 0);
    const { origin, dir } = cam.unproject(400, 300);
    const toT = [0 - origin[0], 0 - origin[1], -246 - origin[2]];
    const n = Math.hypot(...toT);
    assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-9);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(dir[i] - toT[i] / n) < 1e-6);
    assert.ok(Math.abs(n - 1360) < 1e-6, 'distance 13.6 units = 1,360 mm');
    // The top edge is half the vertical field of view above the axis.
    const up = cam.unproject(400, 0).dir;
    const ang = Math.acos(up.reduce((s, v, i) => s + v * dir[i], 0));
    assert.ok(Math.abs(ang - 0.55 / 2) < 1e-6);
  });
  test('fly-to eases the distance in log space; reduced motion cuts', () => {
    const cam = new OrbitCamera(canvas, { distance: 3.6, maxDistance: 45, fov: 0.55 });
    cam.flyTo({ yaw: cam.yaw, pitch: cam.pitch, distance: 36, target: [0, 0, 0] });
    const k = 1 - Math.exp(-0.1 * 3.5);
    cam.update(0.1, 1.5, 0);
    assert.ok(Math.abs(cam.distance - Math.exp(Math.log(3.6) + Math.log(10) * k)) < 1e-9);
    let cut = 0;
    const rm = new OrbitCamera(canvas, { reducedMotion: true, distance: 3.6, onCut: () => cut++ });
    rm.flyTo({ yaw: 1, pitch: 0.2, distance: 20, target: [0, 0, -1] });
    assert.deepEqual([rm.distance, rm.yaw, rm.goal, cut], [20, 1, null, 1]);
  });
});
