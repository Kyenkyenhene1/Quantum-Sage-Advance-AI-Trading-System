# Deployment Checklist

This document provides a minimal deployment checklist and recommendations.

1. Build and test locally

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
```

2. Environment variables
- Use CI/CD secrets (e.g., GitHub Actions secrets, Vercel Environment Variables).
- Copy `.env.example` to `.env.production` locally as a reference (do not commit real secrets).

3. Health checks
- The app exposes a health endpoint at `/api/health`. Configure your platform readiness/liveness probes to use it.

4. Sentry / Monitoring
- Set `NEXT_PUBLIC_SENTRY_DSN` in production environment to capture errors.

5. Rolling & rollback
- Use platform deployments with incremental rollout and easy rollback (Vercel, Cloud Run revisions, or Kubernetes deployments with a previous revision).

6. Security
- Ensure HTTPS is enforced (HSTS header is configured in `next.config.ts`).
- Store secrets in a secure store (Vercel secrets, GitHub Secrets, or cloud KMS).

7. Docker (optional)
- To run locally with Redis via Docker Compose:

```powershell
docker-compose up --build
```

- The compose file exposes the app on `http://localhost:3000` and Redis on `6379`.

8. Environment validation
- The repo includes `src/lib/env.ts` which validates critical environment variables at runtime using `zod`. Ensure required vars are set in your deployment environment.
9. Securing Metrics
- Use a strong `AI_METRICS_API_KEY` and set it as environment secret in your platform.
- Access `/api/ai-metrics` using the `Authorization: Bearer <AI_METRICS_API_KEY>` header. Prometheus text export is only available to authorized callers.

10. Sentry Releases
- Configure `SENTRY_DSN` and set `SENTRY_RELEASE` (or ensure `GITHUB_SHA` is available in the environment) so Sentry groups errors by release.
