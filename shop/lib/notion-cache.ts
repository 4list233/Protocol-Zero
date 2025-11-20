interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()
const TTL = (parseInt(process.env.NOTION_CACHE_TTL_SECONDS || '120') || 120) * 1000

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  const age = Date.now() - entry.timestamp
  if (age > TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}
