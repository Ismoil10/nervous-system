# Prompt for the next session

Paste the block below into a new Claude Code session opened in this repository.

```
You are continuing Brain System, a WebGL2 star-field simulation of the human brain, body, heart
and blood vessels, on branch `wip/brain-build-mac` of this repository. Work only in `brain-system/`.
`anger-galaxy/` is a separate project: never read, change or cite it.

Rules (CLAUDE.md is binding; read it first):
- Before every task and every step, give a short table: task, who does it, model, effort, reason.
  A step in this session runs at this session's own setting; pass `model` and `effort` explicitly
  to every subagent. Token cost matters: delegate mechanical work (docs, renames) to Sonnet or
  Haiku at low effort, and read-only where-is/who-calls questions to the graph-scout agent.
- The graph gate: ask `graphify explain/affected/path "<Name>"` before you grep for a name or read
  a source file, and run `graphify affected` on what you changed before you finish.
- Reply to the user in Uzbek. Project files are in English, with British spelling.
- Never commit or push unless the user asks. Never stop the user's servers on ports 8765 and 8768;
  check in the app with `preview_start` name `brain-system-verify` (port 8770).
- Content: clinical and non-explicit; no genital structures; photosensitivity: at most 3 flashes/s,
  at most 8 % luminance swing per heartbeat; per-beat effects must be energy-conserving.

State (see .handoff/STATE-AT-PAUSE.md, decisions 14–18, for detail):
- Simple HUD (src/ui-simple.js), the default; the full HUD opens with ?advanced=1.
  - Emotion: Calm, Stress, Pleasure. View: Brain, Cutaway, Dopamine, Body, Heart.
  - Style: Detailed (dense, sharp stars in anatomical colours) or Stars (the earlier look, kept by
    renderer `PARAMS.style.keep`). Also Quality and Pause.
- Body form: head, face, neck, shoulders, hands and feet (research/BODY-FORM.md §8–§9).
- Star budgets per tier (performance.js `TIERS.body`): 122,250 / 238,500 / 393,000 / 610,000.
- Heart (research/HEART.md; src/heart.js, src/body/heart-form.js):
  - about 40,000–64,000 stars: fibres, coronaries, valves, the conduction system;
  - a beat clock in screen time, driven by the simulated HR, RSA and contractility;
  - Wiggers volumes, valves that open and close, an energy-conserving activation wave.
- Patient monitor in the Body and Heart views (src/monitor.js, HEART.md §7): ECG/HR, ART,
  RESP/RR, TEMP, ADR (pg/mL), CORT (µg/dL).
- Arterial pulse and the vascular tree down to the capillaries (research/PULSE.md;
  src/pulse.js, src/body/vessel-tree.js).
- Tests: `node --test` in brain-system gives 574 tests: 542 pass, 4 known arm64 golden failures
  (orgasm and legacy traces), 28 todo. `npx tsc -p .` is clean.

Open items, for the user to choose from (ask; do not start several at once):
1. The user's test feedback on the heart, the monitor and the pulse (pending).
2. Breathing: the lungs and the diaphragm should move with respiration. The shader modes exist
   (renderer `setOrgans`, BODY_VS `uOrgan`), but nothing calls `setOrgans` yet (ANALYSIS.md §13.7).
3. Performance on low-end hardware with the larger budgets (610,000 body stars at Ultra).
4. Other organs to the heart's standard: dense and anatomical (lungs, liver, kidneys, gut).

Start by reading CLAUDE.md, .handoff/STATE-AT-PAUSE.md (decisions 14–18) and the research note of
the chosen item. Then ask the user which item to do, with your model-and-effort table.
```
