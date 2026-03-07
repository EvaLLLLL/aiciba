import { Chalk } from 'chalk'

const chalk = new Chalk({ level: 3 })

console.log('')
console.log(
  `  ${chalk.bold.cyan('AICIBA')} ${chalk.dim('— AI-powered English-Chinese dictionary')}`
)
console.log('')
console.log(`  ${chalk.bold('Get started:')}`)
console.log(
  `  ${chalk.cyan('ciba')} ${chalk.dim('<word>')}        Look up a word`
)
console.log(
  `  ${chalk.cyan('ciba')} ${chalk.dim('--help')}        Show all commands`
)
console.log('')
console.log(`  ${chalk.dim('Config will be created on first run.')}`)
console.log('')
