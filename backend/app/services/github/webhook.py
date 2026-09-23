"""GitHub webhook signature verification and event normalization.

Security rules (from Doc 06):
- Never process an unsigned webhook.
- Validate HMAC-SHA256 before reading any payload field.
- Return the normalized event; caller decides whether to enqueue or discard.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.schemas.webhook import NormalizedGitHubEvent


async def verify_and_parse(request: Request) -> NormalizedGitHubEvent:
    """Verify the GitHub webhook signature and return a normalized event.

    Reads raw bytes (required for HMAC), validates the signature, then
    normalizes into a ``NormalizedGitHubEvent`` Pydantic model.

    Args:
        request: The incoming FastAPI request.

    Returns:
        NormalizedGitHubEvent with all required fields populated.

    Raises:
        HTTPException 400: Missing required headers.
        HTTPException 403: Signature mismatch (tampered payload).
    """
    settings = get_settings()

    # --- Extract required headers ---
    event_type = request.headers.get("X-GitHub-Event")
    delivery_id = request.headers.get("X-GitHub-Delivery")
    signature_header = request.headers.get("X-Hub-Signature-256")

    if not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-GitHub-Event header",
        )
    if not delivery_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-GitHub-Delivery header",
        )
    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Hub-Signature-256 header",
        )

    # --- Read raw body and verify HMAC BEFORE parsing JSON ---
    raw_body = await request.body()

    if not settings.github_app_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    secret_bytes = settings.github_app_webhook_secret.encode("utf-8")
    expected_signature = "sha256=" + hmac.new(secret_bytes, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook signature",
        )

    # --- Parse JSON only after signature is verified ---
    import json

    try:
        payload: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from exc

    # --- Extract installation_id (present on most events) ---
    installation_id: int | None = None
    if "installation" in payload and isinstance(payload["installation"], dict):
        installation_id = payload["installation"].get("id")

    return NormalizedGitHubEvent(
        event_type=event_type,
        delivery_id=delivery_id,
        installation_id=installation_id,
        payload=payload,
    )
