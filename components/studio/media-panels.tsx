'use client'

import { useState } from 'react'
import { AudioLines, FileAudio, Headphones, ImagePlus, Mic, ShieldCheck, Upload, Waypoints, X } from 'lucide-react'
import { toast } from 'sonner'
import { modelForId } from '@/lib/studio/catalog'
import { cosineSimilarity, extractOutput, parseObject, positiveInt } from '@/lib/studio/requests'
import { fileData } from '@/lib/studio/client'
import { useOperation, useStudio } from './context'
import { AdvancedJson, DocsLink, EmptyResult, Field, LoadingState, ModelPicker, Notice, ResultPanel, RunButton, ToolLayout } from './shared'

function FileChooser({ files, onChange, accept, multiple = false, label = '选择文件' }: { files: File[]; onChange: (files: File[]) => void; accept: string; multiple?: boolean; label?: string }) {
  return <div className="file-chooser"><label className="upload-zone"><Upload size={21} /><strong>{label}</strong><span>点击浏览本地文件</span><input type="file" aria-label={label} accept={accept} multiple={multiple} onChange={e => { onChange(Array.from(e.target.files || [])); e.target.value = '' }} /></label>{files.map((f, i) => <div className="file-chip" key={i}><span>{f.name}</span><small>{(f.size / 1024 / 1024).toFixed(2)} MB</small><button className="icon-button" aria-label={'移除 ' + f.name} onClick={() => onChange(files.filter((_, n) => n !== i))}><X size={13} /></button></div>)}</div>
}

export function ImagesPanel() {
  const { selections, models } = useStudio()
  const model = selections.images
  const info = modelForId(model, models)
  const op = useOperation('images')
  const [mode, setMode] = useState('generate')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [quality, setQuality] = useState('auto')
  const [format, setFormat] = useState('png')
  const [background, setBackground] = useState('auto')
  const [count, setCount] = useState('1')
  const [files, setFiles] = useState<File[]>([])
  const [mask, setMask] = useState<File[]>([])
  const [advanced, setAdvanced] = useState('')
  async function run() {
    try {
      if (!prompt.trim()) throw new Error('先描述你想要的画面。')
      if (background === 'transparent' && format === 'jpeg') throw new Error('透明背景请选择 PNG 或 WebP。')
      if (['xhigh', 'max'].includes(quality) && !model.includes('2.5')) throw new Error('此模型不支持 xhigh 或 max 画质。')
      const n = positiveInt(count, '生成数量')
      if (n > 10) throw new Error('一次最多生成 10 张图像。')
      const body = { model, prompt, size, quality, output_format: format, background, n, ...parseObject(advanced) }
      if (mode === 'edit') {
        if (!info?.endpoints.includes('image_edit')) throw new Error('此模型的官方能力表未包含图像编辑。')
        if (!files.length) throw new Error('请上传要编辑的原图。')
        if (files.some(f => f.size > 32 * 1024 * 1024) || files.reduce((n, f) => n + f.size, 0) + (mask[0]?.size || 0) > 60 * 1024 * 1024) throw new Error('单张原图不超过 32 MB，总量不超过 60 MB。')
        const form = new FormData()
        for (const [key, value] of Object.entries(body)) form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
        for (const file of files) form.append('image[]', file)
        if (mask[0]) form.set('mask', mask[0])
        await op.run('/images/edits', form, 'POST', model)
      } else await op.run('/images/generations', body, 'POST', model)
    } catch (error) { op.setError((error as Error).message) }
  }
  return <ToolLayout form={<><ModelPicker section="images" /><div className="segmented"><button className={mode === 'generate' ? 'selected' : ''} onClick={() => setMode('generate')}>文生图</button><button className={mode === 'edit' ? 'selected' : ''} onClick={() => setMode('edit')}>图像编辑</button></div><Field label="画面描述"><textarea rows={6} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="描述主体、环境、构图、光线，以及你希望呈现的风格…" /></Field><button className="prompt-example" onClick={() => setPrompt('一座漂浮在云海中的温室，清晨的柔和光线穿过玻璃穹顶，内部种满热带植物，建筑摄影，极简构图，电影级细节。')}>试试：云海中的玻璃温室 ↗</button>{mode === 'edit' && <><FileChooser files={files} onChange={setFiles} accept="image/png,image/jpeg,image/webp" multiple label="上传参考原图" /><Field label="局部编辑蒙版（可选）" hint="PNG 蒙版的透明区域将被编辑；尺寸应与原图一致。"><input type="file" accept="image/png" onChange={e => setMask(Array.from(e.target.files || []))} /></Field></>}<div className="field-grid"><Field label="图像尺寸"><select value={size} onChange={e => setSize(e.target.value)}>{['auto', '1024x1024', '1536x1024', '1024x1536'].map(s => <option key={s}>{s}</option>)}</select></Field><Field label="画质"><select value={quality} onChange={e => setQuality(e.target.value)}>{['auto', 'low', 'medium', 'high', ...(model.includes('2.5') ? ['xhigh', 'max'] : [])].map(s => <option key={s}>{s}</option>)}</select></Field><Field label="输出格式"><select value={format} onChange={e => setFormat(e.target.value)}>{['png', 'jpeg', 'webp'].map(s => <option key={s}>{s}</option>)}</select></Field><Field label="背景"><select value={background} onChange={e => setBackground(e.target.value)}><option value="auto">自动</option><option value="opaque">不透明</option><option value="transparent">透明</option></select></Field></div><Field label="生成数量"><input type="number" min={1} max={10} value={count} onChange={e => setCount(e.target.value)} /></Field><AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label={mode === 'edit' ? '生成编辑结果' : '生成图像'} /><DocsLink path="guides/image-generation" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState label="正在将你的想法绘成图像…" /> : op.result ? <ResultPanel result={op.result} image /> : <EmptyResult icon={<ImagePlus size={32} />} title="画面，从一句描述开始" description="选择模型，写下灵感。生成的图像会出现在这里，支持预览与下载。" />}</ToolLayout>
}

export function SpeechPanel() {
  const { selections } = useStudio()
  const op = useOperation('speech')
  const [input, setInput] = useState('')
  const [voice, setVoice] = useState('coral')
  const [format, setFormat] = useState('mp3')
  const [speed, setSpeed] = useState('1')
  const [instructions, setInstructions] = useState('')
  const [advanced, setAdvanced] = useState('')
  async function run() {
    try {
      if (!input.trim()) throw new Error('请输入要朗读的文字。')
      const n = Number(speed)
      if (!Number.isFinite(n) || n < 0.25 || n > 4) throw new Error('语速必须在 0.25 到 4 之间。')
      await op.run('/audio/speech', { model: selections.speech, input, voice, response_format: format, speed: n, ...(instructions && !selections.speech.startsWith('tts-') ? { instructions } : {}), ...parseObject(advanced) }, 'POST', selections.speech)
    } catch (e) { op.setError((e as Error).message) }
  }
  return <ToolLayout form={<><ModelPicker section="speech" /><Notice kind="warning">Speech API 的现有模型计划于 2027-01-06 停用。新语音应用可使用「实时语音」中的 GPT-Realtime 模型。</Notice><Field label="朗读文本"><textarea rows={8} maxLength={4096} value={input} onChange={e => setInput(e.target.value)} placeholder="写下要被听见的文字…" /></Field><div className="field-grid"><Field label="声音"><select value={voice} onChange={e => setVoice(e.target.value)}>{['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'].map(v => <option key={v}>{v}</option>)}</select></Field><Field label="音频格式"><select value={format} onChange={e => setFormat(e.target.value)}>{['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'].map(v => <option key={v}>{v}</option>)}</select></Field></div><Field label="语速"><input type="number" step="0.05" min="0.25" max="4" value={speed} onChange={e => setSpeed(e.target.value)} /></Field>{!selections.speech.startsWith('tts-') && <Field label="语气与表达（可选）"><textarea rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="例如：用温暖、轻松的声音，语句之间略作停顿。" /></Field>}<AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label="生成语音" /><DocsLink path="guides/text-to-speech" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState /> : op.result ? <ResultPanel result={op.result} /> : <EmptyResult icon={<AudioLines size={34} />} title="让文字，有温度地表达" description="选择声音与语速，生成可试听、可下载的 AI 语音。" />}</ToolLayout>
}

export function TranscribePanel() {
  const { selections } = useStudio()
  const op = useOperation('transcribe')
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState('transcribe')
  const [language, setLanguage] = useState('')
  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState('')
  const [advanced, setAdvanced] = useState('')
  const model = selections.transcribe
  async function run() {
    try {
      const file = files[0]
      if (!file) throw new Error('请先选择音频文件。')
      if (file.size > 25 * 1024 * 1024) throw new Error('转写文件不能超过 25 MB。')
      if (mode === 'translate' && model !== 'whisper-1') throw new Error('旧版音频文件英译仅支持 whisper-1；实时多语言翻译请使用实时语音栏目。')
      const form = new FormData()
      form.set('file', file); form.set('model', model)
      if (prompt.trim()) form.set('prompt', prompt)
      if (language.trim() && mode !== 'translate') {
        if (model === 'gpt-transcribe') for (const lang of language.split(',').map(l => l.trim()).filter(Boolean)) form.append('languages[]', lang)
        else form.set('language', language.trim())
      }
      if (format) form.set('response_format', format)
      if (model.includes('diarize')) { form.set('chunking_strategy', 'auto'); if (!format) form.set('response_format', 'diarized_json') }
      for (const [k, v] of Object.entries(parseObject(advanced))) {
        form.delete(k)
        if (Array.isArray(v)) for (const item of v) form.append(k.endsWith('[]') ? k : k + '[]', String(item))
        else form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
      await op.run(mode === 'translate' ? '/audio/translations' : '/audio/transcriptions', form, 'POST', model)
    } catch (e) { op.setError((e as Error).message) }
  }
  return <ToolLayout form={<><ModelPicker section="transcribe" /><div className="segmented"><button className={mode === 'transcribe' ? 'selected' : ''} onClick={() => setMode('transcribe')}>原语言转写</button><button className={mode === 'translate' ? 'selected' : ''} onClick={() => setMode('translate')}>翻译为英语</button></div>{mode === 'translate' && <Notice kind="warning">文件英译为 Whisper 历史能力；新实时翻译请前往「实时语音」。</Notice>}<FileChooser files={files} onChange={setFiles} accept="audio/*,video/mp4,video/webm" label="上传音频或录音文件" /><p className="field-hint">MP3、MP4、MPEG、MPGA、M4A、WAV、WebM，最大 25 MB。</p><Field label={model === 'gpt-transcribe' ? '预期语言（可多选，逗号分隔）' : '语言代码（可选）'}><input value={language} onChange={e => setLanguage(e.target.value)} placeholder={model === 'gpt-transcribe' ? 'zh,en' : 'zh'} /></Field><Field label="音频上下文（可选）"><textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="提供专业词汇或对话背景，帮助模型准确识别。" /></Field><Field label="输出格式" hint="默认使用模型原生格式；字幕与说话人格式需对应模型支持。"><select value={format} onChange={e => setFormat(e.target.value)}><option value="">模型默认</option>{['json', ...(model === 'whisper-1' ? ['text', 'srt', 'verbose_json', 'vtt'] : []), ...(model.includes('diarize') ? ['diarized_json'] : [])].map(v => <option key={v}>{v}</option>)}</select></Field><AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label="开始转写" /><DocsLink path="guides/speech-to-text" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState label="正在聆听并转写…" /> : op.result ? <ResultPanel result={op.result}>{op.result.json && typeof op.result.json === 'object' && 'text' in op.result.json ? <pre className="text-result">{String(op.result.json.text)}</pre> : null}</ResultPanel> : <EmptyResult icon={<FileAudio size={34} />} title="把声音，整理成文字" description="上传会议、访谈或语音备忘录，获取转写文本和模型返回的细节。" />}</ToolLayout>
}

export function AudioPanel() {
  const { selections } = useStudio()
  const op = useOperation('audio')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [voice, setVoice] = useState('alloy')
  const [outputAudio, setOutputAudio] = useState(true)
  const [advanced, setAdvanced] = useState('')
  async function run() {
    try {
      if (!text.trim() && !files[0]) throw new Error('请输入内容或上传 WAV / MP3 音频。')
      const content: Record<string, unknown>[] = text.trim() ? [{ type: 'text', text }] : []
      if (files[0]) {
        if (files[0].size > 15 * 1024 * 1024) throw new Error('音频对话文件请控制在 15 MB 以内。')
        const format = files[0].name.split('.').pop()?.toLowerCase()
        if (!['wav', 'mp3'].includes(format || '')) throw new Error('音频对话的此入口支持 WAV 和 MP3。')
        content.push({ type: 'input_audio', input_audio: { data: (await fileData(files[0])).split(',')[1], format } })
      }
      await op.run('/chat/completions', { model: selections.audio, messages: [{ role: 'user', content }], modalities: outputAudio ? ['text', 'audio'] : ['text'], ...(outputAudio ? { audio: { voice, format: 'wav' } } : {}), ...parseObject(advanced) }, 'POST', selections.audio)
    } catch (e) { op.setError((e as Error).message) }
  }
  return <ToolLayout form={<><ModelPicker section="audio" /><Field label="你的消息"><textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="例如：听一下这段录音，用自然的声音总结内容。" /></Field><FileChooser files={files} onChange={setFiles} accept=".wav,.mp3" label="添加音频（可选）" /><label className="check"><input type="checkbox" checked={outputAudio} onChange={e => setOutputAudio(e.target.checked)} />同时生成语音回复</label>{outputAudio && <Field label="回复声音"><select value={voice} onChange={e => setVoice(e.target.value)}>{['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'].map(v => <option key={v}>{v}</option>)}</select></Field>}<AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label="发送音频对话" /><DocsLink path="guides/audio" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState /> : op.result ? <ResultPanel result={op.result}>{!outputAudio && op.result.json ? <pre className="text-result">{extractOutput(op.result.json)}</pre> : null}</ResultPanel> : <EmptyResult icon={<Headphones size={34} />} title="和声音，聊聊" description="以音频或文字提问，让 GPT-Audio 理解内容并生成回复。" />}</ToolLayout>
}

export function EmbeddingsPanel() {
  const { selections } = useStudio()
  const op = useOperation('embeddings')
  const [input, setInput] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [advanced, setAdvanced] = useState('')
  async function run() {
    try {
      const texts = input.split('\n').map(s => s.trim()).filter(Boolean)
      if (!texts.length) throw new Error('请至少输入一段文本。')
      if (dimensions && !selections.embeddings.startsWith('text-embedding-3')) throw new Error('只有 text-embedding-3 系列支持自定义维度。')
      await op.run('/embeddings', { model: selections.embeddings, input: texts, encoding_format: 'float', ...(dimensions ? { dimensions: positiveInt(dimensions, '向量维度') } : {}), ...parseObject(advanced) }, 'POST', selections.embeddings)
    } catch (e) { op.setError((e as Error).message) }
  }
  const embeddingData = op.result?.json && typeof op.result.json === 'object' && 'data' in op.result.json && Array.isArray(op.result.json.data) ? op.result.json.data.filter(v => Array.isArray(v.embedding)) as { embedding: number[]; index: number }[] : []
  return <ToolLayout form={<><ModelPicker section="embeddings" /><Field label="输入文本（每行一段）"><textarea rows={9} value={input} onChange={e => setInput(e.target.value)} placeholder={'今天的天气很好\n阳光明媚，适合出门\n这段程序有一个类型错误'} /></Field><Field label="向量维度（可选）" hint="留空使用模型默认维度。"><input type="number" min={1} value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="默认" /></Field><AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label="生成文本向量" /><DocsLink path="guides/embeddings" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState /> : op.result ? <ResultPanel result={op.result}>{embeddingData.length > 0 && <div className="similarity"><h3>语义相似度</h3><p className="field-hint">余弦相似度；越接近 1，方向越接近。</p><div className="table-scroll"><table><thead><tr><th>文本</th>{embeddingData.slice(0,10).map((_, i) => <th key={i}>{i+1}</th>)}</tr></thead><tbody>{embeddingData.slice(0,10).map((row, i) => <tr key={i}><th>{i+1}</th>{embeddingData.slice(0,10).map((col, j) => { const n = cosineSimilarity(row.embedding, col.embedding); return <td key={j} style={{ background: `rgba(20,128,101,${Math.max(0,n)*.2})` }}>{n.toFixed(3)}</td> })}</tr>)}</tbody></table></div><p className="field-hint">{embeddingData.length} 段文本 · {embeddingData[0].embedding.length} 维{embeddingData.length > 10 ? ' · 表中展示前 10 段' : ''}</p></div>}</ResultPanel> : <EmptyResult icon={<Waypoints size={34} />} title="发现文字背后的联系" description="将文本转成向量，比较语义相似度，并下载完整向量数据。" />}</ToolLayout>
}

export function ModerationPanel() {
  const { selections } = useStudio()
  const op = useOperation('moderation')
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [advanced, setAdvanced] = useState('')
  async function run() {
    try {
      if (!input.trim() && !files.length) throw new Error('请输入待审核文本或上传图片。')
      if (files.some(f => f.size > 10 * 1024 * 1024)) throw new Error('审核图片不能超过 10 MB。')
      if (files.length && !selections.moderation.startsWith('omni-')) throw new Error('文本审核旧模型不支持图像，请选择 omni-moderation。')
      const content = files.length ? [...(input.trim() ? [{ type: 'text', text: input }] : []), ...await Promise.all(files.map(async f => ({ type: 'image_url', image_url: { url: await fileData(f) } })))] : input
      await op.run('/moderations', { model: selections.moderation, input: content, ...parseObject(advanced) }, 'POST', selections.moderation)
    } catch (e) { op.setError((e as Error).message) }
  }
  const moderation = op.result?.json && typeof op.result.json === 'object' && 'results' in op.result.json && Array.isArray(op.result.json.results) ? op.result.json.results : []
  return <ToolLayout form={<><ModelPicker section="moderation" /><Field label="待审核文本"><textarea rows={8} value={input} onChange={e => setInput(e.target.value)} placeholder="粘贴需要检查的内容…" /></Field><FileChooser files={files} onChange={setFiles} accept="image/*" label="添加待审核图片（可选）" /><AdvancedJson value={advanced} onChange={setAdvanced} /><RunButton busy={op.busy} onClick={run} stop={op.stop} label="审核内容" /><DocsLink path="guides/moderation" /></>}>{op.error && <Notice kind="error">{op.error}</Notice>}{op.busy ? <LoadingState /> : op.result ? <ResultPanel result={op.result}>{moderation.map((r, i) => <div className="moderation-result" key={i}><div className={'verdict ' + (r.flagged ? 'flagged' : '')}><ShieldCheck size={24} /><div><strong>{r.flagged ? '检测到内容风险' : '未标记内容风险'}</strong><p>模型判断，供你进一步审核。</p></div></div>{Object.entries(r.category_scores || {}).map(([key, score]) => <div className="score-row" key={key}><span>{key}</span><div><i style={{ width: `${Math.min(100,Number(score)*100)}%` }} /></div><code>{(Number(score)*100).toFixed(2)}%</code></div>)}</div>)}</ResultPanel> : <EmptyResult icon={<ShieldCheck size={34} />} title="为内容，多一道把关" description="查看文本或图像在各风险类别中的模型评分与标记结果。" />}</ToolLayout>
}
