"""FastAPI authentication dependency.

Validates the NextAuth.js v5 JWT (HMAC-SHA256) on every protected request.
Returns a ``CurrentUser`` dataclass that callers use for authorization checks.

NextAuth v5 signs JWTs with HMAC-SHA256 using NEXTAUTH_SECRET as the key.
The token is sent in the ``Authorization: Bearer <token>`` header by the frontend.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

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
    github_login: str | None = None
    github_id: int | None = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
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

    # ``sub`` in NextAuth v5 with GitHub OAuth is the numeric GitHub user ID
    # (e.g. "12345678"). Derive a deterministic UUID so the same GitHub user
    # always maps to the same internal UUID, both before and after /auth/session
    # creates the DB row.
    try:
        user_id = UUID(sub)
    except ValueError:
        user_id = uuid.uuid5(uuid.NAMESPACE_OID, sub)

    workspace_id_str: str | None = payload.get("workspace_id")
    workspace_id: UUID | None = None
    if workspace_id_str:
        try:
            workspace_id = UUID(workspace_id_str)
        except ValueError:
            pass

    # If workspace_id was not baked into the token, look up or auto-create the
    # user and their default workspace in the database.
    if workspace_id is None:
        try:
            from app.services import user_service

            user = await user_service.get_or_create_user(
                db,
                email=email,
                name=payload.get("name"),
                avatar_url=payload.get("picture"),
                user_id=user_id,
            )
            workspace = await user_service.get_or_create_workspace(db, user=user)
            await db.commit()
            workspace_id = workspace.id
            user_id = user.id
        except Exception as exc:
            logger.warning("Auto-bootstrapping workspace failed: %s", exc)

    return CurrentUser(
        user_id=user_id,
        email=email,
        name=payload.get("name"),
        avatar_url=payload.get("picture"),
        workspace_id=workspace_id,
        github_login=payload.get("login"),
        github_id=payload.get("github_id"),
    )
