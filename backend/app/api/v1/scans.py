"""Scans API — trigger and query repository scans.

Endpoints:
    POST /api/v1/repositories/{repo_id}/scans   — trigger a new scan
    GET  /api/v1/repositories/{repo_id}/scans   — list scans for a repository
    GET  /api/v1/scans/{scan_id}                — fetch single scan status
    GET  /api/v1/scans/{scan_id}/metrics        — fetch metrics for a scan
"""

from __future__ import annotations

import logging
import uuid

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.enums import TriggerType
from app.models.repository import Repository
from app.models.scan import Scan, ScanMetric
from app.schemas.scan import (
    CreateScanRequest,
    PaginatedScanResponse,
    ScanMetricResponse,
    ScanResponse,
)
from app.services.auth import CurrentUser, get_current_user
from app.workers.jobs.scan_job import run_repository_scan

logger = logging.getLogger(__name__)

router = APIRouter(tags=["scans"])


# ── Helper: assert workspace ownership ────────────────────────────────────────

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


# ── POST /repositories/{repo_id}/scans ────────────────────────────────────────

@router.post(
    "/repositories/{repo_id}/scans",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ScanResponse,
    summary="Trigger a new repository scan",
)
async def trigger_scan(
    repo_id: uuid.UUID,
    body: CreateScanRequest = CreateScanRequest(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    """Create a QUEUED scan record and enqueue the background scan job."""
    repo = await _get_owned_repo(repo_id, current_user, db)
    from app.services.scanner.runner import enqueue_repository_scan
    scan = await enqueue_repository_scan(repo.id, db, trigger=TriggerType.MANUAL)

    # Enqueue ARQ job
    settings = get_settings()
    try:
        pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await pool.enqueue_job(run_repository_scan.__name__, str(scan.id))
        await pool.close()
    except Exception:
        logger.exception("Failed to enqueue scan job for scan %s", scan.id)

    return ScanResponse.model_validate(scan)


# ── GET /repositories/{repo_id}/scans ─────────────────────────────────────────

@router.get(
    "/repositories/{repo_id}/scans",
    response_model=PaginatedScanResponse,
    summary="List scans for a repository",
)
async def list_scans(
    repo_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedScanResponse:
    """Return paginated scans for a repository, newest first."""
    await _get_owned_repo(repo_id, current_user, db)

    total_result = await db.execute(
        select(Scan).where(Scan.repository_id == repo_id)
    )
    all_scans = total_result.scalars().all()
    total = len(all_scans)

    offset = (page - 1) * page_size
    page_result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repo_id)
        .order_by(Scan.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    scans = page_result.scalars().all()

    return PaginatedScanResponse(
        items=[ScanResponse.model_validate(s) for s in scans],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ── GET /scans/{scan_id} ──────────────────────────────────────────────────────

@router.get(
    "/scans/{scan_id}",
    response_model=ScanResponse,
    summary="Get scan status",
)
async def get_scan(
    scan_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    """Return scan status and lifecycle timestamps."""
    scan: Scan | None = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    # Verify workspace ownership via the scan's repository
    await _get_owned_repo(scan.repository_id, current_user, db)
    return ScanResponse.model_validate(scan)


# ── GET /scans/{scan_id}/metrics ──────────────────────────────────────────────

@router.get(
    "/scans/{scan_id}/metrics",
    response_model=list[ScanMetricResponse],
    summary="Get metrics produced by a scan",
)
async def get_scan_metrics(
    scan_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ScanMetricResponse]:
    """Return all metrics recorded for a completed scan."""
    scan: Scan | None = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    await _get_owned_repo(scan.repository_id, current_user, db)

    result = await db.execute(
        select(ScanMetric)
        .where(ScanMetric.scan_id == scan_id)
        .order_by(ScanMetric.category, ScanMetric.metric_name)
    )
    metrics = result.scalars().all()
    return [
        ScanMetricResponse(
            id=m.id,
            scan_id=m.scan_id,
            category=m.category,
            metric_name=m.metric_name,
            metric_value=m.metric_value,
            metric_unit=m.metric_unit,
            extra=m.metadata_,
        )
        for m in metrics
    ]
