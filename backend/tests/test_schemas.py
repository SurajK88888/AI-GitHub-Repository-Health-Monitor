"""Tests for Pydantic schema validation."""

from __future__ import annotations

import uuid

import pytest

from app.enums import ScanType, ScoreBand
from app.schemas.common import ErrorResponse
from app.schemas.scan import CreateScanRequest
from app.schemas.scoring import ScoringConfigurationRequest


class TestScoringConfigurationRequest:
    def test_valid_weights_sum_to_100(self) -> None:
        req = ScoringConfigurationRequest(
            name="Default",
            weights={
                "SECURITY": 20.0,
                "CODE_QUALITY": 20.0,
                "DEPENDENCIES": 15.0,
                "DOCUMENTATION": 10.0,
                "ISSUES": 10.0,
                "PULL_REQUESTS": 10.0,
                "ACTIVITY": 10.0,
                "CONFIGURATION": 5.0,
            },
        )
        assert abs(sum(req.weights.values()) - 100.0) < 0.01

    def test_weights_not_summing_to_100_raises(self) -> None:
        with pytest.raises(ValueError, match="100"):
            ScoringConfigurationRequest(
                name="Bad",
                weights={"SECURITY": 50.0, "CODE_QUALITY": 30.0},  # sums to 80
            )

    def test_negative_weight_raises(self) -> None:
        with pytest.raises(ValueError):
            ScoringConfigurationRequest(
                name="Negative",
                weights={"SECURITY": 110.0, "CODE_QUALITY": -10.0},  # sums to 100 but negative
            )


class TestCreateScanRequest:
    def test_default_scan_type_is_full(self) -> None:
        req = CreateScanRequest()
        assert req.scan_type == ScanType.FULL

    def test_incremental_scan_type(self) -> None:
        req = CreateScanRequest(scan_type=ScanType.INCREMENTAL)
        assert req.scan_type == ScanType.INCREMENTAL


class TestErrorResponse:
    def test_error_response_structure(self) -> None:
        err = ErrorResponse(code="NOT_FOUND", message="Resource not found.")
        assert err.code == "NOT_FOUND"
        assert err.details is None
        assert err.request_id is None

    def test_error_response_with_request_id(self) -> None:
        rid = uuid.uuid4()
        err = ErrorResponse(code="SERVER_ERROR", message="Something went wrong.", request_id=rid)
        assert err.request_id == rid


class TestScoreBand:
    @pytest.mark.parametrize(
        "score,expected",
        [
            (100.0, ScoreBand.EXCELLENT),
            (90.0, ScoreBand.EXCELLENT),
            (89.9, ScoreBand.GOOD),
            (75.0, ScoreBand.GOOD),
            (74.9, ScoreBand.NEEDS_ATTENTION),
            (60.0, ScoreBand.NEEDS_ATTENTION),
            (59.9, ScoreBand.POOR),
            (40.0, ScoreBand.POOR),
            (39.9, ScoreBand.CRITICAL),
            (0.0, ScoreBand.CRITICAL),
        ],
    )
    def test_score_band_boundaries(self, score: float, expected: ScoreBand) -> None:
        assert ScoreBand.for_score(score) == expected
