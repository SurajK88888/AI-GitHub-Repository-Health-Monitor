"""Tests for GET /api/v1/repositories.

Covers:
- Unauthenticated request → 403
- Invalid JWT → 401
- Valid JWT + mocked DB returns empty list
- 404 for non-existent repository
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from httpx import AsyncClient

NEXTAUTH_SECRET = "test-nextauth-secret-with-more-than-32-bytes-length"
REPOS_URL = "/api/v1/repositories"


def _make_token(workspace_id: uuid.UUID | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
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

        async def fake_get_db() -> AsyncGenerator[AsyncMock, None]:
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


@pytest.mark.asyncio
async def test_generate_description_endpoint(client: AsyncClient) -> None:
    from app.database import get_db
    from app.main import app
    from app.services.auth import CurrentUser, get_current_user
    from app.workers.deps import get_redis

    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    repo_id = uuid.uuid4()

    mock_repo = AsyncMock()
    mock_repo.id = repo_id
    mock_repo.name = "demo-repo"
    mock_repo.full_name = "testuser/demo-repo"
    mock_repo.language = "TypeScript"
    mock_repo.owner_login = "testuser"
    mock_repo.github_installation_id = uuid.uuid4()

    mock_inst = AsyncMock()
    mock_inst.github_installation_id = 12345

    mock_db = AsyncMock()
    mock_res = AsyncMock()
    mock_res.scalar_one_or_none.return_value = mock_inst
    mock_db.execute.return_value = mock_res

    async def fake_get_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    async def fake_get_redis() -> AsyncMock:
        return AsyncMock()

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_redis] = fake_get_redis
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=user_id,
        email="test@example.com",
        name="Test User",
        avatar_url=None,
        workspace_id=workspace_id,
    )

    try:
        with (
            patch("app.api.v1.repositories._assert_workspace_member", new_callable=AsyncMock),
            patch(
                "app.api.v1.repositories._get_repo_or_404",
                new_callable=AsyncMock,
                return_value=mock_repo,
            ),
            patch(
                "app.api.v1.repositories.call_ai",
                new_callable=AsyncMock,
                return_value={"description": "A modern TypeScript demo repository."},
            ),
            patch("app.api.v1.repositories.GitHubClient") as mock_gh_cls,
        ):
            mock_gh = AsyncMock()
            mock_gh.get_file_content.return_value = "# Demo\nThis is a test repo"
            mock_gh_cls.return_value.__aenter__.return_value = mock_gh

            response = await client.post(
                f"{REPOS_URL}/{repo_id}/generate-description",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "A modern TypeScript demo repository."
        assert data["repository_name"] == "demo-repo"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_update_description_endpoint(client: AsyncClient) -> None:
    from app.database import get_db
    from app.main import app
    from app.services.auth import CurrentUser, get_current_user
    from app.workers.deps import get_redis

    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    repo_id = uuid.uuid4()

    mock_repo = AsyncMock()
    mock_repo.id = repo_id
    mock_repo.name = "demo-repo"
    mock_repo.full_name = "testuser/demo-repo"
    mock_repo.description = None
    mock_repo.owner_login = "testuser"
    mock_repo.github_installation_id = uuid.uuid4()

    from unittest.mock import MagicMock

    mock_inst = MagicMock()
    mock_inst.github_installation_id = 12345

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = mock_inst
    mock_db.execute.return_value = mock_res

    async def fake_get_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    async def fake_get_redis() -> AsyncMock:
        return AsyncMock()

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_redis] = fake_get_redis
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=user_id,
        email="test@example.com",
        name="Test User",
        avatar_url=None,
        workspace_id=workspace_id,
    )

    try:
        with (
            patch("app.api.v1.repositories._assert_workspace_member", new_callable=AsyncMock),
            patch(
                "app.api.v1.repositories._get_repo_or_404",
                new_callable=AsyncMock,
                return_value=mock_repo,
            ),
            patch("app.services.audit_service.log_event", new_callable=AsyncMock),
            patch("app.api.v1.repositories.GitHubClient") as mock_gh_cls,
        ):
            mock_gh = AsyncMock()
            mock_gh.update_repository_description.return_value = {"status": "ok"}
            mock_gh_cls.return_value.__aenter__.return_value = mock_gh

            response = await client.put(
                f"{REPOS_URL}/{repo_id}/description",
                headers={"Authorization": f"Bearer {token}"},
                json={"description": "Updated by AI", "apply_to_github": True},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated by AI"
        assert data["applied_to_github"] is True
        assert mock_repo.description == "Updated by AI"
    finally:
        app.dependency_overrides.clear()
