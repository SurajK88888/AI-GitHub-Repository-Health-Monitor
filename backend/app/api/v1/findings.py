"""Findings API — query repository findings.

Endpoints:
    GET /api/v1/repositories/{repo_id}/findings   — list findings (filterable)
    GET /api/v1/findings/{finding_id}             — single finding detail
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import DetectionSource, FindingCategory, FindingSeverity, FindingStatus
from app.models.finding import Finding
from app.models.repository import Repository
from app.schemas.finding import FindingResponse, PaginatedFindingResponse
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(tags=["findings"])


async def _get_owned_repo(
    repo_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession,
) -> Repository:
    """Return the repository if it belongs to the user's workspace, else 404."""
    if not current_user.workspace_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No workspace")
    result = await db.execute(
        select(Repository).where(
            Repository.id == repo_id,
            Repository.workspace_id == current_user.workspace_id,
        )
    )
    repo = result.scalars().first()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _finding_to_response(f: Finding) -> FindingResponse:
    return FindingResponse(
        id=f.id,
        repository_id=f.repository_id,
        category=FindingCategory(f.category),
        severity=FindingSeverity(f.severity),
        title=f.title,
        description=f.description,
        evidence=f.evidence,
        detection_source=DetectionSource(f.detection_source),
        status=FindingStatus(f.status),
        fingerprint=f.fingerprint,
        first_seen_at=f.first_detected_at,
        last_seen_at=f.last_detected_at,
        resolved_at=f.resolved_at,
    )


# ── GET /repositories/{repo_id}/findings ──────────────────────────────────────

@router.get(
    "/repositories/{repo_id}/findings",
    response_model=PaginatedFindingResponse,
    summary="List findings for a repository",
)
async def list_findings(
    repo_id: uuid.UUID,
    category: FindingCategory | None = Query(default=None),
    severity: FindingSeverity | None = Query(default=None),
    finding_status: FindingStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedFindingResponse:
    """Return paginated findings for a repository with optional filters."""
    await _get_owned_repo(repo_id, current_user, db)

    stmt = select(Finding).where(Finding.repository_id == repo_id)
    if category is not None:
        stmt = stmt.where(Finding.category == category.value)
    if severity is not None:
        stmt = stmt.where(Finding.severity == severity.value)
    if finding_status is not None:
        stmt = stmt.where(Finding.status == finding_status.value)

    # Total count (all pages)
    total_result = await db.execute(stmt)
    all_findings = total_result.scalars().all()
    total = len(all_findings)

    # Paginated result
    offset = (page - 1) * page_size
    page_result = await db.execute(
        stmt.order_by(Finding.severity, Finding.last_detected_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    findings = page_result.scalars().all()

    return PaginatedFindingResponse(
        items=[_finding_to_response(f) for f in findings],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ── GET /findings/{finding_id} ────────────────────────────────────────────────

@router.get(
    "/findings/{finding_id}",
    response_model=FindingResponse,
    summary="Get a single finding",
)
async def get_finding(
    finding_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FindingResponse:
    """Return a single finding, enforcing workspace isolation."""
    finding: Finding | None = await db.get(Finding, finding_id)
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    # Verify workspace ownership
    await _get_owned_repo(finding.repository_id, current_user, db)
    return _finding_to_response(finding)
