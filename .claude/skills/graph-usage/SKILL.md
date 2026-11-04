---
name: graph-usage
description: Audit how well Claude Code sessions in this repo used the Graphify knowledge graph - graph queries against source reads and searches, per agent (main session, subagents, workflow agents), plus what the graph gate denied. Use when the user asks whether graphify or the knowledge graph is used enough, after a workflow or multi-agent run, or before reporting that work followed the graph-first rules.
argument-hint: "[--last N | --session ID | --all] [--json]"
---

# Graph usage audit

Run the audit from the repo root (it reads this project's Claude Code transcripts and the
graph gate's log; it changes nothing):

```bash
sh .claude/hooks/graph-gate/run.sh usage $ARGUMENTS
```

With no arguments it covers the newest session (`--last 1`). `--last N` covers the N newest
sessions, `--session <id>` one session, `--all` every session, and `--json` prints the same
data as JSON.

Report to the user, in a few lines:

1. The totals: by-name graph queries (explain / affected / path / query --seed), prose
   queries, MCP graph calls, graph rebuilds; source-file reads; searches; gate denials.
2. The ratios: graph calls per source read, and the share of source reads that came after
   that agent's first graph call.
3. Every agent that read or searched code with no graph call, or before its first one, by
   label. While the gate is on there should be none; if there are, say which and why the
   gate let them through if the transcript shows it (a file the graph does not index, a
   search with no camelCase name).
4. The verdict line the script prints (`Graph-first: OK` or `Graph-first: GAPS`).

Quote the numbers as printed; do not round them up or describe the result as better than
the verdict line says.
