#!/bin/bash
# Script Filter: every row comes from ~/.aiciba, so typing costs nothing.
set -uo pipefail

workflow="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=node.sh
. "$workflow/scripts/node.sh"

if [ -z "${NODE_BIN:-}" ]; then
  printf '%s' '{"items":[{"title":"AICIBA needs Node.js 18 or newer","subtitle":"Install Node, or set “Node Path” in this workflow’s configuration","valid":false}]}'
  exit 0
fi

export AICIBA_PRONOUNCE="$workflow/scripts/pronounce.sh"

exec "$NODE_BIN" "$workflow/filter.js" "${1:-}"
