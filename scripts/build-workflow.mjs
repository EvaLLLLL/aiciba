#!/usr/bin/env node
/**
 * Packs the bundled entry points, the shell wrappers and the icon into an
 * installable `.alfredworkflow` — a zip with info.plist at its root, which
 * Alfred imports on double-click.
 *
 * Run `tsup` first (or use `pnpm build:workflow`, which does both).
 */
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { workflow } from '../workflow/plist.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'workflow')
const outDir = join(root, 'dist-workflow')
const stage = join(outDir, 'workflow')
const artifact = join(outDir, 'AICIBA.alfredworkflow')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))

for (const bundle of ['filter.js', 'lookup.js']) {
  if (!existsSync(join(outDir, bundle))) {
    throw new Error(`Missing ${bundle} — run \`tsup\` before this script.`)
  }
}

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })

cpSync(join(outDir, 'filter.js'), join(stage, 'filter.js'))
cpSync(join(outDir, 'lookup.js'), join(stage, 'lookup.js'))
cpSync(join(source, 'icon.png'), join(stage, 'icon.png'))
cpSync(join(source, 'scripts'), join(stage, 'scripts'), { recursive: true })

// Alfred runs these as external scripts, so the executable bit has to survive
// into the zip.
for (const name of readdirSync(join(stage, 'scripts'))) {
  chmodSync(join(stage, 'scripts', name), 0o755)
}

const plist = workflow({
  version: pkg.version,
  description: 'A dictionary between any two languages',
  webaddress: pkg.homepage ?? '',
  createdby: pkg.author ?? '',
  readme: readFileSync(join(source, 'readme.md'), 'utf-8')
})

// plutil reads JSON and writes the XML plist Alfred expects.
execFileSync(
  '/usr/bin/plutil',
  ['-convert', 'xml1', '-o', join(stage, 'info.plist'), '-'],
  { input: JSON.stringify(plist) }
)
execFileSync('/usr/bin/plutil', ['-lint', join(stage, 'info.plist')], {
  stdio: 'ignore'
})

rmSync(artifact, { force: true })
execFileSync('/usr/bin/zip', ['-r', '-X', '-q', artifact, '.'], { cwd: stage })

const size = (statSync(artifact).size / 1024 / 1024).toFixed(2)
console.log(
  `${artifact.replace(`${root}/`, '')}  ${size} MB  (v${pkg.version})`
)
