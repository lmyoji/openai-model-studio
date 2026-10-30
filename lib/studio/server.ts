import apiPaths from '../generated/endpoints.json'

const COOKIE = 'openai_studio_session'
const API_ORIGINS = new Set(['https://api.openai.com', 'https://eu.api.openai.com', 'https://us.api.openai.com'])
const JSON_LIMIT = 32 * 1024
const UPLOAD_LIMIT = 64 * 1024 * 1024

interface StoredSession {
  apiKey: string
  baseUrl: string
  organization: string
  project: string
  expiresAt: number
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function upstreamErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
  const code = cause && typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code: string }).code) : ''
  const detail = `${code} ${cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''} ${message}`.toLowerCase()
  if (/und_err_connect_timeout|etimedout|econnrefused|enotfound|fetch failed|network|socket hang up/.test(detail)) {
    return '本地工作台无法连上 OpenAI API。会自动尝试本机代理 127.0.0.1:7892 和 7897，请确认其中一个已开启。不要设置 HTTP_PROXY/HTTPS_PROXY，否则页面可能无法启动。'
  }
  return '连接 OpenAI 失败，请检查网络或稍后重试。'
}

export function validateBaseUrl(value: unknown) {
  if (typeof value !== 'string') throw new HttpError(400, '请选择有效的 OpenAI API 地址。')
  let url: URL
  try { url = new URL(value) } catch { throw new HttpError(400, 'API 地址格式不正确。') }
  if (!API_ORIGINS.has(url.origin) || url.username || url.password || url.search || url.hash || !['/v1', '/v1/'].includes(url.pathname)) throw new HttpError(400, '此工作台只向官方 OpenAI API 地址发送密钥。')
  return `${url.origin}/v1`
}

export function validateApiPath(value: string) {
  let decoded: string
  try { decoded = decodeURIComponent(value) } catch { throw new HttpError(400, '接口路径编码无效。') }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\s\u0000-\u001f#]/.test(decoded) || decoded.split(/[/?]/).includes('..') || /%2f|%5c|%2e/i.test(decoded)) throw new HttpError(400, '接口路径无效，请填写 /responses 这样的相对路径。')
  const parsed = new URL(decoded, 'https://api.openai.com/v1')
  const roots = new Set(apiPaths.map(p => p.split('/')[1]))
  if (!roots.has(parsed.pathname.split('/')[1])) throw new HttpError(400, '此路径不在官方 API 目录中。')
  return parsed.pathname + parsed.search
}

function json(value: unknown, status = 200, extra?: HeadersInit) {
  const headers = new Headers(extra)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('referrer-policy', 'same-origin')
  return new Response(JSON.stringify(value), { status, headers })
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, '请从工作台页面发起请求。')
}

function sessionBinding(request: Request) {
  return new TextEncoder().encode(new URL(request.url).origin + '\u0000' + (request.headers.get('oai-authenticated-user-id') || 'local'))
}

async function encryptionKey(secret: string) {
  if (!secret || secret.length < 32) throw new HttpError(503, '会话加密尚未配置，请运行 npm run setup:local 或配置 SESSION_SECRET。')
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function base64url(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
}

export async function sealSession(session: StoredSession, secret: string, request: Request) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: sessionBinding(request) }, await encryptionKey(secret), new TextEncoder().encode(JSON.stringify(session)))
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`
}

export async function openSession(request: Request, secret: string): Promise<StoredSession | null> {
  const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
  if (!token || token.length > 6000) return null
  try {
    const [iv, body, extra] = token.split('.')
    if (!iv || !body || extra) return null
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64url(iv), additionalData: sessionBinding(request) }, await encryptionKey(secret), fromBase64url(body))
    const value = JSON.parse(new TextDecoder().decode(decrypted)) as StoredSession
    if (typeof value.apiKey !== 'string' || !value.apiKey || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null
    validateBaseUrl(value.baseUrl)
    return value
  } catch { return null }
}

async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 提交设置。')
  const bytes = await readLimitedBody(request, JSON_LIMIT)
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object')
    return value as Record<string, unknown>
  } catch { throw new HttpError(400, '设置内容必须是有效的 JSON 对象。') }
}

async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, '请求内容过大。')
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) { await reader.cancel(); throw new HttpError(413, '请求内容过大。') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

function limitedStream(stream: ReadableStream<Uint8Array>) {
  let bytes = 0
  return stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength
      if (bytes > UPLOAD_LIMIT) throw new HttpError(413, '上传总量不能超过 64 MB。')
      controller.enqueue(chunk)
    },
  }))
}

function publicStatus(session: StoredSession | null) {
  return session ? { configured: true, maskedKey: '••••••••' + session.apiKey.slice(-4), baseUrl: session.baseUrl, organization: session.organization, project: session.project, expiresAt: session.expiresAt } : { configured: false }
}

export async function handleStudioRequest(request: Request, secret: string, fetcher: typeof fetch = fetch): Promise<Response> {
  try {
    assertSameOrigin(request)
    const url = new URL(request.url)
    const route = url.pathname.replace('/api/studio/', '')
    if (route === 'health' && request.method === 'GET') {
      return json({
        ok: true,
        service: 'OpenAI Studio',
        sessionEncryption: Boolean(secret && secret.length >= 32),
      })
    }
    const session = await openSession(request, secret)
    if (route === 'session') {
      if (request.method === 'GET') return json(publicStatus(session))
      const secure = url.protocol === 'https:' ? '; Secure' : ''
      if (request.method === 'DELETE') return json({ configured: false }, 200, { 'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/studio; Max-Age=0${secure}` })
      if (request.method !== 'POST') throw new HttpError(405, '不支持此请求方法。')
      const body = await readJson(request)
      const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : session?.apiKey
      if (!apiKey || apiKey.length < 16 || apiKey.length > 512 || /\s/.test(apiKey)) throw new HttpError(400, '请输入有效的 API Key。')
      const cleanId = (value: unknown) => {
        if (typeof value !== 'string') return ''
        if (value.length > 160 || /[^\w.:-]/.test(value)) throw new HttpError(400, '组织或项目 ID 格式不正确。')
        return value
      }
      const remember = body.remember === true
      const duration = remember ? 30 * 86400 : 86400
      const next = { apiKey, baseUrl: validateBaseUrl(body.baseUrl || 'https://api.openai.com/v1'), organization: cleanId(body.organization), project: cleanId(body.project), expiresAt: Date.now() + duration * 1000 }
      const token = await sealSession(next, secret, request)
      return json(publicStatus(next), 200, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/studio${remember ? `; Max-Age=${duration}` : ''}${secure}` })
    }
    if (route === 'socket') {
      if (!session) throw new HttpError(401, '请先保存 API Key。')
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') throw new HttpError(400, '需要 WebSocket 连接。')
      const intent = url.searchParams.get('intent')
      const model = url.searchParams.get('model') || ''
      if (intent !== 'transcription' && !/^[\w.:-]{1,200}$/.test(model)) throw new HttpError(400, '请指定有效的实时模型。')
      const query = intent === 'transcription' ? '?intent=transcription' : '?model=' + encodeURIComponent(model)
      const headers = new Headers({ Authorization: `Bearer ${session.apiKey}`, Upgrade: 'websocket' })
      if (session.organization) headers.set('OpenAI-Organization', session.organization)
      if (session.project) headers.set('OpenAI-Project', session.project)
      return await fetcher(session.baseUrl + '/realtime' + query, { headers, redirect: 'error' })
    }
    if (route !== 'request') throw new HttpError(404, '接口不存在。')
    if (!session) throw new HttpError(401, '请先在连接设置中保存 API Key。')
    if (!['GET', 'POST', 'DELETE', 'PATCH', 'PUT'].includes(request.method)) throw new HttpError(405, '不支持此请求方法。')
    const path = validateApiPath(url.searchParams.get('path') || '')
    if (Number(request.headers.get('content-length')) > UPLOAD_LIMIT) throw new HttpError(413, '上传总量不能超过 64 MB。')
    const headers = new Headers({ Authorization: `Bearer ${session.apiKey}` })
    for (const name of ['content-type', 'accept', 'openai-beta']) { const value = request.headers.get(name); if (value) headers.set(name, value) }
    if (session.organization) headers.set('OpenAI-Organization', session.organization)
    if (session.project) headers.set('OpenAI-Project', session.project)
    const body = request.body && !['GET', 'HEAD'].includes(request.method) ? limitedStream(request.body) : undefined
    const upstreamInit: RequestInit & { duplex?: 'half' } = { method: request.method, headers, body, redirect: 'error', signal: request.signal }
    if (body) upstreamInit.duplex = 'half'
    const upstream = await fetcher(session.baseUrl + path, upstreamInit)
    const responseHeaders = new Headers({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' })
    for (const name of ['content-type', 'content-disposition', 'x-request-id', 'openai-processing-ms', 'retry-after', 'x-ratelimit-remaining-requests', 'x-ratelimit-remaining-tokens']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders })
  } catch (error) {
    if (error instanceof HttpError) return json({ error: { message: error.message } }, error.status)
    if (error instanceof Error && error.name === 'AbortError') return json({ error: { message: '请求已停止。' } }, 499)
    return json({ error: { message: upstreamErrorMessage(error) } }, 502)
  }
}
