"""Notification and NotificationPreference models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import NotificationChannel, NotificationSeverity
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class Notification(UUIDPrimaryKeyMixin, Base):
    """In-app notification for a workspace user."""

    __tablename__ = "notifications"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NotificationSeverity.INFO.value
    )
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    workspace: Mapped[Workspace] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Workspace", back_populates="notifications"
    )
    user: Mapped[User] = relationship("User", back_populates="notifications")  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.type!r} read={self.is_read}>"


class NotificationPreference(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-user notification delivery preferences.

    Channel abstraction allows Slack/Discord to be added without changing
    the core notification model.
    """

    __tablename__ = "notification_preferences"

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NotificationChannel.IN_APP.value
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped[User] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User", back_populates="notification_preferences"
    )

    def __repr__(self) -> str:
        return f"<NotificationPreference user={self.user_id} channel={self.channel!r} event={self.event_type!r}>"
