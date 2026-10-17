"""Tests for auto-scan scheduler utility."""

from __future__ import annotations

from datetime import UTC, datetime

from app.services.scanner.scheduler import compute_next_scheduled_scan


def test_daily_schedule_future_today() -> None:
    # 01:00 UTC, target 02:00 UTC -> should be today at 02:00
    base = datetime(2026, 10, 17, 1, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("DAILY", "02:00", from_dt=base)
    assert next_dt == datetime(2026, 10, 17, 2, 0, 0, tzinfo=UTC)


def test_daily_schedule_past_today() -> None:
    # 03:00 UTC, target 02:00 UTC -> should be tomorrow at 02:00
    base = datetime(2026, 10, 17, 3, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("DAILY", "02:00", from_dt=base)
    assert next_dt == datetime(2026, 10, 18, 2, 0, 0, tzinfo=UTC)


def test_weekly_schedule_same_day_future() -> None:
    # 2026-10-17 is Saturday. Target SAT at 15:00 UTC, base is 10:00 UTC
    base = datetime(2026, 10, 17, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("WEEKLY", "15:00", "SAT", from_dt=base)
    assert next_dt == datetime(2026, 10, 17, 15, 0, 0, tzinfo=UTC)


def test_weekly_schedule_same_day_past() -> None:
    # 2026-10-17 is Saturday. Target SAT at 05:00 UTC, base is 10:00 UTC -> next Saturday (2026-10-24)
    base = datetime(2026, 10, 17, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("WEEKLY", "05:00", "SAT", from_dt=base)
    assert next_dt == datetime(2026, 10, 24, 5, 0, 0, tzinfo=UTC)


def test_weekly_schedule_different_day() -> None:
    # 2026-10-17 is Saturday. Target MON at 09:00 UTC -> 2026-10-19 (Monday)
    base = datetime(2026, 10, 17, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("WEEKLY", "09:00", "MON", from_dt=base)
    assert next_dt == datetime(2026, 10, 19, 9, 0, 0, tzinfo=UTC)


def test_monthly_schedule_future_this_month() -> None:
    # Base: Oct 10, 2026. Target: 15th at 04:00 UTC -> Oct 15, 2026 at 04:00 UTC
    base = datetime(2026, 10, 10, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("MONTHLY", "04:00", "15", from_dt=base)
    assert next_dt == datetime(2026, 10, 15, 4, 0, 0, tzinfo=UTC)


def test_monthly_schedule_past_this_month() -> None:
    # Base: Oct 20, 2026. Target: 15th at 04:00 UTC -> Nov 15, 2026 at 04:00 UTC
    base = datetime(2026, 10, 20, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("MONTHLY", "04:00", "15", from_dt=base)
    assert next_dt == datetime(2026, 11, 15, 4, 0, 0, tzinfo=UTC)


def test_monthly_schedule_year_rollover() -> None:
    # Base: Dec 20, 2026. Target: 5th at 02:00 UTC -> Jan 5, 2027 at 02:00 UTC
    base = datetime(2026, 12, 20, 10, 0, 0, tzinfo=UTC)
    next_dt = compute_next_scheduled_scan("MONTHLY", "02:00", "5", from_dt=base)
    assert next_dt == datetime(2027, 1, 5, 2, 0, 0, tzinfo=UTC)
