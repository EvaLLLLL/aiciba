# Sourced by the workflow's entry points; leaves the chosen binary in NODE_BIN
# (empty when nothing suitable exists).
#
# Alfred hands scripts a minimal PATH, so nvm/fnm/mise/volta shims are all
# invisible here. Check the usual places, fall back to the user's login shell,
# and remember the answer so only the first run pays for the search.

aiciba_cache="${alfred_workflow_cache:-${TMPDIR:-/tmp}/aiciba-alfred}"
aiciba_node_hint="$aiciba_cache/node-path"

aiciba_node_ok() {
  [ -n "${1:-}" ] && [ -x "$1" ] &&
    "$1" -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)' \
      >/dev/null 2>&1
}

aiciba_find_node() {
  local candidate
  local candidates=()

  # The workflow's own configuration wins, then anything already on PATH.
  candidates+=("${aiciba_node:-}" "$(command -v node 2>/dev/null)")
  candidates+=(/opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node)
  candidates+=("$HOME/.volta/bin/node" "$HOME/.local/share/mise/shims/node")
  candidates+=("$HOME/.local/bin/node" "$HOME/.bun/bin/node")

  # Version-manager installs, newest first. Read line by line: some of these
  # paths contain spaces.
  while IFS= read -r candidate; do
    [ -n "$candidate" ] && candidates+=("$candidate")
  done < <(ls -t \
    "$HOME"/.nvm/versions/node/*/bin/node \
    "$HOME"/.asdf/installs/nodejs/*/bin/node \
    "$HOME"/.local/share/mise/installs/node/*/bin/node \
    "$HOME/Library/Application Support/fnm/node-versions"/*/installation/bin/node \
    2>/dev/null)

  for candidate in "${candidates[@]}"; do
    if aiciba_node_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  # Last resort: ask the login shell, which knows about the exotic setups.
  local flags
  for flags in -lc -lic; do
    candidate="$("${SHELL:-/bin/zsh}" "$flags" 'command -v node' 2>/dev/null |
      tail -n 1 | tr -d '[:space:]')"
    if aiciba_node_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN="$(cat "$aiciba_node_hint" 2>/dev/null)"

# An executable hint is taken on trust. Re-running the version probe would spawn
# a Node process on every keystroke, which is the cost that caching it exists to
# avoid; a hint gone stale fails the run below and the search repeats.
if [ ! -x "${NODE_BIN:-/nonexistent}" ]; then
  NODE_BIN="$(aiciba_find_node)" || NODE_BIN=""
  if [ -n "$NODE_BIN" ]; then
    mkdir -p "$aiciba_cache" && printf '%s' "$NODE_BIN" >"$aiciba_node_hint"
  fi
fi
