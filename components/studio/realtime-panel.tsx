'use client'

import { useEffect, useRef, useState } from 'react'
import { AudioLines, Download, Mic, MicOff, Phone, PhoneOff, Radio, Send } from 'lucide-react'
import { toast } from 'sonner'
import { modelForId } from '@/lib/studio/catalog'
import { downloadText, ensureSuccess, recordRequest, studioFetch } from '@/lib/studio/client'
import { parseObject } from '@/lib/studio/requests'
import { useStudio } from './context'
import { AdvancedJson, DocsLink, Field, ModelPicker, Notice } from './shared'

export function RealtimePanel() {
  const { selections, models, requireKey, session } = useStudio()
  const model = selections.realtime
  const info = modelForId(model, models)
  const isLive = info?.endpoints.includes('live')
  const isTranslation = info?.endpoints.includes('realtime_translation')
  const isTranscription = info?.endpoints.includes('realtime_transcription') && !info.endpoints.includes('realtime')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('用自然、简洁的中文和我交谈。')
  const [voice, setVoice] = useState('marin')
  const [language, setLanguage] = useState('en')
  const [backend, setBackend] = useState('gpt-6.1-sol')
  const [advanced, setAdvanced] = useState('')
  const [customEvent, setCustomEvent] = useState('{"type":"response.create"}')
  const [events, setEvents] = useState<Record<string, unknown>[]>([])
  const [transcript, setTranscript] = useState('')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [sessionId, setSessionId] = useState('')
  const resources = useRef<{ peer?: RTCPeerConnection; channel?: RTCDataChannel; mic?: MediaStream; socket?: WebSocket; context?: AudioContext; recorder?: AudioWorkletNode; closeTimer?: ReturnType<typeof setTimeout>; started?: number; liveId?: string; abort?: AbortController; ready?: boolean }>({})
  const audio = useRef<HTMLAudioElement>(null)
  const active = ['connecting','connected','closing'].includes(status)
  function cleanup() {
    const r = resources.current
    clearTimeout(r.closeTimer)
    r.abort?.abort(); r.mic?.getTracks().forEach(t => t.stop()); r.recorder?.disconnect()
    if (r.context && r.context.state !== 'closed') void r.context.close().catch(() => {})
    r.socket?.close(); r.channel?.close(); r.peer?.close()
    if (audio.current) audio.current.srcObject = null
    resources.current = {}; setMuted(false)
  }
  useEffect(() => () => {
    const r = resources.current
    if (r.liveId) void studioFetch(`/live/sessions/${encodeURIComponent(r.liveId)}/hangup`, { method: 'POST', keepalive: true }).catch(() => {})
    cleanup()
  }, [])
  useEffect(() => {
    if (status !== 'connected') return
    const id = setInterval(() => setSeconds(Math.floor((Date.now()-(resources.current.started || Date.now()))/1000)),1000)
    return () => clearInterval(id)
  }, [status])
  function sendEvent(event: Record<string, unknown>) {
    const r = resources.current
    if (r.socket?.readyState === WebSocket.OPEN) r.socket.send(JSON.stringify(event))
    else if (r.channel?.readyState === 'open') r.channel.send(JSON.stringify(event))
    else throw new Error('事件通道尚未连接。')
  }
  function handleEvent(data: string) {
    let event: Record<string, any>
    try { event = JSON.parse(data) } catch { return }
    setEvents(previous => [...previous.slice(-249), event])
    if (event.type === 'session.started' || (!isLive && (isTranscription ? ['session.updated'] : ['session.created','session.updated']).includes(event.type))) { resources.current.ready = true; setStatus('connected'); resources.current.started ||= Date.now(); if (event.session?.id) setSessionId(event.session.id) }
    if (event.type === 'session.closed') {
      recordRequest({ section: 'realtime', path: isLive ? '/live/sessions' : '/realtime', model, status: 200, duration: Date.now()-(resources.current.started || Date.now()), usage: event.usage })
      cleanup(); setStatus('ended')
    }
    if (event.type === 'error') setError(event.error?.message || event.message || JSON.stringify(event))
    if (typeof event.delta === 'string' && /transcript|transcription|text/.test(event.type || '')) setTranscript(previous => previous + event.delta)
    if (typeof event.transcript === 'string' && String(event.type).includes('completed')) setTranscript(previous => previous + '\n' + event.transcript + '\n')
    if (String(event.type).endsWith('.done')) setTranscript(previous => previous + '\n')
  }
  async function start() {
    if (active || !requireKey()) return
    let options: Record<string, unknown>
    try { options = parseObject(advanced, '会话配置') } catch (e) { setError((e as Error).message); return }
    setStatus('connecting'); setError(''); setEvents([]); setTranscript(''); setSeconds(0); setSessionId('')
    const r = resources.current = { abort: new AbortController() } as typeof resources.current
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('请在 HTTPS 或 localhost 环境使用支持麦克风的浏览器。')
      r.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (r.abort?.signal.aborted) { r.mic.getTracks().forEach(t => t.stop()); return }
      if (isTranscription) {
        const wsUrl = new URL('/api/studio/socket?intent=transcription', location.href); wsUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const socket = r.socket = new WebSocket(wsUrl)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('实时转写连接超时，请检查 API Key、模型权限或网络。')),20000)
          socket.onopen = () => { clearTimeout(timeout); resolve() }
          socket.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket 连接失败，请检查连接设置与模型权限。')) }
        })
        socket.onmessage = e => handleEvent(e.data)
        socket.onclose = () => { if (resources.current === r) { cleanup(); setStatus('ended') } }
        sendEvent({ type: 'session.update', session: { type: 'transcription', audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model }, turn_detection: null } }, ...options } })
        const context = r.context = new AudioContext({ sampleRate: 24000 })
        if (context.sampleRate !== 24000) throw new Error('此浏览器无法创建 24 kHz 音频，请更换浏览器或使用文件转写。')
        await context.audioWorklet.addModule('/pcm-recorder.js')
        const recorder = r.recorder = new AudioWorkletNode(context, 'studio-pcm-recorder')
        recorder.port.onmessage = event => {
          if (socket.readyState !== WebSocket.OPEN || !r.ready) return
          if (event.data?.type === 'flushed') { socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' })); return }
          let binary = ''; for (const byte of new Uint8Array(event.data)) binary += String.fromCharCode(byte)
          socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: btoa(binary) }))
        }
        context.createMediaStreamSource(r.mic).connect(recorder); recorder.connect(context.destination); await context.resume()
        r.closeTimer = setTimeout(() => { if (!r.ready && resources.current === r) { setError('转写配置未获服务器确认，请检查模型权限。'); cleanup(); setStatus('ended') } },20000)
        return
      }
      const peer = r.peer = new RTCPeerConnection()
      peer.ontrack = event => { if (audio.current) { audio.current.srcObject = new MediaStream([event.track]); void audio.current.play().catch(() => toast.info('请点击音频播放器的播放按钮以收听。')) } }
      peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed') { setError('音频连接失败，请检查网络后重连。'); cleanup(); setStatus('ended') } }
      for (const track of r.mic.getAudioTracks()) peer.addTrack(track, r.mic)
      const channel = r.channel = peer.createDataChannel('oai-events')
      channel.onmessage = e => handleEvent(e.data)
      channel.onopen = () => { if (!isLive) { r.ready = true; r.started = Date.now(); setStatus('connected') } }
      channel.onclose = () => { if (resources.current === r && r.ready) { cleanup(); setStatus('ended') } }
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer)
      await new Promise<void>((resolve, reject) => {
        if (peer.iceGatheringState === 'complete') { resolve(); return }
        const timer = setTimeout(() => { peer.removeEventListener('icegatheringstatechange', check); reject(new Error('音频连接协商超时。')) },10000)
        function check() { if (peer.iceGatheringState === 'complete') { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange',check); resolve() } }
        peer.addEventListener('icegatheringstatechange',check)
      })
      const sdp = peer.localDescription?.sdp
      if (!sdp) throw new Error('无法创建音频连接描述。')
      let answer = ''
      if (isLive) {
        const response = await studioFetch('/live/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: r.abort?.signal, body: JSON.stringify({ session: { model, instructions, delegation: { type: 'responses', responses: { model: backend, instructions: '用中文回答，简明准确。需要时使用联网搜索。', tools: [{ type: 'web_search' }] } }, ...options }, transport: { type: 'webrtc', sdp } }) })
        await ensureSuccess(response)
        const result = await response.json() as {transport:{sdp:string};session:{id:string}}; answer = result.transport?.sdp
        r.liveId = result.session?.id; if (r.liveId) setSessionId(r.liveId)
      } else if (isTranslation) {
        const response = await studioFetch('/realtime/translations/client_secrets', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: r.abort?.signal, body: JSON.stringify({ session: { model, audio: { output: { language } }, ...options } }) })
        await ensureSuccess(response)
        const secret = await response.json() as {value:string}
        if (!secret.value) throw new Error('服务器未返回临时翻译凭据。')
        const apiBase = session.baseUrl || 'https://api.openai.com/v1'
        const result = await fetch(apiBase + '/realtime/translations/calls', { method: 'POST', headers: { Authorization: 'Bearer ' + secret.value, 'content-type': 'application/sdp' }, body: sdp, signal: r.abort?.signal })
        await ensureSuccess(result); answer = await result.text()
      } else {
        const form = new FormData(); form.set('sdp',sdp); form.set('session',JSON.stringify({ type: 'realtime', model, instructions, audio: { output: { voice } }, ...options }))
        const response = await studioFetch('/realtime/calls', { method: 'POST', body: form, signal: r.abort?.signal })
        await ensureSuccess(response); answer = await response.text()
      }
      if (!answer) throw new Error('OpenAI 未返回有效的 SDP 回答。')
      await peer.setRemoteDescription({ type: 'answer', sdp: answer })
      r.closeTimer = setTimeout(() => { if (!r.ready && resources.current === r) { setError('未收到会话就绪事件，请检查模型权限和会话配置。'); cleanup(); setStatus('ended') } },20000)
    } catch (e) { if (resources.current === r) { setError((e as Error).name === 'NotAllowedError' ? '需要麦克风权限才能开始实时语音。' : (e as Error).message); cleanup(); setStatus('ended') } }
  }
  function end() {
    const r = resources.current
    if (isLive && r.channel?.readyState === 'open' && r.ready) {
      setStatus('closing'); sendEvent({ type: 'session.close' })
      r.closeTimer = setTimeout(() => { setError('未收到最终会话用量，正在关闭连接。'); if (r.liveId) void studioFetch(`/live/sessions/${encodeURIComponent(r.liveId)}/hangup`, { method:'POST' }).catch(() => {}); cleanup(); setStatus('ended') },15000)
    } else { cleanup(); setStatus('ended') }
  }
  return <div className="realtime-layout"><aside className="tool-form panel"><ModelPicker section="realtime" disabled={active} />{isLive ? <><Notice>GPT-Live 支持双向说话，并把复杂任务委托给下方模型。语音时长与后台模型分别计费。</Notice><Field label="后台推理模型"><input value={backend} onChange={e => setBackend(e.target.value)} disabled={active} /></Field></> : isTranslation ? <Field label="翻译目标语言"><input value={language} onChange={e => setLanguage(e.target.value)} disabled={active} placeholder="en" /></Field> : isTranscription ? <Notice>麦克风音频以 24 kHz PCM 发送。每说完一段，点击「提交当前语音段」获取最终转写。</Notice> : <Field label="声音"><select value={voice} onChange={e => setVoice(e.target.value)} disabled={active}>{['marin','cedar','alloy','ash','ballad','coral','echo','sage','shimmer','verse'].map(v => <option key={v}>{v}</option>)}</select></Field>}{!isTranscription && !isTranslation && <Field label="对话指令"><textarea rows={5} value={instructions} onChange={e => setInstructions(e.target.value)} disabled={active} /></Field>}<AdvancedJson value={advanced} onChange={setAdvanced} label="会话配置 JSON" hint="与 session 对象合并。嵌套字段会整体覆盖；可配置 VAD、工具、MCP 或转写语言等官方参数。连接前生效。" /><DocsLink path={isLive ? 'guides/live' : isTranslation ? 'guides/realtime-translation' : isTranscription ? 'guides/realtime-transcription' : 'guides/realtime'} /><p className="field-hint">离开此栏目将结束当前连接。语音由 AI 生成。</p></aside><div className="realtime-main panel">{error && <Notice kind="error">{error}</Notice>}<div className={'voice-stage ' + (status === 'connected' ? 'live' : '')}><span className="eyebrow">{isLive ? 'GPT LIVE' : isTranslation ? 'LIVE TRANSLATION' : isTranscription ? 'LIVE TRANSCRIPTION' : 'REALTIME CONVERSATION'}</span><div className="voice-orb"><AudioLines size={58} strokeWidth={1.2} /></div><h2>{status === 'connecting' ? '正在连接你的声音…' : status === 'closing' ? '正在结束会话…' : status === 'connected' ? '我在听，请说。' : '让对话，自然发生。'}</h2><p>{status === 'connected' ? `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')} · ${model}` : '点击开始，授权麦克风，和模型实时交流。'}</p><div className="voice-actions">{active ? <><button className="button secondary" disabled={status !== 'connected'} onClick={() => { resources.current.mic?.getAudioTracks().forEach(t => t.enabled = muted); setMuted(!muted) }}>{muted ? <MicOff size={17} /> : <Mic size={17} />}{muted ? '取消静音' : '静音'}</button><button className="button danger" disabled={status === 'closing'} onClick={end}><PhoneOff size={17} />结束连接</button></> : <button className="button primary" onClick={() => void start()}><Phone size={17} />开始实时语音</button>}</div>{isTranscription && status === 'connected' && <button className="button secondary" onClick={() => { try { resources.current.recorder?.port.postMessage({ type: 'commit' }) } catch (e) { setError((e as Error).message) } }}>提交当前语音段</button>}<audio ref={audio} controls autoPlay className="voice-player" />{sessionId && <small className="muted">{sessionId}</small>}</div><div className="live-transcript"><div className="section-heading"><h3>实时转录与事件</h3><button className="icon-button" title="下载会话事件" onClick={() => downloadText(JSON.stringify(events,null,2),'openai-realtime-events.json')}><Download size={15} /></button></div><pre>{transcript || '连接后，转录文本和模型事件将在这里显示。'}</pre><details className="raw-response"><summary>原始事件 <span>{events.length}</span></summary><pre>{events.map(e => JSON.stringify(e)).join('\n')}</pre></details><details className="advanced"><summary>发送自定义事件（工具结果 / 会话更新）</summary><textarea className="code-input" rows={4} aria-label="自定义实时事件" value={customEvent} onChange={e => setCustomEvent(e.target.value)} /><button className="button secondary small" disabled={status !== 'connected'} onClick={() => { try { sendEvent(parseObject(customEvent,'事件')); toast.success('事件已发送') } catch (e) { setError((e as Error).message) } }}><Send size={13} />发送事件</button></details></div></div></div>
}
