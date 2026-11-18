Release checklist

1. Run tests locally (recommended via Docker Compose):

```powershell
.\scripts\run-tests.ps1
```

2. If using Postgres audit, initialize DB:

```powershell
node scripts/init-audit-pg.js '<POSTGRES_CONN_STRING>'
```

3. Commit changes to a branch and open a PR with `PR_DESCRIPTION.md` as the description.

4. On PR, ensure CI passes (Redis and DB-backed tests).

5. Deploy: set env vars `REDIS_URL`, `AUDIT_PG_URL` (or `AUDIT_DB_PATH`), `METRICS_API_KEY`, and OTEL settings.

6. Monitor metrics and traces after deployment; verify `executed_orders_total` and `execution_failures_total`.
