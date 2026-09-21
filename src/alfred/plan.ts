import type { Word } from '../core/types'
import type { Config } from '../core/config'

/**
 * Script Filter JSON, as documented at
 * https://www.alfredapp.com/help/workflows/inputs/script-filter/json/
 * Only the keys this workflow actually emits are modelled.
 */
export interface AlfredMod {
  arg?: string
  subtitle?: string
  valid?: boolean
  variables?: Record<string, string>
}

export interface AlfredItem {
  title: string
  subtitle?: string
  arg?: string
  valid?: boolean
  autocomplete?: string
  text?: { copy?: string; largetype?: string }
  icon?: { path: string }
  variables?: Record<string, string>
  mods?: { alt?: AlfredMod }
}

export interface AlfredOutput {
  items: AlfredItem[]
  /** Workflow variables every row carries downstream. */
  variables?: Record<string, string>
  /** Seconds until Alfred re-runs the filter with the same query; only set while a lookup is in flight. */
  rerun?: number
}

/**
 * Enter on a row reaches a Conditional, which routes on this: `run` hands the
 * argument to the action script, `play` pronounces it, `copy` puts it on the
 * clipboard.
 */
type Mode = 'run' | 'copy' | 'play'

/** What the action script should do with the row's argument. */
type Action = 'lookup' | 'refresh' | 'setup'

export interface PendingState {
  word: string
  /** A marker this old means the background lookup died without reporting back. */
  stale: boolean
}

export interface ErrorState {
  message: string
  suggestions: string[]
}

export interface FilterState {
  query: string
  config: Config | null
  /** Cached definition for the query, alias-resolved (either language). */
  hit: Word | null
  /** Most-recent-first lookup history, straight from the shared cache. */
  history: Word[]
  pending: PendingState | null
  error: ErrorState | null
}

const RERUN_SECONDS = 0.4
const HISTORY_ROWS = 12
const MATCH_ROWS = 6
const ALERT_ICON =
  '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns'

function meaningsOf(word: Word): string {
  return word.entries
    .flatMap((entry) => entry.meanings.map((m) => m.trim()).filter(Boolean))
    .join('；')
}

function phoneticOf(word: Word): string {
  for (const entry of word.entries) {
    const phonetic = entry.phonetic.trim()
    if (phonetic) return phonetic
  }
  return ''
}

/** Plain-text rendering for the clipboard and Large Type — the CLI's chalk output is TTY-only. */
export function plainDefinition(word: Word): string {
  const head = [word.word, phoneticOf(word)].filter(Boolean).join('  ')
  const body = word.entries.map((entry) => {
    const meanings = entry.meanings.map((m) => m.trim()).join('；')
    const line = `${entry.partOfSpeech.trim()} ${meanings}`.trim()
    // Stored entries are only checked for a headword, so an example may be absent.
    const example = entry.example?.sentence?.trim() ?? ''
    return example ? `${line}\n  ${example}` : line
  })
  return [head, ...body].join('\n')
}

/** ⌥ pronounces the headword, never whichever definition row you are on. */
function pronounceMod(word: string): { alt: AlfredMod } {
  // Explicitly valid: the rows that autocomplete on Enter are themselves not.
  return { alt: { arg: word, subtitle: `Pronounce “${word}”`, valid: true } }
}

const inertMods: { alt: AlfredMod } = { alt: { valid: false } }

function routeTo(target: Mode): Record<string, string> {
  return { mode: target }
}

function run(action: Action): Record<string, string> {
  return { ...routeTo('run'), action }
}

/**
 * The row that names the word. Enter plays it out loud — the one action a
 * dictionary should make effortless — while ⌘C still takes the whole entry.
 */
function headwordItem(word: Word): AlfredItem {
  const plain = plainDefinition(word)
  const phonetic = phoneticOf(word)

  return {
    title: word.word,
    subtitle: [phonetic, '⏎ to hear it'].filter(Boolean).join('; '),
    arg: word.word,
    valid: true,
    autocomplete: word.word,
    text: { copy: plain, largetype: plain },
    variables: routeTo('play'),
    mods: pronounceMod(word.word)
  }
}

function definitionItems(word: Word): AlfredItem[] {
  const largetype = plainDefinition(word)

  return word.entries.map((entry) => {
    const meanings = entry.meanings.map((m) => m.trim()).join('；')
    const example = entry.example?.sentence?.trim() ?? ''
    const phonetic = entry.phonetic.trim()

    return {
      title: `${entry.partOfSpeech.trim()} ${meanings}`.trim(),
      subtitle: [phonetic, example].filter(Boolean).join('; '),
      arg: meanings,
      valid: true,
      autocomplete: word.word,
      text: { copy: meanings, largetype },
      variables: routeTo('copy'),
      mods: pronounceMod(word.word)
    }
  })
}

function entryItems(word: Word): AlfredItem[] {
  return [headwordItem(word), ...definitionItems(word)]
}

/**
 * Rows for words already in the cache. Enter completes the query in place
 * instead of actioning: an invalid item makes Alfred autocomplete, so the entry
 * appears in the same window rather than after a round trip that closes and
 * re-opens it.
 */
function historyItems(history: Word[], limit: number): AlfredItem[] {
  return history.slice(0, limit).map((word) => ({
    title: word.word,
    subtitle: meaningsOf(word),
    valid: false,
    autocomplete: word.word,
    text: { copy: meaningsOf(word), largetype: plainDefinition(word) },
    mods: pronounceMod(word.word)
  }))
}

/** Words already looked up that the query could be reaching for: prefix matches first. */
export function matchHistory(history: Word[], query: string): Word[] {
  const needle = query.toLowerCase()
  const prefix: Word[] = []
  const contains: Word[] = []

  for (const word of history) {
    const candidate = word.word.toLowerCase()
    if (candidate === needle) continue
    if (candidate.startsWith(needle)) prefix.push(word)
    else if (candidate.includes(needle)) contains.push(word)
  }

  return [...prefix, ...contains]
}

function lookupItem(
  query: string,
  config: Config,
  action: Action,
  headword = query
): AlfredItem {
  const refresh = action === 'refresh'
  return {
    title: `Look up “${query}”${refresh ? ' again' : ''}`,
    subtitle: refresh
      ? 'Replaces the cached definition'
      : `Dictionary, then ${config.model} if it is not listed`,
    arg: query,
    valid: true,
    variables: run(action),
    mods: pronounceMod(headword)
  }
}

function pendingItem(word: string): AlfredItem {
  return {
    title: `Looking up “${word}”…`,
    subtitle: 'Waiting for the model to answer',
    valid: false,
    mods: inertMods
  }
}

function errorItems(
  query: string,
  error: ErrorState,
  /** A retry shown over a cached entry must go past the cache to mean anything. */
  retry: Action = 'lookup'
): AlfredItem[] {
  const head: AlfredItem = {
    title: error.message,
    subtitle: `⏎ to try “${query}” again`,
    arg: query,
    valid: true,
    icon: { path: ALERT_ICON },
    variables: run(retry),
    mods: pronounceMod(query)
  }

  // Not 'search': a suggestion is a word nobody has looked up yet, so re-opening
  // Alfred on it would only offer the lookup again.
  const suggestions: AlfredItem[] = error.suggestions.map((word) => ({
    title: word,
    subtitle: 'Did you mean this? ⏎ to look it up',
    arg: word,
    valid: true,
    autocomplete: word,
    variables: run('lookup'),
    mods: pronounceMod(word)
  }))

  return [head, ...suggestions]
}

function inert(title: string, subtitle: string): AlfredItem {
  return { title, subtitle, valid: false, mods: inertMods }
}

/**
 * The whole filter, as a pure function of query + on-disk state, so the
 * interesting part stays testable without a cache, a network or Alfred.
 */
export function buildOutput(state: FilterState): AlfredOutput {
  const output = plan(state)

  // Pronunciation needs to know which language it is reading, and this reaches
  // every downstream action without threading it through each row.
  return state.config
    ? {
        ...output,
        variables: { AICIBA_ENTRY_LANGUAGE: state.config.entryLanguage.code }
      }
    : output
}

function plan(state: FilterState): AlfredOutput {
  const { query, config, hit, history, pending, error } = state

  if (!config) {
    return {
      items: [
        {
          title: 'AICIBA needs an API key',
          subtitle:
            '⏎ opens this workflow’s configuration — or run `ciba --config`',
          arg: query,
          valid: true,
          variables: run('setup'),
          mods: inertMods
        }
      ]
    }
  }

  if (!query) {
    const items = historyItems(history, HISTORY_ROWS)
    return {
      items: items.length
        ? items
        : [
            inert(
              'Type a word to look it up',
              `${config.entryLanguage.name} or ${config.definitionLanguage.name}`
            )
          ]
    }
  }

  // A refresh keeps the old definition on screen; a first lookup has nothing to show yet.
  if (pending && !pending.stale) {
    const items = hit
      ? [...entryItems(hit), pendingItem(query)]
      : [pendingItem(query)]
    return { items, rerun: RERUN_SECONDS }
  }

  if (hit) {
    const tail = error
      ? errorItems(query, error, 'refresh')
      : [lookupItem(query, config, 'refresh', hit.word)]
    return { items: [...entryItems(hit), ...tail] }
  }

  if (pending?.stale) {
    return {
      items: [
        {
          title: `Lookup of “${query}” timed out`,
          subtitle: '⏎ to try again',
          arg: query,
          valid: true,
          icon: { path: ALERT_ICON },
          variables: run('lookup'),
          mods: pronounceMod(query)
        }
      ]
    }
  }

  if (error) return { items: errorItems(query, error) }

  return {
    items: [
      ...historyItems(matchHistory(history, query), MATCH_ROWS),
      lookupItem(query, config, 'lookup')
    ]
  }
}
