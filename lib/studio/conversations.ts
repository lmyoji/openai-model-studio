import type { Conversation } from './types'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('openai-studio', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('conversations', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readConversations(): Promise<Conversation[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('conversations').objectStore('conversations').getAll()
      request.onsuccess = () => resolve((request.result as Conversation[]).sort((a,b) => b.updatedAt-a.updatedAt))
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

export async function writeConversations(conversations: Conversation[]) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite')
      const store = tx.objectStore('conversations')
      store.clear()
      for (const c of conversations.slice(0, 30)) store.put(c)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
