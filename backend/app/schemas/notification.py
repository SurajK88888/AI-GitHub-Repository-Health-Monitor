"""Notification Pydantic schemas (Doc 09 §9)."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.enums import NotificationSeverity, NotificationType
from app.schemas.common import APIModel, PaginatedResponse


class NotificationResponse(APIModel):
    """In-app notification resource response."""

    id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    severity: NotificationSeverity
    resource_type: str | None = None
    resource_id: str | None = None
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None


class PaginatedNotificationResponse(PaginatedResponse):
    items: list[NotificationResponse] = []


class MarkReadRequest(APIModel):
    """Request to mark one or more notifications as read."""

    notification_ids: list[uuid.UUID]


class NotificationUnreadCountResponse(APIModel):
    """Unread notification count badge response."""

    unread_count: int


class NotificationPreferenceResponse(APIModel):
    """Notification preference item response."""

    channel: str
    event_type: str
    enabled: bool


class UpdateNotificationPreferenceRequest(APIModel):
    """Request body to update a notification preference."""

    event_type: str
    channel: str = "IN_APP"
    enabled: bool
