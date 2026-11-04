# Brain System build: state at the pause

The build was paused on **Wednesday 4 November 2026 at about 19:30 (Mac local time, UTC+5)**. It is moving from
the Mac to a Windows 11 computer. This file describes the tree in the first commit on the branch
`wip/brain-build-pause`, the commit that adds this file. That branch was cut from `main` at `9806165`
("Remove Orgasm Galaxy; keep its response model in Brain System"). Before this commit, everything after
`9806165` was uncommitted work in the Mac checkout.

When this file disagrees with `.handoff/HANDOFF-PROMPT.md`, this file wins. Read the handoff prompt only where
this file points to it. Its first line (multi-agent workflows for every step) and its Windows paths are out
of date.

The specification is `brain-system/research/ANALYSIS.md`:
- Appendix A is the binding contract.
- Appendix B is the implementation plan: B.4 modules, B.5 changes per file, B.6 frame loop, B.8 budgets,
  B.10 HUD, B.11 switches, B.12 scenario player, B.13 orgasm, B.14 tests and B.15 phases.

The orgasm scenario's internals are in `brain-system/research/DOPAMINE.md`.

---

## 1. Build stages

The user set the order of eight stages at the start of the Mac session.

| # | Stage | Status | "Done" was checked against |
|---|---|---|---|
| 1 | Finish Phase 0a, turn the tests green, re-record goldens from the post-port legacy path | **Done** | `test/dopamine.test.mjs` (DOPAMINE.md §6.9 rows 1–21 on the deterministic reference, the §9.6 timeline, the multiple profile) and `test/orgasm-regression.test.mjs` (legacy path vs adapter path, identical per human substep) |
| 2 | Drive the app through `OrgasmAdapter` and `SimClock` | **Done** | Browser check on the Mac (port 8770): 125 brain regions, 267,000 points, no console errors, the delegate holds the clock, the climax is reached; the regression test |
| 3 | Phase 2–3 modules and the B.14 tests | **Done** | Geometry port (§7.3), body generation and picking, brainnet, sensory, stimuli and scenarios, each with its tests; `test/geometry-brain`, `geometry-body`, `brainnet`, `determinism`, `scenarios`, `budget` |
| 3b | TypeScript contracts (added by the user mid-session) | **Done** | `npm run typecheck` (`tsc -p .`) exits 0 |
| 4 | Five network modules and interventions as `graph.js` plugins | **Done** | A workflow built them, two skeptics reviewed them (11 findings, 3 major) and a fixer applied all 11. I re-ran the suite and tsc myself afterwards. |
| 5 | Integrate: `main.js`, `performance.js`, the body pass, PhotoLimiter, HUD wiring, README | **Partly done** (see §2) | Not checked; it was interrupted |
| 6 | ANALYSIS fact-check round 2, folded into `PARAMS` | Not started | |
| 7 | Add the docs to the graph semantically | Not started | |
| 8 | Code review, browser verification and wrap-up | Not started | |

What exists after stages 1–4, all under `brain-system/`:
- **Clock and orgasm:**
  - `src/clock.js`: `SimClock`, with the priority order user lock › delegate › keyframes › adaptive, plus
    `settleDelegate(tReachedH, khEnd)`;
  - `src/sim/orgasm-adapter.js`: `OrgasmAdapter`, built on `advanceFrame`/`stepClock`/`onStep(h, prev)`, with
    climax phases `onset` and `orgasm`;
  - `src/response.js` and `src/dopamine.js`: post-port, with hypotheses `sustained` (default) and `dip`, and
    the §6.10 switches.
- **Kernel:** `src/sim/kernel.js` and `src/sim/graph.js`. The plugin contract is the comment at the top of
  graph.js. The kernel also has a CommandRing in `command()`, `scaleEdge`/`edgeScale`, `declared()` and
  `k.options`, and `setIntervention` keys each call separately.
- **Plugins** (all in `src/sim/`):

  | Plugin | Notes |
  |---|---|
  | `brainnet.js` | 332 nodes, 720 edges, 21 ports, 5 pools |
  | `sensory.js` | |
  | `stimuli.js` | including the §11.9 contact-heat delay |
  | `somatic.js` | order 20; also nerve, SCI and rhizotomy presets |
  | `autonomic.js` | order 30 |
  | `enteric.js` | |
  | `endocrine.js` | order 50 |
  | `immune.js` | |

- **Interventions and scenarios:**
  - `src/sim/interventions.js`: the HUD catalogue → plugin presets. HUD ids: sci, nerveSection,
    dorsalRhizotomy, heartTransplant, atropine, truncalVagotomy, sympathectomy, pureAutonomicFailure,
    adrenalectomy, hypophysectomy, splenicDenervation and vns.
  - `src/sim/scenarios.js`: SCENARIOS, `ScenarioPlayer` (`advanceTo`, `hud()`), `evaluate`, `checkpointSkip`.
- **Types:** `src/sim/contracts.d.ts`.
- **Brain geometry:**
  - `src/anatomy.js`: 125 regions. Index 22 is `pituitaryGland`, with the aliases `pituitary` and
    `pituitaryAnt`. `vtaMedial`, `a14` and `caudate` are appended.
  - `src/brain.js`.
- **Body:** `src/body/generate.js` (FLOATS 16; tier counts 32.5k, 63k, 104k and 158k),
  `src/body/picking.js`, `src/body/geometry.js` and `src/body/frame.js`.
- **Present but not yet wired into the app:** `src/statetex.js`, `src/safety.js` (PhotoLimiter),
  `src/ui-body.js` (the new HUD dropdowns) and `src/performance.js`.

## 2. The interrupted stage (5, integration)

**What happened.** A single integrator agent was stopped by request after about 15 minutes. It had been
reading main.js, interventions.js and ui-body.js, and it had started the module-reconciliation part of its
brief. It had **not** yet touched `src/main.js` or `README.md`. No file changed after 19:25:41; I checked
that nothing changed for 60 seconds before the checks below.

**Files it touched**, all syntax-valid. The suite and tsc are unchanged by them.

| File | Change | Unfinished? |
|---|---|---|
| `src/ui-body.js` | (1) Stimulus field keys renamed to the stimulus record's keys (`stimuli.js` owns the record): `freqHz→freq`, `rampCps→ramp`, odour `class→cls`, `velDps→velocity`. (2) Removed the "Posterior thorax (T6)" site entry, which has no geometry or stimuli site; a comment says why. (3) Added `scnBlocked` and handling for a `scenarioUnavailable` field in `syncSettings`, so the HUD can disable scenarios the simulation does not provide. | Complete as edits, but **nothing sends `scenarioUnavailable` yet** (main.js is not wired). |
| `src/ui.js` | Two comment lines: the list of fields forwarded to ui-body.js now names `sense` and `scenarioUnavailable`. | Complete |
| `src/sim/interventions.js` | New export `hudId(id)`: maps a kernel id (e.g. `sympathectomyT2T3`) or a HUD id back to the HUD catalogue id, or null. This fixes the sympathectomy id round trip. | **No caller yet**: main.js must use it when it echoes the active intervention to the HUD. |
| `src/statetex.js` | The packet filter also accepts `q.efference` (the kernel's Packet field name). A comment says main.js maps kernel packets onto body-buffer geometry paths through "wiring.js PacketMap". | **`wiring.js` / `PacketMap` does not exist.** It was the agent's plan; write it, or change the comment. |
| `src/performance.js` | `TIERS` extended per B.8 with `extra`, `body`, `bodyLod`, `packets`, `gutSegments` and `kernelMs`, plus a comment block citing B.8, B.9, §13.4, §8.2 and §11.7. | Values present for all tiers. Nothing reads the new fields yet. Check the numbers against B.8. |
| `src/sim/kernel.js` | `packets()` records now carry `seq`, a stable per-packet id. | Complete |
| `src/sim/contracts.d.ts` | `Packet` gains `seq: number`. | Complete |

## 3. Checks at the pause (step 2 of the pause)

On the Mac, with Node v26.4 and tsc 7.0.2:
- `node --check` on all 54 `.js`/`.mjs` files in `src/` and `test/`: all pass.
- `npm test` (`node --test`, about 71 s): **530 tests, 502 pass, 0 fail, 28 todo**.
- `npm run typecheck` (`tsc -p .`): **exit 0, no errors**.
- `graphify update .` (graphify 0.9.95): ended without errors. The graph has 5,619 nodes and 9,750 links.

**No test fails.** Node's summary prints a "failing tests" list, but every entry in it is a `todo` test whose
assertion fails, with the reason recorded:
1. `test/latency.test.mjs:80`, "VPL → S1 foot (65 mm)". In `brainnet.js`, `thalVPL → s1.foot` is 78 mm
   (1.2 × the centre distance), 20 % over the §2.14 65 mm.
2. `test/latency.test.mjs:160`, "row 47: tibial N22 at the S1 dorsal horn". In `somatic.js`, the ankle joint
   receptors run via L5 straight to portDC. There is no tibial-at-ankle edge into `cord.S1.dh`, so no N22
   arrival can be measured.
3. `test/scenarios.test.mjs:87`, "row 30: Postprandial SBP fall (autonomic off)". In `autonomic.js`, the
   §11.13 GI meal load (`emptyRate`) does not reach CV tpr yet.
4. `test/switches.test.mjs:116`, "somatic off: body-surface pain produces no autonomic response either
   (A.5)". In brainnet/sensory, the salience of a body-surface stimulus is not gated by `g.somatic`. With
   somatic off, hotObject still gives an SCR (+0.88 µS) and an HR rise.

The other 24 todos pass their assertion or are marked open. They wait for a readout or a spec decision:
§12.20 rows 9, 10, 13, 21, 28, 39, 40, 43, 46 and 52; the two composited-frame photosensitivity rules (a
browser check); and evaluator gaps.

**Baselines, for comparison:**

| When | Tests | Pass | Fail | Todo |
|---|---|---|---|---|
| Original handoff (old machine) | 132 | 119 | 0 | 13 |
| After Phase 0a | 133 | 131 | 0 | 2 |
| After stage 3 and the TypeScript contracts | 276 | 221 | 0 | 55 |
| After stage 4 | 530 | 502 | 0 | 28 |
| **At the pause** | **530** | **502** | **0** | **28** |

The pause row is identical to the stage 4 row.

## 4. Decisions made during the Mac session that are not (fully) in the specs or the README

- **Types.** TypeScript is used through JSDoc only: `// @ts-check` per file, `src/sim/contracts.d.ts` and
  `tsc -p .` with `noEmit`.
  - No React, no `.ts` migration, no build step. Type checking is added gradually.
  - `package.json` has no typescript dependency. `tsc` must be on PATH (7.0.2), and `npm run typecheck`
    runs it.
  - `tsconfig.json`: allowJs, checkJs false (per-file opt-in), strict false, ES2022 + DOM.
  - Files with `@ts-check`: `graph.js`, `kernel.js`, `stimuli.js`, `brainnet.js`, `sensory.js` and every
    network module. Use narrow `/** @type {any} */` casts rather than loosening the config.
  - The README "Tests and type check" section mentions this, but no spec does.
- **Model and agent plan:**
  - Main session: Opus 5.5, effort high, no fast mode.
  - Use workflows only for the big stages: networks + interventions (done), the fact-check, the code
    review and the docs extraction.
  - Builders inherit the session model.
  - Fact-check and review finders: `model: 'sonnet'`, effort high. Skeptics inherit.
  - Docs extraction: sonnet, medium. Mechanical agents: haiku, low.
  - Run `/graph-usage` after every workflow and report the numbers. The stage 4 run was
    `Graph-first: OK`: 377 graph calls, 376 code reads, 100 % of reads after a graph call.
- **Goldens.** `test/golden/orgasm-legacy.json` was re-recorded twice:
  - after the DOPAMINE.md §9.8 port;
  - after the §7.3 geometry change. That re-record changed screen state only; all four runs had identical
    human-time hashes.

  Do not re-record goldens to make an integration change pass.
- **Hypotheses.** The default is `sustained` ("Sustained above rest (default; model choice)"). `dip` is the
  rat serotonergic dip.
- **Geometry port (§7.3).** These items were skipped on purpose:
  - petalia;
  - the optional enlargements;
  - the portal-leg drawing;
  - true-volume release allocation;
  - the §7.4 low-tier share.
- **Calibrations made in stage 4.** Each is marked `[model]` in the code; stage 6 should look at them:

  | Module | Parameter | Change and reason |
  |---|---|---|
  | autonomic | `defence.vag` | 0.08 → 0.12, so hotObject row 12 HR rise = 6.9 bpm |
  | autonomic | `stress.symAdr` | 0.30 → 0.185, so adrenaline ≈ ×4.0 with autonomic loaded |
  | enteric | `brakeGain` | 4 → 16, so ≈ 1.77 kcal/min, against the §8.13 1.8. The §8.8 B formula gives about 2.9; the comment records the departure. |
  | endocrine | clock vote | uses the relative distance to target (`en.gap`, threshold 0.08) |
  | stimuli | contact-heat thresholds | cold and warm receptors use 45 °C and 33.5 °C |
  | somatic | startle | recruitment delays: neck 68, shoulder 85, arm 115, leg 150 ms |
  | autonomic | bulbospinal η | 0.20 |
  | autonomic | `spinalRest` | ρ by SCI phase |

- **Ports.**
  - Brain System's normal entry is `brain-system` on 8768.
  - On the Mac, 8768 was held by the user's own hung `python3 -m http.server`, so a second entry,
    `brain-system-verify` on 8770, was added to `.claude/launch.json` for verification. Keep both.
  - Never stop the user's own servers (8765, 8768).
- **Workflow.**
  - Never commit or push unless the user asks.
  - Reply to the user in Uzbek; write every file in English, British spelling.
  - Work only on brain-system; never touch `anger-galaxy/`.
- **Content and HUD rules** (from the specs, restated because they bind every UI change):
  - clinical and non-explicit;
  - no genital structures (pelvic anatomy only as schematic nerves/plexuses, bladder and rectum);
  - at most 3 flashes/s through PhotoLimiter;
  - lantern colour at or above 2,200 K;
  - HUD in collapsible dropdowns, with no subtitles, working at 375 px;
  - reduced motion respected.

## 5. Known problems and open questions

**Integration gaps** (stage 5):
- `main.js` builds no Kernel, registers no plugins and runs no `ScenarioPlayer`.
- No body generation or body pass; no StateTextures feed; no PhotoLimiter in the loop.
- No picking; none of the ui-body.js handlers are wired.
- `orgasm-switched.test.mjs` defines the `hudVitals` rule that main.js must follow.

**Model gaps:**
- The four failing todos in §3.
- SCI: autonomic dysreflexia (the §7 T6 rule) is not implemented, and the partial-preservation gains
  (central cord inner cstLat 0.3, zone of partial preservation 0.5) do not use `scaleEdge` yet.
- RSA gives 10.5 bpm against the §7.8 9.4.
- §8 must settle the conflict between the B formula and the §8.13 1.8 kcal/min.
- **Not modelled in `somatic.js`:**
  - corneal reflex, jaw jerk, stapedius threshold and latency, dazzle blink, M2 reflex, plantar/Babinski,
    H-reflex/RIII, gag;
  - medullary reticulospinal, tectospinal and rubrospinal tracts;
  - antigravity tone for standUp;
  - startle fear factor and prepulse inhibition;
  - intrinsic CPG rhythmogenesis;
  - some muscles: iliopsoas, hand intrinsics, toe muscles, pharynx/larynx/tongue;
  - the C-fibre second wave (rows 9 and 10).
- Blink R1/R2 latencies are not calibrated.

**HUD:**
- No side selector for SCI, nerve section or sympathectomy, and no donor age. They default to the right side
  and C5–C7.
- No rhizotomy rows.
- No posterior T6 stimulus site.

**Specs and docs:**
- The `DOPAMINE.md` round-3 fact-check edits were applied but never re-verified (minor risk; result in
  `.handoff/results/dopamine-factcheck-3-rounds.json`).
- The ANALYSIS fact-check round 2 never completed on the old machine. Its corrections are not in PARAMS.
- The handoff workflows carry stale paths. `brain-system-analysis-verify.js`,
  `brain-system-dopamine-verify.js` and `orgasm-brain-review.js` use `C:\Users\User\projects\galaxy` and an
  old scratchpad. ANALYSIS.md B.15 (~L7034) and ~L5058 have old paths too. Update them to the new clone
  before reuse.

## 6. Remaining plan

Time estimates assume a working session at Opus high, without usage-limit pauses.

1. **Baseline on the new machine** (15 min, direct). Follow `.handoff/RESUME-ON-WINDOWS.md` §3. Expect
   530 / 502 / 0 / 28 and a clean tsc. Explain any difference before changing code. On Windows, check that
   `core.autocrlf=false` held, because some tests read `index.html` as text.
2. **Finish stage 5, integration** (1–1.5 h; one agent or direct, **no workflow**). Use the B.5 rows for
   main.js and performance.js, plus B.6, B.8, B.9, B.10, B.11, B.12 and B.13. The work:
   - In `src/main.js`, keep the per-tick contract exactly:
     ```js
     const s = clock.advance(sdt);
     clock.settleDelegate(adapter.advance(sdt, s.t0H, s.h, s.source), adapter.kh);
     dopamine.updateVisuals(sdt, model, clock.kh);
     ```
   - Add a Kernel with all seven plugins (brainnet, sensory, somatic, autonomic, enteric, endocrine,
     immune), with the OrgasmAdapter's CommandRing as the orgasm command source.
   - Add `ScenarioPlayer`; StateTextures fed from brainnet activity; PhotoLimiter in the loop; body
     generation after the first brain frame and the body render pass; packets mapped onto body geometry
     paths (write the `PacketMap` that the `statetex.js` comment names, or fix the comment); picking on
     canvas click in pick mode; views and camera limits.
   - Handle the URL parameters `?body=0`, `?scenario=<id>` and `?seed=`.
   - Extend the HUD payload: `hudVitals`, the active intervention through `interventions.hudId`, and
     `scenarioUnavailable`.
   - Wire every ui-body.js handler (onBodyMode, onNet, onIntervention, onDeliver, onPick, onScenario,
     onPlay, time controls).
   - Expose kernel, player, clock, adapter and body on `window.__brain`.
   - Read the new TIERS fields.
   - Measure the kernel cost per frame against the B.9 `kernelMs` budget: ≤ 2 ms on the low tier,
     ≤ 1 ms otherwise.
   - `?body=0&scenario=orgasm` must reproduce today's brain-only orgasm experience.
   - Rewrite README.md: features, controls, a switch-semantics table (A.5, §11.10), and the test and
     typecheck commands. Keep the python3 serve command, the `?seed` note and the existing "Tests and type
     check" section.
   - Then: `npm test`, `npm run typecheck`, `graphify update .`, and the impact check.
3. **Verify the integration in the browser** (20–30 min, direct). Use the preview tool's `brain-system`
   entry. Check brain only and whole body, a probe stimulus, two scenarios, and that there are no console
   errors.
4. **Stage 6, ANALYSIS fact-check round 2 → PARAMS** (1–2 h, **workflow**).
   - Adapt `.handoff/workflows/brain-system-analysis-verify.js`: fix the paths, add the strict graph rule to
     its CONTEXT, finders `sonnet`/high, skeptics inherit.
   - Then grep the code for the § citations of every changed section and update PARAMS. Include the stage 4
     `[model]` calibrations in §4.
5. **Stage 7, docs into the graph** (30–60 min, **workflow**, sonnet medium).
   - Adapt `.handoff/workflows/graphify-project-docs.js`. Use the brain-system paths, and split ANALYSIS.md
     into chunks by section line ranges.
   - Cover: ANALYSIS.md, DOPAMINE.md, both READMEs, `brain-system/index.html` and
     `brain-system/research/RESPONSE.md`.
   - Merge with graphify's `--update` flow, as `.handoff/workflows/graphify-body-sources.js` does in its
     Merge stage.
6. **Stage 8a, code review** (1–1.5 h, **workflow**).
   - Adapt `.handoff/workflows/orgasm-brain-review.js`: paths, the whole Brain System scope and both specs.
   - Lenses: model fidelity, render correctness, anatomy/safety/content, performance/robustness, switch
     semantics.
   - Two skeptics per finding. A fixer re-runs `npm test` and `npm run typecheck`.
7. **Stage 8b, browser verification** (30–45 min, direct).
   - Check: brain only vs whole body; every network switch on and off with a probe stimulus; the stimulus
     panel; every scenario (hotObject, kneeJerk, loudSound, brightLight, standUp, stressor, meal, infection,
     orgasm); `?body=0&scenario=orgasm`; the 375 px layout; reduced motion; no console errors.
   - Save screenshots to `brain-system/screenshots/` (ignored by the graph).
8. **Wrap-up** (15 min). `graphify update .`, `/graph-usage`, and a report to the user of what is verified
   and what is not. Offer the follow-up of re-verifying the DOPAMINE.md round-3 edits.

Total: about 5–7 hours of work.

## 7. Workflow scripts

| Script | Use | Status |
|---|---|---|
| `.handoff/workflows/brain-system-networks.js` | Stage 4 (build five plugins → assemble interventions and cross-module tests → 2 skeptics → fixer) | Copied here from the Mac session's own scripts folder. Its `ROOT` is the Mac path `/Users/ismoil/projects1/nervous-system`; change it before reuse. |
| `.handoff/workflows/brain-system-build.js` | The original whole-build workflow from the old machine | Its Integrate-stage prompt (around line 70) is a good brief for step 2 above |
| `.handoff/workflows/brain-system-analysis-verify.js` | Stage 6 | Paths stale |
| `.handoff/workflows/graphify-project-docs.js`, `graphify-body-sources.js` | Stage 7 | Paths stale |
| `.handoff/workflows/orgasm-brain-review.js` | Stage 8a | Paths stale; scope must widen to the whole Brain System |
| `.handoff/workflows/brain-system-dopamine-verify.js`, `brain-system-research.js` | Earlier spec work | Reference only |

Run ids (stage 4: `wf_934e1f97-91a`; old machine: `wf_d2a72afc-205`, `wf_a2e8f850-db6`) live in each
machine's local session data. **They cannot be resumed on another machine.** Start a new run from the
script.
