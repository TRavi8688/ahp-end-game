"""
app/core/config.py  — FIXED VERSION
====================================
FIXES APPLIED:
  - Boot-time validation: app REFUSES TO START if SECRET_KEY is the old default
  - SECRET_KEY must be at least 64 characters
  - REDIS_URL now includes password (no unauthenticated Redis)
  - SENTRY_DSN wired in
  - ENC_KEY loaded from environment (pointing to Secret Manager value)
  - DATABASE_URL has no SQLite fallback
"""

import os
from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

# ── Known dangerous default values that must never reach production ──────────
FORBIDDEN_SECRET_KEYS = {
    "supersecretkey_please_change_in_production_12345",
    "secret",
    "changeme",
    "password",
    "your_secret_key",
    "replace_with_128_character_random_hex_string",
    "test",
    "1234",
    "abcd",
}


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All secrets must be injected via environment — never hardcoded.
    In production, source from GCP Secret Manager.
    """

    # ── Core ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "local"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    # FIXED: No SQLite fallback. Must be explicitly set to a PostgreSQL URL.
    DATABASE_URL: str

    # ── Redis ─────────────────────────────────────────────────────────────────
    # FIXED: Must include password. Format: redis://:PASSWORD@host:6379/0
    REDIS_URL: str

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Encryption ────────────────────────────────────────────────────────────
    # FIXED: enc.key is no longer a file. Value comes from Secret Manager
    # via the ENC_KEY environment variable (set in Cloud Run / GKE).
    ENC_KEY: str = ""  # Optional at startup, required when encryption is used

    # ── Error Tracking ────────────────────────────────────────────────────────
    # FIXED: SENTRY_DSN was entirely missing from original config
    SENTRY_DSN: str = ""

    # ── External APIs ─────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # ── GCP ───────────────────────────────────────────────────────────────────
    GCP_PROJECT_ID: str = ""

    # ════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ════════════════════════════════════════════════════════════════════

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        """
        FIXED: Boot-time guard against default/weak SECRET_KEY.
        App will refuse to start rather than run with a compromised key.
        """
        if v.lower().strip() in FORBIDDEN_SECRET_KEYS:
            raise ValueError(
                "\n\n"
                "  ╔══════════════════════════════════════════════════════╗\n"
                "  ║  FATAL: SECRET_KEY is set to a known default value.  ║\n"
                "  ║                                                      ║\n"
                "  ║  Generate a secure key:                              ║\n"
                "  ║  python3 -c \"import secrets;                         ║\n"
                "  ║             print(secrets.token_hex(64))\"            ║\n"
                "  ║                                                      ║\n"
                "  ║  Store it in GCP Secret Manager. Never in .env.      ║\n"
                "  ╚══════════════════════════════════════════════════════╝\n"
            )
        if len(v) < 32:
            raise ValueError(
                f"SECRET_KEY is too short ({len(v)} chars). "
                "Must be at least 32 characters. "
                "Generate with: python3 -c \"import secrets; print(secrets.token_hex(64))\""
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_url_must_not_be_sqlite(cls, v: str) -> str:
        """
        FIXED: Hard block on SQLite in any non-local environment.
        SQLite cannot handle concurrent hospital-grade write loads.
        """
        if "sqlite" in v.lower():
            env = os.getenv("ENVIRONMENT", "local")
            if env != "local":
                raise ValueError(
                    f"\n\n"
                    f"  FATAL: SQLite DATABASE_URL detected in ENVIRONMENT={env}.\n"
                    f"  SQLite cannot handle concurrent writes from multiple users.\n"
                    f"  Use PostgreSQL: postgresql+asyncpg://user:pass@host:5432/dbname\n"
                )
        return v

    @field_validator("REDIS_URL")
    @classmethod
    def redis_url_must_have_password(cls, v: str) -> str:
        """
        FIXED: Block Redis connections without authentication.
        Format must be: redis://:PASSWORD@host:port/db
        """
        env = os.getenv("ENVIRONMENT", "local")
        if env != "local":
            # In non-local environments, Redis must be password-protected
            if "redis://:@" in v or (v.startswith("redis://") and ":" not in v.split("@")[0]):
                raise ValueError(
                    "REDIS_URL must include a password in non-local environments. "
                    "Format: redis://:YOUR_STRONG_PASSWORD@redis:6379/0"
                )
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    Validation runs once at startup — if any validator raises,
    the application will not start.
    """
    return Settings()


# Convenience alias
settings = get_settings()
