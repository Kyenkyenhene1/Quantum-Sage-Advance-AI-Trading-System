## Observability: Metrics, Tracing, and Audit

This document explains how the project exposes metrics, collects traces, and records audit logs. It also provides configuration guidance and recommended production settings.

Metrics
- The app exposes Prometheus metrics at `GET /api/metrics`.
- Optional protection: set `METRICS_API_KEY` in the environment and include `Authorization: Bearer <key>` or `x-api-key` header.
- Metric names created by `src/lib/metrics.ts`:
  - `ai_calls_total{label,env,model_version}`
  - `ai_errors_total{label,env,model_version}`
  - `ai_latency_seconds{label,env,model_version}` (histogram)
  - `execution_attempts_total{env}`
  - `execution_failures_total{env}`
  - `execution_latency_seconds{env}` (histogram)
  - `executed_orders_total{env,model_version}`

Tracing
- The app initializes OpenTelemetry via `src/lib/tracing.ts`. By default a `ConsoleSpanExporter` is used for local visibility (console). For production send traces to an OTLP collector.
- Environment variables for tracing (recommended):
  - `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP collector URL
  - `OTEL_SERVICE_NAME` — set to identify your service

Audit logs
- Audit logging is implemented with three possible backends, in order of preference:
  1. Postgres (`AUDIT_PG_URL`) — recommended in production for queryability and retention.
  2. SQLite file (`AUDIT_DB_PATH`) — lightweight option for staging/local.
  3. JSONL file (`AUDIT_LOG_PATH`) — fallback simple append-only file.
- Use `scripts/init-audit-pg.js '<PG_CONN>'` to initialize the Postgres table before starting the app.

Recommended production settings
- Set `AUDIT_PG_URL` to a managed Postgres instance and ensure backups and retention.
- Set `REDIS_URL` to a protected Redis instance for counters and rate-limits.
- Configure an OTLP collector and set `OTEL_EXPORTER_OTLP_ENDPOINT` so traces are sent to your tracing backend.
- Protect `/api/metrics` with `METRICS_API_KEY` if metrics must be restricted.

Local development
- For local experimentation you can use `docker compose -f docker-compose.test.yml up` to start Redis and run tests.
- If you don't want to install native modules locally (e.g. `better-sqlite3`), use the Docker Compose test workflow or CI to run tests.
