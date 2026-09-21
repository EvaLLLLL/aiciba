import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import type { LanguageModel } from 'ai'
import { wordSchema } from './types'
import { lookupInDictionary, resolveAccent } from './dictionary'
import { getFromCache, saveToCache } from './cache'
import { loadConfig, type Config, type Provider } from './config'
import {
  DEFAULT_DEFINITION_LANGUAGE,
  DEFAULT_ENTRY_LANGUAGE
} from './languages'

function createModel(config: Config): LanguageModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(config.model)
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey })(config.model)
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model)
  }
}

export class DictionaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DictionaryError'
  }
}

/** The AI SDK reports HTTP failures on the error object; its message is often just "Unauthorized". */
function statusOf(error: unknown): number | undefined {
  if (error instanceof Error && 'statusCode' in error) {
    const status = (error as Error & { statusCode?: unknown }).statusCode
    if (typeof status === 'number') return status
  }
  return undefined
}

function handleApiError(error: unknown): never {
  console.error(error)
  const status = statusOf(error)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      status === 401 ||
      status === 403 ||
      msg.includes('401') ||
      msg.includes('authentication') ||
      msg.includes('api_key') ||
      msg.includes('invalid x-api-key')
    ) {
      throw new DictionaryError(
        'Invalid API key. Check your AICIBA configuration.'
      )
    }
    if (status === 404) {
      throw new DictionaryError(
        'That model does not exist. Check the model name in your configuration.'
      )
    }
    if (status === 429 || msg.includes('429') || msg.includes('rate limit')) {
      throw new DictionaryError(
        'Rate limit exceeded. Please wait a moment and try again.'
      )
    }
    if (
      status === 402 ||
      msg.includes('insufficient_quota') ||
      msg.includes('billing')
    ) {
      throw new DictionaryError(
        'API quota exceeded. Please check your billing settings.'
      )
    }
    if (
      msg.includes('fetch failed') ||
      msg.includes('enotfound') ||
      msg.includes('network')
    ) {
      throw new DictionaryError(
        'Network error. Please check your internet connection.'
      )
    }
  }
  throw new DictionaryError('Unexpected error. Please try again.')
}

function systemPrompt(config: Config): string {
  const entry = config.entryLanguage.name
  const definitions = config.definitionLanguage.name

  return (
    `You are a professional ${entry}-${definitions} dictionary. ` +
    `Every definition you write must be in ${definitions}. ` +
    'Always provide accurate phonetic transcriptions in IPA format. ' +
    `If the input cannot be mapped to a valid ${entry} word, set exists to false, return an empty entries array, ` +
    `and suggest up to 3 similar valid ${entry} words in the suggestions field. ` +
    'Only provide one example sentence per part of speech.'
  )
}

/**
 * One prompt for both directions. Asking the model which language it is looking
 * at beats guessing from the characters: two languages can share a script, and
 * the model has to read the word anyway.
 */
function lookupPrompt(word: string, config: Config): string {
  const entry = config.entryLanguage.name
  const definitions = config.definitionLanguage.name

  return (
    `Look up "${word}". It may be written in ${entry} or in ${definitions}. ` +
    `If it is ${definitions}, find its primary ${entry} equivalent and return the entry for that word. ` +
    `The "word" field must always hold the ${entry} word.`
  )
}

/**
 * Looking a word up is recall, not deliberation, but the GPT-5 family reasons by
 * default and you wait for it: a fresh lookup measured 10.3s at default effort
 * against 2.1s at low, with richer meanings coming back, not thinner ones.
 *
 * 'low' rather than 'minimal' on purpose — both current families accept it,
 * where 'minimal' is refused by the 5.4 models and costs a wasted round trip.
 */
function speedOptions(
  provider: Provider
): Record<string, Record<string, string>> | null {
  return provider === 'openai'
    ? { openai: { reasoningEffort: 'low' } }
    : null
}

/** The heavyweight models refuse the knob outright rather than ignoring it. */
function refusesSpeedOptions(error: unknown): boolean {
  return (
    statusOf(error) === 400 &&
    error instanceof Error &&
    /unsupported|not supported/i.test(error.message)
  )
}

/** Asks the model, for everything the dictionary could not answer. */
async function askModel(word: string, config: Config) {
  const model = createModel(config)

  const settings = {
    model,
    output: Output.object({
      schema: wordSchema(config.entryLanguage, config.definitionLanguage)
    }),
    system: systemPrompt(config),
    prompt: lookupPrompt(word, config)
  }
  const faster = speedOptions(config.provider)

  try {
    const { output } = await generateText(
      faster ? { ...settings, providerOptions: faster } : settings
    ).catch((error: unknown) => {
      if (!refusesSpeedOptions(error)) throw error
      return generateText(settings)
    })

    if (output.exists) saveToCache(word, output)
    return { output, fromCache: false }
  } catch (error) {
    handleApiError(error)
  }
}

/**
 * Three sources, in ascending order of what they cost you in time: the cache
 * answers instantly, the dictionary in about 0.3s, the model in a second or
 * two. Every answer lands in the same cache, so it is only ever paid once.
 */
export async function lookupWord(
  word: string,
  options: { skipCache?: boolean } = {}
) {
  // A forced refresh goes back to the sources instead of serving the stored answer.
  const cached = options.skipCache ? null : getFromCache(word)
  if (cached) return { output: cached, fromCache: true }

  const config = loadConfig()

  // The dictionary asks for no credentials, so it answers whether or not the
  // model has been set up. Unconfigured, that is the pair it was always for.
  const languages = config ?? {
    entryLanguage: DEFAULT_ENTRY_LANGUAGE,
    definitionLanguage: DEFAULT_DEFINITION_LANGUAGE
  }
  const entry = await lookupInDictionary(word, languages, resolveAccent())
  if (entry?.exists) {
    saveToCache(word, entry)
    return { output: entry, fromCache: false }
  }

  if (!config) {
    // Unconfigured, the dictionary's "did you mean" is all there is.
    if (entry) return { output: entry, fromCache: false }
    throw new DictionaryError(
      'No API key configured. Check your AICIBA configuration.'
    )
  }

  const answer = await askModel(word, config)

  // The dictionary only ever said the word is not in *it*. Its corrections are
  // worth keeping once the model agrees the word does not exist.
  if (!answer.output.exists && entry && entry.suggestions.length > 0) {
    return {
      ...answer,
      output: { ...answer.output, suggestions: entry.suggestions }
    }
  }

  return answer
}
