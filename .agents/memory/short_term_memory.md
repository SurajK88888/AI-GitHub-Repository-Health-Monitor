# Short-Term Memory

## Current status
- Phase 2 COMPLETE — GitHub App services, Webhook ingestion, NextAuth validation, Installations & Repositories APIs, ARQ jobs, all 44 tests passing, ruff lint clean, mypy clean.
- Next: Phase 3 — Repository Scanning Engine & Metrics Collectors.

## Completed work
- Phase 1: Full foundation scaffold, 18 models, Alembic migration, 9 Pydantic schemas, FastAPI core, Next.js frontend, CI workflow.
- Phase 2:
  - GitHub App service (`services/github/auth.py`, `services/github/client.py`, `services/github/webhook.py`): RS256 JWT generation, token caching, HMAC verification, REST client.
  - Auth middleware & service (`services/auth.py`, `services/user_service.py`): NextAuth JWT verification, user + workspace automatic bootstrap, idempotent session setup.
  - Audit service (`services/audit_service.py`): Secure, non-blocking audit logging for security events.
  - Redis dependency (`workers/deps.py`): Shared pool with `RedisClient` supporting mypy strict mode and Python 3.14 runtime.
  - Worker jobs (`workers/jobs/webhook_processor.py`): Background processing of GitHub webhook events (`installation`, `installation_repositories`, `push`, `pull_request`).
  - API endpoints (`api/v1/auth.py`, `api/v1/webhooks.py`, `api/v1/installations.py`, `api/v1/repositories.py`): Registered in `main.py`.
  - Tests: 44/44 tests passing, 81.57% backend coverage, ruff clean, mypy clean.

## Phase 3 Scope (Next)
- Repository scanning pipeline (Clone / GitHub API fetch).
- Rule-based metric collection (documentation, security, issues, PRs, activity, configuration).
- Scan job orchestration via ARQ.
