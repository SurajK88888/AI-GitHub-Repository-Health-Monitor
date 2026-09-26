"""Tests for Health Scores API endpoints.

Covers:
- Unauthenticated access → 401
- No workspace → 400
- Repository not found → 404
- No health score yet → 404
- GET /repositories/{id}/health → 200 with correct structure
- GET /repositories/{id}/health/history → 200 paginated
- GET /workspaces/scoring-config → 200
- POST /workspaces/scoring-config → 201 with validation
- POST /workspaces/scoring-config with weights ≠ 100 → 422
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


def _mock_db_override(mock_db: AsyncMock):
    from app.database import get_db
    from app.main import app

    async def fake_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = fake_get_db
    return get_db


def _clear_db_override() -> None:
    from app.database import get_db
    from app.main import app

    app.dependency_overrides.pop(get_db, None)


# ── Authentication ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_unauthenticated_returns_401(client: AsyncClient) -> None:
    repo_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/repositories/{repo_id}/health")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_health_history_unauthenticated_returns_401(client: AsyncClient) -> None:
    repo_id = uuid.uuid4()
    response = await client.get(f"{BASE_URL}/repositories/{repo_id}/health/history")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_scoring_config_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.get(f"{BASE_URL}/workspaces/scoring-config")
    assert response.status_code == 401


# ── No workspace → 400 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_no_workspace_returns_400(client: AsyncClient) -> None:
    token = _make_token()  # no workspace_id
    repo_id = uuid.uuid4()
    with patch("app.services.auth.get_settings") as mock_cfg:
        mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.get(
            f"{BASE_URL}/repositories/{repo_id}/health",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 400


# ── Repository not found → 404 ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_unknown_repo_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)
    repo_id = uuid.uuid4()

    mock_db = AsyncMock()
    # _get_repo_or_404 query returns None
    empty_result = MagicMock()
    empty_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=empty_result)

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/health",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


# ── No health score yet → 404 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_no_score_returns_404(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()

    # Call 1: _get_repo_or_404 → repo found
    repo_result = MagicMock()
    repo_result.scalar_one_or_none.return_value = mock_repo

    # Call 2: latest HealthScore query → None
    hs_result = MagicMock()
    hs_result.scalars.return_value.first.return_value = None

    mock_db.execute = AsyncMock(side_effect=[repo_result, hs_result])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_cfg:
            mock_cfg.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/health",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 404


# ── GET /health → 200 ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_returns_200_with_structure(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    scan_id = uuid.uuid4()
    hs_id = uuid.uuid4()
    cfg_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_hs = MagicMock()
    mock_hs.id = hs_id
    mock_hs.repository_id = repo_id
    mock_hs.scan_id = scan_id
    mock_hs.overall_score = 82.0
    mock_hs.scoring_configuration_id = cfg_id
    mock_hs.created_at = now

    mock_db = AsyncMock()

    # 1: repo lookup
    repo_result = MagicMock()
    repo_result.scalar_one_or_none.return_value = mock_repo

    # 2: latest health score
    hs_result = MagicMock()
    hs_result.scalars.return_value.first.return_value = mock_hs

    # 3: previous health score (None = first scan)
    prev_result = MagicMock()
    prev_result.scalars.return_value.first.return_value = None

    # 4: category breakdown
    cat_result = MagicMock()
    mock_cat = MagicMock()
    mock_cat.category = "SECURITY"
    mock_cat.raw_score = 80.0
    mock_cat.weight = 20.0
    mock_cat.weighted_score = 16.0
    cat_result.scalars.return_value.all.return_value = [mock_cat]

    # 5: config lookup via db.get
    mock_cfg = MagicMock()
    mock_cfg.version = 1
    mock_db.get = AsyncMock(return_value=mock_cfg)

    mock_db.execute = AsyncMock(side_effect=[repo_result, hs_result, prev_result, cat_result])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_settings:
            mock_settings.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/health",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert "score_band" in data
    assert "categories" in data
    assert data["overall_score"] == 82.0
    assert data["score_band"] == "GOOD"
    assert data["score_delta"] is None  # first scan


# ── GET /health/history → 200 paginated ───────────────────────────────────────


@pytest.mark.asyncio
async def test_get_health_history_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id

    mock_db = AsyncMock()

    # 1: repo lookup
    repo_result = MagicMock()
    repo_result.scalar_one_or_none.return_value = mock_repo

    # 2: count = 0
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0

    # 3: paginated results = []
    page_result = MagicMock()
    page_result.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[repo_result, count_result, page_result])

    _mock_db_override(mock_db)
    try:
        with patch("app.services.auth.get_settings") as mock_settings:
            mock_settings.return_value.nextauth_secret = NEXTAUTH_SECRET
            response = await client.get(
                f"{BASE_URL}/repositories/{repo_id}/health/history",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["has_next"] is False


# ── GET /workspaces/scoring-config → 200 ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_scoring_config_returns_200(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    mock_config = MagicMock()
    mock_config.id = uuid.uuid4()
    mock_config.name = "Default"
    mock_config.is_default = True
    mock_config.version = 1
    mock_config.weights = [MagicMock(category="SECURITY", weight=20.0)]
    mock_config.created_at = datetime.now(UTC)

    with patch(
        "app.api.v1.health_scores.get_or_create_default_config",
        new_callable=AsyncMock,
    ) as mock_get_config:
        mock_get_config.return_value = mock_config
        mock_db = AsyncMock()
        _mock_db_override(mock_db)
        try:
            with patch("app.services.auth.get_settings") as mock_settings:
                mock_settings.return_value.nextauth_secret = NEXTAUTH_SECRET
                response = await client.get(
                    f"{BASE_URL}/workspaces/scoring-config",
                    headers={"Authorization": f"Bearer {token}"},
                )
        finally:
            _clear_db_override()

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 1
    assert "weights" in data


# ── POST /workspaces/scoring-config → 201 ─────────────────────────────────────


@pytest.mark.asyncio
async def test_post_scoring_config_returns_201(client: AsyncClient) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    from app.services.scoring.engine import DEFAULT_WEIGHTS

    payload = {"name": "Custom Config", "weights": DEFAULT_WEIGHTS}

    mock_config = MagicMock()
    mock_config.id = uuid.uuid4()
    mock_config.name = "Custom Config"
    mock_config.is_default = True
    mock_config.version = 2
    mock_config.weights = [MagicMock(category=k, weight=v) for k, v in DEFAULT_WEIGHTS.items()]
    mock_config.created_at = datetime.now(UTC)

    with patch(
        "app.api.v1.health_scores.create_new_config_version",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = mock_config
        mock_db = AsyncMock()
        _mock_db_override(mock_db)
        try:
            with patch("app.services.auth.get_settings") as mock_settings:
                mock_settings.return_value.nextauth_secret = NEXTAUTH_SECRET
                response = await client.post(
                    f"{BASE_URL}/workspaces/scoring-config",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )
        finally:
            _clear_db_override()

    assert response.status_code == 201
    data = response.json()
    assert data["version"] == 2


# ── POST /workspaces/scoring-config invalid weights → 422 ─────────────────────


@pytest.mark.asyncio
async def test_post_scoring_config_invalid_weights_returns_422(
    client: AsyncClient,
) -> None:
    workspace_id = uuid.uuid4()
    token = _make_token(workspace_id=workspace_id)

    bad_weights = {"SECURITY": 50.0, "CODE_QUALITY": 10.0}  # sums to 60, not 100

    with patch("app.services.auth.get_settings") as mock_settings:
        mock_settings.return_value.nextauth_secret = NEXTAUTH_SECRET
        response = await client.post(
            f"{BASE_URL}/workspaces/scoring-config",
            json={"name": "Bad Config", "weights": bad_weights},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 422
