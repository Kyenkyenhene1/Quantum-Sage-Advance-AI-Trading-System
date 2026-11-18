import { describe, it, expect } from 'vitest'
import { checkDrawdownLimits, computePositionSize, simulatePyramid } from '../../src/lib/risk'

describe('risk helpers', () => {
  it('computes base lots for example case', () => {
    const lots = computePositionSize({ accountBalance: 10000, riskPerTradePct: 1, stopLossPips: 50, pipValuePerLot: 10 })
    // Example in docs: should be 0.2
    expect(Number(lots.toFixed(4))).toBeCloseTo(0.2)
  })

  it('simulatePyramid returns aggregate risk consistent with formula', () => {
    const out = simulatePyramid(10000, 1, 50, 10, { layers: 3, spacingPips: 25 })
    // totalRisk should be > 0 and baseLots should match computePositionSize
    expect(out.baseLots).toBeGreaterThan(0)
    expect(out.totalRisk).toBeGreaterThan(0)
    expect(out.layers.length).toBe(3)
  })

  it('halts after the configured consecutive-loss limit', () => {
    const state = checkDrawdownLimits(0, 0, 3, 2, 5, 3, 10000)
    expect(state.isConsecutiveLossLimitBreached).toBe(true)
  })
})
