import {
  text,
  select,
  spinner,
  note,
  log,
  password,
  isCancel,
  confirm,
  updateSettings,
  intro
} from '@clack/prompts'
import chalk from 'chalk'

import { sanitize } from '../core/query'
import { formatOutput } from './render'
import { version } from './version'
import { lookupWord, DictionaryError } from '../core/lookup'
import { getHistory, clearCache } from '../core/cache'
import {
  loadConfig,
  saveConfig,
  MODELS,
  PROVIDERS,
  type Config,
  type Provider
} from '../core/config'
import {
  customLanguage,
  findLanguage,
  LANGUAGES,
  type Language
} from '../core/languages'

updateSettings({ withGuide: false })

function showHelp(): void {
  const cmd = (s: string) => chalk.cyan(s.padEnd(16))
  note(
    [
      `${cmd('ciba <word>')}  Look up a word`,
      `${cmd('ciba -l')}  Browse recent history`,
      '',
      `${cmd('--config')}  Reconfigure languages, provider, model, and key`,
      `${cmd('--clear')}  Clear all history`,
      `${cmd('--version')}  Show version`,
      `${cmd('--help')}  Show this message`
    ].join('\n'),
    'aiciba'
  )
}

const OTHER_LANGUAGE = '__other__'

/** Any language the model knows, whether or not this list happens to name it. */
async function chooseLanguage(
  message: string,
  initialValue: string
): Promise<Language> {
  const choice = await select({
    message,
    initialValue,
    options: [
      ...LANGUAGES.map((language) => ({
        value: language.code,
        label: language.label
      })),
      { value: OTHER_LANGUAGE, label: chalk.dim('Other…') }
    ]
  })

  if (isCancel(choice)) process.exit(0)

  const listed = findLanguage(choice as string)
  if (listed) return listed

  // Loops rather than exits: a stray Return should not end the setup.
  for (;;) {
    const name = await text({
      message: 'Language name, in English:',
      placeholder: 'Swahili',
      validate: (value) =>
        value?.trim() ? undefined : 'A language needs a name.'
    })

    if (isCancel(name)) process.exit(0)

    const custom = customLanguage(name)
    if (custom) return custom
  }
}

async function setupConfig(): Promise<void> {
  intro(chalk.bold.cyan('AICIBA') + chalk.dim('  AI Dictionary'))
  log.info('Setup — saved to ~/.aiciba/config.json')

  const entryLanguage = await chooseLanguage('Look up words in:', 'en')
  const definitionLanguage = await chooseLanguage(
    'Write definitions in:',
    entryLanguage.code === 'zh' ? 'en' : 'zh'
  )

  const provider = await select({
    message: 'Choose a provider:',
    options: PROVIDERS
  })

  if (isCancel(provider)) {
    process.exit(0)
  }

  const apiKey = await password({
    message: `Enter your ${provider} API key:`
  })

  if (isCancel(apiKey) || !apiKey.trim()) {
    process.exit(0)
  }

  const model = await select({
    message: 'Choose a model:',
    options: MODELS[provider as Provider]
  })

  if (isCancel(model)) {
    process.exit(0)
  }

  const config: Config = {
    provider: provider as Provider,
    apiKey: apiKey.trim(),
    model: model as string,
    entryLanguage,
    definitionLanguage
  }

  saveConfig(config)
  log.success(
    `Saved — ${entryLanguage.name} words, ${definitionLanguage.name} definitions.`
  )
}

async function lookupAndDisplay(word: string): Promise<void> {
  const s = spinner()
  s.start(`Looking up ${chalk.bold.cyan(word)}`)
  const { output, fromCache } = await lookupWord(word)

  s.clear()

  if (!output.exists) {
    if (output.suggestions.length === 0) {
      log.error(
        `"${word}" is not a valid ${loadConfig()?.entryLanguage.name ?? 'English'} word.`
      )
      return
    }
    const chosen = await select({
      message: `"${word}" was not found. Did you mean:`,
      options: output.suggestions.map((w) => ({ value: w, label: w }))
    })
    if (isCancel(chosen)) return

    const s2 = spinner()
    s2.start(`Looking up ${chalk.bold.cyan(chosen)}`)
    const { output: corrected, fromCache: fc } = await lookupWord(
      chosen as string
    )
    s2.stop(
      fc
        ? `Found ${chalk.bold.cyan(chosen)} ${chalk.dim('(from cache)')}`
        : `Found ${chalk.bold.cyan(chosen)}`
    )

    note(
      formatOutput(corrected),
      chalk.bold.green(
        fc
          ? `Definition: ${corrected.word} ${chalk.dim('(from cache)')}`
          : `Definition: ${corrected.word}`
      )
    )
    return
  }

  note(
    formatOutput(output),
    chalk.bold.green(
      fromCache
        ? `Definition: ${output.word} ${chalk.dim('(from cache)')}`
        : `Definition: ${output.word}`
    )
  )
}

async function main() {
  console.log('')
  const args = process.argv.slice(2)
  const firstArg = args.length > 0 ? args.join(' ') : undefined

  if (firstArg === '--version') {
    console.log(`aiciba v${version}`)
    return
  }

  if (firstArg === '--help') {
    showHelp()
    return
  }

  if (firstArg === '--config') {
    await setupConfig()
    return
  }

  if (firstArg === '--clear') {
    const ok = await confirm({ message: 'Clear all history?' })

    if (!isCancel(ok) && ok) {
      clearCache()
      log.success('History cleared.')
    }
    return
  }

  if (!loadConfig()) await setupConfig()

  if (firstArg === '-l') {
    const history = getHistory()

    if (history.length === 0) {
      log.info('No history yet.')
      return
    }

    const PAGE_SIZE = 5
    const hasMore = history.length > PAGE_SIZE

    const recentOptions = history.slice(0, PAGE_SIZE).map((w) => ({
      value: w.word,
      label: w.word
    }))

    const options = hasMore
      ? [
          ...recentOptions,
          { value: '__search__', label: chalk.dim('Search...') }
        ]
      : recentOptions

    let chosen = await select({
      message: 'Recent words:',
      options
    })

    if (isCancel(chosen)) {
      return
    }

    if (chosen === '__search__') {
      const query = await text({ message: 'Search history:' })

      if (isCancel(query) || !query.trim()) {
        return
      }

      const matches = history.filter((w) =>
        w.word.toLowerCase().includes(query.trim().toLowerCase())
      )

      if (matches.length === 0) {
        log.error(`No results for "${query}".`)
        return
      }

      const matched = await select({
        message: `Results for "${query}":`,
        options: matches.map((w) => ({
          value: w.word,
          label: w.word
        }))
      })

      if (isCancel(matched)) {
        return
      }

      chosen = matched as string
    }

    await lookupAndDisplay(chosen as string)
    return
  }

  let userInput = firstArg ?? ''

  if (!firstArg) {
    const res = await text({ message: 'Enter a word:' })

    if (isCancel(res)) {
      return
    }

    userInput = res.trim()
  }

  const sanitizedInput = sanitize(userInput)

  if (!sanitizedInput) {
    log.error('Invalid input.')
    return
  }

  await lookupAndDisplay(sanitizedInput)
}

main().catch((e) => {
  if (e instanceof DictionaryError) {
    log.error(e.message)
  } else {
    console.error(e)
  }

  process.exit(1)
})
