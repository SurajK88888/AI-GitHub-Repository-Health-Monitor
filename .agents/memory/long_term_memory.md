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

## Invariants
- Weights in ScoringConfiguration must sum to 100 — enforced at schema and DB level
- Historical HealthScore records must never be rewritten when config changes — create new version
- All repo-modifying AI actions require explicit user approval + audit log
- No secrets in source code, logs, or audit records
- Every workspace-owned resource enforces workspace isolation at the API layer
- AI failure must not prevent deterministic health scoring from completing
