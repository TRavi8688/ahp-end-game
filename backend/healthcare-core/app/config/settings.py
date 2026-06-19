"""
healthcare-core/app/config/settings.py

FIXES:
  - Removed JWT_SECRET_KEY / JWT_ALGORITHM (HS256) — healthcare-core does NOT
    sign tokens. It only VALIDATES them via JWKS from auth-service (RS256).
  - Added AUTH_JWKS_URL — the URL from which to fetch auth-service public keys
  - Added SENTRY_DSN, ENV (were missing, caused AttributeError)
  - Added INTERNAL_SERVICE_SECRET validation in production

PLACE AT: backend/healthcare-core/app/config/settings.py
"""
from __future__ import annotations

import os
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospin Healthcare Core"

    ENV: str = "development"
    ENVIRONMENT: str = "development"
    SENTRY_DSN: Optional[str] = None

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn_healthcare"
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/1"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173,"
        "http://localhost:5174,http://localhost:5175,"
        "https://hospin.in,https://www.hospin.in"
    )

    # ── Auth (RS256 validation only — NO signing happens here) ────────────────
    # URL of auth-service JWKS endpoint.
    # healthcare-core fetches public keys from here to validate incoming JWTs.
    AUTH_JWKS_URL: str = (
        "http://auth-service:8001/api/v1/auth/.well-known/jwks.json"
    )

    # Partner JWT secret (for partner-app specific tokens — HS256)
    PARTNER_JWT_SECRET: str = (
        "partner_local_dev_secret_change_in_production_min_32_chars"
    )

    # Internal service-to-service auth secret
    # MUST be set in production — validated by startup_checks
    INTERNAL_SERVICE_SECRET: Optional[str] = None

    # ── Storage ───────────────────────────────────────────────────────────────
    GCP_STORAGE_BUCKET: str = "hospin-medical-records"

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # ── PHI encryption ────────────────────────────────────────────────────────
    FERNET_KEY: Optional[str] = None

    # ── Pool (can be tuned per deployment via env) ────────────────────────────
    DB_POOL_SIZE: int = 20
    DB_POOL_MAX_OVERFLOW: int = 40

    @field_validator("PARTNER_JWT_SECRET")
    @classmethod
    def validate_partner_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("PARTNER_JWT_SECRET must be at least 32 characters.")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


def get_settings() -> Settings:
    return settings
