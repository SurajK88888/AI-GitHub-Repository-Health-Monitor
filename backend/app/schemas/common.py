"""Common Pydantic schemas shared across all resources."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    """Base for all API response/request schemas."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PaginatedResponse(APIModel):
    """Standard paginated collection wrapper."""

    items: list  # override in concrete schemas
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
    total: int = Field(ge=0)
    has_next: bool


class ErrorResponse(APIModel):
    """Standard error envelope — never exposes internal details."""

    code: str
    message: str
    details: dict | None = None
    request_id: uuid.UUID | None = None


class TimestampedResponse(APIModel):
    """Adds created_at / updated_at to responses."""

    created_at: datetime
    updated_at: datetime
