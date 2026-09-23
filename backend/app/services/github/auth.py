"""GitHub App JWT generation and installation access token management.

Tokens are cached in Redis with a 1-minute safety margin before expiry
so every API call gets a valid token without hammering GitHub's token endpoint.
"""

from __future__ import annotations

import time

import jwt  # PyJWT

from app.config import get_settings
from app.workers.deps import RedisClient

_settings = get_settings()

# Redis key patterns
_INSTALLATION_TOKEN_KEY = "github:token:{installation_id}"
_INSTALLATION_TOKEN_EXPIRY_KEY = "github:token_expiry:{installation_id}"

# Safety margin: refresh token 60 s before it actually expires
_SAFETY_MARGIN_SECONDS = 60


def generate_app_jwt() -> str:
    """Generate a GitHub App JWT (RS256) valid for 10 minutes.

    GitHub App JWTs are used to authenticate as the App itself, not as
    an installation. Use this token only to list installations or exchange
    for an installation access token.

    Raises:
        ValueError: If the private key is not configured.
    """
    settings = get_settings()
    if not settings.github_app_private_key:
        raise ValueError("GITHUB_APP_PRIVATE_KEY is not set")

    import base64

    # The env var stores the key as base64 to avoid multi-line env issues
    try:
        private_key_pem = base64.b64decode(settings.github_app_private_key).decode()
    except Exception:
        # Fallback: assume it's already raw PEM (for test environments)
        private_key_pem = settings.github_app_private_key

    now = int(time.time())
    payload = {
        "iat": now - 60,  # issued 60 s ago to allow clock skew
        "exp": now + 600,  # expires in 10 minutes (GitHub max is 10 min)
        "iss": str(settings.github_app_id),
    }
    return jwt.encode(payload, private_key_pem, algorithm="RS256")


async def get_installation_token(
    installation_id: int,
    redis: RedisClient,
) -> str:
    """Return a valid GitHub installation access token.

    Fetches a cached token from Redis if still valid; otherwise exchanges
    the App JWT for a new installation token and caches it.

    Args:
        installation_id: The GitHub installation ID.
        redis: An async Redis client.

    Returns:
        A valid GitHub installation access token string.
    """
    import httpx

    cache_key = _INSTALLATION_TOKEN_KEY.format(installation_id=installation_id)
    expiry_key = _INSTALLATION_TOKEN_EXPIRY_KEY.format(installation_id=installation_id)

    # Check cache
    cached_token = await redis.get(cache_key)
    cached_expiry = await redis.get(expiry_key)

    if cached_token and cached_expiry:
        expiry_ts = float(cached_expiry)
        if time.time() < expiry_ts - _SAFETY_MARGIN_SECONDS:
            return cached_token.decode() if isinstance(cached_token, bytes) else cached_token

    # Exchange App JWT for installation token
    app_jwt = generate_app_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    token: str = data["token"]
    # GitHub returns expiry as ISO 8601; parse to epoch for cache TTL
    from datetime import datetime

    expires_at_str: str = data["expires_at"]
    expires_at_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
    expires_at_ts = expires_at_dt.timestamp()
    ttl_seconds = int(expires_at_ts - time.time() - _SAFETY_MARGIN_SECONDS)

    if ttl_seconds > 0:
        await redis.setex(cache_key, ttl_seconds, token)
        await redis.setex(expiry_key, ttl_seconds, str(expires_at_ts))

    return token
