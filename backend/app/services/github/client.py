"""Async GitHub REST API client.

Wraps httpx.AsyncClient with:
- Automatic installation token injection
- GitHub API version header
- Rate-limit detection and logging
- Typed response helpers
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from app.services.github.auth import get_installation_token
from app.workers.deps import RedisClient

_GITHUB_API_BASE = "https://api.github.com"
_DEFAULT_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


class GitHubClient:
    """Async HTTP client authenticated as a GitHub App installation.

    Usage::

        async with GitHubClient(installation_id=123, redis=redis) as gh:
            repos = await gh.get("/installation/repositories")
    """

    def __init__(
        self,
        installation_id: int,
        redis: RedisClient,
        owner: str = "",
        repo: str = "",
    ) -> None:
        self._installation_id = installation_id
        self._redis = redis
        self._owner = owner
        self._repo = repo
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> GitHubClient:
        token = await get_installation_token(self._installation_id, self._redis)
        self._client = httpx.AsyncClient(
            base_url=_GITHUB_API_BASE,
            headers={**_DEFAULT_HEADERS, "Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()

    def _check_rate_limit(self, response: httpx.Response) -> None:
        remaining = response.headers.get("x-ratelimit-remaining", "?")
        if remaining != "?" and int(remaining) < 100:
            import logging

            logging.getLogger(__name__).warning(
                "GitHub rate limit low: %s remaining (installation %s)",
                remaining,
                self._installation_id,
            )

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any] | list[Any]:
        """Perform a GET request and return parsed JSON."""
        assert self._client is not None, "Use GitHubClient as async context manager"
        response = await self._client.get(path, **kwargs)
        self._check_rate_limit(response)
        response.raise_for_status()
        result: dict[str, Any] | list[Any] = response.json()
        return result

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any] | list[Any]:
        """Perform a POST request and return parsed JSON."""
        assert self._client is not None, "Use GitHubClient as async context manager"
        response = await self._client.post(path, **kwargs)
        self._check_rate_limit(response)
        response.raise_for_status()
        result: dict[str, Any] | list[Any] = response.json()
        return result

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any] | list[Any]:
        """Perform a PUT request and return parsed JSON."""
        assert self._client is not None, "Use GitHubClient as async context manager"
        response = await self._client.put(path, **kwargs)
        self._check_rate_limit(response)
        response.raise_for_status()
        result: dict[str, Any] | list[Any] = response.json()
        return result

    async def get_branch_sha(self, branch: str) -> str | None:
        """Get the latest commit SHA of a branch."""
        owner = self._owner
        repo = self._repo
        if not (owner and repo):
            return None
        try:
            data = await self.get(f"/repos/{owner}/{repo}/branches/{branch}")
            if isinstance(data, dict):
                commit = data.get("commit")
                if isinstance(commit, dict):
                    sha = commit.get("sha")
                    if isinstance(sha, str):
                        return sha
        except Exception:
            return None
        return None

    async def create_branch(self, new_branch: str, base_sha: str) -> dict[str, Any]:
        """Create a new git reference / branch pointing to base_sha."""
        owner = self._owner
        repo = self._repo
        assert owner and repo, "owner and repo must be set to create branch"
        payload = {
            "ref": f"refs/heads/{new_branch}",
            "sha": base_sha,
        }
        res = await self.post(f"/repos/{owner}/{repo}/git/refs", json=payload)
        assert isinstance(res, dict)
        return res

    async def create_or_update_file(
        self,
        path: str,
        message: str,
        content: str,
        branch: str,
        sha: str | None = None,
    ) -> dict[str, Any]:
        """Commit a file into a specific branch.

        Args:
            path: Relative file path in repository (e.g. 'SECURITY.md').
            message: Git commit message.
            content: Raw text content to commit (will be base64-encoded).
            branch: Target branch name.
            sha: File blob SHA if updating an existing file.
        """
        owner = self._owner
        repo = self._repo
        assert owner and repo, "owner and repo must be set to commit file"
        encoded_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload: dict[str, Any] = {
            "message": message,
            "content": encoded_content,
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha

        res = await self.put(f"/repos/{owner}/{repo}/contents/{path}", json=payload)
        assert isinstance(res, dict)
        return res

    async def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
    ) -> dict[str, Any]:
        """Open a pull request on the repository."""
        owner = self._owner
        repo = self._repo
        assert owner and repo, "owner and repo must be set to create PR"
        payload = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
        }
        res = await self.post(f"/repos/{owner}/{repo}/pulls", json=payload)
        assert isinstance(res, dict)
        return res

    async def get_file_content(self, path: str) -> str | None:
        """Fetch and decode the text content of a single file.

        Returns ``None`` if the file is too large, binary, or not found.
        """
        assert self._client is not None, "Use GitHubClient as async context manager"
        owner = self._owner
        repo = self._repo
        if not (owner and repo):
            return None
        try:
            import base64

            data = await self.get(f"/repos/{owner}/{repo}/contents/{path}")
            if isinstance(data, dict) and data.get("encoding") == "base64":
                raw: str = data.get("content", "")
                return base64.b64decode(raw).decode("utf-8", errors="replace")
        except Exception:
            return None
        return None

    async def list_installation_repositories(self) -> list[dict[str, Any]]:
        """Return all repositories accessible to this installation (auto-paginates)."""
        repos: list[dict[str, Any]] = []
        page = 1
        while True:
            data = await self.get(
                "/installation/repositories",
                params={"per_page": 100, "page": page},
            )
            assert isinstance(data, dict)
            batch: list[dict[str, Any]] = data.get("repositories", [])
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return repos


async def get_app_installations() -> list[dict[str, Any]]:
    """Fetch all installations of this GitHub App using the App JWT."""
    from app.services.github.auth import generate_app_jwt

    app_jwt = generate_app_jwt()
    headers = {**_DEFAULT_HEADERS, "Authorization": f"Bearer {app_jwt}"}
    installations: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(base_url=_GITHUB_API_BASE, timeout=15.0) as client:
        while True:
            response = await client.get(
                "/app/installations",
                headers=headers,
                params={"per_page": 100, "page": page},
            )
            response.raise_for_status()
            batch: list[dict[str, Any]] = response.json()
            installations.extend(batch)
            if len(batch) < 100:
                break
            page += 1

    return installations
