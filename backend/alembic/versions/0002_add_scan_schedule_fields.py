"""Add auto-scan scheduling fields to repositories.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "repositories",
        sa.Column(
            "scan_schedule_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "repositories",
        sa.Column("scan_schedule_frequency", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "repositories",
        sa.Column("scan_schedule_time", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "repositories",
        sa.Column("scan_schedule_day", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "repositories",
        sa.Column("next_scheduled_scan_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_repositories_next_scheduled_scan_at",
        "repositories",
        ["next_scheduled_scan_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_repositories_next_scheduled_scan_at", table_name="repositories")
    op.drop_column("repositories", "next_scheduled_scan_at")
    op.drop_column("repositories", "scan_schedule_day")
    op.drop_column("repositories", "scan_schedule_time")
    op.drop_column("repositories", "scan_schedule_frequency")
    op.drop_column("repositories", "scan_schedule_enabled")
