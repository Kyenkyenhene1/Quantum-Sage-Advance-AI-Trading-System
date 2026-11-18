# AI Copilot Instructions for Quantum Sage Advance AI Trading System

## Project Overview
Quantum Sage is a Next.js 15 + AI trading system powered by Google Genkit flows. It provides financial analysis, trade risk assessment, and signal explanation for forex traders. The frontend is a React dashboard with lazy-loaded components, while the backend handles AI operations via structured flows with caching, rate limiting, and observability. External MQL5 Expert Advisors (EAs) integrate via REST APIs for order placement and trade management.

## Architecture Patterns

### AI Flow Pattern
All AI operations follow a standardized pattern in `src/ai/flows/`:
1. Define Zod schemas for input/output in `src/ai/types.ts`
2. Create a flow using `ai.defineFlow()` with the schemas
3. Wrap the flow with: rate limiting (`rateLimit()`), caching (`aiCacheGetAuto/aiCacheSetAuto`), and metrics (`recordAICallStart/End`)
4. Use `'use server'` directive for server-side execution
5. Call `initServerSentry()` for error tracking

**Example pattern** (from `analyze-trading-news.ts`):
- Input validation → cache check → rate limit check → retry wrapper → LLM call → cache store → metrics recording

### Data Persistence Layer
- **SQLite** (`src/lib/auditDb.ts`): Write-ahead logging (WAL) mode for audit trails; use `better-sqlite3` with prepared statements
- **PostgreSQL** (`src/lib/auditPg.ts`): For production scalability (uses `pg` driver); initialize with `scripts/init-audit-pg.js`
- **Redis** (`src/lib/redisClient.ts`): Distributed cache/rate limiting when `REDIS_URL` is set; falls back to in-memory storage in development
- **Firebase**: Real-time auth/data (configured but secondary to custom auth via `src/pages/api/auth/[...nextauth].ts`)

### Resilience & Observability
- **Genkit Flows**: Automatically instrumented for OpenTelemetry tracing
- **Sentry**: Client config in `sentry.client.config.js`, server in `sentry.server.config.js`; controlled by `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
- **Metrics**: Prometheus-compatible endpoint at `/api/ai-metrics` (protected by `AI_METRICS_API_KEY`); records AI call latencies and counts; also `/api/metrics` for execution metrics
- **Rate Limiting**: Global AI rate limit via `AI_GLOBAL_RATE_LIMIT` env (default 200 req/min); both in-memory and Redis adapters available; per-account daily trade caps enforced

### Trade Execution Flow
- **Risk Calculation**: `/api/place-order` (public, proposes sizing) → `/api/signal-execute` (validates + auto-executes if approved) → `/api/execute-order` (forwards to broker executor)
- **Position Sizing** (`src/lib/risk.ts`): Formula-based (lot size = (account_balance × risk_pct) / (SL_pips × pip_value))
- **Layering**: Support for up to 4 additional layered entries with configurable spacing/scaling factors; aggregate risk capped at `maxAggregateRiskPct`
- **Trade Management**: Breakeven stop-loss moves and dynamic SL types (ATR-based, Structure-based, Fixed Pips)

## Testing & Build

### Test Commands
- **Unit tests**: `npm run test` (Vitest with jsdom)
- **E2E tests**: `npm run test:e2e` (Playwright)
- **Docker tests**: `npm run test:compose` (runs all tests in container with Redis + PostgreSQL; requires compose test yml)
- **Type checking**: `npm run typecheck`
- **Linting**: `npm run lint` (ESLint + Prettier)

### Development Workflows
- **Local dev with Turbopack**: `npm run dev` (Next.js 15 with optimized bundling)
- **Genkit dev server**: `npm run genkit:dev` or `npm run genkit:watch` (interactive flow testing UI at localhost:4000)
- **Bundle analysis**: `npm run analyze` (requires `@next/bundle-analyzer`)
- **Local Docker setup**: `docker-compose up --build` (runs app + Redis + monitoring); `docker-compose.test.yml` for test environment
- **Native tests**: Install build tools for `better-sqlite3` (Windows: Visual Studio Build Tools with C++ workload; macOS/Linux: build-essential)

## Key Conventions & Patterns

### Component Structure
- **Lazy loading**: Dashboard components use `Lazy*` wrappers (e.g., `LazyChartDisplay`, `LazyTechnicalIndicatorsCard`) to reduce initial bundle size; see `src/components/quantumsage/`
- **UI library**: shadcn/ui (Radix primitives + Tailwind); components in `src/components/ui/`
- **Forms**: React Hook Form + Zod validation; see `src/components/quantumsage/` for domain components (RiskManagementCard, TradingSignalsCard, etc.)
- **State management**: Local state with hooks; session storage for auth (placeholder); API calls via `fetch()`

### Risk Management Constants
Key files: `src/lib/risk.ts`, `src/components/quantumsage/RiskManagementCard.tsx`, `docs/risk-management.md`
- **Default values**: riskPerTradePct = 1%, maxDailyTrades = 10, layers = 1–3, spacingPips = 25
- **Stop Loss Types**: ATR Based, Structure Based, Fixed Pips, Moving Average, Percentage, Previous High/Low, Time-Based
- **Take Profit Ratios**: 1:1 through 1:1000, Trailing TP, Dynamic (ML)
- **Breakeven Threshold**: Default 20 pips profit to move SL to entry
- **Validation**: Aggregate risk must not exceed maxAggregateRiskPct (default 2%) after layering

### Environment Validation
All env vars validated at runtime via Zod in `src/lib/env.ts`. Key vars:
- `NEXT_PUBLIC_SENTRY_DSN`: Client-side error tracking
- `SENTRY_DSN`: Server-side error tracking
- `REDIS_URL`: Optional; enables distributed cache/rate limiting
- `AI_METRICS_API_KEY`: Protects `/api/ai-metrics` endpoint
- `AI_GLOBAL_RATE_LIMIT`: Requests per minute (default 200)
- `AUDIT_DB_PATH`: Path to SQLite audit log (default `./logs/audit.db`)
- `AUDIT_PG_URL`: PostgreSQL connection string (preferred for production)
- `SERVER_SIDE_API_KEY`: Optional API key for `/api/execute-order` auto-execute protection
- `ORDER_EXECUTOR_URL` + `ORDER_EXECUTOR_API_KEY`: Broker executor endpoint for live orders
- `OTEL_EXPORTER_OTLP_ENDPOINT`: Optional; OTLP collector for trace export (default: ConsoleSpanExporter)

### API Endpoints
- `/api/health`: Readiness/liveness probe (for deployment platforms)
- `/api/ai-metrics`: Prometheus metrics export (protected by `AI_METRICS_API_KEY`; Bearer or x-api-key header)
- `/api/metrics`: General execution metrics (same protection)
- `/api/audit`: Fetch audit logs (uses `auditDb` or `auditPg` depending on config)
- `/api/place-order`: POST; proposes order sizing and layers (public; returns baseLots, layers, totalRisk)
- `/api/signal-execute`: POST; executes signal with optional auto-execute if confidence ≥ threshold
- `/api/execute-order`: POST; forwards approved order to broker executor (protected by `SERVER_SIDE_API_KEY`)

## MQL5 Expert Advisor Integration

### Overview
EAs communicate with Quantum Sage via REST API to obtain:
1. **Sizing proposals** from `/api/place-order` (lot calculations respecting risk rules)
2. **Signal approvals** from `/api/signal-execute` (with optional auto-execution)
3. **Order placement** via `/api/execute-order` (forwarded to broker MT5 bridge)

### Key Configuration
- **Strategies**: ML Core (EMA crossover placeholder), Royal Structure (MSS + OB), Kyenkyenhene Hybrid (liquidity sweep + FVG + MSS)
- **Risk Management**: Dynamic SL cycling, Breakeven moves at configurable pips, Layering with scaling factors
- **Web API** (built into EA): `/api/status` (account/trades), `/api/update-settings`, `/api/start-bot`, `/api/stop-bot`
- **Documentation**: See `docs/mql5-generation-prompt.md` for full EA spec; example webhook snippet in `docs/risk-management.md`

## Troubleshooting & Debugging

### Common Issues
1. **"AI rate limit exceeded"**: Check `AI_GLOBAL_RATE_LIMIT` env; confirm Redis (`REDIS_URL`) is running for distributed limit; verify no concurrent burst of requests
2. **Audit log queries fail**: Ensure `AUDIT_DB_PATH` or `AUDIT_PG_URL` is set and DB is initialized (`npm run scripts/init-audit-pg.js` for Postgres)
3. **Metrics not exported**: Verify `AI_METRICS_API_KEY` matches request header; check `/api/metrics` or `/api/ai-metrics` endpoint is accessible
4. **Genkit flows timeout**: Check network; verify LLM API key is valid; use `npm run genkit:dev` to debug interactively
5. **Position sizing errors**: Validate `stopLossPips > 0` and `pipValuePerLot > 0`; check aggregate risk vs `maxAggregateRiskPct`

### Debugging Tools
- **Local Genkit UI**: `npm run genkit:dev` → http://localhost:4000 (interactive flow testing, trace inspection)
- **Sentry Dashboard**: Check error groups, sessions, and release info; filter by environment/version
- **SQLite Audit**: `sqlite3 logs/audit.db "SELECT * FROM audit ORDER BY id DESC LIMIT 10;"`
- **Redis CLI**: `redis-cli` to inspect cache keys, rate limit counters
- **Logs**: Console output; check `docker-compose logs -f <service>` for container logs
- **Metrics**: `curl -H "x-api-key: $AI_METRICS_API_KEY" http://localhost:3000/api/ai-metrics` (Prometheus text format)

### Observability Stacks
- **Traces**: OpenTelemetry via `src/lib/tracing.ts`; set `OTEL_EXPORTER_OTLP_ENDPOINT` to send to backend (Jaeger, Datadog, etc.)
- **Audit Retention**: Use PostgreSQL for queryability; SQLite for lightweight staging; JSONL for fallback
- **Alerting**: Monitor `/api/health` (readiness), `/api/metrics` (execution latency), Sentry DSN (error rate)

## File Organization Quick Reference
- **Flows** (`src/ai/flows/`): `analyze-trading-news`, `assess-risk-settings`, `explain-trading-signal`, `generate-chart-image`
- **Shared types** (`src/ai/types.ts`): Zod schemas for all flows
- **Risk management** (`src/lib/risk.ts`): Position sizing, layering, aggregate risk helpers
- **Trade endpoints** (`src/pages/api/place-order.ts`, `signal-execute.ts`, `execute-order.ts`): Order processing pipeline
- **Dashboard UI** (`src/components/quantumsage/`): Trading cards, charts, risk controls, strategy selection
- **Backend utilities** (`src/lib/`): Auth, cache, metrics, audit, tracing, rate limiting, Sentry, trade helpers
- **Tests** (`tests/`): Unit tests (risk, audit), E2E tests (health, metrics)
- **Documentation** (`docs/`): Risk management, observability, testing, MQL5 generation prompt

## Common Tasks

### Adding a New AI Flow
1. Define input/output Zod schemas in `src/ai/types.ts`
2. Create `src/ai/flows/my-flow.ts` with pattern from existing flows (use server directive, initServerSentry, metrics/cache/rateLimit wrapping)
3. Import in `src/ai/dev.ts` (for genkit CLI access)
4. Test with `npm run genkit:dev` (Genkit UI), write tests in `tests/unit/` or `tests/e2e/`
5. Update docs if flow has user-facing parameters

### Modifying Risk Calculations
1. Update default values or formulas in `src/lib/risk.ts` functions (computePositionSize, computeAggregateRisk, etc.)
2. Update `RiskManagementCard.tsx` UI to expose new parameters if needed
3. Add/update tests in `tests/unit/risk.test.ts`
4. Document changes in `docs/risk-management.md`

### Debugging Production Issues
- Use `npm run genkit:dev` to trace flows interactively locally
- Check Sentry for production errors with release/version filtering
- Query audit logs via `/api/audit` endpoint or SQLite/Postgres directly
- Monitor Prometheus metrics for latency spikes or error rate increases
- Review EA logs via `/api/status` endpoint (MQL5 web server response)

### Deployment Checklist
- CI pipeline (`.github/workflows/ci.yml`): Lints, typechecks, builds on every PR/push to main
- Set deployment secrets: `SENTRY_DSN`, `REDIS_URL`, `AI_METRICS_API_KEY`, `SERVER_SIDE_API_KEY`, `ORDER_EXECUTOR_URL`, `AUDIT_PG_URL`
- Configure Postgres for audit logs: `scripts/init-audit-pg.js <PG_URL>` before app starts
- Health endpoint `/api/health` must return 200 for readiness probes
- Use release tag in Sentry: `SENTRY_RELEASE` or `GITHUB_SHA` env var
- Optional: Configure OTEL collector endpoint for trace export
- Test locally with `docker-compose up --build` and `npm run test:compose` before deploying
