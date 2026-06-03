#!/usr/bin/env python3
"""
create_superadmin.py — Secure CLI to create a superadmin account.

USAGE:
    python create_superadmin.py --email admin@example.com --password "YourStrongPassword!"

SECURITY MODEL:
    - Password is taken as a runtime argument — never stored in source code.
    - Password is hashed with bcrypt (cost factor 12) at runtime.
    - UUID is generated randomly at runtime — not a fixed predictable value.
    - The database URL must be set in the DATABASE_URL environment variable.
    - This script MUST NOT be committed with any hardcoded credentials.
    - This script MUST be run by a human operator in a secure environment,
      never by CI/CD with a hardcoded password.

REPLACES:
    create_admin.py — which had a hardcoded bcrypt hash AND a predictable UUID.
    That file must be deleted from git history (see POST-FIX GIT COMMANDS).
"""

import argparse
import asyncio
import os
import sys
import uuid

try:
    import asyncpg
except ImportError:
    print("ERROR: asyncpg not installed. Run: pip install asyncpg", file=sys.stderr)
    sys.exit(1)

try:
    from passlib.context import CryptContext
except ImportError:
    print("ERROR: passlib not installed. Run: pip install passlib[bcrypt]", file=sys.stderr)
    sys.exit(1)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

MIN_PASSWORD_LENGTH = 12


def validate_password(password: str) -> None:
    """Enforce minimum password requirements."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long. "
            f"Got {len(password)}."
        )
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_upper and has_lower and has_digit):
        raise ValueError(
            "Password must contain at least one uppercase letter, "
            "one lowercase letter, and one digit."
        )


async def create_superadmin(email: str, password: str, database_url: str) -> None:
    """Insert a superadmin user into the database with a fresh bcrypt hash."""
    validate_password(password)

    # Hash at runtime — never store the hash in source code
    hashed_password = pwd_context.hash(password)
    user_id = str(uuid.uuid4())  # Random UUID — never predictable

    print("Connecting to database...")
    conn = await asyncpg.connect(database_url)

    try:
        query = """
        INSERT INTO users (
            id, email, hashed_password, first_name, last_name,
            global_role, is_active, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, 'Super', 'Admin',
            'super_admin', true, NOW(), NOW()
        )
        ON CONFLICT (email) DO UPDATE
            SET hashed_password = EXCLUDED.hashed_password,
                global_role = 'super_admin',
                updated_at = NOW();
        """
        await conn.execute(query, user_id, email, hashed_password)
        print("Superadmin created successfully.")
        print(f"  Email:  {email}")
        print(f"  UUID:   {user_id}")
        print(f"  Role:   super_admin")
        print()
        print("IMPORTANT: Store the password in a secure password manager.")
        print("           Do not log it or share it over unencrypted channels.")
    finally:
        await conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a superadmin account in the Hospyn database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_superadmin.py --email admin@hospyn.com --password 'MyStr0ngP@ss!'
  DATABASE_URL=postgresql://... python create_superadmin.py --email admin@hospyn.com

Security notes:
  - Never pass the password as a shell variable that appears in ps output.
    Omit --password and you will be prompted securely instead.
  - DATABASE_URL must be set in the environment; do not pass it on the command line.
        """
    )
    parser.add_argument(
        "--email",
        required=True,
        help="Email address for the superadmin account."
    )
    parser.add_argument(
        "--password",
        default=None,
        help=(
            "Password for the superadmin account. "
            "If omitted, you will be prompted securely (recommended)."
        )
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print(
            "ERROR: DATABASE_URL environment variable is not set.\n"
            "Example: export DATABASE_URL=postgresql://hospyn:password@localhost:5432/hospyn",
            file=sys.stderr
        )
        sys.exit(1)

    # Prompt for password if not provided (avoids password in shell history)
    if args.password is None:
        import getpass
        password = getpass.getpass(f"Password for {args.email}: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("ERROR: Passwords do not match.", file=sys.stderr)
            sys.exit(1)
    else:
        password = args.password

    try:
        asyncio.run(create_superadmin(args.email, password, database_url))
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Database operation failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
