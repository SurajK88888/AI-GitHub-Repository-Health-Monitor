"""ARQ worker entry point.

Run with:  python -m app.workers.main
"""

from __future__ import annotations

from typing import Any

import arq
from arq.connections import RedisSettings

from app.config import get_settings
from app.workers.jobs.action_job import run_approved_action
from app.workers.jobs.scan_job import run_repository_scan
from app.workers.jobs.scheduled_scans import dispatch_scheduled_scans
from app.workers.jobs.webhook_processor import process_webhook

settings = get_settings()


class WorkerSettings:
    """ARQ worker configuration."""

    functions: list[Any] = [
        process_webhook,
        run_repository_scan,
        run_approved_action,
        dispatch_scheduled_scans,
    ]

    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 300  # 5 minutes per job
    keep_result = 3600  # keep results for 1 hour
    retry_jobs = True
    max_tries = 3


if __name__ == "__main__":
    arq.run_worker(WorkerSettings)  # type: ignore[arg-type]
