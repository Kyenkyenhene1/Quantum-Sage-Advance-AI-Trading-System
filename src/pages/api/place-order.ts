import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import {
  computePositionSize,
  computeAggregateRisk,
  computeVolatilityAdjustedLots,
  computePartialExitLevels,
  LayerConfig,
} from '@/lib/risk'

const PlaceOrderSchema = z.object({
  pair: z.string().regex(/^[A-Za-z0-9._-]{3,20}$/),
  direction: z.union([z.literal('Buy'), z.literal('Sell')]),
  entryPrice: z.number().finite().positive(),
  accountBalance: z.number().finite().positive(),
  stopLossPips: z.number().finite().positive(),
  pipValuePerLot: z.number().finite().positive(),
  riskPerTradePct: z.number().finite().positive().max(100).optional(),
  confidence: z.number().finite().min(0).max(100).optional(),
  currentATR: z.number().finite().positive().optional(),
  layerConfig: z
    .object({
      layers: z.number().int().min(1).max(10).optional(),
      spacingPips: z.number().finite().min(0).optional(),
      scalingFactors: z.array(z.number().finite().positive()).max(10).optional(),
    })
    .optional(),
  desiredTakeProfitPips: z.number().finite().positive().optional(),
}).strict()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const parsed = PlaceOrderSchema.safeParse(req.body)
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
    riskPerTradePct = 1,
    confidence = 50,
    currentATR = 30,
    layerConfig,
    desiredTakeProfitPips,
  } = parsed.data

  // Build a LayerConfig with sensible defaults when missing
  const cfg: LayerConfig = {
    layers: layerConfig?.layers ?? 1,
    spacingPips: layerConfig?.spacingPips ?? 0,
    scalingFactors: layerConfig?.scalingFactors,
  }

  try {
    let baseLots = computePositionSize({ accountBalance, riskPerTradePct, stopLossPips, pipValuePerLot })

    // VOLATILITY-ADJUSTED SIZING
    const adjustedLots = computeVolatilityAdjustedLots(baseLots, currentATR)
    const volatilityRatio = adjustedLots / baseLots
    baseLots = adjustedLots

    let agg = computeAggregateRisk(baseLots, cfg, stopLossPips, pipValuePerLot)
    if (!Number.isFinite(baseLots) || !Number.isFinite(agg.totalRisk)) {
      res.status(400).json({ ok: false, error: 'Order values exceed supported numeric limits' })
      return
    }
    const maxAggregateRiskPct = Number.parseFloat(process.env.MAX_AGGREGATE_RISK_PCT || '2')
    if (!Number.isFinite(maxAggregateRiskPct) || maxAggregateRiskPct <= 0) {
      res.status(503).json({ ok: false, error: 'Aggregate risk limit is misconfigured' })
      return
    }
    const aggregateRiskLimit = (accountBalance * maxAggregateRiskPct) / 100
    if (agg.totalRisk > aggregateRiskLimit && agg.totalRisk > 0) {
      baseLots *= aggregateRiskLimit / agg.totalRisk
      agg = computeAggregateRisk(baseLots, cfg, stopLossPips, pipValuePerLot)
    }

    // MULTI-TARGET PARTIAL EXITS (confidence-aware)
    const partialExits = computePartialExitLevels(stopLossPips, confidence)
    const takeProfitTiers = partialExits.map(exit => ({
      tier: exit.tier,
      takeProfitPips: stopLossPips * exit.riskRewardRatio,
      riskRewardRatio: exit.riskRewardRatio,
      exitPercentage: exit.exitPercentage,
      description: exit.description,
    }))

    // Response: return pips-based layer price offsets (caller converts pips->price if needed)
    const layers = agg.layers.map((l, i) => ({
      index: i,
      lots: Number(l.lots.toFixed(4)),
      stopLossPips: l.stopLossPips,
      priceOffsetPips: l.price, // price here represents pip offsets as per risk helper
      riskAmount: Number(l.riskAmount.toFixed(2)),
    }))

    const result = {
      ok: true,
      pair,
      direction,
      entryPrice,
      baseLots: Number(baseLots.toFixed(4)),
      totalLots: Number(agg.totalLots.toFixed(4)),
      totalRisk: Number(agg.totalRisk.toFixed(2)),
      stopLossPips,
      desiredTakeProfitPips: desiredTakeProfitPips ?? null,
      volatilityAdjustment: {
        currentATR: Number(currentATR.toFixed(2)),
        adjustmentRatio: Number(volatilityRatio.toFixed(2)),
        note: volatilityRatio < 1 ? 'High volatility - reduced position' : volatilityRatio > 1 ? 'Low volatility - increased position' : 'Normal volatility - standard sizing',
      },
      partialExits: takeProfitTiers,
      layers,
      note: 'Layer price offsets are in pips. Convert to price units using instrument pip-size. Use partialExits for multi-level TP strategy.',
    }

    res.status(200).json(result)
  } catch (err: any) {
    res.status(500).json({ ok: false, error: 'Internal error', details: String(err?.message || err) })
  }
}
