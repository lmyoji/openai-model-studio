import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../.dev.vars', import.meta.url)
const defaultProxy = process.env.OPENAI_STUDIO_PROXY || 'http://127.0.0.1:7892,http://127.0.0.1:7897'

function upsert(content, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(content)) return content.replace(re, line)
  const trimmed = content.replace(/\s*$/, '')
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`
}

function stripGlobalProxyVars(content) {
  return content
    .split('\n')
    .filter(line => !/^(HTTP_PROXY|HTTPS_PROXY)=/i.test(line.trim()))
    .join('\n')
}

let content = existsSync(path) ? readFileSync(path, 'utf8') : ''
content = stripGlobalProxyVars(content)
if (!/^SESSION_SECRET=.+$/m.test(content)) {
  content = upsert(content, 'SESSION_SECRET', randomBytes(32).toString('base64url'))
}
content = upsert(content, 'OPENAI_STUDIO_PROXY', defaultProxy)
writeFileSync(path, content, { mode: 0o600 })

console.log(`Local session encryption is ready. OpenAI proxies (first live port wins): ${defaultProxy}`)
console.log('Tries 127.0.0.1:7892 then 7897. HTTP_PROXY is not set, so the dev server can start.')
