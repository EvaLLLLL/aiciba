import chalk from 'chalk'
import type { Word } from './types'

export function sanitize(input: string): string {
  return input.trim().replace(/[^a-zA-Z\s'-]/g, '')
}

export const DIVIDER = chalk.dim('─'.repeat(40))

export function formatOutput(data: Word): string {
  const lines: string[] = []

  for (const entry of data.entries) {
    const pos = chalk.cyan.italic(entry.partOfSpeech.padEnd(5))
    const phonetic = entry.phonetic
      ? chalk.gray(`[${entry.phonetic.trim()}] `)
      : ''
    const meanings = entry.meanings.map((m) => m.trim()).join('；')

    lines.push(chalk.reset(`${pos} ${phonetic}${chalk.whiteBright(meanings)}`))

    if (entry.example && entry.example.sentence) {
      lines.push(
        chalk.reset(`      ${chalk.gray(entry.example.sentence.trim())}`)
      )
    }

    lines.push('')
  }

  return lines.join('\n').trim()
}
