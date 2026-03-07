import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }
export { version }