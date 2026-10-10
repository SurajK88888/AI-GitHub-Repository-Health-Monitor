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


class DiscoverResponse(BaseModel):
    """Result of dynamic installation discovery and synchronization."""

    installations_synced: int
    repositories_synced: int
    accounts: list[str]


class SyncResponse(BaseModel):
    """Result of a repository sync operation."""

    installation_id: UUID | None = None
    installations_synced: int = 1
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
    "/discover",
    response_model=DiscoverResponse,
    status_code=status.HTTP_200_OK,
    summary="Dynamically discover and sync GitHub App installations and repositories",
)
async def discover_installations(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
) -> DiscoverResponse:
    """Fetch GitHub App installations matching the current user, link to workspace, and sync repositories."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )

    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    from app.services.github.client import GitHubClient, get_app_installations

    try:
        all_installations = await get_app_installations()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to query GitHub App installations: {exc}",
        )

    user_login = (current_user.github_login or "").strip().lower()
    user_id = current_user.github_id

    # Filter installations belonging to this user or organization
    matched_installations = []
    for inst in all_installations:
        account = inst.get("account", {})
        acc_id = account.get("id")
        acc_login = (account.get("login") or "").strip().lower()

        is_match = False
        if user_id and acc_id == user_id:
            is_match = True
        elif user_login and acc_login == user_login:
            is_match = True
        elif current_user.email and acc_login and acc_login in current_user.email.lower():
            is_match = True
        elif len(all_installations) == 1:
            is_match = True

        if is_match:
            matched_installations.append(inst)

    if not matched_installations:
        existing_result = await db.execute(
            select(GitHubInstallation).where(
                GitHubInstallation.workspace_id == current_user.workspace_id,
                GitHubInstallation.status == InstallationStatus.ACTIVE.value,
            )
        )
        existing_list = existing_result.scalars().all()
        existing_ids = {i.github_installation_id for i in existing_list}
        matched_installations = [i for i in all_installations if i.get("id") in existing_ids]

    total_repos_synced = 0
    synced_accounts: list[str] = []

    for inst in matched_installations:
        inst_id: int = inst["id"]
        account = inst.get("account", {})
        acc_id = account.get("id") or 0
        acc_login = account.get("login", "")
        acc_type: str = account.get("type", "User")
        permissions = inst.get("permissions")

        # Upsert installation
        existing_db = await db.execute(
            select(GitHubInstallation).where(GitHubInstallation.github_installation_id == inst_id)
        )
        installation = existing_db.scalar_one_or_none()

        if installation is None:
            installation = GitHubInstallation(
                id=uuid.uuid4(),
                workspace_id=current_user.workspace_id,
                github_installation_id=inst_id,
                github_account_id=acc_id,
                github_account_login=acc_login,
                account_type=acc_type,
                permissions_snapshot=permissions,
                status=InstallationStatus.ACTIVE.value,
            )
            db.add(installation)
            await db.flush()
        else:
            installation.workspace_id = current_user.workspace_id
            installation.github_account_login = acc_login
            installation.account_type = acc_type
            installation.permissions_snapshot = permissions
            installation.status = InstallationStatus.ACTIVE.value
            await db.flush()

        synced_accounts.append(acc_login)

        # Sync repositories for this installation
        async with GitHubClient(installation.github_installation_id, redis) as gh:
            github_repos = await gh.list_installation_repositories()

        for repo_data in github_repos:
            github_repo_id: int = repo_data["id"]
            existing_repo = await db.execute(
                select(Repository).where(
                    Repository.github_installation_id == installation.id,
                    Repository.github_repository_id == github_repo_id,
                )
            )
            repo = existing_repo.scalar_one_or_none()

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
                    monitoring_enabled=True,
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
                repo.monitoring_enabled = True

            total_repos_synced += 1

        await audit_service.log_event(
            db,
            action="INSTALLATION_DISCOVER_SYNC",
            workspace_id=current_user.workspace_id,
            user_id=current_user.user_id,
            resource_type="github_installation",
            resource_id=str(installation.id),
            metadata={"account": acc_login, "repositories_synced": len(github_repos)},
        )

    await db.commit()

    return DiscoverResponse(
        installations_synced=len(matched_installations),
        repositories_synced=total_repos_synced,
        accounts=synced_accounts,
    )


@router.post(
    "/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync repositories from GitHub for a given installation",
)
async def sync_repositories(
    installation_id: UUID | None = None,
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

    if installation_id is None:
        disc = await discover_installations(current_user=current_user, db=db, redis=redis)
        return SyncResponse(
            installation_id=None,
            installations_synced=disc.installations_synced,
            repositories_synced=disc.repositories_synced,
        )

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
                monitoring_enabled=True,
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
            repo.monitoring_enabled = True

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
