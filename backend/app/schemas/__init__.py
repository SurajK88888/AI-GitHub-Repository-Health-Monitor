"""Schemas package."""

from app.schemas.ai import AIAnalysisResponse, AIAnalysisResultSchema
from app.schemas.common import APIModel, ErrorResponse, PaginatedResponse
from app.schemas.finding import FindingResponse, PaginatedFindingResponse
from app.schemas.notification import NotificationResponse, PaginatedNotificationResponse
from app.schemas.recommendation import (
    ApproveActionRequest,
    ApproveActionResponse,
    RecommendationResponse,
)
from app.schemas.repository import PaginatedRepositoryResponse, RepositoryResponse
from app.schemas.scan import CreateScanRequest, PaginatedScanResponse, ScanResponse
from app.schemas.scoring import (
    HealthScoreResponse,
    ScoringConfigurationRequest,
    ScoringConfigurationResponse,
)
from app.schemas.webhook import NormalizedGitHubEvent

__all__ = [
    "AIAnalysisResponse",
    "AIAnalysisResultSchema",
    "APIModel",
    "ApproveActionRequest",
    "ApproveActionResponse",
    "CreateScanRequest",
    "ErrorResponse",
    "FindingResponse",
    "HealthScoreResponse",
    "NormalizedGitHubEvent",
    "NotificationResponse",
    "PaginatedFindingResponse",
    "PaginatedNotificationResponse",
    "PaginatedRepositoryResponse",
    "PaginatedResponse",
    "PaginatedScanResponse",
    "RecommendationResponse",
    "RepositoryResponse",
    "ScanResponse",
    "ScoringConfigurationRequest",
    "ScoringConfigurationResponse",
]
