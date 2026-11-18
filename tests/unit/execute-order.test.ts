import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../src/pages/api/execute-order'

function makeReq(body: any, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    body,
    headers,
    query: {},
    cookies: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as any
}

function makeRes() {
  const res: any = {}
  res.statusCode = 200
  res._body = null
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (payload: any) => { res._body = payload; return res }
  res.setHeader = () => {}
  return res
}

const originalEnv = {
  apiKey: process.env.SERVER_SIDE_API_KEY,
  accountId: process.env.TRADING_ACCOUNT_ID,
  executorUrl: process.env.ORDER_EXECUTOR_URL,
  executorKey: process.env.ORDER_EXECUTOR_API_KEY,
}
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalEnv.apiKey === undefined) delete process.env.SERVER_SIDE_API_KEY
  else process.env.SERVER_SIDE_API_KEY = originalEnv.apiKey
  if (originalEnv.accountId === undefined) delete process.env.TRADING_ACCOUNT_ID
  else process.env.TRADING_ACCOUNT_ID = originalEnv.accountId
  if (originalEnv.executorUrl === undefined) delete process.env.ORDER_EXECUTOR_URL
  else process.env.ORDER_EXECUTOR_URL = originalEnv.executorUrl
  if (originalEnv.executorKey === undefined) delete process.env.ORDER_EXECUTOR_API_KEY
  else process.env.ORDER_EXECUTOR_API_KEY = originalEnv.executorKey
})

function validOrder() {
  return {
    pair: 'EURUSD',
    direction: 'Buy',
    entryPrice: 1.1,
    accountBalance: 10000,
    pipValuePerLot: 10,
    stopLossPips: 50,
    baseLots: 0.1,
    totalLots: 0.1,
    layers: [{ index: 0, lots: 0.1, priceOffsetPips: 0, riskAmount: 50 }],
  }
}

describe('execute-order handler', () => {
  it('fails closed when execution authentication is not configured', async () => {
    delete process.env.SERVER_SIDE_API_KEY
    process.env.TRADING_ACCOUNT_ID = 'account-1'
    const res = makeRes()
    await handler(makeReq(validOrder()), res)
    expect(res.statusCode).toBe(503)
    expect(res._body.error).toBe('Execution authentication is not configured')
  })

  it('requires an authenticated caller', async () => {
    process.env.SERVER_SIDE_API_KEY = 'server-key-that-is-at-least-32-characters'
    process.env.TRADING_ACCOUNT_ID = 'account-1'
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as any

    const res = makeRes()
    await handler(makeReq(validOrder()), res)

    expect(res.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects caller-supplied account identity fields', async () => {
    process.env.SERVER_SIDE_API_KEY = 'server-key-that-is-at-least-32-characters'
    process.env.TRADING_ACCOUNT_ID = 'account-1'
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as any

    const res = makeRes()
    await handler(makeReq({ ...validOrder(), accountId: 'attacker-account' }, { 'x-api-key': 'server-key-that-is-at-least-32-characters' }), res)

    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recomputes aggregate risk before forwarding an order', async () => {
    process.env.SERVER_SIDE_API_KEY = 'server-key-that-is-at-least-32-characters'
    process.env.TRADING_ACCOUNT_ID = 'account-1'
    process.env.ORDER_EXECUTOR_URL = 'https://executor.example/exec'
    process.env.ORDER_EXECUTOR_API_KEY = 'executor-test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"executed":true}',
      headers: { get: () => 'application/json' },
    })
    globalThis.fetch = fetchMock as any
    const order = validOrder()
    order.layers[0].lots = 0.5

    const res = makeRes()
    await handler(makeReq(order, { 'x-api-key': 'server-key-that-is-at-least-32-characters' }), res)

    expect(res.statusCode).toBe(400)
    expect(res._body.error).toBe('Aggregate risk exceeds configured cap')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
