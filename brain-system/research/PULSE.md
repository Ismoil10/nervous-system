# Arterial pulse wave and the vascular tree

The user asked for the pressure pulse that every heartbeat sends through the arteries, drawn on a
denser and more realistic vascular network of fine stars, like the brain's neural network. This
note is the analysis and the design; `src/body/vessel-tree.js`, `src/pulse.js`, the vessel stars of
`src/body/generate.js` and `BODY_VS` build it. The beat itself comes from `src/heart.js`
(research/HEART.md §3).

## 1. What existed (before this pass)

- **Vessels:** four polylines in `geometry.js` `VESSELS` (aorta, IVC, SVC, both carotids), drawn by
  65 % of the `vessel` budget group (7,500 stars at High); the rest is the blood haze (15 %, the
  capillary bed as a whole-body fog below z −100) and the immune speckle (20 %). No limb, visceral,
  cerebral or venous tree, no taper, no colour difference between arteries and veins outside the
  heart.
- **Beat:** `HeartBeat` (heart.js) gives the beat times, the aortic valve opening (`ventricularTimes`:
  ejection starts 70 ms after the QRS onset), the arterial pressure shape (`arterialWave`) and the
  systolic and diastolic pressures from the vitals. Nothing carried the pulse beyond the aortic root
  (`uHeartM.z`, a 12 % root glow during ejection).

## 2. Pulse wave velocity

The pressure wave travels at the pulse wave velocity (PWV), far faster than the blood itself
(≈ 0.2–1 m/s). By Moens–Korteweg, PWV = √(E·h / (2·r·ρ)): it rises where the wall is stiffer (E),
thicker relative to the radius (h/r), so it rises from the elastic aorta to the muscular arteries.

| Segment (healthy adult, 30–40 years, rest) | PWV (m/s) | Model | Source |
|---|---|---|---|
| Ascending aorta and arch | 4–5 | 4.5 | Nichols & O'Rourke 2011 ch. 4; MRI series |
| Descending thoracic aorta | 5–6 | 5.5 | same |
| Abdominal aorta | 6–7 | 6.5 | same |
| Common carotid, internal carotid | 5.5–7 | 6.0 | local carotid PWV; Nichols & O'Rourke |
| Cerebral arteries (intracranial ICA, MCA, ACA, PCA, basilar) | few data; ≈ 6–8 | 7.0 | [model] |
| Subclavian, axillary | ≈ 7 | 7.0 | Avolio et al. 1983 |
| Brachial | 8–9 | 8.5 | Avolio et al. 1983 |
| Radial, ulnar, palmar arches, digital | 8–10 | 9.5 | Avolio et al. 1983 |
| Iliac, femoral | 8–9 | 8.5 | Nichols & O'Rourke |
| Popliteal, tibial, peroneal, dorsalis pedis, plantar | 9–11 | 10.0 | Avolio et al. 1983 |
| Visceral branches (coeliac, mesenteric, renal) | 7–9 | 8.0 | [model] |
| Small arteries and arterioles (the twigs) | the wave is damped rather than carried | 10.0 | [model] |

- **Age.** The aorta stiffens with age; the muscular arteries hardly change. Carotid–femoral PWV
  (the aortic reference) is ≈ 6 m/s under 30 and ≈ 10–11 m/s at 70 and over (Reference Values for
  Arterial Stiffness' Collaboration 2010); arm PWV stays near 8–10 m/s (Avolio et al. 1983). The
  model is a healthy adult of about 35; age is not a control.
- **Pressure.** Arterial wall stiffness rises with distending pressure, so PWV rises acutely with the
  mean arterial pressure (MAP): roughly +0.5–1 m/s per 10 mmHg in the aorta (Spronck et al. 2015).
  Model: +0.8 % per mmHg of MAP above rest.
- **Heart rate.** The viscoelastic wall is stiffer at higher frequencies: PWV rises ≈ 0.2–0.4 m/s
  per 10 bpm (Lantelme et al. 2002). Model: +0.3 % per bpm above 68.
- **Sympathetic tone.** Smooth-muscle tone stiffens the muscular arteries (Boutouyrie et al. 1994);
  acute mental stress raises carotid–femoral PWV by ≈ 0.5 m/s for an hour (Vlachopoulos et al.
  2006). In the model this is carried by the MAP and HR terms, which both rise under Stress.

The model scales every segment's delay by one factor k = 1 / (1 + 0.008·(MAP − MAP₀) + 0.003·(HR − 68)),
clamped to 0.65–1.1, with MAP₀ the resting mean of the vitals (DBP + (SBP − DBP)/3).

## 3. Reflection and pulse-pressure amplification

- **Reflection sites.** Every branching point and taper reflects part of the wave; the high-resistance
  arteriolar beds reflect most (reflection coefficient ≈ 0.3–0.8 at the terminal beds), and the
  aortic bifurcation and the lower-limb beds give the main reflected wave seen in the aorta.
- **Timing.** In a young adult the reflected wave returns to the aortic root in late systole or early
  diastole: it raises diastolic pressure (coronary perfusion) and leaves the central systolic peak
  low (augmentation index ≤ 10 %; Murgo et al. 1980, type C). With a stiffer aorta (age, high
  pressure, stress) it returns earlier, during systole, and augments the central systolic pressure
  (type A, augmentation index 20–40 %).
- **Amplification.** Towards the periphery the incident and reflected waves add closer together and
  the arteries taper, so the pulse pressure (PP) grows while the mean pressure falls only 2–5 mmHg
  along the large arteries. Brachial / aortic PP is ≈ 1.5–1.7 at 20 years and ≈ 1.2–1.3 at 80
  (McEniery et al. 2008; Avolio et al. 2009).

| Site | PP / aortic PP (young adult) | Model A |
|---|---|---|
| Aortic root, arch | 1.0 | 1.0 |
| Abdominal aorta | 1.1–1.2 | 1.15 |
| Common carotid | 1.0–1.1 | 1.05 |
| Brachial | 1.3–1.5 | 1.35 |
| Radial | 1.4–1.7 | 1.5 |
| Femoral | 1.3–1.5 | 1.4 |
| Popliteal | ≈ 1.5 | 1.5 |
| Dorsalis pedis, posterior tibial | 1.6–1.8 | 1.65 |
| Small arteries and arterioles | falls with each generation (damping) | 0.55·A at the first twig level, 0.25·A at the second |
| Capillaries, venules, veins | ≈ 0 (no arterial pulse) | 0 |

The model's A rises linearly with the path distance from the root within each limb and is
interpolated between the sites of the table.

## 4. Foot-to-foot delay from the aortic valve

The arrival time at a site is the integral of path length / PWV along the arteries from the aortic
root (foot-to-foot, the onset of the upstroke). Ranges are for a resting young adult; the model
values come from the tree (§9) and are tested (§11).

| Site | Path from the aortic root | Expected delay | Model (rest): path, delay, A |
|---|---|---|---|
| Carotid (mid-neck) | ≈ 0.15–0.20 m (up the ascending aorta to the arch first) | 25–40 ms | 0.19 m, 37 ms, 1.04 |
| Brachial (antecubital fossa) | ≈ 0.50–0.60 m | 60–80 ms | 0.56 m, 80 ms, 1.34 |
| Radial (wrist) | ≈ 0.75–0.85 m | 85–110 ms | 0.81 m, 106 ms, 1.49 |
| Index fingertip | ≈ 0.95–1.05 m | 110–140 ms | 1.01 m, 128 ms, 1.50 |
| Femoral (groin) | ≈ 0.55–0.70 m | 85–115 ms | 0.67 m, 109 ms, 1.31 |
| Popliteal | ≈ 1.00–1.15 m | 130–165 ms | 1.11 m, 160 ms, 1.48 |
| Posterior tibial (medial malleolus) | ≈ 1.45–1.55 m | 175–210 ms | 1.53 m, 202 ms, 1.64 |
| Dorsalis pedis | ≈ 1.45–1.60 m | 175–215 ms | 1.60 m, 210 ms, 1.62 |

The left side is within 15 % of the right (tested). The paths are those of a 1.75-m figure measured
along the vessels, so they run longer than the straight surface distances used clinically.

Checks: carotid–femoral transit ≈ 60–80 ms at a carotid–femoral PWV of 6.5 m/s over ≈ 0.45 m; the
ECG R wave to radial pulse arrival is ≈ 180–220 ms, of which ≈ 60–100 ms is the pre-ejection period.
The test ranges (§11) are carotid 15–40 ms, radial 70–115 ms, femoral 70–120 ms and dorsalis pedis
150–230 ms, and the order of the sites must follow their path lengths.

## 5. The shape of the wave along the tree

- **Aortic root:** a rounded systolic peak, an inflection where the reflected wave returns, the
  sharp incisura at aortic valve closure, then the diastolic decay (the `arterialWave` of heart.js).
- **Towards the periphery** (brachial, radial, femoral, pedal):
  - the upstroke steepens (the higher-frequency parts travel faster and are amplified);
  - the systolic peak becomes higher and narrower ("peaking");
  - the incisura is smoothed into a later, rounded dicrotic notch, followed by a distinct diastolic
    (dicrotic) wave;
  - diastolic and mean pressures fall slightly (1–5 mmHg).
- **Fingertip (photoplethysmogram, PPG):** a volume signal, a low-passed pressure wave: the peak
  comes ≈ 150–250 ms after its foot, the notch becomes a shoulder, and sympathetic
  vasoconstriction shrinks its amplitude.

The display (§8) shows the arrival front and the amplitude at every star; the shape difference is
shown on the monitor, which already draws the central-like ART trace and gains a peripheral PLETH
trace (§10).

## 6. Damping: arterioles, capillaries and veins

- **Windkessel.** The elastic aorta stores part of each stroke and releases it in diastole, so flow
  in the periphery is pulsatile but continuous.
- **Arterioles** (≈ 10–100 µm) carry the largest pressure drop (mean ≈ 85 → 35 mmHg) and damp the
  pulse: the pulse pressure falls from ≈ 50 to a few mmHg across them.
- **Capillaries:** almost steady flow (a few mmHg of pulsation at most): the existing blood haze gets
  no pulse.
- **Venules and veins:** no arterial pulse. The central veins show the jugular venous pulse (a, c and
  v waves from the right atrium), a separate, retrograde wave; it is not modelled in this pass.
  Veins are drawn steady.

## 7. Stress and arousal

The pulse adds no physiology: it reads the rate, the pressures and the beat from the simulation and
the heart model.

| State | HR | Pressures | PWV and delays | Amplitude | Peripheral pulse |
|---|---|---|---|---|---|
| Calm | ≈ 68 | ≈ 115/75 | rest (k = 1) | 1 | full finger PPG |
| Stress | 78–83 | mean up ≈ 5 mmHg (the simulation gives ≈ 118/81) | PWV ↑ ≈ 7 %, delays ≈ 7 % shorter, fingertip ≈ 9 ms earlier | PP as simulated (≈ 37 mmHg: G ≈ 0.93); steeper upstroke (contractility) | sympathetic vasoconstriction: PPG amplitude falls (≈ −20 to −40 % in the fingers) |
| Pleasure (arousal to climax) | 89 → 125 | SBP up to +45 at the peak | PWV ↑ up to ≈ 30–40 %, delays ≈ 25–30 % shorter | PP ↑ strongly (≈ ×1.5) | flushed skin, PPG amplitude kept |

- Amplitude G = clamp(PP / PP₀, 0.6, 1.6), with PP₀ = 40 mmHg (115/75).
- Finger PPG amplitude = (skin blood flow ÷ 0.25 L/min)^0.8, clamped to 0.45–1.4, from the kernel's
  `sbf`, which the cutaneous vasoconstrictor tone sets (sim/autonomic.js, §7.7).
- References for stress: Vlachopoulos et al. 2006 (PWV and wave reflection under mental stress);
  Kudielka et al. 2004 (HR +10–25 bpm under the TSST); RESPONSE.md §4.1 for the arousal envelope.

## 8. Display and photosensitivity (§13.9, §13.15)

What can be shown:

- **A travelling brightening** of each artery star at its arrival time: the brightening follows the
  upstroke (the wave front), a Gaussian in time with σ = 25 ms centred 30 ms after the foot. At
  5–10 m/s this front is 0.12–0.25 m long, so the whole tree lights in sequence over ≈ 0.2 s, heart
  to feet: the realistic speed reads as a fast sweep, not a slow crawl. Slow motion (`kh` < 1) slows
  it with the heartbeat.
- **No radial swelling.** Real arteries widen by ≈ 5–10 % (aorta, carotid) and 2–5 % (muscular
  arteries) per beat: at most ±1.5 mm, under one pixel in the Whole body view. It would read as
  noise, so the brightening is the cue.
- **Arteries only.** Arterial twigs pulse at reduced amplitude (damping); capillary haze and veins
  stay steady.

Rules it keeps:

- **Rate.** The pulse runs at the heart rate and follows the heartbeat row of §13.15: per beat in
  screen time up to 150 bpm, any `kh`. Above 150 bpm, or while paused, the arteries are steady
  (the heart's steady glow mode).
- **No flash.** The per-star gain is 1 + G·A·0.55·b(t) − G·M(t): at most ≈ ×1.9 at rest and ≈ ×2.5 at
  the largest pulse pressure, on a faint star (the vessel class flux is 0.1 of the mean neuron star).
  The pulse changes luminance only, never chromaticity, so it makes no red transition. A star is far below 10 % of the maximum
  relative luminance, and the lit band is a few pixels wide, far under the flash area (21,824 px²).
- **Energy-conserving, as the heart's wave.** M(t) is the flux-weighted mean of the brightening over
  all drawn pulsing stars at that moment; every pulsing star gives it back, so the total light of the
  vessel class is constant through the beat (tested to < 1 %). The per-beat luminance swing of any
  region is then the redistribution inside it: the arterial stars carry ≈ 1–3 % of a region's light,
  so a region swings well under the 8 % heartbeat limit.
- **Reduced motion.** Nothing moves, so the brightening stays (as the heart's wave does).
- The limiter (§13.15) keeps the last word.

## 9. The vascular tree (design)

`VESSEL_TREE` in `src/body/vessel-tree.js` holds the geometry; the vessel stars of
`src/body/generate.js` draw it. The tree is not part of `PATHS`: the path indices of the gut and the
nerves stay as they are, and the tree stars carry path −1.

**Arteries** (polylines in the body frame; right side mirrored for the left limbs and head):

- aorta from the aortic valve (meeting the heart's root) through the arch to the bifurcation at L4;
- arch branches: brachiocephalic trunk (right subclavian and right common carotid), left common
  carotid, left subclavian;
- neck and head: common carotid, carotid bifurcation, internal and external carotid, vertebral
  arteries, basilar, and the circle of Willis with the anterior, middle and posterior cerebral
  arteries;
- upper limb: subclavian, axillary, brachial (medial arm), radial (lateral forearm) and ulnar (medial
  forearm), the superficial and deep palmar arches and the digital arteries;
- trunk: coeliac trunk (common hepatic, splenic, left gastric), superior and inferior mesenteric,
  renal arteries;
- lower limb: common, external and internal iliac (internal iliac schematic: its gluteal trunk only),
  femoral (anteromedial thigh, adductor canal), popliteal, anterior tibial to the dorsalis pedis,
  posterior tibial to the medial and lateral plantar arteries, peroneal.

**Veins** (blue in Detailed; no pulse): superior and inferior venae cavae, brachiocephalic, internal
and external jugular, the dural sinuses (superior sagittal, transverse, sigmoid), subclavian,
axillary, brachial, cephalic, basilic and median cubital, radial and ulnar, the dorsal venous arch of
the hand, hepatic, renal and portal veins, common and external iliac, femoral, popliteal, tibial,
great and small saphenous, and the dorsal venous arch of the foot.

**Twigs.** Deterministic branching (one seed) gives each artery and vein of radius ≤ 6 mm side
branches every 25–45 mm, 15–45 mm long, two generations deep, kept ≥ 2 mm inside the skin. They are
the small arteries and arterioles at drawing scale (the real ones are far below a pixel) and give the
network its density, as the brain's fibres do.

**Taper by Murray's law.** At each branching r_parent³ = Σ r_child³ (Murray 1926). The named vessels
take their anatomical radii (aorta 14 → 9 mm, common carotid 3.5, brachial 2, radial 1.4, femoral
3.5, dorsalis pedis 1); a twig of radius r_c leaves its parent with (r³ − r_c³)^⅓, and r_c is
0.45–0.6 r. The drawn radius is never below 0.4 mm.

**Stars.** Vessels of radius ≥ 4 mm are walls (a shell at 0.8–1.0 r), so the aorta and the venae
cavae read as fine tubes; smaller ones a Gaussian core (σ = 0.5 r, at least 0.4 mm). Density per mm
∝ (0.35 + √r) × the part weight (artery 1, arterial twig 0.45, vein 0.6, venous twig 0.3), so the
named arteries carry most of the stars and the fine branches stay visible. In the shader the tree's
flux per part is ×4 / ×2.4 / ×2.6 / ×1.6 the vessel class flux [browser check: at ×1.6 the arteries
were lost among the nerves, whose streams carry ≈ 6 stars per mm].

**Per-star data** in the normal slot (unused by the vessel class until now, as the heart stars do):

- x: arrival delay at rest from the aortic valve opening (s); −1 for stars with no pulse;
- y: the vessel part code (0 the earlier haze and immune stars, 1 artery, 2 arterial twig, 3 vein,
  4 venous twig, 5 earlier great artery, 6 earlier great vein);
- z: the pulse amplitude A (§3).

The earlier great-vessel stars keep their positions (the Stars style draws them as before) and carry
their delay along the aorta and carotids, so the Stars style pulses too.

**Colours (Detailed).** Arteries the heart's oxygenated red, veins the heart's venous blue; the
earlier haze and immune stars keep the vessel class colour.

**Budgets.** The tree takes 87.5 % of the `vessel` group: 15,750 / 31,500 / 52,500 / 84,000 stars
(low, medium, high, ultra). The group becomes 18,000 / 36,000 / 60,000 / 96,000, the same
0.3 / 0.6 / 1 / 1.6 tier ratio as before, so the tier compensation of the earlier stars does not
change. Body totals become 104,250 / 202,500 / 333,000 / 514,000. The Stars style draws no tree stars and the earlier ones at
the earlier share (2/3), so its look is unchanged; Detailed draws the tree and not the earlier
great-vessel polylines it replaces.

**Uniforms.** `BODY_VS` is at the 110-slot test limit. One new vec4, `uPulse` (reduced time since
the aortic valve opened, amplitude G, the energy-conserving mean G·M, unused), and the two style
floats `uAnat` and `uSizeK` packed into one `uStyle` vec2, so the count stays at 110. The tree's
share in the Stars style sits in the free lane `uKeep[2].w`.

## 10. Monitor tie-in

- **PLETH:** a fingertip plethysmograph trace (cyan, the bedside convention): the arterial wave at
  the fingertip delay, low-passed (τ = 60 ms) into a volume pulse, its notch a shoulder.
- **PTT:** the pulse transit time from the ECG R wave to the foot of the finger pulse, in ms, as the
  channel's number: (aortic valve opening − R peak) + k × the fingertip delay. It falls under Stress
  and Pleasure, the visible sign of the stiffer, faster arteries. The beat model's pre-ejection
  period is short (the valve opens 35 ms after the R peak; ≈ 60–100 ms is measured), so the PTT
  reads ≈ 40–60 ms below bedside values; its change with the state is the point.
- **No SpO₂ number:** the model does not compute oxygen saturation.

## 11. Tests (`test/pulse.test.mjs`)

- Arrival delays rise with the path length (carotid < brachial < radial; femoral < popliteal <
  dorsalis pedis) and fall in the §4 ranges.
- The delay scale k and the amplitude G follow §7 (shorter under higher MAP and HR, clamped).
- Energy conservation: over a beat, the flux-weighted total of the pulsing stars stays within 1 % of
  its resting value; veins and haze carry no pulse.
- Budgets: the vessel group and body totals of §9 in generate.js, the renderer, performance.js.
- Stars style unchanged: no tree star drawn, the earlier vessel stars drawn at the earlier share and
  bit-identical positions.
- `uPulse` is declared and `BODY_VS` stays at ≤ 110 slots.

## 12. Result (as built)

**Code.**
- `src/body/vessel-tree.js`: `VESSEL_TREE` (140 named vessels, 24.1 m: 83 arteries, 11.7 m, and 57 veins,
  12.5 m, both sides counted), `buildTwigs` (1,223 twigs, 22.0 m, 632 of them arterial), `pulseSite`, `arteryAt`,
  `VPART`. Every named point lies inside the body; < 1 % of the tree stars fall outside the skin.
- `src/body/generate.js`: `treeEntries` and `genVessels` (the earlier vessel, haze and immune stars
  first, bit-identical, then the tree); the earlier great-vessel stars take their delay from the tree
  (`earlierPulse`).
- `src/pulse.js`: `PulseWave` (valve-opening clock, delay scale k, amplitude G, the means of the tree
  and of the earlier great arteries, the PLETH trace and the PTT), `delayScale`, `pulseAmplitude`,
  `pulseKernel`.
- `src/shaders.js` `BODY_VS`: `uPulse`, the tree's keep, colours and flux per part, the head fade of
  the tree; `uAnat` and `uSizeK` packed into `uStyle`. 110 slots, as before.
- `src/renderer.js` (`setPulse`, `keepTree`, budgets), `src/performance.js` (`TIERS.body`),
  `src/main.js` (wiring), `src/monitor.js`, `src/ui-simple.js`, `index.html`, `style.css` (the PLETH
  row and the PTT).

**State values.**

| State | HR | Pressure | k | G | PTT |
|---|---|---|---|---|---|
| Calm | 68 | 115/75 | 1.00 | 1.00 | 163 ms |
| Stress | 79 | 118/81 | 0.93 | 0.93 | 154 ms |
| Pleasure, arousal | 96 | 137/79 | 0.86 | 1.45 | 145 ms |
| Pleasure, climax (model) | 125 | 160/95 | 0.72 | 1.60 | ≈ 127 ms |

**Measured in the app** (Ultra, Apple M4, port 8770):
- Detailed: the red arterial tree reads clearly in the head (cerebral and scalp arteries), the neck
  (carotids, vertebrals), the shoulders and arms; the veins run blue beside them and under the skin.
- Stars: the earlier look, no tree star drawn.
- The frame-mean luminance over several beats varied by 0.04 % at Calm and ≈ 1 % in Pleasure (heart,
  pulse and dopamine together); the limiter factor stayed ≈ 1.
- The energy-conserving mean G·M peaks at ≈ 0.18 per beat at Calm.
- Body generation in Node: 1.8 s at High, 1.4 s at Ultra (the tree's twigs are built once).

**Tests.** `test/pulse.test.mjs` has 6 tests. The full suite has 573 tests: 541 pass, 4 known arm64
golden failures, 28 todo. `tsc` is clean.

**Not done.** The jugular venous pulse, the pulmonary arterial pulse, the coronary pulse and the
intercostal and lumbar arteries (left out under the periodic-structure rule of §13.15).

## 13. Finest detail (second pass)

The user asked for every aorta segment, artery, vein and capillary to be developed down to the
finest detail. Real vessels span ≈ 20–25 generations, from the aorta (radius ≈ 15 mm) to capillaries
(radius ≈ 3–5 µm) (Zamir 2000). One star is ≈ 0.3–3 mm wide on screen, so the drawing carries the
named vessels, then 3–9 generations of branches to a drawn radius of ≈ 0.3–0.4 mm, then capillary
beds drawn at drawing scale: each bed stands for the many thousands of capillaries at one terminal
branch.

### 13.1 Aorta

| Segment | Diameter (adult) | Model radius | Note | Source |
|---|---|---|---|---|
| Annulus | 20–26 mm | 12 | at the valve ring (heart-form.js) | Erbel et al. 2014 |
| Sinuses of Valsalva | 30–36 mm | 14 → 17 in three lobes | three bulges (right, left and non-coronary sinus); the coronary arteries leave the first two | Erbel et al. 2014 |
| Sinotubular junction | 25–29 mm | 13 | the waist above the sinuses | same |
| Ascending aorta | 28–34 mm | 14 | | Hiratzka et al. 2010 |
| Arch | 26–30 mm | 13 → 12.5 | brachiocephalic trunk, left common carotid, left subclavian | same |
| Isthmus | 22–24 mm | 12 | just past the left subclavian | same |
| Descending thoracic | 24–26 mm, 22–24 at the hiatus | 12 → 11 | posterior intercostal arteries T3–T11, bronchial and oesophageal branches | same |
| Abdominal, suprarenal | 20–22 mm | 10.5 | inferior phrenic, coeliac, superior mesenteric, middle suprarenal, renal | same |
| Abdominal, infrarenal | 17–19 mm | 10 → 9 | lumbar arteries L1–L4, inferior mesenteric; bifurcation at L4 | same |

- **Wall:** ≈ 2 mm (intima; a media of 50–60 elastic lamellae; adventitia). Drawn as a shell 0.8–1.0 r.
- **Vasa vasorum:** small vessels in the adventitia of the aorta and the venae cavae, drawn as fine
  branches lying on the wall.
- Gonadal arteries and veins are left out (A.1).

### 13.2 Named arteries added

- **Head and neck:** superior thyroid, lingual, occipital, posterior auricular; ophthalmic; anterior
  communicating; posterior inferior, anterior inferior and superior cerebellar arteries;
  thyrocervical trunk (inferior thyroid, transverse cervical, suprascapular).
- **Chest wall and abdomen wall:** internal thoracic → superior epigastric, meeting the inferior
  epigastric from the external iliac in the rectus sheath; posterior intercostal arteries T3–T11 in
  the costal grooves (vein above, artery, nerve below: VAN); lumbar arteries L1–L4.
- **Upper limb:** thoracoacromial, lateral thoracic, subscapular and thoracodorsal, posterior
  circumflex humeral, profunda brachii, superior ulnar collateral, radial and ulnar recurrent,
  common, anterior and posterior interosseous, dorsal carpal arch, two proper digital arteries on
  each finger and the thumb.
- **Abdomen:** inferior phrenic, gastroduodenal, right and left gastroepiploic, short gastric,
  suprarenal; jejunal and ileal arteries with arcades and vasa recta; ileocolic, right, middle and left
  colic and sigmoid arteries joined by the marginal artery; superior rectal.
- **Lower limb:** superior and inferior gluteal; profunda femoris with perforating arteries; lateral
  and medial circumflex femoral; descending genicular and the four genicular arteries round the knee;
  anterior tibial recurrent; arcuate artery with dorsal metatarsal arteries; plantar arch with
  plantar metatarsal arteries; two digital arteries on each toe.

### 13.3 Organ trees

| Organ | Supply and drainage | Pattern drawn | Source |
|---|---|---|---|
| Lungs | pulmonary artery (deoxygenated, blue) along the bronchi, ≈ 17 orders; 4 pulmonary veins (oxygenated, red) between the segments | dichotomous trees from each hilum, Murray ratio 2^(−⅓) ≈ 0.79, 7–8 generations | Huang et al. 1996; Weibel 1963 |
| Liver | portal vein (≈ 75 % of the flow) and hepatic artery (≈ 25 %) side by side into the lobules; hepatic veins to the IVC | three trees from the hilum and the IVC, 6–7 generations | Guyton & Hall ch. 71 |
| Kidneys | renal artery → 5 segmental → interlobar → arcuate → interlobular → afferent arterioles → ≈ 1 million glomeruli per kidney | a fan from the hilum to the cortex, glomerular tufts in the outer third | Guyton & Hall ch. 27 |
| Spleen | splenic artery → trabecular branches | a fan from the hilum | — |
| Small intestine | 12–20 jejunal and ileal arteries; 1–2 tiers of arcades in the jejunum, 3–5 in the ileum; vasa recta, long in the jejunum, short in the ileum | arteries from the SMA to the mesenteric border, arcades between them, straight vasa recta to the wall | Moore et al. 2018 |
| Colon | marginal artery (Drummond) along the mesenteric border, fed by the colic arteries | a polyline along the colon, fed by the named colic arteries | same |
| Brain | cortical branches of the anterior, middle and posterior cerebral arteries; lenticulostriate arteries | twigs three generations deep on the cerebral arteries | — |

### 13.4 Capillaries

- **Size and number:** capillaries are 5–10 µm wide and 0.5–1 mm long; the body holds ≈ 10 billion of
  them, with an exchange surface of several hundred m² (Guyton & Hall ch. 16). Pressure falls from
  ≈ 35 to ≈ 15 mmHg along them; transit takes ≈ 1–2 s. Flow is steady in the systemic beds (§6);
  pulmonary capillary flow is pulsatile, but drawn steady here.
- **Density by tissue:** myocardium ≈ 3,000–4,000 per mm² of cross-section; skeletal muscle
  ≈ 300–1,000; brain grey matter dense, white matter sparse; lungs ≈ 280 billion capillary segments
  round ≈ 480 million alveoli (Weibel 1963; Ochs et al. 2004); kidney glomeruli ≈ 200 µm tufts of
  ≈ 50 loops.
- **Oxygen saturation:** arterial ≈ 97–98 %; venous outflow by organ: kidney ≈ 90 %, skin ≈ 80 %, liver
  (mixed portal) ≈ 70 %, brain ≈ 65 %, resting muscle ≈ 65 %, heart ≈ 30 %; mixed venous ≈ 70–75 %.
  In the lungs the gradient runs the other way: ≈ 75 % in, ≈ 98 % out.
- **Drawn as beds.** Every terminal arterial branch ends in a bed: 5–8 short strands (random walks of
  a few mm) leaving the branch tip, with stars along them. Each star carries its saturation, which
  colours it from arterial red through purple to venous blue, at the organ's venous saturation. Beds
  are 2–6 mm across; glomeruli are compact tufts ≈ 1.5 mm across; lung beds are diffuse.

### 13.5 Veins added

Azygos and hemiazygos (draining the posterior intercostal veins), internal thoracic, facial,
retromandibular, anterior jugular, median antebrachial, inferior mesenteric, the straight sinus, the
great cerebral vein, the cavernous sinuses, the profunda femoris vein, the deep veins doubled as
venae comitantes in the forearm and leg, and the venous valves of the limb veins (bicuspid, every
≈ 3–5 cm in the saphenous, cephalic and basilic veins) drawn as faint rings.

### 13.6 Display and rules

- **New part codes** (normal slot y): 5 capillary (x = −1, z = its saturation 0–1), 6 pulmonary artery
  (blue, with a pulse), 7 pulmonary vein (red). The earlier great vessels move to 8 and 9.
- **Pulmonary pulse:** the pulmonary valve opens with the aortic one (±10–20 ms); main pulmonary
  artery PWV ≈ 1.5–2.5 m/s (model 2.0); pulse pressure ≈ 15 of the aortic 40 mmHg (A = 0.38, no
  amplification).
- **Colours:** arteries and pulmonary veins red; veins and pulmonary arteries blue; capillaries mix
  from the venous blue to the arterial red by saturation, from 60 % (blue) to 98 % (red).
- **Intercostal and lumbar vessels** form a periodic structure (§13.15): each pair is jittered in path
  and in density (±30 %), their pulse amplitude is damped (A × 0.5), and their arrival times differ by
  level (≈ 5 ms per rib), so they never pulse as a grating.
- **Budgets:** the tree takes 93.75 % of the vessel group: 33,750 / 67,500 / 112,500 / 180,000
  stars, split artery 26 %, arterial branch 16 %, vein 14 %, venous branch 8 %, capillary 24 %,
  pulmonary artery 7 %, pulmonary vein 5 %. The vessel group becomes 36,000 / 72,000 / 120,000 /
  192,000 and the body totals 122,250 / 238,500 / 393,000 / 610,000. The earlier vessel, haze and
  immune stars keep their counts, so the Stars style is unchanged.

### 13.7 Result (as built)

- **Named vessels:** 314 (both sides counted): the first pass's 140 plus the vessels of §13.2 and
  §13.5, the two digital arteries of each finger, thumb and toe, and 16 venae comitantes. The aortic
  root is lobed by its three sinuses (+22 % of the radius); the aorta tapers 14 → 8.5 mm.
- **Detail** (`buildDetail`, built once in ≈ 60 ms): 6,246 branches and 15,668 capillary strands:
  - 4,104 twigs, three generations deep;
  - lungs: 499 pulmonary arterial and 482 pulmonary venous branches;
  - liver: 63 hepatic arterial, 126 portal and 123 hepatic venous branches;
  - kidneys: 126 renal arterial (with glomerular tufts) and 126 renal venous; spleen 31 + 31;
  - gut: 22 jejunal and ileal arteries with 21 arcades and 108 vasa recta; 5 colic arteries and the
    marginal artery; a vein beside each;
  - 18 intercostal and 8 lumbar arteries, each with its vein; 48 vasa vasorum; 229 venous valves.
- **Pulse:** the energy-conserving mean is now taken over every pulsing star through a 2-ms delay
  histogram (it was a 4,000-star sample, whose error reached 1.15 % at 125 bpm); the error is now
  under 1 % at every rate tested.
- **Measured:** body generation in Node 1.8 s at High, 1.5 s at Ultra. In the app (Ultra, Apple M4)
  the chest shows the red branching network, the lungs their blue pulmonary arteries and capillary
  beds, the head the cortical branches; the frame-mean luminance stayed constant at Calm (limiter
  factor 1).
- **Tests:** `test/pulse.test.mjs` has 7 tests. The full suite has 574 tests: 542 pass, 4 known arm64
  golden failures, 28 todo. `tsc` is clean.

## Sources

- Nichols W. W., O'Rourke M. F., Vlachopoulos C. (2011). *McDonald's Blood Flow in Arteries*, 6th
  ed. Hodder Arnold (PWV by segment, reflection, amplification, wave shapes).
- Avolio A. P. et al. (1983). Effects of aging on changing arterial compliance and left ventricular
  load in a northern Chinese urban community. *Circulation* 68: 50–58.
- The Reference Values for Arterial Stiffness' Collaboration (2010). Determinants of pulse wave
  velocity in healthy people and in the presence of cardiovascular risk factors. *Eur Heart J* 31:
  2338–2350.
- Murgo J. P. et al. (1980). Aortic input impedance in normal man: relationship to pressure wave
  forms. *Circulation* 62: 105–116.
- McEniery C. M. et al. (2008). Central pressure: variability and impact of cardiovascular risk
  factors: the Anglo-Cardiff Collaborative Trial II. *Hypertension* 51: 1476–1482.
- Avolio A. P. et al. (2009). Role of pulse pressure amplification in arterial hypertension.
  *Hypertension* 54: 375–383.
- Spronck B. et al. (2015). Pressure-dependence of arterial stiffness: potential clinical
  implications. *J Hypertens* 33: 330–338.
- Lantelme P. et al. (2002). Heart rate: an important confounder of pulse wave velocity assessment.
  *Hypertension* 39: 1083–1087.
- Boutouyrie P. et al. (1994). Sympathetic activation decreases medium-sized arterial compliance in
  humans. *Am J Physiol* 267: H1368–H1376.
- Vlachopoulos C. et al. (2006). Acute mental stress has a prolonged unfavorable effect on arterial
  stiffness and wave reflections. *Psychosom Med* 68: 231–237.
- Murray C. D. (1926). The physiological principle of minimum work. *PNAS* 12: 207–214.
- Allen J. (2007). Photoplethysmography and its application in clinical physiological measurement.
  *Physiol Meas* 28: R1–R39.
- Kudielka B. M. et al. (2004). *Psychoneuroendocrinology* 29: 983–992.
- Erbel R. et al. (2014). 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases.
  *Eur Heart J* 35: 2873–2926.
- Hiratzka L. F. et al. (2010). 2010 ACCF/AHA guidelines for the diagnosis and management of patients
  with thoracic aortic disease. *Circulation* 121: e266–e369.
- Zamir M. (2000). *The Physics of Pulsatile Flow.* Springer (branching generations).
- Huang W. et al. (1996). Morphometry of the human pulmonary vasculature. *J Appl Physiol* 81:
  2123–2133.
- Weibel E. R. (1963). *Morphometry of the Human Lung.* Springer.
- Ochs M. et al. (2004). The number of alveoli in the human lung. *Am J Respir Crit Care Med* 169:
  120–124.
- Moore K. L., Dalley A. F., Agur A. M. R. (2018). *Clinically Oriented Anatomy*, 8th ed. Wolters
  Kluwer (named vessels, arcades, marginal artery, venous valves).
