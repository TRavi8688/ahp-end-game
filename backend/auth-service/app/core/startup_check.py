"""
startup_check.py — Refuses to start if critical secrets are missing or are placeholders.
Import and call run_startup_checks() as the FIRST thing in main.py.
"""
import os
import sys

FORBIDDEN_VALUES = {
    "supersecretkey_please_change_in_production_12345",
    "REPLACE_ME_GENERATE_WITH_openssl_rand_hex_32",
    "REPLACE_ME_GENERATE_WITH_FERNET",
    "changeme", "secret", "supersecret", "your-secret-key", "CHANGE_ME",
    "sqlite+aiosqlite:///app/auth-service/hospyn_auth_local.db",
    "sqlite+aiosqlite:///app/healthcare-core/hospyn_healthcare_local.db",
    "postgresql://postgres:postgres@localhost:5432/hospyn",
    "redis://localhost:6379",
    "redis://redis:6379",
}

ALWAYS_REQUIRED = ["SECRET_KEY", "DATABASE_URL", "REDIS_URL"]
PRODUCTION_REQUIRED = [
    "SECRET_KEY", "FERNET_KEY", "DATABASE_URL", "REDIS_URL",
    "ALLOWED_ORIGINS", "POSTGRES_PASSWORD", "REDIS_PASSWORD", "AUDIT_HMAC_SECRET",
]

def run_startup_checks() -> None:
    env = os.environ.get("ENV", "development").lower()
    is_production = env == "production"
    errors = []

    for var in ALWAYS_REQUIRED:
        value = os.environ.get(var)
        if not value:
            errors.append(f"  {var} is not set.")
        elif value.strip() in FORBIDDEN_VALUES:
            errors.append(f"  {var} is set to a known placeholder value.")
        elif var == "SECRET_KEY" and len(value) < 32:
            errors.append(f"  {var} is too short ({len(value)} chars). Minimum 32.")
        elif var == "DATABASE_URL" and "sqlite" in value.lower():
            errors.append(f"  {var} points to SQLite — use PostgreSQL.")

    if is_production:
        for var in PRODUCTION_REQUIRED:
            if var in ALWAYS_REQUIRED:
                continue
            value = os.environ.get(var)
            if not value:
                errors.append(f"  [PRODUCTION] {var} is not set.")
            elif value.strip() in FORBIDDEN_VALUES:
                errors.append(f"  [PRODUCTION] {var} is a placeholder.")
        origins = os.environ.get("ALLOWED_ORIGINS", "")
        if "*" in origins:
            errors.append("  [PRODUCTION] ALLOWED_ORIGINS contains '*' wildcard. Set explicit domains.")

    if errors:
        print("\n" + "="*60, file=sys.stderr)
        print("STARTUP ABORTED — Environment misconfiguration:", file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
        print("="*60, file=sys.stderr)
        sys.exit(1)

    print(f"[startup_check] OK (ENV={env})")
