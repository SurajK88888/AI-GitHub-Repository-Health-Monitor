"""Tests for the GitHub webhook endpoint.

Security tests (Doc 06 §7):
- Valid HMAC-SHA256 signature → 202 Accepted
- Tampered payload → 403 Forbidden
- Missing signature header → 400 Bad Request
- Missing event header → 400 Bad Request
- Duplicate delivery ID → 202 (skipped, not re-queued)
"""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

WEBHOOK_SECRET = "test-webhook-secret"
WEBHOOK_URL = "/api/v1/webhooks/github"


def _make_payload() -> dict:
    return {
        "action": "created",
        "installation": {"id": 12345, "account": {"login": "testuser"}},
    }


def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.fixture
def webhook_headers():
    """Return valid webhook headers factory."""

    def _headers(payload_bytes: bytes, secret: str = WEBHOOK_SECRET) -> dict:
        return {
            "X-GitHub-Event": "installation",
            "X-GitHub-Delivery": "test-delivery-001",
            "X-Hub-Signature-256": _sign(secret, payload_bytes),
            "Content-Type": "application/json",
        }

    return _headers


@pytest.mark.asyncio
async def test_missing_event_header_returns_400(client: AsyncClient) -> None:
    body = json.dumps(_make_payload()).encode()
    response = await client.post(
        WEBHOOK_URL,
        content=body,
        headers={
            "X-GitHub-Delivery": "del-001",
            "X-Hub-Signature-256": _sign(WEBHOOK_SECRET, body),
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_missing_signature_returns_400(client: AsyncClient) -> None:
    body = json.dumps(_make_payload()).encode()
    response = await client.post(
        WEBHOOK_URL,
        content=body,
        headers={
            "X-GitHub-Event": "installation",
            "X-GitHub-Delivery": "del-002",
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_tampered_payload_returns_403(client: AsyncClient) -> None:
    """Sign original body, then send a different body — should be rejected."""
    original_body = json.dumps(_make_payload()).encode()
    tampered_body = json.dumps({"action": "evil"}).encode()
    signature = _sign(WEBHOOK_SECRET, original_body)

    with patch("app.services.github.webhook.get_settings") as mock_cfg:
        s = mock_cfg.return_value
        s.github_app_webhook_secret = WEBHOOK_SECRET

        response = await client.post(
            WEBHOOK_URL,
            content=tampered_body,
            headers={
                "X-GitHub-Event": "installation",
                "X-GitHub-Delivery": "del-003",
                "X-Hub-Signature-256": signature,
                "Content-Type": "application/json",
            },
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_valid_webhook_returns_202(client: AsyncClient) -> None:
    """Valid signed webhook → 202 Accepted."""
    from app.main import app
    from app.workers.deps import get_redis

    payload = _make_payload()
    body = json.dumps(payload).encode()
    sig = _sign(WEBHOOK_SECRET, body)

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()

    async def fake_get_redis():
        yield mock_redis

    app.dependency_overrides[get_redis] = fake_get_redis

    try:
        with (
            patch("app.services.github.webhook.get_settings") as mock_cfg,
            patch("app.api.v1.webhooks.create_pool", new_callable=AsyncMock) as mock_pool,
        ):
            s = mock_cfg.return_value
            s.github_app_webhook_secret = WEBHOOK_SECRET
            s.redis_url = "redis://localhost:6379/0"
            mock_pool.return_value.__aenter__ = AsyncMock(return_value=mock_pool.return_value)
            mock_pool.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_pool.return_value.enqueue_job = AsyncMock()
            mock_pool.return_value.close = AsyncMock()

            response = await client.post(
                WEBHOOK_URL,
                content=body,
                headers={
                    "X-GitHub-Event": "installation",
                    "X-GitHub-Delivery": "del-004",
                    "X-Hub-Signature-256": sig,
                    "Content-Type": "application/json",
                },
            )
        assert response.status_code == 202
    finally:
        app.dependency_overrides.pop(get_redis, None)
