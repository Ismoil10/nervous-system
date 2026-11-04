#!/bin/sh
# Launch the project graph gate (gate.py) or the usage audit (usage.py) with the first
# Python 3 on this machine. Claude Code runs hook commands with sh on macOS/Linux and
# Git Bash on Windows (without Git Bash it falls back to PowerShell, where this launcher
# cannot run and the gate is off), so this one launcher serves every platform.
#   sh .claude/hooks/graph-gate/run.sh <session-start|prompt|pre|post|stop|subagent-start>
#   sh .claude/hooks/graph-gate/run.sh usage [--last N | --session ID | --all] [--json]
# Fails open: with no usable Python the hook prints nothing and exits 0.
here=$(dirname "$0")
script="$here/gate.py"
if [ "$1" = usage ]; then
  shift
  script="$here/usage.py"
fi
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) order="python py python3" ;;   # python.org installs: python, py
  *) order="python3 python" ;;
esac
for py in "$GRAPH_GATE_PYTHON" $order; do
  [ -n "$py" ] || continue
  p=$(command -v "$py" 2>/dev/null) || continue
  case "$p" in
    *WindowsApps*)
      # the Microsoft Store's App Execution Alias: a real Python once installed from the
      # Store, a stub that opens the Store when not - run it only if it really is Python
      "$p" -c "import sys" >/dev/null 2>&1 || continue ;;
  esac
  if [ "$py" = py ]; then
    exec "$p" -3 "$script" "$@"
  fi
  exec "$p" "$script" "$@"
done
exit 0
