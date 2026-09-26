"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, findings, health, installations, repositories, scans, webhooks
from app.config import get_settings

settings = get_settings()


def create_app() -> FastAPI:
    application = FastAPI(
        title="AI GitHub Repository Health Monitor",
        description="Automated health monitoring for GitHub repositories.",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────────────────────────
    _prefix = "/api/v1"
    application.include_router(health.router, tags=["Health"])
    application.include_router(auth.router, prefix=_prefix)
    application.include_router(webhooks.router, prefix=_prefix)
    application.include_router(installations.router, prefix=_prefix)
    application.include_router(repositories.router, prefix=_prefix)
    application.include_router(scans.router, prefix=_prefix)
    application.include_router(findings.router, prefix=_prefix)

    return application


app = create_app()
