"""ARQ background job: run a repository scan.

This is the bridge between the ARQ queue and the scanner service layer.
It fetches GitHub data, builds a ScanContext, and delegates to runner.run_scan().
After a successful scan it triggers:
  1. Deterministic health scoring (calculate_and_save_health_score)
  2. AI analysis (run_ai_analysis) — non-blocking, failure safe
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.repository import Repository
from app.models.scan import Scan
from app.services.ai.analyzer import run_ai_analysis
from app.services.github.client import GitHubClient
from app.services.scanner.github_fetcher import build_scan_context
from app.services.scanner.runner import run_scan
from app.services.scoring.engine import calculate_and_save_health_score
from app.workers.deps import get_redis

logger = logging.getLogger(__name__)


async def run_repository_scan(ctx: dict[str, Any], scan_id: str) -> None:
    """ARQ job: execute a full repository scan.

    Args:
        ctx: ARQ context dict.
        scan_id: String UUID of the Scan record to process.
    """
    scan_uuid = uuid.UUID(scan_id)
    logger.info("Starting scan job for scan_id=%s", scan_id)

    from app.database import get_db

    db_gen = get_db()
    db: AsyncSession | None = None
    try:
        db = await db_gen.__anext__()
        await _execute_scan(scan_uuid, db)
    except StopAsyncIteration:
        pass
    except Exception:
        logger.exception("Unhandled error in scan job %s", scan_id)
    finally:
        if db is not None:
            try:
                await db_gen.aclose()
            except Exception:
                logger.debug("DB generator close failed for scan %s", scan_id)


async def _execute_scan(scan_uuid: uuid.UUID, db: AsyncSession) -> None:
    """Inner scan execution — loads repository, builds context, runs scan,
    then triggers scoring and AI analysis."""
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.models.github_installation import GitHubInstallation

    # ── Load scan + repository ─────────────────────────────────────────────
    scan: Scan | None = await db.get(Scan, scan_uuid)
    if scan is None:
        logger.error("Scan %s not found — job aborted", scan_uuid)
        return

    repo: Repository | None = await db.get(Repository, scan.repository_id)
    if repo is None:
        logger.error("Repository %s not found for scan %s", scan.repository_id, scan_uuid)
        return

    # ── Parse owner/repo from full_name ───────────────────────────────────
    full_name: str = repo.full_name
    parts = full_name.split("/", 1)
    if len(parts) != 2:
        logger.error("Invalid full_name '%s' for repo %s", full_name, repo.id)
        return
    owner, repo_name = parts

    # ── Find installation ─────────────────────────────────────────────────
    stmt = select(GitHubInstallation).where(
        GitHubInstallation.workspace_id == repo.workspace_id,
    )
    result = await db.execute(stmt)
    installation = result.scalars().first()
    if installation is None:
        logger.error("No installation found for workspace %s", repo.workspace_id)
        return

    # ── Build GitHub client and run scan ───────────────────────────────────
    redis_gen = get_redis()
    redis = await redis_gen.__anext__()
    scan_succeeded = False
    try:
        async with GitHubClient(
            installation_id=installation.github_installation_id,
            redis=redis,
            owner=owner,
            repo=repo_name,
        ) as gh_client:
            scan_ctx = await build_scan_context(gh_client)

        await run_scan(scan_uuid, scan_ctx, db)
        scan_succeeded = True
    except Exception:
        logger.exception("Failed to fetch data or run scan %s", scan_uuid)
        if scan.status != "FAILED":
            scan.status = "FAILED"
            scan.completed_at = datetime.now(UTC)
            scan.error_message = "GitHub data fetch failed"
            await db.commit()
    finally:
        try:
            await redis_gen.aclose()
        except Exception:
            logger.debug("Redis generator close failed for scan %s", scan_uuid)

    # ── Phase 4: scoring + AI analysis (only if scan succeeded) ───────────
    if scan_succeeded:
        # Deterministic scoring — must succeed for the scan to be meaningful
        health_score = await calculate_and_save_health_score(scan_uuid, db)
        if health_score is None:
            logger.error("Health scoring failed for scan %s", scan_uuid)
            return

        # AI analysis — fault-tolerant, failure does NOT block anything
        await run_ai_analysis(scan_uuid, db)

