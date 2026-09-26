"""Tests for Findings API endpoints.

Covers:
- Unauthenticated access → 401
- Missing workspace → 400
- Get finding not found → 404
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from httpx import AsyncClient

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


@pytest.mark.asyncio
async def test_list_findings_unauthenticated_returns_401(client: AsyncClient) -> None:
    repo_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/repositories/{repo_id}/findings")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_finding_unauthenticated_returns_401(client: AsyncClient) -> None:
    finding_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/findings/{finding_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_findings_no_workspace_returns_400(client: AsyncClient) -> None:
    """Token without workspace_id → 400."""
    token = _make_token()  # no workspace_id
    repo_id = uuid.uuid4()

    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            f"{BASE_URL}/repositories/{repo_id}/findings",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_finding_not_found_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    finding_id = uuid.uuid4()

    from app.database import get_db
    from app.main import app

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    async def fake_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = fake_get_db

    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/findings/{finding_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_findings_authenticated_returns_200(client: AsyncClient) -> None:
    from unittest.mock import MagicMock

    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()

    # Query 1: _get_owned_repo -> mock_repo
    # Query 2: total count -> []
    # Query 3: paginated findings -> []
    res_repo = MagicMock()
    res_repo.scalars.return_value.first.return_value = mock_repo

    res_empty = MagicMock()
    res_empty.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[res_repo, res_empty, res_empty])

    from app.database import get_db
    from app.main import app

    async def fake_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = fake_get_db

    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/findings?page=1&page_size=50",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 50
    assert data["total"] == 0
    assert data["has_next"] is False
    assert data["items"] == []
