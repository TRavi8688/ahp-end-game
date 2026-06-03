#!/usr/bin/env python3
"""
Safe superadmin bootstrap script.
NEVER commit this file with hardcoded credentials.
All credentials must come from environment variables.

Usage:
  ADMIN_EMAIL=admin@yourhospital.com \
  ADMIN_PASSWORD=<strong_password> \
  DATABASE_URL=postgresql+asyncpg://user:pass@host/db \
  python3 create_admin_safe.py
"""
import asyncio
import os
import sys
import uuid

import asyncpg
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_required_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"ERROR: Environment variable '{key}' is required but not set.")
        sys.exit(1)
    return val


def validate_password(password: str) -> None:
    if len(password) < 16:
        print("ERROR: ADMIN_PASSWORD must be at least 16 characters.")
        sys.exit(1)
    if password.lower() in ("password", "admin", "superadmin", "hospyn"):
        print("ERROR: ADMIN_PASSWORD is too weak.")
        sys.exit(1)


async def main():
    email = get_required_env("ADMIN_EMAIL")
    password = get_required_env("ADMIN_PASSWORD")
    db_url = get_required_env("DATABASE_URL")

    # Strip asyncpg driver prefix for raw asyncpg connection
    raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    validate_password(password)

    hashed = pwd_context.hash(password)
    admin_id = str(uuid.uuid4())  # Always generate a fresh UUID

    print(f"Creating superadmin: {email}")
    print(f"Generated UUID: {admin_id}")

    conn = await asyncpg.connect(raw_url)
    try:
        existing = await conn.fetchval(
            "SELECT id FROM users WHERE email = $1", email
        )
        if existing:
            print(f"Superadmin with email '{email}' already exists. Updating password.")
            await conn.execute(
                "UPDATE users SET hashed_password = $1 WHERE email = $2",
                hashed, email,
            )
        else:
            await conn.execute(
                """
                INSERT INTO users (id, email, hashed_password, role, is_active, is_verified)
                VALUES ($1, $2, $3, 'superadmin', true, true)
                """,
                admin_id, email, hashed,
            )
            print(f"Superadmin created successfully.")
    finally:
        await conn.close()

    print("Done. Delete this script's environment variables immediately.")


if __name__ == "__main__":
    asyncio.run(main())
