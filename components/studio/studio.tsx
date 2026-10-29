'use client'
import { useEffect, useState } from 'react'
import { ArrowUpRight, AudioLines, BookOpen, Boxes, ChevronRight, ExternalLink, FileAudio, Film, FolderOpen, Headphones, History, Image, KeyRound, Layers, LayoutGrid, Menu, MessageSquare, Radio, Settings2, ShieldCheck, Sparkles, SquareTerminal, Waypoints } from 'lucide-react'
import { SECTIONS, type SectionId } from '@/lib/studio/catalog'
import { loadLocal } from '@/lib/studio/client'
import { StudioProvider, useStudio } from './context'
import { PageIntro } from './shared'
import { ChatPanel } from './chat-panel'
import { AudioPanel, EmbeddingsPanel, ImagesPanel, ModerationPanel, SpeechPanel, TranscribePanel } from './media-panels'
import { RealtimePanel } from './realtime-panel'
import { ApiWorkbench, BatchPanel, VideosPanel } from './api-panels'
import { HistoryPanel, ModelsPanel, OverviewPanel, SettingsPanel } from './management-panels'
const ICONS = { LayoutGrid, MessageSquare, Image, AudioLines, FileAudio, Headphones, Radio, Waypoints, ShieldCheck, Film, FolderOpen, Layers, Boxes, SquareTerminal, History, Settings2 }
const EYEBROWS: Record<string,string> = {chat:'THINK, CREATE, EXPLORE',images:'FROM WORDS TO WORLDS',speech:'GIVE YOUR WORDS A VOICE',transcribe:'EVERY WORD, CAPTURED',audio:'A CONVERSATION YOU CAN HEAR',realtime:'A MORE NATURAL CONVERSATION',embeddings:'FIND THE CONNECTIONS',moderation:'BUILD WITH CONFIDENCE',videos:'VIDEO API ARCHIVE',files:'YOUR KNOWLEDGE, CONNECTED',batch:'DO MORE, AT SCALE',models:'A MODEL FOR EVERY IDEA',api:'YOUR API PLAYGROUND',history:'EVERY REQUEST, IN VIEW',settings:'ONE KEY. ALL YOUR MODELS.'}
export function Studio() { return <StudioProvider><StudioShell /></StudioProvider> }
function StudioShell() {
  const {section,navigate,session} = useStudio()
  const [menuOpen,setMenuOpen] = useState(false)
  const current = SECTIONS.find(s=>s.id===section) || SECTIONS[0]
  useEffect(()=>{document.documentElement.dataset.theme=loadLocal('studio.theme','light')},[])
  function go(id:SectionId){navigate(id);setMenuOpen(false)}
  const renderNav=(ids:SectionId[])=>ids.map(id=>{const item=SECTIONS.find(s=>s.id===id)!;const Icon=ICONS[item.icon];return <button key={id} className={'nav-item '+(section===id?'active':'')} aria-current={section===id?'page':undefined} title={item.label} onClick={()=>go(id)}><Icon size={17} strokeWidth={1.65}/><span>{item.label}</span>{section===id&&<i/>}{id==='videos'&&<small>归档</small>}</button>})
  return <div className="studio-shell">{menuOpen&&<button aria-label="关闭导航遮罩" className="menu-backdrop" onClick={()=>setMenuOpen(false)}/>}<aside className={'sidebar '+(menuOpen?'open':'')}><button className="brand" onClick={()=>go('overview')}><span className="brand-symbol"><Sparkles size={24} strokeWidth={1.6}/></span><span className="brand-name">OpenAI<span>STUDIO</span></span><span className="brand-version">01</span></button><div className="workspace-label"><span className="workspace-avatar">S</span><div><strong>个人工作空间</strong><span>Personal workspace</span></div><ChevronRight size={14}/></div><nav><div className="nav-group">{renderNav(['overview'])}</div><div className="nav-group"><p>创作与探索</p>{renderNav(['chat','images','speech','transcribe','audio','realtime','embeddings','moderation','videos'])}</div><div className="nav-group"><p>开发与管理</p>{renderNav(['files','batch','models','api','history'])}</div></nav><div className="sidebar-bottom"><button className={'key-card '+(session.configured?'configured':'')} onClick={()=>go('settings')}><KeyRound size={17}/><span><strong>{session.configured?'API 已连接':'连接你的 API'}</strong><small>{session.configured?session.maskedKey:'一个 Key，开启所有能力'}</small></span><ArrowUpRight size={14}/></button>{renderNav(['settings'])}<a className="nav-item docs-nav" href="https://developers.openai.com/api/docs" target="_blank" rel="noreferrer"><BookOpen size={17}/><span>官方文档</span><ExternalLink size={12}/></a><div className="sidebar-signature"><i/>OPENAI API WORKSPACE</div></div></aside><div className="app-main"><header className="topbar"><div className="breadcrumbs"><button className="icon-button menu-toggle" aria-label="打开导航" onClick={()=>setMenuOpen(!menuOpen)}><Menu size={19}/></button><span>工作空间</span><ChevronRight size={12}/><strong>{current.label}</strong></div><div className="topbar-actions"><a href="https://developers.openai.com/api/docs" target="_blank" rel="noreferrer">使用指南<ArrowUpRight size={13}/></a><span className="topbar-divider"/><button className="connection-pill" onClick={()=>go('settings')}><i className={'status-dot '+(session.configured?'on':'')}/>{session.configured?'API 已连接':'尚未连接 API'}<KeyRound size={12}/></button><span className="user-avatar">S</span></div></header><main className={'page-content section-'+section} key={section}>{section!=='overview'&&<PageIntro eyebrow={EYEBROWS[section]||'OPENAI STUDIO'} title={current.label} description={current.subtitle}/>}<SectionContent id={section}/></main></div></div>
}
function SectionContent({id}:{id:SectionId}) {
  switch(id) {
    case 'overview':return <OverviewPanel/>
    case 'chat':return <ChatPanel/>
    case 'images':return <ImagesPanel/>
    case 'speech':return <SpeechPanel/>
    case 'transcribe':return <TranscribePanel/>
    case 'audio':return <AudioPanel/>
    case 'realtime':return <RealtimePanel/>
    case 'embeddings':return <EmbeddingsPanel/>
    case 'moderation':return <ModerationPanel/>
    case 'videos':return <VideosPanel/>
    case 'files':return <ApiWorkbench group="文件与知识库"/>
    case 'batch':return <BatchPanel/>
    case 'models':return <ModelsPanel/>
    case 'api':return <ApiWorkbench/>
    case 'history':return <HistoryPanel/>
    case 'settings':return <SettingsPanel/>
  }
}
