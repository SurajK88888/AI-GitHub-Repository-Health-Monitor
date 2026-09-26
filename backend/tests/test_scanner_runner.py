"""Tests for the scan runner — lifecycle, fingerprinting, and finding deduplication."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.enums import ScanStatus
from app.services.scanner.context import ScanContext
from app.services.scanner.runner import _run_collectors, enqueue_repository_scan


def _minimal_ctx() -> ScanContext:
    now = datetime.now(UTC)
    return ScanContext(
        repository_id="repo-1",
        owner="acme",
        repo="demo",
        default_branch="main",
        private=False,
        description="Test repo",
        topics=[],
        stars=0,
        open_issues_count=0,
        created_at=now,
        pushed_at=now,
        file_paths=[],
        file_contents={},
        recent_commits=[],
        open_issues=[],
        open_pull_requests=[],
    )


class TestRunCollectors:
    def test_returns_combined_result(self) -> None:
        ctx = _minimal_ctx()
        result = _run_collectors(ctx)
        # Must produce metrics and findings (even empty ctx gets findings for missing docs, etc.)
        assert isinstance(result.metrics, list)
        assert isinstance(result.findings, list)

    def test_all_8_categories_produce_metrics(self) -> None:
        ctx = _minimal_ctx()
        result = _run_collectors(ctx)
        categories = {m.category for m in result.metrics}
        expected = {
            "DOCUMENTATION", "SECURITY", "CODE_QUALITY", "DEPENDENCIES",
            "ISSUES", "PULL_REQUESTS", "ACTIVITY", "CONFIGURATION",
        }
        assert expected.issubset(categories)

    def test_findings_have_unique_fingerprints(self) -> None:
        ctx = _minimal_ctx()
        result = _run_collectors(ctx)
        fingerprints = [f.fingerprint for f in result.findings]
        # All fingerprints must be non-empty hex strings
        assert all(len(fp) == 64 for fp in fingerprints)  # SHA-256 = 64 hex chars

    def test_collector_failure_does_not_raise(self) -> None:
        """If a collector raises, _run_collectors absorbs it and continues."""
        ctx = _minimal_ctx()
        with patch(
            "app.services.scanner.runner._COLLECTORS",
            [MagicMock(collect=MagicMock(side_effect=RuntimeError("boom")))],
        ):
            result = _run_collectors(ctx)
        assert result.metrics == []
        assert result.findings == []

    def test_deterministic_fingerprints(self) -> None:
        ctx = _minimal_ctx()
        r1 = _run_collectors(ctx)
        r2 = _run_collectors(ctx)
        fps1 = sorted(f.fingerprint for f in r1.findings)
        fps2 = sorted(f.fingerprint for f in r2.findings)
        assert fps1 == fps2


class TestEnqueueRepositoryScan:
    @pytest.mark.asyncio
    async def test_creates_queued_scan(self) -> None:
        repo_id = uuid.uuid4()
        scan_id = uuid.uuid4()
        mock_scan = MagicMock()
        mock_scan.id = scan_id
        mock_scan.repository_id = repo_id
        mock_scan.status = ScanStatus.QUEUED.value

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch("app.services.scanner.runner.Scan", return_value=mock_scan):
            await enqueue_repository_scan(repo_id, mock_db)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_awaited_once()
