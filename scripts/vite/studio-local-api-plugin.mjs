import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const DEFAULT_PROXIES = ['http://127.0.0.1:7892', 'http://127.0.0.1:7897']

function parseDevVars(root) {
  const path = join(root, '.dev.vars')
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }
  return out
}

const proxyAgents = new Map()

function proxyList(value) {
  const fromEnv = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return fromEnv.length ? fromEnv : DEFAULT_PROXIES
}

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 400 })
    const finish = ok => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

let preferredProxy = ''
let loggedProxy = ''

async function liveProxies(value) {
  const open = []
  for (const url of proxyList(value)) {
    const port = Number(new URL(url).port)
    if (port && (await portOpen(port))) open.push(url)
  }
  if (!open.length) {
    throw new Error('本地代理 7892 和 7897 都没有在监听。请先打开 Clash / VPN，并确认 HTTP 端口是其中一个。')
  }
  if (preferredProxy && open.includes(preferredProxy)) {
    return [preferredProxy, ...open.filter(url => url !== preferredProxy)]
  }
  return open
}

function proxiedFetch(proxyUrl) {
  let agent = proxyAgents.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgents.set(proxyUrl, agent)
  }
  return (input, init) =>
    undiciFetch(input, { ...init, dispatcher: agent })
}

function isProxyFailure(error) {
  const cause = error?.cause
  const text = `${error?.message || ''} ${cause?.code || ''} ${cause?.message || ''}`.toLowerCase()
  return /econnrefused|etimedout|und_err_connect_timeout|fetch failed|socket|proxy|econnreset/.test(text)
}

async function fetchViaLiveProxy(configured) {
  const proxies = await liveProxies(configured)
  return async (input, init) => {
    let lastError
    for (const proxy of proxies) {
      try {
        const response = await proxiedFetch(proxy)(input, init)
        preferredProxy = proxy
        if (loggedProxy !== proxy) {
          loggedProxy = proxy
          console.log(`[studio] OpenAI 出站代理: ${proxy}`)
        }
        return response
      } catch (error) {
        lastError = error
        if (preferredProxy === proxy) preferredProxy = ''
        if (!isProxyFailure(error)) throw error
      }
    }
    throw lastError
  }
}

function nodeRequest(req, host) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const init = { method: req.method, headers }
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    init.body = req
    init.duplex = 'half'
  }
  return new Request(`http://${host}${req.url}`, init)
}

async function writeResponse(res, response) {
  res.statusCode = response.status
  const sse = (response.headers.get('content-type') || '').includes('text/event-stream')
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.appendHeader(key, value)
    else res.setHeader(key, value)
  })
  if (sse) {
    res.setHeader('cache-control', 'no-cache, no-transform')
    res.setHeader('x-accel-buffering', 'no')
  }
  if (!response.body) {
    res.end()
    return
  }
  res.flushHeaders?.()
  res.socket?.setNoDelay?.(true)
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const ok = res.write(Buffer.from(value))
    if (!ok) await new Promise(resolve => res.once('drain', resolve))
  }
  res.end()
}

/** Local dev: /api/studio in Node + OPENAI_STUDIO_PROXY (undici must not load in the Worker bundle). */
export function studioLocalApi({ handleStudioRequest }) {
  return {
    name: 'studio-local-api',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      const root = server.config.root

      server.middlewares.use(async (req, res, next) => {
        const pathOnly = req.url?.split('?')[0] ?? ''
        if (!pathOnly.startsWith('/api/studio/')) return next()
        if (req.headers.upgrade?.toLowerCase() === 'websocket') return next()

        try {
          const vars = parseDevVars(root)
          const secret = vars.SESSION_SECRET
          if (!secret) {
            res.statusCode = 503
            res.end('SESSION_SECRET missing — run npm run setup:local')
            return
          }
          const host = req.headers.host ?? '127.0.0.1:5173'
          const response = await handleStudioRequest(
            nodeRequest(req, host),
            secret,
            await fetchViaLiveProxy(vars.OPENAI_STUDIO_PROXY || process.env.OPENAI_STUDIO_PROXY),
          )
          await writeResponse(res, response)
        } catch (error) {
          const message = error instanceof Error ? error.message : '本地代理不可用'
          if (message.includes('7892')) {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: { message } }))
            return
          }
          next(error)
        }
      })
    },
  }
}
