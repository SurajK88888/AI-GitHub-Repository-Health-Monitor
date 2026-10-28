"""Repositories API.

Endpoints:
  GET   /api/v1/repositories        — paginated list (filtered by workspace)
  GET   /api/v1/repositories/{id}   — single repository
  PATCH /api/v1/repositories/{id}   — toggle monitoring_enabled
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import FindingStatus, ScoreBand
from app.models.ai_analysis import AIAnalysis
from app.models.finding import Finding
from app.models.github_installation import GitHubInstallation
from app.models.health_score import HealthScore
from app.models.repository import Repository
from app.models.workspace import WorkspaceMember
from app.schemas.ai import AIAnalysisResponse
from app.schemas.common import PaginatedResponse
from app.schemas.repository import (
    GenerateDescriptionResponse,
    RepositoryResponse,
    RepositoryScheduleRequest,
    RepositoryScheduleResponse,
    UpdateDescriptionRequest,
    UpdateDescriptionResponse,
)
from app.services import audit_service
from app.services.ai.client import call_ai
from app.services.auth import CurrentUser, get_current_user
from app.services.github.client import GitHubClient
from app.services.scanner.scheduler import compute_next_scheduled_scan
from app.workers.deps import RedisClient, get_redis

logger = logging.getLogger(__name__)

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


@router.get(
    "/{repository_id}/schedule",
    response_model=RepositoryScheduleResponse,
    summary="Get repository auto-scan schedule",
)
async def get_repository_schedule(
    repository_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryScheduleResponse:
    """Return the auto-scan schedule for the specified repository."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    return RepositoryScheduleResponse(
        repository_id=repo.id,
        enabled=repo.scan_schedule_enabled,
        frequency=repo.scan_schedule_frequency,
        time=repo.scan_schedule_time,
        day=repo.scan_schedule_day,
        next_scheduled_scan_at=repo.next_scheduled_scan_at,
    )


@router.put(
    "/{repository_id}/schedule",
    response_model=RepositoryScheduleResponse,
    summary="Configure repository auto-scan schedule",
)
async def update_repository_schedule(
    repository_id: UUID,
    body: RepositoryScheduleRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryScheduleResponse:
    """Set or disable the auto-scan schedule for a repository (with optional bulk workspace apply)."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    next_scan_at: datetime | None = None
    if body.enabled:
        next_scan_at = compute_next_scheduled_scan(
            frequency=body.frequency,
            time_str=body.time,
            day_str=body.day,
        )

    repo.scan_schedule_enabled = body.enabled
    repo.scan_schedule_frequency = body.frequency if body.enabled else None
    repo.scan_schedule_time = body.time if body.enabled else None
    repo.scan_schedule_day = body.day if body.enabled else None
    repo.next_scheduled_scan_at = next_scan_at

    applied_count = 1
    if body.apply_to_all:
        bulk_stmt = select(Repository).where(
            Repository.workspace_id == current_user.workspace_id,
            Repository.monitoring_enabled.is_(True),
            Repository.id != repo.id,
        )
        bulk_res = await db.execute(bulk_stmt)
        other_repos = list(bulk_res.scalars().all())
        for other in other_repos:
            other.scan_schedule_enabled = body.enabled
            other.scan_schedule_frequency = body.frequency if body.enabled else None
            other.scan_schedule_time = body.time if body.enabled else None
            other.scan_schedule_day = body.day if body.enabled else None
            other.next_scheduled_scan_at = next_scan_at
            applied_count += 1

    await audit_service.log_event(
        db,
        action="REPOSITORY_SCHEDULE_UPDATED",
        workspace_id=current_user.workspace_id,
        user_id=current_user.user_id,
        resource_type="repository",
        resource_id=str(repo.id),
        metadata={
            "enabled": body.enabled,
            "frequency": body.frequency,
            "time": body.time,
            "day": body.day,
            "apply_to_all": body.apply_to_all,
            "applied_count": applied_count,
        },
    )
    await db.commit()
    await db.refresh(repo)

    return RepositoryScheduleResponse(
        repository_id=repo.id,
        enabled=repo.scan_schedule_enabled,
        frequency=repo.scan_schedule_frequency,
        time=repo.scan_schedule_time,
        day=repo.scan_schedule_day,
        next_scheduled_scan_at=repo.next_scheduled_scan_at,
        applied_count=applied_count,
    )


@router.post(
    "/schedule-all",
    response_model=RepositoryScheduleResponse,
    summary="Configure auto-scan schedule for all workspace repositories",
)
async def update_all_repositories_schedule(
    body: RepositoryScheduleRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryScheduleResponse:
    """Set or disable auto-scan schedule for all monitored repositories in the workspace."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)

    next_scan_at: datetime | None = None
    if body.enabled:
        next_scan_at = compute_next_scheduled_scan(
            frequency=body.frequency,
            time_str=body.time,
            day_str=body.day,
        )

    stmt = select(Repository).where(
        Repository.workspace_id == current_user.workspace_id,
        Repository.monitoring_enabled.is_(True),
    )
    res = await db.execute(stmt)
    repos = list(res.scalars().all())
    for r in repos:
        r.scan_schedule_enabled = body.enabled
        r.scan_schedule_frequency = body.frequency if body.enabled else None
        r.scan_schedule_time = body.time if body.enabled else None
        r.scan_schedule_day = body.day if body.enabled else None
        r.next_scheduled_scan_at = next_scan_at

    await audit_service.log_event(
        db,
        action="WORKSPACE_REPOSITORIES_SCHEDULE_UPDATED",
        workspace_id=current_user.workspace_id,
        user_id=current_user.user_id,
        resource_type="workspace",
        resource_id=str(current_user.workspace_id),
        metadata={
            "enabled": body.enabled,
            "frequency": body.frequency,
            "time": body.time,
            "day": body.day,
            "applied_count": len(repos),
        },
    )
    await db.commit()

    return RepositoryScheduleResponse(
        repository_id=None,
        enabled=body.enabled,
        frequency=body.frequency if body.enabled else None,
        time=body.time if body.enabled else None,
        day=body.day if body.enabled else None,
        next_scheduled_scan_at=next_scan_at,
        applied_count=len(repos),
    )


@router.post(
    "/{repository_id}/generate-description",
    response_model=GenerateDescriptionResponse,
    summary="Generate a concise repository description using AI",
)
async def generate_repository_description(
    repository_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
) -> GenerateDescriptionResponse:
    """Safely inspect safe documentation and manifests to generate a concise repository description."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    # Fetch installation
    inst_res = await db.execute(
        select(GitHubInstallation).where(GitHubInstallation.id == repo.github_installation_id)
    )
    installation = inst_res.scalar_one_or_none()
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub installation not found for repository.",
        )

    # Safe inspection: strictly read metadata and documentation files, NEVER source code files!
    safe_files_analyzed: list[str] = []
    metadata_context_parts: list[str] = []

    # Priority safe documentation and manifest filenames
    safe_files = [
        "README.md",
        "readme.md",
        "README",
        "package.json",
        "pyproject.toml",
        "Cargo.toml",
        "go.mod",
        "composer.json",
        "pom.xml",
    ]

    try:
        async with GitHubClient(
            installation.github_installation_id,
            redis,
            owner=repo.owner_login,
            repo=repo.name,
        ) as gh:
            for safe_filename in safe_files:
                try:
                    content = await gh.get_file_content(safe_filename)
                    if content and content.strip():
                        safe_files_analyzed.append(safe_filename)
                        # Limit excerpt size per file for speed and prompt bounds
                        excerpt = content.strip()[:1000]
                        metadata_context_parts.append(f"--- File: {safe_filename} ---\n{excerpt}")
                        if len(safe_files_analyzed) >= 3:
                            break
                except Exception as read_err:
                    logger.debug("Could not fetch safe file %s: %s", safe_filename, read_err)
                    continue
    except Exception as exc:
        logger.warning("Could not fetch safe metadata files for %s: %s", repo.full_name, exc)

    safe_context_str = "\n\n".join(metadata_context_parts)

    system_prompt = (
        "You are an expert technical writer and open-source documentation specialist. "
        "Your task is to generate a concise, professional, and clear GitHub repository description (maximum 160 characters) "
        "summarizing what the project does and its core technology stack based ONLY on safe metadata and README overview.\n\n"
        "Rules:\n"
        "1. Strictly keep the description under 160 characters so it fits completely in GitHub's About field.\n"
        "2. Do NOT include markdown syntax (no backticks, bold, or links).\n"
        "3. Do NOT wrap the description in quotes.\n"
        "4. Do NOT use emojis.\n"
        '5. Output valid JSON in the format: {"description": "..."}'
    )

    user_prompt = f"Repository Name: {repo.name}\nFull Name: {repo.full_name}\n"
    if safe_context_str:
        user_prompt += f"\nSafe Metadata & Documentation:\n{safe_context_str}\n"
    else:
        user_prompt += "\nNo README or manifest found. Generate a clean description based on the repository name."

    generated_description = ""
    try:
        ai_response = await call_ai(
            system_instruction=system_prompt,
            user_prompt=user_prompt,
        )
        if isinstance(ai_response, dict):
            desc = ai_response.get("description") or ai_response.get("summary") or ""
            generated_description = str(desc).strip()
        elif isinstance(ai_response, str):
            generated_description = ai_response.strip()
    except Exception as err:
        logger.warning("AI generation failed for repo %s: %s", repo.full_name, err)

    # Clean up description
    if generated_description:
        generated_description = generated_description.strip("\"'` ")
        if len(generated_description) > 160:
            generated_description = generated_description[:157] + "..."
    else:
        generated_description = f"An open-source {repo.name} project."

    return GenerateDescriptionResponse(
        repository_id=repo.id,
        repository_name=repo.name,
        description=generated_description,
        safe_files_analyzed=safe_files_analyzed,
    )


@router.put(
    "/{repository_id}/description",
    response_model=UpdateDescriptionResponse,
    summary="Update repository description in database and optionally on GitHub",
)
async def update_repository_description(
    repository_id: UUID,
    body: UpdateDescriptionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
) -> UpdateDescriptionResponse:
    """Update the repository description in the local DB and optionally push to GitHub."""
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found.",
        )
    await _assert_workspace_member(db, current_user.workspace_id, current_user.user_id)
    repo = await _get_repo_or_404(db, repository_id, current_user.workspace_id)

    clean_desc = body.description.strip()
    applied_to_github = False
    github_error: str | None = None

    if body.apply_to_github:
        inst_res = await db.execute(
            select(GitHubInstallation).where(GitHubInstallation.id == repo.github_installation_id)
        )
        installation = inst_res.scalar_one_or_none()
        if not installation:
            github_error = "GitHub App installation not found."
        else:
            try:
                async with GitHubClient(
                    installation.github_installation_id,
                    redis,
                    owner=repo.owner_login,
                    repo=repo.name,
                ) as gh:
                    await gh.update_repository_description(clean_desc)
                applied_to_github = True
            except Exception as exc:
                logger.warning(
                    "GitHub API description update failed for %s: %s",
                    repo.full_name,
                    exc,
                )
                github_error = (
                    "Could not update directly on GitHub (requires repository administration permission). "
                    "You can still add it manually using the 'Add Manually' option."
                )

    # Save to local database
    repo.description = clean_desc
    await audit_service.log_event(
        db,
        action="REPOSITORY_DESCRIPTION_UPDATED",
        workspace_id=current_user.workspace_id,
        user_id=current_user.user_id,
        resource_type="repository",
        resource_id=str(repo.id),
        metadata={
            "applied_to_github": applied_to_github,
            "github_error": github_error,
            "description": clean_desc,
        },
    )
    await db.commit()

    return UpdateDescriptionResponse(
        repository_id=repo.id,
        description=clean_desc,
        applied_to_github=applied_to_github,
        github_error=github_error,
    )
