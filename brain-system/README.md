# Brain System

A scientific visualisation of the human nervous system built from stars. The brain is generated
procedurally in MNI space from cool-white stars (neurons); in whole-body mode a clinical figure of
stars carries the brain's networks through the body: somatic, autonomic, enteric, neuroendocrine
and neuroimmune. A deterministic simulation kernel runs underneath in human time: a rate graph of
brain, cord, ganglia and receptors, the heart, vessels and breathing, the gut, hormones and
cytokines, each on its own fixed time step. Signals travel along the nerves as population volleys
at human conduction velocities, slowed only by the clock shown on screen.

The orgasm scenario keeps the dopamine model of the first build: seven dopaminergic cell groups,
nine terminal fields, Michaelis–Menten uptake, D1/D2 receptor binding, autoreceptors, release
plasticity and a reward-prediction-error signal, with prolactin, GABA, endogenous opioids,
serotonin and oxytocin acting as modulators of dopamine. Released dopamine is warm amber lantern
light.

Design and sources: [research/ANALYSIS.md](research/ANALYSIS.md) (Appendix A is the contract,
Appendix B the implementation plan); dopamine model: [research/DOPAMINE.md](research/DOPAMINE.md);
response model: [research/RESPONSE.md](research/RESPONSE.md).

The tone is clinical and non-explicit. The figure has no sex characteristics (male reference
proportions; female proportions are not modelled), and the pelvis holds only schematic nerves and
plexuses, the bladder and the rectum. Human dopamine during sex has never been measured: the
concentrations are calibrated on rat microdialysis and voltammetry, and human imaging (PET, fMRI)
measures blood flow, not dopamine. Every scenario output is a model run with a stated seed, not a
population mean.

## Getting started
Double-click `start.bat` — it starts a local server and opens `http://127.0.0.1:8768/`
(requires Python). Or:

```bash
python3 -m http.server 8768 --bind 127.0.0.1
```

Requires WebGL2 (Chrome, Edge, Firefox). The brain appears first; the body follows in short slices
and fades in within about two seconds. The app opens in whole-body mode with every network on, playing
the orgasm scenario in demo mode on the Dopamine system view, so the dopamine system is active from the
first frame. `?scenario=none` opens at rest (no scenario) on the Upper body view.

Optional URL parameters:

| Parameter | Values | Effect |
|---|---|---|
| `body` | `0`, `1` | `?body=0` starts brain only and generates the body only when Whole body is first chosen |
| `nets` | comma list of `somatic`, `autonomic`, `enteric`, `neuroendocrine`, `neuroimmune`; `all`; `none` | the networks that start on |
| `scenario` | `hotObject`, `loudSound`, `brightLight`, `kneeJerk`, `standUp`, `meal`, `stressor`, `infection`, `orgasm`, `none` | selected at load (default `orgasm`); the orgasm scenario starts at once, the others play when available; `none` opens at rest |
| `seed` | integer | seed of the model streams (default 1 for the orgasm scenario, each scenario's own seed otherwise) |
| `time` | `reflex`, `pain`, `autonomic`, `gut`, `endocrine`, `immune`, `circadian`, or a clock rate | locks the clock |
| `view` | `whole`, `cutaway`, `dopamine`, `wholeBody`, `upperBody`, `headNeck`, `thorax`, `abdomen`, `torso`, `spine`, `rightArm`, `rightLeg` | start view; it also overrides the fly-to when a scenario is chosen |
| `quality` | `low`, `medium`, `high`, `ultra` | fixes the quality tier |
| `safetyMonitor` | `1` | reads back the composited luminance for the photosensitivity audit |

`?body=0&scenario=orgasm` runs the orgasm scenario in brain-only mode (its central form: the
coupling of arousal to peripheral vasocongestion is removed, and the vitals read "—").

## Features
- **Body.** Brain only or Whole body, and one switch per network. A switched-off network fades to a
  grey ghost at 8 % brightness as its gain ramps down over one second of human time.
- **Interventions.** One at a time: spinal cord injury (level, type, phase), nerve section (nerve,
  day), dorsal rhizotomy, heart transplant, atropine, truncal vagotomy, T2–T3 sympathectomy, pure
  autonomic failure, adrenalectomy, hypophysectomy, splenic denervation and vagus nerve stimulation.
- **Stimulus.** Ten senses (vision, hearing, touch, pain, temperature, smell, taste, balance,
  proprioception, interoception) with their modes and physical intensities. Pick a site on the
  figure or from the keyboard site list; the readout gives the dermatome, nerve, segment and path
  length. Before onset the clock slows so that the first volley stays visible. In brain-only mode
  only the special senses are offered. No sound is ever played, and a light stimulus is a local glow
  in the eye, never a screen flash.
- **Scenarios.** Touching a hot object, sudden loud sound, bright light, knee jerk, standing up,
  eating a meal, acute stressor, infection and fever, and orgasm – dopamine. Play, stop, restart,
  repeat (habituation kept) and seek on a log-time scrubber; scenarios that need the body are greyed
  in brain-only mode.
- **Time.** One clock sets the rate (human seconds per screen second, ×1/200 to ×3,600). It slows
  by itself while fast signals are in flight; Lock and the seven presets fix it. When the model
  cannot keep up within its CPU budget, the clock rate drops instead of the step size.
- **Brain systems.** Display overlays (thalamocortical, basal ganglia loops, cerebellar loops,
  limbic, hypothalamus, brainstem centres, large-scale networks) and the arousal state.
- **Vitals and Live.** Heart rate, blood pressure, respiration, pupils, skin conductance,
  temperatures, gut motility, cortisol, adrenaline, IL-6 and sickness behaviour, with network-off
  tags and 60-s traces; an event log of arrivals and switches, newest first.
- **Views.** Three brain views and nine body views; Skeleton off by default.

## Controls
- Left drag — rotate; right or middle drag, Shift/Ctrl + drag, or a two-finger drag — pan; wheel or
  pinch — zoom towards the point under the cursor; double click — fly halfway in towards that point.
  With **Pick on body** armed, a click selects a site.
- `B` — brain only or whole body · `L` — lock the clock · `[` `]` — clock one decade slower or faster
- `Enter` — apply the stimulus (focus in Stimulus) · `Esc` — cancel picking, close a dropdown or dialog
- `P` — pause · `V` — next view · `H` — hide the HUD · `F` — fullscreen · `I` — About
- Orgasm scenario only: **Demo** mode (default) plays a scripted stimulation and repeats the cycle
  (about 2 minutes); **Manual** mode: hold **Stimulate** or Space, or set a steady level with the
  slider (pressing Stimulate during Demo switches to Manual with the slider at zero). **Distract** or
  `D` is an inhibitory cue (it pauses midbrain dopamine neurons through the GABA brake). The
  scenario block also holds the response profile, refractory duration and post-orgasm hypothesis.

## Network switches
An edge runs only while the body is shown and **every** network it lists is on, so switches compose
by the edge mask alone. Switching ramps the network gain between 0 and 1 over 1 s of human time;
efferent gains act at the effector after the dead time, so a command in transit is cut with the
nerve. "Off" means denervation for nerves (states relax by their own kinetics) and basal
replacement for hormones (never zero). Brain nodes always keep computing their commands, shown as
"efference only" packets that end at the port. Brain-systems overlays are display only.

| Switch off | What turns off | What keeps running | HUD |
|---|---|---|---|
| Master → Brain only | every body node and edge; non-special afferent ports go silent | the whole CNS (rate graph, arousal states, rhythm generators, commands, modulators, dopamine); special senses enter at their first central station; blood-borne inputs held at basal | body vitals "—" |
| Somatic | spinal and trigeminal touch, pain, temperature and proprioception; motor neurons, cranial motor output, somatic reflexes | special senses, the central respiratory rhythm, motor commands (efference only), the other networks | EMG and force 0; "ventilation maintained (model assumption)" |
| Autonomic | sympathetic and parasympathetic outflow, adrenal medulla drive, visceral afferents (baroreflex and chemoreflex loops open) | the sinoatrial node at its intrinsic rate, myogenic tone, the enteric nervous system, central CO₂ chemoreception | HR "intrinsic"; pupils "fixed"; skin conductance "denervated" |
| Enteric | myenteric and submucosal reflexes, migrating motor complex, secretomotor reflexes | slow waves, enteroendocrine release, extrinsic nerves | gut motility "≈ 0" |
| Neuroendocrine | pituitary release, adrenal hormone action, RAAS and AVP pressor action, distant gut-hormone actions | hypothalamic commands (tints), neural networks | hormones "basal" |
| Neuroimmune | immune → brain and brain → immune routes, fever shift, sickness behaviour | the innate response in the tissue; the set point stays 37.0 °C | cytokines shown; set point flat |

Cross-network edges need every listed network, for example adrenal adrenaline (autonomic and
neuroendocrine), the inflammatory reflex (autonomic and neuroimmune; its efferent route is
contested), vagal motor drive to the gut wall (autonomic and enteric) and the pupillary light
reflex (special senses and autonomic). Returning to Whole body restores the resting steady state of
the current switch set.

## What you see

| Element | Meaning |
|---|---|
| Cool-white stars | Neurons; brightness follows regional activity (1 at rest) |
| Body stars | Tissue, not cells: skin, organs, muscle, cord, ganglia, the enteric mesh, vessels; nerves are fibre bundles, not axon counts |
| Packets | Population volleys at modelled human conduction velocities along schematic routes; afferent packets always have the coolest colour |
| Grey ghosts | Networks switched off (8 % brightness, desaturated) |
| Amber lanterns | Extracellular dopamine in a terminal field (orgasm scenario); the glow spreads outward from the field centre as the concentration rises |
| Amber sparks and threads | Release sites and dopamine pathways (travel slowed for visibility) |
| Ember clusters | Dopamine cell bodies (VTA, substantia nigra, A11–A14) |
| Faint tints | Modulators on their source nuclei: prolactin (pituitary), serotonin (raphe), GABA (RMTg), opioids (periaqueductal grey and arcuate) |

Nerves, ganglia, adrenal glands and small nuclei are enlarged for legibility; sense organs,
brainstem relays and some body coordinates are estimated positions.

## Tests and type check
From `brain-system/`, with Node 24 or later:

```bash
npm test
```

runs the headless suite (`node --test`). The simulation core is type-checked without a build step:
`src/sim/contracts.d.ts` states the contracts (graph plugins, nodes and edges, the kernel API,
stimuli, scenarios, interventions) and the files that start with `// @ts-check` are checked
against them. The browser never loads the `.d.ts` file and nothing is compiled:

```bash
npm run typecheck
```

`typecheck` runs `tsc -p .` and needs TypeScript's `tsc` on PATH (it is not an npm dependency).
`test/runtime.test.mjs` drives the app's frame loop headless (`src/sim/runtime.js`): the orgasm
scenario through the integrated loop equals the stand-alone adapter loop at every frame, and the
HUD actions reach the kernel.

## Structure
| File | Purpose |
|---|---|
| `src/main.js` | Entry point: generation, the frame loop, picking, views and HUD wiring |
| `src/sim/runtime.js` | The DOM-free frame loop: clock, orgasm adapter, kernel and scenario player, and the HUD actions |
| `src/clock.js` | `SimClock`: the one owner of the clock rate (user lock › scenario delegate › keyframes › adaptive) |
| `src/sim/kernel.js`, `src/sim/graph.js` | Multi-rate simulation kernel on fixed human-time grids; graph schema and plugin contract |
| `src/sim/brainnet.js`, `sensory.js`, `somatic.js`, `autonomic.js`, `enteric.js`, `endocrine.js`, `immune.js` | The network modules (kernel plugins) |
| `src/sim/stimuli.js`, `scenarios.js`, `interventions.js`, `orgasm-adapter.js` | Stimulus records and sites, the scenario player, intervention presets, the orgasm adapter |
| `src/anatomy.js`, `src/brain.js` | MNI coordinates of every structure; brain point populations and the new-nuclei buffer |
| `src/body/frame.js`, `geometry.js`, `generate.js`, `picking.js` | Body frame, figure geometry and nerve routes, body point generation, site picking |
| `src/dopamine.js`, `src/response.js` | The dopamine model and the sexual-response driver of the orgasm scenario |
| `src/shaders.js`, `src/renderer.js`, `src/statetex.js` | Star, body, dopamine and lantern shaders; HDR, bloom and tonemapping; model state as data textures |
| `src/wiring.js` | Kernel packets onto body paths, network ghosts, limb pose, overlay members |
| `src/safety.js` | Photosensitivity limiter and display-rate rules |
| `src/color.js` | Planck and CIE colours (neurons 7,000–9,500 K, body ≥ 5,500 K, dopamine 2,300 K) |
| `src/performance.js`, `src/camera.js`, `src/ui.js`, `src/ui-body.js` | Quality tiers and adaptive quality, camera, HUD |

Rendering assets (HDR pipeline, bloom, star point-spread function, adaptive quality, HUD style)
come from the Orgasm Galaxy project (removed on 2026-11-02; its response-model analysis lives on as
[research/RESPONSE.md](research/RESPONSE.md)).

## Safety
No part of the screen flashes more than three times per second, and there are no red flashes. A
photosensitivity limiter watches every 10° window of the screen each frame (packets, the body, the
lanterns) and scales the packets in a window, newest first, before it would register a third flash
or change by more than 10 % of maximum in a third of a second. Firing is drawn as a rate-coded twinkle of small points, never as
synchronous spikes; toggles and the body fade in over at least 0.8 s; every large-area brightness
change is low-passed (τ ≥ 0.3 s); the lantern colour never goes below 2,200 K. Reduced motion
(the system setting or Settings › Reduced motion) stops limb motion, auto-rotation and travelling
dopamine flow, halves twinkle and turns camera flights into cross-fades. Flashing is limited to
WCAG 2.3.1 thresholds; this lowers but does not remove risk for photosensitive viewers.
