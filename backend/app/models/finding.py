"""Finding model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import DetectionSource, FindingStatus
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class Finding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A detected repository health problem.

    Findings are de-duplicated using a stable `fingerprint` computed from
    category, rule identifier, and affected resource. The same logical
    problem is updated in-place rather than creating a new row each scan.
    """

    __tablename__ = "findings"
    __table_args__ = (
        UniqueConstraint("repository_id", "fingerprint", name="uq_finding_fingerprint"),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    first_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scans.id", ondelete="SET NULL"), nullable=True
    )
    last_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scans.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    detection_source: Mapped[str] = mapped_column(
        String(20), nullable=False, default=DetectionSource.PROGRAMMATIC.value
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FindingStatus.OPEN.value, index=True
    )
    fingerprint: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    first_detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    last_detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="findings"
    )
    recommendations: Mapped[list[Recommendation]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Recommendation", back_populates="finding"
    )

    def __repr__(self) -> str:
        return (
            f"<Finding id={self.id} category={self.category!r} "
            f"severity={self.severity!r} status={self.status!r}>"
        )
