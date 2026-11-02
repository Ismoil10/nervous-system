// GLSL ES 3.00 shaders for the star brain and the star body. Per-region state arrives in the uState
// data texture (statetex.js; research/ANALYSIS.md §11.15, B.7) indexed by the region id stored in
// every point and the side of the point; per-node, per-path and per-packet body state arrives in
// three further textures. The dopamine model (dopamine.js) still fills the region channels.

import { MM, PATHWAYS } from './anatomy.js';
import { BODY_TEX_W, EDGE_TEX_W } from './statetex.js';

export const PATH_HIST = 16;   // samples of firing-rate history per pathway (axon impulse packets)
export const PATH_COUNT = PATHWAYS.length;

// Tissue classes of the body vertex record (a2.w) and display network bits (a3.x), B.7.
export const TISSUE = { SKIN: 0, ORGAN: 1, MUSCLE: 2, BONE: 3, CORD: 4, NERVE: 5, GANGLION: 6, ENTERIC: 7, VESSEL: 8 };
export const TISSUE_NAMES = ['skin', 'organ', 'muscle', 'bone', 'cord', 'nerve', 'ganglion', 'enteric', 'vessel'];
export const NET_BIT = { somAff: 0, somEff: 1, symp: 2, para: 3, visAff: 4, enteric: 5, endocrine: 6, immune: 7 };
export const BODY_FLOATS = 16;   // a0 pos.xyz (units), flux · a1 normal.xyz, seed · a2 node, path, u, class · a3 nets, LOD, side, segment
export const ORGAN_SLOTS = 8;    // uOrgan[16]: 8 × (node, centre) + (mode, p1, p2, p3)
export const JOINT_SLOTS = 20;   // uJoint[40]: 20 rigid segments × (quaternion, translation), B.7

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
  shimmer: 0.6,                        // §13.8 stream flux × (1 + 0.6·ā)
  twinkleHz: [0.2, 2.0],               // §13.8 per-star twinkle ±10 % at 0.2–2 Hz, desynchronised
  packetCut: 3,                        // [model] Gaussian packet profile truncated at ±3σ
  lodPxMm: [0.8, 2.0],                 // §13.4 LOD 2 at ≥ 0.8 px/mm, ENS close-up (LOD 3) at ≥ 2.0 px/mm (1,080-px reference)
  hand: { z: [-830, -790], x: [175, 195] },   // [model] distal skin for vasoconstriction: hands below the wrist (z −818, §2.6), lateral to the thighs
  foot: { z: [-1620, -1580] },         // [model] feet below the ankle (z −1,603, §2.6)
  size: [2.0, 1.0, 1.5],               // [model] point size uPx·(a + b·log2(1 + flux)), minimum
};

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

// --- Neurons: cool-white stars ---
export const NEURON_VS = HEADER + COMMON + `
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
export const DA_VS = HEADER + COMMON + `
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
  col *= att;
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
layout(location = 1) in vec4 aNrm;    // skin normal (0 for volumes), seed
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
  if ((lod > 1.5 && uPxMm < ${f(PARAMS.lodPxMm[0])}) || (lod > 2.5 && uPxMm < ${f(PARAMS.lodPxMm[1])})) { ${CULL} }
  int cls = clamp(int(aNode.w + 0.5), 0, 8);
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
  // Rigid limb segments (§13.9): quaternion and translation; trunk and pelvis never move.
  int seg = int(floor(aNet.w + 0.5));
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

  float flux = aPos.w * uClassNorm[cls / 4][cls % 4];
  float size = clamp(uPx * (${f(PARAMS.size[0])} + ${f(PARAMS.size[1])} * log2(1.0 + flux)), ${f(PARAMS.size[2])}, uMaxPt);
  flux *= uClassGain[cls / 4][cls % 4] * g * N.x * (1.0 + N.z) * uFade;

  // Head skin and sense organs fade out at brain-view distances (§13.2).
  float head = smoothstep(${f(PARAMS.headZ[0] * MM)}, ${f(PARAMS.headZ[1] * MM)}, p.z);
  float headF = ${f(HS.gain)} * smoothstep(${f(HS.d0)}, ${f(HS.d1)}, uDist);
  if (cls == ${TISSUE.SKIN}) flux *= mix(1.0, headF, head);
  else if (cls == ${TISSUE.ORGAN}) flux *= mix(1.0, mix(headF, 1.0, uSenseFull), head);

  vec3 v = normalize(uEye - p);
  if (dot(n, n) > 0.25) {
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
