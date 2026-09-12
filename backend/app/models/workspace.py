"""Workspace and WorkspaceMember models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import WorkspaceRole
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Ownership boundary for SaaS readiness.

    Every user-owned resource (installations, repos, scans…) ultimately
    belongs to a workspace, which enables multi-tenant isolation.
    """

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    owner: Mapped[User] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User", back_populates="owned_workspaces", foreign_keys=[owner_user_id]
    )
    members: Mapped[list[WorkspaceMember]] = relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan"
    )
    github_installations: Mapped[list[GitHubInstallation]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "GitHubInstallation", back_populates="workspace"
    )
    scoring_configurations: Mapped[list[ScoringConfiguration]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "ScoringConfiguration", back_populates="workspace"
    )
    notifications: Mapped[list[Notification]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Notification", back_populates="workspace"
    )
    ai_actions: Mapped[list[AIAction]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAction", back_populates="workspace"
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AuditLog", back_populates="workspace"
    )

    def __repr__(self) -> str:
        return f"<Workspace id={self.id} slug={self.slug!r}>"


class WorkspaceMember(UUIDPrimaryKeyMixin, Base):
    """Workspace membership with role-based access control."""

    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=WorkspaceRole.MEMBER.value
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="members")
    user: Mapped[User] = relationship("User", back_populates="workspace_memberships")  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<WorkspaceMember workspace={self.workspace_id} user={self.user_id} role={self.role!r}>"
