"""Recommendation model."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import RecommendationStatus
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Recommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An actionable recommendation derived from a finding or AI analysis."""

    __tablename__ = "recommendations"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finding_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("findings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ai_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_analyses.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)  # FindingSeverity
    recommended_action: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RecommendationStatus.PENDING.value
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="recommendations"
    )
    finding: Mapped[Finding | None] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Finding", back_populates="recommendations"
    )
    ai_analysis: Mapped[AIAnalysis | None] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAnalysis", back_populates="recommendations"
    )
    ai_actions: Mapped[list[AIAction]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAction", back_populates="recommendation"
    )

    def __repr__(self) -> str:
        return f"<Recommendation id={self.id} priority={self.priority!r} status={self.status!r}>"
