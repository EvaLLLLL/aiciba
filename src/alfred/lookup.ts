import { DictionaryError, lookupWord } from '../core/lookup'
import { loadConfig } from '../core/config'
import { sanitize } from '../core/query'
import {
  clearError,
  clearPending,
  markPending,
  pruneState,
  writeError
} from './state'

const FORCE_FLAG = '--force'

const args = process.argv.slice(2)
const force = args.includes(FORCE_FLAG)
const word = sanitize(args.find((arg) => arg !== FORCE_FLAG) ?? '')

/**
 * Runs detached from Alfred: the Script Filter watches the markers this writes
 * and re-runs itself until one of them lands.
 */
if (word) {
  markPending(word)
  clearError(word)

  try {
    const { output } = await lookupWord(word, { skipCache: force })
    if (!output.exists) {
      writeError(
        word,
        `“${word}” is not a valid ${loadConfig()?.entryLanguage.name ?? 'English'} word`,
        output.suggestions
      )
    }
  } catch (error) {
    writeError(
      word,
      error instanceof DictionaryError
        ? error.message
        : 'Unexpected error. Please try again.'
    )
  } finally {
    clearPending(word)
    pruneState()
  }
}
