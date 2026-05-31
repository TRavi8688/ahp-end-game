#!/usr/bin/env python3
"""
scripts/reencrypt_phi.py
Re-encrypts all PHI fields from the old (compromised) key to the new key.

Usage:
  OLD_FERNET_KEY=<old_key> \
  NEW_FERNET_KEY=<new_key> \
  DATABASE_URL=postgresql+asyncpg://... \
  python3 scripts/reencrypt_phi.py

WARNING: Run this ONCE after rotating the Fernet key.
         Take a full database backup before running.
         Run in a maintenance window — do NOT run with live traffic.
"""
import asyncio
import os
import sys
from typing import Any

import asyncpg
from cryptography.fernet import Fernet, MultiFernet

# PHI columns that are Fernet-encrypted: (table, column)
# Update this list to match your actual encrypted columns
PHI_COLUMNS: list[tuple[str, str]] = [
    ("patients", "name"),
    ("patients", "phone"),
    ("patients", "address"),
    ("appointments", "notes"),
    ("prescriptions", "details"),
    # Add all Fernet-encrypted columns here
]


def get_required_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"ERROR: '{key}' is required")
        sys.exit(1)
    return val


async def reencrypt_table(conn: asyncpg.Connection, table: str, column: str,
                           decryptor: MultiFernet, encryptor: Fernet) -> int:
    rows = await conn.fetch(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")
    updated = 0
    for row in rows:
        old_encrypted = row[column]
        if not old_encrypted:
            continue
        try:
            plaintext = decryptor.decrypt(old_encrypted.encode())
            new_encrypted = encryptor.encrypt(plaintext).decode()
            await conn.execute(
                f"UPDATE {table} SET {column} = $1 WHERE id = $2",
                new_encrypted, row["id"]
            )
            updated += 1
        except Exception as e:
            print(f"  WARN: Could not re-encrypt row {row['id']} in {table}.{column}: {e}")
    return updated


async def main():
    old_key = get_required_env("OLD_FERNET_KEY")
    new_key = get_required_env("NEW_FERNET_KEY")
    db_url = get_required_env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

    old_fernet = Fernet(old_key.encode())
    new_fernet = Fernet(new_key.encode())
    # MultiFernet tries old key for decryption, then re-encrypts with new key
    multi = MultiFernet([new_fernet, old_fernet])

    print(f"Connecting to database...")
    conn = await asyncpg.connect(db_url)

    total = 0
    try:
        async with conn.transaction():
            for table, column in PHI_COLUMNS:
                print(f"Re-encrypting {table}.{column}...")
                n = await reencrypt_table(conn, table, column, multi, new_fernet)
                print(f"  Updated {n} rows")
                total += n
    finally:
        await conn.close()

    print(f"\nDone. Total rows re-encrypted: {total}")
    print("Verify application works correctly, then delete the OLD_FERNET_KEY from everywhere.")


if __name__ == "__main__":
    asyncio.run(main())
