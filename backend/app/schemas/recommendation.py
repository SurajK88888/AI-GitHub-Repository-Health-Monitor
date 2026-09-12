"""Recommendation Pydantic schemas (Doc 09 §7 and §8)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.enums import FindingSeverity, RecommendationStatus
from app.schemas.common import APIModel, PaginatedResponse


class RecommendedActionSchema(APIModel):
    action_type: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class RecommendationResponse(APIModel):
    """Recommendation resource response (Doc 09 §7)."""

    id: uuid.UUID
    repository_id: uuid.UUID
    finding_id: uuid.UUID | None = None
    title: str
    description: str
    priority: FindingSeverity
    recommended_action: RecommendedActionSchema | None = None
    status: RecommendationStatus
    created_at: datetime


class PaginatedRecommendationResponse(PaginatedResponse):
    items: list[RecommendationResponse] = []


class ApproveActionRequest(APIModel):
    """Request body to approve an AI-recommended action (Doc 09 §8)."""

    confirmation: bool = Field(..., description="Must be true to confirm approval of the action.")


class ApproveActionResponse(APIModel):
    """Response after approving an AI action."""

    action_id: uuid.UUID
    recommendation_id: uuid.UUID | None = None
    status: str
    approval_required: bool
    approved_at: datetime | None = None
