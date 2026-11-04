#!/usr/bin/env python3
"""Audit how much Claude Code agents used the Graphify knowledge graph here.

Reads this project's Claude Code transcripts (the main session and every
subagent or workflow agent), classifies each tool call in order (graph
query, code read, other read, search, gate denial) and reports whether the
agents asked the graph before they read or searched code.

  python usage.py                 newest session by modification time (--last 1)
  python usage.py --last 5        the five newest sessions
  python usage.py --all           every session of this project
  python usage.py --session ID    one session (a unique id prefix is enough)
  python usage.py --root PATH     audit another checkout
  python usage.py --json          the same data as one JSON object

Standard library only; Python 3.8+; macOS, Linux and native Windows.
"""

import argparse
import datetime
import fnmatch
import json
import os
import re
import sys

IS_WIN = os.name == "nt"
FOLD_CASE = IS_WIN or sys.platform == "darwin"   # case-insensitive file systems

# data and docs the gate never treats as code, whatever node types graphify gives them
DATA_EXTS = {".json", ".jsonl", ".yaml", ".yml", ".toml", ".xml", ".csv", ".md", ".txt",
             ".css", ".lock"}
GRAPH_SUBS = {"explain": "by_name", "affected": "by_name", "path": "by_name",
              "query": "query", "god-nodes": "other",
              "update": "rebuild", "extract": "rebuild", "watch": "rebuild"}
GRAPH_KINDS = ("by_name", "prose", "other", "mcp", "rebuild")
GRAPH_RE = re.compile(r"graphify(?:\.exe)?['\"]?\s+(explain|affected|path|query|god-nodes|update|extract|watch)\b",
                      re.I)
READ_CMDS = {"cat", "head", "tail", "sed", "awk", "gawk", "nl", "bat", "batcat", "less", "more"}
PS_READ_CMDS = {"get-content", "gc", "type"}
GREP_CMDS = {"grep", "egrep", "fgrep", "rg", "ag", "ack"}
PS_SEARCH_CMDS = {"select-string", "sls", "findstr"}
PREFIX_WORDS = {"do", "then", "else", "elif", "if", "while", "until", "!", "{", "}", "time",
                "command", "builtin", "exec", "nohup", "noglob", "&"}
GREP_VALUE_OPTS = {"-e", "-f", "-m", "-A", "-B", "-C", "-g", "-t", "-T", "-M", "-j", "-d", "-D",
                   "--glob", "--iglob", "--type", "--type-not", "--include", "--exclude",
                   "--exclude-dir", "--max-count", "--context", "--after-context",
                   "--before-context", "--regexp", "--file", "--max-depth", "--sort", "--sortr",
                   "--threads", "--max-columns", "--ignore-file", "--pre", "--color", "--colour"}
FD_VALUE_OPTS = {"-e", "-t", "-E", "-d", "-j", "-S", "-c", "--extension", "--type", "--exclude",
                 "--max-depth", "--min-depth", "--size", "--changed-within", "--changed-before",
                 "--owner", "--color", "--threads", "--base-directory"}
XARGS_VALUE_OPTS = {"-I", "-n", "-P", "-L", "-d", "-E", "-s", "-a"}
DOC_DIRS = {"research", "raw", "docs", "doc", "sources", "notes"}
DOC_EXTS = (".md", ".txt", ".pdf", ".rst", ".csv")
TYPE_EXTS = {"js": (".js", ".mjs", ".cjs", ".jsx"), "ts": (".ts", ".tsx", ".mts", ".cts"),
             "html": (".html", ".htm"), "json": (".json",), "py": (".py",), "css": (".css",),
             "kotlin": (".kt", ".kts"), "java": (".java",), "md": (".md",), "markdown": (".md",)}

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)(-?)\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")
REDIR_RE = re.compile(r"^(\d*|&)(>>|>\||>|<)(.*)$")
ASSIGN_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", re.S)
VAR_RE = re.compile(r"\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))")
TS_RE = re.compile(r'"timestamp"\s*:\s*"([0-9T:.\-+Z]+)"')
GLOB_CHARS = re.compile(r"[*?\[]")
LISTING_RE = re.compile(r"^[*?]*(\.[A-Za-z0-9_{},*?-]+)?$")
FIND_NAME_TESTS = {"-name", "-iname", "-path", "-ipath", "-wholename", "-iwholename", "-regex", "-iregex"}


def say(text=""):
    sys.stdout.write(text + "\n")


def fold(s):
    return s.lower() if FOLD_CASE else s


def short(text, width):
    text = " ".join(str(text).split())
    return text if len(text) <= width else text[:max(0, width - 3)] + "..."


# ------------------------------------------------------------------ project

class Project(object):
    def __init__(self, root):
        self.root = root
        roots = [os.path.realpath(root), os.path.abspath(root)]
        self.roots = [r for i, r in enumerate(roots) if r not in roots[:i]]
        self.graph_path = os.path.join(root, "graphify-out", "graph.json")
        self.graph_error = None
        self.code = {}            # folded repo-relative path -> repo-relative path
        try:
            with open(self.graph_path, encoding="utf-8", errors="replace") as f:
                graph = json.load(f)
            for node in graph.get("nodes") or []:
                if isinstance(node, dict) and node.get("file_type") == "code":
                    src = node.get("source_file")
                    if isinstance(src, str) and src.strip():
                        src = src.replace("\\", "/").strip("/")
                        if os.path.splitext(src)[1].lower() in DATA_EXTS:
                            continue           # JSON and other data: not code (as in gate.py)
                        self.code[fold(src)] = src
        except (OSError, ValueError, AttributeError) as e:
            self.graph_error = "%s: %s" % (type(e).__name__, e)

    def rel(self, path):
        """Repo-relative forward-slash path, '' for the root, None when outside."""
        if not path:
            return None
        for r in self.roots:
            try:
                rel = os.path.relpath(path, r)
            except ValueError:            # another drive on Windows
                continue
            rel = rel.replace("\\", "/")
            if rel == ".":
                return ""
            if rel != ".." and not rel.startswith("../"):
                return rel
        return None

    def is_root_ancestor(self, path):
        p = fold(os.path.normpath(path).replace("\\", "/").rstrip("/")) + "/"
        return any(fold(r.replace("\\", "/").rstrip("/")).startswith(p) for r in self.roots)

    def code_file(self, abs_path):
        rel = self.rel(abs_path)
        return None if rel is None else self.code.get(fold(rel))

    def code_glob(self, abs_pattern):
        """Indexed code files matched by a glob path (or None when outside the repo)."""
        rel = self.rel(abs_pattern)
        if rel is None:
            return None
        pats = {fold(rel), fold(rel.replace("**/", ""))}
        return [v for k, v in self.code.items() if any(fnmatch.fnmatchcase(k, p) for p in pats)]

    def code_scope(self, abs_path, globs=None, exts=None, name_ok=None):
        """True when a search rooted at abs_path can reach indexed code (after the
        search's own file filters: include globs, file types, name tests)."""
        if not abs_path:
            return False
        if GLOB_CHARS.search(abs_path):
            files = self.code_glob(abs_path) or []
        else:
            rel = self.rel(abs_path)
            if rel is None:
                files = list(self.code.values()) if self.is_root_ancestor(abs_path) else []
            else:
                k = fold(rel)
                files = [v for kk, v in self.code.items() if not k or kk == k or kk.startswith(k + "/")]
        pats = [fold(p.replace("\\", "/")) for g in (globs or []) if isinstance(g, str)
                for p in expand_braces(g) if p and not p.startswith("!")]
        if pats:
            files = [f for f in files if any(match_glob(f, p) for p in pats)]
        if exts:
            files = [f for f in files if fold(f).endswith(exts)]
        if name_ok:
            files = [f for f in files if name_ok(f)]
        return bool(files)

    def read_kind(self, abs_path):
        """('code', rel) or ('other', category) for a file read."""
        rel = self.rel(abs_path) if abs_path else None
        if rel is None:
            return "other", "outside_repo"
        hit = self.code.get(fold(rel))
        if hit:
            return "code", hit
        k = fold(rel)
        if k.startswith("graphify-out/"):
            return "other", "graphify_out"
        if any(p in DOC_DIRS for p in k.split("/")[:-1]) or k.endswith(DOC_EXTS):
            return "other", "docs"
        return "other", "repo_other"


def expand_braces(pattern, depth=0):
    """'*.{ts,tsx}' -> ['*.ts', '*.tsx'] (fnmatch has no braces)."""
    m = re.search(r"\{([^{}]*,[^{}]*)\}", pattern)
    if not m or depth > 4:
        return [pattern]
    out = []
    for alt in m.group(1).split(","):
        out.extend(expand_braces(pattern[:m.start()] + alt + pattern[m.end():], depth + 1))
    return out


def match_glob(rel, pattern):
    """Folded glob against a repo-relative file: by base name, or by path when it has '/'."""
    f = fold(rel)
    if "/" in pattern:
        return fnmatch.fnmatchcase(f, pattern) or fnmatch.fnmatchcase(f, "*/" + pattern.lstrip("/")) \
            or fnmatch.fnmatchcase(f, pattern.replace("**/", ""))
    return fnmatch.fnmatchcase(f.rsplit("/", 1)[-1], pattern)


def resolve(token, cwd):
    """Absolute normalised path for a shell word, or None when it cannot be known."""
    if not isinstance(token, str) or not token.strip():
        return None
    t = token.strip()
    if t.startswith("~"):
        t = os.path.expanduser(t)
    t = t.replace("\\", "/")
    if "$" in t or "`" in t:
        return None
    if IS_WIN:
        m = re.match(r"^/([a-zA-Z])(/.*)?$", t)        # Git Bash style /c/Users/...
        if m:
            t = m.group(1) + ":" + (m.group(2) or "/")
    if not os.path.isabs(t):
        if not cwd:
            return None
        t = os.path.join(cwd, t)
    return os.path.normpath(t)


# -------------------------------------------------------------- shell parse

def strip_heredocs(cmd):
    """Drop heredoc bodies: they are data fed to a program, not commands."""
    out, pending = [], []
    for line in cmd.split("\n"):
        if pending:
            delim, dash = pending[0]
            if (line.lstrip("\t") if dash else line).strip() == delim:
                pending.pop(0)
            continue
        out.append(line)
        for m in HEREDOC_RE.finditer(line):
            pending.append((m.group(3), bool(m.group(1))))
    return "\n".join(out)


def split_segments(cmd, posix=True):
    """Split a command line on unquoted ; && || | & ( ) and newlines.

    Returns [(separator_before, text)]."""
    segs, buf = [], []
    state = {"sep": None}
    quote = None
    i, n = 0, len(cmd)

    def flush(new_sep):
        text = "".join(buf).strip()
        if text:
            segs.append((state["sep"], text))
        del buf[:]
        state["sep"] = new_sep

    while i < n:
        ch = cmd[i]
        nxt = cmd[i + 1] if i + 1 < n else ""
        if quote == "'":
            buf.append(ch)
            if ch == "'":
                quote = None
        elif quote in ('"', "`"):
            buf.append(ch)
            if ch == "\\" and posix and nxt:
                buf.append(nxt)
                i += 1
            elif ch == quote:
                quote = None
        elif ch == "\\" and posix and nxt:
            buf.append(ch + nxt)
            i += 1
        elif ch in "'\"`":
            quote = ch
            buf.append(ch)
        elif ch == "#" and (not buf or buf[-1][-1:].isspace()):
            j = cmd.find("\n", i)
            i = n if j < 0 else j
            continue
        elif ch in ";\n":
            flush(";")
        elif ch == "&":
            prev = buf[-1][-1:] if buf else ""
            if nxt == "&":
                flush("&&")
                i += 1
            elif prev in ("<", ">") or nxt == ">":
                buf.append(ch)
            else:
                flush("&")
        elif ch == "|":
            prev = buf[-1][-1:] if buf else ""
            if prev == ">":
                buf.append(ch)
            elif nxt == "|":
                flush("||")
                i += 1
            else:
                flush("|")
                if nxt == "&":
                    i += 1
        elif ch in "()":
            flush(ch)
        else:
            buf.append(ch)
        i += 1
    flush(None)
    return segs


def split_words(text, posix=True):
    """Quote-aware word split. Returns [(raw, value)] with quotes removed from value."""
    words, raw, val = [], [], []
    quote, started = None, False
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if quote is None:
            if ch.isspace():
                if started:
                    words.append(("".join(raw), "".join(val)))
                    raw, val, started = [], [], False
            elif ch == "\\" and posix and nxt:
                raw.append(ch + nxt)
                val.append(nxt)
                i += 1
                started = True
            elif ch in "'\"":
                quote = ch
                raw.append(ch)
                started = True
            else:
                raw.append(ch)
                val.append(ch)
                started = True
        elif quote == "'":
            raw.append(ch)
            if ch == "'":
                quote = None
            else:
                val.append(ch)
        else:
            raw.append(ch)
            if ch == "\\" and posix and nxt in ('"', "\\", "$", "`"):
                raw.append(nxt)
                val.append(nxt)
                i += 1
            elif ch == '"':
                quote = None
            else:
                val.append(ch)
        i += 1
    if started:
        words.append(("".join(raw), "".join(val)))
    return words


def strip_redirs(words):
    """Remove redirections. Returns (words, input_files, stdin_fed)."""
    out, inputs, stdin = [], [], False
    i = 0
    while i < len(words):
        raw, val = words[i]
        m = REDIR_RE.match(raw) if raw[:1] not in ("'", '"') else None
        if m:
            op, rest = m.group(2), m.group(3)
            if op == "<" and rest.startswith("<"):           # heredoc << or here-string <<<
                stdin = True
                i += 2 if rest.lstrip("<-") == "" else 1
                continue
            if rest == "" and i + 1 < len(words):
                target = words[i + 1][1]
                i += 2
            else:
                target = REDIR_RE.match(val).group(3) if REDIR_RE.match(val) else rest
                i += 1
            if op == "<" and target and not target.startswith("&"):
                inputs.append(target)
                stdin = True
            continue
        out.append((raw, val))
        i += 1
    return out, inputs, stdin


def expand(raw, val, env):
    if raw.startswith("'"):
        return val

    def rep(m):
        name = m.group(1) or m.group(2)
        if name in env:
            return env[name]
        if name in ("HOME", "USERPROFILE", "TMPDIR", "PWD") and os.environ.get(name):
            return os.environ[name]
        return m.group(0)
    return VAR_RE.sub(rep, val)


def prog_name(word):
    base = re.split(r"[\\/]", word)[-1].lower()
    return base[:-4] if base.endswith(".exe") else base


def strip_prefixes(vals):
    """Drop shell keywords and wrapper commands. Returns (vals, via_xargs)."""
    via_xargs = False
    while vals:
        w0 = vals[0]
        name = prog_name(w0)
        if w0 in PREFIX_WORDS:
            vals = vals[1:]
        elif name == "env":
            vals = vals[1:]
            while vals and (vals[0].startswith("-") or ASSIGN_RE.match(vals[0])):
                vals = vals[2:] if vals[0] in ("-u", "-C", "-S") else vals[1:]
        elif name == "sudo":
            vals = vals[1:]
            while vals and vals[0].startswith("-"):
                vals = vals[1:]
        elif name in ("timeout", "gtimeout"):
            vals = vals[1:]
            while vals and vals[0].startswith("-"):
                vals = vals[2:] if vals[0] in ("-s", "-k") else vals[1:]
            vals = vals[1:]
        elif name == "xargs":
            via_xargs = True
            vals = vals[1:]
            while vals and vals[0].startswith("-"):
                vals = vals[2:] if vals[0] in XARGS_VALUE_OPTS else vals[1:]
        elif name in ("uv", "pipx") and vals[1:2] == ["run"]:
            vals = vals[2:]
        elif name == "uvx":
            vals = vals[1:]
        elif re.match(r"^(python[0-9.]*|py)$", name) and len(vals) > 2 and vals[1] == "-m":
            vals = vals[2:]
        elif ASSIGN_RE.match(w0) and len(vals) > 1:
            vals = vals[1:]
        else:
            break
    return vals, via_xargs


def grep_paths(cmd0, args):
    """Path arguments and file filters of a grep-like command: (paths, globs, exts)."""
    value_opts = set(GREP_VALUE_OPTS)
    if cmd0 == "rg":
        value_opts |= {"-r", "--replace"}
    positional, globs, types, pattern_given, end = [], [], [], False, False
    i = 0
    while i < len(args):
        a = args[i]
        if not end and a == "--":
            end = True
        elif not end and a.startswith("-") and a != "-":
            name, value = (a.split("=", 1) + [None])[:2]
            if name in ("-e", "--regexp", "-f", "--file") or (a.startswith("-e") and len(a) > 2
                                                                 and not a.startswith("--")):
                pattern_given = True
            if a in value_opts:
                value = args[i + 1] if i + 1 < len(args) else None
                i += 1
            if value is not None:
                if name in ("--include", "-g", "--glob", "--iglob"):
                    globs.append(value)
                elif name in ("-t", "--type") and cmd0 == "rg":
                    types.append(value.lower())
        else:
            positional.append(a)
        i += 1
    if not pattern_given and positional:
        positional = positional[1:]
    exts = None
    if types and all(t in TYPE_EXTS for t in types):
        exts = tuple(e for t in types for e in TYPE_EXTS[t])
    return positional, globs, exts


def is_listing_pattern(pattern):
    """True for a pattern that only lists files ('*', '*.js', '**', '*.{js,ts}', '.git')."""
    last = str(pattern).replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    return bool(LISTING_RE.match(last))


def find_paths(args):
    """(paths, is_listing, name_ok) of a find command. A listing has no positive name
    test beyond extension globs; name_ok tells whether a repo file passes a name test."""
    paths = []
    for a in args:
        if a.startswith("-") or a in ("(", "!", "\\("):
            break
        paths.append(a)
    named = []
    for i, a in enumerate(args[:-1]):
        if a in FIND_NAME_TESTS:
            if (i and args[i - 1] in ("!", "-not")) or args[i + 2:i + 3] == ["-prune"]:
                continue
            if not is_listing_pattern(args[i + 1]):
                named.append((a, args[i + 1]))
    if not named:
        return paths or ["."], True, None

    def name_ok(rel):
        f = rel.lower()
        for test, pat in named:
            p = pat.lower()
            if test in ("-name", "-iname"):
                if fnmatch.fnmatchcase(f.rsplit("/", 1)[-1], p):
                    return True
            elif test in ("-regex", "-iregex"):
                try:
                    if re.search(pat, "./" + rel, re.I):
                        return True
                except re.error:
                    return True
            elif fnmatch.fnmatchcase(f, p) or fnmatch.fnmatchcase(f, "*" + p.lstrip("./*")):
                return True
        return False
    return paths or ["."], False, name_ok


def fd_paths(args):
    """(paths, is_listing, name_ok) of an fd command."""
    glob_mode = any(a in ("-g", "--glob") for a in args)
    full_path = any(a in ("-p", "--full-path") for a in args)
    positional, i = [], 0
    while i < len(args):
        a = args[i]
        if a in ("-x", "-X", "--exec", "--exec-batch"):
            break
        if a.startswith("--search-path"):
            if "=" in a:
                positional.append(a.split("=", 1)[1])
            elif i + 1 < len(args):
                positional.append(args[i + 1])
                i += 1
        elif a.startswith("-"):
            if a in FD_VALUE_OPTS:
                i += 1
        else:
            positional.append(a)
        i += 1
    pattern = positional[0] if positional else ""
    paths = positional[1:] or ["."]
    if pattern in ("", ".", "^") or is_listing_pattern(pattern) or re.match(r"^\\?\.\w+\$?$", pattern):
        return paths, True, None

    def name_ok(rel):
        target = rel if full_path else rel.rsplit("/", 1)[-1]
        if glob_mode:
            return fnmatch.fnmatchcase(target.lower(), pattern.lower())
        try:
            return bool(re.search(pattern, target, 0 if pattern != pattern.lower() else re.I))
        except re.error:
            return True
    return paths, False, name_ok


def ps_search_paths(cmd0, args):
    if cmd0 == "findstr":
        pos = [a for a in args if not a.startswith("/")]
        return pos[1:]
    paths, i = [], 0
    while i < len(args):
        if args[i].lower() in ("-path", "-literalpath") and i + 1 < len(args):
            paths.append(args[i + 1])
            i += 1
        i += 1
    return paths


def analyse_shell(project, cmd, cwd, ps=False, depth=0):
    """Events of one shell command, in order: ('graph', kind), ('code_read', rel),
    ('search', code_scope, text). Returns (events, error_or_None)."""
    events = []
    if not isinstance(cmd, str) or not cmd.strip():
        return events, None
    posix = not ps
    try:
        body = strip_heredocs(cmd) if posix else cmd
        env = {}
        for sep, seg in split_segments(body, posix):
            words, inputs, stdin = strip_redirs(split_words(seg, posix))
            vals = [expand(r, v, env) for r, v in words]
            if vals and all(ASSIGN_RE.match(v) for v in vals):
                for v in vals:                       # H=/some/dir; cd $H
                    m = ASSIGN_RE.match(v)
                    env[m.group(1)] = m.group(2)
                continue
            vals, via_xargs = strip_prefixes(vals)
            if not vals:
                continue
            cmd0, args = prog_name(vals[0]), vals[1:]
            if cmd0 == "git" and args[:1] == ["grep"]:
                cmd0, args = "git-grep", args[1:]
            if cmd0 in ("cd", "pushd", "chdir", "set-location", "sl"):
                target = next((a for a in args if not a.startswith("-") or a == "-"), None)
                if target == "-":
                    continue
                cwd = resolve(target, cwd) if target else os.path.expanduser("~")
            elif cmd0 == "export":
                for a in args:
                    m = ASSIGN_RE.match(a)
                    if m:
                        env[m.group(1)] = m.group(2)
            elif cmd0 in ("bash", "sh", "zsh", "dash") and depth < 3:
                for j, a in enumerate(args[:-1]):
                    if re.match(r"^-[a-z]*c[a-z]*$", a):
                        sub, _ = analyse_shell(project, args[j + 1], cwd, False, depth + 1)
                        events.extend(sub)
                        break
            elif cmd0 == "graphify":
                sub = args[0].lower() if args else ""
                kind = GRAPH_SUBS.get(sub)
                if kind == "query":
                    seeded = any(a == "--seed" or a.startswith("--seed=") for a in args)
                    kind = "by_name" if seeded else "prose"
                if kind:
                    events.append(("graph", kind))
            elif cmd0 in READ_CMDS or (ps and cmd0 in PS_READ_CMDS):
                if cmd0 == "sed" and not any(re.match(r"^-[A-Za-z]*n[A-Za-z]*$", a) for a in args):
                    continue
                seen = []
                for a in [x for x in args if not x.startswith("-")] + inputs:
                    p = resolve(a, cwd)
                    if not p:
                        continue
                    hits = project.code_glob(p) if GLOB_CHARS.search(p) else [project.code_file(p)]
                    for h in hits or []:
                        if h and h not in seen:
                            seen.append(h)
                for h in seen:
                    events.append(("code_read", h, "%s %s" % (cmd0, h)))
            elif cmd0 in GREP_CMDS or cmd0 in ("find", "fd", "fdfind", "git-grep") or (
                    ps and cmd0 in PS_SEARCH_CMDS):
                listing, globs, exts, name_ok = False, None, None, None
                if cmd0 == "find":
                    paths, listing, name_ok = find_paths(args)
                elif cmd0 in ("fd", "fdfind"):
                    paths, listing, name_ok = fd_paths(args)
                elif cmd0 in PS_SEARCH_CMDS:
                    paths = ps_search_paths(cmd0, args)
                else:
                    paths, globs, exts = grep_paths(cmd0, args)
                    listing = cmd0 == "rg" and "--files" in args
                paths = paths or inputs
                if not paths and (sep == "|" or stdin) and not via_xargs:
                    continue                      # a filter on piped or fed input, not a search
                scopes = [resolve(p, cwd) for p in paths] if paths else [cwd]
                code = not listing and any(project.code_scope(s, globs, exts, name_ok)
                                           for s in scopes if s)
                events.append(("search", code, short(seg, 90)))
        return events, None
    except Exception as e:                          # never let one odd command stop the audit
        events = []
        for m in GRAPH_RE.finditer(cmd):
            sub = m.group(1).lower()
            kind = GRAPH_SUBS[sub]
            if kind == "query":
                tail = cmd[m.end():].split(";")[0].split("&&")[0].split("|")[0]
                kind = "by_name" if "--seed" in tail else "prose"
            events.append(("graph", kind))
        return events, "%s: %s" % (type(e).__name__, e)


# --------------------------------------------------------------- transcripts

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict) and isinstance(b.get("text"), str):
                parts.append(b["text"])
            elif isinstance(b, str):
                parts.append(b)
        return "\n".join(parts)
    return ""


def is_gate_denial(is_error, text):
    # A blocked call comes back as an error whose text starts with the gate's reason,
    # usually behind "PreToolUse:<Tool> hook error: ". Tests that merely print the
    # gate's messages are not errors, or carry the text further down.
    head = text[:400]
    if not is_error or "Graph gate:" not in head:
        return False
    return head.lstrip().startswith("Graph gate:") or "hook" in head[:head.find("Graph gate:")].lower()


def load_transcript(path):
    """Tool uses in order, results by id, and the first/last timestamp."""
    uses, results, seen = [], {}, set()
    first = last = None
    try:
        f = open(path, encoding="utf-8", errors="replace")
    except OSError:
        return uses, results, first, last
    with f:
        for line in f:
            ts = None
            if "tool_use" not in line and "tool_result" not in line:
                m = TS_RE.search(line)
                ts = m.group(1) if m else None
                o = None
            else:
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(o, dict):
                    continue
                ts = o.get("timestamp") if isinstance(o.get("timestamp"), str) else None
            if ts:
                first = ts if first is None or ts < first else first
                last = ts if last is None or ts > last else last
            if o is None:
                continue
            msg = o.get("message")
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            kind = o.get("type")
            for b in content:
                if not isinstance(b, dict):
                    continue
                if kind == "assistant" and b.get("type") == "tool_use":
                    tid = b.get("id")
                    if tid is not None:
                        if tid in seen:
                            continue
                        seen.add(tid)
                    inp = b.get("input") if isinstance(b.get("input"), dict) else {}
                    uses.append({"id": tid, "name": str(b.get("name") or ""), "input": inp,
                                 "cwd": o.get("cwd") if isinstance(o.get("cwd"), str) else None})
                elif kind == "user" and b.get("type") == "tool_result":
                    tid = b.get("tool_use_id")
                    if tid is not None:
                        results[tid] = is_gate_denial(b.get("is_error"), text_of(b.get("content")))
    return uses, results, first, last


def tool_events(project, use):
    """Classify one tool call. Returns (events, parse_error)."""
    name, inp, cwd = use["name"], use["input"], use["cwd"]
    if name.startswith("mcp__") and "graphify" in (name.split("__") + ["", ""])[1].lower():
        return [("graph", "mcp")], None
    if name in ("Bash", "PowerShell"):
        return analyse_shell(project, inp.get("command"), cwd, ps=(name == "PowerShell"))
    if name == "Read":
        p = resolve(inp.get("file_path"), cwd)
        if not p:
            return [], None
        kind, what = project.read_kind(p)
        if kind == "code":
            return [("code_read", what, "Read " + what)], None
        return [("other_read", what)], None
    if name == "Grep":
        scope = resolve(inp.get("path") or ".", cwd)
        exts = TYPE_EXTS.get(str(inp.get("type") or "").lower())
        glob = inp.get("glob") if isinstance(inp.get("glob"), str) else None
        code = project.code_scope(scope, globs=[glob] if glob else None, exts=exts)
        return [("search", code, short("Grep %s %s" % (inp.get("pattern", ""), inp.get("path") or ""), 90))], None
    if name == "Glob":
        pattern = inp.get("pattern") if isinstance(inp.get("pattern"), str) else ""
        base = resolve(inp.get("path") or ".", cwd)
        code = False
        if base and not is_listing_pattern(pattern):
            full = pattern if os.path.isabs(pattern.replace("\\", "/")) else os.path.join(base, pattern)
            for p in expand_braces(full.replace("\\", "/")):
                prefix = re.split(r"[*?\[]", p, 1)[0].rsplit("/", 1)[0] or "/"
                if project.rel(prefix) is None:
                    last = p.rsplit("/", 1)[-1].lower()
                    code = project.is_root_ancestor(prefix) and project.code_scope(
                        prefix, name_ok=lambda r: fnmatch.fnmatchcase(r.rsplit("/", 1)[-1].lower(), last))
                else:
                    code = bool(project.code_glob(p)) or (not GLOB_CHARS.search(p) and project.code_scope(p))
                if code:
                    break
        return [("search", code, short("Glob %s %s" % (pattern, inp.get("path") or ""), 90))], None
    if name in ("Agent", "Task") and str(inp.get("subagent_type") or "") == "graph-scout":
        return [("scout",)], None
    return [], None


def new_counts():
    return {"graph": dict((k, 0) for k in GRAPH_KINDS), "code_reads": 0, "code_reads_after_graph": 0,
            "other_reads": {"docs": 0, "graphify_out": 0, "repo_other": 0, "outside_repo": 0},
            "searches": 0, "code_searches": 0, "denied": 0, "scout_delegations": 0, "tool_calls": 0}


def analyse_agent(project, path, sid, agent_id, meta):
    uses, denials, first, last = load_transcript(path)
    c = new_counts()
    first_graph = first_read = first_search = first_any_search = first_touch = None
    early, parse_errors = [], 0
    for idx, use in enumerate(uses, 1):
        c["tool_calls"] += 1
        if use["id"] is not None and denials.get(use["id"]):
            c["denied"] += 1
            continue
        events, err = tool_events(project, use)
        parse_errors += 1 if err else 0
        for j, ev in enumerate(events):
            pos = (idx, j)
            if ev[0] == "search" and first_any_search is None:
                first_any_search = pos
            if ev[0] == "graph":
                c["graph"][ev[1]] += 1
                if first_graph is None:
                    first_graph = pos
            elif ev[0] == "scout":
                c["scout_delegations"] += 1
            elif ev[0] == "other_read":
                c["other_reads"][ev[1]] += 1
            elif ev[0] == "code_read" or (ev[0] == "search" and ev[1]):
                if ev[0] == "code_read":
                    c["code_reads"] += 1
                    if first_graph is not None:
                        c["code_reads_after_graph"] += 1
                    first_read = first_read or pos
                else:
                    c["searches"] += 1
                    c["code_searches"] += 1
                    first_search = first_search or pos
                if first_touch is None:
                    first_touch = {"index": idx, "what": ev[2]}
                if first_graph is None:
                    early.append({"index": idx, "what": ev[2]})
            elif ev[0] == "search":
                c["searches"] += 1
    meta = meta or {}
    agent_type = meta.get("agentType") if isinstance(meta.get("agentType"), str) else None
    desc = meta.get("description") if isinstance(meta.get("description"), str) else None
    if agent_id == "main":
        label = "main"
    else:
        label = desc or agent_type or ("agent-" + agent_id)
    return {"session": sid, "agent_id": agent_id, "label": label,
            "agent_type": agent_type or ("main" if agent_id == "main" else None),
            "transcript": path, "start": first, "end": last,
            "counts": c,
            "graph_calls": sum(c["graph"].values()),
            "first_graph_call": first_graph[0] if first_graph else None,
            "first_code_read": first_read[0] if first_read else None,
            "first_code_search": first_search[0] if first_search else None,
            "first_search": first_any_search[0] if first_any_search else None,
            "first_code_touch": first_touch,
            "code_touches_before_graph": len(early),
            "first_early_touch": early[0] if early else None,
            "unparsed_commands": parse_errors,
            "has_assistant_calls": bool(uses)}


# ------------------------------------------------------------------ sessions

def slug(path):
    return re.sub(r"[^A-Za-z0-9]", "-", path)


def transcript_dirs(project):
    base = os.environ.get("CLAUDE_CONFIG_DIR")
    base = os.path.expanduser(base) if base else os.path.join(os.path.expanduser("~"), ".claude")
    pdir = os.path.join(base, "projects")
    try:
        entries = sorted(os.listdir(pdir))
    except OSError:
        return pdir, []
    found = []
    for r in project.roots:
        s = slug(r).lower()
        for e in entries:
            el = e.lower()
            if el == s or (len(s) > 200 and el.startswith(s[:200])):
                p = os.path.join(pdir, e)
                if os.path.isdir(p) and p not in found:
                    found.append(p)
    return pdir, found


def find_sessions(dirs):
    sessions = {}
    for d in dirs:
        try:
            entries = os.listdir(d)
        except OSError:
            continue
        names = set(entries)
        for e in entries:
            p = os.path.join(d, e)
            if e.endswith(".jsonl") and os.path.isfile(p):
                s = sessions.setdefault(e[:-6], {"id": e[:-6], "main": None, "dirs": []})
                s["main"] = p
            elif os.path.isdir(p) and (e + ".jsonl" in names or os.path.isdir(os.path.join(p, "subagents"))):
                sessions.setdefault(e, {"id": e, "main": None, "dirs": []})["dirs"].append(p)
    for s in sessions.values():
        files = [s["main"]] if s["main"] else []
        for d in s["dirs"]:
            for dp, dn, fn in os.walk(d):
                dn.sort()
                for name in sorted(fn):
                    if name.endswith(".jsonl"):
                        files.append(os.path.join(dp, name))
        s["subagent_files"] = [f for f in files if f != s["main"]]
        mt = 0.0
        for f in files:
            try:
                mt = max(mt, os.path.getmtime(f))
            except OSError:
                pass
        s["mtime"] = mt
    return [s for s in sessions.values() if s["main"] or s["subagent_files"]]


def read_meta(jsonl):
    p = jsonl[:-6] + ".meta.json"
    try:
        with open(p, encoding="utf-8", errors="replace") as f:
            m = json.load(f)
        return m if isinstance(m, dict) else {}
    except (OSError, ValueError):
        return {}


# ------------------------------------------------------------------ gate log

def gate_log_paths():
    """The project graph gate's log first, then the machine-wide gate's (when installed):
    $GRAPH_GATE_PROJECT_STATE or <machine state>/project, and $GRAPH_GATE_STATE or
    ~/.cache/claude-graph-gate."""
    machine = os.environ.get("GRAPH_GATE_STATE")
    machine = os.path.expanduser(machine) if machine else os.path.join(
        os.path.expanduser("~"), ".cache", "claude-graph-gate")
    proj = os.environ.get("GRAPH_GATE_PROJECT_STATE")
    proj = os.path.expanduser(proj) if proj else os.path.join(machine, "project")
    return [os.path.join(proj, "usage.log"), os.path.join(machine, "usage.log")]


def read_gate_log(project, sids):
    paths = [p for p in gate_log_paths() if os.path.isfile(p)]
    out = {"path": ", ".join(paths) or gate_log_paths()[0], "paths": paths,
           "exists": bool(paths), "asked": 0, "located": 0, "denied": 0, "stop_block": 0,
           "rows": 0, "recent_denied": []}
    base = os.path.basename(os.path.realpath(project.root).rstrip("\\/")).lower()
    denied, seen = [], set()
    for path in paths:
        which = "project" if os.path.basename(os.path.dirname(path)) == "project" else "machine"
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    parts = line.rstrip("\r\n").split("\t", 5)
                    if len(parts) < 6:
                        continue
                    ts, repo, sid, agent, tool, what = parts
                    if repo.strip().lower() != base or sid.strip() not in sids:
                        continue
                    key = (ts, sid, agent, what[:120])
                    if key in seen:
                        continue               # both gates logged the same event
                    seen.add(key)
                    out["rows"] += 1
                    head = what.split(" ", 1)[0]
                    if head == "ASKED":
                        out["asked"] += 1
                    elif head == "LOCATED":
                        out["located"] += 1
                    elif head == "DENIED":
                        out["denied"] += 1
                        denied.append((ts, short("%s  [%s gate]  %s  %s  %s"
                                                 % (ts, which, agent, tool, what), 160)))
                    elif head == "STOP-BLOCK":
                        out["stop_block"] += 1
        except OSError:
            pass
    denied.sort()
    out["recent_denied"] = [d for _, d in denied[-5:][::-1]]
    return out


# ------------------------------------------------------------------ report

def fmt_time(ts):
    if not ts:
        return "?"
    try:
        s = ts.replace("Z", "+00:00")
        m = re.match(r"^(.*T\d\d:\d\d:\d\d)(\.\d+)?(.*)$", s)
        if m:
            frac = (m.group(2) or "")[:7]
            s = m.group(1) + (frac.ljust(7, "0") if frac else "") + m.group(3)
        d = datetime.datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=datetime.timezone.utc)
        return d.astimezone().strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return ts[:16].replace("T", " ")


def build(project, chosen, pdir, dirs, selection):
    agents = []
    sessions_out = []
    for s in chosen:
        sess_agents = []
        if s["main"]:
            sess_agents.append(analyse_agent(project, s["main"], s["id"], "main", None))
        for f in s["subagent_files"]:
            stem = os.path.basename(f)[:-6]
            aid = stem[6:] if stem.startswith("agent-") else stem
            a = analyse_agent(project, f, s["id"], aid, read_meta(f))
            if a["has_assistant_calls"] or stem.startswith("agent-"):
                sess_agents.append(a)
        starts = [a["start"] for a in sess_agents if a["start"]]
        ends = [a["end"] for a in sess_agents if a["end"]]
        sessions_out.append({"id": s["id"], "agents": len(sess_agents),
                             "start": min(starts) if starts else None,
                             "end": max(ends) if ends else None,
                             "mtime": datetime.datetime.fromtimestamp(s["mtime"]).strftime(
                                 "%Y-%m-%d %H:%M:%S") if s["mtime"] else None})
        agents.extend(sess_agents)

    t = new_counts()
    for a in agents:
        c = a["counts"]
        for k in GRAPH_KINDS:
            t["graph"][k] += c["graph"][k]
        for k in t["other_reads"]:
            t["other_reads"][k] += c["other_reads"][k]
        for k in ("code_reads", "code_reads_after_graph", "searches", "code_searches", "denied",
                  "scout_delegations", "tool_calls"):
            t[k] += c[k]
    graph_calls = sum(t["graph"].values())
    graph_queries = graph_calls - t["graph"]["rebuild"]
    ratios = {
        "graph_calls_per_code_read": round(graph_calls / float(t["code_reads"]), 2) if t["code_reads"] else None,
        "graph_queries_per_code_read": round(graph_queries / float(t["code_reads"]), 2) if t["code_reads"] else None,
        "code_reads_after_first_graph_call": t["code_reads_after_graph"],
        "code_reads_after_first_graph_share": round(t["code_reads_after_graph"] / float(t["code_reads"]), 3)
        if t["code_reads"] else None,
    }
    touched = [a for a in agents if a["counts"]["code_reads"] or a["counts"]["code_searches"]]
    no_graph = [a for a in touched if not a["graph_calls"]]
    early = [a for a in touched if a["graph_calls"] and a["code_touches_before_graph"]]
    gaps = len(no_graph) + len(early)
    sids = set(s["id"] for s in chosen)
    starts = [s["start"] for s in sessions_out if s["start"]]
    ends = [s["end"] for s in sessions_out if s["end"]]
    return {
        "project": project.root,
        "graph": {"path": project.graph_path, "indexed_code_files": len(project.code),
                  "error": project.graph_error},
        "transcripts": {"projects_dir": pdir, "matched_dirs": dirs},
        "selection": selection,
        "sessions": sessions_out,
        "time_span": {"start": min(starts) if starts else None, "end": max(ends) if ends else None},
        "totals": {"graph_by_name": t["graph"]["by_name"], "graph_prose": t["graph"]["prose"],
                   "graph_god_nodes": t["graph"]["other"], "graph_mcp": t["graph"]["mcp"],
                   "graph_rebuilds": t["graph"]["rebuild"], "graph_calls": graph_calls,
                   "graph_queries": graph_queries, "graph_scout_delegations": t["scout_delegations"],
                   "code_reads": t["code_reads"], "other_reads": t["other_reads"],
                   "other_reads_total": sum(t["other_reads"].values()),
                   "searches": t["searches"], "code_searches": t["code_searches"],
                   "gate_denials": t["denied"], "tool_calls": t["tool_calls"], "agents": len(agents)},
        "ratios": ratios,
        "agents": [dict((k, v) for k, v in a.items() if k != "has_assistant_calls") for a in agents],
        "agents_without_graph": [agent_ref(a) for a in no_graph],
        "agents_touching_code_before_graph": [agent_ref(a) for a in early],
        "gate_log": read_gate_log(project, sids),
        "verdict": {"ok": gaps == 0, "gaps": gaps,
                    "text": "Graph-first: OK" if gaps == 0 else "Graph-first: GAPS (%d agent%s)"
                    % (gaps, "" if gaps == 1 else "s")},
    }


def agent_ref(a):
    c = a["counts"]
    return {"session": a["session"], "agent_id": a["agent_id"], "label": a["label"],
            "agent_type": a["agent_type"], "code_reads": c["code_reads"],
            "code_searches": c["code_searches"], "graph_calls": a["graph_calls"],
            "first_graph_call": a["first_graph_call"], "first_code_touch": a["first_code_touch"],
            "code_touches_before_graph": a["code_touches_before_graph"],
            "first_early_touch": a["first_early_touch"]}


def ref_name(r, many_sessions):
    if r["agent_id"] == "main":
        name = "main"
    else:
        name = '"%s" (%s, %s)' % (short(r["label"], 50), r["agent_type"] or "agent", r["agent_id"][:8])
    return name + (" [session %s]" % r["session"][:8] if many_sessions else "")


def pct(n, d):
    return "n/a" if not d else "%d%%" % round(100.0 * n / d)


def print_text(rep):
    t, r = rep["totals"], rep["ratios"]
    many = len(rep["sessions"]) > 1
    say("Graph usage audit - %s" % os.path.basename(rep["project"].rstrip("\\/")))
    say("Project:    %s" % rep["project"])
    g = rep["graph"]
    say("Graph:      %s (%d indexed code files)%s" % (
        os.path.relpath(g["path"], rep["project"]) if g["path"].startswith(rep["project"]) else g["path"],
        g["indexed_code_files"], "  [unreadable: %s]" % g["error"] if g["error"] else ""))
    ids = ", ".join(s["id"][:8] for s in rep["sessions"][:6])
    if len(rep["sessions"]) > 6:
        ids += ", +%d more" % (len(rep["sessions"]) - 6)
    say("Sessions:   %d (%s): %s; %d agent transcripts" % (len(rep["sessions"]), rep["selection"], ids or "-",
                                                         t["agents"]))
    span = rep["time_span"]
    say("Time span:  %s -> %s (local time)" % (fmt_time(span["start"]), fmt_time(span["end"])))
    say("")
    say("Totals (%d tool calls)" % t["tool_calls"])
    say("  Graph calls    %4d  by name %d, prose %d, god-nodes %d, MCP %d, rebuilds %d%s" % (
        t["graph_calls"], t["graph_by_name"], t["graph_prose"], t["graph_god_nodes"], t["graph_mcp"],
        t["graph_rebuilds"], "; +%d graph-scout delegations" % t["graph_scout_delegations"]
        if t["graph_scout_delegations"] else ""))
    say("  Code reads     %4d  indexed code files via Read or cat/head/tail/sed -n/awk/nl/bat/less" % t["code_reads"])
    o = t["other_reads"]
    say("  Other reads    %4d  Read of docs/research/raw %d, graphify-out %d, other in repo %d, outside repo %d" % (
        t["other_reads_total"], o["docs"], o["graphify_out"], o["repo_other"], o["outside_repo"]))
    say("  Searches       %4d  aimed at indexed code %d; other %d (outside code, listings, extension globs)" % (
        t["searches"], t["code_searches"], t["searches"] - t["code_searches"]))
    say("  Gate denials   %4d  calls the graph gate blocked (not counted above)" % t["gate_denials"])
    say("")
    say("Ratios")
    if t["code_reads"]:
        say("  Graph calls per code read:  %.2f  (%d / %d; %.2f without rebuilds)" % (
            r["graph_calls_per_code_read"], t["graph_calls"], t["code_reads"], r["graph_queries_per_code_read"]))
    else:
        say("  Graph calls per code read:  n/a  (%d graph calls, no code reads)" % t["graph_calls"])
    say("  Code reads after the agent's first graph call:  %d / %d (%s)" % (
        r["code_reads_after_first_graph_call"], t["code_reads"],
        pct(r["code_reads_after_first_graph_call"], t["code_reads"])))
    say("")
    ng = rep["agents_without_graph"]
    say("Agents that read or searched code with NO graph call: %d" % len(ng))
    for a in ng:
        ft = a["first_code_touch"] or {}
        say("  - %s: %d code reads, %d code searches; first #%s %s" % (
            ref_name(a, many), a["code_reads"], a["code_searches"], ft.get("index", "?"), short(ft.get("what", ""), 70)))
    say("")
    ea = rep["agents_touching_code_before_graph"]
    say("Agents that read or searched code BEFORE their first graph call: %d" % len(ea))
    for a in ea:
        fe = a["first_early_touch"] or {}
        say("  - %s: %d early, first #%s %s; first graph call #%s" % (
            ref_name(a, many), a["code_touches_before_graph"], fe.get("index", "?"),
            short(fe.get("what", ""), 60), a["first_graph_call"]))
    say("")
    gl = rep["gate_log"]
    if not gl["exists"]:
        say("Gate log:   %s not found" % gl["path"])
    else:
        say("Gate log:   %s (%d rows for these sessions)" % (gl["path"], gl["rows"]))
        say("  ASKED %d, LOCATED %d, DENIED %d, STOP-BLOCK %d"
            % (gl["asked"], gl["located"], gl["denied"], gl["stop_block"]))
        if gl["recent_denied"]:
            say("  Most recent DENIED:")
            for line in gl["recent_denied"]:
                say("    " + line)
    say("")
    say(rep["verdict"]["text"])


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(errors="replace")
        except (ValueError, OSError):
            pass
    ap = argparse.ArgumentParser(description="Audit Graphify knowledge-graph use by Claude Code agents.")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--session", metavar="ID", help="one session id (a unique prefix is enough)")
    g.add_argument("--last", metavar="N", type=int, help="the N newest sessions by mtime (default 1)")
    g.add_argument("--all", action="store_true", help="every session of this project")
    ap.add_argument("--root", metavar="PATH", help="project root (default: the repo holding this script)")
    ap.add_argument("--json", action="store_true", help="print one JSON object instead of the text report")
    args = ap.parse_args(argv)

    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.realpath(os.path.abspath(os.path.expanduser(args.root))) if args.root else \
        os.path.realpath(os.path.join(here, "..", "..", ".."))
    project = Project(root)
    pdir, dirs = transcript_dirs(project)
    sessions = sorted(find_sessions(dirs), key=lambda s: s["mtime"], reverse=True)
    if args.session:
        chosen = [s for s in sessions if s["id"] == args.session] or \
            [s for s in sessions if s["id"].startswith(args.session)]
        if len(chosen) != 1:
            sys.stderr.write("usage.py: %s session matches '%s' under %s\n" % (
                "no" if not chosen else "more than one", args.session, ", ".join(dirs) or pdir))
            return 2
        selection = "session %s" % chosen[0]["id"][:8]
    elif args.all:
        chosen, selection = sessions, "all"
    else:
        n = 1 if args.last is None else args.last
        if n < 1:
            sys.stderr.write("usage.py: --last needs N >= 1\n")
            return 2
        chosen, selection = sessions[:n], "newest %d by mtime" % n if n > 1 else "newest by mtime"
    if not chosen:
        sys.stderr.write("usage.py: no Claude Code transcripts for %s (looked in %s)\n" % (
            root, ", ".join(dirs) or os.path.join(pdir, slug(root))))
        return 1
    rep = build(project, chosen, pdir, dirs, selection)
    if args.json:
        say(json.dumps(rep, indent=2, sort_keys=False))
    else:
        print_text(rep)
    return 0


if __name__ == "__main__":
    try:
        code = main()
        sys.stdout.flush()
    except BrokenPipeError:                       # e.g. piped into head
        try:
            devnull = os.open(os.devnull, os.O_WRONLY)
            os.dup2(devnull, sys.stdout.fileno())
        except OSError:
            pass
        code = 0
    except KeyboardInterrupt:
        code = 130
    sys.exit(code)
