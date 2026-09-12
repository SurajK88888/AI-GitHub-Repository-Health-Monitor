"""Scan and ScanMetric models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import ScanStatus, ScanType, TriggerType
from app.models.base import Base, UUIDPrimaryKeyMixin, utc_now


class Scan(UUIDPrimaryKeyMixin, Base):
    """Represents a single repository health scan run.

    Lifecycle: QUEUED → RUNNING → COMPLETED | FAILED | CANCELLED
    """

    __tablename__ = "scans"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_type: Mapped[str] = mapped_column(String(20), nullable=False, default=ScanType.FULL.value)
    trigger_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TriggerType.MANUAL.value
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ScanStatus.QUEUED.value, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    repository: Mapped[Repository] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="scans"
    )
    metrics: Mapped[list[ScanMetric]] = relationship(
        "ScanMetric", back_populates="scan", cascade="all, delete-orphan"
    )
    health_scores: Mapped[list[HealthScore]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "HealthScore", back_populates="scan"
    )
    ai_analyses: Mapped[list[AIAnalysis]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AIAnalysis", back_populates="scan"
    )

    def __repr__(self) -> str:
        return f"<Scan id={self.id} status={self.status!r} type={self.scan_type!r}>"


class ScanMetric(UUIDPrimaryKeyMixin, Base):
    """Stores a single measurable metric produced by an analyzer."""

    __tablename__ = "scan_metrics"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    metric_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    scan: Mapped[Scan] = relationship("Scan", back_populates="metrics")

    def __repr__(self) -> str:
        return f"<ScanMetric scan={self.scan_id} {self.category}.{self.metric_name}={self.metric_value}>"
