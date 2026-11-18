# Evaluating the ML signal model

The current Genkit flows explain signals and assess settings; they do not train or emit the Buy/Sell model predictions. The prediction source is external (for example, an EA or inference service). This workflow records those actual predictions so they can be evaluated against prices observed afterward. The EMA crossover is not used as a substitute for the ML model.

## 1. Send each real model prediction to the journal

Call `POST /api/ml-signals` from the trusted server-side EA or inference service—not browser code. Use the same `SERVER_SIDE_API_KEY` and configured `TRADING_ACCOUNT_ID` as the execution service. Record each model output once, including `Hold` predictions, under a stable model version.

`signalTime` must be the time the prediction became available for trading, in ISO-8601 with a timezone. `trainingDataThrough` must reflect the latest data used to train that exact model version. The endpoint rejects predictions dated at or before that cutoff. Use the same exact broker symbol alias in model signals and the MT5 export (for example `GOLD`, not `XAUUSD`, if the broker uses `GOLD`). Send features only when appropriate for your data policy; the numeric feature snapshot is optional and limited to 128 values.

```json
{
  "signalId": "gold-h1-20261118T100000Z-v42",
  "modelId": "gold-direction-model",
  "modelVersion": "2026-11-17-v42",
  "symbol": "GOLD",
  "timeframe": "H1",
  "signal": "Buy",
  "confidence": 72.4,
  "signalTime": "2026-11-18T10:00:00Z",
  "trainingDataThrough": "2026-10-31T23:59:59Z",
  "entryPrice": 2634.15,
  "featureHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "featureSnapshot": {
    "rsi14": 54.2,
    "atr14": 16.7
  }
}
```

The server stores the account identity from configuration and records its own `receivedAt` time. A successful response is an acknowledgement of logging only; it does not place an order.

## 2. Export actual MT5 history and predictions

With MT5 open and connected to the broker, export the history using the broker's exact gold symbol:

```powershell
py -3 -m pip install MetaTrader5
py -3 scripts\export_mt5_history.py --symbol GOLD --years 5 --output data\GOLD_H1.csv
```

Download the signal journal from an authorized workstation or trusted service. Keep the key out of source control and browser code:

```powershell
$headers = @{ 'x-api-key' = $env:SERVER_SIDE_API_KEY }
Invoke-WebRequest `
  -Uri 'https://your-server.example.com/api/ml-signals?limit=50000&modelVersion=2026-11-17-v42&symbol=GOLD' `
  -Headers $headers `
  -OutFile 'data\ml-signal-journal.csv'
```

The journal is backed by the configured audit store (`AUDIT_PG_URL`, `AUDIT_DB_PATH`, or the JSONL fallback). The export is limited to the authenticated configured account and at most 50,000 recent audit rows.

## 3. Run a cost-aware forward-signal evaluation

```powershell
py -3 scripts\evaluate_ml_signals.py `
  --signals data\ml-signal-journal.csv `
  --market data\GOLD_H1.csv `
  --holding-bars 4 `
  --confidence-thresholds 0,50,60,70,80,90 `
  --spread-multiplier 1.0 `
  --slippage-points-per-side 1 `
  --commission-bps-per-side 0 `
  --output data\ml-evaluation.json
```

The evaluator:

- Uses only recorded Buy/Sell predictions, entering at the first bar open at or after `signalTime` and exiting after the selected fixed holding period.
- Allows only one position at a time; signals while a position is open are skipped.
- Applies MT5 bid-OHLC spread costs (entry spread for Buy, exit spread for Sell), plus the explicit slippage and commission assumptions.
- Compares confidence thresholds and reports trade count, win rate, mean net return, profit factor, sample break-even win rate, drawdown, and a confidence Brier score.
- Requires a single `modelId`/`modelVersion`, symbol, and timeframe per run.
- Requires the model signal symbol to match the symbol stored in the MT5 CSV.

If MT5 has no spread for some bars, pass `--spread-points` with a conservative broker-specific fallback. Vary spread multiplier, slippage, and commission to see whether results survive less favorable costs. Commission basis points are a simplified notional-based approximation, not a broker lot-fee calculation.

## Important limitations

This is a fixed-horizon evaluation of archived predictions, not a model trainer and not a complete execution simulator. It does not model stop-losses, take-profits, gaps, rejected orders, financing, or position sizing. The Brier score is meaningful only if the model's confidence is a calibrated probability. A training cutoff is useful metadata but does not prove that the model avoided leakage; verify the training pipeline and preserve strictly chronological out-of-sample predictions. Do not select a confidence threshold on one holdout and present that same holdout as independent validation. Paper trade and use a later untouched period before considering live changes.
