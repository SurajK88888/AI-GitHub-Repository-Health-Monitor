"""Auto-scan scheduling calculation utility.

Computes next execution timestamps for DAILY, WEEKLY, and MONTHLY schedules.
"""

from __future__ import annotations

import calendar
from datetime import UTC, datetime, time, timedelta

_WEEKDAY_MAP: dict[str, int] = {
    "MON": 0,
    "MONDAY": 0,
    "TUE": 1,
    "TUESDAY": 1,
    "WED": 2,
    "WEDNESDAY": 2,
    "THU": 3,
    "THURSDAY": 3,
    "FRI": 4,
    "FRIDAY": 4,
    "SAT": 5,
    "SATURDAY": 5,
    "SUN": 6,
    "SUNDAY": 6,
}


def compute_next_scheduled_scan(
    frequency: str,
    time_str: str = "02:00",
    day_str: str | None = None,
    from_dt: datetime | None = None,
) -> datetime:
    """Calculate the next scheduled scan UTC datetime.

    Args:
        frequency: "DAILY", "WEEKLY", or "MONTHLY".
        time_str: "HH:MM" in 24-hour UTC format (default "02:00").
        day_str: For WEEKLY: "MON", "TUE", etc.
                 For MONTHLY: "1" to "28" (day of month).
        from_dt: Base datetime (defaults to datetime.now(UTC)).

    Returns:
        A timezone-aware UTC datetime in the future.
    """
    now = from_dt if from_dt is not None else datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

    # Parse hour & minute safely
    try:
        parts = time_str.strip().split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        scheduled_time = time(
            hour=max(0, min(23, hour)), minute=max(0, min(59, minute)), tzinfo=UTC
        )
    except Exception:
        scheduled_time = time(hour=2, minute=0, tzinfo=UTC)

    freq_upper = frequency.strip().upper() if frequency else "DAILY"

    if freq_upper == "DAILY":
        candidate = datetime.combine(now.date(), scheduled_time)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    elif freq_upper == "WEEKLY":
        target_weekday = 0  # Monday default
        if day_str:
            cleaned_day = day_str.strip().upper()
            target_weekday = _WEEKDAY_MAP.get(cleaned_day, 0)

        current_weekday = now.weekday()
        days_ahead = (target_weekday - current_weekday) % 7

        candidate = datetime.combine(now.date() + timedelta(days=days_ahead), scheduled_time)
        if candidate <= now:
            candidate += timedelta(days=7)
        return candidate

    elif freq_upper == "MONTHLY":
        target_day = 1
        if day_str:
            try:
                target_day = max(1, min(28, int(day_str.strip())))
            except Exception:
                target_day = 1

        year = now.year
        month = now.month
        candidate = datetime(
            year, month, target_day, scheduled_time.hour, scheduled_time.minute, tzinfo=UTC
        )
        if candidate <= now:
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1
            max_day = min(target_day, calendar.monthrange(year, month)[1])
            candidate = datetime(
                year, month, max_day, scheduled_time.hour, scheduled_time.minute, tzinfo=UTC
            )
        return candidate

    else:
        candidate = datetime.combine(now.date(), scheduled_time)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate
