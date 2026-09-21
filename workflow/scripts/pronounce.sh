#!/bin/bash
# Plays a word out loud. With --prefetch it only warms the cache, so that the
# play itself starts from disk.
#
# Recordings come from Youdao's dictionary voice endpoint — the one Chinese
# dictionary apps use: plain MP3, no key, and it speaks a dozen languages, not
# only English. Playback goes through NSSound rather than `afplay`, which spends
# about a second on CoreAudio startup before the first sample. macOS speech is
# the last resort, for the languages and words the endpoint has no voice for.
set -uo pipefail

prefetch=''
if [ "${1:-}" = '--prefetch' ]; then
  prefetch=1
  shift
fi

word="${1:-}"
[ -n "$word" ] || exit 0

# The language of the words being looked up. The Script Filter sends it along
# with every result, so it follows `ciba --config` without being set twice.
language="${AICIBA_ENTRY_LANGUAGE:-en}"

# AICIBA_ACCENT is us|uk; the endpoint wants 2|1, and only English has the choice.
accent=2
[ "${AICIBA_ACCENT:-us}" = 'uk' ] && accent=1

cache="${alfred_workflow_cache:-${TMPDIR:-/tmp}/aiciba-alfred}/audio"
slot="$(printf '%s' "$word" | tr '[:upper:]' '[:lower:]' | /usr/bin/shasum -a 1 |
  cut -d ' ' -f 1)"
file="$cache/$language-$accent-$slot.mp3"

# NSSound plays asynchronously and stops when its process does, so wait the clip
# out. `sound.play` without parentheses is deliberate: in JXA that *is* the call.
play() {
  /usr/bin/osascript -l JavaScript - "$1" <<'JXA' 2>/dev/null
function run(argv) {
  ObjC.import('AppKit')
  const sound = $.NSSound.alloc.initWithContentsOfFileByReference(argv[0], true)
  if (!sound.play) throw new Error('playback refused')
  $.NSThread.sleepForTimeInterval(sound.duration + 0.15)
}
JXA
}

speak() {
  [ -n "$prefetch" ] && exit 0
  /usr/bin/say -- "$word"
  exit 0
}

if [ -s "$file" ]; then
  [ -n "$prefetch" ] && exit 0
  play "$file" && exit 0
  /usr/bin/afplay "$file" && exit 0
  rm -f "$file"
fi

mkdir -p "$cache" || speak

if [ "$language" = 'en' ]; then
  voice=(--data "type=$accent")
else
  voice=(--data-urlencode "le=$language")
fi

# --data-urlencode keeps phrases and non-Latin scripts intact. The pid in the
# temp name keeps two prefetches of the same word from trampling each other.
tmp="$file.part.$$"
if /usr/bin/curl -fsS --max-time 6 -o "$tmp" --get \
  --data-urlencode "audio=$word" "${voice[@]}" \
  'https://dict.youdao.com/dictvoice' && [ -s "$tmp" ]; then
  mv -f "$tmp" "$file"
  [ -n "$prefetch" ] && exit 0
  play "$file" && exit 0
  /usr/bin/afplay "$file" && exit 0
  # Not audio after all: drop it rather than replaying a dud.
  rm -f "$file"
fi

rm -f "$tmp"
speak
