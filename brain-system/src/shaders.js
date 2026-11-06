// GLSL ES 3.00 shaders for the star brain and the star body. Per-region state arrives in the uState
// data texture (statetex.js; research/ANALYSIS.md §11.15, B.7) indexed by the region id stored in
// every point and the side of the point; per-node, per-path and per-packet body state arrives in
// three further textures. The dopamine model (dopamine.js) still fills the region channels.

import { MM, PATHWAYS } from './anatomy.js';
import { BODY_TEX_W, EDGE_TEX_W } from './statetex.js';
import { HEART_FORM, HEART_SECTION as HSEC, HEART_DEPTH as HD, HEART_LOD as HL, PART as HP, FOCUS_LOD } from './body/heart-form.js';
import { VPART as VP } from './body/vessel-tree.js';
import { DIAPHRAGM, ORGANS, LUNG_ROLE } from './body/geometry.js';
import { BREATH } from './breath.js';

export const PATH_HIST = 16;   // samples of firing-rate history per pathway (axon impulse packets)
export const PATH_COUNT = PATHWAYS.length;

// Tissue classes of the body vertex record (a2.w) and display network bits (a3.x), B.7.
export const TISSUE = { SKIN: 0, ORGAN: 1, MUSCLE: 2, BONE: 3, CORD: 4, NERVE: 5, GANGLION: 6, ENTERIC: 7, VESSEL: 8 };
export const TISSUE_NAMES = ['skin', 'organ', 'muscle', 'bone', 'cord', 'nerve', 'ganglion', 'enteric', 'vessel'];
export const NET_BIT = { somAff: 0, somEff: 1, symp: 2, para: 3, visAff: 4, enteric: 5, endocrine: 6, immune: 7 };
export const BODY_FLOATS = 16;   // a0 pos.xyz (units), flux · a1 normal.xyz, seed · a2 node, path, u, class · a3 nets, LOD, side, segment
export { LUNG_ROLE };   // geometry.js (research/LUNGS.md §7)
export const ORGAN_SLOTS = 8;    // uOrgan[16]: 8 × (node, centre) + (mode, p1, p2, p3)
export const JOINT_SLOTS = 16;   // uJoint[32]: rigid segments × (quaternion, translation), B.7; geometry.js rigidAt uses 0–13 (was 20: four spare segments, 8 slots, pay for uFocus; CLOSEUP.md §3)

// Visual constants of the body pass. Lengths in mm unless stated; the shader works in units (MM).
export const PARAMS = {
  ghost: 0.08,                         // §13.10, A.5: switched-off network at 8 % flux, desaturated
  restingNetMix: 0.4,                  // §13.5 resting streams carry their network tint at weight 0.4
  headSkin: { gain: 0.35, d0: 5, d1: 8 },   // §13.2 head-skin and sense-organ factor 0.35·smoothstep(5, 8, d) (d in units)
  headZ: [-175, -145],                 // [model] skin above the menton (z −158, §2.3) counts as head skin
  faceBack: 0.35,                      // §13.2 skin facing law mix(0.35, 1, smoothstep(−0.3, 0.4, n·v))
  faceEdge: [-0.3, 0.4],               // §13.2
  faceSqrt: [0.6, 0.4],                // §13.2 × (0.6 + 0.4·|n·v|^0.5)
  torso: { cy: -15, a: 160, b: 120, z0: -835, z1: -185 },   // §13.3 attenuation envelope (elliptic cylinder)
  lambdaBody: 150,                     // §13.3 torso attenuation length λ_body
  // Breathing (research/LUNGS.md §3.5, §7.3) [model]: lung apices (right, left), the craniocaudal
  // weight exponent, the mediastinum's share of the descent (heart on the central tendon, trachea),
  // the abdominal viscera's share and the level where it falls to 0, the abdominal wall's outward
  // shift per mm of descent, the rib levels of the bucket-handle weight (upper z, span), and the
  // Lungs view's dimming of everything else and lift of the lungs.
  breath: { top: [-200, -216], wz: 1.2, mediastinum: 0.35, abdomen: 0.8, abdomenZ: -720, belly: 0.4, ribZ: [-220, 180],
    focusDim: [0.18, 0.4], focusGain: 1.8,
    // Lung stars by role (LUNG_ROLE 2–5: airway, acinus, pleura, parenchyma): flux gains that let the
    // airway tree read through the parenchyma (with generate.js PARAMS.lung.share the airways carry
    // ≈ 78 % of the lungs' light, the total ≈ 1.13 × the stars' own); and the Detailed colours: bronchi
    // greyish ivory (cartilage), the pleura silvery, acini and parenchyma the organ pink. In the Lungs
    // view the capillary beds stay at capillaryFocus: they are haze, not structure.
    roleGain: [1.6, 0.6, 0.6, 0.4], airwayRGB: [0.95, 0.93, 0.88], capillaryFocus: 0.45 },
  shimmer: 0.6,                        // §13.8 stream flux × (1 + 0.6·ā)
  twinkleHz: [0.2, 2.0],               // §13.8 per-star twinkle ±10 % at 0.2–2 Hz, desynchronised
  packetCut: 3,                        // [model] Gaussian packet profile truncated at ±3σ
  lodPxMm: [0.8, 2.0],                 // §13.4 LOD 2 at ≥ 0.8 px/mm, ENS close-up (LOD 3) at ≥ 2.0 px/mm (1,080-px reference)
  hand: { z: [-830, -790], x: [175, 195] },   // [model] distal skin for vasoconstriction: hands below the wrist (z −818, §2.6), lateral to the thighs
  foot: { z: [-1620, -1580] },         // [model] feet below the ankle (z −1,603, §2.6)
  size: [2.0, 1.0, 1.5],               // [model] point size uPx·(a + b·log2(1 + flux)), minimum
  // Heart beat display (research/HEART.md §5) [model]: base descent towards the apex and inward wall
  // motion at rest end-systole, atrial squeeze, the activation wave's gain and width in the
  // conduction system and in the walls, and the Heart view's dimming of everything else.
  heart: { descentMm: 12, wallIn: 0.12, atrialIn: 0.10, glow: [1.6, 0.5], sigma: [0.012, 0.02], focusDim: [0.18, 0.4], focusGain: 2.2,
    leafletOpen: 1.3, coronaryFlow: 0.3, near: [12, 45], openConduction: 0.55 },   // openConduction: the conduction system's flux in the opened heart (HEART.md §8.4)
  // Focus region and focus slab (research/CLOSEUP.md §3–§4) [model]: the wanted density of the body
  // stars grows as (q/q0)² (q px/mm, 1,080-px reference) and the region's close-up stars fill it up to
  // D_max; past D_max the stars grow as (want/D_max)^grow, at most × sizeMax; the region's edge
  // softens over its outer 30 %. The slab, in units of the camera's distance to the pivot d: stars
  // nearer than front[0]–front[1]·d fade out, those beyond back·d dim with the length lambda·d.
  // conserve: the region's stars give back the drawn density to this power: 1 keeps the total light (the
  // heart's law), 0 keeps each star's own light, so the body's surface brightness holds as it nears.
  focus: { q0: 2.0, grow: 0.25, sizeMax: 1.5, edge: 0.7, front: [0.35, 0.75], back: 1.25, lambda: 0.8, conserve: 0.25 },   // near: with the heart in focus, body stars fade in over 12–45 mm from the camera (HEART.md §8.3)
  // Arterial pulse display (research/PULSE.md §8) [model]: each artery star brightens as the wave
  // front passes, a Gaussian in reduced time (s ÷ the delay scale k) of width `sigma` centred `x0`
  // after the foot, cut at ±`cut` σ, of peak gain `gain` × the star's amplitude A × the beat amplitude
  // G; `partGain` is the tree's flux per part (artery, arterial branch, vein, venous branch, capillary,
  // pulmonary artery, pulmonary vein) relative to the vessel class.
  pulse: { x0: 0.03, sigma: 0.025, gain: 0.55, cut: 3, partGain: [4, 2.4, 2.6, 1.6, 1.4, 2.4, 2.4] },
};
const HF = HEART_FORM, vec3mm = (p) => `vec3(${f(p[0] * MM)}, ${f(p[1] * MM)}, ${f(p[2] * MM)})`;
const LUNGS = [1, -1].map((sd) => /** @type {any} */ (ORGANS.find((o) => o.id === 'lungs' && o.side === sd)));
const vec3u = (p) => `vec3(${f(p[0])}, ${f(p[1])}, ${f(p[2])})`;

const f = (x) => Number(x).toFixed(5);
const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

const CULL = `gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); vPeak = 0.0; return;`;

// Light from a point deep inside the brain crosses tissue first: the path from where the view ray
// enters the brain envelope (or the cutaway plane) to the point attenuates it as exp(−L/λ).
// This is the depth cue of a translucent "glass brain"; it never changes colour (warm is reserved
// for dopamine). Region state is read from uState at column 2·r + s, s = 1 left of the midline;
// statetex writes unsided and midline values into both columns.
const COMMON = `
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uEye;
uniform float uPx;        // base pixel size (render height / 1080)
uniform float uPxScale;   // pixels per world unit at distance 1
uniform float uMaxPt;
uniform float uT;         // screen time (s)
uniform float uCut;       // cutaway plane: points with x < uCut are removed (−10 = no cut)
uniform float uLambda;    // tissue attenuation length (world units)
uniform highp sampler2D uState;   // per-region state (statetex.js)
uniform vec3 uAmber;

const vec3 ENV_C = vec3(0.0, ${f(-17 * MM)}, ${f(3 * MM)});
const vec3 ENV_R = vec3(${f(72 * MM)}, ${f(89 * MM)}, ${f(78 * MM)});
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

int sideOf(vec3 p) { return p.x < 0.0 ? 1 : 0; }
vec4 regionState(int r, int s) { return texelFetch(uState, ivec2(2 * r + s, 0), 0); }   // activity, E, spread, modulator
vec4 regionTint(int r, int s) { return texelFetch(uState, ivec2(2 * r + s, 1), 0); }    // tint rgb, substitution amount
vec4 daState(int r, int s) { return texelFetch(uState, ivec2(2 * r + s, 2), 0); }       // firing level, spike phase, release phase, overlay
float pathHistAt(int a) { vec4 t = texelFetch(uState, ivec2(a / 4, 3), 0); return t[a % 4]; }
vec4 areaState(uint a) { return a == 255u ? vec4(1.0, 1.0, 0.0, 0.0) : texelFetch(uState, ivec2(int(a), 4), 0); }

float tissuePath(vec3 p) {
  vec3 d = p - uEye;
  float dist = length(d);
  d /= dist;
  vec3 e = (uEye - ENV_C) / ENV_R, k = d / ENV_R;
  float a = dot(k, k), b = dot(e, k), c = dot(e, e) - 1.0;
  float disc = b * b - a * c;
  if (disc <= 0.0) return 0.0;
  float t0 = max(0.0, (-b - sqrt(disc)) / a);
  if (uCut > -1.0 && uEye.x < uCut && d.x > 1e-4) t0 = max(t0, (uCut - uEye.x) / d.x);
  return max(0.0, dist - t0);
}
`;

// Dopamine wave (display only; user decision, 5 November 2026), like an expanding shock-wave ring:
// shells that race outward from the VTA, widen as they go, push the points they cross slightly
// outward and brighten them. main.js drives up to WAVE_SLOTS shells.
// Neurons and the dopamine system (somata, fibres, release sites) share it, so the wave leaves the
// core dopamine system along its fibres and crosses the whole brain.
export const WAVE_SLOTS = 4;
const WAVE = `
uniform vec4 uWaveO;                   // origin (world units); w > 0.5 while a wave runs
uniform vec4 uWave[${WAVE_SLOTS}];     // radius, amplitude, width, outward push (world units)
float waveAt(inout vec3 p) {
  if (uWaveO.w < 0.5) return 0.0;
  vec3 d = p - uWaveO.xyz;
  float r = length(d);
  float b = 0.0, push = 0.0;
  for (int k = 0; k < ${WAVE_SLOTS}; k++) {
    vec4 W = uWave[k];
    if (W.y <= 0.0) continue;
    float x = (r - W.x) / W.z;
    float g = W.y * exp(-x * x);
    b += g;
    push += g * W.w;
  }
  if (r > 1e-5) p += d * (push / r);
  return b;
}
`;

// --- Neurons: cool-white stars ---
export const NEURON_VS = HEADER + COMMON + WAVE + `
layout(location = 0) in vec4 aPos;    // xyz, flux
layout(location = 1) in vec4 aNrm;    // outward normal of shells (0 for volumes), seed
layout(location = 2) in vec4 aMeta;   // region, dopamine innervation weight, colour tint, kind
layout(location = 3) in uint aArea;   // sided cortical area 2·area + s (§11.15); 255 = none
uniform float uGain;
uniform float uZoom;
uniform float uShell;     // view-mode gain for cortex, cerebellum and white matter
uniform float uDeep;      // view-mode gain for deep nuclei, brainstem and the pituitary
uniform float uBack;      // brightness of shell points that face away from the camera
uniform float uDaGain;
uniform vec3 uCool;
uniform vec3 uWarm;
out vec3 vColor;
out float vPeak;
void main() {
  vec3 p = aPos.xyz;
  if (p.x < uCut) { ${CULL} }
  float wv = waveAt(p);
  int r = int(aMeta.x + 0.5);
  int s = sideOf(p);
  vec4 R = regionState(r, s);
  vec4 T = regionTint(r, s);
  vec4 Ar = areaState(aArea);
  float over = daState(r, s).w * Ar.y;   // brain-systems overlay (display only, §13.10); 1 = none
  float kind = aMeta.w;
  float facing = 1.0;
  if (dot(aNrm.xyz, aNrm.xyz) > 0.5) {
    float nv = dot(aNrm.xyz, normalize(uEye - p));
    facing = mix(uBack, 1.0, smoothstep(-0.3, 0.4, nv));
    // The medial walls face each other across the longitudinal fissure: seen edge-on they are
    // hidden by the opposite hemisphere, so they fade at grazing angles instead of piling up.
    if (abs(p.x) < 0.045 && abs(aNrm.x) > 0.8) facing *= smoothstep(0.08, 0.55, abs(nv));
  }
  float att = exp(-tissuePath(p) / uLambda);
  float shell = (kind < 1.5 || (kind > 3.5 && kind < 4.5)) ? uShell : uDeep;
  // Slow asynchronous twinkle (±10 %, 0.2–0.6 Hz): spontaneous activity, never a flash.
  float tw = 1.0 + 0.10 * sin(uT * (1.3 + 2.4 * aNrm.w) + aNrm.w * 40.0);
  float flux = aPos.w * R.x * Ar.x * over * tw * facing * att * shell;
  float da = aMeta.y * R.y * uDaGain * att * mix(1.0, facing, 0.5) * shell;
  flux *= 1.0 + 2.0 * wv;                              // dopamine wave; wv = 0 keeps the legacy terms
  da += aPos.w * wv * att * max(shell, 0.6) * 0.9;
  vec4 vp = uView * vec4(p, 1.0);
  if (vp.z > -0.01) { ${CULL} }
  gl_Position = uProj * vp;
  float size = clamp(uPx * (2.3 + 1.2 * log2(1.0 + aPos.w)), 2.0, uMaxPt);
  if (kind > 4.5) size = clamp(uPx * 9.0, 3.0, uMaxPt);   // pituitary: glandular haze
  gl_PointSize = size;
  vec3 base = mix(uCool, uWarm, aMeta.z);
  // Modulator tints as a chromaticity substitution at equal luminance (§13.6), amount T.w; the
  // DOPAMINE.md tints keep their additive form (T.w = 0, amount in R.w).
  if (T.w > 0.0) base = mix(base, T.rgb * (dot(base, LUMA) / max(1e-4, dot(T.rgb, LUMA))), T.w);
  vColor = base * flux + uAmber * da + T.rgb * (R.w * aPos.w * 0.6 * att);
  vPeak = uGain * uZoom * 16.0 / (size * size);
}
`;

// Gaussian core and faint wings (energy-conserving point spread function).
export const STAR_FS = HEADER + `
in vec3 vColor;
in float vPeak;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  float core = exp(-r2 * 12.5);
  float halo = 0.06 * exp(-r2 * 3.0);
  float win = clamp(1.0 - r2 * 4.0, 0.0, 1.0);
  outColor = vec4(vColor * vPeak * (core + halo) * win, 1.0);
}
`;

// --- Dopamine system: cell bodies, axon bundles, release sites ---
export const DA_VS = HEADER + COMMON + WAVE + `
layout(location = 0) in vec4 aPos;    // xyz, flux
layout(location = 1) in vec4 aA;      // axon: path, position along it, -, seed | others: -, -, -, seed
layout(location = 2) in vec4 aMeta;   // region (target for axons), w (field distance | source region), -, kind
uniform float uGain;
uniform float uZoom;
uniform vec3 uFibre;
out vec3 vColor;
out float vPeak;

// Firing history per pathway, newest first (uState row 3): firing level of a dopamine cell group
// (1 = tonic), its accumulated visual spike phase and the release phase of a terminal field are
// in row 2.
float pathRate(int path, float u) {
  float x = u * ${f(PATH_HIST - 1)};
  int i = int(floor(x));
  int j = min(i + 1, ${PATH_HIST - 1});
  float va = pathHistAt(path * ${PATH_HIST} + i), vb = pathHistAt(path * ${PATH_HIST} + j);
  return mix(va, vb, x - float(i));
}

void main() {
  vec3 p = aPos.xyz;
  if (p.x < uCut) { ${CULL} }
  float wv = waveAt(p);
  float kind = aMeta.w;
  float seed = aA.w;
  int s = sideOf(p);
  float att = exp(-tissuePath(p) / (uLambda * 1.6));
  vec3 col;
  float size;
  if (kind < 10.5) {
    // Cell bodies: an ember at rest; brighter with the firing level, each twinkling on its own
    // visual spike phase (rate-coded, small points only).
    int g = int(aMeta.x + 0.5);
    vec4 D = daState(g, s);
    float k = 0.6 + 0.8 * fract(seed * 7.13);
    float spike = pow(1.0 - fract(D.y * k + seed * 31.7), 6.0);
    float lvl = D.x;
    col = uAmber * aPos.w * (0.22 + 0.35 * lvl + 0.55 * lvl * spike);
    size = clamp(uPx * (2.6 + 1.3 * log2(1.0 + lvl)), 2.5, uMaxPt);
  } else if (kind < 11.5) {
    // Axons: faint fibre; packets of firing travel from the cell group to the terminal field.
    float rate = pathRate(int(aA.x + 0.5), aA.y);
    col = (uFibre * 0.25 + uAmber * 0.55 * rate) * aPos.w;
    size = clamp(uPx * 2.1, 2.0, uMaxPt);
  } else {
    // Release sites: sparks whose rate follows release in their field; only sites inside the
    // currently "lit" part of the field (distance w below the spread) take part.
    int r = int(aMeta.x + 0.5);
    vec4 R = regionState(r, s);
    float k = 0.05 + 0.12 * fract(seed * 5.31);
    float spark = pow(1.0 - fract(daState(r, s).z * k + seed * 13.1), 14.0);
    float inside = 1.0 - smoothstep(R.z - 0.1, R.z + 0.15, aMeta.y);
    col = uAmber * aPos.w * R.y * (0.12 + 1.4 * spark) * inside;
    size = clamp(uPx * 2.3, 2.0, uMaxPt);
  }
  col *= att * (1.0 + 4.0 * wv);   // the wave lights the somata, fibres and release sites it crosses
  vec4 vp = uView * vec4(p, 1.0);
  if (vp.z > -0.01 || dot(col, col) < 1e-10) { ${CULL} }
  gl_Position = uProj * vp;
  gl_PointSize = size;
  vColor = col;
  vPeak = uGain * uZoom * 16.0 / (size * size);
}
`;

// --- Body: skin, organs, muscle, bone, cord, nerves, ganglia, enteric mesh, vessels (§13) ---
// Additive like the brain. Per point: network ghosting and desaturation, body fade, head-skin fade,
// torso attenuation, skin facing, stream shimmer and travelling packets, organ geometry responses
// and rigid limb transforms. The fragment shader is STAR_FS.
const T = PARAMS.torso, HS = PARAMS.headSkin;
export const BODY_VS = HEADER + COMMON + `
layout(location = 0) in vec4 aPos;    // xyz (units), flux
layout(location = 1) in vec4 aNrm;    // skin normal (0 for volumes; heart stars: τ, part, axial place), seed
layout(location = 2) in vec4 aNode;   // graph node id (−1 none), path id (−1 none), u along the path, tissue class
layout(location = 3) in vec4 aNet;    // network bitmask, LOD, side, rigid segment id (−1 none)
uniform highp sampler2D uBodyState;   // per node: activity (1 = rest), ghost, response, network
uniform highp sampler2D uEdgeAct;     // per path: ā, efference-only flag, ghost, packet run
uniform highp sampler2D uPackets;     // row 0: path, uHead, σu, gain · row 1: fibre, direction, age, efference only
uniform int uNodeCap;
uniform int uPathCap;
uniform float uGain;
uniform float uZoom;       // body zoom law (3.6/d)^γ_body (§13.3)
uniform float uFade;       // body fade (0 = hidden)
uniform float uDist;       // camera distance (units)
uniform float uPxMm;       // pixels per mm at the 1,080-px reference
uniform float uSenseFull;  // 1: sense organs at full flux (Head & neck view, §13.2)
uniform float uSkinDim;    // distal skin dimming by vasoconstriction (−0.10 … 0.15, §13.7)
uniform float uMotion;     // 1: rigid limb transforms; 0 under reduced motion (§13.15)
uniform float uTwinkle;    // shimmer twinkle amplitude (halved under reduced motion)
uniform vec2 uStyle;       // x: anatomical colours 0–1 (simple HUD, Detailed style); y: point size factor (Detailed: smaller, sharper stars at the same energy)
uniform vec4 uKeep[3];     // per tissue class: share of the stars drawn (Stars style: the earlier budgets); [2].y the heart, .w the vascular tree
uniform vec4 uHeartT;      // heart (heart.js): time since the SA firing (s), PR, QRS, P duration
uniform vec4 uHeartM;      // atrial squeeze 0–1, ventricular contraction (1 = rest end-systole), root pulse, mean wave gain
uniform vec4 uHeartK;      // beat mode (1) or steady glow (0), steady gain, motion amplitude, Heart view focus
uniform vec4 uHeartV;      // atrioventricular valves open 0–1, semilunar valves open 0–1, diastole (coronary flow) 0–1, section 0 (closed) – 1 (open)
uniform vec4 uFocus[2];     // focus region (CLOSEUP.md §3): [0] centre (units), radius; [1] D_max (1 = none), weight 0–1, slab 0–1, unused
uniform vec4 uBreath;      // breathing (breath.js, LUNGS.md §7.3): diaphragm excursion, rib-cage expansion (units), Lungs view focus 0–1, unused
uniform vec4 uAir;         // airflow front (LUNGS.md §7.4): front (L from the mouth), gain G, energy-conserving mean G·M, direction (+1 in, −1 out, 0 off)
uniform vec4 uPulse;       // arterial pulse (pulse.js): reduced time since the aortic valve opened (s), amplitude G, energy-conserving mean G·M; w: the heart's close-up density cap D_max (1 = none, HEART.md §8.1)
uniform vec4 uClassGain[3];   // per tissue class: flux ratio × tier compensation (§13.3, B.8)
uniform vec4 uClassNorm[3];   // per tissue class: 1 / mean flux of the class
uniform vec4 uNetGain[2];     // display gain per network bit, ghost 0.08 … 1 (carries the cross-fades)
uniform vec3 uNetRGB[8];      // resting network tint per bit (§13.5)
uniform vec3 uStructRGB;      // structural neutral, 7,500 K
uniform vec3 uAffRGB;         // afferent packets, every network
uniform vec4 uOrgan[${2 * ORGAN_SLOTS}];
uniform vec4 uJoint[${2 * JOINT_SLOTS}];
out vec3 vColor;
out float vPeak;

const float GHOST = ${f(PARAMS.ghost)};
const vec2 TORSO_C = vec2(0.0, ${f(T.cy * MM)});
const vec2 TORSO_R = vec2(${f(T.a * MM)}, ${f(T.b * MM)});
const float TORSO_Z0 = ${f(T.z0 * MM)}, TORSO_Z1 = ${f(T.z1 * MM)};

vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

// Anatomical colours of the Detailed style, one per tissue class (TISSUE order), as in anatomy atlases:
// skin peach, organs rose, muscle red-brown, bone ivory, spinal cord and nerves yellow, ganglia
// pale gold, the enteric nervous system yellow-green, vessels red. Applied as a chromaticity
// substitution at equal luminance, so brightness and the safety limits are unchanged; travelling
// packets keep their network colours [model].
// Heart colours [model]: myocardium red, oxygenated vessels (coronary arteries, aorta, pulmonary
// veins) brighter red, venous ones (cardiac veins, venae cavae, pulmonary arteries) blue, the
// valves, leaflets and chordae ivory (the fibrous tissue).
const float TREE_GAIN[7] = float[7](${PARAMS.pulse.partGain.map(f).join(', ')});   // vascular tree flux per part (PULSE.md §13.6)
const vec3 HEART_MUSCLE = vec3(1.0, 0.46, 0.5), HEART_ART = vec3(1.0, 0.22, 0.2), HEART_VEIN = vec3(0.38, 0.55, 1.0), HEART_FIBROUS = vec3(1.0, 0.95, 0.85);
const vec3 HEART_FAT = vec3(1.0, 0.86, 0.52), HEART_SEROUS = vec3(0.82, 0.9, 1.0);   // epicardial fat pale yellow; the pericardium silvery
const vec3 AIRWAY_RGB = vec3(${PARAMS.breath.airwayRGB.map(f).join(', ')});   // bronchial cartilage, greyish ivory (LUNGS.md §7.1)
const float LUNG_GAIN[4] = float[4](${PARAMS.breath.roleGain.map(f).join(', ')});
// Heart close-up, depth cue and section (HEART.md §8; heart-form.js HEART_LOD, HEART_DEPTH, HEART_SECTION).
const vec3 HEART_C = ${vec3mm(HD.c)}, SEC_N = ${vec3u(HSEC.n)}, SEC_P = ${vec3mm(HSEC.p)};
const vec3 HF_W = ${vec3u(HF.w)}, HF_ANT = ${vec3u(HF.ant)}, HF_RIGHT = ${vec3u(HF.right)};
const vec3 HEART_ENV = vec3(${HD.envelope.map((r) => f(r * MM)).join(', ')});
float rampInt(float x) { return x <= 0.0 ? 0.0 : x < ${f(HL.fade)} ? x * x / ${f(2 * HL.fade)} : x - ${f(HL.fade / 2)}; }
const vec3 VALVE_C[4] = vec3[4](${HF.valves.map((v) => vec3mm(v.c)).join(', ')});
const vec3 VALVE_AX[4] = vec3[4](${HF.valveAxis.map(vec3u).join(', ')});
const float VALVE_R[4] = float[4](${HF.valves.map((v) => f(v.r * MM)).join(', ')});
const vec3 ANAT[9] = vec3[9](
  vec3(1.0, 0.84, 0.76), vec3(1.0, 0.56, 0.58), vec3(0.92, 0.46, 0.4), vec3(1.0, 0.96, 0.84),
  vec3(1.0, 0.9, 0.38), vec3(1.0, 0.88, 0.32), vec3(1.0, 0.84, 0.46), vec3(0.82, 0.95, 0.42),
  vec3(1.0, 0.36, 0.4));

// Breathing (research/LUNGS.md §3.5, §7.3): the diaphragm sheet (geometry.js diaphragmZ), the
// lung ellipsoids and apices, in units.
const vec3 DIA_B[3] = vec3[3](${DIAPHRAGM.bumps.map(vec3mm).join(', ')});
const float DIA_BASE = ${f(DIAPHRAGM.base * MM)}, DIA_R2 = ${f((DIAPHRAGM.radius * MM) ** 2)}, DIA_TOP = ${f(Math.max(...DIAPHRAGM.bumps.map((b) => b[2])) * MM)};
const vec3 LUNG_C[2] = vec3[2](${LUNGS.map((o) => vec3mm(o.c)).join(', ')});
const vec3 LUNG_R[2] = vec3[2](${LUNGS.map((o) => vec3mm(o.r.map((r) => r * 1.08))).join(', ')});
float diaphragmZ(vec2 q) {
  float z = DIA_BASE;
  for (int i = 0; i < 3; i++) {
    vec2 d = q - DIA_B[i].xy;
    float s = 1.0 - dot(d, d) / DIA_R2;
    if (s > 0.0) z = max(z, DIA_BASE + (DIA_B[i].z - DIA_BASE) * sqrt(s));
  }
  return z;
}
bool inLung(vec3 p) {
  int i = p.x >= 0.0 ? 0 : 1;
  vec3 q = (p - LUNG_C[i]) / LUNG_R[i];
  return dot(q, q) <= 1.0;
}
// Displacement of a trunk point at rest position p, for diaphragm excursion e and rib-cage expansion
// rb (units). kind: 1 lung (parenchyma, airways, pulmonary vessels), 2 diaphragm, 3 chest and
// abdominal wall (skin, muscle, bone), 4 other viscera (mediastinum above the sheet, abdomen below).
// strain is the craniocaudal stretch (+) or compression (−), for the energy-conserving flux.
vec3 breathField(vec3 p, int kind, float e, float rb, out float strain) {
  strain = 0.0;
  float zd = diaphragmZ(p.xy);
  float low = clamp((${f(PARAMS.breath.ribZ[0] * MM)} - p.z) / ${f(PARAMS.breath.ribZ[1] * MM)}, 0.0, 1.0);
  float wb = 0.3 + 0.7 * low, wp = 1.0 - 0.5 * low;   // bucket handle low, pump handle high (§3.4)
  vec3 rib = vec3(rb * wb * p.x / ${f(T.a * MM)}, rb * wp * clamp((p.y - ${f((T.cy - T.b) * MM)}) / ${f(2 * T.b * MM)}, 0.0, 1.0), 0.0);
  if (kind == 2) return vec3(0.0, 0.0, -e * clamp((zd - DIA_BASE) / (DIA_TOP - DIA_BASE), 0.0, 1.0));
  if (p.z > zd) {
    if (kind == 3) return rib;
    float za = p.x >= 0.0 ? ${f(PARAMS.breath.top[0] * MM)} : ${f(PARAMS.breath.top[1] * MM)};
    float span = max(za - zd, ${f(20 * MM)});
    float w = clamp((za - p.z) / span, 0.0, 1.0);
    float k = kind == 1 ? 1.0 : ${f(PARAMS.breath.mediastinum)};
    strain = k * ${f(PARAMS.breath.wz)} * e * pow(max(w, 1e-3), ${f(PARAMS.breath.wz - 1)}) / span;
    return vec3(kind == 1 ? rib.xy : vec2(0.0), -k * e * pow(w, ${f(PARAMS.breath.wz)}));
  }
  float zp = ${f(PARAMS.breath.abdomenZ * MM)};
  if (p.z < zp) return vec3(0.0);
  float fall = clamp((p.z - zp) / max(zd - zp, ${f(20 * MM)}), 0.0, 1.0);
  if (kind == 3) return vec3(0.0, p.y > ${f(T.cy * MM)} ? ${f(PARAMS.breath.belly)} * e * fall : 0.0, 0.0);
  strain = -${f(PARAMS.breath.abdomen)} * e / max(zd - zp, ${f(20 * MM)});
  return vec3(0.0, 0.0, -${f(PARAMS.breath.abdomen)} * e * fall);
}

// Path length (units) of the segment point → eye inside the torso envelope (§13.3).
float torsoPath(vec3 p) {
  vec3 d = uEye - p;
  float t0 = 0.0, t1 = 1.0;
  vec2 o = (p.xy - TORSO_C) / TORSO_R, k = d.xy / TORSO_R;
  float a = dot(k, k), b = dot(o, k), c = dot(o, o) - 1.0;
  if (a < 1e-10) {
    if (c > 0.0) return 0.0;
  } else {
    float disc = b * b - a * c;
    if (disc <= 0.0) return 0.0;
    float q = sqrt(disc);
    t0 = max(t0, (-b - q) / a);
    t1 = min(t1, (-b + q) / a);
  }
  if (abs(d.z) < 1e-8) {
    if (p.z < TORSO_Z0 || p.z > TORSO_Z1) return 0.0;
  } else {
    float za = (TORSO_Z0 - p.z) / d.z, zb = (TORSO_Z1 - p.z) / d.z;
    t0 = max(t0, min(za, zb));
    t1 = min(t1, max(za, zb));
  }
  return max(0.0, t1 - t0) * length(d);
}

void main() {
  float lod = aNet.y;
  bool regionStar = lod > ${f(FOCUS_LOD - 0.5)};   // close-up stars of the focus region (CLOSEUP.md §3)
  if (regionStar) { lod -= ${f(FOCUS_LOD)}; if (uFocus[1].x < 1.001 || uFocus[1].y <= 0.0) { ${CULL} } }
  if ((lod > 1.5 && uPxMm < ${f(PARAMS.lodPxMm[0])}) || (lod > 2.5 && uPxMm < ${f(PARAMS.lodPxMm[1])})) { ${CULL} }
  if (lod > ${f(HL.lod - 0.5)} && lod < ${f(HL.lod + 0.5)} && uPulse.w < 1.001) { ${CULL} }   // heart close-up stars (HEART.md §8.1)
  if (lod > ${f(HL.sectionLod - 0.5)} && uHeartV.w <= 0.0) { ${CULL} }   // the cut face: only while the heart is open (§8.4)
  int cls = clamp(int(aNode.w + 0.5), 0, 8);
  float heartPart = cls == ${TISSUE.ORGAN} ? aNrm.y : 0.0;
  float vPart = cls == ${TISSUE.VESSEL} ? aNrm.y : 0.0;   // vessel part code (vessel-tree.js VPART)
  bool tree = vPart > 0.5 && vPart < ${f(VP.PULM_VEIN + 0.5)};   // the tree (1–7); 8–9 the earlier great vessels
  // A random share per class; the heart and the vascular tree have their own, and the tree replaces
  // the earlier great-vessel stars (PULSE.md §9).
  float keep = heartPart > 0.5 ? uKeep[2].y : uKeep[cls / 4][cls % 4];
  if (tree) keep = uKeep[2].w; else if (vPart > 0.5) keep *= 1.0 - uKeep[2].w;
  if (fract(aNrm.w * 113.7 + 0.37) >= keep) { ${CULL} }
  if (heartPart > ${f(HP.TRABECULA - 0.5)} && uStyle.x < 0.5) { ${CULL} }   // Stars keeps the earlier heart (HEART.md §8.5)
  int node = int(floor(aNode.x + 0.5));
  int path = int(floor(aNode.y + 0.5));
  vec3 p = aPos.xyz;
  vec3 n = aNrm.xyz;

  // Organ geometry (§13.7): 1 uniform scale about a centre (lungs, bladder), 2 shift along z
  // (diaphragm), 3 iris ring remap in the x–z plane (inner radius = pupil diameter / 2).
  if (node >= 0) {
    for (int k = 0; k < ${ORGAN_SLOTS}; k++) {
      vec4 OA = uOrgan[2 * k], OB = uOrgan[2 * k + 1];
      if (OB.x < 0.5 || node != int(OA.x + 0.5)) continue;
      vec3 c = OA.yzw;
      if (OB.x < 1.5) p = c + (p - c) * OB.y;
      else if (OB.x < 2.5) p.z += OB.y;
      else {
        vec2 q = p.xz - c.xz;
        float r0 = length(q);
        if (r0 > 1e-6) p.xz = c.xz + q * ((OB.z + (r0 - OB.y) * (OB.w - OB.z) / max(1e-6, OB.w - OB.y)) / r0);
      }
    }
  }
  // Heart (HEART.md §5): the beat moves the chambers (atria, then the ventricles with the base
  // descending towards the apex) and runs the activation wave through each star at its time τ.
  float heartGlow = 1.0, heartSize = 1.0;
  if (heartPart > 0.5) {
    int hp = int(heartPart + 0.5);
    if (uHeartK.x > 0.5) {
      float m = uHeartK.z;
      // Leaflets swing about their ring from closed (in the ring plane) to open (along the valve's
      // axis): the atrioventricular valves in diastole, the semilunar ones during ejection.
      if (hp == ${HP.LEAFLET}) {
        int vi = clamp(int(-aNrm.x - 1.5), 0, 3);
        vec3 vc = VALVE_C[vi], ax = VALVE_AX[vi];
        float R = VALVE_R[vi], th = (vi < 2 ? uHeartV.x : uHeartV.y) * m * ${f(PARAMS.heart.leafletOpen)};
        vec3 q = p - vc;
        float h = dot(q, ax);
        vec3 rad = q - ax * h;
        float rl = length(rad);
        vec3 rd = rl > 1e-6 ? rad / rl : vec3(0.0);
        float L = max(0.0, R - rl);
        p = vc + rd * (R - L * cos(th)) + ax * (L * sin(th) + h * cos(th));
      }
      bool atrialFine = hp == ${HP.PECTINATE} || hp == ${HP.ATRIAL_FIBROUS};
      if (hp == ${HP.RA} || hp == ${HP.LA} || hp == ${HP.SA} || hp == ${HP.ATRIAL_PATH} || atrialFine) {
        vec3 c = hp == ${HP.LA} ? ${vec3mm(HF.la.c)} : ${vec3mm(HF.ra.c)};
        if (atrialFine && distance(p, ${vec3mm(HF.la.c)}) < distance(p, ${vec3mm(HF.ra.c)})) c = ${vec3mm(HF.la.c)};
        p = c + (p - c) * (1.0 - ${f(PARAMS.heart.atrialIn)} * uHeartM.x * m);
      } else if (hp != ${HP.AV} && hp != ${HP.PERICARDIUM}) {
        vec3 q = p - ${vec3mm(HF.base)};
        float s = dot(q, ${`vec3(${f(HF.w[0])}, ${f(HF.w[1])}, ${f(HF.w[2])})`});
        vec3 rr = q - s * ${`vec3(${f(HF.w[0])}, ${f(HF.w[1])}, ${f(HF.w[2])})`};
        float c = uHeartM.y * m;
        float inward = (hp == ${HP.VALVE} || hp == ${HP.ROOT} || hp == ${HP.LEAFLET}) ? 0.0 : ${f(PARAMS.heart.wallIn)} * c;
        p = ${vec3mm(HF.base)} + ${`vec3(${f(HF.w[0])}, ${f(HF.w[1])}, ${f(HF.w[2])})`} * (s + ${f(PARAMS.heart.descentMm * MM)} * c * aNrm.z) + rr * (1.0 - inward);
      }
      float tau = aNrm.x;
      if (tau >= 0.0) {
        float tA = tau < 1.0 ? tau * uHeartT.w
          : tau < 2.0 ? uHeartT.w + (tau - 1.0) * max(0.0, uHeartT.y - 0.03 - uHeartT.w)
          : uHeartT.y - 0.03 + (tau - 2.0) * (uHeartT.z + 0.03);
        bool cond = hp == ${HP.SA} || hp == ${HP.ATRIAL_PATH} || hp == ${HP.AV} || hp == ${HP.HIS} || hp == ${HP.PURKINJE};
        float d = (uHeartT.x - tA) / (cond ? ${f(PARAMS.heart.sigma[0])} : ${f(PARAMS.heart.sigma[1])});
        heartGlow += (cond ? ${f(PARAMS.heart.glow[0])} : ${f(PARAMS.heart.glow[1])}) * exp(-d * d);
      }
      heartGlow = max(0.0, heartGlow - uHeartM.w);   // energy-conserving: the heart's mean wave gain is taken back
      if (hp == ${HP.ROOT}) heartGlow *= 1.0 + 0.12 * uHeartM.z;
      if (hp == ${HP.CORONARY_A}) heartGlow *= 1.0 + ${f(PARAMS.heart.coronaryFlow)} * uHeartV.z;   // coronary flow is diastolic
    } else heartGlow = uHeartK.y;
    heartGlow *= mix(1.0, ${f(PARAMS.heart.focusGain)}, uHeartK.w);   // the heart's focus (Heart view, or close to it) lifts the heart
    heartGlow *= uKeep[2].z;
    // Section (HEART.md §8.4): the half towards the camera goes, the plane sweeping in from outside
    // the heart to the four-chamber plane; the cut face is lifted, so the walls read in section.
    float sec = uHeartV.w;
    float sd = (dot(uEye - SEC_P, SEC_N) >= 0.0 ? 1.0 : -1.0) * dot(p - SEC_P, SEC_N);   // mm-units towards the camera's side of the plane
    if (sec > 0.0) {
      float open = ${f(HSEC.open * MM)} * (1.0 - smoothstep(0.0, 1.0, sec));
      if (sd > open) { ${CULL} }
      bool wall = hp == ${HP.RA} || hp == ${HP.LA} || hp == ${HP.RV} || hp == ${HP.LV} || hp == ${HP.TRABECULA} || hp == ${HP.PECTINATE} || hp == ${HP.ROOT};
      if (wall && sd > open - ${f(HSEC.rim * MM)}) heartGlow *= mix(1.0, ${f(HSEC.rimGain)}, sec);
      if (hp >= ${HP.SA} && hp <= ${HP.PURKINJE}) heartGlow *= mix(1.0, ${f(PARAMS.heart.openConduction)}, sec);   // the walls lead in section
      if (lod > ${f(HL.sectionLod - 0.5)}) heartGlow *= ${f(HSEC.faceGain)} * smoothstep(0.0, 1.0, sec);   // the cut face fades in as the plane arrives
    }
    // Depth cue (Detailed, §8.3): beyond t0 along the line of sight from the heart's centre the stars
    // dim; the inner parts (valves, leaflets, chordae, conduction system, fibrous tissue) dim less.
    // Opened, the depth is taken behind the cut face, and the cue is steeper, so the chambers read
    // as hollows bounded by their walls in section.
    bool inner = hp == ${HP.VALVE} || (hp >= ${HP.SA} && hp <= ${HP.PURKINJE}) || hp == ${HP.LEAFLET} || hp == ${HP.CHORDAE} || hp == ${HP.ATRIAL_FIBROUS};
    float tH = mix(dot(p - HEART_C, normalize(HEART_C - uEye)) - ${f(HD.t0 * MM)}, -sd, sec);
    float lamH = inner ? mix(${f(HD.lambda[1] * MM)}, ${f(HD.lambdaOpen[1] * MM)}, sec) : mix(${f(HD.lambda[0] * MM)}, ${f(HD.lambdaOpen[0] * MM)}, sec);
    heartGlow *= mix(1.0, ${f(HD.gain)} * exp(-max(0.0, tH) / lamH), uStyle.x);
    if (hp == ${HP.PERICARDIUM}) {   // a faint sac, brightest edge-on, so it outlines the heart and never veils it
      vec3 q = p - HEART_C, e = HEART_ENV * HEART_ENV;
      vec3 nE = normalize(HF_W * (dot(q, HF_W) / e.x) + HF_ANT * (dot(q, HF_ANT) / e.y) + HF_RIGHT * (dot(q, HF_RIGHT) / e.z));
      float nv = 1.0 - abs(dot(nE, normalize(uEye - p)));
      heartGlow *= mix(0.12, 1.0, nv * nv);
    }
    // Close-up density (§8.1): the wanted density grows as (q/q0)² with q this star's own px/mm;
    // close-up stars of rank below the filled share fade in, every heart star gives back the drawn
    // density, and past D_max the stars grow a little so the surface stays continuous.
    float dmax = max(1.0, uPulse.w);
    if (dmax > 1.0001) {
      float q = uPxMm * uDist / max(1e-4, -(uView * vec4(p, 1.0)).z);
      float want = max(1.0, (q / ${f(HL.q0)}) * (q / ${f(HL.q0)}));
      float F = (min(want, dmax) - 1.0) / (dmax - 1.0) * ${f(1 + HL.fade)};
      if (lod < ${f(HL.sectionLod - 0.5)}) heartGlow /= 1.0 + (dmax - 1.0) * (rampInt(F) - rampInt(F - 1.0));
      if (lod > ${f(HL.lod - 0.5)} && lod < ${f(HL.lod + 0.5)}) {
        float wc = clamp((F - fract(aNrm.w * ${f(HL.rankMul)} + ${f(HL.rankAdd)})) / ${f(HL.fade)}, 0.0, 1.0);
        if (wc <= 0.0) { ${CULL} }
        heartGlow *= wc;
      }
      heartSize = min(${f(HL.sizeMax)}, pow(max(1.0, want / dmax), ${f(HL.grow)}));
    }
  } else if (uHeartK.w > 0.0) {
    heartGlow = mix(1.0, (cls == ${TISSUE.NERVE} || cls == ${TISSUE.GANGLION} || cls == ${TISSUE.CORD}) ? ${f(PARAMS.heart.focusDim[1])} : ${f(PARAMS.heart.focusDim[0])}, uHeartK.w);
  }
  // Arterial pulse (PULSE.md §8): each artery star brightens as the wave front passes, at its delay
  // from the aortic valve opening; every pulsing star gives back the mean, so the vessels' light is
  // constant through the beat. Veins and the capillary haze carry no pulse.
  float pulseGlow = 1.0;
  if (vPart > 0.5) {
    if (aNrm.x >= 0.0 && uPulse.y > 0.0) {
      float d = (uPulse.x - aNrm.x - ${f(PARAMS.pulse.x0)}) / ${f(PARAMS.pulse.sigma)};
      if (abs(d) < ${f(PARAMS.pulse.cut)}) pulseGlow += uPulse.y * ${f(PARAMS.pulse.gain)} * aNrm.z * exp(-d * d);
      pulseGlow = max(0.0, pulseGlow - uPulse.z);
    }
    if (tree) pulseGlow *= TREE_GAIN[int(vPart + 0.5) - 1];
  }

  // Focus region (CLOSEUP.md §3): round the camera's pivot every body class but the heart has
  // close-up stars; as for the heart (HEART.md §8.1) they fade in by rank as the wanted density
  // (q/q0)² rises, every star there gives back the expected drawn density, and the region's edge is soft.
  float focusGlow = 1.0, focusSize = 1.0;
  if (uFocus[1].x > 1.001 && heartPart < 0.5) {
    float wr = (1.0 - smoothstep(${f(PARAMS.focus.edge)} * uFocus[0].w, uFocus[0].w, distance(p, uFocus[0].xyz))) * uFocus[1].y;
    if (wr > 0.0) {
      float dm = uFocus[1].x, q = uPxMm * uDist / max(1e-4, -(uView * vec4(p, 1.0)).z);
      float want = max(1.0, (q / ${f(PARAMS.focus.q0)}) * (q / ${f(PARAMS.focus.q0)})), dEff = 1.0 + (dm - 1.0) * wr;
      float F = (min(want, dEff) - 1.0) / (dm - 1.0) * ${f(1 + HL.fade)};
      focusGlow = pow(1.0 + (dm - 1.0) * (rampInt(F) - rampInt(F - 1.0)), ${f(-PARAMS.focus.conserve)});
      if (regionStar) {
        float wc = clamp((F - fract(aNrm.w * ${f(HL.rankMul)} + ${f(HL.rankAdd)})) / ${f(HL.fade)}, 0.0, 1.0);
        if (wc <= 0.0) { ${CULL} }
        focusGlow *= wc;
      }
      focusSize = mix(1.0, min(${f(PARAMS.focus.sizeMax)}, pow(max(1.0, want / dEff), ${f(PARAMS.focus.grow)})), wr);
    } else if (regionStar) { ${CULL} }
  }

  // Breathing (research/LUNGS.md §3.5, §7.3): trunk stars (no rigid segment) move with the diaphragm
  // and the rib cage; each star's flux follows its craniocaudal stretch, so a region's light stays
  // constant as its stars spread and gather. Reduced motion holds the mean (§13.15).
  int seg = int(floor(aNet.w + 0.5));
  int lungRole = (cls == ${TISSUE.ORGAN} || cls == ${TISSUE.MUSCLE}) && aNrm.y < -1.5 ? int(-aNrm.y + 0.5) : 0;
  bool lungStar = lungRole >= ${LUNG_ROLE.AIRWAY} && lungRole <= ${LUNG_ROLE.PARENCHYMA};
  bool pulmTree = tree && inLung(aPos.xyz);
  bool pulmBed = pulmTree && vPart > ${f(VP.CAPILLARY - 0.5)} && vPart < ${f(VP.CAPILLARY + 0.5)};
  float breathGlow = lungStar ? LUNG_GAIN[lungRole - ${LUNG_ROLE.AIRWAY}] : 1.0;
  if (seg < 0 && (uBreath.x > 0.0 || uBreath.y > 0.0)) {
    int kind = lungStar || pulmTree ? 1 : lungRole == ${LUNG_ROLE.DIAPHRAGM} ? 2
      : (cls == ${TISSUE.SKIN} || cls == ${TISSUE.MUSCLE} || cls == ${TISSUE.BONE}) ? 3
      : (cls == ${TISSUE.ORGAN} || cls == ${TISSUE.VESSEL} || cls == ${TISSUE.ENTERIC}) ? 4 : 0;
    if (kind > 0) {
      float strain;
      p += breathField(aPos.xyz, kind, uBreath.x, uBreath.y, strain);
      breathGlow /= max(0.5, 1.0 + strain);
    }
  }
  // Airflow front (LUNGS.md §7.4): airway and acinus stars brighten as the interface between inspired
  // and alveolar gas passes their volume coordinate; every one gives back the mean, so the airways'
  // light is constant through the breath.
  // The bright band runs with a dim trail 1.5 σ behind it, so any stretch of airway longer than the
  // band keeps its light (local energy conservation; breath.js frontBand).
  if (abs(uAir.w) > 0.5 && (lungRole == ${LUNG_ROLE.AIRWAY} || lungRole == ${LUNG_ROLE.ACINUS})) {
    float sg = max(${f(BREATH.front.sigmaMin)}, ${f(BREATH.front.sigmaRel)} * max(aNrm.x, uAir.x));
    float d = (aNrm.x - uAir.x) / sg, dt = (aNrm.x - uAir.x + uAir.w * ${f(BREATH.front.trail)} * sg) / sg;
    breathGlow *= max(0.0, 1.0 + uAir.y * (exp(-d * d) - exp(-dt * dt)) - uAir.z);
  }
  // Lungs view: the lungs, their vessels and the diaphragm lifted, everything else dimmed (as the
  // Heart view, HEART.md §5).
  if (uBreath.z > 0.0) {
    bool own = lungRole > 0 || (pulmTree && !pulmBed);
    breathGlow *= pulmBed ? mix(1.0, ${f(PARAMS.breath.capillaryFocus)}, uBreath.z) : own ? mix(1.0, ${f(PARAMS.breath.focusGain)}, uBreath.z)
      : mix(1.0, (cls == ${TISSUE.NERVE} || cls == ${TISSUE.GANGLION} || cls == ${TISSUE.CORD}) ? ${f(PARAMS.breath.focusDim[1])} : ${f(PARAMS.breath.focusDim[0])}, uBreath.z);
  }

  // Rigid limb segments (§13.9): quaternion and translation; trunk and pelvis never move.
  if (uMotion > 0.5 && seg >= 0 && seg < ${JOINT_SLOTS}) {
    vec4 q = uJoint[2 * seg];
    p = qrot(q, p) + uJoint[2 * seg + 1].xyz;
    n = qrot(q, n);
  }

  vec4 N = vec4(1.0, 1.0, 0.0, 0.0);
  if (node >= 0 && node < uNodeCap) N = texelFetch(uBodyState, ivec2(node % ${BODY_TEX_W}, node / ${BODY_TEX_W}), 0);
  vec4 E = vec4(0.0, 0.0, 1.0, -1.0);
  if (path >= 0 && path < uPathCap) E = texelFetch(uEdgeAct, ivec2(path % ${EDGE_TEX_W}, path / ${EDGE_TEX_W}), 0);

  // Network ghosting: the lowest set bit picks the tint; every set bit's switch gates the point.
  uint bits = uint(aNet.x + 0.5);
  float g = 1.0;
  int net = -1;
  for (int i = 0; i < 8; i++) {
    if (((bits >> uint(i)) & 1u) == 0u) continue;
    if (net < 0) net = i;
    g = min(g, uNetGain[i / 4][i % 4]);
  }
  g = min(g, min(N.y, E.z));
  float sat = clamp((g - GHOST) / (1.0 - GHOST), 0.0, 1.0);
  vec3 tintRGB = net >= 0 ? uNetRGB[net] : uStructRGB;
  vec3 base = net >= 0 ? mix(uStructRGB, tintRGB, ${f(PARAMS.restingNetMix)}) : uStructRGB;
  if (uStyle.x > 0.0) {
    // The heart's conduction system (SA node to Purkinje) takes the nerve colour: the signal's path.
    vec3 a = ANAT[cls];
    if (heartPart > 0.5) {
      int hc = int(heartPart + 0.5);
      a = (hc >= ${HP.SA} && hc <= ${HP.PURKINJE}) ? ANAT[${TISSUE.NERVE}]
        : (hc == ${HP.CORONARY_A} || (hc == ${HP.ROOT} && aNrm.x > -1.5)) ? HEART_ART
        : (hc == ${HP.CORONARY_V} || hc == ${HP.ROOT}) ? HEART_VEIN
        : (hc == ${HP.VALVE} || hc == ${HP.LEAFLET} || hc == ${HP.CHORDAE} || hc == ${HP.ATRIAL_FIBROUS}) ? HEART_FIBROUS
        : hc == ${HP.FAT} ? HEART_FAT : hc == ${HP.PERICARDIUM} ? HEART_SEROUS : HEART_MUSCLE;
    }
    // Arteries and pulmonary veins oxygenated red, veins and pulmonary arteries blue, capillaries from
    // blue to red by their oxygen saturation, 60–98 % (PULSE.md §13.6).
    if (lungRole == ${LUNG_ROLE.AIRWAY}) a = AIRWAY_RGB;
    else if (lungRole == ${LUNG_ROLE.PLEURA}) a = HEART_SEROUS;
    if (tree) a = vPart < 2.5 || vPart > ${f(VP.PULM_VEIN - 0.5)} ? HEART_ART
      : vPart > ${f(VP.CAPILLARY - 0.5)} && vPart < ${f(VP.CAPILLARY + 0.5)} ? mix(HEART_VEIN, HEART_ART, clamp((aNrm.z - 0.6) / 0.38, 0.0, 1.0)) : HEART_VEIN;
    base = mix(base, a * (dot(base, LUMA) / max(1e-4, dot(a, LUMA))), uStyle.x);
  }

  float flux = aPos.w * uClassNorm[cls / 4][cls % 4];
  float size = clamp(uPx * uStyle.y * heartSize * focusSize * (${f(PARAMS.size[0])} + ${f(PARAMS.size[1])} * log2(1.0 + flux)), ${f(PARAMS.size[2])} * uStyle.y, uMaxPt);
  flux *= uClassGain[cls / 4][cls % 4] * g * N.x * (1.0 + N.z) * uFade * heartGlow * pulseGlow * focusGlow * breathGlow;

  // Head skin and sense organs fade out at brain-view distances (§13.2).
  float head = smoothstep(${f(PARAMS.headZ[0] * MM)}, ${f(PARAMS.headZ[1] * MM)}, p.z);
  float headF = ${f(HS.gain)} * smoothstep(${f(HS.d0)}, ${f(HS.d1)}, uDist);
  if (cls == ${TISSUE.SKIN}) flux *= mix(1.0, headF, head);
  else if (cls == ${TISSUE.ORGAN}) flux *= mix(1.0, mix(headF, 1.0, uSenseFull), head);
  else if (tree) flux *= mix(1.0, mix(smoothstep(${f(HS.d0)}, ${f(HS.d1)}, uDist), 1.0, uSenseFull), head);   // head vessels leave the brain view clear

  vec3 v = normalize(uEye - p);
  if (cls == ${TISSUE.SKIN} && dot(n, n) > 0.25) {   // only skin stars carry a normal (heart stars carry τ, part, axial)
    float nv = dot(normalize(n), v);
    flux *= mix(${f(PARAMS.faceBack)}, 1.0, smoothstep(${f(PARAMS.faceEdge[0])}, ${f(PARAMS.faceEdge[1])}, nv))
      * (${f(PARAMS.faceSqrt[0])} + ${f(PARAMS.faceSqrt[1])} * sqrt(abs(nv)));
  }
  flux *= exp(-torsoPath(p) / ${f(PARAMS.lambdaBody * MM)});
  if (cls == ${TISSUE.SKIN}) {
    float hand = (1.0 - smoothstep(${f(PARAMS.hand.z[0] * MM)}, ${f(PARAMS.hand.z[1] * MM)}, p.z)) * smoothstep(${f(PARAMS.hand.x[0] * MM)}, ${f(PARAMS.hand.x[1] * MM)}, abs(p.x));
    float foot = 1.0 - smoothstep(${f(PARAMS.foot.z[0] * MM)}, ${f(PARAMS.foot.z[1] * MM)}, p.z);
    flux *= 1.0 - uSkinDim * max(hand, foot);
  }

  // Stream shimmer from low-passed edge activity, and travelling packets (§13.8).
  float shim = 1.0;
  vec3 pk = vec3(0.0);
  if (path >= 0) {
    float hz = ${f(PARAMS.twinkleHz[0])} + ${f(PARAMS.twinkleHz[1] - PARAMS.twinkleHz[0])} * fract(aNrm.w * 7.31);
    shim = (1.0 + ${f(PARAMS.shimmer)} * E.x) * (1.0 + uTwinkle * smoothstep(0.0, 0.2, E.x) * sin(uT * 6.28318 * hz + aNrm.w * 50.0));
    if (E.w >= 0.0) {
      int run = int(E.w + 0.5);
      int first = run / 16, cnt = min(run - first * 16, 8);
      for (int k = 0; k < 8; k++) {
        if (k >= cnt) break;
        vec4 P0 = texelFetch(uPackets, ivec2(first + k, 0), 0);
        vec4 P1 = texelFetch(uPackets, ivec2(first + k, 1), 0);
        float d = (aNode.z - P0.y) / P0.z;
        if (abs(d) > ${f(PARAMS.packetCut)}) continue;
        vec3 pc = P1.y < 0.0 ? uAffRGB : tintRGB;
        if (P1.w > 0.5 || E.y > 0.5) pc = vec3(dot(pc, LUMA));
        pk += pc * (P0.w * exp(-0.5 * d * d));
      }
    }
  }
  vec3 col = flux * (mix(vec3(dot(base, LUMA)), base, sat) * shim + pk * sat);

  vec4 vp = uView * vec4(p, 1.0);
  // With the heart in focus, body stars just in front of the camera thin out (HEART.md §8.3).
  if (heartPart < 0.5 && uHeartK.w > 0.0) col *= mix(1.0, smoothstep(${f(PARAMS.heart.near[0] * MM)}, ${f(PARAMS.heart.near[1] * MM)}, -vp.z), uHeartK.w);
  // Focus slab (Detailed, CLOSEUP.md §4): close to the pivot, the body in front of it thins out and
  // what lies behind it dims, so the structures at the pivot read on their own.
  float slab = uFocus[1].z * uStyle.x;
  if (slab > 0.0 && heartPart < 0.5) {
    float dz = -vp.z;
    float keepF = smoothstep(${f(PARAMS.focus.front[0])} * uDist, ${f(PARAMS.focus.front[1])} * uDist, dz) * exp(-max(0.0, dz - ${f(PARAMS.focus.back)} * uDist) / (${f(PARAMS.focus.lambda)} * uDist));
    col *= mix(1.0, keepF, slab);
  }
  if (vp.z > -0.01 || dot(col, col) < 1e-12) { ${CULL} }
  gl_Position = uProj * vp;
  gl_PointSize = size;
  vColor = col;
  vPeak = uGain * uZoom * 16.0 / (size * size);
}
`;

// --- Lanterns: soft glows of released dopamine in each terminal field ---
export const LANTERN_VS = HEADER + COMMON + `
layout(location = 0) in vec4 aPos;    // xyz, radius (world units)
layout(location = 1) in vec4 aA;      // seed, distance from the field centre (0..1)
layout(location = 2) in vec4 aMeta;   // region
uniform float uGain;
out vec3 vColor;
out float vPeak;
void main() {
  vec3 p = aPos.xyz;
  if (p.x < uCut) { ${CULL} }
  int r = int(aMeta.x + 0.5);
  vec4 R = regionState(r, sideOf(p));
  // A lantern lights once the spreading front reaches it and grows a little with the spread.
  float lit = 1.0 - smoothstep(R.z - 0.12, R.z + 0.12, aA.y);
  float L = tissuePath(p);
  float e = R.y * lit * exp(-L / (uLambda * 2.0));
  vec4 vp = uView * vec4(p, 1.0);
  if (vp.z > -0.01 || e < 1e-4) { ${CULL} }
  gl_Position = uProj * vp;
  // Light seen through more tissue scatters into a wider halo.
  float radius = aPos.w * (0.75 + 0.45 * R.z) * (1.0 + 0.6 * L / uLambda);
  float size = clamp(2.0 * radius * uPxScale / -vp.z, 3.0 * uPx, uMaxPt);
  gl_PointSize = size;
  vColor = uAmber * e;
  // Energy ∝ e, spread over the sprite area (pixels²), referenced to 1080p.
  vPeak = uGain * 900.0 * (uPx * uPx) / (size * size) * (0.8 + 0.4 * fract(aA.x * 3.7));
}
`;

// Two-Gaussian lantern profile: a soft core and a wide halo carrying ~15 % of the light.
export const LANTERN_FS = HEADER + `
in vec3 vColor;
in float vPeak;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  float g = 0.85 * exp(-r2 * 28.0) + 0.15 * exp(-r2 * 7.0);
  float win = clamp(1.0 - r2 * 4.0, 0.0, 1.0);
  outColor = vec4(vColor * vPeak * g * win, 1.0);
}
`;

export const FULLSCREEN_VS = HEADER + `
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Near-black, very slightly blue-grey background (pure black makes the stars look pasted on).
export const BG_FS = HEADER + `
in vec2 vUv;
uniform float uAspect;
out vec4 outColor;
void main() {
  vec2 q = (vUv - vec2(0.5, 0.52)) * vec2(uAspect, 1.0);
  float g = exp(-dot(q, q) * 2.2);
  outColor = vec4(vec3(0.0016, 0.0019, 0.0028) + vec3(0.0018, 0.0021, 0.0032) * g, 1.0);
}
`;

export const DOWN_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec3 s = texture(uSrc, vUv).rgb * 4.0;
  s += texture(uSrc, vUv - uTexel).rgb;
  s += texture(uSrc, vUv + uTexel).rgb;
  s += texture(uSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  s += texture(uSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  outColor = vec4(s / 8.0, 1.0);
}
`;

export const UP_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uWeight;
out vec4 outColor;
void main() {
  vec2 h = uTexel;
  vec3 s = texture(uSrc, vUv + vec2(-2.0 * h.x, 0.0)).rgb;
  s += texture(uSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, 2.0 * h.y)).rgb;
  s += texture(uSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(2.0 * h.x, 0.0)).rgb;
  s += texture(uSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, -2.0 * h.y)).rgb;
  s += texture(uSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  outColor = vec4(s / 12.0 * uWeight, 1.0);
}
`;

// ACES tonemapping. Dim light loses saturation as in mesopic vision, so faint amber halos read as
// warm light rather than neon; bright cores roll off toward pale warm white. uPrev/uMix cross-fade
// a camera cut under reduced motion (§13.11): uMix = 1 shows only the current frame.
export const COMPOSITE_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uPrev;
uniform float uMix;
uniform float uExposure;
uniform float uBloomStr;
uniform float uTime;
out vec4 outColor;
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStr;
  if (uMix < 1.0) c = mix(texture(uPrev, vUv).rgb, c, uMix);
  c *= uExposure;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.35 + 0.65 * smoothstep(0.004, 0.12, l));
  c = aces(c);
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.45 * dot(q, q);
  c = pow(c, vec3(1.0 / 2.2));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  outColor = vec4(c, 1.0);
}
`;

// Worst-case uniform storage of a GLSL source in vec4 slots: one slot per scalar or vector,
// one per column of a matrix, × array length; samplers are counted separately (texture units).
export function uniformSlots(source) {
  const src = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?\s*;/g;
  const cols = { mat2: 2, mat3: 3, mat4: 4, mat2x2: 2, mat3x3: 3, mat4x4: 4, mat2x3: 2, mat2x4: 2, mat3x2: 3, mat3x4: 3, mat4x2: 4, mat4x3: 4 };
  let slots = 0, samplers = 0;
  const names = [];
  for (const m of src.matchAll(re)) {
    const [, type, name, len] = m;
    const n = len ? Number(len) : 1;
    names.push(name);
    if (/sampler/.test(type)) { samplers += n; continue; }
    slots += (cols[type] || 1) * n;
  }
  return { slots, samplers, names };
}
