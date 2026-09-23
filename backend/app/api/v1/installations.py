"""GitHub App installations API.

Endpoints:
  GET  /api/v1/installations        — list installations for the workspace
  POST /api/v1/installations/sync   — sync repositories from GitHub for an installation
"""

from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import InstallationStatus
from app.models.github_installation import GitHubInstallation
from app.models.repository import Repository
from app.models.workspace import WorkspaceMember
from app.services import audit_service
from app.services.auth import CurrentUser, get_current_user
from app.workers.deps import RedisClient, get_redis

router = APIRouter(prefix="/installations", tags=["installations"])


class InstallationResponse(BaseModel):
    """Single GitHub App installation."""

    id: UUID
    workspace_id: UUID
    github_installation_id: int
    github_account_login: str
    account_type: str
    status: str

    model_config = {"from_attributes": True}


class SyncResponse(BaseModel):
    """Result of a repository sync operation."""

    installation_id: UUID
    repositories_synced: int


async def _assert_workspace_member(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> None:
    """Raise 403 if user is not a member of the workspace."""
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
    response_model=list[InstallationResponse],
    summary="List GitHub App installations for the current workspace",
)
async def list_installations(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InstallationResponse]:
    """Return all active GitHub App installations for the user's workspace."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )

    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    result = await db.execute(
        select(GitHubInstallation).where(
            GitHubInstallation.workspace_id == current_user.workspace_id,
            GitHubInstallation.status == InstallationStatus.ACTIVE,
        )
    )
    installations = result.scalars().all()
    return [InstallationResponse.model_validate(i) for i in installations]


@router.post(
    "/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync repositories from GitHub for a given installation",
)
async def sync_repositories(
    installation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
) -> SyncResponse:
    """Fetch repository list from GitHub and upsert into the database."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )

    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    # Verify installation belongs to this workspace
    result = await db.execute(
        select(GitHubInstallation).where(
            GitHubInstallation.id == installation_id,
            GitHubInstallation.workspace_id == current_user.workspace_id,
        )
    )
    installation = result.scalar_one_or_none()
    if installation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found",
        )

    # Fetch repos from GitHub
    from app.services.github.client import GitHubClient

    synced = 0
    async with GitHubClient(installation.github_installation_id, redis) as gh:
        github_repos = await gh.list_installation_repositories()

    for repo_data in github_repos:
        github_repo_id: int = repo_data["id"]
        existing = await db.execute(
            select(Repository).where(
                Repository.github_installation_id == installation.id,
                Repository.github_repository_id == github_repo_id,
            )
        )
        repo = existing.scalar_one_or_none()

        if repo is None:
            repo = Repository(
                id=uuid.uuid4(),
                workspace_id=current_user.workspace_id,
                github_installation_id=installation.id,
                github_repository_id=github_repo_id,
                owner_login=repo_data["owner"]["login"],
                name=repo_data["name"],
                full_name=repo_data["full_name"],
                description=repo_data.get("description"),
                default_branch=repo_data.get("default_branch", "main"),
                is_private=repo_data.get("private", False),
                is_archived=repo_data.get("archived", False),
                is_fork=repo_data.get("fork", False),
                html_url=repo_data["html_url"],
            )
            db.add(repo)
        else:
            repo.name = repo_data["name"]
            repo.full_name = repo_data["full_name"]
            repo.description = repo_data.get("description")
            repo.default_branch = repo_data.get("default_branch", "main")
            repo.is_private = repo_data.get("private", False)
            repo.is_archived = repo_data.get("archived", False)
            repo.is_fork = repo_data.get("fork", False)
            repo.html_url = repo_data["html_url"]

        synced += 1

    await audit_service.log_event(
        db,
        action="INSTALLATION_SYNC",
        workspace_id=current_user.workspace_id,
        user_id=current_user.user_id,
        resource_type="github_installation",
        resource_id=str(installation.id),
        metadata={"repositories_synced": synced},
    )

    await db.commit()
    return SyncResponse(installation_id=installation.id, repositories_synced=synced)
