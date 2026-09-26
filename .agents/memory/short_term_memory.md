# Short-Term Memory

## Current status
- Phase 3 COMPLETE — Repository Scanning Engine, 8 Metric Collectors, Scan Runner, Findings API, Scans API — 94/94 tests passing, ruff clean, 79.41% coverage.
- Next: Phase 4 — AI Analysis + Scoring Engine (HealthScore computation, Gemini integration, Recommendations API).

## Completed work
- Phase 1: Full foundation scaffold, 18 models, Alembic migration, 9 Pydantic schemas, FastAPI core, Next.js frontend, CI workflow.
- Phase 2:
  - GitHub App service (`services/github/auth.py`, `services/github/client.py`, `services/github/webhook.py`): RS256 JWT generation, token caching, HMAC verification, REST client.
  - Auth middleware & service (`services/auth.py`, `services/user_service.py`): NextAuth JWT verification, user + workspace automatic bootstrap, idempotent session setup.
  - Audit service (`services/audit_service.py`): Secure, non-blocking audit logging for security events.
  - Redis dependency (`workers/deps.py`): Shared pool with `RedisClient` supporting mypy strict mode and Python 3.14 runtime.
  - Worker jobs (`workers/jobs/webhook_processor.py`): Background processing of GitHub webhook events.
  - API endpoints (`api/v1/auth.py`, `api/v1/webhooks.py`, `api/v1/installations.py`, `api/v1/repositories.py`): Registered in `main.py`.
  - Tests: 44/44 tests passing, 81.57% backend coverage, ruff clean, mypy clean.
- Phase 3:
  - `ScanContext` dataclasses (`context.py`): CommitSummary, IssueSummary, PullRequestSummary, MetricData, FindingData, CollectorResult.
  - `GitHubFetcher` (`github_fetcher.py`): Fetches repo tree, selected file contents, commits, issues, PRs in one shot.
  - 8 Collectors (`collectors/`): documentation, security, code_quality, dependencies, issues, pull_requests, activity, configuration.
  - `ScanRunner` (`runner.py`): QUEUED→RUNNING→COMPLETED/FAILED lifecycle, finding dedup/upsert with fingerprinting, metric persistence.
  - `run_repository_scan` ARQ job (`workers/jobs/scan_job.py`): wired into `WorkerSettings.functions`.
  - Schemas: `ScanMetricResponse` added to `scan.py`; finding field aliases in `finding.py`.
  - API: `POST/GET /repositories/{id}/scans`, `GET /scans/{id}`, `GET /scans/{id}/metrics`, `GET /repositories/{id}/findings`, `GET /findings/{id}`.
  - Tests: 94/94 passing, 79.41% coverage, ruff clean.
  - Also extended `GitHubClient` with `owner`/`repo` params and `get_file_content()`.
