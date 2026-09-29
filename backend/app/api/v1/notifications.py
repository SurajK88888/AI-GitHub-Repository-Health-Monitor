"""Notifications API.

Endpoints:
  GET  /api/v1/notifications               — paginated list of user notifications
  GET  /api/v1/notifications/unread-count  — count of unread notifications
  POST /api/v1/notifications/mark-read     — mark specific notifications as read
  POST /api/v1/notifications/mark-all-read — mark all notifications as read
  GET  /api/v1/notifications/preferences   — list user notification preferences
  PUT  /api/v1/notifications/preferences   — update/upsert a preference

Workspace isolation: notifications are scoped to ``current_user.workspace_id`` and
``current_user.user_id``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import NotificationSeverity, NotificationType
from app.models.notification import Notification, NotificationPreference
from app.schemas.notification import (
    MarkReadRequest,
    NotificationPreferenceResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
    PaginatedNotificationResponse,
    UpdateNotificationPreferenceRequest,
)
from app.services.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Helpers ────────────────────────────────────────────────────────────────────


def _require_workspace(current_user: CurrentUser) -> UUID:
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Call POST /auth/session first.",
        )
    return current_user.workspace_id


def _to_notification_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        type=NotificationType(n.type),
        title=n.title,
        message=n.message,
        severity=NotificationSeverity(n.severity),
        resource_type=n.resource_type,
        resource_id=n.resource_id,
        is_read=n.is_read,
        created_at=n.created_at,
        read_at=n.read_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=PaginatedNotificationResponse,
    summary="List notifications for the current user and workspace",
)
async def list_notifications(
    is_read: bool | None = Query(None, description="Filter by read status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedNotificationResponse:
    """Return paginated notifications, newest first."""
    workspace_id = _require_workspace(current_user)

    query = select(Notification).where(
        Notification.workspace_id == workspace_id,
        Notification.user_id == current_user.user_id,
    )
    if is_read is not None:
        query = query.where(Notification.is_read.is_(is_read))

    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total: int = count_res.scalar_one()

    offset = (page - 1) * page_size
    items_res = await db.execute(
        query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
    )
    notifications = list(items_res.scalars().all())

    return PaginatedNotificationResponse(
        items=[_to_notification_response(n) for n in notifications],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    summary="Get count of unread notifications",
)
async def get_unread_count(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationUnreadCountResponse:
    """Return number of unread notifications for badge presentation."""
    workspace_id = _require_workspace(current_user)

    query = select(func.count()).where(
        Notification.workspace_id == workspace_id,
        Notification.user_id == current_user.user_id,
        Notification.is_read.is_(False),
    )
    res = await db.execute(query)
    count: int = res.scalar_one()
    return NotificationUnreadCountResponse(unread_count=count)


@router.post(
    "/mark-read",
    summary="Mark specific notifications as read",
)
async def mark_notifications_read(
    body: MarkReadRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark the given notification IDs as read."""
    workspace_id = _require_workspace(current_user)

    if not body.notification_ids:
        return {"success": True, "updated": 0}

    now = datetime.now(UTC)
    stmt = (
        update(Notification)
        .where(
            Notification.id.in_(body.notification_ids),
            Notification.workspace_id == workspace_id,
            Notification.user_id == current_user.user_id,
        )
        .values(is_read=True, read_at=now)
    )
    result = await db.execute(stmt)
    await db.commit()
    rowcount = int(getattr(result, "rowcount", 0))
    return {"success": True, "updated": rowcount}


@router.post(
    "/mark-all-read",
    summary="Mark all user notifications as read",
)
async def mark_all_notifications_read(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark all unread notifications for this user as read."""
    workspace_id = _require_workspace(current_user)

    now = datetime.now(UTC)
    stmt = (
        update(Notification)
        .where(
            Notification.workspace_id == workspace_id,
            Notification.user_id == current_user.user_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True, read_at=now)
    )
    result = await db.execute(stmt)
    await db.commit()
    rowcount = int(getattr(result, "rowcount", 0))
    return {"success": True, "updated": rowcount}


@router.get(
    "/preferences",
    response_model=list[NotificationPreferenceResponse],
    summary="List user notification preferences",
)
async def get_notification_preferences(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationPreferenceResponse]:
    """Return all explicit notification preferences configured for this user."""
    _require_workspace(current_user)

    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.user_id
    )
    res = await db.execute(stmt)
    prefs = list(res.scalars().all())

    return [
        NotificationPreferenceResponse(
            channel=p.channel,
            event_type=p.event_type,
            enabled=p.enabled,
        )
        for p in prefs
    ]


@router.put(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    summary="Update or set a notification preference",
)
async def update_notification_preference(
    body: UpdateNotificationPreferenceRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    """Set or update notification preference for a specific event type."""
    workspace_id = _require_workspace(current_user)

    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.user_id,
        NotificationPreference.event_type == body.event_type,
        NotificationPreference.channel == body.channel,
    )
    res = await db.execute(stmt)
    pref = res.scalars().first()

    if pref is None:
        pref = NotificationPreference(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            user_id=current_user.user_id,
            channel=body.channel,
            event_type=body.event_type,
            enabled=body.enabled,
        )
        db.add(pref)
    else:
        pref.enabled = body.enabled

    await db.commit()
    await db.refresh(pref)

    return NotificationPreferenceResponse(
        channel=pref.channel,
        event_type=pref.event_type,
        enabled=pref.enabled,
    )
