"""Tests for Notifications API endpoints.

Covers:
- Unauthenticated access → 401
- Missing workspace → 400
- List notifications → 200 paginated (with is_read filter)
- Unread count → 200 with count
- Mark read → 200 with updated count
- Mark all read → 200 with updated count
- Get notification preferences → 200
- Update notification preference → 200
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from httpx import AsyncClient

from app.enums import NotificationSeverity, NotificationType

NEXTAUTH_SECRET = "test-nextauth-secret-with-more-than-32-bytes-length"
BASE_URL = "/api/v1"


def _make_token(workspace_id: uuid.UUID | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict = {
        "sub": str(uuid.uuid4()),
        "email": "user@example.com",
        "name": "Test User",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=1)).timestamp()),
    }
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return jwt.encode(payload, NEXTAUTH_SECRET, algorithm="HS256")


def _mock_db_override(mock_db: AsyncMock) -> None:
    from app.database import get_db
    from app.main import app

    async def fake_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = fake_get_db


def _clear_db_override() -> None:
    from app.database import get_db
    from app.main import app

    app.dependency_overrides.pop(get_db, None)


def _make_notification(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    is_read: bool = False,
) -> MagicMock:
    n = MagicMock()
    n.id = uuid.uuid4()
    n.workspace_id = workspace_id
    n.user_id = user_id
    n.type = NotificationType.CRITICAL_FINDING.value
    n.title = "Critical Security Alert"
    n.message = "Vulnerability detected in repository."
    n.severity = NotificationSeverity.CRITICAL.value
    n.resource_type = "repository"
    n.resource_id = str(uuid.uuid4())
    n.is_read = is_read
    n.created_at = datetime.now(UTC)
    n.read_at = None if not is_read else datetime.now(UTC)
    return n


# ── Authentication Guards ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_notifications_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.get(f"{BASE_URL}/notifications")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unread_count_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.get(f"{BASE_URL}/notifications/unread-count")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mark_read_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.post(
        f"{BASE_URL}/notifications/mark-read",
        json={"notification_ids": [str(uuid.uuid4())]},
    )
    assert response.status_code == 401


# ── No Workspace → 400 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_notifications_no_workspace_returns_400(client: AsyncClient) -> None:
    token = _make_token()
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


# ── Happy Paths ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_notifications_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "u@e.com",
            "workspace_id": str(workspace_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        NEXTAUTH_SECRET,
        algorithm="HS256",
    )

    mock_notif = _make_notification(workspace_id, user_id)

    mock_db = AsyncMock()
    count_res = MagicMock()
    count_res.scalar_one.return_value = 1

    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = [mock_notif]

    mock_db.execute = AsyncMock(side_effect=[count_res, items_res])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/notifications?is_read=false",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Critical Security Alert"


@pytest.mark.asyncio
async def test_get_unread_count_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "u@e.com",
            "workspace_id": str(workspace_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        NEXTAUTH_SECRET,
        algorithm="HS256",
    )

    mock_db = AsyncMock()
    res = MagicMock()
    res.scalar_one.return_value = 5
    mock_db.execute = AsyncMock(return_value=res)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/notifications/unread-count",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    assert response.json()["unread_count"] == 5


@pytest.mark.asyncio
async def test_mark_notifications_read_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "u@e.com",
            "workspace_id": str(workspace_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        NEXTAUTH_SECRET,
        algorithm="HS256",
    )

    mock_db = AsyncMock()
    exec_res = MagicMock()
    exec_res.rowcount = 2
    mock_db.execute = AsyncMock(return_value=exec_res)
    mock_db.commit = AsyncMock()

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.post(
                f"{BASE_URL}/notifications/mark-read",
                json={"notification_ids": [str(uuid.uuid4()), str(uuid.uuid4())]},
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    assert response.json()["updated"] == 2


@pytest.mark.asyncio
async def test_mark_all_notifications_read_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "u@e.com",
            "workspace_id": str(workspace_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        NEXTAUTH_SECRET,
        algorithm="HS256",
    )

    mock_db = AsyncMock()
    exec_res = MagicMock()
    exec_res.rowcount = 7
    mock_db.execute = AsyncMock(return_value=exec_res)
    mock_db.commit = AsyncMock()

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.post(
                f"{BASE_URL}/notifications/mark-all-read",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    assert response.json()["updated"] == 7


@pytest.mark.asyncio
async def test_get_and_update_preferences(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "u@e.com",
            "workspace_id": str(workspace_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        NEXTAUTH_SECRET,
        algorithm="HS256",
    )

    mock_pref = MagicMock()
    mock_pref.channel = "IN_APP"
    mock_pref.event_type = "CRITICAL_FINDING"
    mock_pref.enabled = True

    mock_db = AsyncMock()
    list_res = MagicMock()
    list_res.scalars.return_value.all.return_value = [mock_pref]

    get_res = MagicMock()
    get_res.scalars.return_value.first.return_value = mock_pref

    mock_db.execute = AsyncMock(side_effect=[list_res, get_res])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET

            # GET preferences
            get_resp = await client.get(
                f"{BASE_URL}/notifications/preferences",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert get_resp.status_code == 200
            assert len(get_resp.json()) == 1

            # PUT preferences
            put_resp = await client.put(
                f"{BASE_URL}/notifications/preferences",
                json={"event_type": "CRITICAL_FINDING", "channel": "IN_APP", "enabled": False},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert put_resp.status_code == 200
            assert put_resp.json()["enabled"] is False
    finally:
        _clear_db_override()
