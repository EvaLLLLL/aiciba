import type { Word } from './types'
import type { Language } from './languages'

/**
 * A curated dictionary, for the words a dictionary already knows.
 *
 * The model cannot be made fast enough for this job: its floor is server-side
 * time-to-first-token (measured at 0.8–1.8s before a single character arrives),
 * so neither prompt tuning nor streaming brings a lookup under a second. This
 * endpoint answers in about 0.3s with curated senses, both accents' IPA and
 * real bilingual examples — richer than the model's output, not thinner.
 *
 * It is Youdao's dictionary JSON, the same service the workflow already uses
 * for pronunciation. No key and no billing, but it is the endpoint their own
 * web dictionary calls rather than a published API: treat availability and
 * response shape as things that can change without notice. Everything here
 * fails to null — unknown word, altered payload, throttling, no network — and
 * the model takes over.
 */
const ENDPOINT = 'https://dict.youdao.com/jsonapi'

/** Only the dictionaries this parser reads, to keep the payload small. */
const DICTS = JSON.stringify({
  count: 99,
  dicts: [['ec', 'ce', 'blng_sents_part', 'typos']]
})

const TIMEOUT_MS = 2500

export type Accent = 'us' | 'uk'

/** Both the transcription and the cache file it lands in follow this. */
export function resolveAccent(): Accent {
  return process.env.AICIBA_ACCENT?.trim().toLowerCase() === 'uk' ? 'uk' : 'us'
}

export interface LanguagePair {
  entryLanguage: Language
  definitionLanguage: Language
}

/**
 * This source gives English headwords with Chinese meanings, and only that.
 * The reverse pair is a different dictionary, not the same one read backwards,
 * so it declines there too and the model — which speaks every pair — answers.
 */
function covers(languages: LanguagePair): boolean {
  return (
    languages.entryLanguage.code === 'en' &&
    languages.definitionLanguage.code === 'zh'
  )
}

/** Senses are separated by a full-width semicolon; commas live inside one sense. */
const SENSE_SEPARATOR = '；'

/** Youdao prefixes each translation group with its part of speech: "n. …". */
const PART_OF_SPEECH = /^([a-z]{1,5}\.)\s*/i

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

/** An `i` list mixes plain text with link objects; both carry the words we want. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  const text = asRecord(value)['#text']
  return typeof text === 'string' ? text : ''
}

/** Each `trs` group is one part of speech, buried under tr → l → i. */
function translationGroups(entry: Record<string, unknown>): string[] {
  return asArray(entry.trs)
    .map((group) => {
      const label = asRecord(asRecord(asArray(asRecord(group).tr)[0]).l)
      return asArray(label.i).map(textOf).join('').trim()
    })
    .filter(Boolean)
}

function phoneticOf(entry: Record<string, unknown>, accent: Accent): string {
  const raw = accent === 'uk' ? entry.ukphone : entry.usphone
  const phonetic = typeof raw === 'string' ? raw.trim() : ''
  return phonetic ? `/${phonetic}/` : ''
}

function headwordOf(entry: Record<string, unknown>, fallback: string): string {
  const phrase = asRecord(asRecord(entry['return-phrase']).l).i
  const headword = textOf(phrase).trim()
  return headword || fallback
}

/** Word-level example sentences, handed out one per part of speech. */
function examplesOf(payload: Record<string, unknown>): string[] {
  return asArray(asRecord(payload.blng_sents_part)['sentence-pair'])
    .map((pair) => textOf(asRecord(pair).sentence).trim())
    .filter(Boolean)
}

/** Builds an entry from the English→Chinese dictionary, or null if it has none. */
export function parseEnglishEntry(
  payload: unknown,
  word: string,
  accent: Accent = 'us'
): Word | null {
  const root = asRecord(payload)
  const entry = asRecord(asArray(asRecord(root.ec).word)[0])
  const groups = translationGroups(entry)
  if (groups.length === 0) return null

  const phonetic = phoneticOf(entry, accent)
  const examples = examplesOf(root)

  const entries = groups
    .map((text, index) => {
      const match = PART_OF_SPEECH.exec(text)
      const body = match ? text.slice(match[0].length) : text
      return {
        partOfSpeech: match?.[1] ?? '',
        phonetic,
        meanings: body
          .split(SENSE_SEPARATOR)
          .map((sense) => sense.trim())
          .filter(Boolean),
        // One flat list for the whole word, so only the first sense can
        // honestly claim a sentence; the rest render without one.
        example: { sentence: index === 0 ? (examples[0] ?? '') : '' }
      }
    })
    .filter((candidate) => candidate.meanings.length > 0)

  if (entries.length === 0) return null

  return {
    exists: true,
    word: headwordOf(entry, word),
    suggestions: [],
    entries
  }
}

/**
 * The English word a Chinese query maps to. The Chinese→English dictionary
 * lists candidates most-common-first, and the first one is the headword to
 * look up properly.
 */
export function parseEnglishEquivalent(payload: unknown): string | null {
  const entry = asRecord(asArray(asRecord(asRecord(payload).ce).word)[0])
  for (const candidate of translationGroups(entry)) {
    const word = candidate.trim()
    if (word) return word
  }
  return null
}

/** Spelling corrections, which the endpoint offers for a query it cannot match. */
export function parseCorrections(payload: unknown): string[] {
  return asArray(asRecord(asRecord(payload).typos).typo)
    .map((entry) => textOf(asRecord(entry).word).trim())
    .filter(Boolean)
    .slice(0, 3)
}

/**
 * A misspelling gets answered twice over: a junk entry in the dictionary
 * ("recieve" → 奉, no part of speech, no transcription) alongside the right
 * corrections. Anything carrying a label or an IPA transcription is the real
 * article — including phrases, which have a label but no transcription.
 */
function isDictionaryGrade(word: Word): boolean {
  return word.entries.some(
    (entry) => entry.partOfSpeech !== '' || entry.phonetic !== ''
  )
}

async function request(query: string): Promise<unknown | null> {
  const url = `${ENDPOINT}?dicts=${encodeURIComponent(DICTS)}&q=${encodeURIComponent(query)}`
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    // Offline, blocked, slow, or answering something that is not JSON: the
    // model is the fallback for all of it.
    return null
  }
}

export async function lookupInDictionary(
  word: string,
  languages: LanguagePair,
  accent: Accent = 'us'
): Promise<Word | null> {
  if (!covers(languages)) return null

  const payload = await request(word)
  if (!payload) return null

  const english = parseEnglishEntry(payload, word, accent)
  const corrections = parseCorrections(payload)

  if (english && (corrections.length === 0 || isDictionaryGrade(english))) {
    return english
  }

  // Answering "did you mean" here keeps a typo as quick as a hit, instead of
  // spending a model call to be told the word is misspelled.
  if (corrections.length > 0) {
    return { exists: false, word, suggestions: corrections, entries: [] }
  }

  // A Chinese query needs two hops: name the English word, then look it up.
  const equivalent = parseEnglishEquivalent(payload)
  if (!equivalent) return null

  const second = await request(equivalent)
  return second ? parseEnglishEntry(second, equivalent, accent) : null
}
