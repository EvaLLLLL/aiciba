import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lookupInDictionary,
  parseCorrections,
  parseEnglishEntry,
  parseEnglishEquivalent
} from './dictionary'

/** Trimmed from a real response, keeping every shape the parser walks. */
const temper = {
  ec: {
    word: [
      {
        usphone: 'ˈtempər',
        ukphone: 'ˈtempə(r)',
        'return-phrase': { l: { i: 'temper' } },
        trs: [
          {
            tr: [{ l: { i: ['n. 坏脾气，暴躁脾气；心情，情绪；怒气，火气'] } }]
          },
          {
            tr: [{ l: { i: ['v. 使缓和，使温和；使（金属）回火，锻造'] } }]
          }
        ]
      }
    ]
  },
  blng_sents_part: {
    'sentence-pair': [
      { sentence: 'All at once she lost her temper.' },
      { sentence: 'She has a vicious temper.' }
    ]
  }
}

/** The Chinese→English dictionary hides its words in link objects. */
const yuanfen = {
  ce: {
    word: [
      {
        trs: [
          { tr: [{ l: { i: ['', { '#text': 'fate' }] } }] },
          { tr: [{ l: { i: ['', { '#text': 'serendipity' }] } }] }
        ]
      }
    ]
  }
}

test('a part of speech becomes an entry, senses split on the full-width semicolon', () => {
  const word = parseEnglishEntry(temper, 'Temper')

  assert.equal(word?.exists, true)
  // The canonical headword wins over whatever was typed.
  assert.equal(word?.word, 'temper')
  assert.deepEqual(
    word?.entries.map((entry) => entry.partOfSpeech),
    ['n.', 'v.']
  )
  assert.deepEqual(word?.entries[0]?.meanings, [
    '坏脾气，暴躁脾气',
    '心情，情绪',
    '怒气，火气'
  ])
})

test('only the first sense claims an example sentence', () => {
  const word = parseEnglishEntry(temper, 'temper')

  assert.equal(
    word?.entries[0]?.example.sentence,
    'All at once she lost her temper.'
  )
  // The endpoint returns sentences for the word, not per part of speech, so
  // handing the second one to the verb sense would illustrate the noun.
  assert.equal(word?.entries[1]?.example.sentence, '')
})

test('the accent chooses the transcription, wrapped in slashes', () => {
  assert.equal(parseEnglishEntry(temper, 'temper')?.entries[0]?.phonetic, '/ˈtempər/')
  assert.equal(
    parseEnglishEntry(temper, 'temper', 'uk')?.entries[0]?.phonetic,
    '/ˈtempə(r)/'
  )
})

test('a word the dictionary does not carry returns null, leaving it to the model', () => {
  assert.equal(parseEnglishEntry({ blng_sents_part: {} }, 'obstreperus'), null)
  assert.equal(parseEnglishEntry({}, 'zzzzqqq'), null)
  assert.equal(parseEnglishEntry(null, 'zzzzqqq'), null)
})

test('a phrase with no transcription still parses', () => {
  const phrase = {
    ec: {
      word: [
        {
          'return-phrase': { l: { i: 'New York' } },
          trs: [{ tr: [{ l: { i: ['纽约'] } }] }]
        }
      ]
    }
  }
  const word = parseEnglishEntry(phrase, 'New York')

  assert.equal(word?.entries[0]?.phonetic, '')
  // No part-of-speech prefix to strip, so the whole text is the sense.
  assert.equal(word?.entries[0]?.partOfSpeech, '')
  assert.deepEqual(word?.entries[0]?.meanings, ['纽约'])
})

test('a group with nothing but a label is dropped', () => {
  const empty = {
    ec: { word: [{ 'return-phrase': { l: { i: 'x' } }, trs: [{ tr: [{ l: { i: ['n. '] } }] }] }] }
  }

  assert.equal(parseEnglishEntry(empty, 'x'), null)
})

test('中文 resolves to the most common English word', () => {
  assert.equal(parseEnglishEquivalent(yuanfen), 'fate')
  assert.equal(parseEnglishEquivalent(temper), null)
  assert.equal(parseEnglishEquivalent({}), null)
})

/** A misspelling: a junk entry in the dictionary, the real answer under typos. */
const recieve = {
  ec: {
    word: [
      {
        'return-phrase': { l: { i: 'recieve' } },
        trs: [{ tr: [{ l: { i: ['奉'] } }] }]
      }
    ]
  },
  typos: {
    typo: [
      { word: 'receive', trans: 'vt. 收到' },
      { word: 'relieve', trans: 'vt. 解除' }
    ]
  }
}

test('corrections are read, newest-first and capped', () => {
  assert.deepEqual(parseCorrections(recieve), ['receive', 'relieve'])
  assert.deepEqual(parseCorrections(temper), [])
  assert.deepEqual(parseCorrections({}), [])
})

test('a junk entry with no label and no transcription is still parsed', () => {
  // The precedence rule lives in lookupInDictionary; the parser stays literal.
  const word = parseEnglishEntry(recieve, 'recieve')

  assert.equal(word?.entries[0]?.partOfSpeech, '')
  assert.equal(word?.entries[0]?.phonetic, '')
})

test('only the English→Chinese direction is served', async () => {
  const fetched: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown) => {
    fetched.push(String(input))
    throw new Error('the dictionary must not be called for this pair')
  }) as typeof fetch

  try {
    const japanese = await lookupInDictionary('猫', {
      entryLanguage: { code: 'ja', name: 'Japanese' },
      definitionLanguage: { code: 'en', name: 'English' }
    })

    assert.equal(japanese, null)

    // Reversed, this is a different dictionary — Chinese headwords with English
    // meanings — not the same one read backwards.
    const reversed = await lookupInDictionary('苹果', {
      entryLanguage: { code: 'zh', name: 'Chinese' },
      definitionLanguage: { code: 'en', name: 'English' }
    })

    assert.equal(reversed, null)
    assert.deepEqual(fetched, [])
  } finally {
    globalThis.fetch = original
  }
})
