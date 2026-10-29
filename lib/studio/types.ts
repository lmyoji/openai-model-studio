export interface ModelInfo {
  id: string
  name: string
  description: string
  url: string
  modelType: string
  snapshot: string
  snapshots: string[]
  input: string[]
  output: string[]
  endpoints: string[]
  features: string[]
  tools: string[]
  context: string
  maxOutput: string
  reasoningEfforts: string[]
  deprecated: boolean
  sourceVerified: boolean
  shutdownDate?: string
  replacement?: string
  restricted?: boolean
  accountAvailable?: boolean
  undocumented?: boolean
}

export interface SessionStatus {
  configured: boolean
  maskedKey?: string
  baseUrl?: string
  organization?: string
  project?: string
  expiresAt?: number
}

export interface AccountModel {
  id: string
  owned_by?: string
  shutdown_date?: string | null
}

export interface Attachment {
  id: string
  name: string
  mime: string
  data: string
  size: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachments?: Attachment[]
  model?: string
  status?: 'complete' | 'streaming' | 'interrupted' | 'error'
  responseId?: string
  usage?: Record<string, unknown>
}

export interface Conversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

export interface RequestLog {
  id: string
  time: number
  section: string
  path: string
  model?: string
  status: number
  duration: number
  requestId?: string
  usage?: Record<string, unknown>
  error?: string
}

export interface ResultData {
  json?: unknown
  text?: string
  url?: string
  mime?: string
  filename?: string
  requestId?: string
  status?: number
}
