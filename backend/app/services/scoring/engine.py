"""Deterministic health scoring engine.

Formula (from Doc 04 §3):
    Overall Score = Σ(Category Score × Category Weight / 100)

Safety Caps (Doc 04 §5):
    - CRITICAL finding active in a category → that category score ≤ 30.0
    - HIGH finding active in a category → that category score ≤ 60.0
    - Any active CRITICAL SECURITY finding → overall score ≤ 50.0

Score Bands (Doc 04 §8):
    90–100  EXCELLENT
    75–89   GOOD
    60–74   NEEDS_ATTENTION
    40–59   POOR
     0–39   CRITICAL

All numerical values are clamped to [0, 100] at every stage.
Scoring logic is pure / side-effect-free so it is trivially testable.
"""

from __future__ import annotations

import dataclasses
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import FindingCategory, FindingSeverity, FindingStatus, ScoreBand
from app.models.finding import Finding
from app.models.health_score import HealthScore, HealthScoreCategory, ScoringConfiguration
from app.models.repository import Repository
from app.models.scan import Scan, ScanMetric
from app.services.scoring.config_service import get_or_create_default_config

logger = logging.getLogger(__name__)

# Default weights (Doc 04 §2) — must total exactly 100.0
DEFAULT_WEIGHTS: dict[str, float] = {
    "SECURITY": 20.0,
    "CODE_QUALITY": 20.0,
    "DEPENDENCIES": 15.0,
    "DOCUMENTATION": 10.0,
    "ISSUES": 10.0,
    "PULL_REQUESTS": 10.0,
    "ACTIVITY": 10.0,
    "CONFIGURATION": 5.0,
}

# Safety cap constants (centralized — Doc 04 §5)
_CAP_CRITICAL_CATEGORY: float = 30.0   # per-category cap when CRITICAL finding present
_CAP_HIGH_CATEGORY: float = 60.0        # per-category cap when HIGH finding present
_CAP_OVERALL_CRITICAL_SECURITY: float = 50.0  # overall cap when CRITICAL SECURITY active

# Category score formula constants
_METRIC_SCORE_KEY = "score"  # collectors emit a metric named "score" per category


@dataclasses.dataclass
class CategoryScoreResult:
    """Intermediate scoring result for a single category."""

    category: str
    raw_score: float          # 0–100 before any cap
    capped_score: float       # 0–100 after safety cap enforcement
    weight: float             # weight (0–100) from config
    weighted_score: float     # capped_score * weight / 100


@dataclasses.dataclass
class ScoringResult:
    """Full scoring result returned by ``calculate_health_score``."""

    overall_score: float
    score_band: ScoreBand
    categories: list[CategoryScoreResult]
    configuration_id: uuid.UUID
    configuration_version: int


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _derive_category_raw_score(
    category: str,
    metrics: list[ScanMetric],
) -> float:
    """Derive a 0–100 raw score for a category from its ScanMetric rows.

    Strategy: collectors emit a ``score`` metric for each category. If the
    collector emits a numeric ``score`` metric, use it directly. Otherwise
    fall back to 50.0 (neutral — missing data must not be treated as failure,
    per Doc 04 rule 3).
    """
    for m in metrics:
        if m.category == category and m.metric_name == _METRIC_SCORE_KEY:
            return _clamp(float(m.metric_value))
    return 50.0  # neutral default when no score metric found


def _apply_finding_caps(
    category: str,
    raw_score: float,
    open_findings: list[Finding],
) -> float:
    """Apply Doc 04 §5 safety caps to a category score based on open findings.

    Args:
        category: The category string (e.g. ``"SECURITY"``).
        raw_score: Uncapped score 0–100.
        open_findings: All open findings for this repository.

    Returns:
        Capped score 0–100.
    """
    cat_findings = [f for f in open_findings if f.category == category]

    has_critical = any(f.severity == FindingSeverity.CRITICAL.value for f in cat_findings)
    has_high = any(f.severity == FindingSeverity.HIGH.value for f in cat_findings)

    if has_critical:
        return min(raw_score, _CAP_CRITICAL_CATEGORY)
    if has_high:
        return min(raw_score, _CAP_HIGH_CATEGORY)
    return raw_score


def calculate_health_score(
    metrics: list[ScanMetric],
    open_findings: list[Finding],
    weights: dict[str, float],
    configuration_id: uuid.UUID,
    configuration_version: int,
) -> ScoringResult:
    """Compute the health score from scan metrics, open findings, and weights.

    This is a pure function with no DB I/O — all data must be pre-fetched by
    the caller. This makes the calculation trivially unit-testable.

    Args:
        metrics: All ``ScanMetric`` rows from the completed scan.
        open_findings: All currently OPEN ``Finding`` rows for the repository.
        weights: Dict of category → weight (must sum to ~100.0).
        configuration_id: UUID of the ``ScoringConfiguration`` used.
        configuration_version: Version number of the configuration.

    Returns:
        A ``ScoringResult`` with overall score, band, and per-category breakdown.
    """
    category_results: list[CategoryScoreResult] = []
    has_critical_security = any(
        f.category == FindingCategory.SECURITY.value
        and f.severity == FindingSeverity.CRITICAL.value
        for f in open_findings
    )

    for category, weight in weights.items():
        raw = _derive_category_raw_score(category, metrics)
        capped = _apply_finding_caps(category, raw, open_findings)
        weighted = _clamp(capped * weight / 100.0)
        category_results.append(
            CategoryScoreResult(
                category=category,
                raw_score=_clamp(raw),
                capped_score=_clamp(capped),
                weight=weight,
                weighted_score=weighted,
            )
        )

    overall = _clamp(sum(cr.weighted_score for cr in category_results))

    # Overall safety cap: critical security finding → overall ≤ 50 (Doc 04 §5)
    if has_critical_security:
        overall = min(overall, _CAP_OVERALL_CRITICAL_SECURITY)

    return ScoringResult(
        overall_score=round(overall, 2),
        score_band=ScoreBand.for_score(overall),
        categories=category_results,
        configuration_id=configuration_id,
        configuration_version=configuration_version,
    )


async def calculate_and_save_health_score(
    scan_id: uuid.UUID,
    db: AsyncSession,
) -> HealthScore | None:
    """Compute and persist a HealthScore for a completed scan.

    Steps:
    1. Load the ``Scan`` and its parent ``Repository``.
    2. Fetch the workspace's active ``ScoringConfiguration`` (create default if missing).
    3. Load ``ScanMetric`` rows and open ``Finding`` rows for the repository.
    4. Run ``calculate_health_score`` (pure function).
    5. Persist ``HealthScore`` + ``HealthScoreCategory`` rows.

    Args:
        scan_id: UUID of a COMPLETED scan.
        db: Async SQLAlchemy session.

    Returns:
        The newly created ``HealthScore`` or ``None`` on failure.
    """
    # ── Load scan ──────────────────────────────────────────────────────────
    scan: Scan | None = await db.get(Scan, scan_id)
    if scan is None:
        logger.error("calculate_and_save_health_score: Scan %s not found", scan_id)
        return None

    # ── Load repository ────────────────────────────────────────────────────
    repo: Repository | None = await db.get(Repository, scan.repository_id)
    if repo is None:
        logger.error(
            "calculate_and_save_health_score: Repository %s not found", scan.repository_id
        )
        return None

    # ── Get scoring configuration ──────────────────────────────────────────
    config: ScoringConfiguration = await get_or_create_default_config(
        repo.workspace_id, db
    )
    weights = {w.category: w.weight for w in config.weights}

    # ── Load metrics for this scan ─────────────────────────────────────────
    metrics_result = await db.execute(
        select(ScanMetric).where(ScanMetric.scan_id == scan_id)
    )
    metrics = list(metrics_result.scalars().all())

    # ── Load open findings for this repository ─────────────────────────────
    findings_result = await db.execute(
        select(Finding).where(
            Finding.repository_id == scan.repository_id,
            Finding.status == FindingStatus.OPEN.value,
        )
    )
    open_findings = list(findings_result.scalars().all())

    # ── Compute previous score for delta ───────────────────────────────────
    prev_result = await db.execute(
        select(HealthScore)
        .where(HealthScore.repository_id == scan.repository_id)
        .order_by(HealthScore.created_at.desc())
        .limit(1)
    )
    previous_score_row = prev_result.scalars().first()
    previous_overall: float | None = (
        previous_score_row.overall_score if previous_score_row else None
    )

    # ── Calculate ──────────────────────────────────────────────────────────
    try:
        result = calculate_health_score(
            metrics=metrics,
            open_findings=open_findings,
            weights=weights,
            configuration_id=config.id,
            configuration_version=config.version,
        )
    except Exception:
        logger.exception(
            "calculate_and_save_health_score: scoring failed for scan %s", scan_id
        )
        return None

    # ── Persist HealthScore ────────────────────────────────────────────────
    health_score = HealthScore(
        id=uuid.uuid4(),
        repository_id=scan.repository_id,
        scan_id=scan_id,
        scoring_configuration_id=config.id,
        overall_score=result.overall_score,
        created_at=datetime.now(UTC),
    )
    db.add(health_score)
    await db.flush()

    for cr in result.categories:
        db.add(
            HealthScoreCategory(
                id=uuid.uuid4(),
                health_score_id=health_score.id,
                category=cr.category,
                raw_score=cr.raw_score,
                weight=cr.weight,
                weighted_score=cr.weighted_score,
                created_at=datetime.now(UTC),
            )
        )

    await db.commit()
    await db.refresh(health_score)

    delta = (
        round(result.overall_score - previous_overall, 2)
        if previous_overall is not None
        else None
    )
    logger.info(
        "Saved HealthScore %.2f (band=%s, delta=%s) for scan %s",
        result.overall_score,
        result.score_band,
        delta,
        scan_id,
    )
    return health_score
