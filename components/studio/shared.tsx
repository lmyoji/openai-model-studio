'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown, Copy, Download, ExternalLink, LoaderCircle, SlidersHorizontal, Square, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { isRetired, modelForId, sortModels, supportsSection } from '@/lib/studio/catalog'
import { downloadText } from '@/lib/studio/client'
import type { ModelInfo, ResultData } from '@/lib/studio/types'
import { useStudio } from './context'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>
}

export function Notice({ children, kind = 'info' }: { children: ReactNode; kind?: string }) {
  return <div className={'notice ' + kind} role={kind === 'error' ? 'alert' : undefined}>{children}</div>
}

export function ModelPicker({ section, value, onChange, disabled = false }: { section: string; value?: string; onChange?: (id: string) => void; disabled?: boolean }) {
  const { models, selections, chooseModel, synced } = useStudio()
  const [showRetired, setShowRetired] = useState(false)
  const id = value ?? selections[section] ?? ''
  const current = modelForId(id, models)
  const options = useMemo(() => sortModels(models.filter(m => supportsSection(m, section) && (showRetired || !isRetired(m) || m.id === id))), [models, section, showRetired, id])
  return <div className="model-picker">
    <Field label="选择模型"><div className="select-wrap"><select aria-label="选择模型" value={id} disabled={disabled} onChange={e => onChange ? onChange(e.target.value) : chooseModel(section, e.target.value)}>
      {!options.some(m => m.id === id) && <option value={id}>{id || '请选择模型'}</option>}
      {options.map(m => <option key={m.id} value={m.id} disabled={isRetired(m)}>{m.id}{isRetired(m) ? ' · 已停用' : m.accountAvailable === false ? ' · 账号未返回' : m.deprecated ? ' · 即将停用' : ''}</option>)}
    </select><ChevronDown size={14} /></div></Field>
    <div className="model-meta"><span><i className={'status-dot ' + (current?.accountAvailable ? 'on' : '')} />{synced ? current?.accountAvailable ? '账号已返回' : '账号未返回此模型' : '填写 Key 后核实权限'}</span><a href={current?.url || 'https://developers.openai.com/api/docs/models'} target="_blank" rel="noreferrer" title="查看模型官方文档"><ArrowUpRight size={14} /></a></div>
    {current?.shutdownDate && <Notice kind={isRetired(current) ? 'error' : 'warning'}>{isRetired(current) ? '已于' : '计划于'} {current.shutdownDate} 停用。{current.replacement && <span className="break">替代建议：{current.replacement.replace(/`/g, '')}</span>}</Notice>}
    {current?.restricted && <Notice kind="warning">此模型需要单独开通访问权限。</Notice>}
    {current?.undocumented && <Notice>此 ID 的能力信息可能继承自基础模型；请以账号接口实际响应为准。</Notice>}
    <label className="check small"><input type="checkbox" checked={showRetired} onChange={e => setShowRetired(e.target.checked)} />显示已停用模型</label>
  </div>
}

export function AdvancedJson({ value, onChange, label = '高级参数 JSON', hint }: { value: string; onChange: (value: string) => void; label?: string; hint?: string }) {
  return <details className="advanced"><summary><SlidersHorizontal size={14} />{label}<ChevronDown size={13} /></summary><textarea aria-label={label} className="code-input" rows={7} spellCheck={false} value={value} onChange={e => onChange(e.target.value)} placeholder={'{\n  "user": "optional-identifier"\n}'} /><p className="field-hint">{hint || '与表单参数合并，同名字段以这里为准。填写官方接口支持的参数。'}</p></details>
}

export function RunButton({ busy, onClick, stop, label = '开始生成', disabled = false }: { busy: boolean; onClick: () => void; stop?: () => void; label?: string; disabled?: boolean }) {
  return busy ? <button className="button secondary" onClick={stop}><Square size={14} />停止请求</button> : <button className="button primary" disabled={disabled} onClick={onClick}><Sparkles size={15} />{label}<ArrowUpRight size={15} /></button>
}

export function LoadingState({ label = '模型正在处理，请稍候…' }: { label?: string }) { return <div className="loading-state"><LoaderCircle className="spin" size={24} /><p>{label}</p><span>可以停止等待；已开始的 API 调用仍可能计费。</span></div> }

export function EmptyResult({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-result"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p><span className="empty-caption">POWERED BY OPENAI</span></div>
}

function imageMime(data: string) { return data.startsWith('/9j/') ? 'image/jpeg' : data.startsWith('UklGR') ? 'image/webp' : 'image/png' }

export function ResultPanel({ result, image = false, children }: { result: ResultData; image?: boolean; children?: ReactNode }) {
  const json = result.json
  const raw = json !== undefined ? JSON.stringify(json, null, 2) : result.text || ''
  const data = json && typeof json === 'object' && 'data' in json && Array.isArray(json.data) ? json.data : []
  const audioChoices = json && typeof json === 'object' && 'choices' in json && Array.isArray(json.choices) ? json.choices : []
  const images = image ? data : []
  return <div className="result-panel">
    <div className="result-heading"><span><Check size={14} />请求完成</span><div className="actions">{raw && <button className="icon-button" title="复制结果" onClick={() => navigator.clipboard.writeText(raw).then(() => toast.success('已复制结果')).catch(() => toast.error('无法访问剪贴板'))}><Copy size={15} /></button>}{raw && <button className="icon-button" title="下载结果" onClick={() => downloadText(raw, 'openai-result.' + (json !== undefined ? 'json' : 'txt'))}><Download size={15} /></button>}</div></div>
    {children}
    {images.length > 0 && <div className="image-results">{images.map((entry: Record<string, string>, index: number) => {
      const source = entry.b64_json ? `data:${imageMime(entry.b64_json)};base64,${entry.b64_json}` : entry.url
      return <figure key={index}>{source && <img src={source} alt={'生成的图像 ' + (index + 1)} loading="lazy" />}<figcaption>{entry.revised_prompt || `图像 ${index + 1}`}<a href={source} download={`openai-image-${index + 1}.${entry.b64_json ? imageMime(entry.b64_json).split('/')[1] : 'png'}`} target="_blank" rel="noreferrer"><Download size={14} />保存图像</a></figcaption></figure>
    })}</div>}
    {audioChoices.map((choice: { message?: { audio?: { data?: string; transcript?: string } } }, i: number) => choice.message?.audio?.data ? <div className="audio-result" key={i}><audio controls src={'data:audio/wav;base64,' + choice.message.audio.data} /><p>{choice.message.audio.transcript}</p><small>此声音由 AI 生成。</small></div> : null)}
    {result.url && <div className="media-result">{result.mime?.startsWith('audio/') ? <><audio controls src={result.url} /><p className="field-hint">此声音由 AI 生成。</p></> : result.mime?.startsWith('video/') ? <video controls src={result.url} /> : null}<a className="button secondary" href={result.url} download={result.filename}><Download size={15} />下载文件</a></div>}
    {!images.length && result.text && <pre className="text-result">{result.text}</pre>}
    {json !== undefined && <details className="raw-response" open={!image && !children && !audioChoices.length}><summary>原始响应 <span>JSON</span></summary><pre>{raw.slice(0,60000)}{raw.length > 60000 && '\n… 内容较长，请下载查看完整结果。'}</pre></details>}
    {result.requestId && <div className="request-id">Request ID <code>{result.requestId}</code></div>}
  </div>
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export function ToolLayout({ form, children }: { form: ReactNode; children: ReactNode }) { return <div className="tool-layout"><div className="tool-form panel">{form}</div><div className="tool-output panel">{children}</div></div> }

export function DocsLink({ path, children = '官方使用指南' }: { path: string; children?: ReactNode }) { return <a className="text-link" href={'https://developers.openai.com/api/docs/' + path} target="_blank" rel="noreferrer">{children}<ExternalLink size={13} /></a> }
