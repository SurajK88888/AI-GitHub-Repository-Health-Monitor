"""AIAction model — tracks user-approved actions on repositories."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AIActionStatus
from app.models.base import Base, UUIDPrimaryKeyMixin, utc_now


class AIAction(UUIDPrimaryKeyMixin, Base):
    """Tracks a user-approved or system-generated action on a repository.

    All repository-modifying actions must:
    1. Pass authentication and authorization checks.
    2. Require explicit user approval (unless a future policy overrides this).
    3. Be recorded here for full auditability.
    """

    __tablename__ = "ai_actions"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendations.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AIActionStatus.PENDING.value, index=True
    )
    approval_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    workspace: Mapped[Workspace] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Workspace", back_populates="ai_actions"
    )
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="ai_actions"
    )
    recommendation: Mapped[Recommendation | None] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Recommendation", back_populates="ai_actions"
    )
    requester: Mapped[User] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User", back_populates="ai_actions_requested"
    )

    def __repr__(self) -> str:
        return f"<AIAction id={self.id} type={self.action_type!r} status={self.status!r}>"
