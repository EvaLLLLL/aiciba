import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Word } from './types'
import { DATA_DIR } from './paths'

const CACHE_FILE = join(DATA_DIR, 'history.json')

interface CacheStore {
  order: string[] // LRU order, index 0 = most recent
  entries: Record<string, Word>
}

function loadStore(): CacheStore {
  if (!existsSync(CACHE_FILE)) return { order: [], entries: {} }
  try {
    const raw = JSON.parse(
      readFileSync(CACHE_FILE, 'utf-8')
    ) as Partial<CacheStore>
    return {
      order: raw.order ?? [],
      entries: raw.entries ?? {}
    }
  } catch {
    return { order: [], entries: {} }
  }
}

function saveStore(store: CacheStore): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

function touch(store: CacheStore, word: string): void {
  store.order = [word, ...store.order.filter((w) => w !== word)]
}

export function getFromCache(word: string): Word | null {
  const key = word.toLowerCase()
  const store = loadStore()
  const hit = store.entries[key] ?? null
  if (hit) {
    touch(store, key)
    saveStore(store)
  }
  return hit
}

export function saveToCache(word: string, data: Word): void {
  const key = word.toLowerCase()
  const store = loadStore()
  store.entries[key] = data
  touch(store, key)
  saveStore(store)
}

export function getHistory(): Word[] {
  const { order, entries } = loadStore()
  return order.flatMap((key) => (entries[key] ? [entries[key]] : []))
}

export function clearCache(): void {
  saveStore({ order: [], entries: {} })
}
