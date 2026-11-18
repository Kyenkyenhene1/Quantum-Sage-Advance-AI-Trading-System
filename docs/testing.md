# Running Tests Locally

This document explains how to run the project's unit and integration tests locally, including the Redis-backed execution metrics and the SQLite-backed audit tests.

Recommended approach (no native build toolchain required): run tests inside Docker using the provided `docker-compose.test.yml`.

Prerequisites
- Docker Desktop installed and running (Windows: enable WSL2 backend recommended).
- Git and project files available locally.

Run tests via Docker Compose

1. From the repository root run (PowerShell):

```powershell
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

This starts a Redis service and a Node 18 container that installs dependencies and runs `npm test` inside the container. The container exits when the test suite completes; logs appear in the terminal.

You can also use the helper npm script (it runs the same compose command):

```powershell
npm run test:compose
```

Run tests locally (native)

If you prefer to run tests on your host machine (native), you must have a build toolchain available for native modules like `better-sqlite3`. On Windows this typically requires Visual Studio Build Tools; on Linux/macOS you need `build-essential` / `python` installed.

1. Install dependencies:

```powershell
npm ci
```

2. Start Redis (if running Redis-backed tests):

```powershell
docker run -p 6379:6379 --name qs-redis -d redis:7
$env:REDIS_URL='redis://localhost:6379'
```

3. Run tests:

```powershell
npm test
```

Notes and environment variables
- `REDIS_URL`: Set if you want to run the Redis-backed tests against a specific Redis instance. In Docker Compose this is set automatically to `redis://redis:6379`.
- `AUDIT_DB_PATH`: If set, the audit logger will use an SQLite DB at that path instead of the default file-based JSONL. Example:

```powershell
$env:AUDIT_DB_PATH='logs/test-audit.db'
npm test -- -t 'audit.db' --run
```

Windows native build tips
- Install Visual Studio Build Tools with the "Desktop development with C++" workload.
- Or avoid native builds by using `docker compose -f docker-compose.test.yml ...` as described above.

CI
- The repository includes a GitHub Actions workflow that starts Redis and installs build prerequisites before running `npm test` so CI will execute both Redis and DB-backed tests.

If you want, I can add a script that runs only a specific test group (e.g. Redis tests) or add a `Makefile` / PowerShell helper to simplify the commands for developers on Windows.
