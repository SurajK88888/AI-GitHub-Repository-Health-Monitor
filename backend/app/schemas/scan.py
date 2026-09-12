"""Scan Pydantic schemas (Doc 09 §3)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.enums import ScanStatus, ScanType, TriggerType
from app.schemas.common import APIModel, PaginatedResponse


class CreateScanRequest(APIModel):
    """Request to trigger a new repository scan."""

    scan_type: ScanType = ScanType.FULL
    reason: str | None = Field(default=None, max_length=255)


class ScanResponse(APIModel):
    """Scan resource response."""

    id: uuid.UUID
    repository_id: uuid.UUID
    scan_type: ScanType
    trigger_type: TriggerType
    status: ScanStatus
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None


class PaginatedScanResponse(PaginatedResponse):
    items: list[ScanResponse] = []
