import type { NextApiRequest, NextApiResponse } from 'next'
import { tryReserveDailyExecutionSlot } from '@/lib/executionMetrics'
import { logExecution } from '@/lib/audit'
import initServerSentry from '@/lib/sentry.server'
import Sentry from '@/lib/sentry.server'
import { initTracing } from '@/lib/tracing'
import { executionLatency, executionAttempts, executionFailures, executedOrders as metricsExecutedOrders } from '@/lib/metrics'
import { recordAICallStart, recordAICallEnd, recordExecutedOrder } from '@/lib/aiMetrics'
import { z } from 'zod'
import { getExecutionIdentity } from '@/lib/auth'

const ExecuteOrderSchema = z.object({
  pair: z.string().regex(/^[A-Za-z0-9._-]{3,20}$/),
  direction: z.union([z.literal('Buy'), z.literal('Sell')]),
  entryPrice: z.number().finite().positive(),
  accountBalance: z.number().finite().positive(),
  pipValuePerLot: z.number().finite().positive(),
  stopLossPips: z.number().finite().positive(),
  baseLots: z.number().finite().positive(),
  totalLots: z.number().finite().positive(),
  layers: z.array(z.object({
    index: z.number().int().nonnegative(),
    lots: z.number().finite().positive(),
    stopLossPips: z.number().finite().positive().optional(),
    priceOffsetPips: z.number().finite(),
    riskAmount: z.number().finite().nonnegative(),
  }).strict()).min(1).max(10),
}).strict()

// Forwards an approved order payload to the configured execution endpoint.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initServerSentry()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
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

  const parsed = ExecuteOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid order request', details: parsed.error.format() })
    return
  }

  const executorUrl = process.env.ORDER_EXECUTOR_URL
  const executorKey = process.env.ORDER_EXECUTOR_API_KEY
  if (!executorUrl || !executorKey) {
    res.status(503).json({ ok: false, error: 'Order executor is not fully configured' })
    return
  }

  let aiCtx: ReturnType<typeof recordAICallStart> | null = null
  try {
    initTracing()
    const accountId = identity.accountId
    const maxDaily = Number.parseInt(process.env.MAX_DAILY_TRADES_PER_ACCOUNT || '20', 10)
    if (!Number.isSafeInteger(maxDaily) || maxDaily <= 0) {
      res.status(503).json({ ok: false, error: 'Daily trade limit is misconfigured' })
      return
    }
    const order = parsed.data
    const maxAggPct = Number.parseFloat(process.env.MAX_AGGREGATE_RISK_PCT || '2')
    if (!Number.isFinite(maxAggPct) || maxAggPct <= 0) {
      res.status(503).json({ ok: false, error: 'Aggregate risk limit is misconfigured' })
      return
    }
    const layeredLots = order.layers.reduce((total, layer) => total + layer.lots, 0)
    const lotsTolerance = Math.max(0.0001, order.layers.length * 0.00005)
    if (Math.abs(layeredLots - order.totalLots) > lotsTolerance) {
      res.status(400).json({ ok: false, error: 'Layer total does not match totalLots' })
      return
    }
    if (order.layers.some(layer => layer.stopLossPips !== undefined && layer.stopLossPips !== order.stopLossPips)) {
      res.status(400).json({ ok: false, error: 'Layer stop loss does not match stopLossPips' })
      return
    }

    const totalRisk = order.layers.reduce(
      (total, layer) => total + layer.lots * order.stopLossPips * order.pipValuePerLot,
      0,
    )
    const riskCap = order.accountBalance * (maxAggPct / 100)
    if (!Number.isFinite(totalRisk) || totalRisk > riskCap) {
      Sentry.captureMessage(`Aggregate risk ${totalRisk} exceeds cap ${riskCap} for ${accountId}`)
      res.status(400).json({ ok: false, error: 'Aggregate risk exceeds configured cap' })
      return
    }

    const reserved = await tryReserveDailyExecutionSlot(accountId, maxDaily)
    if (!reserved) {
      Sentry.captureMessage(`Daily trade cap reached for ${accountId}`)
      res.status(429).json({ ok: false, error: 'Daily trade cap reached' })
      return
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${executorKey}`,
    }

    aiCtx = recordAICallStart('executeOrderForward', process.env.AI_MODEL_VERSION)
    const start = Date.now()
    executionAttempts.inc({ env: process.env.NODE_ENV || 'development' })
    const r = await fetch(executorUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...order, accountId }),
    })
    const text = await r.text()
    const latency = (Date.now() - start) / 1000
    try { executionLatency.observe({ env: process.env.NODE_ENV || 'development' }, latency) } catch {}
    const contentType = r.headers.get('content-type') || ''
    let parsed: any = null
    if (contentType.includes('application/json')) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }

    if (!r.ok) {
      Sentry.captureMessage(`Executor returned error ${r.status}`)
      recordAICallEnd(aiCtx, new Error(`Executor returned ${r.status}`))
      try { executionFailures.inc({ env: process.env.NODE_ENV || 'development' }) } catch {}
      res.status(502).json({ ok: false, error: 'Executor error', status: r.status, body: parsed ?? text })
      return
    }

    // Audit log the execution forward
    try {
      await logExecution({ accountId, action: 'execute-order', payload: order, executorResponse: parsed ?? text, status: 'ok' })
    } catch (e) {
      Sentry.captureException(e)
    }
    try { metricsExecutedOrders.inc({ env: process.env.NODE_ENV || 'development', model_version: process.env.AI_MODEL_VERSION || 'unknown' }) } catch {}
    try { recordExecutedOrder() } catch {}
    recordAICallEnd(aiCtx)

    res.status(200).json({ ok: true, executorResponse: parsed ?? text })
  } catch (err: any) {
    Sentry.captureException(err)
    if (aiCtx) recordAICallEnd(aiCtx, err)
    res.status(500).json({ ok: false, error: 'Forwarding error' })
  }
}
