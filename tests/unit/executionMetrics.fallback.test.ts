import { describe, it, expect, beforeAll } from 'vitest'

// Ensure REDIS_URL is not set for fallback test
delete process.env.REDIS_URL

let metrics: any
beforeAll(async () => {
  metrics = await import('../../src/lib/executionMetrics')
})

describe('executionMetrics in-memory fallback', () => {
  it('uses fallback counters when REDIS_URL unset', async () => {
    const account = `fb-${Date.now()}`
    const before = await metrics.getDailyExecutionCount(account)
    expect(before).toBe(0)
    const v1 = await metrics.recordExecutionAttempt(account)
    expect(v1).toBeGreaterThanOrEqual(1)
    const v2 = await metrics.getDailyExecutionCount(account)
    expect(v2).toBe(v1)
  })

  it('atomically enforces the daily slot limit in memory', async () => {
    const account = `limit-${Date.now()}`
    expect(await metrics.tryReserveDailyExecutionSlot(account, 1)).toBe(true)
    expect(await metrics.tryReserveDailyExecutionSlot(account, 1)).toBe(false)
    expect(await metrics.getDailyExecutionCount(account)).toBe(1)
  })
})
