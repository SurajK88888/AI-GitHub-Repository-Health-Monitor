"""Base class for all metric and finding collectors."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.enums import FindingCategory
from app.services.scanner.context import CollectorResult, ScanContext


class BaseCollector(ABC):
    """Abstract base class every collector must implement.

    Each collector is responsible for one health category.
    It receives the shared ``ScanContext`` and produces ``CollectorResult``
    containing metrics and findings — no I/O allowed inside ``collect()``.
    """

    @property
    @abstractmethod
    def category(self) -> str:
        """The ``FindingCategory`` enum *value* this collector handles."""

    @abstractmethod
    def collect(self, ctx: ScanContext) -> CollectorResult:
        """Analyse the scan context and return metrics + findings.

        Implementations must be:
        - **Deterministic** for the same input
        - **Pure** (no side effects, no I/O)
        - Resilient (never raise; log warnings and return partial results)
        """

    # ── Convenience helpers ───────────────────────────────────────────────

    @staticmethod
    def _category_value(cat: FindingCategory) -> str:
        return cat.value

    ALL_CATEGORIES: list[str] = [c.value for c in FindingCategory]
