import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/**
 * The manifest sits one level up from the bundle in `dist/` and two up from the
 * source in `src/cli/`, and both are run: `pnpm dev` uses the source directly.
 */
function readVersion(): string {
  for (const path of ['../package.json', '../../package.json']) {
    try {
      const pkg = require(path) as { version?: string }
      if (pkg.version) return pkg.version
    } catch {
      /* not at this level; try the next */
    }
  }
  return '0.0.0'
}

export const version = readVersion()
