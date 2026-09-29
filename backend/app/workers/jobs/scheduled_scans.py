"""ARQ background job: scheduled repository health monitoring.

Dispatches scans for all repositories with `monitoring_enabled = True`
that have not been scanned within the scheduled interval (default 24 hours).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import TriggerType
from app.models.repository import Repository
from app.services.scanner.runner import enqueue_repository_scan

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

    try:
        db = await db_gen.__anext__()

        cutoff = datetime.now(UTC) - timedelta(hours=_DEFAULT_SCAN_INTERVAL_HOURS)

        # Repositories where monitoring is enabled and either never scanned or scanned before cutoff
        stmt = select(Repository).where(
            Repository.monitoring_enabled.is_(True),
            or_(
                Repository.last_scanned_at.is_(None),
                Repository.last_scanned_at < cutoff,
            ),
        )
        result = await db.execute(stmt)
        repos = list(result.scalars().all())

        for repo in repos:
            try:
                scan = await enqueue_repository_scan(
                    repository_id=repo.id,
                    db=db,
                    trigger=TriggerType.SCHEDULED,
                )
                from arq import create_pool
                from arq.connections import RedisSettings

                from app.config import get_settings

                cfg = get_settings()
                arq_pool = await create_pool(RedisSettings.from_dsn(cfg.redis_url))
                await arq_pool.enqueue_job("run_repository_scan", str(scan.id))
                await arq_pool.close()
                dispatched_count += 1
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
        if db is not None:
            try:
                await db_gen.aclose()
            except Exception:
                logger.debug("Failed to close db generator in scheduled_scans")

    logger.info("Scheduled scan dispatch completed: %d scans enqueued", dispatched_count)
    return dispatched_count
