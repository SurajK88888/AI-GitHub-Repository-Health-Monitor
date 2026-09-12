"""HealthScore, HealthScoreCategory, ScoringConfiguration, and ScoringWeight models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class ScoringConfiguration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Versioned scoring configuration.

    Weight configs are never overwritten once used — a new version is
    created instead so historical scores remain reproducible.
    """

    __tablename__ = "scoring_configurations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ── Relationships ─────────────────────────────────────────────────────────
    workspace: Mapped[Workspace] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Workspace", back_populates="scoring_configurations"
    )
    weights: Mapped[list[ScoringWeight]] = relationship(
        "ScoringWeight", back_populates="configuration", cascade="all, delete-orphan"
    )
    health_scores: Mapped[list[HealthScore]] = relationship(
        "HealthScore", back_populates="scoring_configuration"
    )

    def __repr__(self) -> str:
        return f"<ScoringConfiguration id={self.id} name={self.name!r} v{self.version}>"


class ScoringWeight(UUIDPrimaryKeyMixin, Base):
    """A single category weight within a scoring configuration.

    All active weights for a configuration must total exactly 100.
    """

    __tablename__ = "scoring_weights"
    __table_args__ = (
        UniqueConstraint("scoring_configuration_id", "category", name="uq_scoring_weight_category"),
    )

    scoring_configuration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scoring_configurations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    configuration: Mapped[ScoringConfiguration] = relationship(
        "ScoringConfiguration", back_populates="weights"
    )

    def __repr__(self) -> str:
        return f"<ScoringWeight category={self.category!r} weight={self.weight}>"


class HealthScore(UUIDPrimaryKeyMixin, Base):
    """Overall health score for a completed scan.

    Preserves the scoring-configuration version so historical scores
    remain reproducible and explainable.
    """

    __tablename__ = "health_scores"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scoring_configuration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scoring_configurations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="health_scores"
    )
    scan: Mapped[Scan] = relationship("Scan", back_populates="health_scores")  # type: ignore[name-defined]  # noqa: F821
    scoring_configuration: Mapped[ScoringConfiguration] = relationship(
        "ScoringConfiguration", back_populates="health_scores"
    )
    categories: Mapped[list[HealthScoreCategory]] = relationship(
        "HealthScoreCategory", back_populates="health_score", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<HealthScore id={self.id} overall={self.overall_score}>"


class HealthScoreCategory(UUIDPrimaryKeyMixin, Base):
    """Per-category breakdown of a health score."""

    __tablename__ = "health_score_categories"

    health_score_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("health_scores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    raw_score: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    weighted_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    health_score: Mapped[HealthScore] = relationship("HealthScore", back_populates="categories")

    def __repr__(self) -> str:
        return f"<HealthScoreCategory category={self.category!r} raw={self.raw_score} weighted={self.weighted_score}>"
