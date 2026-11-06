# Prompt for the next session

Written on 6 November 2026 on the Mac, to continue on another computer. On that computer, first get
the branch:

```bash
git fetch origin && git switch wip/brain-build-mac && git pull
```

Setup (Node, graphify, the launch entries, Windows notes) is in `.handoff/RESUME.md`. On Windows the
graph gate needs Git Bash and `graphify` on PATH (CLAUDE.md). Then open Claude Code in the repository
root and paste the block below.

```
You are continuing Brain System on branch `wip/brain-build-mac` of this repository. It is a WebGL2
star-field simulation of the human brain and body: nervous system, heart, blood vessels, pulse and
lungs. Work only in `brain-system/`. `anger-galaxy/` is a separate project: never read, change or
cite it.

Rules (CLAUDE.md is binding; read it first):
- Before every task and every step, give a short table: task, who does it, model, effort, reason.
  A step in this session runs at this session's own setting; name that setting. Pass `model` and
  `effort` explicitly to every subagent or new session. Token cost matters:
  - give mechanical work (docs, renames) to Sonnet or Haiku at low effort;
  - give read-only where-is / who-calls questions to the graph-scout agent;
  - start a new session for a new, self-contained task, and send follow-ups to the session that
    already has the context.
- The graph gate: ask `graphify explain/affected/path "<Name>"` before you grep for a name or read
  a source file. Run `graphify affected` on what you changed before you finish.
- Reply to the user in Uzbek. Write project files in English, with British spelling.
- Never commit or push unless the user asks. End commit messages with
  "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".
- Never stop the user's servers on ports 8765 and 8768. Check your work with `preview_start` name
  `brain-system-verify` (port 8770).
- Content: clinical and non-explicit; no genital structures. Photosensitivity: at most 3 flashes/s
  and at most 8 % luminance swing per cycle; per-beat and per-breath effects are energy-conserving;
  nothing moves under reduced motion.

Checking in the browser (learned the hard way):
- After a change, the browser may serve an old module from cache and fail with "does not provide
  an export named …". Reload hard (Cmd/Ctrl+Shift+R), or fetch each `src` file with
  `{cache: 'reload'}` and then reload.
- A hidden Browser pane throttles requestAnimationFrame. The body is built one 8-ms slice per frame,
  so in a hidden pane it takes minutes to appear. This is not a bug.
  - To check anyway: drive frames with `window.__brain.tick(performance.now())` in a loop.
  - Screenshots work after that, and so does `gl.readPixels` in the same task as a tick.
  - `window.__brain` also exposes the camera, the renderer and the body buffer: 16 floats per
    star; offset 5 is the normal's y, which carries −role for lung stars, and offset 15 is the
    rigid segment, 0 for the trunk.
- Measure motion and brightness from pixels; do not trust a still image or a passing unit test alone.

State (decisions 14–23 in .handoff/STATE-AT-PAUSE.md hold the detail):
- Simple HUD (src/ui-simple.js) is the default; the full HUD opens with ?advanced=1.
  - Emotion: Calm, Stress, Pleasure.
  - View: Brain, Cutaway, Dopamine, Body, Heart, Lungs.
  - Style: Detailed or Stars. Also Quality and Pause.
- Camera navigation as in Blender, Maya and Unreal (decision 19; src/camera-controls.js).
- Heart down to fine anatomical detail, crisp in close-up (research/HEART.md §8). The body's close-up
  regions stay sharp (research/CLOSEUP.md).
- Arterial pulse and the vascular tree down to the capillaries (research/PULSE.md).
- Lungs and the respiratory system (research/LUNGS.md, §14 for the second pass):
  - Kernel: breathing answers emotion.
    - Calm: 10.5/min × 0.62 L.
    - Stress: 18/min.
    - Pleasure: up to 26/min with breath-holds.
    - Also sighs, PaCO₂, SaO₂ and EtCO₂.
  - Airway: from the nostrils through the nasal cavity, pharynx and larynx to the trachea, then
    5 lobes and 18 segments (src/body/airway-tree.js).
  - Lungs view: draws structure, not haze. Airways to generation 7, the pleura and the fissures;
    the close-up adds every generation and the acini.
  - Breathing: moves the lungs, the diaphragm and the chest wall, drawn × 3 (`BREATH.display`). Air
    particles run in and out of the airways.
  - Checked in the browser on 8768: the lungs' light centroid moves 18.6 px of 768 between
    inspiration and expiration, and total light changes by about 5 %.
- Patient monitor in the Body, Heart and Lungs views (src/monitor.js):
  - ECG/HR, ART, PLETH/SpO₂ with PTT, RESP/RR, CO₂/EtCO₂;
  - TEMP, ADR (pg/mL), CORT (µg/dL).
- Body star totals per tier: 129,583 / 253,167 / 417,000 / 648,667. `BODY_VS` uses 106 of its 110
  uniform slots.
- Tests: `node --test` in brain-system gives 656 tests: 624 pass, 4 fail, 28 todo.
  - The 4 failures are the known arm64 golden traces: the legacy orgasm traces demo-single,
    demo-multiple, manual-single and demo-noclimax.
  - They were recorded on x64, so on a Windows x64 machine they may pass.
  - `npx tsc -p .` is clean.
- Everything up to `b27d320` is pushed. This handoff file is the last change.

Open items, for the user to choose from (ask; do not start several at once):
1. The user's feedback on the lungs second pass (airway to the nose, sharpness, visible breathing).
2. The next organ system to the heart's standard: research note, form, close-up detail, model link
   and tests. The proposed order is in research/LUNGS.md §10:
   - the gut (stomach, small intestine, colon; the enteric model already computes slow waves);
   - then the liver, pancreas, spleen and the portal circulation;
   - then the kidneys and the bladder;
   - then the endocrine glands.
   Under the content rule, reproductive structures stay out.
3. Performance on low-end hardware with the larger budgets (648,667 body stars at Ultra).
4. A pull request from `wip/brain-build-mac` into `main`, when the user wants it.

Start by reading CLAUDE.md, .handoff/STATE-AT-PAUSE.md (decisions 19–23) and the research note of
the chosen item. Then ask the user which item to do, with your model-and-effort table.
```
