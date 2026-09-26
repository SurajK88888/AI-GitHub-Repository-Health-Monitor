"""Documentation health collector.

Evaluates the presence and quality of key documentation files:
README, LICENSE, CONTRIBUTING guide, and CODE_OF_CONDUCT.
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

_CAT = "DOCUMENTATION"


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class DocumentationCollector(BaseCollector):
    """Checks for README, LICENSE, CONTRIBUTING and CODE_OF_CONDUCT."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0

        # ── README ────────────────────────────────────────────────────────
        has_readme = ctx.has_file_in_root(
            "readme.md", "readme.rst", "readme.txt", "readme"
        )
        result.metrics.append(
            MetricData(_CAT, "has_readme", 1.0 if has_readme else 0.0, "bool")
        )
        if not has_readme:
            score -= 40.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="HIGH",
                    title="Missing README",
                    description=(
                        "No README file found at repository root. "
                        "A README is essential for any repository."
                    ),
                    fingerprint=_fp("missing_readme"),
                    evidence={"files_checked": ["README.md", "README.rst", "README.txt", "README"]},
                )
            )
        else:
            readme_content = ctx.get_content("readme.md", "readme.rst", "readme.txt", "readme") or ""
            readme_length = len(readme_content)
            result.metrics.append(MetricData(_CAT, "readme_length_chars", float(readme_length), "chars"))
            if readme_length < 100:
                score -= 15.0
                result.findings.append(
                    FindingData(
                        category=_CAT,
                        severity="MEDIUM",
                        title="README is too short",
                        description=(
                            f"README contains only {readme_length} characters. "
                            "Consider adding installation, usage, and project description."
                        ),
                        fingerprint=_fp("short_readme"),
                        evidence={"length": readme_length},
                    )
                )

        # ── LICENSE ───────────────────────────────────────────────────────
        has_license = ctx.has_file_in_root("license", "license.md", "license.txt", "license.rst")
        result.metrics.append(MetricData(_CAT, "has_license", 1.0 if has_license else 0.0, "bool"))
        if not has_license:
            score -= 25.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="HIGH",
                    title="Missing LICENSE file",
                    description=(
                        "No LICENSE file found. Without a license, the repository "
                        "defaults to all rights reserved, limiting adoption."
                    ),
                    fingerprint=_fp("missing_license"),
                )
            )

        # ── CONTRIBUTING ──────────────────────────────────────────────────
        has_contributing = ctx.has_file(
            "contributing.md", "contributing.rst", "contributing"
        ) or ctx.has_file(".github/contributing.md")
        result.metrics.append(
            MetricData(_CAT, "has_contributing", 1.0 if has_contributing else 0.0, "bool")
        )
        if not has_contributing:
            score -= 10.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title="Missing CONTRIBUTING guide",
                    description=(
                        "No CONTRIBUTING file found. A contribution guide helps "
                        "new contributors understand the project's workflow and standards."
                    ),
                    fingerprint=_fp("missing_contributing"),
                )
            )

        # ── CODE_OF_CONDUCT ───────────────────────────────────────────────
        has_coc = ctx.has_file("code_of_conduct.md", "code_of_conduct") or ctx.has_file(
            ".github/code_of_conduct.md"
        )
        result.metrics.append(MetricData(_CAT, "has_code_of_conduct", 1.0 if has_coc else 0.0, "bool"))
        if not has_coc:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="Missing CODE_OF_CONDUCT",
                    description=(
                        "No CODE_OF_CONDUCT file found. Adding one sets clear community standards."
                    ),
                    fingerprint=_fp("missing_code_of_conduct"),
                )
            )

        result.metrics.append(MetricData(_CAT, "documentation_score", max(0.0, score), "score"))
        return result
