// Dynamical model of a barred spiral galaxy: rotation curve, stellar bar, nuclear ring and
// kinematic density-wave arms. The formulas here are replicated exactly in the shaders
// (shaders.js); the constants are passed from this file to GLSL, so JS and GPU agree.
//
// Units: galaxy radius ≈ 1 (≈ 15 kpc), time unit ≈ 60 Myr, flat rotation speed V0 = 1.
// The bar is a permanent structure: bars live for gigayears, far longer than one response
// cycle, so its length, axis ratio and pattern speed never change (research/ANALYSIS.md).

// Values from research/ANALYSIS.md §9.1.
export const MODEL = {
  V0: 1.0,              // ≈ 244 km/s
  CORE_RC: 0.03,        // rotation-curve knee (≈ 0.45 kpc): gives inner Lindblad resonances, so a nuclear ring can form
  OMEGA_P: 2.5,         // bar (and arm) pattern speed ≈ 40.7 km s⁻¹ kpc⁻¹, period ≈ 151 Myr; corotation 0.40 = 1.2 bar lengths
  R_BAR: 0.33,          // bar half-length (5 kpc)
  BAR_ECC: 0.65,        // x1-orbit eccentricity: bar axis ratio ≈ 0.35
  RING_R: 0.06,         // nuclear ring radius (0.9 kpc); orbit ≈ 26 Myr
  RING_W: 0.008,        // nuclear ring width
  PITCH_DEG: 18,        // spiral pitch angle; arm geometry does not change on these timescales
  ARM_CONTRAST: 0.62,
  R_OLR: 0.68,          // outer Lindblad resonance: the spiral fades beyond it
  MYR_PER_UNIT: 60,     // 1 model time unit = 60 Myr
  BASE_SPEED: 0.08,     // build clock: 1 s on screen = 0.08 units = 4.8 Myr
  CLUSTER_CYCLE: 2.0,   // visibility cycle of a young cluster in the arms (≈ 120 Myr)
  RING_CYCLE: 8.0,      // ring clusters are followed for ≈ 480 Myr, long enough for the white A-star afterglow
  HII_LIFE: 0.117,      // ring and arm H II regions disperse within ≈ 7 Myr
  LY_PER_UNIT: 48900,   // light-travel time across one model length unit, in years
  JET_LEN: 0.133,       // visible jet length (2 kpc, Seyfert scale)
  JET_TILT_DEG: 30,     // jet tilt from the disk normal
  CONE_LEN: 0.13,       // ionization-cone extent (≈ 2 kpc)
};

// Flat rotation curve: v(r) = V0·(1 − e^(−r/rc)), Ω = v/r.
export function omegaAt(r) {
  return MODEL.V0 * (1 - Math.exp(-r / MODEL.CORE_RC)) / Math.max(r, 0.004);
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const SPIRAL_K = -1 / Math.tan(MODEL.PITCH_DEG * Math.PI / 180);
// Spiral eccentricity from the arm contrast: orbits must not cross, e·√(1/4 + k²) < 1 − e/2.
export const SPIRAL_ECC = MODEL.ARM_CONTRAST / (Math.sqrt(0.25 + SPIRAL_K * SPIRAL_K) + MODEL.ARM_CONTRAST / 2);
// Angle between an orbit's major axis and the arm crest (where neighbouring orbits crowd).
export const CREST = 0.5 * (Math.atan(2 * SPIRAL_K) + Math.PI);

// Orbit families: x2 (inside the nuclear ring, elongated perpendicular to the bar),
// x1 (inside the bar, aligned with it) and the log-twisted spiral orbits outside.
export function orbitShape(a, t) {
  const wx2 = 1 - smoothstep(MODEL.RING_R * 0.9, MODEL.RING_R * 1.5, a);
  const wsp = smoothstep(MODEL.R_BAR * 0.85, MODEL.R_BAR * 1.3, a);
  const spiralEcc = SPIRAL_ECC * (1 - 0.75 * smoothstep(MODEL.R_OLR * 0.9, MODEL.R_OLR * 1.4, a));
  const ecc = wx2 * 0.12 + (1 - wx2) * ((1 - wsp) * MODEL.BAR_ECC + wsp * spiralEcc);
  // The arm crest sits CREST ahead of the orbit axis; shifting by −CREST starts the arms at the bar ends.
  const psi = MODEL.OMEGA_P * t + wsp * (SPIRAL_K * Math.log(Math.max(a, MODEL.R_BAR) / MODEL.R_BAR) - CREST) + wx2 * Math.PI / 2;
  return { ecc, psi };
}

// In-plane position of a disk particle (identical to orbitPos in the shader).
export function orbitPos(a, E, t) {
  const { ecc, psi } = orbitShape(a, t);
  const lx = a * Math.cos(E), ly = a * (1 - ecc) * Math.sin(E);
  const c = Math.cos(psi), s = Math.sin(psi);
  return [c * lx - s * ly, s * lx + c * ly];
}

// Unit vector of the approaching jet: tilted JET_TILT_DEG from the disk normal (Seyfert jets
// point at random angles to the host disk) toward a fixed azimuth.
export function jetAxis() {
  const t = MODEL.JET_TILT_DEG * Math.PI / 180, az = 0.7;
  return [Math.sin(t) * Math.cos(az), Math.sin(t) * Math.sin(az), Math.cos(t)];
}
