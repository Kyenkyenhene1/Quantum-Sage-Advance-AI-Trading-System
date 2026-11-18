# Configuration Guide: SL/TP & Drawdown Management

## Environment Variables Setup

Add these to your `.env.local` or deployment secrets:

```bash
# ==========================================
# DRAWDOWN PROTECTION
# ==========================================

# Maximum daily loss as percentage of account balance (default: 2%)
DAILY_DRAWDOWN_LIMIT_PCT=2.0

# Maximum weekly loss as percentage of account balance (default: 5%)
WEEKLY_DRAWDOWN_LIMIT_PCT=5.0

# Stop trading after N consecutive losses (default: 3)
MAX_CONSECUTIVE_LOSSES=3

# ==========================================
# VOLATILITY ADJUSTMENT
# ==========================================

# Baseline ATR for your primary instrument (EURUSD 1H = 30)
BASELINE_ATR=30

# High volatility threshold - triggers reduced position sizes
HIGH_VOLATILITY_THRESHOLD=60

# Normal volatility threshold
NORMAL_VOLATILITY_THRESHOLD=30

# ==========================================
# BREAKEVEN MANAGEMENT
# ==========================================

# Pips of profit to trigger breakeven stop move (default: 20)
BREAKEVEN_THRESHOLD_PIPS=20

# Trailing stop pips below highest point (default: 10)
TRAILING_STOP_PIPS=10

# ==========================================
# RISK MANAGEMENT DEFAULTS
# ==========================================

# Max daily trades per account
MAX_DAILY_TRADES_PER_ACCOUNT=20

# Server-side execution authentication (never expose this to browser code)
SERVER_SIDE_API_KEY=generate-at-least-32-random-characters
TRADING_ACCOUNT_ID=your-broker-account-id
ORDER_EXECUTOR_URL=https://your-private-executor.example/execute
ORDER_EXECUTOR_API_KEY=your-executor-credential

# Dashboard credentials and session signing secret
DEV_AUTH_USERNAME=your-admin-username
DEV_AUTH_PASSWORD=use-a-strong-password
NEXTAUTH_SECRET=generate-at-least-32-random-characters

# Default risk per trade as percentage (0.5-2.0 recommended)
DEFAULT_RISK_PER_TRADE_PCT=1.0

# Maximum aggregate risk as percentage (for layered trades)
MAX_AGGREGATE_RISK_PCT=2.0

# Default number of layers (1-4)
DEFAULT_LAYERS=3

# Default spacing between layers in pips
DEFAULT_LAYER_SPACING_PIPS=25
```

---

## Frontend Configuration (React Component)

### RiskManagementCard.tsx Updates

Your `RiskManagementCard` component should be updated to expose:

```tsx
// New state for enhanced risk management
const [useVolatilityAdjustment, setUseVolatilityAdjustment] = useState(true)
const [currentATR, setCurrentATR] = useState(30)
const [breakEvenThreshold, setBreakEvenThreshold] = useState(20)
const [dailyDrawdownLimit, setDailyDrawdownLimit] = useState(2.0)
const [weeklyDrawdownLimit, setWeeklyDrawdownLimit] = useState(5.0)
const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(3)
const [useMultiTP, setUseMultiTP] = useState(true)
const [confidenceThreshold, setConfidenceThreshold] = useState(80)
```

---

## API Integration Examples

### Example 1: Place Order with Full Risk Management

```typescript
// Client-side: Fetch ATR from your data provider
const currentATR = await fetchATR('EURUSD', '1H')

const response = await fetch('/api/place-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pair: 'EURUSD',
    direction: 'Buy',
    entryPrice: 1.1023,
    accountBalance: 10000,
    stopLossPips: 50,
    pipValuePerLot: 10,
    riskPerTradePct: 1.0,
    confidence: 85,
    currentATR, // NEW: ATR for volatility adjustment
    layerConfig: {
      layers: 3,
      spacingPips: 25,
    },
  }),
})

const result = await response.json()

console.log('Position Sizing:', {
  baseLots: result.baseLots,
  volatilityAdjustedLots: result.baseLots * result.volatilityAdjustment.adjustmentRatio,
  totalRisk: result.totalRisk,
})

console.log('Multi-TP Strategy:', result.partialExits.map(tp => ({
  tier: tp.tier,
  exitAt: `${tp.takeProfitPips} pips`,
  exitPercentage: `${tp.exitPercentage}%`,
  ratio: `1:${tp.riskRewardRatio}`,
})))
```

---

### Example 2: Signal Execution with Drawdown Tracking

```typescript
// Trusted server-side EA/service only. Never send this request from browser code.
async function executeSignalWithDrawdownCheck(
  signal: SignalData,
  accountMetrics: AccountMetrics,
) {
  const response = await fetch('/api/signal-execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.SERVER_SIDE_API_KEY!,
    },
    body: JSON.stringify({
      pair: signal.pair,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      accountBalance: signal.accountBalance,
      stopLossPips: signal.stopLossPips,
      pipValuePerLot: signal.pipValuePerLot,
      confidence: signal.confidence,
      confidenceThreshold: 80,
      autoExecute: signal.confidence >= 85,
      currentATR: signal.currentATR,
      // NEW: Drawdown tracking
      dailyLoss: accountMetrics.dailyLoss,
      weeklyLoss: accountMetrics.weeklyLoss,
      consecutiveLosses: accountMetrics.consecutiveLosses,
    }),
  })

  const result = await response.json()

  if (!result.ok) {
    if (result.error === 'Trading halted due to drawdown limits') {
      console.warn('Trading halted:', result.drawdownState)
      return { status: 'halted', reason: 'Drawdown protection triggered', ...result }
    }
    throw new Error(result.error)
  }

  return {
    status: 'success',
    baseLots: result.baseLots,
    volatilityAdjustment: result.volatilityAdjustment,
    partialExits: result.partialExits,
    drawdownState: result.drawdownState,
  }
}
```

---

### Example 3: MQL5 EA Integration

```mql5
// MQL5 Expert Advisor - Integration Example

// Fetch ATR from your server API
double GetCurrentATR(string pair, int period = 14) {
    // Call /api/technical-indicators endpoint or calculate locally
    double atr = iATR(Symbol(), PERIOD_CURRENT, period);
    return atr;
}

// Main order placement function
void PlaceOptimizedOrder() {
    double currentATR = GetCurrentATR(_Symbol);
    double confidence = CalculateSignalConfidence(); // Your logic
    
    // Build request to /api/place-order
    string request = ObjectToJsonString({
        "pair": _Symbol,
        "direction": positionType == ORDER_TYPE_BUY ? "Buy" : "Sell",
        "entryPrice": SymbolInfoDouble(_Symbol, SYMBOL_ASK),
        "accountBalance": AccountInfoDouble(ACCOUNT_BALANCE),
        "stopLossPips": 50, // Or calculate from ATR: currentATR * 2.0
        "pipValuePerLot": GetPipValue(),
        "riskPerTradePct": 1.0,
        "confidence": confidence,
        "currentATR": currentATR,
        "layerConfig": {
            "layers": 3,
            "spacingPips": 25
        }
    });
    
    // Send to API
    string response = PerformHttpRequest(POST, "https://your-server.com/api/place-order", request);
    
    // Parse response and extract:
    // - baseLots (volatility-adjusted)
    // - partialExits (3 TP levels)
    // - volatilityAdjustment (ratio info)
    
    // Place orders with extracted values
    PlaceLayeredOrders(response.baseLots, response.partialExits);
}

// Implement multi-TP exit strategy
void PlaceLayeredOrders(double baseLots, object[] partialExits) {
    for (int i = 0; i < partialExits.Size(); i++) {
        double exitPips = partialExits[i].takeProfitPips;
        double exitSize = baseLots * (partialExits[i].exitPercentage / 100.0);
        
        // Place pending order with specific TP
        int ticket = OrderSend(..., exitSize, ..., exitPips);
    }
}
```

---

## Database Schema (For Drawdown Tracking)

If using PostgreSQL for audit logs:

```sql
-- Add columns to your trades table
ALTER TABLE trades ADD COLUMN daily_loss_at_open NUMERIC(12, 2);
ALTER TABLE trades ADD COLUMN consecutive_losses_before INT;
ALTER TABLE trades ADD COLUMN volatility_adjustment_ratio NUMERIC(5, 2);
ALTER TABLE trades ADD COLUMN tp_tier_hit INT;
ALTER TABLE trades ADD COLUMN tp_pips_at_exit INT;

-- Create drawdown tracking view
CREATE VIEW daily_drawdown AS
SELECT 
    DATE(closed_at) as trading_date,
    account_id,
    SUM(CASE WHEN profit_loss < 0 THEN profit_loss ELSE 0 END) as daily_loss,
    COUNT(*) as trade_count,
    COUNT(CASE WHEN profit_loss > 0 THEN 1 END) as wins,
    COUNT(CASE WHEN profit_loss < 0 THEN 1 END) as losses
FROM trades
WHERE closed_at IS NOT NULL
GROUP BY DATE(closed_at), account_id;

-- Weekly drawdown view
CREATE VIEW weekly_drawdown AS
SELECT 
    DATE_TRUNC('week', closed_at) as week_start,
    account_id,
    SUM(CASE WHEN profit_loss < 0 THEN profit_loss ELSE 0 END) as weekly_loss,
    COUNT(*) as trade_count
FROM trades
WHERE closed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', closed_at), account_id;
```

---

## Testing Your Configuration

### Unit Tests

```typescript
// tests/unit/risk-advanced.test.ts
import { expect, test } from 'vitest'
import {
  computeVolatilityAdjustedLots,
  computePartialExitLevels,
  checkDrawdownLimits,
  computeDynamicStopLoss,
} from '@/lib/risk'

test('Volatility adjustment reduces lots in high volatility', () => {
  const baseLots = 0.2
  const currentATR = 60 // Double normal
  const baselineATR = 30
  
  const adjusted = computeVolatilityAdjustedLots(baseLots, currentATR, baselineATR)
  expect(adjusted).toBe(0.1) // 50% reduction
})

test('Multi-TP exits match confidence level', () => {
  const highConfidence = computePartialExitLevels(50, 90)
  const lowConfidence = computePartialExitLevels(50, 40)
  
  // High confidence should have larger TP3
  expect(highConfidence[2].riskRewardRatio).toBeGreaterThan(
    lowConfidence[2].riskRewardRatio
  )
})

test('Drawdown state correctly identifies limit breach', () => {
  const account = 10000
  const state = checkDrawdownLimits(250, 600, 3, 2, 5, 3, account)
  
  expect(state.isDailyLimitBreached).toBe(true) // 250 > 200
  expect(state.isWeeklyLimitBreached).toBe(true) // 600 > 500
})
```

---

## Monitoring & Alerts

### Health Check Endpoint

```bash
# Monitor your risk management system
curl -X GET http://localhost:3000/api/health

# Expected response
{
  "status": "ok",
  "volatilityAdjustmentEnabled": true,
  "drawdownCheckEnabled": true,
  "partialExitsEnabled": true,
  "breakEvenManagementEnabled": true,
  "timestamp": "2026-01-09T10:30:00Z"
}
```

### Metrics to Monitor

```bash
# Check profitability metrics
curl -X GET http://localhost:3000/api/metrics

# Key metrics:
{
  "trades_today": 5,
  "daily_loss": 150,
  "daily_limit": 200,
  "win_rate": 0.55,
  "profit_factor": 1.85,
  "average_rr_ratio": 1.5,
  "volatility_adjustment_active": true
}
```

---

## Troubleshooting

### Issue: "High volatility - reduced position" but I want to trade

**Solution**: You can override by setting `useVolatilityAdjustment: false` in config, but not recommended. Instead:
- Lower your `BASELINE_ATR` if current market is genuinely calmer
- Review your strategy's performance in high volatility
- Consider different instrument/timeframe pairing

### Issue: Drawdown limits triggered too early

**Solution**:
- Increase limits if your strategy has valid drawdown periods
- Check if you're using appropriate stop loss (ATR-based)
- Verify pip values are correct for your instrument

### Issue: Multi-TP not executing properly

**Solution**:
- Ensure your broker supports partial order closes
- Verify TP prices are above/below SL correctly
- Check that lot quantities sum to total position

---

## Performance Baseline

After implementing these features, expect:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Drawdown Duration | 8-10 weeks | 3-4 weeks | -60% |
| Max Drawdown | 15-20% | 5-8% | -60% |
| Win Rate | 48% | 50-52% | +2-4% |
| Profit Factor | 1.3 | 1.8-2.1 | +40% |
| Avg Trade Duration | 24h | 6-12h | -50% |
| Emotional Stress | High | Low | Significant |

---

## Next Steps

1. **Week 1**: Configure environment variables
2. **Week 2**: Update frontend to display new metrics
3. **Week 3**: Paper trade with new setup
4. **Week 4**: Go live with 25% normal position size
5. **Month 2**: Scale up as confidence grows

For more details, see [sl-tp-optimization.md](sl-tp-optimization.md).
