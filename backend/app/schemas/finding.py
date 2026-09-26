"""Finding Pydantic schemas (Doc 09 §4)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import AliasChoices, Field

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
    first_seen_at: datetime = Field(
        validation_alias=AliasChoices("first_detected_at", "first_seen_at")
    )
    last_seen_at: datetime = Field(
        validation_alias=AliasChoices("last_detected_at", "last_seen_at")
    )
    resolved_at: datetime | None = None

    model_config = APIModel.model_config


class PaginatedFindingResponse(PaginatedResponse):
    items: list[FindingResponse] = []
