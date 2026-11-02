// Colour of thermal light: Planck's law × CIE 1931 (Wyman–Sloan–Shirley 2013 analytic fit),
// carried over from the galaxy projects. Neurons are cool-white "stars" (≈ 7,000–9,500 K) and
// dopamine release is warm lantern light at 2,300 K: never below 2,200 K, where the red ratio of the
// Planck colour would reach the WCAG saturated-red criterion (research/DOPAMINE.md §8).

function lobe(x, mu, s1, s2) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}

function cie(nm) {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}

// XYZ -> linear sRGB (D65), normalized to unit luminance.
function xyzToRgb(X, Y, Z) {
  const r = Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z);
  const g = Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z);
  const b = Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / lum, g / lum, b / lum];
}

export function blackbodyRGB(T) {
  const C2 = 1.4388e-2;   // hc/k, m·K
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const l = nm * 1e-9;
    const B = 1 / (Math.pow(l, 5) * (Math.exp(C2 / (l * T)) - 1));
    const [x, y, z] = cie(nm);
    X += B * x; Y += B * y; Z += B * z;
  }
  return xyzToRgb(X, Y, Z);
}

// Mix towards grey: keeps a hue but lowers its chroma (for the modulator tints).
export function desaturate(rgb, k) {
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map((c) => l + (c - l) * (1 - k));
}

// --- Body palette (research/ANALYSIS.md §13.5) ---
// Every body colour is a point near the Planckian locus: a correlated colour temperature T and a
// signed distance Duv from the locus in CIE 1960 UCS (u, v), positive towards green (Ohno 2014).

function planckXYZ(T) {
  const C2 = 1.4388e-2;
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const l = nm * 1e-9;
    const B = 1 / (Math.pow(l, 5) * (Math.exp(C2 / (l * T)) - 1));
    const [x, y, z] = cie(nm);
    X += B * x; Y += B * y; Z += B * z;
  }
  return [X, Y, Z];
}

// CIE 1960 UCS chromaticity of the Planckian radiator at T.
export function planckUV(T) {
  const [X, Y, Z] = planckXYZ(T);
  const d = X + 15 * Y + 3 * Z;
  return [4 * X / d, 6 * Y / d];
}

// Linear sRGB (unit luminance) of the colour T K, Duv away from the locus.
export function cctDuvRGB(T, duv = 0) {
  const [u0, v0] = planckUV(T);
  const [u1, v1] = planckUV(T * 1.001);
  // The locus runs towards lower u and v as T rises; its normal (dv, −du) points to higher v (green).
  let nu = v1 - v0, nv = -(u1 - u0);
  const n = Math.hypot(nu, nv);
  nu /= n; nv /= n;
  const u = u0 + duv * nu, v = v0 + duv * nv;
  const den = 2 * u - 8 * v + 4;
  const x = 3 * u / den, y = 2 * v / den;
  return xyzToRgb(x / y, 1, (1 - x - y) / y);
}

// Display helpers: hex swatch (brightest channel at 1, sRGB transfer) and the linear red ratio
// R/(R+G+B) used by the photosensitivity rules (§13.15).
export function rgbToHex(rgb) {
  const m = Math.max(...rgb, 1e-9);
  const enc = (c) => {
    const x = Math.min(1, Math.max(0, c / m));
    const s = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  };
  return '#' + rgb.map(enc).join('');
}

export function redRatio(rgb) { return rgb[0] / Math.max(1e-9, rgb[0] + rgb[1] + rgb[2]); }

export const NEURON_COOL = blackbodyRGB(9500);    // tint 0
export const NEURON_WARM = blackbodyRGB(7000);    // tint 1
export const DOPAMINE_RGB = blackbodyRGB(2300);   // warm amber lantern light
