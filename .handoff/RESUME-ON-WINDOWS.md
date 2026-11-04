# Move the Brain System build from the Mac to Windows

Three parts, in this order:

1. On the Mac, send the **pause prompt** to the build session. It stops the work, writes
   `.handoff/STATE-AT-PAUSE.md` and pushes everything to the branch `wip/brain-build-pause`.
2. On Windows, do the **setup** once.
3. On Windows, paste the **resume prompt** into a new Claude Code session.

Do not work on both computers at once. After the push, the Mac copy is frozen until you pull
the branch there again.

---

## 1. Pause prompt (on the Mac, to the session "Brain System build: finish from the handoff")

```text
Pause the build now. We are moving to my Windows 11 computer and will continue there in a new Claude Code session that has none of your context: no transcript, no memory, no workflow cache. Do these steps in order, then report to me in Uzbek.

1. Stop. Stop every running workflow and background agent, the stage-5 integration agent included. Start nothing new. Wait until no file under brain-system/ has changed for 60 seconds.
2. Check the tree. Run `node --check` on every .js file in brain-system/src and brain-system/test. Then, in brain-system/, run `npm test` and `npm run typecheck`. Note the pass/fail/todo counts and the name of every failing test.
3. Refresh the graph. Run `graphify update .` once from the repo root and check that it ends without errors.
4. Write `.handoff/STATE-AT-PAUSE.md` (English, British spelling). The next session reads it on a fresh machine, so it must stand on its own:
   - the time of the pause and the commit it describes;
   - each build stage (1 to 8): done, partly done or not started, and what "done" was checked against;
   - the interrupted stage: what the stopped agent was doing, every file it touched, and which of those may be unfinished;
   - the results of step 2: the counts, each failing test and why it fails (if known), compared with the earlier baseline;
   - every decision I made in your session that is not yet in the specs or the README (for example: TypeScript through JSDoc, `// @ts-check` and `tsc --noEmit`, no React, no build step);
   - known problems and open questions;
   - the remaining plan, step by step, with time estimates, marking the stages where a workflow is worth it;
   - the workflow scripts used (paths), noting that their run ids cannot be resumed on another machine.
   Add one line to the top of `.handoff/HANDOFF-PROMPT.md`: it is superseded by `STATE-AT-PAUSE.md` and `RESUME-ON-WINDOWS.md`.
5. Commit and push. I am asking for this explicitly.
   - Add `.DS_Store` to `.gitignore`.
   - Create the branch `wip/brain-build-pause` from main.
   - Commit every change and new file (no `.DS_Store`, nothing gitignored), `.handoff/RESUME-ON-WINDOWS.md` included, with a clear message.
   - Push the branch to origin with upstream set.
   - If graphify's post-commit hook rewrites graphify-out/ afterwards, commit that as a second commit and push again.
   - `git status` must end clean.
   - Do not push to main and do not merge.
6. Do not stop my own servers on ports 8765 and 8768. Change nothing after the push.

Report the branch, the last commit hash, the test counts and the next step from STATE-AT-PAUSE.md.
```

---

## 2. Setup on Windows (once)

The old folder `C:\Users\User\projects\galaxy` is a stale copy from 31 October. Do not work in
it.

1. **Tools.** Git for Windows (Git Bash) is required: Claude Code runs the project's hooks with
   it. Install the rest in PowerShell, skipping what you already have:

   ```powershell
   winget install Git.Git OpenJS.NodeJS.LTS astral-sh.uv
   ```

   Requirements:
   - Python 3.9 or newer from python.org, with "Add python.exe to PATH" ticked.
   - Node 26, the same version as the Mac. Node 24 ran the old tests, but 26 is safer.

2. **graphify 0.9.95 and TypeScript 7.0.2** (the Mac's versions). Open a new PowerShell window
   and run:

   ```powershell
   uv tool install graphifyy==0.9.95
   uv tool update-shell
   npm install -g typescript@7.0.2
   ```

   If you installed graphify with pip before, use `pip install -U graphifyy==0.9.95` instead
   of the uv line. Afterwards, `graphify --version` and `graphify-mcp --help` must work in a
   new Git Bash window.

3. **Clone the branch.** Sign in to GitHub when asked; the repository is private.
   `core.autocrlf=false` keeps the files' LF line endings exactly as on the Mac. Some tests
   read `index.html` as text.

   ```powershell
   cd C:\Users\User\projects
   git clone -c core.autocrlf=false -b wip/brain-build-pause https://github.com/Ismoil10/nervous-system.git
   ```

4. **Open the session.**
   - In the Claude desktop app (Code tab), open `C:\Users\User\projects\nervous-system` in a
     new session.
   - Choose model Opus 5.5 and effort High.
   - When asked, approve the project's `graphify` MCP server.

5. Paste the resume prompt below.

---

## 3. Resume prompt (paste into the new session on Windows)

```text
Continue the Brain System build from the pause on 4 November 2026. Another Claude Code session built it on my Mac. You have none of its context, so the repository is your only source. Read everything below before acting.

How to work with me
- Reply to me in Uzbek. Every project file (code, UI text, docs, data, commit messages) is English, British spelling.
- All work is on brain-system/. anger-galaxy/ is a separate project: never read, cite or change it.
- Use the Graphify graph first, as CLAUDE.md says. The project graph gate (.claude/hooks/graph-gate) enforces it; do not switch it off. After each workflow, run /graph-usage and give me the numbers.
- Use workflows (the Workflow tool) only for the big stages. Do small steps directly or with one subagent. Parallel subagents never run `graphify update`; you run it once between stages.
- Never commit or push unless I ask. Never stop or kill my own server on port 8765. Brain System is served on port 8768.
- Content rules: clinical, scientific, non-explicit tone; the body is a neutral anatomical figure with no genital structures; photosensitivity at most 3 flashes per second.

Steps
1. Read, in this order:
   - CLAUDE.md;
   - .handoff/STATE-AT-PAUSE.md: the state and the remaining plan; it wins over older notes;
   - only the parts of .handoff/HANDOFF-PROMPT.md that STATE-AT-PAUSE.md points to. Its Windows paths and its first line (multi-agent workflows for every step) are out of date.
2. Check this machine. Tell me what is missing instead of working around it.
   - `git status` is clean on the branch wip/brain-build-pause.
   - Versions: node 26, tsc 7.0.2, graphify 0.9.95, graphify-mcp on PATH, python 3.9 or newer.
   - The gate runs: the graph-first protocol message appeared at session start, and `python .claude/hooks/graph-gate/tests/test_gate.py` passes.
   - If %USERPROFILE%\.claude\hooks\graph-gate\gate.py exists (a machine-wide gate), check whether it defers to the project gate (look for `load_deferrals` in it). If it does not, tell me, and do not edit it.
   - .claude/launch.json starts its servers with `python3`. If that is not a real Python here, add separate entries ending in `-win` that use `python`, and leave the existing entries unchanged.
3. Baseline. Run `graphify update .` from the repo root. Then, in brain-system/, run `npm test` and `npm run typecheck`. Compare the counts with STATE-AT-PAUSE.md, and explain any difference before you change code.
4. Save these facts to your memory for this project:
   - reply in Uzbek, files in English (British);
   - brain-system only;
   - the graph gate and /graph-usage;
   - the decisions of mine listed in STATE-AT-PAUSE.md.
5. Tell me in Uzbek what you found and the plan, with time estimates. Then continue with the next step in STATE-AT-PAUSE.md.

Windows notes
- Run Python with PYTHONIOENCODING=utf-8.
- The browser preview pane pauses requestAnimationFrame while hidden. Step the app with window.__brain.tick(now) in a loop, and re-fetch modules with fetch(url, {cache: 'reload'}) before location.reload().
```
