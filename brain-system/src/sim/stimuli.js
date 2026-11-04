// @ts-check
// Stimulus records, senses, sites and the analytic arrival-time overlay (research/ANALYSIS.md A.6,
// §4.4, §4.11, §4.14, §5.1, §5.13–§5.16, §11.9, B.4). Pure data and functions, no kernel state: the
// sensory plugin (sensory.js) drives receptors from these records, the HUD lists senses, modes and
// sites from them, and predictArrivals() gives the §4.14 overlay from any built graph.
//
//   record   { sense, mode, site, side, intensity, unit, durationMs, tOnset, params }   A.6 (+ params)
//   psi      k · (I − I0)^a on the physical continuum of the mode (§4.10, §5.13); k = I0^(−a) [model]
//   class    a physical stimulus drives every receptor class at the site whose threshold I0 it exceeds,
//            whatever sense was picked (§5.1 step 2, A.6)
//   arrival  t = t_rec (§5) + Σ d_e (§4.4) [+ Σ 0.71·τ_i over intermediate relays when compared with NF, §4.11]
//
// `params` carries the A.6 secondary parameters that the record's core fields cannot hold: tone
// frequency and rise time (hearing), vibration frequency and stroke velocity (touch), contact ramp
// (temperature), odour class (smell), rotation axis (balance) and movement velocity (proprioception).
// Units: human seconds (tOnset), ms (durationMs), mm, m/s.

import { BODY_BIT, NET, NET_IDS } from './graph.js';
import { erfc } from './kernel.js';

export const PARAMS = {
  skinBaseline: 32,          // °C, skin baseline of the temperature and heat continua (A.6, §5.14)
  gravity: 9.81,             // m/s², tilt → specific force on the otoliths [T]
  arrivalMinW: 0.25,         // edges below this |w| are modulatory and carry no arrival (§4.14) [model]
  relayAFin: 0.98,           // saturated relay output a_fin of the §4.11 relay term
  relayTheta: 0.5,           // θ_next of the §4.11 relay term (Table 4.8a default)
  contactHeat: {             // §11.9 contact-heat transduction: T_rec(t) = T_skin + (T_c − T_skin)·erfc(d / (2√(α(t − t₀))))
    alpha: 1.0e-7,           // m²/s, skin thermal diffusivity (§11.9) [T]
    depth: 150e-6,           // m, heat-nociceptor terminal depth (§11.9) [model]
    tSkin: 32,               // °C, skin temperature before contact (§12.5; = skinBaseline)
    theta: 43,               // °C, heat threshold at the terminal (§5; §12.5 sensitivity table)
  },
  salience: {                // §3.12 class weights c
    noxious: 0.9, loud: 0.6, aversiveOdour: 0.6, brightFlash: 0.4, food: 0.4, intero: 0.3, innocuous: 0,
    loudDb: 90,               // dB SPL, the startle marker (§3.12, §6)
    brightLog: 3,             // log10 cd/m², flash ≥ 1,000 cd/m² (§3.12)
  },
};

// --- Senses (A.6 order; §5.14 final ranges; §5.13 exponents) ---
const SIDES_EYE = ['R', 'L', 'both'];
const SIDES_LR = ['R', 'L'];
const P = (name, unit, min, max, def, extra) => ({ name, unit, min, max, def, ...extra });
const D = (min, max, def) => ({ min, max, def });
// psi continuum per mode: toI(intensity, params) → I; I0 psi threshold and Imax (top of the A.6 range)
// on that continuum; a = Stevens exponent (§5.13).
const C = (toI, I0, Imax, a, unit) => ({ toI, I0, Imax, a, unit });
const tempUp = (v) => v - PARAMS.skinBaseline, tempDown = (v) => PARAMS.skinBaseline - v;

const SKIN = ['indexTip', 'palm', 'forearmDorsal', 'umbilicus', 'footSole', 'heel', 'bigToe', 'foreheadV1', 'cheekV2', 'chinV3'];
const DERMATOMES = [
  ...['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
  ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
  ...['L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3'],
].map((s) => `dermatome.${s}`);   // §5.14: C2 … S3 (S4–S5 and perineal sites are not pickable, A.1)
const SKIN_SITES = [...SKIN, ...DERMATOMES];
const JOINTS = ['shoulder', 'elbow', 'wrist', 'finger', 'hip', 'knee', 'ankle'];
const TENDONS = ['bicepsTendon', 'tricepsTendon', 'patellarTendon', 'achillesTendon'];

export const SENSES = {
  vision: {
    label: 'Vision', brainOnly: true, sites: ['retina'],
    modes: {
      flash: { param: P('luminance', 'log10 cd/m²', -6, 5, 3), dur: D(10, 100, 10), psi: C((v) => 10 ** v, 1e-6, 1e5, 0.5, 'cd/m²') },
      step: { param: P('luminance', 'log10 cd/m²', -6, 5, 3), dur: D(100, 2000, 1000), psi: C((v) => 10 ** v, 1e-6, 1e5, 0.33, 'cd/m²') },
    },
  },
  hearing: {
    label: 'Hearing', brainOnly: true, sites: ['cochlea'],
    modes: {   // I = sound pressure re 20 µPa, p/p0 = 10^(L/20) (§5.13)
      click: { param: P('level', 'dB SPL', 0, 130, 70), dur: D(0.1, 0.1, 0.1), psi: C((v) => 10 ** (v / 20), 1, 10 ** (130 / 20), 0.67, 'p/p0') },
      tone: { param: P('level', 'dB SPL', 0, 130, 70), dur: D(10, 2000, 200), psi: C((v) => 10 ** (v / 20), 1, 10 ** (130 / 20), 0.67, 'p/p0'),
        extra: { freq: P('frequency', 'Hz', 125, 8000, 1000), riseMs: P('rise', 'ms', 0.5, 20, 5) } },
      noise: { param: P('level', 'dB SPL', 0, 130, 70), dur: D(10, 2000, 200), psi: C((v) => 10 ** (v / 20), 1, 10 ** (130 / 20), 0.67, 'p/p0'),
        extra: { riseMs: P('rise', 'ms', 0.5, 20, 5) } },
    },
  },
  touch: {
    label: 'Touch', brainOnly: false, sites: SKIN_SITES,
    modes: {
      press: { param: P('force', 'mN', 0.1, 10000, 50, { log: true }), dur: D(50, 5000, 1000), psi: C((v) => v, 0.7, 10000, 1.1, 'mN') },
      vibration: { param: P('amplitude', 'µm', 0.1, 1000, 10, { log: true }), dur: D(100, 5000, 1000), psi: C((v) => v, 0.3, 1000, 0.6, 'µm'),
        extra: { freq: P('frequency', 'Hz', 5, 400, 250) } },   // a 0.95 at ≤ 100 Hz, 0.6 above (§5.13): see psiExponent()
      stroke: { param: P('velocity', 'cm/s', 0.3, 30, 3), dur: D(500, 5000, 2000), psi: C((v) => v, 0.3, 30, 1.5, 'cm/s') },
    },
  },
  pain: {
    label: 'Pain', brainOnly: false, sites: SKIN_SITES,
    modes: {   // temperature continua are differences from the 32 °C baseline (§5.13)
      heat: { param: P('temperature', '°C', 42, 60, 50), dur: D(100, 5000, 1000), psi: C(tempUp, 45 - 32, 60 - 32, 1.0, 'ΔT °C') },
      cold: { param: P('temperature', '°C', 0, 15, 5), dur: D(1000, 30000, 5000), psi: C(tempDown, 32 - 10, 32, 1.0, 'ΔT °C') },
      pinprick: { param: P('force', 'mN', 8, 512, 256), dur: D(10, 100, 20), psi: C((v) => v, 80, 512, 1.0, 'mN') },
      pressure: { param: P('pressure', 'kPa', 100, 800, 500), dur: D(1000, 10000, 3000), psi: C((v) => v, 400, 800, 1.0, 'kPa') },
      itch: { param: P('itch', 'relative', 0, 1, 0.5), dur: D(1, 1, 1), psi: C((v) => v, 0.05, 1, 1.0, 'relative') },   // single event; I0 [model]
    },
  },
  temperature: {
    label: 'Temperature', brainOnly: false, sites: SKIN_SITES,
    modes: {
      warm: { param: P('temperature', '°C', 15, 45, 40), dur: D(1000, 60000, 10000), psi: C(tempUp, 1.5, 45 - 32, 1.6, 'ΔT °C'),
        extra: { ramp: P('ramp', '°C/s', 0.5, 5, 1) } },
      cool: { param: P('temperature', '°C', 15, 45, 25), dur: D(1000, 60000, 10000), psi: C(tempDown, 0.75, 32 - 15, 1.0, 'ΔT °C'),
        extra: { ramp: P('ramp', '°C/s', 0.5, 5, 1) } },
    },
  },
  smell: {
    label: 'Smell', brainOnly: true, sites: ['olfEpith'],
    modes: {
      odour: { param: P('concentration', 'log10 × threshold', 0, 8, 2), dur: D(200, 10000, 2000), psi: C((v) => 10 ** v, 1, 1e8, 0.6, '× threshold'),
        extra: { cls: P('class', '', 0, 0, 'food', { options: ['food', 'neutral', 'aversive'] }) } },
    },
  },
  taste: {
    label: 'Taste', brainOnly: true, sites: ['tongueAnt', 'tonguePost'],
    modes: Object.fromEntries([['sweet', 1.3], ['salty', 1.4], ['sour', 1.0], ['bitter', 1.0], ['umami', 1.0]].map(([m, a]) =>
      [m, { param: P('concentration', '× threshold', 0, 100, 10), dur: D(500, 10000, 2000), psi: C((v) => v, 1, 100, a, '× threshold') }])),
  },
  balance: {
    label: 'Balance', brainOnly: true, sites: ['vestLabyrinth'],
    modes: {   // rotation: 1-s ramp to the peak, hold, stop (A.6); psi on angular acceleration peak / 1 s (§5.13)
      rotation: { param: P('peak angular velocity', 'deg/s', 0, 300, 60), dur: D(1000, 60000, 10000), psi: C((v) => v / 1, 1, 300, 1.4, 'deg/s²'),
        extra: { axis: P('axis', '', 0, 0, 'yaw', { options: ['yaw', 'pitch', 'roll'] }) } },
      linear: { param: P('acceleration', 'm/s²', 0, 10, 1), dur: D(200, 5000, 1000), psi: C((v) => v, 0.075, 10, 1.0, 'm/s²') },
      tilt: { param: P('tilt', 'deg', 0, 30, 10), dur: D(1000, 60000, 10000),
        psi: C((v) => PARAMS.gravity * Math.sin((v * Math.PI) / 180), PARAMS.gravity * Math.sin(Math.PI / 180), PARAMS.gravity * Math.sin(Math.PI / 6), 1.0, 'm/s²') },
    },
  },
  proprioception: {
    label: 'Proprioception', brainOnly: false, sites: [...JOINTS, ...TENDONS],
    modes: {
      imposedMovement: { param: P('angle', 'deg', 0, 30, 5), dur: null, sites: JOINTS, psi: C((v) => v, 0.5, 30, 1.0, 'deg'),
        extra: { velocity: P('velocity', 'deg/s', 1, 100, 10) } },   // duration set by angle and velocity (§5.14)
      tendonTap: { param: P('stretch', 'mm', 0.5, 5, 2), dur: D(10, 10, 10), sites: TENDONS, psi: C((v) => v, 0.5, 5, 1.0, 'mm') },
    },
  },
  interoception: {
    label: 'Interoception', brainOnly: false,
    sites: ['carotidSinus', 'aorticArch', 'lungStretch', 'stomachWall', 'duodenum', 'colonRectum', 'bladder', 'carotidBody'],
    modes: {   // sensation thresholds belong to §5.11 (not yet wired): psi stays 0 (baroStep is never perceived)
      baroStep: { param: P('pressure step', 'mmHg', -40, 40, 20), dur: D(1000, 60000, 10000), sites: ['carotidSinus', 'aorticArch'], psi: C((v) => v, Infinity, 40, 1.0, 'mmHg') },
      lungInflation: { param: P('volume', 'L', 0, 3, 1), dur: D(10000, 300000, 60000), sites: ['lungStretch'], psi: C((v) => v, Infinity, 3, 1.0, 'L') },
      gastricDistension: { param: P('volume', 'mL', 0, 800, 200), dur: D(10000, 300000, 60000), sites: ['stomachWall'], psi: C((v) => v, Infinity, 800, 1.0, 'mL') },
      duodenalLipid: { param: P('lipid', 'kcal', 0, 100, 30), dur: D(10000, 300000, 60000), sites: ['duodenum'], psi: C((v) => v, Infinity, 100, 1.0, 'kcal') },
      colorectalDistension: { param: P('volume', 'mL', 0, 300, 100), dur: D(10000, 300000, 60000), sites: ['colonRectum'], psi: C((v) => v, Infinity, 300, 1.0, 'mL') },
      bladderFill: { param: P('volume', 'mL', 0, 600, 300), dur: D(10000, 300000, 60000), sites: ['bladder'], psi: C((v) => v, Infinity, 600, 1.0, 'mL') },
      co2: { param: P('ΔPaCO2', 'mmHg', 0, 20, 5), dur: D(30000, 600000, 120000), sites: ['carotidBody'], psi: C((v) => v, Infinity, 20, 1.0, 'mmHg') },
    },
  },
};
export const SENSE_IDS = Object.freeze(Object.keys(SENSES));   // A.6 fixed order
for (const [id, s] of Object.entries(SENSES)) s.id = id;

// --- Sites (A.3.3, §5.14, §2.3) ---
// Sense organs of the special senses: right-side position (§2.3), the port they feed (§3.14) and the
// route of their nerve from the organ to the brain attachment (§2.3, §2.12, §3.16; waypoints [model]
// where §2.12 gives only the stations). The left organ mirrors x.
export const SENSE_ORGANS = {
  retina: { pos: [33, 48, -38], port: 'portRetina', nerve: 'cn2', sides: SIDES_EYE,          // posterior pole → optic nerve head (cn2)
    route: [[33, 48, -38], [30, 48, -39]] },
  cochlea: { pos: [39, -22, -45], port: 'portCoch', nerve: 'cn8', sides: SIDES_EYE,          // → internal porus → cn8 attachment
    route: [[39, -22, -45], [22, -32, -42], [14.5, -32, -41]] },
  vestLabyrinth: { pos: [42, -28, -43], port: 'portVest', nerve: 'cn8', sides: ['both'],     // both labyrinths; the head is the target (A.6)
    route: [[42, -28, -43], [22, -32, -42], [14.5, -32, -41]] },
  olfEpith: { pos: [5, 45, -40], port: 'portOlf', nerve: 'cn1', sides: SIDES_EYE,            // fila through the cribriform plate → bulb
    route: [[5, 45, -40], [6, 40, -33], [8, 36, -27]] },
  tongueAnt: { pos: [12, 75, -97], port: 'portGust', nerve: 'cn7.special', sides: SIDES_LR,  // chorda tympani → porus → cn7
    route: [[12, 75, -97], [28, 40, -105], [35, 0, -70], [47, -27, -45], [22, -32, -42], [13, -29, -41]] },
  tonguePost: { pos: [12, 30, -100], port: 'portGust', nerve: 'cn9.special', sides: SIDES_LR, // → petrosal ganglion → jugular foramen → cn9
    route: [[12, 30, -100], [25, 10, -90], [30, -32, -62], [9.5, -33, -47]] },
};
const MIDLINE_SITES = new Set(['umbilicus', 'aorticArch', 'lungStretch', 'stomachWall', 'duodenum', 'colonRectum', 'bladder']);
// Afferent route and port of the body sites (§3.14, §5.15): trigeminal skin → portTrig, other skin →
// portDC / portSTT; joints and tendons → portDC; organs → portVisc / portSpinoVisc.
const TRIGEMINAL = new Set(['foreheadV1', 'cheekV2', 'chinV3']);
function siteKind(site) {
  if (site in SENSE_ORGANS) return 'special';
  if (SKIN_SITES.includes(site)) return 'skin';
  if (JOINTS.includes(site)) return 'joint';
  if (TENDONS.includes(site)) return 'tendon';
  if (SENSES.interoception.sites.includes(site)) return 'organ';
  return null;
}
function sitePorts(site, kind) {
  if (kind === 'special') return [SENSE_ORGANS[site].port];
  if (kind === 'skin') return TRIGEMINAL.has(site) ? ['portTrig'] : ['portDC', 'portSTT'];
  if (kind === 'joint' || kind === 'tendon') return ['portDC'];
  if (kind === 'organ') return ['bladder', 'colonRectum'].includes(site) ? ['portSpinoVisc'] : ['portVisc'];
  return [];
}

// --- Receptor classes (§5.2–§5.10; filter forms §4.7, Naka–Rushton §4.8) ---
// I0 and Imax on the class's own continuum (Imax: top of the dynamic range; half-saturation at the
// geometric centre, §5.1), n Naka–Rushton exponent (Table 4.8c, 1–3 [model]), τA s and kA (§4.7),
// form SA (subtractive) or RA (rectified on/off), tRec transduction delay s (§5.1), w weight onto the
// port, rmax and rSpont Hz. `nodes: true` classes get receptor nodes in the brain fragment (special
// senses, brain-only capable, A.6); the others are declared for the body fragments (B.15 phase 4–5),
// which create nodes { kind: 'receptor', site, cls } that sensory.js then drives.
const R = (o) => ({ n: 1, form: 'SA', tauA: [1], kA: 0.5, w: 1, rmax: 100, rSpont: 2, tRec: 0.001, ...o });
export const RECEPTORS = {
  // Vision (§5.2): cones I0 10⁻³–10⁻² cd/m² (10^−2.5 [model]); rods I0 10⁻⁶, saturation 10²; τA cones
  // 0.1 s, rods 1 s; ipRGC kA ≈ 0.1. RGC first spike 20–40 ms photopic (tRec 25 ms [model]);
  // scotopic +50–100 ms (+75 [model]). ipRGC I0 10 cd/m² and tRec 0.3 s [model]. Weights onto the
  // optic nerve 0.7 / 0.7 / 0.3 [model].
  cone: R({ sense: 'vision', site: 'retina', modes: ['flash', 'step'], I0: 10 ** -2.5, Imax: 1e5, tauA: [0.1], kA: 0.8, tRec: 0.025, w: 0.7, nodes: true }),
  rod: R({ sense: 'vision', site: 'retina', modes: ['flash', 'step'], I0: 1e-6, Imax: 1e2, tauA: [1], kA: 0.8, tRec: 0.025, tRecScotopic: 0.075, w: 0.7, nodes: true }),
  ip: R({ sense: 'vision', site: 'retina', modes: ['flash', 'step'], I0: 10, Imax: 1e5, tauA: [1], kA: 0.1, tRec: 0.3, w: 0.3, nodes: true }),
  // Hearing (§5.3): pressure ratio re 20 µPa; population over 0–120 dB (range fractionation, §5.1);
  // AN adaptation rapid 1–5 ms / short-term 30–70 ms (3 / 50 [model]), kA 0.6 [model]; cochlear
  // transduction ≈ 1 ms; spontaneous rate 30 Hz and rmax 300 Hz [model].
  an: R({ sense: 'hearing', site: 'cochlea', modes: ['click', 'tone', 'noise'], I0: 1, Imax: 1e6, tauA: [0.003, 0.05], kA: 0.6, rmax: 300, rSpont: 30, tRec: 0.001, nodes: true }),
  // Balance (§5.9): canal afferent resting rate ≈ 90 Hz; high-pass τ 5 s; velocity storage 15 s (A.8
  // #15); hair-cell transduction < 1 ms. Gain 2 Hz per deg/s (irregular afferents) and weight 2 onto the port [model].
  canal: R({ sense: 'balance', site: 'vestLabyrinth', modes: ['rotation'], form: 'canal', I0: 0, Imax: 300, rmax: 300, rSpont: 90, gain: 2, tauHP: 5, tauVS: 15, tRec: 0.001, w: 2, nodes: true }),
  otoReg: R({ sense: 'balance', site: 'vestLabyrinth', modes: ['linear', 'tilt'], I0: 0.075, Imax: 10, tauA: [1], kA: 0.1, rmax: 300, rSpont: 90, tRec: 0.001, nodes: true }),
  otoIrr: R({ sense: 'balance', site: 'vestLabyrinth', modes: ['linear', 'tilt'], I0: 0.075, Imax: 10, tauA: [1], kA: 0.6, rmax: 300, rSpont: 90, tRec: 0.001, nodes: true }),
  // Smell (§5.7): I0 1 × threshold, dynamic range 1–2 decades (1.5 [model]); τA 5 s, kA 0.7; ORN
  // onset 100–400 ms (150 [model]); unmyelinated ORN axons (C).
  orn: R({ sense: 'smell', site: 'olfEpith', modes: ['odour'], I0: 1, Imax: 10 ** 1.5, tauA: [5], kA: 0.7, tRec: 0.15, fibre: 'C', nodes: true }),
  // Taste (§5.8): I0 1 × threshold, ≈ 2 decades; perceptual adaptation 0.5–2 min (τA 60 s, kA 0.5
  // [model]); tastant transduction 50–200 ms: 70 ms salty and sour, 150 ms sweet, bitter, umami
  // [model, fits gust onsets ≈ 93 / ≈ 172 ms]; gustatory afferents Aδ [model].
  taste: R({ sense: 'taste', site: ['tongueAnt', 'tonguePost'], modes: ['sweet', 'salty', 'sour', 'bitter', 'umami'], I0: 1, Imax: 100, tauA: [60], kA: 0.5,
    tRec: 0.15, tRecMode: { salty: 0.07, sour: 0.07 }, fibre: 'Adelta', nodes: true }),

  // Body classes (declared for B.15 phase 4–5). Touch §5.4: I0 RA1 / SA1 / PC / SA2 0.6 / 1.3 / 0.5 /
  // 7.5 mN, ≈ 2 decades; τA SA1 1.5 s (kA 0.6), SA2 10 s (kA 0.2), RA1 30 ms, PC 5 ms; CT I0 < 5 mN,
  // τA 1 s, kA 0.5. Pain §5.5: AMH II ≈ 46 °C, AMH I > 53 °C, C polymodal 43–45 °C; τA 10 s, kA 0.3;
  // range ≈ 8 °C. Temperature §5.6: τA 30 s, kA 0.7; detection +1–2 / −0.5…−1 °C. Proprioception
  // §5.10: Ia τA 0.2 s kA 0.5, II 2 s 0.2, Ib 1 s 0.3. Heat transduction uses the §11.9 contact model.
  SA1: R({ sense: 'touch', modes: ['press', 'vibration'], I0: 1.3, Imax: 130, tauA: [1.5], kA: 0.6, fibre: 'Abeta', rmax: 300 }),
  RA1: R({ sense: 'touch', modes: ['press', 'vibration', 'stroke'], form: 'RA', I0: 0.6, Imax: 60, tauA: [0.03], fibre: 'Abeta', rmax: 300 }),
  PC: R({ sense: 'touch', modes: ['press', 'vibration'], form: 'RA', I0: 0.5, Imax: 50, tauA: [0.005], fibre: 'Abeta', rmax: 300 }),
  SA2: R({ sense: 'touch', modes: ['press'], I0: 7.5, Imax: 750, tauA: [10], kA: 0.2, fibre: 'Abeta', rmax: 300 }),
  CT: R({ sense: 'touch', modes: ['stroke', 'press'], I0: 5, Imax: 500, tauA: [1], kA: 0.5, fibre: 'CT', rmax: 30 }),
  AMH2: R({ sense: 'pain', modes: ['heat'], I0: 46, Imax: 54, tauA: [10], kA: 0.3, fibre: 'Adelta', tRecModel: 'contactHeat' }),
  AMH1: R({ sense: 'pain', modes: ['heat', 'pinprick', 'pressure'], I0: 53, Imax: 61, tauA: [10], kA: 0.3, fibre: 'Adelta', tRecModel: 'contactHeat' }),
  Cpoly: R({ sense: 'pain', modes: ['heat', 'pressure', 'itch'], I0: 44, Imax: 52, tauA: [10], kA: 0.3, fibre: 'C', rmax: 30, tRecModel: 'contactHeat' }),
  // Thermoreceptors under contact heat (§11.9) reach their own threshold at the terminal: the paradoxical
  // cold discharge above 45 °C (§5.6), warm fibres at skin + I0 [model].
  cold: R({ sense: 'temperature', modes: ['cool', 'cold', 'heat'], I0: 0.75, Imax: 17, tauA: [30], kA: 0.7, fibre: 'Adelta', tRecModel: 'contactHeat', thetaHeat: 45 }),
  warm: R({ sense: 'temperature', modes: ['warm', 'heat'], I0: 1.5, Imax: 13, tauA: [30], kA: 0.7, fibre: 'C', rmax: 30, tRecModel: 'contactHeat', thetaHeat: 33.5 }),
  Ia: R({ sense: 'proprioception', modes: ['tendonTap', 'imposedMovement'], I0: 0.5, Imax: 50, tauA: [0.2], kA: 0.5, fibre: 'Ia', rmax: 300 }),
  II: R({ sense: 'proprioception', modes: ['imposedMovement'], I0: 0.5, Imax: 50, tauA: [2], kA: 0.2, fibre: 'II', rmax: 300 }),
  Ib: R({ sense: 'proprioception', modes: ['imposedMovement', 'tendonTap'], I0: 0.5, Imax: 50, tauA: [1], kA: 0.3, fibre: 'Ib', rmax: 300 }),
};
export const SPECIAL_CLASSES = Object.freeze(Object.keys(RECEPTORS).filter((c) => RECEPTORS[c].nodes));

// Receptor classes present at a site (special senses: from the table; body sites: by sense).
export function classesAt(site) {
  const kind = siteKind(site);
  if (!kind) return [];
  return Object.keys(RECEPTORS).filter((c) => {
    const r = RECEPTORS[c];
    if (r.nodes) return Array.isArray(r.site) ? r.site.includes(site) : r.site === site;
    if (kind === 'skin') return ['touch', 'pain', 'temperature'].includes(r.sense);
    if (kind === 'joint' || kind === 'tendon') return r.sense === 'proprioception';
    return false;
  });
}

// --- Helpers ---
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const normSense = (sense) => { const S = SENSES[sense]; if (!S) throw new Error(`stimuli: unknown sense '${sense}'`); return S; };

// Mode exponent; touch vibration uses 0.95 at ≤ 100 Hz and 0.6 above (§5.13).
export function psiExponent(rec) {
  const M = SENSES[rec.sense]?.modes[rec.mode];
  if (!M) return 1;
  if (rec.sense === 'touch' && rec.mode === 'vibration') return (rec.params?.freq ?? 250) <= 100 ? 0.95 : 0.6;
  return M.psi.a;
}

// Physical value of the record on its mode's psi continuum.
export function continuum(rec) {
  const M = normSense(rec.sense).modes[rec.mode];
  if (!M) throw new Error(`stimuli: unknown mode '${rec.mode}' for ${rec.sense}`);
  return { I: M.psi.toI(rec.intensity, rec.params ?? {}), I0: M.psi.I0, Imax: M.psi.Imax, a: psiExponent(rec), unit: M.psi.unit };
}

// Physical value on a receptor class's own continuum, or null if the class ignores this stimulus.
export function classIntensity(cls, rec) {
  const R0 = RECEPTORS[cls];
  if (!R0 || !R0.modes.includes(rec.mode)) return null;
  const v = rec.intensity, p = rec.params ?? {};
  switch (rec.sense) {
    case 'vision': return 10 ** v;
    case 'hearing': return 10 ** (v / 20);
    case 'smell': return 10 ** v;
    case 'taste': return v;
    case 'balance':
      if (rec.mode === 'rotation') return v;
      return rec.mode === 'tilt' ? PARAMS.gravity * Math.sin((v * Math.PI) / 180) : v;
    case 'pain':
      if (rec.mode === 'heat') return cls === 'cold' ? (v > 45 ? v - 45 + R0.I0 : null) : (cls === 'warm' ? v - PARAMS.skinBaseline : v);   // paradoxical cold > 45 °C (§5.6)
      if (rec.mode === 'cold') return cls === 'cold' ? PARAMS.skinBaseline - v : null;
      return v;
    case 'temperature': return rec.mode === 'warm' ? v - PARAMS.skinBaseline : PARAMS.skinBaseline - v;
    case 'touch': return rec.mode === 'stroke' ? (p.force ?? 50) : v;   // stroke drives LTMRs at a light contact force (50 mN [model])
    case 'proprioception': return v;
    default: return null;
  }
}

// Inverse of the complementary error function on (0, 2): Newton steps on the kernel's erfc
// (Abramowitz–Stegun 7.1.26) from x0 = 0; |erfc(x) − y| < 1e-12 after ≤ 30 steps.
function erfcinv(y) {
  let x = 0;
  for (let i = 0; i < 30; i++) {
    const f = erfc(x) - y;
    if (Math.abs(f) < 1e-12) break;
    x += f / ((2 / Math.sqrt(Math.PI)) * Math.exp(-x * x));   // d erfc/dx = −2/√π · e^(−x²)
  }
  return x;
}

// §11.9 contact heat: time after contact at which the terminal at depth d reaches θ (s; θ_heat 43 °C
// for the heat nociceptors, a class's own thetaHeat otherwise), or Infinity when the contact
// temperature T_c (the record intensity, °C) does not exceed θ.
export function contactHeatTime(tempC, p = PARAMS.contactHeat, theta = p.theta) {
  if (!(tempC > theta)) return Infinity;
  const x = erfcinv((theta - p.tSkin) / (tempC - p.tSkin));
  return (p.depth / (2 * x)) ** 2 / p.alpha;
}

// Transduction delay of a class for this record (§5.1); contact heat for the heat nociceptors (§11.9).
export function tRec(cls, rec) {
  const R0 = RECEPTORS[cls];
  if (!R0) return 0;
  if (R0.tRecModel === 'contactHeat' && rec.mode === 'heat') return contactHeatTime(rec.intensity, PARAMS.contactHeat, R0.thetaHeat ?? PARAMS.contactHeat.theta);
  let t = R0.tRecMode?.[rec.mode] ?? R0.tRec;
  if (R0.tRecScotopic && rec.sense === 'vision' && 10 ** rec.intensity < RECEPTORS.cone.I0) t += R0.tRecScotopic;
  return t;
}

// §3.12 class weight c and §5.16 valence.
export function salienceClass(rec) {
  const S = PARAMS.salience, p = rec.params ?? {};
  const { I, I0 } = continuum(rec);
  switch (rec.sense) {
    case 'pain': return { c: I > I0 ? S.noxious : S.innocuous, valence: 'aversive' };
    case 'hearing': return rec.intensity >= S.loudDb ? { c: S.loud, valence: 'aversive' } : { c: S.innocuous, valence: 'neutral' };
    case 'smell':
      if (p.cls === 'aversive') return { c: S.aversiveOdour, valence: 'aversive' };
      return p.cls === 'food' ? { c: S.food, valence: 'appetitive' } : { c: S.innocuous, valence: 'neutral' };
    case 'vision': return { c: rec.intensity >= S.brightLog ? S.brightFlash : S.innocuous, valence: 'neutral' };
    case 'taste': return { c: S.food, valence: rec.mode === 'bitter' ? 'aversive' : (rec.mode === 'sweet' || rec.mode === 'umami' ? 'appetitive' : 'neutral') };
    case 'interoception': return { c: I > I0 ? S.intero : S.innocuous, valence: 'neutral' };
    case 'touch': return { c: S.innocuous, valence: rec.mode === 'stroke' ? 'appetitive' : 'neutral' };
    default: return { c: S.innocuous, valence: 'neutral' };
  }
}

// --- Sites ---
// Valid site ids for a sense (and mode); in brain-only mode only the special senses (A.6, §11.9).
/** @param {string} sense @param {import('./contracts').SiteQuery} [opts] @returns {string[]} */
export function validSites(sense, { bodyMode = 'body', mode = null } = {}) {
  const S = normSense(sense);
  if (bodyMode === 'brain' && !S.brainOnly) return [];
  const M = mode ? S.modes[mode] : null;
  if (mode && !M) throw new Error(`stimuli: unknown mode '${mode}' for ${sense}`);
  return [...(M?.sites ?? S.sites)];
}

// Resolve a site for a sense: kind, normalised side, the sides to drive, nerve, ports and (special
// senses) the right-side organ position. null when the site is invalid for the sense, mode or mode
// of the body, or the side is not allowed.
/** @param {string} site @param {import('./contracts').SiteQuery} [opts] */
export function resolveSite(site, { sense = null, mode = null, side, bodyMode = 'body' } = {}) {
  const kind = siteKind(site);
  if (!kind) return null;
  if (sense && !validSites(sense, { bodyMode, mode }).includes(site)) return null;
  if (bodyMode === 'brain' && kind !== 'special') return null;
  let sides, s = side;
  if (kind === 'special') {
    const allowed = SENSE_ORGANS[site].sides;
    if (s == null) s = allowed.includes('both') ? 'both' : 'R';
    if (!allowed.includes(s)) return null;
    sides = s === 'both' ? ['R', 'L'] : [s];
  } else if (MIDLINE_SITES.has(site)) {
    if (s != null && s !== 'both') return null;
    s = null; sides = [null];
  } else {
    if (s == null) s = 'R';
    if (!SIDES_LR.includes(s)) return null;
    sides = [s];
  }
  const org = SENSE_ORGANS[site];
  return { site, kind, side: s, sides, special: kind === 'special', nerve: org?.nerve ?? null, ports: sitePorts(site, kind),
    pos: org ? [...org.pos] : null, classes: classesAt(site) };
}

// Build a validated A.6 record with §5.14 defaults and clamped ranges.
/** @param {import('./contracts').StimulusSpec} spec */
export function makeStimulus({ sense, mode, site, side, intensity, durationMs, tOnset = 0, params = {} } = /** @type {any} */ ({})) {
  const S = normSense(sense);
  const m = mode ?? Object.keys(S.modes)[0];
  const M = S.modes[m];
  if (!M) throw new Error(`stimuli: unknown mode '${m}' for ${sense}`);
  const sites = validSites(sense, { mode: m });
  const st = site ?? sites[0];
  if (!sites.includes(st)) throw new Error(`stimuli: site '${st}' is not valid for ${sense} ${m}`);
  const res = resolveSite(st, { sense, mode: m, side });
  if (!res) throw new Error(`stimuli: side '${side}' is not valid at ${st}`);
  const pm = M.param;
  const I = clamp(Number.isFinite(intensity) ? intensity : pm.def, pm.min, pm.max);
  const out = {};
  for (const [k, spec] of Object.entries(M.extra ?? {})) {
    const v = params[k];
    if (spec.options) out[k] = spec.options.includes(v) ? v : spec.def;
    else out[k] = clamp(Number.isFinite(v) ? v : spec.def, spec.min, spec.max);
  }
  for (const [k, v] of Object.entries(params)) if (!(k in out)) out[k] = v;   // pass-through (e.g. touch stroke force)
  let dur;
  if (M.dur) dur = clamp(Number.isFinite(durationMs) ? durationMs : M.dur.def, M.dur.min, M.dur.max);
  else dur = (1000 * I) / out.velocity;   // imposed movement: angle / velocity
  return { sense, mode: m, site: st, side: res.side, intensity: I, unit: pm.unit, durationMs: dur, tOnset, params: out };
}

// --- Analytic arrival-time overlay (§4.14) ---
// Dijkstra from the stimulated receptor nodes over the active subgraph (edges whose networks are all
// on and that no intervention cuts), per receptor class, with edge weights d_e (§4.4). t_rec is added
// at the source; with { relay: true } each intermediate rate unit adds 0.71·τ (§4.11 relay term for a
// saturated relay, w 1, θ 0.5), which is the comparison with the NF layer. Inhibitory, modulatory
// (|w| < 0.25) and layer (volume, blood) edges carry no arrival.
//   src: a Kernel (switches and cuts from its state) or a built graph (with opts.nets, opts.bodyMode).
//   → { [nodeId]: { t, tEV, cls, source, hops } }  (t in s from tOnset; earliest class first)
export function predictArrivals(src, rec, { targets = null, relay = false, nets = NET_IDS, bodyMode = 'body' } = {}) {
  const k = src && src.graph && typeof src.edgeGate === 'function' ? src : null;
  const g = k ? k.graph : src;
  const netsOn = new Set(nets);
  const gate = (e) => {
    if (k) return k.edgeGate(e.i) > 0;
    if ((e.nets & BODY_BIT) && bodyMode === 'brain') return false;
    for (const n of NET_IDS) if ((e.nets & NET[n]) && !netsOn.has(n)) return false;
    return true;
  };
  const res = resolveSite(rec.site, { sense: rec.sense, mode: rec.mode, side: rec.side, bodyMode: k ? k.bodyMode : bodyMode });
  if (!res) return {};
  const lagOf = (n) => (relay ? (n.tau > 0 ? n.tau * Math.log(PARAMS.relayAFin / (PARAMS.relayAFin - PARAMS.relayTheta)) : 0) : 0);
  const sources = g.nodes.filter((n) => n.kind === 'receptor' && n.site === rec.site && res.sides.includes(n.side ?? null)
    && (() => { const I = classIntensity(n.cls, rec); return I !== null && (RECEPTORS[n.cls].form === 'canal' ? I !== 0 : I > RECEPTORS[n.cls].I0); })());
  const best = new Map();
  const N = g.nodes.length;
  for (const s of sources) {
    const t0 = tRec(s.cls, rec);
    const dist = new Float64Array(N).fill(Infinity), ev = new Float64Array(N).fill(Infinity), hops = new Int32Array(N);
    const done = new Uint8Array(N);
    dist[s.i] = t0; ev[s.i] = t0;
    for (;;) {
      let u = -1, du = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }   // O(N²); N ≈ 10³ is well under 1 ms per class at this size
      if (u < 0) break;
      done[u] = 1;
      const lag = lagOf(g.nodes[u]);   // the receptor output stage counts as a rate unit too (τ 0.5 ms, Table 4.13a)
      for (let q = g.outOff[u]; q < g.outOff[u + 1]; q++) {
        const e = g.edges[g.outEdge[q]];
        if (e.w < PARAMS.arrivalMinW || e.transport === 'layer' || !gate(e)) continue;
        const d = du + lag + e.delay;
        if (d < dist[e.to]) { dist[e.to] = d; ev[e.to] = ev[u] + e.delay; hops[e.to] = hops[u] + 1; }
      }
    }
    for (let i = 0; i < N; i++) {
      if (!Number.isFinite(dist[i])) continue;
      const id = g.nodes[i].id;
      if (targets && !targets.includes(id)) continue;
      const cur = best.get(id);
      if (!cur || dist[i] < cur.t) best.set(id, { t: dist[i], tEV: ev[i], cls: s.cls, source: s.id, hops: hops[i] });
    }
  }
  return Object.fromEntries(best);
}
