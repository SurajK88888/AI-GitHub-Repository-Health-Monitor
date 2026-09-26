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

        result.metrics.append(MetricData(_CAT, "configuration_score", max(0.0, score), "score"))
        return result
