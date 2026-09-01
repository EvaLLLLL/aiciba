import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Word } from './types'

// Point the cache at a scratch dir *before* importing it: DATA_DIR is read at module load,
// and a real ~/.aiciba must never be touched by the suite.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'aiciba-test-'))
process.env.AICIBA_HOME = DATA_DIR

const CACHE_FILE = join(DATA_DIR, 'history.json')
const CORRUPT_FILE = join(DATA_DIR, 'history.corrupt.json')

const {
  MAX_ENTRIES,
  clearCache,
  getFromCache,
  getHistory,
  saveToCache
} = await import('./cache')

const word = (w: string): Word => ({
  exists: true,
  word: w,
  suggestions: [],
  entries: []
})

/**
 * Backdate the file so "was it rewritten?" doesn't depend on clock granularity.
 * Reads the timestamp back rather than trusting the one written: the filesystem
 * stores nanoseconds, so mtimeMs can land a fraction below the requested value.
 */
function backdate(): number {
  const stale = new Date(Date.now() - 60_000)
  utimesSync(CACHE_FILE, stale, stale)
  return statSync(CACHE_FILE).mtimeMs
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true })
  mkdirSync(DATA_DIR, { recursive: true })
})

after(() => rmSync(DATA_DIR, { recursive: true, force: true }))

test('a Chinese input and its English headword share one entry', () => {
  saveToCache('苹果', word('apple'))

  assert.equal(getFromCache('苹果')?.word, 'apple')
  assert.equal(getFromCache('apple')?.word, 'apple')
  assert.equal(getHistory().length, 1)
  assert.equal(JSON.parse(readFileSync(CACHE_FILE, 'utf-8')).aliases['苹果'], 'apple')
})

test('lookups are case-insensitive', () => {
  saveToCache('Apple', word('apple'))

  assert.equal(getFromCache('APPLE')?.word, 'apple')
  assert.equal(getHistory().length, 1)
})

test('a legacy file keyed by input word is migrated and deduped', () => {
  writeFileSync(
    CACHE_FILE,
    JSON.stringify({
      order: ['苹果', 'apple', 'banana'],
      entries: { 苹果: word('apple'), apple: word('apple'), banana: word('banana') }
    })
  )

  assert.deepEqual(
    getHistory().map((w) => w.word),
    ['apple', 'banana']
  )
  assert.equal(getFromCache('苹果')?.word, 'apple')
})

test('entries past the cap are evicted least-recently-used first', () => {
  for (let i = 0; i < MAX_ENTRIES + 20; i++) {
    saveToCache(`word${i}`, word(`word${i}`))
  }

  const history = getHistory()
  assert.equal(history.length, MAX_ENTRIES)
  assert.equal(history[0]?.word, `word${MAX_ENTRIES + 19}`)
  assert.equal(getFromCache('word0'), null)
})

test('a hit on the most recent entry does not rewrite the file', () => {
  saveToCache('alpha', word('alpha'))
  saveToCache('beta', word('beta'))

  const stale = backdate()
  assert.equal(getFromCache('beta')?.word, 'beta')
  assert.equal(statSync(CACHE_FILE).mtimeMs, stale)
})

test('a hit that reorders history is persisted', () => {
  saveToCache('alpha', word('alpha'))
  saveToCache('beta', word('beta'))

  const stale = backdate()
  assert.equal(getFromCache('alpha')?.word, 'alpha')
  assert.notEqual(statSync(CACHE_FILE).mtimeMs, stale)
  assert.equal(getHistory()[0]?.word, 'alpha')
})

test('an unreadable file is set aside rather than silently dropped', () => {
  writeFileSync(CACHE_FILE, '{"order":[trunca')

  assert.deepEqual(getHistory(), [])
  assert.ok(existsSync(CORRUPT_FILE))
})

test('writes leave no temp files behind', () => {
  saveToCache('gamma', word('gamma'))

  assert.deepEqual(readdirSync(DATA_DIR), ['history.json'])
})

test('clearCache empties history', () => {
  saveToCache('delta', word('delta'))
  clearCache()

  assert.deepEqual(getHistory(), [])
  assert.equal(getFromCache('delta'), null)
})
