"""Notification delivery and event dispatching service.

Manages:
- Creating in-app Notification records with user preferences honored.
- Event-driven dispatching from scan pipeline:
  - Critical security findings
  - Health score degradation (>= 10 points decline)
  - Scan completion and scan failure
  - Remediation action results
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import NotificationChannel, NotificationSeverity, NotificationType
from app.models.finding import Finding
from app.models.health_score import HealthScore
from app.models.notification import Notification, NotificationPreference
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.workspace import WorkspaceMember

logger = logging.getLogger(__name__)


async def is_notification_enabled(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: str,
    channel: str = NotificationChannel.IN_APP.value,
) -> bool:
    """Check if the user has enabled notifications for this event type and channel.

    Default is True if no preference row exists.
    """
    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == user_id,
        NotificationPreference.event_type == event_type,
        NotificationPreference.channel == channel,
    )
    result = await db.execute(stmt)
    pref = result.scalars().first()
    if pref is not None:
        return pref.enabled
    return True


async def create_notification(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    notification_type: NotificationType | str,
    title: str,
    message: str,
    severity: NotificationSeverity | str = NotificationSeverity.INFO,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> Notification | None:
    """Create an in-app notification if permitted by user preferences.

    Args:
        db: Async SQLAlchemy session.
        workspace_id: Target workspace UUID.
        user_id: Target recipient user UUID.
        notification_type: NotificationType enum or string.
        title: Short title (max 512 chars).
        message: Notification body text.
        severity: NotificationSeverity enum or string.
        resource_type: Optional resource category ('repository', 'scan', etc.).
        resource_id: Optional resource UUID string.

    Returns:
        The created Notification or None if suppressed by preferences.
    """
    event_type_str = (
        notification_type.value
        if isinstance(notification_type, NotificationType)
        else str(notification_type)
    )
    severity_str = severity.value if isinstance(severity, NotificationSeverity) else str(severity)

    enabled = await is_notification_enabled(db, user_id, event_type_str)
    if not enabled:
        logger.debug(
            "Notification %s suppressed for user %s by preference",
            event_type_str,
            user_id,
        )
        return None

    notification = Notification(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        user_id=user_id,
        type=event_type_str,
        title=title[:512],
        message=message,
        severity=severity_str,
        resource_type=resource_type,
        resource_id=resource_id,
        is_read=False,
        created_at=datetime.now(UTC),
    )
    db.add(notification)
    await db.flush()
    return notification


async def dispatch_scan_notifications(
    db: AsyncSession,
    scan: Scan,
    health_score: HealthScore | None = None,
    previous_score: float | None = None,
    open_findings: list[Finding] | None = None,
) -> list[Notification]:
    """Inspect completed scan results and dispatch appropriate notifications to workspace members.

    Triggers:
    1. SCAN_FAILED: If scan failed.
    2. CRITICAL_FINDING: If scan uncovered any open CRITICAL findings.
    3. SCORE_DEGRADATION: If health score dropped by 10 or more points.
    4. SCAN_COMPLETED: Regular summary for completed scan.

    Returns:
        List of generated Notification records.
    """
    repo = await db.get(Repository, scan.repository_id)
    if repo is None:
        logger.warning("dispatch_scan_notifications: repository %s not found", scan.repository_id)
        return []

    # Find members to notify
    members_stmt = select(WorkspaceMember).where(WorkspaceMember.workspace_id == repo.workspace_id)
    members_res = await db.execute(members_stmt)
    members = list(members_res.scalars().all())
    user_ids = [m.user_id for m in members]

    created: list[Notification] = []

    # 1. Scan Failed
    if scan.status == "FAILED":
        for uid in user_ids:
            n = await create_notification(
                db=db,
                workspace_id=repo.workspace_id,
                user_id=uid,
                notification_type=NotificationType.SCAN_FAILED,
                title="Repository Scan Failed",
                message=f"Scan for {repo.full_name} failed: {scan.error_message or 'Unknown error'}",
                severity=NotificationSeverity.CRITICAL,
                resource_type="repository",
                resource_id=str(repo.id),
            )
            if n:
                created.append(n)
        await db.commit()
        return created

    # 2. Critical Findings
    findings_list = open_findings or []
    critical_findings = [f for f in findings_list if f.severity == "CRITICAL"]
    if critical_findings:
        crit_count = len(critical_findings)
        first_title = critical_findings[0].title
        for uid in user_ids:
            n = await create_notification(
                db=db,
                workspace_id=repo.workspace_id,
                user_id=uid,
                notification_type=NotificationType.CRITICAL_FINDING,
                title=f"{crit_count} Critical Security Issue{'s' if crit_count > 1 else ''} Detected",
                message=f"Critical finding on {repo.full_name}: '{first_title}'"
                + (f" and {crit_count - 1} more." if crit_count > 1 else "."),
                severity=NotificationSeverity.CRITICAL,
                resource_type="repository",
                resource_id=str(repo.id),
            )
            if n:
                created.append(n)

    # 3. Score Degradation
    if health_score is not None and previous_score is not None:
        score_diff = health_score.overall_score - previous_score
        if score_diff <= -10.0:
            for uid in user_ids:
                n = await create_notification(
                    db=db,
                    workspace_id=repo.workspace_id,
                    user_id=uid,
                    notification_type=NotificationType.SCORE_DEGRADATION,
                    title="Health Score Significantly Dropped",
                    message=(
                        f"Health score for {repo.full_name} declined by "
                        f"{abs(score_diff):.1f} points (from {previous_score:.1f} to {health_score.overall_score:.1f})."
                    ),
                    severity=NotificationSeverity.HIGH,
                    resource_type="repository",
                    resource_id=str(repo.id),
                )
                if n:
                    created.append(n)

    # 4. Scan Completed (Informational)
    score_str = f" Score: {health_score.overall_score:.1f}/100." if health_score else ""
    for uid in user_ids:
        n = await create_notification(
            db=db,
            workspace_id=repo.workspace_id,
            user_id=uid,
            notification_type=NotificationType.SCAN_COMPLETED,
            title="Repository Scan Completed",
            message=f"Automated health scan completed for {repo.full_name}.{score_str}",
            severity=NotificationSeverity.INFO,
            resource_type="repository",
            resource_id=str(repo.id),
        )
        if n:
            created.append(n)

    await db.commit()
    return created
