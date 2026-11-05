> **Superseded** by `.handoff/STATE-AT-PAUSE.md` (the state on 5 November 2026 and the remaining plan) and `.handoff/RESUME.md`; read this file only where STATE-AT-PAUSE.md points to it.

> This prompt's original first line switched on multi-agent workflows for every step. It was removed on
> 5 November 2026 so that pasting this file cannot switch that mode on again. The rule now is workflows
> only for the big stages (STATE-AT-PAUSE.md §3).

# Handoff: continue the Brain System build (galaxy workspace)

You are taking over a task that another Claude Code session paused on 2026-10-31 at about 21:30 (local time,
UTC+5). Read this whole prompt before acting. The working directory is `C:\Users\User\projects\galaxy`
(Windows 11; Git Bash, PowerShell, Node 24 and Python with the `graphify` CLI are installed).

## 1. How to work with this user

- **Language:** reply to the user in **Uzbek**. Every project file (code, UI text, docs, data, file names,
  commit messages if ever asked) is **English only**, British spelling as in the existing docs.
- **Multi-agent mode was on (31 October; no longer applies):** the user wants exhaustive, verified work. Use the Workflow tool (read the
  `workflow-authoring` skill first) for research, building, fact-checking and review; adversarially verify
  findings; use subagents in parallel on disjoint files. Token cost is not a constraint; correctness is.
- **Graphify is mandatory and the user checks it** (they have asked twice whether it is used enough). Rules
  from `CLAUDE.md`, applied strictly: before any grep or source read run `graphify query "<question>"
  --budget 2500` from the workspace root; use `graphify explain "<symbol>"` for anything you call or change
  and `graphify path "<A>" "<B>"` for every route between structures/modules (qualify ambiguous labels as
  `"<file>::<label>"`); read raw files only at the lines the graph points to; run `graphify update .` after
  code changes (AST only, free). Put the same rule in every subagent prompt that explores code, and tell
  parallel subagents NOT to run `graphify update` themselves (concurrent runs corrupt `graph.json`; run it
  once between stages). After each workflow, measure graph use with
  `node .handoff/tools/graph_usage.js <workflow transcript dir>` and report the numbers to the user.
- **Never commit or push unless the user asks.** The repo (branch `master`) has no commits; everything is
  untracked. There is no git safety net — see §5 for backups.
- **Never stop or kill the user's own server** on port 8765 (a `python -m http.server` in a VS Code terminal).
  Brain System is served on **8768**: use the preview tool with the `brain-system` entry of
  `.claude/launch.json` (or `brain-system/start.bat`).
- **Content rules:** clinical, scientific, non-explicit tone; the body is a neutral anatomical figure with no
  genital structures (pelvic anatomy only as schematic nerves/plexuses, bladder, rectum). Photosensitivity:
  ≤ 3 flashes/s, large-area changes low-passed, dopamine lantern colour ≥ 2,200 K (2,300 K used).
- **HUD rules:** collapsible dropdowns; no secondary subtitles under any heading; settings and live data in
  dropdowns; works at 375 px.
- **Design decision made with the user:** modulators (prolactin, serotonin, GABA, opioids, oxytocin) may be
  shown as restrained, labelled low-chroma tints on their source nuclei, never on dopamine lanterns (the user
  chose "modulators shown in the model and the HUD"; the specs already say so).
- **Workflow gotchas:** subagents cannot Write report-like files (a hook blocks it) — have them return text
  and save it yourself, or have them Edit an existing file; workflow scripts are plain JS (no `Date.now()`,
  no `Math.random()`); a workflow's `resumeFromRunId` cache works only inside the session that ran it, so
  nothing from the old session can be resumed — re-run stages instead.
- **Windows gotchas:** run Python with `PYTHONIOENCODING=utf-8`; Wikipedia's REST API rate-limits
  (`HTTP 429`) — `.handoff/tools/retry.sh` captures with pauses; the browser preview pane pauses
  `requestAnimationFrame` while hidden, so step the app with `window.__brain.tick(now)` in a loop and
  re-fetch modules with `fetch(url, {cache: 'reload'})` before `location.reload()`.

## 2. The workspace

| Path | What it is |
|---|---|
| `anger-galaxy/` | Finished sibling project (WebGL2 star galaxy). Do not change it in this task. `orgasm-galaxy/` was removed on 2026-11-02; its response-model analysis is now `brain-system/research/RESPONSE.md` and its human-physiology captures are in `brain-system/raw/`. |
| `brain-system/` | **This project.** Renamed today from `orgasm-brain/` (folder, page title, HUD, graph ids and paths, launch config, memory all updated). |
| `brain-system/research/ANALYSIS.md` | The **canonical spec** for the whole-body extension (≈ 7,060 lines): §1 conventions, §2 frames and the reference body, §3 brain systems, §4 signal processing, §5 sensory, §6 somatic, §7 autonomic, §8 enteric, §9 neuroendocrine, §10 neuroimmune, §11 integration (switches, kernel), §12 scenarios and validation, §13 rendering/HUD/performance/safety, §14 sources, **Appendix A** the binding contract (frames, names A.3, clocks A.4, switch semantics A.5, stimuli A.6, decisions A.8, shared values A.9), **Appendix B** the implementation plan (B.3 current code, B.4 modules and interfaces, B.5 per-file changes, B.6 frame loop, B.7 GPU layout, B.8 budgets, B.10–B.12 HUD/switches/scenarios, B.13 orgasm scenario, B.14 tests, B.15 phases). Use Grep on headings and Read with offset/limit; it is too long to read whole. |
| `brain-system/research/DOPAMINE.md` | Spec of the **orgasm scenario** (dopamine model, 2,276 lines, §1–§11). Fact-checked in 3 rounds. |
| `brain-system/raw/` | 137 Wikipedia captures (18 dopamine + 119 nervous-system/senses/autonomic/enteric/endocrine/immune sources), all semantically in the graph. |
| `brain-system/src/` | The app (plain ES modules, no build step). New folders `src/sim/` and `src/body/` are being created by the build. |
| `brain-system/test/`, `brain-system/package.json` | Headless Node tests (`node --test` from `brain-system/`), created by the build. |
| `graphify-out/` | The knowledge graph (≈ 4,470 nodes after the last full merge at 18:06; later code edits not yet indexed). Backups: `graphify-out/backup-body-sources/`, `graphify-out/2026-10-31/`. |
| `.handoff/` | This prompt, the pre-build backup of the app, copies of all workflow scripts and helper tools, the DOPAMINE fact-check result. Excluded from the graph (`.graphifyignore`). |
| Memory | `C:\Users\User\.claude\projects\C--Users-User-projects-galaxy\memory\` (`MEMORY.md`, `galaxy-project.md`, `language-split.md`) — read them; update `galaxy-project.md` when the state changes. |
| Old session transcripts | `C:\Users\User\.claude\projects\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\subagents\workflows\<run id>\` (journal.jsonl + agent-*.jsonl). Build run: `wf_d2a72afc-205`; ANALYSIS fact-check run: `wf_a2e8f850-db6`. Builder reports, if any finished, are in the build journal. |

## 3. What the user asked (in order)

1. Earlier projects: Anger Galaxy, Orgasm Galaxy, then **Orgasm Brain** — a human brain made of tiny cool-white
   neuron stars with dopamine as warm amber lantern glow, simulating dopamine during orgasm with an explicit
   mathematical model (dopamine + modulators). Built and working (HUD, adaptive quality, three views).
2. Small fix (done): pressing **Stimulate** in Demo mode switches to Manual with the slider at zero.
3. **Current task (verbatim):** "Rename the project from 'Orgasm Brain' to 'Brain System'. Begin developing a
   complete model of the brain's biological networks distributed throughout the human body. Before modeling,
   conduct a comprehensive analysis of the brain's internal systems, signal processing, and neural responses
   to all sensory inputs. Following this analysis, proceed with modeling the distributed body networks. Do not
   create a new project — ensure the model can be dynamically toggled and modified within the existing single
   project structure. Allow the user to simulate the human model both with and without biological systems
   enabled."
4. The user's answers to clarifying questions: the orgasm/dopamine model **stays as a scenario**; model **all
   four** network groups (somatic; autonomic; enteric + gut–brain axis; neuroendocrine + neuroimmune);
   **master switch (brain only ↔ whole body) plus one switch per network**, a disabled network drops out and
   the rest respond accordingly; stimuli from **both** a manual panel (pick a sense, click a body site) and
   scripted scenarios.
5. The user then chose the **faster path**: start building now, in parallel with the remaining fact-checks,
   and fold the corrections in afterwards. They were told: first working version ≈ 3–4 h, everything ≈ 6–7 h.

## 4. What is done

- Rename to Brain System (all references, graph rewritten, `graphify update .` clean).
- Sources captured with `graphify add` and merged semantically into the graph (20 chunks, validated).
- `ANALYSIS.md` written by a 9-lens research workflow → framework architect → 14 writers (rewritten once to
  fix a numbering mismatch and a truncated section), assembled with `.handoff/tools/assemble_analysis.js`.
- `ANALYSIS.md` fact-check (6 lenses + one skeptic per major issue + editor): **round 1 done** — 48 major
  issues reported, 41 confirmed and applied, plus most of 78 minor ones. Round 2 was stopped while its six
  checkers were still reading, before its editor started, so **the file holds the complete round-1 revision
  and no partial round-2 edits; round 2 has to be re-run.** Important round-1 decision: **B.15 now starts with a "Phase 0a" — the
  DOPAMINE.md §9.8 port of `response.js` to the corrected galaxy response model — before any body work**, and
  "as today / bit-identical" in the spec now means the post-port build. The build workflow was launched before
  or around this edit, so its builders may not have followed it.
- `DOPAMINE.md` fact-check: 3 rounds, 22 → 11 → 4 confirmed major issues, all applied; round-3 fixes were not
  re-verified (minor risk). Result: `.handoff/results/dopamine-factcheck-3-rounds.json`.
- Earlier, in `main.js`: brightness tune values (somata 0.7, axons 0.22, release 0.35); `_dev.html` deleted.

## 5. State at the pause — verify before you change anything

- **Both workflows were stopped deliberately at 21:30 at the user's request** (build run `wf_d2a72afc-205`,
  ANALYSIS fact-check run `wf_a2e8f850-db6`). A file snapshot taken after the stop showed no further writes.
- **The build workflow (`.handoff/workflows/brain-system-build.js`) was in its first stage.** Six builders were
  writing in parallel (groundwork, kernel, body-geometry, brain-additions, render, hud); none had sent its
  report, so every one of them may be unfinished. Stages not started: graph update, the six network builders
  (somatic, autonomic, endocrine, enteric, immune, scenarios+interventions), integration (`main.js`,
  `performance.js`, README), verification and fixes.
- Final file state at the stop (compared with the backup):
  - changed: `src/anatomy.js`, `brain.js`, `camera.js`, `color.js`, `gl-utils.js`, `renderer.js`,
    `response.js`, `shaders.js`, `ui.js`, `index.html`, `style.css`;
  - new: `package.json`, `src/clock.js`, `src/safety.js`, `src/statetex.js`, `src/ui-body.js`,
    `src/sim/graph.js`, `src/sim/kernel.js`, `src/sim/orgasm-adapter.js`, `src/body/frame.js`,
    `src/body/geometry.js` (last written 21:30:34, seconds before the stop — check it is complete),
    `test/clock`, `dopamine`, `geometry-brain`, `hud-static`, `orgasm-regression`, `safety`, `shaders`
    `.test.mjs`, `test/golden/orgasm-legacy.json`;
  - not yet written: `src/body/generate.js`, `src/body/picking.js`, `src/sim/brainnet.js`, `sensory.js`,
    `stimuli.js`, every network module (`somatic`, `autonomic`, `endocrine`, `enteric`, `immune`),
    `scenarios.js`, `interventions.js`; `main.js` and `performance.js` are unchanged.
  - Every `.js` file passes `node --check`. `node --test` from `brain-system/`: **132 tests, 119 pass, 0 fail,
    13 todo** (≈ 20 s).
- **The app on port 8768 still loads** (checked after the stop at 21:31: no console errors, the brain renders,
  the demo cycle runs), but it is mid-build: the new HUD dropdowns (Body "Brain only", Interventions,
  Stimulus, Scenarios, Time, Brain systems, Views) are visible yet not wired, because `main.js` is still the
  old one (only the integrator rewires it); and the brain looked washed out / overexposed in the centre in a
  small preview — check the shading against the backup (the `uState` texture migration in `shaders.js`,
  `renderer.js`, `statetex.js` is the first suspect). Nothing is corrupted at byte level (each edit writes a
  whole file), but the foundation modules may be unfinished.
- **Backup of the last working app:** `.handoff/backup-brain-system-pre-build/` (`src/`, `index.html`,
  `style.css`, `README.md`, `start.bat`). The app needs nothing else at runtime, so the old version can be shown
  without touching the in-progress files: `python -m http.server 8769 --bind 127.0.0.1 --directory
  .handoff/backup-brain-system-pre-build`. Do not overwrite the in-progress files unless the user asks.
- The old session's workflows are stopped. If the old session is somehow still open and working, ask the user to
  stop it before you edit anything — two sessions editing the same files would conflict.

First steps for you:
1. Read memory, then `graphify query` the brain-system code to orient yourself (most new files are not in the
   graph yet — run `graphify update .` first once you have confirmed no other session is writing).
2. Inventory: diff every file against the backup; `node --check` every `.js`; `node --test` from
   `brain-system/`; for each module in Appendix B.4, record whether it exists, exports the B.4 interface and
   passes its tests. Check `src/sim/graph.js` for the plugin contract the network modules must implement.
3. Read Appendix B.15 (now with Phase 0a) and decide with this inventory what remains.
4. Tell the user (in Uzbek) what you found and the plan, then continue.

## 6. Plan to finish (each substantive step as a workflow)

1. **Finish the build.** Simplest: run `.handoff/workflows/brain-system-build.js` again after adding one line to
   its CONTEXT: "An interrupted run already wrote some of these files: read what exists, keep what is correct
   against the spec, complete what is missing, and do not regress working parts." Also tell it about Phase 0a
   (decide whether the DOPAMINE.md §9.8 port happens now or as a separate step — the spec puts it first; the
   orgasm regression test must compare against the legacy path of the same commit). Its stages: foundation
   (groundwork + orgasm adapter + clock; kernel + graph schema + brainnet + sensory + stimuli; body geometry;
   brain additions; rendering incl. state texture and body pass; HUD) → `graphify update` → networks
   (somatic, autonomic, endocrine, enteric, immune, scenarios + interventions) → integration → independent
   verification with up to two fix rounds. Constants live in `PARAMS` objects with § citations.
2. **Finish the ANALYSIS fact-check** if round 2 did not complete: run
   `.handoff/workflows/brain-system-analysis-verify.js` (it runs up to 2 rounds; consider adding the strict
   graph rule to its CONTEXT). Then **fold the corrections into the code**: grep the code for § citations of
   changed sections and update `PARAMS`.
3. **Add the specs and docs to the graph semantically** (they only have heading nodes): `ANALYSIS.md`,
   `DOPAMINE.md`, `brain-system/README.md`, `brain-system/index.html`, the root `README.md`, and
   `brain-system/research/RESPONSE.md`. Adapt `.handoff/workflows/graphify-project-docs.js`
   (paths changed from orgasm-brain to brain-system; split `ANALYSIS.md` into several chunks by section line
   ranges because the extraction spec bounds lines per chunk) and merge with the graphify `--update` flow
   (`~/.claude/skills/graphify/SKILL.md` + `references/update.md`), as `.handoff/workflows/graphify-body-sources.js`
   does in its Merge stage.
4. **Code review:** adapt `.handoff/workflows/orgasm-brain-review.js` (paths, whole Brain System scope, the two
   specs) — lenses model fidelity, render correctness, anatomy/safety/content, performance/robustness, plus a
   switch-semantics lens; two skeptics per finding; a fixer that re-runs `node --test`.
5. **Browser verification** (preview tool, `brain-system` entry): brain only vs whole body; every network
   switch on/off with a probe stimulus; the stimulus panel (pick a body site, deliver each sense); every
   scenario (hotObject, kneeJerk, loudSound, brightLight, standUp, stressor, meal, infection, orgasm);
   `?body=0&scenario=orgasm` must reproduce today's orgasm experience; 375 px layout; reduced motion; no console
   errors. Save screenshots to `brain-system/screenshots/` (ignored by the graph) and send them to the user.
6. **Wrap up:** `graphify update .`; README (features, controls, switch table, test command); update memory;
   report graph-usage numbers; tell the user what is done and what is not verified.
7. **Follow-up to offer the user (separate task):** re-verify the DOPAMINE.md round-3 edits.

## 7. Useful details

- Brain frame = body frame: MNI-152 mm, origin ≈ anterior commissure, x right, y anterior, z superior; scene
  scale 0.01 units per mm; stature 1,760 mm, floor at z = −1,672 mm (Appendix A.2).
- Point budgets per tier (B.8): neurons 60k/130k/240k/400k; body 32.5k/63k/104k/158k; extra brain nuclei
  3k–18k; ≤ 256 visible packets.
- The existing brain buffer (seed 1848) must stay bit-identical; region ids 0–32 keep their indices; per-region
  state moves from uniform arrays to a data texture because 122 regions exceed the vertex-uniform budget.
- URL parameters planned (B.5): `body` (0/1), `nets`, `scenario`, `seed`, `time`, `view`, `quality`.
- Tests planned (B.14): dopamine, orgasm-regression, determinism, latency, switches, scenarios, geometry,
  safety, budget, hud-static.
- `window.__brain` exposes `tune, model, dopamine, camera, quality, renderer, tick, setView` today, and should
  add `kernel, clock, scenarios, stimuli, adapter, safety`.
- Old-session estimate given to the user: about 6–7 hours of work remained at the pause (build ≈ 3–4 h to a
  first working version, then fact-check folding, docs into the graph, review, browser verification).
