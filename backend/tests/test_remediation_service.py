"""Tests for the remediation service (templates + executor).

Covers:
- Template generation for security policy, dependabot, CI, readme, contributing
- Sanitization of repo name in templates
- execute_remediation_action with unknown action → NOT_FOUND
- execute_remediation_action with non-APPROVED action → INVALID_STATUS
- execute_remediation_action happy path: branch created, file committed, PR opened, action completed
- execute_remediation_action failure path: handles exception gracefully, marks FAILED, logs audit
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.enums import AIActionStatus, RecommendationStatus
from app.services.remediation.executor import execute_remediation_action
from app.services.remediation.templates import (
    generate_ci_workflow,
    generate_contributing_guide,
    generate_dependabot_config,
    generate_readme,
    generate_remediation_content,
    generate_security_policy,
)

# ── Templates Unit Tests ───────────────────────────────────────────────────────


def test_generate_security_policy_contains_repo_name() -> None:
    content = generate_security_policy("my-awesome-repo")
    assert "my-awesome-repo" in content
    assert "Reporting a Vulnerability" in content
    assert "Security Advisories" in content


def test_generate_dependabot_config_valid() -> None:
    content = generate_dependabot_config()
    assert "package-ecosystem" in content
    assert "github-actions" in content
    assert "interval" in content


def test_generate_ci_workflow_valid() -> None:
    content = generate_ci_workflow("test-app")
    assert "name: test-app CI" in content
    assert "actions/checkout@v4" in content


def test_generate_readme_valid() -> None:
    content = generate_readme("ProjectX", "Cool project description")
    assert "# ProjectX" in content
    assert "Cool project description" in content


def test_generate_contributing_guide_valid() -> None:
    content = generate_contributing_guide("ProjectY")
    assert "# Contributing to ProjectY" in content
    assert "Pull Request" in content or "pull request" in content


def test_generate_remediation_content_security_policy() -> None:
    path, msg, content = generate_remediation_content(
        action_type="ADD_SECURITY_POLICY",
        category="SECURITY",
        repo_name="demo",
    )
    assert path == "SECURITY.md"
    assert "security policy" in msg
    assert "Security Policy" in content


def test_generate_remediation_content_dependabot() -> None:
    path, msg, content = generate_remediation_content(
        action_type="ENABLE_DEPENDABOT",
        category="DEPENDENCIES",
        repo_name="demo",
    )
    assert path == ".github/dependabot.yml"
    assert "dependabot" in msg
    assert "package-ecosystem" in content


def test_generate_remediation_content_ci() -> None:
    path, msg, content = generate_remediation_content(
        action_type="SETUP_CI_WORKFLOW",
        category="CODE_QUALITY",
        repo_name="demo",
    )
    assert path == ".github/workflows/ci.yml"
    assert "continuous integration" in msg
    assert "build-and-test" in content


def test_generate_remediation_content_custom_override() -> None:
    path, msg, content = generate_remediation_content(
        action_type="CUSTOM",
        category="CONFIGURATION",
        repo_name="demo",
        parameters={
            "file_path": "config/settings.json",
            "commit_message": "chore: add settings",
            "content": '{"key": "value"}',
        },
    )
    assert path == "config/settings.json"
    assert msg == "chore: add settings"
    assert content == '{"key": "value"}'


# ── Executor Unit & Integration Tests ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_execute_remediation_action_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    mock_redis = AsyncMock()

    result = await execute_remediation_action(uuid.uuid4(), mock_db, mock_redis)
    assert result["status"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_execute_remediation_action_invalid_status() -> None:
    action = MagicMock()
    action.status = AIActionStatus.PENDING.value  # not APPROVED

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=action)
    mock_redis = AsyncMock()

    result = await execute_remediation_action(uuid.uuid4(), mock_db, mock_redis)
    assert result["status"] == "INVALID_STATUS"


@pytest.mark.asyncio
async def test_execute_remediation_action_success() -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    action_id = uuid.uuid4()
    user_id = uuid.uuid4()
    rec_id = uuid.uuid4()

    mock_action = MagicMock()
    mock_action.id = action_id
    mock_action.workspace_id = workspace_id
    mock_action.repository_id = repo_id
    mock_action.recommendation_id = rec_id
    mock_action.requested_by = user_id
    mock_action.action_type = "ADD_SECURITY_POLICY"
    mock_action.status = AIActionStatus.APPROVED.value

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id
    mock_repo.full_name = "owner/repo"
    mock_repo.default_branch = "main"

    mock_rec = MagicMock()
    mock_rec.id = rec_id
    mock_rec.recommended_action = {"category": "SECURITY"}

    mock_installation = MagicMock()
    mock_installation.github_installation_id = 99999

    mock_db = AsyncMock()
    # db.get calls: 1. AIAction, 2. Repository, 3. Recommendation
    mock_db.get = AsyncMock(side_effect=[mock_action, mock_repo, mock_rec])

    # db.execute calls: installation lookup
    inst_result = MagicMock()
    inst_result.scalars.return_value.first.return_value = mock_installation
    mock_db.execute = AsyncMock(return_value=inst_result)

    mock_redis = AsyncMock()

    # Mock GitHubClient
    with (
        patch("app.services.remediation.executor.GitHubClient") as mock_gh_cls,
        patch(
            "app.services.notifications.service.create_notification", new_callable=AsyncMock
        ) as mock_notif,
        patch("app.services.audit_service.log_event", new_callable=AsyncMock) as mock_audit,
    ):
        mock_gh = AsyncMock()
        mock_gh.get_branch_sha = AsyncMock(return_value="abc123sha")
        mock_gh.create_branch = AsyncMock(return_value={"ref": "refs/heads/remediation"})
        mock_gh.get_file_content = AsyncMock(return_value=None)
        mock_gh.create_or_update_file = AsyncMock(return_value={"commit": {"sha": "def456"}})
        mock_gh.create_pull_request = AsyncMock(
            return_value={"html_url": "https://github.com/owner/repo/pull/1", "number": 1}
        )
        mock_gh_cls.return_value.__aenter__ = AsyncMock(return_value=mock_gh)
        mock_gh_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        outcome = await execute_remediation_action(action_id, mock_db, mock_redis)

    assert outcome["status"] == "COMPLETED"
    assert outcome["pull_request_url"] == "https://github.com/owner/repo/pull/1"
    assert outcome["pull_request_number"] == 1
    assert mock_action.status == AIActionStatus.COMPLETED.value
    assert mock_rec.status == RecommendationStatus.COMPLETED.value
    assert mock_audit.called
    assert mock_notif.called


@pytest.mark.asyncio
async def test_execute_remediation_action_github_failure() -> None:
    workspace_id = uuid.uuid4()
    repo_id = uuid.uuid4()
    action_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_action = MagicMock()
    mock_action.id = action_id
    mock_action.workspace_id = workspace_id
    mock_action.repository_id = repo_id
    mock_action.recommendation_id = None
    mock_action.requested_by = user_id
    mock_action.action_type = "ADD_SECURITY_POLICY"
    mock_action.status = AIActionStatus.APPROVED.value

    mock_repo = MagicMock()
    mock_repo.id = repo_id
    mock_repo.workspace_id = workspace_id
    mock_repo.full_name = "owner/repo"
    mock_repo.default_branch = "main"

    mock_installation = MagicMock()
    mock_installation.github_installation_id = 99999

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[mock_action, mock_repo])

    inst_result = MagicMock()
    inst_result.scalars.return_value.first.return_value = mock_installation
    mock_db.execute = AsyncMock(return_value=inst_result)

    mock_redis = AsyncMock()

    with (
        patch("app.services.remediation.executor.GitHubClient") as mock_gh_cls,
        patch(
            "app.services.notifications.service.create_notification", new_callable=AsyncMock
        ) as mock_notif,
        patch("app.services.audit_service.log_event", new_callable=AsyncMock) as mock_audit,
    ):
        mock_gh = AsyncMock()
        mock_gh.get_branch_sha = AsyncMock(
            side_effect=RuntimeError("GitHub API rate limit exceeded")
        )
        mock_gh_cls.return_value.__aenter__ = AsyncMock(return_value=mock_gh)
        mock_gh_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        outcome = await execute_remediation_action(action_id, mock_db, mock_redis)

    assert outcome["status"] == "FAILED"
    assert "rate limit" in outcome["error"]
    assert mock_action.status == AIActionStatus.FAILED.value
    assert mock_audit.called
    assert mock_notif.called
