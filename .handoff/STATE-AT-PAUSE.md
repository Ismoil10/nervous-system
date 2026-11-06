# Brain System build: state at the pause

The build was paused on **Thursday 5 November 2026 at about 01:30 (Windows local time, UTC+5)**, at the
user's request, to continue on another computer. It ran on the user's Windows 11 computer after the move
from the Mac (the Mac pause state is this file at commit `71e27cd`).

The Windows work was done on the branch **`wip/brain-build-windows`**, cut from `main` at `1e65443` (the
merge of the Mac pause branch). It is now merged into `main` (pull request #2, merge commit `0101203`), so
`main` holds all the work and the same tree as the branch tip. Continue on a new branch cut from `main`
(decision 7). The commits, oldest first:

| Commit | Content |
|---|---|
| `5712f4c` | Windows setup: `-win` launch entries, golden traces re-recorded on x64, `.gitignore` |
| `2d6e9aa` | Stage 5 integration and the fixes from the first browser review |
| `dcd5325` | Stage 6: ANALYSIS.md fact-check round 2 and the opening-rule amendments |
| `e503a9d` | This handoff: this file, `RESUME.md`, the stage 6 results and the partial PARAMS patch |
| `b9136d0` | The rebuilt graph (`graphify-out/`) |
| `0101203` | Merge of pull request #2 into `main` |

When this file disagrees with older notes in `.handoff/`, this file wins. `RESUME.md` holds the setup and
the resume prompt. `HANDOFF-PROMPT.md` and `RESUME-ON-WINDOWS.md` are superseded.

The specification is `brain-system/research/ANALYSIS.md`. Appendix A is the binding contract; Appendix B
is the implementation plan. The orgasm scenario's internals are in `brain-system/research/DOPAMINE.md`.

---

## 1. Build stages

| # | Stage | Status | "Done" was checked against |
|---|---|---|---|
| 1 | Phase 0a, tests green, goldens from the post-port legacy path | **Done** (Mac) | `dopamine.test.mjs`, `orgasm-regression.test.mjs` |
| 2 | App driven through `OrgasmAdapter` and `SimClock` | **Done** (Mac) | Browser check; regression test |
| 3 | Phase 2–3 modules and the B.14 tests | **Done** (Mac) | Their tests |
| 3b | TypeScript contracts through JSDoc | **Done** (Mac) | `npm run typecheck` exit 0 |
| 4 | Five network modules and interventions as `graph.js` plugins | **Done** (Mac) | Workflow, two skeptics, fixer, suite |
| 5 | Integration: `main.js`, runtime, body pass, PhotoLimiter, HUD wiring, README | **Done** (Windows) | Suite and tsc (§4); browser check (see below); review of the diff; graph impact check |
| 6 | ANALYSIS fact-check round 2, folded into `PARAMS` | **Partly done** (§5) | Fact-check applied to ANALYSIS.md and committed; the PARAMS fold was interrupted |
| 7 | Add the docs to the graph semantically | Not started | |
| 8 | Code review (8a), browser verification (8b), wrap-up | Not started | |

**Stage 5 browser check** (Windows, port 8768, entry `brain-system-win`):
- whole body generated and faded in, brain and HUD rendered, no console errors;
- a touch on the right palm reached `s1.hand` at 22 ms with 163 packets, and the clock descended to
  ×1/200;
- `hotObject` and `loudSound` ran through their stages on their keyframed clocks;
- `?body=0&scenario=orgasm` passed Baseline → Orgasm with vitals "—", HUD dimming and auto-spin stop at
  the climax;
- after the fixes: the body is clearly visible from Whole body to Thorax; zoom-to-cursor and pan were
  checked numerically; the default load plays the orgasm demo, and `?scenario=none` opens at rest.

## 2. What was built on Windows

**Stage 5 integration** (commit `2d6e9aa`):
- `src/sim/runtime.js` (new) is the DOM-free frame loop. It holds SimClock, the OrgasmAdapter, the Kernel
  with all seven plugins (the adapter's command ring is its orgasm command source) and the
  ScenarioPlayer, plus the HUD actions. The per-tick contract is kept:
  ```js
  clock.setAdaptiveTarget(isFinite(k.khTarget()) ? k.khTarget() : khIdle);
  const s = clock.advance(sdt);
  clock.settleDelegate(adapter.advance(sdt, s.t0H, s.h, s.source), adapter.kh);
  model.events.length = 0;
  dopamine.updateVisuals(sdt, model, clock.kh);
  const behind = clock.tH - k.t > s.h;        // backlog over one frame → no budget (§11.14)
  clock.commit(player.advanceTo(clock.tH, behind ? Infinity : TIERS[tier].kernelMs));
  brainnet.updateVisuals(sdt);
  ```
- `src/main.js` (rewritten):
  - body generation in 8-ms slices after the first brain frame, the body pass and its fade-in;
  - packets placed on body paths;
  - PhotoLimiter (its factors scale packets only);
  - picking; body views and camera limits (§13.11);
  - URL parameters `body`, `nets`, `scenario`, `seed`, `time`, `view`, `quality`;
  - every ui-body.js handler;
  - the HUD payload (`hudVitals`, `hudId`, `scenarioUnavailable`, event log, kernel ms);
  - `window.__brain` with `tick(now)`, `runtime`, `kernel`, `player`, `clock`, `adapter`, `body`, `safety`,
    `camera`, `renderer`, `tune` and `setView`.
- `src/wiring.js` (new): the `PacketMap` that `statetex.js` names, the network ghosts, the limb pose and the
  overlay members.
- `src/renderer.js`: a Skeleton toggle.
- `src/ui-body.js`: `setToggleAvailable`, which greys toggles the renderer cannot draw.
- `test/runtime.test.mjs` (6 tests): the orgasm run through the runtime is bit-identical to the old loop.
- README rewritten.

**Fixes from the user's first browser review** (same commit):
- Body too dark: `tune.body` 1 → 6 in `main.js`.
- Free zoom (`src/camera.js`):
  - the wheel and a pinch zoom towards the point under the cursor;
  - a right or middle drag, a Shift/Ctrl drag or a two-finger drag pans;
  - a double click flies halfway in;
  - a camera test was added to `test/shaders.test.mjs`.
- Dopamine waves at load: the app opens playing the orgasm scenario again (§3).

**Stage 6 fact-check** (workflow, 9 agents, script `.handoff/workflows/brain-system-analysis-factcheck-r2.js`):
- Four lenses (sonnet, high): anatomy/rendering/safety, neural physiology, visceral physiology, and
  integration/switches. One skeptic per lens, then one editor.
- Findings:
  - 14 major reported, 12 confirmed and 2 refuted;
  - 47 minor;
  - 12 verdicts on the stage-4 calibrations.
- The editor made 114 changes to ANALYSIS.md (64 numeric) across §1–§14 and Appendices A and B.
- The full result is in `.handoff/results/stage6-factcheck-r2.json`: `confirmed`, `rejected`,
  `calibrations`, and `edit.changes` with before/after.

## 3. Decisions of the user

**Made on Windows (4–5 November 2026):**
1. **Golden traces are platform-specific.** `test/golden/orgasm-legacy.json` was re-recorded on Windows
   x64 (Node 26.13) with the user's approval, before any stage-5 change. The Mac (arm64) golden differed only
   in the last bits of floating-point state, with one snapshot value off by 1 ulp. The legacy-vs-adapter
   identity tests passed throughout. On another CPU architecture the four golden tests may fail the same
   way: tell the user and ask before re-recording. Never re-record to make a code change pass.
2. **Brain-only orgasm = the §11.14 central form.** With `?body=0` the κ coupling is removed, so onset comes
   later (55.2 s vs 43.1 s screen time at 60 fps) and the vitals read "—". With every network on in
   whole-body mode, the traces equal the legacy path. ANALYSIS.md B.5 was amended to match.
3. **The app opens playing the orgasm scenario** in demo mode on the Dopamine system view, as it did before
   the whole-body build. `?scenario=none` opens at rest on the Upper body view. ANALYSIS.md §1, §13, A.7 and
   B.9 were amended to match (`DEFAULT_SCENARIO` in `main.js`).
4. **Body brightness** `tune.body` = 6 [model, browser check].
5. **Free camera:** zoom towards the cursor, pan and double-click fly-in.
6. **anger-galaxy has no connection to this project.** The README link to it was removed.
7. **Git:** work on a `wip/` branch, never on `main` itself; commit only when asked (the user asked for
   these commits). Push only when asked. The Windows work was on `wip/brain-build-windows`; after its merge
   into `main` (5 November), cut each new work branch from `main` and name it after the computer (for
   example `wip/brain-build-mac`).

**Made on the Mac after the merge (5 November 2026):**

8. **Simple HUD by default.** The 13-dropdown HUD was too much for an average user.
   A first simple HUD (scenario rail, senses, views, networks; commit `34ce9ea`) was still too much:
   the user could not tell how to start anything, and stress had no visible effect. So the default
   is now `src/ui-simple.js`; its controls were reworked again in decision 11. It first had three controls:
   - Calm / Stress / Dopamine;
   - Look at Brain / Body (the camera only);
   - Pause.

   The readouts are a plain story and one meter (stress hormones or dopamine).
   - Stress plays `stressor` and draws the stress circuit on the brain. It is display only [model]:
     an overlay ×2.2 on the circuit and ×0.45 elsewhere, plus a blue BrainNet tint, scaled by the
     adrenaline meter. Without it the stressor changed only hormones and the heart rate; the scene
     stayed almost unchanged (`kernel.display` is empty and `setOrgans` is never called).
   - Dopamine plays the orgasm demo.
   - The full HUD stays behind `?advanced=1`, with nothing deleted.
   - `<body>` carries no HUD class in the markup: main.js adds `hud-simple`. A browser that keeps an
     old cached `main.js` then still shows a working full HUD instead of a dead simple one. This was
     the likely cause of "the simulation stopped working".

   ANALYSIS.md B.10 records the design. Tests: `test/hud-simple.test.mjs`.
9. **The pre-build dopamine wave is back in the simple HUD.** The user said the bright wave that
   radiated from the nucleus through the brain at the dopamine peak had been there before the body
   build and changed after it. They asked for it to start in the core dopamine system and run out
   along the fibres. They said it was modelled on the anger wave of `anger-galaxy/`, and for this
   task they allowed reading that project read-only ("Ha, faqat o'qish"; nothing there was changed;
   the scope rule in CLAUDE.md otherwise stands).

   The simple HUD now restores:
   - pulse-locked climax reward;
   - fibre flow with 0.5-s travel;
   - no 2-s glow floor during the climax;
   - an expanding shock-wave-style wave from the VTA (`shaders.js` `WAVE`, shared by `NEURON_VS` and
     `DA_VS`; `renderer.setWaves`; `main.js` `updateWaves`). One slow bright shell starts at the
     climax and a faster, weaker one with each contraction. The front widens, pushes the points it
     crosses outward and lights the dopamine somata, fibres and release sites.

   This stays under 3 shells a second, and reduced motion is respected. The full HUD (`?advanced=1`)
   keeps the DOPAMINE.md display. The pre-build code itself is not in git (only the Windows
   `.handoff/backup-brain-system-pre-build/` has it), so the wave is a reconstruction. Ask the user
   whether it matches.
10. **UI numbers and buttons.** The meter shows its percentage, the only number on screen. The
   buttons are small, with 5–9 px corners.
11. **Emotion and view are separate states; Quality is back.**
   - The simple HUD has four controls: emotion (Calm / Stress / Pleasure), view (Brain / Cutaway /
     Dopamine / Body), Quality (Auto or a fixed tier) and Pause.
   - An emotion never moves the camera, and a view never changes the emotion.
   - Adaptive quality (hardware start tier, then frame-time scaling of render scale and tier) was
     already in `performance.js`, the same logic as `anger-galaxy/`. Only the manual control had
     been missing from the simple HUD. `main.js` `setQuality` now serves both HUDs.

12. **Glass style (stage 1 of the visual upgrade); Stars kept as a preset.** The user asked for a
   more precise, translucent, crisp model and chose stage 1 of the proposal: glass shells from the
   existing procedural fields, with no downloaded data.
   - `src/glass.js` meshes them with surface nets at load: cerebrum with pressed-in folds,
     cerebellum, skin, and the heart, lungs, liver, spleen, kidneys and bladder from `ORGANS`. The
     work is sliced and the grid is finer at higher tiers.
   - `shaders.js` `GLASS_VS/FS` with `renderer.setGlass` / `_drawGlass` draw them as additive glass.
   - The simple HUD's style choice is Glass (default) or Stars (the earlier look, kept exactly as a
     preset at the user's request). It is remembered in `localStorage`.
   - Stage 2 (real meshes: BodyParts3D or Z-Anatomy organs, MNI surfaces, HCP1065 tracts; CC BY-SA)
     waits for the user. It would change DOPAMINE.md §7.2 ("no downloaded meshes").
   - After the user's first test:
     - Field blur and Taubin smoothing remove the bumps and indents where `bodySDF` switches
       primitives; the skin now follows the human form.
     - Rotation lag is fixed: the shells were Ultra (≈ 1M triangles). They are now meshed at the tier
       that renders, are coarser and cull back faces.
     - Brain flicker is fixed with `fwidth` fading on thin folds and shallower glass folds
       (`FOLD_SCALE` 0.25).
     - Distinct anatomical colours (user request): brain pink-lavender, nerves and cord yellow,
       organs in atlas colours; dopamine keeps amber.

13. **The skin follows an analysis of the human form.** The user said the body was not a proper
    human shape and asked for the form to be analysed first.
    - `research/BODY-FORM.md` is that analysis. It sets ANSUR II 50th-percentile targets, made
      sex-neutral at 1,760 mm, and walks the surface anatomy region by region. It lists the defects
      of the old mannequin, the modelling method and the acceptance criteria.
    - `bodySDF` in `src/body/geometry.js` now builds the skin from `FORM`:
      - front/back superelliptic torso sections;
      - deltoid, trapezius, pectoral, scapular and gluteal masses;
      - profiled limbs with the calf, knee, malleoli and thenar eminence;
      - arms joined with a crease;
      - seamless guards; segment caps that never share a joint plane.
    - Unchanged: the joints, landmarks, head, neck, internal `sdTorso`, organs, routes and sites.
    - `test/body-form.test.mjs` checks the result.
    - The waist is narrower than ANSUR II, because the elbows at x 195 would otherwise fuse into it.

14. **Head, face and body second pass; the glass no longer flickers.** The user asked for the head,
    face and body to read as a true human form, keeping the transparency. They also reported the
    body flickering in Glass while rotating.
    - `BODY-FORM.md` §8–§9 and `geometry.js`:
      - `HEAD_FORM`: cranium, face, almond eye fissures (`eyeFissure`), nose, lips, ears;
      - the neck as torso sections, with the sternomastoids;
      - clavicles and axillary folds; the deltoid joined to the arm with a height-dependent radius;
      - `HAND_FORM` and `FOOT_FORM`;
      - a Hermite section spline;
      - joints without bands.
    - Flicker: the glass rim is thinner than a pixel on limbs seen from afar. The background and the
      shells are now drawn with 4× MSAA and resolved into the scene (`renderer._glassTarget`, where
      the format allows it). The flickering pixels fell about tenfold.
    - A glass remesh now also waits until the camera has rested for 1 s.

15. **Glass replaced by a dense star model.** The user found the glass shells distorted and jagged.
    They asked for a sharper, denser particle model, with the nervous system brighter so the signals
    read.
    - `glass.js`, the glass shaders and the MSAA pass are gone.
    - Body budgets per tier are now 78.5k / 151k / 248.5k / 378k (skin and nerves ×3, cord ×2.5,
      organs, ganglia and enteric mesh ×2, the rest ×1.5).
    - The simple HUD style is Detailed (default) or Stars, through renderer `PARAMS.style`:
      - Detailed draws every star at 0.8 × size, in anatomical colours. The nervous system gets
        boost 1.6–2.0, and the skin 3.4 for the silhouette.
      - Stars culls each class to its earlier share (`uKeep`), so it keeps the earlier look.
    - A stored "glass" choice opens as Detailed.

16. **Heart model.** The user asked for a realistic, beating heart. Details are in
    `brain-system/research/HEART.md`.
    - `src/body/heart-form.js` (`HEART_FORM`) and `heartEntries` in `generate.js`: ventricles with
      helical fibres, atria, valves and leaflets, papillary muscles, great vessels, coronary vessels
      and the conduction system.
    - `src/heart.js` (`HeartBeat`): beats in screen time (steady glow above 150 bpm), PR, QT
      (Fridericia), Wiggers volumes, valve timing and a schematic ECG. Rate, RSA and contractility
      come from the simulation.
    - Display: a Heart view, heart stars ×2.2 and the rest ×0.18; the simple HUD shows beats per
      minute and an ECG trace.
    - Organ budget 22k / 44k / 72k / 116k; body totals 88.5k / 171k / 280.5k / 430k (the heart takes
      55 % of the organ stars).
17. **Patient monitor.** The heart-rate readout is replaced by a bedside-style monitor. Details are in
    `brain-system/research/HEART.md` §7.
    - `src/monitor.js` (`MONITOR`, `RespTrace`, `isAlarm`, `monitorValues`) and `#shud-monitor` with
      `SimpleHud.drawMonitor` in `src/ui-simple.js`. The arterial wave, `arterialWave`, is in `src/heart.js`.
    - Channels: ECG and HR, ART, RESP, TEMP, and the orange model blood values ADR and CORT. A value
      outside its limits turns yellow and never flashes.
    - Every trace runs in screen time. SpO₂ and capnography are not shown, because the model does not compute them.
18. **Arterial pulse and vascular tree.** The user asked for the pulse wave of each heartbeat on a
    denser, realistic vascular network. Details are in `brain-system/research/PULSE.md`.
    - `src/body/vessel-tree.js` (`VESSEL_TREE`, `buildTwigs`, `pulseSite`): 140 named arteries and veins
      (aorta to the cerebral, digital and pedal arteries; cavae to the saphenous veins and dural
      sinuses) and 1,223 twigs, radii by Murray's law; each artery point carries its arrival delay
      (path ÷ PWV) and pulse amplitude.
    - `src/pulse.js` (`PulseWave`): the time since the aortic valve opened, the delay scale k from MAP
      and HR, the amplitude G from the pulse pressure, the energy-conserving mean (`BODY_VS` `uPulse`),
      the PLETH trace and the PTT on the monitor. No SpO₂.
    - Display: Detailed draws the tree (arteries red, veins blue) instead of the earlier great vessels;
      Stars keeps the earlier look. `uAnat` and `uSizeK` became `uStyle`, so `BODY_VS` stays at 110 slots.
    - Vessel budget 18k / 36k / 60k / 96k (the tree 87.5 %); body totals 104,250 / 202,500 / 333,000 / 514,000.
    - The user decided to keep the Stars style as it is: no tree there (`keepTree` 0, the earlier look).
    - Second pass, at the user's request ("all aortas, arteries, veins and capillaries down to the finest
      details", PULSE.md §13): the aortic root sinuses; 314 named vessels; `buildDetail` with twigs
      three generations deep, organ trees (lungs, liver, kidneys, spleen), gut arcades and the marginal
      artery, intercostal and lumbar vessels, venous valves, vasa vasorum and 15,668 capillary strands
      coloured by oxygen saturation. Part codes 1–7 for the tree, 8–9 for the earlier great vessels.
      Vessel budget 36k / 72k / 120k / 192k; body totals 122,250 / 238,500 / 393,000 / 610,000.
    - Next decision for the user: whether the denser vessels and their brightness suit them, and
      whether the larger Ultra budget (610,000 stars) runs smoothly on their other computer.
19. **Camera navigation as in Blender, Maya / 3ds Max and Unreal.** The user found the orbit camera
    awkward, and the model turned against the hand. Details are in `brain-system/README.md`
    ("Camera navigation").
    - `src/camera.js` keeps only the maths:
      - orbit, look and pan; zoom about a point (`zoomAbout`), with a dolly on through the near limit;
      - eased wheel zoom, focus, pivot, framing, the axis views and fly mode;
      - the pitch stops at π/2 − 0.002;
      - the drag direction follows the "grab" convention (`dragAngles`): the surface under the
        cursor follows it. Before, both axes were reversed.
    - `src/camera-controls.js` handles the input:
      - mouse, trackpad (wheel kind from `wheelDeltaY`, Safari gesture events) and touch;
      - capture-phase keys that leave the HUD keys alone;
      - the `?` panel, the first-visit hint (three shows) and the pivot ring.
    - `src/view-pick.js` reads the depth under the cursor from the stars: the first layer that
      reaches 35 % of the densest layer along the ray.
    - The near limit (0.9) and the brightness law are unchanged. Release inertia comes from the last
      80 ms of the drag and is capped at 0.05 rad per frame.
    - Next decision for the user:
      - whether the grab direction and the speeds feel right on their mouse and trackpad;
      - whether a double-click on the chest should prefer the nearest structure. Today it can pass
        a sparse front layer for the bright cord behind it.

20. **The heart in close-up detail** (`brain-system/research/HEART.md` §8). The user asked for the
    finest anatomical elements, crisp when the camera is close. They chose:
    - all four groups of structures;
    - a depth cue and a section opened on request;
    - names on hover only;
    - close-up stars built on demand: Low +0, Medium +60k, High +150k, Ultra +250k.

    What was built:
    - **Fine anatomy** in `HEART_FORM` and `heartEntries`, as parts 16–20, with 98 structure names
      in `LABEL_NAMES`. Each star stores its structure id / 128 in the path-position slot.
    - **Close-up stars** (LOD 4), built in slices by `generateHeartCloseUpChunks`.
      - The density law is (q/q0)² per star, with q0 = 4.5 px/mm.
      - Every heart star's flux is divided by the expected drawn density, so the heart's light is
        conserved.
      - D_max is in `uPulse.w`.
    - **The depth cue** (Detailed). The heart's focus `uHeartK.w` is continuous: it covers the Heart
      view and the camera close to the heart.
    - **The four-chamber section**: the C key or the corner button. The amount is in `uHeartV.w`.
      - The camera turns to face the cut in the Heart view.
      - A cut-face layer (LOD 5) of 30k / 60k / 100k stars is drawn while the heart is open.
    - **Hover names** in `src/heart-ui.js`.
    - **Stars** draws no fine anatomy, and its heart share keeps the earlier 2,400 stars.
    - `BODY_VS` stays at its 110-slot limit.
    - The close-up costs 0.5–0.9 ms of GPU time on an M4 at High.

    Next decision for the user:
    - whether the close-up density and the depth cue read well on their screen;
    - whether the conduction system (gold) should be quieter in the section view;
    - whether hover names are wanted on touch, for example on a long press.

21. **Body close-up clarity** (`brain-system/research/CLOSEUP.md`). The user reported that the
    systems, fibres and organs went blurry when zoomed in.

    Measured causes:
    - a fixed star count per structure: about 330 stars in a 30-mm sphere of the abdomen;
    - Gaussian-cloud geometry;
    - overlapping layers;
    - rendering at 75 % of a Retina screen's pixels at High.

    Bloom was ruled out. The brain stays crisp and is unchanged.

    The user chose the full focus region, full resolution when close, a quieter conduction system in
    the opened heart, and names on touch.

    What was built:
    - **The focus region.** `generateFocusRegionChunks` runs the body generators in a region mode:
      - curves sample only near the sphere;
      - other entries are probed and rejected outside it;
      - skin, cord, gut rows and haze have custom samplers.

      It holds k × the body's stars in the sphere round the pivot, with a per-class flux correction.
      The stars are tagged LOD + 8. A region takes 45–110 ms and is sliced.
    - **The shader.** It applies the heart's density law with q0 = 2 px/mm. The region's stars give
      back the density only to the power 0.25 (`PARAMS.focus.conserve`). With full conservation the
      close-up was a dim fog.
    - **The focus slab** (Detailed): the body in front of the pivot thins out and the far side dims.
    - **`uFocus[2]`** reuses 8 slots freed by `JOINT_SLOTS` 20 → 16 (`rigidAt` uses 0–13). `BODY_VS`
      now uses 104 of its 110 slots.
    - **Full resolution** up to dpr 2 within 600 mm while the GPU has room.
    - **The heart:**
      - the conduction system dims to 0.55 × in the opened heart;
      - a long press on touch names a structure.
    - Nerve streamlines now come from a seeded stream per path.

    Next decision for the user:
    - whether the brightness of the close-up suits them;
    - whether the region size and the slab feel natural when they zoom and pan.

    `PARAMS.focus.conserve` sets the close-up brightness: 0 keeps each star's light, 1 keeps the total
    light. The region size and the slab are set by `FOCUS` in `main.js` and `PARAMS.focus.front` and
    `.back`.

22. **Lungs and the respiratory system** (`brain-system/research/LUNGS.md`). The user asked for an
    analysis of the lungs and the respiratory system. Before building, they chose:
    - the lungs only for now, to the finest detail; the other organs later, one system at a time
      (LUNGS.md §10 proposes the order: gut, then liver, pancreas, spleen and the portal circulation,
      then kidneys and bladder, then the endocrine glands, then the reproductive organs);
    - all four display parts: the airway tree with the acini, the breathing motion, the airflow
      front, and a Lungs view;
    - SpO₂ and CO₂ (capnogram and EtCO₂) on the monitor;
    - the kernel extension, with Calm as relaxed slow, deep breathing.

    Measured before the change: `rr` stayed at 14 and `vt` at 0.5 through Stress and Pleasure, so
    nothing drove breathing from emotion.

    What was built:
    - **The kernel** (`Autonomic._resp`):
      - CO₂ on alveolar ventilation, in two pools;
      - a behavioural drive from the stressor, the arousal record (read with every network on: a
        deliberate change to the §11.14 "record ignored" rule for the respiratory layer only) and
        the HUD's `relax` input;
      - sighs, the acute pH, SaO₂ (Severinghaus) and EtCO₂.

      Calm runs at 10.5/min × 0.62 L, Stress at 18/min with PaCO₂ 38, Pleasure at up to 26/min with
      breath-holds. Rest is unchanged.
    - **The airway tree** (`src/body/airway-tree.js`, built by a subagent): 27,305 branches, 5 lobes,
      18 segments, fitted fissures, the carina at z −274.
    - **The lung stars:** they take 31.75 % of an organ budget that grew by a third; every other
      organ keeps its count, and the body totals are now 129,583 / 253,167 / 417,000 / 648,667.
      Also:
      - pulmonary arteries beside the bronchi;
      - a diaphragm sheet;
      - the breathing field and the airflow front in `BODY_VS` (106 of its 110 slots);
      - the breath clock (`src/breath.js`);
      - the Lungs view with names (`src/lung-ui.js`);
      - SpO₂ and a CO₂ row on the monitor.

    Next decision for the user:
    - whether the airway tree reads clearly enough in the Lungs view and close up;
    - whether the breathing depth and the airflow front suit them;
    - which organ system comes next.

    The airway's legibility is set by `PARAMS.lung.share` (generate.js) and `PARAMS.breath.roleGain`
    (shaders.js).

23. **Lungs, second pass** (`brain-system/research/LUNGS.md` §14). The user reported three things:
    the airway should reach the nose, the lungs were a blurry pink haze, and the breathing and
    airflow could not be seen. They chose to draw the motion × 3 and to show the airflow with
    particles.

    Measured cause of the blur: 55k stars inside the lungs covered each pixel about 3 times in the
    Lungs view. The airways drawn to generation 11 also project as an even texture, and the acini,
    parenchyma and capillary beds fill the volume.

    What changed:
    - **Upper airway:** nostrils, nasal cavities, pharynx and larynx to the trachea, inside the head
      SDF (`UPPER_AIRWAY` in `airway-tree.js`).
    - **The body build draws structure only:** airways to generation 7, the pleura on the lungs and
      along the fissures, a light speckle of acini, no parenchyma.
    - **The close-up region** adds every airway generation and the acini.
    - **Pulmonary vessels:** veins 5 generations, fewer lung capillary strands, arteries to
      generation 7.
    - **Motion:** drawn × 3 (`BREATH.display`), with the rib term gated above the thoracic inlet.
    - **Air particles** (role 7) run along their branches with the breath. They replace the
      luminance band. `uAir` now carries their displacement; budgets are unchanged and `BODY_VS`
      still uses 106 slots.

    Fixed after the parent's browser check:
    - the breathing gate was `seg < 0`, but the trunk is segment 0, so it never ran; it is now
      `seg == 0`;
    - the upper airway fell under the head fade; airways and air particles are now exempt.

    Next decision for the user: whether the lungs now read crisply on 8768, and whether × 3 and the
    particles suit them.

**Carried over from the Mac session (still binding):**
- **Types:** JSDoc only, through `// @ts-check` per file, `src/sim/contracts.d.ts` and `tsc -p .` with
  noEmit. No React, no `.ts`, no build step, no typescript dependency in `package.json` (`tsc` 7.0.2 must be
  on PATH). Prefer narrow `/** @type {any} */` casts.
- **Agents:**
  - main session Opus 5.5, effort high, no fast mode;
  - workflows only for the big stages (stage 6 fact-check, stage 7 docs, stage 8a review);
  - fact-check and review finders sonnet/high, skeptics inherit; docs extraction sonnet/medium;
  - run `/graph-usage` after every workflow and report the numbers.
- **Hypotheses:** the default is `sustained`; `dip` is the rat serotonergic dip.
- **Geometry port (§7.3), skipped on purpose:** petalia, the optional enlargements, the portal-leg drawing,
  true-volume release allocation and the §7.4 low-tier share.
- **Ports:** Brain System on 8768, verification entry on 8770; never stop the user's servers on 8765/8768.
- **Workflow rules:** reply in Uzbek; files in English with British spelling; work only on brain-system.
- **Content and HUD rules:**
  - clinical, non-explicit;
  - no genital structures (pelvic anatomy only as schematic nerves/plexuses, bladder and rectum);
  - at most 3 flashes/s through PhotoLimiter; lantern colour at or above 2,200 K;
  - HUD in collapsible dropdowns without subtitles, working at 375 px;
  - reduced motion respected.

## 4. Checks at the pause

On Windows with Node v26.13.0 (V8 14.6, x64), tsc 7.0.2, graphify 0.9.97 and Python 3.12.10. The tree is
the code of `2d6e9aa` plus the stage-6 ANALYSIS.md edits:
- `npm test`: **537 tests, 509 pass, 0 fail, 28 todo**. The four todos with failing assertions are the
  known model gaps:
  - `latency.test.mjs:80`: VPL → S1 foot is 78 mm against 65 mm;
  - `latency.test.mjs:160`: no tibial N22 edge;
  - `scenarios.test.mjs:87`: the postprandial SBP fall does not reach CV tpr;
  - `switches.test.mjs:116`: somatic off does not gate body-surface salience.
- `npm run typecheck`: **exit 0**.
- `graphify update .`: 5,712 nodes, 10,063 links.
- `/graph-usage` for the Windows session (12 agent transcripts):
  - 122 graph calls (114 by name, 2 prose, 6 rebuilds) against 119 code reads, 1.03 per read;
  - 119/119 (100 %) of reads came after the agent's first graph call;
  - 18 gate denials; **Graph-first: OK**.
- Graph gate tests: 100 run; 96 pass, 3 skipped, 1 error. The error is the `ü` path fixture of
  `AsciiOutputTest` under the cp1251 code page; that class passes with `PYTHONUTF8=1`. It is a test-harness
  limit, not a gate fault.

| When | Tests | Pass | Fail | Todo |
|---|---|---|---|---|
| Mac pause (stage 4) | 530 | 502 | 0 | 28 |
| Windows, Node 24 or 26, Mac golden | 530 | 498 | 4 (golden, platform bits) | 28 |
| Windows, golden re-recorded | 530 | 502 | 0 | 28 |
| After stage 5 and the fixes | 537 | 509 | 0 | 28 |
| Mac (arm64, Node 26.4) at `0101203`, x64 golden | 537 | 505 | 4 (golden, platform bits) | 28 |
| Mac, simple HUD, wave, emotion/view split, glass with colours, body form (decisions 8–13) | 558 | 526 | 4 (golden, platform bits) | 28 |
| Mac, head/face/body second pass, glass MSAA (decision 14) | 562 | 530 | 4 (golden, platform bits) | 28 |
| Mac, dense star model replaces the glass (decision 15) | 554 | 522 | 4 (golden, platform bits) | 28 |
| Mac, heart model (decision 16) | 564 | 532 | 4 (golden, platform bits) | 28 |
| Mac, patient monitor (decision 17) | 567 | 535 | 4 (golden, platform bits) | 28 |
| Mac, arterial pulse and vascular tree (decision 18) | 573 | 541 | 4 (golden, platform bits) | 28 |
| Mac, vascular tree to the capillaries (decision 18, second pass) | 574 | 542 | 4 (golden, platform bits) | 28 |
| Mac, camera navigation (decision 19; `test/camera.test.mjs`, 24 tests) | 598 | 566 | 4 (golden, platform bits) | 28 |
| Mac, heart close-up detail (decision 20; `test/heart-detail.test.mjs`, 8 tests) | 606 | 574 | 4 (golden, platform bits) | 28 |
| Mac, body close-up clarity (decision 21; `test/closeup.test.mjs`, 5 tests) | 611 | 579 | 4 (golden, platform bits) | 28 |
| Mac, lungs and respiratory system (decision 22; `airway-tree` 14, `breath` 10, `lungs` 9, respiration 7, monitor 2 new tests) | 653 | 621 | 4 (golden, platform bits) | 28 |
| Mac, lungs second pass: upper airway, sharpness, visible breathing (decision 23; `lungs` 10, `breath` 9) | 654 | 622 | 4 (golden, platform bits) | 28 |
| Mac, lungs: breathing gate (seg == 0) and the airway head fade fixed (decision 23; `lungs` 12) | 656 | 624 | 4 (golden, platform bits) | 28 |

The last row was checked on the Mac on 5 November, after the merge, with graphify 0.9.95. On that run,
`npm run typecheck` exited 0 and the graph gate tests passed 103 of 103. The rebuilt `graph.json` was
identical to the committed one.

## 5. The interrupted step: stage 6 PARAMS fold

**What happened.** One agent was folding the stage-6 numeric changes and calibration verdicts into the code
PARAMS. The user stopped the session after it had edited 10 source and 4 test files, and it was not
verified as a whole. Its last action was recording the simulated IL-10 peak (§10.2).

**What was kept:**
- The code is back at `2d6e9aa`.
- The partial work is saved as `.handoff/results/stage6-params-partial.patch` (512 lines; it re-applies
  cleanly with `git apply`). It touches:
  - `src/body/frame.js`, `src/body/geometry.js`, `src/safety.js`;
  - `src/sim/autonomic.js`, `endocrine.js`, `enteric.js`, `immune.js`, `scenarios.js`, `somatic.js`,
    `stimuli.js`;
  - `test/autonomic.test.mjs`, `clock.test.mjs`, `enteric.test.mjs`, `safety.test.mjs`.
- ANALYSIS.md keeps two owner rows that agent added: `stress.symAdr` 0.185 (§7), and SCI spinal tone ρ by
  phase. The ρ row states the new values, which the committed code does not use yet; the patch does.

**How to finish:**
1. Apply the patch.
2. Review every hunk against `.handoff/results/stage6-factcheck-r2.json` (`edit.changes` where `numeric` is
   true, and `calibrations`).
3. Finish the remaining numeric changes. Module PARAMS cite their § in comments, so grep the § number and
   the old value.
4. Run `npm test` and `npm run typecheck` per module, then for the whole suite. The rules for doing this:
   - If a test asserts an old spec number, update the assertion to the revised ANALYSIS.md value.
   - If a checkpoint fails because the physiology moved outside its tolerance, revert that one value and
     list it as "needs model re-calibration". Never loosen tolerances or re-record the golden.
   - Do not change `response.js` or `dopamine.js` here; DOPAMINE.md owns them.

**Calibration verdicts** (stage-4 values marked `[model]`):

| Module | Parameter | Verdict | Owner / action |
|---|---|---|---|
| autonomic | `defence.vag` 0.12 | keep | full offset-gain table in §7.8 |
| autonomic | `stress.symAdr` 0.185 | document | §7.6 fSymAdr row and §9.4 (ratio ×4.1) |
| autonomic | bulbospinal η 0.20 | document | §6.3 (cord cross-section map) |
| autonomic | `spinalRest` ρ by SCI phase | **change** | [0, 0.02, 0.05, 0.10, 0.15] for muscle, splanchnic and cardiac channels; skin channels up to 0.3 at phase 4; owner §7.8 with a cross-reference from §6.15 |
| enteric | `brakeGain` 16 | **change** (spec) | ANALYSIS §8.8 now writes G = G_pyl/(1 + 16·B·(r̃/r_set)⁴); the code already uses 16, so only its comment needs to match |
| endocrine | clock vote via `en.gap` 0.08 | document | §9.8 and §11 |
| stimuli | contact-heat thresholds (cold 45 °C, warm 33.5 °C) | keep | §5.6 and a per-class θ table in §11.9 |
| somatic | startle recruitment delays (68 / 85 / 115 / 150 ms) | document | §6.11 and §12.6 |

## 6. Known problems and open questions

**Model work found by stage 6** (needs the user's go-ahead; not a PARAMS edit):
- **HPA timing (§9.4, §9.10, §9.11).** The late cortisol peak comes from the delay chain, not from the
  clearance k_C alone. A k_C sweep cannot bring the peak below about 40 min and makes recovery worse.
  - The open calibration is ACTH t½ ≈ 15 min (deconvolution; the 22 min in the document is
    β-endorphin's), a human adrenal lag of 3–5 min (10 min is a rat value) and k_S ≥ 0.14/min. Keep the
    plasma cortisol pool at t½ 60–90 min (sourced 65 min).
  - Re-run the §9.4 Hopf threshold after any change.
  - The CAR row is an amplitude failure (a_CAR against the GR feedback gain), not a delay failure.
- **Heart apex geometry (§2.8).** The apex anchor (−85, 55, −390) lies outside the drawn union. Either
  document an apex lobe that reaches it (e.g. c (−70, 46, −385), half (24, 16, 10), clipped at z −392) or
  move the anchor to about (−80, 50, −384). The liver now documents its left-lobe ellipsoid (union ≈ 1.5 L).
- **Six overflow issues** were listed by the fact-checkers as "resolve in the next round" and never
  verified. They are in the result JSON (`edit.skipped`).
- **Two refuted issues** (§6.10 contact-heat timing; §11.11 cortisol brake on immune cells) need no
  change.

**Golden traces per architecture** (the user's decision, under decision 1):
- The arm64 golden from `71e27cd` (`test/golden/orgasm-legacy.json` there) passed all 17
  orgasm-regression tests against this code on the Mac. It was checked on 5 November, in a throwaway
  worktree.
- One golden per architecture would end the four failures on either machine with no re-recording and no
  looser tolerance:
  - `orgasm-legacy.arm64.json`, taken from `71e27cd`;
  - `orgasm-legacy.x64.json`, today's file;
  - the test picks one by `process.arch`.
- Ask the user before doing it.

**From the stage 5 integration** (for the stage 8 review and browser check):
- **Model cost:**
  - The meal scenario crawls: the kernel hits its 1-ms budget (about 244 awake nodes and about 700 packets),
    so it runs at about ×0.5 against its ×10 keyframes.
  - The acute stressor runs at about ×5.4 against ×10.
- **Hitches:**
  - The first return to Whole body for a switch set blocks for about 0.7 s.
  - Play and the 10 % snapshot marks spike to 5–7 ms per frame.
  - The kernel overshoots its budget to 1.5–2.4 ms.
- **Clock:** after a touch it holds ×0.005 for the rest of a 200-ms press, about 40 screen seconds. This
  follows A.4 but may feel stuck.
- **Not implemented:**
  - organ responses (heartbeat, pupils, lungs) and limb directions not checked on screen;
  - the predicted-arrival line in the site readout;
  - the portrait distance-fit rule, the "syncopal range" tag and the extra Live disclosures;
  - drawing for the Touch receptors and Labels toggles (they are greyed);
  - `onSense` (a no-op) and the connectivity arcs of the large-scale networks overlay.
- **Display:**
  - Fibre tracts stay at 4,200 K (§13.16 suggests 5,500–6,000 K).
  - Close-ups of a hand or finger show sparse points; the body point budget limits detail.
- **[model] choices made in integration:**
  - a URL scenario plays at load;
  - brain only stops a running scenario only if it needs the body;
  - an active intervention is re-applied after Play;
  - the anticipation hold is 5 ms of tH;
  - the limiter scales packets only;
  - Reset restarts the selected scenario or returns the body to rest;
  - the overlay membership lists and limb rotation axes are the agent's choices.

**Carried over from the Mac** (unchanged):
- **Failing-assertion todos:** the four in §4.
- **SCI:**
  - autonomic dysreflexia (§7 T6 rule) is not implemented;
  - the partial-preservation gains do not use `scaleEdge` yet.
- **Physiology values:**
  - RSA is 10.5 bpm against the §7.8 9.4.
  - Blink R1/R2 latencies are not calibrated.
- **Not modelled in `somatic.js`:**
  - corneal reflex, jaw jerk, stapedius, dazzle blink, M2, plantar/Babinski, H-reflex/RIII, gag;
  - the medullary reticulospinal, tectospinal and rubrospinal tracts;
  - antigravity tone, the startle fear factor and prepulse inhibition, CPG rhythmogenesis;
  - some muscles;
  - the C-fibre second wave.
- **HUD:**
  - no side selector for SCI, nerve section or sympathectomy;
  - no rhizotomy rows;
  - no posterior T6 site.
- **Specs:**
  - The DOPAMINE.md round-3 edits were never re-verified (`.handoff/results/dopamine-factcheck-3-rounds.json`).
  - ANALYSIS.md B.15 still names an old Windows path.

**Environment notes:**
- **`graphify-out/manifest.json`:** at session start the gate runs `graphify update`, which rewrites this
  file with the machine's own file times. A fresh session therefore always shows it as changed in
  `git status`. That is expected, not a sign of lost work.
- **Git on the Windows computer:** system git there has `core.autocrlf=true`. The working tree is CRLF, but
  commits are LF. Clone new copies with `-c core.autocrlf=false`.
- **Python on Windows:** run it with `PYTHONUTF8=1` (cp1251 code page).
- **Preview pane:** it may pause `requestAnimationFrame` and return stale screenshots. Step the app with
  `window.__brain.tick(now)`. Change the DOM before a screenshot, or measure with `gl.readPixels`.

## 7. Remaining plan

Time estimates assume a working session at Opus high, without usage-limit pauses.

1. **Baseline on the new machine** (15 min, direct): follow `RESUME.md`. Expect 537 / 509 / 0 / 28 on x64 and a
   clean tsc. On arm64 (the Mac), expect 505 passing and the 4 golden failures (§4). Explain any other
   difference first; see decision 1 and the per-architecture option in §6.
2. **Finish the stage 6 PARAMS fold** (45–75 min, one agent or direct, **no workflow**): §5. Then
   `graphify update .`, the impact check and a commit (ask first).
3. **Ask the user about the model re-calibrations** from §6: HPA delay chain, heart apex, the six overflow
   issues. Each is 30–60 min if approved.
4. **Stage 7, docs into the graph** (30–60 min, **workflow**, sonnet medium):
   - Adapt `.handoff/workflows/graphify-project-docs.js` (stale paths).
   - Cover ANALYSIS.md split by section line ranges, DOPAMINE.md, both READMEs, `brain-system/index.html`
     and `research/RESPONSE.md`.
   - Merge with graphify's `--update` flow, as `graphify-body-sources.js` does.
   - Run `/graph-usage` afterwards.
5. **Stage 8a, code review** (1–1.5 h, **workflow**):
   - Adapt `.handoff/workflows/orgasm-brain-review.js` to the whole Brain System and both specs.
   - Lenses: model fidelity, render correctness, anatomy/safety/content, performance/robustness (start from
     the §6 stage-5 list), switch semantics.
   - Two skeptics per finding; a fixer re-runs `npm test` and `npm run typecheck`.
   - Run `/graph-usage` afterwards.
6. **Stage 8b, browser verification** (30–45 min, direct):
   - Check both HUDs: the simple one (default) and the full one (`?advanced=1`).
   - Check brain only vs whole body.
   - Check every network switch on and off with a probe stimulus, and the stimulus panel.
   - Run every scenario (hotObject, kneeJerk, loudSound, brightLight, standUp, stressor, meal, infection,
     orgasm) and `?body=0&scenario=orgasm`.
   - Check the 375-px layout, reduced motion, and that there are no console errors.
   - Save screenshots to `brain-system/screenshots/`.
7. **Wrap-up** (15 min): `graphify update .`, `/graph-usage`, and a report of what is verified and what is
   not. Offer to re-verify the DOPAMINE.md round-3 edits.

Total: about 4–6 hours, plus any approved re-calibrations.

## 8. Workflow scripts

| Script | Use | Status |
|---|---|---|
| `.handoff/workflows/brain-system-analysis-factcheck-r2.js` | Stage 6 (four lenses → one skeptic per lens → editor; ≤ 9 agents) | Ran on Windows as `wf_af6b84e2-a38`. Its SCRATCH path is the Windows session scratchpad; change it before reuse |
| `.handoff/workflows/graphify-project-docs.js`, `graphify-body-sources.js` | Stage 7 | Paths stale (old `galaxy` folder) |
| `.handoff/workflows/orgasm-brain-review.js` | Stage 8a | Paths stale; widen the scope to the whole Brain System |
| `.handoff/workflows/brain-system-networks.js` | Stage 4 | Mac `ROOT`; reference only |
| `.handoff/workflows/brain-system-build.js`, `brain-system-analysis-verify.js`, `brain-system-dopamine-verify.js`, `brain-system-research.js` | Earlier work | Reference only |

Workflow run ids live in each machine's local session data and **cannot be resumed on another machine**.
Start a new run from the script.
