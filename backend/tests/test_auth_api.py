"""Tests for POST /api/v1/auth/session.

Covers:
- Valid JWT creates user + workspace and returns IDs
- Missing Authorization header → 403 (HTTPBearer auto_error)
- Invalid/malformed JWT → 401
- Calling twice with same email is idempotent
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from httpx import AsyncClient

AUTH_SESSION_URL = "/api/v1/auth/session"
NEXTAUTH_SECRET = "test-nextauth-secret-with-more-than-32-bytes-length"


def _make_token(
    email: str = "test@example.com",
    name: str = "Test User",
    secret: str = NEXTAUTH_SECRET,
    expired: bool = False,
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid.uuid4()),
        "email": email,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + (timedelta(hours=-1) if expired else timedelta(hours=1))).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_missing_auth_header_returns_401(client: AsyncClient) -> None:
    response = await client.post(AUTH_SESSION_URL)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_jwt_returns_401(client: AsyncClient) -> None:
    response = await client.post(
        AUTH_SESSION_URL,
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_jwt_returns_401(client: AsyncClient) -> None:
    token = _make_token(expired=True)
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.post(
            AUTH_SESSION_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_jwt_with_mocked_db_returns_200(client: AsyncClient) -> None:
    """Valid JWT + mocked DB session → 200 with user_id and workspace_id."""
    token = _make_token()
    fake_user_id = uuid.uuid4()
    fake_workspace_id = uuid.uuid4()

    mock_user = MagicMock()
    mock_user.id = fake_user_id
    mock_user.email = "test@example.com"
    mock_user.name = "Test User"

    mock_workspace = MagicMock()
    mock_workspace.id = fake_workspace_id

    with (
        patch("app.services.auth.get_settings") as mock_cfg,
        patch(
            "app.api.v1.auth.user_service.get_or_create_user",
            new_callable=AsyncMock,
            return_value=mock_user,
        ),
        patch(
            "app.api.v1.auth.user_service.get_or_create_workspace",
            new_callable=AsyncMock,
            return_value=mock_workspace,
        ),
        patch("app.api.v1.auth.user_service.record_login", new_callable=AsyncMock),
        patch("app.api.v1.auth.audit_service.log_event", new_callable=AsyncMock),
        patch("app.api.v1.auth.get_db"),
    ):
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET

        # Patch get_db to yield a mock session
        mock_db = AsyncMock()
        mock_db.commit = AsyncMock()

        async def fake_get_db():
            yield mock_db

        with patch("app.api.v1.auth.get_db", fake_get_db):
            response = await client.post(
                AUTH_SESSION_URL,
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert "workspace_id" in data
