#!/usr/bin/env python3
"""
scripts/create_superadmin.py
Run ONCE to create the first super_admin user.

Usage:
    SUPER_ADMIN_PHONE=+91XXXXXXXXXX \
    SUPER_ADMIN_EMAIL=admin@hospyn.com \
    SUPER_ADMIN_PASSWORD=StrongPassword123! \
    DATABASE_URL=postgresql+asyncpg://hospyn:pass@localhost:5432/hospyn \
    python3 scripts/create_superadmin.py
"""

import asyncio
import os
import sys
import uuid

try:
    from passlib.context import CryptContext
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import text
except ImportError:
    print("Install deps first: pip install passlib bcrypt sqlalchemy asyncpg")
    sys.exit(1)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_superadmin():
    db_url   = os.environ.get("DATABASE_URL",
        "postgresql+asyncpg://hospyn:REPLACE_PASSWORD@localhost:5432/hospyn")
    phone    = os.environ.get("SUPER_ADMIN_PHONE",    "+91XXXXXXXXXX")
    email    = os.environ.get("SUPER_ADMIN_EMAIL",    "admin@hospyn.com")
    password = os.environ.get("SUPER_ADMIN_PASSWORD", "")
    name     = os.environ.get("SUPER_ADMIN_NAME",     "Super Admin")

    if not password:
        print("ERROR: Set SUPER_ADMIN_PASSWORD env var")
        sys.exit(1)
    if phone == "+91XXXXXXXXXX":
        print("ERROR: Set SUPER_ADMIN_PHONE env var to a real phone number")
        sys.exit(1)
    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters")
        sys.exit(1)

    engine = create_async_engine(db_url, echo=False)
    hashed  = pwd_context.hash(password)
    user_id = str(uuid.uuid4())

    async with AsyncSession(engine) as session:
        # Check for existing super_admin
        r = await session.execute(
            text("SELECT id, email FROM users WHERE role = 'super_admin' AND deleted_at IS NULL LIMIT 1")
        )
        existing = r.fetchone()
        if existing:
            print(f"Super admin already exists: id={existing[0]}, email={existing[1]}")
            print("Delete it first or use create a second one by removing this check.")
            await engine.dispose()
            return

        await session.execute(
            text("""
                INSERT INTO users
                    (id, full_name, email, phone_number, hashed_password,
                     role, is_active, token_version, created_at, updated_at)
                VALUES
                    (:id, :name, :email, :phone, :hashed,
                     'super_admin', true, 1, NOW(), NOW())
            """),
            {
                "id":     user_id,
                "name":   name,
                "email":  email,
                "phone":  phone,
                "hashed": hashed,
            }
        )
        await session.commit()

    print(f"\n✅ Super admin created!")
    print(f"   ID:    {user_id}")
    print(f"   Name:  {name}")
    print(f"   Email: {email}")
    print(f"   Phone: {phone}")
    print(f"   Role:  super_admin")
    print(f"\nLogin at: https://app.hospyn.com (or localhost:5177 for dev)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_superadmin())
