import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Alfred exports `alfred_workflow_cache` (and creates nothing); the fallback keeps
 * these scripts runnable from a plain shell for testing.
 */
const STATE_DIR =
  process.env.alfred_workflow_cache?.trim() || join(tmpdir(), 'aiciba-alfred')

const PENDING_DIR = join(STATE_DIR, 'pending')
const ERROR_DIR = join(STATE_DIR, 'error')

/**
 * A background lookup still unfinished after this long is assumed dead. Kept
 * generous: a reasoning model can chew on a word for a minute or two, and a
 * premature "timed out" row invites a second paid lookup for the same word.
 */
export const PENDING_TTL_MS = 300_000

/** Markers older than this are litter from sessions long gone. */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Marker filename for a word. `action.sh` computes the same digest in shell
 * so either side can write a marker the other will find — that's what lets the
 * shell claim "pending" before Node has even started booting.
 *
 * Hashed exactly as handed over, with no case folding: `tr` in the shell folds
 * ASCII only, so anything cleverer here would disagree on the first accented
 * word. Both sides receive the same sanitized query, which is what must match.
 */
export function slot(word: string): string {
  return createHash('sha1').update(word).digest('hex')
}

function write(dir: string, word: string, contents: string): void {
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, slot(word)), contents, 'utf-8')
  } catch {
    /* A workflow that can't write a marker still works, it just can't show progress. */
  }
}

function drop(dir: string, word: string): void {
  rmSync(join(dir, slot(word)), { force: true })
}

export function markPending(word: string): void {
  write(PENDING_DIR, word, word)
}

export function clearPending(word: string): void {
  drop(PENDING_DIR, word)
}

export function readPending(
  word: string
): { word: string; stale: boolean } | null {
  const file = join(PENDING_DIR, slot(word))
  try {
    const age = Date.now() - statSync(file).mtimeMs
    return { word, stale: age > PENDING_TTL_MS }
  } catch {
    return null
  }
}

export function writeError(
  word: string,
  message: string,
  suggestions: string[] = []
): void {
  write(ERROR_DIR, word, JSON.stringify({ message, suggestions }))
}

export function clearError(word: string): void {
  drop(ERROR_DIR, word)
}

export function readError(
  word: string
): { message: string; suggestions: string[] } | null {
  try {
    const raw = JSON.parse(
      readFileSync(join(ERROR_DIR, slot(word)), 'utf-8')
    ) as {
      message?: unknown
      suggestions?: unknown
    }
    if (typeof raw.message !== 'string') return null
    return {
      message: raw.message,
      suggestions: Array.isArray(raw.suggestions)
        ? raw.suggestions.filter((s): s is string => typeof s === 'string')
        : []
    }
  } catch {
    return null
  }
}

/** Housekeeping for markers whose word was never looked at again. */
export function pruneState(now = Date.now()): void {
  for (const dir of [PENDING_DIR, ERROR_DIR]) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      const file = join(dir, name)
      try {
        if (now - statSync(file).mtimeMs > PRUNE_AFTER_MS) {
          rmSync(file, { force: true })
        }
      } catch {
        /* raced with another run; nothing to do */
      }
    }
  }
}
