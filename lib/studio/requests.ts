import type { ChatMessage, ModelInfo } from './types'

export interface ChatOptions {
  model: ModelInfo
  messages: ChatMessage[]
  instructions: string
  endpoint: string
  reasoning: string
  maxTokens: string
  temperature: string
  webSearch: boolean
  codeInterpreter: boolean
  vectorStores: string
  imageGeneration: boolean
  jsonSchema: string
  advanced: string
  stream: boolean
}

export function parseObject(text: string, name = '高级参数'): Record<string, unknown> {
  if (!text.trim()) return {}
  let result: unknown
  try { result = JSON.parse(text) } catch { throw new Error(`${name}不是有效的 JSON，请检查引号和逗号。`) }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${name}必须是 JSON 对象。`)
  return result as Record<string, unknown>
}

export function buildChatRequest(o: ChatOptions) {
  const advanced = parseObject(o.advanced)
  const tools: Record<string, unknown>[] = []
  if (o.webSearch) tools.push({ type: 'web_search' })
  if (o.codeInterpreter) tools.push({ type: 'code_interpreter', container: { type: 'auto' } })
  if (o.imageGeneration) tools.push({ type: 'image_generation' })
  if (o.vectorStores.trim()) tools.push({ type: 'file_search', vector_store_ids: o.vectorStores.split(',').map(s => s.trim()).filter(Boolean) })
  const messages = o.messages.filter(m => m.role === 'user' || (m.status === 'complete' && m.text))
  const payload: Record<string, unknown> = { model: o.model.id, stream: o.stream }
  if (o.endpoint === '/responses') {
    payload.store = false
    payload.input = messages.map(m => ({ role: m.role, content: m.role === 'assistant' ? m.text : [
      ...(m.text ? [{ type: 'input_text', text: m.text }] : []),
      ...(m.attachments || []).map(a => a.mime.startsWith('image/') ? { type: 'input_image', image_url: a.data } : { type: 'input_file', filename: a.name, file_data: a.data }),
    ] }))
    if (o.instructions.trim()) payload.instructions = o.instructions
    if (o.reasoning) payload.reasoning = { effort: o.reasoning }
    if (o.maxTokens) payload.max_output_tokens = positiveInt(o.maxTokens, '最大输出 Token')
    if (tools.length) payload.tools = tools
    if (o.jsonSchema.trim()) payload.text = { format: { type: 'json_schema', name: 'structured_output', strict: true, schema: parseObject(o.jsonSchema, 'JSON Schema') } }
  } else if (o.endpoint === '/completions') {
    if (messages.some(m => m.attachments?.length)) throw new Error('旧版 Completions 不支持附件，请切换到 Responses。')
    if (tools.length || o.jsonSchema.trim()) throw new Error('旧版 Completions 不支持工具或 JSON Schema。')
    payload.prompt = [o.instructions, ...messages.map(m => `${m.role}: ${m.text}`), 'assistant:'].filter(Boolean).join('\n')
    if (o.maxTokens) payload.max_tokens = positiveInt(o.maxTokens, '最大输出 Token')
  } else {
    if (tools.length) throw new Error('这些内置工具需要 Responses API，请切换接口。')
    payload.messages = [
      ...(o.instructions.trim() ? [{ role: 'system', content: o.instructions }] : []),
      ...messages.map(m => ({ role: m.role, content: m.attachments?.length ? [
        { type: 'text', text: m.text },
        ...m.attachments.map(a => {
          if (!a.mime.startsWith('image/')) throw new Error('Chat Completions 的此入口仅支持图片附件；PDF 请使用 Responses。')
          return { type: 'image_url', image_url: { url: a.data } }
        }),
      ] : m.text })),
    ]
    if (o.reasoning) payload.reasoning_effort = o.reasoning
    if (o.maxTokens) payload.max_completion_tokens = positiveInt(o.maxTokens, '最大输出 Token')
    if (o.jsonSchema.trim()) payload.response_format = { type: 'json_schema', json_schema: { name: 'structured_output', strict: true, schema: parseObject(o.jsonSchema, 'JSON Schema') } }
  }
  if (o.temperature !== '') {
    const temperature = Number(o.temperature)
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('温度必须在 0 到 2 之间。')
    payload.temperature = temperature
  }
  Object.assign(payload, advanced)
  return { path: o.endpoint, body: payload }
}

export function positiveInt(value: string, label: string) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label}必须是正整数。`)
  return n
}

export function extractOutput(json: unknown): string {
  if (!json || typeof json !== 'object') return String(json ?? '')
  const value = json as Record<string, unknown>
  if (typeof value.output_text === 'string') return value.output_text
  if (typeof value.text === 'string') return value.text
  if (Array.isArray(value.choices)) return value.choices.map(c => c.message?.content || c.text || c.message?.refusal || c.message?.audio?.transcript || (c.message?.tool_calls ? JSON.stringify(c.message.tool_calls, null, 2) : '')).join('\n')
  if (Array.isArray(value.output)) return value.output.flatMap(item => {
    if (item.type === 'message') return (item.content || []).map((c: Record<string, unknown>) => c.text || c.refusal || '')
    if (item.type === 'function_call') return [`函数调用：${item.name}\n${item.arguments}`]
    if (item.type === 'image_generation_call') return ['[已生成图像，请在原始响应中查看 image_generation_call.result]']
    if (item.type?.endsWith('_call')) return [`[${item.type}: ${item.status || '完成'}]`]
    return []
  }).filter(Boolean).join('\n\n')
  return JSON.stringify(json, null, 2)
}

export async function readSSE(response: Response, onEvent: (event: Record<string, unknown>) => void) {
  if (!response.body) throw new Error('服务器没有返回数据流。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  function dispatch(frame: string) {
    const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') return
    let event: Record<string, unknown>
    try { event = JSON.parse(data) } catch { throw new Error('收到无效的 SSE 数据，请在调用记录中检查请求。') }
    if (event.type === 'error' || event.error || event.type === 'response.failed') {
      const e = event.error || (event.response as Record<string, unknown> | undefined)?.error
      throw new Error(typeof e === 'object' && e ? String((e as Record<string, unknown>).message || JSON.stringify(e)) : String(e || event.message || '模型生成失败'))
    }
    onEvent(event)
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) { dispatch(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2) }
      if (done) { if (buffer.trim()) dispatch(buffer); break }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, aa = 0, bb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2 }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0
}
