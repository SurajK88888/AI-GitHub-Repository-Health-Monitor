"""FastAPI dependency for async Redis client.

Provides a shared Redis connection pool injected into route handlers.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from redis.asyncio import Redis as _Redis

    RedisClient = _Redis[Any]
else:
    from redis.asyncio import Redis as RedisClient

from app.config import get_settings

_redis_pool: RedisClient | None = None


async def get_redis() -> AsyncGenerator[RedisClient, None]:
    """Yield a Redis client from the shared pool.

    Initializes the pool on first call. The pool is reused across requests
    for efficiency.
    """
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        _redis_pool = RedisClient.from_url(settings.redis_url, decode_responses=False)
    yield _redis_pool
