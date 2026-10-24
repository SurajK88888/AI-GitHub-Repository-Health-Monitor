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
    private: bool = Field(default=False, validation_alias="is_private")
    archived: bool = Field(default=False, validation_alias="is_archived")
    fork: bool = Field(default=False, validation_alias="is_fork")
    html_url: str
    monitoring_enabled: bool
    last_scanned_at: datetime | None = None
    latest_health_score: dict[str, object] | None = None
    has_no_code: bool = False

    # Auto-scan schedule fields
    scan_schedule_enabled: bool = False
    scan_schedule_frequency: str | None = None
    scan_schedule_time: str | None = None
    scan_schedule_day: str | None = None
    next_scheduled_scan_at: datetime | None = None

    model_config = APIModel.model_config


class RepositoryScheduleRequest(APIModel):
    """Request to configure auto-scan schedule for a repository."""

    enabled: bool = True
    frequency: str = Field(default="DAILY")
    time: str = Field(default="02:00")
    day: str | None = None
    apply_to_all: bool = False


class RepositoryScheduleResponse(APIModel):
    """Auto-scan schedule configuration response."""

    repository_id: uuid.UUID | None = None
    enabled: bool
    frequency: str | None = None
    time: str | None = None
    day: str | None = None
    next_scheduled_scan_at: datetime | None = None
    applied_count: int | None = None


class PaginatedRepositoryResponse(PaginatedResponse):
    items: list[RepositoryResponse] = []


class GenerateDescriptionResponse(APIModel):
    """AI generated repository description response."""

    repository_id: uuid.UUID
    repository_name: str
    description: str
    safe_files_analyzed: list[str] = Field(default_factory=list)


class UpdateDescriptionRequest(APIModel):
    """Request to update a repository's description."""

    description: str = Field(min_length=1, max_length=1024)
    apply_to_github: bool = False


class UpdateDescriptionResponse(APIModel):
    """Response after updating repository description."""

    repository_id: uuid.UUID
    description: str
    applied_to_github: bool
    github_error: str | None = None
