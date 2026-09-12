"""Webhook internal event schemas (Doc 09 §10).

GitHub payloads are normalized into these schemas before entering
internal processing. The raw payload is never passed application-wide.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class NormalizedGitHubEvent(APIModel):
    """Internal representation of a received GitHub webhook event."""

    event_id: str = Field(description="GitHub X-GitHub-Delivery header value")
    event_type: str = Field(description="GitHub X-GitHub-Event header value")
    installation_id: int
    repository_id: int | None = None
    action: str | None = None
    sender: str | None = None
    delivery_timestamp: datetime
    payload_reference: str | None = Field(
        default=None,
        description="Internal reference to the stored/compressed raw payload if needed",
    )
