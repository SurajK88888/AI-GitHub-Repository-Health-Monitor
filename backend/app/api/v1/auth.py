"""Auth API — session bootstrap endpoint.

Called by the Next.js frontend immediately after NextAuth sign-in to ensure
the user and default workspace exist in the backend database.

Flow:
  1. Frontend receives NextAuth session (JWT).
  2. Frontend calls POST /api/v1/auth/session with the JWT in Authorization header.
  3. Backend decodes JWT, upserts User + Workspace, records login.
  4. Returns { user_id, workspace_id } for the frontend to cache.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import audit_service, user_service
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class SessionResponse(BaseModel):
    """Response body for POST /auth/session."""

    user_id: UUID
    workspace_id: UUID
    message: str = "Session established"


@router.post(
    "/session",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Bootstrap user session",
    description=(
        "Called after NextAuth sign-in. Creates the user and default workspace "
        "if they do not yet exist. Idempotent — safe to call on every page load."
    ),
)
async def bootstrap_session(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Create or refresh the user session in the backend database."""
    user = await user_service.get_or_create_user(
        db,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
    )
    workspace = await user_service.get_or_create_workspace(db, user=user)
    await user_service.record_login(db, user=user)

    await audit_service.log_event(
        db,
        action="USER_LOGIN",
        workspace_id=workspace.id,
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        metadata={"email": user.email},
    )

    await db.commit()

    return SessionResponse(user_id=user.id, workspace_id=workspace.id)
