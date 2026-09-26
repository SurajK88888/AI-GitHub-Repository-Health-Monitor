"""Scoring configuration service.

Manages workspace-level scoring configurations with version immutability:
- Fetching or creating the default workspace configuration.
- Creating new versioned configurations when weights change.
- Weights in an existing configuration are NEVER overwritten.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_score import ScoringConfiguration, ScoringWeight
from app.schemas.scoring import DEFAULT_WEIGHTS

logger = logging.getLogger(__name__)


async def get_or_create_default_config(
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> ScoringConfiguration:
    """Return the workspace's default scoring configuration, creating it if absent.

    The default configuration uses the weights defined in ``engine.DEFAULT_WEIGHTS``.
    If a default already exists, it is returned unchanged — this function never
    modifies an existing configuration.

    Args:
        workspace_id: The workspace to fetch/create a config for.
        db: Async SQLAlchemy session.

    Returns:
        The workspace's default ``ScoringConfiguration`` (with ``weights`` loaded).
    """
    stmt = (
        select(ScoringConfiguration)
        .where(
            ScoringConfiguration.workspace_id == workspace_id,
            ScoringConfiguration.is_default.is_(True),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing is not None:
        # Eagerly load weights if not already loaded
        await db.refresh(existing, ["weights"])
        return existing

    # Create v1 default config
    config = ScoringConfiguration(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        name="Default",
        is_default=True,
        version=1,
    )
    db.add(config)
    await db.flush()  # get config.id

    for category, weight in DEFAULT_WEIGHTS.items():
        db.add(
            ScoringWeight(
                id=uuid.uuid4(),
                scoring_configuration_id=config.id,
                category=category,
                weight=weight,
            )
        )

    await db.commit()
    await db.refresh(config, ["weights"])
    logger.info("Created default scoring configuration v1 for workspace %s", workspace_id)
    return config


async def create_new_config_version(
    workspace_id: uuid.UUID,
    name: str,
    weights: dict[str, float],
    db: AsyncSession,
) -> ScoringConfiguration:
    """Create a new versioned scoring configuration for a workspace.

    The previous default configuration is de-listed (``is_default=False``) and
    a new version with incremented version number is created.  Historical
    ``HealthScore`` records remain linked to their original configuration —
    this function never modifies or deletes existing versions.

    Args:
        workspace_id: Owning workspace UUID.
        name: Human-readable label for the new configuration.
        weights: Dict mapping category string → weight float (must sum to 100.0).
        db: Async SQLAlchemy session.

    Returns:
        The newly created ``ScoringConfiguration``.
    """
    # Find current default to determine next version
    stmt = (
        select(ScoringConfiguration)
        .where(
            ScoringConfiguration.workspace_id == workspace_id,
            ScoringConfiguration.is_default.is_(True),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    current_default = result.scalars().first()

    next_version = (current_default.version + 1) if current_default else 1

    # Demote current default
    if current_default is not None:
        current_default.is_default = False

    # Create new config
    config = ScoringConfiguration(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        name=name,
        is_default=True,
        version=next_version,
    )
    db.add(config)
    await db.flush()

    for category, weight in weights.items():
        db.add(
            ScoringWeight(
                id=uuid.uuid4(),
                scoring_configuration_id=config.id,
                category=category,
                weight=weight,
            )
        )

    await db.commit()
    await db.refresh(config, ["weights"])
    logger.info(
        "Created scoring configuration v%d '%s' for workspace %s",
        next_version,
        name,
        workspace_id,
    )
    return config
