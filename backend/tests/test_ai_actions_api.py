"""Tests for AI Actions API endpoints.

Covers:
- Unauthenticated access → 401
- Missing workspace → 400
- Repository not found → 404
- Action not found → 404
- List actions → 200 paginated
- Get action detail → 200
- Execute approved action → 202 Accepted
- Execute non-approved action → 409 Conflict
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from httpx import AsyncClient

from app.enums import AIActionStatus

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


def _make_action(
    workspace_id: uuid.UUID,
    repo_id: uuid.UUID,
    status: str = AIActionStatus.APPROVED.value,
) -> MagicMock:
    action = MagicMock()
    action.id = uuid.uuid4()
    action.workspace_id = workspace_id
    action.repository_id = repo_id
    action.recommendation_id = uuid.uuid4()
    action.requested_by = uuid.uuid4()
    action.action_type = "ADD_SECURITY_POLICY"
    action.status = status
    action.approval_required = True
    action.approved_at = datetime.now(UTC)
    action.completed_at = None
    action.result = None
    action.error_message = None
    action.created_at = datetime.now(UTC)
    return action


# ── Authentication Guards ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_actions_unauthenticated_returns_401(client: AsyncClient) -> None:
    repo_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/repositories/{repo_id}/actions")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_action_unauthenticated_returns_401(client: AsyncClient) -> None:
    action_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/actions/{action_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_execute_action_unauthenticated_returns_401(client: AsyncClient) -> None:
    action_id = uuid.uuid4()
    response = await client.post(f"{BASE_URL}/actions/{action_id}/execute")
    assert response.status_code == 401


# ── No Workspace → 400 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_actions_no_workspace_returns_400(client: AsyncClient) -> None:
    token = _make_token()
    repo_id = uuid.uuid4()
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            f"{BASE_URL}/repositories/{repo_id}/actions",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


# ── 404 Not Found ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_actions_unknown_repo_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_db = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=empty)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/actions",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_action_not_found_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    action_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/actions/{action_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


# ── Happy Paths ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_actions_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_action = _make_action(workspace_id, repo_id)

    mock_db = AsyncMock()
    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo

    count_res = MagicMock()
    count_res.scalar_one.return_value = 1

    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = [mock_action]

    mock_db.execute = AsyncMock(side_effect=[repo_res, count_res, items_res])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/actions",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["action_type"] == "ADD_SECURITY_POLICY"


@pytest.mark.asyncio
async def test_get_action_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_action = _make_action(workspace_id, repo_id)
    action_id = mock_action.id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_action)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/actions/{action_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(action_id)
    assert data["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_execute_approved_action_returns_202(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_action = _make_action(workspace_id, repo_id, status=AIActionStatus.APPROVED.value)
    action_id = mock_action.id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_action)

    _mock_db_override(mock_db)
    try:
        with (
            patch("app.services.auth.get_settings") as mock_cfg,
            patch("app.api.v1.ai_actions.create_pool", new_callable=AsyncMock) as mock_pool_creator,
        ):
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            mock_cfg.return_value.redis_url = "redis://localhost:6379/0"

            mock_pool = AsyncMock()
            mock_pool.enqueue_job = AsyncMock()
            mock_pool.close = AsyncMock()
            mock_pool_creator.return_value = mock_pool

            response = await client.post(
                f"{BASE_URL}/actions/{action_id}/execute",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 202
    data = response.json()
    assert data["id"] == str(action_id)
    assert mock_pool.enqueue_job.called


@pytest.mark.asyncio
async def test_execute_non_approved_action_returns_409(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_action = _make_action(workspace_id, repo_id, status=AIActionStatus.PENDING.value)
    action_id = mock_action.id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_action)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.post(
                f"{BASE_URL}/actions/{action_id}/execute",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 409
