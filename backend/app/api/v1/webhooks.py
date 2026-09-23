"""GitHub webhook ingestion endpoint.

Security chain (Doc 06 §7):
  1. Validate HMAC-SHA256 signature (before reading any payload field).
  2. Validate required headers.
  3. Idempotency check (Redis key on X-GitHub-Delivery).
  4. Enqueue ARQ job.
  5. Return 202 Accepted immediately.

No analysis runs inside this request handler.
"""

from __future__ import annotations

import logging

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.services.github.webhook import verify_and_parse
from app.workers.deps import RedisClient, get_redis
from app.workers.jobs.webhook_processor import process_webhook

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Redis idempotency key: 24-hour TTL
_DELIVERY_TTL = 86_400
_DELIVERY_KEY_PREFIX = "webhook:seen:"


@router.post(
    "/github",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Receive GitHub App webhook events",
    description=(
        "GitHub posts signed webhook events here. "
        "Signature is validated before any payload processing. "
        "Processing is async — always returns 202 immediately."
    ),
)
async def receive_github_webhook(
    request: Request,
    redis: RedisClient = Depends(get_redis),
) -> JSONResponse:
    """Validate, deduplicate, and enqueue a GitHub webhook event."""
    # Step 1 & 2: Validate signature + parse
    event = await verify_and_parse(request)

    # Step 3: Idempotency — skip duplicate deliveries
    idempotency_key = f"{_DELIVERY_KEY_PREFIX}{event.delivery_id}"
    already_seen = await redis.get(idempotency_key)
    if already_seen:
        logger.info(
            "Duplicate webhook delivery %s (event=%s) — skipping",
            event.delivery_id,
            event.event_type,
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"queued": False, "reason": "duplicate"},
        )

    # Mark delivery as seen
    await redis.setex(idempotency_key, _DELIVERY_TTL, "1")

    # Step 4: Enqueue ARQ job
    settings = get_settings()
    try:
        pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await pool.enqueue_job(
            process_webhook.__name__,
            event.model_dump(),
        )
        await pool.close()
    except Exception:
        logger.exception("Failed to enqueue webhook job for delivery %s", event.delivery_id)
        # Still return 202 — GitHub will retry if we return 5xx

    logger.info(
        "Webhook enqueued: event=%s delivery=%s installation=%s",
        event.event_type,
        event.delivery_id,
        event.installation_id,
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"queued": True},
    )
