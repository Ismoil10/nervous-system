// GLSL ES 3.00 shaders. The orbital formulas match galaxy-model.js;
// the constants are injected from that file.

import { MODEL } from './galaxy-model.js';

const f = (x) => Number(x).toFixed(5);

const HEADER = `#version 300 es
precision highp float;
`;

const ATTRS = `
layout(location = 0) in vec4 aOrbit;
layout(location = 1) in vec4 aColor;
layout(location = 2) in vec4 aMeta;
`;

// Kinematic density-wave model (Lindblad): centered elliptical orbits whose
// axes twist logarithmically with radius; the pattern rotates at the pattern speed Ωp.
const ORBIT = `
uniform float uT;      // model time (integrated at the anger-driven rate)
uniform float uK;      // spiral winding coefficient k = −1/tan(pitch)
uniform float uEcc;    // orbital eccentricity (arm contrast)
uniform float uHeat;   // velocity dispersion multiplier (dynamical heating)
uniform vec3 uRing;    // shock-wave ring: radius, strength, width

const float PI = 3.14159265;
const float OMEGA_P = ${f(MODEL.OMEGA_P)};

float omegaAt(float r) {
  return ${f(MODEL.V0)} * (1.0 - exp(-r / ${f(MODEL.CORE_RC)})) / max(r, 0.004);
}
float eccAt(float a) {
  return uEcc * smoothstep(0.02, 0.2, a) * (1.0 - 0.45 * smoothstep(0.75, 1.3, a));
}
float crestOffset() {
  return 0.5 * (atan(2.0 * uK) + PI);
}
vec2 ellipsePos(float a, float E, float epi, float sigma) {
  float om = omegaAt(a);
  float e = eccAt(a);
  float psi = uK * log(a + 0.04) + OMEGA_P * uT;
  // Epicyclic radial oscillation: frequency κ = √2·Ω (for a flat rotation curve).
  float aa = a * (1.0 + sigma * uHeat * sin(epi + 1.41421 * om * uT));
  vec2 l = vec2(aa * cos(E), aa * (1.0 - e) * sin(E));
  float c = cos(psi), s = sin(psi);
  return vec2(c * l.x - s * l.y, s * l.x + c * l.y);
}
vec2 ringPush(vec2 p, out float boost) {
  float r = length(p);
  float d = (r - uRing.x) / uRing.z;
  boost = uRing.y * exp(-d * d);
  return p * ((r + boost * 0.08) / max(r, 1e-4));
}
`;

const CULL = `gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); vPeak = 0.0; return;`;

export const STAR_VS = HEADER + ATTRS + ORBIT + `
uniform mat4 uView;
uniform mat4 uProj;
uniform float uSF;       // star formation intensity
uniform float uSFFrac;   // fraction of active clusters
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
  float boost = 0.0;
  if (kind < 0.5) {
    // Old disk stars: differential rotation, dynamically "hot" (large epicycle amplitude).
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * uT;
    vec2 p = ringPush(ellipsePos(a, E, aOrbit.w, 0.06), boost);
    pos = vec3(p, aOrbit.z * 0.016 * (1.0 + 0.7 * a) * (0.55 + 0.45 * uHeat));
    bright *= 1.0 + 2.0 * boost;
  } else if (kind < 2.5) {
    // Bulge and halo: pressure-supported spheroids that rotate slowly.
    float halo = step(1.5, kind);
    float r = aOrbit.x;
    float om = omegaAt(r) * mix(0.45, 0.08, halo);
    r *= 1.0 + 0.03 * (uHeat - 1.0) * sin(aOrbit.w + 2.0 * om * uT);
    float ph = aOrbit.y + om * uT;
    float w = aOrbit.z;
    float rho = r * sqrt(max(1.0 - w * w, 0.0));
    pos = vec3(rho * cos(ph), rho * sin(ph), r * w * mix(0.62, 0.85, halo));
  } else {
    // Young stars: born at the arm crest, drift downstream with the flow and fade when their lifetime ends.
    float tc = ${f(MODEL.CLUSTER_CYCLE)};
    float since = fract(aMeta.z + uT / tc) * tc;
    float a = aOrbit.x;
    float E = crestOffset() + aOrbit.y + (omegaAt(a) - OMEGA_P) * since;
    vec2 p = ringPush(ellipsePos(a, E, aOrbit.w, 0.015), boost);
    pos = vec3(p, aOrbit.z * 0.006 * (1.0 + 0.7 * a) * (0.6 + 0.4 * uHeat));
    float life = aMeta.w;
    float alive = smoothstep(0.0, 0.12, since)
                * (1.0 - smoothstep(life * 0.7, life, since))
                * (1.0 - smoothstep(tc * 0.85, tc, since));
    float evo = pow(1.0 + since / 0.3, -0.7);   // population luminosity declines with age
    float act = max(smoothstep(aMeta.y - 0.08, aMeta.y + 0.08, uSFFrac), min(1.0, boost * 2.0));
    bright *= alive * evo * act * (0.8 + 0.25 * uSF) * (1.0 + 3.0 * boost);
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

export const SPRITE_VS = HEADER + ATTRS + ORBIT + `
uniform mat4 uView;
uniform mat4 uProj;
uniform float uSF;
uniform float uSFFrac;
uniform float uAT;          // animation time (s)
uniform float uOutflow;     // superwind strength
uniform float uPxScale;     // pixels / (world units / distance)
uniform float uMaxPt;
uniform float uIntensity;
out vec3 vColor;
out float vPeak;

void main() {
  float kind = aMeta.x;
  vec3 pos;
  float bright = aColor.w;
  float size = aMeta.w;
  float boost = 0.0;
  if (kind < 4.5) {
    // Diffuse disk light (unresolved old stars).
    float a = aOrbit.x;
    float E = aOrbit.y + (omegaAt(a) - OMEGA_P) * uT;
    vec2 p = ringPush(ellipsePos(a, E, aOrbit.w, 0.06), boost);
    pos = vec3(p, aOrbit.z * 0.02);
    bright *= 1.0 + 4.0 * boost;
  } else if (kind < 5.5) {
    // Diffuse bluish light of the young population in the arms — co-rotates with the pattern.
    vec2 p = ringPush(ellipsePos(aOrbit.x, crestOffset() + aOrbit.y, aOrbit.w, 0.0), boost);
    pos = vec3(p, aOrbit.z * 0.01);
    bright *= (0.45 + 0.35 * uSF) * (1.0 + 3.0 * boost);
  } else if (kind < 6.5) {
    // H II region: born with its cluster; the Strömgren sphere expands, then disperses.
    float tc = ${f(MODEL.CLUSTER_CYCLE)};
    float since = fract(aMeta.z + uT / tc) * tc;
    float a = aOrbit.x;
    float E = crestOffset() + aOrbit.y + (omegaAt(a) - OMEGA_P) * since;
    vec2 p = ringPush(ellipsePos(a, E, aOrbit.w, 0.0), boost);
    pos = vec3(p, aOrbit.z * 0.005);
    float life = ${f(MODEL.HII_LIFE)};
    float alive = smoothstep(0.0, 0.05, since) * (1.0 - smoothstep(life * 0.5, life, since));
    float act = max(smoothstep(aMeta.y - 0.08, aMeta.y + 0.08, uSFFrac), min(1.0, boost * 2.5));
    bright *= alive * act * uSF * (1.0 + 4.0 * boost);
    size *= 0.6 + 1.2 * clamp(since / life, 0.0, 1.0);
  } else if (kind < 7.5) {
    // Dust: on the upstream side of the arm crest (the shock front where gas is compressed), or diffuse.
    float a = aOrbit.x;
    float om = omegaAt(a);
    float E = aMeta.z > 0.5
      ? crestOffset() + aOrbit.y - 0.22 * sign(om - OMEGA_P)
      : aOrbit.y + (om - OMEGA_P) * uT;
    vec2 p = ringPush(ellipsePos(a, E, aOrbit.w, 0.0), boost);
    pos = vec3(p, aOrbit.z * 0.004);
    bright *= 1.0 + boost;
  } else {
    // Bipolar superwind (as in M82): H-alpha (Hα) filaments along a cone from the nucleus, perpendicular to the disk plane.
    float p = fract(aOrbit.y + uAT * 0.045 * (0.7 + 0.6 * aOrbit.x));
    float h = p * 0.62;
    float ang = aMeta.y + 0.25 * sin(h * 9.0 + aMeta.y);
    float rho = 0.025 + h * 0.5 * (0.35 + 0.65 * aOrbit.z) + 0.012 * sin(h * 23.0 + aMeta.y * 3.0);
    pos = vec3(rho * cos(ang), rho * sin(ang), aOrbit.w * (0.015 + h));
    bright *= uOutflow * pow(1.0 - p, 1.5) * smoothstep(0.0, 0.06, p);
    size *= 0.7 + 1.6 * p;
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

// Supernovae and other short-lived events (a small buffer the CPU updates every frame).
export const FX_VS = HEADER + `
layout(location = 0) in vec4 aPos;     // xyz, flux
layout(location = 1) in vec4 aCol;     // rgb, size (base pixels)
uniform mat4 uView;
uniform mat4 uProj;
uniform float uPx;
uniform float uMaxPt;
out vec3 vColor;
out float vPeak;
void main() {
  vec4 vp = uView * vec4(aPos.xyz, 1.0);
  if (vp.z > -0.01 || aPos.w <= 0.0) { ${CULL} }
  gl_Position = uProj * vp;
  float size = clamp(uPx * aCol.w, 3.0, uMaxPt);
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

// Unresolved bulge light (Sérsic n = 2) and the active galactic nucleus (AGN) — both pulse with the heartbeat.
export const CORE_FS = HEADER + `
uniform vec2 uCenter;
uniform float uRe;
uniform float uCorePow;
uniform vec3 uCoreColor;
uniform float uAgnPow;
uniform vec3 uAgnColor;
uniform float uAgnSigma;
out vec4 outColor;
void main() {
  vec2 d = gl_FragCoord.xy - uCenter;
  float r = length(d) / uRe;
  float sersic = min(exp(-3.67 * (sqrt(r + 1e-4) - 1.0)), 40.0);
  float agn = exp(-dot(d, d) / (2.0 * uAgnSigma * uAgnSigma));
  outColor = vec4(uCoreColor * uCorePow * sersic + uAgnColor * uAgnPow * agn, 1.0);
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
