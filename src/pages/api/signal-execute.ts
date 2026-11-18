import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { computePositionSize, computeAggregateRisk, computeVolatilityAdjustedLots, computePartialExitLevels, checkDrawdownLimits, LayerConfig } from '@/lib/risk'
import { tryReserveDailyExecutionSlot } from '@/lib/executionMetrics'
import { recordAICallStart, recordAICallEnd, recordExecutedOrder } from '@/lib/aiMetrics'
import { initTracing } from '@/lib/tracing'
import { executionAttempts, executionFailures, executionLatency, executedOrders as metricsExecutedOrders } from '@/lib/metrics'
import initServerSentry from '@/lib/sentry.server'
import Sentry from '@/lib/sentry.server'
import { logExecution } from '@/lib/audit'
import { getExecutionIdentity } from '@/lib/auth'

const SignalSchema = z.object({
  pair: z.string().regex(/^[A-Za-z0-9._-]{3,20}$/),
  direction: z.union([z.literal('Buy'), z.literal('Sell')]),
  entryPrice: z.number().finite().positive(),
  accountBalance: z.number().finite().positive(),
  stopLossPips: z.number().finite().positive(),
  pipValuePerLot: z.number().finite().positive(),
  confidence: z.number().finite().min(0).max(100),
  confidenceThreshold: z.number().finite().min(0).max(100).optional(),
  autoExecute: z.boolean().optional(),
  currentATR: z.number().finite().positive().optional(),
  dailyLoss: z.number().finite().min(0).optional(),
  weeklyLoss: z.number().finite().min(0).optional(),
  consecutiveLosses: z.number().int().min(0).optional(),
  layerConfig: z
    .object({
      layers: z.number().int().min(1).max(10).optional(),
      spacingPips: z.number().finite().min(0).optional(),
      scalingFactors: z.array(z.number().finite().positive()).max(10).optional(),
    })
    .optional(),
}).strict()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initServerSentry()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const parsed = SignalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.format() })
    return
  }

  const {
    pair,
    direction,
    entryPrice,
    accountBalance,
    stopLossPips,
    pipValuePerLot,
    confidence,
    confidenceThreshold = 80,
    autoExecute = false,
    currentATR = 30, // Default ATR baseline
    dailyLoss = 0,
    weeklyLoss = 0,
    consecutiveLosses = 0,
    layerConfig,
  } = parsed.data

  const shouldExecute = autoExecute && confidence >= confidenceThreshold
  let accountId = 'signal-preview'
  if (shouldExecute) {
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
    accountId = identity.accountId
  }

  const ctxMetric = recordAICallStart('signalExecute', process.env.AI_MODEL_VERSION)

  // DRAWDOWN CHECK: Prevent trading if limits breached
  const dailyLimitPct = Number.parseFloat(process.env.DAILY_DRAWDOWN_LIMIT_PCT || '2.0')
  const weeklyLimitPct = Number.parseFloat(process.env.WEEKLY_DRAWDOWN_LIMIT_PCT || '5.0')
  const maxConsecutiveL = Number.parseInt(process.env.MAX_CONSECUTIVE_LOSSES || '3', 10)
  if (
    !Number.isFinite(dailyLimitPct) || dailyLimitPct <= 0 ||
    !Number.isFinite(weeklyLimitPct) || weeklyLimitPct <= 0 ||
    !Number.isSafeInteger(maxConsecutiveL) || maxConsecutiveL <= 0
  ) {
    recordAICallEnd(ctxMetric, new Error('Drawdown limits are misconfigured'))
    res.status(503).json({ ok: false, error: 'Drawdown limits are misconfigured' })
    return
  }

  const drawdownState = checkDrawdownLimits(
    dailyLoss,
    weeklyLoss,
    consecutiveLosses,
    dailyLimitPct,
    weeklyLimitPct,
    maxConsecutiveL,
    accountBalance,
  )

  if (
    drawdownState.isDailyLimitBreached ||
    drawdownState.isWeeklyLimitBreached ||
    drawdownState.isConsecutiveLossLimitBreached
  ) {
    Sentry.captureMessage(
      `Trading halt limit breached: daily=${drawdownState.isDailyLimitBreached}, weekly=${drawdownState.isWeeklyLimitBreached}, consecutive=${drawdownState.isConsecutiveLossLimitBreached}`,
    )
    recordAICallEnd(ctxMetric, new Error('Drawdown limit breached'))
    res.status(429).json({
      ok: false,
      error: 'Trading halted due to drawdown limits',
      drawdownState,
    })
    return
  }

  const cfg: LayerConfig = {
    layers: layerConfig?.layers ?? 5,
    spacingPips: layerConfig?.spacingPips ?? 0,
    scalingFactors: layerConfig?.scalingFactors,
  }

  try {
    // Apply the aggregate-risk ceiling to the final layered position size.
    const maxAggregateRiskPct = Number.parseFloat(process.env.MAX_AGGREGATE_RISK_PCT || '2')
    if (!Number.isFinite(maxAggregateRiskPct) || maxAggregateRiskPct <= 0) {
      recordAICallEnd(ctxMetric, new Error('MAX_AGGREGATE_RISK_PCT is misconfigured'))
      res.status(503).json({ ok: false, error: 'Aggregate risk limit is misconfigured' })
      return
    }

    // VOLATILITY-ADJUSTED POSITION SIZING
    let baseLots = computePositionSize({ accountBalance, riskPerTradePct: 1, stopLossPips, pipValuePerLot })
    const adjustedLots = computeVolatilityAdjustedLots(baseLots, currentATR)
    const volatilityAdjustmentRatio = baseLots > 0 ? adjustedLots / baseLots : 0

    baseLots = adjustedLots // Use volatility-adjusted lots for calculations

    let agg = computeAggregateRisk(baseLots, cfg, stopLossPips, pipValuePerLot)
    if (!Number.isFinite(baseLots) || !Number.isFinite(agg.totalRisk)) {
      res.status(400).json({ ok: false, error: 'Order values exceed supported numeric limits' })
      recordAICallEnd(ctxMetric, new Error('Order values exceed supported numeric limits'))
      return
    }
    const aggregateRiskLimit = (accountBalance * maxAggregateRiskPct) / 100
    if (agg.totalRisk > aggregateRiskLimit && agg.totalRisk > 0) {
      baseLots *= aggregateRiskLimit / agg.totalRisk
      agg = computeAggregateRisk(baseLots, cfg, stopLossPips, pipValuePerLot)
    }

    // COMPUTE MULTI-TARGET PARTIAL EXIT LEVELS (confidence-aware)
    const partialExits = computePartialExitLevels(stopLossPips, confidence)
    const takeProfitTiers = partialExits.map(exit => ({
      tier: exit.tier,
      takeProfitPips: stopLossPips * exit.riskRewardRatio,
      riskRewardRatio: exit.riskRewardRatio,
      exitPercentage: exit.exitPercentage,
      description: exit.description,
    }))

    const responsePayload: any = {
      ok: true,
      pair,
      direction,
      entryPrice,
      accountBalance,
      pipValuePerLot,
      confidence,
      confidenceThreshold,
      autoExecute,
      baseLots: Number(baseLots.toFixed(4)),
      totalLots: Number(agg.totalLots.toFixed(4)),
      totalRisk: Number(agg.totalRisk.toFixed(2)),
      volatilityAdjustment: {
        currentATR: Number(currentATR.toFixed(2)),
        adjustmentRatio: Number(volatilityAdjustmentRatio.toFixed(2)),
        note: volatilityAdjustmentRatio < 1 ? 'High volatility - reduced position' : volatilityAdjustmentRatio > 1 ? 'Low volatility - increased position' : 'Normal volatility - standard sizing',
      },
      partialExits: takeProfitTiers,
      drawdownState: {
        dailyLoss: Number(drawdownState.dailyLoss.toFixed(2)),
        weeklyLoss: Number(drawdownState.weeklyLoss.toFixed(2)),
        consecutiveLosses: drawdownState.consecutiveLosses,
        isConsecutiveLossLimitBreached: drawdownState.isConsecutiveLossLimitBreached,
        dailyLimitPct,
        weeklyLimitPct,
      },
      layers: agg.layers.map((l, i) => ({ index: i, lots: Number(l.lots.toFixed(4)), priceOffsetPips: l.price, riskAmount: Number(l.riskAmount.toFixed(2)) })),
    }

    // If criteria met and autoExecute requested, forward to executor
    if (shouldExecute) {
      const executorUrl = process.env.ORDER_EXECUTOR_URL
      const executorKey = process.env.ORDER_EXECUTOR_API_KEY
      if (!executorUrl || !executorKey) {
        recordAICallEnd(ctxMetric, new Error('Executor is not fully configured'))
        res.status(503).json({ ok: false, error: 'Executor is not fully configured' })
        return
      }

      const maxDaily = Number.parseInt(process.env.MAX_DAILY_TRADES_PER_ACCOUNT || '20', 10)
      if (!Number.isSafeInteger(maxDaily) || maxDaily <= 0) {
        recordAICallEnd(ctxMetric, new Error('Daily trade limit is misconfigured'))
        res.status(503).json({ ok: false, error: 'Daily trade limit is misconfigured' })
        return
      }
      const reserved = await tryReserveDailyExecutionSlot(accountId, maxDaily)
      if (!reserved) {
        Sentry.captureMessage(`Daily trade cap reached for ${accountId}`)
        recordAICallEnd(ctxMetric, new Error('Daily trade cap reached'))
        res.status(429).json({ ok: false, error: 'Daily trade cap reached' })
        return
      }

      const execBody = {
        pair,
        direction,
        entryPrice,
        accountBalance,
        pipValuePerLot,
        layers: responsePayload.layers,
        baseLots: responsePayload.baseLots,
        totalLots: responsePayload.totalLots,
        stopLossPips,
        accountId,
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${executorKey}`,
      }

      try {
        initTracing()
        const start = Date.now()
        executionAttempts.inc({ env: process.env.NODE_ENV || 'development' })
        const r = await fetch(executorUrl, { method: 'POST', headers, body: JSON.stringify(execBody) })
        const text = await r.text()
        const latency = (Date.now() - start) / 1000
        try { executionLatency.observe({ env: process.env.NODE_ENV || 'development' }, latency) } catch {}
        let parsedBody: any = null
        const ct = r.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          try { parsedBody = JSON.parse(text) } catch { parsedBody = text }
        }
        responsePayload.executeResult = { ok: r.ok, status: r.status, body: parsedBody ?? text }
        Sentry.captureMessage(`Auto-execution attempt for ${accountId} pair=${pair} confidence=${confidence}`)
        try {
          await logExecution({ accountId, action: 'auto-execute', payload: execBody, executorResponse: parsedBody ?? text, status: r.ok ? 'ok' : 'error' })
        } catch (e) {
          Sentry.captureException(e)
        }
        if (!r.ok) {
          try { executionFailures.inc({ env: process.env.NODE_ENV || 'development' }) } catch {}
          const error = new Error(`Executor returned ${r.status}`)
          recordAICallEnd(ctxMetric, error)
          res.status(502).json({ ...responsePayload, ok: false, error: 'Executor error' })
          return
        } else {
          try { metricsExecutedOrders.inc({ env: process.env.NODE_ENV || 'development', model_version: process.env.AI_MODEL_VERSION || 'unknown' }) } catch {}
          try { recordExecutedOrder() } catch {}
        }
      } catch (err: any) {
        Sentry.captureException(err)
        try { executionFailures.inc({ env: process.env.NODE_ENV || 'development' }) } catch {}
        recordAICallEnd(ctxMetric, err)
        res.status(502).json({ ...responsePayload, ok: false, error: 'Executor request failed' })
        return
      }
    }
    recordAICallEnd(ctxMetric)

    res.status(200).json(responsePayload)
  } catch (err: any) {
    Sentry.captureException(err)
    recordAICallEnd(ctxMetric, err)
    res.status(500).json({ ok: false, error: 'Internal error' })
  }
}
