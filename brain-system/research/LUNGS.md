# Lungs and the respiratory system: anatomy, breathing and its response to emotion

The user asked for an analysis of the lungs and the respiratory system, and for a model of it, as
the heart has (research/HEART.md) and the vascular tree has (research/PULSE.md). This note is the
analysis and the proposed design. §11 lists the choices put to the user before building. "All the
systems and organs" is scoped in §10: one organ system at a time, in an agreed order.

Tags: [T] textbook value; [recalled] from memory of the cited source, to check before it sets a
test; [model] a design value of this project; conf. high, medium or low.

## 1. What existed (6 November 2026)

- **Geometry** (`src/body/geometry.js`, BODY-FORM.md §2.8):
  - two lung ellipsoids: right c (78, −18, −318), r (62, 80, 118); left c (−82, −22, −328),
    r (56, 78, 112); clipped above the diaphragm, heart carved out; 9 % of the organ budget (`ORGAN_SHARES`);
  - the trachea, a tube from z −172 to the carina at −290 (r 9 mm), and two main bronchi to the
    hila at (±45, −20, −300) (r 7 → 5 mm). They fall only 10 mm over 46 mm, about 12° below the
    horizontal; the real right main bronchus is ≈ 25° from the vertical and the left ≈ 45° (§2.2);
  - the larynx ellipsoid at (0, 30, −158.5); the diaphragm height field `diaphragmZ` (domes R −382,
    L −395, central tendon −392, costal base −455); rib hints T1–T11 above the intercostal nerves;
    both phrenic nerves (C3–C5) to the domes; the `lungStretch` receptor site (`cn10.pulmonary`).
- **Vessels** (PULSE.md §13.3–13.4): pulmonary arteries and veins grow as fractal trees from the
  hila, 7–8 generations (499 arterial, 482 venous branches), with lung capillaries mixing 75 → 98 %
  saturation. They do not follow the airways, since no airway tree exists. There is no bronchial
  circulation.
- **Model** (`Autonomic._resp`, ANALYSIS.md §7.9): the CO₂ chemoreflex sets `ve`;
  `vt = 0.5 (ve/7)^0.6`, `rr = ve/vt`; `respPhase` advances uniformly; `paco2` balances on `ve`
  (τ 600 s at rest); `pao2 = 95 − 1.25 (paco2 − 40)`. The slope 1.25 is 1/R with R = 0.8, the
  alveolar gas equation, with a fixed A–a gradient of 5 mmHg. RSA follows `respPhase` and `vt`.
- **Measured** (kernel probe, all networks on, seed 1): in the `stressor` scenario (0–1,500 s) and
  the `orgasm` scenario, `rr` 14.0, `vt` 0.50, `ve` 7.0, PaCO₂ 40.0 and PaO₂ 95.0 throughout.
  **Nothing drives breathing from emotion or arousal.** In Pleasure the monitor's RESP number comes
  from `response.js` (14 + ΔRR·h, through the adapter), while `RespTrace`'s amplitude uses the
  kernel's `vt` (0.5): the rate and the depth come from two models.
- **Display:** no breathing motion. `BODY_VS` declares `uOrgan[16]` (modes: scale, shiftZ, iris),
  but nothing calls `renderer.setOrgans`. The §13.7 row "uniform lung scale ±2 %" is about seven
  times too small (§3.5). `BODY_VS` uses 104 of its 110 tested vec4 slots.
- **Monitor:** a RESP row (rate and impedance trace, `RespTrace`). No SpO₂ ("not modelled",
  `monitor.js`), no CO₂.

## 2. Anatomy (adult, upright, neutral)

### 2.1 Upper airway

- **Nose:** the nasal cavity with three turbinates warms and humidifies the air. In nose breathing
  it gives about half of the total airway resistance [T].
- **Pharynx:** nasopharynx, oropharynx and laryngopharynx. The genioglossus (XII) holds it open,
  with activity that starts just before inspiration.
- **Larynx** (C3–C6): the posterior cricoarytenoid (recurrent laryngeal nerve, X) widens the glottis
  in inspiration. The adductors narrow it in early expiration (post-inspiratory braking) [T].

### 2.2 The airway tree

A dichotomous tree from the trachea (generation 0) to the alveolar sacs (generation 23). Weibel's
symmetric model A gives the dimensions at about ¾ TLC (Weibel 1963) [T, high]:

| z | Name | Number | Diameter (mm) | Length (mm) | Volume of the generation (mL) |
|---|---|---|---|---|---|
| 0 | trachea | 1 | 18 | 120 | 30.5 |
| 1 | main bronchi | 2 | 12.2 | 47.6 | 11.1 |
| 2 | lobar bronchi | 4 (real: 5) | 8.3 | 19 | 4.1 |
| 3 | segmental bronchi | 8 (real: 18–20) | 5.6 | 7.6 | 1.5 |
| 4 | subsegmental | 16 | 4.5 | 12.7 | 3.2 |
| 5–10 | small bronchi | 32 → 1,024 | 3.5 → 1.3 | 10.7 → 4.6 | 26.7 |
| 11–15 | bronchioles | 2,048 → 32,768 | 1.09 → 0.66 | 3.9 → 2.0 | 67.4 |
| 16 | terminal bronchioles | 65,536 | 0.60 | 1.65 | 30.6 |
| 17–19 | respiratory bronchioles | 1.3–5.2 × 10⁵ | 0.54 → 0.47 | 1.41 → 0.99 | — |
| 20–22 | alveolar ducts | 1.0–4.2 × 10⁶ | 0.45 → 0.41 | 0.83 → 0.59 | — |
| 23 | alveolar sacs | 8.4 × 10⁶ | 0.41 | 0.50 | — |

- **Conducting zone,** z 0–16: about 175 mL in Weibel's table at ¾ TLC; the anatomical dead space
  is ≈ 150 mL (≈ 2 mL/kg), measured at FRC with the upper airway (Fowler) [T].
- **Respiratory zone,** z 17–23: about 30,000 acini, each ≈ 6–7 mm across (Haefeli-Bleuer & Weibel
  1988). There are ≈ 480 million alveoli, range 274–790 million (Ochs et al. 2004), each ≈ 0.2 mm
  across, with a gas-exchange surface of ≈ 130 m² [T].
- **Total cross-section:** 2.5 cm² in the trachea, ≈ 185 cm² at z 16, ≈ 1.1 m² at z 23. At a mean
  inspiratory flow of 0.33 L/s, air moves at ≈ 1.3 m/s in the trachea, ≈ 2 cm/s at the terminal
  bronchioles and < 1 mm/s in the acini. Bulk flow carries the fresh gas to about z 15–17, and
  diffusion carries it on: the "stationary diffusion front" [T].
- **Branching:** the diameter ratio per generation is ≈ 0.68 for z 0–3, ≈ 0.8 to z 10 and
  0.86–0.9 beyond. Length is ≈ 3 diameters. Daughters leave at ≈ 35–40° each, and the branching
  plane turns ≈ 90° every generation (Weibel 1963; Horsfield & Cumming 1968; Kitaoka et al. 1999).
- **Asymmetry:** the real tree is asymmetric. Paths from the trachea to a terminal bronchiole take
  8 to 25 generations, about 23 on average to the sacs (Horsfield & Cumming 1968).
- **Main bronchi:** the carina sits at T4–T5 at an angle of ≈ 60–75°. The right main bronchus is
  short (≈ 2.5 cm), wide and steep (≈ 25° from the vertical). Its upper lobe bronchus leaves
  ≈ 2 cm below the carina, above the right pulmonary artery (eparterial); then the bronchus
  intermedius, the middle lobe bronchus forward and the lower lobe bronchus. The left main
  bronchus is ≈ 5 cm long at ≈ 45°, under the aortic arch, with the left pulmonary artery arching
  over it [T].
- **Wall:** 16–20 C-shaped cartilage rings in the trachea, cartilage plates in the bronchi to about
  1 mm diameter (≈ z 10–11), none in the bronchioles. A spiral of smooth muscle runs throughout
  [T].

### 2.3 Lobes, fissures, segments, pleura

- **Lobes:** right upper, middle and lower; left upper (with the lingula) and lower. Volume shares
  are ≈ RUL 20 %, RML 9 %, RLL 25 %, LUL 23 %, LLL 23 % [recalled, CT volumetry; medium].
- **Fissures:**
  - the oblique fissure on both sides, from the T4–T5 spinous level behind to the 6th costal
    cartilage in front;
  - the horizontal fissure (right only), along the 4th costal cartilage to the oblique fissure at
    the midaxillary line;
  - the cardiac notch on the left upper lobe [T].
- **Bronchopulmonary segments:** 10 right and 8 left (Boyden), each with its own segmental bronchus
  and artery. The veins run between the segments [T].
  - Right: apical, posterior, anterior (RUL); lateral, medial (RML); superior, medial, anterior,
    lateral and posterior basal (RLL).
  - Left: apicoposterior, anterior, superior and inferior lingular (LUL); superior, anteromedial,
    lateral and posterior basal (LLL).
- **Surface markings** (mid-expiration):
  - the apex 2–3 cm above the medial third of the clavicle;
  - the inferior border at the 6th rib (midclavicular), the 8th (midaxillary) and the 10th
    (paravertebral);
  - the parietal pleura two ribs lower (8th, 10th, 12th): the costodiaphragmatic recess, into
    which the lung slides on deep inspiration [T].
- **Pleura:** visceral and parietal layers with a 10–20 µm space and ≈ 0.26 mL/kg of fluid.
  - Pleural pressure is ≈ −5 cmH₂O at FRC and ≈ −8 at the end of a tidal inspiration.
  - The upright gradient is ≈ 0.25 cmH₂O/cm, so apical alveoli are larger and the bases ventilate
    more per unit volume (West zones) [T].

### 2.4 Respiratory muscles

- **Diaphragm:**
  - two domes, the right higher, on a central tendon;
  - crura on L1–L3, costal fibres on ribs 7–12 and the xiphoid;
  - the zone of apposition, the part lying against the inner rib cage, shortens as the dome
    descends;
  - nerve: phrenic, C3–C5 [T].
- **Intercostals:**
  - external intercostals (inspiratory, mostly dorsal and upper spaces) and parasternal internal
    intercostals (inspiratory);
  - internal interosseous intercostals (expiratory, lower ventrolateral spaces);
  - all from the intercostal nerves T1–T11 (De Troyer, Kirkwood & Wilson 2005).
- **Accessory muscles:** the scalenes (active even in quiet breathing), the sternocleidomastoids
  (forced inspiration), and the abdominal muscles (active expiration in exercise, hyperventilation,
  coughing and speech) [T].

### 2.5 Vessels

- **Pulmonary arteries** (deoxygenated, blue) run with the bronchi in bronchovascular bundles, each
  branch beside the airway of the same order and of about its calibre. An equal number of
  "supernumerary" arteries leave them without an airway. Strahler orders: ≈ 17 (Huang et al.
  1996).
- **Pulmonary veins** (oxygenated, red) run between the segments and in the interlobular septa, not
  with the bronchi, and converge to two veins per side into the left atrium [T].
- **Pressures and the capillary bed:**
  - mean pulmonary arterial pressure ≈ 14 mmHg (systolic 20–25, diastolic 8–10);
  - capillary blood ≈ 75–100 mL at rest (≈ 200 mL at full recruitment);
  - transit time ≈ 0.75 s at rest, with O₂ equilibrium in the first ≈ 0.25 s [T].
- **Bronchial circulation** (systemic, red): usually one right bronchial artery (often from the
  intercostobronchial trunk) and two left, from the descending aorta. They carry ≈ 1–2 % of the
  cardiac output to the airway walls down to the terminal bronchioles, the visceral pleura and the
  nodes. Proximal veins drain to the azygos system; distal ones drain into the pulmonary veins, a
  small anatomical shunt that is part of the A–a gradient [T].

### 2.6 Nerves

- **Vagal afferents:** slowly adapting stretch receptors (the Hering–Breuer inflation reflex),
  rapidly adapting receptors (irritant, cough, augmented breaths) and C fibres [T].
- **Efferents:**
  - vagal cholinergic (bronchoconstriction, mucus);
  - sympathetic T1–T4, with circulating adrenaline acting on β₂ receptors (bronchodilation);
  - somatic: phrenic and intercostal motor nerves [T].

## 3. Mechanics of breathing

### 3.1 Volumes and capacities (man, 20–30 years, 1.75 m; women ≈ 20–25 % smaller)

| Volume | Value (L) | Note | Conf. |
|---|---|---|---|
| Tidal volume (TV) | 0.5 (0.4–0.6) | the model's `vt0` | high |
| Inspiratory reserve (IRV) | ≈ 3.0 | | medium |
| Expiratory reserve (ERV) | ≈ 1.1–1.2 | | medium |
| Residual volume (RV) | ≈ 1.2 | | medium |
| FRC = ERV + RV | ≈ 2.3–2.4 | end of a quiet expiration | medium |
| Inspiratory capacity = TV + IRV | ≈ 3.5 | | medium |
| Vital capacity | ≈ 4.6–4.8 | | medium |
| TLC | ≈ 5.8–6.0 | | medium |
| Anatomical dead space (VD) | ≈ 0.15 | | high |

Sources: West & Luks 2021; Stocks & Quanjer 1995 [T].

**Alveolar ventilation:** V̇A = (VT − VD)·f = (0.5 − 0.15) × 14 = 4.9 L/min. By the alveolar
ventilation equation PaCO₂ = 0.863·V̇CO₂/V̇A, the model's rest (7 L/min, PaCO₂ 40) implies
V̇CO₂ ≈ 227 mL/min STPD, within the 200–250 of a 70-kg adult at rest [model].

### 3.2 The tidal breath

- **Timing:** inspiration is active and takes Ti/Ttot ≈ 0.4. At 14/min, Ti ≈ 1.7 s and
  Te ≈ 2.6 s (Tobin et al. 1983 [recalled]).
- **Expiration** is passive: volume falls roughly exponentially, braked early by post-inspiratory
  diaphragm and laryngeal activity, with a short pause at FRC [T].
- **Flows:** peak inspiratory flow ≈ 0.4–0.5 L/s at rest; mean VT/Ti ≈ 0.3 L/s [T].
- **In the model:** `RespTrace` already draws this shape (raised-cosine inspiration over 0.4 of
  the cycle, expiration τ 0.12 × cycle). The design keeps it and makes it the single breath shape
  for the trace, the lungs and the airflow (§7.4).

### 3.3 Diaphragm

- **Quiet breathing:** the right hemidiaphragm moves 1.8 ± 0.3 cm (men) and 1.6 ± 0.3 cm (women)
  craniocaudally, by M-mode ultrasound (Boussuges et al. 2009, high).
- **Deep breathing:** 7.0 ± 1.1 cm (men) and 5.7 ± 1.0 cm (women) (Boussuges et al. 2009); up to
  ≈ 10 cm from RV to TLC [T].
- **Shape of the motion:** the dome descends like a piston while the costal attachments stay
  fixed. The posterior dome moves more than the central tendon, and the zone of apposition
  shortens [T].
- **Share of VT:** the diaphragm gives ≈ 60–75 % of VT in quiet upright breathing; the rest comes
  from the rib cage [T]. With an effective piston area of ≈ 250–300 cm², 0.35 L needs ≈ 1.3 cm,
  which agrees with the measured excursion.
- **Excursion law** [model, fitted to the Boussuges means]: e(ΔV) = 15 mm × (ΔV / 0.5 L)^0.85,
  which gives 15 mm at 0.5 L and ≈ 69 mm at 3 L.
- **Abdominal organs below the dome:** the liver, spleen, kidneys and pancreas move ≈ 1–2 cm with
  quiet breathing and 4–6 cm with deep breathing, and the abdominal wall moves out (Suramo et al.
  1984 [recalled]). The heart rides on the central tendon.

### 3.4 Rib cage

- **Pump handle** (ribs 1–6): rotation about the axis of the rib neck raises the sternum and moves
  it forward, increasing the anteroposterior diameter [T].
- **Bucket handle** (ribs 7–10): rotation about the axis through the costovertebral joint and the
  costal margin lifts the lateral shaft and increases the transverse diameter. Ribs 11–12 move like
  calipers [T].
- **Size of the motion:** in quiet breathing the anterior chest wall moves only a few mm. In deep
  breathing the sternum moves ≈ 2–3 cm forward and up, and chest expansion at the 4th intercostal
  space reaches 5–7 cm of circumference (≈ 1 cm of radius) [recalled, low]. The rib cage share
  rises with depth.

### 3.5 How the lung expands

- **Direction:** mostly craniocaudal at the bases (the diaphragm), with a smaller anteroposterior
  and lateral part (the rib cage). The apices move least.
- **Measured motion** (4D CT, quiet breathing): lower-lobe points move ≈ 1.2 cm craniocaudally
  (up to 2.5 cm), upper-lobe points ≈ 0.2–0.5 cm (Seppenwoolde et al. 2002). The airways lengthen
  and widen with lung volume.
- **Size:** ΔV/V ≈ 0.5 L ÷ (2.4 L of gas + ≈ 1 L of tissue and blood) ≈ 15 % per quiet breath, an
  isotropic scale of ≈ 4.8 %. The §13.7 uniform ±2 % lung scale about the hila underdraws it about
  seven-fold in volume, and in the wrong place: the hila barely move.
- **Displacement field** [model], for a point p above the diaphragm, with the lung apex z_a and the
  diaphragm z_d(x, y) below p:
  - vertical: Δz = −e · w^1.2, with w = (z_a − z)/(z_a − z_d), clamped to 0–1;
  - lateral: Δx = k_b · x · s(z), the bucket handle, strongest at the lower ribs;
  - anteroposterior: Δy = k_p · (y − y_spine) · s(z), the pump handle, strongest at the upper ribs.

  k_b and k_p are set so that the rib cage carries 30 % of ΔV at rest and 45 % at 3 L. The
  diaphragm sheet moves by −e × its dome profile (1 at the domes, 0 at the costal base). Below the
  sheet, Δz = −e × a fall-off to 0 at the pelvic brim, and the abdominal wall moves out.
- **Strain at the base:** ≈ 15 mm ÷ 180 mm ≈ 8 % craniocaudal per quiet breath; 25–40 % for a
  deep breath. §7.4 deals with its effect on luminance.

## 4. Gas exchange

### 4.1 Values (sea level, healthy young adult)

| Quantity | Value | Model | Conf. | Source |
|---|---|---|---|---|
| PIO₂ | 150 mmHg | — | high | [T] |
| PAO₂ (alveolar gas equation, R 0.8) | ≈ 100 mmHg | implicit | high | [T] |
| PaO₂ | 90–100 mmHg; falls ≈ 0.25–0.3 per year of age | 95 | high | Sorbini et al. 1968 |
| A–a gradient | 5–10 mmHg (≈ age/4 + 4) | 5 | medium | [T] |
| PaCO₂ | 35–45 (40) mmHg | 40 | high | [T] |
| Mixed venous PO₂ / PCO₂ | 40 / 46 mmHg | — | high | [T] |
| SaO₂ | 96–98 % | — | high | [T] |
| pH, HCO₃⁻ | 7.35–7.45; 22–26 mmol/L | — | high | [T] |
| EtCO₂; PaCO₂ − EtCO₂ | 35–45 mmHg; 2–5 mmHg in health | — | high | Bhavani-Shankar et al. 1992 |
| SpO₂ (pulse oximetry) | 95–100 %; accuracy ≈ ±2 % (70–100 %); averaged over 4–16 s | — | high | ISO 80601-2-61 [recalled] |
| Lung-to-finger circulation delay | ≈ 15–30 s | — | low | [recalled] |
| V/Q, whole lung; apex; base (upright) | ≈ 0.8–1.0; ≈ 3.3; ≈ 0.6 | — | high | West 1962 |

### 4.2 Oxygen saturation (computable from the model)

- **Curve:** Severinghaus (1979): S = 100 / (23,400 / (P³ + 150·P) + 1). It gives 97.4 % at 95 mmHg,
  90.6 % at 60, 75 % at 40 and 50 % at P50 26.8.
- **Shift with pH and CO₂:** the "virtual PO₂" is
  P·10^(0.024 (37 − T) + 0.40 (pH − 7.40) + 0.06 log₁₀(40/PaCO₂)) (Severinghaus 1979 [recalled;
  check before use]).
- **Acute pH from PaCO₂** (Henderson–Hasselbalch): pH = 6.1 + log₁₀(HCO₃⁻ / (0.0307 · PaCO₂)).
  Acute buffering lowers HCO₃⁻ by ≈ 2 mmol/L per 10 mmHg fall in PaCO₂ [T].
- **What the model gives:** PaCO₂ 40 → pH 7.39, SpO₂ 97 %. At PaCO₂ 25 (hyperventilation), PaO₂
  rises to ≈ 114 by the alveolar gas equation, pH to ≈ 7.54 and SpO₂ to ≈ 99 %.
- **Behaviour:** a healthy person does not desaturate in any of the three states, so SpO₂ stays at
  97–99 %. This is real, not a fault. Shown on a monitor, the number would hardly move.

### 4.3 CO₂ and the capnogram (computable from the model)

- **Phases:** the capnogram plots CO₂ at the mouth against time.
  - Phase I: dead-space gas, ≈ 0.
  - Phase II: a steep rise as alveolar gas mixes in, over ≈ 0.1–0.2 L of expired volume.
  - Phase III: the alveolar plateau, rising slowly; its end value is EtCO₂.
  - Inspiration then drops it back to 0 (Bhavani-Shankar et al. 1992).
- **In the model:** EtCO₂ = PaCO₂ − 3 mmHg [model; 2–5 in health]. The curve is a function of the
  expired volume from the breath clock (§7.4), so the trace, the lungs and the airflow share one
  signal.
- **CO₂ kinetics:** one pool with τ 600 s at rest (`tauCo2`) is too slow for the climax.
  Hyperventilation lowers the alveolar and arterial PCO₂ within about a minute (FRC washout,
  τ ≈ FRC/V̇A ≈ 30 s), and the tissue stores follow over 10–20 min (Farhi & Rahn 1955
  [recalled]). A two-pool CO₂ model (lungs and blood τ ≈ 40–90 s; tissues τ ≈ 10–20 min) leaves
  the resting value unchanged and lets EtCO₂ fall during hyperventilation as it does in life
  [model].

## 5. Control

### 5.1 The brainstem rhythm and its outputs

- **Inspiration:** the rhythm is generated in the preBötzinger complex (Smith et al. 1991; human
  homologue Schwarzacher et al. 2011).
- **Expiration and CO₂ sensing:** the retrotrapezoid nucleus and parafacial group give active
  expiration and central CO₂ sensing (Guyenet & Bayliss 2015).
- **Afferents:** the NTS (dorsal group) integrates the vagal and glossopharyngeal afferents.
- **Pons:** the Kölliker–Fuse and parabrachial nuclei shape the inspiratory off-switch and
  post-inspiration (Del Negro, Funk & Feldman 2018).
- **Three phases:** inspiration; post-inspiration (laryngeal adduction, diaphragm braking); late
  expiration (active only at high drive).
- **Outputs:**
  - phrenic (C3–C5) to the diaphragm;
  - bulbospinal premotor neurons to the external and parasternal intercostals (T1–T11);
  - hypoglossal (XII) to the genioglossus, starting before inspiration;
  - the recurrent laryngeal (X): abductor in inspiration, adductors in post-inspiration;
  - abdominal expiratory motoneurons;
  - inspiratory gating of the cardiac vagal neurons (RSA, already modelled).
- **Sighs:** generated in the preBötC under neuropeptide control (NMB and GRP from the
  RTN/parafacial group). Humans sigh about 12 times per hour at rest (Li et al. 2016). A sigh is an
  augmented breath of ≈ 2–3 × VT, a second inspiratory effort on top of a normal one, followed by a
  pause.
- **In the model:** the nodes exist (`preBotC`, `rtn`, `ntsVisc`, `pbn`, `nAmbVagal`, `phrenicNuc`,
  `bsResp`, `carotidBody`; ANALYSIS.md §3, §6, §7.9).

### 5.2 Chemoreflexes and stretch reflexes

- **Central chemoreflex** (RTN): ≈ 2/3 of the CO₂ response, slow (τ 60–150 s).
- **Peripheral chemoreflex** (carotid body): ≈ 1/3 of the CO₂ response and all of the acute
  hypoxic response, fast (τ 10–20 s), steep below PaO₂ ≈ 60.
- **Gain:** HCVR 1.5–3 L/min per mmHg; the model uses 2.0 (ANALYSIS.md §7.9).
- **Awake drive:** awake, a wakefulness drive keeps breathing going at low PaCO₂, so behavioural
  hyperventilation lowers PaCO₂ against the chemoreflex. Asleep, apnoea follows ≈ 3–5 mmHg below
  eupnoea [T].
- **Hering–Breuer inflation reflex:** weak in adults within the eupnoeic range; it acts above
  ≈ 2–3 × VT, so it limits deep breaths but does not shape quiet breathing [T].

### 5.3 Behavioural and emotional drive

- **Voluntary:** the motor cortex drives speech and breath-holding.
- **Emotional:** limbic structures drive breathing through the periaqueductal grey and the
  brainstem. Anticipatory anxiety raises the rate, with amygdala activity locked to inspiration
  (Homma & Masaoka 2008). The PAG organises emotional breathing: vocalisation, panting and
  breath-holding (Subramanian, Balnave & Holstege 2008 [recalled]).
- **Interaction with the chemical drive:** this drive adds to the chemical drive and can override
  it. Ventilation then exceeds the metabolic need and PaCO₂ falls.

## 6. Response to emotion and arousal

| State | Rate (/min) | VT (L) | V̇E | Pattern | PaCO₂ / EtCO₂ | Conf. | Sources |
|---|---|---|---|---|---|---|---|
| Calm (relaxed rest) | 10–14; deep relaxation 6–10 | 0.5–0.8 | ≈ rest | regular; sighs ≈ 12/h; RSA larger with slower, deeper breaths | ≈ 40 / ≈ 37 | medium | Boiten et al. 1994; Homma & Masaoka 2008 |
| Stress (acute psychosocial, TSST class) | +2 to +6 (≈ 17–20) | unchanged or lower | +10–30 % | Ti shorter, more irregular; sighs ≈ 2× | −1 to −4 mmHg | medium (direction), low (size) | Boiten et al. 1994; Kreibig 2010; Vlemincx et al. 2013 |
| Pleasure: arousal and plateau | 14 → 22–24 | rising | rising | deeper and faster | falling | low | RESPONSE.md §4.1, §7.4 (Masters & Johnson 1966) |
| Pleasure: climax | ≈ 27 typical; up to 40 (individual extreme) | large | high | hyperventilation, broken by breath-holds and vocalising | hypocapnia | low | Masters & Johnson 1966; RESPONSE.md §4.1 |
| Recovery | back to rest over minutes | | | a post-hyperventilation pause is possible | recovers over minutes | low | [T] |

- **Calm, model choice:** Calm in the HUD is "at rest" (no scenario). Two choices fit the
  evidence: the textbook rest (14/min × 0.5 L, the kernel's present baseline, which keeps every
  resting golden), or a relaxed slow-deep pattern (≈ 10–11/min × 0.65 L, the same V̇A). The second
  matches "slow, deep" and makes the RSA grow visibly (the model's RSA rises with VT and as the
  rate falls). §11 asks.
- **Stress:** the rate rises before the depth changes, and sighs become more frequent. The sigh is
  the "reset" of a stiffened breathing pattern (Vlemincx et al. 2013).
- **Pleasure:** `response.js` already carries the rate envelope (RR = 14 + ΔRR·h, with breath-holds
  while Ω > 0.8). In the build it becomes the arousal input to the kernel's behavioural drive, so
  the lungs, the monitor and the gases agree. `response.js`'s algebraic vitals stay the regression
  reference (ANALYSIS.md B.13).

## 7. Display options and the photosensitivity rules

Rules in force (ANALYSIS.md §13.9, §13.15; HEART.md §5; PULSE.md §8):
- at most 3 flashes per second (display target ≤ 2);
- a luminance swing of at most 8 % per breath or beat;
- energy-conserving effects: the class's total light stays constant;
- no chromaticity flash;
- periodic structures irregular, with ≤ 5 light–dark pairs and ≤ 30 % Michelson contrast;
- reduced motion freezes the breathing geometry at its mean (§13.15).

Breathing runs at ≤ 40/min = 0.67 Hz, under the 1 Hz rhythm rule. It is drawn breath by breath
in screen time, as the heart is (HEART.md §5): time compression does not speed it up and slow
motion slows it. At `kh` > 1 the model rate still sets the screen rate.

### 7.1 Airway tree and acini (fine stars, crisp up close)

- **Large airways:** trachea, carina, main bronchi (at their true angles, §2.2), 5 lobar and
  18 segmental bronchi with Boyden's names.
- **Space-filling tree:** inside each segment, a tree in the manner of Kitaoka et al. 1999 and
  Tawhai et al. 2000. Each branch splits the parent's territory by its centre of mass; the
  diameter, length and angle follow §2.2; the tree stops when the territory falls below one acinus.
- **Acini:** a spray of alveolar-sac stars at each terminal bronchiole.
- **Levels of detail:** the whole-body build carries generations ≤ 10–12. The close-up adds
  generations 13–16 and the acini through the existing focus-region LOD (`FOCUS_LOD`, CLOSEUP.md).
  The close-up is crisp at the heart's standard.
- **Tracheal rings:** irregular, jittered, low-contrast star arcs, visible only close up, to meet
  the periodic-structure rule.
- **Lobes and fissures:** thin dark gaps (≈ 2 mm) in the parenchyma haze; the cardiac notch; a
  faint visceral pleural shell and the costodiaphragmatic recess.

### 7.2 Bronchovascular bundles

- **Pulmonary arteries:** regrown along the airway tree, beside each bronchus, of the same order
  and calibre, blue, keeping PULSE.md's pulmonary pulse.
- **Pulmonary veins:** between the segments, red.
- **Bronchial arteries:** 1 right and 2 left, thin and red, from the descending aorta along the
  main bronchi.
- **Rebuild:** this replaces the present free-growing lung trees (PULSE.md §13.3); the lung
  capillary beds stay.

### 7.3 Breathing motion

- **What moves:** the §3.5 field acts on the lungs, airways, lung vessels, diaphragm, ribs, heart
  (on the central tendon), abdominal organs and chest and abdominal skin, all from one breath
  clock.
- **Luminance:** energy-conserving per region. Each star's flux is multiplied by the local
  projected dilation of the field, so a region's light stays within ±3 % while the stars spread
  and gather. Without this, the base would dim by ≈ 8 % per quiet breath and 25–40 % per deep
  breath.
- **Reduced motion:** geometry frozen at the mean (§13.15).

### 7.4 Airflow wave

- **Volume coordinate:** every airway star carries the cumulative airway volume from the mouth to
  its position, as a fraction of VD.
- **Inspiration:** a soft front moves to the star where that volume equals the inspired volume
  V(t). It crosses the conducting tree in the first ≈ 150 mL, about 0.4–0.5 s at rest, then fades
  into the acini as the diffusion front.
- **Expiration:** a returning front of alveolar gas leaves through the trachea, in step with the
  capnogram's phase II.
- **Luminance:** luminance only, energy-conserving over the airway class as the pulse is (tested
  to < 1 %), ≤ ×2 on faint stars, a few pixels wide. The swing per region per breath is ≤ 8 %.
- **Reduced motion:** the front stays, as the heart's wave does.

### 7.5 Gas exchange

- **Colour:** no new colour. The lung capillaries keep the blue-to-red gradient of PULSE.md §13.4
  (75 → 98 %), reached in the first third of the capillary.
- **Ventilation per region:** optionally, the alveolar stars of the bases brighten slightly more
  than the apices (V ≈ 1.5× per unit volume), within the 8 % swing.

### 7.6 Lungs view and names

- **View:** a Lungs view (camera on the thorax) beside the Heart view. Skin, muscle, bone and the
  non-lung organs dim to 0.3, as in the Heart view.
- **Names:** hover names for lobes, segments, airway generations and vessels (as `heart-ui.js`
  does).

### 7.7 Patient monitor

Only values the model computes are shown:
- **SpO₂** (§4.2): a number in the PLETH row, delayed lung-to-finger and averaged over 8 s, as an
  integer. It reads 97–99 % in every state.
- **CO₂** (§4.3): a capnogram row and EtCO₂. It moves, ≈ 37 at rest and ≈ 25–30 at the climax
  with the two-pool CO₂ model.
- **RESP:** the rate and trace read the same breath clock as the lungs (one source, §1).

That is two new numbers at most.

## 8. Model changes (kernel), proposed

1. **CO₂ on alveolar ventilation:** V̇A = (VT − VD)·f with VD 0.15 L. Rest is unchanged
   (4.9 L/min ↔ PaCO₂ 40), but rapid shallow breathing ventilates less, as in life.
2. **Two-pool CO₂** (§4.3). Rest is unchanged.
3. **A behavioural drive in `_resp`:**
   - inputs: the scenario `stress` input (it already reaches the kernel's input hook), the arousal
     level of the response model and an optional relaxation term (Calm);
   - outputs: the rate, the VT pattern and the sigh rate;
   - the chemical drive stays and opposes hypocapnia with the gain of §5.2.
4. **Sighs:** a seeded Poisson process, deterministic per seed: 12/h at rest, ≈ 2× in stress. Each
   adds ≈ 1 × VT on top of a breath, then a pause of about one cycle.
5. **Derived variables:** `spo2`, `phA` and `etco2` (§4.2–4.3), and an instantaneous lung volume
   above FRC on the display-side breath clock.
6. **Golden traces:** rest stays identical. The `stressor` and `orgasm` traces that include `rr`
   will change by design and need a recorded re-baseline.

## 9. Budgets (to measure when built)

- **Uniforms:**
  - the motion needs ≈ 2 vec4: diaphragm excursion, rib coefficients, abdominal shift and the
    dilation gain;
  - the airflow needs 1 vec4: front volume, direction, gain and mean;
  - `BODY_VS` is at 104 of 110. The unused `uOrgan[16]` can give room (`ORGAN_SLOTS` 8 → 6 frees
    4 vec4), or its slots can carry the breath.
- **Stars:** an airway-and-acinus class of roughly 8k / 16k / 28k / 44k (Low / Medium / High /
  Ultra) in the body buffer, plus the close-up regions (×4–6, CLOSEUP.md). The heart and the
  vessel tree set the precedent; the totals go in ANALYSIS.md when measured.

## 10. "All the systems and organs": proposed order

One organ system per pass, each to the heart's standard: research note, form, close-up LOD, model
link, tests. The order puts first the organs whose dynamics the simulation already computes:

1. **Lungs and respiratory system** (this note).
2. **Gut:** stomach, small intestine, colon. The enteric model already computes slow waves,
   contractions and chyme (ANALYSIS.md §8).
3. **Liver, pancreas, spleen and the portal circulation.** They move with the diaphragm (§3.3).
4. **Kidneys, ureters and bladder.** The bladder volume law exists.
5. **Endocrine glands:** thyroid, adrenals, pituitary (endocrine model).
6. **Reproductive organs** (response model).

## 11. Questions put to the user before building

1. Scope: the lungs now and then the other organs one at a time in the §10 order, or another
   order?
2. Which lung parts: the airway tree and acini (§7.1–7.2), breathing motion (§7.3), the airflow
   wave (§7.4), the Lungs view (§7.6)?
3. Monitor: SpO₂, CO₂ (capnogram and EtCO₂), both or neither (§7.7)?
4. Breathing and emotion: the kernel extension of §8 (one source for the lungs, the monitor and the
   gases); Calm as textbook rest or relaxed slow-deep breathing (§6)?

**Answers (6 November 2026).**
1. The lungs and the respiratory system only for now, at high quality, to the finest detail; the
   other organs later.
2. All four parts: the airway tree and acini with the bronchovascular bundles, the breathing
   motion, the airflow wave and the Lungs view.
3. Both SpO₂ and CO₂ (capnogram and EtCO₂) on the monitor.
4. The kernel extension of §8, with Calm as relaxed slow-deep breathing.

## 12. Tests (planned)

- **Airway tree:** generation counts, diameter and length ratios, cumulative volume to z 16 within
  150–180 mL, 10 + 8 segments with their names, every star inside its lobe, nothing crossing a
  fissure.
- **Motion:** the excursion law (15 mm at 0.5 L, ≈ 69 mm at 3 L), zero at the apices, continuity at
  the diaphragm, the region luminance change ≤ 3 % (dilation gain).
- **Airflow:** energy conserved to < 1 %; the front reaches z 16 at V = VD.
- **Kernel:**
  - rest unchanged (14, 0.5, 40, 95);
  - Stress raises the rate by 3–6/min and doubles the sigh rate;
  - the Pleasure climax reaches ≥ 25/min, with PaCO₂ falling;
  - SpO₂ 97 % at rest, ≤ 100 always, rising with hypocapnia;
  - EtCO₂ = PaCO₂ − 3.
- **Monitor:** the SpO₂ and CO₂ rows appear only while the kernel supplies the values.
- **Shaders:** `BODY_VS` ≤ 110 slots.

## 13. Result (as built, 6 November 2026)

### 13.1 Kernel (`src/sim/autonomic.js`, `Autonomic._resp`)

- **Ventilation:** CO₂ balances on alveolar ventilation, V̇A = (VT − 0.15)·f, in two pools: a fast
  lung-and-blood pool (share 0.6, τ 60 s) and the tissue pool (τ 600 s), both ∝ V̇A₀/V̇A. The awake CO₂
  response below eupnoea is flat (0.5 L/min per mmHg).
- **Behavioural drive:** the rate is 14 × (1 + 0.30·u) × (1 − 0.25·c) + 13·h. u is the stressor
  input, h the arousal drive of the orgasm adapter's record, c the HUD's `relax` (Calm). Stress adds
  20 % of V̇A₀, arousal 3·h⁴·V̇A₀. VT = V̇A/f + VD. Through a breath-hold the drive is held, so
  breathing resumes at its depth.
- **The record with every network on:** the respiratory layer now reads the arousal drive and the
  breath-hold; the rest of the CV layer still ignores the record, and the HUD keeps the legacy vitals.
  `test/autonomic.test.mjs` and `test/orgasm-switched.test.mjs` were changed to match.
- **Derived values:** `phA` (acute Henderson–Hasselbalch), `sao2` (Severinghaus 1979 with the
  temperature, pH and CO₂ shift), `etco2` = PaCO₂ − 3, `sighRate` (12/h, ×2 in a full stressor);
  `relax` is an input.

| State | Rate (/min) | VT (L) | V̇E (L/min) | PaCO₂ / EtCO₂ (mmHg) | SaO₂ (%) | Sighs (/h) |
|---|---|---|---|---|---|---|
| Rest (no input) | 14.0 | 0.50 | 7.0 | 40 / 37 | 97.4 | 12 |
| Calm (relax 1) | 10.5 | 0.62 | 6.5 | 40 / 37 | 97.4 | 12 |
| Stress (stressor, 5–14 min) | 18.2 | 0.43 | 7.9 | 38 / 35 | 97.7 | 24 |
| Pleasure, plateau (app run) | 22–23 | 0.42 | 9.5 | 36 / 33 | 98.0 | 12 |
| Pleasure, climax (app run) | 24–26, 3-s holds | 0.45–0.49 | ≈ 12 | 36 / 32 | 98.0 | 12 |
| Synthetic h = 1 for 20 s (test) | 26.6 | 0.67 | 17.8 | 26–31 / 23–28 | 98.6–99.0 | 12 |

The arousal hypocapnia is milder than §6 first estimated (EtCO₂ ≈ 32 at the climax of the app's
run, not 25–30), because the climax is short and the fast pool needs about a minute.

### 13.2 Display

- **Breath clock** (`src/breath.js`): one breath at a time in screen time (Ti/Ttot 0.4). Sighs come
  from a seeded Poisson draw per breath (2.5 × VT, a longer inspiration, then a pause); a
  breath-hold holds the volume. It gives the diaphragm excursion (15 mm × (ΔV/0.5 L)^0.85), the rib
  expansion, the airflow front and the capnogram. The RESP trace now draws this breath.
- **Breathing field** (`BODY_VS` `breathField`): the lungs, airways and pulmonary vessels follow the
  piston and the ribs; the diaphragm dome descends with its costal rim fixed; the chest wall moves out;
  the mediastinum and heart take 0.35 of the descent; the abdominal viscera are carried down (0.8, to
  0 at z −720) and the abdominal wall moves out. Trunk stars only, not the limbs. Each star's flux is
  divided by its craniocaudal stretch. Reduced motion sends zero excursion. Breathing does not use
  `uMotion`, which the orgasm scenario turns off for the limbs.
- **Airflow front:** a band in the volume coordinate, σ = 0.03·s (≥ 1 mL; a ring about 5 mm deep in
  the trachea), followed by a dim trail 1.5 σ behind it. The trachea's light swings ≤ 8 % (tested);
  the global mean is given back too. Gain 0.6.
- **Lung stars** (`generate.js` `lungEntries`), 31.75 % of an organ budget that grew by a third
  (High 72,000 → 96,000; every other organ keeps its count):
  - airway walls 55 %: generations ≤ 9 / 10 / 11 / 11 by tier; per branch ∝ length × r^1.3;
    irregular ring hints on the trachea and main bronchi;
  - acini 25 %, parenchyma 8 % with 1.2-mm fissure gaps, visceral pleura 12 %.

  The roles' flux gains are 1.6 / 0.6 / 0.6 / 0.4, so the airways carry about 78 % of the lungs'
  light. Detailed colours: the bronchi greyish ivory, the pleura silvery.
- **Close-up region:** every airway generation near the pivot, ∝ length × (0.5 + r).
- **Bronchovascular bundles** (`vessel-tree.js`): 628 pulmonary arteries, one beside each airway of
  generations 2–8 (0.9 × the airway's radius, 1 mm from its wall), with a capillary bed at each tip.
  The pulmonary veins keep their intersegmental trees. The old free-growing arterial fractal is gone.
- **Diaphragm:** a muscle sheet on `diaphragmZ`, about 800 stars at High.
- **Old geometry:** the old trachea and bronchi tubes left `ORGANS`. The `airways` node keeps its
  index; `diaphragm` is registered after every earlier node.
- **Lungs view:** camera (0.62, −0.1, −3.3) at 6.0 units, right of the monitor. The lungs, airways,
  pulmonary arteries and veins and the diaphragm are lifted × 1.8; everything else dims to 0.18;
  the capillary beds dim to 0.45.
- **Names** (`src/lung-ui.js`): the named airway, the segment and generation of a smaller one, or
  the lobe and segment.
- **Monitor:**
  - SpO₂ in the PLETH row, with a 20-s lung-to-finger delay, an 8-s average and alarm < 90;
  - PTT beside it;
  - a CO₂ row with the capnogram and EtCO₂, alarm outside 30–50.

  The RESP number stays the runtime's vital: the kernel's, or the legacy algebra in Pleasure.

### 13.3 Budgets

- **Shader:** `BODY_VS` uses 106 of 110 slots (`uBreath`, `uAir`); `uOrgan` stays unused.
- **Body totals:** 129,583 / 253,167 / 417,000 / 648,667 (`TIERS.body`).
- **High lung stars:** airways ≈ 16,800, acini ≈ 7,600, pleura ≈ 3,650, parenchyma ≈ 2,440.
- **Airway tree:** 27,305 branches, 4,613 of them at generation ≤ 11. It builds in 140–220 ms, once.

### 13.4 Tests

- `test/airway-tree.test.mjs` (14);
- `test/breath.test.mjs` (10);
- `test/lungs.test.mjs` (9);
- respiration tests in `test/autonomic.test.mjs` (7 new);
- the SpO₂ and capnogram tests in `test/monitor.test.mjs` (2 new);
- budgets and HUD ids updated in `geometry-body`, `pulse`, `shaders` and `hud-simple`.

### 13.5 Open

- **Stars style:** the organ class keeps its earlier total, but the lungs now take a larger part of
  it than before.
- **Not built:** a metabolic V̇CO₂ for exertion; a fall of PaO₂ during long breath-holds; names for
  the pulmonary vessels.

## 14. Second pass: the upper airway, sharpness and visible breathing (6 November 2026)

The user reported three things: the airway should reach the nose; the lungs read as a diffuse pink
haze; the breathing and the airflow cannot be seen. They chose to draw the motion × 3 and to show
the airflow with particles.

### 14.1 Upper airway (`airway-tree.js` `UPPER_AIRWAY`, `upperAirwaySegments`)

- **Path:** each nostril, the nasal vestibule and the nasal cavity to the choana; then the
  nasopharynx, oropharynx and laryngopharynx; then the larynx (vestibule, a 2.5-mm glottic slit,
  subglottis) to the top of the trachea.
- **Section:** elliptic, lateral half-width × sagittal half-height; the nasal cavity is a tall
  slit (3 × 16 mm).
- **Placement:** every wall point lies inside the skin. The vestibule runs within 1 mm of the
  nasal skin, as it does in life. All points are ≥ 2 mm from the eyes and below z −48 (under the
  cribriform plate).
- **Volume coordinate:** it runs from 0 at the nostril to the upper dead space (50 mL) at the
  trachea. Each nasal passage counts half, since it carries half the flow.
- **Names:** "Nasal cavity · right", "Oropharynx", "Larynx · glottis" and so on.
- **Stars:** 6 % of the lungs' stars. Breathing does not move them: they lie above the thoracic
  inlet, or on the head's rigid segment.

### 14.2 Sharpness

Measured first: inside the lungs the High build drew 55,131 stars.

| Stars inside the lungs (High) | Count | Kind |
|---|---|---|
| Airway walls | 15,236 | 4,613 branches to generation 11 |
| Acini | 7,436 | fill the volume |
| Parenchyma | 2,438 | fills the volume |
| Pleura | 3,658 | surface |
| Pulmonary arteries | 7,756 | lines |
| Pulmonary veins | 4,486 | random fractal, 7 generations |
| Capillary beds | 4,899 | haze |
| Nerves passing | 2,882 | |
| Other organs | 3,427 | |

- **Coverage:** in the Lungs view (≈ 90,000 px²) these ≈ 2.4-px stars cover each pixel about 3
  times, so they merge into a sheet.
- **The tree itself:** a space-filling tree drawn to generation 11 projects as an even texture,
  not as a tree.
- **Ruled out:** the `uKeep` cull (Detailed draws every star), the LOD (body LOD 2 draws every
  base star) and the alpha.

**Changes:**
- **The whole-body build draws only structure:**
  - airways to generation 7 (6 / 7 / 7 / 8 by tier; walls scatter 0.06 × r);
  - the upper airway;
  - air particles;
  - the visceral pleura on the lung surface and **along the fissures**, a sheet wherever the lobes
    above and below differ;
  - a light speckle of acini;
  - no parenchyma haze.
- **Shares of the lungs' stars:** airways 47 %, upper airway 6 %, air 10 %, acini 8 %, pleura 17 %,
  fissure pleura 12 %. Role gains are airway 1.6, acinus 0.7, pleura 0.8, air 1.4.
- **The close-up region near the pivot** (CLOSEUP.md) adds every airway generation and the acini
  at 5 × their body share. The lobes, fissures, hilum and finer bronchi sharpen as the camera nears.
- **Pulmonary vessels:**
  - arteries beside the airways to generation 7;
  - veins 5 generations (was 7);
  - lung capillary strands 2–3 per bed (was 6–8);
  - in the Lungs view the beds dim to 0.45.

High now: airway walls 16,154 (with the upper airway), pleura 8,840, air 3,048, acini 2,438.
The budgets are unchanged.

### 14.3 Visible breathing

- **The values were right but small.** The reported `uBreath.x` 0.0774 is 7.7 mm: 1 unit is
  100 mm. That is the true excursion at VT 0.45 L, and the rib-cage motion is under 1 mm at rest.
- **× 3:** the motion is now drawn × 3 (`BREATH.display`), and the rib term is gated to zero above
  the thoracic inlet (z −195). The model, the traces and the monitor keep true values. Calm now
  shows ≈ 54 mm of diaphragm excursion and Pleasure ≈ 23 mm.
- **Light under the larger motion:** each star still keeps its light through its stretch
  (energy-conserving).
- **Air particles** (role 7, pale cyan, 10 % of the lungs' stars):
  - they sit in the upper airway and in the base airways ≥ 4 mm long, at generation ≤ 7;
  - each carries its branch vector, packed exactly in one float (components ±120 mm);
  - `BODY_VS` moves it along that vector by the breath's displacement V/VT (`BreathClock.drift`):
    inwards from the nostrils as the lungs fill, outwards as they empty; a sigh carries them 2.5
    runs;
  - each fades in and out over its run (mean gain 1), so the light is conserved;
  - they pass any point at most a few times a breath, ≤ 2 Hz.
- **The luminance band is removed.** The 8 % rule kept it too thin to see.
- **Reduced motion:** the geometry and the particles hold.

### 14.3a Fixes after the browser check (6 November 2026)

- **No star moved.** `BODY_VS` gated the breathing on `seg < 0`, but `rigidAt` gives the trunk 0
  (the head 1, the limbs 2–13), never −1, so `breathField` never ran. The gate is now `seg == 0`.
  The trunk's joint transform is the identity, so it composes with the breathing.
  - Measured on 8770, Lungs view, Calm: the lungs' light centroid moves 20.5 px of 768 between
    end-expiration and end-inspiration; it moved 0.6 px before.
  - Total light changes by 6 %.
- **The upper airway was dark.** Organ stars above z −145 take the head fade (0.35 ×
  smoothstep(5, 8, camera distance)), which is 0 at close range. The airways and the air particles
  are now exempt.
  - Measured in a side view: the upper airway's walls are 2–6 × as bright as the tissue 12 mm
    beside them, from the nasal vestibule to the subglottis.
  - The upper airway's share rose from 6 % to 10 % of the lungs' stars; the pleura went 17 → 15 %
    and the fissures 12 → 10 %.

### 14.4 Tests

- `test/lungs.test.mjs`, rewritten: the role shares and no haze; the upper airway inside the head;
  the walls; the fissure pleura; the particle packing; the region's finer airways and acini; the
  names from the nose to the acini; the breathing gate against the stars as `put()` packs them;
  the airways' exemption from the head fade.
- `test/breath.test.mjs`: the particle displacement and the × 3 display.
- `test/geometry-body.test.mjs`: the air particles' packed vectors.

## Sources

- Weibel E. R. (1963). *Morphometry of the Human Lung.* Springer.
- Horsfield K., Cumming G. (1968). Morphology of the bronchial tree in man. *J Appl Physiol* 24:
  373–383.
- Haefeli-Bleuer B., Weibel E. R. (1988). Morphometry of the human pulmonary acinus. *Anat Rec*
  220: 401–414.
- Ochs M. et al. (2004). The number of alveoli in the human lung. *Am J Respir Crit Care Med* 169:
  120–124.
- Kitaoka H., Takaki R., Suki B. (1999). A three-dimensional model of the human airway tree.
  *J Appl Physiol* 87: 2207–2217.
- Tawhai M. H., Pullan A. J., Hunter P. J. (2000). Generation of an anatomically based
  three-dimensional model of the conducting airways. *Ann Biomed Eng* 28: 793–802.
- Huang W. et al. (1996). Morphometry of the human pulmonary vasculature. *J Appl Physiol* 81:
  2123–2133.
- Standring S. (ed.) (2020). *Gray's Anatomy*, 42nd ed. Elsevier (lobes, fissures, segments, pleura,
  surface markings, bronchial arteries).
- West J. B., Luks A. M. (2021). *West's Respiratory Physiology: The Essentials*, 11th ed. Wolters
  Kluwer (volumes, pressures, V/Q, gas exchange).
- West J. B. (1962). Regional differences in gas exchange in the lung of erect man. *J Appl
  Physiol* 17: 893–898.
- Stocks J., Quanjer P. H. (1995). Reference values for residual volume, functional residual
  capacity and total lung capacity. *Eur Respir J* 8: 492–506.
- Boussuges A., Gole Y., Blanc P. (2009). Diaphragmatic motion studied by M-mode ultrasonography:
  methods, reproducibility, and normal values. *Chest* 135: 391–400.
- De Troyer A., Kirkwood P. A., Wilson T. A. (2005). Respiratory action of the intercostal
  muscles. *Physiol Rev* 85: 717–756.
- Seppenwoolde Y. et al. (2002). Precise and real-time measurement of 3D tumor motion in lung due
  to breathing and heartbeat. *Int J Radiat Oncol Biol Phys* 53: 822–834.
- Suramo I., Päivänsalo M., Myllylä V. (1984). Cranio-caudal movements of the liver, pancreas and
  kidneys in respiration. *Acta Radiol Diagn* 25: 129–131 [recalled].
- Tobin M. J. et al. (1983). Breathing patterns. 1. Normal subjects. *Chest* 84: 202–205
  [recalled].
- Sorbini C. A. et al. (1968). Arterial oxygen tension in relation to age in healthy subjects.
  *Respiration* 25: 3–13.
- Severinghaus J. W. (1979). Simple, accurate equations for human blood O₂ dissociation
  computations. *J Appl Physiol* 46: 599–602.
- Bhavani-Shankar K. et al. (1992). Capnometry and anaesthesia. *Can J Anaesth* 39: 617–632.
- Farhi L. E., Rahn H. (1955). Gas stores of the body and the unsteady state. *J Appl Physiol* 7:
  472–484 [recalled].
- Smith J. C. et al. (1991). Pre-Bötzinger complex: a brainstem region that may generate
  respiratory rhythm in mammals. *Science* 254: 726–729.
- Schwarzacher S. W., Rüb U., Deller T. (2011). Neuroanatomical characteristics of the human
  pre-Bötzinger complex and its involvement in neurodegenerative brainstem diseases. *Brain* 134:
  24–35.
- Guyenet P. G., Bayliss D. A. (2015). Neural control of breathing and CO₂ homeostasis. *Neuron*
  87: 946–961.
- Del Negro C. A., Funk G. D., Feldman J. L. (2018). Breathing matters. *Nat Rev Neurosci* 19:
  351–367.
- Li P. et al. (2016). The peptidergic control circuit for sighing. *Nature* 530: 293–297.
- Homma I., Masaoka Y. (2008). Breathing rhythms and emotions. *Exp Physiol* 93: 1011–1021.
- Subramanian H. H., Balnave R. J., Holstege G. (2008). The midbrain periaqueductal gray control of
  respiration. *J Neurosci* 28: 12274–12283 [recalled].
- Boiten F. A., Frijda N. H., Wientjes C. J. E. (1994). Emotions and respiratory patterns: review
  and critical analysis. *Int J Psychophysiol* 17: 103–128.
- Kreibig S. D. (2010). Autonomic nervous system activity in emotion: a review. *Biol Psychol* 84:
  394–421.
- Vlemincx E. et al. (2013). Respiratory variability and sighing: a psychophysiological reset
  model. *Biol Psychol* 93: 24–32.
- Masters W. H., Johnson V. E. (1966). *Human Sexual Response*; RESPONSE.md §4.1 for the envelope.
