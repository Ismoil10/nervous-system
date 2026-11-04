# Galaxy workspace

Scientific visualizations that model human states with realistic, moving stars: a galaxy and a star-built brain and body.

| Project | What it models | Start |
|---|---|---|
| [anger-galaxy](anger-galaxy/README.md) | Human anger: arousal cycle, outburst and recovery in an unbarred spiral | `anger-galaxy/start.bat` (port 8765) |
| [brain-system](brain-system/README.md) | The brain and its nerve networks throughout a human body made of stars; dopamine across the sexual response cycle as one scenario | `brain-system/start.bat` (port 8768) |

Each project keeps its own research (`research/ANALYSIS.md`) and source captures (`raw/`).
The Graphify knowledge graph of Brain System is in `graphify-out/` (`graph.html` for the
interactive view). Anger Galaxy is excluded from it (`.graphifyignore`). After code changes run
`graphify update .` from this folder.
Claude Code sessions here must use the graph first. The project graph gate in
`.claude/hooks/graph-gate/` (see `CLAUDE.md`):
- blocks searching or reading indexed source that the graph has not shown the agent;
- keeps the graph fresh;
- stops a turn that changed code once, to ask for a graph impact check.

`/graph-usage` audits how well a session used it.
