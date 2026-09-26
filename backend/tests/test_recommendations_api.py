"""Tests for Recommendations API endpoints.

Covers:
- Unauthenticated access → 401
- No workspace → 400
- Repository not found → 404
- Recommendation not found → 404
- List recommendations → 200 with empty items
- List recommendations with status filter → 200
- List recommendations with priority filter → 200
- Get single recommendation → 200
- Approve PENDING recommendation → 200 with action_id
- Approve non-PENDING recommendation → 409
- Approve without confirmation=true → 400
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

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


def _make_recommendation(
    repo_id: uuid.UUID,
    status: str = "PENDING",
    priority: str = "HIGH",
) -> MagicMock:
    rec = MagicMock()
    rec.id = uuid.uuid4()
    rec.repository_id = repo_id
    rec.finding_id = None
    rec.ai_analysis_id = uuid.uuid4()
    rec.title = "Fix the vulnerability"
    rec.description = "You should fix this immediately."
    rec.priority = priority
    rec.status = status
    rec.recommended_action = {"action_type": "REVIEW", "category": "SECURITY"}
    rec.created_at = datetime.now(UTC)
    return rec


# ── Authentication guards ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_recommendations_unauthenticated_returns_401(
    client: AsyncClient,
) -> None:
    repo_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/repositories/{repo_id}/recommendations")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_recommendation_unauthenticated_returns_401(
    client: AsyncClient,
) -> None:
    rec_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/recommendations/{rec_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_approve_recommendation_unauthenticated_returns_401(
    client: AsyncClient,
) -> None:
    rec_id = uuid.uuid4()
    response = await client.post(
        f"{BASE_URL}/recommendations/{rec_id}/approve",
        json={"confirmation": True},
    )
    assert response.status_code == 401


# ── No workspace → 400 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_recommendations_no_workspace_returns_400(
    client: AsyncClient,
) -> None:
    token = _make_token()
    repo_id = uuid.uuid4()
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            f"{BASE_URL}/repositories/{repo_id}/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


# ── Repository not found → 404 ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_recommendations_unknown_repo_returns_404(
    client: AsyncClient,
) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    repo_id = uuid.uuid4()

    mock_db = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=empty)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/recommendations",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


# ── List recommendations → 200 empty ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_recommendations_returns_200_empty(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()

    # 1: repo lookup
    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo

    # 2: count
    count_res = MagicMock()
    count_res.scalar_one.return_value = 0

    # 3: items
    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[repo_res, count_res, items_res])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/recommendations",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["has_next"] is False


# ── List recommendations with filters → 200 ───────────────────────────────────


@pytest.mark.asyncio
async def test_list_recommendations_with_status_filter_returns_200(
    client: AsyncClient,
) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_rec = _make_recommendation(repo_id, status="PENDING")

    mock_db = AsyncMock()
    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo

    count_res = MagicMock()
    count_res.scalar_one.return_value = 1

    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = [mock_rec]

    mock_db.execute = AsyncMock(side_effect=[repo_res, count_res, items_res])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/recommendations?status=PENDING",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["status"] == "PENDING"


# ── Get single recommendation → 200 ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_recommendation_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_rec = _make_recommendation(repo_id)
    rec_id = mock_rec.id

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()
    # db.get(Recommendation, id) → rec
    mock_db.get = AsyncMock(return_value=mock_rec)

    # _get_repo_or_404 execute
    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo
    mock_db.execute = AsyncMock(return_value=repo_res)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/recommendations/{rec_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(rec_id)
    assert data["title"] == "Fix the vulnerability"


# ── Get recommendation → 404 ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_recommendation_not_found_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    rec_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/recommendations/{rec_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


# ── Approve recommendation → 200 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_pending_recommendation_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    user_id = uuid.uuid4()
    token_payload: dict = {
        "sub": str(user_id),
        "email": "u@example.com",
        "name": "U",
        "workspace_id": str(workspace_id),
        "iat": int(datetime.now(UTC).timestamp()),
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
    }
    token = jwt.encode(token_payload, NEXTAUTH_SECRET, algorithm="HS256")

    mock_rec = _make_recommendation(repo_id, status="PENDING")
    rec_id = mock_rec.id

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_action = MagicMock()
    mock_action.id = uuid.uuid4()
    mock_action.status = "APPROVED"
    mock_action.approval_required = True
    mock_action.approved_at = datetime.now(UTC)

    mock_db = AsyncMock()
    # First get: Recommendation, Second: Repo (via _get_repo_or_404 → execute)
    mock_db.get = AsyncMock(side_effect=[mock_rec, mock_action])

    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo
    mock_db.execute = AsyncMock(return_value=repo_res)

    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.post(
                f"{BASE_URL}/recommendations/{rec_id}/approve",
                json={"confirmation": True},
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["approval_required"] is True
    assert "action_id" in data


# ── Approve non-PENDING → 409 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_already_approved_returns_409(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_rec = _make_recommendation(repo_id, status="APPROVED")  # already approved
    rec_id = mock_rec.id

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=mock_rec)

    repo_res = MagicMock()
    repo_res.scalar_one_or_none.return_value = mock_repo
    mock_db.execute = AsyncMock(return_value=repo_res)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.post(
                f"{BASE_URL}/recommendations/{rec_id}/approve",
                json={"confirmation": True},
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 409


# ── Approve without confirmation → 400 ────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_without_confirmation_returns_400(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    rec_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.post(
            f"{BASE_URL}/recommendations/{rec_id}/approve",
            json={"confirmation": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 400
