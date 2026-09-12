"""GitHubInstallation model."""

from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AccountType, InstallationStatus
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GitHubInstallation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Records a GitHub App installation for a workspace.

    Tokens/credentials must NOT be stored in plaintext. If installation
    tokens are cached, they must be encrypted at rest.
    """

    __tablename__ = "github_installations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    github_installation_id: Mapped[int] = mapped_column(
        BigInteger, unique=True, nullable=False, index=True
    )
    github_account_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    github_account_login: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AccountType.USER.value
    )
    permissions_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=InstallationStatus.ACTIVE.value, index=True
    )

    # installed_at is provided by TimestampMixin.created_at

    # ── Relationships ─────────────────────────────────────────────────────────
    workspace: Mapped[Workspace] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Workspace", back_populates="github_installations"
    )
    repositories: Mapped[list[Repository]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Repository", back_populates="github_installation"
    )

    def __repr__(self) -> str:
        return (
            f"<GitHubInstallation id={self.id} "
            f"github_installation_id={self.github_installation_id}>"
        )
