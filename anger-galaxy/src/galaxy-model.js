// Dynamical model of the galaxy: rotation curve and kinematic density wave.
// The formulas here are replicated exactly in the shaders (shaders.js); the constants
// are passed from this file to GLSL, so the JS and GPU computations match.
//
// Units: galaxy radius ≈ 1 (≈ 15 kpc), time unit ≈ 60 Myr,
// rotation speed in the flat part of the curve V0 = 1.

export const MODEL = {
  V0: 1.0,
  CORE_RC: 0.09,        // "knee" of the rotation curve: solid-body rotation inside it
  OMEGA_P: 1.25,        // spiral pattern speed Ωp; corotation radius ≈ 0.8
  MYR_PER_UNIT: 60,     // 1 model time unit = 60 Myr
  BASE_SPEED: 0.08,     // in the calm state, 1 s on screen = 0.08 units ≈ 4.8 Myr
  CLUSTER_CYCLE: 2.0,   // visibility cycle of a young star cluster (≈ 120 Myr)
  HII_LIFE: 0.45,       // time an H II region stays visible (≈ 27 Myr)
};

// Flat rotation curve: v(r) = V0·(1 − e^(−r/rc)), Ω = v/r.
export function omegaAt(r) {
  return MODEL.V0 * (1 - Math.exp(-r / MODEL.CORE_RC)) / Math.max(r, 0.004);
}

// Orbits are centered ellipses (Lindblad epicycle approximation, m = 2).
// Orientation angle of the orbit's major axis ψ(a) = k·ln(a + 0.04); k < 0 gives trailing arms.
// The angle at which neighboring orbits crowd closest together is the arm crest:
//   r(φ) ≈ a·(1 − e/2 + (e/2)·cos2Δ),  with dr/da minimal at  Δ = (atan(2k) + π) / 2.
export function crestOffset(k) {
  return 0.5 * (Math.atan(2 * k) + Math.PI);
}

// Choose the eccentricity from the arm contrast c and the pitch angle: for the orbits not to
// cross, e·√(1/4 + k²) < 1 − e/2 must hold; c is that ratio itself (0..1).
export function spiralShape(pitchDeg, contrast) {
  const k = -1 / Math.tan(pitchDeg * Math.PI / 180);
  const ecc = contrast / (Math.sqrt(0.25 + k * k) + contrast / 2);
  return { k, ecc };
}

export function eccAt(a, ecc) {
  const s = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  return ecc * s(0.02, 0.2, a) * (1 - 0.45 * s(0.75, 1.3, a));
}

// In-plane position of a disk particle (identical to ellipsePos in the shader).
export function ellipsePos(a, E, t, k, ecc) {
  const e = eccAt(a, ecc);
  const psi = k * Math.log(a + 0.04) + MODEL.OMEGA_P * t;
  const lx = a * Math.cos(E), ly = a * (1 - e) * Math.sin(E);
  const c = Math.cos(psi), s = Math.sin(psi);
  return [c * lx - s * ly, s * lx + c * ly];
}
