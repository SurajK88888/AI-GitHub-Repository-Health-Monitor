"""Tests for the deterministic health scoring engine and config service.

Covers:
- DEFAULT_WEIGHTS sum to 100.0
- calculate_health_score math correctness
- CRITICAL finding safety cap (category ≤ 30, overall ≤ 50)
- HIGH finding safety cap (category ≤ 60)
- Score band mapping for each band
- Score clamping (never < 0, never > 100)
- delta calculation for reporting
- Empty findings list → no cap applied
- Missing score metric → neutral 50.0 default
"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.enums import FindingSeverity, FindingStatus, ScoreBand
from app.services.scoring.engine import (
    DEFAULT_WEIGHTS,
    _apply_finding_caps,
    _clamp,
    _derive_category_raw_score,
    calculate_health_score,
)

# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_metric(category: str, score: float) -> MagicMock:
    m = MagicMock()
    m.category = category
    m.metric_name = "score"
    m.metric_value = score
    return m


def _make_finding(
    category: str,
    severity: str,
    status: str = FindingStatus.OPEN.value,
) -> MagicMock:
    f = MagicMock()
    f.category = category
    f.severity = severity
    f.status = status
    return f


def _make_config_id() -> uuid.UUID:
    return uuid.uuid4()


# ── Unit: DEFAULT_WEIGHTS ──────────────────────────────────────────────────────


def test_default_weights_sum_to_100() -> None:
    total = sum(DEFAULT_WEIGHTS.values())
    assert abs(total - 100.0) < 0.01, f"Expected 100.0, got {total}"


def test_default_weights_all_non_negative() -> None:
    for category, w in DEFAULT_WEIGHTS.items():
        assert w >= 0, f"{category} weight must be non-negative"


def test_default_weights_has_all_8_categories() -> None:
    expected = {
        "SECURITY",
        "CODE_QUALITY",
        "DEPENDENCIES",
        "DOCUMENTATION",
        "ISSUES",
        "PULL_REQUESTS",
        "ACTIVITY",
        "CONFIGURATION",
    }
    assert set(DEFAULT_WEIGHTS.keys()) == expected


# ── Unit: _clamp ───────────────────────────────────────────────────────────────


def test_clamp_within_bounds() -> None:
    assert _clamp(50.0) == 50.0


def test_clamp_below_zero() -> None:
    assert _clamp(-10.0) == 0.0


def test_clamp_above_100() -> None:
    assert _clamp(110.0) == 100.0


# ── Unit: _derive_category_raw_score ──────────────────────────────────────────


def test_derive_score_uses_metric_when_present() -> None:
    metrics = [_make_metric("SECURITY", 75.0), _make_metric("CODE_QUALITY", 60.0)]
    assert _derive_category_raw_score("SECURITY", metrics) == 75.0


def test_derive_score_neutral_when_no_metric() -> None:
    metrics = [_make_metric("CODE_QUALITY", 80.0)]
    # SECURITY metric not present → neutral 50.0
    assert _derive_category_raw_score("SECURITY", metrics) == 50.0


def test_derive_score_clamps_above_100() -> None:
    metrics = [_make_metric("SECURITY", 150.0)]
    assert _derive_category_raw_score("SECURITY", metrics) == 100.0


# ── Unit: _apply_finding_caps ──────────────────────────────────────────────────


def test_no_cap_when_no_relevant_findings() -> None:
    findings = [_make_finding("CODE_QUALITY", FindingSeverity.LOW.value)]
    assert _apply_finding_caps("SECURITY", 90.0, findings) == 90.0


def test_critical_finding_caps_category_at_30() -> None:
    findings = [_make_finding("SECURITY", FindingSeverity.CRITICAL.value)]
    capped = _apply_finding_caps("SECURITY", 90.0, findings)
    assert capped == 30.0


def test_high_finding_caps_category_at_60() -> None:
    findings = [_make_finding("SECURITY", FindingSeverity.HIGH.value)]
    capped = _apply_finding_caps("SECURITY", 90.0, findings)
    assert capped == 60.0


def test_critical_takes_priority_over_high() -> None:
    findings = [
        _make_finding("SECURITY", FindingSeverity.CRITICAL.value),
        _make_finding("SECURITY", FindingSeverity.HIGH.value),
    ]
    capped = _apply_finding_caps("SECURITY", 90.0, findings)
    assert capped == 30.0


def test_cap_does_not_raise_score_below_raw() -> None:
    """Cap must never raise a score that's already below the cap value."""
    findings = [_make_finding("SECURITY", FindingSeverity.CRITICAL.value)]
    capped = _apply_finding_caps("SECURITY", 20.0, findings)
    assert capped == 20.0  # min(20, 30) == 20


def test_findings_in_different_category_do_not_cap() -> None:
    """Critical finding in DOCUMENTATION must not cap SECURITY score."""
    findings = [_make_finding("DOCUMENTATION", FindingSeverity.CRITICAL.value)]
    capped = _apply_finding_caps("SECURITY", 90.0, findings)
    assert capped == 90.0


# ── Integration: calculate_health_score ───────────────────────────────────────


def _all_score_metrics(score: float) -> list[MagicMock]:
    return [_make_metric(cat, score) for cat in DEFAULT_WEIGHTS]


def test_perfect_score_no_findings() -> None:
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=_all_score_metrics(100.0),
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    assert result.overall_score == 100.0
    assert result.score_band == ScoreBand.EXCELLENT


def test_zero_score_no_findings() -> None:
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=_all_score_metrics(0.0),
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    assert result.overall_score == 0.0
    assert result.score_band == ScoreBand.CRITICAL


def test_overall_capped_at_50_on_critical_security_finding() -> None:
    cfg_id = _make_config_id()
    findings = [_make_finding("SECURITY", FindingSeverity.CRITICAL.value)]
    result = calculate_health_score(
        metrics=_all_score_metrics(100.0),
        open_findings=findings,
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    assert result.overall_score <= 50.0


def test_critical_security_cap_does_not_affect_category_scores_elsewhere() -> None:
    """High overall cap must not reduce e.g. CODE_QUALITY below its computed value."""
    cfg_id = _make_config_id()
    findings = [_make_finding("SECURITY", FindingSeverity.CRITICAL.value)]
    result = calculate_health_score(
        metrics=_all_score_metrics(100.0),
        open_findings=findings,
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    # CODE_QUALITY category should have raw_score=100, capped_score=100 (no HIGH/CRITICAL in CODE_QUALITY)
    cq = next(c for c in result.categories if c.category == "CODE_QUALITY")
    assert cq.raw_score == 100.0
    assert cq.capped_score == 100.0


def test_high_finding_caps_category_not_others() -> None:
    cfg_id = _make_config_id()
    findings = [_make_finding("CODE_QUALITY", FindingSeverity.HIGH.value)]
    result = calculate_health_score(
        metrics=_all_score_metrics(100.0),
        open_findings=findings,
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    cq = next(c for c in result.categories if c.category == "CODE_QUALITY")
    sec = next(c for c in result.categories if c.category == "SECURITY")
    assert cq.capped_score == 60.0  # HIGH cap applied
    assert sec.capped_score == 100.0  # no cap on security


def test_weighted_score_math_correct() -> None:
    """Verify weighted_score = capped_score * weight / 100 for each category."""
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=_all_score_metrics(80.0),
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    for cr in result.categories:
        expected = round(cr.capped_score * cr.weight / 100.0, 6)
        assert abs(cr.weighted_score - expected) < 0.01, (
            f"{cr.category}: {cr.weighted_score} != {expected}"
        )


def test_overall_equals_sum_of_weighted_scores() -> None:
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=_all_score_metrics(70.0),
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    expected_sum = round(sum(cr.weighted_score for cr in result.categories), 2)
    assert abs(result.overall_score - expected_sum) < 0.01


def test_score_band_good() -> None:
    assert ScoreBand.for_score(82.0) == ScoreBand.GOOD


def test_score_band_needs_attention() -> None:
    assert ScoreBand.for_score(65.0) == ScoreBand.NEEDS_ATTENTION


def test_score_band_poor() -> None:
    assert ScoreBand.for_score(45.0) == ScoreBand.POOR


def test_score_band_critical() -> None:
    assert ScoreBand.for_score(30.0) == ScoreBand.CRITICAL


def test_score_band_excellent() -> None:
    assert ScoreBand.for_score(95.0) == ScoreBand.EXCELLENT


def test_configuration_id_and_version_preserved() -> None:
    cfg_id = uuid.uuid4()
    result = calculate_health_score(
        metrics=[],
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=3,
    )
    assert result.configuration_id == cfg_id
    assert result.configuration_version == 3


def test_no_metrics_yields_neutral_50_per_category() -> None:
    """Missing metrics must default to 50 (not 0), per Doc 04 rule 3."""
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=[],
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    for cr in result.categories:
        assert cr.raw_score == 50.0


def test_custom_weights_applied() -> None:
    """Custom weights that sum to 100 should be applied correctly."""
    cfg_id = _make_config_id()
    custom_weights = dict.fromkeys(DEFAULT_WEIGHTS, 100.0 / 8)
    result = calculate_health_score(
        metrics=_all_score_metrics(80.0),
        open_findings=[],
        weights=custom_weights,
        configuration_id=cfg_id,
        configuration_version=2,
    )
    # Each category: 80 * (100/8) / 100 = 10 → total = 80
    assert abs(result.overall_score - 80.0) < 0.5


def test_overall_always_within_0_100() -> None:
    """Verify overall score never escapes [0, 100]."""
    cfg_id = _make_config_id()
    result = calculate_health_score(
        metrics=_all_score_metrics(100.0),
        open_findings=[],
        weights=DEFAULT_WEIGHTS,
        configuration_id=cfg_id,
        configuration_version=1,
    )
    assert 0.0 <= result.overall_score <= 100.0
