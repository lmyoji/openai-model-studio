'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Braces, Download, Film, FolderOpen, Layers, Play, Plus, SquareTerminal, Upload } from 'lucide-react'
import { toast } from 'sonner'
import paths from '@/lib/generated/endpoints.json'
import { API_TEMPLATES, type ApiTemplate } from '@/lib/studio/templates'
import { downloadText } from '@/lib/studio/client'
import { parseObject } from '@/lib/studio/requests'
import { useOperation, useStudio } from './context'
import { AdvancedJson, DocsLink, EmptyResult, Field, LoadingState, Notice, ResultPanel, RunButton, ToolLayout } from './shared'

export function ApiWorkbench({ group }: { group?: string }) {
  const { selections } = useStudio()
  const templates = group ? API_TEMPLATES.filter(t => t.group === group) : API_TEMPLATES
  const initial = templates[0]
  const op = useOperation(group === '文件与知识库' ? 'files' : group === '批处理与训练' ? 'batch' : 'api')
  const [template, setTemplate] = useState(initial.id)
  const [method, setMethod] = useState(initial.method)
  const [path, setPath] = useState(initial.path)
  const [bodyMode, setBodyMode] = useState(initial.multipart ? 'multipart' : 'json')
  const [body, setBody] = useState(JSON.stringify(initial.body,null,2))
  const [files, setFiles] = useState<{ name: string; file: File }[]>([])
  const [fileField, setFileField] = useState('file')
  const [betaHeader, setBetaHeader] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const current = API_TEMPLATES.find(t => t.id === template)
  useEffect(() => {
    if (!group && selections.api) setBody(previous => { try { const value = JSON.parse(previous); return JSON.stringify({...value,model:selections.api},null,2) } catch { return previous } })
  }, [selections.api,group])
  function choose(id: string) {
    const t = templates.find(t => t.id === id)
    if (!t) return
    setTemplate(id); setMethod(t.method); setPath(t.path); setBody(JSON.stringify(t.body,null,2)); setBodyMode(t.multipart ? 'multipart' : 'json'); setFiles([]); op.setError(''); setDeleteConfirmation(false)
  }
  async function run(confirmed = false) {
    if (method === 'DELETE' && !confirmed) { setDeleteConfirmation(true); return }
    try {
      if (!path.startsWith('/') || path.includes('REPLACE_ME') || path.includes('SESSION_ID') || path.includes('REPLACE_UNIX')) throw new Error('请填写实际接口路径，并替换示例中的 ID 占位符。')
      const payload = bodyMode === 'raw' ? body : parseObject(body, '请求参数')
      const headers = betaHeader.trim() ? { 'OpenAI-Beta': betaHeader.trim() } : undefined
      if (bodyMode === 'multipart' && method !== 'GET') {
        if (files.reduce((n,f) => n+f.file.size,0) > 60*1024*1024) throw new Error('上传总量不能超过 60 MB。大文件请使用官方分片 Uploads 接口。')
        const form = new FormData()
        for (const [k,v] of Object.entries(payload)) {
          if (Array.isArray(v)) for (const item of v) form.append(k.endsWith('[]') ? k : k+'[]', typeof item === 'object' ? JSON.stringify(item) : String(item))
          else form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
        }
        for (const file of files) form.append(file.name,file.file)
        await op.run(path,form,method,undefined,headers)
      } else await op.run(path,method === 'GET' || method === 'DELETE' ? undefined : payload,method,typeof payload === 'object' ? String(payload.model || '') : undefined,headers)
      setDeleteConfirmation(false)
    } catch (e) { op.setError((e as Error).message) }
  }
  const icon = group === '文件与知识库' ? <FolderOpen size={32} /> : group === '批处理与训练' ? <Layers size={32} /> : <SquareTerminal size={32} />
  return <ToolLayout form={<><Field label="快速模板"><select value={template} onChange={e => choose(e.target.value)}>{[...new Set(templates.map(t => t.group))].map(g => <optgroup key={g} label={g}>{templates.filter(t => t.group === g).map(t => <option value={t.id} key={t.id}>{t.label}</option>)}</optgroup>)}</select></Field>{current?.note && <Notice kind="warning">{current.note}</Notice>}<div className="request-path"><select aria-label="HTTP 方法" value={method} onChange={e => { setMethod(e.target.value); setDeleteConfirmation(false) }}>{['GET','POST','DELETE','PATCH','PUT'].map(m => <option key={m}>{m}</option>)}</select><input aria-label="API 路径" list="api-paths" value={path} onChange={e => setPath(e.target.value)} placeholder="/responses" /><datalist id="api-paths">{paths.map(p => <option key={p} value={p} />)}</datalist></div><div className="api-origin">https://api.openai.com/v1 <span>官方目录 {paths.length} 个路径</span></div>{!['GET','DELETE'].includes(method) && <><Field label="请求内容类型"><select value={bodyMode} onChange={e => setBodyMode(e.target.value)}><option value="json">application/json</option><option value="multipart">multipart/form-data · 文件上传</option><option value="raw">text/plain · 原始文本</option></select></Field><Field label={bodyMode === 'multipart' ? '表单字段 JSON' : '请求体'}><textarea className="code-input api-body" rows={15} spellCheck={false} value={body} onChange={e => setBody(e.target.value)} /></Field>{bodyMode === 'multipart' && <><div className="file-add"><input aria-label="上传文件字段名" value={fileField} onChange={e => setFileField(e.target.value)} placeholder="file / image[] / mask" /><label className="button secondary small"><Plus size={13} />添加文件<input aria-label="添加 API 上传文件" type="file" hidden multiple onChange={e => { if (!fileField.trim()) { toast.error('先填写文件字段名'); return } setFiles(previous => [...previous,...Array.from(e.target.files || []).map(file => ({name:fileField,file}))]); e.target.value = '' }} /></label></div>{files.map((f,i) => <div className="file-chip" key={i}><code>{f.name}</code><span>{f.file.name}</span><button className="icon-button" title="移除文件" onClick={() => setFiles(previous => previous.filter((_,j) => j !== i))}>×</button></div>)}</>}</>}<details className="advanced"><summary>可选请求头</summary><Field label="OpenAI-Beta"><input value={betaHeader} onChange={e => setBetaHeader(e.target.value)} placeholder="按官方文档填写（通常留空）" /></Field></details>{deleteConfirmation ? <div className="inline-confirm"><span>确认从 OpenAI 删除路径对应的资源？</span><button className="button danger small" onClick={() => void run(true)}>确认执行删除</button><button className="button secondary small" onClick={() => setDeleteConfirmation(false)}>取消</button></div> : <RunButton busy={op.busy} onClick={() => void run()} stop={op.stop} label={method === 'GET' ? '发送查询' : '执行请求'} />}<a className="text-link" href="https://developers.openai.com/api/reference/overview" target="_blank" rel="noreferrer">API Reference <ArrowRight size={13} /></a><p className="field-hint">所有请求使用连接设置中的 Key。模型、参数和权限以接口实际响应为准；不会自动重试付费请求。</p></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState label="请求已发出，正在等待 OpenAI 响应…" /> : op.result ? <ResultPanel result={op.result} /> : <EmptyResult icon={icon} title={group === '文件与知识库' ? '你的资料，也是模型的上下文' : group === '批处理与训练' ? '让模型，处理更大的任务' : '为每一种可能，留一个入口'} description={group === '文件与知识库' ? '上传文件，创建向量知识库，检查索引状态并执行语义检索。' : group === '批处理与训练' ? '提交批处理、查询结果、查看训练任务。支持完整官方 JSON 参数。' : '选择模板或官方路径，编辑完整参数，查看真实响应。支持 JSON、文件上传与二进制下载。'} />}</ToolLayout>
}

export function BatchPanel() {
  function downloadExample() {
    const rows = [
      {custom_id:'request-1',method:'POST',url:'/v1/responses',body:{model:'gpt-6.1-sol',input:'用一句话解释什么是向量检索。',store:false}},
      {custom_id:'request-2',method:'POST',url:'/v1/responses',body:{model:'gpt-6.1-sol',input:'将 Hello world 翻译成中文。',store:false}},
    ]
    downloadText(rows.map(r => JSON.stringify(r)).join('\n')+'\n','openai-batch-example.jsonl','application/jsonl')
  }
  return <><div className="workflow-strip"><div><span>01</span><strong>准备 JSONL</strong><button onClick={downloadExample}><Download size={13} />下载示例</button></div><ArrowRight size={16} /><div><span>02</span><strong>上传文件</strong><small>purpose 选择 batch</small></div><ArrowRight size={16} /><div><span>03</span><strong>创建任务</strong><small>填写 input_file_id</small></div><ArrowRight size={16} /><div><span>04</span><strong>查询并下载</strong><small>output_file_id → 文件内容</small></div></div><Notice kind="warning">微调平台限制：新组织无法新建训练；已获准的活跃老客户计划于 2027-01-06 起无法新建微调任务。微调模型的推理可用性跟随基础模型。Evals 另有关闭时间表。<DocsLink path="deprecations" /></Notice><ApiWorkbench group="批处理与训练" /></>
}

export function VideosPanel() {
  const op = useOperation('videos')
  const [id,setId] = useState('')
  return <div className="video-page"><div className="retired-hero panel"><div className="empty-icon"><Film size={32} /></div><span className="badge warning">官方已停用</span><h2>Sora 视频 API 已结束服务</h2><p>Sora 2、Sora 2 Pro 与 Videos API 已于 2026-09-24 停用。<br />官方文档中的历史示例仍可查阅，现已无法通过 API 新建视频。</p><DocsLink path="deprecations#2026-03-24-sora-2-video-generation-models-and-videos-api">查看官方停用说明</DocsLink></div><div className="panel legacy-video"><h3>历史任务查询</h3><p>如你的账号保留了特殊访问权限，可在这里发送历史任务查询。接口可能返回停用错误。</p><div className="inline-input"><input aria-label="历史视频任务 ID" value={id} onChange={e => setId(e.target.value)} placeholder="video_…" /><button className="button secondary" disabled={!id.trim() || op.busy} onClick={() => void op.run('/videos/'+encodeURIComponent(id.trim()),undefined,'GET')}>查询任务</button></div>{op.error && <Notice kind="error">{op.error}</Notice>}{op.result && <ResultPanel result={op.result} />}</div></div>
}
