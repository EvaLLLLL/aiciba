import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DATA_DIR } from './paths'

const CONFIG_FILE = join(DATA_DIR, 'config.json')

export type Provider = 'anthropic' | 'openai' | 'gemini'

export interface Config {
  provider: Provider
  apiKey: string
  model: string
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
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' }
  ],
  openai: [
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini (fastest)' },
    { value: 'gpt-5.4-pro-2026-03-05', label: 'GPT-5 Pro (most capable)' }
  ],
  gemini: [
    {
      value: 'gemini-3.1-flash-lite-preview',
      label: 'Gemini 3.1 Flash (fastest)'
    },
    {
      value: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro (most capable)'
    }
  ]
}

export function loadConfig(): Config | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Config
  } catch {
    return null
  }
}

export function saveConfig(config: Config): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}
