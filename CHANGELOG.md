# Changelog

All notable changes are listed in this file.

Unreleased
- Add Redis-backed execution counters with in-memory fallback
- Add file/SQLite/Postgres audit logging and helpers
- Add Prometheus metrics endpoint `GET /api/metrics`
- Add OpenTelemetry tracing initialization
- Wire metrics and tracing into execution endpoints
- Add tests for metrics, audit, and execution counters; add Docker Compose test helper
- Add docs: `docs/testing.md`, `docs/observability.md`, update `.env.example`
