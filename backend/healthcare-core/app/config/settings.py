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

from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn Healthcare Core"

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
        "https://hospyn.com,https://www.hospyn.com"
    )

    # ── Auth ──────────────────────────────────────────────────────────────────
    # EXECUTION FIX (critical): auth-service's actual /auth/login route signs
    # tokens with HS256 via app/services/auth_service.py (NOT the RS256 path in
    # app/core/security.py / JWKS). These two fields were previously removed
    # from this Settings class with a comment saying "healthcare-core only
    # validates via JWKS" — but nothing in auth-service's real login flow ever
    # switched to RS256, so every authenticated request to healthcare-core was
    # raising AttributeError on settings.JWT_SECRET_KEY before it could even
    # check the token. Restored here, MUST match auth-service's JWT_SECRET_KEY
    # exactly (same value in both services' env — it's a shared HS256 secret).
    JWT_SECRET_KEY: str = (
        "local_dev_secret_key_must_be_at_least_32_characters_long_for_security"
    )
    JWT_ALGORITHM: str = "HS256"

    # Kept for future migration to RS256/JWKS (app/middleware/rbac.py implements
    # that path already, but auth-service's login route doesn't issue RS256
    # tokens yet, so it isn't wired into the dependency graph — see rbac.py
    # docstring before switching to it).
    AUTH_JWKS_URL: str = (
        "http://auth-service:8001/api/v1/auth/.well-known/jwks.json"
    )

    # EXECUTION: used by onboarding.py to call auth-service's internal
    # create-partner-user / activate-user endpoints (see auth-service/app/api/internal.py).
    AUTH_SERVICE_INTERNAL_URL: str = "http://auth-service:8001/api/v1"

    # Partner JWT secret (for partner-app specific tokens — HS256)
    PARTNER_JWT_SECRET: str = (
        "partner_local_dev_secret_change_in_production_min_32_chars"
    )

    # Internal service-to-service auth secret
    # MUST be set in production — validated by startup_checks
    INTERNAL_SERVICE_SECRET: Optional[str] = None

    # ── Storage ───────────────────────────────────────────────────────────────
    GCP_STORAGE_BUCKET: str = "hospyn-medical-records"

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # ── PHI encryption ────────────────────────────────────────────────────────
    FERNET_KEY: Optional[str] = None

    # ── Pool (can be tuned per deployment via env) ────────────────────────────
    DB_POOL_SIZE: int = 20
    DB_POOL_MAX_OVERFLOW: int = 40

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        v = v.strip()
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if "sslmode=" in v:
            v = v.replace("sslmode=require", "ssl=require").replace("sslmode=disable", "")
        return v

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
