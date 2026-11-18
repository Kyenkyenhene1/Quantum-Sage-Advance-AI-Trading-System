import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../../src/pages/api/signal-execute'

function makeReq(body: any = {}) {
  return { method: 'POST', body, headers: {}, query: {}, socket: { remoteAddress: '127.0.0.1' } } as any
}

function makeRes() {
  const res: any = {}
  res.statusCode = 200
  res._body = null
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (payload: any) => { res._body = payload; return res }
  res.setHeader = () => {}
  res.send = (payload: any) => { res._body = payload; return res }
  return res
}

describe('signal-execute handler', () => {
  const OLD_FETCH = globalThis.fetch
  const OLD_ENV = {
    apiKey: process.env.SERVER_SIDE_API_KEY,
    accountId: process.env.TRADING_ACCOUNT_ID,
    executorUrl: process.env.ORDER_EXECUTOR_URL,
    executorKey: process.env.ORDER_EXECUTOR_API_KEY,
  }

  beforeEach(() => {
    // mock fetch to executor
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ executed: true }), headers: { get: () => 'application/json' } }) as any
    process.env.SERVER_SIDE_API_KEY = 'test-server-side-key-that-is-at-least-32-chars'
    process.env.TRADING_ACCOUNT_ID = 'test-account'
  })

  afterEach(() => {
    globalThis.fetch = OLD_FETCH
    if (OLD_ENV.apiKey === undefined) delete process.env.SERVER_SIDE_API_KEY
    else process.env.SERVER_SIDE_API_KEY = OLD_ENV.apiKey
    if (OLD_ENV.accountId === undefined) delete process.env.TRADING_ACCOUNT_ID
    else process.env.TRADING_ACCOUNT_ID = OLD_ENV.accountId
    if (OLD_ENV.executorUrl === undefined) delete process.env.ORDER_EXECUTOR_URL
    else process.env.ORDER_EXECUTOR_URL = OLD_ENV.executorUrl
    if (OLD_ENV.executorKey === undefined) delete process.env.ORDER_EXECUTOR_API_KEY
    else process.env.ORDER_EXECUTOR_API_KEY = OLD_ENV.executorKey
  })

  it('returns computed sizing and enforces 5 layers', async () => {
    const req = makeReq({ pair: 'EURUSD', direction: 'Buy', entryPrice: 1.1, accountBalance: 10000, stopLossPips: 50, pipValuePerLot: 10, confidence: 90, autoExecute: false })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._body.ok).toBe(true)
    expect(res._body.layers.length).toBeGreaterThanOrEqual(5)
  })

  it('attempts execution when confidence >= threshold and autoExecute true', async () => {
    const req = makeReq({ pair: 'EURUSD', direction: 'Buy', entryPrice: 1.1, accountBalance: 10000, stopLossPips: 50, pipValuePerLot: 10, confidence: 95, confidenceThreshold: 80, autoExecute: true })
    req.headers['x-api-key'] = 'test-server-side-key-that-is-at-least-32-chars'
    const res = makeRes()
    process.env.ORDER_EXECUTOR_URL = 'https://executor.example/exec'
    process.env.ORDER_EXECUTOR_API_KEY = 'testkey'
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._body.ok).toBe(true)
    expect(res._body.executeResult).toBeDefined()
  })

  it('rejects unauthenticated auto-execution', async () => {
    const req = makeReq({ pair: 'EURUSD', direction: 'Buy', entryPrice: 1.1, accountBalance: 10000, stopLossPips: 50, pipValuePerLot: 10, confidence: 95, autoExecute: true })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res._body.error).toBe('Unauthorized')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('halts at the consecutive-loss limit', async () => {
    const req = makeReq({
      pair: 'EURUSD',
      direction: 'Buy',
      entryPrice: 1.1,
      accountBalance: 10000,
      stopLossPips: 50,
      pipValuePerLot: 10,
      confidence: 90,
      consecutiveLosses: 3,
    })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res._body.drawdownState.isConsecutiveLossLimitBreached).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('caps aggregate layered risk at the configured maximum', async () => {
    const req = makeReq({
      pair: 'EURUSD',
      direction: 'Buy',
      entryPrice: 1.1,
      accountBalance: 10000,
      stopLossPips: 50,
      pipValuePerLot: 10,
      confidence: 90,
      layerConfig: { layers: 5 },
    })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._body.totalRisk).toBeLessThanOrEqual(200)
  })
})
