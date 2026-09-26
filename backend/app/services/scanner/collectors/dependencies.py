"""Dependencies health collector.

Evaluates the presence of package manifests and lockfiles for
common package managers.
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

_CAT = "DEPENDENCIES"

# (manifest, lockfile or None) pairs
_MANIFEST_LOCKFILE_PAIRS: list[tuple[str, str | None]] = [
    ("package.json", "package-lock.json"),
    ("package.json", "yarn.lock"),
    ("package.json", "pnpm-lock.yaml"),
    ("pyproject.toml", None),            # can use uv.lock or poetry.lock
    ("requirements.txt", None),          # lockfile optional for requirements
    ("Pipfile", "Pipfile.lock"),
    ("Gemfile", "Gemfile.lock"),
    ("go.mod", "go.sum"),
    ("Cargo.toml", "Cargo.lock"),
    ("pom.xml", None),
    ("build.gradle", None),
    ("composer.json", "composer.lock"),
    ("pubspec.yaml", "pubspec.lock"),
]

_LOCKFILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "uv.lock", "poetry.lock", "Pipfile.lock",
    "Gemfile.lock", "go.sum", "Cargo.lock",
    "composer.lock", "pubspec.lock",
}


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class DependenciesCollector(BaseCollector):
    """Checks for package manifests and missing lockfiles."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0

        root_files_lower = {p.lower() for p in ctx.file_paths if "/" not in p}
        all_files_lower = {p.lower() for p in ctx.file_paths}

        manifests_found: list[str] = []
        missing_lockfile: list[str] = []

        for manifest, lockfile in _MANIFEST_LOCKFILE_PAIRS:
            if manifest.lower() not in root_files_lower:
                continue
            manifests_found.append(manifest)

            # Check lockfile if one is expected
            if lockfile:
                # Also look for alternative lockfiles (e.g. yarn.lock / pnpm-lock)
                alternatives = [lf for lf in _LOCKFILES if lf.lower() in all_files_lower]
                has_any_lock = (
                    lockfile.lower() in root_files_lower
                    or bool(alternatives)
                )
                if not has_any_lock and manifest == "package.json":
                    missing_lockfile.append(manifest)
                elif lockfile.lower() not in root_files_lower and manifest != "package.json":
                    missing_lockfile.append(manifest)

        result.metrics.append(
            MetricData(_CAT, "manifest_count", float(len(manifests_found)), "count")
        )
        result.metrics.append(
            MetricData(_CAT, "missing_lockfile_count", float(len(missing_lockfile)), "count")
        )

        if not manifests_found:
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="INFORMATIONAL",
                    title="No recognized dependency manifests found",
                    description=(
                        "No package manifests (package.json, pyproject.toml, go.mod, etc.) "
                        "were detected. If this is a code repository, add a manifest for "
                        "reproducible dependency management."
                    ),
                    fingerprint=_fp("no_manifest"),
                )
            )

        for manifest in missing_lockfile:
            score -= 20.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="MEDIUM",
                    title=f"Missing lockfile for {manifest}",
                    description=(
                        f"'{manifest}' was found but no corresponding lockfile is committed. "
                        "Lockfiles ensure reproducible builds and pin transitive dependency versions."
                    ),
                    fingerprint=_fp("missing_lockfile", manifest),
                    evidence={"manifest": manifest},
                )
            )

        result.metrics.append(MetricData(_CAT, "dependencies_score", max(0.0, score), "score"))
        return result
