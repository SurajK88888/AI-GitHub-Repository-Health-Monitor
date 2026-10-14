"""AI analysis orchestrator.

Runs an AI analysis for a completed scan:
1. Load scan, health score, findings.
2. Build a sanitized prompt (no secrets, no raw code).
3. Call Gemini via ``client.call_gemini``.
4. Parse the structured JSON response.
5. Persist ``AIAnalysis`` + ``Recommendation`` records.

Failure invariant (Doc 04 §6 + Doc 01):
- AI failure MUST NOT raise to the caller.
- AI failure MUST NOT affect the deterministic health score.
- On any exception the ``AIAnalysis`` record is set to FAILED and the
  function returns ``None``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import AIAnalysisStatus, AIAnalysisType, FindingStatus, RecommendationStatus
from app.models.ai_analysis import AIAnalysis
from app.models.finding import Finding
from app.models.health_score import HealthScore, HealthScoreCategory
from app.models.recommendation import Recommendation
from app.models.repository import Repository
from app.models.scan import Scan
from app.services.ai.client import AIClientError, GeminiClientError, call_ai
from app.services.ai.prompts import PROMPT_VERSION, SYSTEM_INSTRUCTION, build_analysis_prompt

logger = logging.getLogger(__name__)

_MAX_FINDINGS_IN_PROMPT = 10
_DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
_VALID_PRIORITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
_VALID_CATEGORIES = {
    "SECURITY",
    "CODE_QUALITY",
    "DEPENDENCIES",
    "DOCUMENTATION",
    "ISSUES",
    "PULL_REQUESTS",
    "ACTIVITY",
    "CONFIGURATION",
}


def _sanitize_findings(findings: list[Finding]) -> list[dict[str, Any]]:
    """Convert Finding ORM rows to safe dicts for prompt inclusion.

    Only includes severity, category, title, and description.
    NEVER includes evidence blobs, credentials, or raw code.
    """
    return [
        {
            "severity": f.severity,
            "category": f.category,
            "title": f.title[:120],
            "description": f.description[:200],
        }
        for f in findings[:_MAX_FINDINGS_IN_PROMPT]
    ]


def _parse_recommendations(
    ai_output: dict[str, Any],
    repository_id: uuid.UUID,
    ai_analysis_id: uuid.UUID,
) -> list[Recommendation]:
    """Parse the AI JSON output into ``Recommendation`` ORM objects.

    Invalid or out-of-spec entries are skipped with a warning.
    """
    recs_raw = ai_output.get("recommendations", [])
    recommendations: list[Recommendation] = []

    for item in recs_raw:
        if not isinstance(item, dict):
            continue
        priority = str(item.get("priority", "MEDIUM")).upper()
        if priority not in _VALID_PRIORITIES:
            priority = "MEDIUM"

        title = str(item.get("title", "")).strip()[:512]
        description = str(item.get("description", "")).strip()
        if not title or not description:
            logger.warning("Skipping recommendation with missing title/description")
            continue

        category = str(item.get("category", "")).upper() or "CONFIGURATION"
        raw_action_type = str(item.get("action_type", "")).strip().upper()

        # Determine concrete actionable type if supported by remediation templates
        valid_action_types = {
            "CREATE_SECURITY_POLICY",
            "ENABLE_DEPENDABOT",
            "ADD_CI_WORKFLOW",
            "CREATE_README",
            "CREATE_CONTRIBUTING",
            "MANUAL_REVIEW",
        }
        if raw_action_type in valid_action_types:
            action_type = raw_action_type
        else:
            t_lower = title.lower()
            if "security.md" in t_lower or ("security" in t_lower and "policy" in t_lower):
                action_type = "CREATE_SECURITY_POLICY"
            elif "dependabot" in t_lower:
                action_type = "ENABLE_DEPENDABOT"
            elif (
                "workflow" in t_lower
                or "ci pipeline" in t_lower
                or "continuous integration" in t_lower
            ):
                action_type = "ADD_CI_WORKFLOW"
            elif "readme" in t_lower:
                action_type = "CREATE_README"
            elif "contributing" in t_lower:
                action_type = "CREATE_CONTRIBUTING"
            elif category == "SECURITY":
                action_type = "CREATE_SECURITY_POLICY"
            elif category == "DOCUMENTATION":
                action_type = "CREATE_README"
            else:
                action_type = "MANUAL_REVIEW"

        recommended_action: dict[str, Any] = {
            "action_type": action_type,
            "category": category,
            "ai_generated": True,
        }

        recommendations.append(
            Recommendation(
                id=uuid.uuid4(),
                repository_id=repository_id,
                ai_analysis_id=ai_analysis_id,
                title=title,
                description=description,
                priority=priority,
                recommended_action=recommended_action,
                status=RecommendationStatus.PENDING.value,
            )
        )

    return recommendations


async def run_ai_analysis(
    scan_id: uuid.UUID,
    db: AsyncSession,
) -> AIAnalysis | None:
    """Run AI analysis for a completed scan and persist results.

    This function is fault-tolerant: any failure is caught, the
    ``AIAnalysis`` record is marked FAILED, and ``None`` is returned.
    It NEVER raises.

    Args:
        scan_id: UUID of a completed scan.
        db: Async SQLAlchemy session.

    Returns:
        The created ``AIAnalysis`` or ``None`` on failure.
    """
    # ── Load scan ──────────────────────────────────────────────────────────
    scan: Scan | None = await db.get(Scan, scan_id)
    if scan is None:
        logger.error("run_ai_analysis: Scan %s not found", scan_id)
        return None

    repo: Repository | None = await db.get(Repository, scan.repository_id)
    if repo is None:
        logger.error("run_ai_analysis: Repository %s not found", scan.repository_id)
        return None

    # ── Create PENDING AIAnalysis record ───────────────────────────────────
    settings = get_settings()
    active_provider = getattr(settings, "ai_provider", "google") or "google"
    if active_provider == "groq":
        active_model = (
            getattr(settings, "groq_model", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile"
        )
        provider_name = "groq"
    else:
        active_model = getattr(settings, "ai_model", _DEFAULT_GEMINI_MODEL) or _DEFAULT_GEMINI_MODEL
        provider_name = "google"

    analysis = AIAnalysis(
        id=uuid.uuid4(),
        repository_id=scan.repository_id,
        scan_id=scan_id,
        analysis_type=AIAnalysisType.REPOSITORY_SUMMARY.value,
        provider=provider_name,
        model=active_model,
        prompt_version=PROMPT_VERSION,
        status=AIAnalysisStatus.RUNNING.value,
        created_at=datetime.now(UTC),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    try:
        # ── Load health score for this scan ────────────────────────────────
        hs_result = await db.execute(
            select(HealthScore).where(HealthScore.scan_id == scan_id).limit(1)
        )
        health_score = hs_result.scalars().first()
        if health_score is None:
            raise RuntimeError(f"No HealthScore found for scan {scan_id}")

        # ── Load category breakdown ────────────────────────────────────────
        cat_result = await db.execute(
            select(HealthScoreCategory).where(
                HealthScoreCategory.health_score_id == health_score.id
            )
        )
        categories = [
            {
                "category": c.category,
                "raw_score": c.raw_score,
                "weight": c.weight,
            }
            for c in cat_result.scalars().all()
        ]

        # ── Load previous health score for delta ───────────────────────────
        prev_result = await db.execute(
            select(HealthScore)
            .where(
                HealthScore.repository_id == scan.repository_id,
                HealthScore.id != health_score.id,
            )
            .order_by(HealthScore.created_at.desc())
            .limit(1)
        )
        prev = prev_result.scalars().first()
        previous_score: float | None = prev.overall_score if prev else None

        # ── Load top open findings (CRITICAL + HIGH first) ─────────────────
        findings_result = await db.execute(
            select(Finding)
            .where(
                Finding.repository_id == scan.repository_id,
                Finding.status == FindingStatus.OPEN.value,
            )
            .order_by(Finding.severity)  # alphabetical: CRITICAL < HIGH < LOW < MEDIUM
            .limit(_MAX_FINDINGS_IN_PROMPT)
        )
        findings = list(findings_result.scalars().all())
        sanitized_findings = _sanitize_findings(findings)

        # ── Build prompt ───────────────────────────────────────────────────
        prompt = build_analysis_prompt(
            repo_full_name=repo.full_name,
            overall_score=health_score.overall_score,
            score_band=str(
                __import__("app.enums", fromlist=["ScoreBand"])
                .ScoreBand.for_score(health_score.overall_score)
                .value
            ),
            previous_score=previous_score,
            category_scores=categories,
            top_findings=sanitized_findings,
        )

        # ── Call AI Provider ───────────────────────────────────────────────
        ai_output = await call_ai(
            system_instruction=SYSTEM_INSTRUCTION,
            user_prompt=prompt,
            provider=provider_name,
            model=active_model,
        )

        # ── Parse recommendations ──────────────────────────────────────────
        new_recommendations = _parse_recommendations(ai_output, scan.repository_id, analysis.id)
        for rec in new_recommendations:
            db.add(rec)

        # ── Mark analysis COMPLETED ────────────────────────────────────────
        analysis.status = AIAnalysisStatus.COMPLETED.value
        analysis.completed_at = datetime.now(UTC)
        analysis.result = {
            "summary": str(ai_output.get("summary", ""))[:2000],
            "key_risks": [str(r)[:500] for r in ai_output.get("key_risks", [])[:5]],
            "recommendations": [
                {
                    "title": r.get("title", "")[:512],
                    "priority": r.get("priority", "MEDIUM"),
                    "category": r.get("category", ""),
                }
                for r in ai_output.get("recommendations", [])[:5]
            ],
        }
        await db.commit()
        logger.info(
            "AI analysis completed for scan %s via %s (%s) — %d recommendations",
            scan_id,
            provider_name,
            active_model,
            len(new_recommendations),
        )
        return analysis

    except (GeminiClientError, AIClientError) as exc:
        logger.warning("AI analysis skipped for scan %s: %s", scan_id, exc)
        analysis.status = AIAnalysisStatus.SKIPPED.value
        analysis.completed_at = datetime.now(UTC)
        await db.commit()
        return analysis

    except Exception:
        logger.exception("AI analysis failed for scan %s", scan_id)
        analysis.status = AIAnalysisStatus.FAILED.value
        analysis.completed_at = datetime.now(UTC)
        await db.commit()
        return analysis
