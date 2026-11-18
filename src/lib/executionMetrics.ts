import { getRedis } from './redisClient'

const redis = getRedis()

function todayKey() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

/**
 * Increment per-account daily execution counter. Uses Redis INCR with expiry (48h).
 * Returns the new count for today.
 */
export async function recordExecutionAttempt(accountId = 'anonymous'): Promise<number> {
  const key = `exec:daily:${accountId}:${todayKey()}`
  if (redis) {
    try {
      const val = await redis.incr(key)
      // set TTL to 48 hours to auto-expire keys (only once)
      const ttl = await redis.ttl(key)
      if (ttl < 0) await redis.expire(key, 60 * 60 * 48)
      return Number(val)
    } catch (err) {
      // fallback to 0 on Redis errors
      // eslint-disable-next-line no-console
      console.warn('Redis recordExecutionAttempt failed, falling back', err)
      return 0
    }
  }
  // in-memory fallback
  // store under global (module-scoped) map
  ;(global as any)._exec_counts = (global as any)._exec_counts || {}
  const m = (global as any)._exec_counts
  const today = todayKey()
  const k = `${accountId}:${today}`
  m[k] = (m[k] || 0) + 1
  return m[k]
}

export async function tryReserveDailyExecutionSlot(accountId: string, maxDaily: number): Promise<boolean> {
  const key = `exec:daily:${accountId}:${todayKey()}`
  if (redis) {
    const script = `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      if current >= tonumber(ARGV[1]) then return 0 end
      local nextCount = redis.call('INCR', KEYS[1])
      if redis.call('TTL', KEYS[1]) < 0 then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      return nextCount
    `
    const count = await redis.eval(script, 1, key, maxDaily, 60 * 60 * 48)
    return Number(count) > 0
  }

  ;(global as any)._exec_counts = (global as any)._exec_counts || {}
  const m = (global as any)._exec_counts
  const today = todayKey()
  const k = `${accountId}:${today}`
  const current = m[k] || 0
  if (current >= maxDaily) return false
  m[k] = current + 1
  return true
}

export async function getDailyExecutionCount(accountId = 'anonymous'): Promise<number> {
  const key = `exec:daily:${accountId}:${todayKey()}`
  if (redis) {
    try {
      const v = await redis.get(key)
      return v ? parseInt(v, 10) : 0
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Redis getDailyExecutionCount failed, falling back', err)
      return 0
    }
  }
  const m = (global as any)._exec_counts || {}
  const today = todayKey()
  const k = `${accountId}:${today}`
  return m[k] || 0
}

export async function resetDailyCounts() {
  if (redis) {
    // best-effort: delete keys for today by pattern (may be slow in prod)
    try {
      const keys = await redis.keys(`exec:daily:*:${todayKey()}`)
      if (keys.length) await redis.del(...keys)
    } catch (err) {
      // ignore
    }
    return
  }
  (global as any)._exec_counts = {}
}

export async function recordExecutionResult(accountId = 'anonymous', ok = true) {
  // For now this mirrors recordExecutionAttempt on success; future: separate success/failure counters
  if (ok) return await getDailyExecutionCount(accountId)
  return await getDailyExecutionCount(accountId)
}
