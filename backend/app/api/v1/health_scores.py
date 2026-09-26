"""Health Scores API.

Endpoints:
  GET  /api/v1/repositories/{repository_id}/health            — latest score + delta + categories
  GET  /api/v1/repositories/{repository_id}/health/history    — paginated history
  GET  /api/v1/workspaces/scoring-config                      — current workspace config
  POST /api/v1/workspaces/scoring-config                      — create new config version

Workspace isolation: every resource lookup verifies the repository belongs
to ``current_user.workspace_id``.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import ScoreBand
from app.models.health_score import HealthScore, HealthScoreCategory, ScoringConfiguration
from app.models.repository import Repository
from app.schemas.scoring import (
    CategoryScoreResponse,
    HealthScoreResponse,
    PaginatedHealthScoreResponse,
    ScoringConfigurationRequest,
    ScoringConfigurationResponse,
)
from app.services.auth import CurrentUser, get_current_user
from app.services.scoring.config_service import (
    create_new_config_version,
    get_or_create_default_config,
)

router = APIRouter(tags=["health-scores"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_workspace(current_user: CurrentUser) -> UUID:
    """Return workspace_id or raise 400."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )
    return current_user.workspace_id


async def _get_repo_or_404(
    db: AsyncSession, repository_id: UUID, workspace_id: UUID
) -> Repository:
    """Return repository or 404 if not found / not owned by workspace."""
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.workspace_id == workspace_id,
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found"
        )
    return repo


async def _build_health_score_response(
    health_score: HealthScore,
    previous_score: HealthScore | None,
    db: AsyncSession,
) -> HealthScoreResponse:
    """Assemble a ``HealthScoreResponse`` from ORM objects."""
    # Load categories
    cat_result = await db.execute(
        select(HealthScoreCategory).where(
            HealthScoreCategory.health_score_id == health_score.id
        )
    )
    categories = [
        CategoryScoreResponse(
            category=c.category,
            raw_score=c.raw_score,
            weight=c.weight,
            weighted_score=c.weighted_score,
        )
        for c in cat_result.scalars().all()
    ]

    prev_score_val: float | None = (
        previous_score.overall_score if previous_score else None
    )
    delta: float | None = (
        round(health_score.overall_score - prev_score_val, 2)
        if prev_score_val is not None
        else None
    )

    # Load config version
    config: ScoringConfiguration | None = await db.get(
        ScoringConfiguration, health_score.scoring_configuration_id
    )
    config_version = config.version if config else 1

    return HealthScoreResponse(
        overall_score=health_score.overall_score,
        score_band=ScoreBand.for_score(health_score.overall_score),
        scan_id=health_score.scan_id,
        configuration_version=config_version,
        categories=categories,
        previous_score=prev_score_val,
        score_delta=delta,
        calculated_at=health_score.created_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get(
    "/repositories/{repository_id}/health",
    response_model=HealthScoreResponse,
    summary="Get the latest health score for a repository",
)
async def get_repository_health(
    repository_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthScoreResponse:
    """Return the most recent health score, score band, delta, and category breakdown.

    Returns 404 if the repository has never been scored.
    """
    workspace_id = _require_workspace(current_user)
    await _get_repo_or_404(db, repository_id, workspace_id)

    # Latest score
    hs_result = await db.execute(
        select(HealthScore)
        .where(HealthScore.repository_id == repository_id)
        .order_by(HealthScore.created_at.desc())
        .limit(1)
    )
    health_score = hs_result.scalars().first()
    if health_score is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No health score found — run a scan first.",
        )

    # Previous score (for delta)
    prev_result = await db.execute(
        select(HealthScore)
        .where(
            HealthScore.repository_id == repository_id,
            HealthScore.id != health_score.id,
        )
        .order_by(HealthScore.created_at.desc())
        .limit(1)
    )
    previous = prev_result.scalars().first()

    return await _build_health_score_response(health_score, previous, db)


@router.get(
    "/repositories/{repository_id}/health/history",
    response_model=PaginatedHealthScoreResponse,
    summary="Paginated health score history for a repository",
)
async def get_repository_health_history(
    repository_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedHealthScoreResponse:
    """Return paginated health score history, newest first."""
    workspace_id = _require_workspace(current_user)
    await _get_repo_or_404(db, repository_id, workspace_id)

    base_query = select(HealthScore).where(HealthScore.repository_id == repository_id)

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total: int = count_result.scalar_one()

    offset = (page - 1) * page_size
    hs_result = await db.execute(
        base_query.order_by(HealthScore.created_at.desc()).offset(offset).limit(page_size)
    )
    scores = list(hs_result.scalars().all())

    # Build responses — compare each score against the one before it in the list
    # (list is newest-first, so "previous" is the next item)
    items: list[HealthScoreResponse] = []
    for i, hs in enumerate(scores):
        prev = scores[i + 1] if i + 1 < len(scores) else None
        items.append(await _build_health_score_response(hs, prev, db))

    return PaginatedHealthScoreResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get(
    "/workspaces/scoring-config",
    response_model=ScoringConfigurationResponse,
    summary="Get the current workspace scoring configuration",
)
async def get_scoring_config(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScoringConfigurationResponse:
    """Return the active (default) scoring configuration for the workspace."""
    workspace_id = _require_workspace(current_user)
    config = await get_or_create_default_config(workspace_id, db)
    weights_dict = {w.category: w.weight for w in config.weights}
    return ScoringConfigurationResponse(
        id=config.id,
        name=config.name,
        is_default=config.is_default,
        version=config.version,
        weights=weights_dict,
        created_at=config.created_at,
    )


@router.post(
    "/workspaces/scoring-config",
    response_model=ScoringConfigurationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new scoring configuration version",
)
async def update_scoring_config(
    body: ScoringConfigurationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScoringConfigurationResponse:
    """Create a new scoring configuration version for the workspace.

    Weights must sum to exactly 100.0. The previous configuration is de-listed
    (not deleted) so historical health scores remain reproducible.
    """
    workspace_id = _require_workspace(current_user)
    config = await create_new_config_version(
        workspace_id=workspace_id,
        name=body.name,
        weights=body.weights,
        db=db,
    )
    weights_dict = {w.category: w.weight for w in config.weights}
    return ScoringConfigurationResponse(
        id=config.id,
        name=config.name,
        is_default=config.is_default,
        version=config.version,
        weights=weights_dict,
        created_at=config.created_at,
    )
