#!/bin/bash
# Runs for the rows the filter marks `mode=run`: open this workflow's
# configuration, browse a word already cached, or ask the model for a new one.
# Either way it ends by re-opening Alfred on the same keyword, where the Script
# Filter shows progress and then the definition.
set -uo pipefail

workflow="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=node.sh
. "$workflow/scripts/node.sh"

reveal_configuration() {
  /usr/bin/osascript - "${alfred_workflow_bundleid:-com.evalllll.aiciba}" <<'APPLESCRIPT'
on run argv
  tell application id "com.runningwithcrayons.Alfred" to reveal workflow (item 1 of argv) configuration true
end run
APPLESCRIPT
}

reopen_alfred() {
  /usr/bin/osascript - "$1" <<'APPLESCRIPT'
on run argv
  tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)
end run
APPLESCRIPT
}

if [ "${action:-lookup}" = 'setup' ]; then
  reveal_configuration
  exit 0
fi

word="${1:-}"
[ -n "$word" ] || exit 0

# Hashed as-is: `tr '[:upper:]' '[:lower:]'` folds ASCII only, so folding here
# would part company with state.ts on the first accented word. Both sides are
# handed the same sanitized query, which is the string that has to match.
marker() {
  printf '%s' "$word" | /usr/bin/shasum -a 1 | cut -d ' ' -f 1
}

start_lookup() {
  local slot
  slot="$(marker)"
  mkdir -p "$aiciba_cache/pending" "$aiciba_cache/error"

  # Claim "pending" from the shell, not from Node: Alfred re-opens and re-runs
  # the filter well before a 1.5 MB bundle has finished booting, and a missing
  # marker would offer to look up a word already in flight.
  printf '%s' "$word" >"$aiciba_cache/pending/$slot"
  rm -f "$aiciba_cache/error/$slot"

  if [ -z "${NODE_BIN:-}" ]; then
    printf '%s' '{"message":"AICIBA needs Node.js 18 or newer","suggestions":[]}' \
      >"$aiciba_cache/error/$slot"
    rm -f "$aiciba_cache/pending/$slot"
    return
  fi

  # Detached: this action has to return now so the filter can poll for the answer.
  nohup "$NODE_BIN" "$workflow/lookup.js" "$word" ${1:+--force} \
    >/dev/null 2>&1 &
}

case "${action:-lookup}" in
  refresh) start_lookup force ;;
  *) start_lookup ;;
esac

reopen_alfred "${ciba_keyword:-c} $word"
