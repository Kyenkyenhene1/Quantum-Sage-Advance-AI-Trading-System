import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { getExecutionIdentity } from '@/lib/auth'
import { logExecution, readAuditLines } from '@/lib/audit'
import initServerSentry from '@/lib/sentry.server'
import Sentry from '@/lib/sentry.server'

const SignalSchema = z.object({
  signalId: z.string().min(1).max(128),
  modelId: z.string().min(1).max(80),
  modelVersion: z.string().min(1).max(80),
  symbol: z.string().regex(/^[A-Za-z0-9._-]{3,20}$/),
  timeframe: z.string().regex(/^[MHDW]\d{1,2}$/),
  signal: z.enum(['Buy', 'Sell', 'Hold']),
  confidence: z.number().finite().min(0).max(100),
  signalTime: z.string().datetime({ offset: true }),
  trainingDataThrough: z.string().datetime({ offset: true }),
  entryPrice: z.number().finite().positive().optional(),
  featureHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  featureSnapshot: z.record(z.number().finite()).optional(),
}).strict().superRefine((signal, ctx) => {
  if (signal.featureSnapshot && Object.keys(signal.featureSnapshot).length > 128) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['featureSnapshot'],
      message: 'A feature snapshot may contain at most 128 numeric values',
    })
  }
})

function csvCell(value: unknown): string {
  let text = value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

function getSingleQueryValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initServerSentry()
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const identity = getExecutionIdentity(req)
  if (!identity.ok) {
    const configurationError = identity.reason !== 'unauthorized'
    res.status(configurationError ? 503 : 401).json({
      ok: false,
      error: identity.reason === 'account-not-configured'
        ? 'Trading account is not configured'
        : identity.reason === 'execution-auth-not-configured'
          ? 'Execution authentication is not configured'
          : 'Unauthorized',
    })
    return
  }

  if (req.method === 'POST') {
    const parsed = SignalSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid model signal', details: parsed.error.format() })
      return
    }

    const receivedAt = new Date().toISOString()
    if (
      Date.parse(parsed.data.signalTime) > Date.now() ||
      Date.parse(parsed.data.trainingDataThrough) >= Date.parse(parsed.data.signalTime)
    ) {
      res.status(400).json({
        ok: false,
        error: 'signalTime must be current and later than trainingDataThrough',
      })
      return
    }

    try {
      const logged = await logExecution({
        timestamp: receivedAt,
        accountId: identity.accountId,
        action: 'ml-model-signal',
        status: 'attempt',
        payload: {
          ...parsed.data,
          receivedAt,
        },
      })
      if (!logged) {
        Sentry.captureMessage('Could not persist ML model signal')
        res.status(503).json({ ok: false, error: 'Could not persist model signal' })
        return
      }

      res.status(201).json({ ok: true, signalId: parsed.data.signalId, receivedAt })
    } catch (error) {
      Sentry.captureException(error)
      res.status(500).json({ ok: false, error: 'Could not persist model signal' })
    }
    return
  }

  const rawLimit = getSingleQueryValue(req.query.limit) || '10000'
  const limit = Number.parseInt(rawLimit, 10)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50000) {
    res.status(400).json({ ok: false, error: 'limit must be an integer from 1 to 50000' })
    return
  }

  try {
    const modelVersion = getSingleQueryValue(req.query.modelVersion)
    const symbol = getSingleQueryValue(req.query.symbol)
    const auditEntries = await readAuditLines(limit)
    const signalEntries = auditEntries
      .filter(entry =>
        entry.action === 'ml-model-signal' &&
        entry.accountId === identity.accountId &&
        entry.payload &&
        (!modelVersion || entry.payload.modelVersion === modelVersion) &&
        (!symbol || entry.payload.symbol === symbol),
      )
      .sort((first, second) =>
        Date.parse(first.payload.receivedAt || first.timestamp) -
        Date.parse(second.payload.receivedAt || second.timestamp),
      )

    const columns = [
      'signalId',
      'receivedAt',
      'signalTime',
      'trainingDataThrough',
      'accountId',
      'modelId',
      'modelVersion',
      'symbol',
      'timeframe',
      'signal',
      'confidence',
      'entryPrice',
      'featureHash',
      'featureSnapshot',
    ]
    const rows = signalEntries.map(entry => {
      const payload = entry.payload as z.infer<typeof SignalSchema> & { receivedAt?: string }
      return [
        payload.signalId,
        payload.receivedAt || entry.timestamp,
        payload.signalTime,
        payload.trainingDataThrough,
        entry.accountId,
        payload.modelId,
        payload.modelVersion,
        payload.symbol,
        payload.timeframe,
        payload.signal,
        payload.confidence,
        payload.entryPrice,
        payload.featureHash,
        payload.featureSnapshot,
      ].map(csvCell).join(',')
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="ml-signal-journal.csv"')
    res.status(200).send([columns.join(','), ...rows].join('\r\n'))
  } catch (error) {
    Sentry.captureException(error)
    res.status(500).json({ ok: false, error: 'Could not export model signals' })
  }
}
