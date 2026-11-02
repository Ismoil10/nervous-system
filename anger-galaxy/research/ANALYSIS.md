# Anger Galaxy — scientific analysis and design rationale

This document was prepared **before** the animation was written. The sources are collected in
the `raw/` folder (Wikipedia articles loaded via Graphify `ingest`) and in the Graphify knowledge
graph of the `galaxy` workspace (`../graphify-out/graph.json`). Every design decision rests on one of the scientific facts
below.

---

## 1. How stars appear in space

### 1.1. Point source and PSF
- A star is so far away that its angular size is far smaller than the limit a telescope can
  resolve. In an image a star is a **point source**, and its shape is set by the optics'
  point-spread function (PSF): a bright core (the Airy disk, close to a Gaussian) and a faint
  halo around it.
- A bright star looks larger — it is not actually bigger; the faint wings of its PSF simply rise
  above the sensitivity threshold as well. **Conclusion:** star size depends on brightness, but
  a star is not drawn as a "ball".
- **Diffraction spikes** — a telescope artifact produced by the struts (spider vanes) that hold
  the secondary mirror: 4 spikes on Hubble, 6+2 on JWST. They appear only on the **brightest** stars (mostly
  foreground Milky Way stars).
- There is **no twinkling** in a vacuum: twinkling (scintillation) is a result of turbulence in
  Earth's atmosphere. That is why the animation uses no random "twinkle"; brightness changes only
  for a physical reason (a supernova, a young star fading).

### 1.2. Color = temperature (black-body radiation)
Source: `raw/…Stellar_classification.md` L83–111 (found via Graphify `query`/`explain`).

| Class | Temperature, K | Color (at the D65 white point) | Mass, M☉ | Luminosity, L☉ | Fraction of main-sequence stars |
|---|---|---|---|---|---|
| O | ≥ 33,000 | blue | ≥ 16 | ≥ 30,000 | 0.00003 % |
| B | 10,000–33,000 | deep bluish white | 2.1–16 | 25–30,000 | 0.12 % |
| A | 7,300–10,000 | bluish white | 1.4–2.1 | 5–25 | 0.61 % |
| F | 6,000–7,300 | white | 1.04–1.4 | 1.5–5 | 3.0 % |
| G | 5,300–6,000 | yellowish white (the Sun) | 0.8–1.04 | 0.6–1.5 | 7.6 % |
| K | 3,900–5,300 | pale yellowish orange | 0.45–0.8 | 0.08–0.6 | 12 % |
| M | 2,300–3,900 | orange-red | 0.08–0.45 | ≤ 0.08 | 76 % |

- Because a black-body spectrum is broad, **there are no green or violet stars**, and the colors
  are pastel (low saturation). In the animation the colors are **computed** from Planck's law +
  the CIE 1931 color-matching functions and adapted to the D65 (sRGB) white point — which yields
  exactly the "Color (at the D65 white point)" column of the table.

### 1.3. Star counts and brightness are inversely distributed
- Initial mass function (IMF): Salpeter dN/dm ∝ m^−2.35 (m > 0.5 M☉); Kroupa is flatter at low
  masses. In other words, most stars are small, faint red dwarfs.
- Luminosity L ∝ M^3.5, lifetime τ ≈ 10 billion years · M^−2.5. A 20 M☉ O/B star lives a few
  million years — it dies before the galaxy completes a single rotation (≈ 200 Myr).
  **Conclusion:** bright blue stars are found only near their birthplace — next to the spiral
  arms; long-lived yellow/red stars are spread evenly across the disk.
- Luminosities span a factor of 10^6 → rendering requires **HDR** (a floating-point buffer) +
  tonemapping; otherwise bright stars "blow out".

### 1.4. Gas and dust
- **H II regions**: young O/B stars ionize hydrogen; recombination emits the H-alpha
  (Hα, 656.3 nm) line → red-pink nebulae are strung along the spiral arms like a "string of
  beads".
- **Dust** absorbs blue light more strongly than red (reddening, extinction).
  Dust lanes lie on the inner (concave) edge of the arms — where the gas is compressed in the
  density wave.

---

## 2. Distribution of stars in a galaxy

| Component | Shape / profile | Stars | Color |
|---|---|---|---|
| Bulge | spheroid, Sérsic profile (n ≈ 2–4) | old K giants | yellowish orange |
| Disk | exponential: I(r) = I₀·e^(−r/R_d), very thin (h ≈ 0.02 R) | mixed ages | yellowish white |
| Spiral arms | logarithmic spiral r = a·e^(bθ), pitch angle 10–40° | young O/B, H II | blue-white + pink |
| Halo | sparse spherical, power-law profile | very old, globular clusters | yellowish |

### 2.1. Rotation
- Beyond the center, a galaxy's rotation curve is **nearly flat** (v ≈ const, because of dark
  matter). Angular velocity Ω(r) = v/r → inner stars have several times the angular velocity of outer
  ones and complete an orbit several times sooner (**differential rotation**), while the center
  rotates like a rigid body.
- **The winding problem**: if the arms were material, differential rotation would wind them into
  a tight coil within a few rotations. The solution is **density wave theory** (Lin–Shu): an arm
  is a wave that rotates at a constant pattern speed Ωp; stars and gas flow through it, slowing
  down and piling up inside it (a "traffic jam").
- **Kinematic model** (Lindblad, Kalnajs): every star moves on a slightly elliptical orbit; the
  ellipse axis turns progressively with radius → a two-armed spiral forms where the orbits crowd
  together. This model is cheap on the GPU, and the arms never wind up.

### 2.2. Star formation
- Gas is compressed as it enters an arm → stars form → young blue stars and H II regions light up
  on the arm's **downstream** side and, because of their short lives, fade before they drift far
  from the arm.

---

## 3. Realism rules (render requirements)
1. Star = PSF (Gaussian core + halo); energy is conserved even at sub-pixel sizes (no aliasing
   "shimmer" in motion).
2. Color comes only from temperature, via Planck + CIE.
3. Brightness follows a heavy-tailed distribution: many faint, few bright. HDR + ACES
   tonemapping + bloom (bloom is the analog of the optics' wide PSF wings).
4. Diffraction spikes only on the brightest foreground stars.
5. Bulge warm yellow, arms bluish, H II pink, dust reddening and darkening.
6. Differential rotation + density wave; the arms do not wind up.
7. The disk is very thin, and it still looks that way when the 3D camera views it at an
   inclination.
8. Time is a time-lapse: 1 second on screen ≈ millions of years (shown in the HUD).

---

## 4. Psychophysiological model of anger
- **Anger arousal cycle**: trigger → escalation → peak (crisis/outburst) → recovery →
  post-crisis depression → calm.
- Physiology (`raw/…Anger.md` L36–40): heart rate speeds up, blood pressure rises, adrenaline
  and noradrenaline levels increase; anger is part of the "fight or flight" response. Anger
  impairs the capacity for self-control — the system "goes out of control".
- Novaco's three modalities of anger: cognitive, somatic-affective, behavioral.
- **Rises fast, falls slowly**: the effect of adrenaline persists for minutes.
- **Excitation transfer** (Zillmann): residual arousal from an earlier provocation adds to the
  arousal caused by the next one — successive provocations raise anger in a staircase pattern.

## 5. Mapping: anger → a real phenomenon in the galaxy

| Aspect of anger | Galactic analog (real physical phenomenon) | Animation parameter |
|---|---|---|
| Arousal level | rotation speed (time scale) | `speed` |
| Tension, narrowing of attention | arms sharpen and wind more tightly | `ecc`, `twist` |
| Inner "boiling" | velocity dispersion grows, the disk thickens (dynamical heating) | `heat` |
| Flushed face | **starburst**: H-alpha emission intensifies | `starForm` |
| Heart rate | pulsating brightness of the nucleus (AGN), BPM 62 → 150 | `pulse`, `bpm` |
| Outburst (peak) | shock-wave ring (a ring galaxy like the Cartwheel: it pushes the arms outward "like a stone dropped into a pond" and is temporary — `raw/…Ring_galaxy.md` L43–46), supernovae, an M82-like bipolar H-alpha "superwind" | `ring`, `supernova`, `outflow` |
| Recovery | parameters return slowly, exponentially | asymmetric smoothing |
| Post-crisis depression | rotation slows down, the galaxy dims | `speed < 1` |

## 6. Performance strategy
- Orbits are computed **on the GPU** (vertex shader): each frame the CPU sends only a few
  uniforms; hundreds of thousands of stars are drawn with a single draw call.
- The stars in the buffer are randomly shuffled — drawing the first N of them gives a subsample
  of the same density; lowering quality does not require rebuilding the buffer.
- Quality tiers (low / medium / high / ultra): star count, bloom levels, render scale, DPR cap.
- The initial tier is determined from the GPU name, CPU cores, memory and device type; then an
  **adaptive controller** measures FPS and automatically adjusts the render scale and tier (with
  hysteresis, so it does not oscillate).
- Rendering stops while the tab is hidden; `prefers-reduced-motion` is respected.
- This computer: NVIDIA GTX 1060, Intel i7-8750H (6 cores / 12 threads), 16 GB RAM,
  1920×1080 @ 120 Hz → expected initial tier: **high**.
