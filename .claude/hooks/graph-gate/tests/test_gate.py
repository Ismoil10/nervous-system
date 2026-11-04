#!/usr/bin/env python3
"""Hermetic tests for the project graph gate, .claude/hooks/graph-gate/gate.py.

Run from the repo root with any Python 3.8+ (stdlib only; macOS, Linux and Windows):

    python3 .claude/hooks/graph-gate/tests/test_gate.py
    python3 .claude/hooks/graph-gate/tests/test_gate.py -v -k Stop     # a subset

What a test touches: every test class makes its own temp dir holding a throw-away git
repo (src/engine.js, src/render.js, src/sim/render.js and package.json, which the
synthetic graph indexes as code the way the real graph indexes brain-system/package.json;
README.md, docs/notes.md and data/config.json, which it does not), a synthetic
graphify-out/graph.json (code nodes in those files, two document nodes, links,
built_at_commit = HEAD) and graphify-out/manifest.json (per-file mtime). gate.py is copied
to <tmp>/.claude/hooks/graph-gate/gate.py, so the gate's PROJECT_ROOT is that temp repo,
and is run as `sys.executable gate.py <mode>` with a hook payload on stdin and
    GRAPH_GATE_PROJECT_STATE, GRAPH_GATE_STATE   temp dirs
    GRAPH_GATE_NO_WATCH=1, GRAPH_GATE_NO_GIT_SETUP=1
    GRAPHIFY_BIN                                 a fake graphify that logs its args, exits 0
    HOME, USERPROFILE                            a temp dir (~/.cache/graphify-watch too)
so the real repo, ~/.cache and ~/.claude are never touched and no real graphify runs.
Graph answers reach the post hook as synthetic text in graphify 0.9.x's own formats.

Every gate run must exit 0 and print nothing or one pure-ASCII JSON object; run_gate()
checks that on every call. Tests marked @unittest.expectedFailure pin known gate bugs
(the comment above each names the bug); they pass while the bug is there and turn into
"unexpected success" once it is fixed.
"""
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GATE_DIR = os.path.dirname(TESTS_DIR)
GATE_SRC = os.path.join(GATE_DIR, "gate.py")
RUN_SH_SRC = os.path.join(GATE_DIR, "run.sh")
HAVE_GIT = shutil.which("git") is not None
POSIX = os.name == "posix"
IS_ROOT = POSIX and hasattr(os, "geteuid") and os.geteuid() == 0
# On POSIX the gate asks `ps` whether a `graphify watch` runs, and treats "cannot tell"
# as running - then Stop never reports a stale graph. Those assertions need `ps`.
WATCHER_CHECK = os.name == "nt" or shutil.which("ps") is not None


# ----------------------------------------------------------------- the fixture repo

SOURCES = {
    "src/engine.js": (
        'import { PixelRenderer } from "./render.js";\n'   # 1
        "\n"                                                # 2
        "export class BrainEngine {\n"                      # 3
        "  constructor() {\n"                               # 4
        "    this.renderer = new PixelRenderer();\n"        # 5
        "  }\n"                                             # 6
        "\n"                                                # 7
        "  tick(dt) {\n"                                    # 8
        "    return dt * 2;\n"                              # 9
        "  }\n"                                             # 10
        "}\n"                                               # 11
        "\n"                                                # 12
        "export function startEngine() {\n"                 # 13
        "  const engine = new BrainEngine();\n"             # 14
        "  return engine.tick(1);\n"                        # 15
        "}\n"),                                             # 16
    "src/render.js": (
        "export class PixelRenderer {\n"
        "  draw(ctx) {\n"
        "    return ctx;\n"
        "  }\n"
        "}\n"),
    "src/sim/render.js": (
        "// simulation-side renderer\n"
        "export class SimRenderer {\n"
        "  step(n) {\n"
        "    return n + 1;\n"
        "  }\n"
        "}\n"),
    "package.json": '{\n  "name": "demo",\n  "version": "1.0.0"\n}\n',
    "README.md": "# Demo\n\nBrainEngine drives src/engine.js and draws with PixelRenderer.\n",
    "docs/notes.md": "# Design Notes\n\nSimRenderer lives in src/sim/render.js.\n",
    "data/config.json": '{\n  "speed": 1\n}\n',
}
CODE_FILES = ["src/engine.js", "src/render.js", "src/sim/render.js", "package.json"]


def _node(nid, label, sf, loc, ftype="code"):
    return {"id": nid, "label": label, "file_type": ftype, "source_file": sf,
            "source_location": loc, "norm_label": label.lower(), "community": 0,
            "_origin": "ast"}


NODES = [
    _node("src_engine", "engine.js", "src/engine.js", "L1"),
    _node("src_engine_brainengine", "BrainEngine", "src/engine.js", "L3"),
    _node("src_engine_brainengine_tick", ".tick()", "src/engine.js", "L8"),
    _node("src_engine_startengine", "startEngine()", "src/engine.js", "L13"),
    _node("src_render", "src/render.js", "src/render.js", "L1"),
    _node("src_render_pixelrenderer", "PixelRenderer", "src/render.js", "L1"),
    _node("src_render_pixelrenderer_draw", ".draw()", "src/render.js", "L2"),
    _node("src_sim_render", "src/sim/render.js", "src/sim/render.js", "L1"),
    _node("src_sim_render_simrenderer", "SimRenderer", "src/sim/render.js", "L2"),
    _node("package", "package.json", "package.json", "L1"),
    _node("readme_overview", "Overview", "README.md", "L1", "document"),
    _node("docs_notes_design_notes", "Design Notes", "docs/notes.md", "L1", "document"),
]


def _link(s, t, rel):
    return {"source": s, "target": t, "relation": rel, "confidence": "EXTRACTED",
            "confidence_score": 1.0, "weight": 1.0, "_origin": "ast"}


LINKS = [
    _link("src_engine", "src_engine_brainengine", "contains"),
    _link("src_engine", "src_engine_startengine", "contains"),
    _link("src_engine_brainengine", "src_engine_brainengine_tick", "method"),
    _link("src_engine_startengine", "src_engine_brainengine", "calls"),
    _link("src_engine", "src_render", "imports"),
    _link("src_render", "src_render_pixelrenderer", "contains"),
    _link("src_render_pixelrenderer", "src_render_pixelrenderer_draw", "method"),
    _link("src_sim_render", "src_sim_render_simrenderer", "contains"),
    _link("readme_overview", "src_engine_brainengine", "references"),
]


def graph_json(built_at):
    # built_at_commit last, as graphify writes it (the gate reads the file's tail)
    return json.dumps({"directed": False, "multigraph": False, "graph": {}, "nodes": NODES,
                       "links": LINKS, "hyperedges": [], "built_at_commit": built_at},
                      indent=1)


# ------------------------------------------- graph answers in graphify 0.9.x's formats

EXPLAIN_BRAINENGINE = (                      # graphify explain "BrainEngine"
    "Node: BrainEngine\n"
    "  ID:        src_engine_brainengine\n"
    "  Source:    src/engine.js L3\n"
    "  Type:      code\n"
    "  Community: BrainEngine\n"
    "  Degree:    4\n"
    "\n"
    "Connections (4):\n"
    "  <-- engine.js [contains] [EXTRACTED] src/engine.js:L3\n"
    "  <-- startEngine() [calls] [EXTRACTED] src/engine.js:L14\n"
    "  <-- Overview [references] [EXTRACTED] README.md:L1\n"
    "  --> .tick() [method] [EXTRACTED] src/engine.js:L8\n")

EXPLAIN_ENGINE_FILE = (                      # graphify explain "src/engine.js"
    "Node: engine.js\n"
    "  ID:        src_engine\n"
    "  Source:    src/engine.js L1\n"
    "  Type:      code\n"
    "  Community: BrainEngine\n"
    "  Degree:    3\n"
    "\n"
    "Connections (3):\n"
    "  --> BrainEngine [contains] [EXTRACTED] src/engine.js:L3\n"
    "  --> startEngine() [contains] [EXTRACTED] src/engine.js:L13\n"
    "  --> src/render.js [imports] [EXTRACTED] src/engine.js:L1\n")

AMBIGUOUS_RENDER = (                         # graphify explain "render.js" (exit 4)
    "No exact match for 'render.js'. These names contain it, but none is called that:\n"
    "  src/render.js  src/render.js L1\n"
    "  src/sim/render.js  src/sim/render.js L1\n"
    "Retry with the exact label, a path::symbol form (e.g. "
    "src/render.js::src/render.js), or the full node id.\n")

QUERY_PROSE = (                              # graphify query "how is drawing done" --budget 400
    "Graph: graphify-out/graph.json (12 nodes) | Traversal: BFS depth=2 | Start: "
    "['PixelRenderer', 'Overview'] | 4 nodes found\n"
    "\n"
    "[!] TRUNCATED: showing 3 of 4 nodes (~400-token budget). The answer may be among the "
    "1 cut nodes — raise the token budget to 600 to get all 4 (CLI: --budget 600, MCP: "
    "token_budget=600) or narrow the query (e.g. context_filter=['call'], or get_node for a "
    "specific symbol).\n"
    "\n"
    "NODE PixelRenderer [src=src/render.js loc=L1 community=Render]\n"
    "NODE .draw() [src=src/render.js loc=L2 community=Render]\n"
    "NODE Overview [src=README.md loc=L1 community=Docs]\n"
    "... (truncated — 1 more nodes cut by ~400-token budget. Narrow with "
    "context_filter=['call'] or use get_node for a specific symbol)\n")

NO_MATCH_BRAIN = "No node matching 'Brain' found.\n"     # graphify explain "Brain" (exit 4)

MCP_SIMRENDERER = (                          # mcp__graphify__get_node {"label": "SimRenderer"}
    "Node: SimRenderer\n"
    "  ID: src_sim_render_simrenderer\n"
    "  Source: src/sim/render.js L2\n"
    "  Type: code\n"
    "  Degree: 1\n")

GRAPH_REPORT = (                             # graphify-out/GRAPH_REPORT.md
    "# Graph Report - repo  (2026-11-04)\n"
    "\n"
    "## Summary\n"
    "- 12 nodes · 9 edges · 3 communities\n"
    "\n"
    "## Community Hubs (Navigation)\n"
    "- src/render.js\n"
    "- Sim\n"
    "\n"
    "## Surprising Connections\n"
    "  README.md → src/render.js\n")


def affected_out(name, where="src/engine.js:L14"):   # graphify affected "<name>" --depth 2
    return ("Affected nodes for %s\n"
            "Relations: calls, indirect_call, references, imports, imports_from\n"
            "Depth: 2\n"
            "- engine.js [contains] %s\n" % (name, where))


# ------------------------------------------------------------------------- helpers

def write(root, rel, text):
    p = os.path.join(root, *rel.split("/"))
    d = os.path.dirname(p)
    if not os.path.isdir(d):
        os.makedirs(d)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return p


def read(root, rel):
    with open(os.path.join(root, *rel.split("/")), encoding="utf-8") as f:
        return f.read()


def rmtree(path):
    def fix(func, p, _exc):
        try:
            os.chmod(p, stat.S_IREAD | stat.S_IWRITE | stat.S_IEXEC)
            func(p)
        except OSError:
            pass
    if sys.version_info >= (3, 12):
        shutil.rmtree(path, onexc=fix)
    else:
        shutil.rmtree(path, onerror=fix)


def fwd(p):
    """A path as a shell command spells it (forward slashes on Windows too)."""
    return p.replace("\\", "/")


def decision(out):
    if not out:
        return None
    h = out.get("hookSpecificOutput") or {}
    return h.get("permissionDecision") or out.get("decision")


def reason(out):
    if not out:
        return ""
    h = out.get("hookSpecificOutput") or {}
    return (h.get("permissionDecisionReason") or out.get("reason")
            or h.get("additionalContext") or "")


class Fixture(object):
    """A temp dir with a home, the two state dirs, a fake graphify and git repos."""

    def __init__(self, prefix="graph-gate-test-"):
        self.base = os.path.realpath(tempfile.mkdtemp(prefix=prefix))
        self.home = os.path.join(self.base, "home")
        self.mstate = os.path.join(self.base, "machine-state")
        self.pstate = os.path.join(self.base, "project-state")
        os.makedirs(self.home)
        self.fake_log = os.path.join(self.base, "fake-graphify.log")
        self.fake_bin = self._fake_graphify()
        self.env = self._env()

    def _fake_graphify(self):
        if os.name == "nt":
            p = os.path.join(self.base, "fake-graphify.cmd")
            with open(p, "w", newline="") as f:
                f.write('@echo off\r\necho %%*>>"%s"\r\nexit /b 0\r\n' % self.fake_log)
        else:
            p = os.path.join(self.base, "fake-graphify")
            with open(p, "w", encoding="utf-8") as f:
                f.write("#!/bin/sh\nprintf '%%s\\n' \"$*\" >> '%s'\nexit 0\n" % self.fake_log)
            os.chmod(p, 0o755)
        return p

    def _env(self):
        env = {}
        for k, v in os.environ.items():
            u = k.upper()
            if u.startswith(("GRAPH_GATE", "GRAPHIFY", "GIT_", "CLAUDE_")):
                continue                       # no outer repo, hook or graphify settings
            env[k] = v
        env.update({
            "HOME": self.home, "USERPROFILE": self.home,
            "XDG_CONFIG_HOME": os.path.join(self.home, ".config"),
            "XDG_CACHE_HOME": os.path.join(self.home, ".cache"),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GRAPH_GATE_PROJECT_STATE": self.pstate,
            "GRAPH_GATE_STATE": self.mstate,
            "GRAPH_GATE_NO_WATCH": "1",
            "GRAPH_GATE_NO_GIT_SETUP": "1",
            "GRAPHIFY_BIN": self.fake_bin,
            "PYTHONIOENCODING": "utf-8",
        })
        return env

    def git(self, cwd, *args):
        r = subprocess.run(["git"] + list(args), cwd=cwd, env=self.env, capture_output=True,
                           encoding="utf-8", errors="replace", timeout=60)
        if r.returncode != 0:
            raise AssertionError("git %s failed: %s" % (" ".join(args), r.stderr))
        return r.stdout

    def write_manifest(self, root):
        m = {}
        for rel in CODE_FILES:
            m[rel] = {"mtime": os.path.getmtime(os.path.join(root, *rel.split("/"))),
                      "seen": time.time(), "ast_hash": "0" * 32, "semantic_hash": "0" * 32}
        write(root, "graphify-out/manifest.json", json.dumps(m, indent=1))

    def make_repo(self, name="repo", graph="ok", stale=False, commit_graph=True, gate=True):
        """A git repo with the fixture sources and graph. graph: ok | missing | corrupt."""
        root = os.path.join(self.base, name)
        os.makedirs(root)
        self.git(root, "init", "-q")
        for k, v in (("user.name", "Gate Test"), ("user.email", "gate-test@example.invalid"),
                     ("commit.gpgsign", "false"), ("core.autocrlf", "false")):
            self.git(root, "config", k, v)
        for rel, text in SOURCES.items():
            write(root, rel, text)
        if commit_graph:
            write(root, "graphify-out/graph.json", graph_json("f" * 40))
        else:
            write(root, ".gitignore", "graphify-out/\n")
        self.git(root, "add", "-A")
        self.git(root, "commit", "-q", "-m", "init")
        head = self.git(root, "rev-parse", "HEAD").strip()
        gj = os.path.join(root, "graphify-out", "graph.json")
        if graph == "ok":
            write(root, "graphify-out/graph.json", graph_json("deadbeef" * 5 if stale else head))
        elif graph == "corrupt":
            write(root, "graphify-out/graph.json", "{ this is not json")
        elif os.path.exists(gj):
            os.remove(gj)
        self.write_manifest(root)
        if gate:
            install_gate(root)
        return root

    def fake_calls(self):
        try:
            with open(self.fake_log, encoding="utf-8", errors="replace") as f:
                return [l.strip() for l in f if l.strip()]
        except OSError:
            return []

    def cleanup(self):
        rmtree(self.base)


def install_gate(root):
    d = os.path.join(root, ".claude", "hooks", "graph-gate")
    if not os.path.isdir(d):
        os.makedirs(d)
    shutil.copy2(GATE_SRC, os.path.join(d, "gate.py"))
    if os.path.isfile(RUN_SH_SRC):
        shutil.copy2(RUN_SH_SRC, os.path.join(d, "run.sh"))
    return os.path.join(d, "gate.py")


def gate_of(root):
    return os.path.join(root, ".claude", "hooks", "graph-gate", "gate.py")


# ----------------------------------------------------------------------- base class

@unittest.skipUnless(HAVE_GIT, "git is not on PATH")
@unittest.skipUnless(os.path.isfile(GATE_SRC), "gate.py not found next to tests/")
class GateCase(unittest.TestCase):
    repo_kw = {}

    @classmethod
    def setUpClass(cls):
        cls.fx = Fixture()
        cls.root = cls.fx.make_repo(**cls.repo_kw)
        cls.gate_path = gate_of(cls.root)

    @classmethod
    def tearDownClass(cls):
        cls.fx.cleanup()

    def setUp(self):
        self.sid = "%s-%s" % (type(self).__name__, self._testMethodName)

    # -- running the gate

    def run_gate(self, mode, payload=None, raw=None, env=None, gate=None, cwd=None):
        e = dict(self.fx.env)
        e.update(env or {})
        data = raw if raw is not None else json.dumps(payload).encode("utf-8")
        r = subprocess.run([sys.executable, gate or self.gate_path, mode], input=data,
                           capture_output=True, env=e, cwd=cwd or self.root, timeout=60)
        self.assertEqual(r.returncode, 0, "gate exited %d: %s" % (r.returncode, r.stderr[-800:]))
        out = r.stdout
        self.assertTrue(all(b < 128 for b in bytearray(out)),
                        "gate printed non-ASCII bytes: %r" % out[:300])
        if not out.strip():
            return None
        obj = json.loads(out.decode("ascii"))
        self.assertIsInstance(obj, dict)
        return obj

    def base_payload(self, event, agent=None, session=None, cwd=None, **kw):
        p = {"session_id": session or self.sid, "cwd": cwd or self.root,
             "hook_event_name": event}
        if agent:
            p["agent_id"] = agent
            p["agent_type"] = "general-purpose"
        p.update(kw)
        return p

    def pre(self, tool, tool_input, agent=None, session=None, cwd=None, env=None, gate=None):
        p = self.base_payload("PreToolUse", agent, session, cwd, tool_name=tool,
                              tool_input=tool_input)
        return self.run_gate("pre", p, env=env, gate=gate)

    def bash(self, cmd, **kw):
        return self.pre("Bash", {"command": cmd, "description": "test"}, **kw)

    def read(self, rel_or_abs, **kw):
        p = rel_or_abs if os.path.isabs(rel_or_abs) else os.path.join(
            self.root, *rel_or_abs.split("/"))
        return self.pre("Read", {"file_path": p}, **kw)

    def post_bash(self, cmd, stdout="", stderr="", failure=False, agent=None, session=None,
                  cwd=None, env=None, gate=None):
        if failure:                           # PostToolUseFailure: the output is in "error"
            p = self.base_payload("PostToolUseFailure", agent, session, cwd, tool_name="Bash",
                                  tool_input={"command": cmd},
                                  error="Exit code 4\n" + stdout + stderr)
        else:
            p = self.base_payload("PostToolUse", agent, session, cwd, tool_name="Bash",
                                  tool_input={"command": cmd, "description": "test"},
                                  tool_response={"stdout": stdout, "stderr": stderr,
                                                 "interrupted": False, "isImage": False})
        return self.run_gate("post", p, env=env, gate=gate)

    def post_mcp(self, tool, tool_input, text, agent=None, session=None, cwd=None):
        p = self.base_payload("PostToolUse", agent, session, cwd, tool_name=tool,
                              tool_input=tool_input,
                              tool_response=[{"type": "text", "text": text}])
        return self.run_gate("post", p)

    def post_read(self, path, content, agent=None, session=None):
        p = self.base_payload("PostToolUse", agent, session, None, tool_name="Read",
                              tool_input={"file_path": path},
                              tool_response={"type": "text", "file": {
                                  "filePath": path, "content": content,
                                  "numLines": content.count("\n"), "startLine": 1,
                                  "totalLines": content.count("\n")}})
        return self.run_gate("post", p)

    def explain(self, name, output, **kw):
        """Feed the post hook a `graphify explain "<name>"` run from the repo root."""
        return self.post_bash('graphify explain "%s"' % name, output, **kw)

    # -- assertions

    def assertDenied(self, out, *needles):
        self.assertEqual(decision(out), "deny", "expected a deny, got %r" % (out,))
        r = reason(out)
        for n in needles:
            self.assertIn(n, r)
        return r

    def assertAllowed(self, out):
        self.assertIsNone(out, "expected no output (allowed), got: %s" % reason(out)[:600])


# ------------------------------------------------------------------------ READ gate

class ReadGateTest(GateCase):
    """2. Reading an indexed source file needs a graph answer that named it."""

    def test_read_tool_denied_with_explain_hint(self):
        r = self.assertDenied(self.read("src/engine.js"), "READ", "src/engine.js",
                              'graphify explain "src/engine.js"')
        self.assertIn("BrainEngine L3", r)      # the symbols the graph indexes in it

    def test_read_tool_relative_parts_normalised(self):
        self.assertDenied(self.read(os.path.join(self.root, "src", "sim", "..", "render.js")),
                          "src/render.js")

    def test_bash_readers_denied(self):
        for cmd in ("cat src/engine.js",
                    "cat ./src/engine.js | head -40",
                    "sed -n 1,20p src/engine.js",
                    "sed -n '1,20p' src/engine.js",
                    "head -n 20 src/engine.js",
                    "head -20 src/engine.js",
                    "tail -n 5 src/engine.js",
                    "nl -ba src/engine.js",
                    "awk 'NR<20' src/engine.js",
                    "perl -ne 'print if 1..20' src/engine.js",
                    "less src/engine.js",
                    "cat src/{engine,render}.js",
                    'for f in src/*.js; do head -3 "$f"; done'):
            with self.subTest(cmd=cmd):
                self.assertDenied(self.bash(cmd), "READ", "src/engine.js")

    def test_git_show_and_cat_file_denied(self):
        self.assertDenied(self.bash("git show HEAD:src/engine.js"), "src/engine.js")
        self.assertDenied(self.bash("git show HEAD:src/engine.js | head -50"), "src/engine.js")
        self.assertDenied(self.bash("git --no-pager show HEAD~0:src/render.js"), "src/render.js")
        self.assertDenied(self.bash("git cat-file -p HEAD:src/sim/render.js"),
                          "src/sim/render.js")
        self.assertDenied(self.bash("git -C src show HEAD:./render.js"), "src/render.js")

    def test_git_show_without_a_code_path_allowed(self):
        self.assertAllowed(self.bash("git show --stat HEAD"))
        self.assertAllowed(self.bash("git show HEAD:README.md"))

    def test_grep_printing_one_or_two_files_denied(self):
        self.assertDenied(self.bash("grep -n tick src/engine.js"), "src/engine.js")
        self.assertDenied(self.bash("rg -n tick src/engine.js"), "src/engine.js")
        r = self.assertDenied(self.bash("grep -n draw src/engine.js src/render.js"))
        self.assertIn("src/engine.js", r)
        self.assertIn("src/render.js", r)

    def test_grep_match_all_over_three_files_denied(self):
        self.assertDenied(self.bash('grep -n "" src/engine.js src/render.js src/sim/render.js'),
                          "src/sim/render.js")

    def test_grep_names_counts_and_wide_searches_allowed(self):
        for cmd in ("grep -l tick src/engine.js",
                    "grep -c tick src/engine.js",
                    "grep -q tick src/engine.js",
                    "rg --files-with-matches tick src/engine.js",
                    "grep -n tick src/engine.js src/render.js src/sim/render.js",
                    "grep -rn tick src"):
            with self.subTest(cmd=cmd):
                self.assertAllowed(self.bash(cmd))

    def test_in_place_edit_is_not_a_read(self):
        self.assertAllowed(self.bash("sed -i.bak 's/dt \\* 2/dt * 3/' src/engine.js"))
        self.assertAllowed(self.bash("perl -pi -e 's/a/b/' src/render.js"))

    def test_grep_tool_content_mode_on_one_file_denied(self):
        p = os.path.join(self.root, "src", "engine.js")
        self.assertDenied(self.pre("Grep", {"pattern": "tick", "path": p,
                                            "output_mode": "content"}), "src/engine.js")
        self.assertAllowed(self.pre("Grep", {"pattern": "tick", "path": p}))
        self.assertAllowed(self.pre("Grep", {"pattern": "tick", "path": p,
                                             "output_mode": "files_with_matches"}))
        self.assertAllowed(self.pre("Grep", {"pattern": "tick", "path": p,
                                             "output_mode": "count"}))

    def test_non_code_files_never_gated(self):
        for rel in ("README.md", "docs/notes.md", "data/config.json",
                    "graphify-out/GRAPH_REPORT.md", "graphify-out/graph.json",
                    ".claude/hooks/graph-gate/gate.py"):
            with self.subTest(rel=rel):
                self.assertAllowed(self.read(rel))
        self.assertAllowed(self.bash("cat README.md docs/notes.md data/config.json"))
        self.assertAllowed(self.bash("sed -n 1,5p docs/notes.md"))
        self.assertAllowed(self.pre("Grep", {"pattern": "Engine", "output_mode": "content",
                                             "path": os.path.join(self.root, "README.md")}))

    def test_new_js_file_the_graph_does_not_index_is_not_gated(self):
        write(self.root, "scripts/tool.js", "export const x = 1;\n")
        self.assertAllowed(self.read("scripts/tool.js"))
        self.assertAllowed(self.bash("cat scripts/tool.js"))

    def test_package_json_is_data_not_gated(self):
        # graphify gives package.json "code" nodes, but JSON is data to the gate
        self.assertAllowed(self.read("package.json"))

    def test_unlocked_by_explain_output_and_only_for_named_files(self):
        self.assertDenied(self.read("src/engine.js"))
        self.assertIsNone(self.explain("BrainEngine", EXPLAIN_BRAINENGINE))
        self.assertAllowed(self.read("src/engine.js"))
        self.assertAllowed(self.bash("sed -n 3,11p src/engine.js"))
        self.assertAllowed(self.bash("git show HEAD:src/engine.js"))
        self.assertAllowed(self.pre("Grep", {"pattern": "tick", "output_mode": "content",
                                             "path": os.path.join(self.root, "src", "engine.js")}))
        self.assertDenied(self.read("src/render.js"), "src/render.js")   # not in that answer

    def test_unlocked_by_cd_root_and_explain_from_elsewhere(self):
        cmd = 'cd "%s" && graphify explain "BrainEngine"' % fwd(self.root)
        self.post_bash(cmd, EXPLAIN_BRAINENGINE, cwd=self.fx.base)
        self.assertAllowed(self.read("src/engine.js"))

    def test_unlocked_by_ambiguous_near_miss_in_post_tool_use_failure(self):
        # graphify explain "render.js" exits 4 with a near-miss list naming both files
        self.post_bash('graphify explain "render.js"', AMBIGUOUS_RENDER, failure=True)
        self.assertAllowed(self.read("src/render.js"))
        self.assertAllowed(self.read("src/sim/render.js"))
        self.assertDenied(self.read("src/engine.js"))

    def test_unlocked_by_prose_query_output(self):
        self.post_bash('graphify query "how is drawing done" --budget 400', QUERY_PROSE)
        self.assertAllowed(self.read("src/render.js"))
        self.assertDenied(self.read("src/engine.js"))

    def test_unlocked_by_mcp_answer(self):
        self.post_mcp("mcp__graphify__get_node",
                      {"label": "SimRenderer", "project_path": self.root}, MCP_SIMRENDERER)
        self.assertAllowed(self.read("src/sim/render.js"))

    def test_unlocked_by_mcp_answer_without_project_path(self):
        self.post_mcp("mcp__graphify__query_graph", {"question": "who renders the sim"},
                      MCP_SIMRENDERER)
        self.assertAllowed(self.read("src/sim/render.js"))

    def test_unlocked_by_reading_graph_report(self):
        rp = os.path.join(self.root, "graphify-out", "GRAPH_REPORT.md")
        self.post_read(rp, GRAPH_REPORT)
        self.assertAllowed(self.read("src/render.js"))
        self.assertDenied(self.read("src/engine.js"))
        self.assertDenied(self.read("src/sim/render.js"))

    def test_reading_a_markdown_file_outside_graphify_out_unlocks_nothing(self):
        self.post_read(os.path.join(self.root, "docs", "notes.md"), SOURCES["docs/notes.md"])
        self.assertDenied(self.read("src/sim/render.js"))

    def test_graph_answer_never_seen_unlocks_nothing(self):
        for cmd in ('graphify explain "BrainEngine" > /dev/null',
                    'true || graphify explain "BrainEngine"',
                    'cd src && graphify explain "BrainEngine"'):   # not the repo's graph
            with self.subTest(cmd=cmd):
                self.post_bash(cmd, EXPLAIN_BRAINENGINE)
                self.assertDenied(self.read("src/engine.js"))

    def test_located_is_per_agent(self):
        self.explain("BrainEngine", EXPLAIN_BRAINENGINE)                   # main agent
        self.assertAllowed(self.read("src/engine.js"))
        self.assertDenied(self.read("src/engine.js", agent="sub-1"), "src/engine.js")
        self.explain("BrainEngine", EXPLAIN_BRAINENGINE, agent="sub-2")
        self.assertAllowed(self.read("src/engine.js", agent="sub-2"))
        self.assertDenied(self.read("src/engine.js", agent="sub-1"))
        self.assertDenied(self.read("src/engine.js", session=self.sid + "-other"))

    def test_same_command_explain_then_read_by_file_path(self):
        self.assertAllowed(self.bash(
            'graphify explain "src/engine.js" && sed -n 1,20p src/engine.js'))
        self.assertAllowed(self.bash('graphify explain "engine.js"; cat src/engine.js'))

    def test_same_command_credit_needs_the_file_stem_and_a_seen_answer(self):
        self.assertDenied(self.bash('graphify explain "BrainEngine" && cat src/render.js'),
                          "src/render.js")
        self.assertDenied(self.bash(
            'graphify explain "src/engine.js" >/dev/null && cat src/engine.js'))
        self.assertDenied(self.bash('cat src/engine.js; graphify explain "src/engine.js"'))

    def test_ttl_expires_located_files(self):
        env = {"GRAPH_GATE_TTL": "2"}
        self.post_bash('graphify explain "BrainEngine"', EXPLAIN_BRAINENGINE, env=env)
        self.assertIsNone(self.read("src/engine.js", env=env))
        time.sleep(2.4)
        self.assertDenied(self.read("src/engine.js", env=env))

    def test_input_redirection_is_a_read(self):
        self.assertDenied(self.bash("head -50 < src/engine.js"), "src/engine.js")


# ---------------------------------------------------------------------- SEARCH gate

class SearchGateTest(GateCase):
    """1. A search for a camelCase/PascalCase name needs a by-name graph query first."""

    def grep_tool(self, pattern, rel="src", **kw):
        return self.pre("Grep", {"pattern": pattern,
                                 "path": os.path.join(self.root, *rel.split("/"))}, **kw)

    def test_camel_case_search_denied_in_every_form(self):
        cases = [
            ("Grep", {"pattern": "BrainEngine", "path": os.path.join(self.root, "src")}),
            ("Grep", {"pattern": "new BrainEngine\\("}),
            ("Glob", {"pattern": "**/*BrainEngine*"}),
            ("Bash", {"command": "grep -rn BrainEngine src"}),
            ("Bash", {"command": "rg -n 'BrainEngine' ."}),
            ("Bash", {"command": "find . -name '*BrainEngine*'"}),
            ("Bash", {"command": "git grep -n BrainEngine"}),
            ("Bash", {"command": "find src -name '*.js' | xargs grep -n BrainEngine"}),
        ]
        for tool, ti in cases:
            with self.subTest(tool=tool, ti=ti):
                self.assertDenied(self.pre(tool, ti), "SEARCH", "BrainEngine",
                                  'graphify explain "BrainEngine"')

    def test_non_names_never_blocked(self):
        for cmd in ("grep -rn lerp_value src",          # snake_case
                    "grep -rn tick src",                # plain word
                    "grep -rn MAX_SPEED src",           # ALLCAPS
                    "grep -rn '\"isLast\"' src",        # a quoted string key
                    "grep -rn 0xFFF5F5F7 src",          # a hex literal
                    "rg -n -t js render src"):
            with self.subTest(cmd=cmd):
                self.assertAllowed(self.bash(cmd))
        self.assertAllowed(self.pre("Glob", {"pattern": "src/**/*.js"}))

    def test_searches_outside_indexed_code_allowed(self):
        self.assertAllowed(self.bash("grep -rn BrainEngine docs"))
        self.assertAllowed(self.bash("grep -n BrainEngine README.md"))
        self.assertAllowed(self.grep_tool("BrainEngine", "docs"))
        self.assertAllowed(self.bash("grep -rn BrainEngine graphify-out"))

    def test_unlocked_by_explain_by_name(self):
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.explain("BrainEngine", EXPLAIN_BRAINENGINE)
        self.assertAllowed(self.grep_tool("BrainEngine"))
        self.assertAllowed(self.bash("grep -rn BrainEngine src"))
        self.assertDenied(self.grep_tool("PixelRenderer"), "PixelRenderer")

    def test_unknown_name_counts_once_asked(self):
        self.explain("FooWidget", "No node matching 'FooWidget' found.\n")
        self.assertAllowed(self.grep_tool("FooWidget"))

    def test_unlocked_by_affected_path_and_query_seed(self):
        self.post_bash('graphify affected "startEngine" --depth 2', affected_out("startEngine"))
        self.assertAllowed(self.grep_tool("startEngine"))
        self.post_bash('graphify path "PixelRenderer" "SimRenderer"',
                       "No path found between 'PixelRenderer' and 'SimRenderer'.\n")
        self.assertAllowed(self.grep_tool("PixelRenderer"))
        self.assertAllowed(self.grep_tool("SimRenderer"))

    def test_query_seed_counts_prose_query_does_not(self):
        self.post_bash('graphify query "how is drawing done" --budget 400', QUERY_PROSE)
        self.assertDenied(self.grep_tool("PixelRenderer"))
        self.post_bash('graphify query "how is drawing done" --seed "PixelRenderer"',
                       QUERY_PROSE)
        self.assertAllowed(self.grep_tool("PixelRenderer"))

    def test_unlocked_by_mcp_get_node(self):
        self.post_mcp("mcp__graphify__get_node",
                      {"label": "SimRenderer", "project_path": self.root}, MCP_SIMRENDERER)
        self.assertAllowed(self.grep_tool("SimRenderer"))

    def test_asks_need_real_graph_output(self):
        self.post_bash('graphify explain "BrainEngine"', "")
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.post_bash('graphify explain "BrainEngine"', "Traceback (most recent call last):\n")
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.post_bash('true || graphify explain "BrainEngine"', EXPLAIN_BRAINENGINE)
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.post_bash('graphify explain "BrainEngine" > /dev/null', EXPLAIN_BRAINENGINE)
        self.assertDenied(self.grep_tool("BrainEngine"))

    def test_one_name_per_explain(self):
        self.post_bash('graphify explain "BrainEngine|PixelRenderer"',
                       "No node matching 'BrainEngine|PixelRenderer' found.\n")
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.assertDenied(self.grep_tool("PixelRenderer"))

    def test_short_word_does_not_unlock_longer_names(self):
        self.explain("Brain", NO_MATCH_BRAIN)
        self.assertDenied(self.grep_tool("BrainEngine"), "BrainEngine")

    def test_asks_are_per_agent_and_per_session(self):
        self.explain("BrainEngine", EXPLAIN_BRAINENGINE, agent="scout-1")
        self.assertAllowed(self.grep_tool("BrainEngine", agent="scout-1"))
        self.assertDenied(self.grep_tool("BrainEngine"))
        self.assertDenied(self.grep_tool("BrainEngine", agent="scout-2"))
        self.assertDenied(self.grep_tool("BrainEngine", agent="scout-1",
                                         session=self.sid + "-other"))

    def test_ask_earlier_in_the_same_command_counts(self):
        self.assertAllowed(self.bash('graphify explain "BrainEngine"; grep -rn BrainEngine src'))
        self.assertDenied(self.bash('grep -rn BrainEngine src; graphify explain "BrainEngine"'))


# ----------------------------------------------------------------------- WRITE gate

class WriteGateTest(GateCase):
    """3. Subagents never rebuild the graph; nobody reinstalls or removes graphify's hooks."""

    def test_subagent_rebuilds_denied(self):
        for cmd in ("graphify update .", "graphify update . --force", "graphify watch .",
                    "graphify extract .", "graphify add https://example.invalid/x",
                    "graphify export html", "graphify cluster-only .", "graphify label .",
                    "graphify tree", "graphify merge-graphs a.json b.json",
                    "graphify hook install", "graphify hook uninstall",
                    "graphify cursor install", "graphify global add x",
                    "graphify provider remove y", "graphify install --platform claude"):
            with self.subTest(cmd=cmd):
                self.assertDenied(self.bash(cmd, agent="sub-1"), "subagents do not run")

    def test_main_agent_may_rebuild(self):
        for cmd in ("graphify update .", "graphify watch .", "graphify hook install",
                    'cd "%s" && graphify update .' % fwd(self.root)):
            with self.subTest(cmd=cmd):
                self.assertAllowed(self.bash(cmd))

    def test_claude_install_and_uninstall_denied_for_everyone(self):
        for cmd in ("graphify claude install", "graphify claude uninstall",
                    "graphify uninstall", "graphify uninstall --purge"):
            for agent in (None, "sub-1"):
                with self.subTest(cmd=cmd, agent=agent):
                    self.assertDenied(self.bash(cmd, agent=agent), "is blocked in this repo")

    def test_read_only_graphify_commands_allowed(self):
        for cmd in ("graphify hook status", 'graphify explain "BrainEngine"',
                    'graphify query "x" --budget 400', "graphify god-nodes", "graphify --help"):
            for agent in (None, "sub-1"):
                with self.subTest(cmd=cmd, agent=agent):
                    self.assertAllowed(self.bash(cmd, agent=agent))

    def test_another_repo_is_not_this_gates_business(self):
        other = os.path.join(self.fx.base, "other")
        if not os.path.isdir(other):
            self.fx.make_repo("other", gate=False)
        self.assertAllowed(self.bash('cd "%s" && graphify update .' % fwd(other), agent="sub-1"))
        self.assertAllowed(self.bash("graphify update .", agent="sub-1", cwd=other))

    def test_subagent_update_with_path_argument_from_outside_is_denied(self):
        self.assertDenied(self.bash('graphify update "%s"' % fwd(self.root), agent="sub-1",
                                    cwd=self.fx.base), "subagents do not run")


# ---------------------------------------------------- Agent prompts and MCP rewrites

class RewriteTest(GateCase):
    """4. Agent/Task prompts are left alone (SubagentStart delivers the protocol, and a
    rewrite would race the machine-wide gate's); mcp__graphify__* calls get project_path."""

    def test_agent_prompt_is_not_rewritten(self):
        for tool in ("Agent", "Task"):
            with self.subTest(tool=tool):
                ti = {"prompt": "find where BrainEngine ticks", "description": "d",
                      "subagent_type": "Explore"}
                self.assertAllowed(self.pre(tool, ti))

    def test_agent_prompt_with_protocol_left_alone(self):
        self.assertAllowed(self.pre("Agent", {"prompt": "x\nGRAPH-FIRST PROTOCOL ...",
                                              "description": "d"}))

    def test_agent_prompt_outside_repo_left_alone(self):
        self.assertAllowed(self.pre("Agent", {"prompt": "x", "description": "d"},
                                    cwd=self.fx.base))

    def test_mcp_project_path_filled(self):
        out = self.pre("mcp__graphify__get_node", {"label": "BrainEngine"})
        self.assertEqual(decision(out), "allow")
        new = out["hookSpecificOutput"]["updatedInput"]
        self.assertEqual(new["label"], "BrainEngine")
        self.assertEqual(os.path.normcase(new["project_path"]), os.path.normcase(self.root))

    def test_mcp_subdir_project_path_pointed_at_graph_root(self):
        out = self.pre("mcp__graphify__query_graph",
                       {"question": "x", "project_path": os.path.join(self.root, "src")})
        self.assertEqual(os.path.normcase(out["hookSpecificOutput"]["updatedInput"]
                                          ["project_path"]), os.path.normcase(self.root))

    def test_mcp_with_graph_root_left_alone(self):
        self.assertAllowed(self.pre("mcp__graphify__get_node",
                                    {"label": "BrainEngine", "project_path": self.root}))


# --------------------------------------------------- scoping, kill switches, fail-open

class ScopeTest(GateCase):
    """7. Only the repo the gate ships in is gated."""

    @classmethod
    def setUpClass(cls):
        super(ScopeTest, cls).setUpClass()
        cls.other = cls.fx.make_repo("other", gate=False)      # its own graph, same files
        cls.loose = os.path.join(cls.fx.base, "loose")          # a graph but no git
        for rel in ("src/engine.js",):
            write(cls.loose, rel, SOURCES[rel])
        write(cls.loose, "graphify-out/graph.json", graph_json("f" * 40))

    def test_another_git_repo_is_not_gated(self):
        p = os.path.join(self.other, "src", "engine.js")
        self.assertAllowed(self.read(p))
        self.assertAllowed(self.read(p, cwd=self.other))
        self.assertAllowed(self.bash("cat ../other/src/engine.js"))
        self.assertAllowed(self.pre("Grep", {"pattern": "BrainEngine",
                                             "path": os.path.join(self.other, "src")}))
        self.assertAllowed(self.bash("grep -rn BrainEngine src", cwd=self.other))

    def test_a_dir_without_git_is_not_gated(self):
        self.assertAllowed(self.read(os.path.join(self.loose, "src", "engine.js")))

    def test_this_repo_is_gated_from_any_cwd(self):
        self.assertDenied(self.read("src/engine.js", cwd=self.other))
        self.assertDenied(self.read("src/engine.js", cwd=self.fx.base))

    def test_another_repos_graph_answer_unlocks_nothing_here(self):
        self.post_mcp("mcp__graphify__get_node",
                      {"label": "SimRenderer", "project_path": self.other}, MCP_SIMRENDERER)
        self.post_bash('graphify explain "BrainEngine"', EXPLAIN_BRAINENGINE, cwd=self.other)
        self.assertDenied(self.read("src/sim/render.js"))
        self.assertDenied(self.read("src/engine.js"))
        self.assertDenied(self.pre("Grep", {"pattern": "BrainEngine",
                                            "path": os.path.join(self.root, "src")}))


class KillSwitchTest(GateCase):

    def test_graph_gate_off_file_in_repo_root(self):
        flag = write(self.root, ".graph-gate-off", "")
        try:
            self.assertAllowed(self.read("src/engine.js"))
            self.assertAllowed(self.bash("grep -rn BrainEngine src"))
            self.assertAllowed(self.bash("graphify update .", agent="sub-1"))
            self.assertIsNone(self.run_gate("session-start", self.base_payload("SessionStart")))
        finally:
            os.remove(flag)
        self.assertDenied(self.read("src/engine.js"))

    def test_env_graph_gate_off(self):
        for v in ("off", "OFF", "0", "false", "no"):
            with self.subTest(value=v):
                env = {"GRAPH_GATE": v}
                self.assertAllowed(self.read("src/engine.js", env=env))
                self.assertIsNone(self.run_gate("session-start",
                                                self.base_payload("SessionStart"), env=env))
        self.assertDenied(self.read("src/engine.js", env={"GRAPH_GATE": "on"}))

    def test_off_file_next_to_gate(self):
        flag = os.path.join(os.path.dirname(self.gate_path), "OFF")
        write(os.path.dirname(flag), "OFF", "")
        try:
            self.assertAllowed(self.read("src/engine.js"))
            self.assertAllowed(self.bash("graphify claude install"))
        finally:
            os.remove(flag)
        self.assertDenied(self.read("src/engine.js"))


class FailOpenTest(GateCase):

    MODES = ("session-start", "prompt", "pre", "post", "stop", "subagent-start", "bogus-mode")
    GARBAGE = (b"", b"\xff\xfe\x00garbage {", b"{\"tool_name\": ", b"[1, 2, 3]", b"null",
               b"\"Bash\"")

    def test_garbage_stdin_outside_the_repo_prints_nothing(self):
        for mode in self.MODES:
            for raw in self.GARBAGE:
                with self.subTest(mode=mode, raw=raw):
                    self.assertIsNone(self.run_gate(mode, raw=raw, cwd=self.fx.base))

    def test_garbage_stdin_in_the_repo_never_blocks(self):
        for mode in ("pre", "post", "stop", "bogus-mode"):
            for raw in self.GARBAGE:
                with self.subTest(mode=mode, raw=raw):
                    self.assertIsNone(self.run_gate(mode, raw=raw))

    def test_odd_payload_shapes(self):
        for ti in (None, [], "cat src/engine.js", {"command": None}, {"file_path": 7}):
            for tool in ("Bash", "Read", "Grep", "Glob", "Agent", "mcp__graphify__get_node"):
                with self.subTest(tool=tool, ti=ti):
                    p = self.base_payload("PreToolUse", tool_name=tool, tool_input=ti)
                    out = self.run_gate("pre", p)
                    self.assertNotEqual(decision(out), "deny")

    @unittest.skipUnless(POSIX and not IS_ROOT, "needs POSIX permissions and a non-root user")
    def test_unwritable_state_never_denies(self):
        fx = Fixture()
        try:
            root = fx.make_repo()
            markers = os.path.join(fx.pstate, "markers")
            os.makedirs(markers)
            os.chmod(markers, 0o500)
            os.chmod(fx.pstate, 0o500)
            try:
                self.assertIsNone(self.run_gate("pre", self.base_payload(
                    "PreToolUse", cwd=root, tool_name="Read",
                    tool_input={"file_path": os.path.join(root, "src", "engine.js")}),
                    env=fx.env, gate=gate_of(root), cwd=root))
            finally:
                os.chmod(fx.pstate, 0o700)
                os.chmod(markers, 0o700)
        finally:
            fx.cleanup()


class MissingGraphTest(GateCase):
    repo_kw = {"graph": "missing"}

    def test_nothing_is_gated_without_a_graph(self):
        self.assertAllowed(self.read("src/engine.js"))
        self.assertAllowed(self.bash("cat src/engine.js"))
        self.assertAllowed(self.bash("grep -rn BrainEngine src"))
        self.assertAllowed(self.bash("graphify update .", agent="sub-1"))
        self.assertIsNone(self.run_gate("session-start", self.base_payload("SessionStart")))
        self.assertIsNone(self.run_gate("prompt", self.base_payload("UserPromptSubmit",
                                                                    prompt="hi")))
        self.assertIsNone(self.run_gate("stop", self.base_payload("Stop",
                                                                  stop_hook_active=False)))


class CorruptGraphTest(GateCase):
    repo_kw = {"graph": "corrupt"}

    def test_reads_not_gated_with_an_unreadable_graph(self):
        self.assertAllowed(self.read("src/engine.js"))
        self.assertAllowed(self.bash("sed -n 1,20p src/engine.js"))


# ------------------------------------------------------------- lifecycle hooks

class LifecycleTest(GateCase):
    """5. SessionStart / SubagentStart / UserPromptSubmit."""

    def handshake(self, sid=None):
        p = os.path.join(self.fx.mstate, "markers", "%s.projectgates" % (sid or self.sid))
        with open(p, encoding="utf-8") as f:
            return f.read().splitlines()

    def test_session_start_context_and_handshake(self):
        out = self.run_gate("session-start", self.base_payload("SessionStart", source="startup"))
        h = out["hookSpecificOutput"]
        self.assertEqual(h["hookEventName"], "SessionStart")
        ctx = h["additionalContext"]
        for needle in ("GRAPH-FIRST PROTOCOL", fwd(self.root), "1. SEARCH", "2. READ",
                       "3. UPDATE", "4. IMPACT", "graph-scout"):
            self.assertIn(needle, ctx)
        self.assertNotIn("Graph upkeep", ctx)      # graph built at HEAD, watcher disabled
        self.assertEqual(self.handshake(), [self.root])
        self.run_gate("session-start", self.base_payload("SessionStart", source="resume"))
        self.assertEqual(self.handshake(), [self.root])   # one line however often it runs
        self.assertFalse(any("watch" in c for c in self.fx.fake_calls()))

    def test_subagent_start_context_and_handshake(self):
        out = self.run_gate("subagent-start", self.base_payload(
            "SubagentStart", agent="sub-1"))
        h = out["hookSpecificOutput"]
        self.assertEqual(h["hookEventName"], "SubagentStart")
        self.assertIn("GRAPH-FIRST PROTOCOL", h["additionalContext"])
        self.assertEqual(self.handshake(), [self.root])

    def test_prompt_context_and_turn_snapshot(self):
        out = self.run_gate("prompt", self.base_payload("UserPromptSubmit", prompt="hi"))
        h = out["hookSpecificOutput"]
        self.assertEqual(h["hookEventName"], "UserPromptSubmit")
        self.assertIn("Graph gate active", h["additionalContext"])
        markers = os.listdir(os.path.join(self.fx.pstate, "markers"))
        self.assertTrue(any(n.startswith(self.sid + "__") and n.endswith(".turnstart")
                            for n in markers), markers)
        self.assertIn(self.sid + ".turn", markers)
        self.assertEqual(self.handshake(), [self.root])

    def test_lifecycle_hooks_outside_the_repo_print_nothing(self):
        for mode, event in (("session-start", "SessionStart"), ("prompt", "UserPromptSubmit"),
                            ("subagent-start", "SubagentStart"), ("stop", "Stop")):
            with self.subTest(mode=mode):
                self.assertIsNone(self.run_gate(mode, self.base_payload(
                    event, cwd=self.fx.base)))

    def test_stale_graph_starts_one_background_update(self):
        fx = Fixture()
        try:
            root = fx.make_repo(stale=True)
            payload = self.base_payload("SessionStart", cwd=root)
            out = self.run_gate("session-start", payload, env=fx.env, gate=gate_of(root),
                                cwd=root)
            ctx = reason(out)
            self.assertIn("Graph upkeep", ctx)
            self.assertIn("`graphify update .` started in the background", ctx)
            deadline = time.time() + 15
            while time.time() < deadline and "update ." not in fx.fake_calls():
                time.sleep(0.1)
            self.assertIn("update .", fx.fake_calls())
            # the per-HEAD stamp keeps a second session from starting another rebuild
            out2 = self.run_gate("session-start", dict(payload, session_id=self.sid + "-2"),
                                 env=fx.env, gate=gate_of(root), cwd=root)
            self.assertNotIn("update .` started", reason(out2))
            self.assertTrue(os.path.isdir(os.path.join(fx.home, ".cache", "graphify-watch")))
        finally:
            fx.cleanup()

    @unittest.skipUnless(POSIX and shutil.which("sh"), "run.sh is a POSIX sh launcher")
    def test_run_sh_launches_the_gate(self):
        run_sh = os.path.join(os.path.dirname(self.gate_path), "run.sh")
        if not os.path.isfile(run_sh):
            self.skipTest("run.sh not found")
        env = dict(self.fx.env, GRAPH_GATE_PYTHON=sys.executable)
        payload = self.base_payload("PreToolUse", tool_name="Read", tool_input={
            "file_path": os.path.join(self.root, "src", "engine.js")})
        r = subprocess.run(["sh", run_sh, "pre"], input=json.dumps(payload).encode("utf-8"),
                           capture_output=True, env=env, cwd=self.root, timeout=60)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(decision(json.loads(r.stdout.decode("ascii"))), "deny")


# --------------------------------------------------------------------- Stop hook

class StopTest(GateCase):
    """6. Stop blocks once per turn when code changed without a by-name impact query."""

    @classmethod
    def setUpClass(cls):
        cls.fx = Fixture()
        cls.n = 0

    def setUp(self):
        super(StopTest, self).setUp()
        type(self).n += 1
        self.root = self.fx.make_repo("r%d" % self.n)          # every test edits its own
        self.gate_path = gate_of(self.root)

    def prompt(self):
        out = self.run_gate("prompt", self.base_payload("UserPromptSubmit", prompt="go"))
        self.assertIsNotNone(out)

    def stop(self, active=False):
        return self.run_gate("stop", self.base_payload("Stop", stop_hook_active=active))

    def edit(self, rel, old, new):
        text = read(self.root, rel)
        self.assertIn(old, text)
        write(self.root, rel, text.replace(old, new, 1))

    def graph_saw(self, rel):
        """What `graphify watch`/`update` would do: record the file's current mtime."""
        mp = os.path.join(self.root, "graphify-out", "manifest.json")
        with open(mp, encoding="utf-8") as f:
            m = json.load(f)
        m.setdefault(rel, {})["mtime"] = os.path.getmtime(os.path.join(self.root,
                                                                       *rel.split("/")))
        with open(mp, "w", encoding="utf-8") as f:
            json.dump(m, f)

    def edit_start_engine_body(self):
        self.edit("src/engine.js", "return engine.tick(1);", "return engine.tick(2);")

    def assertBlocked(self, out, *needles):
        self.assertEqual(decision(out), "block", "expected a Stop block, got %r" % (out,))
        for n in needles:
            self.assertIn(n, reason(out))
        return reason(out)

    def test_no_change_no_block(self):
        self.prompt()
        self.assertIsNone(self.stop())

    def test_no_turn_snapshot_no_block(self):
        self.edit_start_engine_body()
        self.assertIsNone(self.stop())

    def test_code_edit_without_impact_query_blocks_once(self):
        self.prompt()
        self.edit_start_engine_body()
        r = self.assertBlocked(self.stop(), "src/engine.js", "startEngine",
                               'graphify affected "startEngine" --depth 2')
        if WATCHER_CHECK:
            self.assertIn("graphify update .", r)        # no watcher and the graph is stale
        self.assertIsNone(self.stop())                    # at most once per turn
        self.prompt()                                     # a new turn: the edit is old news
        self.assertIsNone(self.stop())

    def test_stop_hook_active_never_blocks(self):
        self.prompt()
        self.edit_start_engine_body()
        self.assertIsNone(self.stop(active=True))
        self.assertBlocked(self.stop())

    def test_impact_query_by_name_after_the_edit_passes(self):
        self.prompt()
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.post_bash('graphify affected "startEngine" --depth 2', affected_out("startEngine"))
        self.assertIsNone(self.stop())

    def test_explain_on_the_changed_file_passes(self):
        self.prompt()
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.explain("src/engine.js", EXPLAIN_ENGINE_FILE)
        self.assertIsNone(self.stop())

    def test_subagent_impact_query_counts_for_the_session(self):
        self.prompt()
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.post_bash('graphify affected "startEngine" --depth 2', affected_out("startEngine"),
                       agent="graph-scout-1")
        self.assertIsNone(self.stop())

    def test_mcp_get_node_counts_as_impact_query(self):
        self.prompt()
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.post_mcp("mcp__graphify__get_node",
                      {"label": "startEngine()", "project_path": self.root},
                      "Node: startEngine()\n  Source: src/engine.js L13\n")
        self.assertIsNone(self.stop())

    def test_query_before_the_edit_or_without_a_name_does_not_count(self):
        self.prompt()
        self.post_bash('graphify affected "startEngine" --depth 2', affected_out("startEngine"))
        time.sleep(0.1)                                   # the edit's mtime lands after the ask
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.post_bash('graphify query "what calls startEngine" --seed "startEngine"',
                       QUERY_PROSE)                       # query --seed is no impact check
        self.assertBlocked(self.stop(), "startEngine")

    def test_unrelated_name_does_not_count(self):
        self.prompt()
        self.edit_start_engine_body()
        self.graph_saw("src/engine.js")
        self.post_bash('graphify affected "PixelRenderer" --depth 2',
                       affected_out("PixelRenderer", "src/render.js:L1"))
        self.assertBlocked(self.stop(), "asked since: PixelRenderer")

    @unittest.skipUnless(WATCHER_CHECK, "no `ps`: the gate assumes a watcher runs")
    def test_graph_not_updated_since_the_edit_asks_for_update(self):
        self.prompt()
        self.edit_start_engine_body()                     # manifest still has the old mtime
        self.post_bash('graphify affected "startEngine" --depth 2', affected_out("startEngine"))
        r = self.assertBlocked(self.stop(), "has not seen", "src/engine.js",
                               "graphify update .")
        self.assertNotIn("no by-name impact query", r)

    def test_json_data_edit_does_not_count(self):
        self.prompt()
        self.edit("data/config.json", '"speed": 1', '"speed": 2')
        self.assertIsNone(self.stop())

    def test_dot_dir_graphify_out_and_markdown_edits_do_not_count(self):
        self.prompt()
        write(self.root, ".claude/tool.js", "export function helperThing() {}\n")
        write(self.root, "graphify-out/extra.js", "export function otherThing() {}\n")
        self.edit("README.md", "draws", "renders")
        self.assertIsNone(self.stop())

    def test_package_json_edit_does_not_count(self):
        self.prompt()
        self.edit("package.json", '"1.0.0"', '"1.0.1"')
        self.assertIsNone(self.stop())

    def test_new_untracked_source_file_counts(self):
        self.prompt()
        write(self.root, "src/extra.js", "export function helperThing() {\n  return 1;\n}\n")
        self.assertBlocked(self.stop(), "src/extra.js", "helperThing")

    def test_edit_reverted_within_the_turn_does_not_count(self):
        self.prompt()
        self.edit_start_engine_body()
        self.edit("src/engine.js", "return engine.tick(2);", "return engine.tick(1);")
        self.assertIsNone(self.stop())

    def test_committing_last_turns_edit_does_not_count(self):
        self.edit_start_engine_body()                      # made before this turn began
        self.prompt()
        self.fx.git(self.root, "commit", "-q", "-am", "tick(2)")
        self.assertIsNone(self.stop())

    def test_impact_query_on_the_edited_method_is_credited(self):
        self.prompt()
        self.edit("src/engine.js", "return dt * 2;", "return dt * 3;")
        self.graph_saw("src/engine.js")
        self.post_bash('graphify affected ".tick()" --depth 2', affected_out(".tick()"))
        self.assertIsNone(self.stop())


# ------------------------------------------------------------------ linked worktrees

class WorktreeTest(GateCase):
    """A linked worktree with no graph of its own is judged against the main checkout's
    graph (repo_of); here the worktree's own copy of the gate runs."""

    @classmethod
    def setUpClass(cls):
        cls.fx = Fixture()
        cls.main = cls.fx.make_repo("main", commit_graph=False, gate=False)
        cls.root = os.path.join(cls.fx.base, "wt")
        cls.fx.git(cls.main, "worktree", "add", "-q", "--detach", cls.root)
        cls.root = os.path.realpath(cls.root)
        cls.gate_path = install_gate(cls.root)

    def test_worktree_read_is_gated_against_the_main_graph(self):
        self.assertDenied(self.read("src/engine.js"), "src/engine.js",
                          "This worktree has no graph of its own", fwd(self.main))

    def test_worktree_deny_lifts_after_a_main_graph_query(self):
        self.post_bash('cd "%s" && graphify explain "BrainEngine"' % fwd(self.main),
                       EXPLAIN_BRAINENGINE)
        self.assertAllowed(self.read("src/engine.js"))
        self.assertAllowed(self.pre("Grep", {"pattern": "BrainEngine",
                                             "path": os.path.join(self.root, "src")}))


# ------------------------------------------------- fixes from the adversarial review

class ReviewFixesTest(GateCase):
    """Behaviour the first adversarial review asked for (bypasses, false denies, deny loops)."""

    def test_listing_printed_with_a_graph_query_locates_nothing_extra(self):
        out = EXPLAIN_BRAINENGINE + "\n./src/render.js\n./src/engine.js\n"
        self.post_bash('graphify explain "BrainEngine"; find . -name "*.js"', out)
        self.assertDenied(self.read("src/render.js"), "src/render.js")

    def test_graph_answer_through_head_still_locates(self):
        self.post_bash('graphify explain "BrainEngine" | head -40', EXPLAIN_BRAINENGINE)
        self.assertAllowed(self.read("src/engine.js"))

    def test_by_name_path_query_locates_the_defining_file(self):
        self.post_bash('graphify path "BrainEngine" "BrainEngine"',
                       "Shortest path (0 hops):\n  BrainEngine\n")
        self.assertAllowed(self.read("src/engine.js"))

    def test_py_m_graphify_counts_as_graphify(self):
        self.post_bash('python3 -m graphify explain "BrainEngine"', EXPLAIN_BRAINENGINE)
        self.assertAllowed(self.read("src/engine.js"))

    def test_more_reads_are_seen(self):
        for cmd in ('echo "$(<src/engine.js)"', "ls src/*.js | xargs cat",
                    'find src -name "*.js" -exec head -3 {} \;',
                    "diff src/engine.js src/render.js", "git log -p -- src/engine.js",
                    "git blame src/engine.js", "git show HEAD -- src/engine.js",
                    "python3 -c \"print(open('src/engine.js').read())\"",
                    "for f in $(ls src/*.js); do head -3 \"$f\"; done",
                    "bash <<'EOF'\ncat src/engine.js\nEOF"):
            with self.subTest(cmd=cmd):
                self.assertDenied(self.bash(cmd, session=self.sid + "-fresh"), "READ")

    def test_content_free_and_running_code_are_not_reads(self):
        for cmd in ("cat src/engine.js | wc -l", "sed -n '$=' src/engine.js",
                    "awk 'END {print NR}' src/engine.js", "wc -l src/*.js", "ls src",
                    "node -e \"import('./src/engine.js').then(m => console.log(1))\"",
                    "cat src/engine.js > /dev/null", "git diff --stat", "git log --stat"):
            with self.subTest(cmd=cmd):
                self.assertAllowed(self.bash(cmd, session=self.sid + "-fresh"))

    def test_powershell_get_content_is_a_read(self):
        self.assertDenied(self.pre("PowerShell", {"command": "Get-Content src\\engine.js"}),
                          "src/engine.js")

    @unittest.skipIf(os.name == "nt", "PATH layout differs on Windows")
    def test_fails_open_when_graphify_is_not_on_path(self):
        env = {"GRAPHIFY_BIN": "", "PATH": "/usr/bin:/bin"}
        self.assertAllowed(self.read("src/engine.js", env=env))
        self.assertAllowed(self.bash("grep -rn BrainEngine src", env=env))

    def test_agent_without_shell_is_denied_once_then_passes(self):
        write(self.root, ".claude/agents/reader-only.md",
              "---\nname: reader-only\ndescription: x\ntools: Read, Grep, Glob\n---\nbody\n")
        p = self.base_payload("PreToolUse", tool_name="Read",
                              tool_input={"file_path": os.path.join(self.root, "src", "render.js")},
                              agent_id="ro-1", agent_type="reader-only")
        self.assertIn("no Bash", reason(self.run_gate("pre", p)))
        self.assertIsNone(self.run_gate("pre", p))


# --------------------------------------------------------------------- ASCII output

class AsciiOutputTest(GateCase):
    """Every emitted JSON object is pure ASCII (run_gate checks each call), even when
    the repo path, the command and the graph answers are not."""

    @classmethod
    def setUpClass(cls):
        cls.fx = Fixture(prefix="graph-gate-ümläut-")
        cls.root = cls.fx.make_repo("répo")
        cls.gate_path = gate_of(cls.root)

    def test_session_start_with_non_ascii_repo_path(self):
        out = self.run_gate("session-start", self.base_payload("SessionStart"))
        self.assertIn(fwd(self.root), reason(out))

    def test_deny_reasons_with_non_ascii_command(self):
        r = self.assertDenied(self.bash("cat src/engine.js  # café ✓"), "src/engine.js")
        self.assertIn("café ✓", r)
        self.assertDenied(self.read("src/engine.js"), "src/engine.js")

    def test_post_and_stop_with_non_ascii_text(self):
        self.post_bash('graphify query "wäs ist das" --budget 400', QUERY_PROSE)
        self.assertAllowed(self.read("src/render.js"))
        self.run_gate("prompt", self.base_payload("UserPromptSubmit", prompt="ä✓"))
        write(self.root, "src/neu.js", "export function grüßeWelt() {}\n"
                                       "export function helloThere() {}\n")
        try:
            out = self.run_gate("stop", self.base_payload("Stop", stop_hook_active=False))
            self.assertEqual(decision(out), "block")
            self.assertIn("src/neu.js", reason(out))
        finally:
            os.remove(os.path.join(self.root, "src", "neu.js"))


if __name__ == "__main__":
    unittest.main()
