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

# Content patterns for hardcoded credentials / secrets
_CONTENT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"),
        "Private Key Block",
    ),
    (
        re.compile(r"(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)"),
        "AWS Access Key ID",
    ),
    (
        re.compile(
            r"(?:^|[^a-zA-Z0-9])(gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{82})(?:[^a-zA-Z0-9]|$)"
        ),
        "GitHub Personal Access Token",
    ),
    (
        re.compile(r"(?:^|[^a-zA-Z0-9])(xox[baprs]-[0-9a-zA-Z]{10,48})(?:[^a-zA-Z0-9]|$)"),
        "Slack Token",
    ),
]

_DUMMY_SECRET_INDICATORS = (
    "example",
    "placeholder",
    "your_",
    "xxxx",
    "test",
    "fake",
    "dummy",
    "sample",
)


def _mask_secret(token: str) -> str:
    cleaned = token.strip()
    if len(cleaned) <= 8:
        return "********"
    return f"{cleaned[:4]}...{cleaned[-4:]}"


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
        flagged_files: set[str] = set()

        # ── Sensitive file detection ──────────────────────────────────────
        for path in ctx.file_paths:
            filename = path.split("/")[-1].lower()
            for pattern, label in _COMPILED:
                if pattern.search(filename) or pattern.search(path.lower()):
                    sensitive_count += 1
                    flagged_files.add(path)
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

        # ── Hardcoded secrets in file contents ────────────────────────────
        for path, content in ctx.file_contents.items():
            if path in flagged_files or not content:
                continue
            truncated_content = content[:200_000]
            for pattern, label in _CONTENT_PATTERNS:
                match = pattern.search(truncated_content)
                if not match:
                    continue
                matched_token = match.group(1) if match.groups() else match.group(0)
                matched_lower = matched_token.lower()
                if any(indicator in matched_lower for indicator in _DUMMY_SECRET_INDICATORS):
                    continue

                sensitive_count += 1
                flagged_files.add(path)
                score -= 30.0
                masked_preview = _mask_secret(matched_token)
                result.findings.append(
                    FindingData(
                        category=_CAT,
                        severity="CRITICAL",
                        title=f"Hardcoded secret detected: {label}",
                        description=(
                            f"File '{path}' contains an unmasked {label}. "
                            "Hardcoded credentials in repository files are a critical security risk. "
                            "Immediately revoke and rotate the secret, and scrub it from git history."
                        ),
                        fingerprint=_fp("content_secret", f"{path}:{label}"),
                        evidence={
                            "file_path": path,
                            "matched_pattern": label,
                            "masked_preview": masked_preview,
                        },
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
