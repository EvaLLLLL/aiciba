import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const bundle = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'postinstall.js'
)
if (existsSync(bundle)) {
  await import(pathToFileURL(bundle).href)
}
