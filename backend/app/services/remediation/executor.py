"""Remediation executor.

Executes an approved AIAction by:
1. Validating workspace ownership and action status (must be APPROVED).
2. Creating an isolated remediation branch in the target GitHub repository.
3. Committing the remediation file(s) generated from safe templates.
4. Opening a Pull Request back into the default branch.
5. Updating action and recommendation status to COMPLETED (or FAILED).
6. Recording audit logs and creating in-app notifications.

Security invariants (Doc 06 & 07):
- NEVER executes without explicit prior approval (status == APPROVED).
- Operates strictly under the authorized GitHub App installation for the workspace.
- Remediation files are generated from strict templates; no arbitrary user code injection.
- Zero secrets or tokens in commits, branches, or PR descriptions.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import AIActionStatus, NotificationSeverity, NotificationType, RecommendationStatus
from app.models.ai_action import AIAction
from app.models.github_installation import GitHubInstallation
from app.models.recommendation import Recommendation
from app.models.repository import Repository
from app.services import audit_service
from app.services.github.client import GitHubClient
from app.services.remediation.templates import generate_remediation_content
from app.workers.deps import RedisClient

logger = logging.getLogger(__name__)


async def execute_remediation_action(
    action_id: uuid.UUID,
    db: AsyncSession,
    redis: RedisClient,
) -> dict[str, Any]:
    """Execute an approved remediation action on GitHub.

    Args:
        action_id: UUID of the AIAction to execute.
        db: Async SQLAlchemy session.
        redis: Async Redis client.

    Returns:
        Dict summarizing execution outcome (status, pull_request_url, error, etc.).
    """
    # ── Load AIAction ────────────────────────────────────────────────────────
    action: AIAction | None = await db.get(AIAction, action_id)
    if action is None:
        logger.error("execute_remediation_action: AIAction %s not found", action_id)
        return {"status": "NOT_FOUND", "error": "AIAction not found"}

    if action.status != AIActionStatus.APPROVED.value:
        logger.warning(
            "execute_remediation_action: AIAction %s has status '%s', expected APPROVED",
            action_id,
            action.status,
        )
        return {
            "status": "INVALID_STATUS",
            "error": f"Action status is '{action.status}', must be APPROVED",
        }

    # ── Load Repository ──────────────────────────────────────────────────────
    repo: Repository | None = await db.get(Repository, action.repository_id)
    if repo is None:
        logger.error("execute_remediation_action: Repository %s not found", action.repository_id)
        return {"status": "FAILED", "error": "Repository not found"}

    # ── Load GitHub Installation ─────────────────────────────────────────────
    stmt = select(GitHubInstallation).where(
        GitHubInstallation.workspace_id == repo.workspace_id,
    )
    result = await db.execute(stmt)
    installation = result.scalars().first()
    if installation is None:
        logger.error(
            "execute_remediation_action: No GitHub installation found for workspace %s",
            repo.workspace_id,
        )
        action.status = AIActionStatus.FAILED.value
        action.error_message = "No GitHub App installation found for workspace"
        action.completed_at = datetime.now(UTC)
        await db.commit()
        return {"status": "FAILED", "error": action.error_message}

    # ── Parse repo owner and name ────────────────────────────────────────────
    full_name = repo.full_name
    parts = full_name.split("/", 1)
    if len(parts) != 2:
        logger.error("execute_remediation_action: Invalid repository full_name '%s'", full_name)
        action.status = AIActionStatus.FAILED.value
        action.error_message = f"Invalid repository full_name '{full_name}'"
        action.completed_at = datetime.now(UTC)
        await db.commit()
        return {"status": "FAILED", "error": action.error_message}

    owner, repo_name = parts

    # ── Mark EXECUTING ───────────────────────────────────────────────────────
    action.status = AIActionStatus.EXECUTING.value
    await db.commit()

    # ── Load linked recommendation if present ────────────────────────────────
    rec: Recommendation | None = None
    if action.recommendation_id:
        rec = await db.get(Recommendation, action.recommendation_id)

    category = "CONFIGURATION"
    params: dict[str, Any] = {}
    if rec and rec.recommended_action:
        category = str(rec.recommended_action.get("category", "CONFIGURATION"))
        params = rec.recommended_action.get("parameters", {})

    target_file, commit_msg, file_content = generate_remediation_content(
        action_type=action.action_type,
        category=category,
        repo_name=repo_name,
        parameters=params,
    )

    base_branch = repo.default_branch or "main"
    short_id = str(action.id)[:8]
    remediation_branch = f"health-monitor/remediation-{short_id}"

    try:
        async with GitHubClient(
            installation_id=installation.github_installation_id,
            redis=redis,
            owner=owner,
            repo=repo_name,
        ) as gh_client:
            # 1. Fetch default branch HEAD SHA
            base_sha = await gh_client.get_branch_sha(base_branch)
            if not base_sha:
                # Fallback to master if main wasn't found
                base_branch = "master"
                base_sha = await gh_client.get_branch_sha("master")
                if not base_sha:
                    raise RuntimeError(
                        f"Could not determine HEAD SHA for default branch of {full_name}"
                    )

            # 2. Create isolated remediation branch
            await gh_client.create_branch(remediation_branch, base_sha)

            # 3. Check if file already exists in branch to obtain its SHA (for clean update)
            existing_file_content = await gh_client.get_file_content(target_file)
            file_sha: str | None = None
            if existing_file_content is not None:
                # Fetch raw file metadata to get sha
                meta = await gh_client.get(
                    f"/repos/{owner}/{repo_name}/contents/{target_file}?ref={remediation_branch}"
                )
                if isinstance(meta, dict):
                    file_sha = meta.get("sha")

            # 4. Commit remediation file to new branch
            await gh_client.create_or_update_file(
                path=target_file,
                message=commit_msg,
                content=file_content,
                branch=remediation_branch,
                sha=file_sha,
            )

            # 5. Open Pull Request
            pr_title = f"[Health Monitor] {commit_msg.capitalize()}"
            pr_body = (
                f"### Automated Health Remediation\n\n"
                f"This pull request was automatically generated and approved via the "
                f"**AI GitHub Repository Health Monitor**.\n\n"
                f"- **Action Type:** `{action.action_type}`\n"
                f"- **Category:** `{category}`\n"
                f"- **Target File:** `{target_file}`\n\n"
                f"Please review the changes and merge when ready."
            )
            pr_data = await gh_client.create_pull_request(
                title=pr_title,
                body=pr_body,
                head=remediation_branch,
                base=base_branch,
            )

            pr_url = pr_data.get("html_url") if isinstance(pr_data, dict) else None
            pr_number = pr_data.get("number") if isinstance(pr_data, dict) else None

        # ── Mark COMPLETED ───────────────────────────────────────────────────
        now = datetime.now(UTC)
        action.status = AIActionStatus.COMPLETED.value
        action.completed_at = now
        action.result = {
            "pull_request_url": pr_url,
            "pull_request_number": pr_number,
            "branch": remediation_branch,
            "file_path": target_file,
        }

        if rec is not None:
            rec.status = RecommendationStatus.COMPLETED.value

        # Log audit event
        await audit_service.log_event(
            db,
            action="ACTION_EXECUTED",
            workspace_id=action.workspace_id,
            user_id=action.requested_by,
            resource_type="repository",
            resource_id=str(repo.id),
            metadata={
                "action_id": str(action.id),
                "action_type": action.action_type,
                "pull_request_url": pr_url,
                "branch": remediation_branch,
            },
        )

        # In-app notification
        from app.services.notifications.service import create_notification

        await create_notification(
            db=db,
            workspace_id=action.workspace_id,
            user_id=action.requested_by,
            notification_type=NotificationType.ACTION_COMPLETED,
            title="Remediation Pull Request Opened",
            message=f"Pull request #{pr_number or ''} was created on {full_name} for '{action.action_type}'.",
            severity=NotificationSeverity.INFO,
            resource_type="repository",
            resource_id=str(repo.id),
        )

        await db.commit()
        logger.info(
            "Remediation action %s completed successfully: PR=%s",
            action_id,
            pr_url,
        )
        return {
            "status": "COMPLETED",
            "pull_request_url": pr_url,
            "pull_request_number": pr_number,
            "branch": remediation_branch,
        }

    except Exception as exc:
        logger.exception("execute_remediation_action: Execution failed for action %s", action_id)
        now = datetime.now(UTC)
        action.status = AIActionStatus.FAILED.value
        action.completed_at = now
        action.error_message = str(exc)[:500]

        if rec is not None:
            rec.status = RecommendationStatus.FAILED.value

        await audit_service.log_event(
            db,
            action="ACTION_FAILED",
            workspace_id=action.workspace_id,
            user_id=action.requested_by,
            resource_type="repository",
            resource_id=str(repo.id),
            metadata={
                "action_id": str(action.id),
                "action_type": action.action_type,
                "error": str(exc)[:200],
            },
        )

        from app.services.notifications.service import create_notification

        await create_notification(
            db=db,
            workspace_id=action.workspace_id,
            user_id=action.requested_by,
            notification_type=NotificationType.ACTION_FAILED,
            title="Remediation Action Failed",
            message=f"Remediation for '{action.action_type}' on {full_name} failed: {str(exc)[:150]}",
            severity=NotificationSeverity.HIGH,
            resource_type="repository",
            resource_id=str(repo.id),
        )

        await db.commit()
        return {"status": "FAILED", "error": str(exc)[:500]}
