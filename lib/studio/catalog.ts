import catalog from '../generated/models.json'
import type { AccountModel, ModelInfo } from './types'

export const VERIFIED_AT = catalog.verifiedAt
export const DOCUMENTED_MODELS: ModelInfo[] = catalog.models
export const FEATURED = ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra', 'gpt-6-luna']

export const SECTIONS = [
  { id: 'overview', label: '工作台概览', subtitle: '从一个想法，到所有可能', icon: 'LayoutGrid' },
  { id: 'chat', label: '对话与推理', subtitle: '思考、创作、代码与视觉理解', icon: 'MessageSquare', endpoint: 'responses' },
  { id: 'images', label: '图像创作', subtitle: '让文字变成画面', icon: 'Image', endpoint: 'image_generation' },
  { id: 'speech', label: '语音合成', subtitle: '赋予文字自然的声音', icon: 'AudioLines', endpoint: 'speech_generation' },
  { id: 'transcribe', label: '语音转写', subtitle: '让每一句话清晰可见', icon: 'FileAudio', endpoint: 'transcription' },
  { id: 'audio', label: '音频对话', subtitle: '文字与声音，自由对话', icon: 'Headphones', endpoint: 'audio_chat' },
  { id: 'realtime', label: '实时语音', subtitle: '自然、流畅的实时交流', icon: 'Radio', endpoint: 'realtime' },
  { id: 'embeddings', label: '向量与语义', subtitle: '探索文本之间的联系', icon: 'Waypoints', endpoint: 'embeddings' },
  { id: 'moderation', label: '内容审核', subtitle: '识别文本与图像的内容风险', icon: 'ShieldCheck', endpoint: 'moderation' },
  { id: 'videos', label: '视频生成', subtitle: 'Sora 历史接口与任务查询', icon: 'Film', endpoint: 'video' },
  { id: 'files', label: '文件与知识库', subtitle: '管理文件、向量库和检索', icon: 'FolderOpen' },
  { id: 'batch', label: '批处理与训练', subtitle: '批量任务、微调与评估', icon: 'Layers' },
  { id: 'models', label: '模型目录', subtitle: '官方能力与账号可用性，一目了然', icon: 'Boxes' },
  { id: 'api', label: 'API 实验室', subtitle: '完整参数，自由探索', icon: 'SquareTerminal' },
  { id: 'history', label: '调用记录', subtitle: '查看耗时、用量与请求状态', icon: 'History' },
  { id: 'settings', label: '连接设置', subtitle: '一个 API Key，连接整个工作台', icon: 'Settings2' },
] as const

export type SectionId = typeof SECTIONS[number]['id']

export function isRetired(model: ModelInfo, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(model.shutdownDate && model.shutdownDate <= today)
}

export function modelForId(id: string, models = DOCUMENTED_MODELS): ModelInfo | undefined {
  const exact = models.find(m => m.id === id || m.snapshots.includes(id))
  if (exact) return { ...exact, id }
  if (id.startsWith('ft:')) {
    const base = modelForId(id.split(':')[1], models)
    if (base) return { ...base, id, name: id, undocumented: true }
  }
  const base = models.filter(m => id.startsWith(m.id + '-')).sort((a, b) => b.id.length - a.id.length)[0]
  return base ? { ...base, id, name: id, undocumented: true } : undefined
}

export function supportsSection(m: ModelInfo, section: string) {
  if (section === 'chat') return (m.endpoints.includes('responses') || m.endpoints.includes('chat_completions') || m.endpoints.includes('completions')) && m.output.includes('text') && !m.input.includes('audio')
  if (section === 'audio') return m.endpoints.includes('chat_completions') && m.input.includes('audio')
  if (section === 'realtime') return m.endpoints.some(e => ['realtime', 'live', 'realtime_transcription', 'realtime_translation'].includes(e))
  const endpoint = SECTIONS.find(s => s.id === section)
  return Boolean(endpoint && 'endpoint' in endpoint && m.endpoints.includes(endpoint.endpoint))
}

export function sectionForModel(m: ModelInfo): SectionId {
  for (const id of ['images', 'realtime', 'speech', 'transcribe', 'audio', 'embeddings', 'moderation', 'chat']) {
    if (supportsSection(m, id)) return id as SectionId
  }
  return 'api'
}

export function mergeAccountModels(accountModels: AccountModel[], synced: boolean): ModelInfo[] {
  const account = new Map(accountModels.map(m => [m.id, m]))
  const result = DOCUMENTED_MODELS.map(m => {
    const actual = account.get(m.id) || account.get(m.snapshot) || m.snapshots.map(id => account.get(id)).find(Boolean)
    return { ...m, ...(actual?.shutdown_date ? { shutdownDate: actual.shutdown_date } : {}), accountAvailable: synced ? Boolean(actual) : undefined }
  })
  for (const actual of accountModels) {
    if (result.some(m => m.id === actual.id)) continue
    const base = modelForId(actual.id)
    result.push(base
      ? { ...base, id: actual.id, name: actual.id, accountAvailable: true, ...(actual.shutdown_date ? { shutdownDate: actual.shutdown_date } : {}) }
      : { id: actual.id, name: actual.id, description: '账号返回的模型。官方目录尚无能力信息，请在 API 实验室选择接口并填写参数。', url: 'https://developers.openai.com/api/docs/models', modelType: 'unknown', snapshot: actual.id, snapshots: [], input: [], output: [], endpoints: [], features: [], tools: [], context: '', maxOutput: '', reasoningEfforts: [], deprecated: false, sourceVerified: false, undocumented: true, accountAvailable: true, ...(actual.shutdown_date ? { shutdownDate: actual.shutdown_date } : {}) })
  }
  return result
}

export function sortModels(models: ModelInfo[]) {
  return [...models].sort((a, b) => {
    const score = (m: ModelInfo) => (isRetired(m) ? 1000 : 0) + (m.accountAvailable === false ? 100 : 0) + (FEATURED.includes(m.id) ? FEATURED.indexOf(m.id) - 10 : 0) + (m.deprecated ? 20 : 0)
    return score(a) - score(b) || a.name.localeCompare(b.name)
  })
}

export const DEFAULT_MODELS: Record<string, string> = { chat: 'gpt-6.1-sol', images: 'gpt-image-2.5-flare', speech: 'gpt-4o-mini-tts', transcribe: 'gpt-transcribe', audio: 'gpt-audio-1.5', realtime: 'gpt-realtime-2.1-mini', embeddings: 'text-embedding-3-small', moderation: 'omni-moderation-latest' }
