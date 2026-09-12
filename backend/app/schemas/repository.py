"""Repository Pydantic schemas (Doc 09 §2)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel, PaginatedResponse, TimestampedResponse


class RepositoryMonitorRequest(APIModel):
    """Request to add / update a repository's monitoring state."""

    github_repository_id: int = Field(gt=0)
    monitoring_enabled: bool = True


class RepositoryResponse(TimestampedResponse):
    """Full repository resource response."""

    id: uuid.UUID
    github_repository_id: int
    owner_login: str
    name: str
    full_name: str
    description: str | None = None
    default_branch: str
    private: bool
    archived: bool
    fork: bool
    html_url: str
    monitoring_enabled: bool
    last_scanned_at: datetime | None = None

    model_config = APIModel.model_config


class PaginatedRepositoryResponse(PaginatedResponse):
    items: list[RepositoryResponse] = []
