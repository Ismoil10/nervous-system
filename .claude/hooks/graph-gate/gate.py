#!/usr/bin/env python3
"""Graph gate - project edition (from the machine-wide gate v2 rev 3).

Makes Claude Code - the main session and every subagent and workflow agent it starts -
use this repo's Graphify knowledge graph before raw source, keep the graph fresh, and
check the impact of what a turn changed. It ships in the repo, so it travels with every
clone, and runs on macOS, Linux and Windows (Git Bash runs the hook command; run.sh picks
a Python 3). Wired from .claude/settings.json as one script with six entry points:

  session-start  SessionStart        prune old state; start `graphify watch`; refresh a graph
                                     when code changed since the commit it was built at;
                                     install graphify's git hooks and graph.json merge driver
                                     once per clone; tell the model the protocol
  prompt         UserPromptSubmit    snapshot the source diff at turn start; keep the watcher
                                     alive; one-line reminder
  pre            PreToolUse          DENY (1) a search (Grep, Glob, Bash/PowerShell grep/rg/
                                     find/fd/...) over indexed code for a camelCase/PascalCase
                                     name this agent has not asked the graph about by name;
                                     (2) a READ that prints an indexed source file no graph
                                     answer has shown this agent: Read; cat/head/tail/less/
                                     bat/nl/tac and `< file`; sed/awk/perl over files; grep/
                                     rg/git grep over one or two files, narrowed to one by a
                                     glob, or with a match-all pattern; diff and git diff
                                     --no-index; git show/cat-file REV:path, show REV -- path,
                                     blame, log -p/-L with a path; find -exec <reader>; a
                                     reader fed a listing (`| xargs cat`, loops over ls/find);
                                     python/node scripts that open()/readFileSync() it - but
                                     not when the output only goes to wc/shasum or a file;
                                     (3) a graph rebuild (`graphify update/extract/watch/add/
                                     export/...`) by a subagent, and `graphify claude install|
                                     uninstall` / `graphify uninstall` by anyone. An agent
                                     with no Bash or graphify MCP tool gets the graph's answer
                                     in the deny and passes on retry. Fills project_path on
                                     mcp__graphify__*. Stands aside when graphify is not on
                                     PATH (nothing could lift a deny)
  post           PostToolUse and     record (a) the names a REAL by-name graph query asked
                 PostToolUseFailure  about (explain|affected|path, query --seed, MCP get_node/
                                     get_neighbors/shortest_path/get_pr_impact/query_graph) and
                                     (b) the indexed source files a graph answer named - any
                                     graphify read command (prose query too), any
                                     mcp__graphify__* answer, graphify-out/*.md, and the
                                     files that define the symbols a by-name query asked
                                     about; when other commands printed into the same Bash
                                     output, only paths in graphify's own answer syntax count
  stop           Stop                once per turn: source changed this turn and no agent of
                                     the session ran a by-name impact query on a changed
                                     declaration (or the function/method a body edit sits
                                     in) or a changed file's stem after the last edit, or
                                     the graph has not seen the edited files and no watcher
                                     runs -> block once with a pre-filled `graphify update .`
                                     / `graphify affected`
  subagent-start SubagentStart       give every subagent (Workflow agents too) the protocol

Gates only the repo it ships in: its work tree, the main checkout it is a worktree of, and
their linked worktrees (`isolation: worktree` agents). Never gated: files the graph does not
index as code (research notes, raw/ captures, Markdown, JSON and other data, an HTML page
without parsed script); patterns with no camelCase/PascalCase name (snake_case, ALLCAPS,
"quoted" keys, hex and other literals, plain words, extension globs); pipeline filters.

The machine-wide gate (~/.claude/hooks/graph-gate/gate.py, when installed) stands down for
this repo while this gate runs in a session, once it honours the handshake: this gate
writes <session>.projectgates into the machine gate's state dir at SessionStart,
UserPromptSubmit and SubagentStart. Until then both gate (duplicate deny reasons, no harm:
each keeps its own state).

Kill switches: env GRAPH_GATE=off, a file named OFF next to this script, or .graph-gate-off
in the repo root. State: $GRAPH_GATE_PROJECT_STATE, else <machine state>/project, where the
machine state is $GRAPH_GATE_STATE or ~/.cache/claude-graph-gate; GRAPH_GATE_TTL (seconds,
default 7200) is how long an ask or a located file lasts; GRAPH_GATE_NO_GIT_SETUP=1 skips
installing graphify's git hooks; GRAPH_GATE_NO_WATCH=1 never starts `graphify watch`;
GRAPH_GATE_NO_UPDATE=1 never starts a background `graphify update`; GRAPH_GATE_WATCH_DIR
moves the watcher's pid/log/lock dir (default ~/.cache/graphify-watch); GRAPHIFY_BIN names
the graphify executable; GRAPH_GATE_PROJECT_ROOT overrides the repo root (tests only).

Fail-open everywhere: any exception prints nothing and exits 0, and a deny is only issued
when a later graph query could be recorded (the state dir is writable, graphify is on
PATH, the graph is readable). The only intentional blocks are the PreToolUse denies and
the once-per-turn Stop block. Python 3.8+, stdlib only; all text is read and written as
UTF-8.
"""
import os
import sys

# Fast path, before json/re are imported (about 20 ms of a ~55 ms run on this Mac):
# most hook calls are a Bash command that is no search (pre) or runs no graphify
# (post). Decided on the raw payload's words; anything unclear takes the full path.
_RAW = None
_SEARCH_TOKENS = {"grep", "egrep", "fgrep", "zgrep", "ugrep", "rg", "rga", "ripgrep", "ag",
                  "ack", "pt", "sift", "fd", "fdfind", "find", "sg", "mdfind", "awk", "gawk",
                  "perl", "sed"}
_READ_TOKENS = {"cat", "head", "tail", "less", "more", "bat", "batcat", "nl", "tac", "show",
                "graphify", "diff", "sdiff", "colordiff", "blame", "annotate", "log", "xargs",
                "python", "python3", "py", "node", "deno", "bun", "bash", "sh", "zsh", "Read"}
if __name__ == "__main__":
    try:
        _RAW = sys.stdin.buffer.read().decode("utf-8", "replace")
        _MODE = sys.argv[1] if len(sys.argv) > 1 else ""
        if _MODE == "post" and "graphify" not in _RAW:
            sys.exit(0)
        if _MODE == "pre" and "mcp__" not in _RAW:
            _t = _RAW
            for _esc in ("\\n", "\\t", "\\r", "\\b", "\\f"):
                _t = _t.replace(_esc, " ")
            _words = set(_t.translate({c: 32 for c in range(128)
                                       if not (chr(c).isalnum() or c == 95)}).split())
            if "Bash" in _words and "<" not in _RAW and not (_words & (_SEARCH_TOKENS | _READ_TOKENS |
                                                   {"Grep", "Glob", "Agent", "Task"})):
                sys.exit(0)
    except Exception:
        pass

import json  # noqa: E402  (after the fast path on purpose)
import re  # noqa: E402
import time  # noqa: E402
import io  # noqa: E402
import posixpath  # noqa: E402


def open(file, mode="r", *args, **kw):  # noqa: A001 - UTF-8 text on every platform
    if "b" not in mode:
        kw.setdefault("encoding", "utf-8")
        kw.setdefault("errors", "replace")
    return io.open(file, mode, *args, **kw)


HERE = os.path.dirname(os.path.abspath(__file__))
# The machine-wide gate (~/.claude/hooks/graph-gate, when installed) keeps its state here;
# this gate only writes its <session>.projectgates handshake there.
MACHINE_STATE = os.path.expanduser(os.environ.get("GRAPH_GATE_STATE")
                                   or "~/.cache/claude-graph-gate")
# Its own state, apart, so the two gates never overwrite each other's turn snapshots,
# asks or Stop markers when both run.
STATE = os.path.expanduser(os.environ.get("GRAPH_GATE_PROJECT_STATE")
                           or os.path.join(MACHINE_STATE, "project"))
MARKERS = os.path.join(STATE, "markers")
WATCH_DIR = os.path.expanduser(os.environ.get("GRAPH_GATE_WATCH_DIR") or "~/.cache/graphify-watch")
IS_WIN = os.name == "nt"
# The repo this copy ships in: <root>/.claude/hooks/graph-gate/gate.py -> <root>.
PROJECT_ROOT = os.path.realpath(os.environ.get("GRAPH_GATE_PROJECT_ROOT")
                                or os.path.join(HERE, os.pardir, os.pardir, os.pardir))
_GRAPHIFY = []


def graphify_bin():
    """The graphify executable: $GRAPHIFY_BIN, PATH, then ~/.local/bin."""
    if not _GRAPHIFY:
        import shutil
        p = os.environ.get("GRAPHIFY_BIN") or shutil.which("graphify")
        if not p:
            for c in ("~/.local/bin/graphify", "~/.local/bin/graphify.exe"):
                c = os.path.expanduser(c)
                if os.path.isfile(c):
                    p = c
                    break
        _GRAPHIFY.append(p or "graphify")
    return _GRAPHIFY[0]


def _seconds(name, default):
    try:
        v = float(os.environ.get(name) or default)
    except (TypeError, ValueError):
        return float(default)
    return v if v > 0 else float(default)


TTL = _seconds("GRAPH_GATE_TTL", 7200)      # how long "this agent asked about X" lasts
PRUNE_AGE = 3 * 86400                       # markers older than this are deleted
LOG_MAX = 2000000                           # usage.log rotates past this size

NAME_SUBS = {"explain", "affected", "path"}  # by name; these also count as impact checks
QUERY_SUBS = NAME_SUBS | {"query"}           # query counts only with --seed
MCP_IMPACT_TOOLS = {"get_node", "get_neighbors", "shortest_path", "get_pr_impact"}
MCP_QUERY_TOOLS = MCP_IMPACT_TOOLS | {"query_graph"}
GRAPH_OUTPUT = re.compile(r"^(Node:|No node matching|Ambiguous:|Affected nodes for|"
                          r"No unique node match|Graph: |Shortest path|No directed path|"
                          r"No path found|No matching nodes found|"
                          r"No exact match for '|"              # near miss (explain, path): exit 4
                          r"'[^'\n]*' and '[^'\n]*' both resolved to)", re.M)
# One name per asked label: `explain "A|B"` / "A B" / "A,B" resolve to nothing in the
# graph ("No node matching 'A|B'") and must not credit A and B.
ONE_NAME = re.compile(r"^[\w$.#:/\\\-<>]+(?:\(\))?$")
# Cheap pre-filter: a Bash command with none of these words cannot be a search.
SEARCH_WORD = re.compile(r"\b(?:[efzu]?grep|rga?|ripgrep|ag|ack|pt|sift|fd|fdfind|find|sg|"
                         r"ast-grep|mdfind|g?awk|perl|sed)\b")
DIFF_SPECS = ["*.kt", "*.kts", "*.java", "*.swift", "*.ts", "*.tsx", "*.js", "*.jsx",
              "*.py", "*.go", "*.rs"]
DECL = re.compile(r"\b(fun|class|object|interface|typealias|struct|func|def|function|enum|"
                  r"val|var|let|const)\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?([A-Za-z_]\w{2,})")
DECL_WEAK = {"val", "var", "let", "const"}
NOT_A_NAME = {"class", "interface", "object", "fun", "val", "var", "enum", "struct", "func",
              "def", "function", "const", "let", "typealias", "data", "sealed", "abstract",
              "open", "inner", "value", "annotation", "suspend", "inline", "private",
              "public", "internal", "protected", "override", "static", "async"}
# Programming-language sources graphify parses (a new one counts at Stop before the graph
# has seen it) and data/doc formats that are never code to the gate, whatever node types
# graphify gives them (brain-system/package.json has "code" nodes; it is still data).
CODE_EXTS = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts", ".py", ".kt",
             ".kts", ".java", ".swift", ".go", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs",
             ".rb", ".php", ".lua", ".scala", ".dart", ".vue", ".svelte"}
DATA_EXTS = {".json", ".jsonl", ".yaml", ".yml", ".toml", ".xml", ".csv", ".md", ".txt",
             ".css", ".lock"}
MARKUP_EXTS = {".html", ".htm"}               # code only when the graph found script in it
# Commands that print a file's content: reading one of the graph's code files with them
# needs a graph answer that named the file first.
READERS = {"cat", "head", "tail", "less", "more", "bat", "batcat", "nl", "tac"}
READER_VAL = {"-n", "-c", "--lines", "--bytes", "-r", "--line-range", "-l", "--language",
              "-H", "--highlight-line", "--theme", "--style", "-m", "--map-syntax"}
# grep/rg flags that print no file content (names, counts, exit status only)
NO_CONTENT = {"-l", "-L", "-c", "-q", "--files-with-matches", "--files-without-match",
              "--count", "--quiet", "--count-matches", "--files"}
# graphify subcommands that read the graph and print what it holds
GRAPH_READ_SUBS = QUERY_SUBS | {"god-nodes"}
# graphify subcommands that write the graph, its outputs or tool config: a subagent
# leaves them to the main session (concurrent rebuilds of graph.json collide)
GRAPH_WRITE_SUBS = {"update", "extract", "watch", "cluster-only", "label", "add",
                    "merge-graphs", "export", "tree", "install", "clone", "merge-driver"}
ACTION_WORD = re.compile(SEARCH_WORD.pattern + r"|\b(?:cat|head|tail|less|more|batcat|bat|nl|tac|"
                         r"show|graphify|diff|sdiff|colordiff|blame|annotate|log|xargs|"
                         r"python3?|py|node|deno|bun|bash|sh|zsh)\b|<")


# ------------------------------------------------------------------ helpers

def read_payload():
    try:
        raw = _RAW if _RAW is not None else sys.stdin.read()
        d = json.loads(raw) if raw.strip() else {}
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def globally_off():
    return (os.environ.get("GRAPH_GATE", "").strip().lower() in ("off", "0", "false", "no")
            or os.path.exists(os.path.join(HERE, "OFF")))


def _str(v):
    return v if isinstance(v, str) else ""


def tool_input(payload):
    ti = payload.get("tool_input")
    return ti if isinstance(ti, dict) else {}


def cwd_of(payload):
    c = payload.get("cwd")
    if isinstance(c, str) and c:
        return c
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


_REPO_CACHE = {}


def _has_graph(d):
    return (os.path.isfile(os.path.join(d, "graphify-out", "graph.json"))
            and not os.path.exists(os.path.join(d, ".graph-gate-off")))


def _main_checkout(d):
    """The main checkout of a linked worktree (.git is a file whose gitdir has a
    commondir), else None. Submodules have no commondir and stay their own repo."""
    try:
        with open(os.path.join(d, ".git")) as f:
            line = f.readline().strip()
        if not line.startswith("gitdir:"):
            return None
        gd = os.path.normpath(os.path.join(d, line[7:].strip()))
        with open(os.path.join(gd, "commondir")) as f:
            common = os.path.realpath(os.path.normpath(os.path.join(gd, f.readline().strip())))
        if os.path.basename(common) == ".git":
            return os.path.dirname(common)
    except (OSError, ValueError):
        pass
    return None


def repo_of(path):
    """(work tree, graph root) for the real git work tree that holds `path`, when a
    graph covers it; else None. The nearest .git decides, so ~/projects (no .git, a
    stray graph.json) never counts and a sibling repo is judged by ITS graph. A linked
    worktree (graphify-out is gitignored) falls back to its main checkout's graph."""
    try:
        d = os.path.realpath(os.path.expanduser(path))
    except Exception:
        return None
    seen, res = [], None
    while True:
        if d in _REPO_CACHE:
            res = _REPO_CACHE[d]
            break
        seen.append(d)
        if os.path.exists(os.path.join(d, ".git")):
            if _has_graph(d):
                res = (d, d)
            elif not os.path.exists(os.path.join(d, ".graph-gate-off")):
                main = _main_checkout(d)
                if main and main != d and _has_graph(main):
                    res = (d, main)
            break
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    if res and not _in_family(res[0]):
        res = None                             # another repo: not this gate's to judge
    for s in seen:
        _REPO_CACHE[s] = res
    return res


_FAMILY = []


def _in_family(work):
    """Is `work` this gate's repo: its work tree, the main checkout it is a worktree of, or
    another linked worktree of that checkout (`isolation: worktree` agents run here,
    in .claude/worktrees/...)? A separate clone is not."""
    if not _FAMILY:
        fam = {os.path.normcase(PROJECT_ROOT)}
        main = _main_checkout(PROJECT_ROOT)
        if main:
            fam.add(os.path.normcase(main))
        _FAMILY.append(fam)
    fam = _FAMILY[0]
    if os.path.normcase(work) in fam:
        return True
    main = _main_checkout(work)
    return bool(main) and os.path.normcase(main) in fam


def graph_root(payload):
    return repo_of(cwd_of(payload))


def _in_git(d):
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return True
        parent = os.path.dirname(d)
        if parent == d:
            return False
        d = parent


def _safe(s, default):
    s = re.sub(r"[^A-Za-z0-9_.-]", "_", str(s or ""))[:96]
    return s or default


def _sha(s, n):
    import hashlib
    return hashlib.sha1(s.encode("utf-8", "replace")).hexdigest()[:n]


def rkey(graph):
    return _sha(os.path.realpath(graph), 10)


def mpath(name):
    os.makedirs(MARKERS, exist_ok=True)
    return os.path.join(MARKERS, name)


def agent_marker(payload, graph, kind):
    return mpath("%s__%s__%s.%s" % (_safe(payload.get("session_id"), "nosession"),
                                    _safe(payload.get("agent_id"), "main"), rkey(graph), kind))


def session_marker(payload, graph, kind):
    return mpath("%s__%s.%s" % (_safe(payload.get("session_id"), "nosession"), rkey(graph), kind))


def touch(path):
    with open(path, "a"):
        pass
    os.utime(path, None)


def log_usage(root, payload, what):
    try:
        os.makedirs(STATE, exist_ok=True)
        with open(os.path.join(STATE, "usage.log"), "a") as f:
            f.write("%s\t%s\t%s\t%s\t%s\t%s\n" % (
                time.strftime("%Y-%m-%d %H:%M:%S"), os.path.basename(root or "-"),
                _safe(payload.get("session_id"), "-"), _safe(payload.get("agent_id"), "main"),
                _str(payload.get("tool_name")) or "-",
                what.replace("\n", " ").replace("\t", " ")[:200]))
    except Exception:
        pass


def debug(payload, event):
    if os.path.exists(os.path.join(HERE, "DEBUG")):
        try:
            os.makedirs(STATE, exist_ok=True)
            with open(os.path.join(STATE, "debug.log"), "a") as f:
                f.write(json.dumps({"event": event, "payload": payload})[:4000] + "\n")
        except Exception:
            pass


def emit(obj):
    out = json.dumps(obj, ensure_ascii=True)   # ASCII: no console code page can garble it
    try:
        sys.stdout.buffer.write(out.encode("ascii"))
        sys.stdout.flush()
    except AttributeError:
        sys.stdout.write(out)


def shq(s):
    import shlex
    return shlex.quote(s)


def disp(p):
    """A path as the model should type it (forward slashes on Windows too)."""
    return p.replace("\\", "/") if IS_WIN else p


def protocol(repo):
    work, graph = repo
    where = disp(graph) if work == graph else (
        "%s - this worktree has no graph of its own, so the gate uses the main checkout's "
        "graph at %s, which reflects the main checkout's code" % (disp(work), disp(graph)))
    g = shq(disp(graph))
    return (
        "GRAPH-FIRST PROTOCOL (enforced by this repo's hook .claude/hooks/graph-gate, in %s). "
        "Use the Graphify knowledge graph before raw source, then confirm with grep/Read. "
        "SCOPE: all work is on brain-system/; anger-galaxy/ is an unrelated project, excluded "
        "from the graph - never read, cite or change it.\n"
        "  cd %s && graphify explain \"<Symbol or path/file.js>\"   # what it is, file:line, "
        "who uses it\n"
        "  graphify affected \"<Symbol>\" --depth 2   # blast radius before/after an edit\n"
        "  graphify path \"<A>\" \"<B>\"               # how A reaches B\n"
        "  graphify query \"<question>\" --seed \"<Symbol>\" --budget 1500   # a scoped "
        "neighbourhood\n"
        "(or mcp__graphify__get_node / get_neighbors / shortest_path / query_graph; the hook "
        "fills in project_path).\n"
        "1. SEARCH: a Grep/Glob/grep/rg/find for a camelCase/PascalCase name is blocked until "
        "this agent has asked the graph about that name BY NAME (explain/affected/path, or "
        "query --seed). One name per explain (`graphify explain \"A\"; graphify explain "
        "\"B\"`, not \"A|B\"); a name the graph does not know still counts once asked; a "
        "short word (Model, State) does not unlock the longer names that contain it; a prose "
        "query without --seed asks about no name. %s\n"
        "2. READ: printing a source file the graph indexes (Read; cat/head/tail/sed/awk/nl/bat, "
        "`< file`; grep over one or two files or narrowed to one by a glob; diff; git show/"
        "blame/log -p of it; python/node scripts that open it) is blocked until a graph answer "
        "shown to THIS agent named that file: explain, query (prose too) or an "
        "mcp__graphify__* answer that prints its path, an explain/affected/path by name on a "
        "symbol it defines, or graphify-out/GRAPH_REPORT.md. When graphify runs in the same "
        "command as grep/find/ls, only the paths in graphify's own answer count. Then read only "
        "the lines the graph pointed to (Read with offset/limit). Research notes, raw/ "
        "captures, Markdown, JSON and other files the graph does not index as code are never "
        "gated.\n"
        "3. UPDATE: subagents never rebuild the graph - `graphify update/extract/watch/add/"
        "export/cluster-only/label` is blocked for them (concurrent rebuilds of graph.json "
        "collide); the main session's `graphify watch` refreshes it on save, or the main agent "
        "runs `graphify update .` once between stages. `graphify claude install|uninstall` and "
        "`graphify uninstall` are blocked for every agent: this hook replaces graphify's own "
        "hook-guard, and uninstall --purge deletes the graph.\n"
        "4. IMPACT: when a turn changed code, the gate stops it once and asks for `graphify "
        "affected \"<changed declaration, or the function/method around a body edit>\" "
        "--depth 2` (after `graphify update .` when no watcher runs) - or hand the impact "
        "check, and any where-is / who-calls / what-breaks question, to the graph-scout agent "
        "(its queries count for this check; a grep or read YOU run still needs your own graph "
        "query).\n"
        "Run graphify from the repo root and read its answer: a query after `||`, or whose "
        "output goes to a file or /dev/null, counts for nothing. What the graph holds on this "
        "JavaScript (measured: 79%% of call sites, 89%% in src, 49%% in tests): methods are "
        "nodes labelled `.name()` (an ambiguous name lists ids: explain takes "
        "`path::.method()`, affected and path need the id); `this.method()` calls, plain function calls, imports and `new X()` are "
        "in; calls on another object are in only when its class is inferable (`renderer.render()` "
        "in main.js is not); calls inside anonymous test()/describe() callbacks are not; GLSL "
        "in shader strings is not parsed. 'No callers' is a lead to confirm with grep, never a "
        "verdict. /graph-usage audits how well a session used the graph."
        % (where, g, NEVER_BLOCKED))


NEVER_BLOCKED = ("String keys in quotes (\"isLast\"), snake_case, ALLCAPS, hex and other "
                 "literals, plain words, extension globs and searches outside the indexed "
                 "code (research/, raw/, docs, scratch dirs) are never blocked.")


# ------------------------------------------------------------- bash parsing
#
# Decide on what the shell would actually RUN, against what the graph actually
# INDEXES:
#   * commands are split on unquoted operators only; $(...), `...` and <(...) bodies
#     (also inside double quotes) are commands of their own; redirections are dropped
#   * shell keywords (if/then/do/while/!/{) and wrappers (xargs -0, timeout 20, env,
#     sudo -u x, ...) are skipped with their own options; bash/sh/zsh -c and eval recurse
#   * options that take a value (-e, -A 3, -g GLOB, -t kotlin, --include GLOB) are not
#     operands; `cd DIR`, `VAR=value` and `for v in WORDS` earlier in the command are
#     followed; an unknown $VAR or `cd -` makes the place unknown, which fails open
#   * a search is over code only when its target is in a git repo that has a graph
#     AND could touch a file the graph indexes as code (dirs/extensions read from
#     graph.json), so res/ XML, docs, JSON, build outputs and scratch dirs pass
#   * one or two regular files are a read, not a search, whatever the flags (-r, rg)

_HEREDOC = re.compile(r"(?<!<)<<(?!<)-?\s*(['\"]?)([A-Za-z_]\w*)\1")
_ASSIGN = re.compile(r"^[A-Za-z_]\w*=")
SEARCH_EXES = {"grep", "egrep", "fgrep", "zgrep", "ugrep", "rg", "ripgrep", "rga", "ag", "ack",
               "pt", "sift", "fd", "fdfind", "find", "sg", "ast-grep", "mdfind"}
GREP_LIKE = {"grep", "egrep", "fgrep", "zgrep", "ugrep"}
RECURSIVE_BY_DEFAULT = {"rg", "ripgrep", "rga", "ag", "ack", "pt", "sift"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
KEYWORDS = {"if", "then", "else", "elif", "do", "while", "until", "!", "{", "}", "fi",
            "done", "coproc", "esac"}
# wrapper -> its options that take a separate value
WRAPPERS = {"sudo": {"-u", "-g", "-C", "-D", "-h", "-p", "-U", "-r", "-t"},
            "env": {"-u", "-C", "-S", "--unset", "--chdir"}, "nice": {"-n"},
            "ionice": {"-c", "-n", "-p"}, "timeout": {"-s", "-k", "--signal", "--kill-after"},
            "gtimeout": {"-s", "-k"}, "stdbuf": {"-i", "-o", "-e"}, "nohup": set(),
            "command": set(), "builtin": set(), "caffeinate": set(), "doas": {"-u"},
            "time": set(), "exec": {"-a"},
            "uvx": {"--from", "--with", "-p", "--python", "--with-requirements", "--index-url"},
            "xargs": {"-I", "-i", "-n", "-P", "-L", "-l", "-d", "-E", "-e", "-s", "-a",
                      "-R", "-S", "--max-args", "--max-procs", "--delimiter", "--arg-file",
                      "--replace", "--max-lines", "--eof"}}
GREP_VAL = {"-e", "-f", "-m", "-A", "-B", "-C", "-d", "-D", "--regexp", "--file",
            "--max-count", "--after-context", "--before-context", "--context",
            "--include", "--exclude", "--exclude-dir", "--exclude-from", "--binary-files",
            "--label", "--devices", "--directories", "--group-separator"}
RG_VAL = {"-e", "-f", "-g", "--glob", "--iglob", "-t", "--type", "-T", "--type-not", "-m",
          "--max-count", "-A", "-B", "-C", "--after-context", "--before-context",
          "--context", "-M", "--max-columns", "-j", "--threads", "-d", "--max-depth",
          "--maxdepth", "-E", "--encoding", "-r", "--replace", "--type-add", "--sort",
          "--sortr", "--pre", "--pre-glob", "--ignore-file", "--path-separator", "--colors",
          "--context-separator", "--max-filesize", "-G", "--file-search-regex", "--ignore",
          "--ignore-dir", "--depth"}
FD_VAL = {"-e", "--extension", "-t", "--type", "-E", "--exclude", "-d", "--max-depth",
          "--min-depth", "--exact-depth", "-S", "--size", "-c", "--color", "-o", "--owner",
          "--changed-within", "--changed-before", "--base-directory", "-j", "--threads",
          "--max-results", "--ignore-file", "--search-path", "--path-separator"}
SG_VAL = {"-p", "--pattern", "-l", "--lang", "-r", "--rewrite", "--globs", "-c", "--config",
          "--selector", "--strictness", "--json", "-j", "--threads"}
MDFIND_VAL = {"-onlyin", "-name", "-s", "-attr"}
TYPE_EXTS = {"kotlin": ".kt .kts", "kt": ".kt .kts", "java": ".java", "py": ".py",
             "python": ".py", "swift": ".swift", "ts": ".ts .tsx", "typescript": ".ts .tsx",
             "js": ".js .jsx .mjs .cjs", "javascript": ".js .jsx", "go": ".go", "rust": ".rs",
             "rs": ".rs", "sql": ".sql", "xml": ".xml", "json": ".json", "yaml": ".yaml .yml",
             "md": ".md", "markdown": ".md", "gradle": ".gradle", "html": ".html .htm",
             "css": ".css", "sh": ".sh", "toml": ".toml", "txt": ".txt"}
SCANNERS = {"awk": {"-f", "-v", "-F"}, "gawk": {"-f", "-v", "-F"},
            "perl": {"-e", "-E", "-I", "-M", "-m", "-f"}, "sed": {"-e", "-f"}}
# Android resource references are not graph edges (0 nodes for any string key), so a
# graph query cannot answer "who uses R.string.x" - do not demand one.
RES_REF = re.compile(r"^(R\.(string|plurals|array|drawable|mipmap|color|dimen|raw|font|"
                     r"style|id|xml|anim|layout|integer|bool)\.|@\+?(string|drawable|color|"
                     r"dimen|style|id|layout|mipmap)/)")
NEVER_CODE_PARTS = {"graphify-out", ".git", "node_modules", ".gradle", ".idea", ".kotlin",
                    "DerivedData", "Pods", "__pycache__"}


def _braces(word, limit=64):
    """Bash brace expansion of one word: app/src/{main,test} -> two words."""
    m = re.search(r"\{([^{}]*,[^{}]*)\}", word)
    if not m:
        return [word]
    out = []
    for alt in m.group(1).split(","):
        out += _braces(word[:m.start()] + alt + word[m.end():], limit)
        if len(out) >= limit:
            break
    return out[:limit]


_GITTOP = re.compile(r"\$\(\s*git\s+rev-parse\s+--show-toplevel\s*\)|`\s*git\s+rev-parse\s+"
                     r"--show-toplevel\s*`")


def _git_top(d):
    try:
        d = os.path.abspath(d)
        while True:
            if os.path.exists(os.path.join(d, ".git")):
                return d
            parent = os.path.dirname(d)
            if parent == d:
                return None
            d = parent
    except Exception:
        return None


def strip_heredocs(text):
    m = _HEREDOC.search(text)
    while m:
        nl = text.find("\n", m.end())
        if nl == -1:
            break
        end = re.compile(r"^\s*" + re.escape(m.group(2)) + r"\s*$", re.M).search(text, nl + 1)
        if end is None:
            return text[:nl + 1]
        text = text[:nl + 1] + text[end.end():]
        m = _HEREDOC.search(text, nl + 1)
    return text


def _close(s, i):
    """Index of the ')' that closes the '(' at s[i], honouring quotes and nesting."""
    depth, q, j = 0, None, i
    while j < len(s):
        ch = s[j]
        if q:
            if ch == "\\" and q == '"':
                j += 1
            elif ch == q:
                q = None
        elif ch in "'\"":
            q = ch
        elif ch == "\\":
            j += 1
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return j
        j += 1
    return len(s)


def _skip_word(s, i):
    """End index of the shell word starting at s[i] (quotes honoured)."""
    q = None
    while i < len(s):
        ch = s[i]
        if q:
            if ch == q:
                q = None
        elif ch in "'\"":
            q = ch
        elif ch == "\\":
            i += 1
        elif ch.isspace() or ch in "|;&()<>":
            break
        i += 1
    return i


def split_commands(cmd):
    """[(text, piped, quiet, after_and)] per simple command. Quote-aware; command
    substitutions come out as commands of their own (their place in the outer word
    becomes __SUBST__); comments and redirections (with their targets) are removed.
    quiet: the command runs only after `||`, or its stdout goes to a file or /dev/null -
    a graph query there may never run, or its answer is never seen, so it unlocks
    nothing. after_and: the command follows `&&` (see _walk: `false && graphify ...`)."""
    def scan(s):
        segs, buf, piped, quiet, q, i, n = [], [], False, False, None, 0, len(s)
        after_and = False

        def flush(next_piped, next_quiet=False, next_and=False):
            nonlocal buf, piped, quiet, after_and
            t = "".join(buf).strip()
            if t:
                segs.append((t, piped, quiet, after_and))
            buf, piped, quiet, after_and = [], next_piped, next_quiet, next_and

        while i < n:
            ch = s[i]
            if q == "'":
                buf.append(ch)
                q = None if ch == "'" else q
                i += 1
                continue
            if ch == "\\" and i + 1 < n:
                if s[i + 1] != "\n":          # backslash-newline is a line continuation
                    buf.append(s[i:i + 2])
                i += 2
                continue
            if s.startswith("$((", i):        # arithmetic, not a command
                j = s.find("))", i + 3)
                i = n if j < 0 else j + 2
                buf.append("0")
                continue
            if s.startswith("$(", i) or (q is None and s.startswith(("<(", ">("), i)):
                j = _close(s, i + 1)
                segs.extend(scan(s[i + 2:j]))
                buf.append("__SUBST__")
                i = j + 1
                continue
            if ch == "`":
                j = s.find("`", i + 1)
                j = n if j < 0 else j
                segs.extend(scan(s[i + 1:j]))
                buf.append("__SUBST__")
                i = j + 1
                continue
            if q == '"':
                buf.append(ch)
                q = None if ch == '"' else q
                i += 1
                continue
            if ch in "'\"":
                q = ch
                buf.append(ch)
                i += 1
                continue
            # ---- unquoted
            if ch == "#" and (i == 0 or s[i - 1] in " \t\n;&|()"):
                j = s.find("\n", i)           # a comment: its quotes and words are not code
                i = n if j < 0 else j
                continue
            if ch in "<>" or (ch == "&" and s.startswith("&>", i)):
                # redirection: drop a leading fd number, the operator and its target
                k = len(buf)
                while k and buf[k - 1].isdigit():
                    k -= 1
                fd = ""
                if k == 0 or buf[k - 1].isspace():
                    fd = "".join(buf[k:])
                    del buf[k:]
                j = i + 1
                while j < n and s[j] in "<>&|-":
                    j += 1
                op = s[i:j]
                out_redir = ">" in op and not op.startswith("<") and fd in ("", "1")
                if op.endswith("&") and j < n and (s[j].isdigit() or s[j] == "-"):
                    quiet = quiet or (out_redir and s[j] == "-")   # >&- closes stdout
                    i = j + 1                  # 2>&1, >&-
                    continue
                quiet = quiet or out_redir     # > file, >/dev/null, &>, 1>>log
                while j < n and s[j] in " \t":
                    j += 1
                i = _skip_word(s, j)
                if op == "<" and fd in ("", "0") and i > j:
                    # `cat < file`, `$(<file)`, `done < file`: keep the file the command
                    # reads its stdin from (_walk turns the marker into Seg.stdin_file)
                    buf.append(" __STDIN__=" + s[j:i] + " ")
                else:
                    buf.append(" ")
                continue
            if s.startswith(("&&", "||"), i):
                flush(False, s.startswith("||", i), s.startswith("&&", i))
                i += 2
                continue
            if s.startswith("|&", i):
                flush(True)
                i += 2
                continue
            if ch == "|":
                flush(True)
                i += 1
                continue
            if ch in ";\n&()":
                flush(False)
                i += 1
                continue
            buf.append(ch)
            i += 1
        flush(False)
        return segs

    return scan(strip_heredocs(cmd))


def _tokens(text):
    import shlex
    try:
        return shlex.split(text, posix=True)
    except ValueError:
        return text.split()


def executable(toks):
    """(exe, args, via_xargs): skips VAR=x, shell keywords and wrappers with their
    options (xargs -0 -I{}, timeout 20, env -u X, sudo -u x ...)."""
    i, via_xargs = 0, False
    while i < len(toks):
        t = toks[i]
        if t in KEYWORDS or _ASSIGN.match(t):
            i += 1
            continue
        name = os.path.basename(t)
        if name in WRAPPERS:
            via_xargs = via_xargs or name == "xargs"
            i += 1
            while i < len(toks) and toks[i].startswith("-") and toks[i] != "--":
                i += 2 if toks[i] in WRAPPERS[name] else 1
            if i < len(toks) and toks[i] == "--":
                i += 1
            if name in ("timeout", "gtimeout") and i < len(toks):
                i += 1                         # the DURATION
            continue
        name = re.sub(r"(?i)\.exe$", "", name)
        rest = toks[i + 1:]
        if re.match(r"^(python3?(\.\d+)?|py)$", name, re.I):
            # `python -m graphify ...`, `py -3 -m graphify ...` (Windows without Scripts on
            # PATH) are graphify itself
            k = 0
            while k < len(rest) and re.match(r"^-[0-9.]+$|^-[BEIsSu]+$", rest[k]):
                k += 1
            if rest[k:k + 2] == ["-m", "graphify"]:
                return "graphify", rest[k + 2:], via_xargs
        if name in ("uvx", "pipx") or (name == "uv" and rest[:1] == ["run"]):
            r = rest[1:] if name in ("uv", "pipx") and rest[:1] in (["run"],) else rest
            r = [t for t in r if t not in ("--from", "graphifyy")] if r[:1] == ["--from"] else r
            if r[:1] == ["graphify"]:
                return "graphify", r[1:], via_xargs
        return name, rest, via_xargs
    return None, [], via_xargs


def parse_opts(args, val_opts):
    """(positionals, [(opt, value)]) honouring --, --opt=value, -X value, -Xvalue and
    short clusters like -rne PATTERN."""
    pos, opts, i, end = [], [], 0, False
    while i < len(args):
        a = args[i]
        if end or a == "-" or not a.startswith("-"):
            pos.append(a)
        elif a == "--":
            end = True
        elif a.startswith("--"):
            if "=" in a:
                opts.append(tuple(a.split("=", 1)))
            elif a in val_opts:
                opts.append((a, args[i + 1] if i + 1 < len(args) else ""))
                i += 1
            else:
                opts.append((a, None))
        elif a in val_opts:                    # whole-word options such as -onlyin
            opts.append((a, args[i + 1] if i + 1 < len(args) else ""))
            i += 1
        else:
            for k in range(1, len(a)):
                o = "-" + a[k]
                if o in val_opts:
                    if k + 1 < len(a):
                        opts.append((o, a[k + 1:]))
                    else:
                        opts.append((o, args[i + 1] if i + 1 < len(args) else ""))
                        i += 1
                    break
                opts.append((o, None))
        i += 1
    return pos, opts


def expand(word, env):
    """~, $VAR and ${VAR} from this command's assignments, then the environment;
    None when a variable is unknown."""
    if word is None:
        return None
    if word.startswith("~"):
        word = os.path.expanduser(word)
    unknown = []

    def sub(m):
        k = m.group(1) or m.group(2)
        v = env[k] if k in env else os.environ.get(k)
        if v is None:
            unknown.append(k)
            return ""
        return v
    out = re.sub(r"\$\{(\w+)\}|\$(\w+)", sub, word)
    if unknown:
        return None
    return native(os.path.expanduser(out) if out.startswith("~") else out)


def native(p):
    """Git Bash spells C:\\x as /c/x; native Python on Windows needs C:/x."""
    if IS_WIN and isinstance(p, str):
        m = re.match(r"^/([A-Za-z])(/|$)", p)
        if m:
            return m.group(1).upper() + ":/" + p[m.end():]
    return p


def pattern_variants(raw, env, loops, depth=0):
    """A search pattern with $vars filled in: loop variables give one variant per
    loop word; known variables their value; unknown ones nothing."""
    m = re.search(r"\$\{(\w+)\}|\$(\w+)", raw)
    if not m or depth > 4:
        return [raw]
    k = m.group(1) or m.group(2)
    head, tail = raw[:m.start()], raw[m.end():]
    if k in loops:
        out = []
        for w in (loops[k] or [""])[:24]:
            out += pattern_variants(head + w + tail, env, loops, depth + 1)
        return out
    v = env[k] if k in env else os.environ.get(k)
    return pattern_variants(head + (v or "") + tail, env, loops, depth + 1)


FILE_ARGS = {"0": ["__SUBST__"], "1": ["__SUBST__"], "@": ["__SUBST__"]}


def _short_timeout(toks):
    """True when the command runs under `timeout` with under 2 seconds to live."""
    for k, t in enumerate(toks[:4]):
        if os.path.basename(t) in ("timeout", "gtimeout"):
            j = k + 1
            while j < len(toks) and toks[j].startswith("-"):
                j += 2 if toks[j] in WRAPPERS["timeout"] else 1
            m = re.match(r"^(\d*\.?\d+)s?$", toks[j]) if j < len(toks) else None
            return bool(m) and float(m.group(1)) < 2
    return False


class Seg(object):
    __slots__ = ("exe", "args", "via_xargs", "piped", "here", "env", "loops", "quiet",
                 "stdin_words", "stdin_file", "upstream")

    def __init__(self, exe, args, via_xargs, piped, here, env, loops, quiet=False):
        self.exe, self.args, self.via_xargs, self.piped = exe, args, via_xargs, piped
        self.here, self.env, self.loops, self.quiet = here, env, loops, quiet
        self.stdin_words = []
        self.stdin_file = None                 # `cmd < file`
        self.upstream = None                   # the Seg whose stdout this one reads


_PWD_SUBST = re.compile(r"\$\(\s*pwd\s*\)|`\s*pwd\s*`")


def heredoc_scripts(cmd):
    """[(the command text before <<, body)] for each heredoc in cmd: `bash <<'EOF'` and
    `python3 - <<'EOF'` scripts are code the gate must look into."""
    out = []
    for m in _HEREDOC.finditer(cmd):
        nl = cmd.find("\n", m.end())
        if nl == -1:
            break
        end = re.compile(r"^\s*" + re.escape(m.group(2)) + r"\s*$", re.M).search(cmd, nl + 1)
        body = cmd[nl + 1:end.start() if end else len(cmd)]
        ls = cmd.rfind("\n", 0, m.start()) + 1
        head = re.split(r"\|\||&&|[;|(]", cmd[ls:m.start()])[-1]
        out.append((head, body))
    return out


def _walk(cmd, cwd, env=None, depth=0, loops=None, quiet0=False):
    """Yield a Seg per simple command, following cd/pushd, VAR=value, export, read,
    `for v in WORDS`, and recursing into bash/sh/zsh -c and eval. here=None means the
    working directory is unknown from that point on. quiet0: the whole command runs
    after `||` or with its stdout thrown away (an outer `bash -c '...' >/dev/null`)."""
    env = dict(env or {})
    here, loops, lit = cwd, dict(loops or {}), []

    def place():
        env["PWD"] = here
        env["__GITTOP__"] = _git_top(here) if here else None
    place()
    last, prev = "", None
    cmd = _PWD_SUBST.sub("${PWD}", _GITTOP.sub("${__GITTOP__}", cmd))
    for text, piped, quiet, after_and in split_commands(cmd):
        toks = _tokens(text)
        stdin = [t[len("__STDIN__="):] for t in toks if t.startswith("__STDIN__=")]
        toks = [t for t in toks if not t.startswith("__STDIN__=")]
        # `false && graphify explain X` never runs; `timeout 0.01 graphify ...` is killed
        quiet = (quiet or quiet0 or (after_and and last in ("false", "exit", "return"))
                 or _short_timeout(toks))
        last = toks[0] if toks else ""
        if not toks or (stdin and executable(toks)[0] is None):
            if stdin:                          # `$(<file)`, `done < file`: the file's lines
                seg = Seg("cat", [], False, piped, here, env, loops, quiet)
                seg.stdin_file = stdin[-1]
                prev = seg
                yield seg
            continue
        if all(_ASSIGN.match(t) for t in toks):
            for t in toks:
                k, v = t.split("=", 1)
                env[k] = expand(v, env)
            continue
        exe, args, via_xargs = executable(toks)
        if exe is None:
            continue
        if exe in ("export", "local", "declare", "typeset", "readonly"):
            for a in args:
                if _ASSIGN.match(a):
                    k, v = a.split("=", 1)
                    env[k] = expand(v, env)
            continue
        if exe == "read":
            for a in args:
                if re.match(r"^[A-Za-z_]\w*$", a):
                    env[a] = None
                    loops[a] = ["__SUBST__"]   # lines of a file list, read under here
            continue
        if exe in ("for", "select") and len(args) >= 2 and args[1] == "in":
            loops[args[0]] = args[2:]          # for f in a/*.kt; do grep X "$f"; done
            continue
        if exe in ("cd", "pushd"):
            a = [x for x in args if x == "-" or not x.startswith("-")]
            if not a:
                here = os.path.expanduser("~")
            elif a[0] == "-":
                here = None
            else:
                d = expand(a[0], env)
                if d is None or (here is None and not os.path.isabs(d)):
                    here = None
                else:
                    here = os.path.normpath(os.path.join(here, d))
            place()
            continue
        if exe == "popd":
            here = None
            place()
            continue
        if exe in SHELLS:
            if depth < 3:
                for k, a in enumerate(args[:-1]):
                    if re.match(r"^-\w*c\w*$", a):
                        for s in _walk(args[k + 1], here, env, depth + 1,
                                       FILE_ARGS if via_xargs else None, quiet):
                            yield s
                        break
            continue
        if exe == "eval":
            if depth < 3:
                for s in _walk(" ".join(args), here, env, depth + 1, None, quiet):
                    yield s
            continue
        seg = Seg(exe, args, via_xargs, piped, here, env, loops, quiet)
        seg.stdin_words = lit if piped else []
        seg.stdin_file = stdin[-1] if stdin else None
        seg.upstream = prev if piped else None
        lit = ([a for a in args[1 if exe == "printf" else 0:] if not a.startswith("-")]
               if exe in ("echo", "printf") else [])
        prev = seg
        yield seg
    if depth < 3:
        for head, body in heredoc_scripts(cmd):
            hexe, hargs, _ = executable(_tokens(head))
            if hexe in SHELLS and not any(re.match(r"^-\w*c\w*$", a) for a in hargs):
                for s in _walk(body, cwd, env, depth + 1, None, quiet0):   # bash <<'EOF'
                    yield s
            elif hexe and re.match(r"^(python3?(\.\d+)?|py|node)$", hexe, re.I):
                yield Seg(hexe, ["__SCRIPT__", body], False, False, cwd, env, loops, quiet0)


def _seg_searches(s):
    """[(abs_path, name_globs, patterns)] for the multi-file search one command runs."""
    found = _seg_searches1(s)
    if s.via_xargs and s.stdin_words:          # echo A B | xargs -n1 rg -l: A, B are patterns
        found = [(p, g, pats + s.stdin_words) for p, g, pats in found]
    return found


def _seg_searches1(s):
    exe, args, here, env, loops = s.exe, s.args, s.here, s.env, s.loops
    found = []

    def path(o):
        if o == "__SUBST__":
            return here                         # a file list from a command, under here
        e = expand(o, env)
        if e is None or (here is None and not os.path.isabs(e)):
            return None
        return os.path.normpath(os.path.join(here or "/", e))

    def pats_of(raws):
        out = []
        for r in raws:
            if r:
                out += pattern_variants(r, env, loops)
        return out

    def operands(paths, globs, pats):
        """Files, dirs and shell globs -> targets; <=2 plain files are a read."""
        files, out, words = [], [], []
        for o in paths:
            if o == "{}" and s.via_xargs:
                words.append("__SUBST__")      # xargs -I{} grep -n X {}: the file list
                continue
            m = re.match(r"^\$\{?(\w+|@)\}?$", o)
            for w in (loops[m.group(1)] if m and m.group(1) in loops else [o]):
                words += _braces(w)
        for o in words:
            if "__SUBST__" in o:               # "$(git rev-parse --show-toplevel)/app"
                if here is not None:
                    out.append((here, globs, pats))
                continue
            p = path(o)
            if p is None:
                continue                       # unknown $VAR / dir: cannot tell, let it pass
            if any(c in o for c in "*?["):
                if "**" in o:                  # zsh/globstar recursion: never walk the tree,
                    # judge the literal prefix dir + the name glob (a recursive search)
                    out.append((_glob_base(p, "/"), (globs or []) + [os.path.basename(p)], pats))
                    continue
                import glob as _glob
                import itertools
                hits = list(itertools.islice(_glob.iglob(p), 5000))
                files += [h for h in hits if os.path.isfile(h)]
                out += [(h, globs, pats) for h in hits if os.path.isdir(h)]
            elif os.path.isdir(p):
                out.append((p, globs, pats))
            else:
                files.append(p)
        if out or len(files) > 2:
            out += [(f, globs, pats) for f in files]
        return out

    if exe == "git":
        k, g = 0, here
        while k < len(args) and args[k].startswith("-"):
            if args[k] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace"):
                if args[k] == "-C" and k + 1 < len(args):
                    g = path(args[k + 1])
                k += 1
            k += 1
        if args[k:k + 1] == ["grep"] and g is not None:
            rest = args[k + 1:]
            spec = rest[rest.index("--") + 1:] if "--" in rest else []
            pre = rest[:rest.index("--")] if "--" in rest else rest
            pos, opts = parse_opts(pre, GREP_VAL)
            has_pat = any(o in ("-e", "-f", "--regexp", "--file") for o, _ in opts)
            raw = [v for o, v in opts if o in ("-e", "--regexp") and v] or ([] if has_pat else pos[:1])
            inc = [x for x in spec if not re.match(r"^:(!|\^|\([^)]*exclude[^)]*\))", x)]
            inc = [re.sub(r"^:(\([^)]*\)|/)?", "", x) for x in inc]
            found.append((g, inc or None, pats_of(raw + inc)))
        return found
    if exe == "find":
        k = 0
        while k < len(args) and not args[k].startswith("-") and args[k] not in ("(", "!", "\\("):
            k += 1
        starts, expr = args[:k] or ["."], args[k:]
        names = [expr[j + 1] for j in range(len(expr) - 1) if expr[j] in ("-name", "-iname")]
        other = [expr[j + 1] for j in range(len(expr) - 1)
                 if expr[j] in ("-path", "-ipath", "-regex", "-iregex", "-wholename",
                                "-iwholename")]
        runs_search, sub_pats = False, []
        for j, e in enumerate(expr):
            if e in ("-exec", "-execdir", "-ok", "-okdir") and j + 1 < len(expr):
                sub_exe = os.path.basename(expr[j + 1])
                if sub_exe in SHELLS and j + 3 < len(expr) and re.match(r"^-\w*c\w*$", expr[j + 2]):
                    for st in starts:
                        p = path(st)
                        for sub in (_walk(expr[j + 3], p, env, 1, FILE_ARGS) if p else []):
                            found += _seg_searches1(sub)
                    continue
                if sub_exe in SEARCH_EXES - {"find", "fd", "fdfind"}:
                    runs_search = True
                    tail = expr[j + 2:]
                    stop = next((x for x, t in enumerate(tail) if t in (";", "+")), len(tail))
                    sp, so = parse_opts(tail[:stop], GREP_VAL if sub_exe in GREP_LIKE else RG_VAL)
                    has_pat = any(o in ("-e", "-f", "--regexp", "--file") for o, _ in so)
                    sub_pats += ([v for o, v in so if o in ("-e", "--regexp") and v]
                                 or ([] if has_pat else [x for x in sp[:1] if x != "{}"]))
        if names or other or runs_search:
            for st in starts:
                p = path(st)
                if p:
                    found.append((p, names or None, pats_of(names + other + sub_pats)))
        return found
    if exe in ("fd", "fdfind"):
        k = next((j for j, a in enumerate(args) if a in ("-x", "--exec", "-X", "--exec-batch")),
                 None)
        if k is not None:
            sub = args[k + 1:]
            args = args[:k]
            if sub and os.path.basename(sub[0]) in SEARCH_EXES | set(SCANNERS):
                sub_seg = Seg(os.path.basename(sub[0]), [a for a in sub[1:] if a not in
                              ("{}", "{/}", "{//}", "{.}", "{/.}", ";")], True, False, here,
                              env, loops)
                found += _seg_searches1(sub_seg)
        pos, opts = parse_opts(args, FD_VAL)
        exts = ["*." + v for o, v in opts if o in ("-e", "--extension") and v]
        roots = pos[1:] + [v for o, v in opts if o == "--search-path" and v]
        if s.piped and not roots and not s.via_xargs:
            return found
        for r_ in roots or ["."]:
            p = path(r_)
            if p:
                found.append((p, exts or None, pats_of(pos[:1] + exts)))
        return found
    if exe in ("sg", "ast-grep"):
        a = args[1:] if args[:1] and args[0] in ("run", "scan") else args
        pos, opts = parse_opts(a, SG_VAL)
        raw = [v for o, v in opts if o in ("-p", "--pattern") and v]
        if raw:
            for r_ in pos or ["."]:
                p = path(r_)
                if p:
                    found.append((p, None, pats_of(raw)))
        return found
    if exe == "mdfind":
        pos, opts = parse_opts(args, MDFIND_VAL)
        roots = [v for o, v in opts if o == "-onlyin" and v]
        raw = [v for o, v in opts if o == "-name" and v] + pos[:1]
        for r_ in roots:
            p = path(r_)
            if p:
                found.append((p, None, pats_of(raw)))
        return found
    if exe in SCANNERS:
        pos, opts = parse_opts(args, SCANNERS[exe])
        flags = {o for o, _ in opts}
        if exe in ("sed", "perl") and flags & {"-i", "--in-place"}:
            return found                       # an in-place edit, not a search
        script_given = bool(flags & {"-e", "-E", "-f"})
        files_ = pos if script_given else pos[1:]
        raw = [v for o, v in opts if o in ("-e", "-E") and v] or ([] if script_given else pos[:1])
        if s.via_xargs and not files_:
            if here is not None:
                found.append((here, None, pats_of(raw)))
        elif files_:
            found += operands(files_, None, pats_of(raw))
        return found
    if exe not in SEARCH_EXES:
        return found
    val = GREP_VAL if exe in GREP_LIKE else RG_VAL
    pos, opts = parse_opts(args, val)
    flags = {o for o, _ in opts}
    raw_globs = [v for o, v in opts if o in ("--include", "-g", "--glob", "--iglob") and v
                 and not v.startswith("!")]
    globs = list(raw_globs)
    for o, v in opts:
        if o in ("-t", "--type") and v:
            globs += ["*" + e for e in TYPE_EXTS.get(v, "*").split()]
    has_pattern_opt = bool(flags & {"-e", "-f", "--regexp", "--file"})
    list_files = "--files" in flags or (exe in ("ag", "ack") and "-g" in flags)
    if has_pattern_opt:
        raw = [v for o, v in opts if o in ("-e", "--regexp") and v]
    elif list_files:
        raw = []
    else:
        raw = pos[:1]
    pats = pats_of(raw + raw_globs)
    paths = pos if (has_pattern_opt or list_files) else pos[1:]
    recursive = (exe in RECURSIVE_BY_DEFAULT or bool(flags & {"-r", "-R", "--recursive",
                 "--dereference-recursive", "--include"})
                 or any(o in ("-d", "--directories") and v == "recurse" for o, v in opts))
    if not paths:
        if here is not None and (s.via_xargs or (recursive and not s.piped)):
            found.append((here, globs or None, pats))  # xargs file list / grep -r here
        return found                           # a filter on a pipe, or stdin
    found += operands(paths, globs or None, pats)
    return found


def _seg_graph_call(s):
    """(repo, subcommand, [names]) when this command is a creditable graph query: a
    by-name `graphify explain|affected|path`, or `query` with --seed, that reads the
    repo's own graph (run from its root, or --graph pointing into it)."""
    if s.exe != "graphify" or not s.args or s.args[0] not in QUERY_SUBS:
        return None
    sub, rest = s.args[0], s.args[1:]
    gpath, seeds, k = None, [], 0
    while k < len(rest):
        a = rest[k]
        if a == "--graph" and k + 1 < len(rest):
            gpath = rest[k + 1]
            k += 2
            continue
        if a == "--seed" and k + 1 < len(rest):
            seeds.append(rest[k + 1])
            k += 2
            continue
        if a.startswith("--graph="):
            gpath = a.split("=", 1)[1]
        elif a.startswith("--seed=") and a[7:]:
            seeds.append(a[7:])
        k += 1
    if sub == "query":
        raw = seeds                            # prose asks about no name
    elif sub == "path":
        raw = rest[:2]
    else:
        raw = rest[:1]
    names = []
    for r in raw:
        if r and not r.startswith("-") and "__SUBST__" not in r:
            names += [n.strip() for n in pattern_variants(r, s.env, s.loops)
                      if ONE_NAME.match(n.strip())]
    if not names:
        return None
    if gpath:
        g = expand(gpath, s.env)
        if g is None or (s.here is None and not os.path.isabs(g)):
            return None
        g = os.path.realpath(os.path.join(s.here or "/", g))
        if os.path.basename(os.path.dirname(g)) != "graphify-out":
            return None
        root = os.path.dirname(os.path.dirname(g))
    else:
        if s.here is None:
            return None
        root = os.path.realpath(s.here)
    repo = repo_of(root)
    if not repo or repo[1] != root:
        return None                            # run elsewhere it reads (or makes) another graph
    return (repo, sub, names)


def analyze(cmd, cwd):
    """(searches, graph_calls) of a Bash command, in order. Each search carries how
    many graph calls came before it in the same command."""
    searches, calls = [], []
    for s in _walk(cmd, cwd):
        c = _seg_graph_call(s)
        if c:
            if not s.quiet:                    # `true || graphify ...`, `graphify ... >/dev/null`
                calls.append(c)
            continue
        for p, globs, pats in _seg_searches(s):
            searches.append((p, globs, pats, len(calls)))
    return searches, calls


def graph_calls(cmd, cwd):
    """Creditable graph calls whose answer the agent can have seen: one real answer
    in the output must not credit a `|| graphify explain X` that never ran or a
    `graphify explain X >/dev/null` whose answer was thrown away."""
    return [c for c in (_seg_graph_call(s) for s in _walk(cmd, cwd) if not s.quiet) if c]


def _ext_globs_may_hit(globs, exts):
    for g in globs:
        base = g.rsplit("/", 1)[-1]
        alts = [base]
        m = re.search(r"\{([^}]*)\}", base)
        if m:
            alts = [base[:m.start()] + a + base[m.end():] for a in m.group(1).split(",")]
        for a in alts:
            e = re.search(r"\.[^./*?\[\]]+$", a)
            if not e or e.group(0).lower() in exts:
                return True
    return False


_INDEX = {}


def _label_key(label):
    """A node label as a lookup key: `.render()` -> render, `start()` -> start."""
    return re.sub(r"\(\)$", "", str(label).strip()).lstrip(".#").lower()


def _load_index(graph):
    """{exts, dirs, files, labels} from the repo's graph, cached by graph.json mtime: the
    code extensions, the dirs that hold indexed code, for every indexed code file its most
    connected symbols [[label, location], ...], and for every code label and node id the
    files that define it. Data and docs (JSON, Markdown, ...) never count as code, nor does
    an HTML file the graph found no script in. None when the graph cannot be read or holds
    no code node: then the gate gates nothing (fails open)."""
    if graph in _INDEX:
        return _INDEX[graph]
    res = None
    gj = os.path.join(graph, "graphify-out", "graph.json")
    try:
        mt = os.path.getmtime(gj)
        cache = os.path.join(STATE, "pindex-%s.json" % _sha(graph, 12))
        try:
            with open(cache) as f:
                c = json.load(f)
            if (c.get("v") == 3 and c.get("mtime") == mt and c.get("exts")
                    and isinstance(c.get("files"), dict) and isinstance(c.get("labels"), dict)):
                res = {"exts": set(c["exts"]), "dirs": set(c["dirs"]), "files": c["files"],
                       "labels": c["labels"]}
        except Exception:
            pass
        if res is None:
            with open(gj) as f:
                g = json.load(f)
            g = g if isinstance(g, dict) else {}
            deg = {}
            for e in g.get("links") or g.get("edges") or []:
                if isinstance(e, dict):
                    for k in ("source", "target"):
                        v = e.get(k)
                        if isinstance(v, str):
                            deg[v] = deg.get(v, 0) + 1
            per, labels = {}, {}
            for node in g.get("nodes") or []:
                if not isinstance(node, dict) or node.get("file_type") != "code":
                    continue
                sf = node.get("source_file")
                if not isinstance(sf, str) or not sf:
                    continue
                sf = sf.replace("\\", "/")
                if posixpath.splitext(sf)[1].lower() in DATA_EXTS:
                    continue
                lst = per.setdefault(sf, [])
                label = node.get("label")
                if isinstance(label, str) and label and label not in (sf, posixpath.basename(sf)):
                    lst.append((deg.get(node.get("id"), 0), label,
                                str(node.get("source_location") or "")))
                    for key in (_label_key(label), str(node.get("id") or "").lower()):
                        if key:
                            fl = labels.setdefault(key, [])
                            if sf not in fl:
                                fl.append(sf)
            for sf in [f for f, v in per.items()
                       if not v and posixpath.splitext(f)[1].lower() in MARKUP_EXTS]:
                del per[sf]                    # an HTML page with no script the graph parsed
            exts, dirs = set(), {""}
            for sf in per:
                e = posixpath.splitext(sf)[1].lower()
                if e:
                    exts.add(e)
                d = posixpath.dirname(sf)
                while d and d not in dirs:
                    dirs.add(d)
                    d = posixpath.dirname(d)
            if exts:
                files = {f: [[l, loc] for _, l, loc in sorted(v, key=lambda t: -t[0])[:8]]
                         for f, v in per.items()}
                labels = {k: [f for f in v if f in per] for k, v in labels.items()}
                labels = {k: v for k, v in labels.items() if v}
                res = {"exts": exts, "dirs": dirs, "files": files, "labels": labels}
                try:
                    os.makedirs(STATE, exist_ok=True)
                    tmp = "%s.%d.tmp" % (cache, os.getpid())
                    with open(tmp, "w") as f:
                        json.dump({"v": 3, "mtime": mt, "exts": sorted(exts),
                                   "dirs": sorted(dirs), "files": files, "labels": labels}, f)
                    os.replace(tmp, cache)
                except OSError:
                    pass
    except Exception:
        res = None
    _INDEX[graph] = res
    return res


def code_index(graph):
    """(code extensions, dirs that hold indexed code), or None."""
    idx = _load_index(graph)
    return (idx["exts"], idx["dirs"]) if idx else None


def code_files(graph):
    """{repo-relative path of an indexed code file: [[label, location], ...]}."""
    idx = _load_index(graph)
    return idx["files"] if idx else {}


def _repos_below(d):
    """Graph repos that are direct children of d (rg from ~/projects reaches them)."""
    out = []
    try:
        for n in sorted(os.listdir(d))[:400]:
            ch = os.path.join(d, n)
            if not n.startswith(".") and os.path.exists(os.path.join(ch, ".git")):
                r = repo_of(ch)
                if r and r[0] == os.path.realpath(ch):
                    out.append(r)
    except OSError:
        pass
    return out


def dir_names(graph):
    """Directory names on the paths of indexed code (androidTest, chat, ...), exact case:
    the package dir `addfriend` must not exempt the class AddFriend."""
    idx = code_index(graph)
    if idx is None:
        return set()
    return {part for d in idx[1] for part in d.split("/") if part}


def code_target(p, globs=None):
    """The (work, graph) repo when searching `p` can touch code the graph indexes."""
    try:
        full = os.path.realpath(p)
        repo = repo_of(full)
        if not repo:
            if os.path.isdir(full):
                for r in _repos_below(full):
                    if code_target(r[0], globs):
                        return r
            return None
        rel = os.path.relpath(full, repo[0])
        rel = "" if rel == "." else rel
        if rel.startswith(".."):
            return None
        rel = rel.replace(os.sep, "/")         # the graph's paths use / on Windows too
        if set(rel.split("/")) & NEVER_CODE_PARTS:
            return None
        idx = code_index(repo[1])
        if idx is None:
            return None                        # unreadable graph: nothing can be asked, gate nothing
        exts, dirs = idx
        if os.path.isfile(full):
            return repo if os.path.splitext(full)[1].lower() in exts else None
        if rel not in dirs:          # res/, docs/, assets/, build/, scratch: no indexed code
            return None
        if globs and not _ext_globs_may_hit(globs, exts):
            return None
        return repo
    except Exception:
        return None


def _glob_base(pattern, base):
    """The directory a Glob pattern starts in - absolute patterns start where their
    literal prefix ends, not in cwd."""
    full = os.path.normpath(pattern if os.path.isabs(pattern) else os.path.join(base, pattern))
    lit = []
    for part in full.split(os.sep):
        if any(c in part for c in "*?[{"):
            break
        lit.append(part)
    return os.sep.join(lit) or os.sep


# --------------------------------------------------------- names and asking

RES_TOKEN = re.compile(r"\bR\.(?:string|plurals|array|drawable|mipmap|color|dimen|raw|font|style|"
                       r"id|xml|anim|layout|integer|bool)\.\w+|@\+?(?:string|drawable|color|dimen|"
                       r"style|id|layout|mipmap)/\w+")
HEX_LITERAL = re.compile(r"(?<![A-Za-z0-9_])0[xX][0-9A-Fa-f_]+[uUlL]*")
QUOTED_LITERAL = re.compile(r'"[^"\n?*+|()]*"')     # a literal, not regex around a name
CAMEL = re.compile(r"[a-z0-9][A-Z]|[A-Z]{2}[a-z]{2}")
HEX_WORD = re.compile(r"^[0-9A-Fa-f]*[0-9][0-9A-Fa-f]*$")


def code_idents(patterns):
    """camelCase / PascalCase identifiers in search patterns - the names the graph can
    answer about (Dvf1Test, UIKit and _uiState too). snake_case keys, ALLCAPS, plain
    words and literals - "quoted keys", 0xFFF5F5F7, R.string.x - give none."""
    found = []
    for p in patterns:
        if not isinstance(p, str):
            continue
        p = re.sub(r'\\([."/@])', r"\1", p)      # R\.string\.x, \"key\" -> plain text
        p = RES_TOKEN.sub(" ", p)                  # resource refs are no graph edges
        p = QUOTED_LITERAL.sub(" ", p)             # "isLast", "v1/x/{challengeId}"
        p = HEX_LITERAL.sub(" ", p)                # Color(0xFFF5F5F7)
        p = re.sub(r"\\[A-Za-z]", " ", p)
        for tok in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", p):
            tok = tok.lstrip("_")                  # _uiState backs uiState
            if len(tok) >= 4 and "_" not in tok and CAMEL.search(tok) and re.search("[a-z]", tok) \
                    and not HEX_WORD.match(tok) and tok not in found:
                found.append(tok)               # not E88E5 (#1E88E5) or A1B2C3
    return found


def name_keys(name):
    """Lower-cased lookup keys of one asked name: MessageRow() -> messagerow,
    Foo.bar -> foo, bar; a file path -> its stem (directories name no symbol)."""
    n = str(name).strip().strip("\"'`").strip()
    n = re.sub(r"\(.*$", "", n)
    if "::" in n:                              # path::.method() names the method
        n = n.rsplit("::", 1)[-1]
    ext = r"\.(kts?|java|py|swift|[cm]?[jt]sx?|go|rs|html?|json|vue|svelte|rb|php|cs|cpp|c|h)$"
    out = set()
    stem = re.sub(ext, "", n.rstrip("/").replace("\\", "/").rsplit("/", 1)[-1], flags=re.I)
    stem = stem.lstrip(".#_")
    if stem:                                   # clock.test.mjs -> clock.test (a file's stem)
        out.add(stem.lower())
    if "/" in n:                               # app/.../ChatRoomScreen.kt -> ChatRoomScreen
        n = stem
    for part in re.split(r"[.#:/\\\s]+", n):
        if part:
            out.add(part.lower())
    return out


def _covers(key, ident):
    """Does asking about `key` cover a search for (or a change to) `ident`? Directional:
      * the same name;
      * a part of the asked name (MessageR after MessageRow; MessageRow and
        ChatRoomBubbles after ChatRoomBubbles.kt::MessageRow() or a full node id);
      * an asked compound name of 8+ letters that the ident extends, by at most its own
        length (ChatRepository -> ChatRepositoryImpl, MessageRow -> MessageRowPreview).
    NOT the reverse: asking about a short or generic word (Venue, Screen, State) must not
    unlock every longer name that contains it (64 / 51 camelCase labels for screen /
    state in osh-bor-android), and ChatRoom does not unlock ChatRoomPollController."""
    return (key == ident or (len(ident) >= 5 and ident in key)
            or (len(key) >= 8 and ident.startswith(key) and 2 * len(key) >= len(ident)))


def matches(ident, keys):
    i = ident.lower()
    return any(_covers(k, i) for k in keys)


def read_log(path, since=0.0):
    out = []
    try:
        with open(path) as f:
            for line in f:
                parts = line.rstrip("\n").split("\t", 3)
                if len(parts) == 4:
                    try:
                        ts = float(parts[0])
                    except ValueError:
                        continue
                    if ts >= since:
                        out.append((ts, parts[1], parts[2], parts[3]))
    except OSError:
        pass
    return out


def asked_keys(payload, graph):
    keys = set()
    for _, _, _, n in read_log(agent_marker(payload, graph, "asked"), time.time() - TTL):
        keys |= name_keys(n)
    return keys


def can_record(payload, graph):
    """Probe: would a graph query by this agent be recorded? If not (read-only or full
    state dir), the gate must not deny - nothing could ever unlock it."""
    try:
        with open(agent_marker(payload, graph, "asked"), "a"):
            pass
        return True
    except OSError:
        return False


def record(payload, repo, sub, names, what):
    graph = repo[1]
    now = time.time()
    agent = _safe(payload.get("agent_id"), "main")
    lines = "".join("%.3f\t%s\t%s\t%s\n" % (now, agent, sub,
                                            re.sub(r"[\t\n]", " ", n)[:200]) for n in names)
    with open(agent_marker(payload, graph, "asked"), "a") as f:
        f.write(lines)
    if sub in NAME_SUBS or sub in MCP_IMPACT_TOOLS:
        with open(session_marker(payload, graph, "impact"), "a") as f:
            f.write(lines)
    log_usage(repo[0], payload, "ASKED %s %s | %s" % (sub, ",".join(names)[:80], what))


# ---------------------------------------------------------------- watcher

def watch_name(root):
    real = os.path.realpath(root)
    return "%s-%s" % (os.path.basename(real), _sha(real, 8))


def _lock(path):
    """A non-blocking exclusive lock, held while the returned handle stays open; None when
    another process holds it or locking is impossible."""
    try:
        f = open(path, "a+")
    except OSError:
        return None
    try:
        if IS_WIN:
            import msvcrt
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return f
    except (OSError, ImportError):
        f.close()
        return None


def _spawn_detached(argv, cwd, out):
    """Start argv so it outlives this hook: its own session on POSIX, a detached process
    group without a console window on Windows."""
    import subprocess
    kw = dict(cwd=cwd, stdout=out, stderr=out, stdin=subprocess.DEVNULL)
    if not IS_WIN:
        return subprocess.Popen(argv, start_new_session=True, **kw)
    # NEW_PROCESS_GROUP | NO_WINDOW: a hidden console of its own that graphify.EXE's python
    # child inherits (DETACHED_PROCESS would cancel NO_WINDOW and the child would open a
    # visible console window)
    flags = 0x00000200 | 0x08000000
    try:
        return subprocess.Popen(argv, creationflags=flags | 0x01000000, **kw)  # + BREAKAWAY
    except OSError:
        return subprocess.Popen(argv, creationflags=flags, **kw)


def _win_pid_alive(pid):
    """Is pid a live graphify/python process? (A reused pid of another program is not.)"""
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x1000, False, int(pid))     # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        try:
            code = ctypes.c_ulong()
            if not k.GetExitCodeProcess(h, ctypes.byref(code)):
                return True
            if code.value != 259:                      # STILL_ACTIVE
                return False
            buf = ctypes.create_unicode_buffer(1024)
            size = ctypes.c_ulong(1024)
            if k.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
                exe = os.path.basename(buf.value).lower()
                return "graphify" in exe or "python" in exe or exe in ("py.exe", "uv.exe")
            return True
        finally:
            k.CloseHandle(h)
    except Exception:
        return True


def _pidfile_alive(root):
    """The watcher this gate started (its pid file), when the process list cannot tell."""
    try:
        with open(os.path.join(WATCH_DIR, "%s.pid" % watch_name(root))) as f:
            pid = int(f.read().strip())
    except (OSError, ValueError):
        return False
    if IS_WIN:
        return _win_pid_alive(pid)
    try:
        os.kill(pid, 0)                                # POSIX: signal 0 only probes
        return True
    except OSError as e:
        import errno
        return e.errno == errno.EPERM


def watcher_alive(root):
    """True when a `graphify watch` process watches root. POSIX: ANY such process, whoever
    started it and from whatever cwd; unknown (ps/lsof missing or slow) counts as alive - a
    missed refresh is cheap, a duplicate watcher per prompt is not. Windows: the process
    whose pid the gate recorded when it started the watcher."""
    import subprocess
    real = os.path.realpath(root)
    if IS_WIN:
        return _pidfile_alive(root)
    try:
        r = subprocess.run(["ps", "-axo", "pid=,command="], capture_output=True,
                           encoding="utf-8", errors="replace", timeout=2)
    except subprocess.TimeoutExpired:
        return True
    except Exception:
        return _pidfile_alive(root)            # no ps (minimal Linux images)
    if r.returncode != 0 or not r.stdout.strip():
        return _pidfile_alive(root)            # BusyBox ps takes no -axo
    ps = r.stdout
    for line in ps.splitlines():
        pid, _, cmd = line.strip().partition(" ")
        if not re.search(r"graphify(\.watch|\S*\s+watch)\b", cmd):
            continue
        args = cmd.split()
        if not args or os.path.basename(args[0]) in ("grep", "pgrep", "rg", "ugrep"):
            continue
        if any(os.path.realpath(a) == real for a in args if a.startswith("/")):
            return True
        try:
            cwd = subprocess.run(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"],
                                 capture_output=True, encoding="utf-8", errors="replace",
                                 timeout=2).stdout
        except Exception:
            return True
        if ("n" + real) in cwd.splitlines():
            return True
    return False


def start_watcher(root):
    """Start `graphify watch <root>` unless one runs; locked so concurrent sessions start
    one between them. True when this call started it."""
    if os.environ.get("GRAPH_GATE_NO_WATCH", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    os.makedirs(WATCH_DIR, exist_ok=True)
    name = watch_name(root)
    lk = _lock(os.path.join(WATCH_DIR, "%s.lock" % name))
    if lk is None:
        return False                           # another session is checking/starting it
    try:
        if watcher_alive(root):
            return False
        with open(os.path.join(WATCH_DIR, "%s.log" % name), "ab") as log:
            p = _spawn_detached([graphify_bin(), "watch", os.path.realpath(root)], root, log)
        with open(os.path.join(WATCH_DIR, "%s.pid" % name), "w") as f:
            f.write(str(p.pid))
        return True
    finally:
        lk.close()


def graph_commit(root):
    gj = os.path.join(root, "graphify-out", "graph.json")
    pat = re.compile(r'"built_at_commit"\s*:\s*"([0-9a-f]{7,40})"')
    try:
        with open(gj, "rb") as f:                # the key is written last: read the tail
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 8192))
            m = pat.search(f.read().decode("utf-8", "replace"))
        if m:
            return m.group(1)
        with open(gj, "rb") as f:
            m = pat.search(f.read(65536).decode("utf-8", "replace"))
        return m.group(1) if m else None
    except Exception:
        return None


def head_commit(root):
    import subprocess
    try:
        out = subprocess.run(["git", "-C", root, "rev-parse", "HEAD"], capture_output=True,
                             encoding="utf-8", errors="replace", timeout=3)
        return out.stdout.strip() if out.returncode == 0 else None
    except Exception:
        return None


def ensure_fresh(graph):
    """Start the watcher if none runs; refresh a graph built at another commit."""
    import subprocess
    notes = []
    try:
        if not watcher_alive(graph) and start_watcher(graph):
            notes.append("started `graphify watch` (log: ~/.cache/graphify-watch/%s.log)"
                         % watch_name(graph))
    except Exception as e:
        notes.append("could not start the watcher: %s" % e)
    built, head = graph_commit(graph), head_commit(graph)
    # A committed graph is built at the commit before the one that carries it, and graphify
    # leaves an unchanged graph unwritten - so only code changed since `built` makes it stale.
    if built and head and built != head and code_changed_since(graph, built):
        try:
            if start_update(graph, head):
                notes.append("graph was built at %s and code changed since: `graphify update .` "
                             "started in the background (~10 s)" % built[:7])
        except Exception:
            pass
    return notes


def code_changed_since(graph, commit):
    """True when source the graph indexes differs between `commit` and HEAD (or the
    answer is unknown)."""
    import subprocess
    try:
        r = subprocess.run(["git", "-C", graph, "diff", "--quiet", commit, "HEAD", "--"]
                           + specs_for(graph), capture_output=True, timeout=10)
        return r.returncode != 0
    except Exception:
        return True


def start_update(graph, head):
    """One background `graphify update .` per repo and HEAD, however many sessions start
    at once: `graphify update` waits for graphify's rebuild lock, so N concurrent starts
    would run N full rebuilds back to back. True when this call started it."""
    import subprocess
    if os.environ.get("GRAPH_GATE_NO_UPDATE", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    os.makedirs(WATCH_DIR, exist_ok=True)
    name = watch_name(graph)
    stamp = os.path.join(WATCH_DIR, "%s.update" % name)
    lk = _lock(os.path.join(WATCH_DIR, "%s.update.lock" % name))
    if lk is None:
        return False                           # another session is starting it right now
    try:
        try:
            with open(stamp) as f:
                if f.read().strip() == head and time.time() - os.path.getmtime(stamp) < 900:
                    return False               # already started for this HEAD
        except OSError:
            pass
        _spawn_detached([graphify_bin(), "update", "."], graph, subprocess.DEVNULL)
        with open(stamp, "w") as f:
            f.write(head)
        return True
    finally:
        lk.close()


def prune_state():
    cutoff = time.time() - PRUNE_AGE
    hand = os.path.join(MACHINE_STATE, "markers")
    for d in (MARKERS, STATE, hand):
        try:
            names = os.listdir(d)
        except OSError:
            continue
        for n in names:
            if d == STATE and not n.startswith(("index-", "pindex-")):
                continue
            if d == hand and not n.endswith(".projectgates"):
                continue                       # the machine-wide gate's own markers
            p = os.path.join(d, n)
            try:
                if os.path.isfile(p) and os.path.getmtime(p) < cutoff:
                    os.remove(p)
            except OSError:
                pass
    for n in ("usage.log", "debug.log"):
        p = os.path.join(STATE, n)
        try:
            if os.path.getsize(p) > LOG_MAX:
                os.replace(p, p + ".1")
        except OSError:
            pass
    # A watcher appends to its log (O_APPEND) for as long as it runs; renaming would
    # leave it writing to the old inode, so keep the tail and truncate in place.
    try:
        logs = [n for n in os.listdir(WATCH_DIR) if n.endswith(".log")]
    except OSError:
        logs = []
    for n in logs:
        p = os.path.join(WATCH_DIR, n)
        try:
            if os.path.getsize(p) > LOG_MAX:
                with open(p, "r+b") as f:
                    f.seek(-LOG_MAX // 10, 2)
                    tail = f.read()
                    f.seek(0)
                    f.truncate()
                    f.write(tail)
        except OSError:
            pass


# ------------------------------------------------------------ turn diff

def specs_for(graph):
    idx = code_index(graph)
    exts = set(idx[0]) if idx else {s[1:] for s in DIFF_SPECS}
    specs = ["*" + e for e in sorted((exts | CODE_EXTS) - DATA_EXTS)]
    return specs + [":(exclude,glob)graphify-out/**", ":(exclude,glob).*/**",
                    ":(exclude,glob)**/node_modules/**"]


def turn_state(work, base, specs, unread=None):
    """{line-hash: (file, '+text' | '-text', hunk context)} for the source diff of the
    work tree against the turn's start commit, plus every line of untracked source
    files. The hunk context is git's funcname line (`fun ChatRoomScreen(...) {`), the
    declaration that encloses a body-only change. Hashing content (not --stat) sees a
    re-edit of an already-dirty line; diffing against the START commit means a
    commit-only turn changes nothing. Untracked files skipped for the read budget go
    into `unread` (their lines are not "gone"). None on error."""
    import hashlib
    import subprocess
    git = ["git", "-C", work, "-c", "core.quotepath=off"]
    d = subprocess.run(git + ["diff", "--no-color", "--no-ext-diff", "--no-renames", "-U0",
                              "--src-prefix=a/", "--dst-prefix=b/", base, "--"] + specs,
                       capture_output=True, encoding="utf-8", errors="replace", timeout=10)
    if d.returncode != 0:
        return None
    u = subprocess.run(git + ["ls-files", "--others", "--exclude-standard", "-z", "--"] + specs,
                       capture_output=True, encoding="utf-8", errors="replace", timeout=10)
    if u.returncode != 0:
        return None

    def h(path, line):
        return hashlib.sha1((path + "\0" + line).encode("utf-8", "replace")).hexdigest()[:12]

    lines, cur, minus, in_hunk, ctx, newln, src = {}, "", None, False, "", 0, {}

    def enclosing(path, pos, hunk_ctx):
        """git's funcname line, or for JavaScript/TypeScript (where git's default driver
        only sees column-0 lines such as `export class X {`) the method or function
        around the change, as `function name(` so DECL reads it."""
        if posixpath.splitext(path)[1].lower() not in JS_LIKE:
            return hunk_ctx
        if path not in src:
            try:
                with open(os.path.join(work, path)) as f:
                    src[path] = f.read(2000000).splitlines()
            except OSError:
                src[path] = []
        name = _js_enclosing(src[path], pos - 1)
        return ("function %s(" % name) if name else hunk_ctx

    for l in d.stdout.splitlines():
        if l.startswith("diff --git "):
            in_hunk, minus = False, None
            continue
        if not in_hunk:
            if l.startswith("--- "):
                minus = l[6:].strip('"') if l.startswith("--- a/") else None
            elif l.startswith("+++ "):
                cur = (l[6:].strip('"') if l.startswith("+++ b/") else None) or minus or cur
            elif l.startswith("@@"):
                in_hunk, ctx = True, l.split("@@", 2)[-1].strip()
                m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)", l)
                newln = int(m.group(1)) if m else 0
            continue
        if l.startswith("@@"):
            ctx = l.split("@@", 2)[-1].strip()
            m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)", l)
            newln = int(m.group(1)) if m else 0
            continue
        if l and l[0] == "+":
            lines[h(cur, l)] = (cur, l, enclosing(cur, newln, ctx))
            newln += 1
        elif l and l[0] == "-":
            lines[h(cur, l)] = (cur, l, enclosing(cur, max(newln, 1), ctx))
    budget = 3000000
    untracked = [x for x in u.stdout.split("\0") if x]
    untracked.sort(key=lambda x: posixpath.splitext(x)[1].lower() not in CODE_EXTS)  # code first
    for path in untracked:
        if budget <= 0:
            if unread is not None:
                unread.add(path)
            continue
        try:
            with open(os.path.join(work, path), errors="replace") as f:
                text = f.read(300000)
        except OSError:
            continue
        budget -= len(text)
        for l in text.splitlines():
            lines[h(path, "+" + l)] = (path, "+" + l, "")
    return lines


JS_LIKE = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts"}
_JS_DEF = re.compile(
    r"^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?"
    r"(?:function\s*\*?\s*([A-Za-z_$][\w$]*)"
    r"|\*?\s*#?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{"
    r"|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?"
    r"(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))")
_JS_NOT_NAMES = {"if", "for", "while", "switch", "catch", "with", "return", "function", "else",
                 "do", "try", "new", "typeof", "await", "super", "constructor"}


def _js_enclosing(lines, idx):
    """The name of the JavaScript function or method whose body holds line idx (0-based),
    found by scanning up for a definition indented less than that line."""
    if not lines:
        return None
    idx = min(max(idx, 0), len(lines) - 1)
    cur = lines[idx]
    ci = len(cur) - len(cur.lstrip()) if cur.strip() else 10 ** 6
    for j in range(idx, max(-1, idx - 600), -1):
        m = _JS_DEF.match(lines[j])
        if not m:
            continue
        name = m.group(2) or m.group(3) or m.group(4)
        if not name or name in _JS_NOT_NAMES:
            continue
        if j == idx or len(m.group(1)) < ci:
            return name
    return None


# --------------------------------------------------------------- handlers

def on_session_start(payload, repo):
    announce(payload)
    notes = ensure_fresh(repo[1]) + ensure_git_setup(repo[0])   # prune_state(): in main()
    if not graphify_available():
        notes.insert(0, "graphify is NOT on PATH here, so no agent can query the graph and "
                        "the gate does not block searches or reads until it is (pipx/uv "
                        "install graphifyy, or put its Scripts/bin directory on PATH)")
    ctx = protocol(repo)
    if notes:
        ctx += "\nGraph upkeep this session: " + "; ".join(notes) + "."
    emit({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": ctx}})


def on_subagent_start(payload, repo):
    announce(payload)
    emit({"hookSpecificOutput": {"hookEventName": "SubagentStart",
                                 "additionalContext": protocol(repo)}})


def _turn_file(payload):
    return mpath("%s.turn" % _safe(payload.get("session_id"), "nosession"))


def new_turn(payload):
    """Stamp a new turn for the session. The session's cwd can move between repos and
    the workspace (cd persists in the main agent), so a snapshot or block written in an
    older turn for some repo must never be judged as this turn's."""
    tid = "%.6f" % time.time()
    try:
        p = _turn_file(payload)
        tmp = "%s.%d.tmp" % (p, os.getpid())
        with open(tmp, "w") as f:
            f.write(tid)
        os.replace(tmp, p)
    except OSError:
        pass
    return tid


def current_turn(payload):
    try:
        with open(_turn_file(payload)) as f:
            return f.read().strip()
    except OSError:
        return None


def snapshot_turn(payload, repo, tid):
    work, graph = repo
    try:
        try:
            os.remove(session_marker(payload, work, "turnstart"))  # never judge by a stale one
        except OSError:
            pass
        head = head_commit(work)
        if head:
            lines = turn_state(work, head, specs_for(graph))
            if lines is not None:
                path = session_marker(payload, work, "turnstart")
                tmp = "%s.%d.tmp" % (path, os.getpid())
                by_file, decl = {}, {}
                for k, v in lines.items():
                    by_file.setdefault(v[0], []).append(k)
                    if DECL.search(v[1]):
                        decl[k] = v[1]
                with open(tmp, "w") as f:
                    json.dump({"base": head, "turn": tid, "files": by_file, "decl": decl}, f)
                os.replace(tmp, path)
    except Exception:
        pass
    try:
        os.remove(session_marker(payload, work, "stopblocked"))   # a new turn may block again
    except OSError:
        pass


def on_prompt(payload, repo):
    work, graph = repo
    announce(payload)
    snapshot_turn(payload, repo, new_turn(payload))
    try:
        if not watcher_alive(graph):
            start_watcher(graph)               # re-checks under a lock
    except Exception:
        pass
    emit({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext":
          "Graph gate active in %s (project hook): ask the graph about a symbol BY NAME "
          "before you search for it (cd %s && graphify explain/affected/path \"<Name>\", or "
          "mcp__graphify__get_node/get_neighbors); let a graph answer name a source file before "
          "you read it; subagents leave `graphify update` to the main agent; run `graphify "
          "affected` on what you changed before you finish - or delegate to graph-scout."
          % (os.path.basename(work), shq(disp(graph)))}})


def deny(reason):
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                 "permissionDecisionReason": reason}})


def allow_with(new_input, why):
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow",
                                 "permissionDecisionReason": why, "updatedInput": new_input}})


_GRAPHIFY_ON_PATH = []


def graphify_available():
    """Can an agent run graphify by name here? Without it no ask or answer can ever lift a
    deny, so the gate stands aside (fails open) and SessionStart says why."""
    if not _GRAPHIFY_ON_PATH:
        import shutil
        gb = os.environ.get("GRAPHIFY_BIN")
        _GRAPHIFY_ON_PATH.append(bool(shutil.which("graphify")
                                      or (gb and os.path.isfile(gb))))
    return _GRAPHIFY_ON_PATH[0]


_AGENT_TOOLS = {}
NO_SHELL_BUILTINS = {"statusline-setup"}       # built-in agent types without Bash


def agent_can_query(payload):
    """Can this agent ask the graph itself (Bash, PowerShell or a graphify MCP tool)? False
    only for a subagent whose definition lists its tools and none of those; an agent with
    no tools: line inherits them all."""
    at = _str(payload.get("agent_type"))
    if not _str(payload.get("agent_id")) or not at:
        return True
    if at in _AGENT_TOOLS:
        return _AGENT_TOOLS[at]
    if at in NO_SHELL_BUILTINS:
        _AGENT_TOOLS[at] = False
        return False
    name = at.split(":")[-1]
    dirs = [os.path.join(PROJECT_ROOT, ".claude", "agents"),
            os.path.expanduser("~/.claude/agents")]
    try:
        import glob as _glob
        dirs += _glob.glob(os.path.expanduser("~/.claude/plugins/cache/*/*/*/agents"))
        dirs += _glob.glob(os.path.expanduser("~/.claude/plugins/cache/*/*/agents"))
    except Exception:
        pass
    ok = True
    for d in dirs:
        p = os.path.join(d, name + ".md")
        try:
            with open(p) as f:
                head = f.read(4000)
        except OSError:
            continue
        m = re.match(r"^---\s*\n(.*?)\n---", head, re.S)
        if not m:
            break
        t = re.search(r"^tools:\s*(.*(?:\n[ \t]+-.*)*)", m.group(1), re.M)
        if t:
            tools = re.findall(r"[\w*:.\-]+", t.group(1).replace("tools:", ""))
            ok = any(x in ("Bash", "PowerShell", "*") or x.startswith("mcp__graphify")
                     for x in tools)
        break
    _AGENT_TOOLS[at] = ok
    return ok


def graph_answer(graph, name):
    """`graphify explain <name>` run by the gate itself, for an agent that cannot run it."""
    import subprocess
    try:
        r = subprocess.run([graphify_bin(), "explain", name], cwd=graph, capture_output=True,
                           encoding="utf-8", errors="replace", timeout=6,
                           stdin=subprocess.DEVNULL)
        return (r.stdout or r.stderr or "").strip()
    except Exception:
        return ""


def _strip_base(pattern, base):
    """A Glob/Grep glob without the literal directory prefix it starts with, so folder
    names on the way to the repo (OneDrive, GitHub) are not read as symbols."""
    pat = pattern.replace("\\", "/")
    b = base.replace("\\", "/").rstrip("/")
    if b and pat.startswith(b + "/"):
        return pat[len(b) + 1:]
    return pat


def on_pre(payload):
    tool = _str(payload.get("tool_name"))
    ti = tool_input(payload)
    cwd = cwd_of(payload)
    subagent = bool(_str(payload.get("agent_id")))

    if tool.startswith("mcp__graphify__"):
        # Without project_path the server reads whatever graph it was started with: point
        # it at this repo. A project_path with no graph of its own (a linked worktree, a
        # subdirectory of the repo) would make the server fail: point it at the graph
        # that covers it. Another repo's graph root is left alone.
        pp = _str(ti.get("project_path"))
        if pp:
            real = os.path.realpath(native(os.path.expanduser(pp)))
            if os.path.isfile(os.path.join(real, "graphify-out", "graph.json")):
                return
            repo = repo_of(real)
        else:
            repo = repo_of(cwd)
        if repo:
            new = dict(ti)
            new["project_path"] = repo[1]
            allow_with(new, "project_path=%s" % repo[1])
        return

    searches, calls, reads, writes, what = [], [], [], [], ""
    if tool == "Read":
        fp = _str(ti.get("file_path"))
        if not fp:
            return
        reads.append((os.path.join(cwd, os.path.expanduser(native(fp))), frozenset()))
        what = "Read %s" % fp
    elif tool == "Grep":
        pat = _str(ti.get("pattern"))
        g = _str(ti.get("glob"))
        p = os.path.join(cwd, os.path.expanduser(native(_str(ti.get("path")) or cwd)))
        globs = [g] if g else []
        if _str(ti.get("type")):
            globs += ["*" + e for e in TYPE_EXTS.get(ti["type"], "*").split()]
        if g.startswith("!"):
            globs = globs[1:]                  # a negative glob limits nothing to code
        gpat = _strip_base(g, p) if g else ""
        content = _str(ti.get("output_mode")) == "content"
        if os.path.isfile(p):
            if content:
                reads.append((p, frozenset()))  # lines of one file: a read of it
            if g:
                searches.append((p, globs or None, [pat, gpat], 0))
        else:
            searches.append((p, globs or None, [pat] + ([gpat] if g else []), 0))
            if content and os.path.isdir(p):
                narrowed = indexed_under(p, [gpat] if g and not g.startswith("!") else None)
                if pat in MATCH_ALL:           # every line of every file below
                    reads += [(f, frozenset()) for f in narrowed]
                elif g and 0 < len(narrowed) <= 2 and not any(c in gpat for c in "*?["):
                    reads += [(f, frozenset()) for f in narrowed]   # glob names one file
        what = "Grep %r" % pat
    elif tool == "Glob":
        pat = _str(ti.get("pattern"))
        base = os.path.join(cwd, os.path.expanduser(native(_str(ti.get("path")) or cwd)))
        start = _glob_base(os.path.expanduser(native(pat)), base)
        rel = _strip_base(os.path.expanduser(native(pat)), start)
        searches.append((start, [rel], [rel], 0))
        what = "Glob %r" % pat
    elif tool in ("Bash", "PowerShell"):
        cmd = _str(ti.get("command"))
        if tool == "PowerShell":
            cmd = powershell_as_sh(cmd)
        searches, calls, reads, writes = analyze_full(cmd, cwd)
        what = cmd.strip().splitlines()[0][:120] if cmd.strip() else ""
    else:
        return

    # 1. graph rebuilds and config rewrites
    for sub, everyone, repo in writes:
        if not repo:
            continue
        if everyone:
            log_usage(repo[0], payload, "DENIED graphify %s" % sub)
            deny("Graph gate: `graphify %s` is blocked in this repo. Its Graphify hooks are the "
                 "project graph gate in .claude/hooks/graph-gate (wired in .claude/settings.json), "
                 "which replaces graphify's own hook-guard: `graphify claude install` would add "
                 "machine-specific hook-guard hooks to the committed settings, and `graphify "
                 "uninstall` (with --purge) removes the hooks and can delete graphify-out/. If "
                 "the user really wants this, they can run it in their own terminal." % sub)
            return
        if subagent:
            log_usage(repo[0], payload, "DENIED subagent graphify %s" % sub)
            deny("Graph gate: subagents do not run `graphify %s`. Concurrent rebuilds of "
                 "graphify-out/graph.json collide, so the main session owns the graph: its "
                 "`graphify watch` re-extracts files within seconds of a save, and the main "
                 "agent runs `graphify update .` once between stages. Carry on with the graph "
                 "as it is (confirm anything new with grep/Read) and say in your report that "
                 "the graph needs an update." % sub)
            return

    if not graphify_available():
        return                                 # nothing could ever lift a deny: fail open

    # 2. searches for names this agent has not asked the graph about
    missing_by_graph, repos, asked_cache = {}, {}, {}
    for p, globs, pats, ncalls in searches:
        idents = code_idents(pats)
        if not idents:
            continue                           # literals, string keys, extension globs
        repo = code_target(p, globs)
        if not repo:
            continue
        graph = repo[1]
        places = dir_names(graph) | {x for x in re.split(r"[\\/]", repo[0]) if x}
        idents = [i for i in idents if i not in places]
        if not idents:
            continue                           # -g 'brain-system/src/sim/**': a place, not a name
        if graph not in asked_cache:
            asked_cache[graph] = asked_keys(payload, graph)
        asked = set(asked_cache[graph])
        for crepo, _, names in calls[:ncalls]:   # asked earlier in this same command
            if crepo[1] == graph:
                for n in names:
                    asked |= name_keys(n)
        for i in idents:
            if not matches(i, asked):
                lst = missing_by_graph.setdefault(graph, [])
                if i not in lst:
                    lst.append(i)
                repos[graph] = repo

    # 3. reads of indexed source files no graph answer has shown this agent
    unread, loc_cache = {}, {}
    for p, keys in reads:
        t = read_target(p)
        if not t:
            continue
        repo, rel = t
        if keys and re.sub(r"\.[^./]+$", "", posixpath.basename(rel)).lower() in keys:
            continue                           # asked about this file earlier in the command
        graph = repo[1]
        if graph not in loc_cache:
            loc_cache[graph] = located(payload, graph)
        if rel in loc_cache[graph]:
            continue
        lst = unread.setdefault(graph, [])
        if rel not in lst:
            lst.append(rel)
        repos[graph] = repo

    if not missing_by_graph and not unread:
        return
    if not all(can_record(payload, g) for g in set(missing_by_graph) | set(unread)):
        return                                 # unwritable state: a deny could never lift
    if not agent_can_query(payload):
        # No Bash and no graphify MCP tool: the agent cannot ask, so the gate asks for it -
        # this deny carries the graph's answer, which counts; the retry goes through.
        msgs = []
        for graph, missing in missing_by_graph.items():
            ans = [graph_answer(graph, m) for m in missing[:4]]
            record(payload, repos[graph], "explain", missing, "asked by the gate")
            msgs.append("- SEARCH for %s - the graph's answer:\n%s"
                        % (", ".join(missing), "\n".join(a[:1200] for a in ans if a)))
        for graph, rels in unread.items():
            record_located(payload, repos[graph], "", "gate", files=rels)
            msgs.append(read_deny_text(graph, rels).split("  `graphify explain")[0].rstrip())
        log_usage(PROJECT_ROOT, payload, "DENIED-ONCE %s (agent without graph tools)" % what)
        deny("Graph gate: this agent has no Bash or graphify MCP tool, so the gate looked the "
             "graph up for it - use what the graph says below, then retry the same call (it "
             "will go through) and read only the lines the graph points to.\n%s" % "\n".join(msgs))
        return
    msgs = []
    for graph, missing in missing_by_graph.items():
        log_usage(repos[graph][0], payload, "DENIED %s (not asked: %s)" % (what, ",".join(missing)))
        msgs.append(search_deny_text(graph, missing))
    for graph, rels in unread.items():
        log_usage(repos[graph][0], payload, "DENIED %s (not located: %s)" % (what, ",".join(rels)))
        msgs.append(read_deny_text(graph, rels))
    wt = [r for r in repos.values() if r[0] != r[1]]
    deny("Graph gate: this call (%s) is blocked.\n%s%s"
         % (what, "\n".join(msgs),
            ("\nThis worktree has no graph of its own; run graphify from the main checkout at "
             "%s, whose graph answers for it." % disp(wt[0][1])) if wt else ""))


def powershell_as_sh(cmd):
    """A PowerShell command in the shape _walk reads: Get-Content/gc/type are cat,
    Select-String is grep, Set-Location is cd, backslashes are slashes."""
    t = cmd.replace("\\", "/")
    t = re.sub(r"(?i)\bSet-Location\b|\bsl\b(?=\s)", "cd", t)
    t = re.sub(r"(?i)\b(?:Get-Content|gc|type)\b(?=\s)", "cat", t)
    t = re.sub(r"(?i)\b(?:Select-String|sls)\b(?=\s)", "grep", t)
    t = re.sub(r"(?i)\s-(?:Path|LiteralPath)\s+", " ", t)
    t = re.sub(r"(?i)\s-Pattern\s+", " -e ", t)
    return t


def search_deny_text(graph, missing):
    return (
        "- SEARCH: this agent has not asked the knowledge graph about %s. Ask by name first:\n"
        "  cd %s && %s\n"
        "  (or `graphify affected \"<Name>\" --depth 2`, `graphify path \"<A>\" \"<B>\"`, "
        "`graphify query \"<question>\" --seed \"<Name>\"`, or mcp__graphify__get_node / "
        "get_neighbors). One explain per name (not \"A|B\"), with its answer printed (not sent "
        "to /dev/null, not after `||`); a name the graph does not know still counts once "
        "asked. Then re-run this search to CONFIRM what the graph said: it misses calls on "
        "another object whose class it cannot infer (renderer.render()) and calls inside "
        "anonymous test() callbacks. %s For a where-is / who-calls question you can hand the "
        "whole thing to the graph-scout agent."
        % (", ".join(missing), shq(disp(graph)),
           "; ".join('graphify explain "%s"' % m for m in missing[:10]), NEVER_BLOCKED))


def read_deny_text(graph, rels):
    files = code_files(graph)
    lines = []
    for rel in rels[:6]:
        syms = ", ".join(("%s %s" % (l, loc)).strip() for l, loc in (files.get(rel) or [])[:6])
        lines.append('  cd %s && graphify explain "%s"%s'
                     % (shq(disp(graph)), rel, ("\n      (the graph indexes it with: %s)" % syms)
                        if syms else ""))
    more = (("\n  ... and %d more: %s - one `graphify query \"<question>\"` whose answer lists "
             "them unlocks them together" % (len(rels) - 6, ", ".join(rels[6:12])))
            if len(rels) > 6 else "")
    return (
        "- READ: no graph answer has shown this agent %s yet. Ask the graph first - any answer "
        "that names the file unlocks reading it for this agent:\n%s%s\n"
        "  `graphify explain \"<a symbol in it>\"`, `graphify affected` / `graphify path` on a "
        "symbol it defines, a `graphify query \"<question>\"` that lists the file, an "
        "mcp__graphify__* answer or graphify-out/GRAPH_REPORT.md count too. Then read only the "
        "lines the graph pointed to (Read with offset/limit). Files the graph does not index "
        "as code (research notes, raw/ captures, Markdown, JSON, data) are never gated."
        % (", ".join(rels[:12]), "\n".join(lines), more))


def response_text(payload):
    parts = []
    r = payload.get("tool_response")
    if isinstance(r, dict):
        for k in ("stdout", "stderr", "output", "result", "text"):
            if isinstance(r.get(k), str):
                parts.append(r[k])
        f = r.get("file")
        if isinstance(f, dict) and isinstance(f.get("content"), str):
            parts.append(f["content"])         # Read: {"type": "text", "file": {...}}
        if isinstance(r.get("content"), list):
            r = r["content"]
        elif isinstance(r.get("content"), str):
            parts.append(r["content"])
    if isinstance(r, list):
        for item in r:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
    elif isinstance(r, str):
        parts.append(r)
    if isinstance(payload.get("error"), str):
        parts.append(payload["error"])
    return "\n".join(parts)


def on_post(payload):
    tool = _str(payload.get("tool_name"))
    ti = tool_input(payload)
    failed = payload.get("hook_event_name") == "PostToolUseFailure" or (
        "error" in payload and "tool_response" not in payload)
    if tool == "Read":
        if failed:
            return
        fp = os.path.join(cwd_of(payload), os.path.expanduser(native(_str(ti.get("file_path")))))
        full = os.path.realpath(fp)
        repo = repo_of(full)
        if not repo:
            return
        rel = os.path.relpath(full, repo[1]).replace(os.sep, "/")
        if rel.startswith("graphify-out/") and rel.endswith(".md"):
            record_located(payload, repo, response_text(payload), "report")  # GRAPH_REPORT.md
        return
    if tool.startswith("mcp__graphify__"):
        short = tool[len("mcp__graphify__"):]
        pp = _str(ti.get("project_path"))
        text = response_text(payload)
        if pp:
            root = os.path.realpath(native(os.path.expanduser(pp)))
            repo = repo_of(root)
            if not repo:
                return                         # not this repo: another graph answered
            if repo[1] != root and (
                    os.path.isfile(os.path.join(root, "graphify-out", "graph.json"))
                    or re.search(r"^Error executing|graph file not found|No such file",
                                 text, re.M)):
                return                         # its own graph answered, or none did
        else:
            repo = graph_root(payload)         # the pre hook filled in this repo's root
            if not repo:
                return
        if failed and not GRAPH_OUTPUT.search(text):
            return
        names = [str(ti[k]).strip() for k in ("label", "node_id", "source", "target")
                 if ti.get(k) and ONE_NAME.match(str(ti[k]).strip())]
        record_located(payload, repo, text, short, files=files_for_names(repo[1], names))
        if short not in MCP_QUERY_TOOLS:
            return                             # stats, god nodes, communities: no name asked
        if short == "query_graph":
            q = str(ti.get("question") or "").strip()
            if re.match(r"^[\w.()\-:/]+$", q):
                names.append(q)
            names += code_idents([q])
        if short == "get_pr_impact" and ti.get("pr_number") is not None:
            names.append("#pr%s" % ti.get("pr_number"))
        if names:
            record(payload, repo, short, names, short)
        return
    if tool in ("Bash", "PowerShell"):
        cmd = _str(ti.get("command"))
        if tool == "PowerShell":
            cmd = powershell_as_sh(cmd)
        cwd = cwd_of(payload)
        text = response_text(payload)
        segs = [s for s in _walk(cmd, cwd) if not s.quiet]
        shown, other = [], False
        for s in segs:
            r = _seg_graph_read(s)
            if r:
                if r not in shown:
                    shown.append(r)
            elif not (s.piped and not s.args) and s.exe not in STDIN_FILTERS | {"true", ":"}:
                other = True                   # grep/find/ls/git/echo printed into the output
            elif s.exe in STDIN_FILTERS and [a for a in s.args if not a.startswith("-")
                                             and os.path.exists(os.path.join(cwd, a))]:
                other = True                   # a filter given files of its own
        calls = graph_calls(cmd, cwd)
        answered = bool(GRAPH_OUTPUT.search(text))
        for repo in shown:
            # Only the graph's own answer locates files: when other commands printed into
            # the same output, only paths in graphify's answer syntax count.
            named = [f for c in calls if c[0] == repo for f in files_for_names(repo[1], c[2])]
            record_located(payload, repo, text, "bash", strict=other,
                           files=named if answered else ())
        if not calls or not answered:
            return                             # never ran, or printed no graph answer
        for repo, sub, names in calls:
            record(payload, repo, sub, names, cmd.strip()[:120])


# filters that only reshape the stream piped into them (graph output | head -20)
STDIN_FILTERS = {"head", "tail", "sed", "grep", "egrep", "rg", "cut", "sort", "uniq", "awk",
                 "less", "more", "cat", "tr", "column", "nl", "fold", "fmt", "wc", "tee"}


def _own_commits(work, base, head, since):
    """True when HEAD only moved forward by commits made this turn (`git commit` in
    the turn); False for a checkout, pull, merge, reset or rebase onto other work."""
    import subprocess
    git = ["git", "-C", work]
    # Decide on the commits HEAD has that the turn's start lacks - not on ancestry, so an
    # amend, `reset --soft && commit` or squash of an older commit still counts as this
    # turn's (and its code change is judged), while a checkout or pull of older commits
    # does not.
    r = subprocess.run(git + ["log", "--format=%ct", "%s..%s" % (base, head)],
                       capture_output=True, encoding="utf-8", errors="replace", timeout=5)
    if r.returncode != 0 or not r.stdout.split():
        return False
    return all(int(t) >= since - 2 for t in r.stdout.split())


def on_stop(payload, repo):
    if payload.get("stop_hook_active"):
        return
    reason = stop_reason(payload, repo)
    if reason:
        emit({"decision": "block", "reason": reason})


def stop_reason(payload, repo):
    """The block reason for this repo's turn, or None (and the turn may end)."""
    work, graph = repo
    tid = current_turn(payload) or ""
    blocked = session_marker(payload, work, "stopblocked")
    try:
        with open(blocked) as f:
            if f.read().strip() == tid:
                return None                    # at most one block per turn
    except OSError:
        pass
    tpath = session_marker(payload, work, "turnstart")
    try:
        with open(tpath) as f:
            start = json.load(f)
        start_mtime = os.path.getmtime(tpath)
    except (OSError, ValueError):
        return None
    base = start.get("base") if isinstance(start, dict) else None
    if not base or start.get("turn") != tid:
        return None                            # none, or snapshotted in an older turn
    moved = False
    head = head_commit(work)
    if head and head != base and not _own_commits(work, base, head, start_mtime):
        # HEAD moved onto work this turn did not write (checkout, pull, merge, reset,
        # rebase): only what is uncommitted on top of the new HEAD can be this turn's.
        base, moved = head, True
    unread = set()
    lines = turn_state(work, base, specs_for(graph), unread)
    if lines is None:
        return None
    files = start.get("files") if isinstance(start.get("files"), dict) else {}
    before = set(start.get("lines") or [])     # (older snapshot format)
    for ks in files.values():
        before.update(ks)
    new = [v for k, v in lines.items() if k not in before]
    if not moved:
        # Lines that were in the diff at turn start and are gone now: uncommitted code
        # deleted or reverted this turn (an EXISTING line deleted shows up as a new '-').
        # A deleted declaration keeps its name, so its callers get checked.
        decl_text = start.get("decl") if isinstance(start.get("decl"), dict) else {}
        for f, ks in files.items():
            if f in unread or not isinstance(ks, list):
                continue
            for k in ks:
                if k not in lines:
                    t = decl_text.get(k)
                    new.append((f, "-" + t[1:] if isinstance(t, str) and t else "", ""))
    new = [v for v in new if counts_as_code(graph, v[0])]   # not JSON data, .claude/ ...
    if not new:
        return None                            # nothing changed, or only committed
    changed = []
    for f, _, _ in new:
        if f not in changed:
            changed.append(f)
    mtimes = []
    for f in changed:
        p = os.path.join(work, f)
        if not os.path.exists(p):              # deleted: its directory changed when it went
            p = os.path.dirname(p)
        try:
            m = os.path.getmtime(p)
            if m >= start_mtime:
                mtimes.append(m)
        except OSError:
            pass
    last_edit = max(mtimes or [start_mtime])
    strong, weak, around = [], [], []
    for f, text, ctx in new:
        encl = DECL.findall(ctx)[:1]           # the function/class a body edit sits in
        in_fun = bool(encl) and encl[0][0] in ("fun", "func", "def", "function")
        js = posixpath.splitext(f)[1].lower() in JS_LIKE
        for kw, n in DECL.findall(text):
            if n in NOT_A_NAME or n in strong or n in weak:
                continue
            if kw in DECL_WEAK and (in_fun or js) and text[1:2].isspace():
                continue                       # a local val/var/let/const: no graph node
            (weak if kw in DECL_WEAK else strong).append(n)
        for kw, n in encl:
            if n not in NOT_A_NAME and n not in around:
                around.append(n)
    # A body-only edit (`val title = ...` inside ChatRoomScreen) affects the callers of
    # the ENCLOSING declaration; a changed local val is no graph node to ask about.
    decls = strong + [n for n in around if n not in strong] + [n for n in weak if n not in around]
    idents = {d.lower() for d in decls}
    stems = {os.path.splitext(os.path.basename(f))[0].lower() for f in changed}
    checks = read_log(session_marker(payload, graph, "impact"), last_edit)
    asked_since = set()
    for _, _, _, n in checks:
        asked_since |= name_keys(n)
    # Only a changed declaration (or the one a body edit sits in) or a changed file's own
    # stem counts - not a callee, a builtin, a local, or any name that contains the stem:
    # asking about `Screen` does not cover ChatRoomScreen.kt, nor `toFixed` formatTime().
    impact_ok = any(matches(t, asked_since) for t in idents) or bool(stems & asked_since)
    unseen = [] if work != graph else graph_unseen(graph, changed)
    if unseen and watcher_alive(graph):
        unseen = []                            # the watcher re-extracts them within seconds
    if impact_ok and not unseen:
        return None
    with open(blocked, "w") as f:              # raises on a read-only state dir: no block
        f.write(tid)
    names = decls[:3] or [os.path.splitext(os.path.basename(f))[0] for f in changed[:3]]
    files_txt = ", ".join(changed[:4]) + (" and %d more" % (len(changed) - 4)
                                           if len(changed) > 4 else "")
    g = shq(disp(graph))
    if impact_ok:
        log_usage(work, payload, "STOP-BLOCK graph has not seen %s" % ",".join(unseen[:4]))
        return ("Graph gate: the knowledge graph has not seen this turn's edits to %s and no "
                "`graphify watch` is running, so graph answers no longer match the code. "
                "Run:\n  cd %s && graphify update .\n(AST only, seconds, no LLM; you, the "
                "main agent - subagents must not) and, if your impact check named a symbol "
                "the old graph did not have, run `graphify affected` on it again."
                % (", ".join(unseen[:4]), g))
    log_usage(work, payload, "STOP-BLOCK no impact query on %s" % ",".join(names))
    asked = sorted({n for _, _, _, n in checks})[:5]
    return ("Graph gate: this turn changed %s%s, and no by-name impact query on a changed "
            "symbol or file ran after the last edit%s.%s Before finishing, run:\n  cd %s && "
            "%s%s\nthen confirm the callers it lists with grep (the graph misses calls "
            "through this.x(), obj.method() and callbacks) and fix or report anything that "
            "breaks - or ask the graph-scout agent for the impact check (its query counts "
            "too). If the change cannot affect any caller (comments, strings, tests only), "
            "say so in one line and stop."
            % (files_txt,
               " (declarations: %s)" % ", ".join(decls[:5]) if decls else "",
               " (asked since: %s)" % ", ".join(asked) if asked else "",
               (" The graph has not seen the edits to %s yet and no watcher runs, so update "
                "it first." % ", ".join(unseen[:4])) if unseen else "",
               g, "graphify update . && " if unseen else "",
               "; ".join('graphify affected "%s" --depth 2' % n for n in names)))


# ------------------------------------------------------------ project edition

def announce(payload):
    """Tell the machine-wide graph gate (~/.claude/hooks/graph-gate, when installed) that
    this project gate runs in this session, so it stands down for this repo instead of
    gating every call twice."""
    try:
        d = os.path.join(MACHINE_STATE, "markers")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, "%s.projectgates" % _safe(payload.get("session_id"), "nosession"))
        try:
            with open(p) as f:
                if PROJECT_ROOT in f.read().splitlines():
                    os.utime(p, None)
                    return
        except OSError:
            pass
        with open(p, "a") as f:
            f.write(PROJECT_ROOT + "\n")
    except Exception:
        pass


def ensure_git_setup(work):
    """graphify's git hooks (a background graph rebuild after commit, checkout, merge and
    rebase) and the graph.json merge driver that .gitattributes names: installed once per
    clone with `graphify hook install`, which appends to existing hooks."""
    if os.environ.get("GRAPH_GATE_NO_GIT_SETUP", "").strip().lower() in ("1", "true", "yes", "on"):
        return []
    import subprocess
    try:
        r = subprocess.run(["git", "-C", work, "rev-parse", "--git-path", "hooks"],
                           capture_output=True, encoding="utf-8", errors="replace", timeout=5)
        if r.returncode != 0:
            return []
        hd = r.stdout.strip()
        hd = hd if os.path.isabs(hd) else os.path.join(work, hd)
        missing, dead = [], []
        for h in ("post-commit", "post-checkout", "post-merge", "post-rewrite"):
            try:
                with open(os.path.join(hd, h)) as f:
                    text = f.read()
            except OSError:
                missing.append(h)
                continue
            if "graphify" not in text:
                missing.append(h)
            elif re.search(r"^exit\b", text.split("# graphify-")[0], re.M):
                dead.append(h)                 # an `exit` before graphify's block: never runs
        if dead and not missing:
            return ["graphify's block in .git/hooks/%s never runs: the hook exits before it "
                    "(move graphify's block above that `exit`)" % ", ".join(dead)]
        d = subprocess.run(["git", "-C", work, "config", "--get", "merge.graphify.driver"],
                           capture_output=True, encoding="utf-8", errors="replace", timeout=5)
        if not missing and d.returncode == 0 and d.stdout.strip():
            return []
        r = subprocess.run([graphify_bin(), "hook", "install"], cwd=work, capture_output=True,
                           encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL,
                           timeout=20)
        if r.returncode == 0:
            return ["installed graphify's git hooks (background graph rebuild after commit, "
                    "checkout, merge, rebase) and the graph.json merge driver "
                    "(`graphify hook install`)"]
        return ["`graphify hook install` failed: %s" % (r.stderr or r.stdout).strip()[:200]]
    except Exception as e:
        return ["could not check graphify's git hooks: %s" % e]


def read_target(p):
    """(repo, rel) when `p` is a file the graph indexes as code, i.e. a read the gate
    judges; None for anything else. A different letter case of an indexed file on a
    case-insensitive file system (macOS, Windows) is that file."""
    try:
        full = os.path.realpath(native(p))
        repo = repo_of(full)
        if not repo:
            return None
        rel = os.path.relpath(full, repo[0]).replace(os.sep, "/")
        if rel == ".." or rel.startswith("../"):
            return None
        files = code_files(repo[1])
        if rel in files:
            return (repo, rel)
        if os.path.isfile(full):
            low = rel.lower()
            for f in files:
                if f.lower() == low and os.path.samefile(full, os.path.join(repo[0], f)):
                    return (repo, f)
        return None
    except Exception:
        return None


def located(payload, graph):
    """Indexed source files a graph answer has shown this agent within the TTL."""
    return {n for _, _, _, n in read_log(agent_marker(payload, graph, "located"),
                                         time.time() - TTL)}


def files_in(text, graph, strict=False):
    """The graph's code files a graph answer names (repo-relative, / separated). strict:
    only in graphify's own answer syntax (`Source:  P L12`, `src=P`, `P:L12`, `P L12`, an
    indented candidate line, `<-- P [`), so a path that grep, find, ls or git printed in the
    same command does not count."""
    files = code_files(graph)
    if not text or not files:
        return []
    t = text.replace("\\", "/")
    out = []
    for f in files:
        if f not in t:
            continue
        e = re.escape(f)
        if strict:
            pat = (r"(?:Source:[ \t]+|src=|^[ \t]+|(?:<--|-->)[ \t]*)" + e + r"(?![\w-])"
                   r"|(?<![\w./-])" + e + r"(?::L\d| L\d)")
            if re.search(pat, t, re.M):
                out.append(f)
        elif re.search(r"(?<![\w.-])" + e + r"(?![\w-])", t):
            out.append(f)
    return out


def files_for_names(graph, names):
    """The files of the graph's code nodes that an asked name resolves to exactly: a label
    (`SimClock`, `.render()`, `start()`), a `path::.method()` form or a node id. `graphify
    path` and `affected` answer with labels only, so their own files come from here."""
    labels = (_load_index(graph) or {}).get("labels") or {}
    out = []
    for name in names:
        n = str(name).strip().strip("\"'`").strip()
        for key in (n.lower(), _label_key(n.split("::")[-1])):
            for f in labels.get(key) or []:
                if f not in out:
                    out.append(f)
    return out


def record_located(payload, repo, text, via, strict=False, files=()):
    try:
        hits = files_in(text, repo[1], strict) if text else []
        hits += [f for f in files if f not in hits]
        if not hits:
            return
        now = time.time()
        agent = _safe(payload.get("agent_id"), "main")
        with open(agent_marker(payload, repo[1], "located"), "a") as f:
            f.write("".join("%.3f\t%s\t%s\t%s\n" % (now, agent, via, h) for h in hits))
        log_usage(repo[0], payload, "LOCATED %s %s" % (via, ",".join(hits)[:150]))
    except Exception:
        pass


MATCH_ALL = {"", ".", "^", "$", ".*", "^.*", "^.*$", "\\w*", ".?", "(?s).*"}
# consumers that print nothing of their input: `cat a.js | wc -l` reads no line
CONTENT_FREE = {"wc", "md5", "md5sum", "shasum", "sha1sum", "sha224sum", "sha256sum",
                "sha384sum", "sha512sum", "b2sum", "cksum", "sum"}
# commands that list files (an `| xargs cat` or a `for f in $(...)` loop reads their list)
LISTERS = {"ls", "find", "fd", "fdfind", "git", "echo", "printf", "rg", "grep", "tree"}
SCRIPTS = re.compile(r"^(python3?(\.\d+)?|py|node|deno|bun)$", re.I)
INLINE_READ = re.compile(r"(?:\bopen|read_text|read_bytes|readlines|\bPath|readFileSync|"
                         r"readFile|createReadStream)\s*\(\s*(?:[\w.]+\s*,\s*)?"
                         r"['\"]([^'\"\n]+)['\"]")
DIFFERS = {"diff", "sdiff", "colordiff", "vimdiff", "delta", "difft"}


def indexed_under(d, globs=None):
    """Absolute paths of the graph's code files under directory d, optionally only those
    whose name (or repo path) matches one of the globs."""
    import fnmatch
    repo = repo_of(d)
    if not repo:
        return []
    rel = os.path.relpath(os.path.realpath(d), repo[0]).replace(os.sep, "/")
    rel = "" if rel == "." else rel
    if rel.startswith(".."):
        return []
    pats = []
    for g in globs or []:
        for b in _braces(g):
            pats.append(b.replace("\\", "/").lstrip("./") or "*")
    out = []
    for f in code_files(repo[1]):
        if rel and not f.startswith(rel + "/"):
            continue
        if pats and not any(fnmatch.fnmatch(posixpath.basename(f), p.rsplit("/", 1)[-1])
                            or fnmatch.fnmatch(f, p) for p in pats):
            continue
        out.append(os.path.join(repo[0], f))
    return out


def _seg_paths(s):
    """(path, files) helpers for one command: path() resolves an operand; files() turns
    operands into (files, dirs, unresolved) - unresolved when a file list comes from a
    pipe, xargs, `{}` or a loop over command output."""
    here, env, loops = s.here, s.env, s.loops

    def path(o):
        e = expand(o, env)
        if e is None or (here is None and not os.path.isabs(e)):
            return None
        return os.path.normpath(os.path.join(here or "/", e))

    def files(ops):
        found, dirs, unresolved = [], [], False
        for o in ops:
            if o == "-":
                continue
            if "__SUBST__" in o or "{}" in o:
                unresolved = True
                continue
            m = re.match(r"^\$\{?(\w+|@)\}?$", o)
            for w in (loops[m.group(1)] if m and m.group(1) in loops else [o]):
                for b in _braces(w):
                    if "__SUBST__" in b:
                        unresolved = True
                        continue
                    p = path(b)
                    if p is None:
                        continue
                    if any(c in b for c in "*?["):
                        import glob as _glob
                        import itertools
                        for h in itertools.islice(_glob.iglob(p, recursive="**" in b), 2000):
                            (dirs if os.path.isdir(h) else found).append(h)
                    elif os.path.isdir(p):
                        dirs.append(p)
                    else:
                        found.append(p)
        return found, dirs, unresolved
    return path, files


def _seg_reads(s):
    """(paths, unresolved) for one command: the files whose CONTENT it prints, and whether
    it reads a file list it cannot see (`| xargs cat`, `cat "$f"` in a loop over a
    listing). Covers cat/head/tail/less/more/bat/nl/tac and `< file`; sed/awk/perl over
    files (not in-place); grep/rg/git grep printing lines of one or two files, of the files
    a literal --include/-g/glob narrows a tree to, or of every file with a match-all
    pattern or --passthru; diff/sdiff and git diff --no-index; git blame, git log -p/-L
    with a path, git show REV:path and REV -- path; find -exec <reader>; python -c / node -e
    / heredoc scripts that open() or readFileSync() a literal path."""
    exe, args = s.exe, s.args
    path, files = _seg_paths(s)
    stdin = [path(s.stdin_file)] if s.stdin_file and path(s.stdin_file) else []

    if SCRIPTS.match(exe or ""):
        code = ""
        if args[:1] == ["__SCRIPT__"] and len(args) > 1:
            code = args[1]
        else:
            for k, a in enumerate(args[:-1]):
                if a in ("-c", "-e", "-p", "--eval", "--print"):
                    code = args[k + 1]
                    break
        return [p for p in (path(m.group(1)) for m in INLINE_READ.finditer(code)) if p], False
    if exe in READERS:
        pos, _ = parse_opts(args, READER_VAL)
        found, _, unresolved = files(pos)
        if s.via_xargs and not pos and not s.stdin_words:
            unresolved = True
        if s.via_xargs and s.stdin_words:      # echo a.js b.js | xargs cat
            found += files(s.stdin_words)[0]
        return found + stdin, unresolved
    if exe in SCANNERS:
        pos, opts = parse_opts(args, SCANNERS[exe])
        flags = {o for o, _ in opts}
        if exe in ("sed", "perl") and flags & {"-i", "--in-place"}:
            return [], False                   # an in-place edit, not a read
        if exe in ("awk", "gawk") and any(v and "inplace" in v for _, v in opts):
            return [], False
        script_given = bool(flags & {"-e", "-E", "-f"})
        script = ([v for o, v in opts if o in ("-e", "-E")] or pos[:1] or [""])[0] or ""
        if (exe == "sed" and script.strip() == "$=") or (
                exe in ("awk", "gawk") and re.match(r"^\s*END\s*\{\s*print\s+NR\s*;?\s*\}\s*$",
                                                    script)):
            return [], False                   # a line count, no content
        found, _, unresolved = files(pos if script_given else pos[1:])
        if s.via_xargs and not (pos if script_given else pos[1:]):
            unresolved = True
        return found + stdin, unresolved
    if exe in DIFFERS:
        pos, opts = parse_opts(args, {"-I", "-x", "-X", "-L", "--label", "-W", "--width"})
        if {o for o, _ in opts} & {"-q", "--brief", "-s", "--report-identical-files"}:
            return [], False
        found, dirs, _ = files(pos)
        for d in dirs:
            found += indexed_under(d)
        return found, False
    if exe == "find":
        k = 0
        while k < len(args) and not args[k].startswith("-") and args[k] not in ("(", "!", "\\("):
            k += 1
        starts, expr = args[:k] or ["."], args[k:]
        runs = False
        for j, e in enumerate(expr):
            if e in ("-exec", "-execdir", "-ok", "-okdir") and j + 1 < len(expr):
                sub = os.path.basename(expr[j + 1])
                tail = expr[j + 2:]
                stop = next((x for x, t in enumerate(tail) if t in (";", "\\;", "+")), len(tail))
                if sub in READERS or sub in SCANNERS or sub in DIFFERS:
                    runs = True
                elif sub in GREP_LIKE | {"rg", "ag", "ack"}:
                    so = {o for o, _ in parse_opts(tail[:stop], GREP_VAL)[1]}
                    runs = not (so & NO_CONTENT)
        if not runs:
            return [], False
        names = [expr[j + 1] for j in range(len(expr) - 1) if expr[j] in ("-name", "-iname")]
        out = []
        for st in starts:
            p = path(st)
            if p and os.path.isdir(p):
                out += indexed_under(p, names or None)
            elif p:
                out.append(p)
        return out, False
    if exe == "git":
        k, g = 0, s.here
        while k < len(args) and args[k].startswith("-"):
            if args[k] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace"):
                if args[k] == "-C" and k + 1 < len(args):
                    g = path(args[k + 1])
                k += 1
            k += 1
        sub, rest = (args[k] if k < len(args) else ""), args[k + 1:]
        if g is None or not sub:
            return [], False
        top = _git_top(g)

        def gp(rp):
            base = g if rp.startswith(("./", "../")) or not top else top
            return os.path.normpath(os.path.join(base, rp))
        after = rest[rest.index("--") + 1:] if "--" in rest else []
        before = rest[:rest.index("--")] if "--" in rest else rest
        if sub in ("show", "cat-file"):
            out = [gp(a.split(":", 1)[1]) for a in before
                   if not a.startswith("-") and ":" in a and a.split(":", 1)[1]]
            if sub == "show" and after:
                out += [os.path.normpath(os.path.join(g, a)) for a in after]
            return out, False
        if sub in ("blame", "annotate"):
            pos, _ = parse_opts(before, {"-L", "-S", "--contents", "-C", "-M", "--since"})
            ops = after or pos[-1:]
            return [os.path.normpath(os.path.join(g, a)) for a in ops], False
        if sub == "log":
            pos, opts = parse_opts(before, {"-L", "-n", "--max-count", "--since", "--until",
                                            "--author", "--grep", "--format", "--pretty"})
            flags = {o for o, _ in opts}
            out = [gp(v.split(":", 1)[1]) for o, v in opts if o == "-L" and v and ":" in v]
            if flags & {"-p", "-u", "--patch"} and after:
                out += [os.path.normpath(os.path.join(g, a)) for a in after]
            return out, False
        if sub == "diff" and "--no-index" in rest:
            found, dirs, _ = files([a for a in rest if not a.startswith("-")])
            for d in dirs:
                found += indexed_under(d)
            return found, False
        if sub == "grep":
            pos, opts = parse_opts(before, GREP_VAL)
            flags = {o for o, _ in opts}
            if flags & NO_CONTENT:
                return [], False
            raw = [v for o, v in opts if o in ("-e", "--regexp")] or pos[:1]
            specs = after or pos[1:]
            found, dirs, _ = files(specs) if specs else ([], [g], False)
            if dirs:
                if raw and all(r in MATCH_ALL for r in raw):
                    for d in dirs:
                        found += indexed_under(d)
                    return found, False
                return [], False
            return (found if len(found) <= 2 or (raw and all(r in MATCH_ALL for r in raw))
                    else []), False
        return [], False
    if exe in SEARCH_EXES and exe not in ("find", "fd", "fdfind", "sg", "ast-grep", "mdfind"):
        val = GREP_VAL if exe in GREP_LIKE else RG_VAL
        pos, opts = parse_opts(args, val)
        flags = {o for o, _ in opts}
        if flags & NO_CONTENT or (exe in ("ag", "ack") and "-g" in flags):
            return [], False                   # names, counts or exit status: no content
        has_pat = bool(flags & {"-e", "-f", "--regexp", "--file"})
        raw = [v for o, v in opts if o in ("-e", "--regexp")] or ([] if has_pat else pos[:1])
        everything = (raw and all(r in MATCH_ALL for r in raw)) or "--passthru" in flags
        found, dirs, _ = files(pos if has_pat else pos[1:])
        if dirs:
            globs = [v for o, v in opts if o in ("--include", "-g", "--glob", "--iglob") and v
                     and not v.startswith("!")]
            narrowed = [f for d in dirs for f in indexed_under(d, globs or None)]
            if everything:
                return found + narrowed, False  # grep -rn "" src/ prints every line
            if globs and 0 < len(narrowed) <= 2 and not any(c in g for g in globs for c in "*?["):
                return narrowed, False         # rg -n -C40 tick -g clock.js src/: one file
            return [], False                   # a search over a tree: the search gate's
        if len(found) <= 2 or everything:
            return found + stdin, False        # one or two files: a read of them
        return [], False
    if exe == "cat" or stdin:
        return stdin, False
    return [], False


def listed_files(s):
    """The graph's code files a listing command names or contains (ls, find, fd, git
    ls-files, echo/printf of paths, rg --files, grep -l): what `| xargs cat` or a loop over
    its output would read."""
    exe = s.exe
    if exe not in LISTERS:
        return []
    path, files = _seg_paths(s)
    args = s.args
    if exe == "git":
        if not args or args[0] != "ls-files":
            return []
        ops = [a for a in args[1:] if not a.startswith("-") and a != "--"] or ["."]
        found, dirs, _ = files(ops)
        return found + [f for d in dirs for f in indexed_under(d)]
    if exe == "find":
        k = 0
        while k < len(args) and not args[k].startswith("-") and args[k] not in ("(", "!"):
            k += 1
        names = [args[j + 1] for j in range(k, len(args) - 1) if args[j] in ("-name", "-iname")]
        found, dirs, _ = files(args[:k] or ["."])
        return found + [f for d in dirs for f in indexed_under(d, names or None)]
    if exe in ("fd", "fdfind"):
        pos, opts = parse_opts(args, FD_VAL)
        exts = ["*." + v for o, v in opts if o in ("-e", "--extension") and v]
        roots = pos[1:] or ["."]
        found, dirs, _ = files(roots)
        return found + [f for d in dirs for f in indexed_under(d, exts or None)]
    if exe in ("rg", "grep"):
        pos, opts = parse_opts(args, RG_VAL if exe == "rg" else GREP_VAL)
        flags = {o for o, _ in opts}
        if not flags & {"--files", "-l", "--files-with-matches"}:
            return []
        ops = pos if "--files" in flags else pos[1:]
        found, dirs, _ = files(ops or ["."])
        return found + [f for d in dirs for f in indexed_under(d)]
    ops = [a for a in args if not a.startswith("-")]
    if exe == "printf":
        ops = ops[1:]
    found, dirs, _ = files(ops or (["."] if exe in ("ls", "tree") else []))
    return found + [f for d in dirs for f in indexed_under(d)]


def _graph_repo(gpath, s):
    """The repo whose graph a graphify command reads: --graph pointing into its
    graphify-out, or run from its root."""
    if gpath:
        g = expand(gpath, s.env)
        if g is None or (s.here is None and not os.path.isabs(g)):
            return None
        g = os.path.realpath(os.path.join(s.here or "/", g))
        if os.path.basename(os.path.dirname(g)) != "graphify-out":
            return None
        root = os.path.dirname(os.path.dirname(g))
    else:
        if s.here is None:
            return None
        root = os.path.realpath(s.here)
    repo = repo_of(root)
    if not repo or os.path.normcase(repo[1]) != os.path.normcase(root):
        return None                            # run elsewhere it reads (or makes) another graph
    return repo


def _seg_graph_read(s):
    """The repo when this command prints graph content: a graphify read whose answer lists
    graph nodes (explain, affected, path, query - prose too - and god-nodes), or a reader
    of graphify-out/*.md (GRAPH_REPORT.md, the wiki)."""
    if s.exe != "graphify":
        for p in _seg_reads(s)[0]:
            parts = p.replace("\\", "/").split("/")
            if len(parts) > 1 and parts[-2] == "graphify-out" and p.endswith(".md") \
                    or "graphify-out/wiki" in p.replace("\\", "/"):
                repo = repo_of(p)
                if repo:
                    return repo
        return None
    if not s.args or s.args[0] not in GRAPH_READ_SUBS:
        return None
    gpath, rest, k = None, s.args[1:], 0
    while k < len(rest):
        a = rest[k]
        if a == "--graph" and k + 1 < len(rest):
            gpath = rest[k + 1]
            k += 2
            continue
        if a.startswith("--graph="):
            gpath = a.split("=", 1)[1]
        k += 1
    return _graph_repo(gpath, s)


def _seg_graph_write(s):
    """(subcommand, blocked for every agent, repo) when this graphify command writes the
    graph, its outputs or tool config of this repo; None otherwise. The repo is the one a
    path argument names (`graphify update /path/to/repo`), else the command's directory."""
    if s.exe != "graphify" or not s.args:
        return None
    path, _ = _seg_paths(s)
    target = None
    for a in s.args[1:]:
        if not a.startswith("-") and "://" not in a:
            p = path(a)
            if p and os.path.isdir(p):
                target = p
                break
    repo = repo_of(target or (s.here if s.here is not None else PROJECT_ROOT))
    if not repo:
        return None                            # another repo's graph
    sub = s.args[0]
    nxt = s.args[1] if len(s.args) > 1 else ""
    if sub == "claude" and nxt in ("install", "uninstall"):
        return ("claude " + nxt, True, repo)
    if sub == "uninstall":
        return ("uninstall", True, repo)
    if nxt in ("install", "uninstall"):        # hook install, cursor install, ...
        return ("%s %s" % (sub, nxt), False, repo)
    if sub in ("global", "provider") and nxt in ("add", "remove"):
        return ("%s %s" % (sub, nxt), False, repo)
    if sub in GRAPH_WRITE_SUBS:
        return (sub, False, repo)
    return None


def analyze_full(cmd, cwd):
    """(searches, graph_calls, reads, graph_writes) of a Bash command, in order. A search
    carries how many by-name graph calls came before it; a read carries the name keys
    those calls asked about (`graphify explain "src/x.js" && sed -n 1,40p src/x.js`). A
    reader fed a file list it cannot see reads the code files that the command's listing
    commands name; a reader whose output only goes to wc/shasum, or to a file or
    /dev/null, prints nothing."""
    segs = list(_walk(cmd, cwd))
    downstream = {id(s.upstream): s for s in segs if s.upstream is not None}
    searches, calls, reads, writes, asked_now = [], [], [], [], set()
    for s in segs:
        if s.exe == "graphify":
            w = _seg_graph_write(s)
            if w:
                writes.append(w)
            c = _seg_graph_call(s)
            if c and not s.quiet:
                calls.append(c)
                for n in c[2]:
                    asked_now |= name_keys(n)
            continue
        for p, globs, pats in _seg_searches(s):
            searches.append((p, globs, pats, len(calls)))
        found, unresolved = _seg_reads(s)
        if unresolved:
            up = s.upstream
            found = found + (listed_files(up) if up is not None else
                             [f for o in segs if o is not s for f in listed_files(o)])
        if not found:
            continue
        nxt, quiet = downstream.get(id(s)), s.quiet
        while nxt is not None and not quiet:   # `cat a.js | sort | wc -l` shows no line
            if nxt.exe in CONTENT_FREE:
                quiet = True
            nxt = downstream.get(id(nxt))
        if quiet:
            continue
        for p in found:
            reads.append((p, frozenset(asked_now)))
    return searches, calls, reads, writes


def counts_as_code(graph, rel):
    """Does a change to `rel` count for the end-of-turn checks? Files the graph indexes as
    code do. So does a file with a code extension (.js, .ts, .py, ...) that graphify has
    not extracted yet - unless it sits in graphify-out/, a dot dir (.claude/, .handoff/,
    .git/) or node_modules. A file graphify has seen and found no code in (an index.html
    with no script) does not; neither do data and docs (JSON, Markdown, CSS)."""
    rel = rel.replace("\\", "/")
    if rel in code_files(graph):
        return True
    parts = rel.split("/")
    if any(p.startswith(".") or p in NEVER_CODE_PARTS for p in parts[:-1]):
        return False
    e = posixpath.splitext(rel)[1].lower()
    if e in DATA_EXTS or (e not in CODE_EXTS and e not in (code_index(graph) or ((),))[0]):
        return False
    return rel not in _manifest(graph)         # in the manifest: graphify saw no code there


def _manifest(graph):
    try:
        with open(os.path.join(graph, "graphify-out", "manifest.json")) as f:
            m = json.load(f)
        return m if isinstance(m, dict) else {}
    except Exception:
        return {}


def graph_unseen(graph, changed):
    """Changed files whose current content graphify has not extracted: no entry in
    graphify-out/manifest.json, or one recorded before the file's last write."""
    manifest = _manifest(graph)
    if not manifest:
        return []
    out = []
    for f in changed:
        rel = f.replace("\\", "/")
        try:
            mt = os.path.getmtime(os.path.join(graph, rel))
        except OSError:
            continue                           # deleted: nothing to extract
        e = manifest.get(rel)
        seen = e.get("mtime") if isinstance(e, dict) else None
        if not isinstance(seen, (int, float)) or seen + 0.001 < mt:
            out.append(rel)
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if globally_off():
        return
    payload = read_payload()
    debug(payload, mode)
    tool = _str(payload.get("tool_name"))
    ti = tool_input(payload)
    if mode == "pre":
        if tool == "Bash" and not ACTION_WORD.search(_str(ti.get("command"))):
            return                             # fast path: no search, read or graphify word
        on_pre(payload)                        # judges each search/read by its TARGET's repo
        return
    if mode == "post":
        if tool in ("Bash", "PowerShell"):
            if "graphify" not in _str(ti.get("command")):
                return
        elif tool == "Read":
            if "graphify-out" not in _str(ti.get("file_path")).replace("\\", "/"):
                return
        elif not tool.startswith("mcp__graphify__"):
            return
        on_post(payload)
        return
    if mode == "session-start":
        try:
            prune_state()
        except Exception:
            pass
    repo = graph_root(payload)
    if not repo:
        return                                 # a cwd outside this repo: not this gate's
    handler = {"session-start": on_session_start, "prompt": on_prompt, "stop": on_stop,
               "subagent-start": on_subagent_start}.get(mode)
    if handler:
        handler(payload, repo)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
