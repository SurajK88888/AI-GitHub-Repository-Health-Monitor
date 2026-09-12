"""User model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import UserStatus
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Application user.

    GitHub credentials are never stored here — they belong in the
    github_installations table and the secret manager.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=UserStatus.ACTIVE.value)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    owned_workspaces: Mapped[list[Workspace]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Workspace", back_populates="owner", foreign_keys="Workspace.owner_user_id"
    )
    workspace_memberships: Mapped[list[WorkspaceMember]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "WorkspaceMember", back_populates="user"
    )
    notifications: Mapped[list[Notification]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Notification", back_populates="user"
    )
    notification_preferences: Mapped[list[NotificationPreference]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "NotificationPreference", back_populates="user"
    )
    ai_actions_requested: Mapped[list[AIAction]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAction", back_populates="requester"
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AuditLog", back_populates="user"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
