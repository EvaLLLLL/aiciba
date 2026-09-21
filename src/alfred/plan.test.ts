import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Word } from '../core/types'
import type { Config } from '../core/config'

// Both module trees read their directories once, at load: point them at scratch
// space before importing, so a real ~/.aiciba is never read or written here.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'aiciba-alfred-test-'))
const STATE_DIR = join(DATA_DIR, 'cache')
process.env.AICIBA_HOME = DATA_DIR
process.env.alfred_workflow_cache = STATE_DIR

const { buildOutput, matchHistory, plainDefinition } = await import('./plan')
const {
  clearError,
  clearPending,
  markPending,
  readError,
  readPending,
  slot,
  writeError
} = await import('./state')

const config: Config = {
  provider: 'anthropic',
  apiKey: 'sk-test',
  model: 'claude-haiku-4-5-20251001',
  entryLanguage: { code: 'en', name: 'English' },
  definitionLanguage: { code: 'zh', name: 'Chinese' }
}

function entry(partOfSpeech: string, meanings: string[]) {
  return {
    partOfSpeech,
    phonetic: '/wɜːd/',
    meanings,
    example: { sentence: `Use ${partOfSpeech} in a sentence.` }
  }
}

function word(name: string, ...parts: ReturnType<typeof entry>[]): Word {
  return {
    exists: true,
    word: name,
    suggestions: [],
    entries: parts.length ? parts : [entry('n.', ['意思'])]
  }
}

const base = {
  query: 'aura',
  config,
  hit: null,
  history: [],
  pending: null,
  error: null
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true })
  mkdirSync(DATA_DIR, { recursive: true })
})

after(() => rmSync(DATA_DIR, { recursive: true, force: true }))

test('without a config the first row leads to the configuration sheet', () => {
  const { items } = buildOutput({ ...base, config: null })

  assert.equal(items.length, 1)
  assert.match(items[0]?.title ?? '', /API key/)
  assert.equal(items[0]?.valid, true)
  assert.deepEqual(items[0]?.variables, { mode: 'run', action: 'setup' })
})

test('an empty query browses history, newest first', () => {
  const history = [word('aura'), word('beam')]
  const { items } = buildOutput({ ...base, query: '', history })

  assert.deepEqual(
    items.map((item) => item.title),
    ['aura', 'beam']
  )
  // Enter completes the query in place, so the entry opens without Alfred
  // closing and re-opening around it.
  assert.equal(items[0]?.valid, false)
  assert.equal(items[0]?.autocomplete, 'aura')
  // ⌥ still pronounces from a row Enter no longer actions.
  assert.equal(items[0]?.mods?.alt?.valid, true)
})

test('the empty state names the configured pair', () => {
  const { items } = buildOutput({ ...base, query: '' })

  assert.match(items[0]?.subtitle ?? '', /English/)
  assert.match(items[0]?.subtitle ?? '', /Chinese/)
})

test('an empty history says so rather than showing nothing', () => {
  const { items } = buildOutput({ ...base, query: '' })

  assert.equal(items.length, 1)
  assert.equal(items[0]?.valid, false)
})

test('a cached word renders the word, each part of speech, then a refresh', () => {
  const hit = word('aura', entry('n.', ['气场', '氛围']), entry('v.', ['环绕']))
  const { items, rerun } = buildOutput({ ...base, hit })

  assert.deepEqual(
    items.map((item) => item.title),
    ['aura', 'n. 气场；氛围', 'v. 环绕', 'Look up “aura” again']
  )
  assert.equal(items[1]?.arg, '气场；氛围')
  assert.deepEqual(items[1]?.variables, { mode: 'copy' })
  assert.deepEqual(items[3]?.variables, { mode: 'run', action: 'refresh' })
  // Nothing is in flight, so Alfred must not poll.
  assert.equal(rerun, undefined)
})

test('Enter on the word itself plays it, and carries the whole entry', () => {
  const hit = word('aura', entry('n.', ['气场']))
  const [headword] = buildOutput({ ...base, hit }).items

  assert.equal(headword?.title, 'aura')
  assert.equal(headword?.arg, 'aura')
  assert.deepEqual(headword?.variables, { mode: 'play' })
  assert.match(headword?.subtitle ?? '', /hear it/)
  assert.equal(headword?.text?.copy, plainDefinition(hit))
})

test('⌥ pronounces the headword, not the 中文 that was typed', () => {
  const { items } = buildOutput({ ...base, query: '气场', hit: word('aura') })

  for (const item of items) {
    assert.equal(item.mods?.alt?.arg, 'aura')
  }
})

test('a lookup in flight asks Alfred to poll', () => {
  const { items, rerun } = buildOutput({
    ...base,
    pending: { word: 'aura', stale: false }
  })

  assert.equal(items.length, 1)
  assert.equal(items[0]?.valid, false)
  assert.ok(rerun && rerun > 0)
})

test('a refresh keeps the old definition on screen while it runs', () => {
  const { items, rerun } = buildOutput({
    ...base,
    hit: word('aura'),
    pending: { word: 'aura', stale: false }
  })

  assert.deepEqual(
    items.map((item) => item.title),
    ['aura', 'n. 意思', 'Looking up “aura”…']
  )
  assert.ok(rerun)
})

test('an abandoned marker offers a retry instead of polling forever', () => {
  const { items, rerun } = buildOutput({
    ...base,
    pending: { word: 'aura', stale: true }
  })

  assert.equal(rerun, undefined)
  assert.match(items[0]?.title ?? '', /timed out/)
  assert.deepEqual(items[0]?.variables, { mode: 'run', action: 'lookup' })
})

test('a failed lookup shows the reason and any suggested spellings', () => {
  const { items } = buildOutput({
    ...base,
    query: 'auraa',
    error: {
      message: 'Invalid API key. Check your AICIBA configuration.',
      suggestions: ['aura', 'aural']
    }
  })

  assert.equal(items.length, 3)
  assert.match(items[0]?.title ?? '', /Invalid API key/)
  assert.deepEqual(
    items.slice(1).map((item) => item.title),
    ['aura', 'aural']
  )
  assert.deepEqual(items[1]?.variables, { mode: 'run', action: 'lookup' })
})

test('an uncached word offers the AI lookup last, behind cheaper matches', () => {
  const history = [word('sagging'), word('lasagna'), word('beam')]
  const { items } = buildOutput({ ...base, query: 'sag', history })

  assert.deepEqual(
    items.map((item) => item.title),
    ['sagging', 'lasagna', 'Look up “sag”']
  )
  assert.deepEqual(items.at(-1)?.variables, { mode: 'run', action: 'lookup' })
})

test('history matching prefers prefixes and skips the exact word', () => {
  const history = [word('lasagna'), word('sagging'), word('sag')]

  assert.deepEqual(
    matchHistory(history, 'sag').map((w) => w.word),
    ['sagging', 'lasagna']
  )
})

test('plain text keeps the phonetic, meanings and example', () => {
  const plain = plainDefinition(word('aura', entry('n.', ['气场', '氛围'])))

  assert.equal(plain, 'aura  /wɜːd/\nn. 气场；氛围\n  Use n. in a sentence.')
})

test('marker names are the sha1 of the word exactly as handed over', () => {
  // `action.sh` pipes the same string through `shasum -a 1` and nothing else.
  assert.equal(slot('hello'), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')

  // No folding or trimming here: `tr` in the shell only folds ASCII, so a
  // cleverer rule would disagree with it on the first accented word.
  assert.notEqual(slot('Hello'), slot('hello'))
  assert.notEqual(slot('hello '), slot('hello'))
  assert.notEqual(slot('Ärger'), slot('ärger'))
})

test('markers round-trip and clear', () => {
  markPending('aura')
  assert.deepEqual(readPending('aura'), { word: 'aura', stale: false })
  assert.equal(readPending('beam'), null)

  clearPending('aura')
  assert.equal(readPending('aura'), null)

  writeError('aura', 'nope', ['aural'])
  assert.deepEqual(readError('aura'), {
    message: 'nope',
    suggestions: ['aural']
  })

  clearError('aura')
  assert.equal(readError('aura'), null)
})

test('a malformed error marker is ignored, not thrown', () => {
  mkdirSync(join(STATE_DIR, 'error'), { recursive: true })
  writeFileSync(join(STATE_DIR, 'error', slot('aura')), 'not json', 'utf-8')

  assert.equal(readError('aura'), null)
})
