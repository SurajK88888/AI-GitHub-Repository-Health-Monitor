"""ARQ background job: scheduled repository health monitoring.

Dispatches scans for:
1. Repositories with user-configured schedules (`scan_schedule_enabled = True`)
   whose `next_scheduled_scan_at <= now`.
2. Monitored repositories without custom schedules (`scan_schedule_enabled = False`)
   that have not been scanned within the default interval (24 hours).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import TriggerType
from app.models.repository import Repository
from app.services.scanner.runner import enqueue_repository_scan
from app.services.scanner.scheduler import compute_next_scheduled_scan

logger = logging.getLogger(__name__)

_DEFAULT_SCAN_INTERVAL_HOURS = 24


async def dispatch_scheduled_scans(ctx: dict[str, Any]) -> int:
    """Find monitored repositories due for a health scan and enqueue them.

    Args:
        ctx: ARQ context dict.

    Returns:
        Number of scans dispatched.
    """
    logger.info("Running dispatch_scheduled_scans cron check...")
    from app.database import get_db

    db_gen = get_db()
    db: AsyncSession | None = None
    dispatched_count = 0

    cfg = get_settings()
    arq_pool = None

    try:
        db = await db_gen.__anext__()
        now = datetime.now(UTC)

        # ── 1. User-configured scheduled repositories due for scan ─────────────
        scheduled_stmt = select(Repository).where(
            Repository.scan_schedule_enabled.is_(True),
            Repository.next_scheduled_scan_at.is_not(None),
            Repository.next_scheduled_scan_at <= now,
        )
        scheduled_res = await db.execute(scheduled_stmt)
        user_due_repos = list(scheduled_res.scalars().all())

        # ── 2. Fallback: monitored repos without custom schedule (24h cutoff) ──
        cutoff = now - timedelta(hours=_DEFAULT_SCAN_INTERVAL_HOURS)
        fallback_stmt = select(Repository).where(
            Repository.monitoring_enabled.is_(True),
            Repository.scan_schedule_enabled.is_(False),
            or_(
                Repository.last_scanned_at.is_(None),
                Repository.last_scanned_at < cutoff,
            ),
        )
        fallback_res = await db.execute(fallback_stmt)
        fallback_repos = list(fallback_res.scalars().all())

        all_target_repos = user_due_repos + fallback_repos
        if not all_target_repos:
            logger.info("No repositories due for scheduled scan at this time.")
            return 0

        arq_pool = await create_pool(RedisSettings.from_dsn(cfg.redis_url))

        for repo in all_target_repos:
            try:
                scan = await enqueue_repository_scan(
                    repository_id=repo.id,
                    db=db,
                    trigger=TriggerType.SCHEDULED,
                )
                await arq_pool.enqueue_job("run_repository_scan", str(scan.id))
                dispatched_count += 1

                # If this was a custom user schedule, advance next_scheduled_scan_at
                if repo.scan_schedule_enabled:
                    repo.next_scheduled_scan_at = compute_next_scheduled_scan(
                        frequency=repo.scan_schedule_frequency or "DAILY",
                        time_str=repo.scan_schedule_time or "02:00",
                        day_str=repo.scan_schedule_day,
                        from_dt=now,
                    )
                    await db.commit()

                logger.info(
                    "Enqueued scheduled scan %s for repo %s (%s)",
                    scan.id,
                    repo.id,
                    repo.full_name,
                )
            except Exception:
                logger.exception("Failed to enqueue scheduled scan for repo %s", repo.id)

    except StopAsyncIteration:
        pass
    except Exception:
        logger.exception("Unhandled error in dispatch_scheduled_scans")
    finally:
        if arq_pool is not None:
            try:
                await arq_pool.close()
            except Exception:
                logger.debug("Failed to close arq_pool in scheduled_scans")
        if db is not None:
            try:
                await db_gen.aclose()
            except Exception:
                logger.debug("Failed to close db generator in scheduled_scans")

    logger.info("Scheduled scan dispatch completed: %d scans enqueued", dispatched_count)
    return dispatched_count
