# Quantum Sage Advance AI Trading System

Quantum Sage is a Next.js trading dashboard and API with Genkit-powered analysis flows, risk-sizing helpers, audit/metrics support, and REST integration for external trading systems.

> **Trading risk:** This software does not guarantee profitability. Keep the system in paper-trading mode until you have validated your own strategy with broker data, realistic costs, and out-of-sample results. Never commit credentials or expose server-side execution keys to browser code.

## Requirements

- Node.js 18 or later
- npm
- Python 3 for the optional ML prediction evaluator and MT5 history exporter
- MetaTrader 5 terminal and broker account for exporting broker history

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set the required local environment values in `.env.local` before enabling AI or execution integrations. Do not commit `.env.local`.

## Validation

```powershell
npm run typecheck
npm run test -- --run
py -3 -m unittest discover -s tests\python -v
```

## ML signal evaluation

The project does not include or train the external Buy/Sell model. It includes an authenticated signal journal and evaluator for predictions produced by your actual model. See [docs/ml-evaluation.md](docs/ml-evaluation.md) for recording predictions, exporting broker OHLC/spread data, and evaluating out-of-sample performance with explicit cost assumptions.

## Security and operations

- Configure `SERVER_SIDE_API_KEY`, `TRADING_ACCOUNT_ID`, `ORDER_EXECUTOR_URL`, and `ORDER_EXECUTOR_API_KEY` only in trusted server environments.
- Read [docs/configuration-guide.md](docs/configuration-guide.md), [docs/risk-management.md](docs/risk-management.md), and [DEPLOYMENT.md](DEPLOYMENT.md) before connecting a live executor.
- Historical evaluations are exploratory, not a promise of future returns. Include spread, slippage, commissions, and a later untouched validation period.
