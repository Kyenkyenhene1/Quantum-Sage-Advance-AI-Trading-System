type Bucket = { tokens: number; last: number }

const buckets = new Map<string, Bucket>()

import { rateLimitRedis } from './rateLimitRedis'

export async function rateLimit(key: string, limit = 60, perSeconds = 60) {
  if (process.env.REDIS_URL) {
    try {
      return await rateLimitRedis(key, limit, perSeconds)
    } catch (e) {
      try { console.warn('rateLimit: redis call failed, falling back to in-memory', (e as any)?.message ?? e) } catch {}
      // continue to in-memory fallback
    }
  }

  const now = Date.now()
  const bucket = buckets.get(key) || { tokens: limit, last: now }
  const elapsed = (now - bucket.last) / 1000
  // refill as a float for smoother behavior
  const refill = elapsed * (limit / perSeconds)
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill)
    bucket.last = now
  }

  if (bucket.tokens < 1) {
    buckets.set(key, bucket)
    return { allowed: false, remaining: Math.max(0, Math.floor(bucket.tokens)) }
  }
  // consume a token
  bucket.tokens = bucket.tokens - 1
  bucket.last = now
  buckets.set(key, bucket)
  return { allowed: true, remaining: Math.floor(bucket.tokens) }
}
