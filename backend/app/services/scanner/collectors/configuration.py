"""Configuration health collector.

Evaluates repository metadata quality: description, topics,
CI/CD presence, and default branch naming.
"""

from __future__ import annotations

import hashlib

from app.services.scanner.collectors.base import BaseCollector
from app.services.scanner.context import (
    CollectorResult,
    FindingData,
    MetricData,
    ScanContext,
)

_CAT = "CONFIGURATION"


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class ConfigurationCollector(BaseCollector):
    """Checks repository description, topics, and default branch settings."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0

        # ── Description ───────────────────────────────────────────────────
        has_description = bool(ctx.description and ctx.description.strip())
        result.metrics.append(
            MetricData(_CAT, "has_description", 1.0 if has_description else 0.0, "bool")
        )
        if not has_description:
            score -= 15.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title="Repository has no description",
                    description=(
                        "The repository description is empty. "
                        "A clear description helps users quickly understand the project's purpose."
                    ),
                    fingerprint=_fp("no_description"),
                )
            )

        # ── Topics ────────────────────────────────────────────────────────
        topic_count = len(ctx.topics)
        result.metrics.append(MetricData(_CAT, "topic_count", float(topic_count), "count"))
        if topic_count == 0:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="No repository topics set",
                    description=(
                        "No topics are configured. Topics improve discoverability on GitHub."
                    ),
                    fingerprint=_fp("no_topics"),
                )
            )

        # ── Default branch naming ─────────────────────────────────────────
        modern_branches = {"main", "trunk", "develop"}
        if ctx.default_branch not in modern_branches:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title=f"Non-standard default branch name: '{ctx.default_branch}'",
                    description=(
                        f"The default branch is '{ctx.default_branch}'. "
                        "Modern repositories typically use 'main' or 'trunk'."
                    ),
                    fingerprint=_fp("branch_naming", ctx.default_branch),
                    evidence={"default_branch": ctx.default_branch},
                )
            )

        # ── Dependabot or CI as config health signal ───────────────────────
        has_github_config = bool(ctx.matching_paths(".github/"))
        result.metrics.append(
            MetricData(_CAT, "has_github_config_dir", 1.0 if has_github_config else 0.0, "bool")
        )
        if not has_github_config:
            score -= 10.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title="No .github/ configuration directory",
                    description=(
                        "No .github/ directory found. GitHub configuration "
                        "(workflows, issue templates, PR templates, Dependabot) lives here."
                    ),
                    fingerprint=_fp("no_github_dir"),
                )
            )

        # ── Branch protection & review rules ──────────────────────────────
        has_branch_protection = ctx.branch_protection is not None and bool(ctx.branch_protection)
        result.metrics.append(
            MetricData(_CAT, "has_branch_protection", 1.0 if has_branch_protection else 0.0, "bool")
        )

        requires_pr_reviews = False
        required_reviewers = 0.0
        enforces_status_checks = False

        if has_branch_protection and ctx.branch_protection:
            pr_reviews = ctx.branch_protection.get("required_pull_request_reviews")
            if isinstance(pr_reviews, dict):
                required_reviewers = float(pr_reviews.get("required_approving_review_count", 1))
                requires_pr_reviews = required_reviewers > 0

            status_checks = ctx.branch_protection.get("required_status_checks")
            if isinstance(status_checks, dict):
                enforces_status_checks = bool(
                    status_checks.get("contexts")
                    or status_checks.get("checks")
                    or status_checks.get("strict")
                )

            # If branch is protected but no PR reviews are required before merging
            if not requires_pr_reviews:
                score -= 5.0
                result.findings.append(
                    FindingData(
                        category=_CAT,
                        severity="LOW",
                        title=f"Branch protection on '{ctx.default_branch}' does not enforce PR reviews",
                        description=(
                            f"Branch protection is enabled on '{ctx.default_branch}', but code reviews "
                            "are not required before merging. Enforcing at least 1 peer approval protects "
                            "against accidental regressions."
                        ),
                        fingerprint=_fp("no_pr_reviews_enforced", ctx.default_branch),
                        evidence={"default_branch": ctx.default_branch},
                    )
                )

            # If status checks are not enforced
            if not enforces_status_checks:
                result.findings.append(
                    FindingData(
                        category=_CAT,
                        severity="INFORMATIONAL",
                        title=f"Branch protection on '{ctx.default_branch}' does not enforce CI status checks",
                        description=(
                            f"Branch protection is active on '{ctx.default_branch}', but automated CI checks "
                            "are not required to pass before merging."
                        ),
                        fingerprint=_fp("no_status_checks_enforced", ctx.default_branch),
                        evidence={"default_branch": ctx.default_branch},
                    )
                )
        else:
            # Branch protection is not enabled or not configured
            if ctx.has_source_code():
                score -= 10.0
                result.findings.append(
                    FindingData(
                        category=_CAT,
                        severity="LOW",
                        title=f"No branch protection on default branch '{ctx.default_branch}'",
                        description=(
                            f"The default branch '{ctx.default_branch}' has no branch protection rules enabled. "
                            "Direct pushes, force pushes, or unreviewed merges are permitted. "
                            "Enable branch protection with pull request reviews and status checks to protect main."
                        ),
                        fingerprint=_fp("no_branch_protection", ctx.default_branch),
                        evidence={"default_branch": ctx.default_branch},
                    )
                )

        result.metrics.append(
            MetricData(
                _CAT, "requires_pull_request_reviews", 1.0 if requires_pr_reviews else 0.0, "bool"
            )
        )
        result.metrics.append(
            MetricData(_CAT, "required_reviewers_count", required_reviewers, "count")
        )
        result.metrics.append(
            MetricData(
                _CAT, "enforces_status_checks", 1.0 if enforces_status_checks else 0.0, "bool"
            )
        )

        result.metrics.append(MetricData(_CAT, "configuration_score", max(0.0, score), "score"))
        return result
