import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Config } from './config'

// config.ts reads its directory once, at load, so point it at scratch space
// before importing: a real ~/.aiciba must never be read or written here.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'aiciba-config-test-'))
process.env.AICIBA_HOME = DATA_DIR

const { loadConfig, saveConfig } = await import('./config')

const CONFIG_FILE = join(DATA_DIR, 'config.json')

const config: Config = {
  provider: 'anthropic',
  apiKey: 'sk-test',
  model: 'claude-haiku-4-5-20251001',
  entryLanguage: { code: 'en', name: 'English' },
  definitionLanguage: { code: 'zh', name: 'Chinese' }
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true })
  mkdirSync(DATA_DIR, { recursive: true })
  for (const key of [
    'AICIBA_API_KEY',
    'AICIBA_PROVIDER',
    'AICIBA_MODEL',
    'AICIBA_ENTRY_LANGUAGE',
    'AICIBA_DEFINITION_LANGUAGE'
  ]) {
    delete process.env[key]
  }
})

after(() => rmSync(DATA_DIR, { recursive: true, force: true }))

test('an API key in the environment overrides the config file', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  process.env.AICIBA_API_KEY = 'sk-env'
  process.env.AICIBA_PROVIDER = 'gemini'
  process.env.AICIBA_MODEL = 'gemini-3.1-pro-preview'

  assert.deepEqual(loadConfig(), {
    ...config,
    provider: 'gemini',
    apiKey: 'sk-env',
    model: 'gemini-3.1-pro-preview'
  })
})

test('an empty provider means the one the config file saved', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  // What Alfred's Provider popup ships as its default, labelled "From ciba CLI".
  process.env.AICIBA_PROVIDER = ''

  assert.deepEqual(loadConfig(), config)
})

test('a provider named without a key of its own is refused', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  process.env.AICIBA_PROVIDER = 'gemini'

  // Borrowing the stored Anthropic key for Gemini would fail as a 401 that
  // blames the key; saying nothing is configured names the real problem.
  assert.equal(loadConfig(), null)
})

test('an unusable provider does not fall back to the stored credentials', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  process.env.AICIBA_API_KEY = 'sk-env'
  process.env.AICIBA_PROVIDER = 'deepmind'

  // The key the user supplied must not be quietly swapped for someone else's.
  assert.equal(loadConfig(), null)
})

test('a model set in Alfred applies on top of the key from the file', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  process.env.AICIBA_MODEL = 'claude-sonnet-5'

  assert.deepEqual(loadConfig(), { ...config, model: 'claude-sonnet-5' })
})

test('an environment key with no model picks the provider default', () => {
  process.env.AICIBA_API_KEY = 'sk-env'
  process.env.AICIBA_PROVIDER = 'openai'

  assert.equal(loadConfig()?.model, 'gpt-5.4-mini')
})

test('an unknown provider is refused rather than guessed', () => {
  process.env.AICIBA_API_KEY = 'sk-env'
  process.env.AICIBA_PROVIDER = 'deepmind'

  assert.equal(loadConfig(), null)
  assert.equal(existsSync(CONFIG_FILE), false)
})

test('a config written before languages existed is English to Chinese', () => {
  writeFileSync(
    CONFIG_FILE,
    JSON.stringify({
      provider: 'openai',
      apiKey: 'sk-file',
      model: 'gpt-5.4-mini'
    }),
    'utf-8'
  )

  assert.deepEqual(loadConfig()?.entryLanguage, { code: 'en', name: 'English' })
  assert.deepEqual(loadConfig()?.definitionLanguage, {
    code: 'zh',
    name: 'Chinese'
  })
})

test('a key from Alfred does not drag the pair back to the default', () => {
  writeFileSync(
    CONFIG_FILE,
    JSON.stringify({
      ...config,
      entryLanguage: { code: 'ja', name: 'Japanese' },
      definitionLanguage: { code: 'en', name: 'English' }
    }),
    'utf-8'
  )
  process.env.AICIBA_API_KEY = 'sk-env'
  process.env.AICIBA_PROVIDER = 'openai'

  const resolved = loadConfig()

  assert.equal(resolved?.apiKey, 'sk-env')
  assert.deepEqual(resolved?.entryLanguage, { code: 'ja', name: 'Japanese' })
  assert.deepEqual(resolved?.definitionLanguage, { code: 'en', name: 'English' })
})

test('the environment can set the pair on its own', () => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
  process.env.AICIBA_ENTRY_LANGUAGE = 'Spanish'
  process.env.AICIBA_DEFINITION_LANGUAGE = 'fr'

  assert.deepEqual(loadConfig()?.entryLanguage, { code: 'es', name: 'Spanish' })
  assert.deepEqual(loadConfig()?.definitionLanguage, {
    code: 'fr',
    name: 'French'
  })
})

test('a config saved by --config round-trips with both languages', () => {
  const japanese: Config = {
    provider: 'openai',
    apiKey: 'sk-saved',
    model: 'gpt-5.4-mini',
    entryLanguage: { code: 'ja', name: 'Japanese' },
    definitionLanguage: { code: 'en', name: 'English' }
  }

  saveConfig(japanese)

  assert.deepEqual(loadConfig(), japanese)
  // Written where the CLI says it writes, and readable as plain JSON.
  assert.deepEqual(
    JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')),
    japanese
  )
})

test('a language off the list survives the round-trip', () => {
  const swahili: Config = {
    ...config,
    entryLanguage: { code: 'swahili', name: 'Swahili' }
  }

  saveConfig(swahili)

  assert.deepEqual(loadConfig()?.entryLanguage, {
    code: 'swahili',
    name: 'Swahili'
  })
})
