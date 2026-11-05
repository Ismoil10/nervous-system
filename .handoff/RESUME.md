# Resume the Brain System build on another computer

This replaces `.handoff/RESUME-ON-WINDOWS.md`. The build was paused on Windows on 5 November 2026, on the
branch `wip/brain-build-windows`. That branch is merged into `main` (pull request #2, merge commit
`0101203`), so `main` holds all the work. Continue on a new branch cut from `main`, never on `main` itself.
The state, decisions and remaining plan are in `.handoff/STATE-AT-PAUSE.md`.

Two parts, in this order:

1. On the new computer, do the **setup** once.
2. Paste the **resume prompt** into a new Claude Code session.

Do not work on two computers at once. Push the branch before you stop on one computer, and pull it before
you continue on the other.

---

## 1. Setup (once per computer)

**Tools.** Install these, skipping what you already have:
- Git. On Windows, Git for Windows (Git Bash), which Claude Code uses to run the project's hooks.
- Node 26 (the build used 26.13 on Windows and 26.4 on the Mac).
- Python 3.9 or newer. On Windows, use python.org with "Add python.exe to PATH" ticked.
- uv (optional, for graphify).

Windows (PowerShell):

```powershell
winget install Git.Git OpenJS.NodeJS.LTS astral-sh.uv
```

macOS:

```bash
brew install git node uv
```

Then install graphify and TypeScript 7.0.2:

```bash
uv tool install graphifyy==0.9.97
```

```bash
uv tool update-shell
```

```bash
npm install -g typescript@7.0.2
```

- If graphify was installed with pip before, run `pip install -U graphifyy==0.9.97` instead.
- 0.9.95 (Mac) and 0.9.97 (Windows) built the same graph.
- In a new terminal, `graphify --version`, `graphify-mcp --help`, `node --version` and `tsc --version` must
  all work.
- Windows: if `tsc` fails in Git Bash with `node_modules/node/bin/node: No such file`, a broken global npm
  package `node` shadows Node. Remove it with `npm uninstall -g node`.

**Clone and cut the work branch.** The repository is private; sign in to GitHub when asked.
`core.autocrlf=false` keeps the files' LF line endings.

```bash
git clone -c core.autocrlf=false https://github.com/Ismoil10/nervous-system.git
```

On Windows, clone into `C:\Users\User\projects`; on the Mac, into the projects folder used there. Then,
inside the clone, cut the work branch from `main`. Name it after the computer, for example
`wip/brain-build-mac`. On Windows pick a new name: `wip/brain-build-windows` is already merged.

```bash
git switch -c wip/brain-build-mac
```

If a clone already exists, fetch and cut the branch straight from `origin/main`. Do not switch to the local
`main` first: it may be behind, and the switch fails while the gate's `graphify-out/manifest.json` change is
in the tree.

```bash
git fetch
```

```bash
git switch -c wip/brain-build-mac origin/main
```

On the Mac, the existing checkout (`/Users/ismoil/projects1/nervous-system`) is on the old
`wip/brain-build-pause` branch, which now holds `main`'s content (`0101203`); leave that branch alone and
run these two steps.

**Open the session.**
- In the Claude desktop app (Code tab), open the clone's folder in a new session.
- Choose Opus 5.5, effort High.
- Approve the project's `graphify` MCP server when asked.
- Then paste the prompt below.

---

## 2. Resume prompt (paste into the new session)

```text
Continue the Brain System build from the pause on 5 November 2026. Earlier Claude Code sessions built it on my Mac and then on my Windows computer. You have none of their context, so the repository is your only source. Read everything below before acting.

How to work with me
- Reply to me in Uzbek. Every project file (code, UI text, docs, data, commit messages) is English, British spelling.
- All work is on brain-system/. anger-galaxy/ is a separate project with no connection to this one: never read, cite or change it.
- Use the Graphify graph first, as CLAUDE.md says. The project graph gate (.claude/hooks/graph-gate) enforces it; do not switch it off. After each workflow, run /graph-usage and give me the numbers.
- Use workflows (the Workflow tool) only for the big stages (docs into the graph, code review). Do small steps directly or with one subagent. Subagents never run `graphify update`; you run it once between stages.
- Never commit or push unless I ask. Never stop or kill my own servers on ports 8765 and 8768. Brain System is served on port 8768.
- Content rules: clinical, scientific, non-explicit tone; the body is a neutral anatomical figure with no genital structures; photosensitivity at most 3 flashes per second.

Steps
1. Read, in this order: CLAUDE.md; .handoff/STATE-AT-PAUSE.md (the state, my decisions and the remaining plan; it wins over every older note in .handoff/).
2. Check this machine. Tell me what is missing instead of working around it.
   - You are on a `wip/` branch cut from `main` at `0101203` or later, never on `main` itself. `git status` shows no changes outside graphify-out/; the gate's session-start `graphify update` rewrites graphify-out/manifest.json with this machine's file times, which is expected. `git config core.autocrlf` is false or unset in this clone.
   - Versions: node 26, tsc 7.0.2, graphify 0.9.95 or newer, graphify-mcp on PATH, python 3.9 or newer.
   - The gate runs: the graph-first protocol message appeared at session start, and `python .claude/hooks/graph-gate/tests/test_gate.py` passes (on Windows run it with PYTHONUTF8=1).
   - .claude/launch.json: on Windows use the `-win` entries (python); on the Mac the original entries (python3).
3. Baseline. Run `graphify update .` from the repo root. Then, in brain-system/, run `npm test` and `npm run typecheck`. Compare with STATE-AT-PAUSE.md §4 and explain any difference before you change code. The orgasm golden traces are platform-specific (STATE §3 decision 1, §4): on arm64 (the Mac) the four golden tests in orgasm-regression.test.mjs fail in the last bits. Tell me, and ask before re-recording; STATE §6 has an option that needs no re-recording.
4. Save to your memory for this project: reply in Uzbek, files in English (British); brain-system only; the graph gate and /graph-usage; every decision of mine listed in STATE-AT-PAUSE.md §3.
5. Tell me in Uzbek what you found and the plan, with time estimates. Then continue with the next step of the remaining plan in STATE-AT-PAUSE.md §7.

Machine notes
- Windows: run Python with PYTHONUTF8=1 and PYTHONIOENCODING=utf-8 (the ANSI code page is cp1251).
- The browser preview pane may pause requestAnimationFrame and may show a stale screenshot. Step the app with window.__brain.tick(now) in a loop, re-fetch changed modules with fetch(url, {cache: 'reload'}) before location.reload(), and change something in the DOM before a screenshot (or measure with gl.readPixels) so the capture is fresh.
```
