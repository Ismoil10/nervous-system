## Scope

All work is on `brain-system/`. `anger-galaxy/` is a separate project that has nothing to do with this work: do not read, change, cite or borrow from it. It is excluded from the graph (`.graphifyignore`). Scope greps and searches to `brain-system/`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships. It covers Brain System only: its JavaScript (AST), and the research notes and source captures behind it (semantic).

Graph use is enforced by the project graph gate, `.claude/hooks/graph-gate/` (wired in `.claude/settings.json`). It applies to the main session and to every subagent and workflow agent. Work with it:

- **Ask by name before you search.** A Grep/Glob/grep/rg/find for a camelCase/PascalCase name is blocked until you have run `graphify explain "<Name>"` (or `affected`, `path`, `query --seed`, or an `mcp__graphify__*` lookup) from the repo root. Use one name per `explain`; a prose `graphify query` without `--seed` names nothing.
- **Let the graph locate a source file before you print it.** These are blocked until a graph answer shown to you named that file: Read, cat/sed/head, `< file`, grep over one or two files, diff, git show/blame/log -p, and scripts that open() it. Answers that count:
  - `graphify explain "brain-system/src/renderer.js"`;
  - an explain/affected/path on a symbol the file defines;
  - a `graphify query` that lists the file;
  - an MCP answer;
  - GRAPH_REPORT.md.

  Then read only the lines the graph pointed to. Research notes, raw/ captures, Markdown, JSON (package.json included) and other data are never gated.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output. Read graphify-out/GRAPH_REPORT.md only for broad architecture review, or when query/path/explain do not surface enough context. If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- **Keep the graph current.** The gate starts `graphify watch` at session start and installs graphify's git hooks once per clone. Without a watcher, the main agent runs `graphify update .` after code changes (AST-only, no API cost). Subagents never run `graphify update/extract/watch/add/export`: the gate blocks it, because concurrent rebuilds collide.
- **Check impact before you finish.** When a turn changed code, the gate stops it once and asks for `graphify affected "<changed declaration, or the function/method around a body edit>" --depth 2`, or the graph-scout agent's impact check. Then confirm with grep. The graph misses calls on another object whose class it cannot infer (`renderer.render()`, `r.drive()`) and calls inside anonymous `test()` callbacks. `this.method()` calls are in it.
- Hand where-is / who-calls / what-breaks questions to the **graph-scout** agent (`.claude/agents/graph-scout.md`). The graphify MCP server is in `.mcp.json`; approve it once for this project folder.
- Run **/graph-usage** to audit how well a session (and its subagents) used the graph.
- Do not run `graphify claude install` or `graphify uninstall` here; the gate blocks both, because it replaces graphify's own hook-guard.
- To switch the gate off, create `.graph-gate-off` in the repo root or set `GRAPH_GATE=off`.
- On Windows the gate needs Git Bash, which Claude Code uses to run hooks. It also needs `graphify` on PATH; without it the gate stands aside and says so at session start.
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
