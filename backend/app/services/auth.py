"""FastAPI authentication dependency.

Validates the NextAuth.js v5 JWT (HMAC-SHA256) on every protected request.
Returns a ``CurrentUser`` dataclass that callers use for authorization checks.

NextAuth v5 signs JWTs with HMAC-SHA256 using NEXTAUTH_SECRET as the key.
The token is sent in the ``Authorization: Bearer <token>`` header by the frontend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user identity extracted from a validated JWT."""

    user_id: UUID
    email: str
    name: str | None
    avatar_url: str | None
    workspace_id: UUID | None  # None until /auth/session is called


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> CurrentUser:
    """FastAPI dependency — decode and validate the NextAuth JWT.

    Raises:
        HTTPException 401: Missing, malformed, or expired token.
    """
    settings = get_settings()
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "email"]},
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT received")
        raise credentials_exception
    except jwt.InvalidTokenError as exc:
        logger.warning("Invalid JWT: %s", exc)
        raise credentials_exception

    email: str | None = payload.get("email")
    sub: str | None = payload.get("sub")
    if not email or not sub:
        raise credentials_exception

    # ``sub`` in NextAuth is the user's internal DB UUID (after /auth/session syncs it)
    # On the very first call it may be the OAuth provider's user ID — handled gracefully.
    try:
        user_id = UUID(sub)
    except ValueError:
        # sub is not a UUID yet — treat as anonymous pre-session state
        raise credentials_exception

    workspace_id_str: str | None = payload.get("workspace_id")
    workspace_id: UUID | None = None
    if workspace_id_str:
        try:
            workspace_id = UUID(workspace_id_str)
        except ValueError:
            pass

    return CurrentUser(
        user_id=user_id,
        email=email,
        name=payload.get("name"),
        avatar_url=payload.get("picture"),
        workspace_id=workspace_id,
    )
