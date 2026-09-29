"""Tests for the notification service and event dispatcher.

Covers:
- Preference resolution (enabled by default, honors disabled preference)
- create_notification creates Notification row
- create_notification suppresses creation when disabled by preference
- dispatch_scan_notifications on SCAN_FAILED
- dispatch_scan_notifications on CRITICAL_FINDING
- dispatch_scan_notifications on SCORE_DEGRADATION
- dispatch_scan_notifications on regular SCAN_COMPLETED
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.enums import NotificationSeverity, NotificationType
from app.services.notifications.service import (
    create_notification,
    dispatch_scan_notifications,
    is_notification_enabled,
)


@pytest.mark.asyncio
async def test_is_notification_enabled_default_true() -> None:
    mock_db = AsyncMock()
    res = MagicMock()
    res.scalars.return_value.first.return_value = None  # no preference row
    mock_db.execute = AsyncMock(return_value=res)

    enabled = await is_notification_enabled(mock_db, uuid.uuid4(), "CRITICAL_FINDING")
    assert enabled is True


@pytest.mark.asyncio
async def test_is_notification_enabled_honors_disabled_preference() -> None:
    mock_db = AsyncMock()
    mock_pref = MagicMock()
    mock_pref.enabled = False
    res = MagicMock()
    res.scalars.return_value.first.return_value = mock_pref
    mock_db.execute = AsyncMock(return_value=res)

    enabled = await is_notification_enabled(mock_db, uuid.uuid4(), "CRITICAL_FINDING")
    assert enabled is False


@pytest.mark.asyncio
async def test_create_notification_success() -> None:
    mock_db = AsyncMock()
    # preference query returns None (enabled by default)
    res = MagicMock()
    res.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=res)
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()

    notif = await create_notification(
        db=mock_db,
        workspace_id=workspace_id,
        user_id=user_id,
        notification_type=NotificationType.CRITICAL_FINDING,
        title="Critical Security Finding",
        message="A dangerous flaw was found.",
        severity=NotificationSeverity.CRITICAL,
    )

    assert notif is not None
    assert notif.workspace_id == workspace_id
    assert notif.user_id == user_id
    assert notif.title == "Critical Security Finding"
    assert notif.type == "CRITICAL_FINDING"
    assert notif.severity == "CRITICAL"
    assert notif.is_read is False
    assert mock_db.add.called


@pytest.mark.asyncio
async def test_create_notification_suppressed_by_preference() -> None:
    mock_db = AsyncMock()
    mock_pref = MagicMock()
    mock_pref.enabled = False
    res = MagicMock()
    res.scalars.return_value.first.return_value = mock_pref
    mock_db.execute = AsyncMock(return_value=res)
    mock_db.add = MagicMock()

    notif = await create_notification(
        db=mock_db,
        workspace_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        notification_type=NotificationType.CRITICAL_FINDING,
        title="Critical Finding",
        message="Some message",
    )

    assert notif is None
    assert not mock_db.add.called


@pytest.mark.asyncio
async def test_dispatch_scan_notifications_scan_failed() -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id
    mock_repo.full_name = "org/repo"

    mock_scan = MagicMock()
    mock_scan.repository_id = repo_id
    mock_scan.status = "FAILED"
    mock_scan.error_message = "Network timeout"

    mock_member = MagicMock()
    mock_member.user_id = user_id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_repo)

    members_res = MagicMock()
    members_res.scalars.return_value.all.return_value = [mock_member]

    # Preference query (inside create_notification)
    pref_res = MagicMock()
    pref_res.scalars.return_value.first.return_value = None

    mock_db.execute = AsyncMock(side_effect=[members_res, pref_res])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    notifs = await dispatch_scan_notifications(mock_db, mock_scan)
    assert len(notifs) == 1
    assert notifs[0].type == "SCAN_FAILED"
    assert notifs[0].severity == "CRITICAL"


@pytest.mark.asyncio
async def test_dispatch_scan_notifications_critical_findings_and_degradation() -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id
    mock_repo.full_name = "org/repo"

    mock_scan = MagicMock()
    mock_scan.repository_id = repo_id
    mock_scan.status = "COMPLETED"

    mock_hs = MagicMock()
    mock_hs.overall_score = 65.0  # dropped from 85.0 (diff = -20.0)

    mock_finding = MagicMock()
    mock_finding.severity = "CRITICAL"
    mock_finding.title = "Exposed AWS credentials"

    mock_member = MagicMock()
    mock_member.user_id = user_id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_repo)

    members_res = MagicMock()
    members_res.scalars.return_value.all.return_value = [mock_member]

    # 3 notifications will be generated: CRITICAL_FINDING, SCORE_DEGRADATION, SCAN_COMPLETED
    pref_res = MagicMock()
    pref_res.scalars.return_value.first.return_value = None

    mock_db.execute = AsyncMock(side_effect=[members_res, pref_res, pref_res, pref_res])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    notifs = await dispatch_scan_notifications(
        db=mock_db,
        scan=mock_scan,
        health_score=mock_hs,
        previous_score=85.0,
        open_findings=[mock_finding],
    )

    types = [n.type for n in notifs]
    assert "CRITICAL_FINDING" in types
    assert "SCORE_DEGRADATION" in types
    assert "SCAN_COMPLETED" in types
