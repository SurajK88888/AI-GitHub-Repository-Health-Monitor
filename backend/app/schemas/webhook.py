"""Webhook internal event schemas (Doc 09 §10).

GitHub payloads are normalized into these schemas before entering
internal processing. The raw payload is never passed application-wide.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.common import APIModel


class NormalizedGitHubEvent(APIModel):
    """Internal representation of a received GitHub webhook event.

    Populated by ``app.services.github.webhook.verify_and_parse`` after
    HMAC validation. The full raw payload is included for worker processing.
    """

    event_type: str = Field(description="GitHub X-GitHub-Event header value")
    delivery_id: str = Field(description="GitHub X-GitHub-Delivery header value")
    installation_id: int | None = Field(
        default=None,
        description="GitHub installation ID extracted from payload (if present)",
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Full parsed JSON payload (safe to pass to workers after validation)",
    )
