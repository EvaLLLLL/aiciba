import { z } from 'zod'
import type { Language } from './languages'

/**
 * The shape of a dictionary entry. These descriptions reach the model as part
 * of the schema, so they name the configured languages rather than assuming a
 * pair: `entry` is the language of the headword, `definitions` the language the
 * meanings are written in.
 */
export function wordSchema(entry: Language, definitions: Language) {
  return z.object({
    exists: z
      .boolean()
      .describe(`Whether the word exists in ${entry.name}`),
    word: z
      .string()
      .describe(`The ${entry.name} headword this entry is for`),
    suggestions: z
      .array(z.string())
      .describe(
        `Up to 3 similar valid ${entry.name} words if the input word does not exist. Empty array if the word exists.`
      ),
    entries: z
      .array(
        z.object({
          partOfSpeech: z
            .string()
            .describe('Part of speech, e.g. n. v. adj. adv. prep. conj.'),
          phonetic: z
            .string()
            .describe('Phonetic transcription, e.g. /ˈɛɡzæmpl/'),
          meanings: z
            .array(z.string())
            .describe(
              `List of ${definitions.name} definitions for this part of speech`
            ),
          example: z
            .object({
              sentence: z
                .string()
                .describe(`One example sentence in ${entry.name}`)
            })
            .describe('One example sentence for this part of speech')
        })
      )
      .describe(
        'All part-of-speech entries for this word. Empty array if the word does not exist.'
      )
  })
}

export type Word = z.infer<ReturnType<typeof wordSchema>>
