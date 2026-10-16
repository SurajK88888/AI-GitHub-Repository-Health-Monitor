# Short-Term Memory

## Current status
- **Session 20 (2026-10-14): Functional & Secure Topbar Repository Search Bar.**
  - **Issue Reported:** Global Topbar search bar was static with no interaction or search capability.
  - **Feature:**
    1. **Interactive Topbar Search Bar:** Implemented two-way query binding with real-time filtering, safe character length limit (`maxLength={100}`), click-outside dismissal, and clear (✕) button in `frontend/src/components/layout/Topbar.tsx`.
    2. **Live Results Dropdown & Highlight:** Animated dropdown popover displaying top matching repositories with health score badges, repo icons, full names, and XSS-safe highlighted matching substrings.
    3. **Keyboard Navigation & Deep-Linking:** Full keyboard control (ArrowDown/ArrowUp navigation, Enter to open selected repo or submit search, Escape to close).
    4. **Repositories Page Search Integration:** `/repositories` page now parses `search` / `q` searchParams, displays active search filter banner with one-click clear button, and tailors empty states to search queries.
    5. **Backend Search Support:** Added parameterized `search` query parameter in `backend/app/api/v1/repositories.py` (`Repository.name.ilike`, `Repository.full_name.ilike`) with max length validation.
  - **Files Changed:**
    - `frontend/src/components/layout/Topbar.tsx`
    - `frontend/src/app/repositories/page.tsx`
    - `backend/app/api/v1/repositories.py`
  - **Verification:** `npx tsc --noEmit` and `npm run lint` clean (0 errors).
- **Session 19 (2026-10-14): Widget Controller (Master Switch & Granular Visibility Controls).**
  - **Feature:**
    1. Built modular `WidgetController` located in `frontend/src/components/widgets/controller/` with draggable floating dock, master switch (`Enable All Widgets` ON/OFF), and granular per-widget visibility toggles (`System Clock`, `Theme Switcher`).
    2. Implemented `WidgetProvider` & `useWidgetController()` hook managing state and local storage persistence (`gh_health_widgets_controller_settings`).
    3. Added "Reset Layout" action dispatching `gh_health_reset_widget_positions` to restore all widget positions back to default navbar docking.
    4. Documented controller architecture in `.agents/rules/widgets.md`.
  - **Verification:** `tsc --noEmit` passed cleanly with 0 errors.
- **Session 18 (2026-10-14): Latest Notifications 5-Item Limit & Notifications Center Filter Tags.**
  - **Feature:**
    1. **Latest Notifications Widget Limit:** In `frontend/src/components/dashboard/Widgets.tsx`, updated `NotificationsWidget` to display only the first 5 notifications at a time using `.slice(0, 5)` and added `page_size=5` to the fetch query parameter.
    2. **Notification Center Filter Tags:** In `frontend/src/app/notifications/page.tsx`, replaced the binary "Unread only" toggle button with three dedicated filter tags: **All**, **Read**, and **Unread**.
    3. **Dynamic Filtering & State Sync:** Dynamically fetches from `/notifications` using the `is_read` parameter (`false`, `true`, or none) with `page_size=50&limit=50`, filters notifications considering optimistic `localRead` state, syncs unread counts via `/notifications/unread-count`, and tailors empty states to each selected tag.
  - **Files Changed:**
    - `frontend/src/components/dashboard/Widgets.tsx`
    - `frontend/src/app/notifications/page.tsx`
  - **Verification:** `npm run lint` clean (0 errors, 0 breaking warnings).
- **Session 17 (2026-10-14): Dark-Bright Theme Toggle Widget.**
  - **Feature:** Built modular Dark/Bright/Auto Theme Switcher Widget under `frontend/src/components/widgets/theme-toggle/` with segmented pill control (`Bright ☀️`, `Dark 🌙`, `Auto 💻`), draggable pointer-capture engine, viewport boundary clamping, position/mode persistence in `localStorage`, and zero-flash initialization script in `app/layout.tsx`. Configured Tailwind `darkMode: "class"` and updated CSS custom properties in `globals.css`.
  - **Verification:** `npm run type-check` passed with 0 errors.
- **Session 16 (2026-10-14): Interactive Tech Stack Visualizer Component.**
  - **Feature:**
    1. Built dynamic, interactive architecture visualizer container (`TechStackVisualizer.tsx`) categorizing repository technologies into 4 tiers: Client & UI, API & Backend, Data & Storage, and DevOps & CI/CD.
    2. Interactive node selection with hover states, live connection status indicators (`Connected & Active`, `Monitored by Scan`, `Action Required`), purpose descriptions, and configuration file origins.
    3. Filterable by architectural layer with empty state handling for zero-code repositories.
  - **Files Changed:** Created `frontend/src/components/repository/TechStackVisualizer.tsx` and integrated into `frontend/src/app/repositories/[id]/page.tsx`. Zero unrelated code modified.
  - **Verification:** `next build` compiled cleanly with 0 errors. Docker frontend container restarted.
- **Session 15 (2026-10-14): Category Descriptions & Scrollable Backend Calculation Details Modal.**

  - **Feature:**
    1. Added exact, concise description below each of the 8 category names in the Category Breakdown grid.
    2. Added a circular "i" info icon button next to each category name.
    3. Clicking the "i" icon displays an interactive, scrollable info display modal (`max-h-[62vh] overflow-y-auto`) presenting full breakdown logic as per backend collectors: base score, exact deduction amounts, conditions, severity tags, safety caps & overrides, weight percentage, and the underlying backend collector file path.
  - **Files Changed:** Only `frontend/src/app/repositories/[id]/page.tsx`. Zero unrelated files touched.
  - **Verification:** Next.js production build succeeded with zero errors, frontend container restarted.
- **Session 14 (2026-10-14): Frontend Empty Repository Warning Tag & Alert Banner.**

  - **Feature:** Display a yellow warning tag (`⚠️ Empty Repository`) on the left side of the repository name, and a prominent yellow warning banner on the repository detail page (`/repositories/[id]`) and repository cards (`/repositories`).
  - **Conditional Logic:** Evaluates `repo.has_no_code` and open findings (`no source code`/`empty repository`). If source code is present, neither the tag nor warning message is displayed.
  - **Changes:**
    - `backend/app/schemas/repository.py`: added `has_no_code: bool = False` to `RepositoryResponse`.
    - `backend/app/api/v1/repositories.py`: attached `has_no_code` based on open findings in `_attach_latest_health_scores`.
    - `frontend/src/lib/types.ts`: added `has_no_code?: boolean` to `Repository`.
    - `frontend/src/components/layout/DashboardLayout.tsx`: relaxed `title` prop to `React.ReactNode`.
    - `frontend/src/app/repositories/[id]/page.tsx`: rendered yellow tag on the left of `repo.name` in header and yellow warning callout banner above category scores.
    - `frontend/src/app/repositories/page.tsx`: rendered yellow `⚠️ Empty Repo` tag on the left of `repo.name` in repo cards.
  - **Verification:** Backend tests passing (222/222, 75.61% coverage), Next.js production build succeeded with zero errors, containers restarted.
- **Session 13 (2026-10-14): Real-Time Draggable System Clock & Widget Architecture Rule.**

  - **Feature:** Added real-time software system clock widget with sub-second synchronization, 12H/24H toggle, date, seconds, timezone selector (400+ IANA zones), pointer-capture drag engine, and persistence.
  - **Modular Architecture:** Created dedicated per-widget subfolder structure under `frontend/src/components/widgets/clock/` orchestrated via `WidgetContainer.tsx` in `frontend/src/app/layout.tsx`.
  - **Rules Added:** Codified widget design and folder creation standards in `.agents/rules/widgets.md` and referenced in `.agents/rules/development.md`.
- **Session 12 (2026-10-14): Empty / No-Code Repository Detection & Scoring Safety Cap.**
  - **Issue Reported by User:** Scanning an empty repository (`Hello-galaxy`) with zero code files (only a README.md and 1 initial commit) gave an undeserved score of 71/100 (Needs Attention), 100 in Dependencies, 100 in Issues, 100 in PRs, and lacked any finding stating that the repo has no code.
  - **Fix Applied:**
    1. Added `ScanContext.has_source_code()` checking for recognizable language file extensions and project manifests.
    2. Updated `CodeQualityCollector`: when no source code exists, it emits a `HIGH` severity finding (`No source code detected (Empty Repository)`: "The repository contains no recognizable source code files or package manifests. Automated tests, CI/CD pipelines, and code quality tools cannot be evaluated.") and sets `code_quality_score` to `0.0`.
    3. Updated `DependenciesCollector`: when no manifests and no source code exist, `dependencies_score` is set to `0.0` (instead of 100.0).
    4. Updated `engine.py` (`calculate_health_score`): added `_CAP_OVERALL_EMPTY_REPO = 30.0` safety cap whenever an empty repo finding is active, enforcing `CRITICAL` band (score ≤ 30.0).
    5. Unit tests: added 4 new unit tests in `test_collectors.py` and `test_scoring_service.py`. Test suite: **222 / 222 passing**, **75.69% test coverage**.
    6. Restarted Docker backend and worker containers cleanly.
- **Session 11 (2026-10-14): Fixed /findings client-side exception crash.**

  - **Issue:** Clicking "Findings" (`/findings`) threw `Application error: a client-side exception has occurred`.
  - **Root Cause:** In `frontend/src/app/findings/page.tsx:125`, `<pre>{f.evidence}</pre>` attempted to render `f.evidence` directly. The backend returns `evidence` as a JSON dictionary (`dict[str, Any]`), causing React to throw `Error: Objects are not valid as a React child`.
  - **Fix Applied:** Updated `evidence` in `frontend/src/lib/types.ts` to `Record<string, unknown> | string | null`, and safely serialized `f.evidence` in `frontend/src/app/findings/page.tsx` using `{typeof f.evidence === "string" ? f.evidence : JSON.stringify(f.evidence, null, 2)}`. Zero unrelated files touched.
  - **Build Status:** Frontend container rebuild in progress.
- **Session 10 (2026-10-14): Resolved 50% category scores bug + Added Groq AI support.**
  - **Why all categories showed 50% (FIXED):** The 8 collectors emitted metrics like `security_score`, `documentation_score`, etc., but `_derive_category_raw_score` in `engine.py` was checking for `metric_name == "score"`. Because of this name check mismatch, every category fell back to the neutral `50.0` default. Updated `_derive_category_raw_score` to match `<category>_score`, `score`, or `metric_unit == 'score'`. Real collector metrics are now used.
  - **Groq AI Provider Support (IMPLEMENTED):**
    - Added `call_groq` in `services/ai/client.py` using Groq's high-speed OpenAI-compatible chat completions endpoint with native JSON mode.
    - Added unified `call_ai` router that automatically switches between `google` (Gemini) and `groq` (`llama-3.3-70b-versatile`).
    - Added `groq_api_key` and `groq_model` to `backend/app/config.py`.
    - Added unit tests for `call_groq` and `call_ai` routing in `tests/test_ai_service.py`.
  - **Test Suite:** 218 / 218 tests passing (100% pass rate, 75.54% coverage).
  - **Containers:** All 5 Docker containers running and healthy.
- End-to-End Scan & Dashboard Flow: ANALYZED, FIXED & VERIFIED LIVE.
  - Root Cause A (Dashboard Overview / Trends): `GET /api/v1/repositories` returned `latest_health_score: None`. Added `_attach_latest_health_scores()` to attach calculated score, score band, and timestamps.
  - Root Cause B (Dashboard Recent Scans): `/api/v1/scans` returned 404 because no workspace-scoped scans list route existed. Added `GET /api/v1/scans` endpoint with repository name enrichment.
  - Root Cause C (Repository Detail Categories): Category breakdown referenced flat fields (`hs.documentation_score`) rather than `hs.categories` array. Implemented `getCategoryScore()` fallback resolver.
  - Root Cause D (AI Model Invariant & Overload): `gemini-3.5-flash-lite` experienced high-demand 503 spikes; upgraded default to `gemini-3.5-flash` with graceful non-blocking `SKIPPED` degradation ensuring scans and health scores never fail or hang.
  - Live Validation: Verified live backend container API with authenticated JWT requests:
    - `GET /repositories`: returns `latest_health_score` (50.0/POOR) for scanned repos.
    - `GET /scans?limit=5`: returns HTTP 200 with 1 completed scan for `Dhanx`.
    - `GET /repositories/{id}/health`: returns 50.0/POOR across 8 categories.
  - Test Suite: 212/212 tests passing. All docker containers refreshed and running.
- Ready for Phase 7 (Testing, Polish, Docs, and Deployment).

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
- Phase 6:
  - Design & Theme:
    - Cohesive indigo/violet/purple variant color palette configured in `tailwind.config.ts` and `globals.css`.
    - 3D card perspective hover-lift animations (`whileHover={{ y: -8, scale: 1.02, rotateX: 1.5, rotateY: 0.5, boxShadow: ... }}`) using Framer Motion with spring physics.
    - Drag-and-drop dashboard grid built with `@dnd-kit/core` and `@dnd-kit/sortable`, supporting touch and pointer sensors with `localStorage` order persistence.
  - UI Component Library (`src/components/ui/`):
    - `MotionCard`: 3D hover-lift card with gradient hover glow and drag-handle affordance.
    - `ScoreRing`: animated SVG circular progress with Framer Motion stroke dashoffset and score label animation.
    - `Badge`: variant badges for `FindingSeverity`, `ScoreBand`, `ScanStatus` (with pulsing live indicator), and `AIActionStatus`.
    - `Button`: spring-animated button with 5 variants, 3 sizes, and inline loading spinner.
    - `Spinner` & `Skeleton`: custom shimmering skeletons, empty states, and error boundary fallbacks.
  - Layout & Navigation (`src/components/layout/`):
    - `Sidebar`: spring-animated navigation items with `layoutId` active indicators and unread notification counter badge.
    - `Topbar`: sticky blurred navigation header with user dropdown menu and notification quick-link.
    - `DashboardLayout`: persistent app shell that automatically polls unread notifications every 30s.
  - Dashboard & Widgets (`src/components/dashboard/`):
    - `DraggableDashboard`: drag-and-drop widget grid with `DragOverlay` ghost state and spring animations.
    - 8 customizable widgets: `OverviewScores`, `CriticalFindings`, `RecentScans`, `ScoreTrend` (Recharts AreaChart), `TopRepos`, `Notifications`, `QuickActions`, `ActivityFeed`.
  - App Router Pages (`src/app/`):
    - `/` (Home): interactive hero landing page with feature cards and animated brand icon.
    - `/dashboard`: draggable widget layout with auto-sync and refresh controls.
    - `/repositories`: grid of monitored repositories with health score rings and instant "Scan Now" trigger.
    - `/repositories/[id]`: repository detail view with 8-category score breakdowns, category score bars, and tabbed Findings / Recommendations / AI Actions panels with approval and execution triggers.
    - `/findings`: repository findings explorer with severity filters (`CRITICAL`, `HIGH`, `MEDIUM`, etc.) and expandable code evidence.
    - `/actions`: AI remediation actions manager with status filter, execution triggers, and GitHub PR links.
    - `/notifications`: real-time notification feed with severity indicators, single mark-as-read, and mark-all-read.
    - `/settings`: notification preferences management with animated spring switches.
    - `/auth/signin`: custom branded signin page wrapped in Next.js `<Suspense>` boundary.
  - Verification:
    - `npm run build` succeeds (11/11 static and dynamic routes compiled).
    - `npm run lint` clean (0 errors, 0 warnings).
    - `npx tsc --noEmit` clean (0 type errors).
    - Backend pytest test suite clean (212/212 passing, 79.29% coverage).
- Session 21:
  - Notifications Widget & Dropdown:
    - Limited dropdown to top 5 latest notifications (`items.slice(0, 5)`).
    - Filter tabs added (`ALL`, `UNREAD`, `READ`) with client-side reactive filtering for specific message views.
  - Global Search Bar & Repositories:
    - Secure, debounced search implemented in `Topbar.tsx` querying repositories API and linking directly to results.
    - Synchronized search query parameter in `/repositories` page.
  - Findings `INFO` Tag & Error Formatting:
    - Resolved `[object Object]` error when clicking `INFO` tag on `/findings` page.
    - Root cause: Backend `FindingSeverity` enum uses `INFORMATIONAL` whereas the frontend tab sends `INFO`, causing FastAPI 422 Unprocessable Entity, which `api.ts` rendered as `[object Object]` due to raw `detail` object handling.
    - Backend (`backend/app/api/v1/findings.py`): Accepted string severity queries and mapped `INFO` -> `INFORMATIONAL` across both repository findings and workspace findings endpoints.
    - Frontend (`frontend/src/app/findings/page.tsx`, `types.ts`, `Badge.tsx`, `utils.ts`): Extended `FindingSeverity` type to support both `INFO` and `INFORMATIONAL`, added `INFORMATIONAL` badge and color styling mapping to `"INFO"`, and sent `INFORMATIONAL` for API requests.
    - API Client (`frontend/src/lib/api.ts`): Formatted FastAPI `detail` array/object error structures into readable strings to permanently eliminate `[object Object]` errors.
    - Verification: `npx tsc --noEmit` exited clean (code 0).


