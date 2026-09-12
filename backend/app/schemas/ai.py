"""AI analysis Pydantic schemas (Doc 09 §11)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from app.enums import AIAnalysisStatus, AIAnalysisType
from app.schemas.common import APIModel


class AIAnalysisResultSchema(APIModel):
    """Structured AI analysis output stored as JSONB."""

    summary: str | None = None
    key_risks: list[str] = []
    recommendations: list[str] = []
    raw: dict[str, Any] | None = None


class AIAnalysisResponse(APIModel):
    """AI analysis resource response (Doc 09 §11)."""

    id: uuid.UUID
    repository_id: uuid.UUID
    scan_id: uuid.UUID | None = None
    analysis_type: AIAnalysisType
    provider: str
    model: str
    prompt_version: str
    status: AIAnalysisStatus
    result: AIAnalysisResultSchema | None = None
    created_at: datetime
    completed_at: datetime | None = None
