# Risk Management: SL/TP and Layering (Pyramiding)

This document summarizes recommended practices for stop-loss (SL), take-profit (TP), and number/size of layers (pyramiding) for the QuantumSage system. It includes practical formulas, concrete examples, and implementation guidance you can adopt in `src/lib/risk.ts`.

## Key Principles

- Risk per trade (account-level): prefer 0.5%–2% of account equity per directional trade. 1% is a common default.
- Maximum aggregated exposure (when using layers) should be bounded — total potential loss across all layers must not exceed a chosen cap (e.g., 2% of equity).
- Stop loss should be set using volatility (ATR) or meaningful technical levels, not arbitrarily. Express SL in pips.
- Typical TP strategies:
  - Fixed R:R: e.g., 1:2 (TP = 2 × SL distance) or 1:3 if higher conviction.
  - Multi-target exits: partial take-profits at 0.5R, 1R, 2R to secure profit and free up risk.
  - Dynamic TP tied to ATR or support/resistance levels.
- Layering (pyramiding): prefer adding smaller layers as price moves in favor of the trade (scale-in on winners). Avoid averaging down without strict rules.

## Layers: Recommended Defaults

- Conservative: 1 (no layering) or up to 2 layers (initial + 1 add) with decreasing sizes.
- Moderate: up to 3 layers (initial + 2 adds). Typical scaling factors (relative): [1, 0.6, 0.4] (sum normalized).
- Aggressive / experienced-only: up to 4 layers, but total risk must be capped and lot sizing must decrease geometrically.

Layer spacing guidance:
- Use ATR: spacing ≈ 0.5–1.0 × ATR for momentum-based layering.
- Fixed pip spacing: choose spacing that avoids immediate re-triggering; 0.5×ATR or at least a few pips greater than spread.

Scaling pattern:
- For pyramiding into a winning move (recommended): keep layer sizes decreasing. Example scaling factors: [1.0, 0.6, 0.4].
- For averaging down (if allowed): make layer sizes tiny and cap total risk strictly (e.g., per-trade cap 1–1.5%). Avoid increasing lot sizes after adverse moves.

## Position Sizing Formula

Base lots for a single entry:

lots = (accountBalance × riskPerTradePct) / (stopLossPips × pipValuePerLot)

- Example: accountBalance = $10,000, riskPerTradePct = 1% (0.01), stopLossPips = 50, pipValuePerLot = $10 (1 lot → $10/pip)
  - riskAmount = 10,000 × 0.01 = $100
  - lots = 100 / (50 × 10) = 100 / 500 = 0.2 lots

If using 3 layers with decreasing sizes, compute lots per layer using `splitLotsForLayers` in `src/lib/risk.ts` which normalizes scaling factors and returns layer lot sizes whose aggregate exposure can be calculated.

## Aggregated Risk and Caps

- After splitting lots per layer, compute the worst-case loss (if all layers get stopped) as the sum over layers: lots_i × stopLossPips × pipValuePerLot.
- Ensure `totalWorstCaseLoss ≤ accountBalance × maxAggregateRiskPct` (e.g., 2%). If not, reduce base lots or reduce number of layers.

## Take-Profit Strategies

- Single TP at fixed R:R (e.g., 1:2) — simple and acceptable.
- Multi TP / partial exits (recommended):
  - Exit 30% at 0.5R, 40% at 1R, 30% at 2R. This secures profits while letting a portion run.
  - Alternatively, use ATR multiples: TP1 = 0.5–1 ATR, TP2 = 2 ATR.

## Example Walkthrough

Given:
- Account = $10,000
- Risk per trade = 1%
- Stop loss = 50 pips
- Pip value per lot = $10
- Layers = 3, spacing = 25 pips, scaling (default): [1, 0.6, 0.36]

Compute base lots: lots = 100 / (50 × 10) = 0.2 lots
Split into layers (approx): [0.2, 0.12, 0.08]
Total worst-case loss = (0.2 + 0.12 + 0.08) × 50 × 10 = 0.4 × 500 = $200 (2% of account) → if your max aggregate risk is 2% this is acceptable; otherwise reduce base lots.

## Implementation guidance for the app

- Provide user-configurable defaults: `riskPerTradePct`, `maxAggregateRiskPct`, `layers`, `spacingPips`, `scalingFactors`.
- Default conservative values: riskPerTradePct = 1; maxAggregateRiskPct = 2; layers = 1–3; spacing = 0.5 ATR.
- Enforce guards: before placing an order, compute `totalWorstCaseLoss` and block order if exceeds `maxAggregateRiskPct`.
- Prefer scaling-in on winners (add layers when initial trade is in profit by a threshold) rather than averaging down into losses.

### Redis / Multi-instance Counters

- For production deployments with more than one app instance (or any horizontally scaled setup), use Redis for atomic per-account daily execution counters and rate-limits. The app will use the `REDIS_URL` environment variable when present and fall back to an in-memory counter for local development.
- Recommended `REDIS_URL` examples:
  - `redis://redis:6379` (Docker compose / local)
  - `redis://:PASSWORD@redis.example.com:6379/0` (production with password)
- When `REDIS_URL` is set, the server will use Redis INCR + EXPIRE semantics to maintain daily counts. Ensure your deployment sets `REDIS_URL` (or a managed Redis service connection string) and that the Redis instance is secured and not publicly exposed.

Add or verify `REDIS_URL` in your `.env`/secrets store. The included `.env.example` contains a `REDIS_URL=` entry as a reminder.

## Next steps suggested

1. Add/configure ATR calculation in your data pipeline and expose it to the risk UI.
2. Integrate `src/lib/risk.ts` functions into the strategy control flow to compute allowed lots and verify aggregate risk before sending orders.
3. Add a UI control for multi-TP partial exit rules.
4. Add unit tests for `src/lib/risk.ts` with common currency examples and edge cases (stopLossPips=0, tiny pipValue, etc.).

---

For a concrete code-assisted integration I added `src/lib/risk.ts` with helper functions. You can call `simulatePyramid(...)` to get a quick summary in the server environment (or a small Node script) to validate defaults before executing live orders.

## API Integration Example

You can call the app's server endpoint `POST /api/place-order` to get a proposed sizing and layer plan before sending orders to your execution layer. Example request (JSON):

```json
{
  "pair": "EURUSD",
  "direction": "Buy",
  "entryPrice": 1.1023,
  "accountBalance": 10000,
  "stopLossPips": 50,
  "pipValuePerLot": 10,
  "riskPerTradePct": 1,
  "layerConfig": { "layers": 3, "spacingPips": 25 }
}
```

The endpoint returns a structured JSON containing `baseLots`, `totalLots`, `totalRisk` and a `layers` array with per-layer suggested lots and pip offsets. Use the `priceOffsetPips` values to convert to instrument price units (pip-size differs across instruments).

## Example MQL5 Webhook (EA) Snippet

If your external EA places orders, call the `/api/place-order` endpoint first to obtain allowed sizing. The following MQL5 snippet demonstrates a simple HTTP POST and parsing the JSON response (simplified):

```mql5
// Pseudo-code for MQL5 (replace with proper MQL5 HTTP functions)
string url = "https://your-server.example.com/api/place-order";
string body = "{\"pair\":\"EURUSD\",\"direction\":\"Buy\",\"entryPrice\":1.1023,\"accountBalance\":10000,\"stopLossPips\":50,\"pipValuePerLot\":10,\"riskPerTradePct\":1,\"layerConfig\":{\"layers\":3,\"spacingPips\":25}}";
string response = HttpPostJson(url, body); // replace with WebRequest or WinHttp in MQL5
// Parse `response` JSON and extract `baseLots` and `layers`
// Use those values when calling OrderSend or equivalent
```

Note: the EA must have network access and handle authentication if your endpoint is protected. Use HTTPS and an API key or HMAC signing for production.

## Securing the Flow

Execution endpoints require the server-side `SERVER_SIDE_API_KEY`; a dashboard login or the executor's `ORDER_EXECUTOR_API_KEY` does not authorize an order. Never expose `SERVER_SIDE_API_KEY` in browser code. Set `TRADING_ACCOUNT_ID` so daily limits and audit records are bound to a server-configured account rather than a caller-supplied ID. Keep broker balance and loss figures sourced from a trusted EA/service.

Use HTTPS, strong credentials, and rotate keys periodically. For production multi-account deployments, map each credential to a server-verified broker account rather than sharing a single service key across accounts.

## Putting it all together (recommended)

1. A client or EA calls `POST /api/place-order` to obtain suggested sizing and layers.
2. A trusted server-side EA reviews the proposal and builds an `/api/execute-order` payload containing the validated order fields (`pair`, `direction`, `entryPrice`, `accountBalance`, `pipValuePerLot`, `stopLossPips`, `baseLots`, `totalLots`, and `layers`). Call it with `x-api-key` or `Authorization: Bearer` using `SERVER_SIDE_API_KEY`. Never make this request from browser code. The server binds the configured account ID, enforces risk/daily limits, and forwards to the executor configured in `ORDER_EXECUTOR_URL`.
3. Server returns executor response and logs the action for audit (Sentry/metrics).

## Next steps for production

- Add audit logging for all `execute-order` calls.
- Enforce per-user / per-account rate limits and daily trade caps in the server.
- Add integration tests that run against a staging executor endpoint.
