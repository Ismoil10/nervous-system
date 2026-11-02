// GLSL ES 3.00 shaders. The orbital formulas match galaxy-model.js;
// the constants are injected from that file.

import { MODEL, SPIRAL_K, SPIRAL_ECC, CREST } from './galaxy-model.js';

const f = (x) => Number(x).toFixed(5);

const HEADER = `#version 300 es
precision highp float;
`;

const ATTRS = `
layout(location = 0) in vec4 aOrbit;
layout(location = 1) in vec4 aColor;
layout(location = 2) in vec4 aMeta;
`;

// Histories are packed into vec4 uniform arrays (four samples per vector).
export const RING_HIST_N = 128;
export const RING_HIST_DT = 0.075;   // model units (4.5 Myr) per ring star-formation sample: resolves 10–20 Myr bursts
export const AGN_HIST_N = 48;
export const AGN_HIST_YR = 1500;     // astrophysical years per AGN-luminosity sample (72 kyr of light-travel history)

// Kinematic model of a barred spiral: x2 orbits inside the nuclear ring (perpendicular to the bar),
// aligned x1 orbits that make up the bar, and log-twisted density-wave orbits outside it whose
// arm crests start at the bar ends. Everything turns at one pattern speed Ωp.
const ORBIT = `
uniform float uT;      // model time (constant rate: one screen second ≈ 4.8 Myr)

const float PI = 3.14159265;
const float OMEGA_P = ${f(MODEL.OMEGA_P)};
const float R_BAR = ${f(MODEL.R_BAR)};
const float BAR_ECC = ${f(MODEL.BAR_ECC)};
const float RING_R = ${f(MODEL.RING_R)};
const float SPIRAL_K = ${f(SPIRAL_K)};
const float SPIRAL_ECC = ${f(SPIRAL_ECC)};
const float CREST = ${f(CREST)};

float omegaAt(float r) {
  return ${f(MODEL.V0)} * (1.0 - exp(-r / ${f(MODEL.CORE_RC)})) / max(r, 0.004);
}
void orbitShape(float a, out float ecc, out float psi) {
  float wx2 = 1.0 - smoothstep(RING_R * 0.9, RING_R * 1.5, a);
  float wsp = smoothstep(R_BAR * 0.85, R_BAR * 1.3, a);
  float spiralEcc = SPIRAL_ECC * (1.0 - 0.75 * smoothstep(${f(MODEL.R_OLR * 0.9)}, ${f(MODEL.R_OLR * 1.4)}, a));
  ecc = wx2 * 0.12 + (1.0 - wx2) * ((1.0 - wsp) * BAR_ECC + wsp * spiralEcc);
  psi = OMEGA_P * uT + wsp * (SPIRAL_K * log(max(a, R_BAR) / R_BAR) - CREST) + wx2 * PI * 0.5;
}
vec2 orbitPos(float a, float E, float epi, float sigma) {
  float ecc, psi;
  orbitShape(a, ecc, psi);
  // Epicyclic radial oscillation: frequency κ = √2·Ω (for a flat rotation curve).
  float aa = a * (1.0 + sigma * sin(epi + 1.41421 * omegaAt(a) * uT));
  vec2 l = vec2(aa * cos(E), aa * (1.0 - ecc) * sin(E));
  float c = cos(psi), s = sin(psi);
  return vec2(c * l.x - s * l.y, s * l.x + c * l.y);
}
vec2 toBarFrame(vec2 p) {
  float c = cos(OMEGA_P * uT), s = sin(OMEGA_P * uT);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
// Static boxy/peanut thickening of the bar (the edge-on signature of a buckled bar).
float diskHeight(float a) {
  float x = (a - 0.5 * R_BAR) / (0.25 * R_BAR);   // pow() is undefined for negative bases in GLSL
  float peanut = exp(-x * x);
  return 0.016 * (1.0 + 0.7 * a) * (1.0 + 2.2 * peanut);
}
`;

// Star-formation history of the nuclear ring, sampled backwards in model time: a cluster's
// brightness depends on the star formation rate when it was born, so after the burst the
// ring keeps its ageing clusters (a post-starburst fade) instead of switching off.
const RING_SF = `
uniform vec4 uRingHist[${RING_HIST_N / 4}];
uniform float uArmFrac;   // steady star formation in the arms (fraction of active associations)
float histSample(int i) { return uRingHist[i >> 2][i & 3]; }
float ringSFAt(float age) {
  float x = clamp(age / ${f(RING_HIST_DT)}, 0.0, ${f(RING_HIST_N - 1.001)});
  int i = int(floor(x));
  return mix(histSample(i), histSample(i + 1), x - float(i));
}
`;

const CULL = `gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); vPeak = 0.0; return;`;

export const STAR_VS = HEADER + ATTRS + ORBIT + RING_SF + `
uniform mat4 uView;
uniform mat4 uProj;
uniform float uGain;
uniform float uPx;       // base pixel size (scaled to render height)
uniform float uMaxPt;
uniform float uZoom;
out vec3 vColor;
out float vPeak;

void main() {
  float kind = aMeta.x;
  vec3 pos;
  float bright = aColor.w;
  if (kind < 0.5) {
    // Old disk stars; inside the bar their aligned x1 orbits form the bar itself.
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * uT;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.05), aOrbit.z * diskHeight(a));
  } else if (kind < 2.5) {
    // Bulge and halo: pressure-supported spheroids that rotate slowly.
    float halo = step(1.5, kind);
    float r = aOrbit.x;
    float ph = aOrbit.y + omegaAt(r) * mix(0.45, 0.08, halo) * uT;
    float w = aOrbit.z;
    float rho = r * sqrt(max(1.0 - w * w, 0.0));
    pos = vec3(rho * cos(ph), rho * sin(ph), r * w * mix(0.62, 0.85, halo));
  } else if (kind < 3.5) {
    // Arm associations: born at the arm crest, drift downstream and fade as their massive stars die.
    float tc = ${f(MODEL.CLUSTER_CYCLE)};
    float since = fract(aMeta.z + uT / tc) * tc;
    float a = aOrbit.x;
    float E = CREST + aOrbit.y + (omegaAt(a) - OMEGA_P) * since;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.015), aOrbit.z * 0.006 * (1.0 + 0.7 * a));
    float life = aMeta.w;
    float alive = smoothstep(0.0, 0.12, since) * (1.0 - smoothstep(life * 0.7, life, since))
                * (1.0 - smoothstep(tc * 0.85, tc, since));
    float evo = pow(1.0 + since / 0.3, -0.7);   // population luminosity declines with age
    bright *= alive * evo * smoothstep(aMeta.y - 0.08, aMeta.y + 0.08, uArmFrac);
  } else {
    // Nuclear-ring clusters: born at the lane contact points, carried round the ring as they age.
    float tc = ${f(MODEL.RING_CYCLE)};
    float since = fract(aMeta.z + uT / tc) * tc;
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * since;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.01), aOrbit.z * 0.004);
    float life = aMeta.w;
    float alive = smoothstep(0.0, 0.03, since) * (1.0 - smoothstep(life * 0.7, life, since))
                * (1.0 - smoothstep(tc * 0.85, tc, since));
    float evo = pow(1.0 + since / 0.12, -0.7);
    float sf = ringSFAt(since);
    bright *= alive * evo * smoothstep(aMeta.y - 0.1, aMeta.y + 0.1, sf) * (0.7 + 0.5 * min(sf, 1.5));
  }
  if (bright < 1e-4) { ${CULL} }
  vec4 vp = uView * vec4(pos, 1.0);
  if (vp.z > -0.01) { ${CULL} }
  gl_Position = uProj * vp;
  // PSF: size grows with the logarithm of brightness while energy (flux) is conserved.
  float size = clamp(uPx * (2.6 + 1.5 * log2(1.0 + bright)), 3.0, uMaxPt);
  gl_PointSize = size;
  vColor = aColor.rgb;
  vPeak = bright * uGain * uZoom * 16.0 / (size * size);
}
`;

export const STAR_FS = HEADER + `
in vec3 vColor;
in float vPeak;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  float core = exp(-r2 * 12.5);        // Gaussian core (σ = sprite/5)
  float halo = 0.06 * exp(-r2 * 3.0);  // PSF wings
  float win = clamp(1.0 - r2 * 4.0, 0.0, 1.0);
  outColor = vec4(vColor * vPeak * (core + halo) * win, 1.0);
}
`;

export const SPRITE_VS = HEADER + ATTRS + ORBIT + RING_SF + `
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uEye;          // camera position (Doppler beaming and light-echo geometry)
uniform vec3 uJetAxis;      // unit vector of the approaching jet
uniform float uJet;         // jet spine level (∝ 0.2·Ω)
uniform float uConeO;       // oxytocin analog: brightness of the AGN-lit gas
uniform vec4 uAgnHist[${AGN_HIST_N / 4}];   // AGN luminosity (fraction of peak), sampled backwards in astro time
uniform float uLane;        // bar-lane opacity factor (gas column, 0.3 + 1.2·G)
uniform float uLaneWidth;   // bar-lane width (myotonia sharpens it)
uniform float uInflow;      // visibility of gas clumps streaming along the lanes
uniform float uFlowT;       // integrated streaming phase of the lane gas
uniform float uNucFeed;     // nuclear feeding spirals inside the ring (dopamine analog)
uniform vec3 uFlush;        // inner radius, outer radius, strength of the inner-disk H-alpha glow
uniform float uPxScale;     // pixels / (world units / distance)
uniform float uMaxPt;
uniform float uIntensity;
out vec3 vColor;
out float vPeak;

float agnSample(int i) { return uAgnHist[i >> 2][i & 3]; }
float agnAt(float years) {
  float x = clamp(years / ${f(AGN_HIST_YR)}, 0.0, ${f(AGN_HIST_N - 1.001)});
  int i = int(floor(x));
  return mix(agnSample(i), agnSample(i + 1), x - float(i));
}
vec3 axisPoint(float along, float side, float ang, float radius, out vec3 ax) {
  ax = uJetAxis * side;
  vec3 t1 = normalize(cross(ax, abs(ax.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(ax, t1);
  return ax * along + (t1 * cos(ang) + t2 * sin(ang)) * radius;
}
// Light from the nucleus reaches gas at p and then the observer later than the direct light by
// |p|·(1 − cos φ)/c, φ being the angle between nucleus→gas and nucleus→observer.
float echoDelayYears(vec3 p) {
  float d = length(p);
  float cosPhi = dot(p / max(d, 1e-5), normalize(uEye));
  return d * (1.0 - cosPhi) * ${f(MODEL.LY_PER_UNIT)};
}

void main() {
  float kind = aMeta.x;
  vec3 pos;
  float bright = aColor.w;
  float size = aMeta.w;
  if (kind < 5.5) {
    // Diffuse disk light (unresolved old stars), following the bar and disk orbits.
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * uT;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.05), aOrbit.z * diskHeight(a) * 1.2);
  } else if (kind < 6.5) {
    // Diffuse bluish light of the young population in the arms — co-rotates with the pattern.
    pos = vec3(orbitPos(aOrbit.x, CREST + aOrbit.y, aOrbit.w, 0.0), aOrbit.z * 0.01);
    bright *= 0.5 + 0.5 * uArmFrac;
  } else if (kind < 8.5) {
    // H II regions (arms and nuclear ring): ionised by the youngest stars, gone within ≈ 7 Myr.
    bool ring = kind > 7.5;
    float tc = ring ? ${f(MODEL.RING_CYCLE)} : ${f(MODEL.CLUSTER_CYCLE)};
    float since = fract(aMeta.z + uT / tc) * tc;
    float a = aOrbit.x;
    float E = (ring ? 0.0 : CREST) + aOrbit.y + (omegaAt(a) - OMEGA_P) * since;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.0), aOrbit.z * 0.004);
    float life = ${f(MODEL.HII_LIFE)};
    float alive = smoothstep(0.0, 0.015, since) * (1.0 - smoothstep(life * 0.5, life, since));
    float sf = ring ? ringSFAt(since) : uArmFrac;
    bright *= alive * smoothstep(aMeta.y - 0.1, aMeta.y + 0.1, sf) * (ring ? 0.6 + 0.6 * min(sf, 1.5) : 0.8);
    size *= 0.6 + 1.2 * clamp(since / life, 0.0, 1.0);
  } else if (kind < 9.5) {
    float a = aOrbit.x;
    if (aMeta.z > 1.5) {
      // Nuclear feeding spirals: thin dust spirals inside the ring that carry gas toward the nucleus.
      float r = a;
      float ang = aOrbit.y + 2.2 * log(r / RING_R) + OMEGA_P * uT + omegaAt(r) * 0.15 * uT;
      pos = vec3(r * cos(ang), r * sin(ang), aOrbit.z * 0.002);
      bright *= uNucFeed;
    } else {
      // Arm dust: on the upstream side of the arm crest (where gas is compressed), or diffuse.
      float om = omegaAt(a);
      float E = aMeta.z > 0.5 ? CREST + aOrbit.y - 0.22 * sign(om - OMEGA_P) : aOrbit.y + (om - OMEGA_P) * uT;
      pos = vec3(orbitPos(a, E, aOrbit.w, 0.0), aOrbit.z * 0.004);
    }
  } else if (kind < 10.5) {
    // Bar dust lanes: standing shocks on the bar's leading edges. Flowing clumps enter at the bar
    // end and stall at the nuclear ring — gas never pours straight into the nucleus.
    float side = aOrbit.y;
    float s = aMeta.y > 0.5 ? fract(aMeta.z - uFlowT) : aOrbit.x;
    float x = 0.02 + s * (R_BAR * 0.85 - 0.02);
    float y = RING_R * 0.95 * (1.0 - s) * (1.0 - s) + 0.04 * s + 0.012 * sin(PI * s);
    vec2 lane = side * vec2(x, y + aOrbit.z * uLaneWidth * 0.5);
    pos = vec3(toBarFrame(lane), aOrbit.w * 0.003);
    bright *= aMeta.y > 0.5
      ? uInflow * smoothstep(0.0, 0.1, s) * (1.0 - smoothstep(0.85, 1.0, s))
      : uLane;
  } else if (kind < 11.5) {
    // Relativistic jet spine: narrow (aspect ≈ 0.1), widening from ≈ 30 pc to ≈ 150 pc.
    vec3 ax;
    float u = aOrbit.x;
    pos = axisPoint(u * ${f(MODEL.JET_LEN)}, aOrbit.y, aOrbit.z, (0.001 + 0.004 * u) * aOrbit.w, ax);
    // Doppler beaming with β = 0.8 (Γ ≈ 1.67), α = 0.7: ≈ 100:1 jet/counterjet at 30° to the line of sight.
    float mu = dot(ax, normalize(uEye - pos));
    float dop = pow(1.0 / (1.6667 * (1.0 - 0.8 * mu)), 2.7);
    bright *= uJet * dop * smoothstep(0.0, 0.04, u) * exp(-u * ${f(MODEL.JET_LEN * 15 / 0.8)});
    size *= 0.6 + 1.2 * u;
  } else if (kind < 12.5) {
    // Ionization cones (half-opening ≈ 35°) and light-echo clouds: gas lit by the AGN as it was
    // one light-travel time earlier, so it keeps glowing after the nucleus fades.
    vec3 ax;
    if (aMeta.y > 1.5) {
      // Echo cloud: a clump 3–10 kpc out, inside the cone direction.
      pos = axisPoint(aOrbit.x, aOrbit.y, aOrbit.z, aOrbit.w, ax);
    } else {
      float d = aOrbit.x;
      pos = axisPoint(d * ${f(MODEL.CONE_LEN)}, aOrbit.y, aOrbit.z, d * ${f(MODEL.CONE_LEN)} * 0.7 * aOrbit.w, ax);
      bright *= (0.35 + 0.65 * (1.0 - d)) * smoothstep(0.0, 0.08, d) * (0.55 + 0.45 * sin(aOrbit.z * 7.0 + aMeta.z * 31.0));
      size *= 0.7 + 1.3 * d;
    }
    bright *= agnAt(echoDelayYears(pos)) * (0.4 + 0.6 * uConeO);
  } else {
    // Inner-disk H-alpha glow (sex-flush analog): spreads from the ring toward the bar ends and
    // fades centre-first, as galaxies quench inside-out.
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * uT;
    pos = vec3(orbitPos(a, E, aOrbit.w, 0.0), aOrbit.z * 0.004);
    float r = length(pos.xy);
    bright *= uFlush.z * smoothstep(uFlush.x - 0.03, uFlush.x, r) * (1.0 - smoothstep(uFlush.y - 0.05, uFlush.y, r));
  }
  if (bright < 1e-4) { ${CULL} }
  vec4 vp = uView * vec4(pos, 1.0);
  if (vp.z > -0.01) { ${CULL} }
  gl_Position = uProj * vp;
  float px = size * uPxScale / -vp.z;
  gl_PointSize = clamp(px, 1.5, uMaxPt);
  vColor = aColor.rgb;
  // Surface brightness is independent of distance; for very small sprites we conserve energy instead.
  vPeak = bright * uIntensity * min(1.0, (px * px) / (1.5 * 1.5));
}
`;

// A sprite inside the thin disk appears as an ellipse when inclined: its minor axis lies along the
// on-screen projection of the disk normal, with axis ratio |cos i|. In an optically thin medium the
// light path lengthens, so surface brightness (and dust column) increases by a factor of 1/|cos i|.
const DISK_SPRITE = `
uniform vec3 uDiskAxis;   // xy: direction of the normal in point-coord space, z: axis ratio
vec2 diskCoord() {
  vec2 d = gl_PointCoord - 0.5;
  float along = dot(d, uDiskAxis.xy);
  return d + uDiskAxis.xy * along * (1.0 / uDiskAxis.z - 1.0);
}
`;

export const GLOW_FS = HEADER + DISK_SPRITE + `
in vec3 vColor;
in float vPeak;
out vec4 outColor;
void main() {
  vec2 d = diskCoord();
  float r2 = dot(d, d);
  float g = exp(-r2 * 10.0) * clamp(1.0 - r2 * 4.0, 0.0, 1.0);
  outColor = vec4(vColor * vPeak * g * min(1.0 / uDiskAxis.z, 2.5), 1.0);
}
`;

// Dust: absorption (extinction). Blend: dst *= (1 − src). Blue light is absorbed more -> reddening.
export const DUST_FS = HEADER + DISK_SPRITE + `
in vec3 vColor;
in float vPeak;
out vec4 outColor;
void main() {
  vec2 d = diskCoord();
  float r2 = dot(d, d);
  float g = exp(-r2 * 9.0) * clamp(1.0 - r2 * 4.0, 0.0, 1.0);
  float path = min(1.0 / uDiskAxis.z, 5.0);
  outColor = vec4(clamp(vColor * vPeak * g * path, 0.0, 0.95), 1.0);
}
`;

// Jet knots (a small buffer the CPU updates every frame).
export const FX_VS = HEADER + `
layout(location = 0) in vec4 aPos;     // xyz, flux
layout(location = 1) in vec4 aCol;     // rgb, size (world units)
uniform mat4 uView;
uniform mat4 uProj;
uniform float uPx;
uniform float uPxScale;
uniform float uMaxPt;
out vec3 vColor;
out float vPeak;
void main() {
  vec4 vp = uView * vec4(aPos.xyz, 1.0);
  if (vp.z > -0.01 || aPos.w <= 0.0) { ${CULL} }
  gl_Position = uProj * vp;
  // Flux is conserved: a knot that expands or is seen from further away spreads the same light.
  float size = clamp(aCol.w * uPxScale / -vp.z, 3.0 * uPx, uMaxPt);
  gl_PointSize = size;
  vColor = aCol.rgb;
  vPeak = aPos.w * 16.0 / (size * size) * (uPx * uPx);
}
`;

export const BG_VS = HEADER + `
layout(location = 0) in vec4 aDir;     // direction, type (0 star, 1 galaxy, 2 bright star with diffraction spikes)
layout(location = 1) in vec4 aCol;     // rgb, brightness
layout(location = 2) in vec4 aShape;   // galaxy: size, angle, elongation
uniform mat4 uViewRot;
uniform mat4 uProj;
uniform float uPx;
uniform float uGain;
uniform float uMaxPt;
out vec3 vColor;
out float vPeak;
out float vSize;
out vec3 vShape;
flat out float vKind;
void main() {
  gl_Position = uProj * uViewRot * vec4(aDir.xyz * 30.0, 1.0);
  vKind = aDir.w;
  vColor = aCol.rgb;
  float lum = aCol.w;
  if (aDir.w > 0.5 && aDir.w < 1.5) {
    float s = clamp(aShape.x * uPx * 2.5, 2.0, uMaxPt);
    gl_PointSize = s;
    vSize = s;
    vShape = vec3(aShape.y, aShape.z, 0.0);
    vPeak = lum * uGain;
  } else {
    float sig = uPx * (0.55 + 0.22 * log2(1.0 + lum));
    float s = aDir.w > 1.5 ? uPx * (30.0 + 9.0 * log2(lum)) : sig * 5.0;
    s = clamp(s, 3.0, uMaxPt);
    gl_PointSize = s;
    vSize = s;
    vShape = vec3(0.0, 0.0, sig);
    vPeak = lum * uGain / (6.2832 * sig * sig) * (uPx * uPx) * 3.0;
  }
}
`;

export const BG_FS = HEADER + `
in vec3 vColor;
in float vPeak;
in float vSize;
in vec3 vShape;
flat in float vKind;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float win = clamp(1.0 - dot(d, d) * 4.0, 0.0, 1.0);
  if (vKind > 0.5 && vKind < 1.5) {
    float c = cos(vShape.x), s = sin(vShape.x);
    vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    q.y /= max(1.0 - vShape.y, 0.2);
    float r2 = dot(q, q);
    float g = 0.75 * exp(-r2 * 40.0) + 0.25 * exp(-r2 * 12.0);
    outColor = vec4(vColor * vPeak * g * win, 1.0);
    return;
  }
  vec2 px = d * vSize;
  float r2 = dot(px, px);
  float sig = vShape.z;
  float core = exp(-r2 / (2.0 * sig * sig));
  float halo = 0.05 * exp(-r2 / (18.0 * sig * sig));
  float spikes = 0.0;
  if (vKind > 1.5) {
    // Four Hubble-style diffraction spikes (from the mirror support vanes). Fixed in screen space.
    const float ca = 0.97815, sa = 0.20791;
    vec2 u = vec2(ca * px.x + sa * px.y, -sa * px.x + ca * px.y);
    float L = vSize * 0.16;
    float w = max(0.55, sig * 0.5);
    spikes = 0.18 * (exp(-abs(u.y) / w) * exp(-abs(u.x) / L) + exp(-abs(u.x) / w) * exp(-abs(u.y) / L));
  }
  outColor = vec4(vColor * vPeak * (core + halo + spikes) * win, 1.0);
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

// Unresolved bulge light (Sérsic n = 2) and the active galactic nucleus (AGN): an unresolved
// bluish-white point that, when bright, shows the telescope's four diffraction spikes (as in 3C 273).
export const CORE_FS = HEADER + `
uniform vec2 uCenter;
uniform float uRe;
uniform float uCorePow;
uniform vec3 uCoreColor;
uniform float uAgnPow;
uniform vec3 uAgnColor;
uniform float uAgnSigma;
uniform float uSpikeLen;
out vec4 outColor;
void main() {
  vec2 d = gl_FragCoord.xy - uCenter;
  float r = length(d) / uRe;
  float sersic = min(exp(-3.67 * (sqrt(r + 1e-4) - 1.0)), 40.0);
  float agn = exp(-dot(d, d) / (2.0 * uAgnSigma * uAgnSigma));
  const float ca = 0.97815, sa = 0.20791;   // same 12° spike orientation as the foreground stars
  vec2 u = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
  float w = uAgnSigma * 0.6;
  float spikes = exp(-abs(u.y) / w) * exp(-abs(u.x) / uSpikeLen) + exp(-abs(u.x) / w) * exp(-abs(u.y) / uSpikeLen);
  outColor = vec4(uCoreColor * uCorePow * sersic + uAgnColor * uAgnPow * (agn + 0.12 * spikes), 1.0);
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

export const COMPOSITE_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
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
  c = aces(c * uExposure);
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.5 * dot(q, q);   // subtle optical vignetting
  c = pow(c, vec3(1.0 / 2.2));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;   // dithering against banding
  outColor = vec4(c, 1.0);
}
`;
