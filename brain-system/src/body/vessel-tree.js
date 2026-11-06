// @ts-check
// Vascular tree (research/PULSE.md §9): the named arteries and veins as polylines in the body frame
// (mm; x right, y anterior, z superior), each point with its radius, plus a deterministic branching
// of small side branches (twigs). Every artery point carries its foot-to-foot arrival delay from the
// aortic valve opening (path length ÷ pulse wave velocity, PULSE.md §2 and §4) and its pulse
// amplitude relative to the aortic root (§3). Shared by the star generator (body/generate.js), the
// pulse model (pulse.js) and the body shader (shaders.js), so it has no heavy imports: the twig
// builder takes the inside test as an argument.
//
// Vessel stars carry three numbers in the normal slot (unused by the vessel class before):
//   x: arrival delay at rest (s after the aortic valve opens; −1 = no pulse);
//   y: the part code (VPART);
//   z: the pulse amplitude A (pulse pressure ÷ aortic pulse pressure, damped in the twigs).

import { mulberry32 } from '../anatomy.js';
import { HEART_FORM } from './heart-form.js';
import { buildAirwayTree } from './airway-tree.js';

// Part codes (normal slot y): the tree is 1–7, the earlier great-vessel stars 8–9 (PULSE.md §13.6).
export const VPART = { EARLIER: 0, ARTERY: 1, ARTERY_TWIG: 2, VEIN: 3, VEIN_TWIG: 4, CAPILLARY: 5, PULM_ARTERY: 6, PULM_VEIN: 7,
  EARLIER_ARTERY: 8, EARLIER_VEIN: 9 };

export const TREE = {
  // Twigs (PULSE.md §9) [model]: side branches every `spacing` mm of a vessel no wider than
  // `maxParentR`, `length` mm long (shorter off small parents), leaving at `angle` degrees from the
  // parent's direction, radius `ratio` × the parent's (Murray: the parent keeps (r³ − r_c³)^⅓), in
  // `steps` bends of ≤ `bend` degrees; `sub` second-generation twigs per twig at `subScale` of its
  // radius and length. The pulse is damped to `amp` × the parent's amplitude per generation.
  // Twigs go `levels` generations deep (§13).
  twig: { spacing: [25, 45], length: [15, 45], maxParentR: 6, angle: [35, 75], ratio: [0.45, 0.6], steps: 4, bend: 20,
    sub: [1, 2], subScale: 0.6, amp: [0.55, 0.25, 0.12], levels: 3, pwv: 10, minR: 0.35, skinGap: 2 },
  // A.1: no twigs near the midline of the pelvis (the pelvic box of the content rules).
  pelvicBox: { x: 60, z: [-900, -640] },
  // Organ trees (§13.3) [model]: dichotomous branching, the larger child `ratio` × the parent radius
  // and the other by Murray ((1 − γ³)^⅓), children `lenRatio` × the parent length, `angle` degrees off
  // the parent, each generation in a plane turned ≈ 90°. The heart is carved out of the lungs.
  organ: { ratio: [0.75, 0.85], lenRatio: [0.7, 0.85], angle: [22, 42], pwv: 10, pulmPwv: 2.0, pulmAmp: 0.38, pulmDelay: 0.025,
    heart: { c: [-30, 15, -345], r: 58 }, shrink: 3,
    // Pulmonary arteries in the bronchovascular bundles (research/LUNGS.md §2.5, §7.2) [model]: one
    // beside each airway branch from the lobar bronchi to generation `pulmGen`, `pulmCal` × the airway's
    // lumen radius, `pulmGap` mm clear of its wall.
    pulmGen: 8, pulmCal: 0.9, pulmGap: 1 },
  // Capillary beds (§13.4) [model]: strands (random walks of `steps` × `step` mm, turning by up to
  // `spread`) from each terminal arterial tip, `n` per bed, drawn `width` mm wide; saturation `from`
  // at the arteriole to `to` at the venule (the organ's venous saturation; the lungs run the other way).
  bed: {
    tissue: { n: [5, 7], steps: 3, step: 1.6, spread: 1.1, from: 0.98, to: 0.72, width: 0.35 },
    muscle: { n: [5, 7], steps: 3, step: 2.0, spread: 0.6, from: 0.98, to: 0.65, width: 0.35 },
    brain: { n: [5, 7], steps: 3, step: 1.3, spread: 1.2, from: 0.98, to: 0.65, width: 0.3 },
    kidney: { n: [6, 8], steps: 4, step: 0.5, spread: 2.2, from: 0.98, to: 0.95, width: 0.2 },   // glomerular tufts
    liver: { n: [5, 7], steps: 3, step: 1.6, spread: 1.2, from: 0.9, to: 0.7, width: 0.35 },
    spleen: { n: [5, 6], steps: 3, step: 1.4, spread: 1.2, from: 0.98, to: 0.75, width: 0.3 },
    gut: { n: [4, 5], steps: 3, step: 1.2, spread: 0.9, from: 0.98, to: 0.7, width: 0.3 },
    lung: { n: [6, 8], steps: 3, step: 2.0, spread: 1.3, from: 0.75, to: 0.98, width: 0.4 },
  },
  brain: { c: [0, -15, 12], r: [62, 82, 60] },   // [model] the brain's envelope for the bed type
  vasa: { minR: 6, every: 30, steps: 6, step: 4, r: 0.35, amp: 0.3 },   // vasa vasorum on the aorta and the venae cavae
  periodicAmp: 0.5,                     // intercostal and lumbar pulse damping (§13.6)
  valves: { every: [35, 50], veins: ['cephalic', 'basilic', 'greatSaphenous', 'smallSaphenous', 'femoralV', 'poplitealV',
    'brachialV', 'axillaryV', 'anteriorTibialV', 'posteriorTibialV', 'radialV', 'ulnarV', 'medianAntebrachial'] },
  // Deep veins doubled as venae comitantes: [artery, the vein it joins].
  comitantes: [['radial', 'radialV'], ['ulnar', 'ulnarV'], ['brachial', 'brachialV'], ['anteriorTibial', 'anteriorTibialV'],
    ['posteriorTibial', 'posteriorTibialV'], ['peroneal', 'posteriorTibialV'], ['profundaFemoris', 'femoralV'], ['antInterosseous', 'ulnarV']],
};

// Named vessels. `sided`: right-side coordinates, built for both sides (x mirrored); otherwise `side`
// (0 unpaired, ±1 one side only). `from`: the parent vessel (resolved on the same side first); the
// first point is joined to the nearest point of the parent. Rows are [x, y, z, radius]. `pwv`: m/s
// (one value, or one per point); `amp`: pulse amplitude at the end (the start takes the parent's).
/** @typedef {{ id: string, side?: number, sided?: boolean, from?: string, pwv?: number | number[], amp0?: number, amp?: number,
 *   twigs?: boolean, vein?: boolean, sinus?: { len: number, k: number }, pts: number[][] }} VesselDef */
/** @type {VesselDef[]} */
const ARTERIES = [
  // The aortic root bulges in three sinuses of Valsalva (`sinus`: over `len` mm, up to k × r, §13.1).
  { id: 'aorta', side: 0, amp0: 1, amp: 1.15, twigs: false, sinus: { len: 20, k: 0.22 },
    pwv: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 5, 5.5, 5.5, 6, 6.5, 6.5, 6.5, 6.5],
    pts: [[11, 3, -321, 14], [-4, 8, -306, 13.5], [0, 9, -284, 13.5], [2, 8, -272, 13.5], [-6, 2, -258, 13], [-20, -8, -252, 12.5],
      [-26, -26, -265, 12], [-26, -40, -295, 12], [-24, -52, -380, 11.5], [-8, -20, -460, 11], [-5, 2, -470, 10.5], [-7, 7, -500, 10],
      [-6, 13, -552, 9.5], [-5, 7, -590, 8.5]] },
  // Arch branches: brachiocephalic trunk (right subclavian and common carotid), left common carotid,
  // left subclavian.
  { id: 'bct', side: 1, from: 'aorta', pwv: 5.5, amp: 1.03, pts: [[8, 6, -245, 6.5], [18, 8, -230, 6.2]] },
  { id: 'subclavian', side: 1, from: 'bct', pwv: 7, amp: 1.15, pts: [[30, 4, -222, 4.5], [48, -4, -214, 4.4], [66, -10, -214, 4.2], [84, -16, -222, 4]] },
  { id: 'subclavian', side: -1, from: 'aorta', pwv: 7, amp: 1.15,
    pts: [[-30, -30, -245, 4.6], [-34, -18, -225, 4.5], [-48, -6, -214, 4.4], [-66, -10, -214, 4.2], [-84, -16, -222, 4]] },
  { id: 'cca', side: 1, from: 'bct', pwv: 6, amp: 1.05, pts: [[24, 8, -215, 3.6], [26, 7, -180, 3.5], [26, 6, -150, 3.4], [27, 6, -120, 3.3]] },
  { id: 'cca', side: -1, from: 'aorta', pwv: 6, amp: 1.05,
    pts: [[-18, -6, -240, 3.6], [-22, 2, -215, 3.6], [-25, 7, -180, 3.5], [-26, 6, -150, 3.4], [-27, 6, -120, 3.3]] },
  // Head and neck.
  { id: 'ica', sided: true, from: 'cca', pwv: 6.5, amp: 1.05,
    pts: [[28, 2, -105, 2.7], [28, -6, -85, 2.6], [25, -14, -64, 2.5], [20, -10, -48, 2.4], [15, -2, -36, 2.3], [13, 0, -26, 2.2]] },
  { id: 'eca', sided: true, from: 'cca', pwv: 7, amp: 1.1, pts: [[30, 12, -110, 2.2], [36, 8, -90, 1.9], [44, -4, -74, 1.7], [62, -14, -55, 1.5]] },
  { id: 'sta', sided: true, from: 'eca', pwv: 8, amp: 1.15, pts: [[68, -14, -40, 1.2], [68, -8, -15, 1], [62, 4, 15, 0.9], [50, 20, 45, 0.8]] },
  { id: 'facial', sided: true, from: 'eca', pwv: 8, amp: 1.15, pts: [[38, 28, -128, 1.3], [40, 40, -133, 1.2], [40, 58, -118, 1.1], [32, 70, -100, 1], [22, 74, -72, 0.9]] },
  { id: 'maxillary', sided: true, from: 'eca', pwv: 8, amp: 1.1, pts: [[45, 4, -82, 1.4], [40, 18, -72, 1.2], [32, 30, -64, 1]] },
  { id: 'vertebral', sided: true, from: 'subclavian', pwv: 6.5, amp: 1.05,
    pts: [[36, -8, -205, 2], [30, -22, -175, 2], [30, -26, -130, 1.9], [32, -30, -95, 1.9], [26, -40, -78, 1.8], [10, -36, -64, 1.8], [3, -28, -54, 1.8]] },
  { id: 'basilar', side: 0, from: 'vertebral.R', pwv: 7, amp: 1.05, pts: [[0, -26, -50, 1.6], [0, -22, -40, 1.6], [0, -16, -28, 1.5]] },
  { id: 'pca', sided: true, from: 'basilar', pwv: 7, amp: 1.05, pts: [[8, -18, -27, 1.1], [16, -26, -24, 1], [24, -40, -18, 0.9], [26, -60, -8, 0.85], [20, -80, 2, 0.8]] },
  { id: 'mca', sided: true, from: 'ica', pwv: 7, amp: 1.05, pts: [[22, 2, -24, 1.5], [34, 2, -20, 1.4], [46, -2, -12, 1.3], [54, -6, 0, 1.2]] },
  { id: 'mcaSup', sided: true, from: 'mca', pwv: 7, amp: 1.05, pts: [[56, 4, 15, 0.9], [54, 16, 35, 0.8], [46, 24, 52, 0.7]] },
  { id: 'mcaInf', sided: true, from: 'mca', pwv: 7, amp: 1.05, pts: [[58, -18, 5, 0.9], [57, -36, 15, 0.8], [52, -52, 28, 0.7]] },
  { id: 'aca', sided: true, from: 'ica', pwv: 7, amp: 1.05,
    pts: [[8, 8, -22, 1.1], [3, 16, -16, 1], [3, 30, -4, 1], [3, 34, 14, 0.95], [3, 24, 34, 0.9], [3, 4, 46, 0.85], [3, -22, 48, 0.8], [3, -46, 36, 0.75]] },
  { id: 'pcomm', sided: true, from: 'ica', pwv: 7, amp: 1.05, twigs: false, pts: [[13, -8, -26, 0.7], [15, -20, -25, 0.7]] },
  // Upper limb.
  { id: 'axillary', sided: true, from: 'subclavian', pwv: 7.5, amp: 1.25, pts: [[100, -18, -235, 3.6], [125, -18, -255, 3.4], [148, -16, -280, 3.2], [160, -14, -310, 3]] },
  { id: 'brachial', sided: true, from: 'axillary', pwv: 8.5, amp: 1.35,
    pts: [[165, -10, -340, 2.8], [170, -6, -400, 2.6], [176, -4, -460, 2.4], [184, -2, -520, 2.3], [190, -4, -560, 2.2], [194, -6, -585, 2.1]] },
  { id: 'radial', sided: true, from: 'brachial', pwv: 9.5, amp: 1.5,
    pts: [[202, -4, -610, 1.6], [220, -4, -680, 1.5], [236, -8, -760, 1.45], [246, -8, -805, 1.4], [252, -14, -828, 1.3]] },
  { id: 'ulnar', sided: true, from: 'brachial', pwv: 9.5, amp: 1.5,
    pts: [[192, -6, -605, 1.7], [196, -10, -680, 1.6], [206, -12, -760, 1.5], [215, -10, -805, 1.45], [222, -10, -840, 1.3]] },
  { id: 'palmarSup', sided: true, from: 'ulnar', pwv: 9.5, amp: 1.5, pts: [[228, -6, -862, 1.1], [240, -4, -870, 1], [252, -6, -866, 0.9], [258, -8, -856, 0.8]] },
  { id: 'palmarDeep', sided: true, from: 'radial', pwv: 9.5, amp: 1.5, pts: [[250, -16, -848, 1], [238, -16, -858, 0.9], [225, -16, -858, 0.8]] },
  { id: 'pollicis', sided: true, from: 'radial', pwv: 9.5, amp: 1.5, twigs: false, pts: [[262, -12, -850, 0.8], [270, -6, -880, 0.7], [278, -4, -915, 0.6]] },
  // Two proper digital arteries on each finger (§13.2).
  .../** @type {[string, number, number, number, number, number][]} */ ([['index', 254, 258, -916, -1000, 9.5],
    ['middle', 237, 240, -920, -1008, 9.5], ['ring', 220, 222, -916, -1000, 9], ['little', 204, 205, -906, -985, 8]]).flatMap(
    ([f, bx, tx, bz, tz, rf]) => [-1, 1].map((k) => ({ id: `${k < 0 ? 'digital' : 'digital2'}.${f}`, sided: true, from: 'palmarSup', pwv: 9.5,
      amp: 1.5, twigs: false, pts: [[bx, -7, -880, 0.75], [bx + k * 0.5 * rf, -10, bz, 0.6], [(bx + tx) / 2 + k * 0.5 * rf, -10, (bz + tz) / 2, 0.5],
        [tx + k * 0.4 * rf, -12, tz + 8, 0.4]] }))),
  { id: 'digital.thumb', sided: true, from: 'pollicis', pwv: 9.5, amp: 1.5, twigs: false, pts: [[272, -10, -890, 0.55], [276, -6, -922, 0.45]] },
  { id: 'digital2.thumb', sided: true, from: 'pollicis', pwv: 9.5, amp: 1.5, twigs: false, pts: [[281, -8, -888, 0.55], [284, -3, -918, 0.45]] },
  // Abdomen.
  { id: 'coeliac', side: 0, from: 'aorta', pwv: 8, amp: 1.15, twigs: false, pts: [[-4, 22, -468, 3.5], [-2, 32, -466, 3.3]] },
  { id: 'hepatic', side: 0, from: 'coeliac', pwv: 8, amp: 1.15, pts: [[14, 34, -468, 2.4], [30, 30, -462, 2.2], [42, 22, -450, 2], [52, 18, -440, 1.8]] },
  { id: 'splenic', side: 0, from: 'coeliac', pwv: 8, amp: 1.15,
    pts: [[-16, 30, -466, 2.6], [-36, 18, -464, 2.5], [-58, -4, -460, 2.4], [-82, -26, -458, 2.3], [-98, -40, -458, 2.2]] },
  { id: 'leftGastric', side: 0, from: 'coeliac', pwv: 8, amp: 1.15, pts: [[-12, 38, -455, 1.6], [-22, 44, -440, 1.4], [-30, 46, -425, 1.2]] },
  { id: 'sma', side: 0, from: 'aorta', pwv: 8, amp: 1.2,
    pts: [[-5, 24, -490, 3.4], [-3, 38, -510, 3.2], [2, 48, -545, 3], [10, 50, -585, 2.6], [22, 46, -620, 2.2], [36, 40, -640, 1.8]] },
  { id: 'ima', side: 0, from: 'aorta', pwv: 8, amp: 1.2, pts: [[-14, 18, -560, 1.8], [-26, 24, -580, 1.7], [-34, 24, -610, 1.6], [-30, 18, -645, 1.4], [-14, 4, -680, 1.2]] },
  { id: 'renal', side: 1, from: 'aorta', pwv: 8, amp: 1.15, pts: [[10, 0, -502, 2.8], [24, -18, -504, 2.7], [36, -36, -508, 2.6]] },
  { id: 'renal', side: -1, from: 'aorta', pwv: 8, amp: 1.15, pts: [[-18, 0, -498, 2.8], [-28, -18, -498, 2.7], [-36, -36, -497, 2.6]] },
  // Lower limb (the internal iliac schematic: its gluteal trunk only, A.1).
  { id: 'commonIliac', sided: true, from: 'aorta', pwv: 8, amp: 1.2, twigs: false, pts: [[12, 10, -610, 5], [28, 10, -630, 4.6], [40, 6, -645, 4.4]] },
  { id: 'internalIliac', sided: true, from: 'commonIliac', pwv: 8.5, amp: 1.25, pts: [[46, -8, -665, 2.6], [50, -26, -690, 2.2], [60, -44, -705, 2]] },
  { id: 'externalIliac', sided: true, from: 'commonIliac', pwv: 8.5, amp: 1.3, twigs: false, pts: [[52, 18, -670, 4], [62, 34, -700, 3.9], [68, 46, -728, 3.8]] },
  { id: 'femoral', sided: true, from: 'externalIliac', pwv: 8.5, amp: 1.45,
    pts: [[72, 48, -760, 3.6], [72, 40, -820, 3.4], [68, 30, -900, 3.2], [64, 16, -980, 3], [64, -4, -1060, 2.9], [70, -30, -1110, 2.8]] },
  { id: 'popliteal', sided: true, from: 'femoral', pwv: 9.5, amp: 1.5, pts: [[78, -54, -1140, 2.6], [80, -60, -1180, 2.5], [80, -58, -1225, 2.4]] },
  { id: 'anteriorTibial', sided: true, from: 'popliteal', pwv: 10, amp: 1.6,
    pts: [[88, -40, -1240, 1.9], [92, -18, -1260, 1.8], [92, -12, -1350, 1.7], [88, -10, -1450, 1.6], [84, -10, -1540, 1.5], [82, -14, -1595, 1.4]] },
  { id: 'dorsalisPedis', sided: true, from: 'anteriorTibial', pwv: 10, amp: 1.65, pts: [[82, 4, -1618, 1.3], [84, 30, -1626, 1.2], [86, 60, -1634, 1], [80, 108, -1646, 0.7]] },
  { id: 'posteriorTibial', sided: true, from: 'popliteal', pwv: 10, amp: 1.65,
    pts: [[78, -60, -1260, 2], [74, -58, -1350, 1.9], [70, -56, -1450, 1.8], [64, -56, -1550, 1.6], [58, -62, -1600, 1.5], [58, -50, -1636, 1.4]] },
  { id: 'peroneal', sided: true, from: 'posteriorTibial', pwv: 10, amp: 1.6, pts: [[86, -58, -1300, 1.5], [94, -52, -1400, 1.4], [98, -50, -1500, 1.3], [98, -52, -1580, 1.1]] },
  { id: 'medialPlantar', sided: true, from: 'posteriorTibial', pwv: 10, amp: 1.65, pts: [[64, 0, -1664, 1.1], [70, 40, -1662, 1], [74, 80, -1660, 0.8]] },
  { id: 'lateralPlantar', sided: true, from: 'posteriorTibial', pwv: 10, amp: 1.65,
    pts: [[70, -40, -1666, 1.2], [90, -10, -1666, 1.1], [104, 30, -1662, 1], [110, 70, -1658, 0.9], [92, 92, -1658, 0.8]] },
  // Second pass (PULSE.md §13.2). Head and neck.
  { id: 'supThyroid', sided: true, from: 'eca', pwv: 8, amp: 1.1, pts: [[26, 22, -125, 1], [22, 26, -150, 0.9], [20, 26, -162, 0.8]] },
  { id: 'lingual', sided: true, from: 'eca', pwv: 8, amp: 1.1, pts: [[26, 24, -114, 1], [18, 40, -110, 0.9], [10, 55, -104, 0.8], [6, 70, -100, 0.7]] },
  { id: 'occipital', sided: true, from: 'eca', pwv: 8, amp: 1.15, pts: [[42, -20, -82, 1], [40, -55, -70, 0.9], [26, -84, -50, 0.8], [12, -96, -20, 0.7]] },
  { id: 'postAuricular', sided: true, from: 'eca', pwv: 8, amp: 1.15, pts: [[48, -20, -72, 0.8], [58, -34, -54, 0.7], [56, -40, -32, 0.6]] },
  { id: 'ophthalmic', sided: true, from: 'ica', pwv: 7, amp: 1.05,
    pts: [[20, 18, -36, 0.8], [27, 38, -37, 0.7], [31, 48, -36, 0.6], [28, 64, -27, 0.5], [24, 74, -22, 0.45]] },
  { id: 'acomm', side: 0, from: 'aca.R', pwv: 7, amp: 1.05, twigs: false, pts: [[-3, 16, -16, 0.6]] },
  { id: 'pica', sided: true, from: 'vertebral', pwv: 7, amp: 1.05, pts: [[16, -46, -62, 0.8], [24, -60, -56, 0.7], [18, -74, -46, 0.6]] },
  { id: 'aica', sided: true, from: 'basilar', pwv: 7, amp: 1.05, pts: [[12, -30, -44, 0.7], [24, -42, -42, 0.6]] },
  { id: 'sca', sided: true, from: 'basilar', pwv: 7, amp: 1.05, pts: [[10, -26, -30, 0.8], [18, -42, -28, 0.7], [16, -58, -30, 0.6]] },
  { id: 'thyrocervical', sided: true, from: 'subclavian', pwv: 7.5, amp: 1.15, twigs: false, pts: [[52, 2, -202, 1.6]] },
  { id: 'infThyroid', sided: true, from: 'thyrocervical', pwv: 8, amp: 1.15, pts: [[40, 12, -182, 1.1], [24, 22, -166, 0.9]] },
  { id: 'transCervical', sided: true, from: 'thyrocervical', pwv: 8, amp: 1.15, pts: [[70, -20, -200, 1], [100, -50, -205, 0.9]] },
  { id: 'suprascapular', sided: true, from: 'thyrocervical', pwv: 8, amp: 1.2, pts: [[80, -10, -214, 1], [120, -40, -226, 0.9], [130, -40, -236, 0.8]] },
  // Chest and abdominal wall.
  { id: 'intThoracic', sided: true, from: 'subclavian', pwv: 8, amp: 1.15,
    pts: [[42, 6, -222, 1.4], [32, 50, -240, 1.4], [28, 66, -280, 1.3], [30, 72, -330, 1.3], [32, 74, -380, 1.2]] },
  { id: 'supEpigastric', sided: true, from: 'intThoracic', pwv: 9, amp: 1.25, pts: [[38, 78, -420, 1], [42, 78, -480, 0.9], [42, 76, -540, 0.8]] },
  { id: 'infEpigastric', sided: true, from: 'externalIliac', pwv: 9, amp: 1.3, pts: [[58, 56, -712, 1.2], [48, 70, -665, 1.1], [42, 76, -610, 1], [42, 76, -560, 0.8]] },
  // Upper limb.
  { id: 'thoracoacromial', sided: true, from: 'axillary', pwv: 8, amp: 1.25, pts: [[128, -2, -252, 1.2], [134, 12, -258, 1], [124, 36, -282, 0.8]] },
  { id: 'acromialBr', sided: true, from: 'thoracoacromial', pwv: 8, amp: 1.25, pts: [[170, 0, -240, 0.7]] },
  { id: 'latThoracic', sided: true, from: 'axillary', pwv: 8, amp: 1.25, pts: [[142, 0, -300, 1], [136, 10, -350, 0.9], [128, 18, -400, 0.8]] },
  { id: 'subscapular', sided: true, from: 'axillary', pwv: 8, amp: 1.25, twigs: false, pts: [[150, -30, -322, 1.6]] },
  { id: 'circScapular', sided: true, from: 'subscapular', pwv: 8, amp: 1.25, pts: [[140, -60, -320, 0.9], [118, -90, -308, 0.8]] },
  { id: 'thoracodorsal', sided: true, from: 'subscapular', pwv: 8, amp: 1.25, pts: [[140, -42, -360, 1.1], [130, -52, -420, 0.9], [120, -56, -470, 0.8]] },
  { id: 'postCircHumeral', sided: true, from: 'axillary', pwv: 8, amp: 1.25, pts: [[172, -40, -302, 1], [195, -52, -292, 0.9], [214, -36, -290, 0.8]] },
  { id: 'profundaBrachii', sided: true, from: 'brachial', pwv: 8.5, amp: 1.35, pts: [[182, -30, -380, 1.2], [200, -54, -430, 1], [214, -50, -500, 0.9], [210, -40, -555, 0.8]] },
  { id: 'supUlnarColl', sided: true, from: 'brachial', pwv: 8.5, amp: 1.35, pts: [[170, -24, -470, 0.8], [172, -44, -545, 0.7]] },
  { id: 'radialRecurrent', sided: true, from: 'radial', pwv: 9, amp: 1.4, pts: [[214, -12, -592, 0.8], [214, -22, -540, 0.7]] },
  { id: 'ulnarRecurrent', sided: true, from: 'ulnar', pwv: 9, amp: 1.4, pts: [[182, -20, -592, 0.8], [176, -36, -560, 0.7]] },
  { id: 'commonInterosseous', sided: true, from: 'ulnar', pwv: 9, amp: 1.4, twigs: false, pts: [[200, -20, -640, 1.1]] },
  { id: 'antInterosseous', sided: true, from: 'commonInterosseous', pwv: 9.5, amp: 1.45, pts: [[210, -22, -700, 0.9], [224, -22, -790, 0.7]] },
  { id: 'postInterosseous', sided: true, from: 'commonInterosseous', pwv: 9.5, amp: 1.45, pts: [[206, -40, -660, 0.9], [220, -42, -740, 0.8], [232, -36, -800, 0.7]] },
  { id: 'dorsalCarpal', sided: true, from: 'radial', pwv: 9.5, amp: 1.5, pts: [[246, -32, -834, 0.8], [230, -34, -838, 0.7], [214, -30, -836, 0.6]] },
  // Abdomen.
  { id: 'infPhrenic', sided: true, from: 'aorta', pwv: 8, amp: 1.15, pts: [[14, -10, -458, 0.9], [40, -20, -432, 0.8], [58, -22, -408, 0.7]] },
  { id: 'suprarenal', sided: true, from: 'aorta', pwv: 8, amp: 1.15, pts: [[18, -8, -482, 0.6], [34, -30, -462, 0.5]] },
  { id: 'gastroduodenal', side: 0, from: 'hepatic', pwv: 8.5, amp: 1.2, pts: [[16, 38, -484, 1.4], [14, 42, -504, 1.2]] },
  { id: 'rGastroepiploic', side: 0, from: 'gastroduodenal', pwv: 9, amp: 1.2, pts: [[0, 56, -510, 1], [-20, 62, -504, 0.9], [-42, 60, -494, 0.8]] },
  { id: 'lGastroepiploic', side: 0, from: 'splenic', pwv: 9, amp: 1.2, pts: [[-70, 18, -470, 0.9], [-56, 48, -484, 0.8], [-46, 58, -492, 0.7]] },
  { id: 'shortGastric', side: 0, from: 'splenic', pwv: 9, amp: 1.2, pts: [[-80, -10, -442, 0.6], [-68, 10, -426, 0.5]] },
  // Lower limb.
  { id: 'supGluteal', sided: true, from: 'internalIliac', pwv: 9, amp: 1.3, pts: [[74, -68, -700, 1.4], [100, -88, -690, 1.1], [128, -80, -680, 0.9]] },
  { id: 'infGluteal', sided: true, from: 'internalIliac', pwv: 9, amp: 1.3, pts: [[64, -66, -740, 1.2], [80, -92, -770, 1], [94, -94, -810, 0.8]] },
  { id: 'profundaFemoris', sided: true, from: 'femoral', pwv: 9, amp: 1.45,
    pts: [[78, 32, -800, 2.2], [86, 10, -840, 2], [80, -10, -900, 1.8], [76, -20, -980, 1.5], [74, -28, -1050, 1.2]] },
  { id: 'perforating1', sided: true, from: 'profundaFemoris', pwv: 9.5, amp: 1.45, pts: [[96, -40, -880, 0.9], [100, -62, -890, 0.8]] },
  { id: 'perforating2', sided: true, from: 'profundaFemoris', pwv: 9.5, amp: 1.45, pts: [[92, -50, -955, 0.8], [98, -68, -965, 0.7]] },
  { id: 'perforating3', sided: true, from: 'profundaFemoris', pwv: 9.5, amp: 1.45, pts: [[88, -55, -1025, 0.8], [94, -70, -1035, 0.7]] },
  { id: 'latCircFemoral', sided: true, from: 'profundaFemoris', pwv: 9, amp: 1.45, pts: [[100, 34, -810, 1.4], [120, 30, -850, 1.1], [125, 24, -950, 0.9], [120, 14, -1060, 0.8]] },
  { id: 'medCircFemoral', sided: true, from: 'profundaFemoris', pwv: 9, amp: 1.45, pts: [[70, 12, -806, 1.2], [80, -30, -790, 1], [100, -60, -770, 0.8]] },
  { id: 'descGenicular', sided: true, from: 'femoral', pwv: 9.5, amp: 1.5, pts: [[56, 0, -1100, 0.9], [50, -6, -1150, 0.8]] },
  { id: 'genicularSM', sided: true, from: 'popliteal', pwv: 9.5, amp: 1.5, pts: [[62, -46, -1150, 0.8], [46, -20, -1150, 0.7]] },
  { id: 'genicularSL', sided: true, from: 'popliteal', pwv: 9.5, amp: 1.5, pts: [[98, -46, -1150, 0.8], [114, -20, -1150, 0.7]] },
  { id: 'genicularIM', sided: true, from: 'popliteal', pwv: 9.5, amp: 1.5, pts: [[62, -50, -1214, 0.8], [50, -16, -1220, 0.7]] },
  { id: 'genicularIL', sided: true, from: 'popliteal', pwv: 9.5, amp: 1.5, pts: [[100, -50, -1210, 0.8], [116, -16, -1205, 0.7]] },
  { id: 'antTibRecurrent', sided: true, from: 'anteriorTibial', pwv: 10, amp: 1.6, pts: [[96, 4, -1246, 0.7], [90, 12, -1218, 0.6]] },
  { id: 'arcuate', sided: true, from: 'dorsalisPedis', pwv: 10, amp: 1.65, twigs: false, pts: [[100, 52, -1630, 0.8], [118, 46, -1632, 0.7], [128, 40, -1636, 0.6]] },
  // Toes: a dorsal metatarsal artery to each toe from the arcuate artery, two plantar digital arteries
  // on each toe from the plantar arch (the end of the lateral plantar artery).
  .../** @type {number[][]} */ ([[70, 126, -1656, 12, 75, 160, -1660], [92, 126, -1660, 8.5, 96, 155, -1663], [107, 120, -1661, 8, 110, 148, -1664], [120, 113, -1662, 7.5, 123, 139, -1665], [132, 104, -1663, 7, 135, 126, -1666]]).flatMap(([bx, by, bz, rt, tx, ty, tz], i) => [
    { id: `dorsalMetatarsal${i + 1}`, sided: true, from: 'arcuate', pwv: 10, amp: 1.65, twigs: false,
      pts: [[bx + 4, by - 40, bz + 14, 0.6], [bx + 4, by - 6, bz + 0.4 * rt, 0.5]] },
    ...[-1, 1].map((k) => ({ id: `${k < 0 ? 'toeDigital' : 'toeDigital2'}${i + 1}`, sided: true, from: 'lateralPlantar', pwv: 10, amp: 1.65, twigs: false,
      pts: [[bx + k * 0.45 * rt, by - 6, bz - 0.35 * rt, 0.5], [tx + k * 0.4 * rt, ty - 4, tz - 0.3 * rt, 0.4]] })),
  ]),
];

/** @type {VesselDef[]} */
const VEINS = [
  { id: 'svc', side: 0, twigs: false, pts: [[30, 0, -236, 10], [30, 3, -270, 10], [28, 3, -300, 10], [27, 2, -316, 9.5]] },
  { id: 'ivc', side: 0, twigs: false, pts: [[16, -12, -398, 11], [26, 0, -420, 12], [31, 6, -445, 12], [30, 6, -470, 12], [24, 2, -520, 11.5], [21, -1, -590, 11]] },
  { id: 'bcv', side: 1, from: 'svc', twigs: false, pts: [[36, 6, -222, 7]] },
  { id: 'bcv', side: -1, from: 'svc', twigs: false, pts: [[10, 22, -236, 6.5], [-14, 22, -232, 6.5], [-36, 8, -222, 6.5]] },
  // Head and neck: the internal and external jugular veins and the dural sinuses.
  { id: 'ijv', sided: true, from: 'bcv', pts: [[40, 10, -205, 6], [38, 8, -170, 6.5], [36, 4, -130, 6], [34, -4, -100, 5.5], [32, -16, -80, 5], [32, -26, -66, 4.5]] },
  { id: 'ejv', sided: true, from: 'bcv', pts: [[58, 2, -212, 2.2], [56, 2, -180, 2.2], [49, -3, -150, 2], [48, -10, -122, 1.8]] },
  { id: 'sss', side: 0, pts: [[0, 58, -10, 2.5], [0, 56, 30, 3], [0, 30, 66, 3.5], [0, -10, 78, 4], [0, -50, 74, 4.5], [0, -84, 50, 5], [0, -98, 10, 5], [0, -96, -28, 5.5]] },
  { id: 'transverse', sided: true, from: 'sss', twigs: false, pts: [[24, -94, -32, 4], [46, -84, -38, 4], [58, -62, -46, 3.8]] },
  { id: 'sigmoid', sided: true, from: 'transverse', twigs: false, pts: [[56, -48, -58, 3.6], [46, -36, -66, 3.4], [34, -28, -70, 3.2]] },
  // Upper limb: deep veins with the arteries; the cephalic, basilic and median cubital veins under the skin.
  { id: 'subclavianV', sided: true, from: 'bcv', twigs: false, pts: [[56, 0, -222, 5], [80, -6, -226, 5], [100, -12, -238, 5]] },
  { id: 'axillaryV', sided: true, from: 'subclavianV', pts: [[126, -10, -258, 4.5], [150, -8, -284, 4.2], [162, -8, -314, 4]] },
  { id: 'brachialV', sided: true, from: 'axillaryV', pts: [[168, -14, -340, 2.2], [174, -12, -400, 2], [180, -10, -460, 1.9], [188, -10, -520, 1.8], [194, -12, -575, 1.7]] },
  { id: 'basilic', sided: true, from: 'axillaryV',
    pts: [[164, -2, -400, 2.4], [158, -6, -470, 2.3], [162, -10, -540, 2.2], [162, -22, -600, 2], [182, -26, -700, 1.8], [200, -30, -790, 1.6], [220, -34, -840, 1.4]] },
  { id: 'cephalic', sided: true, from: 'axillaryV',
    pts: [[150, 2, -256, 2], [214, -2, -300, 2], [226, -14, -380, 2], [230, -20, -470, 1.9], [232, -24, -560, 1.8], [246, -20, -660, 1.7], [254, -20, -760, 1.5], [258, -26, -830, 1.3]] },
  { id: 'medianCubital', sided: true, from: 'cephalic', twigs: false, pts: [[220, -4, -575, 1.5], [200, 1, -560, 1.5], [178, -2, -548, 1.5]] },
  { id: 'radialV', sided: true, from: 'brachialV', pts: [[204, -8, -610, 1.3], [224, -8, -680, 1.2], [238, -10, -760, 1.1], [248, -12, -805, 1]] },
  { id: 'ulnarV', sided: true, from: 'brachialV', pts: [[190, -10, -610, 1.3], [194, -14, -680, 1.2], [204, -16, -760, 1.1], [213, -14, -805, 1]] },
  { id: 'dorsalHand', sided: true, from: 'cephalic', twigs: false, pts: [[250, -28, -858, 1], [236, -28, -868, 1], [222, -28, -862, 1], [212, -28, -850, 1]] },
  // Abdomen: hepatic, renal and portal veins.
  { id: 'hepaticV', side: 0, from: 'ivc', pts: [[50, -4, -432, 4.5], [72, -8, -440, 3.5]] },
  { id: 'hepaticVM', side: 0, from: 'ivc', pts: [[20, 14, -428, 4], [26, 30, -440, 3]] },
  { id: 'hepaticVL', side: 0, from: 'ivc', pts: [[-8, 18, -424, 3.5], [-30, 26, -430, 2.5]] },
  { id: 'renalV', side: 1, from: 'ivc', twigs: false, pts: [[38, -30, -505, 3.5]] },
  { id: 'renalV', side: -1, from: 'ivc', twigs: false, pts: [[-6, 22, -502, 3.6], [-22, 2, -500, 3.5], [-36, -32, -498, 3.4]] },
  { id: 'portal', side: 0, twigs: false, pts: [[5, 22, -508, 6], [20, 22, -480, 6], [34, 16, -455, 5.5], [46, 12, -445, 4]] },
  { id: 'splenicV', side: 0, from: 'portal', pts: [[-30, 14, -490, 3.6], [-60, -6, -470, 3.5], [-90, -36, -462, 3.4]] },
  { id: 'smv', side: 0, from: 'portal', pts: [[8, 30, -530, 3.5], [12, 42, -570, 3], [24, 44, -615, 2.5]] },
  // Lower limb: deep veins with the arteries; the great and small saphenous veins under the skin.
  { id: 'commonIliacV', sided: true, from: 'ivc', twigs: false, pts: [[32, 2, -625, 6.5], [44, -2, -650, 6]] },
  { id: 'externalIliacV', sided: true, from: 'commonIliacV', twigs: false, pts: [[52, 12, -675, 5.5], [58, 30, -705, 5.3], [62, 42, -732, 5.2]] },
  { id: 'femoralV', sided: true, from: 'externalIliacV',
    pts: [[64, 44, -762, 5], [64, 36, -820, 4.8], [62, 24, -900, 4.5], [60, 8, -980, 4.2], [62, -12, -1060, 4], [70, -36, -1110, 3.8]] },
  { id: 'poplitealV', sided: true, from: 'femoralV', pts: [[78, -62, -1140, 3.6], [80, -66, -1180, 3.5], [80, -64, -1225, 3.4]] },
  { id: 'anteriorTibialV', sided: true, from: 'poplitealV',
    pts: [[90, -42, -1245, 1.4], [94, -16, -1265, 1.3], [94, -14, -1350, 1.3], [90, -12, -1450, 1.2], [86, -12, -1540, 1.1], [84, -16, -1590, 1]] },
  { id: 'posteriorTibialV', sided: true, from: 'poplitealV',
    pts: [[76, -64, -1262, 1.6], [72, -62, -1350, 1.5], [68, -60, -1450, 1.4], [62, -58, -1550, 1.3], [56, -64, -1598, 1.2]] },
  { id: 'greatSaphenous', sided: true, from: 'femoralV',
    pts: [[62, 58, -780, 2.6], [50, 50, -860, 2.5], [36, 30, -960, 2.4], [32, 0, -1060, 2.3], [26, -36, -1160, 2.2], [29, -32, -1260, 2.1], [38, -30, -1380, 2],
      [47, -28, -1500, 1.9], [46, -28, -1590, 1.8], [60, 10, -1625, 1.7], [66, 40, -1626, 1.6]] },
  { id: 'smallSaphenous', sided: true, from: 'poplitealV',
    pts: [[80, -86, -1190, 1.8], [84, -92, -1300, 1.7], [92, -84, -1420, 1.6], [100, -64, -1540, 1.5], [104, -54, -1600, 1.4]] },
  { id: 'dorsalFoot', sided: true, from: 'greatSaphenous', twigs: false,
    pts: [[80, 60, -1626, 1.3], [100, 70, -1630, 1.3], [118, 60, -1634, 1.2], [112, 20, -1628, 1.2], [104, -20, -1620, 1.2]] },
  // Second pass (PULSE.md §13.5).
  { id: 'azygos', side: 0, from: 'svc', pts: [[26, -14, -258, 5.5], [20, -32, -264, 5], [14, -44, -282, 4.5], [14, -46, -320, 4.2], [14, -46, -380, 4],
    [14, -42, -440, 3.8], [16, -34, -480, 3.5]] },
  { id: 'hemiazygos', side: 0, from: 'azygos', pts: [[2, -56, -372, 2.6], [-18, -62, -392, 2.6], [-30, -60, -430, 2.4], [-30, -52, -470, 2.2]] },
  { id: 'intThoracicV', sided: true, from: 'bcv', pts: [[36, 48, -240, 1.6], [34, 68, -280, 1.5], [36, 74, -330, 1.4], [38, 76, -380, 1.3]] },
  { id: 'facialV', sided: true, from: 'ijv', pts: [[40, 20, -130, 1.8], [44, 38, -128, 1.6], [36, 60, -100, 1.3], [28, 70, -70, 1.1], [24, 70, -52, 1]] },
  { id: 'retromandibular', sided: true, from: 'ijv', pts: [[44, -8, -95, 1.6], [46, -14, -74, 1.4], [54, -16, -54, 1.2]] },
  { id: 'antJugular', sided: true, from: 'subclavianV', pts: [[30, 30, -208, 1.2], [14, 36, -180, 1.1], [12, 34, -140, 1]] },
  { id: 'medianAntebrachial', sided: true, from: 'medianCubital', pts: [[205, 2, -620, 1.2], [215, 0, -700, 1.1], [228, -2, -780, 1]] },
  { id: 'imv', side: 0, from: 'splenicV', pts: [[-40, 10, -500, 2.4], [-45, 15, -540, 2.2], [-40, 18, -580, 2], [-32, 15, -640, 1.8]] },
  { id: 'straightSinus', side: 0, from: 'sss', twigs: false, pts: [[0, -80, -10, 3], [0, -60, 0, 2.6], [0, -44, -4, 2.2]] },
  { id: 'infSagittal', side: 0, from: 'straightSinus', pts: [[0, -30, 26, 1.6], [0, 0, 36, 1.4], [0, 25, 30, 1.2]] },
  { id: 'cavernous', sided: true, from: 'sigmoid', twigs: false, pts: [[24, -20, -50, 1.2], [16, -10, -34, 1.6], [14, 8, -30, 2]] },
].map((v) => ({ ...v, vein: true }));

// Pulse sites (PULSE.md §4): the vessel and a point near the palpation site (right side).
export const PULSE_SITES = {
  carotid: ['cca', [26, 6, -150]],
  brachial: ['brachial', [190, -4, -560]],
  radial: ['radial', [246, -8, -805]],
  finger: ['digital.index', [258, -12, -990]],
  femoral: ['femoral', [72, 48, -760]],
  popliteal: ['popliteal', [80, -60, -1180]],
  posteriorTibial: ['posteriorTibial', [58, -62, -1600]],
  dorsalisPedis: ['dorsalisPedis', [84, 30, -1626]],
};

// ---------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const suffix = (s) => (s > 0 ? '.R' : s < 0 ? '.L' : '');

// Per-point arrays of a polyline: cumulative arc (mm).
function arcs(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  return cum;
}
// Value of a per-point array at segment i, fraction f.
const lerpAt = (arr, i, f) => arr[i] + (arr[Math.min(arr.length - 1, i + 1)] - arr[i]) * f;

// Nearest point of a vessel to q: { p, i, f, s, d, a, L, r }.
export function nearestOn(v, q) {
  let best = null;
  for (let i = 0; i < v.pts.length - 1; i++) {
    const a = v.pts[i], ab = sub(v.pts[i + 1], a), l2 = dot(ab, ab);
    const f = l2 > 0 ? Math.min(1, Math.max(0, dot(sub(q, a), ab) / l2)) : 0;
    const p = [a[0] + ab[0] * f, a[1] + ab[1] * f, a[2] + ab[2] * f], e = len(sub(q, p));
    if (!best || e < best.e) best = { e, p, i, f };
  }
  const { p, i, f, e } = best;
  return { p, i, f, dist: e, s: lerpAt(v.cum, i, f), d: lerpAt(v.d, i, f), a: lerpAt(v.a, i, f), L: lerpAt(v.L, i, f), r: lerpAt(v.r, i, f) };
}

function buildNamed() {
  const list = [], byId = new Map();
  for (const def of [...ARTERIES, ...VEINS]) {
    for (const s of def.sided ? [1, -1] : [def.side ?? 0]) {
      const id = def.id + suffix(s);
      const rows = def.pts.map((p) => (def.sided && s < 0 ? [-p[0], p[1], p[2], p[3]] : [...p]));
      const parent = def.from ? byId.get(def.from + suffix(s)) || byId.get(def.from) : null;
      if (def.from && !parent) throw new Error(`vessel ${id}: unknown parent ${def.from}`);
      const at = parent ? nearestOn(parent, rows[0]) : null;
      if (at) rows.unshift([at.p[0], at.p[1], at.p[2], Math.min(at.r, rows[0][3])]);
      const pts = rows.map((r) => [r[0], r[1], r[2]]), r = rows.map((x) => x[3]), cum = arcs(pts), n = pts.length, L = cum[n - 1];
      const vein = !!def.vein;
      const pwv = (k) => (Array.isArray(def.pwv) ? def.pwv[Math.min(k, def.pwv.length - 1)] : def.pwv);
      const d = [vein ? -1 : at ? at.d : 0];
      for (let k = 1; k < n; k++) d.push(vein ? -1 : d[k - 1] + (cum[k] - cum[k - 1]) / (1000 * 0.5 * (pwv(k - 1) + pwv(k))));
      const a0 = vein ? 0 : at ? at.a : def.amp0 ?? 1, a1 = vein ? 0 : def.amp ?? a0;
      const a = cum.map((c) => a0 + (a1 - a0) * (L > 0 ? c / L : 0));
      const Lp = cum.map((c) => (at ? at.L : 0) + c);
      const v = { id, name: def.id, part: vein ? VPART.VEIN : VPART.ARTERY, side: s, vein, level: 0, parent: parent ? parent.id : null,
        twigs: def.twigs !== false, sinus: def.sinus || null, pts, r, cum, len: L, d, a, L: Lp, wf: 1 };
      list.push(v);
      byId.set(id, v);
    }
  }
  // Venae comitantes (§13.5): a second deep vein on the other side of each listed artery, joining its vein.
  for (const [an, vn] of TREE.comitantes) for (const s of [1, -1]) {
    const art = byId.get(an + suffix(s)), vein = byId.get(vn + suffix(s));
    if (!art || !vein) throw new Error(`comitans ${an}: unknown vessel`);
    const rows = art.pts.slice(1).map((p, k) => {
      const t = norm(sub(art.pts[Math.min(art.pts.length - 1, k + 2)], art.pts[k])), w = norm(cross(t, [0, 1, 0])), off = art.r[k + 1] + 2;
      return [p[0] + w[0] * off, p[1] + w[1] * off, p[2] + w[2] * off, art.r[k + 1] * 1.2];
    });
    const at = nearestOn(vein, rows[0]);
    rows.unshift([at.p[0], at.p[1], at.p[2], rows[0][3]]);
    const pts = rows.map((r) => [r[0], r[1], r[2]]), cum = arcs(pts), id = `${an}V2${suffix(s)}`;
    const v = { id, name: `${an}V2`, part: VPART.VEIN, side: s, vein: true, level: 0, parent: vein.id, twigs: true, sinus: null, pts,
      r: rows.map((x) => x[3]), cum, len: cum[cum.length - 1], d: cum.map(() => -1), a: cum.map(() => 0), L: cum.map(() => 0), wf: 1 };
    list.push(v);
    byId.set(id, v);
  }
  return { list, byId };
}
const NAMED = buildNamed();

export const VESSEL_TREE = { vessels: NAMED.list, byId: NAMED.byId };
export const vesselById = (id) => NAMED.byId.get(id) || null;

// A pulse site: { p, delay (s, rest), amp, pathMm } on the given side.
export function pulseSite(id, side = 1) {
  const [vid, q] = PULSE_SITES[id];
  const v = NAMED.byId.get(vid + suffix(side)) || NAMED.byId.get(vid);
  const hit = nearestOn(v, side < 0 ? [-q[0], q[1], q[2]] : q);
  return { p: hit.p, delay: hit.d, amp: hit.a, pathMm: hit.L };
}

// The nearest artery point among the named vessels `names` on a side (the earlier great vessels take
// their delay and amplitude from it): { d, a }.
export function arteryAt(q, names, side = 0) {
  let best = null;
  for (const nm of names) {
    const v = NAMED.byId.get(nm + suffix(side)) || NAMED.byId.get(nm);
    if (!v || v.vein) continue;
    const h = nearestOn(v, q);
    if (!best || h.dist < best.dist) best = h;
  }
  return best ? { d: best.d, a: best.a } : { d: -1, a: 0 };
}

// Detail (PULSE.md §9, §13): twigs three generations deep, vasa vasorum, organ trees, the gut's
// arcades and marginal artery, intercostal and lumbar vessels, venous valves, and a capillary bed at
// every terminal arterial branch. ctx comes from generate.js, which has the body geometry:
//   inside(p): may a branch point lie here (≥ skinGap mm inside the skin);
//   organs: { lungR, lungL, liver, liverL, spleen, kidneyR, kidneyL } as { c, r } ellipsoids (mm);
//   gut: { small, colon }: centreline samples { p, r, t } of the jejunum and ileum, and of the colon;
//   intercostal: [{ seg, side, pts }]: the intercostal nerve routes (the vessels run above them).
// Returns { branches: vessel-like objects with a part code, beds: capillary strands with saturation }.
const detailCache = new Map();
export function buildDetail(ctx, seed = 1848) {
  if (detailCache.has(seed)) return detailCache.get(seed);
  const T = TREE.twig, B = TREE.bed, O = TREE.organ, E = ctx.organs, u = mulberry32(seed ^ 0x5a17);
  const rr = (a, b) => a + (b - a) * u(), pick = (a) => a[0] + Math.floor(u() * (a[1] - a[0] + 1));
  const P = TREE.pelvicBox, ok = (p) => !(Math.abs(p[0]) < P.x && p[2] > P.z[0] && p[2] < P.z[1]) && ctx.inside(p);
  const inEll = (e, p, shrink = 0) => {
    const x = (p[0] - e.c[0]) / Math.max(1, e.r[0] - shrink), y = (p[1] - e.c[1]) / Math.max(1, e.r[1] - shrink), z = (p[2] - e.c[2]) / Math.max(1, e.r[2] - shrink);
    return x * x + y * y + z * z <= 1;
  };
  const perp = (t) => norm(cross(t, Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const along = (p, w, k) => [p[0] + w[0] * k, p[1] + w[1] * k, p[2] + w[2] * k];
  const mix3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const branches = [], beds = [];
  // A branch polyline: radius r0 → r1, delay from d0 at `pwv`, amplitude `a`.
  const mk = (pts, r0, r1, o) => {
    const cum = arcs(pts), L = cum[cum.length - 1];
    return { id: null, name: o.name, part: o.part, side: o.side ?? 0, vein: !!o.vein, level: o.level ?? 1, parent: null, twigs: false, sinus: null,
      pts, r: cum.map((c) => Math.max(T.minR, r0 + (r1 - r0) * (L > 0 ? c / L : 0))), cum, len: L,
      d: cum.map((c) => (o.vein ? -1 : o.d0 + c / (1000 * o.pwv))), a: cum.map(() => (o.vein ? 0 : o.a)), L: cum.map(() => 0), wf: o.wf ?? 1 };
  };
  const add = (b) => { if (b && b.len > 0.5) branches.push(b); return b; };
  const end = (b) => ({ p: b.pts[b.pts.length - 1], t: norm(sub(b.pts[b.pts.length - 1], b.pts[b.pts.length - 2])), d: b.d[b.d.length - 1] });
  const region = (p) => (inEll(E.kidneyR, p) || inEll(E.kidneyL, p) ? 'kidney' : inEll(E.liver, p) || inEll(E.liverL, p) ? 'liver'
    : inEll(E.spleen, p) ? 'spleen' : inEll(TREE.brain, p) ? 'brain' : Math.abs(p[0]) > 150 || p[2] < -780 ? 'muscle' : 'tissue');
  // A capillary bed at a terminal arterial tip: strands with saturation from the arteriole to the venule.
  const bed = (p, dir, kind, side) => {
    const b = B[kind] || B.tissue, n = pick(b.n);
    for (let k = 0; k < n; k++) {
      let q = p, dd = dir;
      const pts = [p];
      for (let j = 0; j < b.steps; j++) {
        dd = norm([dd[0] + rr(-b.spread, b.spread), dd[1] + rr(-b.spread, b.spread), dd[2] + rr(-b.spread, b.spread)]);
        q = along(q, dd, b.step);
        if (!ctx.inside(q)) break;
        pts.push(q);
      }
      if (pts.length < 2) continue;
      const cum = arcs(pts), L = cum[cum.length - 1];
      beds.push({ part: VPART.CAPILLARY, side, pts, cum, len: L, r: cum.map(() => b.width), d: cum.map(() => -1), a: cum.map(() => 0), oxy: cum.map((c) => b.from + (b.to - b.from) * c / L) });
    }
  };

  // 1. Twigs off the named vessels, `levels` generations deep, a bed at every arterial twig tip.
  const grow = (p0, t, rad, length, d0, a, vein, level, side, part) => {
    const n1 = perp(t), n2 = cross(t, n1), phi = 2 * Math.PI * u(), th = (rr(T.angle[0], T.angle[1]) * Math.PI) / 180;
    const w = [0, 1, 2].map((k) => n1[k] * Math.cos(phi) + n2[k] * Math.sin(phi));
    let dir = norm([0, 1, 2].map((k) => t[k] * Math.cos(th) + w[k] * Math.sin(th)));
    const pts = [p0], step = length / T.steps, bend = (T.bend * Math.PI) / 180;
    for (let k = 0; k < T.steps; k++) {
      dir = norm([dir[0] + rr(-bend, bend), dir[1] + rr(-bend, bend), dir[2] + rr(-bend, bend)]);
      const q = along(pts[pts.length - 1], dir, step);
      if (!ok(q)) break;
      pts.push(q);
    }
    if (pts.length < 2) return null;
    return mk(pts, rad, rad * 0.7, { part, vein, d0, a: vein ? 0 : a * T.amp[level - 1], pwv: T.pwv, side, level, name: 'twig' });
  };
  const branchOut = (tw, rc, length, a0) => {
    if (!tw.vein) { const e = end(tw); bed(e.p, e.t, region(e.p), tw.side); }
    if (tw.level >= T.levels || tw.pts.length < 3) return;
    for (let k = 0, n = pick(T.sub); k < n; k++) {
      const q = vesselPoint(tw, rr(0.4, 0.95) * tw.len);
      const st = add(grow(q.p, q.t, Math.max(T.minR, rc * T.subScale), length * T.subScale, q.d, a0, tw.vein, tw.level + 1, tw.side, tw.part));
      if (st) branchOut(st, rc * T.subScale, length * T.subScale, a0);
    }
  };
  for (const v of NAMED.list) {
    if (!v.twigs) continue;
    for (let s = rr(0.3, 1) * T.spacing[0]; s < v.len; s += rr(T.spacing[0], T.spacing[1])) {
      const q = vesselPoint(v, s);
      if (q.r > T.maxParentR) continue;
      const rc = Math.max(T.minR, q.r * rr(T.ratio[0], T.ratio[1])), length = rr(T.length[0], T.length[1]) * (0.6 + 0.4 * Math.min(1, q.r / 3));
      const tw = add(grow(q.p, q.t, rc, length, q.d, q.a, v.vein, 1, v.side, v.vein ? VPART.VEIN_TWIG : VPART.ARTERY_TWIG));
      if (tw) branchOut(tw, rc, length, q.a);
    }
  }

  // 2. Vasa vasorum: fine vessels lying on the wall of the aorta and the venae cavae.
  const V = TREE.vasa;
  for (const v of NAMED.list) {
    if (Math.max(...v.r) < V.minR) continue;
    for (let k = 0, n = Math.round(v.len / V.every); k < n; k++) {
      const s0 = rr(0, v.len), dir = u() < 0.5 ? 1 : -1, pts = [];
      let phi = rr(0, 2 * Math.PI);
      for (let j = 0, s = s0; j < V.steps && s >= 0 && s <= v.len; j++, s += dir * V.step, phi += rr(-0.35, 0.35)) {
        const q = vesselPoint(v, s), n1 = perp(q.t), n2 = cross(q.t, n1), R = q.r + 0.6;
        pts.push([0, 1, 2].map((m) => q.p[m] + (n1[m] * Math.cos(phi) + n2[m] * Math.sin(phi)) * R));
      }
      if (pts.length < 2) continue;
      const q0 = vesselPoint(v, s0);
      add(mk(pts, V.r, V.r, { part: v.vein ? VPART.VEIN_TWIG : VPART.ARTERY_TWIG, vein: v.vein, d0: q0.d, a: q0.a * V.amp, pwv: T.pwv, side: v.side, name: 'vasa' }));
    }
  }

  // 3. Organ trees (§13.3): dichotomous branching inside the organ, a bed at each arterial tip.
  const fractal = (root, dir, r0, len0, maxGen, inOrgan, o) => {
    const rec = (p, d, r, l, gen, delay, plane) => {
      let e = along(p, d, l);
      if (!inOrgan(e)) {
        d = norm(mix3(d, norm(sub(o.centre, p)), 0.5));
        e = along(p, d, l);
        if (!inOrgan(e)) { if (!o.vein && gen > 1) bed(p, d, o.bedKind, o.side); return; }
      }
      const mid = mix3(p, e, 0.5).map((x) => x + rr(-0.08, 0.08) * l);
      const a = o.vein ? 0 : o.a0 * (1 - (1 - o.ampTip) * (gen - 1) / maxGen);
      const b = add(mk([p, mid, e], r, r * 0.92, { part: o.part, vein: o.vein, d0: delay, a, pwv: o.pwv, side: o.side, level: gen, name: o.name }));
      const dEnd = b ? end(b).d : delay;
      const g1 = rr(O.ratio[0], O.ratio[1]), r1 = r * g1, r2 = r * Math.cbrt(Math.max(0.05, 1 - g1 ** 3));
      if (gen >= maxGen || r2 < T.minR) { if (!o.vein) bed(e, d, o.bedKind, o.side); return; }
      const psi = plane + Math.PI / 2 + rr(-0.4, 0.4), n1 = perp(d), n2 = cross(d, n1);
      const w = [0, 1, 2].map((k) => n1[k] * Math.cos(psi) + n2[k] * Math.sin(psi));
      const th1 = (rr(O.angle[0], O.angle[1]) * 0.6 * Math.PI) / 180, th2 = (rr(O.angle[0], O.angle[1]) * Math.PI) / 180;
      rec(e, norm([0, 1, 2].map((k) => d[k] * Math.cos(th1) + w[k] * Math.sin(th1))), r1, l * rr(O.lenRatio[0], O.lenRatio[1]), gen + 1, dEnd, psi);
      rec(e, norm([0, 1, 2].map((k) => d[k] * Math.cos(th2) - w[k] * Math.sin(th2))), r2, l * rr(O.lenRatio[0], O.lenRatio[1]), gen + 1, dEnd, psi);
    };
    rec(root, norm(dir), r0, len0, 1, o.d0, rr(0, 2 * Math.PI));
  };
  const named = (id) => { const v = NAMED.byId.get(id), e = end(v); return { p: e.p, d: v.vein ? -1 : e.d, a: v.a[v.a.length - 1], r: v.r[v.r.length - 1] }; };
  const heart = O.heart, outHeart = (p) => len(sub(p, heart.c)) > heart.r;
  const organ = (es) => (p) => es.some((e) => inEll(e, p, O.shrink)) && ctx.inside(p);
  const lung = (e) => (p) => inEll(e, p, O.shrink) && outHeart(p) && ctx.inside(p);
  const rootEnd = (id) => { const r = HEART_FORM.roots.find((x) => x.id === id); return r.pts[r.pts.length - 1]; };
  const sys = (part, vein, name, side, bedKind, centre, a0) => ({ part, vein, name, side, bedKind, centre, pwv: O.pwv, a0, ampTip: 0.4, d0: 0 });
  // Pulmonary arteries beside the bronchi (bronchovascular bundles, LUNGS.md §2.5, §7.2): from each
  // pulmonary artery's end (heart-form.js) an artery runs beside every airway branch of the lobar
  // bronchi down to generation pulmGen, on a side carried down the tree (rotation-minimising), with a
  // capillary bed at each tip. The veins keep their own trees between the segments.
  const AW = buildAirwayTree(), artEnd = new Map();
  for (const side of [1, -1]) artEnd.set(`root${side}`, { p: rootEnd(side > 0 ? 'pulmonaryArteryR' : 'pulmonaryArteryL'), d: O.pulmDelay, off: null });
  for (const b of AW.branches) {
    if (b.gen < 2 || b.gen > O.pulmGen || !b.side) continue;
    const par = artEnd.get(b.parent) ?? artEnd.get(`root${b.side}`);
    const t = norm(sub(b.b, b.a)), seed = par.off ?? sub(par.p, b.a);
    let off = sub(seed, [t[0] * dot(seed, t), t[1] * dot(seed, t), t[2] * dot(seed, t)]);
    off = len(off) > 1e-6 ? norm(off) : perp(t);
    const ra = Math.max(T.minR, b.r * O.pulmCal), gap = b.r + ra + O.pulmGap;
    const e = along(b.b, off, gap), mid = along(mix3(b.a, b.b, 0.5), off, gap);
    const a = O.pulmAmp * (1 - 0.5 * (b.gen - 2) / Math.max(1, O.pulmGen - 2));
    const br = add(mk([par.p, mid, e], ra, ra * 0.92, { part: VPART.PULM_ARTERY, vein: false, d0: par.d, a, pwv: O.pulmPwv, side: b.side, level: b.gen - 1, name: 'pulmonary' }));
    artEnd.set(b.id, { p: e, d: br ? end(br).d : par.d, off });
    if (b.gen === O.pulmGen || !b.children || !b.children.length) bed(e, t, 'lung', b.side);
  }
  for (const [side, lungE, pvs] of [[1, E.lungR, ['pulmonaryVeinRU', 'pulmonaryVeinRL']], [-1, E.lungL, ['pulmonaryVeinLU', 'pulmonaryVeinLL']]]) {
    const inside = lung(lungE);
    for (const pv of pvs) {
      const q = rootEnd(pv), aim = [lungE.c[0], lungE.c[1], lungE.c[2] + (pv.endsWith('U') ? 50 : -50)];
      fractal(q, sub(aim, q), 4.5, 30, 7, inside, { part: VPART.PULM_VEIN, vein: true, name: 'pulmonaryV', side, bedKind: 'lung', centre: lungE.c, pwv: 1, a0: 0, ampTip: 1, d0: -1 });
    }
  }
  const liver = organ([E.liver, E.liverL]), hep = named('hepatic'), por = named('portal');
  fractal(hep.p, [1, -0.2, 0.3], 1.6, 20, 6, liver, { ...sys(VPART.ARTERY_TWIG, false, 'hepaticTree', 0, 'liver', E.liver.c, hep.a), d0: hep.d });
  fractal(por.p, [1, -0.1, 0.2], 4, 26, 7, liver, sys(VPART.VEIN_TWIG, true, 'portalTree', 0, 'liver', E.liver.c, 0));
  for (const [id, dir, r0, gen] of [['hepaticV', [1, 0.2, -0.1], 3, 6], ['hepaticVM', [0.2, 0.6, -0.3], 2.5, 6], ['hepaticVL', [-1, 0.2, -0.1], 2, 5]]) {
    fractal(named(id).p, dir, r0, 22, gen, liver, sys(VPART.VEIN_TWIG, true, 'hepaticVTree', 0, 'liver', E.liver.c, 0));
  }
  const spl = named('splenic'), splV = named('splenicV'), spleen = organ([E.spleen]);
  fractal(spl.p, sub(E.spleen.c, spl.p), 1.8, 16, 5, spleen, { ...sys(VPART.ARTERY_TWIG, false, 'splenicTree', 0, 'spleen', E.spleen.c, spl.a), d0: spl.d });
  fractal(splV.p, sub(E.spleen.c, splV.p), 2.2, 16, 5, spleen, sys(VPART.VEIN_TWIG, true, 'splenicVTree', 0, 'spleen', E.spleen.c, 0));
  for (const [side, kid] of [[1, E.kidneyR], [-1, E.kidneyL]]) {
    const ra = named('renal' + suffix(side)), rv = named('renalV' + suffix(side)), inK = organ([kid]);
    fractal(ra.p, sub(kid.c, ra.p), 2.2, 14, 6, inK, { ...sys(VPART.ARTERY_TWIG, false, 'renalTree', side, 'kidney', kid.c, ra.a), d0: ra.d });
    fractal(rv.p, sub(kid.c, rv.p), 2.6, 14, 6, inK, sys(VPART.VEIN_TWIG, true, 'renalVTree', side, 'kidney', kid.c, 0));
  }

  // 4. Gut (§13.3): jejunal and ileal arteries from the SMA with arcades and vasa recta; the colic
  // arteries and the marginal artery along the colon. Veins run beside the arteries.
  const vasaRecta = (m, g, dAt, a, toward) => {
    for (let k = 0; k < 3; k++) {
      const ang = (u() < 0.5 ? -1 : 1) * rr(0.6, 1.4), back = [-toward[0], -toward[1], -toward[2]], side = norm(cross(g.t, back));
      const w = norm([0, 1, 2].map((j) => back[j] * Math.cos(ang) + side[j] * Math.sin(ang))), e = along(g.p, w, g.r);
      const vr = add(mk([m, e], 0.45, 0.35, { part: VPART.ARTERY_TWIG, d0: dAt, a: a * 0.5, pwv: T.pwv, level: 3, name: 'vasaRecta' }));
      if (vr) bed(e, w, 'gut', 0);
    }
  };
  const veinBeside = (b, name) => {
    const off = along([0, 0, 0], perp(norm(sub(b.pts[b.pts.length - 1], b.pts[0]))), 2.5);
    add(mk(b.pts.map((q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]]), b.r[0] * 1.2, b.r[b.r.length - 1] * 1.2, { part: VPART.VEIN_TWIG, vein: true, level: b.level, name }));
  };
  const sma = NAMED.byId.get('sma');
  let prev = null;
  for (const g of ctx.gut.small) {
    const at = nearestOn(sma, g.p), toward = norm(sub(at.p, g.p)), m = along(g.p, toward, g.r + 2);
    const mid = mix3(at.p, m, 0.6).map((x) => x + rr(-3, 3));
    const art = add(mk([at.p, mid, m], 1.3, 0.9, { part: VPART.ARTERY_TWIG, d0: at.d, a: at.a * 0.8, pwv: 8.5, level: 1, name: 'jejunal' }));
    if (!art) continue;
    veinBeside(art, 'jejunalV');
    const dm = end(art).d;
    if (prev) {
      const am = mix3(prev.m, m, 0.5).map((x, k) => x + 0.5 * (toward[k] + prev.toward[k]) * 6);
      const arc = add(mk([prev.m, am, m], 0.8, 0.8, { part: VPART.ARTERY_TWIG, d0: Math.min(prev.d, dm), a: at.a * 0.7, pwv: 9, level: 2, name: 'arcade' }));
      if (arc) veinBeside(arc, 'arcadeV');
    }
    vasaRecta(m, g, dm, at.a, toward);
    prev = { m, d: dm, toward };
  }
  const C = ctx.gut.colon, mpts = C.map((g) => along(g.p, norm([-g.p[0], 10 - g.p[1], 0]), g.r + 3));
  /** @type {[string, number[], number][]} */
  const feeders = [['sma', [36, 40, -640], 0.02], ['sma', [10, 50, -585], 0.15], ['sma', [2, 48, -545], 0.38], ['ima', [-26, 24, -580], 0.66], ['ima', [-34, 24, -610], 0.86]];
  const mcum = arcs(mpts), fed = [];
  for (const [vid, q, frac] of feeders) {
    const src = nearestOn(NAMED.byId.get(vid), q), idx = Math.round(frac * (mpts.length - 1)), tgt = mpts[idx];
    const colic = add(mk([src.p, mix3(src.p, tgt, 0.5).map((x) => x + rr(-4, 4)), tgt], 1.2, 0.9, { part: VPART.ARTERY_TWIG, d0: src.d, a: src.a, pwv: 8.5, level: 1, name: 'colic' }));
    if (colic) { veinBeside(colic, 'colicV'); fed.push([mcum[idx], end(colic).d, src.a]); }
  }
  if (fed.length && mpts.length > 1) {
    const marg = add(mk(mpts, 0.9, 0.8, { part: VPART.ARTERY_TWIG, d0: 0, a: 1.2, pwv: 9, level: 2, name: 'marginal' }));
    marg.d = mcum.map((c) => Math.min(...fed.map(([cf, df]) => df + Math.abs(c - cf) / 9000)));
    veinBeside(marg, 'marginalV');
    for (let i = 0; i < C.length; i += 2) vasaRecta(mpts[i], C[i], marg.d[i], 1.2, norm(sub(mpts[i], C[i].p)));
  }

  // 5. Intercostal (T3–T11) and lumbar (L1–L4) arteries and veins: each pair jittered in path and
  // density, the pulse damped (§13.6). The arteries leave the aorta; the veins join the azygos
  // (right), the hemiazygos (left) and, in the loins, the IVC.
  const aorta = NAMED.byId.get('aorta'), ivc = NAMED.byId.get('ivc');
  const pair = (pts, side, veinTo, rA, name) => {
    const wf = rr(0.7, 1.3), jz = rr(-3, 3);
    const art = pts.map((q) => [q[0], q[1], q[2] + 4 + jz]), at = nearestOn(aorta, art[0]);
    add(mk([at.p, ...art], rA, rA * 0.55, { part: VPART.ARTERY_TWIG, d0: at.d, a: at.a * TREE.periodicAmp, pwv: 9, side, level: 1, name, wf }));
    const vp = pts.map((q) => [q[0], q[1], q[2] + 8 + jz]), vt = nearestOn(veinTo, vp[0]);
    add(mk([vt.p, ...vp], rA * 1.2, rA * 0.7, { part: VPART.VEIN_TWIG, vein: true, side, level: 1, name: name + 'V', wf }));
  };
  for (const ic of ctx.intercostal) {
    const lvl = Number(ic.seg.slice(1));
    if (ic.seg[0] !== 'T' || lvl < 3 || lvl > 11) continue;
    pair(ic.pts.slice(1), ic.side, NAMED.byId.get(ic.side > 0 ? 'azygos' : 'hemiazygos'), 1.1, 'intercostal');
  }
  for (const z of [-482, -515, -548, -580]) for (const side of [1, -1]) {
    const j = rr(-4, 4);
    pair([[18, -40, z + j], [36, -58, z - 4 + j], [58, -72, z - 8 + j], [82, -78, z - 12 + j]].map((q) => [side * q[0], q[1], q[2]]), side, ivc, 1.3, 'lumbar');
  }

  // 6. Venous valves (§13.5): faint rings every 35–50 mm in the limb veins.
  for (const v of NAMED.list) {
    if (!v.vein || !TREE.valves.veins.includes(v.name)) continue;
    for (let s = rr(10, 30); s < v.len; s += rr(TREE.valves.every[0], TREE.valves.every[1])) {
      const q = vesselPoint(v, s), n1 = perp(q.t), n2 = cross(q.t, n1), R = q.r * 0.95;
      const ring = Array.from({ length: 9 }, (_, k) => [0, 1, 2].map((m) => q.p[m] + (n1[m] * Math.cos((k * Math.PI) / 4) + n2[m] * Math.sin((k * Math.PI) / 4)) * R));
      add(mk(ring, 0.3, 0.3, { part: VPART.VEIN, vein: true, side: v.side, level: 0, name: 'valve' }));
    }
  }
  const out = { branches, beds };
  detailCache.set(seed, out);
  return out;
}

// A point on a vessel at arc s: { p, t (unit tangent), r, d, a, i, f }.
export function vesselPoint(v, s) {
  let i = 0;
  while (i < v.cum.length - 2 && v.cum[i + 1] < s) i++;
  const f = Math.min(1, Math.max(0, (s - v.cum[i]) / Math.max(1e-9, v.cum[i + 1] - v.cum[i])));
  const a = v.pts[i], b = v.pts[i + 1];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], t: norm(sub(b, a)), r: lerpAt(v.r, i, f), d: lerpAt(v.d, i, f), a: lerpAt(v.a, i, f), i, f };
}
