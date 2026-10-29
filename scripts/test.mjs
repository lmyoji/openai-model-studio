import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
mkdirSync('.sites-runtime', { recursive: true })
await build({ entryPoints: ['tests/studio.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '.sites-runtime/studio.test.mjs', logLevel: 'warning' })
const result = spawnSync(process.execPath, ['--test', '.sites-runtime/studio.test.mjs'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
