"""AIAnalysis model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AIAnalysisStatus, AIAnalysisType
from app.models.base import Base, UUIDPrimaryKeyMixin, utc_now


class AIAnalysis(UUIDPrimaryKeyMixin, Base):
    """Records an AI processing task and its output.

    Only the minimum required data is sent to AI providers.
    Raw source code and secrets must never be stored here.
    """

    __tablename__ = "ai_analyses"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    analysis_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default=AIAnalysisType.REPOSITORY_SUMMARY.value
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False)
    input_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AIAnalysisStatus.PENDING.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="ai_analyses"
    )
    scan: Mapped[Scan | None] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Scan", back_populates="ai_analyses"
    )
    recommendations: Mapped[list[Recommendation]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Recommendation", back_populates="ai_analysis"
    )

    def __repr__(self) -> str:
        return f"<AIAnalysis id={self.id} type={self.analysis_type!r} status={self.status!r}>"
