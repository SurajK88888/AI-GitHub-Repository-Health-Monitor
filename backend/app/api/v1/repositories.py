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
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import FindingStatus, ScoreBand
from app.models.ai_analysis import AIAnalysis
from app.models.finding import Finding
from app.models.health_score import HealthScore
from app.models.repository import Repository
from app.models.workspace import WorkspaceMember
from app.schemas.ai import AIAnalysisResponse
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


async def _attach_latest_health_scores(
    db: AsyncSession,
    repos: list[Repository],
) -> list[RepositoryResponse]:
    if not repos:
        return []

    repo_ids = [r.id for r in repos]
    stmt = (
        select(HealthScore)
        .where(HealthScore.repository_id.in_(repo_ids))
        .order_by(HealthScore.created_at.desc())
    )
    hs_result = await db.execute(stmt)
    latest_scores: dict[UUID, HealthScore] = {}
    for score in hs_result.scalars().all():
        if score.repository_id not in latest_scores:
            latest_scores[score.repository_id] = score

    # Query open findings for empty / no-source-code repositories
    finding_stmt = (
        select(Finding.repository_id)
        .where(
            Finding.repository_id.in_(repo_ids),
            Finding.status == FindingStatus.OPEN.value,
            (Finding.title.ilike("%no source code%") | Finding.title.ilike("%empty repository%")),
        )
        .distinct()
    )
    empty_repos_result = await db.execute(finding_stmt)
    empty_repo_ids = set(empty_repos_result.scalars().all())

    responses: list[RepositoryResponse] = []
    for r in repos:
        resp = RepositoryResponse.model_validate(r)
        resp.has_no_code = r.id in empty_repo_ids
        latest_hs = latest_scores.get(r.id)
        if latest_hs:
            resp.latest_health_score = {
                "id": str(latest_hs.id),
                "repository_id": str(latest_hs.repository_id),
                "scan_id": str(latest_hs.scan_id),
                "overall_score": latest_hs.overall_score,
                "score_band": ScoreBand.for_score(latest_hs.overall_score).value,
                "calculated_at": latest_hs.created_at.isoformat() if latest_hs.created_at else None,
            }
        responses.append(resp)
    return responses


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List repositories for the current workspace",
)
async def list_repositories(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    limit: int | None = Query(None, description="Alias for page_size"),
    monitoring_only: bool = Query(False, description="Only return monitored repos"),
    search: str | None = Query(
        None, max_length=100, description="Search term for repository name or full_name"
    ),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse:
    """Return paginated list of repositories scoped to the user's workspace."""
    if limit is not None:
        page_size = min(max(limit, 1), 100)

    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )

    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    query = select(Repository).where(Repository.workspace_id == current_user.workspace_id)
    if monitoring_only:
        query = query.where(Repository.monitoring_enabled.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Repository.name.ilike(term),
                Repository.full_name.ilike(term),
            )
        )

    # Count total
    from sqlalchemy import func
    from sqlalchemy import select as sa_select

    count_result = await db.execute(sa_select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Paginated results
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    repos = list(result.scalars().all())
    items = await _attach_latest_health_scores(db, repos)

    return PaginatedResponse(
        items=items,
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
    items = await _attach_latest_health_scores(db, [repo])
    return items[0]


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

    items = await _attach_latest_health_scores(db, [repo])
    return items[0]


@router.get(
    "/{repository_id}/ai-analysis",
    response_model=AIAnalysisResponse | None,
    summary="Get latest AI analysis for a repository",
)
async def get_latest_ai_analysis(
    repository_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AIAnalysisResponse | None:
    """Return the most recent completed AI analysis for the specified repository."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    stmt = (
        select(AIAnalysis)
        .where(AIAnalysis.repository_id == repo.id)
        .order_by(AIAnalysis.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    if analysis is None:
        return None
    return AIAnalysisResponse.model_validate(analysis)
