# Orgasm Galaxy

A scientific visualization of the human sexual response — excitement, plateau, the point of
inevitability, orgasm, resolution and the refractory period — modelled through a realistic
barred spiral galaxy. The physiology and neurology run as a dynamic model in human time; the
galaxy answers with real astrophysical phenomena in its own time: gas inflow along the bar dust
lanes, a starburst in the nuclear ring, an igniting active nucleus, jet knots launched one per
contraction, ionization cones with light echoes, and a post-starburst afterglow.
Scientific basis and sources: [research/ANALYSIS.md](research/ANALYSIS.md). The tone is clinical
and non-explicit; the numbers are illustrative typical values from the literature.

## Getting started
Double-click `start.bat` — it starts a local server and opens `http://127.0.0.1:8767/`
(requires Python). Or:

```bash
python -m http.server 8767 --bind 127.0.0.1
```

Requires WebGL2 (Chrome, Edge, Firefox). To pick the quality manually: `?quality=low|medium|high|ultra`.

## Controls
- **Demo** mode (default) plays a scripted stimulation and repeats the cycle (about 2 minutes).
- **Manual** mode: hold the **Stimulate** button or Space, or set a steady level with the slider.
  **Distract** is an inhibitory cue that lowers arousal (dual control).
- Settings: response profile (single peak with refractory period, multiple peaks possible, rapid
  rise, plateau without climax, extended, older adult), refractory duration (10 s – 24 h),
  cardiovascular envelope (typical / laboratory), quality, Reset, About.
- Mouse — rotate, wheel — zoom, `D` — distract, `P` — pause, `H` — hide the HUD, `F` — fullscreen,
  `I` — About, `Esc` — close.

## What maps to what

| Body and brain | In the galaxy |
|---|---|
| Vasocongestion | gas streaming in along the bar dust lanes and stalling in the nuclear ring |
| Felt arousal | starburst in the nuclear ring ("pearls" born at the lane contact points) |
| Dopamine (wanting) | nuclear feeding spirals and faint nuclear flicker |
| Myotonia | sharper bar dust lanes |
| Sympathetic discharge | the active nucleus ignites over the 2.5 s point of inevitability |
| Contraction train (≈ 0.8 s apart) | jet knots, one per contraction, weaker and further apart |
| Oxytocin | ionization cones and light echoes |
| Opioid afterglow | relic knots cooling as they fly out |
| Prolactin / satiety | quenched, post-starburst ring (blue light fades to a white A-star glow) |
| Refractory inhibition | depleted nuclear gas reservoir that the bar refills slowly |
| Sex flush | inner-disk H-alpha glow that fades centre-first |

Two clocks are shown in the HUD: human time and astrophysical time. During the build one screen
second is 10 human seconds and 4.8 Myr; at the climax the galaxy clock slows to about 1,000 years
per second, so the contraction rhythm plays in real time and the disk appears frozen.
Bar, arms and disk never change shape — only gas, star formation, the nucleus and the jet respond.

## Structure
| File | Purpose |
|---|---|
| `src/response.js` | Response model: arousal, vasocongestion, autonomic tone, hormones, refractory inhibition, phases, pulse train, clocks |
| `src/galaxy-model.js` | Barred-galaxy kinematics: x1/x2 orbits, nuclear ring, arms from the bar ends, jet axis |
| `src/astro.js` | Planck + CIE star colours, emission-line and synchrotron colours, IMF, all particle populations |
| `src/shaders.js` | GPU orbits, star-formation history ageing, lanes, jet beaming, cones with light-travel delays, HDR |
| `src/renderer.js` | HDR render order and bloom chain |
| `src/knots.js` | Jet knots launched by the contraction pulses |
| `src/performance.js` | Hardware detection and adaptive quality |
| `src/camera.js`, `src/ui.js`, `src/main.js` | Camera, HUD, animation loop |

Rendering assets (orbit pipeline, star colours, PSF, dust, bloom, adaptive quality, HUD style)
come from [Anger Galaxy](../anger-galaxy/README.md).

## Performance
Orbits, cluster ageing, Doppler beaming and light-echo delays are computed on the GPU; the CPU
integrates about twenty scalars per frame. Particle kinds are interleaved in warp-sized blocks so
the GPU runs one shader branch at a time. GPU time on a GTX 1060 (1024×768):
Low 0.6 ms · Medium 1.1 ms · High 1.8 ms · Ultra (400,000 stars) 2.3–2.8 ms.

## Safety
The contraction rhythm is at most 1.25 Hz and never rendered as large-area flicker, the nucleus
always ramps up over at least 2.5 s, and `prefers-reduced-motion` halves knot brightness and stops
camera drift (research/ANALYSIS.md §10).
