"""Activity health collector.

Analyses commit recency and development frequency over the last 30 days.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from app.services.scanner.collectors.base import BaseCollector
from app.services.scanner.context import (
    CollectorResult,
    FindingData,
    MetricData,
    ScanContext,
)

_CAT = "ACTIVITY"
_INACTIVE_DAYS = 90  # flag if no commit for 90 days
_LOW_ACTIVITY_DAYS = 30  # flag if no commit for 30 days


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class ActivityCollector(BaseCollector):
    """Checks commit recency and development frequency."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0
        now = datetime.now(UTC)

        commit_count_30d = len(ctx.recent_commits)
        result.metrics.append(
            MetricData(_CAT, "commit_count_30d", float(commit_count_30d), "count")
        )

        # Days since last push (from repo metadata — more reliable than commit list)
        days_since_push: float | None = None
        if ctx.pushed_at:
            days_since_push = (now - ctx.pushed_at).total_seconds() / 86400
            result.metrics.append(MetricData(_CAT, "days_since_last_push", days_since_push, "days"))

        # Days since last commit in window
        days_since_commit: float | None = None
        if ctx.recent_commits:
            latest = max(c.committed_at for c in ctx.recent_commits)
            days_since_commit = (now - latest).total_seconds() / 86400
        elif ctx.pushed_at:
            days_since_commit = days_since_push
        if days_since_commit is not None:
            result.metrics.append(
                MetricData(_CAT, "days_since_last_commit", days_since_commit, "days")
            )

        # Unique contributors in window
        contributors = {c.author_login for c in ctx.recent_commits if c.author_login}
        result.metrics.append(
            MetricData(_CAT, "active_contributors_30d", float(len(contributors)), "count")
        )

        # ── Inactive repository ───────────────────────────────────────────
        effective_days = (
            days_since_commit
            if days_since_commit is not None
            else (days_since_push if days_since_push is not None else None)
        )

        if effective_days is not None and effective_days > _INACTIVE_DAYS:
            score -= 40.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="HIGH",
                    title=f"Repository appears inactive ({int(effective_days)} days since last commit)",
                    description=(
                        f"No commits detected in the last {int(effective_days)} days. "
                        "Repositories inactive for 90+ days may be abandoned or unmaintained."
                    ),
                    fingerprint=_fp("inactive_repository"),
                    evidence={"days_since_last_commit": effective_days},
                )
            )
        elif effective_days is not None and effective_days > _LOW_ACTIVITY_DAYS:
            score -= 15.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title=f"Low recent activity ({int(effective_days)} days since last commit)",
                    description=(
                        f"No commits in the last {int(effective_days)} days. "
                        "Consider increasing development velocity or archiving if the project is complete."
                    ),
                    fingerprint=_fp("low_activity"),
                    evidence={"days_since_last_commit": effective_days},
                )
            )

        # ── Very low commit volume ─────────────────────────────────────────
        if (
            commit_count_30d == 0
            and effective_days is not None
            and effective_days <= _INACTIVE_DAYS
        ):
            score -= 10.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="No commits in the last 30 days",
                    description=(
                        "Zero commits were recorded in the last 30 days. "
                        "Regular commits indicate active development."
                    ),
                    fingerprint=_fp("no_commits_30d"),
                )
            )

        result.metrics.append(MetricData(_CAT, "activity_score", max(0.0, score), "score"))
        return result
