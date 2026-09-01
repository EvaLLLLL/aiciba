import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { Word } from './types'
import { DATA_DIR } from './paths'

const CACHE_FILE = join(DATA_DIR, 'history.json')
const CORRUPT_FILE = join(DATA_DIR, 'history.corrupt.json')

/** Cap the on-disk history so every lookup doesn't pay for an ever-growing file. */
export const MAX_ENTRIES = 500

interface CacheStore {
  order: string[] // LRU order, index 0 = most recent
  entries: Record<string, Word> // canonical key -> definition
  aliases: Record<string, string> // lookup input (e.g. 中文) -> canonical key
}

function emptyStore(): CacheStore {
  return { order: [], entries: {}, aliases: {} }
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
  const entries: Record<string, Word> = {}
  const aliases: Record<string, string> = { ...store.aliases }
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
  if (!existsSync(CACHE_FILE)) return emptyStore()

  let raw: Partial<CacheStore>
  try {
    raw = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as Partial<CacheStore>
  } catch {
    // Set the unreadable file aside rather than silently dropping every entry.
    try {
      renameSync(CACHE_FILE, CORRUPT_FILE)
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
  const tmp = `${CACHE_FILE}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(store), 'utf-8')
  renameSync(tmp, CACHE_FILE)
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

export function clearCache(): void {
  saveStore(emptyStore())
}
