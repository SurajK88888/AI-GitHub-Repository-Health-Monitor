"""Issues health collector.

Analyses the repository's open issue backlog including count,
stale issues, and issue templates.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

from app.services.scanner.collectors.base import BaseCollector
from app.services.scanner.context import (
    CollectorResult,
    FindingData,
    MetricData,
    ScanContext,
)

_CAT = "ISSUES"
_STALE_DAYS = 90


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class IssuesCollector(BaseCollector):
    """Evaluates issue backlog health."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0
        now = datetime.now(UTC)
        stale_threshold = now - timedelta(days=_STALE_DAYS)

        open_count = len(ctx.open_issues)
        stale_issues = [i for i in ctx.open_issues if i.updated_at < stale_threshold]
        stale_count = len(stale_issues)
        stale_ratio = (stale_count / open_count * 100.0) if open_count > 0 else 0.0

        result.metrics.append(MetricData(_CAT, "open_issue_count", float(open_count), "count"))
        result.metrics.append(MetricData(_CAT, "stale_issue_count", float(stale_count), "count"))
        result.metrics.append(
            MetricData(_CAT, "stale_issue_ratio", round(stale_ratio, 2), "percent")
        )

        # ── Stale issues ──────────────────────────────────────────────────
        if stale_count > 0:
            severity = "HIGH" if stale_count >= 10 else "MEDIUM" if stale_count >= 3 else "LOW"
            score -= min(30.0, stale_count * 3.0)
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity=severity,
                    title=f"{stale_count} stale issue(s) (no activity for {_STALE_DAYS}+ days)",
                    description=(
                        f"{stale_count} open issue(s) have had no activity for over "
                        f"{_STALE_DAYS} days. Regularly triaging and closing stale issues "
                        "keeps the project healthy and responsive."
                    ),
                    fingerprint=_fp("stale_issues"),
                    evidence={"stale_count": stale_count, "threshold_days": _STALE_DAYS},
                )
            )

        # ── High open count (scale-aware) ─────────────────────────────────
        active_contributors = len({c.author_login for c in ctx.recent_commits if c.author_login})
        backlog_threshold = max(50, active_contributors * 15)

        if open_count >= backlog_threshold:
            if stale_ratio >= 40.0 or stale_count >= 10:
                score -= 20.0
                severity = "MEDIUM"
                title = (
                    f"Large unmaintained open issue backlog "
                    f"({open_count} issues, {round(stale_ratio, 1)}% stale)"
                )
                description = (
                    f"The repository has {open_count} open issues, of which {stale_count} "
                    f"({round(stale_ratio, 1)}%) have had no activity for {_STALE_DAYS}+ days. "
                    "A large stale backlog suggests triage and maintenance bottlenecks."
                )
            else:
                score -= 10.0
                severity = "LOW"
                title = f"Large active open issue backlog ({open_count} issues)"
                description = (
                    f"The repository has {open_count} open issues. While issues are actively "
                    "worked on, a large open backlog can increase triage overhead."
                )

            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity=severity,
                    title=title,
                    description=description,
                    fingerprint=_fp("high_issue_backlog"),
                    evidence={
                        "open_count": open_count,
                        "stale_count": stale_count,
                        "stale_ratio": round(stale_ratio, 2),
                        "backlog_threshold": backlog_threshold,
                        "active_contributors": active_contributors,
                    },
                )
            )

        # ── Issue templates ───────────────────────────────────────────────
        has_issue_template = (
            ctx.has_file(".github/issue_template.md")
            or ctx.has_file(".github/ISSUE_TEMPLATE.md")
            or bool(ctx.matching_paths(".github/ISSUE_TEMPLATE/"))
        )
        result.metrics.append(
            MetricData(_CAT, "has_issue_templates", 1.0 if has_issue_template else 0.0, "bool")
        )
        if not has_issue_template:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="No issue templates found",
                    description=(
                        "No .github/ISSUE_TEMPLATE found. Issue templates guide reporters "
                        "to provide the information needed for faster resolution."
                    ),
                    fingerprint=_fp("no_issue_template"),
                )
            )

        result.metrics.append(MetricData(_CAT, "issues_score", max(0.0, score), "score"))
        return result
