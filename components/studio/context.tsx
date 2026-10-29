'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast, Toaster } from 'sonner'
import { DEFAULT_MODELS, mergeAccountModels, type SectionId } from '@/lib/studio/catalog'
import { ensureSuccess, loadLocal, parseResult, recordRequest, saveLocal, studioFetch } from '@/lib/studio/client'
import type { AccountModel, ModelInfo, ResultData, SessionStatus } from '@/lib/studio/types'

interface StudioContextValue {
  section: SectionId
  navigate: (section: SectionId) => void
  session: SessionStatus
  refreshSession: () => Promise<SessionStatus>
  models: ModelInfo[]
  accountModels: AccountModel[]
  synced: boolean
  syncing: boolean
  syncModels: () => Promise<void>
  selections: Record<string, string>
  chooseModel: (section: string, id: string) => void
  requireKey: () => boolean
}

const Context = createContext<StudioContextValue | null>(null)
const IDS = ['overview', 'chat', 'images', 'speech', 'transcribe', 'audio', 'realtime', 'embeddings', 'moderation', 'videos', 'files', 'batch', 'models', 'api', 'history', 'settings']

export function StudioProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<SectionId>('overview')
  const [session, setSession] = useState<SessionStatus>({ configured: false })
  const [accountModels, setAccountModels] = useState<AccountModel[]>([])
  const [synced, setSynced] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selections, setSelections] = useState(DEFAULT_MODELS)
  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/studio/session', { cache: 'no-store' })
    await ensureSuccess(response)
    const status: SessionStatus = await response.json()
    setSession(status)
    if (!status.configured) { setAccountModels([]); setSynced(false) }
    return status
  }, [])
  const syncModels = useCallback(async () => {
    setSyncing(true)
    try {
      const response = await studioFetch('/models')
      await ensureSuccess(response)
      const data = await response.json() as { data: AccountModel[] }
      if (!Array.isArray(data.data)) throw new Error('模型接口没有返回有效的模型列表。')
      setAccountModels(data.data.filter((m: AccountModel) => typeof m.id === 'string'))
      setSynced(true)
      toast.success(`已同步 ${data.data.length} 个账号模型`)
    } catch (error) { toast.error(error instanceof Error ? error.message : '模型同步失败'); throw error }
    finally { setSyncing(false) }
  }, [])
  useEffect(() => {
    function onHash() { const value = location.hash.slice(1); if (IDS.includes(value)) setSection(value as SectionId) }
    onHash()
    setSelections({ ...DEFAULT_MODELS, ...loadLocal<Record<string, string>>('studio.selections', {}) })
    refreshSession().then(status => { if (status.configured) void syncModels().catch(() => {}) }).catch(error => toast.error(error.message))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [refreshSession, syncModels])
  const navigate = useCallback((id: SectionId) => { setSection(id); history.replaceState(null, '', '#' + id); window.scrollTo({ top: 0 }) }, [])
  const chooseModel = useCallback((id: string, model: string) => {
    setSelections(previous => { const next = { ...previous, [id]: model }; saveLocal('studio.selections', next); return next })
  }, [])
  const requireKey = useCallback(() => {
    if (session.configured) return true
    toast.info('先连接 API Key，即可开始使用。')
    navigate('settings')
    return false
  }, [navigate, session.configured])
  const models = useMemo(() => mergeAccountModels(accountModels, synced), [accountModels, synced])
  return <Context.Provider value={{ section, navigate, session, refreshSession, models, accountModels, synced, syncing, syncModels, selections, chooseModel, requireKey }}>{children}<Toaster position="bottom-right" richColors closeButton /></Context.Provider>
}

export function useStudio() { const context = useContext(Context); if (!context) throw new Error('Missing studio provider'); return context }

export function useOperation(section: string) {
  const { requireKey } = useStudio()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const resultUrl = useRef<string | undefined>(undefined)
  useEffect(() => () => { controller.current?.abort(); if (resultUrl.current) URL.revokeObjectURL(resultUrl.current) }, [])
  async function run(path: string, body?: Record<string, unknown> | FormData | string, method = 'POST', model?: string, extraHeaders?: HeadersInit) {
    if (!requireKey() || busy) return null
    setBusy(true); setError('')
    controller.current = new AbortController()
    const start = performance.now()
    let status = 0, requestId: string | undefined
    try {
      const headers = new Headers(extraHeaders)
      if (body && !(body instanceof FormData) && typeof body !== 'string') headers.set('content-type', 'application/json')
      if (typeof body === 'string' && !headers.has('content-type')) headers.set('content-type', 'text/plain')
      const response = await studioFetch(path, { method, headers, body: body ? body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body) : undefined, signal: controller.current.signal })
      status = response.status; requestId = response.headers.get('x-request-id') || undefined
      const parsed = await parseResult(response)
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
      resultUrl.current = parsed.url
      setResult(parsed)
      recordRequest({ section, path, model, status, requestId, duration: performance.now() - start, usage: parsed.json && typeof parsed.json === 'object' && 'usage' in parsed.json ? (parsed.json as { usage: Record<string, unknown> }).usage : undefined })
      return parsed
    } catch (e) {
      const message = e instanceof Error && e.name === 'AbortError' ? '请求已停止。' : e instanceof Error ? e.message : '请求失败'
      setError(message)
      recordRequest({ section, path, model, status: status || (controller.current.signal.aborted ? 499 : 0), requestId, duration: performance.now() - start, error: message })
      return null
    } finally { setBusy(false) }
  }
  return { busy, result, error, setError, setResult, run, stop: () => controller.current?.abort() }
}
