import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Ensure REDIS_URL is set before importing the module
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let metrics: any

beforeAll(async () => {
  metrics = await import('../../src/lib/executionMetrics')
})

afterAll(async () => {
  try {
    if (metrics && metrics.resetDailyCounts) await metrics.resetDailyCounts()
  } catch (e) {
    // ignore
  }
})

describe('executionMetrics Redis integration', () => {
  it('increments and reads daily counters', async () => {
    const account = `test-redis-${Date.now()}`
    const before = await metrics.getDailyExecutionCount(account)
    expect(before).toBe(0)

    const v1 = await metrics.recordExecutionAttempt(account)
    expect(v1).toBeGreaterThanOrEqual(1)

    const v2 = await metrics.getDailyExecutionCount(account)
    expect(v2).toBeGreaterThanOrEqual(1)
    expect(v2).toBe(v1)

    const v3 = await metrics.recordExecutionAttempt(account)
    expect(v3).toBe(v2 + 1)
  })
})
