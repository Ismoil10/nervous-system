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
- **Views.** Three brain views and ten body views; Skeleton off by default.
- **Lungs and breathing** ([research/LUNGS.md](research/LUNGS.md)). The kernel's respiration answers
  emotion: Calm breathes slowly and deeply (≈ 10.5/min × 0.62 L), Stress faster and shallower with
  twice the sighs (≈ 18/min, PaCO₂ ≈ 38), Pleasure hyperventilates towards the climax, with
  breath-holds. CO₂ balances on alveolar ventilation in two pools; SaO₂ comes from the Severinghaus
  curve, EtCO₂ from PaCO₂. One breath clock, in screen time, moves the lungs, the diaphragm, the rib
  cage, the heart and the abdominal organs, sends an airflow front through the airways, and draws
  the RESP trace and the capnogram. The airway tree runs from the trachea to the acini, with the
  pulmonary arteries beside the bronchi; the Lungs view dims everything else.

## Controls
The app opens with a **simple HUD** (`src/ui-simple.js`) of four controls. The person's emotion
and the way the brain is shown are separate: an emotion never moves the camera, and a view never
changes the emotion.
- **Calm · Stress · Pleasure** (bottom): the emotional state.
  - **Calm** stops everything.
  - **Stress** plays the acute stressor. The brain's stress circuit (amygdala, hypothalamus,
    brainstem alarm centres, insula and cingulate) turns blue and brightens as adrenaline rises,
    while the rest of the brain dims.
  - **Pleasure** plays the orgasm scenario, the model's strongest dopamine release, which peaks
    about 45 s after the start. At the climax a bright wave leaves the core dopamine system in the
    midbrain. It runs out along the dopamine fibres and through the whole brain, widening and
    pushing the stars it crosses outward. A smaller wave follows each contraction.
- **View** (above the emotions): Brain, Cutaway, Dopamine system or Body. Next to it, the **style**:
  - **Detailed** (default) draws the body as a dense field of small, sharp stars: about two to three
    times as many as before, with the nervous system (cord, nerves, ganglia, enteric mesh) brighter
    so the travelling signals stand out. Everything takes the colours of anatomy atlases:
    - brain: pink-lavender;
    - spinal cord and nerves: yellow;
    - enteric nerves: yellow-green;
    - muscle: red-brown; bone: ivory; vessels: red;
    - heart red, lungs pink, liver red-brown, spleen purple, kidneys maroon, bladder pale yellow.

    Dopamine keeps its amber.
  - **Stars** is the earlier look, kept as a preset.
  - **Heart** (view button): a close camera on a beating heart with valves, fibres, coronary vessels
    and the conduction system. In the Body, Heart and Lungs views the HUD shows a patient monitor:
    ECG and heart rate, arterial pressure, a fingertip pulse (PLETH) with SpO₂ and the pulse transit
    time, respiration, the capnogram with EtCO₂, temperature, and the adrenaline and cortisol blood
    values. SpO₂ and EtCO₂ are the model's own values (`research/LUNGS.md` §4); SpO₂ stays at
    97–99 % in every state, as in a healthy person.
  - **Lungs** (view button): both lungs breathing, the diaphragm, the airway tree with its airflow
    front, and the pulmonary vessels; everything else dims (`research/LUNGS.md` §7).
  - **Heart close-up** (Detailed; `research/HEART.md` §8). The heart carries its fine anatomy:
    - trabeculae, pectinate muscles and the crista terminalis;
    - papillary muscles with their heads, and chordae that fan out;
    - leaflets with their scallops, nodules and lunulae;
    - the sinuses of Valsalva with the coronary ostia;
    - the fossa ovalis, the coronary sinus ostium and the Eustachian and Thebesian valves;
    - the smaller coronary branches and veins, the epicardial fat and the pericardium.

    As the camera nears the heart:
    - more stars fade in, built in the background on first approach (Medium +60k, High +150k,
      Ultra +250k), so the surface stays fine and continuous;
    - the heart's light does not change;
    - its back dims, so the front reads first;
    - the rest of the body steps back.

    **C**, or the heart button in the top corner, opens the heart along the four-chamber plane, and
    the camera turns to face the cut. Hovering with the mouse, or a long press on touch, names the
    structure under the cursor.
  - **Body close-up** (Detailed; `research/CLOSEUP.md`). Close to the body, every system round the
    point in view gains close-up stars, built in the background: Medium +100k, High +200k,
    Ultra +300k. Nerve fibres, vessels, ganglia, organs, muscle, bone and skin stay crisp instead of
    breaking into a dim scatter.
    - The body in front of that point thins out and the far side dims, so the structures there read
      on their own.
    - On high-resolution screens the canvas renders at full resolution while the GPU has room.
  - **Pulse and vessels** (Detailed): a branching tree of arteries (red) and veins (blue) in fine stars,
    from the aorta (with its root sinuses) to the cerebral, digital and pedal arteries, with the
    vessels of the lungs, liver, kidneys, spleen and gut, and capillary beds coloured from red to blue
    by their oxygen saturation. Each heartbeat sends its pressure wave
    through the arteries at the measured wave speeds, faster under Stress and Pleasure; the total light
    stays constant (`research/PULSE.md`).
  The browser remembers the choice. The body stars follow the human form of `research/BODY-FORM.md`:
  head and face, neck, shoulders, a jointed hand and an arched foot. (The glass shells of 5 November
  were replaced by the Detailed stars.)
- **Quality** (top right): Auto adapts to the computer. It picks a starting tier from the graphics
  hardware, then lowers the render scale or the tier when frames are slow, and raises them again
  when there is headroom. Low, Medium, High and Ultra fix the tier. Auto names the tier it is using.
- **Pause** (top right, or `P`). Keys `1`, `2` and `3` choose Calm, Stress and Pleasure.
- **Camera controls** (`?` button top right, or the `?` key): the navigation below, with buttons
  for the front, side and top views, frame all and fly.

### Camera navigation
The camera follows the conventions of Blender, Maya / 3ds Max and Unreal Engine (`src/camera.js`,
`src/camera-controls.js`). A drag turns the model *with* the hand, as in those tools: the surface
under the cursor follows it.

| | Mouse | Trackpad | Touch |
|---|---|---|---|
| Turn (orbit) | left or middle drag | click and drag | one finger |
| Move (pan) | right drag, Shift + drag, Shift + middle drag | two-finger scroll | two fingers |
| Zoom | wheel, towards the point under the cursor; Ctrl + middle drag; Alt + right drag | pinch | pinch |
| Focus on a part | double-click | double-click | double tap |
| Turn round a point | Alt + click or middle click | Alt + click | — |

- **Focus** flies the clicked part to the centre and closer; it becomes the pivot. The depth is
  read from the stars drawn under the cursor, so a click on the heart through the chest finds the
  heart (`src/view-pick.js`). **Turn round a point** keeps the eye where it is and makes the clicked
  point the pivot.
- The wheel zooms towards what is under the cursor; at the closest distance it keeps moving the
  camera forward, so the camera can pass into the body.
- Keys: numpad `1` `3` `7` — front, side (right), top; with Ctrl, the other side; `Alt` + `1` `3`
  `7` on keyboards without a numpad · numpad `9` — the opposite side · arrows or numpad `4` `6` `8`
  `2` — turn in 15° steps · Shift + arrows — move · `+` `−` — zoom · `Home` — frame everything ·
  `F` or `.` (numpad `.`) — frame the part last focused (the full HUD keeps `F` for full screen:
  use `.`) · `?` — the controls.
- **Fly mode** (`Shift` + `F`, or Fly in the controls): `W` `A` `S` `D` move, `Q` `E` down and up,
  Shift faster, drag to look round (mouse right turns right), the wheel moves forward and back,
  `Esc` leaves. A view button or a framing key also ends it.
- The pitch stops just short of straight up or down, so the view never flips; the distance is held
  between the closest and the farthest view (0.9 and 45 units). Release a drag while moving and the
  turn coasts briefly. Under reduced motion, framing and views cut instead of flying.
- Clicking the scene returns the keyboard to it. The camera keys never take the HUD keys (`P`, `1`
  to `3`, Space, `V`, `H`, `I`), nothing is taken while a field has focus, and the arrows stay with
  sliders and lists.

Top left, a short story says what is happening in plain words. Below it, one meter with its
percentage rises from rest: stress hormones or dopamine. It is the only number on screen. After an
update, reload with Cmd+Shift+R (Ctrl+Shift+R on Windows), so that the browser does not keep old
scripts.

Every other control — interventions, the full stimulus panel, the clock, brain systems, vitals,
dopamine and modulator readouts, performance, and the orgasm scenario's settings and hypotheses —
is in the **full HUD**: open the page with `?advanced=1`. The rest of this section describes the
full HUD.

- Camera: as in **Camera navigation** above. With **Pick on body** armed, a click selects a site.
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
| `src/performance.js`, `src/camera.js`, `src/ui.js`, `src/ui-body.js` | Quality tiers and adaptive quality, camera, full HUD (`?advanced=1`) |
| `src/camera-controls.js`, `src/view-pick.js` | Camera input (mouse, trackpad, touch, keys, fly mode, help) and the depth under the cursor |
| `src/ui-simple.js` | Simple HUD (the default): emotion (Calm / Stress / Pleasure), view and style, quality, Pause; story and one meter |
| `src/heart.js` | `HeartBeat`: the beat clock, conduction timing, Wiggers volumes, valves and the schematic ECG |
| `src/monitor.js` | `MONITOR`, `RespTrace`, `CapnoTrace`, `SpO2Meter`, `isAlarm`, `monitorValues`: the patient monitor's channels, alarm limits, the respiration trace, the capnogram and the oximeter reading |
| `src/breath.js` | `BreathClock`: one breath at a time in screen time from the kernel's respiration (sighs, breath-holds); the diaphragm excursion and rib-cage laws, the airflow front and its energy-conserving mean, the capnogram |
| `src/body/airway-tree.js` | `buildAirwayTree`, `LOBES`, `SEGMENTS`, `lobeOf`, `segmentOf`, `fissureDist`: the airway tree from the trachea to the acini (space-filling, Murray diameters), the lobes, fissures and Boyden segments |
| `src/lung-ui.js` | Lungs view names: the airway, segment or lobe under the mouse |
| `src/pulse.js` | `PulseWave`: the arterial pulse from the beat (arrival delays scaled by the state's wave speed, the energy-conserving mean for `BODY_VS`), the PLETH trace and the pulse transit time |
| `src/body/vessel-tree.js` | `VESSEL_TREE`, `buildDetail`, `pulseSite`: the named arteries and veins, their branches, organ trees and capillary beds, radii (Murray), arrival delays and pulse amplitudes |
| `src/body/heart-form.js` | `HEART_FORM`: heart geometry (ventricles, fibres, atria, valves, vessels, conduction system, fine anatomy); `LABEL_NAMES`; the close-up law (`HEART_LOD`), depth cue and four-chamber section |
| `src/heart-ui.js` | Heart close-up interface: the structure name under the mouse (`pickHeartLabel`) and the section button |

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
