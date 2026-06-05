"""
Hospyn Healthcare Core — FastAPI Application Entry Point

This is the main application file that configures CORS, registers all API
routes, and exposes the health endpoint for Cloud Run.
"""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.config.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hospyn Healthcare Core API",
    description="Healthcare management platform API",
    version="2.0.0",
)


# ─── CORS Configuration ─────────────────────────────────────────────────────
def configure_cors(application: FastAPI) -> None:
    """
    SEC-5 FIX: CORS is configured from an explicit allowlist.

    Uses ALLOWED_ORIGINS env var if set, otherwise falls back to
    settings.ALLOWED_ORIGINS from config/settings.py.
    """
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()

    if not raw_origins:
        # Fall back to settings default
        raw_origins = settings.ALLOWED_ORIGINS

    if not raw_origins:
        logger.warning(
            "ALLOWED_ORIGINS is not set. Using permissive defaults for development."
        )
        raw_origins = "http://localhost:3000,http://localhost:5173"

    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    logger.info("CORS allowed origins: %s", origins)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Cloud Run readiness probes."""
    return {"status": "healthy", "service": "healthcare-core", "version": "2.0.0"}


# ─── Register All API Routes ────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")
