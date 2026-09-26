"""GitHub data fetcher for repository scanning.

Fetches all data needed to populate a ScanContext without requiring
collectors to make individual GitHub API calls.  All I/O is centralized
here so the scan runner can handle rate-limit / auth failures in one place.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.github.client import GitHubClient
from app.services.scanner.context import (
    CommitSummary,
    IssueSummary,
    PullRequestSummary,
    ScanContext,
)

logger = logging.getLogger(__name__)

# Files we try to fetch content for (relative to repo root, case-insensitive)
_CONTENT_FILES = [
    "readme.md",
    "readme.rst",
    "readme.txt",
    "readme",
    "license",
    "license.md",
    "license.txt",
    "contributing.md",
    "contributing",
    "code_of_conduct.md",
    "security.md",
    ".github/dependabot.yml",
    ".github/dependabot.yaml",
]

_COMMIT_WINDOW_DAYS = 30
_MAX_ISSUES = 100
_MAX_PRS = 100
_MAX_COMMITS = 100


async def build_scan_context(client: GitHubClient) -> ScanContext:
    """Fetch repository data and return a populated ``ScanContext``.

    Args:
        client: An authenticated ``GitHubClient`` context-managed by the caller.

    Returns:
        Populated ``ScanContext`` ready to pass to collectors.
    """
    owner = client._owner
    repo = client._repo

    # ── 1. Repository metadata ─────────────────────────────────────────────
    repo_raw = await client.get(f"/repos/{owner}/{repo}")
    repo_data: dict[str, Any] = repo_raw if isinstance(repo_raw, dict) else {}
    default_branch: str = repo_data.get("default_branch", "main")

    created_at = _parse_dt(repo_data.get("created_at"))
    pushed_at = _parse_dt(repo_data.get("pushed_at"))

    # ── 2. File tree (recursive, one request) ─────────────────────────────
    file_paths: list[str] = []
    try:
        tree_raw = await client.get(
            f"/repos/{owner}/{repo}/git/trees/{default_branch}",
            params={"recursive": "1"},
        )
        tree_resp: dict[str, Any] = tree_raw if isinstance(tree_raw, dict) else {}
        file_paths = [
            item["path"]
            for item in tree_resp.get("tree", [])
            if item.get("type") == "blob"
        ]
    except Exception:
        logger.warning("Could not fetch file tree for %s/%s", owner, repo)

    # ── 3. Selected file contents ──────────────────────────────────────────
    file_contents: dict[str, str] = {}
    path_lower_map = {p.lower(): p for p in file_paths}
    for target in _CONTENT_FILES:
        actual_path = path_lower_map.get(target.lower())
        if actual_path:
            try:
                content = await client.get_file_content(actual_path)
                if content:
                    file_contents[actual_path] = content
            except Exception:
                logger.debug("Could not fetch %s for %s/%s", actual_path, owner, repo)

    # ── 4. Recent commits (last N days) ───────────────────────────────────
    recent_commits: list[CommitSummary] = []
    since = (datetime.now(UTC) - timedelta(days=_COMMIT_WINDOW_DAYS)).isoformat()
    try:
        commits_data = await client.get(
            f"/repos/{owner}/{repo}/commits",
            params={"since": since, "per_page": _MAX_COMMITS},
        )
        commits_raw: list[dict[str, Any]] = (
            commits_data if isinstance(commits_data, list) else []
        )
        for c in commits_raw:
            committer = c.get("commit", {}).get("committer", {})
            author_login: str | None = None
            if c.get("author"):
                author_login = c["author"].get("login")
            committed_at = _parse_dt(committer.get("date")) or datetime.now(UTC)
            recent_commits.append(
                CommitSummary(
                    sha=c.get("sha", ""),
                    message=(c.get("commit", {}).get("message") or "")[:200],
                    committed_at=committed_at,
                    author_login=author_login,
                )
            )
    except Exception:
        logger.warning("Could not fetch commits for %s/%s", owner, repo)

    # ── 5. Open issues (exclude pull requests) ────────────────────
    open_issues: list[IssueSummary] = []
    try:
        issues_data = await client.get(
            f"/repos/{owner}/{repo}/issues",
            params={"state": "open", "per_page": _MAX_ISSUES},
        )
        issues_raw: list[dict[str, Any]] = (
            issues_data if isinstance(issues_data, list) else []
        )
        for issue in issues_raw:
            if "pull_request" in issue:
                continue  # skip PR items in issues list
            open_issues.append(
                IssueSummary(
                    number=issue["number"],
                    title=issue.get("title", ""),
                    created_at=_parse_dt(issue.get("created_at")) or datetime.now(UTC),
                    updated_at=_parse_dt(issue.get("updated_at")) or datetime.now(UTC),
                    labels=[label.get("name", "") for label in issue.get("labels", [])],
                )
            )
    except Exception:
        logger.warning("Could not fetch issues for %s/%s", owner, repo)

    # ── 6. Open pull requests ─────────────────────────────────────
    open_prs: list[PullRequestSummary] = []
    try:
        prs_data = await client.get(
            f"/repos/{owner}/{repo}/pulls",
            params={"state": "open", "per_page": _MAX_PRS},
        )
        prs_raw: list[dict[str, Any]] = prs_data if isinstance(prs_data, list) else []
        for pr in prs_raw:
            open_prs.append(
                PullRequestSummary(
                    number=pr["number"],
                    title=pr.get("title", ""),
                    created_at=_parse_dt(pr.get("created_at")) or datetime.now(UTC),
                    updated_at=_parse_dt(pr.get("updated_at")) or datetime.now(UTC),
                    draft=pr.get("draft", False),
                )
            )
    except Exception:
        logger.warning("Could not fetch PRs for %s/%s", owner, repo)

    return ScanContext(
        repository_id=str(repo_data.get("id", "")),
        owner=owner,
        repo=repo,
        default_branch=default_branch,
        private=repo_data.get("private", False),
        description=repo_data.get("description"),
        topics=repo_data.get("topics", []),
        stars=repo_data.get("stargazers_count", 0),
        open_issues_count=repo_data.get("open_issues_count", 0),
        created_at=created_at or datetime.now(UTC),
        pushed_at=pushed_at,
        file_paths=file_paths,
        file_contents=file_contents,
        recent_commits=recent_commits,
        open_issues=open_issues,
        open_pull_requests=open_prs,
    )


def _parse_dt(value: str | None) -> datetime | None:
    """Parse ISO 8601 string to UTC-aware datetime, return None on failure."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except (ValueError, TypeError):
        return None
