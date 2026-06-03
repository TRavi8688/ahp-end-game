"""
tests/unit/auth/test_config_validation.py
==========================================
Tests that the Settings class correctly REFUSES TO START
when given dangerous/default configuration values.
These tests verify the boot-time security guards work.
"""
import pytest
import os


def make_settings(overrides: dict):
    """Helper: create a Settings instance with given values."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../backend/auth-service"))

    # Clear cached settings if any
    try:
        from app.core.config import get_settings
        get_settings.cache_clear()
    except Exception:
        pass

    # Set environment variables for this test
    env_defaults = {
        "DATABASE_URL": "postgresql+asyncpg://hospyn:pass@localhost:5432/test",
        "REDIS_URL": "redis://localhost:6379/0",
        "SECRET_KEY": "a" * 64,  # Safe default for tests
        "ENVIRONMENT": "local",
    }
    env_defaults.update(overrides)

    from app.core.config import Settings
    return Settings(**env_defaults)


# ── SECRET_KEY validation tests ───────────────────────────────────────────────

def test_default_secret_key_is_rejected():
    """The old default key must be rejected at startup."""
    from pydantic import ValidationError
    with pytest.raises((ValidationError, ValueError)):
        make_settings({
            "SECRET_KEY": "supersecretkey_please_change_in_production_12345"
        })


def test_short_secret_key_is_rejected():
    """Secret keys shorter than 32 characters must be rejected."""
    from pydantic import ValidationError
    with pytest.raises((ValidationError, ValueError)):
        make_settings({"SECRET_KEY": "tooshort"})


def test_strong_secret_key_is_accepted():
    """A properly generated 64+ character key must be accepted."""
    import secrets
    strong_key = secrets.token_hex(64)
    settings = make_settings({"SECRET_KEY": strong_key})
    assert settings.SECRET_KEY == strong_key


def test_known_weak_keys_rejected():
    """All known weak keys must be rejected."""
    from pydantic import ValidationError
    weak_keys = ["secret", "changeme", "password", "1234"]
    for key in weak_keys:
        with pytest.raises((ValidationError, ValueError)):
            make_settings({"SECRET_KEY": key})


# ── DATABASE_URL validation tests ─────────────────────────────────────────────

def test_sqlite_rejected_in_production():
    """SQLite DATABASE_URL must be rejected in production environment."""
    from pydantic import ValidationError
    with pytest.raises((ValidationError, ValueError)):
        make_settings({
            "DATABASE_URL": "sqlite+aiosqlite:///app/hospyn.db",
            "ENVIRONMENT": "production",
        })


def test_sqlite_allowed_in_local():
    """SQLite is allowed in local development environment."""
    settings = make_settings({
        "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
        "ENVIRONMENT": "local",
    })
    assert "sqlite" in settings.DATABASE_URL


def test_postgresql_url_accepted():
    """Valid PostgreSQL URL must be accepted."""
    pg_url = "postgresql+asyncpg://hospyn:password@localhost:5432/hospyn_test"
    settings = make_settings({"DATABASE_URL": pg_url})
    assert settings.DATABASE_URL == pg_url
