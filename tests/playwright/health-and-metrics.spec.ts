import { test, expect } from '@playwright/test'

test.describe('Health and Metrics', () => {
  test('GET /api/health returns 200 and redis status (if configured)', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
  })

  test('GET /api/ai-metrics requires auth and returns metrics', async ({ request }) => {
    // expect the env to provide AI_METRICS_API_KEY in CI
    const apiKey = process.env.AI_METRICS_API_KEY
    test.skip(!apiKey, 'AI_METRICS_API_KEY not set in environment')

    const headers = { Authorization: `Bearer ${apiKey}` }
    const res = await request.get('http://localhost:3000/api/ai-metrics', { headers })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
    expect(body).toHaveProperty('metrics')
  })
})
