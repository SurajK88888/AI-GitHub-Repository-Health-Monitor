"""Audit logging service.

Writes immutable AuditLog rows for security-relevant events.

Rules (Doc 06):
- No secrets or sensitive payloads in metadata.
- Failure to write an audit log must not crash the main operation
  (log the error, do not re-raise).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def log_event(
    db: AsyncSession,
    *,
    action: str,
    workspace_id: UUID | None = None,
    user_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Write an audit log row.

    This function is intentionally fault-tolerant: if writing the audit log
    fails (e.g. DB unavailable), the error is logged but not re-raised so
    the calling operation can still succeed.

    Args:
        db: Active async DB session.
        action: Short description of the action (e.g. ``USER_LOGIN``).
        workspace_id: Workspace context, if applicable.
        user_id: Actor user ID, if authenticated.
        resource_type: Type of resource affected (e.g. ``repository``).
        resource_id: ID of the affected resource.
        metadata: Additional safe context (must not contain secrets).
    """
    try:
        entry = AuditLog(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata,
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.exception("Failed to write audit log for action=%r user=%s", action, user_id)
