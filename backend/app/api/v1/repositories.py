"""Repositories API.

Endpoints:
  GET   /api/v1/repositories        — paginated list (filtered by workspace)
  GET   /api/v1/repositories/{id}   — single repository
  PATCH /api/v1/repositories/{id}   — toggle monitoring_enabled
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.repository import Repository
from app.models.workspace import WorkspaceMember
from app.schemas.common import PaginatedResponse
from app.schemas.repository import RepositoryResponse
from app.services import audit_service
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/repositories", tags=["repositories"])


class UpdateRepositoryRequest(BaseModel):
    """Partial update for a repository."""

    monitoring_enabled: bool | None = None


async def _get_repo_or_404(
    db: AsyncSession,
    repo_id: UUID,
    workspace_id: UUID,
) -> Repository:
    """Return the repository or raise 404 if not found / not owned by workspace."""
    result = await db.execute(
        select(Repository).where(
            Repository.id == repo_id,
            Repository.workspace_id == workspace_id,
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )
    return repo


async def _assert_workspace_member(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List repositories for the current workspace",
)
async def list_repositories(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    monitoring_only: bool = Query(False, description="Only return monitored repos"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse:
    """Return paginated list of repositories scoped to the user's workspace."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )

    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    query = select(Repository).where(Repository.workspace_id == current_user.workspace_id)
    if monitoring_only:
        query = query.where(Repository.monitoring_enabled.is_(True))

    # Count total
    from sqlalchemy import func
    from sqlalchemy import select as sa_select

    count_result = await db.execute(sa_select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Paginated results
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    repos = result.scalars().all()

    return PaginatedResponse(
        items=[RepositoryResponse.model_validate(r) for r in repos],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 1,
        has_next=(offset + page_size) < total,
    )


@router.get(
    "/{repository_id}",
    response_model=RepositoryResponse,
    summary="Get a single repository",
)
async def get_repository(
    repository_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    """Return a single repository by ID (workspace-scoped)."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)
    return RepositoryResponse.model_validate(repo)


@router.patch(
    "/{repository_id}",
    response_model=RepositoryResponse,
    summary="Update repository settings",
)
async def update_repository(
    repository_id: UUID,
    body: UpdateRepositoryRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    """Toggle monitoring_enabled (and other future settings)."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    changed: dict[str, object] = {}
    if body.monitoring_enabled is not None and repo.monitoring_enabled != body.monitoring_enabled:
        repo.monitoring_enabled = body.monitoring_enabled
        changed["monitoring_enabled"] = body.monitoring_enabled

    if changed:
        await audit_service.log_event(
            db,
            action="REPOSITORY_UPDATED",
            workspace_id=current_user.workspace_id,
            user_id=current_user.user_id,
            resource_type="repository",
            resource_id=str(repo.id),
            metadata=changed,
        )
        await db.commit()
        await db.refresh(repo)

    return RepositoryResponse.model_validate(repo)
