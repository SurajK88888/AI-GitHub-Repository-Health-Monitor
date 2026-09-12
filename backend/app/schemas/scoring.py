"""Health scoring Pydantic schemas (Doc 09 §5 and §6)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field, model_validator

from app.enums import FindingCategory, ScoreBand
from app.schemas.common import APIModel, PaginatedResponse


class CategoryScoreResponse(APIModel):
    """Per-category breakdown within a health score."""

    category: FindingCategory
    raw_score: float = Field(ge=0.0, le=100.0)
    weight: float = Field(ge=0.0, le=100.0)
    weighted_score: float = Field(ge=0.0, le=100.0)


class HealthScoreResponse(APIModel):
    """Overall health score response (Doc 09 §5)."""

    overall_score: float = Field(ge=0.0, le=100.0)
    score_band: ScoreBand
    scan_id: uuid.UUID
    configuration_version: int
    categories: list[CategoryScoreResponse]
    previous_score: float | None = None
    score_delta: float | None = None
    calculated_at: datetime


class PaginatedHealthScoreResponse(PaginatedResponse):
    items: list[HealthScoreResponse] = []


# ── Scoring configuration request (Doc 09 §6) ─────────────────────────────────

DEFAULT_WEIGHTS: dict[str, float] = {
    "SECURITY": 20.0,
    "CODE_QUALITY": 20.0,
    "DEPENDENCIES": 15.0,
    "DOCUMENTATION": 10.0,
    "ISSUES": 10.0,
    "PULL_REQUESTS": 10.0,
    "ACTIVITY": 10.0,
    "CONFIGURATION": 5.0,
}


class ScoringConfigurationRequest(APIModel):
    """Request to create or update a scoring configuration."""

    name: str = Field(min_length=1, max_length=255)
    weights: dict[str, float]

    @model_validator(mode="after")
    def weights_must_total_100(self) -> ScoringConfigurationRequest:
        total = sum(self.weights.values())
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"Category weights must sum to 100.0, got {total:.2f}")
        if any(w < 0 for w in self.weights.values()):
            raise ValueError("All weights must be non-negative")
        return self


class ScoringConfigurationResponse(APIModel):
    """Scoring configuration resource response."""

    id: uuid.UUID
    name: str
    is_default: bool
    version: int
    weights: dict[str, float]
    created_at: datetime
