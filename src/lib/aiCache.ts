type CacheEntry<T> = { value: T; expiresAt: number }

const store = new Map<string, CacheEntry<any>>()

export function aiCacheGet<T>(key: string): T | undefined {
  const e = store.get(key)
  if (!e) return undefined
  if (Date.now() > e.expiresAt) {
    store.delete(key)
    return undefined
  }
  return e.value as T
}

export function aiCacheSet<T>(key: string, value: T, ttlMs = 1000 * 60 * 5) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function aiCacheClear() {
  store.clear()
}

// Note: This in-memory cache is suitable for single-instance development.
// For production, replace with Redis or another distributed cache and
// provide an adapter implementing the same API.
import { aiCacheGetRedis, aiCacheSetRedis, aiCacheClearRedis } from './aiCacheRedis'

export async function aiCacheGetAuto<T>(key: string): Promise<T | undefined> {
  if (process.env.REDIS_URL) {
    try {
      return await aiCacheGetRedis<T>(key)
    } catch (e) {
      try { console.warn('aiCacheGetAuto: redis get failed, falling back to memory', (e as any)?.message ?? e) } catch {}
      return aiCacheGet<T>(key)
    }
  }
  return Promise.resolve(aiCacheGet<T>(key))
}

export async function aiCacheSetAuto<T>(key: string, value: T, ttlMs = 1000 * 60 * 5) {
  if (process.env.REDIS_URL) {
    try {
      return await aiCacheSetRedis<T>(key, value, ttlMs)
    } catch (e) {
      try { console.warn('aiCacheSetAuto: redis set failed, falling back to memory', (e as any)?.message ?? e) } catch {}
      return aiCacheSet<T>(key, value, ttlMs)
    }
  }
  return Promise.resolve(aiCacheSet<T>(key, value, ttlMs))
}

export async function aiCacheClearAuto() {
  if (process.env.REDIS_URL) {
    try {
      return await aiCacheClearRedis()
    } catch (e) {
      try { console.warn('aiCacheClearAuto: redis clear failed, falling back to memory', (e as any)?.message ?? e) } catch {}
      return aiCacheClear()
    }
  }
  return Promise.resolve(aiCacheClear())
}
