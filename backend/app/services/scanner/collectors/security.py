"""Security health collector.

Detects committed secrets/sensitive files, missing security policies,
and Dependabot configuration.
"""

from __future__ import annotations

import hashlib
import re

from app.services.scanner.collectors.base import BaseCollector
from app.services.scanner.context import (
    CollectorResult,
    FindingData,
    MetricData,
    ScanContext,
)

_CAT = "SECURITY"

# Patterns for sensitive filenames that should never be committed
_SENSITIVE_PATTERNS: list[tuple[str, str]] = [
    (r"\.env$", "Environment file (.env)"),
    (r"\.env\.(local|production|staging|development)$", "Environment file"),
    (r"id_rsa$", "Private SSH key (id_rsa)"),
    (r"id_ed25519$", "Private SSH key (id_ed25519)"),
    (r"\.pem$", "PEM certificate/key"),
    (r"\.p12$", "PKCS12 keystore"),
    (r"\.pfx$", "PFX keystore"),
    (r"secrets\.json$", "secrets.json"),
    (r"credentials\.json$", "credentials.json"),
    (r"service[-_]?account\.json$", "Service account key"),
    (r"\.aws/credentials$", "AWS credentials"),
]

_COMPILED = [(re.compile(p, re.IGNORECASE), label) for p, label in _SENSITIVE_PATTERNS]


def _fp(rule_id: str, resource: str = "") -> str:
    return hashlib.sha256(f"{_CAT}:{rule_id}:{resource}".encode()).hexdigest()


class SecurityCollector(BaseCollector):
    """Checks for secrets exposure, security policy, and Dependabot config."""

    @property
    def category(self) -> str:
        return _CAT

    def collect(self, ctx: ScanContext) -> CollectorResult:
        result = CollectorResult()
        score = 100.0
        sensitive_count = 0

        # ── Sensitive file detection ──────────────────────────────────────
        for path in ctx.file_paths:
            filename = path.split("/")[-1].lower()
            for pattern, label in _COMPILED:
                if pattern.search(filename) or pattern.search(path.lower()):
                    sensitive_count += 1
                    score -= 30.0
                    result.findings.append(
                        FindingData(
                            category=_CAT,
                            severity="CRITICAL",
                            title=f"Potentially committed secret: {label}",
                            description=(
                                f"File '{path}' matches pattern for sensitive file '{label}'. "
                                "Committed secrets are a critical security risk. "
                                "Rotate credentials immediately and remove from history."
                            ),
                            fingerprint=_fp("sensitive_file", path),
                            evidence={"file_path": path, "matched_pattern": label},
                        )
                    )
                    break  # only one finding per file

        result.metrics.append(
            MetricData(_CAT, "sensitive_files_found", float(sensitive_count), "count")
        )

        # ── SECURITY.md policy ────────────────────────────────────────────
        has_security_md = ctx.has_file("security.md") or ctx.has_file(".github/security.md")
        result.metrics.append(
            MetricData(_CAT, "has_security_policy", 1.0 if has_security_md else 0.0, "bool")
        )
        if not has_security_md:
            score -= 15.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="MEDIUM",
                    title="Missing SECURITY.md policy",
                    description=(
                        "No SECURITY.md found. A security policy tells researchers "
                        "how to report vulnerabilities responsibly."
                    ),
                    fingerprint=_fp("missing_security_md"),
                )
            )

        # ── Dependabot configuration ──────────────────────────────────────
        has_dependabot = ctx.has_file(".github/dependabot.yml", ".github/dependabot.yaml")
        result.metrics.append(
            MetricData(_CAT, "has_dependabot", 1.0 if has_dependabot else 0.0, "bool")
        )
        if not has_dependabot:
            score -= 10.0
            result.findings.append(
                FindingData(
                    category=_CAT,
                    severity="LOW",
                    title="Dependabot not configured",
                    description=(
                        "No .github/dependabot.yml found. Dependabot automatically "
                        "opens PRs to update vulnerable dependencies."
                    ),
                    fingerprint=_fp("missing_dependabot"),
                )
            )

        # ── Safety cap: critical secret → score ≤ 30 ─────────────────────
        if sensitive_count > 0:
            score = min(score, 30.0)

        result.metrics.append(MetricData(_CAT, "security_score", max(0.0, score), "score"))
        return result
