"""Models package — import all models so Alembic can detect them."""

from app.models.ai_action import AIAction
from app.models.ai_analysis import AIAnalysis
from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.finding import Finding
from app.models.github_installation import GitHubInstallation
from app.models.health_score import (
    HealthScore,
    HealthScoreCategory,
    ScoringConfiguration,
    ScoringWeight,
)
from app.models.notification import Notification, NotificationPreference
from app.models.recommendation import Recommendation
from app.models.repository import Repository
from app.models.scan import Scan, ScanMetric
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

__all__ = [
    "AIAction",
    "AIAnalysis",
    "AuditLog",
    "Base",
    "Finding",
    "GitHubInstallation",
    "HealthScore",
    "HealthScoreCategory",
    "Notification",
    "NotificationPreference",
    "Recommendation",
    "Repository",
    "Scan",
    "ScanMetric",
    "ScoringConfiguration",
    "ScoringWeight",
    "User",
    "Workspace",
    "WorkspaceMember",
]
