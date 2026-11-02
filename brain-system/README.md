# Brain System

A scientific visualization of dopamine in the human brain across the sexual response cycle —
excitement, plateau, the point of inevitability, orgasm, resolution and the refractory period.
The brain is built procedurally in MNI space from tiny cool-white stars (neurons); released
dopamine is warm amber lantern light that spreads between them. A mathematical model of the
dopamine system runs underneath: seven dopaminergic cell groups, nine terminal fields,
Michaelis–Menten uptake, D1/D2 receptor binding, autoreceptors, release plasticity and a
reward-prediction-error signal, with prolactin, GABA, endogenous opioids, serotonin and oxytocin
acting as modulators of dopamine. Scientific basis and sources: [research/DOPAMINE.md](research/DOPAMINE.md).

The tone is clinical and non-explicit. Human dopamine during sex has never been measured: the
concentrations are calibrated on rat microdialysis and voltammetry, and human imaging (PET, fMRI)
measures blood flow, not dopamine.

## Getting started
Double-click `start.bat` — it starts a local server and opens `http://127.0.0.1:8768/`
(requires Python). Or:

```bash
python -m http.server 8768 --bind 127.0.0.1
```

Requires WebGL2 (Chrome, Edge, Firefox). Optional URL parameters: `?quality=low|medium|high|ultra`
and `?view=whole|cutaway|dopamine`.

## Controls
- **Demo** mode (default) plays a scripted stimulation and repeats the cycle (about 2 minutes).
- **Manual** mode: hold **Stimulate** or Space, or set a steady level with the slider. Pressing Stimulate during Demo switches to Manual with the slider at zero.
  **Distract** is an inhibitory cue (it pauses midbrain dopamine neurons through the GABA brake).
- **View**: whole brain, cutaway (left hemisphere removed at the midline) or the dopamine system
  with the cortex faded down.
- Settings: response profile, refractory duration, the post-orgasm dopamine hypothesis
  (serotonergic satiety dip, or dopamine sustained through the post-ejaculatory interval), quality.
- Mouse — rotate, wheel — zoom, `D` — distract, `V` — next view, `P` — pause, `H` — hide the HUD,
  `F` — fullscreen, `I` — About, `Esc` — close.

## What you see

| Element | Meaning |
|---|---|
| Cool-white stars | Neurons. Brightness follows regional activity from human PET and fMRI of orgasm: reward, sensory, cerebellar, brainstem and hypothalamic regions rise; lateral orbitofrontal and temporal cortex fall |
| Amber lanterns | Extracellular dopamine in a terminal field; the glow spreads outward from the field centre as the concentration rises, and its persistence follows the region's clearance |
| Amber sparks | Release sites (varicosities) firing at a rate set by release in their field |
| Amber threads | Dopamine pathways; firing travels along them (travel slowed for visibility — real conduction takes 40–200 ms) |
| Ember clusters | Dopamine cell bodies (VTA, substantia nigra, A11–A14); they twinkle at a rate-coded fraction of their firing |
| Faint tints | Modulators on their source nuclei: prolactin (pituitary, rose), serotonin (raphe, violet), GABA (RMTg, teal), opioids (periaqueductal grey and arcuate, sage) |

## Structure
| File | Purpose |
|---|---|
| `src/anatomy.js` | MNI coordinates and sizes of every structure, the implicit cerebrum and cerebellum, procedural sulci, dopamine pathways and terminal fields |
| `src/brain.js` | Point populations: cortex, cerebellum, deep nuclei, brainstem, dopamine cell bodies, axon streamlines, release sites, lanterns |
| `src/dopamine.js` | The dopamine model (firing, release, uptake, receptors, autoreceptors, prediction error, modulators) and its visual state |
| `src/response.js` | Physiological driver: arousal, vasocongestion, autonomic tone, hormones, refractory inhibition, phases, contraction train (from Orgasm Galaxy) |
| `src/shaders.js`, `src/renderer.js` | Star, dopamine and lantern shaders; HDR, bloom and tonemapping |
| `src/color.js` | Planck + CIE colours (neurons 7,000–9,500 K, dopamine 2,300 K) |
| `src/performance.js`, `src/camera.js`, `src/ui.js`, `src/main.js` | Adaptive quality, camera, HUD, animation loop |

Rendering assets (HDR pipeline, bloom, star point-spread function, adaptive quality, HUD style)
come from the Orgasm Galaxy project (removed on 2026-11-02; its response-model analysis lives on as
[research/RESPONSE.md](research/RESPONSE.md)) and [Anger Galaxy](../anger-galaxy/README.md).

## Safety
Nothing flashes more than three times per second. Firing is drawn as a rate-coded twinkle of
small points, never as synchronous spikes; every large-area brightness change is low-passed
(τ ≥ 0.3 s); the lantern colour never goes below 2,200 K (WCAG saturated-red limit); cerebellar
folia stay below 30 % contrast; `prefers-reduced-motion` slows the camera and stops its drift.
