/**
 * A dictionary runs between two languages: the one whose words you look up,
 * and the one their definitions are written in. `name` is the English name,
 * because that is what the model is told; the code is only used to recognise
 * pairs a faster source can handle.
 */
export interface Language {
  code: string
  name: string
}

interface LanguageChoice extends Language {
  /** What `ciba --config` shows, in the language's own script. */
  label: string
}

export const LANGUAGES: LanguageChoice[] = [
  { code: 'en', name: 'English', label: 'English' },
  { code: 'zh', name: 'Chinese', label: '中文 (Chinese)' },
  { code: 'ja', name: 'Japanese', label: '日本語 (Japanese)' },
  { code: 'ko', name: 'Korean', label: '한국어 (Korean)' },
  { code: 'es', name: 'Spanish', label: 'Español (Spanish)' },
  { code: 'fr', name: 'French', label: 'Français (French)' },
  { code: 'de', name: 'German', label: 'Deutsch (German)' },
  { code: 'it', name: 'Italian', label: 'Italiano (Italian)' },
  { code: 'pt', name: 'Portuguese', label: 'Português (Portuguese)' },
  { code: 'ru', name: 'Russian', label: 'Русский (Russian)' },
  { code: 'ar', name: 'Arabic', label: 'العربية (Arabic)' },
  { code: 'hi', name: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'th', name: 'Thai', label: 'ไทย (Thai)' },
  { code: 'vi', name: 'Vietnamese', label: 'Tiếng Việt (Vietnamese)' }
]

/** What the dictionary was before it could be anything else. */
export const DEFAULT_ENTRY_LANGUAGE: Language = { code: 'en', name: 'English' }
export const DEFAULT_DEFINITION_LANGUAGE: Language = {
  code: 'zh',
  name: 'Chinese'
}

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
}

/** Accepts a code (`ja`) or a name (`Japanese`), however it was typed. */
export function findLanguage(value: string): Language | null {
  const needle = value.trim().toLowerCase()
  if (!needle) return null

  for (const language of LANGUAGES) {
    if (language.code === needle || language.name.toLowerCase() === needle) {
      return { code: language.code, name: language.name }
    }
  }
  return null
}

/** A language the list does not carry: the model knows more of them than this file does. */
export function customLanguage(name: string): Language | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return findLanguage(trimmed) ?? { code: slug(trimmed), name: trimmed }
}

/** Reads a language back out of stored config, which is JSON and so unverified. */
export function asLanguage(value: unknown): Language | null {
  if (typeof value === 'string') return customLanguage(value)

  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  if (!record) return null

  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!name) return null

  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : slug(name)
  return { code, name }
}
