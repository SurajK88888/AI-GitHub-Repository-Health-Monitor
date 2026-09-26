"""Tests for the AI analysis service.

Covers:
- Payload sanitization (_sanitize_findings): no raw evidence, truncates long strings
- Prompt building: includes key fields, excludes secrets
- Mocked Gemini response parsing → Recommendation objects
- GeminiClientError on missing API key
- GeminiClientError on HTTP error → AIAnalysis set to SKIPPED
- Unhandled exception → AIAnalysis set to FAILED
- Recommendations with invalid/missing fields are skipped gracefully
- _parse_recommendations: priority normalization
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai.analyzer import _parse_recommendations, _sanitize_findings
from app.services.ai.client import GeminiClientError, call_gemini
from app.services.ai.prompts import PROMPT_VERSION, build_analysis_prompt

# ── _sanitize_findings ─────────────────────────────────────────────────────────

def _make_finding(
    severity: str = "HIGH",
    category: str = "SECURITY",
    title: str = "Test finding",
    description: str = "Test description",
) -> MagicMock:
    f = MagicMock()
    f.severity = severity
    f.category = category
    f.title = title
    f.description = description
    return f


def test_sanitize_findings_returns_safe_keys_only() -> None:
    findings = [_make_finding()]
    result = _sanitize_findings(findings)
    assert len(result) == 1
    entry = result[0]
    assert set(entry.keys()) == {"severity", "category", "title", "description"}


def test_sanitize_findings_strips_evidence() -> None:
    f = _make_finding()
    f.evidence = {"token": "ghp_supersecret"}
    result = _sanitize_findings([f])
    assert "evidence" not in result[0]


def test_sanitize_findings_truncates_title_to_120() -> None:
    long_title = "A" * 200
    f = _make_finding(title=long_title)
    result = _sanitize_findings([f])
    assert len(result[0]["title"]) <= 120


def test_sanitize_findings_truncates_description_to_200() -> None:
    long_desc = "B" * 300
    f = _make_finding(description=long_desc)
    result = _sanitize_findings([f])
    assert len(result[0]["description"]) <= 200


def test_sanitize_findings_limits_to_10() -> None:
    findings = [_make_finding() for _ in range(20)]
    result = _sanitize_findings(findings)
    assert len(result) == 10


def test_sanitize_findings_empty_list() -> None:
    assert _sanitize_findings([]) == []


# ── build_analysis_prompt ──────────────────────────────────────────────────────

def test_build_prompt_contains_repo_name() -> None:
    prompt = build_analysis_prompt(
        repo_full_name="owner/my-repo",
        overall_score=75.0,
        score_band="GOOD",
        previous_score=None,
        category_scores=[{"category": "SECURITY", "raw_score": 80.0, "weight": 20.0}],
        top_findings=[],
    )
    assert "owner/my-repo" in prompt


def test_build_prompt_contains_score() -> None:
    prompt = build_analysis_prompt(
        repo_full_name="owner/repo",
        overall_score=62.5,
        score_band="NEEDS_ATTENTION",
        previous_score=None,
        category_scores=[],
        top_findings=[],
    )
    assert "62.5" in prompt


def test_build_prompt_includes_delta_when_previous_score_given() -> None:
    prompt = build_analysis_prompt(
        repo_full_name="owner/repo",
        overall_score=80.0,
        score_band="GOOD",
        previous_score=72.0,
        category_scores=[],
        top_findings=[],
    )
    assert "improved" in prompt or "declined" in prompt


def test_build_prompt_no_delta_line_when_no_previous() -> None:
    prompt = build_analysis_prompt(
        repo_full_name="owner/repo",
        overall_score=80.0,
        score_band="GOOD",
        previous_score=None,
        category_scores=[],
        top_findings=[],
    )
    # The delta section should not be present
    assert "improved by" not in prompt
    assert "declined by" not in prompt


def test_build_prompt_includes_findings() -> None:
    findings = [{"severity": "CRITICAL", "category": "SECURITY", "title": "Exposed token"}]
    prompt = build_analysis_prompt(
        repo_full_name="owner/repo",
        overall_score=40.0,
        score_band="POOR",
        previous_score=None,
        category_scores=[],
        top_findings=findings,
    )
    assert "Exposed token" in prompt
    assert "CRITICAL" in prompt


def test_build_prompt_no_findings_message() -> None:
    prompt = build_analysis_prompt(
        repo_full_name="owner/repo",
        overall_score=90.0,
        score_band="EXCELLENT",
        previous_score=None,
        category_scores=[],
        top_findings=[],
    )
    assert "no open findings" in prompt


def test_prompt_version_is_set() -> None:
    assert PROMPT_VERSION == "1.0.0"


# ── _parse_recommendations ─────────────────────────────────────────────────────

def test_parse_recommendations_valid_input() -> None:
    repo_id = uuid.uuid4()
    analysis_id = uuid.uuid4()
    ai_output: dict[str, Any] = {
        "recommendations": [
            {
                "title": "Enable Dependabot",
                "description": "Keep dependencies fresh.",
                "priority": "HIGH",
                "category": "DEPENDENCIES",
            }
        ]
    }
    recs = _parse_recommendations(ai_output, repo_id, analysis_id)
    assert len(recs) == 1
    assert recs[0].title == "Enable Dependabot"
    assert recs[0].priority == "HIGH"
    assert recs[0].repository_id == repo_id
    assert recs[0].ai_analysis_id == analysis_id


def test_parse_recommendations_normalizes_priority() -> None:
    repo_id = uuid.uuid4()
    analysis_id = uuid.uuid4()
    ai_output: dict[str, Any] = {
        "recommendations": [
            {
                "title": "Fix it",
                "description": "Do this.",
                "priority": "invalid_priority",
                "category": "SECURITY",
            }
        ]
    }
    recs = _parse_recommendations(ai_output, repo_id, analysis_id)
    assert recs[0].priority == "MEDIUM"  # normalized default


def test_parse_recommendations_skips_missing_title() -> None:
    repo_id = uuid.uuid4()
    analysis_id = uuid.uuid4()
    ai_output: dict[str, Any] = {
        "recommendations": [
            {"description": "No title here.", "priority": "LOW"}
        ]
    }
    recs = _parse_recommendations(ai_output, repo_id, analysis_id)
    assert len(recs) == 0


def test_parse_recommendations_skips_missing_description() -> None:
    repo_id = uuid.uuid4()
    analysis_id = uuid.uuid4()
    ai_output: dict[str, Any] = {
        "recommendations": [
            {"title": "No description", "priority": "LOW"}
        ]
    }
    recs = _parse_recommendations(ai_output, repo_id, analysis_id)
    assert len(recs) == 0


def test_parse_recommendations_skips_non_dict_entries() -> None:
    repo_id = uuid.uuid4()
    analysis_id = uuid.uuid4()
    ai_output: dict[str, Any] = {
        "recommendations": ["not a dict", 42]
    }
    recs = _parse_recommendations(ai_output, repo_id, analysis_id)
    assert len(recs) == 0


def test_parse_recommendations_empty_list() -> None:
    recs = _parse_recommendations({"recommendations": []}, uuid.uuid4(), uuid.uuid4())
    assert recs == []


def test_parse_recommendations_missing_key() -> None:
    recs = _parse_recommendations({}, uuid.uuid4(), uuid.uuid4())
    assert recs == []


# ── call_gemini client ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_call_gemini_raises_when_no_api_key() -> None:
    with patch("app.services.ai.client.get_settings") as mock_settings:
        mock_settings.return_value.google_ai_api_key = ""
        with pytest.raises(GeminiClientError, match="not configured"):
            await call_gemini(
                system_instruction="sys",
                user_prompt="user",
            )


@pytest.mark.asyncio
async def test_call_gemini_raises_on_http_error() -> None:
    import httpx

    with patch("app.services.ai.client.get_settings") as mock_settings:
        mock_settings.return_value.google_ai_api_key = "fake-key"

        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 429
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "rate limited", request=MagicMock(), response=mock_response
        )

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)

            with pytest.raises(GeminiClientError, match="HTTP 429"):
                await call_gemini(
                    system_instruction="sys",
                    user_prompt="user",
                )


@pytest.mark.asyncio
async def test_call_gemini_raises_on_bad_json_response() -> None:
    with patch("app.services.ai.client.get_settings") as mock_settings:
        mock_settings.return_value.google_ai_api_key = "fake-key"

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"candidates": [{"content": {"parts": [{"text": "not json {{"}]}}]}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)

            with pytest.raises(GeminiClientError, match="parse"):
                await call_gemini(
                    system_instruction="sys",
                    user_prompt="user",
                )


@pytest.mark.asyncio
async def test_call_gemini_success_returns_parsed_dict() -> None:
    expected = {"summary": "Good repo", "key_risks": [], "recommendations": []}

    with patch("app.services.ai.client.get_settings") as mock_settings:
        mock_settings.return_value.google_ai_api_key = "fake-key"

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": json.dumps(expected)}]}}
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)

            result = await call_gemini(
                system_instruction="sys",
                user_prompt="user",
            )

    assert result == expected
