import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const path = new URL('../.dev.vars', import.meta.url)
if (!existsSync(path) || !/^SESSION_SECRET=.+$/m.test(readFileSync(path, 'utf8'))) {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') + '\n' : ''
  writeFileSync(path, existing + 'SESSION_SECRET=' + randomBytes(32).toString('base64url') + '\n', { mode: 0o600 })
}
console.log('Local session encryption is ready. Enter your API key in the Settings page.')
