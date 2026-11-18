import { getRedis } from './redisClient'

function client() {
  const r = getRedis()
  if (!r) throw new Error('REDIS_URL not configured')
  return r
}

export async function aiCacheGetRedis<T>(key: string): Promise<T | undefined> {
  const r = client()
  const v = await r.get(key)
  if (!v) return undefined
  try {
    return JSON.parse(v) as T
  } catch (err) {
    return undefined
  }
}

export async function aiCacheSetRedis<T>(key: string, value: T, ttlMs = 1000 * 60 * 5) {
  const r = client()
  const ttlSec = Math.ceil(ttlMs / 1000)
  await r.set(key, JSON.stringify(value), 'EX', ttlSec)
}

export async function aiCacheClearRedis() {
  const r = client()
  await r.flushdb()
}
