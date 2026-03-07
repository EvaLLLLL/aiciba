import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import type { LanguageModel } from 'ai'
import { WordSchema } from './types'
import { getFromCache, saveToCache } from './cache'
import { loadConfig, type Config } from './config'

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

function handleApiError(error: unknown): never {
  console.error(error)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('401') ||
      msg.includes('authentication') ||
      msg.includes('api_key') ||
      msg.includes('invalid x-api-key')
    ) {
      throw new DictionaryError('Invalid API key. Run --config to update it.')
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
      throw new DictionaryError(
        'Rate limit exceeded. Please wait a moment and try again.'
      )
    }
    if (msg.includes('insufficient_quota') || msg.includes('billing')) {
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

export async function getResponseFromAi(word: string) {
  const cached = getFromCache(word)
  if (cached) return { output: cached, fromCache: true }

  const config = loadConfig()!
  const model = createModel(config)

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: WordSchema }),
      system:
        'You are a professional English-Chinese dictionary. ' +
        'Always provide accurate phonetic transcriptions in IPA format. ' +
        'If the input is not a valid English word, set exists to false, return an empty entries array, ' +
        'and suggest up to 3 similar valid English words in the suggestions field. ' +
        'Only provide one example sentence per part of speech.',
      prompt: `Look up the English word "${word}".`
    })

    if (output.exists) saveToCache(word, output)

    return { output, fromCache: false }
  } catch (error) {
    handleApiError(error)
  }
}
