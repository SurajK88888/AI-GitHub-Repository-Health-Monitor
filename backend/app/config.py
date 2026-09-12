"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = "insecure-default-change-in-production"

    # ── API ──────────────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"  # noqa: S104
    api_port: int = 8000
    api_cors_origins: list[str] = ["http://localhost:3000"]

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://healthmonitor:changeme@localhost:5432/healthmonitor"
    test_database_url: str = (
        "postgresql+asyncpg://healthmonitor:changeme@localhost:5432/healthmonitor_test"
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── GitHub App ───────────────────────────────────────────────────────────
    github_app_id: str = ""
    github_app_private_key: str = ""  # base64-encoded PEM
    github_app_webhook_secret: str = ""
    github_app_client_id: str = ""
    github_app_client_secret: str = ""

    # ── AI Provider ──────────────────────────────────────────────────────────
    ai_provider: Literal["openai", "anthropic", "google"] = "openai"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_ai_api_key: str = ""

    # ── Email / Notifications ────────────────────────────────────────────────
    email_provider: str = "smtp"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@example.com"

    @field_validator("api_cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
