"""Pull Requests health collector.

Analyses the open PR backlog including stale PRs and PR templates.
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

_CAT = "PULL_REQUESTS"
_STALE_DAYS = 30


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class PullRequestsCollector(BaseCollector):
    """Evaluates pull-request backlog health and PR templates."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0
        now = datetime.now(UTC)
        stale_threshold = now - timedelta(days=_STALE_DAYS)

        open_count = len(ctx.open_pull_requests)
        non_draft = [pr for pr in ctx.open_pull_requests if not pr.draft]
        stale_prs = [pr for pr in non_draft if pr.updated_at < stale_threshold]
        stale_count = len(stale_prs)

        result.metrics.append(MetricData(_CAT, "open_pr_count", float(open_count), "count"))
        result.metrics.append(MetricData(_CAT, "stale_pr_count", float(stale_count), "count"))
        result.metrics.append(
            MetricData(_CAT, "open_non_draft_pr_count", float(len(non_draft)), "count")
        )

        # ── Stale non-draft PRs ───────────────────────────────────────────
        if stale_count > 0:
            severity = "HIGH" if stale_count >= 5 else "MEDIUM" if stale_count >= 2 else "LOW"
            score -= min(30.0, stale_count * 5.0)
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity=severity,
                    title=f"{stale_count} stale pull request(s) (no activity for {_STALE_DAYS}+ days)",
                    description=(
                        f"{stale_count} non-draft PR(s) have had no activity for over "
                        f"{_STALE_DAYS} days. Stale PRs often indicate review bottlenecks "
                        "and accumulate merge conflicts over time."
                    ),
                    fingerprint=_fp("stale_prs"),
                    evidence={"stale_count": stale_count, "threshold_days": _STALE_DAYS},
                )
            )

        # ── Large PR backlog ──────────────────────────────────────────────
        if open_count >= 20:
            score -= 15.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="MEDIUM",
                    title=f"Large open PR backlog ({open_count} PRs)",
                    description=(
                        f"The repository has {open_count} open pull requests. "
                        "A large backlog may indicate review capacity problems."
                    ),
                    fingerprint=_fp("high_pr_backlog"),
                    evidence={"open_count": open_count},
                )
            )

        # ── PR template ───────────────────────────────────────────────────
        has_pr_template = (
            ctx.has_file(".github/pull_request_template.md")
            or ctx.has_file(".github/PULL_REQUEST_TEMPLATE.md")
            or bool(ctx.matching_paths(".github/PULL_REQUEST_TEMPLATE/"))
        )
        result.metrics.append(
            MetricData(_CAT, "has_pr_template", 1.0 if has_pr_template else 0.0, "bool")
        )
        if not has_pr_template:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="No pull request template found",
                    description=(
                        "No .github/pull_request_template.md found. PR templates ensure "
                        "reviewers receive consistent context for every pull request."
                    ),
                    fingerprint=_fp("no_pr_template"),
                )
            )

        result.metrics.append(MetricData(_CAT, "pull_requests_score", max(0.0, score), "score"))
        return result
