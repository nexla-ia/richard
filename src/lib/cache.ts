// Cache em memória com TTL — evita re-fetch ao trocar de página
const store = new Map<string, { data: unknown; ts: number }>()
const TTL = 30_000 // 30 segundos

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { store.delete(key); return null }
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T): T {
  store.set(key, { data, ts: Date.now() })
  return data
}

export function cacheInvalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
