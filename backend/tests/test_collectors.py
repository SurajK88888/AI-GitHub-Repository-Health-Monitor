"""Unit tests for all 8 scanner collectors.

Uses synthetic ScanContext values — no GitHub API calls.
All tests are deterministic and run without any external services.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.scanner.collectors.activity import ActivityCollector
from app.services.scanner.collectors.code_quality import CodeQualityCollector
from app.services.scanner.collectors.configuration import ConfigurationCollector
from app.services.scanner.collectors.dependencies import DependenciesCollector
from app.services.scanner.collectors.documentation import DocumentationCollector
from app.services.scanner.collectors.issues import IssuesCollector
from app.services.scanner.collectors.pull_requests import PullRequestsCollector
from app.services.scanner.collectors.security import SecurityCollector
from app.services.scanner.context import (
    CommitSummary,
    IssueSummary,
    PullRequestSummary,
    ScanContext,
)


def _ctx(**overrides: object) -> ScanContext:
    """Build a minimal ScanContext with sensible defaults."""
    now = datetime.now(UTC)
    defaults: dict[str, object] = {
        "repository_id": "123",
        "owner": "acme",
        "repo": "demo",
        "default_branch": "main",
        "private": False,
        "description": "A great project",
        "topics": ["python", "ai"],
        "stars": 10,
        "open_issues_count": 0,
        "created_at": now - timedelta(days=365),
        "pushed_at": now - timedelta(days=1),
        "file_paths": [],
        "file_contents": {},
        "recent_commits": [],
        "open_issues": [],
        "open_pull_requests": [],
    }
    defaults.update(overrides)
    return ScanContext(**defaults)  # type: ignore[arg-type]


# ═════════════════════════════════════════════════════════════════════════════
# Documentation collector
# ═════════════════════════════════════════════════════════════════════════════


class TestDocumentationCollector:
    collector = DocumentationCollector()

    def test_all_present_produces_no_critical_findings(self) -> None:
        ctx = _ctx(
            file_paths=["README.md", "LICENSE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md"],
            file_contents={"README.md": "A" * 500},
        )
        result = self.collector.collect(ctx)
        severities = {f.severity for f in result.findings}
        assert "CRITICAL" not in severities
        assert "HIGH" not in severities

    def test_missing_readme_generates_high_finding(self) -> None:
        ctx = _ctx(file_paths=["LICENSE"])
        result = self.collector.collect(ctx)
        titles = [f.title for f in result.findings]
        assert any("README" in t for t in titles)
        assert any(f.severity == "HIGH" for f in result.findings)

    def test_missing_license_generates_high_finding(self) -> None:
        ctx = _ctx(
            file_paths=["README.md"],
            file_contents={"README.md": "Hello world! " * 20},
        )
        result = self.collector.collect(ctx)
        assert any("LICENSE" in f.title for f in result.findings)

    def test_short_readme_produces_medium_finding(self) -> None:
        ctx = _ctx(
            file_paths=["README.md", "LICENSE"],
            file_contents={"README.md": "Short"},
        )
        result = self.collector.collect(ctx)
        assert any("short" in f.title.lower() for f in result.findings)

    def test_fingerprints_are_deterministic(self) -> None:
        ctx = _ctx()
        r1 = self.collector.collect(ctx)
        r2 = self.collector.collect(ctx)
        fps1 = {f.fingerprint for f in r1.findings}
        fps2 = {f.fingerprint for f in r2.findings}
        assert fps1 == fps2

    def test_metrics_include_score(self) -> None:
        ctx = _ctx()
        result = self.collector.collect(ctx)
        names = [m.metric_name for m in result.metrics]
        assert "documentation_score" in names


# ═════════════════════════════════════════════════════════════════════════════
# Security collector
# ═════════════════════════════════════════════════════════════════════════════


class TestSecurityCollector:
    collector = SecurityCollector()

    def test_clean_repo_no_critical_findings(self) -> None:
        ctx = _ctx(
            file_paths=[
                "README.md",
                ".github/dependabot.yml",
                "SECURITY.md",
            ]
        )
        result = self.collector.collect(ctx)
        assert not any(f.severity == "CRITICAL" for f in result.findings)

    def test_env_file_triggers_critical_finding(self) -> None:
        ctx = _ctx(file_paths=["src/.env", "README.md"])
        result = self.collector.collect(ctx)
        assert any(f.severity == "CRITICAL" for f in result.findings)

    def test_pem_file_triggers_critical_finding(self) -> None:
        ctx = _ctx(file_paths=["keys/private.pem"])
        result = self.collector.collect(ctx)
        assert any(f.severity == "CRITICAL" for f in result.findings)

    def test_critical_secret_caps_score_at_30(self) -> None:
        ctx = _ctx(file_paths=["id_rsa", ".github/dependabot.yml", "SECURITY.md"])
        result = self.collector.collect(ctx)
        score_metrics = [m for m in result.metrics if m.metric_name == "security_score"]
        assert score_metrics[0].metric_value <= 30.0

    def test_missing_dependabot_produces_low_finding(self) -> None:
        ctx = _ctx(file_paths=["SECURITY.md"])
        result = self.collector.collect(ctx)
        assert any("Dependabot" in f.title for f in result.findings)

    def test_missing_security_md_produces_medium_finding(self) -> None:
        ctx = _ctx(file_paths=[".github/dependabot.yml"])
        result = self.collector.collect(ctx)
        assert any("SECURITY" in f.title for f in result.findings)


# ═════════════════════════════════════════════════════════════════════════════
# Code Quality collector
# ═════════════════════════════════════════════════════════════════════════════


class TestCodeQualityCollector:
    collector = CodeQualityCollector()

    def test_healthy_repo_no_high_findings(self) -> None:
        ctx = _ctx(
            file_paths=[
                ".github/workflows/ci.yml",
                "tests/test_main.py",
                "pyproject.toml",
            ]
        )
        result = self.collector.collect(ctx)
        assert not any(f.severity == "HIGH" for f in result.findings)

    def test_no_ci_generates_high_finding(self) -> None:
        ctx = _ctx(file_paths=["tests/test_main.py", "pyproject.toml"])
        result = self.collector.collect(ctx)
        assert any("CI" in f.title for f in result.findings)

    def test_no_tests_generates_high_finding(self) -> None:
        ctx = _ctx(file_paths=[".github/workflows/ci.yml", "pyproject.toml"])
        result = self.collector.collect(ctx)
        assert any("test" in f.title.lower() for f in result.findings)

    def test_ci_workflow_count_metric(self) -> None:
        ctx = _ctx(
            file_paths=[
                ".github/workflows/ci.yml",
                ".github/workflows/deploy.yml",
            ]
        )
        result = self.collector.collect(ctx)
        count_metric = next(m for m in result.metrics if m.metric_name == "ci_workflow_count")
        assert count_metric.metric_value == 2.0


# ═════════════════════════════════════════════════════════════════════════════
# Dependencies collector
# ═════════════════════════════════════════════════════════════════════════════


class TestDependenciesCollector:
    collector = DependenciesCollector()

    def test_package_json_with_lockfile_no_medium_findings(self) -> None:
        ctx = _ctx(file_paths=["package.json", "package-lock.json"])
        result = self.collector.collect(ctx)
        assert not any(f.severity == "MEDIUM" for f in result.findings)

    def test_package_json_without_lockfile_medium_finding(self) -> None:
        ctx = _ctx(file_paths=["package.json", "src/index.js"])
        result = self.collector.collect(ctx)
        assert any("lockfile" in f.title.lower() for f in result.findings)

    def test_no_manifests_produces_informational(self) -> None:
        ctx = _ctx(file_paths=["README.md"])
        result = self.collector.collect(ctx)
        assert any(f.severity == "INFORMATIONAL" for f in result.findings)

    def test_manifest_count_metric(self) -> None:
        ctx = _ctx(file_paths=["package.json", "package-lock.json", "go.mod", "go.sum"])
        result = self.collector.collect(ctx)
        count_metric = next(m for m in result.metrics if m.metric_name == "manifest_count")
        assert count_metric.metric_value >= 2.0


# ═════════════════════════════════════════════════════════════════════════════
# Issues collector
# ═════════════════════════════════════════════════════════════════════════════


class TestIssuesCollector:
    collector = IssuesCollector()

    def test_no_issues_clean(self) -> None:
        ctx = _ctx(open_issues=[])
        result = self.collector.collect(ctx)
        assert not any(f.severity in ("HIGH", "MEDIUM") for f in result.findings)

    def test_stale_issues_generate_finding(self) -> None:
        now = datetime.now(UTC)
        stale = IssueSummary(
            number=1,
            title="Old bug",
            created_at=now - timedelta(days=120),
            updated_at=now - timedelta(days=100),
        )
        ctx = _ctx(open_issues=[stale])
        result = self.collector.collect(ctx)
        assert any("stale" in f.title.lower() for f in result.findings)

    def test_many_stale_issues_high_severity(self) -> None:
        now = datetime.now(UTC)
        stale_issues = [
            IssueSummary(
                number=i,
                title=f"Issue {i}",
                created_at=now - timedelta(days=200),
                updated_at=now - timedelta(days=100),
            )
            for i in range(15)
        ]
        ctx = _ctx(open_issues=stale_issues)
        result = self.collector.collect(ctx)
        stale_finding = next(f for f in result.findings if "stale" in f.title.lower())
        assert stale_finding.severity == "HIGH"

    def test_open_count_metric(self) -> None:
        now = datetime.now(UTC)
        issues = [
            IssueSummary(number=i, title=f"Issue {i}", created_at=now, updated_at=now)
            for i in range(5)
        ]
        ctx = _ctx(open_issues=issues)
        result = self.collector.collect(ctx)
        metric = next(m for m in result.metrics if m.metric_name == "open_issue_count")
        assert metric.metric_value == 5.0


# ═════════════════════════════════════════════════════════════════════════════
# Pull Requests collector
# ═════════════════════════════════════════════════════════════════════════════


class TestPullRequestsCollector:
    collector = PullRequestsCollector()

    def test_no_prs_clean(self) -> None:
        ctx = _ctx(open_pull_requests=[])
        result = self.collector.collect(ctx)
        assert not any(f.severity in ("HIGH", "MEDIUM") for f in result.findings)

    def test_stale_prs_generate_finding(self) -> None:
        now = datetime.now(UTC)
        stale_pr = PullRequestSummary(
            number=1,
            title="Old feature",
            created_at=now - timedelta(days=60),
            updated_at=now - timedelta(days=40),
            draft=False,
        )
        ctx = _ctx(open_pull_requests=[stale_pr])
        result = self.collector.collect(ctx)
        assert any("stale" in f.title.lower() for f in result.findings)

    def test_draft_prs_not_counted_as_stale(self) -> None:
        now = datetime.now(UTC)
        draft_pr = PullRequestSummary(
            number=1,
            title="Draft feature",
            created_at=now - timedelta(days=60),
            updated_at=now - timedelta(days=40),
            draft=True,
        )
        ctx = _ctx(open_pull_requests=[draft_pr])
        result = self.collector.collect(ctx)
        # Draft PRs should not produce stale finding
        assert not any("stale" in f.title.lower() for f in result.findings)

    def test_open_pr_count_metric(self) -> None:
        now = datetime.now(UTC)
        prs = [
            PullRequestSummary(number=i, title=f"PR {i}", created_at=now, updated_at=now)
            for i in range(3)
        ]
        ctx = _ctx(open_pull_requests=prs)
        result = self.collector.collect(ctx)
        metric = next(m for m in result.metrics if m.metric_name == "open_pr_count")
        assert metric.metric_value == 3.0


# ═════════════════════════════════════════════════════════════════════════════
# Activity collector
# ═════════════════════════════════════════════════════════════════════════════


class TestActivityCollector:
    collector = ActivityCollector()

    def test_recent_active_repo_no_high_findings(self) -> None:
        now = datetime.now(UTC)
        commits = [
            CommitSummary(sha=f"abc{i}", message="fix", committed_at=now - timedelta(days=i))
            for i in range(10)
        ]
        ctx = _ctx(recent_commits=commits, pushed_at=now - timedelta(days=1))
        result = self.collector.collect(ctx)
        assert not any(f.severity == "HIGH" for f in result.findings)

    def test_inactive_90_days_generates_high_finding(self) -> None:
        now = datetime.now(UTC)
        ctx = _ctx(
            recent_commits=[],
            pushed_at=now - timedelta(days=120),
        )
        result = self.collector.collect(ctx)
        assert any("inactive" in f.title.lower() for f in result.findings)
        assert any(f.severity == "HIGH" for f in result.findings)

    def test_commit_count_metric(self) -> None:
        now = datetime.now(UTC)
        commits = [
            CommitSummary(sha=f"abc{i}", message="feat", committed_at=now - timedelta(days=i))
            for i in range(7)
        ]
        ctx = _ctx(recent_commits=commits, pushed_at=now)
        result = self.collector.collect(ctx)
        metric = next(m for m in result.metrics if m.metric_name == "commit_count_30d")
        assert metric.metric_value == 7.0


# ═════════════════════════════════════════════════════════════════════════════
# Configuration collector
# ═════════════════════════════════════════════════════════════════════════════


class TestConfigurationCollector:
    collector = ConfigurationCollector()

    def test_well_configured_repo_clean(self) -> None:
        ctx = _ctx(
            description="A great ML library",
            topics=["python", "ml", "ai"],
            default_branch="main",
            file_paths=[".github/workflows/ci.yml"],
        )
        result = self.collector.collect(ctx)
        assert not any(f.severity in ("HIGH", "MEDIUM") for f in result.findings)

    def test_no_description_generates_low_finding(self) -> None:
        ctx = _ctx(description=None)
        result = self.collector.collect(ctx)
        assert any("description" in f.title.lower() for f in result.findings)

    def test_no_topics_generates_informational(self) -> None:
        ctx = _ctx(topics=[])
        result = self.collector.collect(ctx)
        assert any("topics" in f.title.lower() for f in result.findings)

    def test_non_standard_branch_informational(self) -> None:
        ctx = _ctx(default_branch="master", file_paths=[".github/dependabot.yml"])
        result = self.collector.collect(ctx)
        assert any("master" in f.title.lower() for f in result.findings)

    def test_topic_count_metric(self) -> None:
        ctx = _ctx(topics=["python", "ai", "health"])
        result = self.collector.collect(ctx)
        metric = next(m for m in result.metrics if m.metric_name == "topic_count")
        assert metric.metric_value == 3.0
