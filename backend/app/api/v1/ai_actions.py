"""AI Actions API.

Endpoints:
  GET  /api/v1/repositories/{repository_id}/actions    — list actions for repository
  GET  /api/v1/actions/{action_id}                     — get single action details
  POST /api/v1/actions/{action_id}/execute             — trigger async remediation execution

Workspace isolation: repository and action ownership is strictly verified against
``current_user.workspace_id``.
"""

from __future__ import annotations

from uuid import UUID

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.enums import AIActionStatus
from app.models.ai_action import AIAction
from app.models.repository import Repository
from app.schemas.ai import AIActionResponse, PaginatedAIActionResponse
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(tags=["ai-actions"])


# ── Helpers ────────────────────────────────────────────────────────────────────


def _require_workspace(current_user: CurrentUser) -> UUID:
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )
    return current_user.workspace_id


async def _get_repo_or_404(db: AsyncSession, repository_id: UUID, workspace_id: UUID) -> Repository:
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.workspace_id == workspace_id,
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _to_action_response(action: AIAction) -> AIActionResponse:
    return AIActionResponse(
        id=action.id,
        workspace_id=action.workspace_id,
        repository_id=action.repository_id,
        recommendation_id=action.recommendation_id,
        requested_by=action.requested_by,
        action_type=action.action_type,
        status=action.status,
        approval_required=action.approval_required,
        approved_at=action.approved_at,
        completed_at=action.completed_at,
        result=action.result,
        error_message=action.error_message,
        created_at=action.created_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get(
    "/repositories/{repository_id}/actions",
    response_model=PaginatedAIActionResponse,
    summary="List actions for a repository",
)
async def list_repository_actions(
    repository_id: UUID,
    action_status: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAIActionResponse:
    """Return paginated AI actions for a repository with optional status filtering."""
    workspace_id = _require_workspace(current_user)
    await _get_repo_or_404(db, repository_id, workspace_id)

    query = select(AIAction).where(
        AIAction.repository_id == repository_id,
        AIAction.workspace_id == workspace_id,
    )
    if action_status:
        query = query.where(AIAction.status == action_status.upper())

    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total: int = count_res.scalar_one()

    offset = (page - 1) * page_size
    items_res = await db.execute(
        query.order_by(AIAction.created_at.desc()).offset(offset).limit(page_size)
    )
    actions = list(items_res.scalars().all())

    return PaginatedAIActionResponse(
        items=[_to_action_response(a) for a in actions],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get(
    "/actions/{action_id}",
    response_model=AIActionResponse,
    summary="Get single action detail",
)
async def get_action(
    action_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AIActionResponse:
    """Get single AI action, ensuring workspace boundary isolation."""
    workspace_id = _require_workspace(current_user)

    action: AIAction | None = await db.get(AIAction, action_id)
    if action is None or action.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    return _to_action_response(action)


@router.post(
    "/actions/{action_id}/execute",
    response_model=AIActionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Execute an approved action asynchronously",
)
async def execute_action(
    action_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AIActionResponse:
    """Trigger background execution of an approved action.

    Action must be in APPROVED status. Returns 202 Accepted once enqueued.
    """
    workspace_id = _require_workspace(current_user)

    action: AIAction | None = await db.get(AIAction, action_id)
    if action is None or action.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    if action.status != AIActionStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Action is in '{action.status}' status and cannot be executed (must be APPROVED).",
        )

    # Enqueue background job via ARQ
    try:
        cfg = get_settings()
        pool = await create_pool(RedisSettings.from_dsn(cfg.redis_url))
        await pool.enqueue_job("run_approved_action", str(action.id))
        await pool.close()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to enqueue background remediation job. Please retry.",
        ) from exc

    return _to_action_response(action)
