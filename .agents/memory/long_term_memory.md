# Long-Term Memory

Use for confirmed, durable project knowledge. Keep it concise; link to `docs/` for detail.

## Project facts
- Purpose: AI GitHub Repository Health Monitor — automated 0–100 health scoring for GitHub repos
- Main domains: Auth, Workspaces, GitHub Integration, Scanning, Scoring, AI Analysis, Notifications, Audit
- Supported environments: development (Docker Compose), staging, production (Vercel + Render/Railway + managed PG + Redis)

## Architecture decisions
| Date | Decision | Reason | ADR |
|---|---|---|---|
| 2026-09-11 | NextAuth.js v5 (GitHub OAuth) | Best fit for Next.js; no external managed-auth dependency | — |
| 2026-09-11 | ARQ (async, Redis-native) | Fits FastAPI async model; lightweight vs Celery | — |
| 2026-09-11 | String enums stored as VARCHAR | Avoids PG ALTER TYPE on every new enum member | — |
| 2026-09-11 | Alembic manual migration (0001) | DB-free initial migration; autogenerate available for future changes | — |
| 2026-09-11 | pyproject.toml build-backend = setuptools.build_meta | setuptools.backends.legacy not available on installed setuptools | — |
| 2026-09-20 | HMAC-SHA256 signature on raw bytes | Ensures tamper-proof webhook verification before parsing JSON | — |
| 2026-09-20 | Webhook idempotency in Redis | 24-hour delivery ID cache prevents duplicate event processing | — |
| 2026-09-20 | GitHub App token cache margin | Installation access tokens refreshed 60 seconds before expiry | — |
| 2026-09-20 | Lazy user/workspace bootstrap | POST /api/v1/auth/session initializes DB records on first login | — |
| 2026-09-24 | Collectors are pure functions (no I/O) | ScanContext pre-loaded; collectors deterministic for same input | — |
| 2026-09-24 | Finding dedup by SHA-256 fingerprint | fingerprint = SHA-256("category:rule_id:resource"); UniqueConstraint on (repo, fingerprint) | — |
| 2026-09-24 | GitHubClient extended with owner/repo + get_file_content() | Scanner needs file content without a separate client; backward-compatible (owner/repo default to "") | — |
| 2026-09-24 | ARQ job uses async generator .aclose() instead of break-in-finally | break inside finally silences exceptions (B012 lint rule); generator .aclose() is correct | — |
| 2026-09-26 | Deterministic health scoring engine is pure function | `calculate_health_score` is side-effect-free, easily testable without DB | Doc 04 |
| 2026-09-26 | Hard safety caps on critical findings | Critical security finding caps overall score at 50; per-category critical caps at 30, high at 60 | Doc 04 |
| 2026-09-26 | Fault-tolerant AI analysis pipeline | AI provider failure/timeout records status as SKIPPED/FAILED and never blocks scoring or scan completion | Doc 04, 05 |
| 2026-09-26 | Two-layer prompt sanitization | Prompt only includes sanitized finding metadata, never raw evidence blobs or source code | Doc 01, 04 |
| 2026-09-27 | Automated remediation requires prior APPROVED status | Action executor validates status == APPROVED; never executes without explicit user approval | Doc 06, 07 |
| 2026-09-27 | Isolated remediation branches | All remediation commits are pushed to a dedicated branch (health-monitor/remediation-*) before PR | Doc 05, 06 |
| 2026-09-27 | Event-driven in-app notifications with preference filtering | Scans and actions trigger structured notifications that honor user preference suppresses | Doc 05, 08 |

## Invariants
- Weights in ScoringConfiguration must sum to 100 — enforced at schema and DB level
- Historical HealthScore records must never be rewritten when config changes — create new version
- All repo-modifying AI actions require explicit user approval + audit log
- No secrets in source code, logs, or audit records
- Every workspace-owned resource enforces workspace isolation at the API layer
- AI failure must not prevent deterministic health scoring from completing
