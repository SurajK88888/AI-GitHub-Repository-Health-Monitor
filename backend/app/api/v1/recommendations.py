"""Recommendations API.

Endpoints:
  GET  /api/v1/repositories/{repository_id}/recommendations    — list, filterable
  GET  /api/v1/recommendations/{recommendation_id}             — single detail
  POST /api/v1/recommendations/{recommendation_id}/approve     — approve action

Workspace isolation: repository_id lookup verifies workspace ownership before
returning any recommendation data.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import FindingSeverity, RecommendationStatus
from app.models.ai_action import AIAction
from app.models.recommendation import Recommendation
from app.models.repository import Repository
from app.schemas.recommendation import (
    ApproveActionRequest,
    ApproveActionResponse,
    PaginatedRecommendationResponse,
    RecommendationResponse,
    RecommendedActionSchema,
)
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(tags=["recommendations"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_workspace(current_user: CurrentUser) -> UUID:
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )
    return current_user.workspace_id


async def _get_repo_or_404(
    db: AsyncSession, repository_id: UUID, workspace_id: UUID
) -> Repository:
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


def _rec_to_response(rec: Recommendation) -> RecommendationResponse:
    """Convert a Recommendation ORM row to response schema."""
    raw_action = rec.recommended_action or {}
    recommended_action: RecommendedActionSchema | None = None
    if raw_action:
        recommended_action = RecommendedActionSchema(
            action_type=str(raw_action.get("action_type", "REVIEW")),
            parameters={
                k: v for k, v in raw_action.items() if k != "action_type"
            },
        )
    return RecommendationResponse(
        id=rec.id,
        repository_id=rec.repository_id,
        finding_id=rec.finding_id,
        title=rec.title,
        description=rec.description,
        priority=FindingSeverity(rec.priority),
        recommended_action=recommended_action,
        status=RecommendationStatus(rec.status),
        created_at=rec.created_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get(
    "/repositories/{repository_id}/recommendations",
    response_model=PaginatedRecommendationResponse,
    summary="List recommendations for a repository",
)
async def list_recommendations(
    repository_id: UUID,
    priority: FindingSeverity | None = Query(None, description="Filter by priority"),
    rec_status: RecommendationStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedRecommendationResponse:
    """Return paginated recommendations for a repository, with optional filtering."""
    workspace_id = _require_workspace(current_user)
    await _get_repo_or_404(db, repository_id, workspace_id)

    base_query = select(Recommendation).where(
        Recommendation.repository_id == repository_id
    )
    if priority is not None:
        base_query = base_query.where(Recommendation.priority == priority.value)
    if rec_status is not None:
        base_query = base_query.where(Recommendation.status == rec_status.value)

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total: int = count_result.scalar_one()

    offset = (page - 1) * page_size
    rec_result = await db.execute(
        base_query.order_by(Recommendation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    recs = list(rec_result.scalars().all())

    return PaginatedRecommendationResponse(
        items=[_rec_to_response(r) for r in recs],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get(
    "/recommendations/{recommendation_id}",
    response_model=RecommendationResponse,
    summary="Get a single recommendation",
)
async def get_recommendation(
    recommendation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    """Return a single recommendation, verifying workspace isolation."""
    workspace_id = _require_workspace(current_user)

    rec: Recommendation | None = await db.get(Recommendation, recommendation_id)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found"
        )

    # Workspace isolation: verify the recommendation's repository belongs to this workspace
    await _get_repo_or_404(db, rec.repository_id, workspace_id)

    return _rec_to_response(rec)


@router.post(
    "/recommendations/{recommendation_id}/approve",
    response_model=ApproveActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a recommendation and create an AIAction",
)
async def approve_recommendation(
    recommendation_id: UUID,
    body: ApproveActionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApproveActionResponse:
    """Approve a pending recommendation.

    Creates an ``AIAction`` record for auditability.  Only ``PENDING``
    recommendations can be approved.  Returns 400 if ``confirmation`` is not
    ``true`` or 409 if the recommendation is already processed.
    """
    if not body.confirmation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirmation must be true to approve the action.",
        )

    workspace_id = _require_workspace(current_user)

    rec: Recommendation | None = await db.get(Recommendation, recommendation_id)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found"
        )

    # Workspace isolation
    repo = await _get_repo_or_404(db, rec.repository_id, workspace_id)

    # Only PENDING recommendations can be approved
    if rec.status != RecommendationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Recommendation is already in status '{rec.status}' "
                "and cannot be approved again."
            ),
        )

    import uuid as _uuid
    from datetime import UTC, datetime

    now = datetime.now(UTC)

    # Transition recommendation to APPROVED
    rec.status = RecommendationStatus.APPROVED.value

    # Create AIAction for full auditability
    action = AIAction(
        id=_uuid.uuid4(),
        workspace_id=workspace_id,
        repository_id=repo.id,
        recommendation_id=rec.id,
        requested_by=current_user.user_id,
        action_type="RECOMMENDATION_APPROVE",
        status="APPROVED",
        approval_required=True,
        approved_at=now,
        created_at=now,
    )
    db.add(action)

    await db.commit()
    await db.refresh(action)

    return ApproveActionResponse(
        action_id=action.id,
        recommendation_id=rec.id,
        status=action.status,
        approval_required=action.approval_required,
        approved_at=action.approved_at,
    )
