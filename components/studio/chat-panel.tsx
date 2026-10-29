'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowUpRight, Braces, Check, Code2, Copy, Download, FileText, Image, Lightbulb, LoaderCircle, Paperclip, Plus, Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { isRetired, modelForId } from '@/lib/studio/catalog'
import { downloadText, ensureSuccess, fileData, recordRequest, studioFetch } from '@/lib/studio/client'
import { readConversations, writeConversations } from '@/lib/studio/conversations'
import { buildChatRequest, extractOutput, readSSE } from '@/lib/studio/requests'
import type { Attachment, ChatMessage, Conversation } from '@/lib/studio/types'
import { useStudio } from './context'
import { AdvancedJson, DocsLink, Field, ModelPicker, Notice } from './shared'

const EXAMPLES = [
  { icon: Lightbulb, label: '拓展一个想法', description: '从灵感到可执行的方案', prompt: '我想做一个帮助人们养成阅读习惯的产品。请和我一起推敲它的核心价值、用户场景和最小可行版本。' },
  { icon: Code2, label: '一起解决难题', description: '调试代码，理解复杂问题', prompt: '请扮演一位耐心的编程导师，先询问我的技术背景，再一步步讲解如何设计一个可靠的 API 调用系统。' },
  { icon: FileText, label: '让表达更清晰', description: '写作、整理与信息提炼', prompt: '帮我把一个复杂的想法整理成清晰的文案。请先问我目标读者、使用场景和希望传达的核心信息。' },
  { icon: Image, label: '读懂一张图片', description: '上传图像，发现更多细节', prompt: '我将上传一张图片。请从内容、构图、颜色和潜在用途几个角度分析它。' },
]

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g)
  return <div className="markdown">{blocks.map((block, i) => {
    if (block.startsWith('```')) {
      const first = block.indexOf('\n')
      const code = block.slice(first+1).replace(/```$/, '').trimEnd()
      return <div className="code-block" key={i}><div><span>{block.slice(3, first) || 'code'}</span><button onClick={() => navigator.clipboard.writeText(code).then(() => toast.success('已复制代码')).catch(() => toast.error('复制失败'))}><Copy size={13} />复制</button></div><pre><code>{code}</code></pre></div>
    }
    return block.split('\n').map((line, j) => {
      const inline = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((s, k) => {
        if (s.startsWith('**') && s.endsWith('**')) return <strong key={k}>{s.slice(2,-2)}</strong>
        if (s.startsWith('`') && s.endsWith('`')) return <code key={k}>{s.slice(1,-1)}</code>
        const link = s.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
        return link ? <a key={k} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a> : s
      })
      return /^#{1,4} /.test(line) ? <h3 key={i+'-'+j}>{line.replace(/^#{1,4} /, '')}</h3> : <div className={line ? 'md-line' : 'md-space'} key={i+'-'+j}>{inline}</div>
    })
  })}</div>
}

function newConversation(): Conversation { return { id: crypto.randomUUID(), title: '新的对话', updatedAt: Date.now(), messages: [] } }

export function ChatPanel() {
  const { selections, models, requireKey } = useStudio()
  const model = modelForId(selections.chat, models)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState('')
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')
  const [endpoint, setEndpoint] = useState('/responses')
  const [reasoning, setReasoning] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
  const [temperature, setTemperature] = useState('')
  const [stream, setStream] = useState(true)
  const [webSearch, setWebSearch] = useState(false)
  const [codeInterpreter, setCodeInterpreter] = useState(false)
  const [imageGeneration, setImageGeneration] = useState(false)
  const [vectorStores, setVectorStores] = useState('')
  const [jsonSchema, setJsonSchema] = useState('')
  const [advanced, setAdvanced] = useState('')
  const [rawResponse, setRawResponse] = useState<unknown>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const current = conversations.find(c => c.id === activeId)
  const messages = current?.messages || []
  useEffect(() => {
    let mounted = true
    readConversations().then(value => { if (!mounted) return; const list = value.length ? value.map(c => ({...c,messages:c.messages.map(m => m.status === 'streaming' ? {...m,status:'interrupted' as const} : m)})) : [newConversation()]; setConversations(list); setActiveId(list[0].id) }).catch(() => { if (mounted) { const c = newConversation(); setConversations([c]); setActiveId(c.id); toast.info('浏览器存储暂不可用，本次对话会保留到页面关闭。') } }).finally(() => { if (mounted) setReady(true) })
    return () => { mounted = false; abort.current?.abort() }
  }, [])
  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => { writeConversations(conversations).catch(() => toast.warning('对话保存失败，可能是浏览器存储空间不足。请导出重要内容。')) }, 700)
    return () => clearTimeout(id)
  }, [conversations, ready])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages.length, busy])
  useEffect(() => {
    if (!model) return
    if (model.endpoints.includes('responses')) setEndpoint('/responses')
    else if (model.endpoints.includes('chat_completions')) setEndpoint('/chat/completions')
    else setEndpoint('/completions')
    setReasoning(''); setTemperature(''); setWebSearch(false); setCodeInterpreter(false); setImageGeneration(false); setVectorStores(''); setError('')
  }, [selections.chat])

  function updateMessages(id: string, transform: (messages: ChatMessage[]) => ChatMessage[]) {
    setConversations(previous => previous.map(c => c.id === id ? { ...c, messages: transform(c.messages), updatedAt: Date.now() } : c))
  }
  async function attach(files: FileList | null) {
    if (!files) return
    try {
      const list = Array.from(files)
      if (attachments.length + list.length > 5) throw new Error('一次最多添加 5 个附件。')
      if (list.some(f => f.size > 10*1024*1024)) throw new Error('单个附件不能超过 10 MB。')
      if (list.reduce((n,f) => n+f.size,0) + attachments.reduce((n,f) => n+f.size,0) > 20*1024*1024) throw new Error('附件总量不能超过 20 MB。')
      const added = await Promise.all(list.map(async file => {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') throw new Error('此入口支持 PNG、JPEG、WebP、GIF 或 PDF。其他文件可在「文件与知识库」上传后使用 file_id。')
        return { id: crypto.randomUUID(), name: file.name, mime: file.type, data: await fileData(file), size: file.size }
      }))
      setAttachments(previous => [...previous, ...added])
    } catch (e) { toast.error((e as Error).message) }
  }
  async function send() {
    if (busy || (!input.trim() && !attachments.length) || !ready) return
    if (!requireKey()) return
    if (!model) { setError('未找到模型能力信息，请在模型目录选择模型。'); return }
    if (isRetired(model)) { setError('此模型已经停用，请选择其他模型。'); return }
    if (attachments.some(a => a.mime.startsWith('image/')) && !model.input.includes('image')) { setError('此模型不支持图片输入，请选择支持视觉理解的模型。'); return }
    const conversationId = activeId
    const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: input.trim(), attachments }
    const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: '', model: model.id, status: 'streaming' }
    let request
    try { request = buildChatRequest({ model, messages: [...messages, user], instructions, endpoint, reasoning, maxTokens, temperature, webSearch, codeInterpreter, vectorStores, imageGeneration, jsonSchema, advanced, stream: stream && model.features.includes('streaming') }) }
    catch (e) { setError((e as Error).message); return }
    setConversations(previous => previous.map(c => c.id === conversationId ? { ...c, title: c.messages.length ? c.title : (user.text || user.attachments?.[0]?.name || '新的对话').slice(0,32), messages: [...c.messages, user, assistant], updatedAt: Date.now() } : c))
    setInput(''); setAttachments([]); setError(''); setBusy(true); setRawResponse(null)
    const controller = new AbortController(); abort.current = controller
    const start = performance.now()
    let status = 0, requestId: string | undefined, responseId = '', output = '', usage: Record<string, unknown> | undefined, completed = false
    const chatCalls = new Map<number,{id:string;type:string;function:{name:string;arguments:string}}>()
    function update(patch: Partial<ChatMessage>) { updateMessages(conversationId, previous => previous.map(m => m.id === assistant.id ? { ...m, ...patch } : m)) }
    try {
      const response = await studioFetch(request.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request.body), signal: controller.signal })
      status = response.status; requestId = response.headers.get('x-request-id') || undefined
      await ensureSuccess(response)
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        await readSSE(response, event => {
          const v = event as Record<string, any>
          if (v.type === 'response.created') responseId = v.response?.id || ''
          if (v.type === 'response.output_text.delta' || v.type === 'response.refusal.delta') output += v.delta || ''
          if (v.choices?.[0]?.delta?.content) output += v.choices[0].delta.content
          if (v.choices?.[0]?.delta?.refusal) output += v.choices[0].delta.refusal
          for (const call of v.choices?.[0]?.delta?.tool_calls || []) {
            const current = chatCalls.get(call.index) || {id:'',type:'function',function:{name:'',arguments:''}}
            if (call.id) current.id = call.id
            if (call.function?.name) current.function.name += call.function.name
            if (call.function?.arguments) current.function.arguments += call.function.arguments
            chatCalls.set(call.index,current)
          }
          if (v.choices?.[0]?.text) output += v.choices[0].text
          if (v.choices?.[0]?.finish_reason) completed = ['stop','tool_calls','function_call'].includes(v.choices[0].finish_reason)
          if (v.usage) usage = v.usage
          if (v.type === 'response.completed' || v.type === 'response.incomplete') {
            responseId = v.response?.id || responseId; usage = v.response?.usage
            output = extractOutput(v.response) || output
            completed = v.type === 'response.completed'
            setRawResponse(v.response)
            if (v.type === 'response.incomplete') setError('模型输出未完成：' + JSON.stringify(v.response?.incomplete_details || {}))
          }
          update({ text: output, responseId, usage })
        })
        if (chatCalls.size) {
          const calls = [...chatCalls.values()]
          setRawResponse({choices:[{message:{role:'assistant',content:output,tool_calls:calls}}],usage})
          output += '\n\n工具调用（执行后请在 API 实验室提交结果）：\n' + JSON.stringify(calls,null,2)
          update({text:output})
        }
        if (!completed) { update({ text: output, status: 'interrupted' }); throw new Error(output ? '连接结束，但未收到完整完成状态。已保留收到的内容。' : '没有收到可显示的文本。请检查原始工具响应或改用非流式请求。') }
      } else {
        const value = await response.json() as { id?: string; usage?: Record<string, unknown>; status?: string; error?: {message?:string} }; setRawResponse(value)
        output = extractOutput(value); usage = value.usage; responseId = value.id || ''
        if (value.error) throw new Error(value.error.message || JSON.stringify(value.error))
        if (value.status === 'queued' || value.status === 'in_progress') throw new Error('此请求仍在后台运行。请在 API 实验室使用 GET /responses/' + responseId + ' 查询结果。')
      }
      update({ text: output, responseId, usage, status: 'complete' })
      recordRequest({ section: 'chat', path: request.path, model: model.id, status, duration: performance.now()-start, requestId, usage })
    } catch (e) {
      const message = controller.signal.aborted ? '已停止生成。' : (e as Error).message
      setError(message); update({ text: output, status: controller.signal.aborted ? 'interrupted' : 'error', responseId, usage })
      recordRequest({ section: 'chat', path: request.path, model: model.id, status: controller.signal.aborted ? 499 : status, duration: performance.now()-start, requestId, usage, error: message })
    } finally { setBusy(false); abort.current = null; inputRef.current?.focus() }
  }
  function create() { if (busy) return; const c = newConversation(); setConversations(previous => [c, ...previous].slice(0,30)); setActiveId(c.id); setError(''); setRawResponse(null); setAttachments([]); setInput('') }
  return <div className="chat-layout"><div className="chat-main panel">
    <div className="chat-toolbar"><div className="conversation-select"><select aria-label="切换对话" disabled={busy} value={activeId} onChange={e => { setActiveId(e.target.value); setRawResponse(null); setError(''); setAttachments([]) }}>{conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><span>{messages.filter(m => m.role === 'user').length} 轮对话</span></div><div className="actions"><button className="icon-button" disabled={busy} title="新建对话" onClick={create}><Plus size={17} /></button><button className="icon-button" disabled={!messages.length} title="导出对话" onClick={() => downloadText(JSON.stringify(current,null,2),'openai-conversation.json')}><Download size={16} /></button><button className="icon-button" disabled={busy} title="删除当前对话" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /></button></div></div>
    {confirmDelete && <div className="inline-confirm"><span>删除此浏览器中的当前对话？</span><button className="button danger small" onClick={() => { const remaining = conversations.filter(c => c.id !== activeId); const list = remaining.length ? remaining : [newConversation()]; setConversations(list); setActiveId(list[0].id); setConfirmDelete(false) }}>确认删除</button><button className="button secondary small" onClick={() => setConfirmDelete(false)}>取消</button></div>}
    <div className="chat-scroll">{messages.length === 0 ? <div className="chat-welcome"><div className="welcome-mark"><Sparkles size={28} strokeWidth={1.5} /></div><span className="eyebrow">A SPACE FOR YOUR IDEAS</span><h2>有什么想法，<br />我们一起完成。</h2><p>选择一个模型，开始一段新的探索。</p><div className="chat-examples">{EXAMPLES.map(e => <button key={e.label} onClick={() => { setInput(e.prompt); inputRef.current?.focus() }}><e.icon size={18} /><strong>{e.label}</strong><span>{e.description}</span><ArrowUpRight size={14} /></button>)}</div></div> : <div className="message-list">{messages.map(m => <article key={m.id} className={'message ' + m.role}><div className="message-avatar">{m.role === 'user' ? '你' : <Sparkles size={16} />}</div><div className="message-content"><div className="message-label"><strong>{m.role === 'user' ? '你' : m.model || 'Assistant'}</strong>{m.status === 'interrupted' && <span className="badge">已停止</span>}{m.status === 'error' && <span className="badge warning">未完成</span>}</div>{m.attachments?.length ? <div className="message-attachments">{m.attachments.map(a => <div key={a.id}>{a.mime.startsWith('image/') ? <img src={a.data} alt={a.name} /> : <FileText size={18} />}<span>{a.name}</span></div>)}</div> : null}{m.text ? <Markdown text={m.text} /> : m.status === 'streaming' ? <div className="thinking"><i /><i /><i /><span>正在思考…</span></div> : <span className="muted">没有生成文本。</span>}{m.role === 'assistant' && m.status !== 'streaming' && <div className="message-actions"><button className="icon-button" title="复制回复" onClick={() => navigator.clipboard.writeText(m.text).then(() => toast.success('已复制')).catch(() => toast.error('复制失败'))}><Copy size={13} /></button>{m.usage && <span>{JSON.stringify(m.usage).match(/"(?:total_tokens)":(\d+)/)?.[1] || ''} tokens</span>}</div>}</div></article>)}<div ref={bottom} /></div>}</div>
    <div className="composer-area">{error && <Notice kind="error">{error}</Notice>}{rawResponse !== null && <details className="chat-raw"><summary><Braces size={13} />查看本次完整响应与工具输出</summary><pre>{JSON.stringify(rawResponse,null,2).slice(0,60000)}</pre><button className="button secondary small" onClick={() => downloadText(JSON.stringify(rawResponse,null,2),'openai-response.json')}>下载完整响应</button></details>}{attachments.length > 0 && <div className="composer-files">{attachments.map(a => <span key={a.id}>{a.name}<button className="icon-button" aria-label={'移除 ' + a.name} onClick={() => setAttachments(previous => previous.filter(f => f.id !== a.id))}><X size={12} /></button></span>)}</div>}<div className="composer"><textarea aria-label="发送消息" ref={inputRef} rows={3} value={input} onChange={e => setInput(e.target.value)} placeholder="把你的想法写在这里…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} /><div className="composer-bottom"><label className="attach-button" title="添加图片或 PDF"><Paperclip size={17} /><span>附件</span><input aria-label="添加图片或 PDF" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple disabled={busy} onChange={e => { void attach(e.target.files); e.target.value = '' }} /></label><span className="composer-model">{selections.chat}</span>{busy ? <button className="send-button stop" title="停止生成" onClick={() => abort.current?.abort()}><Square size={15} fill="currentColor" /></button> : <button className="send-button" title="发送消息" disabled={!ready || (!input.trim() && !attachments.length)} onClick={() => void send()}><ArrowUp size={20} /></button>}</div></div><p className="composer-hint">Enter 发送 · Shift + Enter 换行 <span>内容由 AI 生成，请核实重要信息。</span></p></div>
  </div><aside className="chat-controls panel"><div className="controls-title"><SlidersIcon /><h3>模型与参数</h3></div><ModelPicker section="chat" /><Field label="调用接口"><select value={endpoint} onChange={e => setEndpoint(e.target.value)}>{model?.endpoints.includes('responses') && <option value="/responses">Responses</option>}{model?.endpoints.includes('chat_completions') && <option value="/chat/completions">Chat Completions</option>}{model?.endpoints.includes('completions') && <option value="/completions">Completions（旧版）</option>}</select></Field><Field label="系统指令"><textarea rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="设定角色、表达方式或任务背景。" /></Field>{model?.reasoningEfforts.length ? <Field label="推理强度"><select value={reasoning} onChange={e => setReasoning(e.target.value)}><option value="">模型默认</option>{model.reasoningEfforts.map(v => <option key={v}>{v}</option>)}</select></Field> : null}<div className="field-grid"><Field label="最大输出 Token"><input type="number" min={1} value={maxTokens} onChange={e => setMaxTokens(e.target.value)} placeholder="默认" /></Field><Field label="温度" hint="部分推理模型不支持。"><input type="number" min={0} max={2} step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="默认" /></Field></div><label className="check"><input type="checkbox" checked={stream} onChange={e => setStream(e.target.checked)} />流式输出</label>{endpoint === '/responses' && <div className="tool-toggles"><h4>内置工具</h4>{model?.tools.includes('web_search') && <label className="check"><input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} />联网搜索</label>}{model?.tools.includes('code_interpreter') && <label className="check"><input type="checkbox" checked={codeInterpreter} onChange={e => setCodeInterpreter(e.target.checked)} />代码解释器</label>}{model?.tools.includes('image_generation') && <label className="check"><input type="checkbox" checked={imageGeneration} onChange={e => setImageGeneration(e.target.checked)} />图像生成</label>}{model?.tools.includes('file_search') && <Field label="知识库 ID（逗号分隔）"><input value={vectorStores} onChange={e => setVectorStores(e.target.value)} placeholder="vs_…" /></Field>}<p className="field-hint">工具可能产生独立费用。函数、MCP 等可通过高级参数配置；自定义工具结果由你提交。</p></div>}<details className="advanced"><summary><Braces size={14} />结构化输出</summary><Field label="JSON Schema"><textarea className="code-input" rows={5} value={jsonSchema} onChange={e => setJsonSchema(e.target.value)} placeholder={'{"type":"object","properties":{"answer":{"type":"string"}},"required":["answer"],"additionalProperties":false}'} /></Field></details><AdvancedJson value={advanced} onChange={setAdvanced} /><div className="model-footnote"><Check size={13} /><span>对话保存在此浏览器的 IndexedDB 中。API Key 由加密会话管理。</span></div><DocsLink path="guides/text" /></aside></div>
}

function SlidersIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="3" fill="var(--panel)" /><circle cx="16" cy="17" r="3" fill="var(--panel)" /></svg> }
