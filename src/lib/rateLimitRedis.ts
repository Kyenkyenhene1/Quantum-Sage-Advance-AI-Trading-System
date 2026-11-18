import { getRedis } from './redisClient'

// token bucket implemented with Redis using INCR and EXPIRE
export async function rateLimitRedis(key: string, limit = 60, perSeconds = 60) {
  const r = getRedis()
  if (!r) throw new Error('REDIS_URL not configured')
  const redisKey = `ratelimit:${key}`
  try {
    const cur = await r.incr(redisKey)
    if (cur === 1) {
      await r.expire(redisKey, perSeconds)
    }
    const remaining = Math.max(0, limit - cur)
    return { allowed: cur <= limit, remaining }
  } catch (e) {
    try { console.warn('rateLimitRedis failed', (e as any)?.message ?? e) } catch {}
    // bubble up so callers can handle fallback
    throw e
  }
}
