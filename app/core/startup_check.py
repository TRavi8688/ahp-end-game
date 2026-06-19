"""
app/core/startup_check.py

Validates critical environment variables at application startup.
The application REFUSES TO START if any required variable is missing,
empty, or equal to a known placeholder value.

Add this to app/main.py BEFORE creating the FastAPI app:

    from app.core.startup_check import run_startup_checks
    run_startup_checks()
"""

import os
import sys

FORBIDDEN_VALUES: set[str] = {
    "supersecretkey_please_change_in_production_12345",
    "REPLACE_ME_GENERATE_WITH_openssl_rand_hex_32",
    "REPLACE_ME_GENERATE_WITH_FERNET",
    "changeme",
    "secret",
    "supersecret",
    "your-secret-key",
    "CHANGE_ME",
    "sqlite+aiosqlite:///app/auth-service/hospyn_auth_local.db",
    "sqlite+aiosqlite:///app/healthcare-core/hospyn_healthcare_local.db",
    "postgresql://postgres:postgres@localhost:5432/hospyn",
    "redis://localhost:6379",
    "redis://redis:6379",
}

PRODUCTION_REQUIRED: list[str] = [
    "SECRET_KEY",
    "FERNET_KEY",
    "DATABASE_URL",
    "REDIS_URL",
    "ALLOWED_ORIGINS",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "AUDIT_HMAC_SECRET",
]

ALWAYS_REQUIRED: list[str] = [
    "SECRET_KEY",
    "DATABASE_URL",
    "REDIS_URL",
]


def _check_variable(name: str, value: str | None, context: str) -> list[str]:
    errors: list[str] = []

    if not value:
        errors.append(
            f"  [{context}] {name} is not set. "
            f"Generate one and add it to your secrets manager."
        )
        return errors

    if value.strip() in FORBIDDEN_VALUES:
        errors.append(
            f"  [{context}] {name} is set to a known placeholder value. "
            f"Generate a real secret and set it in your environment."
        )
        return errors

    if name == "SECRET_KEY" and len(value) < 32:
        errors.append(
            f"  [{context}] {name} is too short ({len(value)} chars). "
            f"Must be at least 32 characters. "
            f"Generate with: openssl rand -hex 32"
        )

    if name == "FERNET_KEY" and len(value) < 44:
        errors.append(
            f"  [{context}] {name} appears invalid (too short for a Fernet key). "
            f"Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )

    if name == "DATABASE_URL" and "sqlite" in value.lower():
        errors.append(
            f"  [{context}] {name} is set to SQLite. "
            f"SQLite is not supported in production. Use PostgreSQL."
        )

    return errors


def run_startup_checks() -> None:
    """
    Validate all required environment variables.
    Calls sys.exit(1) if any check fails, preventing the app from starting.
    """
    env = os.environ.get("ENV", "development").lower()
    is_production = env == "production"

    all_errors: list[str] = []

    for var in ALWAYS_REQUIRED:
        value = os.environ.get(var)
        all_errors.extend(_check_variable(var, value, "ALL ENVS"))

    if is_production:
        for var in PRODUCTION_REQUIRED:
            if var in ALWAYS_REQUIRED:
                continue
            value = os.environ.get(var)
            all_errors.extend(_check_variable(var, value, "PRODUCTION"))

        allowed_origins = os.environ.get("ALLOWED_ORIGINS", "")
        if "*" in allowed_origins:
            all_errors.append(
                "  [PRODUCTION] ALLOWED_ORIGINS contains '*' (wildcard). "
                "Set explicit allowed origins, e.g. https://app.hospyn.com"
            )

    if all_errors:
        print("\n" + "=" * 70, file=sys.stderr)
        print("STARTUP ABORTED — Environment misconfiguration detected:", file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        for error in all_errors:
            print(error, file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        print(
            "\nFix the above issues and restart the service.\n"
            "See .env.example for documentation on each variable.\n",
            file=sys.stderr
        )
        sys.exit(1)

    print(
        f"[startup_check] Environment validation passed "
        f"(ENV={env}, production_mode={is_production})"
    )
