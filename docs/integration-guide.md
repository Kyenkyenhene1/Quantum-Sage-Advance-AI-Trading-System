# Integration Guide: Implementing SL/TP Enhancements

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Trading Frontend                          │
│  (Dashboard showing volatility adjustment & multi-TP)       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Enhanced API Endpoints                          │
│  ├─ /api/place-order      (+ ATR input)                     │
│  ├─ /api/signal-execute   (+ Drawdown tracking)            │
│  └─ /api/execute-order    (no changes)                     │
└──────────┬────────────────────────────────────┬─────────────┘
           │                                    │
           ▼                                    ▼
    ┌──────────────────┐            ┌──────────────────┐
    │   Risk Engine    │            │  Execution Logs  │
    │  (risk.ts)       │            │  (Audit DB/PG)   │
    │                  │            │                  │
    │ ✨ NEW:         │            │  Drawdown State  │
    │ • Volatility     │            │  Position Data   │
    │ • Multi-TP       │            │  TP Tier Hits    │
    │ • Drawdown caps  │            │                  │
    │ • Breakeven mgmt │            └──────────────────┘
    │ • Profitability  │
    └──────────────────┘
```

---

## Step-by-Step Integration

### Phase 1: Backend Setup (Already Done ✓)

**Completed**:
- ✅ New functions added to `src/lib/risk.ts`
- ✅ API schemas updated in `signal-execute.ts` and `place-order.ts`
- ✅ Drawdown checks integrated
- ✅ Volatility adjustment logic added
- ✅ Multi-TP calculation implemented

**Your task**: Just run tests to verify

```bash
npm run test -- risk.test.ts
npm run test:e2e
```

---

### Phase 2: Frontend Integration (1-2 Hours)

#### Step 2.1: Update RiskManagementCard Component

```tsx
// src/components/quantumsage/RiskManagementCard.tsx

import {
  computeVolatilityAdjustedLots,
  computePartialExitLevels,
  checkDrawdownLimits,
} from '@/lib/risk'

export function RiskManagementCard() {
  // NEW STATE: Volatility & Drawdown Tracking
  const [currentATR, setCurrentATR] = useState(30)
  const [useVolatilityAdjustment, setUseVolatilityAdjustment] = useState(true)
  const [dailyDrawdownLimit, setDailyDrawdownLimit] = useState(2.0)
  const [weeklyDrawdownLimit, setWeeklyDrawdownLimit] = useState(5.0)
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(3)

  // Tracking state
  const [accountMetrics, setAccountMetrics] = useState({
    dailyLoss: 0,
    weeklyLoss: 0,
    consecutiveLosses: 0,
    todayTradeCount: 0,
  })

  // TP Strategy preference
  const [useMultiTP, setUseMultiTP] = useState(true)
  const [confidence, setConfidence] = useState(80)

  // Fetch ATR from market data
  const fetchAndUpdateATR = async () => {
    const atr = await fetchATRFromChart() // Your implementation
    setCurrentATR(atr)
  }

  useEffect(() => {
    // Fetch ATR every minute
    const interval = setInterval(fetchAndUpdateATR, 60000)
    return () => clearInterval(interval)
  }, [])

  // Simulate order and show new metrics
  const handleSimulateOrder = async () => {
    const result = await fetch('/api/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair: 'EURUSD',
        direction: 'Buy',
        entryPrice: 1.1000,
        accountBalance: 10000,
        stopLossPips: 50,
        pipValuePerLot: 10,
        confidence, // NEW
        currentATR, // NEW
        riskPerTradePct: 1,
      }),
    }).then(r => r.json())

    // Display new fields
    console.log('Volatility Adjustment:', result.volatilityAdjustment)
    console.log('Partial Exits:', result.partialExits)

    // Show in UI
    setSimResult(result)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Management Enhanced</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* NEW: Volatility Section */}
        <div className="space-y-2">
          <Label>Current ATR (for volatility adjustment)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={currentATR}
              onChange={(e) => setCurrentATR(parseFloat(e.target.value))}
              placeholder="Enter ATR value"
            />
            <Button onClick={fetchAndUpdateATR} size="sm">
              Auto Fetch
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Higher ATR → Smaller positions (to avoid whipsaws)
            Lower ATR → Bigger positions (safer market)
          </div>
        </div>

        {/* NEW: Volatility Adjustment Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            checked={useVolatilityAdjustment}
            onCheckedChange={setUseVolatilityAdjustment}
          />
          <Label>Enable Volatility-Adjusted Sizing</Label>
        </div>

        {/* NEW: Multi-TP Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            checked={useMultiTP}
            onCheckedChange={setUseMultiTP}
          />
          <Label>Use 3-Tier Partial Exit Strategy</Label>
        </div>

        {/* NEW: Drawdown Limits */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Drawdown Protection</h3>
          
          <div className="space-y-2">
            <Label>Daily Loss Limit (%)</Label>
            <Slider
              min={0.5}
              max={5}
              step={0.5}
              value={[dailyDrawdownLimit]}
              onValueChange={([v]) => setDailyDrawdownLimit(v)}
            />
            <div className="text-xs">Max loss per day: ${(10000 * dailyDrawdownLimit / 100).toFixed(0)}</div>
          </div>

          <div className="space-y-2">
            <Label>Weekly Loss Limit (%)</Label>
            <Slider
              min={1}
              max={10}
              step={0.5}
              value={[weeklyDrawdownLimit]}
              onValueChange={([v]) => setWeeklyDrawdownLimit(v)}
            />
            <div className="text-xs">Max loss per week: ${(10000 * weeklyDrawdownLimit / 100).toFixed(0)}</div>
          </div>

          <div className="space-y-2">
            <Label>Max Consecutive Losses</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxConsecutiveLosses}
              onChange={(e) => setMaxConsecutiveLosses(parseInt(e.target.value))}
            />
            <div className="text-xs">Stop trading after N losses in a row</div>
          </div>
        </div>

        {/* NEW: Account Metrics Display */}
        <div className="space-y-2 border-t pt-4 bg-slate-50 p-3 rounded">
          <h3 className="font-semibold text-sm">Today's Status</h3>
          <div className="text-xs space-y-1">
            <div>Daily Loss: ${accountMetrics.dailyLoss} / ${(10000 * dailyDrawdownLimit / 100).toFixed(0)}</div>
            <div>Weekly Loss: ${accountMetrics.weeklyLoss} / ${(10000 * weeklyDrawdownLimit / 100).toFixed(0)}</div>
            <div>Consecutive Losses: {accountMetrics.consecutiveLosses}</div>
            <div>Trades Today: {accountMetrics.todayTradeCount}</div>
          </div>
        </div>

        {/* Simulation Result */}
        {simResult && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm">Position Sizing Result</h3>
            
            {/* Volatility Adjustment */}
            <Alert className={
              simResult.volatilityAdjustment.adjustmentRatio < 1 
                ? 'border-amber-500 bg-amber-50'
                : 'border-green-500 bg-green-50'
            }>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Volatility Adjustment</AlertTitle>
              <AlertDescription>
                ATR: {simResult.volatilityAdjustment.currentATR} 
                → Multiplier: {simResult.volatilityAdjustment.adjustmentRatio}x
                → {simResult.volatilityAdjustment.note}
              </AlertDescription>
            </Alert>

            {/* Multi-TP Display */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">3-Tier Exit Strategy</h4>
              {simResult.partialExits?.map((tp, idx) => (
                <div key={idx} className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="font-semibold">Tier {tp.tier}</div>
                  <div>Take Profit: {tp.takeProfitPips} pips (1:{tp.riskRewardRatio})</div>
                  <div>Exit: {tp.exitPercentage}% of position</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSimulateOrder} className="w-full">
          Simulate Order with New Features
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

#### Step 2.2: Create Drawdown Monitor Component

```tsx
// src/components/quantumsage/DrawdownMonitor.tsx

export function DrawdownMonitor({ accountMetrics, limits }) {
  const dailyPercent = (accountMetrics.dailyLoss / (10000 * limits.daily / 100)) * 100
  const weeklyPercent = (accountMetrics.weeklyLoss / (10000 * limits.weekly / 100)) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Drawdown Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Daily Drawdown */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span>Daily: ${accountMetrics.dailyLoss} / ${(10000 * limits.daily / 100).toFixed(0)}</span>
            <span className={dailyPercent >= 80 ? 'text-red-600 font-bold' : 'text-gray-600'}>
              {dailyPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                dailyPercent >= 100 
                  ? 'bg-red-600' 
                  : dailyPercent >= 80 
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(dailyPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Weekly Drawdown */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span>Weekly: ${accountMetrics.weeklyLoss} / ${(10000 * limits.weekly / 100).toFixed(0)}</span>
            <span className={weeklyPercent >= 80 ? 'text-red-600 font-bold' : 'text-gray-600'}>
              {weeklyPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                weeklyPercent >= 100 
                  ? 'bg-red-600' 
                  : weeklyPercent >= 80 
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(weeklyPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Consecutive Losses */}
        <div className="text-xs space-y-1 border-t pt-3">
          <div>Consecutive Losses: {accountMetrics.consecutiveLosses}/3</div>
          {accountMetrics.consecutiveLosses >= 2 && (
            <Alert variant="destructive" className="text-xs">
              Approaching loss limit - consider taking a break
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Phase 3: EA/Bot Integration (1-2 Hours)

#### Step 3.1: Update Order Placement Function

```typescript
// Your trading bot or EA integration

async function placeOptimizedOrder(signal) {
  // 1. Fetch current ATR from your data source
  const currentATR = await getATR(signal.pair, signal.timeframe)

  // 2. Get account metrics
  const metrics = await getAccountMetrics()

  // 3. Call enhanced API
  const response = await fetch('/api/place-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pair: signal.pair,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      accountBalance: signal.accountBalance,
      stopLossPips: signal.stopLossPips,
      pipValuePerLot: signal.pipValuePerLot,
      riskPerTradePct: signal.riskPerTradePct,
      confidence: signal.confidence,
      currentATR, // NEW
      layerConfig: signal.layerConfig,
    }),
  })

  const orderSizing = await response.json()

  return {
    baseLots: orderSizing.baseLots,
    volatilityAdjusted: orderSizing.volatilityAdjustment.adjustmentRatio,
    partialExits: orderSizing.partialExits,
    layers: orderSizing.layers,
  }
}
```

---

#### Step 3.2: Implement Multi-TP Execution

```typescript
// Place orders with 3-tier exit strategy

async function executeWithMultiTP(sizing, signal) {
  const { baseLots, partialExits, direction } = sizing

  // Calculate actual lot sizes per tier (sum should equal baseLots)
  const lotsPerTier = partialExits.map((tp, i) => 
    baseLots * (tp.exitPercentage / 100)
  )

  // Place orders
  const orders = []

  for (let i = 0; i < partialExits.length; i++) {
    const tp = partialExits[i]
    const lots = lotsPerTier[i]
    
    const tpPrice = direction === 'Buy'
      ? signal.entryPrice + (tp.takeProfitPips * 0.0001) // Adjust for instrument
      : signal.entryPrice - (tp.takeProfitPips * 0.0001)

    const order = await placePendingOrder({
      pair: signal.pair,
      volume: lots,
      direction: direction === 'Buy' ? 0 : 1,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLossPips,
      takeProfit: tpPrice,
      comment: `TP${tp.tier}-${tp.exitPercentage}%`,
    })

    orders.push(order)
  }

  return orders
}
```

---

### Phase 4: Database Updates (Optional but Recommended)

```sql
-- Add tracking columns to your trades table
ALTER TABLE trades ADD COLUMN volatility_adjustment_ratio DECIMAL(5,2);
ALTER TABLE trades ADD COLUMN tp_tier_hit INT;
ALTER TABLE trades ADD COLUMN daily_loss_when_placed DECIMAL(12,2);
ALTER TABLE trades ADD COLUMN exit_strategy VARCHAR(50);

-- Create analytics view
CREATE VIEW trade_analytics AS
SELECT 
  DATE(created_at) as trade_date,
  COUNT(*) as total_trades,
  SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN profit_loss < 0 THEN 1 ELSE 0 END) as losses,
  AVG(volatility_adjustment_ratio) as avg_volatility_adj,
  SUM(CASE WHEN tp_tier_hit = 1 THEN 1 ELSE 0 END) as tp1_hits,
  SUM(CASE WHEN tp_tier_hit = 2 THEN 1 ELSE 0 END) as tp2_hits,
  SUM(CASE WHEN tp_tier_hit = 3 THEN 1 ELSE 0 END) as tp3_hits
FROM trades
GROUP BY DATE(created_at);
```

---

## Testing Checklist

### ✅ Unit Tests
```bash
npm run test -- risk.test.ts

# Should pass:
# ✓ Volatility adjustment
# ✓ Multi-TP calculation
# ✓ Drawdown checks
# ✓ Breakeven management
```

### ✅ API Tests
```bash
npm run test:e2e

# Should verify:
# ✓ /api/place-order with ATR parameter
# ✓ /api/signal-execute with drawdown tracking
# ✓ Response includes partialExits
# ✓ Response includes volatilityAdjustment
```

### ✅ Manual Testing (Paper Trade)
1. Set all limits (daily 2%, weekly 5%, max 3 losses)
2. Place test orders with varying ATR values
3. Verify position sizes scale correctly
4. Confirm multi-TP prices calculated properly
5. Check drawdown state tracking

### ✅ Live Trading Checklist
- [ ] Environment variables set correctly
- [ ] ATR data feeding properly
- [ ] Multi-TP orders executing at correct prices
- [ ] Drawdown tracking accumulating correctly
- [ ] Position sizing visible in UI
- [ ] Alerts firing at drawdown limits

---

## Rollout Plan

### Week 1: Setup & Testing
- Day 1-2: Code review & unit testing
- Day 3-4: Frontend integration & component testing
- Day 5: E2E testing with paper trade

### Week 2: Paper Trading
- Paper trade all 5 trading days
- Monitor volatility adjustment ratios
- Verify TP executions
- Verify drawdown tracking

### Week 3: Gradual Live Rollout
- Day 1: Go live with 25% normal position size
- Day 2-4: Monitor, increase to 50% if all good
- Day 5: Monitor for end-of-week issues

### Week 4: Full Rollout
- Scale to 75% if metrics look good
- Full 100% after 2+ weeks of successful trading

---

## Monitoring & Alerts

### Key Metrics to Track Daily
```javascript
{
  "date": "2026-01-09",
  "trades": 5,
  "wins": 3,
  "losses": 2,
  "daily_loss": 150,
  "daily_limit": 200,
  "avg_volatility_adj": 0.87,
  "tp1_hits": 2,
  "tp2_hits": 1,
  "tp3_hits": 0,
  "profit_factor": 1.45,
  "status": "Normal"
}
```

### Alert Triggers
- Daily loss > 80% of limit → ⚠️ Warning
- Daily loss >= 100% → 🔴 Stop trading
- 3 consecutive losses → 🔴 Pause 1-2 hours
- Weekly loss > 80% of limit → ⚠️ Warning
- Volatility adj < 0.5 (very high vol) → ℹ️ Info

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| ATR not updating | Verify data provider connection; check `fetchATR()` function |
| TP prices wrong | Check pip-to-price conversion; verify instrument settings |
| Drawdown not tracking | Ensure `dailyLoss`, `weeklyLoss` parameters being sent; check audit DB |
| Position size unchanged | Verify `currentATR` != baseline; check `useVolatilityAdjustment` is enabled |
| Multi-TP not executing | Verify broker supports multiple pending orders; check order comment format |

---

## Support & Documentation

- **Theory**: See `docs/sl-tp-optimization.md`
- **Setup**: See `docs/configuration-guide.md`
- **Quick Ref**: See `docs/quick-start-summary.md`
- **API Examples**: Check both API endpoint docs in `/src/pages/api/`
- **Tests**: Check `tests/unit/risk.test.ts` for function usage

---

**You're ready to integrate! Start with Phase 1 verification, then work through phases 2-4 at your pace.** 🚀
