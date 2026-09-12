"""Unit tests for the health scoring formula.

These tests are purely mathematical — no database or external services required.
The scoring engine implementation will live in app/services/scoring.py (Phase 4).
These tests define the contract the engine must satisfy.
"""

from __future__ import annotations

import pytest


def calculate_overall_score(category_scores: dict[str, float], weights: dict[str, float]) -> float:
    """Reference implementation of the scoring formula from Doc 04.

    Overall Score = Σ(Category Score × Category Weight / 100)
    """
    total = sum(
        score * (weights[category] / 100.0)
        for category, score in category_scores.items()
        if category in weights
    )
    return round(total, 2)


DEFAULT_WEIGHTS = {
    "SECURITY": 20.0,
    "CODE_QUALITY": 20.0,
    "DEPENDENCIES": 15.0,
    "DOCUMENTATION": 10.0,
    "ISSUES": 10.0,
    "PULL_REQUESTS": 10.0,
    "ACTIVITY": 10.0,
    "CONFIGURATION": 5.0,
}


class TestScoringFormula:
    def test_perfect_score_returns_100(self) -> None:
        scores = dict.fromkeys(DEFAULT_WEIGHTS, 100.0)
        result = calculate_overall_score(scores, DEFAULT_WEIGHTS)
        assert result == 100.0

    def test_zero_score_returns_0(self) -> None:
        scores = dict.fromkeys(DEFAULT_WEIGHTS, 0.0)
        result = calculate_overall_score(scores, DEFAULT_WEIGHTS)
        assert result == 0.0

    def test_known_example_from_spec(self) -> None:
        """Doc 04 example: Security=90×20%, CodeQuality=80×20%, Dependencies=70×15%..."""
        scores = {
            "SECURITY": 90.0,
            "CODE_QUALITY": 80.0,
            "DEPENDENCIES": 70.0,
            "DOCUMENTATION": 60.0,
            "ISSUES": 75.0,
            "PULL_REQUESTS": 65.0,
            "ACTIVITY": 85.0,
            "CONFIGURATION": 90.0,
        }
        result = calculate_overall_score(scores, DEFAULT_WEIGHTS)
        # Manual: 18+16+10.5+6+7.5+6.5+8.5+4.5 = 77.5
        assert result == 77.5

    def test_score_always_between_0_and_100(self) -> None:
        for raw in [0.0, 50.0, 100.0]:
            scores = dict.fromkeys(DEFAULT_WEIGHTS, raw)
            result = calculate_overall_score(scores, DEFAULT_WEIGHTS)
            assert 0.0 <= result <= 100.0

    def test_weights_not_summing_to_100_is_detectable(self) -> None:
        bad_weights = {"SECURITY": 50.0, "CODE_QUALITY": 30.0}  # sums to 80
        total = sum(bad_weights.values())
        assert abs(total - 100.0) > 0.01, "Bad weights must be detectable"

    @pytest.mark.parametrize(
        "security_score,expected_security_contribution",
        [
            (100.0, 20.0),
            (50.0, 10.0),
            (0.0, 0.0),
        ],
    )
    def test_security_category_contribution(
        self, security_score: float, expected_security_contribution: float
    ) -> None:
        contribution = security_score * (DEFAULT_WEIGHTS["SECURITY"] / 100.0)
        assert contribution == expected_security_contribution
