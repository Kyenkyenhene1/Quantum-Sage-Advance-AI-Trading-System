import { describe, it, expect } from 'vitest'
import placeOrderHandler from '../../src/pages/api/place-order'

function makeReq(method: string, body: any = {}) {
  return {
    method,
    body,
    headers: {},
    query: {},
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
  res.send = (payload: any) => { res._body = payload; return res }
  return res
}

describe('place-order API handler', () => {
  it('returns 405 for non-POST', async () => {
    const req = makeReq('GET')
    const res = makeRes()
    await placeOrderHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res._body.ok).toBe(false)
  })

  it('validates input and returns proposed sizing', async () => {
    const req = makeReq('POST', {
      pair: 'EURUSD', direction: 'Buy', entryPrice: 1.1,
      accountBalance: 10000, stopLossPips: 50, pipValuePerLot: 10,
    })
    const res = makeRes()
    await placeOrderHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._body.ok).toBe(true)
    expect(res._body.baseLots).toBeGreaterThan(0)
    expect(Array.isArray(res._body.layers)).toBe(true)
  })

  it('keeps layered proposal risk within the configured aggregate cap', async () => {
    const req = makeReq('POST', {
      pair: 'EURUSD',
      direction: 'Buy',
      entryPrice: 1.1,
      accountBalance: 10000,
      stopLossPips: 50,
      pipValuePerLot: 10,
      riskPerTradePct: 1,
      layerConfig: { layers: 5, spacingPips: 25 },
    })
    const res = makeRes()
    await placeOrderHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._body.totalRisk).toBeLessThanOrEqual(200)
  })

  it('rejects invalid numeric order input', async () => {
    const req = makeReq('POST', {
      pair: 'EURUSD',
      direction: 'Buy',
      entryPrice: 1.1,
      accountBalance: -1,
      stopLossPips: 50,
      pipValuePerLot: 10,
    })
    const res = makeRes()
    await placeOrderHandler(req, res)
    expect(res.statusCode).toBe(400)
  })
})
