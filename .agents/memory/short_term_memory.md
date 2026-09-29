# Short-Term Memory

## Current status
- Phase 5 COMPLETE — Automation & Remediation (GitHub Remediation Engine, In-App & Event Notifications, Action Execution, Scheduled Monitoring Worker, AI Actions API, Notifications API) — 212/212 tests passing, ruff clean, mypy clean, 79.29% coverage.
- Next: Phase 6 — Frontend Dashboard & UI Components (Next.js 15, React 19, Tailwind CSS, repository views, findings, scores, actions, notifications).

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
- Phase 4:
  - Scoring Service Layer (`services/scoring/config_service.py`, `services/scoring/engine.py`):
    - 8-category deterministic scoring with Doc 04 default weights totaling 100%.
    - Safety caps: CRITICAL finding in category caps it at 30; HIGH caps at 60; CRITICAL SECURITY finding caps overall score at 50.
    - Score bands: EXCELLENT (90-100), GOOD (75-89), NEEDS_ATTENTION (60-74), POOR (40-59), CRITICAL (0-39).
    - Workspace-level versioned configurations with immutability for reproducible historical scores.
  - AI Analysis Service Layer (`services/ai/prompts.py`, `services/ai/client.py`, `services/ai/analyzer.py`):
    - Sanitized prompt templates (v1.0.0) — never send raw source code, tokens, or secrets.
    - Async Gemini REST client using `httpx` with graceful degradation if API key is not configured.
    - `run_ai_analysis`: non-blocking, fault-tolerant (AI failure marks `AIAnalysis` as SKIPPED/FAILED and never crashes scans/scoring), creates `Recommendation` records.
  - Worker Pipeline (`workers/jobs/scan_job.py`):
    - Calls `calculate_and_save_health_score` then `run_ai_analysis` after a successful scan.
  - API Endpoints (`api/v1/health_scores.py`, `api/v1/recommendations.py`):
    - `GET /repositories/{id}/health`, `GET /repositories/{id}/health/history`, `GET /workspaces/scoring-config`, `POST /workspaces/scoring-config`.
    - `GET /repositories/{id}/recommendations`, `GET /recommendations/{id}`, `POST /recommendations/{id}/approve` (creates `AIAction` audit trail).
    - Registered in `main.py`.
  - Tests: 174/174 tests passing, 79.02% coverage, ruff clean, mypy clean.
- Phase 5:
  - GitHub Remediation Engine (`services/github/client.py`, `services/remediation/templates.py`, `services/remediation/executor.py`):
    - Extended `GitHubClient` with mutation endpoints: `post`, `put`, `get_branch_sha`, `create_branch`, `create_or_update_file`, `create_pull_request`.
    - Templated fix generators for `SECURITY.md`, `.github/dependabot.yml`, `.github/workflows/ci.yml`, `README.md`, `CONTRIBUTING.md`.
    - `execute_remediation_action`: validates action is `APPROVED`, creates dedicated branch, commits fix, opens PR, updates action/recommendation status to `COMPLETED`, logs audit event, and dispatches in-app notification.
  - Notification Service (`services/notifications/service.py`):
    - `create_notification`: creates in-app notification records, respecting user `NotificationPreference`.
    - `dispatch_scan_notifications`: event-driven dispatcher handling `SCAN_FAILED`, `CRITICAL_FINDING`, `SCORE_DEGRADATION` (>= 10 point drop), and `SCAN_COMPLETED`.
    - Integrated into `scan_job.py` worker pipeline.
  - Background Worker Jobs (`workers/jobs/action_job.py`, `workers/jobs/scheduled_scans.py`):
    - `run_approved_action`: executes remediation action asynchronously via ARQ.
    - `dispatch_scheduled_scans`: periodic cron job dispatching scans for monitored repositories.
    - Registered in `WorkerSettings.functions`.
  - API Endpoints & Schemas (`api/v1/ai_actions.py`, `api/v1/notifications.py`, `schemas/ai.py`, `schemas/notification.py`):
    - AI Actions API: `GET /repositories/{id}/actions`, `GET /actions/{id}`, `POST /actions/{id}/execute` (202 Accepted, ARQ enqueued).
    - Notifications API: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/mark-read`, `POST /notifications/mark-all-read`, `GET/PUT /notifications/preferences`.
    - Registered in `main.py`.
  - Tests: 212/212 tests passing, 79.29% coverage, ruff clean, mypy clean.


