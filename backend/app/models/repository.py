"""Repository model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Repository(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A GitHub repository accessible through an installation.

    `monitoring_enabled` distinguishes repos the user has explicitly
    enrolled from repos that are merely accessible to the GitHub App.
    """

    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint(
            "github_installation_id",
            "github_repository_id",
            name="uq_installation_repository",
        ),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    github_installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("github_installations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    github_repository_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    owner_login: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    default_branch: Mapped[str] = mapped_column(String(255), nullable=False, default="main")
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_fork: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    html_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    monitoring_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    github_installation: Mapped[GitHubInstallation] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "GitHubInstallation", back_populates="repositories"
    )
    scans: Mapped[list[Scan]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Scan", back_populates="repository", cascade="all, delete-orphan"
    )
    findings: Mapped[list[Finding]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Finding", back_populates="repository", cascade="all, delete-orphan"
    )
    health_scores: Mapped[list[HealthScore]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "HealthScore", back_populates="repository", cascade="all, delete-orphan"
    )
    ai_analyses: Mapped[list[AIAnalysis]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAnalysis", back_populates="repository", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list[Recommendation]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Recommendation", back_populates="repository", cascade="all, delete-orphan"
    )
    ai_actions: Mapped[list[AIAction]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAction", back_populates="repository"
    )

    def __repr__(self) -> str:
        return f"<Repository id={self.id} full_name={self.full_name!r}>"
