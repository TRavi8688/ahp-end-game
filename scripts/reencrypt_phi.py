#!/usr/bin/env python3
"""
scripts/reencrypt_phi.py
Phase 6: Re-encrypt all PHI columns from the old (compromised) Fernet key to the new one.

Run ONCE after rotating FERNET_KEY. Take a full DB backup first.
Do NOT run with live traffic — use a maintenance window.

Usage:
  OLD_FERNET_KEY=CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs= \
  NEW_FERNET_KEY=<new_key_from_secret_manager> \
  DATABASE_URL=postgresql://hospyn:pass@localhost:5432/hospyn \
  python3 scripts/reencrypt_phi.py
"""
import asyncio
import os
import sys

from cryptography.fernet import Fernet, MultiFernet

# Table → encrypted columns mapping. Update this as new PHI columns are added.
PHI_COLUMNS = [
    ("patients", "name_encrypted"),
    ("patients", "phone_encrypted"),
    ("patients", "address_encrypted"),
    ("appointments", "notes_encrypted"),
]


def get_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"ERROR: {key} is required", file=sys.stderr)
        sys.exit(1)
    return val


async def main():
    old_key = get_env("OLD_FERNET_KEY")
    new_key = get_env("NEW_FERNET_KEY")
    db_url = get_env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

    if old_key == new_key:
        print("ERROR: OLD_FERNET_KEY and NEW_FERNET_KEY are the same.", file=sys.stderr)
        sys.exit(1)

    # MultiFernet: decrypts with old key, re-encrypts with new key
    multi = MultiFernet([Fernet(new_key.encode()), Fernet(old_key.encode())])
    new_fernet = Fernet(new_key.encode())

    import asyncpg
    print("Connecting...")
    conn = await asyncpg.connect(db_url)
    total = 0

    try:
        async with conn.transaction():
            for table, col in PHI_COLUMNS:
                rows = await conn.fetch(f"SELECT id, {col} FROM {table} WHERE {col} IS NOT NULL")
                updated = 0
                for row in rows:
                    try:
                        plaintext = multi.decrypt(row[col].encode())
                        new_encrypted = new_fernet.encrypt(plaintext).decode()
                        await conn.execute(
                            f"UPDATE {table} SET {col} = $1 WHERE id = $2",
                            new_encrypted, row["id"]
                        )
                        updated += 1
                    except Exception as e:
                        print(f"  WARN: Could not re-encrypt {table}.{col} id={row['id']}: {e}")
                print(f"  {table}.{col}: {updated}/{len(rows)} rows re-encrypted")
                total += updated
    finally:
        await conn.close()

    print(f"\nDone. {total} rows re-encrypted with new key.")
    print("Verify the app works, then remove OLD_FERNET_KEY from all systems.")


if __name__ == "__main__":
    asyncio.run(main())
