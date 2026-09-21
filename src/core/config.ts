import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DATA_DIR } from './paths'
import {
  asLanguage,
  DEFAULT_DEFINITION_LANGUAGE,
  DEFAULT_ENTRY_LANGUAGE,
  type Language
} from './languages'

const CONFIG_FILE = join(DATA_DIR, 'config.json')

export type Provider = 'anthropic' | 'openai' | 'gemini'

export interface Config {
  provider: Provider
  apiKey: string
  model: string
  /** The language of the words being looked up. */
  entryLanguage: Language
  /** The language their definitions are written in. */
  definitionLanguage: Language
}

export const PROVIDERS: { value: Provider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'gemini', label: 'Google (Gemini)' }
]

export const MODELS: Record<Provider, { value: string; label: string }[]> = {
  anthropic: [
    {
      value: 'claude-haiku-4-5-20251001',
      label: 'Claude Haiku 4.5 (fastest)'
    },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (balanced)' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (most capable)' }
  ],
  // The first entry is what an unset model falls back to, so it is the one that
  // answers a lookup in about two seconds rather than a minute and a half.
  openai: [
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (recommended)' },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (fastest)' },
    { value: 'gpt-5.6', label: 'GPT-5.6 (most capable)' }
  ],
  gemini: [
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (fastest)' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (most capable)' }
  ]
}

/** Credentials, before the languages are layered on. */
type Credentials = Omit<Config, 'entryLanguage' | 'definitionLanguage'>

function readStored(): Record<string, unknown> | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

/** Own properties only: `MODELS['constructor']` is otherwise a truthy function. */
function knownProvider(value: unknown): Provider | null {
  return typeof value === 'string' && Object.hasOwn(MODELS, value)
    ? (value as Provider)
    : null
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Alfred hands the provider, model and key to its scripts as environment
 * variables, so the workflow needs no `~/.aiciba/config.json`, and a field left
 * empty there falls back to whatever `ciba --config` saved.
 *
 * A key belongs to exactly one provider, so those two always travel together:
 * a provider named without a key of its own cannot borrow the stored one, and
 * an unknown provider is refused rather than quietly resolved to somebody
 * else's account. The model then belongs to whichever provider won.
 */
function credentials(stored: Record<string, unknown> | null): Credentials | null {
  const envKey = process.env.AICIBA_API_KEY?.trim()
  const envProvider = process.env.AICIBA_PROVIDER?.trim()
  const envModel = process.env.AICIBA_MODEL?.trim()

  const named = envProvider ? knownProvider(envProvider) : null
  if (envProvider && !named) return null

  const storedProvider = knownProvider(stored?.provider)
  const storedKey = trimmed(stored?.apiKey)
  const storedModel = trimmed(stored?.model)

  const provider = envKey ? (named ?? storedProvider) : storedProvider
  if (!provider) return null

  // Without its own key, a named provider would end up holding the stored
  // provider's key — a 401 that blames the key rather than the mismatch.
  if (!envKey && named && named !== provider) return null

  const apiKey = envKey || storedKey
  if (!apiKey) return null

  return {
    provider,
    apiKey,
    model: envModel || storedModel || MODELS[provider][0]!.value
  }
}

/**
 * Languages resolve on their own, so a key supplied by Alfred never drags the
 * pair back to the default: the environment wins, then whatever `ciba --config`
 * saved, and only then English to Chinese — which is what every config written
 * before this existed meant.
 */
function withLanguages(
  credentials: Credentials,
  stored: Record<string, unknown> | null
): Config {
  return {
    ...credentials,
    entryLanguage:
      asLanguage(process.env.AICIBA_ENTRY_LANGUAGE) ??
      asLanguage(stored?.entryLanguage) ??
      DEFAULT_ENTRY_LANGUAGE,
    definitionLanguage:
      asLanguage(process.env.AICIBA_DEFINITION_LANGUAGE) ??
      asLanguage(stored?.definitionLanguage) ??
      DEFAULT_DEFINITION_LANGUAGE
  }
}

export function loadConfig(): Config | null {
  const stored = readStored()
  const resolved = credentials(stored)

  return resolved ? withLanguages(resolved, stored) : null
}

export function saveConfig(config: Config): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}
