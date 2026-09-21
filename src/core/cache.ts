import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { Word } from './types'
import { DATA_DIR } from './paths'
import { loadConfig } from './config'
import { resolveAccent } from './dictionary'

/**
 * One store per language pair: the same spelling means different things in
 * different dictionaries. English→Chinese keeps the original filename, so the
 * history written before any of this existed is still the history you have.
 */
function cacheFile(): string {
  const config = loadConfig()
  const entry = config?.entryLanguage.code ?? 'en'
  const definitions = config?.definitionLanguage.code ?? 'zh'

  const pair =
    entry === 'en' && definitions === 'zh'
      ? 'history'
      : `history-${entry}-${definitions}`

  // The IPA is chosen when the entry is fetched, so a stored one belongs to the
  // accent that asked for it. American keeps the plain name it has always had.
  return join(
    DATA_DIR,
    resolveAccent() === 'uk' ? `${pair}-uk.json` : `${pair}.json`
  )
}

/** Cap the on-disk history so every lookup doesn't pay for an ever-growing file. */
export const MAX_ENTRIES = 500

interface CacheStore {
  order: string[] // LRU order, index 0 = most recent
  entries: Record<string, Word> // canonical key -> definition
  aliases: Record<string, string> // lookup input (e.g. 中文) -> canonical key
}

/**
 * Null-prototyped: on a plain object literal `entries['constructor']` answers
 * with a function nobody stored, so an ordinary word would never cache.
 */
function bare<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>
}

function emptyStore(): CacheStore {
  return { order: [], entries: bare<Word>(), aliases: bare<string>() }
}

/** Keys are the lowercased English headword, so 中文 input and its result share one entry. */
function toKey(word: string): string {
  return word.trim().toLowerCase()
}

/**
 * Enforce the store invariants on load: entries keyed by headword, aliases
 * pointing at live entries, order deduped and covering every entry. Also
 * migrates files written before entries were keyed canonically.
 */
function normalizeStore(store: CacheStore): CacheStore {
  const entries = bare<Word>()
  const aliases = Object.assign(bare<string>(), store.aliases)
  const rekeyed = new Map<string, string>()

  for (const [key, word] of Object.entries(store.entries)) {
    if (!word || typeof word.word !== 'string') continue
    const canonical = toKey(word.word) || key
    entries[canonical] = word
    rekeyed.set(key, canonical)
    if (canonical !== key) aliases[key] = canonical
  }

  for (const [from, to] of Object.entries(aliases)) {
    if (from === to || !entries[to]) delete aliases[from]
  }

  const order: string[] = []
  const seen = new Set<string>()
  for (const key of [...store.order, ...Object.keys(entries)]) {
    const canonical = rekeyed.get(key) ?? key
    if (!entries[canonical] || seen.has(canonical)) continue
    seen.add(canonical)
    order.push(canonical)
  }

  return { order, entries, aliases }
}

function loadStore(): CacheStore {
  const file = cacheFile()
  if (!existsSync(file)) return emptyStore()

  let raw: Partial<CacheStore>
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<CacheStore>
  } catch {
    // Set the unreadable file aside rather than silently dropping every entry.
    try {
      renameSync(file, file.replace(/\.json$/, '.corrupt.json'))
    } catch {
      /* nothing recoverable */
    }
    return emptyStore()
  }

  return normalizeStore({
    order: raw.order ?? [],
    entries: raw.entries ?? {},
    aliases: raw.aliases ?? {}
  })
}

function saveStore(store: CacheStore): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  // Write-then-rename: a crash or a concurrent `ciba` can't truncate the real file.
  const file = cacheFile()
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(store), 'utf-8')
  renameSync(tmp, file)
}

/** Move `key` to the front; false means it was already there and no write is needed. */
function touch(store: CacheStore, key: string): boolean {
  if (store.order[0] === key) return false
  store.order = [key, ...store.order.filter((w) => w !== key)]
  return true
}

function evict(store: CacheStore): void {
  if (store.order.length <= MAX_ENTRIES) return

  for (const key of store.order.splice(MAX_ENTRIES)) {
    delete store.entries[key]
  }
  for (const [from, to] of Object.entries(store.aliases)) {
    if (!store.entries[to]) delete store.aliases[from]
  }
}

export function getFromCache(word: string): Word | null {
  const store = loadStore()
  const input = toKey(word)
  const key = store.aliases[input] ?? input
  const hit = store.entries[key] ?? null

  if (hit && touch(store, key)) saveStore(store)

  return hit
}

/**
 * Like `getFromCache` minus the LRU bookkeeping. The Alfred filter runs on
 * every keystroke, so it must not rewrite history.json — or reorder it —
 * just because a word happened to scroll past.
 */
export function peekCache(word: string): Word | null {
  const store = loadStore()
  const input = toKey(word)
  return store.entries[store.aliases[input] ?? input] ?? null
}

export function saveToCache(word: string, data: Word): void {
  const store = loadStore()
  const input = toKey(word)
  const key = toKey(data.word) || input

  if (!key) return

  store.entries[key] = data
  if (input && input !== key) store.aliases[input] = key
  touch(store, key)
  evict(store)
  saveStore(store)
}

export function getHistory(): Word[] {
  const { order, entries } = loadStore()
  return order.flatMap((key) => (entries[key] ? [entries[key]] : []))
}

/** Every pair's store, because the prompt asking for this says "all history". */
export function clearCache(): void {
  if (!existsSync(DATA_DIR)) return

  for (const name of readdirSync(DATA_DIR)) {
    if (/^history.*\.json$/.test(name)) {
      rmSync(join(DATA_DIR, name), { force: true })
    }
  }
}
