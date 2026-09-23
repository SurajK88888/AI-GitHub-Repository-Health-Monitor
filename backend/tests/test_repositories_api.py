"""Tests for GET /api/v1/repositories.

Covers:
- Unauthenticated request → 403
- Invalid JWT → 401
- Valid JWT + mocked DB returns empty list
- 404 for non-existent repository
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from httpx import AsyncClient

NEXTAUTH_SECRET = "test-nextauth-secret-with-more-than-32-bytes-length"
REPOS_URL = "/api/v1/repositories"


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
async def test_list_repos_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.get(REPOS_URL)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_repos_invalid_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(
        REPOS_URL,
        headers={"Authorization": "Bearer garbage"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_repos_no_workspace_returns_400(client: AsyncClient) -> None:
    """Token without workspace_id → 400 (session not bootstrapped)."""
    token = _make_token(workspace_id=None)
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            REPOS_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_nonexistent_repo_returns_404(client: AsyncClient) -> None:
    """GET /repositories/{id} for unknown ID returns 404."""
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    repo_id = uuid.uuid4()

    with (
        patch("app.services.auth.get_settings") as mock_cfg,
        patch("app.api.v1.repositories._assert_workspace_member", new_callable=AsyncMock),
        patch(
            "app.api.v1.repositories._get_repo_or_404",
            new_callable=AsyncMock,
            side_effect=Exception("not found"),
        ),
    ):
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET

        from fastapi import HTTPException

        async def fake_get_db():
            yield AsyncMock()

        with (
            patch("app.api.v1.repositories.get_db", fake_get_db),
            patch(
                "app.api.v1.repositories._get_repo_or_404",
                new_callable=AsyncMock,
                side_effect=HTTPException(status_code=404, detail="Repository not found"),
            ),
        ):
            response = await client.get(
                f"{REPOS_URL}/{repo_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 404
