"""Shared Python enumerations used across models, schemas, and business logic.

All enum values are stored as strings in PostgreSQL (VARCHAR / TEXT) rather
than native PG enums so that adding new members never requires a schema
migration — only data changes.
"""

from __future__ import annotations

import enum


class AppEnv(enum.StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


# ── Users ────────────────────────────────────────────────────────────────────


class UserStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


# ── Workspaces ───────────────────────────────────────────────────────────────


class WorkspaceRole(enum.StrEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


# ── GitHub Installations ─────────────────────────────────────────────────────


class AccountType(enum.StrEnum):
    USER = "User"
    ORGANIZATION = "Organization"


class InstallationStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REMOVED = "REMOVED"


# ── Scans ────────────────────────────────────────────────────────────────────


class ScanType(enum.StrEnum):
    FULL = "FULL"
    INCREMENTAL = "INCREMENTAL"
    TARGETED = "TARGETED"


class TriggerType(enum.StrEnum):
    MANUAL = "MANUAL"
    WEBHOOK = "WEBHOOK"
    SCHEDULED = "SCHEDULED"
    SYSTEM = "SYSTEM"


class ScanStatus(enum.StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# ── Findings ─────────────────────────────────────────────────────────────────


class FindingCategory(enum.StrEnum):
    SECURITY = "SECURITY"
    CODE_QUALITY = "CODE_QUALITY"
    DEPENDENCIES = "DEPENDENCIES"
    DOCUMENTATION = "DOCUMENTATION"
    ISSUES = "ISSUES"
    PULL_REQUESTS = "PULL_REQUESTS"
    ACTIVITY = "ACTIVITY"
    CONFIGURATION = "CONFIGURATION"


class FindingSeverity(enum.StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATIONAL = "INFORMATIONAL"


class DetectionSource(enum.StrEnum):
    PROGRAMMATIC = "PROGRAMMATIC"
    GITHUB = "GITHUB"
    AI = "AI"
    HYBRID = "HYBRID"


class FindingStatus(enum.StrEnum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    IGNORED = "IGNORED"


# ── AI ───────────────────────────────────────────────────────────────────────


class AIAnalysisType(enum.StrEnum):
    REPOSITORY_SUMMARY = "REPOSITORY_SUMMARY"
    FINDING_EXPLANATION = "FINDING_EXPLANATION"
    RECOMMENDATION = "RECOMMENDATION"
    SCORE_CHANGE_EXPLANATION = "SCORE_CHANGE_EXPLANATION"
    RISK_PRIORITIZATION = "RISK_PRIORITIZATION"


class AIAnalysisStatus(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class RecommendationStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AIActionStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# ── Notifications ─────────────────────────────────────────────────────────────


class NotificationSeverity(enum.StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class NotificationType(enum.StrEnum):
    CRITICAL_FINDING = "CRITICAL_FINDING"
    SCORE_DEGRADATION = "SCORE_DEGRADATION"
    SECURITY_FINDING = "SECURITY_FINDING"
    SCAN_FAILED = "SCAN_FAILED"
    SCAN_COMPLETED = "SCAN_COMPLETED"
    ACTION_COMPLETED = "ACTION_COMPLETED"
    ACTION_FAILED = "ACTION_FAILED"
    MONITORING_FAILURE = "MONITORING_FAILURE"


class NotificationChannel(enum.StrEnum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    SLACK = "SLACK"  # future
    DISCORD = "DISCORD"  # future


# ── Score bands (presentation only — not stored) ─────────────────────────────


class ScoreBand(enum.StrEnum):
    EXCELLENT = "EXCELLENT"  # 90–100
    GOOD = "GOOD"  # 75–89
    NEEDS_ATTENTION = "NEEDS_ATTENTION"  # 60–74
    POOR = "POOR"  # 40–59
    CRITICAL = "CRITICAL"  # 0–39

    @classmethod
    def for_score(cls, score: float) -> ScoreBand:
        if score >= 90:
            return cls.EXCELLENT
        if score >= 75:
            return cls.GOOD
        if score >= 60:
            return cls.NEEDS_ATTENTION
        if score >= 40:
            return cls.POOR
        return cls.CRITICAL
