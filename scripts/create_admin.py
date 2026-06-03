"""
scripts/create_admin.py

Creates or updates the superadmin user in the Hospyn database.

PHASE 3 FIX:
- All credentials and DB connection details read from environment variables.
- Hardcoded bcrypt hash and hardcoded postgresql://postgres:postgres@localhost URL removed.
- Script validates env vars before connecting — fails loudly instead of silently using defaults.

Usage:
    export DATABASE_URL=postgresql://hospyn:yourpassword@localhost:5432/hospyn
    export ADMIN_EMAIL=superadmin@hospyn.com
    export ADMIN_PASSWORD=SomeStrongPassword123!
    python scripts/create_admin.py
"""

import asyncio
import os
import sys


def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(f"ERROR: Environment variable '{name}' is not set.", file=sys.stderr)
        sys.exit(1)
    return val


async def main():
    database_url = _require_env("DATABASE_URL")
    admin_email = _require_env("ADMIN_EMAIL")
    admin_password = _require_env("ADMIN_PASSWORD")

    # Validate password is not trivially weak
    if len(admin_password) < 12:
        print("ERROR: ADMIN_PASSWORD must be at least 12 characters.", file=sys.stderr)
        sys.exit(1)

    try:
        import asyncpg
        from passlib.context import CryptContext
    except ImportError as e:
        print(f"ERROR: Missing dependency — {e}. Run: poetry install", file=sys.stderr)
        sys.exit(1)

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(admin_password)

    print(f"Connecting to database...")
    conn = await asyncpg.connect(database_url)

    try:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", admin_email
        )
        if existing:
            await conn.execute(
                "UPDATE users SET hashed_password = $1, role = 'superadmin', is_active = true WHERE email = $2",
                hashed_password, admin_email
            )
            print(f"Updated superadmin: {admin_email}")
        else:
            await conn.execute(
                """
                INSERT INTO users (email, hashed_password, role, is_active, is_superuser)
                VALUES ($1, $2, 'superadmin', true, true)
                """,
                admin_email, hashed_password
            )
            print(f"Created superadmin: {admin_email}")
    finally:
        await conn.close()

    print("Done. Please store the credentials in your secrets manager, not in source code.")


if __name__ == "__main__":
    asyncio.run(main())
