import { readSSE } from './requests'
import type { RequestLog, ResultData } from './types'

export async function studioFetch(path: string, options: RequestInit = {}) {
  return fetch(`/api/studio/request?path=${encodeURIComponent(path)}`, { ...options, credentials: 'same-origin' })
}

export function errorMessage(value: unknown, status?: number) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const error = data.error
  let message = typeof error === 'string' ? error : error && typeof error === 'object' ? String((error as Record<string, unknown>).message || JSON.stringify(error)) : typeof value === 'string' ? value : '请求失败'
  const advice: Record<number, string> = { 401: '请检查 API Key 是否有效，或重新保存连接设置。', 403: '此密钥可能没有对应模型或项目权限。', 404: '模型或接口不存在，也可能已停用。', 429: '请检查账户余额、配额和速率限制，稍后再试。', 413: '文件或请求过大，请缩小后重试。' }
  if (status && advice[status]) message = `${advice[status]}\n${message}`
  return message
}

export async function ensureSuccess(response: Response) {
  if (response.ok) return
  const type = response.headers.get('content-type') || ''
  const value = type.includes('json') ? await response.json().catch(() => ({})) : await response.text()
  throw new Error(errorMessage(value, response.status))
}

export async function parseResult(response: Response): Promise<ResultData> {
  await ensureSuccess(response)
  const mime = response.headers.get('content-type') || 'application/octet-stream'
  const meta = { mime, requestId: response.headers.get('x-request-id') || undefined, status: response.status }
  if (mime.includes('text/event-stream')) {
    const events: Record<string, unknown>[] = []
    await readSSE(response, event => events.push(event))
    return { ...meta, json: events }
  }
  if (mime.includes('json')) return { ...meta, json: await response.json() }
  if (mime.startsWith('text/') || mime.includes('application/sdp')) return { ...meta, text: await response.text() }
  const blob = await response.blob()
  const extension = mime.includes('audio/mpeg') ? 'mp3' : mime.split('/')[1]?.split(';')[0] || 'bin'
  return { ...meta, url: URL.createObjectURL(blob), filename: `openai-output.${extension}` }
}

export function saveLocal<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage quota must not interrupt a request. */ }
}

export function loadLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

export function recordRequest(log: Omit<RequestLog, 'id' | 'time'>) {
  const entry = { ...log, id: crypto.randomUUID(), time: Date.now() }
  const logs = loadLocal<RequestLog[]>('studio.logs', [])
  saveLocal('studio.logs', [entry, ...logs].slice(0, 200))
  window.dispatchEvent(new Event('studio-log'))
}

export async function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

export function downloadText(text: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
