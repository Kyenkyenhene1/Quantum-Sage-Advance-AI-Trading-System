/**
 * Risk management helpers for position sizing, SL/TP and layering (pyramiding)
 *
 * This module provides deterministic calculations (no market calls) for
 * - computePositionSize
 * - computeLayerPrices
 * - splitLotsForLayers
 * - computeAggregateRisk
 * - simulatePyramid (summary)
 *
 * All currency/pip conversions should be provided by the caller. The functions
 * are intentionally small and well-typed so you can adapt them to the app's
 * risk controls and user-configurable settings.
 */

export type Side = 'buy' | 'sell'

export interface PositionSizingInput {
  accountBalance: number // account currency (e.g., USD)
  riskPerTradePct: number // e.g., 1 = 1% (pass 1 for 1%)
  stopLossPips: number // distance in pips from entry to SL
  pipValuePerLot: number // value of 1 lot per pip in account currency (e.g., 10 for many major pairs)
}

export interface LayerConfig {
  layers: number // number of additional entries including initial (e.g., 1 = single entry)
  spacingPips: number // uniform spacing between layers in pips (can be 0)
  scalingFactors?: number[] // relative size multipliers per layer. Length should be `layers` or will default
}

export interface LayeredPosition {
  price: number
  lots: number
  stopLossPips: number
  riskAmount: number
}

/**
 * Compute base lot size for a single entry so that risk = accountBalance * riskPct
 * Formula: lots = (accountBalance * riskPct) / (stopLossPips * pipValuePerLot)
 */
export function computePositionSize(input: PositionSizingInput): number {
  const { accountBalance, riskPerTradePct, stopLossPips, pipValuePerLot } = input
  if (stopLossPips <= 0 || pipValuePerLot <= 0) return 0
  const riskAmount = (accountBalance * (riskPerTradePct / 100))
  const lots = riskAmount / (stopLossPips * pipValuePerLot)
  // Round to sensible fractional lot (e.g., 0.01) if needed by consumer
  return lots
}

/**
 * Compute layer prices for a pyramiding strategy.
 * - entryPrice: price of the first entry
 * - side: buy or sell
 * - cfg: LayerConfig for spacing and scaling
 * Returns array of prices length == layers
 */
export function computeLayerPrices(entryPrice: number, side: Side, cfg: LayerConfig): number[] {
  const { layers, spacingPips } = cfg
  const prices: number[] = []
  for (let i = 0; i < layers; i++) {
    const offsetPips = i * spacingPips
    // price movement per pip is context-dependent; here we assume caller converts pips->price
    // We'll return values in "price units offset" where pipToPrice must be applied by caller.
    // For many FX pairs a pip is 0.0001 or 0.01 for JPY pairs. Caller should compute actual price.
    const delta = offsetPips
    if (side === 'buy') prices.push(entryPrice - delta)
    else prices.push(entryPrice + delta)
  }
  return prices
}

/**
 * Given a base lots value and optional scaling factors, return lots per layer.
 * scalingFactors defines relative sizes (e.g., [1,0.6,0.4]) where sum=2.0 -> scaled absolute sizes
 * If scalingFactors not provided, default is decreasing sizes: 1, 0.6, 0.4... truncated to layers
 */
export function splitLotsForLayers(baseLots: number, cfg: LayerConfig): number[] {
  const { layers, scalingFactors } = cfg
  if (layers <= 1) return [baseLots]
  let factors: number[]
  if (scalingFactors && scalingFactors.length === layers) {
    factors = scalingFactors
  } else {
    // default geometric decay factors, normalized
    factors = new Array(layers).fill(0).map((_, i) => Math.pow(0.6, i))
  }
  const sum = factors.reduce((s, v) => s + v, 0)
  return factors.map(f => (f / sum) * baseLots * layers) // scale so that total nominal roughly equals baseLots*layers
}

/**
 * Compute aggregation risk summary for a layered position.
 * - baseLots: base lots computed from computePositionSize
 * - cfg: layer config
 * - entryPrice: first entry price (for price list computation if needed)
 * - stopLossPips: stop loss used for each entry (assumed same here)
 * - pipValuePerLot: pip value to convert pips -> currency
 */
export function computeAggregateRisk(
  baseLots: number,
  cfg: LayerConfig,
  stopLossPips: number,
  pipValuePerLot: number,
): { layers: LayeredPosition[]; totalRisk: number; totalLots: number } {
  const lotsPerLayer = splitLotsForLayers(baseLots, cfg)
  const prices = computeLayerPrices(0, 'buy', cfg) // price offsets only (caller may ignore price)
  const layers: LayeredPosition[] = lotsPerLayer.map((lots, i) => {
    const riskAmount = Math.abs(lots * stopLossPips * pipValuePerLot)
    return { price: prices[i] || 0, lots, stopLossPips, riskAmount }
  })
  const totalRisk = layers.reduce((s, p) => s + p.riskAmount, 0)
  const totalLots = layers.reduce((s, p) => s + p.lots, 0)
  return { layers, totalRisk, totalLots }
}

/**
 * Simple simulation helper: given account and config, show recommended base lots and aggregated risk.
 */
export function simulatePyramid(
  accountBalance: number,
  riskPerTradePct: number,
  stopLossPips: number,
  pipValuePerLot: number,
  cfg: LayerConfig,
) {
  const baseLots = computePositionSize({ accountBalance, riskPerTradePct, stopLossPips, pipValuePerLot })
  const agg = computeAggregateRisk(baseLots, cfg, stopLossPips, pipValuePerLot)
  return {
    accountBalance,
    riskPerTradePct,
    stopLossPips,
    pipValuePerLot,
    baseLots,
    layers: agg.layers,
    totalRisk: agg.totalRisk,
    totalLots: agg.totalLots,
  }
}

/**
 * VOLATILITY-ADJUSTED POSITION SIZING
 * Reduces position size during high volatility, increases during low volatility
 * This helps minimize drawdowns by being more cautious when markets are choppy
 *
 * Formula: adjustedLots = baseLots × (baselineATR / currentATR)
 * Example: If baseline ATR=30 and current ATR=60, lots are cut in half (0.5x)
 */
export function computeVolatilityAdjustedLots(
  baseLots: number,
  currentATR: number,
  baselineATR: number = 30, // Default baseline for EURUSD 1H
): number {
  if (currentATR <= 0 || baselineATR <= 0) return baseLots
  const adjustedLots = baseLots * (baselineATR / currentATR)
  // Cap adjustment to 50%-150% of base lots to prevent extreme sizing
  return Math.max(baseLots * 0.5, Math.min(adjustedLots, baseLots * 1.5))
}

/**
 * DYNAMIC STOP LOSS CALCULATION
 * Suggests ATR-based stop loss with volatility multiplier
 * Lower multiplier (1.5x) for high volatility, higher (2.5x) for low volatility
 */
export function computeDynamicStopLoss(
  currentATR: number,
  highVolatilityThreshold: number = 60,
  normalVolatilityThreshold: number = 30,
): { stopLossPips: number; volatilityLevel: 'low' | 'normal' | 'high' } {
  let multiplier: number
  let volatilityLevel: 'low' | 'normal' | 'high'

  if (currentATR >= highVolatilityThreshold) {
    multiplier = 1.5
    volatilityLevel = 'high'
  } else if (currentATR >= normalVolatilityThreshold) {
    multiplier = 2.0
    volatilityLevel = 'normal'
  } else {
    multiplier = 2.5
    volatilityLevel = 'low'
  }

  return {
    stopLossPips: Math.ceil(currentATR * multiplier),
    volatilityLevel,
  }
}

/**
 * MULTI-TARGET PARTIAL EXIT STRATEGY
 * 3-tier take profit system for optimal profit locking and win-rate improvement
 * Secures profits gradually while allowing upside capture
 */
export interface PartialExitLevel {
  tier: 1 | 2 | 3
  riskRewardRatio: number // e.g., 1 for 1:1, 2 for 1:2
  exitPercentage: number // % of position to exit at this tier
  description: string
}

export function computePartialExitLevels(
  stopLossPips: number,
  confidence: number = 50, // 0-100 scale
): PartialExitLevel[] {
  // Adjust TP ratios based on signal confidence
  let tp1Ratio = 1.0
  let tp2Ratio = 1.5
  let tp3Ratio = 3.0

  if (confidence >= 90) {
    // High confidence: more aggressive take profits
    tp1Ratio = 1.2
    tp2Ratio = 2.0
    tp3Ratio = 5.0
  } else if (confidence >= 75) {
    // Normal confidence: standard ratios
    tp1Ratio = 1.0
    tp2Ratio = 1.5
    tp3Ratio = 3.0
  } else {
    // Low confidence: conservative, lock in quicker
    tp1Ratio = 0.8
    tp2Ratio = 1.2
    tp3Ratio = 2.0
  }

  return [
    {
      tier: 1,
      riskRewardRatio: tp1Ratio,
      exitPercentage: 30,
      description: `Exit 30% at ${(stopLossPips * tp1Ratio).toFixed(0)} pips (${tp1Ratio}:1 R:R)`,
    },
    {
      tier: 2,
      riskRewardRatio: tp2Ratio,
      exitPercentage: 40,
      description: `Exit 40% at ${(stopLossPips * tp2Ratio).toFixed(0)} pips (${tp2Ratio}:1 R:R)`,
    },
    {
      tier: 3,
      riskRewardRatio: tp3Ratio,
      exitPercentage: 30,
      description: `Exit 30% at ${(stopLossPips * tp3Ratio).toFixed(0)} pips (${tp3Ratio}:1 R:R) - Let winners run`,
    },
  ]
}

/**
 * BREAKEVEN MANAGEMENT
 * Automatically moves stop loss to entry price after reaching profit threshold
 * Reduces risk while keeping position open for potential larger moves
 */
export interface BreakevenConfig {
  breakEvenThresholdPips: number // e.g., 20 pips profit to trigger SL move
  trailingStopPips: number // e.g., 10 pips below highest point
}

export function shouldMoveToBreakeven(
  currentProfitPips: number,
  breakEvenThresholdPips: number,
): boolean {
  return currentProfitPips >= breakEvenThresholdPips
}

export function computeTrailingStopPrice(
  highestPriceSinceEntry: number,
  trailingStopPips: number,
  side: Side,
  pipToPrice: number = 0.0001,
): number {
  const trailingAmount = trailingStopPips * pipToPrice
  if (side === 'buy') {
    return highestPriceSinceEntry - trailingAmount
  } else {
    return highestPriceSinceEntry + trailingAmount
  }
}

/**
 * DRAWDOWN TRACKING & RECOVERY HELPERS
 * Tracks daily/weekly losses to enforce trading halts during adverse periods
 */
export interface DrawdownState {
  dailyLoss: number
  weeklyLoss: number
  consecutiveLosses: number
  isDailyLimitBreached: boolean
  isWeeklyLimitBreached: boolean
  isConsecutiveLossLimitBreached: boolean
}

export function checkDrawdownLimits(
  dailyLoss: number,
  weeklyLoss: number,
  consecutiveLosses: number,
  dailyLimitPct: number = 2.0, // 2% daily max loss
  weeklyLimitPct: number = 5.0, // 5% weekly max loss
  maxConsecutiveLosses: number = 3,
  accountBalance: number = 10000,
): DrawdownState {
  const dailyLimitAmount = (accountBalance * dailyLimitPct) / 100
  const weeklyLimitAmount = (accountBalance * weeklyLimitPct) / 100

  return {
    dailyLoss,
    weeklyLoss,
    consecutiveLosses,
    isDailyLimitBreached: dailyLoss >= dailyLimitAmount,
    isWeeklyLimitBreached: weeklyLoss >= weeklyLimitAmount,
    isConsecutiveLossLimitBreached: consecutiveLosses >= maxConsecutiveLosses,
  }
}

/**
 * PROFIT FACTOR & PROFITABILITY RATIO HELPERS
 * Calculates metrics to measure system health and profitability
 */
export interface ProfitabilityMetrics {
  profitFactor: number // Sum of wins / Sum of losses (>1.5 is good, >2.0 is excellent)
  winRate: number // % of winning trades (0-100)
  averageWinSize: number
  averageLossSize: number
  riskRewardRatio: number // Average reward per unit of risk
  expectancy: number // Average profit per trade
}

export function computeProfitabilityMetrics(
  winningTrades: number[],
  losingTrades: number[],
): ProfitabilityMetrics {
  const totalWins = winningTrades.reduce((s, w) => s + w, 0)
  const totalLosses = Math.abs(losingTrades.reduce((s, l) => s + l, 0))
  const totalTrades = winningTrades.length + losingTrades.length
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0

  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 1

  return {
    profitFactor,
    winRate,
    averageWinSize: avgWin,
    averageLossSize: avgLoss,
    riskRewardRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    expectancy: totalTrades > 0 ? (totalWins - totalLosses) / totalTrades : 0,
  }
}
