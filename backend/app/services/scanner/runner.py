"""Scan runner — orchestrates data fetching, collector execution, and DB persistence.

Lifecycle managed here:
    QUEUED → RUNNING → COMPLETED | FAILED

Finding deduplication strategy:
    - Compute SHA-256 fingerprint = category:rule_id:resource
    - If finding with same (repository_id, fingerprint) exists:
        → UPDATE last_detected_at + ensure status=OPEN
    - If not:
        → INSERT new finding
    - At end of scan, any finding from this repo NOT seen this run
        → UPDATE status=RESOLVED, resolved_at=now
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import FindingStatus, ScanStatus, TriggerType
from app.models.finding import Finding
from app.models.scan import Scan, ScanMetric
from app.services.scanner.collectors.activity import ActivityCollector
from app.services.scanner.collectors.code_quality import CodeQualityCollector
from app.services.scanner.collectors.configuration import ConfigurationCollector
from app.services.scanner.collectors.dependencies import DependenciesCollector
from app.services.scanner.collectors.documentation import DocumentationCollector
from app.services.scanner.collectors.issues import IssuesCollector
from app.services.scanner.collectors.pull_requests import PullRequestsCollector
from app.services.scanner.collectors.security import SecurityCollector
from app.services.scanner.context import CollectorResult, FindingData, ScanContext

logger = logging.getLogger(__name__)

_COLLECTORS = [
    DocumentationCollector(),
    SecurityCollector(),
    CodeQualityCollector(),
    DependenciesCollector(),
    IssuesCollector(),
    PullRequestsCollector(),
    ActivityCollector(),
    ConfigurationCollector(),
]


async def run_scan(
    scan_id: uuid.UUID,
    ctx: ScanContext,
    db: AsyncSession,
) -> None:
    """Execute all collectors for one scan and persist results.

    Args:
        scan_id: The UUID of the ``Scan`` record that must already exist in QUEUED state.
        ctx: Populated ``ScanContext`` from ``build_scan_context()``.
        db: Async SQLAlchemy session.
    """
    # ── Load scan record ──────────────────────────────────────────────────
    scan: Scan | None = await db.get(Scan, scan_id)
    if scan is None:
        logger.error("Scan %s not found — aborting", scan_id)
        return

    # ── Transition to RUNNING ─────────────────────────────────────────────
    scan.status = ScanStatus.RUNNING.value
    scan.started_at = datetime.now(UTC)
    await db.flush()

    try:
        combined = _run_collectors(ctx)
        await _persist_metrics(scan_id, combined, db)
        await _persist_findings(scan.repository_id, scan_id, combined.findings, db)

        scan.status = ScanStatus.COMPLETED.value
        scan.completed_at = datetime.now(UTC)
        logger.info("Scan %s completed — %d findings", scan_id, len(combined.findings))

    except Exception as exc:
        logger.exception("Scan %s failed", scan_id)
        scan.status = ScanStatus.FAILED.value
        scan.completed_at = datetime.now(UTC)
        scan.error_message = str(exc)[:512]

    await db.commit()


def _run_collectors(ctx: ScanContext) -> CollectorResult:
    """Run all collectors and merge results into one CollectorResult."""
    combined = CollectorResult()
    for collector in _COLLECTORS:
        try:
            result = collector.collect(ctx)
            combined.metrics.extend(result.metrics)
            combined.findings.extend(result.findings)
        except Exception:
            logger.exception("Collector %s raised unexpectedly", type(collector).__name__)
    return combined


async def _persist_metrics(
    scan_id: uuid.UUID,
    result: CollectorResult,
    db: AsyncSession,
) -> None:
    """Insert ScanMetric rows for all emitted metrics."""
    for m in result.metrics:
        db.add(
            ScanMetric(
                id=uuid.uuid4(),
                scan_id=scan_id,
                category=m.category,
                metric_name=m.metric_name,
                metric_value=m.metric_value,
                metric_unit=m.metric_unit,
                metadata_=m.extra,
            )
        )
    await db.flush()


async def _persist_findings(
    repository_id: uuid.UUID,
    scan_id: uuid.UUID,
    new_findings: list[FindingData],
    db: AsyncSession,
) -> None:
    """Upsert findings and resolve stale ones.

    Strategy:
    1. Load existing OPEN findings for this repository.
    2. For each new finding: update if fingerprint matches, else insert.
    3. Any existing OPEN finding not seen this scan → RESOLVED.
    """
    now = datetime.now(UTC)

    # Load current open findings indexed by fingerprint
    stmt = select(Finding).where(
        Finding.repository_id == repository_id,
        Finding.status == FindingStatus.OPEN.value,
    )
    result = await db.execute(stmt)
    existing: dict[str, Finding] = {f.fingerprint: f for f in result.scalars().all()}

    seen_fingerprints: set[str] = set()

    for fd in new_findings:
        seen_fingerprints.add(fd.fingerprint)
        if fd.fingerprint in existing:
            # Update existing finding
            existing_finding = existing[fd.fingerprint]
            existing_finding.last_detected_at = now
            existing_finding.last_scan_id = scan_id
            existing_finding.status = FindingStatus.OPEN.value
        else:
            # Insert new finding
            db.add(
                Finding(
                    id=uuid.uuid4(),
                    repository_id=repository_id,
                    first_scan_id=scan_id,
                    last_scan_id=scan_id,
                    category=fd.category,
                    severity=fd.severity,
                    title=fd.title,
                    description=fd.description,
                    evidence=fd.evidence,
                    detection_source=fd.detection_source,
                    status=FindingStatus.OPEN.value,
                    fingerprint=fd.fingerprint,
                    first_detected_at=now,
                    last_detected_at=now,
                )
            )

    # Resolve findings not seen in this scan
    for fingerprint, finding in existing.items():
        if fingerprint not in seen_fingerprints:
            finding.status = FindingStatus.RESOLVED.value
            finding.resolved_at = now

    await db.flush()


async def enqueue_repository_scan(
    repository_id: uuid.UUID,
    db: AsyncSession,
    trigger: TriggerType = TriggerType.MANUAL,
) -> Scan:
    """Create a QUEUED scan record and return it.

    The caller is responsible for actually enqueuing the ARQ job.
    """
    scan = Scan(
        id=uuid.uuid4(),
        repository_id=repository_id,
        trigger_type=trigger.value,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    return scan
