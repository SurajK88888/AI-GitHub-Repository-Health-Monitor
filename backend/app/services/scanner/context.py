"""Scan context data structures.

The ScanContext is an in-memory snapshot of a repository's state
captured during a single scan run.  It is passed to every collector
so each analyzer works from the same, consistent data — no extra
GitHub API calls inside collectors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class CommitSummary:
    """Lightweight commit info needed by analyzers."""

    sha: str
    message: str
    committed_at: datetime
    author_login: str | None = None


@dataclass
class IssueSummary:
    """Open issue metadata."""

    number: int
    title: str
    created_at: datetime
    updated_at: datetime
    labels: list[str] = field(default_factory=list)


@dataclass
class PullRequestSummary:
    """Open pull-request metadata."""

    number: int
    title: str
    created_at: datetime
    updated_at: datetime
    draft: bool = False


@dataclass
class ScanContext:
    """Complete repository snapshot passed to every collector.

    All fields sourced via GitHubClient before any analysis begins.
    Missing / unavailable data is represented as ``None`` so collectors
    can distinguish *absent* from *empty*.
    """

    # ── Identity ─────────────────────────────────────────────────────────────
    repository_id: str
    owner: str
    repo: str
    default_branch: str
    private: bool

    # ── Metadata ─────────────────────────────────────────────────────────────
    description: str | None
    topics: list[str]
    stars: int
    open_issues_count: int
    created_at: datetime
    pushed_at: datetime | None

    # ── File-tree (flat list of paths, lowercased for matching) ──────────────
    file_paths: list[str]

    # ── Selected file contents (key = original path, value = raw text) ───────
    file_contents: dict[str, str]

    # ── Activity data ─────────────────────────────────────────────────────────
    recent_commits: list[CommitSummary]   # last 30 days

    # ── Issue & PR data ───────────────────────────────────────────────────────
    open_issues: list[IssueSummary]
    open_pull_requests: list[PullRequestSummary]

    # ── Optional: GitHub security info ───────────────────────────────────────
    has_vulnerability_alerts: bool | None = None   # None = not accessible

    def has_file(self, *names: str) -> bool:
        """Return True if any of *names* exist anywhere in the tree."""
        lowered = [n.lower() for n in names]
        return any(
            any(p.lower().endswith(n) or p.lower().split("/")[-1] == n for n in lowered)
            for p in self.file_paths
        )

    def has_file_in_root(self, *names: str) -> bool:
        """Return True if any of *names* exist at repository root."""
        lowered = {n.lower() for n in names}
        root_files = {p.lower() for p in self.file_paths if "/" not in p}
        return bool(lowered & root_files)

    def matching_paths(self, prefix: str) -> list[str]:
        """Return all paths that start with *prefix* (case-insensitive)."""
        prefix_lower = prefix.lower()
        return [p for p in self.file_paths if p.lower().startswith(prefix_lower)]

    def get_content(self, *names: str) -> str | None:
        """Return content of the first matching file, or None."""
        for name in names:
            for path, content in self.file_contents.items():
                if path.lower().endswith(name.lower()):
                    return content
        return None


@dataclass
class MetricData:
    """A single measurable metric emitted by a collector."""

    category: str
    metric_name: str
    metric_value: float
    metric_unit: str | None = None
    extra: dict[str, Any] | None = None


@dataclass
class FindingData:
    """A single finding emitted by a collector.

    ``fingerprint`` must be deterministic for the same logical problem
    so that repeated scans do not create duplicate rows.
    """

    category: str
    severity: str          # FindingSeverity enum value
    title: str
    description: str
    fingerprint: str       # SHA-256 hex of "category:rule_id:resource"
    evidence: dict[str, Any] | None = None
    detection_source: str = "PROGRAMMATIC"


@dataclass
class CollectorResult:
    """Aggregated output of one collector pass."""

    metrics: list[MetricData] = field(default_factory=list)
    findings: list[FindingData] = field(default_factory=list)
