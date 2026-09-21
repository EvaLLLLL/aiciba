import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/cli/main.ts', 'src/cli/postinstall.ts'],
    format: 'esm',
    target: 'node18',
    outDir: 'dist',
    clean: true,
    banner: {
      js: '#!/usr/bin/env node'
    }
  },
  // The Alfred workflow ships without node_modules, so its two entry points are
  // bundled whole. Keeping them separate matters: the filter runs on every
  // keystroke and must not pay to parse the AI SDK the lookup needs.
  {
    entry: {
      filter: 'src/alfred/filter.ts',
      lookup: 'src/alfred/lookup.ts'
    },
    format: 'esm',
    target: 'node18',
    outDir: 'dist-workflow',
    clean: true,
    splitting: false,
    noExternal: [/.*/]
  }
])
