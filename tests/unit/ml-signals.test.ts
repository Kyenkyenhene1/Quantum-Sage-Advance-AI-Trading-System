import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../src/pages/api/ml-signals'
import { getExecutionIdentity } from '@/lib/auth'
import { logExecution, readAuditLines } from '@/lib/audit'

vi.mock('@/lib/auth', () => ({
  getExecutionIdentity: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logExecution: vi.fn(),
  readAuditLines: vi.fn(),
}))

function makeReq(method: string, body?: unknown, query: Record<string, string> = {}) {
  return {
    method,
    body,
    query,
    headers: {},
    cookies: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as any
}

function makeRes() {
  const headers: Record<string, string> = {}
  const res: any = { statusCode: 200, _body: null, headers }
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (value: unknown) => { res._body = value; return res }
  res.send = (value: unknown) => { res._body = value; return res }
  res.setHeader = (key: string, value: string) => { headers[key] = value }
  return res
}

const originalKey = process.env.SERVER_SIDE_API_KEY
const originalAccountId = process.env.TRADING_ACCOUNT_ID

afterEach(() => {
  vi.clearAllMocks()
  if (originalKey === undefined) delete process.env.SERVER_SIDE_API_KEY
  else process.env.SERVER_SIDE_API_KEY = originalKey
  if (originalAccountId === undefined) delete process.env.TRADING_ACCOUNT_ID
  else process.env.TRADING_ACCOUNT_ID = originalAccountId
})

describe('ML signal journal endpoint', () => {
  it('requires configured execution identity before logging signals', async () => {
    vi.mocked(getExecutionIdentity).mockReturnValue({ ok: false, reason: 'unauthorized' })
    const res = makeRes()
    await handler(makeReq('POST', {}), res)
    expect(res.statusCode).toBe(401)
    expect(logExecution).not.toHaveBeenCalled()
  })

  it('persists validated model outputs with server-derived account identity', async () => {
    vi.mocked(getExecutionIdentity).mockReturnValue({ ok: true, accountId: 'trusted-account' })
    vi.mocked(logExecution).mockResolvedValue(true)
    const res = makeRes()
    await handler(makeReq('POST', {
      signalId: 'prediction-001',
      modelId: 'gold-direction-model',
      modelVersion: '2026-11-17',
      symbol: 'GOLD',
      timeframe: 'H1',
      signal: 'Buy',
      confidence: 72,
      signalTime: '2026-11-17T10:00:00Z',
      trainingDataThrough: '2026-10-31T23:59:59Z',
      featureSnapshot: { rsi: 54.2, atr: 16.7 },
    }), res)

    expect(res.statusCode).toBe(201)
    expect(logExecution).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'trusted-account',
      action: 'ml-model-signal',
      status: 'attempt',
      payload: expect.objectContaining({ signalId: 'prediction-001' }),
    }))
  })

  it('rejects signals dated before the model training cutoff', async () => {
    vi.mocked(getExecutionIdentity).mockReturnValue({ ok: true, accountId: 'trusted-account' })
    const res = makeRes()
    await handler(makeReq('POST', {
      signalId: 'prediction-leak',
      modelId: 'gold-direction-model',
      modelVersion: '2026-11-17',
      symbol: 'GOLD',
      timeframe: 'H1',
      signal: 'Sell',
      confidence: 66,
      signalTime: '2026-10-01T10:00:00Z',
      trainingDataThrough: '2026-10-31T23:59:59Z',
    }), res)

    expect(res.statusCode).toBe(400)
    expect(logExecution).not.toHaveBeenCalled()
  })

  it('exports only the authenticated account signal records as CSV', async () => {
    vi.mocked(getExecutionIdentity).mockReturnValue({ ok: true, accountId: 'trusted-account' })
    vi.mocked(readAuditLines).mockResolvedValue([
      {
        accountId: 'other-account',
        action: 'ml-model-signal',
        timestamp: '2026-11-17T10:00:01Z',
        payload: { signalId: 'other', modelVersion: 'v1', symbol: 'GOLD' },
      },
      {
        accountId: 'trusted-account',
        action: 'ml-model-signal',
        timestamp: '2026-11-17T10:00:02Z',
        payload: {
          signalId: 'one',
          receivedAt: '2026-11-17T10:00:02Z',
          signalTime: '2026-11-17T10:00:00Z',
          trainingDataThrough: '2026-10-31T23:59:59Z',
          modelId: 'gold-model',
          modelVersion: 'v1',
          symbol: 'GOLD',
          timeframe: 'H1',
          signal: 'Buy',
          confidence: 75,
        },
      },
    ] as any)
    const res = makeRes()
    await handler(makeReq('GET'), res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toContain('text/csv')
    expect(res._body).toContain('"one"')
    expect(res._body).not.toContain('"other"')
  })

  it('escapes spreadsheet formula prefixes in exported strings', async () => {
    vi.mocked(getExecutionIdentity).mockReturnValue({ ok: true, accountId: 'trusted-account' })
    vi.mocked(readAuditLines).mockResolvedValue([{
      accountId: 'trusted-account',
      action: 'ml-model-signal',
      timestamp: '2026-11-17T10:00:02Z',
      payload: {
        signalId: '=HYPERLINK("https://example.invalid")',
        receivedAt: '2026-11-17T10:00:02Z',
        signalTime: '2026-11-17T10:00:00Z',
        trainingDataThrough: '2026-10-31T23:59:59Z',
        modelId: 'model',
        modelVersion: 'v1',
        symbol: 'GOLD',
        timeframe: 'H1',
        signal: 'Buy',
        confidence: 75,
      },
    }] as any)
    const res = makeRes()
    await handler(makeReq('GET'), res)
    expect(res._body).toContain(`"'=HYPERLINK(""https://example.invalid"")"`)
  })
})
