import { fetch as undiciFetch, ProxyAgent } from 'undici'

const agents = new Map<string, ProxyAgent>()

function agentFor(proxyUrl: string) {
  let agent = agents.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    agents.set(proxyUrl, agent)
  }
  return agent
}

function proxyUrls(value?: string) {
  const list = (value || 'http://127.0.0.1:7892,http://127.0.0.1:7897')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return list.length ? list : ['http://127.0.0.1:7892', 'http://127.0.0.1:7897']
}

/** Outbound fetch for OpenAI. Tries each OPENAI_STUDIO_PROXY (7892, then 7897). */
export function createOutboundFetch(proxyUrl?: string): typeof fetch {
  const urls = proxyUrls(proxyUrl)
  const outbound = async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastError: unknown
    for (const url of urls) {
      try {
        return await undiciFetch(input as Parameters<typeof undiciFetch>[0], {
          ...(init as Record<string, unknown>),
          dispatcher: agentFor(url),
        }) as unknown as Response
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
  return outbound as typeof fetch
}
