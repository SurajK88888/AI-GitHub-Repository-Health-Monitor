# Short-Term Memory

## Current status
- **Session 34 (2026-10-21): Fixed Backend Bandit Linting (S110, S311) & Frontend ESLint 9 Flat Config Migration.**
  - **Issues Resolved:**
    1. **Backend Bandit S110 (`try`-`except`-`pass`):** In `backend/app/services/ai/analyzer.py` and `client.py`, bare `except Exception: pass` blocks were replaced with explicit logger debug entries (`logger.debug(..., exc_info=True)` / specific exceptions) to prevent silent error masking.
    2. **Backend Bandit S311 (Pseudo-random jitter in exponential backoff):** Annotated `random.uniform` in `backend/app/services/ai/client.py` with `# noqa: S311` because network retry backoff jitter is non-cryptographic.
    3. **Backend Test Assertion Adjustment:** In `backend/tests/test_ai_service.py`, aligned test bounds to `6.5 <= delay_default <= 8.0` matching the base 3.0 backoff multiplier introduced to avoid RPM limits.
    4. **Frontend ESLint 9 Flat Config Migration:** Migrated legacy `.eslintrc.json` to modern `frontend/eslint.config.mjs` incorporating `@eslint/js`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, and `@next/eslint-plugin-next`, resolving the `@rushstack/eslint-patch` / missing config error.
  - **Verification:**
    - `python -m ruff check backend`: **All checks passed (0 errors)**.
    - `python -m pytest tests/test_ai_service.py`: **36 / 36 passed**.
    - `npm run type-check`: **0 errors**.
    - `npm run build`: **Compiled successfully (all 12 routes generated)**.
    - Pre-commit hook ran cleanly with 0 errors. Committed `672ee81` and pushed to `seventhphase`.
- **Session 33 (2026-10-19): Fixed Type Variance Invariance Error in build_analysis_prompt.**
  - **Issue Reported:** Type error `Argument list[dict[str, float | str]] is not assignable to parameter category_scores with type list[dict[str, object]] in function build_analysis_prompt @ analyzer.py:L527`.
  - **Root Cause:** In Python's type system, mutable containers (`list` and `dict`) are strictly invariant. Even though `float | str` is a subtype of `object`, `dict[str, float | str]` is not assignable to `dict[str, object]`, nor is `list[...]`.
  - **Fix Applied:**
    1. In `backend/app/services/ai/prompts.py`, updated `category_scores` and `top_findings` parameter annotations to `Sequence[Mapping[str, Any]]` (covariant read-only interfaces).
    2. In `backend/app/services/ai/analyzer.py`, explicitly typed `categories: list[dict[str, Any]]`.
  - **Verification:**
    - Ruff check clean (0 errors).
    - Pytest `test_ai_service.py`: **36 / 36 passed**.
- **Session 32 (2026-10-19): Universal AI Rate Limiter, Jittered Retry-After Handling & High-Throughput Model Configuration.**
  - **Issue Reported:** Groq API requests hitting HTTP 429 `rate_limit_exceeded` during scans (e.g. 3 requests dispatched at the exact same second 11:46:02 AM).
  - **Root Causes Fixed:**
    1. ARQ background worker ran up to 10 jobs in parallel (`max_jobs = 10`), triggering simultaneous AI calls across concurrent repository scans.
    2. Zero outbound rate limiting or concurrency control in `backend/app/services/ai/client.py`.
    3. Thundering herd: when 429 occurred, static exponential backoff without jitter woke all failed requests up at the same instant, and ignored the `Retry-After` header sent by Groq.
    4. `.env` was using `GROQ_MODEL=openai/gpt-oss-20b`, an experimental preview model with restrictive RPM quotas.
  - **Fixes Applied (`backend/app/services/ai/client.py` & `.env`):**
    1. Added `_extract_retry_after`: extracts delay from `retry-after` header, `retry-after-ms`, or regex error messages.
    2. Added `_calculate_backoff`: computes `retry_after + random.uniform(0.5, 1.5)` (or base exponential `2 * (2**attempt) + random.uniform(0.5, 2.0)`), breaking synchronization.
    3. Added global concurrency lock `_get_ai_lock()` and inter-request throttle `_throttle_ai_request()` (`1.5s` minimum interval) in `call_ai` so outbound calls never burst simultaneously.
    4. Added automatic fallback to Google Gemini if Groq exhausts retries and a Gemini API key is configured.
    6. Replaced unsafe direct `repo.language` access in `_extract_architecture_cues` (`backend/app/services/ai/analyzer.py`) with `getattr(repo, "language", None)` to eliminate `AttributeError` that blocked outbound AI execution.
    7. Restarted Docker worker container (`docker compose restart worker`).
  - **Verification:**
    - Pytest `test_ai_service.py`: **36 / 36 passed** (100% pass rate).
    - Live worker logs: zero attribute errors on scan completion.
    - Preserved zero disruption to unrelated code and maintained failure invariants.
- **Session 31 (2026-10-19): Synchronized Frontend Calculation Details Modal with Upgraded Backend Engine (Improvement 6).**
  - **Feature:**
    1. **Synchronized Modal Info Text (`frontend/src/app/repositories/[id]/page.tsx`):**
       - Updated all category definitions in `CATEGORY_EXPLANATIONS` to match the real backend scoring rules, deduction weights, severities, and safety caps implemented in Improvements 1–5:
         - **Security**: Added in-content credential pattern scanning (private keys, AWS `AKIA...`, GitHub `ghp_...`, Slack `xox...`) alongside committed key files.
         - **Code Quality**: Added failed latest workflow run detection (-20 pts, HIGH) and low execution pass rate (<50%, -10 pts, MEDIUM) alongside workflow presence.
         - **Dependencies**: Added Dependabot CVE/GHSA vulnerability alert ingestion (Critical: -25 to -40 pts; High: -15 to -25 pts; Med/Low: -5 to -15 pts).
         - **Issues**: Added scale-aware capacity thresholds (`max(50, active_contributors * 15)`), differentiating unmaintained stale backlogs from active velocity.
         - **Pull Requests**: Added scale-aware PR thresholds (`max(20, active_contributors * 5)`), evaluating stale non-draft PRs and review throughput.
         - **Configuration**: Added default branch protection checks, required PR review enforcement (-5 pts), and CI status check enforcement.
    2. **Verification:**
       - TypeScript check `tsc --noEmit` passed with 0 errors.
       - Next.js production build (`next build`) succeeded with 0 errors (all 12 static/dynamic routes compiled).
       - Zero unrelated files modified.
- **Session 30 (2026-10-19): Branch Protection & Code Review Enforcement Evaluation (Improvement 5).**
  - **Feature:**
    1. **Branch Protection Ingestion (`github_fetcher.py` & `ScanContext`):**
       - Added `branch_protection` field to `ScanContext`.
       - Fetched `/repos/{owner}/{repo}/branches/{default_branch}/protection` in `github_fetcher.py` with fail-safe error handling for 404 (unprotected) or permission restrictions.
    2. **Branch Protection & Review Enforcement Evaluation (`ConfigurationCollector`):**
       - Emitted new metrics: `has_branch_protection` (bool), `requires_pull_request_reviews` (bool), `required_reviewers_count` (count), `enforces_status_checks` (bool).
       - Evaluated default branch protections:
         - Missing branch protection on non-empty repo: flags `LOW` finding (*"No branch protection on default branch '{branch}'"*), deducts `-10.0 pts`.
         - Protected branch without required PR reviews: flags `LOW` finding (*"Branch protection on '{branch}' does not enforce PR reviews"*), deducts `-5.0 pts`.
         - Protected branch without required CI status checks: flags `INFORMATIONAL` finding (*"Branch protection on '{branch}' does not enforce CI status checks"*).
    3. **Backward Compatibility & Safety:**
       - All existing collector tests remain passing.
       - Added 4 new unit tests in `backend/tests/test_collectors.py` verifying full protection clean state, missing reviews deduction, missing status checks informational finding, and missing branch protection deduction on code repos.
  - **Verification:**
    - Full test suite: **257 / 257 passed** (61/61 collector tests passed), **70.67% test coverage** ($\ge 50\%$ required).
    - Ruff check: clean (0 errors). Zero unrelated code modified.
- **Session 29 (2026-10-18): Scale-Aware Issue & PR Backlog Health Evaluation (Improvement 4).**
  - **Feature:**
    1. **Scale-Aware Issue Backlog Evaluation (`IssuesCollector`):**
       - Computed `active_contributors` from recent commits in the 30-day window (`ctx.recent_commits`).
       - Replaced the static 50-issue threshold with a dynamic scale-aware threshold: `backlog_threshold = max(50, active_contributors * 15)`. Active multi-contributor teams with high issue volume are no longer penalized if issues are actively worked on.
       - Emitted new metric: `stale_issue_ratio` (percentage of open issues unupdated for 90+ days).
       - Differentiated unmaintained backlogs (`stale_ratio >= 40%` or `stale_count >= 10`, severity `MEDIUM`, -20 pts deduction) from high-volume actively maintained backlogs (`stale_ratio < 40%`, severity `LOW`, -10 pts deduction).
    2. **Scale-Aware PR Backlog Evaluation (`PullRequestsCollector`):**
       - Scaled the PR backlog threshold dynamically based on team capacity: `backlog_threshold = max(20, active_contributors * 5)`.
       - Emitted new metric: `stale_pr_ratio` (percentage of open non-draft PRs unupdated for 30+ days).
       - Differentiated review bottleneck backlogs (`stale_ratio >= 30%` or `stale_count >= 4`, severity `MEDIUM`, -15 pts deduction) from high-volume active velocity PR flows (`stale_ratio < 30%`, severity `LOW`, -5 pts deduction).
    3. **Backward Compatibility & Safety:**
       - All existing collector tests and assertions remain intact.
       - Added 8 dedicated unit tests in `backend/tests/test_collectors.py` verifying ratio calculations, team scale tolerance, and backlog severity assignment.
  - **Verification:**
    - Full test suite: **253 / 253 passed** (57/57 collector tests passed), **70.78% test coverage** ($\ge 50\%$ required).
    - Ruff check: clean (0 errors). Zero unrelated code modified.
- **Session 28 (2026-10-18): Auto-Scan Schedule Info Popover Smart Placement & Portal Stacking Context Fix.**
  - **Feature:**
    1. **Fixed Message Box Appearing Behind Sibling Cards (Stacking Context Fix):**
       - Root cause: Each repository card in the grid is wrapped inside a Framer Motion card (`motion.div variants={item}`) with `relative` and `transform`, creating independent CSS stacking contexts. Sibling cards later in the DOM order (e.g., Card 2 "Indian-Mathematicians") were painted on top of the popover opened from Card 1 ("Hello-galaxy").
       - Solution: Rendered the floating info popover via React Portal (`createPortal(..., document.body)`) with fixed viewport coordinates (`coords`) and `zIndex: 9999`. By mounting directly into `document.body` in the root stacking context, the popover is guaranteed to appear in front of all repository cards and surrounding elements.
       - Updated `handleClickOutside` with `popoverRef` to preserve click actions inside the portal.
    2. **Fixed Sidebar Overlap on Repository Cards (Screenshot 1):**
       - Replaced hardcoded `sm:right-0` with dynamic horizontal positioning (`placement.horizontal`). If aligning right would project into the sidebar zone (`rect.right - 288 < 250px`), it aligns left, keeping the popover cleanly positioned over the repository card.
    3. **Fixed Top Viewport Cutoff on Repository Detail Header (Screenshot 2):**
       - Added dynamic vertical positioning (`placement.vertical`). If available space above the button is insufficient (`spaceAbove < 230px`), the popover automatically flips to open downwards (`top: rect.bottom + 8`).
    4. **Live Recalculation & Smooth Motion:**
       - Coordinates recalculate immediately on button hover, info button click, window scroll, and window resize.
       - Tailored entry/exit animations (`y: 6` / `y: -6`) to match active vertical orientation for smooth, natural appearance.
       - Added `max-w-[calc(100vw-2rem)]` safeguard against horizontal clipping on mobile devices.
  - **Verification:**
    - TypeScript compiler check `npx tsc --noEmit` passed with 0 errors (exit code 0).
    - Preserved all existing schedule functionality, callbacks, and layout integrity without touching unrelated code.
- **Session 27 (2026-10-18): Minimizable & Draggable Resizable Sidebar, Small-Screen / Tablet Dropdown Menu, and Size-Responsive Button & Typography Measurements.**
  - **Feature:**
    1. **Minimizable & Draggable Resizable Sidebar (Requirement 1):**
       - In `frontend/src/components/layout/Sidebar.tsx`, added a collapse/expand toggle button (`«` / `»`) allowing the user to minimize the sidebar into a 68px icon-only rail with centered icons and hover tooltips.
       - Implemented an interactive right-edge drag handle (`cursor-col-resize`) with live pointer tracking and strictly enforced limits: minimum width `190px`, maximum width `360px`.
       - Fixed drag boundary: removed accidental auto-collapse on drag, enforcing a firm stop at `190px` with zero flickering or forced decrease.
       - Fixed header layout: in collapsed mode, brand logo and expand button `»` are stacked vertically in separate rows, permanently preventing button overlap or logo covering.
       - Enhanced transition smoothness: set 350ms easing transition across width, content margins, and text label opacity/max-width for an elegant, gradual minimize animation.
       - Persisted sidebar width and collapsed state in `localStorage` (`gh_health_sidebar_width`, `gh_health_sidebar_collapsed`).
    2. **Small-Screen / Tablet Navigation Dropdown Menu (Requirement 2):**
       - In `frontend/src/components/layout/Topbar.tsx`, added a responsive `⬡ Menu ▼` trigger button on screens `< 768px` (tablets & mobile).
       - Clicking the trigger smoothly reveals a full-featured navigation dropdown menu with all 6 destinations, active indicator, and unread notification badge, closing automatically on navigation or outside click.
       - In `frontend/src/app/globals.css`, added `@media (max-width: 767px)` rules hiding fixed desktop sidebar and resetting content margins to 0.
    3. **Size-Responsive Button & Text Measurements (Requirement 3):**
       - In `frontend/src/components/layout/Sidebar.tsx`, dynamically scaled button padding, icon size, typography, and notification badges based on active width (`isCompact < 220px`).
       - In `frontend/src/components/scheduler/ScheduleButtonWithInfo.tsx`, streamlined compact mode inside repository cards to display `⏱️ Daily` / `⏱️ Weekly` / `⏱️ Monthly` (saving ~40px) with `text-[11.5px]` font and balanced padding.
       - In `frontend/src/app/repositories/page.tsx`, updated the card action bar (`Scan Now`, `Auto-scan`, `Details →`) with balanced measurements (`px-2.5 py-1.5 text-xs whitespace-nowrap`, `min-w-[76px]`), eliminating awkward wrapping and overflow across all card widths.
  - **Verification:**
    - TypeScript compiler check `npx tsc --noEmit` passed with 0 errors (exit code 0).
    - Zero unrelated code modified.
- **Session 26 (2026-10-18): AI Repository Scan & Architecture Mapping for Interactive Tech Stack Visualizer.**
  - **Feature:**
    1. **Root Cause Analysis:** Previously, when a healthy repository (like `AI-GitHub-Repository-Health-Monitor`) had 0 dependency/quality findings, the client-side text heuristic couldn't detect frontend/backend/database components because it lacked access to `package.json`, `pyproject.toml`, or backend scan context files.
    2. **AI Prompt & Architecture Cue Ingestion:**
       - Enhanced `backend/app/services/scanner/github_fetcher.py` to fetch common manifest files (`package.json`, `frontend/package.json`, `pyproject.toml`, `backend/pyproject.toml`, `requirements.txt`, `Dockerfile`, `go.mod`, etc.) into `ScanContext.file_contents`.
       - Updated `backend/app/services/ai/prompts.py` to include `tech_stack` specification in `_SCHEMA_DESCRIPTION` (name, layer, purpose, confidence) and added `architecture_cues` parameter to `build_analysis_prompt`.
       - Built `_extract_architecture_cues` in `backend/app/services/ai/analyzer.py` extracting repository language, frameworks (Next.js, React, Tailwind, FastAPI, SQLAlchemy, Redis, Docker, GitHub Actions) and fallback nodes.
       - Built `_parse_tech_stack` in `backend/app/services/ai/analyzer.py` normalizing layers to `client`, `backend`, `data`, `devops`, bounds-checking fields, and persisting `tech_stack` inside `analysis.result`.
       - Updated `backend/app/workers/jobs/scan_job.py` to pass `scan_ctx=scan_ctx` directly to `run_ai_analysis`.
       - Updated Pydantic schemas in `backend/app/schemas/ai.py` to include `tech_stack: list[dict[str, Any]] = []`.
    3. **Frontend Integration & Visualizer Enhancement:**
       - In `frontend/src/lib/types.ts`, added `tech_stack` definition to `AIAnalysis["result"]`.
       - In `frontend/src/app/repositories/[id]/page.tsx`, passed `aiAnalysis={aiAnalysis}` to `<TechStackVisualizer />`.
       - In `frontend/src/components/repository/TechStackVisualizer.tsx`:
         - Made AI-detected `aiAnalysis.result.tech_stack` the primary data source, mapping nodes with rich technology visuals, live connection health status, and confidence levels.
         - Merged heuristic nodes to prevent any detected component from being lost.
         - Added an `✨ AI Architecture Scan` badge in the header whenever AI analysis powers the visualizer.
         - Preserved empty repository safety guard (`if (hasNoCode) return null`).
  - **Verification:**
    - Full backend test suite: **245 / 245 passed** (100% pass rate, **75.20% test coverage**, $\ge 50\%$ required).
    - Next.js production build: **Passed with 0 compilation or lint errors**.
    - Docker containers (`backend`, `worker`, `frontend`): restarted and verified running healthy.
- **Session 25 (2026-10-18): Auto-Scan Scheduler UTC & Local Time Info Tags, Local Time Border Highlight (+2px), and UTC/Local Clock View Toggle.**
  - **Feature:**
    1. **Execution Time (UTC) Info Tag:** In `frontend/src/components/scheduler/ScheduleScanModal.tsx`, added an interactive `(ℹ)` info button next to `Execution Time (UTC)` with a floating popover detailing Coordinated Universal Time (UTC) standard, why background workers run on UTC, and how it eliminates Daylight Saving Time (DST) shifts. Includes outside-click dismissal and clean hover states.
    2. **Local Time Conversion Info Tag:** In `frontend/src/components/scheduler/TimeSelectorClock.tsx`, added an interactive `(ℹ)` info button next to `📍 Local Time:` explaining how UTC execution time converts to the user's browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), including real-time offset notation (`getTimezoneOffsetString()`).
    3. **Local Time Area Highlight & Font Increase (+2px):** Wrapped the Local Time title section in a bordered container with a soft indigo/brand gradient highlight (`border border-indigo-200/90 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-white shadow-2xs`). Increased the font size by 2px from `text-[11px]` to `text-[13px] font-extrabold text-indigo-950 font-mono` with an enhanced badge container.
    4. **Clock UTC vs. Local Time Toggle:** Added a segmented toggle button (`[ 🌐 UTC ] [ 📍 Local ]`) directly on the clock interface (`timeViewMode`). When set to `Local`, the clock dial, rotating hands, AM/PM periods, steppers (`-1h`, `+1h`, `-15m`, `+15m`), and hour/minute selector grids reflect local time, converting bidirectionally to/from UTC (`convertLocalToUtc`) so schedules persist consistently in UTC without affecting backend execution.
    5. **12h / 24h Format Toggle Button on Complete Right Side:** Added a segmented toggle button (`[ 12h ] [ 24h ]`) on the complete right side of the interactive time bar (`ml-auto`). When `12h` is selected, the digital clock displays 12-hour format with an interactive `AM`/`PM` badge, the hour sub-mode selector displays 12h notation, and the hour selection grid switches to 12-hour clickable buttons tailored to the current period (`12 AM/PM` to `11 AM/PM`).
    6. **Custom Themed Repository Dropdown (7 Items Visible):** In `frontend/src/components/scheduler/ScheduleScanModal.tsx`, replaced native HTML `<select>` with a custom branded dropdown popup styled to match the app theme (`bg-brand-50/80`, `border-brand-200`, `shadow-xl`, rotating chevron). Fixed viewport height to `max-h-[252px]` ($7 \times 36\text{px}$) to display exactly 7 repositories at a time with smooth scrolling for the rest, click-outside dismissal, and auto-scrolling to the currently active repository upon opening.
  - **Verification:**
    - TypeScript compiler check `npx tsc --noEmit` exited cleanly with 0 errors.
    - Zero unrelated code modified.
- **Session 24 (2026-10-18): Real CVE / Vulnerability Alert Ingestion in Dependencies Collector (Improvement 3).**
  - **Feature:**
    1. **Dependabot Alerts Ingestion:** Enhanced `github_fetcher.py` and `ScanContext` (`context.py`) with `dependency_alerts` field fetching open Dependabot alerts (`/repos/{owner}/{repo}/dependabot/alerts`) with fail-safe error handling.
    2. **Vulnerability Evaluation & Severity Deductions:** Enhanced `DependenciesCollector` (`collectors/dependencies.py`) to evaluate active security vulnerabilities:
       - Flags a `CRITICAL` finding and deducts `25.0` to `40.0 pts` if open CRITICAL alerts exist (affecting packages, CVE/GHSA IDs, automatically capped at $\le 30.0$ by scoring engine).
       - Flags a `HIGH` finding and deducts `15.0` to `25.0 pts` if open HIGH alerts exist (automatically capped at $\le 60.0$).
       - Flags a `MEDIUM` finding and deducts up to `15.0 pts` if only medium/low alerts exist.
       - Records `open_vulnerability_alerts_count`, `critical_vulnerabilities_count`, and `high_vulnerabilities_count` metrics.
    3. **Resilience:** Clean repos or private repos where alerts API is disabled or inaccessible default gracefully with 0 deductions.
  - **Verification:**
    - Full test suite: **240 / 240 passed** (9/9 dependencies collector tests), **69.97% test coverage**.
    - Ruff lint and formatting clean. Zero unrelated files changed.
- **Session 23 (2026-10-18): CI Workflow Execution Status & Pass Rate in Code Quality Collector (Improvement 2).**
  - **Feature:**
    1. **Workflow Runs Ingestion:** Enhanced `github_fetcher.py` and `ScanContext` (`context.py`) with `recent_ci_runs` field fetching the latest 10 GitHub Actions workflow runs (`/repos/{owner}/{repo}/actions/runs`) with fail-safe error handling.
    2. **Execution Health & Flakiness Detection:** Enhanced `CodeQualityCollector` (`collectors/code_quality.py`) to evaluate completed workflow runs:
       - Flags a `HIGH` finding and deducts `-20.0 pts` if the most recent completed run failed (`failure` or `timed_out`).
       - Flags a `MEDIUM` finding and deducts `-10.0 pts` if the overall CI pass rate is below 50% across recent runs.
       - Records `ci_success_rate` (percent) and `ci_failed_run_count` (count) metrics.
    3. **Backward Compatibility:** Repositories without Actions or where Actions API is inaccessible default gracefully with 0 deductions.
  - **Verification:**
    - Full test suite: **237 / 237 passed** (8/8 code quality tests), **70.09% test coverage**.
    - Ruff lint and formatting clean. Zero unrelated files changed.
- **Session 22 (2026-10-17): Content-Level Secret Scanning in Security Collector (Improvement 1).**
  - **Feature:**
    1. **Content Secret Scanning:** Enhanced `SecurityCollector` (`backend/app/services/scanner/collectors/security.py`) to scan repository file contents (`ctx.file_contents`) for hardcoded credentials (unencrypted Private Key blocks, AWS Access Key IDs `AKIA...`, GitHub Personal Access Tokens `ghp_...` / `github_pat_...`, Slack tokens `xox...`).
    2. **False-Positive Guard & Masking:** Filters out dummy/example tokens (`example`, `placeholder`, `your_`, `test`, `sample`) and masks secrets (`_mask_secret`) before recording in findings/evidence to prevent credential leakage.
    3. **GitHub Fetcher Extension:** Added high-risk configuration files (`docker-compose.yml`, `docker-compose.yaml`, `.env.example`) to `_CONTENT_FILES` in `backend/app/services/scanner/github_fetcher.py`.
    4. **Deduplication:** Prevents double-penalizing files already flagged by path. Enforces safety cap (`score <= 30.0`) when content secrets are detected.
  - **Verification:**
    - Full test suite: **234 / 234 passed** (10/10 security collector tests), **70.12% test coverage**.
    - Ruff lint and formatting clean. Zero unrelated files changed.
- **Session 21 (2026-10-17): Automated AI Scan Scheduling (User-Configurable Date, Time & Day).**
  - **Feature:**
    1. **Data Model & Migration:** Added `scan_schedule_enabled`, `scan_schedule_frequency` (DAILY, WEEKLY, MONTHLY), `scan_schedule_time` (HH:MM UTC), `scan_schedule_day` (MON..SUN or 1..28), and `next_scheduled_scan_at` (indexed UTC timestamp) to `repositories` via clean Alembic migration `0002_add_scan_schedule_fields.py`.
    2. **Scheduler Utility:** Built and unit-tested `compute_next_scheduled_scan` in `backend/app/services/scanner/scheduler.py` handling DAILY, WEEKLY, and MONTHLY schedule calculations and rollover.
    3. **REST API Endpoints:** Added `GET /repositories/{id}/schedule`, `PUT /repositories/{id}/schedule` (supports single repo and `apply_to_all` workspace bulk update), and `POST /repositories/schedule-all` in `backend/app/api/v1/repositories.py`.
    4. **ARQ Worker Cron:** Configured periodic cron job in `backend/app/workers/main.py` (`cron(dispatch_scheduled_scans, minute={0, 15, 30, 45})`). Enhanced `dispatch_scheduled_scans` in `backend/app/workers/jobs/scheduled_scans.py` to trigger user-due scans, advance next run timestamps, and maintain 24h default check for non-scheduled repos.
    5. **Frontend UI Modal, Dedicated `components/scheduler/` & Cross-Page Access:**
       - Extracted into dedicated reusable folder `frontend/src/components/scheduler/` containing `ScheduleScanModal.tsx`, `TimeSelectorClock.tsx`, `ScheduleButtonWithInfo.tsx`, and barrel `index.ts`.
       - Built `TimeSelectorClock.tsx` with an interactive SVG analog clock face (hour/minute hands rotate live, dial numbers clickable), 24h hour grid & minute intervals (`:00`, `:05`... `:55`), AM/PM toggles, quick adjustment steppers (`-1h`, `+1h`, `-15m`, `+15m` with balanced padding and `min-w-[38px]`/`min-w-[48px]`), quick preset pills, and live local timezone translation (`📍 Local Time: ...`).
       - Replaced native monthly `<select>` with custom dropdown displaying 5 day selection options at a time (`max-h-[180px] overflow-y-auto`), active day auto-scrolling into view, and click-outside dismissal.
       - Built `ScheduleButtonWithInfo.tsx` featuring an attached interactive `ℹ` info tag. Hovering or clicking the info tag reveals schedule details (frequency, UTC time, local timezone conversion, and next scan timestamp if configured, or "Not scheduled yet" if disabled).
       - Connected `ScheduleScanModal` across all key entry points:
         - **Repository Detail Page (`/repositories/[id]`):** In the page header using `ScheduleButtonWithInfo`.
         - **Repositories List Page (`/repositories`):** In the header action button and on every repository card action row via `ScheduleButtonWithInfo`.
         - **Dashboard Page (`/dashboard`):** In the header actions ("Schedule Scans") and inside the **Quick Actions Widget** (`⏱️ Schedule Scans` action).
         - Supports multi-repo switching in the modal header and workspace-wide "Apply to all" synchronization.
  - **Verification:**
    - Alembic upgrade `0001 -> 0002` applied cleanly with code 0.
    - Unit tests: 8 passed in `backend/tests/test_scheduler.py`.
    - Ruff lint and formatting clean.
    - Frontend TypeScript `npx tsc --noEmit` passed with 0 errors.
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


