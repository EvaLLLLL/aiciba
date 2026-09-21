import { spawn } from 'child_process'

import { getHistory, peekCache } from '../core/cache'
import { loadConfig, type Config } from '../core/config'
import { sanitize } from '../core/query'
import { buildOutput, type AlfredOutput } from './plan'
import { readError, readPending } from './state'

/**
 * Warm the pronunciation cache while the entry is on screen. The download is
 * the only part of playing a word that anyone would otherwise wait for, and by
 * the time a hand reaches ⏎ it has usually landed.
 */
function prefetchAudio(word: string, config: Config): void {
  const script = process.env.AICIBA_PRONOUNCE?.trim()
  if (!script) return

  const child = spawn(script, ['--prefetch', word], {
    detached: true,
    stdio: 'ignore',
    // The code, not whatever was typed into Alfred's field: playback resolves
    // the same value through the item variables, and a mismatch would file the
    // download under a name the play never looks for.
    env: { ...process.env, AICIBA_ENTRY_LANGUAGE: config.entryLanguage.code }
  })

  // A missing or unreadable script reports itself asynchronously, so a throw
  // here would take the whole Script Filter down with it.
  child.on('error', () => {
    /* Pronunciation still works; it just pays for the download later. */
  })
  child.unref()
}

/** Script Filter entry point: reads only cached state, so it stays free and instant. */
function filter(query: string): AlfredOutput {
  const config = loadConfig()
  if (!config) {
    return buildOutput({
      query,
      config,
      hit: null,
      history: [],
      pending: null,
      error: null
    })
  }

  const hit = query ? peekCache(query) : null
  if (hit) prefetchAudio(hit.word, config)

  return buildOutput({
    query,
    config,
    hit,
    // A hit already answers the query, so skip re-reading the whole history.
    history: hit ? [] : getHistory(),
    pending: query ? readPending(query) : null,
    error: query ? readError(query) : null
  })
}

let output: AlfredOutput

try {
  output = filter(sanitize(process.argv[2] ?? ''))
} catch (error) {
  // A thrown script filter shows Alfred's generic failure; a row explains itself.
  output = {
    items: [
      {
        title: 'AICIBA hit an unexpected error',
        subtitle: error instanceof Error ? error.message : String(error),
        valid: false
      }
    ]
  }
}

console.log(JSON.stringify(output))
