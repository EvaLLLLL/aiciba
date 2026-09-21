import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  asLanguage,
  customLanguage,
  findLanguage,
  LANGUAGES
} from './languages'

test('a language can be named by code or by name, in any case', () => {
  assert.deepEqual(findLanguage('ja'), { code: 'ja', name: 'Japanese' })
  assert.deepEqual(findLanguage('Japanese'), { code: 'ja', name: 'Japanese' })
  assert.deepEqual(findLanguage('  JAPANESE '), {
    code: 'ja',
    name: 'Japanese'
  })
  assert.equal(findLanguage('Klingon'), null)
  assert.equal(findLanguage('   '), null)
})

test('a language off the list still works, under a slug of its name', () => {
  assert.deepEqual(customLanguage('Swahili'), {
    code: 'swahili',
    name: 'Swahili'
  })
  assert.deepEqual(customLanguage('Ancient Greek'), {
    code: 'ancient-greek',
    name: 'Ancient Greek'
  })
  // A listed language keeps its proper code rather than a slug of the name.
  assert.deepEqual(customLanguage('German'), { code: 'de', name: 'German' })
  assert.equal(customLanguage('  '), null)
})

test('stored config is read back defensively', () => {
  assert.deepEqual(asLanguage({ code: 'ko', name: 'Korean' }), {
    code: 'ko',
    name: 'Korean'
  })
  // A bare string is accepted, since that is what a hand-edited config may hold.
  assert.deepEqual(asLanguage('Italian'), { code: 'it', name: 'Italian' })
  // A name with no code gets one derived from it.
  assert.deepEqual(asLanguage({ name: 'Swahili' }), {
    code: 'swahili',
    name: 'Swahili'
  })

  assert.equal(asLanguage(undefined), null)
  assert.equal(asLanguage({}), null)
  assert.equal(asLanguage({ code: 'xx' }), null)
  assert.equal(asLanguage(42), null)
})

test('every listed language is complete and unique', () => {
  const codes = new Set<string>()
  for (const language of LANGUAGES) {
    assert.ok(language.code && language.name && language.label, language.code)
    assert.equal(codes.has(language.code), false, `duplicate ${language.code}`)
    codes.add(language.code)
  }
})
