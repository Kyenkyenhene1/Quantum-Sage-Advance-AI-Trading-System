Title: observability + audit + execution metrics enhancements

Summary
- Added Redis-backed execution counters with in-memory fallback.
- Added file/SQLite/Postgres audit logging with prepared statements and PG adapter.
- Added Prometheus metrics and `/api/metrics` endpoint.
- Added OpenTelemetry tracing init (Console exporter by default).
- Wired metrics/tracing into `signal-execute` and `execute-order` flows.
- Added tests and CI workflow for Redis/DB-backed tests and Docker Compose test helper.

How to verify
1. Run tests via Docker Compose (Windows PowerShell): `.\scripts\run-tests.ps1`
2. Alternatively run locally: `npm ci` then `npm test` (requires build tools for native modules)

Notes
- For production, set `AUDIT_PG_URL`, `REDIS_URL`, `METRICS_API_KEY`, and configure OTLP exporter for traces.
