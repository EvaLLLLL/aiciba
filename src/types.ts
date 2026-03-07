import { z } from 'zod'

const WordEntrySchema = z.object({
  partOfSpeech: z
    .string()
    .describe('Part of speech, e.g. n. v. adj. adv. prep. conj.'),
  phonetic: z.string().describe('Phonetic transcription, e.g. /ˈɛɡzæmpl/'),
  meanings: z
    .array(z.string())
    .describe('List of Chinese definitions for this part of speech'),
  example: z
    .object({
      sentence: z.string().describe('One example sentence in English')
    })
    .describe('One example sentence for this part of speech')
})

export const WordSchema = z.object({
  exists: z.boolean().describe('Whether the word exists in English'),
  word: z.string().describe('The original word being looked up'),
  suggestions: z
    .array(z.string())
    .describe(
      'Up to 3 similar valid English words if the input word does not exist. Empty array if the word exists.'
    ),
  entries: z
    .array(WordEntrySchema)
    .describe(
      'All part-of-speech entries for this word. Empty array if the word does not exist.'
    )
})

export type Word = z.infer<typeof WordSchema>
