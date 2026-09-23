"""User and workspace bootstrapping service.

Responsible for:
- Creating or retrieving a User row on first GitHub sign-in
- Creating a default Workspace + WorkspaceMember row for new users
- Updating last_login_at on subsequent logins
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import UserStatus, WorkspaceRole
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


def _slugify(text: str) -> str:
    """Convert a string to a URL-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = re.sub(r"^-+|-+$", "", slug)
    return slug[:100] or "workspace"


async def get_or_create_user(
    db: AsyncSession,
    *,
    email: str,
    name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Return existing user or create a new one.

    Args:
        db: Active async DB session.
        email: The user's email address (unique identifier).
        name: Display name from the OAuth provider.
        avatar_url: Profile picture URL.

    Returns:
        The User ORM instance (already flushed, not yet committed).
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            avatar_url=avatar_url,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.flush()
    else:
        # Update profile fields if changed
        if name and user.name != name:
            user.name = name
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url

    return user


async def get_or_create_workspace(
    db: AsyncSession,
    *,
    user: User,
) -> Workspace:
    """Return the user's default workspace or create one.

    Creates:
    - A Workspace with slug derived from the user's email prefix.
    - A WorkspaceMember row with OWNER role.

    Args:
        db: Active async DB session.
        user: The authenticated user (must already be flushed).

    Returns:
        The Workspace ORM instance.
    """
    # Check if user already has a workspace (as owner)
    result = await db.execute(select(Workspace).where(Workspace.owner_user_id == user.id))
    workspace = result.scalar_one_or_none()

    if workspace is None:
        email_prefix = user.email.split("@")[0]
        base_slug = _slugify(email_prefix)

        # Ensure slug uniqueness by appending a short UUID suffix if needed
        slug = base_slug
        slug_exists = await db.execute(select(Workspace).where(Workspace.slug == slug))
        if slug_exists.scalar_one_or_none():
            slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"

        workspace = Workspace(
            id=uuid.uuid4(),
            name=f"{user.name or email_prefix}'s Workspace",
            slug=slug,
            owner_user_id=user.id,
        )
        db.add(workspace)
        await db.flush()

        member = WorkspaceMember(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.OWNER,
        )
        db.add(member)
        await db.flush()

    return workspace


async def record_login(db: AsyncSession, *, user: User) -> None:
    """Update last_login_at for the user.

    Args:
        db: Active async DB session.
        user: The authenticated user ORM instance.
    """
    user.last_login_at = datetime.now(UTC)
