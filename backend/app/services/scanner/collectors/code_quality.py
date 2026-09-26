"""Code Quality health collector.

Evaluates presence of CI/CD workflows, automated tests, and
linter/formatter configuration.
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

_CAT = "CODE_QUALITY"

# Linter/formatter configuration files
_LINTER_CONFIGS = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.yml",
    "prettier.config.js",
    "pyproject.toml",  # also covers ruff, black, mypy when present
    ".flake8",
    "setup.cfg",
    ".rubocop.yml",
    "golangci-lint.yml",
    ".golangci.yml",
    "sonar-project.properties",
    ".stylelintrc",
    ".stylelintrc.json",
]

# Test directory and file patterns
_TEST_INDICATORS = [
    "test/",
    "tests/",
    "__tests__/",
    "spec/",
    "specs/",
    "test.js",
    "test.ts",
    "spec.js",
    "spec.ts",
    ".test.js",
    ".test.ts",
    ".spec.js",
    ".spec.ts",
    "test_",
    "_test.go",
    "_test.py",
    "conftest.py",
    "jest.config.js",
    "jest.config.ts",
    "vitest.config.ts",
    "pytest.ini",
]


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class CodeQualityCollector(BaseCollector):
    """Evaluates CI workflows, automated tests, and lint configs."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0

        # ── CI/CD workflows ───────────────────────────────────────────────
        ci_workflows = ctx.matching_paths(".github/workflows")
        has_ci = len(ci_workflows) > 0
        result.metrics.append(
            MetricData(_CAT, "ci_workflow_count", float(len(ci_workflows)), "count")
        )
        result.metrics.append(MetricData(_CAT, "has_ci", 1.0 if has_ci else 0.0, "bool"))

        if not has_ci:
            score -= 30.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="HIGH",
                    title="No CI/CD workflows configured",
                    description=(
                        "No GitHub Actions workflows found in .github/workflows/. "
                        "Automated CI prevents regressions and enforces quality standards."
                    ),
                    fingerprint=_fp("missing_ci"),
                )
            )

        # ── Test files/directories ────────────────────────────────────────
        has_tests = False
        for path_lower in [p.lower() for p in ctx.file_paths]:
            for indicator in _TEST_INDICATORS:
                if indicator in path_lower:
                    has_tests = True
                    break
            if has_tests:
                break

        result.metrics.append(MetricData(_CAT, "has_tests", 1.0 if has_tests else 0.0, "bool"))
        if not has_tests:
            score -= 30.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="HIGH",
                    title="No automated tests detected",
                    description=(
                        "No test files or test directories were found. "
                        "Automated tests are essential for maintaining code quality."
                    ),
                    fingerprint=_fp("no_tests"),
                )
            )

        # ── Linter/formatter configuration ────────────────────────────────
        has_linter = False
        for config in _LINTER_CONFIGS:
            if ctx.has_file_in_root(config) or ctx.has_file(config):
                has_linter = True
                break

        result.metrics.append(
            MetricData(_CAT, "has_linter_config", 1.0 if has_linter else 0.0, "bool")
        )
        if not has_linter:
            score -= 15.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title="No linter or formatter configuration found",
                    description=(
                        "No linter or code-formatter configuration detected. "
                        "Consistent code style reduces review friction."
                    ),
                    fingerprint=_fp("no_linter_config"),
                )
            )

        result.metrics.append(MetricData(_CAT, "code_quality_score", max(0.0, score), "score"))
        return result
