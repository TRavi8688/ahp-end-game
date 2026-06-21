"""
shared/startup_checks.py

Production safety validations.
Run once at service boot (inside the lifespan context) BEFORE
the service starts accepting traffic.

PLACE AT: backend/shared/startup_checks.py

USAGE in every service's main.py lifespan:
    from shared.startup_checks import run_startup_checks

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        run_startup_checks(settings)
        init_redis(settings.REDIS_URL)
        yield
        await close_redis()
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_KNOWN_UNSAFE_SECRETS = [
    "local_dev_secret_key_must_be_at_least_32_characters_long_for_security",
    "supersecretkey_please_change_in_production_12345",
    "partner_local_dev_secret_change_in_production_min_32_chars",
    "super-secret-internal-key-change-in-prod",
]


def run_startup_checks(settings) -> None:
    """
    Run ALL startup checks. Raises ValueError to abort startup on any failure.
    Call this as the FIRST thing inside your lifespan handler.
    """
    _check_jwt_secret(settings)
    _check_internal_service_secret()
    _check_encryption_key()
    _check_database_url(settings)
    _check_redis_url(settings)
    _warn_sentry(settings)
    logger.info("startup_checks_passed", service=getattr(settings, "PROJECT_NAME", "unknown"))


def _check_jwt_secret(settings) -> None:
    env = getattr(settings, "ENVIRONMENT", "development").lower()
    if env != "production":
        return

    # Auth service uses SECRET_KEY; healthcare-core uses JWT_SECRET_KEY.
    # Accept whichever the calling service provides.
    jwt_key = getattr(settings, "JWT_SECRET_KEY", "") or getattr(settings, "SECRET_KEY", "")
    if jwt_key in _KNOWN_UNSAFE_SECRETS:
        raise ValueError(
            "FATAL: JWT/secret key is set to a known default value in production. "
            'Generate: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if len(jwt_key) < 32:
        raise ValueError(
            "FATAL: JWT/secret key is too short. Must be at least 32 characters. "
            "Set JWT_SECRET_KEY or SECRET_KEY in your environment."
        )


def _check_internal_service_secret() -> None:
    env = os.environ.get("ENVIRONMENT", "development").lower()
    if env != "production":
        return

    secret = os.environ.get("INTERNAL_SERVICE_SECRET", "")
    if not secret or secret in _KNOWN_UNSAFE_SECRETS:
        raise ValueError(
            "FATAL: INTERNAL_SERVICE_SECRET is not set or is using a default value "
            "in production. Internal service endpoints are unprotected. "
            'Generate: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )


def _check_encryption_key() -> None:
    env = os.environ.get("ENVIRONMENT", "development").lower()
    enc_key = os.environ.get("ENCRYPTION_KEY", "")

    if env == "production" and not enc_key:
        raise ValueError(
            "FATAL: ENCRYPTION_KEY is not set in production. PHI fields will be unencrypted. "
            'Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    if not enc_key:
        logger.warning("ENCRYPTION_KEY not set — PHI field encryption is DISABLED (dev mode)")


def _check_database_url(settings) -> None:
    db_url = getattr(settings, "DATABASE_URL", "")
    env = getattr(settings, "ENVIRONMENT", "development").lower()

    if env == "production" and "sqlite" in db_url.lower():
        raise ValueError(
            "FATAL: SQLite is not allowed in production. Use PostgreSQL."
        )


def _check_redis_url(settings) -> None:
    redis_url = getattr(settings, "REDIS_URL", "")
    env = getattr(settings, "ENVIRONMENT", "development").lower()

    if env == "production" and redis_url and "@" not in redis_url and "://:@" not in redis_url:
        logger.warning(
            "SECURITY WARNING: REDIS_URL has no password in production. "
            "Set REDIS_URL=redis://:PASSWORD@host:6379/0"
        )


def _warn_sentry(settings) -> None:
    env = getattr(settings, "ENVIRONMENT", "development").lower()
    if env == "production" and not getattr(settings, "SENTRY_DSN", None):
        logger.warning(
            "SENTRY_DSN is not set — errors in production will not be tracked. "
            "Set SENTRY_DSN to your Sentry project DSN."
        )
