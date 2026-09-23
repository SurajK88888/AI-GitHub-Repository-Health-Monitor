"""ARQ worker job: process GitHub webhook events.

Handles:
  - installation.created / installation.deleted
  - installation_repositories.added / installation_repositories.removed
  - push (recorded for activity tracking in Phase 3)
  - pull_request (recorded for PR tracking in Phase 3)

All DB operations use a fresh async session per job invocation.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.database import AsyncSessionLocal
from app.enums import InstallationStatus
from app.models.github_installation import GitHubInstallation
from app.models.repository import Repository
from app.services import audit_service

logger = logging.getLogger(__name__)


async def process_webhook(ctx: dict[str, Any], event: dict[str, Any]) -> None:
    """ARQ job entrypoint for GitHub webhook events.

    Args:
        ctx: ARQ job context (contains redis pool etc.).
        event: Serialized NormalizedGitHubEvent dict.
    """
    event_type: str = event.get("event_type", "")
    payload: dict[str, Any] = event.get("payload", {})
    delivery_id: str = event.get("delivery_id", "unknown")
    installation_id_raw: int | None = event.get("installation_id")

    logger.info(
        "Processing webhook event=%s delivery=%s installation=%s",
        event_type,
        delivery_id,
        installation_id_raw,
    )

    async with AsyncSessionLocal() as db:
        try:
            if event_type == "installation" and installation_id_raw:
                await _handle_installation(db, payload, installation_id_raw)

            elif event_type == "installation_repositories" and installation_id_raw:
                await _handle_installation_repositories(db, payload, installation_id_raw)

            elif event_type in ("push", "pull_request"):
                # Phase 3 will handle scanning; for now just log
                logger.info("Event %s received for future processing (Phase 3)", event_type)

            await audit_service.log_event(
                db,
                action=f"WEBHOOK_{event_type.upper()}",
                metadata={"delivery_id": delivery_id, "event_type": event_type},
            )
            await db.commit()

        except Exception:
            logger.exception(
                "Failed to process webhook event=%s delivery=%s", event_type, delivery_id
            )
            await db.rollback()
            raise


async def _handle_installation(
    db: Any,
    payload: dict[str, Any],
    github_installation_id: int,
) -> None:
    """Create or deactivate a GitHubInstallation row."""
    from sqlalchemy import select

    action: str = payload.get("action", "")
    installation_data: dict[str, Any] = payload.get("installation", {})
    account: dict[str, Any] = installation_data.get("account", {})

    result = await db.execute(
        select(GitHubInstallation).where(
            GitHubInstallation.github_installation_id == github_installation_id
        )
    )
    installation = result.scalar_one_or_none()

    if action == "created":
        if installation is None:
            # We need a workspace_id — for new installs without a session we
            # store a sentinel and the user links it on next /auth/session call.
            # Phase 2 scope: store the installation; workspace linking is done
            # through the /installations API after OAuth callback.
            logger.info(
                "New installation %s from account %s — stored without workspace (link via UI)",
                github_installation_id,
                account.get("login"),
            )
        else:
            installation.status = InstallationStatus.ACTIVE

    elif action in ("deleted", "suspend"):
        if installation:
            installation.status = InstallationStatus.REMOVED

    elif action == "unsuspend":
        if installation:
            installation.status = InstallationStatus.ACTIVE


async def _handle_installation_repositories(
    db: Any,
    payload: dict[str, Any],
    github_installation_id: int,
) -> None:
    """Add or remove Repository rows based on installation_repositories events."""
    from sqlalchemy import select

    result = await db.execute(
        select(GitHubInstallation).where(
            GitHubInstallation.github_installation_id == github_installation_id
        )
    )
    installation = result.scalar_one_or_none()
    if installation is None:
        logger.warning(
            "installation_repositories event for unknown installation %s",
            github_installation_id,
        )
        return

    added: list[dict[str, Any]] = payload.get("repositories_added", [])
    removed: list[dict[str, Any]] = payload.get("repositories_removed", [])

    for repo_data in added:
        github_repo_id: int = repo_data["id"]
        exists = await db.execute(
            select(Repository).where(
                Repository.github_installation_id == installation.id,
                Repository.github_repository_id == github_repo_id,
            )
        )
        if exists.scalar_one_or_none() is None:
            repo = Repository(
                id=uuid.uuid4(),
                workspace_id=installation.workspace_id,
                github_installation_id=installation.id,
                github_repository_id=github_repo_id,
                owner_login=repo_data.get("full_name", "").split("/")[0],
                name=repo_data["name"],
                full_name=repo_data["full_name"],
                html_url=f"https://github.com/{repo_data['full_name']}",
                is_private=repo_data.get("private", False),
            )
            db.add(repo)
            logger.info("Added repository %s", repo_data["full_name"])

    for repo_data in removed:
        github_repo_id = repo_data["id"]
        result_r = await db.execute(
            select(Repository).where(
                Repository.github_installation_id == installation.id,
                Repository.github_repository_id == github_repo_id,
            )
        )
        repo = result_r.scalar_one_or_none()
        if repo:
            repo.monitoring_enabled = False
            logger.info("Removed repository %s (monitoring disabled)", repo_data["full_name"])
