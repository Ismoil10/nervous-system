# Brain System — the whole-body sexual response model: analysis and design rationale

Origin: written as the analysis of the Orgasm Galaxy project, which was removed from the workspace on
2026-11-02 (it remains in the git history). Brain System keeps this document because its §3–§7 define
the canonical whole-body response model behind `src/response.js` and the orgasm scenario
(DOPAMINE.md §6.7); "galaxy §n" in older text means §n of this document. The galaxy-visualization
parts — §2 (stars in space), §8 (mapping onto the galaxy), the galaxy rows of §9–§10 — and their
astrophysics captures are historical. Paths such as `raw/` and `../anger-galaxy/` below are as
originally written; the human-physiology captures now live in `brain-system/raw/`.

This document was written **before** any Orgasm Galaxy code, and it is the basis of the model.
Sources are the Wikipedia captures in `raw/` and `../anger-galaxy/raw/`. They were located
through the Graphify knowledge graph of the `galaxy` workspace (`../graphify-out/graph.json`,
using `graphify query` / `explain` / `path`) and read only at the lines the graph pointed to.
The captures are introductions cut off at about 12,000 characters, so they are supplemented
with peer-reviewed findings, cited as author + year.

**Evidence labels.** **[G]** is a raw capture (file and line); **[L]** is the peer-reviewed
literature; **[T]** is textbook knowledge, which has no single primary source checked here and so
carries lower confidence. Confidence is given as **H**/**M**/**L** where it matters. Numbers
marked [T] or L are illustrative parameters, not measured constants.

---

## 1. Purpose and framing

Orgasm Galaxy is a scientific visualization. It maps the time course of the human sexual
response onto real, physically consistent processes in a barred spiral galaxy:

- gas inflow,
- a circumnuclear starburst,
- an active nucleus with a jet,
- an afterglow and a refill.

The page is clinical and non-explicit. It shows no bodies, anatomy or suggestive imagery, only
stars, gas and a nucleus, with vital signs and neurochemistry as abstract readouts. It is
inclusive of all bodies. Individual differences are expressed as continuous parameters, never as
"male" or "female" presets, and population-level sex differences are described as tendencies
with wide overlap. The aim is that a viewer who knows the physiology recognises its rhythm, and
a viewer who knows astronomy finds nothing physically false.

---

## 2. How stars look in space and how they are distributed

### 2.1. Carried over from Anger Galaxy (summary only)

The full treatment is in `../anger-galaxy/research/ANALYSIS.md` §1–§3 (L10–L105). This project
reuses those rules and the code that implements them (`src/` was copied from Anger Galaxy and then
changed as described in §2.3 and §9.1):

- **Stars are point sources.** Each is drawn as a PSF with a Gaussian core and a halo. There is
  no twinkling in vacuum. Diffraction spikes appear only on the brightest sources.
- **Colour comes only from temperature**, via Planck + CIE 1931 at the D65 white point. There
  are no green or violet stars, and colours are pastel.
- **Brightness has a heavy-tailed distribution.** The IMF follows Salpeter/Kroupa,
  L ∝ M^3.5 and lifetime τ ≈ 10 Gyr · M^−2.5. Rendering uses HDR, ACES tonemapping and bloom.
- **Components:** a Sérsic bulge (old, yellow-orange), a thin exponential disk, logarithmic
  arms with young O/B stars and pink H II, and a sparse halo. Dust reddens and dims.
- **Kinematics:** the rotation curve is flat outside the centre, rotation is differential, and
  the kinematic (Lindblad/Kalnajs) density wave keeps the arms from winding up.
- **Time is a time-lapse,** and the HUD always shows the scale. Anger's base rate is
  1 s = 0.08 model units ≈ 4.8 Myr, with 1 unit = 60 Myr and radius 1 = 15 kpc
  (`../anger-galaxy/src/galaxy-model.js` L8–L16). In `src/galaxy-model.js` the constants are at
  L10–L30; `CORE_RC`, `OMEGA_P` and `HII_LIFE` have new values, and bar, ring and jet constants
  were added (§2.3, §9.1).

### 2.2. New structures this project needs

**Bar.** About two thirds of local spirals are barred, and the Milky Way is one of them
[G Barred_spiral_galaxy.md L23]. Bars were rarer in the past: 20 % of distant spirals against
about 65 % locally [G L45].

- A bar that has buckled becomes thicker and shorter [G L41]; seen edge-on it appears as a
  boxy/peanut ("X") bulge (Combes & Sanders 1981; Athanassoula 2005, L).
- Optically, a bar is a smooth yellow-orange band of old stars. Two straight dark dust lanes sit
  offset toward its leading edges; they are standing shocks where gas loses angular momentum
  (Athanassoula 1992, L).
- A bar is a solid-body pattern. For the Milky Way Ω_b ≈ 40 km s⁻¹ kpc⁻¹, the half-length is
  about 5 kpc and corotation lies at about 1.0–1.4 bar lengths (Bland-Hawthorn & Gerhard 2016;
  Aguerri et al. 2015, L, M).
- **The bar is fixed anatomy in this model.** The capture describes bar buckling that a central
  black hole suppresses and delays [G L41] and a contested bar/no-bar oscillation of about 2 Gyr
  [G L43]. Long-lived bars are well supported: the bar of NGC 4371 is about 10 Gyr old (Gadotti et
  al. 2015, L, M), and bars resist realistic central mass concentrations (Shen & Sellwood 2004;
  Athanassoula, Lambert & Dehnen 2005, L). One default cycle spans about 0.7 Gyr of astro time
  (§7.7), so a bar that grew or dissolved within it would be too fast by a factor of ~3 even
  against the contested 2 Gyr oscillation, and by far more against the many-Gyr lifetimes of most
  bars.

**Bar-driven inflow.** Through orbital resonance the bar channels gas inward from the arms and
fuels star formation near the centre [G L39]. The mechanism is gravitational torque plus shocks
(Shlosman, Frank & Begelman 1989, L).

- In the Milky Way the inflow is about 2.7 M☉/yr (Sormani & Barnes 2019, L, M).
- A black hole of 4.15 × 10⁶ M☉ (GRAVITY Collaboration 2019, L) accreting at the Eddington
  limit swallows only about 0.09 M☉/yr [T]. Most of the fuel therefore ends up in nuclear-ring
  stars, and only a trickle reaches the nucleus.
- Gas does **not** spiral straight into the nucleus. It stalls in a ring at about 0.1–1 kpc.
  Reaching an accretion disk requires losing more than 99.99 % of its specific angular momentum
  through nested mechanisms (Hopkins & Quataert 2010, L). A "drain vortex" look is unphysical.

**Nuclear ring.** Star-forming nuclear rings occur in about 20 % of disc galaxies, with radii of
about 0.1–2 kpc (Comerón et al. 2010, L). In the classic picture they form where bar-driven gas
piles up near the inner Lindblad resonance, on x2 orbits (Schwarz 1981; Buta & Combes 1996, L).
Hydrodynamic simulations instead place the ring where inflowing gas meets a centrifugal barrier
set by its residual angular momentum, not at a resonance (Kim, Seo & Kim 2012, L, M). NGC 1097
is an example.

- In HST colour images a ring is a tight loop of blue-white clusters strung with pink Hα knots.
- In the "pearls on a string" scenario the youngest clusters sit at the two **contact points**
  where the bar dust lanes meet the ring, and cluster age increases downstream (Böker et al.
  2008, L). Only some rings show this gradient; others are "popcorn"-like (open question).

**Circumnuclear starburst.** A starburst has a birthrate parameter b = SFR / past-average
SFR ≥ 3 [G ../anger-galaxy/raw/…Starburst_galaxy.md L23, L41].

- Starbursts reach 100+ M☉/yr and use up their gas in about 0.1 Gyr, against 1–2 Gyr for
  normal disks [G L25, L60].
- Bars are a recognised trigger [G L41].
- Ring star formation follows inflow and can be **episodic**, with a cycle of about 10–20 Myr
  (Seo & Kim 2013; Krumholz & Kruijssen 2015, L, L-confidence).
- Bar-driven inflow is itself intermittent and varies by factors of a few over tens of Myr in
  these simulations (Seo & Kim 2013; Krumholz & Kruijssen 2015, L, L-confidence). The model reads
  the stop of the ring refill after the climax as the end of such an inflow episode (§8.2 #1).

**Active galactic nucleus (AGN).** An AGN emits non-stellar radiation from radio to gamma rays,
powered by accretion onto a black hole of 10⁶–10¹⁰ M☉ [G Active_galactic_nucleus.md L25, L47].

- Optically it is an unresolved bluish-white point. At high luminosity it carries diffraction
  spikes, as in the HST image of 3C 273 [G L31].
- A resolved accretion disk or torus is invisible at galaxy scale: a 1 pc disk is about 3 × 10⁻⁵
  of a 30 kpc frame.
- At the Eddington limit a Milky-Way-mass black hole emits about 5 × 10⁴⁴ erg/s ≈ 1.3 × 10¹¹ L☉,
  comparable to or more than the whole galaxy [T]. Seyfert nuclei emit about 10⁴²–10⁴⁴ erg/s.
- Single accretion phases last about 10⁵ yr inside activity periods of 10⁷–10⁸ yr (Schawinski
  et al. 2015; Hickox et al. 2014, L). AGNs therefore **flicker**.
- Nuclear star formation and Seyfert accretion coexist and correlate (Diamond-Stanic & Rieke
  2012, L); NGC 1097 and NGC 7469 each have a star-forming ring and a Seyfert nucleus. Statistically,
  AGN accretion peaks as nuclear star formation declines. Davies et al. 2007 (adaptive-optics
  spectroscopy of the central few tens of pc) find recent nuclear starbursts that are no longer
  active, with AGN fuelling starting ~50–100 Myr after the burst. Wild, Heckman & Charlot 2010 find
  black-hole accretion peaking ~250 Myr after the burst, when it has faded into a post-starburst
  (L). The model's order (starburst first, then AGN ignition) rests on the coexistence evidence
  plus this delay. Ignition may come while the ring still forms stars or in its post-starburst
  phase, up to ~250 Myr after the burst (§10, rule 4).
- Davies et al. 2007 propose fuelling by slow winds from the 50–100 Myr-old stars. That cannot be
  carried over to the 0.9 kpc ring: gas lost by ring stars keeps the ring's angular momentum and
  reaches the black hole no more easily than ring gas does. If it is invoked at all, it belongs to
  an unresolved nuclear disk or cluster of ≲ 50 pc fed through the nuclear spirals, which the model
  does not draw.
- With the defaults, ignition comes ~235 Myr after stimulation starts (~185 Myr after the ring's
  SFR first exceeds 1.5× rest) and ~40 Myr after its SFR peak (§7.7, §8.1). This falls inside the
  observed 50–250 Myr range only for the default run: the low-e profile (θ at 14.9 min ≈ 430 Myr),
  edging and repeat cycles fall outside it.
- The bar–AGN link is weak observationally. Knapen, Shlosman & Peletier 2000 found bars in 79 %
  of Seyferts against 59 % of controls, while Ho, Filippenko & Sargent 1997 and Cisternas et al.
  2013 found no excess. Most nuclear-ring galaxies are not luminous AGN. **A bar does not
  guarantee a climax**, which gives the model its "plateau without climax" branch.

**Astrophysical jet.** A jet is a pair of narrow, opposite streams of ionised matter along the
rotation axis [G Astrophysical_jet.md L23, L33]. It is launched by magnetic fields in the
accretion disk and possibly powered by black-hole spin (Blandford–Znajek) [G L25, L41–L44].

- **M87 reference values** [G Messier_87.md L37, L59, L62]: distance 16.4 Mpc; jet at position
  angle 260°, 20″ long and 2″ wide, so about 1.5 kpc with aspect about 0.1; central mass
  estimated at 5 × 10⁹ M☉ in 1978.
- In the M87 jet (knots HST-1, D, E, F, I, A, B, C), features in HST-1 and knot D move at 4–6 c
  apparent speed (Biretta, Sparks & Macchetto 1999, L); the outer knots (A, B, C) are much slower
  or quasi-stationary. HST-1 brightened more than 50-fold in X-rays in 2000–2005 (Harris et al.
  2006, L).
- Eight knots over 20″ give a mean spacing of about 2.5″ ≈ 200 pc (1″ = 79.5 pc at 16.4 Mpc). The
  gaps are irregular (about 0.8″ to 4″), and most knots are quasi-stationary or slow shock features
  rather than a ballistic train of blobs, so this mean is used only as an illustrative scale.
- Optical jet light is synchrotron emission, F_ν ∝ ν^−α with α ≈ 0.6–1, so F_λ ∝ λ^(α−2) rises
  toward the blue. Integrated through CIE 1931, α = 0.7 gives chromaticity ≈ (0.299, 0.304), a
  correlated colour temperature of about 7,700 K: near-neutral white with at most a faint cool
  tint, not distinctly blue (computed here). Jets look blue in published images mainly by contrast
  with a ~4,500 K bulge and through filter choice [T]. The renderer computes this colour from the
  power law, not from the Planck pipeline.
- **Relativistic beaming** makes fast jets one-sided [G Astrophysical_jet.md L33; AGN L27]. The
  jet-to-counterjet brightness ratio is ((1+β cos θ)/(1−β cos θ))^(2+α) for a continuous flow and
  ((1+β cos θ)/(1−β cos θ))^(3+α) for discrete moving blobs [T].
- **Disk–jet coupling is observed.** In 3C 120, dips in X-ray emission were followed by the
  ejection of new superluminal knots roughly yearly (Marscher et al. 2002, L), so the nucleus dims
  briefly before each ejection.
- **Caution:** powerful kiloparsec-scale jets live mainly in giant ellipticals such as M87 and
  Cen A [G AGN L35; Messier_87.md L37]. Seyfert jets in spirals are weak, at most a few kpc long,
  and point in random directions relative to the disk (Kinney et al. 2000, L). Spiral-hosted
  large jets are rare (Ledlow, Owen & Keel 1998; Bagchi et al. 2014, L). Optical jets are known
  in relatively few objects, of order tens [T, L]. FR I jets slow to mildly relativistic speeds on
  kiloparsec scales; in 3C 31 the deceleration is spread over roughly 1 to more than 10 kpc (Laing
  & Bridle 2002, L). Jets in Seyfert spirals are
  also slow and largely two-sided: VLBI component speeds are ≲ 0.25c (Middelberg et al. 2004, L, M),
  and below 0.05c in NGC 4151 (Ulvestad et al. 2005, L, M).
- **Model choice.** The model shows a deliberately rare case: a relativistic (β ≈ 0.8), one-sided
  jet in a disk galaxy, as in γ-ray-emitting narrow-line Seyfert 1 galaxies (Abdo et al. 2009, L;
  their hosts are thought to be mostly disk-like, but host morphology is debated, [T], L) and the
  few spiral-hosted radio jets (Ledlow, Owen & Keel 1998; Bagchi et al. 2014). Black-hole mass
  estimates for γ-ray NLS1s are typically ~10⁷–10⁸ M☉ [T, L], so the model's 4 × 10⁶ M☉ hole
  (§9.1) sits at or below the low end for jetted NLS1s, a further stretch beyond their rarity.
  Beyond ~1 kpc the knots decelerate by a design scaling for a low-power Seyfert jet (β ∝ d⁻²,
  §9.3), qualitatively as in FR I jets; it is several times faster than the deceleration Laing &
  Bridle 2002 find in 3C 31. The About text says the jet, its deceleration and the black-hole mass
  are atypical.
- Restarted jets leave nested "double-double" relic lobes on 100 kpc–Mpc scales, built over
  10⁶–10⁸ yr (Schoenmakers et al. 2000, L). These are a physical record of repeated episodes, but
  they lie far outside a 30 kpc optical frame and the model does not show them. A repeat peak is
  drawn as a fresh AGN and jet ignition tens of Myr after the previous one, by which time the
  earlier knots and jet cocoon are long gone (§7.8, §9.3).

**Ionization cones and light echoes.**

- An AGN lights biconical cones of gas glowing in [O III] 500.7 nm (teal) and Hα (pink), as in
  NGC 5252 (Tadhunter & Tsvetanov 1989, L). Emission-line gas is the **only legitimate source of
  green** in the scene.
- Real extended narrow-line regions are patchy and filamentary: they glow only where a cone
  intersects gas, often the host disk, since Seyfert axes are randomly oriented relative to the
  disk (Kinney et al. 2000, L). A uniformly filled glowing bicone in empty space would be as fake
  as a glowing shock shell (§9.4).
- Hanny's Voorwerp still glows in [O III] although its quasar faded within the last ~10⁵ yr
  (Lintott et al. 2009; Keel et al. 2012, L). It is gas that keeps shining after its source has
  gone dark, but only for about the light-crossing plus recombination time: AGN-lit gas fades
  within ~10⁴–10⁵ yr of its source dimming.
- Large-scale AGN feedback is mostly invisible in optical light. A huge glowing shock shell would
  be fake (Fabian 2012, L).

**Post-starburst fade.** E+A galaxies show A-star absorption and no emission lines once star
formation has stopped (Dressler & Gunn 1983; Zabludoff et al. 1996, L).

- With τ ≈ 10 Gyr · M^−2.5, stars of 20 M☉ live about 6 Myr, 5 M☉ about 180 Myr and 2 M☉ about
  1.8 Gyr.
- Hα from an instantaneous burst falls about a hundredfold within about 10 Myr (Leitherer et al.
  1999, L, H).
- The colour therefore drifts from pink, to blue-white, to a lingering white, then warm-white
  A/F-star glow (§9.1). It emerges by itself from the existing temperature-to-colour code.
- The AGN does **not** blow out the ring at the climax. In the model the ring fades afterwards by
  gas exhaustion once its refill stops (§7.4, §8.1). AGN feedback is not needed for this, and
  post-starburst statistics argue against AGN as the primary quencher (Yesuf et al. 2014, L). The
  stop is read as the end of an intermittent bar-inflow episode (above); that it coincides with
  the climax is a design choice, and the About text says so.
- Massive galaxies at z ≈ 2 quench **inside-out**, the centre first, over Gyr timescales
  (Tacchella et al. 2015, L). This is a galaxy-wide trend and is not used for the cycle's
  tens-of-Myr fade.

### 2.3. Corrections to reused Anger parameters

| Reused element | Problem | Orgasm Galaxy rule |
|---|---|---|
| `HII_LIFE` 0.45 units (≈ 27 Myr) | H II regions disperse in ~1.5 Myr of feedback within ~10 Myr cloud lives (Kruijssen et al. 2019) [G ../anger-galaxy/raw/…H_II_region.md L49] | 5–10 Myr in the ring (default 7 Myr) |
| Arm winding / sharpening with arousal (`ecc`, `twist`) | Spirals are thought to be transient and recurrent, changing over a few rotations (~0.3–0.5 Gyr; Sellwood & Carlberg 2014), comparable to one ~0.7 Gyr cycle but not in step with arousal | Arms and bar fixed (a kinematic-wave simplification); only gas and star formation respond |
| Disk heating that reverses (`heat`) | Stellar dynamical heating is irreversible [T] | Not used |
| Seconds-long supernova flashes | Individual SNe last months, about 10⁻⁸ s on screen; a 1 M☉/yr ring gives ~5 × 10⁴ SNe per screen second at 4.8 Myr/s (Diehl et al. 2006) | Not used; superbubbles of 0.1–1 kpc lasting ~10⁷ yr if needed |
| AGN brightness pulsing at heart rate | Quasi-periodic nuclear variability exists (X-ray QPEs hours apart, Miniutti et al. 2019; an X-ray QPO in RE J1034+396, Gierliński et al. 2008; OJ 287's ~12 yr optical outbursts, Sillanpää et al. 1988; Valtonen et al. 2008), but nothing corresponds to a heart-rate rhythm at these time-lapse scales (Myr or centuries per screen second) | Rhythm only in jet knots |
| Expanding collisional ring | Anger's outburst signature; it needs an intruder [G ../anger-galaxy/raw/…Ring_galaxy.md L43–L45] | Not used; resonant (stationary) rings only |
| Superwind | Physically expected here, not unphysical: winds are driven by central starbursts (Heckman, Armus & Miley 1990) above Σ_SFR ≈ 0.1 M☉ yr⁻¹ kpc⁻² (Heckman 2002), as in the barred NGC 253 and NGC 1808. The ring at b ≈ 4–5 (~1.5–3 M☉/yr over ~0.7 kpc², §9.1) has Σ_SFR ≈ 2–4 M☉ yr⁻¹ kpc⁻² | Omitted by default, for distinctness from Anger's M82-style outflow and because a wind is faint or invisible face-on; an optional faint, narrow, biconical extraplanar Hα and dust plume scaled with ring SFR may be shown near edge-on. The About text says the omission is a choice |
| `CORE_RC` 0.09 (solid-body core ≈ 1.35 kpc) | No inner Lindblad resonance exists for a bar, so there are no x2 orbits, the classic site of a nuclear ring (simulations tie the ring radius to the inflowing gas's angular momentum rather than to a resonance; Kim, Seo & Kim 2012) | 0.03 (≈ 0.45 kpc), a design choice that allows x2 orbits: ILRs at 0.036 and 0.093 units (computed in §9.1) |

### 2.4. The physical causal chain and its timescales

The chain is: **bar inflow (dust lanes) → gas piles up in the nuclear ring → circumnuclear
starburst (through an assumed rise in star-formation efficiency, §8.1) → AGN ignition after the
burst has begun (≥ 50 Myr into it), while the ring still forms stars or in its post-starburst
phase up to ~250 Myr after the burst → jet with knots, plus ionization cones → the inflow episode
ends, the ring gas is used up and the post-starburst fade follows → slow refill by the bar.**

The motion is centripetal build-up, then release along the axis, then afterglow. The graph links
the two ends directly (`graphify path` "Bar-driven Gas Inflow (Stellar Nursery)" → "Active
Galactic Nucleus", via Barred_spiral_galaxy.md L39).

| Process | Timescale | At 4.8 Myr/s | At 1 kyr/s |
|---|---|---|---|
| Bar rotation (Ω_b ≈ 40 km s⁻¹ kpc⁻¹) | ~150 Myr | ~31 s | frozen |
| Nuclear-ring orbit (0.9 kpc, ~210 km/s) | ~26 Myr | ~5.4 s | frozen |
| Ring burst cycle (physical; not modelled as an oscillator, §8.1 row 4) | 10–20 Myr | 2–4 s | frozen |
| Ring H II visibility | 5–10 Myr | 1–2 s | frozen |
| Starburst onset → AGN peak (observed, statistical) | 50–250 Myr | 10–50 s | — |
| One AGN accretion phase | ~10⁵ yr | 0.02 s | ~100 s |
| Knot travel to 2 kpc (0.8c to 1 kpc, then decelerating) | ~14 kyr | 0.003 s | ~14 s |
| Jet head (= leading knot, §9.3) to 1 kpc at 0.8c | ~4 kyr | < 0.001 s | ~4 s |
| Ionization front filling a 1–3 kpc cone (observed delay r(1 − cos φ)/c, axis 30° from the line of sight) | near cone 0–6.5 kyr; far cone ~4–20 kyr | < 0.01 s | 0–6.5 s; ~4–20 s |
| Light echo off a cloud 3–10 kpc away | 10⁴–3 × 10⁴ yr | < 0.01 s | 10–30 s |
| Hα fade after burst stops | ~10 Myr | ~2 s | — |
| Blue O/B light fade | 10–100 Myr | 2–20 s | — |
| White A-star glow | 0.3–1 Gyr | 60–200 s | — |
| Nuclear reservoir refill | 10⁸–10⁹ yr | 20–200 s | — |

No single time-lapse can show bar inflow and moving jet knots together: their timescales differ by
more than three orders of magnitude. The model therefore uses **two astrophysical clock regimes**,
a galactic one at Myr/s and a jet one at kyr/s. This is a visualization device, not a physical
effect. The model switches between them smoothly at the threshold, and the HUD always states the
current scale (§7.7).

---

## 3. The sexual response cycle

### 3.1. Models

| Model | Phases | Key idea | Source |
|---|---|---|---|
| Masters & Johnson | Excitement → plateau → orgasm → resolution | Four-stage linear physiological model from laboratory observation (~382 women, ~312 men, >10,000 cycles; Masters & Johnson 1966) | [G Human_sexual_response_cycle.md L19] (the model); Masters & Johnson 1966 (sample) |
| Kaplan | Biphasic (vasocongestive excitement; reflex orgasmic contractions) → triphasic (desire, excitement, orgasm) | Desire as a separate, neurologically distinct first phase; shaped DSM-III | Kaplan 1974, 1979 |
| Basson | Circular, with feedback | Many people start from sexual neutrality. Receptivity comes from intimacy, desire can be *responsive* (following arousal), phases overlap, and satisfaction does not require orgasm | Basson 2000, 2001 |
| Dual control | Excitation (SES) vs inhibition (SIS) | Two largely independent systems with stable individual differences. The same stimulus can push one person over threshold and leave another flat; an inhibiting cue can collapse arousal abruptly | Bancroft & Janssen 2000 |
| Incentive motivation | Positive feedback | Arousal raises attention to cues and their reward value, which raises arousal. This gives a slow start, an accelerating rise and a sudden discharge | Toates 2009 |

**Criticisms used by the model.**

- The sample was self-selected and not representative (Tiefer 1991).
- No marker separates plateau from late excitement (Robinson 1976; Tiefer 1991). In this model,
  plateau is an *operational* band on one continuous arousal variable, not a separate mechanism.
- In a sample of nurses, about one third each endorsed the Masters & Johnson and Basson models and
  about a quarter Kaplan's, and a minority endorsed none; Basson endorsement was associated with
  lower sexual-function scores and more dissatisfaction (Sand & Fisher 2007; non-representative
  sample). DSM-5 merged
  female desire and arousal (APA 2013). The model therefore lets desire come **before or after**
  arousal (the parameter ρ, §7.2), and it lets a cycle end without orgasm.
- Felt and genital arousal agree with mean r ≈ 0.66 in men and r ≈ 0.26 in women (Chivers et al.
  2010, H). The model tracks them as **two coupled signals** with an individual concordance κ.

### 3.2. Response patterns

Masters & Johnson 1966 described one pattern in men: a single orgasm followed by an obligatory
refractory period. They described three patterns in women:

- **Pattern A:** one or more orgasms, with arousal staying at or above plateau level in between.
- **Pattern B:** a prolonged plateau without orgasm and a slow resolution.
- **Pattern C:** a rapid rise to orgasm and a fast resolution.

These patterns are kept as **profiles available to any body** (§7.9). Each profile is a
combination of continuous parameters.

### 3.3. Typical quantitative timeline (adult, effective stimulation)

| Phase | Typical duration | Range / variability | Main events | Sources |
|---|---|---|---|---|
| Baseline | — | — | HR 60–80 bpm, RR 12–16/min (resting norms). The starting point may be neutrality (Basson) | [T] |
| Excitement onset | 0–30 s | Slower with age | Genital vasocongestion within seconds (erection) or 10–30 s (lubrication) | [G HSRC L37]; Masters & Johnson 1966 |
| Excitement build | ~0.5–10 min | Minutes to hours (stated for females) [G HSRC L41]; preferred length of foreplay varies across cultures [G HSRC L23] | HR, BP and RR rise [G HSRC L29]; myotonia; nipple erection; arousal moves in **waves**, partly lost and regained (stated for erection [G HSRC L37]; generalised here to all bodies as an assumption). Genital temperature peaked at ~10 min in both sexes during erotic film viewing (Kukkonen et al. 2007; visual stimulation, laboratory); this is used only as evidence that men and women did not differ, not as a duration | [G HSRC L23, L29, L37, L41]; [G Sexual_arousal.md L39]; Kukkonen et al. 2007 |
| Plateau | ~0.5–3 min | Tens of minutes if extended voluntarily (edging) | Arousal high and accelerating; HR 100–175 bpm (M&J individual range); orgasmic platform; rhythmic contractions at the base of the penis; frustration if prolonged without orgasm | [G HSRC L45–L55]; Masters & Johnson 1966 (HR); [T, L] for duration |
| Point of inevitability (emission; people with a prostate) | ~2–3 s before expulsion | Other bodies: no timed, all-or-none window is documented; M&J describe only a brief sensation of "suspension" and an optional 2–4 s platform spasm (§4.5) | Emission begins; from here the ejaculatory reflex cannot be stopped. The model makes this window a profile parameter (§7.4) | Masters & Johnson 1966; §4.7 |
| Orgasm | contractions ~3–15 s; felt ~5–40 s typical, with a long right tail (L) | Female lab mean ~20 s (SD ~12 s; Levin & Wagner 1985); signalled durations well beyond 40 s in some women in anal-probe studies (Bohlen et al. 1982; recalled, L); status orgasmus 20 to >60 s (Masters & Johnson 1966); extended reports of minutes, whose classification as orgasm is disputed | 3–15 contractions, first intervals ~0.6 s (EMG, men) to 0.8 s (the classic M&J value), that weaken and space out; peak HR, BP and RR; euphoria | Numbers: Masters & Johnson 1966; Levin & Wagner 1985; Gerstenberg, Levin & Wagner 1990. Definition: [G Orgasm.md L23, L31]; disputed extended orgasms: [G Orgasm.md L33] |
| Early resolution | 0–5 min | — | HR and BP fall steeply; muscles relax; first-stage detumescence (to ~1.5× flaccid size); genital hypersensitivity | [G HSRC L75, L79]; [G Refractory_period_sex.md L29] |
| Late resolution | ~5–30 min | Flush up to ~2 h; prolactin ~60 min; vasocongestion lasts hours if there was no orgasm | Vasocongestion clears; flush fades in reverse order | [G HSRC L31]; [G Refractory L29]; [T] |
| Refractory period | Order of magnitude only (L): ~15 min at 18 → ~20 h in the 70s | Minutes to days; rarely absent (case reports: Whipple, Myers & Komisaruk 1998; Haake et al. 2002). Female: contested; some report short or absent refractoriness, many report post-orgasmic hypersensitivity [G L19, L29]; data insufficient | Orgasm generally impossible; satiety; hypersensitivity | [G Refractory_period_sex.md L19, L23, L29, L33] (secondary sources; the age figures are hedged "according to some studies"). No peer-reviewed age series exists (Levin 2009). Lengthening with age into many hours in older men is consistent with Masters & Johnson 1966 [T] |

**Latency to orgasm** is strongly right-skewed and depends on context.

- Intravaginal ejaculation latency, timed with a stopwatch from intromission to ejaculation, has a
  median of 5.4 min, range 0.55–44 min (Waldinger et al. 2005, n = 500 couples).
- Partnered women report a mean time to orgasm of about 13–14 min (Bhat & Shastry 2020, M). This
  is a retrospective self-estimate that is not restricted to the penetration interval.
- The two partnered figures (Waldinger et al. 2005: stopwatch, penetration interval only, men;
  Bhat & Shastry 2020: retrospective self-estimate, women) measure different intervals by different
  methods, so the apparent gap between them is partly a measurement artefact and cannot be split
  between causes.
- With effective solo stimulation many women reach orgasm in under about 4 min (Kinsey et al.
  1953, M). This is a third, different measure (retrospective, solo) and is not comparable with
  either partnered figure.
- In a US probability sample of women aged 18–94, about 18 % said intercourse alone was enough for
  orgasm, about 37 % that clitoral stimulation was necessary during intercourse, and about 36 %
  that it improved orgasm (Herbenick et al. 2018, M). The capture's "70–80 % require direct
  clitoral stimulation" [G Orgasm.md L51] rests on unspecified "general statistics" (L).
- How often orgasm "usually or always" occurs when sexually intimate differs by gender and
  orientation (Frederick et al. 2018, M): heterosexual men about 95 %, gay men about 89 %,
  bisexual men about 88 %, lesbian women about 86 %, bisexual women about 66 % and heterosexual
  women about 65 %. That women with women partners report rates close to men's points to the type
  of stimulation and to context rather than to sex alone.

**Multiple orgasms.** They are possible, especially in women, and rare in men because of the
refractory period [G Orgasm.md L39; HSRC L81].

- Estimates in women depend on definition, from about 14 % "regularly" (Kinsey et al. 1953) to
  about 43 % "usually" (Darling, Davidson & Jennings 1991).
- "Serial" orgasms are seconds to about 1 min apart; "sequential" ones are about 2–10 min apart
  [T, L].
- Some men report non-ejaculatory orgasms before a final ejaculatory one. One laboratory case
  documented six ejaculatory orgasms in 36 min [G Refractory L33; Whipple, Myers & Komisaruk
  1998].

**Male and female orgasm are more alike than different.** Raters could not tell written
descriptions apart [G Orgasm.md L43; Vance & Wagner 1976]. Imaging networks at orgasm are also
broadly similar (§5).

### 3.4. Sources of variability the model must allow

- **Age.** Every phase slows. Erection latency goes from seconds to minutes, expulsive force and
  contraction count fall, and the refractory period grows to hours. After menopause without
  hormone therapy, vasocongestion is reduced and some women need a lubricant
  [G Vasocongestion.md L37]; lubrication is slower in older women, while orgasm capacity usually
  persists (Masters & Johnson 1966, L).
- **Hormones.** In a study of 130 trans women and 33 trans men after at least 1 year of
  gender-affirming hormone therapy, trans women self-reported (for masturbation) increases in time
  to orgasm, orgasm duration and orgasm satisfaction, and many participants reported a shift from
  short, single-peak to longer, multiple-peak orgasms [G Refractory_period_sex.md L35]. The
  comparison is a retrospective self-report, and hormone and surgical status may be confounded.
  Within those limits, the time course appears to depend partly on hormones, not only on anatomy.
- **Medication.** SSRIs delay orgasm. 59 % of 1,022 outpatients on antidepressants reported
  sexual dysfunction (Montejo et al. 2001).
- **Neurology.** Orgasm is possible after spinal cord injury [G Orgasm.md L41; Sipski et al.
  2001]. A few women with clinically complete injury reported orgasm, possibly carried by vagal
  afferents from the cervix (a hypothesis; very small n; Komisaruk et al. 2004; §5.4). Orgasm from
  imagery alone has been documented in women without SCI (Whipple, Ogden & Komisaruk 1992), and
  the capture reports it after SCI too [G L41]. The capture's claim that it was *first* reported
  after SCI is doubtful: Kinsey et al. 1953 already reported that about 2 % of women reached
  orgasm by fantasy alone, and orgasm during sleep has long been described [G L25].
- **Context.** The orgasm gap shows that context and type of stimulation modulate whether the
  cycle completes: about 65 % of heterosexual women against about 86 % of lesbian women usually or
  always reach orgasm (Frederick et al. 2018, §3.3). Laboratory and home heart rates are not used
  as evidence of context, because those samples differ in age, health and sex (§4.1).

---

## 4. Peripheral physiology during arousal, orgasm and resolution

### 4.1. Cardiovascular and respiratory

| Measure | Baseline | Excitement | Plateau | Orgasm (peak) | +2 min | Recovery |
|---|---|---|---|---|---|---|
| Heart rate | 60–80 bpm [T] | rising, ~90–110 (design interpolation between baseline, the home value of ~101 at −2 min and the M&J plateau lower bound; [T], L) | 100–175 (M&J individual range); ~101 at −2 min (home) | study means: ~110–127 in the laboratory, healthy young men (Bohlen et al. 1984, M); 117 (90–144) at home, middle-aged men with coronary disease (Hellerstein & Friedman 1970, n = 14); individual extremes 110–180+ (M&J); rarely > 130 in everyday sexual activity in normotensive people (AHA) | ~85 (home) | baseline in ~2–5 min ([T], L; the home data give only ~85 at +2 min) |
| Systolic BP | ~110–120 | rising | women +20–60, men +20–80 mmHg (M&J individual ranges, M) | study mean peak ~160 mmHg, healthy men (Nemec, Mansfield & Kennedy 1976; recalled figures, L–M, re-check); individual extremes women +30–80, men +40–100 mmHg (M&J); rarely > 170 mmHg in normotensive people (AHA) | falling | minutes |
| Diastolic BP | ~70–80 | rising | women +10–20, men +10–40 mmHg (M&J individual ranges, M) | study mean peak ~80 mmHg, healthy men (Nemec, Mansfield & Kennedy 1976; L–M, re-check); individual extremes women +20–40, men +20–50 mmHg (M&J) | falling | minutes |
| Respiration | 12–16/min | rising | hyperventilation begins late | up to ~40/min (M&J individual extreme; no study mean is cited here), broken by breath-holds (duration not documented) and vocalizing | normalising | minutes |
| Energy cost | — | — | — | orgasm phase: 2.5–3.3 METs (O₂ uptake; Bohlen et al. 1984) | — | — |

Whole-session energy costs are a different measure and are higher: about 6.0 METs in men and 5.6 in
women, averaged over the whole activity with an armband monitor in young couples (Frappier et al.
2013), and 3–5 METs for the whole activity (AHA). They are not orgasm-peak values.

Sources: direction from [G HSRC L29, L47, L61, L75]. Magnitudes from Masters & Johnson 1966
(laboratory; volunteers of both sexes, mostly younger adults but spanning roughly 18–89 years
[T, M]; ranges of individual extremes), Bohlen et al. 1984 (laboratory means; healthy young men),
Nemec, Mansfield & Kennedy 1976 (laboratory means of BP; healthy men; recalled figures, L–M),
Hellerstein & Friedman 1970 (home; 14 middle-aged men with coronary disease or coronary risk,
recorded with their wives: peak 117.4 bpm, ~101 at −2 min, ~85 at +2 min) and Levine et al. 2012
(AHA statement; its HR and BP limits refer to normotensive people). The M&J ranges and the home
mean differ in summary statistic, age, health and sex, so their gap is not evidence of a
laboratory-vs-home effect; laboratory means in healthy young men are close to the home mean.
Female cardiovascular data are sparse (Masters & Johnson 1966; Exton et al. 1999).

The relative risk of myocardial infarction is about 2.5 within 2 h of sexual activity, but the
absolute risk stays very low (Muller et al. 1996). This is consistent with a sharp, brief peak.

**Design consequence.** There are two envelopes, and the *typical* one is the default. In it, HR
follows study means (peak about 115–125 bpm), BP follows the study means of Nemec et al. 1976
(peak about 160/80–85, L–M), and RR, for which no study mean is cited, is a design estimate
scaled the same way as HR (plateau about 22–24/min, peak about 27/min; [T], L). The *upper range
(M&J individual extremes)* envelope has HR up to about 180 bpm, BP up to +100/+50 mmHg (men;
women +80/+40) and RR up to about 40/min. Both rest mostly on data from men, and the About text
says so.

### 4.2. Vasocongestion

Vasocongestion is swelling of tissue from increased blood flow and local pressure. It produces
erection of the penis and clitoris, lubrication, nipple swelling in all sexes and the sex flush
[G Vasocongestion.md L25, L37, L39].

- Genital vasodilation is mainly parasympathetic (S2–S4, nitric oxide → cGMP) (Burnett et al.
  1992; Ignarro et al. 1990).
- Onset takes seconds for erection and 10–30 s for lubrication. Testicular volume rises about
  50 % and breast volume up to about 20–25 % (Masters & Johnson 1966, L).
- After orgasm the clearance is fast. Penile detumescence has two stages: the first, during the
  refractory period, to about 1.5× flaccid size; the second, after it, to flaccid [G HSRC L79].
  Visible vasocongestion clears in about 5–30 min [T].
- **Without orgasm**, pelvic congestion can last hours (Masters & Johnson 1966, [T]), felt as
  cramp-like aching or pelvic heaviness [G Vasocongestion.md L41].

### 4.3. Myotonia

Muscle tone rises from excitement onward and is maximal at orgasm [G HSRC L33, L47]. It shows in
the face, neck, abdomen, thighs and buttocks.

Carpopedal spasm (involuntary flexion of the hands and feet) appears in late plateau and at
orgasm in some people of all sexes. Its prevalence and mechanism are unknown: myotonia, or
hypocapnia from hyperventilation (Masters & Johnson 1966, L).

### 4.4. Sex flush

| Property | Value | Source |
|---|---|---|
| Prevalence | ~50–75 % of females, ~25 % of males; more likely when warm, may be absent when cool | [G HSRC L29; Sex_flush.md L29] |
| Spread | Female: under the breasts → breasts, torso, face, hands, soles, possibly the whole body. Male: epigastrium → chest, neck, face, forehead, back, sometimes shoulders and forearms | [G HSRC L31] |
| Timing | Female onset in late excitement or early plateau; male onset in late plateau; peak at orgasm | Masters & Johnson 1966 (M) |
| Fade | Soon after orgasm, up to ~2 h; reverse order of appearance; sometimes with sweating | [G HSRC L31] |

Redness may be under-detected on darker skin, and the original samples were small and probably
mostly light-skinned. No proper study across skin tones exists.

### 4.5. Rhythmic contractions

Orgasm is defined clinically by rhythmic involuntary contractions plus characteristic changes in
HR, BP and respiration [G Orgasm.md L31]. At least 26 definitions coexist (Mah & Binik 2001).

| Property | Value | Source |
|---|---|---|
| Initial interval | ~0.6–0.8 s (0.8 s ≈ 1.25 Hz is the classic M&J observational value, reported for both sexes); instrumented EMG in men is commonly summarised with first intervals nearer ~0.6 s that lengthen by ~0.1 s per contraction. The model treats it as an individual parameter, 0.6–0.9 s (the 0.9 s upper bound is a design value), default 0.8 s. The default train follows the M&J pattern (a constant initial interval, then lengthening); an optional EMG-like mode lengthens from the first interval (§7.5) | Masters & Johnson 1966; Gerstenberg, Levin & Wagner 1990 (M; summary figures not re-checked against the paper) |
| After the first 3–6 pulses | intervals lengthen and amplitude falls; irregular minor contractions several seconds apart | Masters & Johnson 1966; Bohlen et al. 1980, 1982; Gerstenberg, Levin & Wagner 1990 |
| Count | 3–5 in a mild orgasm, 8–12 (up to ~15) in an intense one; male: 3–4 major expulsive contractions plus minor ones, or ~10–15 EMG bursts in all, most of them minor; anal sphincter about 2–4 at ~0.8 s (men), present in some female orgasms (count variable; [T], L) | Masters & Johnson 1966 (M); Gerstenberg, Levin & Wagner 1990 (M) |
| Onset | sometimes a sustained spasm of ~2–4 s before the rhythmic train (orgasmic platform) | Masters & Johnson 1966 (M) |
| Amplitude profile | pulses 1–2 strongest, then a monotonic decline | [G HSRC L65] |
| Fast component | 8–13 Hz rectal-pressure fluctuations ride on the slow contractions; absent in imitation (women, clitorally induced orgasm, small laboratory sample) | van Netten et al. 2008 (M) |
| Individuality | distinct pattern types and large differences between individuals (anal-probe studies); some reported orgasms show no regular train | Bohlen et al. 1980, 1982 (L) |
| Felt vs measured | felt orgasm (~20 s) outlasts the regular train | Levin & Wagner 1985 |

### 4.6. Other signs

- **Pupils.** Pupils dilate with arousal [G Sexual_arousal.md L55; Hess & Polt 1960], but light
  and mental effort confound this. Pupil size at orgasm itself has not been measured.
- **Sweating.** About one third of participants sweat in resolution (Masters & Johnson 1966, L).
- **Analgesia.** In women the pain detection threshold was raised throughout vaginal
  self-stimulation and rose further, by about 107 %, at orgasm (Whipple & Komisaruk 1985, L).

### 4.7. Autonomic sequence

1. **Arousal onset.** Vagal withdrawal starts the HR rise [T]. Parasympathetic S2–S4 genital
   vasodilation begins.
2. **Excitement → plateau.** Sympathetic tone rises *on top of* the parasympathetic genital drive.
   HR, BP and catecholamines climb (Krüger et al. 1998; Exton et al. 1999).
3. **Emission** (in people with a prostate and seminal vesicles). Sympathetic T10–L2 outflow via
   the hypogastric nerve contracts the vas deferens, seminal vesicles and prostate and closes the
   bladder neck (α1 receptors). It is felt as inevitability about 2–3 s before expulsion
   (Masters & Johnson 1966 for the timing; Giuliano & Clement 2005 for the pathways).
4. **Expulsion / rhythmic train.** Somatic S2–S4 output via the pudendal nerve drives the
   bulbospongiosus, ischiocavernosus and pelvic floor (Onuf's nucleus), together with a
   sympathetic discharge.
5. **Resolution.** Parasympathetic tone returns, and catecholamines reach baseline within minutes.

The textbook rule "parasympathetic arousal, sympathetic orgasm" holds for the genital vessels and
for emission, not for the whole body. Moderate sympathetic activation *helps* genital arousal in
women, following an inverted U (Meston & Gorzalka 1995; Lorenz et al. 2012).

---

## 5. Brain and spinal cord

### 5.1. Method caveat

- H₂¹⁵O PET integrates blood flow over about 40–90 s, longer than an orgasm (~10–30 s). Its
  "orgasm" images therefore blend late plateau, climax and early resolution [T].
- fMRI samples every ~2 s but is badly affected by head and pelvic motion [T].
- Samples are very small (n ≈ 2–13; the SCI fMRI work had a few participants), mostly young,
  cisgender, heterosexual and Western. Heath 1972 recorded with depth electrodes in 2 psychiatric
  or epileptic patients; the findings do not generalise, and the wider research programme they
  come from is ethically problematic (it included a conversion experiment).
- Region lists below should be re-checked against the primary papers before they are quoted
  elsewhere.

### 5.2. Activations and deactivations

| Region | During stimulation | At orgasm | Interpretation | Sources |
|---|---|---|---|---|
| Large parts of cerebral cortex | — | activity ↓ in large parts of the cortex (wording of the capture, which says "metabolic"); some limbic and paralimbic regions (e.g. ACC and insula) unchanged or ↑, but amygdala and hippocampus ↓ in PET (Holstege et al. 2003; Georgiadis et al. 2006) and ↑ in fMRI (Wise et al. 2017) | general release | [G Orgasm.md L27] for the "large parts of cortex" wording only: the capture cites an unnamed Georgiadis reference whose details were cut off, so it is not paired here with a specific paper |
| Lateral orbitofrontal cortex, temporal pole, inferior temporal gyrus | — | ↓ (PET); specific to real orgasm, not imitation | loss of evaluative and inhibitory control ("letting go"); the lateral OFC evaluates and inhibits | Georgiadis et al. 2006; Kringelbach 2005; Georgiadis & Kringelbach 2012 |
| Amygdala, hippocampus, temporal lobe | ↓ (PET) | ↓ (PET); ↑ (fMRI) | release from vigilance (compare Klüver–Bucy) vs disagreement between methods | Georgiadis et al. 2006, 2009; Holstege et al. 2003; Wise et al. 2017; Klüver & Bucy 1939 |
| Genital somatosensory cortex (medial paracentral lobule), S2, posterior insula, claustrum | ↑ | ↑ | sensory input; in women, clitoris, vagina and cervix map to clustered but distinct sites, and nipple stimulation also activated the genital region of S1 (Komisaruk et al. 2011, women only); penile representation has been reported nearer the hip/trunk area of the postcentral gyrus (Kell et al. 2005, M) | Komisaruk et al. 2011; Kell et al. 2005; Georgiadis et al. 2009 |
| VTA / mesodiencephalic transition zone, subparafascicular and intralaminar thalamus | NAcc dopamine ↑ in anticipation (rat; Pfaus et al. 1990; Damsma et al. 1992) | ↑ (PET, men); PET resolution limits localisation to the mesodiencephalic region, not the VTA itself; compared by the authors to a heroin "rush" | reward and salience; the thalamic target of the spinal ejaculation generator (rat) | Holstege et al. 2003; Truitt & Coolen 2002 |
| Nucleus accumbens, anterior cingulate, insula, OFC, operculum | rising | peak, then decline (fMRI, women) | reward, interoception; no widespread cortical shutdown in fMRI | Wise, Frangos & Komisaruk 2017 |
| Cerebellum (deep nuclei, vermis) | — | ↑, among the most consistently reported activations | motor timing of the rhythm? sensory prediction? hedonic? | Holstege et al. 2003; Georgiadis et al. 2006 |
| Hypothalamus (PVN), pituitary | — | PVN ↑ (fMRI, women incl. complete SCI, n ≈ a few; Komisaruk et al. 2004; Komisaruk & Whipple 2005), not reported in male PET; pituitary ↑ in women but not men (PET) | possibly related to oxytocin/prolactin release; but men release oxytocin at ejaculation (Murphy et al. 1987; Carmichael et al. 1987) without a pituitary PET signal, so pituitary blood flow does not index oxytocin release from posterior-pituitary terminals; the hypothalamus is near the resolution limit of PET/fMRI | Komisaruk et al. 2004; Komisaruk & Whipple 2005; Huynh, Willemsen & Holstege 2013 |
| Periaqueductal gray (PAG) | — | ↑ (fMRI, women incl. complete SCI, n ≈ a few; Komisaruk et al. 2004; Komisaruk & Whipple 2005); not reported in male PET | descending analgesia and gating of vocalization (the better-grounded functions); "relaxed quiescence" and dense OT/AVP receptors are speculative here (animal stimulation and maternal behaviour; one capture line is marked citation needed) | [G Periaqueductal_gray.md L34–L44; L50, L60]; Komisaruk et al. 2004; Komisaruk & Whipple 2005 |
| Septal region | — | spike and slow-wave activity (depth electrodes, 2 psychiatric/epileptic patients; §5.1) | — | Heath 1972 (L) |

**Sex differences.** One small study found more amygdala and hypothalamus response to visual
sexual cues in men, even when women's subjective arousal was equal or higher (Hamann et al.
2004), but a meta-analysis of 61 neuroimaging studies found no sex difference in the neural
response to visual sexual stimuli (Mitricheva et al. 2019). At orgasm, patterns are broadly
similar across sexes (Georgiadis et al. 2009), with the pituitary as the exception. During
tactile genital stimulation, however, the same PET data show prominent sex differences (Georgiadis
et al. 2009), so the "During stimulation" entries in the table should be read per sex. A
meta-analysis dominated by visual-stimulus studies, mostly in men, describes an arousal network
with cognitive, emotional, motivational and autonomic/endocrine parts, plus inhibitory regions
(medial OFC, temporal cortex) whose activity falls as arousal rises (Stoléru et al. 2012).

### 5.3. Time course

| Stage | Time | Brain events |
|---|---|---|
| Anticipation | seconds to minutes before contact | Mesolimbic firing rises in anticipation of reward in general [G Mesolimbic_pathway.md L39]; NAcc dopamine rises before copulation (rat; Pfaus et al. 1990; Damsma et al. 1992); with visual sexual cues, hypothalamus, amygdala, insula, ACC and ventral striatum engage (human fMRI/PET; Stoléru et al. 2012) |
| Stimulation (excitement → plateau) | minutes | Sensory cortex, S2, posterior insula and claustrum ↑ (sex differences in this phase, §5.2); inhibitory and vigilance regions start to fall; plasma oxytocin shows a modest, inconsistent rise (§6); pain threshold raised during vaginal self-stimulation (women; Whipple & Komisaruk 1985) |
| Approach | last ~10–60 s | Coordinated rise in NAcc, insula, ACC, OFC, hypothalamus, VTA, dorsal raphe and cerebellum (fMRI, women; Wise et al. 2017) |
| Orgasm | ~10–30 s | Peak across reward, sensory, motor, limbic and brainstem regions; lateral OFC and temporal ↓ (PET); larger elevation of the pain threshold at orgasm (women; Whipple & Komisaruk 1985); spinal ejaculation generator fires (rat; human counterpart unknown) |
| Post-orgasm | 0–5 min | Regional activity falls from the peak; oxytocin peaks at or within ~1 min after orgasm (Carmichael et al. 1987; Blaicher et al. 1999, limited by sampling) and then declines; NAcc dopamine stays raised after a single ejaculation in rats and declines only with satiety after repeated ejaculations (Fiorino, Coury & Phillips 1997); a short post-ejaculatory dip via lateral-hypothalamic serotonin is proposed (Lorrain et al. 1999); no human data |
| Resolution / refractory | 5–60+ min | Prolactin raised; ventrolateral PAG quiescence is a speculative substrate (animal stimulation studies); imaging of the refractory brain is almost absent |

### 5.4. Spinal cord

| Pathway | Segments | Carries | Role |
|---|---|---|---|
| Pudendal nerve | S2–S4 | sensation from clitoris/penis and perineum; motor to bulbospongiosus and ischiocavernosus (Onuf's nucleus) | rhythmic expulsion / contraction train |
| Pelvic splanchnic nerves | S2–S4 (parasympathetic) | sensation from vagina, cervix and rectum; from prostate and bladder neck in male anatomy | vasocongestion, erection, lubrication |
| Hypogastric nerve | T10–L2 (sympathetic) | sensation from uterus and cervix; from prostate, seminal vesicles and vas deferens in male anatomy | emission, bladder-neck closure |
| Vagus nerve | cranial X → nucleus of the solitary tract | sensation from cervix and uterus, bypassing the cord (hypothesis in humans) | possibly genital sensation after complete SCI (very small n) |

Pathway table: Komisaruk, Beyer-Flores & Whipple 2006 [T, H]; vagal route (a hypothesis in
humans) from Komisaruk et al. 2004, Whipple, Gerdes & Komisaruk 1996 and Cueva-Rolón et al. 1996
(rat vagotomy).

- **Spinal generator.** In male rats, galanin-expressing lumbar spinothalamic (LSt) neurons at
  L3–L4 are necessary for ejaculation (Truitt & Coolen 2002). A human counterpart and a female
  equivalent are not identified.
- **Descending inhibition.** The urethrogenital reflex is a spinal rhythmic pattern in both sexes
  of rat, studied in anaesthetised, spinalised animals. It is normally held back by descending
  inhibition from the nucleus paragigantocellularis (partly serotonergic) and is released when the
  cord is cut (Marson & McKenna 1990; McKenna, Chung & McVary 1991). As a hypothesis for the
  ejaculatory reflex, orgasm can be read as **a spinal rhythm that the brain normally keeps in
  check**. Orgasm from imagery alone (below), and orgasm reported by a few women with clinically
  complete SCI, possibly carried by vagal afferents from the cervix (NTS activation in fMRI, very
  small n; Komisaruk et al. 2004; rat: Cueva-Rolón et al. 1996), suggest that a disinhibited spinal
  reflex cannot be the whole account. Clinically "complete" lesions can spare some pathways, so
  the vagal route remains a hypothesis.
- **SSRIs** delay orgasm in all sexes, consistent with a net serotonergic brake (§6). The site of
  action (spinal, supraspinal or both) and the role of receptor adaptation are unresolved. A
  receptor-subtype hypothesis is set out by Waldinger et al. 1998, and the acute effect of
  on-demand dapoxetine (Pryor et al. 2006) shows that adaptation is not always needed.
- **Spinal cord injury.** About half of women with SCI reached orgasm in the laboratory. The
  chance is lowest when sacral reflexes are abolished (Sipski, Alexander & Rosen 1995; Sipski et
  al. 2001). Orgasm is also reported by a substantial minority of men with SCI, often without
  antegrade ejaculation, and complete sacral lesions reduce the likelihood ([T], L).
- **Imagery alone** can produce orgasm with BP, HR, pupil and pain-threshold changes comparable to
  genital stimulation (Whipple, Ogden & Komisaruk 1992; 10 self-selected women who reported this
  ability, so the result does not generalise).
- **Autonomic dysreflexia.** With lesions at or above about T6, stimulation can trigger sudden BP
  spikes [T].
- **PAG motor route.** In cats, the PAG drives mating posture and vocalization through the
  nucleus retroambiguus onto lumbosacral motoneurons, including Onuf's nucleus (VanderHorst &
  Holstege 1997; Holstege & Huynh 2011). This is proposed as a final common pathway.

### 5.5. What this means for the model

1. **Threshold, then a train (hypothesis).** In male rats, ejaculation depends on a lumbar
   generator held in check by the brainstem (nPGi); a human counterpart and a female equivalent
   are not identified (§5.4). The model borrows only the abstract shape: orgasm starts when
   arousal crosses θ, a short onset window follows, and the contraction train then runs its
   course. The onset window is a profile parameter (§7.4). It is irreversible, about 2.5 s, only
   in the emission (ejaculatory) setting, which matches the documented point of inevitability
   (§3.3); otherwise it is shorter and interruptible, because no comparable point of no return is
   documented for other bodies. Both choices are design assumptions. The "spinal rhythm under
   brain control" framing is kept as a hypothesis for the ejaculatory reflex only, since orgasm
   also occurs from imagery alone (Whipple, Ogden & Komisaruk 1992) and is reported by a few women
   after clinically complete SCI, possibly via vagal afferents (itself a hypothesis; very small n;
   Komisaruk et al. 2004).
2. **"Letting go."** Lateral OFC and temporal cortex showed reduced blood flow at orgasm in PET
   (Georgiadis et al. 2006) but not in fMRI (Wise et al. 2017). The galaxy has no counterpart for
   evaluative cortex. The HUD fade to minimum opacity during the orgasm phase (§8.3) is an
   **interface** metaphor for this contested finding.
3. **Build and decline.** In one fMRI study of 10 women, activity rose to orgasm and fell
   afterwards (Wise et al. 2017). The model's gradual build and faster post-orgasmic decline are
   model choices that are consistent with this, not measured rates.
4. **One generator for every body (assumption).** PET finds broadly similar brain activity at
   orgasm in women and men (Georgiadis et al. 2009), which says nothing about spinal generators.
   For simplicity, the model uses one generator with per-profile timing for every body.

### 5.6. Open questions

- Prefrontal deactivation (PET) vs activation (fMRI).
- Whether NAcc activity encodes pleasure or motivation.
- What the cerebellar activation means.
- The human counterpart of the rat generator, and a female equivalent.
- The PAG's role in humans, which is inferred from cats. The graph has no edge from PAG or VTA to
  the Orgasm node.

---

## 6. Neurochemistry

| Substance | Source / site | Role in the cycle | Rise | Peak | Decay (plasma t½) | Evidence | Model variable |
|---|---|---|---|---|---|---|---|
| **Dopamine** | VTA → nucleus accumbens (mesolimbic, part of the medial forebrain bundle); MPOA; TIDA | *Wanting* / incentive salience, anticipation; MPOA dopamine supports genital reflexes; activates PVN oxytocin neurons; inhibits prolactin | phasic transients 1–3 s on cues; tonic rise over 5–20 min | anticipation and copulation; timing relative to the climax is unresolved: microdialysis (5–10 min bins) cannot resolve the climax, and sub-second voltammetry (Robinson et al. 2001, male rats) links phasic accumbal transients mainly to the female's presentation and to approach (details to be checked against the paper; M); no human data | tonic elevation persists across early ejaculation series and declines with satiety (Fiorino, Coury & Phillips 1997); a post-ejaculatory dip is proposed from lateral-hypothalamic serotonin (Lorrain et al. 1999); a novel partner restores it (Coolidge effect) | [G Mesolimbic_pathway.md L23–L39; Nucleus_accumbens.md L41, L53; Prolactin.md L40]; male rats: Pfaus et al. 1990; Damsma et al. 1992; Robinson et al. 2001; Fiorino, Coury & Phillips 1997; Hull et al. 1995; Lorrain et al. 1999; female rats, paced mating: Mermelstein & Becker 1995; reviews: Argiolas & Melis 2005; Berridge & Robinson 1998. Human evidence only indirect (Holstege et al. 2003; Weintraub et al. 2010) | D (its post-orgasmic suppression in §7.4 is an assumption) |
| **Oxytocin** | PVN/SON → posterior pituitary; PVN → lumbosacral cord | smooth-muscle contraction (uterus, reproductive tract); positive feedback documented in parturition and lactation; during orgasm only a correlation between oxytocin level and contraction intensity is known (Carmichael et al. 1994); bonding (voles) | modest and inconsistent rise during arousal (Carmichael et al. 1987; not seen in men by Murphy et al. 1987) | main rise at orgasm/ejaculation, both sexes; peak at or within ~1 min after orgasm (Carmichael et al. 1987; Blaicher et al. 1999, whose first post-orgasm sample at ~1 min limits the timing) | t½ ~3–5 min; near baseline by ~30 min | [G Oxytocin.md L73, L75] (L75's "similar process during sexual activity" generalises from parturition and lactation); Carmichael et al. 1987, 1994; Murphy et al. 1987; Blaicher et al. 1999; Wakerley & Lincoln 1973 (milk-ejection reflex, lactating rat: analogy only); [T] t½ | O |
| **Prolactin** | anterior pituitary, under tonic dopamine inhibition | marker of satiety; associated with the male refractory period, but the similar rise in women, who often have no obligatory refractory period, argues against prolactin causing refractoriness on its own; cause disputed | **no rise with arousal alone**; rises after orgasm in both sexes (Exton et al. 1999, 2001) | within minutes of orgasm, then a plateau; the post-orgasmic increase is ~400 % greater after intercourse than after masturbation (pooled small samples; Brody & Krüger 2006) | still raised at ~60 min, the end of sampling (Krüger et al. 1998, 2002); t½ ~20–50 min | [G Refractory_period_sex.md L25, L29; Prolactin.md L34, L40]; Krüger et al. 1998, 2002, 2003; Exton et al. 1999, 2001; Brody & Krüger 2006; Haake et al. 2002 (single case: no rise in a multi-orgasmic man); against a causal role: Valente et al. 2021 (mice) | R (HUD marker; no causal input, §7.4) |
| **Endogenous opioids** | PAG, MPOA, NAcc / ventral pallidum hotspots | *liking*, hedonic impact, analgesia, relaxation | around the climax (assumed) | analgesia peaks near orgasm: the pain threshold rose at orgasm (Whipple & Komisaruk 1985; women, vaginal-stimulation-induced). Opioid and PAG mediation is inferred from animal work; in rats, analgesia from vaginocervical stimulation is only partly reversed by naloxone [T] | unknown in humans. The capture links endorphins to relaxation in the resolution phase [G Orgasm.md L23], which the slow decay of Ψ (§7.4) reflects | [G Orgasm.md L23; Periaqueductal_gray.md L34–L44]; Whipple & Komisaruk 1985; Coolen et al. 2004; Agmo & Berenfeld 1990; Paredes & Martínez 2001; Berridge & Kringelbach 2015; human naloxone data conflict (Murphy et al. 1990 vs Goldstein & Hansteen 1977) | Ψ |
| **Serotonin** | raphe and nPGi (descending); lateral hypothalamus | net inhibitory effect of increased 5-HT on ejaculation, mediated mainly by 5-HT1B/2C receptors, while 5-HT1A stimulation (e.g. 8-OH-DPAT) can facilitate it (rat); post-ejaculatory satiety (5-HT up, NAcc dopamine down) | after orgasm (rat lateral hypothalamus) | post-ejaculatory interval | unknown in humans | Lorrain et al. 1997, 1999; Marson & McKenna 1990; Waldinger et al. 1998 (review, including receptor subtypes); Pryor et al. 2006; Montejo et al. 2001 | part of I |
| **Noradrenaline / adrenaline** | sympathetic nerves, adrenal medulla | HR and BP rise; emission (α1) | rises progressively through arousal (both sexes) | at orgasm (~2–3×), with HR and BP | t½ ~1–3 min; baseline within ~2–10 min | Krüger et al. 1998; Exton et al. 1999; Wiedeking, Ziegler & Lake 1979; [T] t½ | N (with σ) |
| **Vasopressin** | PVN/SON | arousal phase (men); pair bonding via V1a in ventral pallidum (voles) | during arousal (men) | before ejaculation | Murphy et al. 1987 found AVP raised during arousal but not significantly above baseline at ejaculation. Given AVP clearance (t½ roughly 10–20 min [T, L]; estimates vary, about 5–35 min), this suggests that secretion falls before ejaculation, but coarse sampling and statistical power (n = 13) limit the inference. The model's V time course (secretion stops when the generator fires, then clearance over ~10–30 min) is an assumption | Murphy et al. 1987; Winslow et al. 1993; Lim et al. 2004; Young & Wang 2004 | V (HUD only) |

**Kinetic cascade.** This is a synthesis, not a single study: fast signals at the peak, slow
signals in the afterglow.

```
catecholamines   ▁▂▃▄▅▇█▃▁            spike at orgasm, gone in minutes        (t½ 1–3 min)
oxytocin         ▁▁▁▁▂▃█▇▆▅▄▃▂▁        peak at or within ~1 min after orgasm, ~10–30 min tail  (t½ 3–5 min)
opioid tone      ▁▁▁▁▂▃█▇▇▆▅▄▃▂▁       climax, tens of minutes (assumed)
prolactin        ▁▁▁▁▁▁▃▆██████▆▄▂▁    only after orgasm, both sexes, ≥ 60 min (t½ 20–50 min)
dopamine         ▂▄▅▆▇█▇▇▇▇▆▆▅▅▅▅      rises before the climax column; timing at climax unresolved;
                                       stays near plateau after one ejaculation (rat) and declines
                                       only with satiety after repeated ones; the model's
                                       post-orgasmic fall of D (§7.4) is an assumption, not drawn here
refractory I     ▁▁▁▁▁▁█▇▆▅▄▃▂▁        minutes to days (individual, age)
```

Columns are schematic; the orgasm is the seventh column, where the catecholamines peak.

**Caveats.**

- Peripheral oxytocin assays are often invalid (McCullough, Churchland & Mendez 2013), and the
  arousal-phase oxytocin secretion term in §7.4 is weakly supported.
- No study shows an oxytocin bolus with each contraction, so the model has none.
- Human dopamine and serotonin at orgasm have never been measured directly. Every direct dopamine
  measurement above except Mermelstein & Becker 1995 (female rats) is from male rats; human
  evidence (Holstege et al. 2003; Weintraub et al. 2010) is indirect. The post-orgasmic
  suppression of D in §7.4 is an assumption.
- Whether prolactin *causes* refractoriness is unresolved, so the model uses R only as a marker
  (HUD and recovery timing), never as a cause (§7.4, §8.2 #8).
- The capture's claim that an oxytocin surge is "chiefly responsible" for the male refractory
  period [G Refractory L25] rests on thin evidence.
- The peripheral seminal-vesicle feedback theory [G L27] is marked citation needed.
- Bonding effects are shown in voles and not established in humans.

---

## 7. Unified dynamic model

### 7.1. Design principles

- **One continuous arousal variable** with an operational plateau band. Felt and genital arousal
  are two coupled signals (§3.1).
- **Positive feedback** through D (incentive motivation) carries arousal to a steady state above
  threshold. The tuned model rises steadily and then more slowly toward that state (§7.4); it does
  not reproduce an accelerating final rise, which is a simplification. **Dual control** lets one
  inhibitory cue collapse arousal, and inhibition propensity also slows the build.
- **A threshold, then a train.** Orgasm starts at a threshold and the contraction train runs its
  course, a design abstraction of the rat ejaculation generator (§5.5). Whether the short onset
  window before the train can be cancelled is a profile parameter.
- **Fast and slow afterglow channels** follow the measured kinetic cascade (§6).
- **Refractory inhibition** gates stimulation. It is a continuous, individual parameter that can
  be zero.
- All human dynamics integrate in **human time** t. The renderer's own physics (orbits, cluster
  ageing, ring gas, the AGN light curve, knot motion, ionization fronts, light-travel delays)
  integrates in **astrophysical time**. The model only sets the renderer's parameters. Every
  human variable that drives a galaxy quantity passes through a physical response time in astro
  time first (low-pass filters for G, M and D; listed per renderer input in §8.1), and jet
  quantities are set at the nucleus and then travel at the jet speed, so nothing in the galaxy
  changes instantly when the astro clock runs at kyr/s.

### 7.2. Inputs and individual parameters

| Symbol | Meaning | Range | Default | Basis |
|---|---|---|---|---|
| S(t) | stimulation input (user hold / slider / demo script), smoothed to S̃ with τ = 1 s | 0–1 | — | physical or mental trigger [G Orgasm.md L25, L41] |
| X(t) | inhibitory cue (the "distraction" control), decays with τ_X = 20 s | 0–1 | 0 | dual control |
| e | excitation propensity (SES) | 0–1 | 0.5 | Bancroft & Janssen 2000 |
| s | inhibition propensity (SIS) | 0–1 | 0.5 | Bancroft & Janssen 2000 |
| κ | felt–genital concordance | 0.2–0.7 | 0.45 | Chivers et al. 2010 (means 0.26 / 0.66) |
| ρ | desire mode: 0 = responsive (Basson), 1 = spontaneous (Kaplan) | 0–1 | 0.5 | Basson 2000; Kaplan 1979 |
| q | orgasm intensity | 0–1 | 0.5 (±15 % random per cycle) | contraction counts 3–15; the default deliberately sits in M&J's intense band (9 pulses, §7.5) |
| Δ₀ | initial contraction interval | 0.6–0.9 s (0.9 s bound: design) | 0.8 s | §4.5 (M) |
| pattern | contraction-interval pattern: M&J (constant initial interval, then lengthening) or EMG-like (lengthening from the first interval) | M&J / EMG-like | M&J | §4.5, §7.5 |
| T_pre | onset window before the first pulse (human time) | 0–3 s | 1.5 s | §3.3, §4.5, §4.7 |
| u_pre | onset window irreversible (emission setting: T_pre ≈ 2.5 s, cannot be cancelled) | off / on | off | emission in bodies with a prostate and seminal vesicles (§4.7); design assumption |
| I₀ | refractory depth (≥ 0.08 means an obligatory refractory period) | 0–1 | 1.0 | [G Refractory L19, L29] |
| T_ref | refractory duration (log slider): the time after the orgasm at which I falls below 0.08 and orgasm becomes possible again; arousal must then still rebuild (≈ 9 min with defaults) | 10 s – 24 h | 15 min (young-adult low end; a mid-adult value is ~30–60 min, [T], L) | [G Refractory L33], hedged "according to some studies", order of magnitude only (L). With I₀ ≥ 0.08 even the low end needs a full rebuild; near-absent refractoriness (case reports, §3.3) is the I₀ < 0.08 setting |
| f | flush propensity | 0–1 | 0.6 | prevalence 25–75 % |
| env | cardiovascular envelope: typical (HR from study means, BP from the means of one study, RR a design estimate) or upper range (M&J individual extremes) | — | typical | §4.1 |
| age factor | slows G rise (τ_G × (1 + 4·age), up to ×5), lowers q, lengthens T_ref | 0–1 | 0 | §3.4 |

### 7.3. State variables

| Variable | Meaning | Range |
|---|---|---|
| A | central (felt) arousal | 0–1 |
| G | genital / peripheral vasocongestion | 0–1 |
| D | dopaminergic drive (wanting) | 0–1 |
| ν, σ | parasympathetic genital outflow; sympathetic tone | 0–1 |
| M | myotonia | 0–1 |
| N | plasma catecholamines (1 = typical orgasm peak) | 0–~1.2 |
| O | plasma oxytocin (1 = typical orgasm peak) | 0–~1.3 |
| R | prolactin (1 = typical post-orgasm plateau); a marker for the HUD and the recovery timing, with no causal input | 0–~1.5 |
| Ψ | opioid / hedonic tone (HUD only) | 0–1 |
| Ω | orgasm envelope (generator output; design abstraction) | 0–1 |
| C(t) | contraction pulse train | 0–1 |
| I | refractory inhibition | 0–1 |
| H | post-orgasmic hypersensitivity | 0–1 |
| F | sex flush | 0–1 |
| V | vasopressin (HUD only) | 0–1 |
| HR, RR, SBP/DBP | derived vital signs | bpm, /min, mmHg |

### 7.4. Equations

Each step uses first-order dynamics, integrated once per frame with dt = k_h · dt_screen
(§7.7). The constants below were re-tuned and checked by numerical integration (dt = 0.05 s,
deterministic run with η = 0). With default parameters and continuous effective stimulation,
A reaches the plateau band (0.75) at ≈ 5.9 human minutes and θ = 0.85 at ≈ 8.1 min. The
trajectory and the other checks follow the equations. (The earlier constants, τ_A = 120 s, γ = 3,
λ = 0.10 with a two-way G coupling and θ = 0.92, settled at A* ≈ 0.87 < θ, so the climax depended
on noise alone.) The refractory terms and the satiety gate were corrected after a second
re-integration (the refractory drain now stops at I < 0.08, and prolactin no longer gates D or the
ring refill); the first build is unchanged, and the post-orgasmic checks below use the corrected
terms.

```
Effective stimulation (refractory and hypersensitivity gate it)
  S_eff = S̃ · (1 − I) · (1 − 0.9·H)

Central arousal: self-amplifying drive, dual control, upward genital feedback
  dA/dt = (1/τ_A)·[ e·S_eff·(1 + γ·D)·(1 − A) − (λ + λ_s·s + a_H·S̃·H)·A ]
          + κ·S_eff·max(0, G − A)/τ_c                (genital feedback: raises A only, only while stimulated)
          − A·[ s·X/τ_inh + (1 − S̃)/τ_off + max(0, I − 0.08)/τ_R ]
                                    (inhibitory cue; stimulation withdrawn; refractory decline,
                                     which stops once I < 0.08, i.e. at T_ref)
  τ_A = 600 s, γ = 5, λ = 0.03, λ_s = 0.15 (baseline inhibition: SIS acts without a cue),
  a_H = 0.5, τ_c = 60 s, τ_inh = 20 s, τ_off = 180 s, τ_R = 90 s
  A is not integrated during ONSET and ORGASM; there it changes only by the per-pulse discharge.
  There is no hard ceiling on A: refractoriness acts through S_eff, the term max(0, I − 0.08)·A/τ_R
  and the gate.
  A_obs = clamp(A + η, 0, 1),  η = Ornstein–Uhlenbeck level noise, correlation time 20 s, sd 0.03
  (arousal "waves"). A_obs drives the phase thresholds, the stochastic ring-SFR modulation and
  the readouts; A drives the dynamics.
  Autonomic arousal: â = min(1, max(A/θ, Ω))   (keeps the sympathetic peak through the train)

Genital vasocongestion (parasympathetic, NO), inverted-U sympathetic effect
  ν = clamp( κ·A + (1 − κ)·e·S_eff , 0, 1 ) · u(σ),   u(σ) = 1 + 1.2·σ·(0.6 − σ)
  dG/dt = (ν − G)/τ_G,   τ_G = 20 s · (1 + 4·age)
  After orgasm (two-stage, design values; the first stage stands for detumescence to about
  1.5× flaccid size [G HSRC L79]): G → 0.5·G_peak with τ = 60 s, then → 0 with τ = 10 min
  (stage 2 starts when I < 0.5 or 5 min after orgasm); effective new stimulation can raise G again
  No orgasm (stimulation withdrawn from PLATEAU): G → 0 with τ = 45 min      (persists for hours)

Dopaminergic drive (anticipation or responsive), suppressed by satiety (assumption, §6)
  Q  = I            (satiety gate; prolactin R is not used, because its causal role is unresolved, §6)
  D* = (1 − 0.85·Q) · clamp(0.2 + 0.6·[ρ·S̃ + (1 − ρ)·A] + 0.2·A, 0, 1)
  dD/dt = (D* − D)/τ_D,   τ_D = 30 s;  + 0.1 phasic transient (τ = 2 s) at each stimulation onset

Autonomic tone
  σ* = 0.10 + 0.55·â² + 0.35·Ω
  dσ/dt = (σ* − σ)/τ_σ,  τ_σ = 10 s rising (3 s while Ω > 0.5), 60 s falling
  dM/dt = (â^1.5 + 0.3·Ω − M)/τ_M,  τ_M = 30 s rising, 60 s falling

Catecholamines (t½ ≈ 2 min)
  dN/dt = (σ + 0.5·Ω − N)/τ_N,  τ_N = 30 s rising, 173 s falling

Oxytocin (secretion and clearance; the arousal-phase term is weakly supported, §6)
  dO/dt = 5e−4·A + 0.03·Ω − O/τ_O,   τ_O = 350 s (t½ ≈ 4 min)
  No per-contraction bolus: no study shows one (only a correlation with contraction intensity,
  Carmichael et al. 1994).

Prolactin (orgasm-specific marker; closed form after each orgasm end t_e, accumulates over
orgasms; used only for the HUD and the RECOVERY → BASELINE timing, never as a cause)
  R(t) = c_ctx · [1 − e^(−(t − t_e)/5 min)] · e^(−max(0, t − t_e − 30 min)/40 min)   (decline t½ ≈ 28 min)
  c_ctx = 0.3 + 0.7·I₀   (smaller rise without an obligatory refractory period; evidence n = 1,
                          Haake et al. 2002)

Opioid tone (human kinetics unmeasured: design assumption; HUD only, §8.2 #11)
  dΨ/dt = 0.025·Ω − Ψ/τ_Ψ,   τ_Ψ = 15 min   (peak ≈ 0.8–0.9 for a default orgasm)

Vasopressin (arousal-phase rise reported in men; HUD only; amplitude is a parameter, default 0.5)
  dV/dt = (0.6·A·(1 − Ω) − V)/τ_V,   τ_V = 60 s rising, 20 min falling (t½ ≈ 14 min)
  (assumption: secretion stops when the generator fires; plasma then declines over ~10–30 min, §6)

Refractory inhibition and hypersensitivity
  During the train: at each pulse k, I ← I + (I_tgt − I_start)·a_k / Σa,  I_tgt = max(I, I₀),
  so I rises in step with the discharge of A and reaches I_tgt at the orgasm end t_e
  After t_e: I(t) = I_tgt · e^(−(t − t_e)/τ_I),  τ_I = T_ref / ln(I₀ / 0.08) for I₀ > 0.08, else 20 s
  (so I < 0.08, the gate opens and the drain on A stops at exactly T_ref after t_e)
  H(t) = e^(−(t − t_e)/τ_H),   τ_H = 120 s   (hypersensitivity duration poorly quantified: assumption)

Sex flush (HUD only, §8.3)
  F* = f · smoothstep(0.7, 1.0, â) + 0.2·f·Ω
  dF/dt = (F* − F)/τ_F,  τ_F = 30 s rising, 5 min falling

Vital signs (envelope "typical": HR_pk = 125 (study means), ΔSBP = 45 and ΔDBP = 8 (study means
             of Nemec et al. 1976, L–M), ΔRR = 13 (design, scaled like HR, L);
             "upper range (M&J individual extremes)": HR_pk = 180, ΔSBP = 100, ΔDBP = 50, ΔRR = 26)
  h   = clamp(0.3·â + 0.7·σ, 0, 1)
  HR  = HR_0 + (HR_pk − HR_0)·h,   HR_0 = 68 bpm
  RR  = 14 + ΔRR·h, with brief breath-holds while Ω > 0.8 (duration a design value, [T])
  SBP = 115 + ΔSBP·h,   DBP = 75 + ΔDBP·h
```

**Deterministic build** (defaults, S = 1 from t = 0, η = 0):

| t (min) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 0.19 | 0.38 | 0.51 | 0.61 | 0.69 | 0.76 | 0.81 | 0.85 | 0.90 | 0.95 |
| G | 0.34 | 0.45 | 0.54 | 0.59 | 0.63 | 0.64 | 0.65 | 0.64 | 0.65 | 0.68 |
| D | 0.51 | 0.64 | 0.72 | 0.78 | 0.83 | 0.86 | 0.89 | 0.91 | 0.94 | 0.97 |

The steady state under continued stimulation is A* ≈ 0.96, above θ, so θ is crossed
deterministically. A(6 min) ≈ 0.76 and A(8 min) ≈ 0.85 = θ.

**Check against the data** (defaults, simulated):

- **Threshold timing.** With the level noise, the gate (A_obs ≥ θ for 0.5 s) opens at a median of
  7.4 min (10–90 %: 6.8–8.2 min; 300 runs), slightly earlier than the deterministic 8.1 min.
  Changing κ from 0.2 to 0.7 shifts the crossing by less than 0.3 min, so higher concordance no
  longer makes θ harder to reach. s = 0.8 delays it to 8.5 min, e = 0.3 to 14.9 min, and the rapid
  profile crosses at 2.7 min.
- **Heart rate, respiration and BP.** Plateau h ≈ 0.63–0.75 gives HR ≈ 104–111 bpm. At the end of
  the train h ≈ 1.0, so HR ≈ 125 bpm (typical envelope; study means 110–127 in the laboratory and
  117 at home). RR is ≈ 22–24/min in plateau and ≈ 27/min at the peak (design), and BP peaks at
  ≈ 160/83 mmHg (compare ~160/80 in Nemec et al. 1976, L–M).
- **After the train** A falls from A_res = 0.35 with τ ≈ 60 s and never rises during the
  refractory period (0.14 at +1 min, 0.06 at +2 min). Two minutes after the first pulse σ ≈ 0.31
  and h ≈ 0.24, so HR ≈ 82 bpm (85 measured; Hellerstein & Friedman 1970).
- **Oxytocin.** O is ≈ 0.08 just before the climax (a modest arousal-phase rise) and peaks at
  ≈ 1.0 about 50 s after the orgasm phase ends (compare Blaicher et al. 1999). It is ≈ 0.5 at
  +5 min and ≈ 0.1 at +15 min, near baseline by ~30 min.
- **Prolactin and refractoriness.** R peaks at 30 min, is ≈ 0.47 at 60 min (decline t½ ≈ 28 min)
  and falls below 0.2 at ≈ 95 min. I falls below 0.08 at 15 min (= T_ref).
- **Refractory interval** (re-integrated, dt = 0.05 s, η = 0). With stimulation withdrawn after
  the orgasm and resumed at T_ref = 15 min, θ is reached again 8.8 min later (23.8 min after t_e),
  close to the 8.1 min of the first build, so T_ref sets when orgasm becomes possible and the
  rebuild adds the usual build time. With T_ref = 10 s and stimulation held from t_e, θ comes 8.8
  min after t_e, because hypersensitivity and the reset to A_res = 0.35 dominate. The earlier
  terms (drain I·A/τ_R, which stayed about four times the baseline loss at I = 0.07, and
  Q = max(I, R), which kept D suppressed for ~95 min whatever T_ref) gave 41.6 min and 21 min, so
  the refractory interval was then set mainly by prolactin and the tail of I, not by T_ref.

**Orgasm trigger and discharge.**

- **Gate.** An orgasm can begin when A_obs ≥ θ = 0.85 for 0.5 s and I < 0.08.
- **Onset window (ONSET phase).** For T_pre human seconds (0–3 s, default 1.5 s), Ω rises from 0
  to 1. With the emission setting (u_pre on, T_pre ≈ 2.5 s) it **cannot be cancelled**; this
  represents the emission phase in bodies with a prostate and seminal vesicles (§3.3, §4.7).
  Otherwise it is interruptible: if stimulation is released (S̃ < 0.5) during the window, Ω
  decays with τ = 2 s and the phase returns to PLATEAU, while the clock ramps back up and the
  nucleus returns to L_q over 2.5 s (§9.2, §9.4). Both rules are design assumptions. On
  screen, ONSET always lasts 2.5 s, the photosensitivity floor for the AGN rise and the clock
  ramp, so k_h = T_pre / 2.5 s during it (physiology paused when T_pre = 0).
- **Train.** The contraction train (§7.5) runs at Ω = 1. Each pulse k discharges arousal,
  A ← A − δ_A·a_k, with δ_A chosen so that A reaches A_res = 0.35 + 0.45·(1 − I₀) by the end of
  the train, while I rises in step (above). That is 0.35 for an obligatory refractory profile and
  ≈ 0.78 when I₀ = 0.05 (pattern A: arousal stays at or above plateau level).
- **Decay.** After the last pulse, Ω decays with τ = 20 s, and A relaxes from A_res (τ ≈ 60–90 s
  while I is high; τ_off alone, 180 s, when I₀ ≈ 0 and stimulation stops).

### 7.5. Contraction pulse train

```
N      = round(3 + 12·q)                    regular pulses: 3–15 (default 9, deliberately intense)
n_reg  = 3 + floor(3·q)                     pulses at the initial interval: 3–6 (default 4)
Δ₀     = initial interval, individual 0.6–0.9 s (default 0.8 s, the classic M&J value;
         the 0.9 s upper bound is a design value)
Δ_k    = Δ₀                                 for k ≤ n_reg
Δ_k    = Δ₀ · 1.08^(k − n_reg)              for k > n_reg   (design fit: intervals lengthen)
EMG-like option (pattern = EMG-like): n_reg = 1, Δ_k = Δ₀ + 0.1 s·(k − 1), Δ₀ ≈ 0.6 s
         (Gerstenberg, Levin & Wagner 1990, M; 9 pulses then span ≈ 7.6 s)
a_1 = a_2 = 1;   a_k = 0.82^(k − 2) for k ≥ 3          (design fit: first two strongest, then decline)
tail   = 0–3 minor pulses, amplitude 0.10–0.20, intervals 2–4 s with ±25 % jitter
onset  = optional sustained spasm before pulse 1 (individual, default off); when used, it fills
         the ONSET window, so T_pre is set to its duration (M&J: 2–4 s, capped at 3 s)
pulse shape p(t) = (t/t_r)·e^(1 − t/t_r),  t_r = 0.12 s   (peak at 0.12 s, FWHM ≈ 2.45·t_r ≈ 0.29 s)
C(t)   = Σ_k a_k · p(t − t_k)
```

The factors 1.08 and 0.82 are design fits to the qualitative description "intervals lengthen,
intensity falls" (Masters & Johnson 1966; [G HSRC L65]). No cited source gives them.

**The default is deliberately intense.** M&J give 3–5 contractions for a mild orgasm and 8–12 (up
to ~15) for an intense one, and in people with a prostate only 3–4 major expulsive contractions.
The linear mapping puts the mid-intensity default (q = 0.5) at 9 pulses, inside the intense band,
so that the rhythm reads clearly on screen; a mild orgasm of 3–5 pulses is q ≲ 0.17. In the
emission reading, the later pulses of the default train correspond to the minor contractions.

With the defaults (Δ₀ = 0.8 s), pulses fall at t = 0, 0.80, 1.60, 2.40, 3.26, 4.20, 5.21, 6.29
and 7.47 s, with amplitudes 1, 1, 0.82, 0.67, 0.55, 0.45, 0.37, 0.30 and 0.25. Minor pulses follow
at about 10 s and 13 s, and the orgasm phase ends at about 15 s. That matches the 3–15 s regular
train, the ~20 s felt duration and the EMG picture of ~10–15 bursts, most of them minor.

The 8–13 Hz component (van Netten et al. 2008; women, small laboratory sample) is **kept in the
model as an optional feature but never rendered as luminance flicker** (§10).

### 7.6. Phase machine

```
BASELINE ──► EXCITEMENT ──► PLATEAU ──► ONSET (T_pre; 2.5 s on screen) ──► ORGASM (train + tail, ~5–40 s; longer if Extended)
                 ▲             │  │                                              │
                 └─────────────┘  ▼                                              ▼
                       RESOLUTION_NO_CLIMAX                              RESOLUTION_EARLY (0–5 min)
                       (pattern B: G τ = 45 min,                                 ▼
                        ring burns gas, no AGN)                          RESOLUTION_LATE (5–30 min)
                                                                                 ▼
                                                                         RECOVERY ──► BASELINE
```

| From | To | Condition |
|---|---|---|
| BASELINE | EXCITEMENT | S_eff > 0.05 |
| EXCITEMENT | PLATEAU | A_obs ≥ 0.75 |
| EXCITEMENT | BASELINE | A < 0.03 and S̃ < 0.02 for 20 s |
| PLATEAU | ONSET | A_obs ≥ θ (0.85) for 0.5 s and I < 0.08 |
| PLATEAU | EXCITEMENT | A_obs < 0.7 with S̃ > 0.05 (arousal sagged, e.g. after a distraction cue X) |
| PLATEAU | RESOLUTION_NO_CLIMAX | S̃ < 0.05 for ≥ 60 s and A < 0.6 |
| ONSET | ORGASM | T_pre elapsed |
| ONSET | PLATEAU | stimulation released (S̃ < 0.5) while u_pre is off |
| ORGASM | RESOLUTION_EARLY | end of the train and tail (t_e) |
| RESOLUTION_EARLY | PLATEAU | S_eff > 0.05, I < 0.08 and A_obs ≥ 0.75 (pattern A; the clock ramps from its current rate to 4.8 Myr/s over 8 s, §9.2) |
| RESOLUTION_EARLY | RESOLUTION_LATE | 5 min after t_e |
| RESOLUTION_LATE | EXCITEMENT | S_eff > 0.05 and I < 0.08 (sequential peak) |
| RESOLUTION_LATE | RECOVERY | 30 min after t_e |
| RECOVERY | EXCITEMENT | S_eff > 0.05 and I < 0.08 |
| RECOVERY | BASELINE | I < 0.08 and R < 0.2 |
| RESOLUTION_NO_CLIMAX | EXCITEMENT | S_eff > 0.05 |
| RESOLUTION_NO_CLIMAX | BASELINE | G < 0.1 |

### 7.7. Clocks: what one screen second means

Every screen second carries **two labels**, both shown in the HUD:

- the human-equivalent duration k_h (human seconds per screen second), which the physiology
  integrates;
- the astrophysical duration k_a (years per screen second), which the renderer integrates.

| Phase | k_h (human s / screen s) | Default screen time | Human time | k_a (astro clock) | What the astro clock shows |
|---|---|---|---|---|---|
| Baseline | 10 | idle | — | 4.8 Myr/s | bar turns in ~31 s; quiet nucleus |
| Excitement | 10 | ~35 s | ~6 min | 4.8 Myr/s | ~170 Myr, about one bar rotation; inflow builds; ring SFR rises; first pearls |
| Plateau | 10 | ~14 s | ~2 min (shorter with noise) | 4.8 Myr/s | ~65 Myr: ring starburst at or just past its peak (b ≈ 4.7 → 4.6), ~2.5 ring orbits; stochastic ring-SFR modulation on ~10 Myr (≈ 2 s) |
| Onset | T_pre / 2.5 s (0–1.2) | 2.5 s | 0–3 s (default 1.5 s) | exponential ramp 4.8 Myr/s → 1 kyr/s | disk visibly freezes; nucleus ignites, rising over the whole 2.5 s |
| Orgasm | 1 (real time) | ~15 s (5–40; longer in the Extended profile) | ~15 s | 1 kyr/s | knots at Δ₀ ≈ 0.8 s ≈ 800 yr intervals; the jet head (the leading knot) reaches 1 kpc after ~4 s and the 2 kpc visible length after ~14 s; ionization fronts fill the near cone in 0–6.5 s and the far cone over ~4–20 s (observed delays, §9.4) |
| Early resolution | 20 | 15 s | 5 min | ramp 1 kyr/s → 4.8 Myr/s over the first 8 s, then 4.8 Myr/s | AGN fade and light echoes in the first ~2–4.5 s; the far cone finishes lighting early in the ramp; relic knots decelerate and fade before ~3 kpc; then ring SFR falls as its gas is used up (b ≈ 4.4 → 1.2 over the last ~9 s); Hα fades |
| Late resolution | 60 | 25 s | 25 min | ramp 4.8 → 10 Myr/s over 3 s, then 10 Myr/s | ring SFR falls below baseline (b ≈ 0.5 at 15 min after the orgasm, ≈ 0.4 at its minimum); blue fades; white A-star glow; with T_ref = 15 min the inflow resumes ~10 s in (I < 0.08) and the lanes darken again over ~20 Myr |
| Recovery | max(60, remaining / 20 s) | ≤ 20 s | until I < 0.08 and R < 0.2 (≈ 95 min after the orgasm with defaults) | 10 Myr/s | ring refilling by the bar (b ≈ 0.7 → 0.9); A-star glow warming |
| No-climax resolution | max(60, remaining / 30 s) | ≤ 30 s | until G < 0.1 (~1–1.5 h) | 10 Myr/s | ring keeps forming stars from the gas it holds; no AGN |

**Why these clocks.**

- During the build, 1 s = 10 human s and 4.8 Myr. One human excitement phase then spans about one
  bar rotation, and the plateau spans a circumnuclear starburst episode. Both lie inside the
  physical ranges in §2.4. Ignition comes ~235 Myr after stimulation starts (~185 Myr after the
  ring's SFR first exceeds 1.5× rest), inside the observed 50–250 Myr starburst-to-AGN range for
  the default run only (§2.2).
- The 20 s correlation of the arousal waves becomes 2 s on screen, ≈ 10 Myr, so η reads as
  stochastic modulation of the ring SFR on ~10 Myr timescales. It has no period and does not
  represent the physical 10–20 Myr cycle, a large-amplitude relaxation oscillation (Krumholz &
  Kruijssen 2015) that is not modelled.
- At the climax, 1 s = 1 human s, so the **contraction rhythm (Δ₀ ≈ 0.8 s) is shown in real
  time**, and 1 kyr. Knots ejected 0.8 s apart at 0.8c are about 0.2 kpc apart intrinsically. With
  retarded-time positions on (§9.3) and the jet at 30° to the line of sight, they appear about
  0.32 kpc apart in projection, move at 1.3c projected (≈ 0.40 kpc per screen second; 2.6c along
  the jet) and appear to reach 1 kpc along the jet in ~1.25 s. That is within a factor of two of
  the mean projected knot spacing of M87 (2.5″ ≈ 200 pc, §2.2), but the agreement is a coincidence
  of averages and is illustrative only: M87's knots are mostly quasi-stationary or slow shocks with
  irregular gaps, and the relativistic jet is itself a deliberately rare choice for a disk galaxy
  (§2.2).
- The clock ramps are exponential in log₁₀(yr/s), and every phase change has one (listed in
  §9.2), so there are no cuts. Integrating the early-resolution ramp gives elapsed astro time
  E(t) ≈ 943 · (4800^(t/8 s) − 1) yr. The 10⁴–10⁵ yr AGN fade and light echoes therefore play out
  about 2–4.5 s after the climax.
- One default cycle spans about 0.7 Gyr of astro time (≈ 170 + 65 + 1.4 Myr of build and onset,
  ~15 kyr of orgasm, ≈ 38 Myr of early resolution, ≈ 240 Myr of late resolution and ≤ 200 Myr of
  recovery).

**Default run: about 2 min of screen time per full cycle** (deterministic; simulated).

| Screen time | Event |
|---|---|
| 0 s | Stimulation starts |
| ~2 s | G at half its target |
| ~35 s | Plateau (A = 0.75) |
| ~49 s | θ crossed (deterministic; ~41–49 s with the level noise); ONSET |
| ~51.5 s | First pulse |
| ~67 s | Orgasm phase ends |
| ~82 s | Late resolution begins |
| ~92 s | With T_ref = 15 min: refractory ends (I < 0.08) and orgasm becomes possible again; with stimulation, a fresh build reaches θ ≈ 8.8 human min (≈ 53 s on screen at the build clock) later |
| ~107–127 s | Recovery (R < 0.2 at ≈ 95 human min) |

### 7.8. User stimulation and the refractory limit

- **Controls.** Hold the Stimulate control (pointer or Space), or set a level 0–1. A Distraction
  control pulses X. Demo mode plays a scripted S(t).
- **During the refractory period** S is multiplied by (1 − I), the term max(0, I − 0.08)·A/τ_R
  pulls A down, and the gate requires I < 0.08, so **no stimulation can produce a new orgasm until
  I < 0.08**, which happens exactly T_ref after the orgasm. Arousal must then rebuild (≈ 8.8 human
  min with defaults, §7.4).
- **Hypersensitivity.** Stimulation during H is mostly ineffective and slightly *lowers* A (the
  term a_H·S̃·H·A). This models post-orgasmic stimulation felt as uncomfortable rather than
  arousing, in all sexes [G Refractory L19, L23, L29].
- **HUD feedback.** While stimulation is gated, the HUD shows "refractory: x % — about mm:ss
  (human) remaining". The countdown is the time until the gate opens (T_ref after the orgasm); it
  does not include the rebuild. The galaxy shows the gate as the end of the inflow episode: lighter
  lanes and no refill of the ring's gas (§8).
- **No obligatory refractory** (I₀ < 0.08). Holding stimulation in early resolution returns
  straight to plateau from A_res ≈ 0.78. With default e the next peak follows about 1–3 human
  minutes later (median ≈ 1.9 min, 10–90 %: 1.1–2.6 min with the level noise, 150 runs; ≈ 2.7 min
  deterministic), between the serial and sequential ranges of §3.3; higher e shortens it (≈ 1.7
  min deterministic at e = 0.8). The clock ramps from 1 kyr/s back to 4.8 Myr/s over 8 s (§9.2),
  so the next peak comes ~1–45 Myr later in astro time (median ≈ 20 Myr). Each repeat peak is
  drawn as a fresh AGN and jet ignition within one 10⁷–10⁸ yr activity period (Schawinski et al.
  2015; Hickox et al. 2014). The earlier knots fade within seconds of the first peak, and a kpc jet
  cocoon would refill within a few Myr, so no older knot train or existing channel is drawn.

### 7.9. Profiles

Profiles are named by response pattern, never by sex, and each one only sets parameters.

| Profile | Settings | Basis |
|---|---|---|
| Single peak with refractory period, young adult (default) | I₀ = 1, T_ref = 15 min, q = 0.5, T_pre = 1.5 s (interruptible); emission setting optional (u_pre on: T_pre ≈ 2.5 s, irreversible) | Masters & Johnson single-peak pattern. T_ref = 15 min is the young-adult low end of the reported range ([G Refractory L33], hedged); a mid-adult value is ~30–60 min ([T], L), set with the slider, and the HUD always shows the human time |
| Multiple peaks possible | I₀ = 0.05, τ_H = 30 s (so A_res ≈ 0.78 and c_ctx ≈ 0.34) | pattern A; 14–43 % of women; some men; smaller prolactin rise (HUD only) per Haake et al. 2002 (n = 1) |
| Rapid rise, fast resolution | e = 0.8, τ_A × 0.5, faster G decay (θ at ≈ 2.7 min) | pattern C |
| Plateau without climax | e = 0.3, s = 0.8 (plateau at ≈ 11 min, steady A* ≈ 0.92) and the orgasm gate disabled; the demo withdraws stimulation after ~12 human min | pattern B; frustration [G HSRC L47]. e and s alone only slow the build (θ would be reached at ≈ 16 min), so the absent climax is a design device; its causes (type of stimulation, context, inhibition) are not modelled |
| Extended / multi-peak | N up to 15, slower interval growth (1.04), longer tail, so the orgasm phase may exceed 40 s; q-envelope with 2–3 maxima | status orgasmus (20 to >60 s, Masters & Johnson 1966); multiple-peak reports [G Refractory L35] |
| Older adult | age factor 0.8: τ_G × 4.2, q − 0.2, T_ref 8–20 h (order of magnitude, L; screen recovery capped at 20 s, so the galaxy shows only that the inflow stays gated through late resolution; the age dependence of the duration is shown in the HUD) | §3.4 |

In the About text, sex differences are given as overlapping population tendencies. Examples are
flush prevalence, the concordance means, and that an obligatory refractory period is more often
reported by men and multiple orgasms by women.

---

## 8. Mapping: physiology → galaxy → animation parameter

### 8.1. Mapping table

| # | Physiological / neural variable | Real galactic phenomenon | Animation parameter(s) |
|---|---|---|---|
| 1 | Genital vasocongestion **G** (blood inflow and pooling) | Bar-driven **gas inflow** along the leading-edge dust lanes, piling up at the nuclear ring | `inflow`: mass flux F_in = (g₀ + G)·r (r: reservoir gate, row 12), smoothed in astro time to F̂ (τ_in = 20 Myr, the gas crossing time of the bar); lane opacity τ_V = 0.1 + 1.2·F̂ (≈ 0.34 at rest, ≈ 1.5 at G = 1, 0.1 when the inflow has stopped) and lane sprite density ∝ F̂, at a fixed streaming speed set by the bar potential (~150 km/s); F̂ refills the ring gas `ringGas` m (equations below) |
| 2 | Central arousal **A** | **Circumnuclear starburst** in the ring (birthrate b) | `ringSFR`: b = ε·m/g₀ with efficiency ε = 1 + 4·Â² (Â = A smoothed in astro time); pearl spawn rate ∝ b at the two contact points |
| 3 | Concordance **κ** | Scatter in star-formation efficiency (gas → SFR) | `sfScatter`: how tightly the spawn rate follows b (scatter ±30 %·(1 − κ)) |
| 4 | Arousal waves **η** | Stochastic modulation of ring SFR on ~10 Myr timescales (the physical 10–20 Myr burst cycle is not modelled as an oscillator) | `ringSFRMod` (from A_obs) modulates spawn rate ±20 % |
| 5 | Dopaminergic drive **D** (anticipation, wanting) | Nuclear feeding channel inside the ring (nuclear dust spirals) and low-level AGN flicker | `nucFeed` = D̂·Ĝ (spiral opacity; D and G smoothed in astro time, τ = 20 Myr); `agnFlicker` amplitude ≤ 3 × 10⁻³ L_gal ∝ D·â⁴, as a slow random walk |
| 6 | Myotonia **M** | Shock strength in the bar lanes (narrower, sharper lanes) | `laneSharp`: lane width 0.012 → 0.006 units from M̂ (M smoothed in astro time, τ = 20 Myr) |
| 7 | Sympathetic discharge **σ / N** (sharpest, shortest peak) | **AGN accretion luminosity**: point source plus diffraction spikes near the peak | `agnLum`: L_AGN(t_a) = L_q + L_pk·(0.7 + 0.3·N_pk)·g(t_a): during ONSET log L_AGN rises linearly in screen time (§9.4); g holds at 1 through the train, then decays with e-folding 2 × 10⁴ yr in astro time; Ω and N set only the peak amplitude; spikes above 0.03 L_gal |
| 8 | Contraction pulse train **C(t)** | **Jet knot ejections** (disk–jet coupling) | `knots[]`: one knot per pulse, brightness ∝ a_k, spacing set by Δ_k and the knot speed; after the train the knots fade as relics with a fixed e-folding of 10 kyr in astro time (§9.3) |
| 9 | Oxytocin **O** (t½ 3–5 min) | none: HUD only (§8.2 #7, §8.3). The **ionization cones** ([O III] + Hα) and **light echoes** follow L_AGN (row 7) | `coneLum`(r, t_a) = L_AGN(t_a − r(1 − cos φ)/c) ⊗ recombination kernel (t_rec ≈ 10²–10⁴ yr); echo brightness = L_AGN history delayed by the light-travel time |
| 10 | Opioid tone **Ψ** (afterglow) | none: HUD only (§8.2 #11, §8.3) | — |
| 11 | Prolactin **R** (marker of satiety) | **Post-starburst (E+A) state**, likewise a marker: it emerges as the ring's star formation dies out once the inflow stops (row 12) and the burst population ages into a white A-star glow | none: R is not an input to the galaxy, because its causal role is unresolved (§6, §8.2 #8); the fade and colour drift are emergent |
| 12 | Refractory inhibition **I** | **End of a bar-inflow episode**: the nuclear gas reservoir is not refilled while I ≥ 0.08; inflow resumes as I falls below it | `reservoir` r = max(0, 1 − I/0.08) gates F_in (lanes and ring refill); it never removes existing ring gas, which is consumed over ~10–100 Myr |
| 13 | Sex flush **F** | none: HUD only (§8.2 #10, §8.3) | — |
| 14 | Multiple peaks | Fresh AGN and jet ignition ~1–45 Myr (median ≈ 20 Myr) after the previous one, within one 10⁷–10⁸ yr activity period (§7.8) | repeat of 7 and 8 |
| 15 | Plateau without climax | Ring starburst that never fuels a luminous AGN | 1–6 active, 7–9 never triggered |
| 16 | Phase | Astrophysical clock regime (observer's time-lapse) | `clock` (k_a), shown in the HUD |

**Ring gas and star formation** (integrated by the renderer in astro time t_a, in Myr):

```
r = max(0, 1 − I/0.08)                                    (reservoir gate; R is not used)
dF̂/dt_a = [ (g₀ + G)·r − F̂ ] / τ_in,   τ_in = 20 Myr          (inflow in transit along the bar)
dm/dt_a = [ F̂ − ε·m ] / t_dep,   g₀ = 0.2, t_dep = 100 Myr
ε = 1 + 4·Â²,   dÂ/dt_a = (A − Â)/τ_⋆,   τ_⋆ = 20 Myr         (assumed rise in burst efficiency)
b = ε·m / g₀                                                  (b = 1 at rest)
```

τ_⋆ keeps the burst from stopping faster than about a ring orbit (~26 Myr), although A itself
collapses within ~20 kyr of astro time after the climax, and τ_in makes the ring respond to the
inflow only after the gas has crossed the bar. With the defaults (simulated, dt = 0.05 human s),
the ring gas m peaks at ≈ 1.7× its rest value ~4 min into the build (b ≈ 3.7 then), so pile-up
comes first. b keeps rising to ≈ 4.7 in early plateau through the increase in ε, while m falls to
≈ 1.2× rest; at ignition b ≈ 4.6, about 40 Myr after its peak. The plateau starburst is therefore
mostly an efficiency effect. ε is an assumption: it could stand for the ring becoming
gravitationally unstable as gas accumulates (Krumholz & Kruijssen 2015).

After the climax b stays near 4.4 through the first ~6 s of early resolution, while little astro
time passes, then falls to ≈ 2.1 at +10 s and ≈ 1.2 at +15 s (≈ 38 Myr after the climax). It is
≈ 0.5 ten seconds into late resolution, when I falls below 0.08 with T_ref = 15 min and the inflow
resumes, reaches its minimum ≈ 0.4 a few seconds later, and is ≈ 0.7 at the start of recovery and
≈ 0.9 at its end. Without a climax (r = 1), b stays raised while G decays over ~1 h. In a second
cycle started at T_ref, the depleted ring re-forms a weaker starburst: b first exceeds 1.5 about
140 Myr after stimulation resumes and is ≈ 3.1 at the second ignition (~260 Myr after
resumption), against 4.6 the first time. (With the earlier gate Q = max(I, R), prolactin kept the
refill near zero through the second build and the second AGN ignited at b ≈ 1, breaking rule 4 of
§10.)

**Renderer inputs and their response times in astro time.**

| Renderer input | Driven by | Response in astro time |
|---|---|---|
| Lane opacity and lane sprite density | F̂ | τ_in = 20 Myr (streaming speed fixed) |
| Lane width | M̂ | τ = 20 Myr |
| Ring gas, ring SFR, pearl spawn rate | F̂, Â | t_dep = 100 Myr; τ_⋆ = 20 Myr |
| Ring-SFR modulation | A_obs (η) | ~10 Myr correlation, ±20 % |
| Nuclear-spiral opacity | D̂·Ĝ | τ = 20 Myr |
| Plateau AGN flicker | D·â⁴ | none needed: nuclear accretion can change within ≲ 10⁵ yr (< 0.02 s at 4.8 Myr/s); drawn as a slow random walk (rise ≥ 1 s) |
| AGN luminosity | Ω and N (peak amplitude only) | light curve in astro time (e-folding 2 × 10⁴ yr); ONSET rise log-linear in screen time (§9.4) |
| Knots | pulses of C(t) | launched at the nucleus, then move at the jet speed |
| Jet spine | Ω at the launch time t_a − d/v_jet | drains outward at the jet speed (§9.3) |
| Ionization cones, light echoes | L_AGN history | light-travel delay plus recombination (t_rec ≈ 10²–10⁴ yr) |
| Cluster colours and brightness | birth time | stellar ageing (§9.1) |

### 8.2. Why each mapping is defensible

1. **G → inflow.** Both are a fluid driven inward by a mechanism into a central reservoir:
   vasodilation pools blood, and bar torque piles gas up at the ring. Both respond within the
   build and clear afterwards. The bar itself is not changed, only the gas on it (§2.2). The
   inflow rate is carried by the gas column (lane opacity and sprite density from the smoothed
   mass flux F̂), not by the streaming speed, which the bar potential fixes at ~100–200 km/s.
   Bar-driven inflow is intrinsically episodic and varies by factors of a few over tens of Myr
   (Seo & Kim 2013; Krumholz & Kruijssen 2015), so the stop of the inflow after the climax is read
   as the end of an inflow episode. That it coincides with the climax is a design choice, and the
   About text says so.
2. **A → ring starburst.** A starburst is self-limiting by gas exhaustion (~0.1 Gyr) and occupies
   a bounded "high" phase; on galaxy scales stellar feedback mainly regulates star formation, and
   positive, propagating star formation is a local and debated effect. It is the natural plateau.
   In the model gas piles up first and the burst then grows through an assumed rise in efficiency
   ε (§8.1), just as felt arousal follows stimulation with a lag. Once the inflow stops after the
   climax, the SFR falls by gas consumption over ~10–40 Myr (§8.1).
3. **κ → star-formation efficiency.** Galaxies scatter around the Kennicutt–Schmidt relation
   (Kennicutt 1998, L). Gas can pile up without proportional star formation, which mirrors genital
   response without matching felt arousal, and the reverse.
4. **D → nuclear feeding.** Dopamine is anticipatory: it rises before and during the build
   (reward anticipation in general, [G Mesolimbic L39]; rat NAcc data, §6), and its timing at the
   climax is unresolved. Gas creeping past the ring toward the black hole is the precondition for
   AGN ignition, but it is not the ignition itself.
5. **σ/N → AGN luminosity.** The catecholamine spike is the briefest, sharpest hormonal signal at
   the peak (t½ 1–3 min). One AGN phase is brief compared with the galaxy (10⁵ yr against 10⁸ yr
   build-up). Both peak once and fall fast, and an AGN can outshine the host, matching the
   highest-amplitude signal. N sets only the peak amplitude; the AGN light curve itself runs in
   astro time (row 7), apart from the log-linear ONSET rise in screen time (§9.4).
6. **C(t) → jet knots.** Disk instabilities are linked to the ejection of discrete knots (3C 120;
   Marscher et al. 2002), so a train of knots from a rhythmic, slowing driver is physically
   possible. The 0.8 s ↔ ~200 pc agreement with M87's mean knot spacing (0.2 kpc intrinsic,
   ≈ 0.32 kpc projected with retarded time) is a coincidence of averages and illustrative only
   (§7.7), and the relativistic jet is a deliberately rare case
   (§2.2). The rhythm is placed **along the axis, not in the nucleus brightness**, because no
   optical nuclear periodicity at these time-lapse scales is observed (§2.3). Real disk–jet
   coupling also involves brief nuclear X-ray dips before ejections, which are not shown.
7. **O → HUD only.** Oxytocin and ionization cones both outlast the peak, but their timescales do
   not match. Cone [O III] luminosity follows the AGN's ionizing output, so the cones cannot glow
   before ignition, whereas O is already ≈ 0.08 of its peak during the build. After the climax,
   O's 4-minute half-life maps to ~10–40 Myr of astro time, whereas AGN-lit gas fades within
   ~10⁴–10⁵ yr of the source dimming (light crossing plus recombination; Lintott et al. 2009).
   The cones and echoes are therefore computed from L_AGN alone (row 9), and O is shown in the
   neurochemistry panel.
8. **R ↔ post-starburst state (two markers).** Prolactin is a *marker* of satiety whose causal
   role is disputed (Valente et al. 2021, mice); it also rises after orgasm in women, who often
   have no obligatory refractory period (Exton et al. 1999, 2001). The E+A spectrum is likewise a
   *marker* of recent quenching, not its cause. R is therefore not an input to the galaxy: the
   ring fades by gas exhaustion once the inflow stops (row 12), not by AGN feedback, and
   post-starburst statistics argue against AGN as the primary quencher (Yesuf et al. 2014). The
   pairing is between two markers, neither of them causal; this is the model's stated position,
   not a claim about prolactin's role.
9. **I → reservoir refill.** A refill time of M_gas/Ṁ_in grows when supply is low, a qualitative
   analog of a refractory period that lengthens with age (order of magnitude ~15 min at 18 to
   ~20 h in the 70s, L). On screen the recovery is capped at 20 s (≤ 200 Myr at 10 Myr/s), so the
   galaxy's refill time cannot scale with T_ref; the age dependence is shown in the HUD, and the
   galaxy shows only whether the inflow is still gated at the end of late resolution. The gate is
   continuous: with I₀ < 0.08 (multiple peaks) the refill is reduced briefly, never stopped.
10. **F → HUD only.** An earlier mapping to an inner-disk Hα wave was dropped. No known process
    drives an Hα wave from a nuclear ring to the bar ends over ~50–100 Myr; bar bodies are often
    star-formation "deserts" (James & Percival 2016, 2018, M); inside-out quenching is a Gyr-scale
    trend in massive galaxies (§2.2); and an outward wave would contradict the centripetal, then
    axial motion of §8.4 and drift toward Anger's global Hα flood. The flush is shown in the HUD
    only, like heart rate.
11. **Ψ → HUD only.** By the criterion of #7, opioid tone has no galaxy counterpart. Its 15-min
    decay maps to hundreds of Myr of astro time, whereas relic knots vanish within ~10⁴–10⁵ yr,
    about 1–1.5 human min into early resolution, while Ψ is still near its peak. An earlier
    mapping to the relic e-folding changed it only between about 10 and 14 kyr across profiles,
    which cannot be seen. Relics now fade with a fixed e-folding (§9.3), and Ψ is shown in the
    neurochemistry panel.

### 8.3. Variables deliberately not mapped onto the galaxy

- **Heart rate, respiration and blood pressure** appear only as HUD readouts and traces. A
  nucleus pulsing at heart rate was Anger's signature and has no astrophysical counterpart.
- **Cortical "letting go"** (lateral OFC / temporal deactivation) has no counterpart in the
  galaxy. It is shown at the interface instead: during ORGASM the HUD fades to 25 % opacity, and
  automatic camera drift is suspended so attention rests on the nucleus. The camera is not moved
  without the user's consent.
- **Hypersensitivity H, vasopressin V and serotonin** gate the model or appear in the
  neurochemistry panel, with no separate visual.
- **Oxytocin O, opioid tone Ψ, prolactin R and the sex flush F** appear only in the HUD
  (§8.2 #7, #8, #10, #11); R also times the end of recovery.
- **The 8–13 Hz pressure component** stays in the model only, for photosensitivity reasons.
- **Rotation speed is set by the phase clock, not continuously by arousal.** The time-lapse rate
  is the observer's choice and changes only with the phase regime (§7.7): the disk freezes at the
  climax and turns about twice as fast in late resolution as during the build.

### 8.4. How it must look and feel different from Anger Galaxy

| Aspect | Anger Galaxy | Orgasm Galaxy |
|---|---|---|
| Direction of motion | **Centrifugal**: expanding collisional ring, M82-like superwind, supernovae across the disk | **Centripetal, then axial**: gas streams in along the bar and gathers in the ring; release is a narrow jet along one axis; then an afterglow |
| Time structure | Rises fast, falls slowly; staircase with repeated provocations; Poisson-random events | Slow build with slow waves; threshold; **periodic, decelerating** pulse train (~1.1–1.7 Hz, default 1.25 Hz → slower); cascaded decays (minutes → hour); gated refill |
| Rhythm carrier | Nuclear brightness at heart rate (62–150 BPM) | Jet knots only; the nucleus holds a smooth envelope (plateau flicker is a slow random walk); HR in the HUD |
| Clock | Rotation speed scales with arousal | Fixed clocks per phase; at the climax time "zooms in" (4.8 Myr/s → 1 kyr/s) and the disk **freezes** while the axis pulses |
| Morphology | Arms sharpen and twist; disk heats | Bar, arms and disk unchanged; only gas, star formation, nucleus and jet respond |
| Colour story | Global Hα flood, reddish | Pink pearls in a tight central ring → near-white synchrotron knots (≈ 7,700 K equivalent) along the axis, with patchy teal/pink cone gas → white, then warm-white A-star afterglow. Jet and afterglow are told apart by shape and motion (a narrow moving line vs a diffuse ring glow), not by colour |
| Spatial focus | Whole disk, outer regions | The central ~2 kpc and the jet axis; the outer disk stays calm |
| Ending | Post-crisis "depression": slow rotation, dim galaxy | Warm, quiet afterglow, then a slow refill |

---

## 9. Implementation targets

### 9.1. Galaxy geometry and dynamics (model units: radius 1 = 15 kpc, time 1 = 60 Myr, V0 = 1 ≈ 244 km/s)

| Parameter | Value | Basis |
|---|---|---|
| `CORE_RC` | 0.03 (≈ 0.45 kpc) | design choice that allows x2 orbits: ILRs at 0.036 and 0.093 units (0.54 / 1.4 kpc) for Ω_b = 2.5, computed from v = V0(1 − e^(−r/rc)), κ² = 2Ω(Ω + dv/dr); the ring radius itself is a design value, since simulations tie it to the inflowing gas's angular momentum (Kim, Seo & Kim 2012) |
| Bar pattern speed Ω_b | 2.5 units (≈ 40.7 km s⁻¹ kpc⁻¹), period ≈ 151 Myr | Bland-Hawthorn & Gerhard 2016 |
| Bar half-length | 0.33 (5 kpc); axis ratio 0.3–0.4; colour 4,200–5,000 K | corotation r_CR = V0/Ω_b = 0.40, so R_CR/R_bar = 1.2 |
| Bar orbits | inside 0.33, ellipse orientation fixed in the bar frame (x1-like), eccentricity 0.5–0.7; boxy/peanut thickening to ~2× disk scale height within 0.5 bar length | [G Barred L41] (buckling); Combes & Sanders 1981; Athanassoula 2005 |
| Spiral arms | start at the bar ends, rotate with the bar pattern, run to ~OLR (r_OLR = 1.707·V0/Ω_b ≈ 0.68); pitch fixed | Lindblad resonances [T] |
| Dust lanes | two straight lanes along the leading edges, ~0.8 bar length, width 0.012 → 0.006 (M̂), τ_V 0.1–1.5 (F̂; ≈ 0.34 at rest); fixed streaming speed | Athanassoula 1992; §8.1 |
| Nuclear ring | radius 0.06 (0.9 kpc), width 0.008; v ≈ 211 km/s, orbit ≈ 26 Myr (≈ 5.4 s at 4.8 Myr/s); laps the bar every ≈ 32 Myr | computed; NGC 1097-like |
| Contact points | 2, where the drawn lanes join the ring, fixed in the bar frame | Böker et al. 2008 |
| Ring H II life | 7 Myr (5–10) ≈ 1.5 s at base | Kruijssen et al. 2019 |
| Cluster colour track | taken from single-stellar-population B−V (Starburst99 or Bruzual & Charlot 2003, solar metallicity) converted to a colour temperature, including the temporary reddening when red supergiants appear at ~8–20 Myr. Approximate targets: 0–5 Myr ≈ 25,000 K + Hα; 5–8 Myr ≈ 15,000–20,000 K; ~8–20 Myr a red-supergiant dip (to roughly 8,000–10,000 K, L); 20–100 Myr ≈ 12,000 → 10,000 K; 0.5 Gyr ≈ 7,800 K (B−V ≈ +0.25); 1 Gyr ≈ 6,300–6,500 K (B−V ≈ +0.5); L ∝ age^−0.8 | Leitherer et al. 1999; Bruzual & Charlot 2003; [T, M] for the B−V values; [T] single-population fading |
| Ring gas and SFR | g₀ = 0.2, t_dep = 100 Myr, τ_⋆ = 20 Myr, τ_in = 20 Myr (§8.1); b ≈ 4.7 at most with the defaults, ≤ 6 at G = 1; ring SFR ≈ 0.3–0.6 M☉/yr at rest and ≈ 1.5–3 M☉/yr at the peak, over ≈ 0.7 kpc² (Σ_SFR ≈ 2–4 M☉ yr⁻¹ kpc⁻²) | [G Starburst L25, L60] (depletion ~0.1 Gyr); design |
| Galaxy luminosity L_gal | 3 × 10¹⁰ L☉ ≈ 1.2 × 10⁴⁴ erg/s (Milky-Way-like); the inner 2 kpc holds ≈ 10–15 % of it | [T]; design |
| Ring share of total light | 0.5 % at baseline → 2–2.5 % at the plateau peak (b ≈ 4–5), i.e. about +10–20 % of the light of the inner 2 kpc | design target |
| Black hole | 4 × 10⁶ M☉ (Milky-Way-like; at or below the low end of γ-ray NLS1 estimates, ~10⁷–10⁸ M☉ [T, L], stated in the About text); disk, torus and photon ring not drawn | §2.2 |

### 9.2. Clocks and durations

| Item | Target |
|---|---|
| Build clock | 1 s = 10 human s = 4.8 Myr (`BASE_SPEED` 0.08) |
| Climax clock | 1 s = 1 human s = 1,000 yr |
| Ramps | exponential in log₁₀(yr/s), each starting from the current rate (a ramp in progress is retargeted, never cut): 2.5 s down from 4.8 Myr/s to 1 kyr/s (ONSET, always 2.5 s whatever T_pre); 2.5 s back up to 4.8 Myr/s if ONSET is cancelled, with the nucleus returning to L_q over the same 2.5 s (§9.4); 8 s up from 1 kyr/s to 4.8 Myr/s (early resolution, and ORGASM / RESOLUTION_EARLY → PLATEAU for a repeat peak); 3 s from 4.8 to 10 Myr/s (into late resolution); 3 s from 10 to 4.8 Myr/s (RESOLUTION_LATE, RECOVERY or RESOLUTION_NO_CLIMAX → EXCITEMENT; RECOVERY or RESOLUTION_NO_CLIMAX → BASELINE) |
| Resolution / recovery clock | 1 s = 20–60 human s (more in recovery) = 4.8–10 Myr |
| Default cycle | excitement ~35 s, plateau ~14 s, onset 2.5 s, orgasm ~15 s, early resolution 15 s, late resolution 25 s, recovery ≤ 20 s; total ≈ 2 min (≈ 0.7 Gyr of astro time) |
| Refractory on screen | T_ref = 15 min (default; young-adult low end) ends ~25 s after the orgasm, after which orgasm is possible again but needs a fresh build (~53 s on screen); longer T_ref is compressed so recovery never exceeds 20 s, with the human time shown |

### 9.3. Pulse train and jet

| Item | Target |
|---|---|
| Pulse interval | Δ₀ (individual 0.6–0.9 s, the 0.9 s bound a design value; default 0.80 s) for the first 3–6 pulses, then ×1.08 per pulse (design fit; M&J pattern). Optional EMG-like mode: +0.1 s per pulse from the first interval, Δ₀ ≈ 0.6 s (§7.5) |
| Pulse count | 3–15 (default 9, which deliberately sits in M&J's intense band of 8–12 so that the rhythm reads clearly; a mild orgasm has 3–5, and M&J describe 3–4 major expulsive contractions in people with a prostate) plus 0–3 minor pulses 2–4 s apart |
| Amplitude | a₁ = a₂ = 1, then ×0.82 per pulse (design fit) |
| Pulse shape | alpha function, t_r = 0.12 s (FWHM ≈ 0.29 s) |
| Jet type | a deliberately rare relativistic, one-sided jet in a disk galaxy (as in γ-ray narrow-line Seyfert 1s and the few spiral-hosted radio jets, §2.2); typical Seyfert jets are slower (≲ 0.25c) and two-sided; the About text says so |
| Jet length (visible) | up to 2 kpc (0.133 units, `JET_LEN`); tilted 15–75° from the disk normal (seeded, default 60°), wide enough that the ionization cones cut the disk (§9.4); Seyfert axes are randomly oriented relative to the disk (Kinney et al. 2000), and 15–75° covers ~70 % of random orientations |
| Jet growth | the leading knot defines the head: the spine grows behind knot 1 and follows its β(d) law, so the head reaches 1 kpc after ~4 kyr (≈ 4 s at 1 kyr/s) and `JET_LEN` after ~14 kyr (≈ 14 s), where it stops however long the orgasm lasts. All knots follow the same β(d) law, so none overtakes another and the train crosses its own channel. Real young radio sources advance their heads at only ~0.1–0.3c while boring through the ISM (Owsianik & Conway 1998, M); the faster head assumes the jet runs into low-density gas above the thin gas disk, a design simplification that the About text states |
| Knot speed | β = 0.8 (Γ ≈ 1.67) out to 1 kpc, then decelerating as β ∝ d⁻² (0.2 at 2 kpc), a design scaling for a low-power Seyfert jet, qualitatively as in FR I jets (in 3C 31 the deceleration is spread over ~1 to >10 kpc; Laing & Bridle 2002); intrinsic speed ≈ 0.25 kpc per screen second at 1 kyr/s while β = 0.8. With retarded time on and the jet at 30° to the line of sight, the apparent speed is 1.3c projected (≈ 0.40 kpc per screen second; 2.6c along the jet), and knots appear to reach 1 kpc along the jet in ~1.25 s |
| Knot spacing | ≈ 0.2 kpc intrinsic at Δ₀ = 0.8 s while β = 0.8; on screen, with retarded time at 30° to the line of sight, ≈ 0.32 kpc in projection; the spacing shrinks beyond 1 kpc as the knots decelerate (M87's mean ≈ 200 pc projected is an illustrative coincidence, not a match) |
| Knot size | 30 pc at launch → 150 pc at 2 kpc (jet aspect ≈ 0.1) |
| Knot brightness | ∝ a_k · e^(−d / 0.8 kpc) · δ^(3+α) (discrete blobs), with δ = 1/(Γ(1 − β cos θ)) per sprite from the camera direction and α = 0.7; the spine uses δ^(2+α) (continuous flow) |
| Jet/counterjet | at 30° from the line of sight with β = 0.8: spine ≈ 100:1, knots ≈ 550:1; ≈ 1:1 side-on, dimmed ×0.25; the ratios fall as knots decelerate |
| Jet spine | faint continuous emission behind the head; its brightness at distance d is ∝ 0.2·Ω evaluated at the launch time t_a − d/v_jet, so after the train the spine switches off as a gap that starts at the nucleus and grows outward at the jet speed, never everywhere at once |
| Relic | after the train, the remaining knots keep moving along the β(d) law and fade with a fixed e-folding of 10 kyr in astro time, so they are effectively gone before ~3 kpc (≈ 3 s into early resolution). A repeat peak (§7.8) comes ~1–45 Myr later and is drawn as a fresh ignition with a new spine and knot train; no older knot train survives that long, no earlier channel is drawn, and double-double radio sources (100 kpc–Mpc lobes) are not drawn |
| Apparent motion | retarded-time knot positions (apparent superluminal motion), computed analytically in the vertex shader, are on whenever Doppler boosting is on; the two are switched together |
| Visibility label | real optical jets are rare and faint; the jet is drawn ×10 brighter than a physical optical surface brightness, and the About dialog says so, together with the head speed and the cone boost (§9.4); an optional "radio layer" uses labelled false colour |

### 9.4. Nucleus, cones and echoes

| Item | Target |
|---|---|
| Quiescent nucleus L_q | 1 × 10⁻³ L_gal (nuclear star cluster plus low-luminosity AGN) |
| Plateau flicker | ≤ 3 × 10⁻³ L_gal; a slow random walk (rise ≥ 1 s, ≤ 2 events per 10 s); ∝ D·â⁴ |
| Peak L_pk | 0.1 + 0.4·q of L_gal (default 0.3 L_gal ≈ 3.5 × 10⁴³ erg/s for L_gal = 3 × 10¹⁰ L☉ ≈ 1.2 × 10⁴⁴ erg/s, i.e. ≈ 0.07 L_Edd); 300× the quiescent nucleus |
| AGN light curve | one L_AGN(t_a) feeds the nucleus, the cones and the echo history buffer. **Onset:** log L_AGN rises linearly in screen time from L_q to the peak over the 2.5 s ONSET ramp. Because the clock rate falls exponentially, 82 % of ONSET's ~1.4 Myr of astro time passes in its first 0.5 s, so this shape puts most of the ×300 rise into the last ~10⁴–10⁵ yr of astro time (×10 in the last ~8 kyr, ×100 in the last ~260 kyr), and the first ~1.2 Myr stay at ≤ 3 L_q, a low-level pre-flicker like the plateau flicker. A rise linear in t_a would flash within 0.5 s, and one linear in screen time would hold ~0.1 L_gal for ~1 Myr, ten times one accretion phase. **Hold** through the train, then **decay** with e-folding 2 × 10⁴ yr in astro time, so the fade plays out over the early-resolution ramp. **Cancelled ONSET:** log L_AGN falls linearly back to L_q over 2.5 s of screen time while the clock ramps back up. Ω and N set only the peak amplitude |
| Diffraction spikes | only while L > 0.03 L_gal; 4 spikes as in Anger |
| Ionization cones | half-opening 30–40° (default 35°), extent 1–3 kpc along the jet axis. Emission is computed from an explicit gas field, never a filled bicone: the inner disk where the cone cuts it (with the default 60° tilt and 35° half-opening, a ±19° wedge of disk gas on each side, with sharp straight edges) plus 20–60 clumpy extraplanar or tidal clouds, so the emission is patchy and filamentary. Each gas element is lit by L_AGN(t_a − r(1 − cos φ)/c) convolved with a recombination kernel (t_rec ≈ 10²–10⁴ yr, density-dependent) and weighted by its density squared. Observed delays: near cone 0–0.66 r/c, far cone 1.3–2 r/c (axis 30° from the line of sight), so at 1 kyr/s the near cone fills in 0–6.5 s and the far cone over ~4–20 s, finishing early in the resolution ramp; both fade within ~2–4.5 s of early resolution. Physical brightness: total cone [O III] ≈ L_bol/3500 (Heckman et al. 2004) ≈ 10⁴⁰ erg/s at the default peak, a few % of the ring's peak Hα (~2–4 × 10⁴¹ erg/s for 1.5–3 M☉/yr; Kennicutt 1998), spread over a larger area; any display boost (at most ×5) is labelled in the About text, as for the jet; chroma ≤ 0.35 |
| Light echoes | 3–5 gas clouds at 3–10 kpc inside the cone directions; delay d·(1 − cos φ)/c in astro time (≈ 10–30 kyr) |
| About text | real disk–jet coupling involves brief nuclear X-ray dips before ejections (Marscher et al. 2002); they are deliberately not shown |

### 9.5. Colour

| Element | Spectrum → colour |
|---|---|
| Stars, bar, bulge, clusters | Planck + CIE (Anger pipeline): bar and bulge 4,200–5,000 K; ring OB stars 15,000–30,000 K; post-starburst glow along the population colour track of §9.1 (≈ 9,500 K at 0.1 Gyr → ≈ 7,800 K at 0.5 Gyr → ≈ 6,300–6,500 K at 1 Gyr) |
| H II / pearls | Hα 656.3 nm + [N II] 658.4 nm with a little Hβ: pink; never saturated red |
| AGN core | power law F_ν ∝ ν^−0.44 (Vanden Berk et al. 2001), integrated through CIE: correlated colour temperature ≈ 8,400 K, white with a faint cool tint |
| Jet and knots | synchrotron F_ν ∝ ν^−0.7, so F_λ ∝ λ^−1.3, integrated through CIE: chromaticity ≈ (0.299, 0.304), correlated colour temperature ≈ 7,700 K, near-neutral white (no "pale blue"); chroma ≤ 0.25 |
| Ionization cones | [O III] 495.9 / 500.7 nm (teal) + Hα (pink); chroma ≤ 0.35; **the only green in the scene** |
| Dust | Anger extinction law (blue absorbed more than red) |
| UI | No sex-coded colours (no pink/blue gender coding); colour carries physics only |

### 9.6. Brightness and HDR

- Exposure is fixed. There is no auto-exposure "pumping", so the ACES tonemap and bloom absorb the
  ≥ 300× AGN jump.
- The pulse-related luminance change is confined to the knots and stays small in area.
- The ring at the plateau peak brightens the inner 2 kpc by about +10–20 % (ring share 0.5 % →
  2–2.5 % of L_gal, §9.1), never the whole frame.
- The post-starburst glow decays emergently as L ∝ age^−0.8.

### 9.7. Vitals in the HUD

| Readout | Range (typical envelope, default; basis per row) | Upper-range envelope (M&J individual extremes) |
|---|---|---|
| HR | 68 → ~104–111 (plateau) → ~125 (peak) → ~82 (+2 min) → 68 (study means, §4.1) | peak up to 180 |
| RR | 14 → ~22–24 (plateau) → ~27 (peak), with brief breath-holds (duration a design value, [T]); a design estimate scaled like HR, since no study mean is cited ([T], L) | up to 40 |
| BP | 115/75 → ~160/83 (peak) (study means of Nemec, Mansfield & Kennedy 1976 in healthy men; recalled figures, L–M) | peak +100 systolic / +50 diastolic (men); +80 / +40 (women) |
| Neurochemistry (normalized bars) | D, O, R, N, Ψ, V; I as a "refractory" gauge with human time remaining | — |

### 9.8. HUD and controls

- **Dropdown sections** (as in Anger): Phase & clocks (human time and astro scale, always
  visible); Vitals; Neurochemistry; Profile & parameters (§7.2, §7.9); Display (radio layer,
  labels, reduced motion).
- **Controls:** Stimulate (hold or level), Distraction, Demo, Reset; Escape closes panels.
- **Text** uses clinical terms only. The About dialog lists the mappings, the clock regimes, the
  documented compromises (jet brightness, rarity, head speed and deceleration; the black-hole mass
  at or below the low end for jetted NLS1s; the cone boost; the timing of the inflow stop at the
  climax; HUD-only oxytocin, opioid tone, prolactin and flush; the omitted superwind and nuclear
  dips; the clocks; design-estimate respiration; cardiovascular data mostly from men) and the
  sources.

### 9.9. Performance budgets (on top of Anger's tiers)

| Element | Sprites (high tier) | Notes |
|---|---|---|
| Ring clusters + pearls | ≤ 2,000 + ≤ 300 | birth time and azimuth per sprite; ageing on the GPU |
| Dust-lane extinction | 1,000–3,000 | opacity and sprite density from F̂, width from M̂ (smoothed in astro time) |
| Nuclear spirals | ≤ 1,000 | opacity from D̂·Ĝ (smoothed in astro time) |
| Jet spine + knots + relics | 200–400 + ≤ 16 + ≤ 32 | Doppler factor in the vertex shader |
| Cone gas (inner-disk wedge + 20–60 clumps) + echo clouds | 2,000–6,000 + 5 × ~500 | brightness from the L_AGN history buffer (light-travel delay plus recombination kernel), weighted by gas density squared |
| CPU per frame | model ODEs (≈ 20 scalars) + a few uniforms | one draw call per sprite family; adaptive tiers unchanged |

---

## 10. Realism rules and things to avoid

**Rules**

1. Keep all Anger rules: PSF stars, Planck/CIE colour, a heavy-tailed brightness distribution,
   HDR/ACES/bloom, no twinkle, a thin disk, spikes only on the brightest sources, and a HUD time
   scale (`../anger-galaxy/research/ANALYSIS.md` L94–L105).
2. The bar, the arms and the disk thickness are fixed anatomy. Only gas, star formation, the
   nucleus and the jet respond to the model.
3. Gas streams slowly along the lanes and **stalls in the ring**. There is never a drain vortex
   into the nucleus.
4. The causal order is: inflow → ring starburst → AGN ignition after the burst has begun
   (≥ 50 Myr after the ring's SFR first exceeds 1.5× rest), while the ring still forms stars or in
   its post-starburst phase up to ~250 Myr after the burst (nuclear star formation and Seyfert
   accretion coexist, and AGN accretion peaks as nuclear star formation declines; Davies et al.
   2007; Wild, Heckman & Charlot 2010) → jet and cones → the inflow episode ends and the ring gas
   is used up → fade → refill. The jet never blows out the ring. With the defaults the first
   ignition comes ~185 Myr into the burst at b ≈ 4.6, and a second cycle started at T_ref ignites
   ~120 Myr into a weaker re-formed burst at b ≈ 3.1 (§8.1).
5. The rhythm lives only in the jet knots. The nucleus brightness follows a smooth envelope; its
   plateau flicker is a slow random walk, never a pulse.
6. The jet is narrow (aspect ≈ 0.1), knotty, relativistic only within ~1 kpc and one-sided by
   Doppler beaming. It is a deliberately rare case for a disk galaxy, tilted relative to the disk,
   near-white (its CIE-computed synchrotron colour) and faint, with its visibility boost and its
   rarity labelled.
7. Green comes only from [O III] gas, at low saturation. Stars are never green.
8. Colour ageing is emergent (birth time → temperature). Nothing is recoloured by hand.
9. Quenching proceeds by gas exhaustion once the inflow episode ends; no Hα wave propagates
   across the disk. The flush appears only in the HUD.
10. Clock changes are smooth exponential ramps, and every phase change has one (§9.2), including
    4.8 ↔ 10 Myr/s, the repeat-peak ramp and a cancelled ONSET. The HUD always shows both the
    human-equivalent time and the astrophysical scale.
11. The human numbers in the HUD are illustrative typical values from the literature, not
    measurements of anyone. The About text says so, along with the uncertainty notes from §3–§6.

**Avoid**

- A resolved accretion disk, a torus or a black-hole shadow/photon ring at galaxy scale. These
  need ray tracing and are far below one pixel (EHT 2019).
- A uniform, saturated "laser beam" jet; two equally bright sides; a perfectly straight jet with
  no knots; a long, bright optical jet presented as typical.
- A nucleus pulsing at heart rate or at the contraction rhythm; disk-wide supernova flashes; an
  expanding collisional ring; arms that wind or sharpen; a disk that heats and cools. These are
  Anger's signatures and/or unphysical. A starburst-driven superwind would be physical here
  (§2.3); it is omitted by default for distinctness, never shown as an M82-style flood, and its
  omission is stated in the About text.
- A bar that grows, spins up or dissolves during a cycle.
- A huge glowing optical shock shell from AGN feedback, or a uniformly filled glowing bicone in
  empty space: the cones light only gas that is there (§9.4).
- Galaxy structures that follow fast human variables directly: lanes, nuclear spirals and the jet
  spine respond only through their astro-time response times (§8.1).
- Tidal disruption events as the climax. Their timescale is invisible and the image is
  destructive (Rees 1988).
- **Photosensitivity hazards.** Never more than 3 flashes per second (WCAG 2.1, SC 2.3.1). The
  pulse rate is ≤ 1.7 Hz (Δ₀ ≥ 0.6 s), the 8–13 Hz component is never rendered, and no
  large-area luminance swing exceeds 10 % in under a third of a second. The AGN always ramps up
  over ≥ 2.5 s, log-linear in screen time (§9.4). With
  `prefers-reduced-motion`, the clock-regime ramp is replaced by a cross-fade, knot brightness
  modulation is halved, and the camera never moves automatically.
- **Explicit or anatomical content.** No bodies, silhouettes, body-shaped nebulae, suggestive
  shapes or wording. No sound design that imitates vocalization.
- **Sex-coded presets or colours.** Profiles are response patterns available to any body.
- Tying felt intensity to heart rate alone. Physiology correlates only weakly with subjective
  intensity (Levin & Wagner 1985; Carmichael et al. 1994), so q, HR and O vary partly
  independently.
- Presenting disputed findings as settled: the female refractory period, the cause of the
  refractory period, the PET-vs-fMRI cortex question, and bar-driven AGN fuelling.

---

## 11. Sources

### 11.1. Raw captures used (located with `graphify query` / `explain` / `path`)

`brain-system/raw/en_wikipedia_org_api_rest_v1_page_html_*.md`:

| File | Lines used |
|---|---|
| Orgasm.md | L23, L25, L27, L31, L33, L39, L41, L43, L51, L53 |
| Human_sexual_response_cycle.md | L19, L23, L29, L31, L33, L37, L41, L45–L55, L61–L69, L75–L81 |
| Refractory_period_sex.md | L19, L23, L25, L27, L29, L33, L35, L41 |
| Sexual_arousal.md | L39, L55 |
| Sex_flush.md | L29, L31 (redirects to the response-cycle text) |
| Vasocongestion.md | L25, L37, L39, L41 |
| Oxytocin.md | L73, L75 |
| Prolactin.md | L34, L40 |
| Mesolimbic_pathway.md | L23, L25, L31, L39 |
| Nucleus_accumbens.md | L41, L53 |
| Periaqueductal_gray.md | L34, L36, L42, L44, L50, L56, L60 |
| Active_galactic_nucleus.md | L25, L27, L31, L35, L47 |
| Astrophysical_jet.md | L23, L25, L27, L33, L35, L41–L44, L50 |
| Barred_spiral_galaxy.md | L21, L23, L39, L41, L43, L45 |
| Messier_87.md | L21, L28, L37, L39, L51, L59, L62 |

`anger-galaxy/raw/en_wikipedia_org_api_rest_v1_page_html_*.md`: Starburst_galaxy.md L23, L25,
L41, L60; H_II_region.md L25, L49, L57, L59; Ring_galaxy.md L31, L41–L45; Density_wave_theory.md
L119, L175; Spiral_galaxy.md L73.

Project files: `anger-galaxy/research/ANALYSIS.md` L10–L144; `anger-galaxy/src/galaxy-model.js`
L1–L16 (constants at L8–L16); `orgasm-galaxy/src/galaxy-model.js` L1–L30, copied from Anger and
then changed according to §2.3 and §9.1 (`CORE_RC` 0.03 vs 0.09, `OMEGA_P` 2.5 vs 1.25,
`HII_LIFE` 0.117 vs 0.45, plus bar, ring and jet constants at L14–L29);
`anger-galaxy/src/events.js` L25–L29, L46–L50.

### 11.2. Literature: human sexual response, physiology and neuroscience

- **Response models and critique:** Masters & Johnson 1966 (*Human Sexual Response*); Kolodny,
  Masters & Johnson 1979; Kaplan 1974, 1979; Basson 2000, 2001; Robinson 1976; Tiefer 1991;
  Sand & Fisher 2007; American Psychiatric Association 2013 (DSM-5); Bancroft & Janssen 2000;
  Toates 2009; Chivers et al. 2010.
- **Timing and prevalence:** Kinsey et al. 1953; Darling, Davidson & Jennings 1991; Waldinger et
  al. 2005; Bhat & Shastry 2020; Frederick et al. 2018; Herbenick et al. 2018; Kukkonen et al.
  2007; Levin & Wagner 1985; Mah & Binik 2001; Vance & Wagner 1976.
- **Multiple orgasms and refractory period:** Whipple, Myers & Komisaruk 1998; Dunn & Trost 1989;
  Haake et al. 2002; Levin 2009; Aversa et al. 2000; Valente, Marques & Lima 2021.
- **Cardiovascular and energy cost:** Hellerstein & Friedman 1970; Nemec, Mansfield & Kennedy
  1976 (BP figures recalled, to be re-checked); Bohlen et al. 1984; Frappier et al. 2013; Levine et
  al. 2012 (AHA); Muller et al. 1996.
- **Contractions and pressure:** Bohlen et al. 1980, 1982; Gerstenberg, Levin & Wagner 1990;
  van Netten et al. 2008.
- **Autonomic and vascular:** Burnett et al. 1992; Ignarro et al. 1990; Giuliano & Clement 2005;
  Meston & Gorzalka 1995; Lorenz et al. 2012.
- **Pupils:** Hess & Polt 1960; Rieger & Savin-Williams 2012.
- **Spinal cord and reflexes:** Truitt & Coolen 2002; Marson & McKenna 1990; McKenna, Chung &
  McVary 1991; Sipski, Alexander & Rosen 1995; Sipski et al. 2001; Komisaruk, Beyer-Flores &
  Whipple 2006; Whipple, Gerdes & Komisaruk 1996; Cueva-Rolón et al. 1996; VanderHorst & Holstege
  1997; Holstege & Huynh 2011.
- **Imaging:** Holstege et al. 2003; Georgiadis et al. 2006, 2009; Huynh, Willemsen & Holstege
  2013; Komisaruk et al. 2004, 2011; Komisaruk & Whipple 2005; Wise, Frangos & Komisaruk 2017;
  Whipple, Ogden & Komisaruk 1992; Stoléru et al. 2012; Hamann et al. 2004; Mitricheva et al.
  2019; Kell et al. 2005; Heath 1972; Cohen,
  Rosen & Goldstein 1976; Graber et al. 1985; Janszky et al. 2002; Kringelbach 2005; Georgiadis &
  Kringelbach 2012; Klüver & Bucy 1939; Whipple & Komisaruk 1985.
- **Neurochemistry:** Carmichael et al. 1987, 1994; Murphy et al. 1987, 1990; Blaicher et al.
  1999; Wakerley & Lincoln 1973; Krüger et al. 1998, 2002, 2003; Exton et al. 1999, 2001;
  Brody & Krüger 2006; Wiedeking, Ziegler & Lake 1979; Pfaus et al. 1990, 1995; Damsma et al.
  1992; Robinson et al. 2001; Fiorino, Coury & Phillips 1997; Hull et al. 1995; Hull, Muschamp &
  Sato 2004; Mermelstein & Becker 1995; Argiolas & Melis 2005; Berridge & Robinson 1998; Berridge
  & Kringelbach 2015; Weintraub et al. 2010; Coolen et al. 2004; Agmo & Berenfeld 1990; Paredes &
  Martínez 2001; Goldstein & Hansteen 1977; Lorrain et al. 1997, 1999; Waldinger et al. 1998;
  Pryor et al. 2006; Montejo et al. 2001; McCullough, Churchland & Mendez 2013; Walum, Waldman &
  Young 2016; Behnia et al. 2014; Burri et al. 2008; Williams, Catania & Carter 1992; Winslow et
  al. 1993; Williams et al. 1994; Young & Wang 2004; Lim et al. 2004; Walum et al. 2008;
  Thackare, Nicholson & Whittington 2006; Wildt et al. 1998.

### 11.3. Literature: astrophysics

- **Bars and inflow:** Shlosman, Frank & Begelman 1989; Athanassoula 1992; Bland-Hawthorn &
  Gerhard 2016; Aguerri et al. 2015; Sormani & Barnes 2019; Shen & Sellwood 2004; Athanassoula,
  Lambert & Dehnen 2005; Combes & Sanders 1981; Athanassoula 2005; Gadotti et al. 2015; Hopkins &
  Quataert 2010.
- **Black-hole mass:** GRAVITY Collaboration 2019; Häring & Rix 2004; Soltan 1982.
- **Nuclear rings and starbursts:** Comerón et al. 2010; Buta & Combes 1996; Schwarz 1981; Kim,
  Seo & Kim 2012; Böker et al. 2008; Mazzuca et al. 2008; Seo & Kim 2013; Krumholz & Kruijssen
  2015; Kennicutt 1998.
- **Superwinds and bar star formation:** Heckman, Armus & Miley 1990; Heckman 2002; James &
  Percival 2016, 2018.
- **AGN activity and fuelling:** Davies et al. 2007; Wild, Heckman & Charlot 2010; Diamond-Stanic
  & Rieke 2012; Schawinski et al. 2015; Hickox et al. 2014; Su, Slatyer & Finkbeiner 2010;
  Bland-Hawthorn et al. 2019; Knapen, Shlosman & Peletier 2000; Ho, Filippenko & Sargent 1997;
  Cisternas et al. 2013; Vanden Berk et al. 2001.
- **Nuclear variability:** Miniutti et al. 2019; Gierliński et al. 2008; Sillanpää et al. 1988;
  Valtonen et al. 2008.
- **Jets:** Biretta, Sparks & Macchetto 1999; Harris et al. 2006; Marscher et al. 2002; Kinney et
  al. 2000; Ledlow, Owen & Keel 1998; Bagchi et al. 2014; Middelberg et al. 2004; Ulvestad et al.
  2005; Abdo et al. 2009; Owsianik & Conway 1998; Asada & Nakamura 2012; Laing & Bridle 2002;
  Schoenmakers et al. 2000; Event Horizon Telescope Collaboration 2019.
- **Feedback, cones and echoes:** Fabian 2012; Di Matteo, Springel & Hernquist 2005; Croton et
  al. 2006; Feruglio et al. 2010; Tadhunter & Tsvetanov 1989; Lintott et al. 2009; Keel et al.
  2012; Heckman et al. 2004 ([O III] bolometric correction).
- **Quenching and post-starburst:** Yesuf et al. 2014; Dressler & Gunn 1983; Zabludoff et al.
  1996; Leitherer et al. 1999; Bruzual & Charlot 2003; Tacchella et al. 2015.
- **Star formation, supernovae and arms:** Kruijssen et al. 2019; Diehl et al. 2006; Lee et al.
  2023; Sellwood & Carlberg 2014; Rees 1988.

### 11.4. Standards

- W3C 2018, WCAG 2.1, Success Criterion 2.3.1 (Three Flashes or Below Threshold).

### 11.5. Textbook knowledge (lower confidence)

- Plasma half-lives of oxytocin, prolactin, catecholamines and vasopressin.
- Plateau and resolution durations; serial vs sequential spacing.
- The autonomic pathway anatomy, including the male visceral afferents of the pelvic and
  hypogastric nerves.
- Resting heart-rate and respiratory norms; pelvic congestion lasting hours without orgasm.
- Partial naloxone reversal of vaginocervical-stimulation analgesia in rats.
- The Eddington limit; synchrotron spectra; Doppler boosting (δ^(2+α) for continuous flows,
  δ^(3+α) for discrete blobs); light-travel arithmetic; Kepler periods.
- The host morphology of γ-ray narrow-line Seyfert 1 galaxies (debated) and their black-hole
  masses (~10⁷–10⁸ M☉).
- Single-population fading (L ∝ age^−0.8); single-population B−V values (red-supergiant dip,
  B−V ≈ +0.25 at 0.5 Gyr and ≈ +0.5 at 1 Gyr).
- Autonomic dysreflexia at T6; orgasm and ejaculation after SCI in people with male anatomy.
- The PET/fMRI temporal resolution caveats.
- The age span of the Masters & Johnson sample; M&J plateau BP ranges and anal-sphincter counts;
  excitement HR and the time for HR to return to baseline; vagal withdrawal at arousal onset.
- The optical appearance of jets (relative rarity; blue look from contrast and filters).
