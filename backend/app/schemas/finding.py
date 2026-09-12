"""Finding Pydantic schemas (Doc 09 §4)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from app.enums import DetectionSource, FindingCategory, FindingSeverity, FindingStatus
from app.schemas.common import APIModel, PaginatedResponse


class FindingResponse(APIModel):
    """Finding resource response."""

    id: uuid.UUID
    repository_id: uuid.UUID
    category: FindingCategory
    severity: FindingSeverity
    title: str
    description: str
    evidence: dict[str, Any] | None = None
    detection_source: DetectionSource
    status: FindingStatus
    fingerprint: str
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None = None

    model_config = APIModel.model_config


class PaginatedFindingResponse(PaginatedResponse):
    items: list[FindingResponse] = []
