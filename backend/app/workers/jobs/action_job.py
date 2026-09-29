"""ARQ background job: execute an approved remediation action.

Invoked asynchronously when an approved action is triggered via the API.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.remediation.executor import execute_remediation_action
from app.workers.deps import get_redis

logger = logging.getLogger(__name__)


async def run_approved_action(ctx: dict[str, Any], action_id: str) -> None:
    """Execute an approved AIAction asynchronously in the background.

    Args:
        ctx: ARQ context dict.
        action_id: String UUID of the AIAction to execute.
    """
    action_uuid = uuid.UUID(action_id)
    logger.info("Starting remediation action job for action_id=%s", action_id)

    from app.database import get_db

    db_gen = get_db()
    db: AsyncSession | None = None
    redis_gen = get_redis()
    try:
        db = await db_gen.__anext__()
        redis = await redis_gen.__anext__()
        await execute_remediation_action(action_uuid, db, redis)
    except StopAsyncIteration:
        pass
    except Exception:
        logger.exception("Unhandled error executing remediation action %s", action_id)
    finally:
        try:
            await redis_gen.aclose()
        except Exception:
            logger.debug("Failed to close redis generator in action job")
        if db is not None:
            try:
                await db_gen.aclose()
            except Exception:
                logger.debug("Failed to close db generator in action job")
