"""Tests for the /health and /ready endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_returns_ok_status(client: AsyncClient) -> None:
    response = await client.get("/health")
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_returns_version(client: AsyncClient) -> None:
    response = await client.get("/health")
    data = response.json()
    assert "version" in data


@pytest.mark.asyncio
async def test_ready_returns_200(client: AsyncClient) -> None:
    response = await client.get("/ready")
    assert response.status_code == 200
