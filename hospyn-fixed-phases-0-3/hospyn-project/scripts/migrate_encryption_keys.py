"""
SEC-1: PHI Encryption Key Rotation Script
==========================================
Run this BEFORE purging enc.key from git history.

Steps:
  1. Set OLD_FERNET_KEY env var to the leaked key value from git history.
  2. Set NEW_FERNET_KEY env var to the newly generated key.
  3. Set DATABASE_URL env var to your PostgreSQL connection string.
  4. Run: python migrate_encryption_keys.py

Generate new key first:
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
import sys
import logging
from cryptography.fernet import Fernet, InvalidToken
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

OLD_KEY = os.environ.get("OLD_FERNET_KEY")
NEW_KEY = os.environ.get("NEW_FERNET_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# ---- Tables and columns that store Fernet-encrypted PHI ----
# Adjust this list to match your actual schema.
ENCRYPTED_COLUMNS = [
    # (table_name, primary_key_col, encrypted_col)
    ("patients", "id", "dob_encrypted"),
    ("patients", "id", "address_encrypted"),
    ("patients", "id", "phi_notes_encrypted"),
    ("appointments", "id", "notes_encrypted"),
    ("prescriptions", "id", "dosage_encrypted"),
    ("lab_results", "id", "result_data_encrypted"),
]

BATCH_SIZE = 500


def rotate_column(conn, table: str, pk_col: str, enc_col: str,
                  old_fernet: Fernet, new_fernet: Fernet) -> int:
    """Re-encrypt one column in batches. Returns count of rows migrated."""
    rotated = 0
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS cnt FROM {table} WHERE {enc_col} IS NOT NULL")
        total = cur.fetchone()["cnt"]
        logger.info(f"  {table}.{enc_col}: {total} rows to migrate")

        offset = 0
        while True:
            cur.execute(
                f"SELECT {pk_col}, {enc_col} FROM {table} "
                f"WHERE {enc_col} IS NOT NULL ORDER BY {pk_col} "
                f"LIMIT %s OFFSET %s",
                (BATCH_SIZE, offset),
            )
            rows = cur.fetchall()
            if not rows:
                break

            updates = []
            for row in rows:
                raw_ct = row[enc_col]
                if isinstance(raw_ct, str):
                    raw_ct = raw_ct.encode()
                try:
                    plaintext = old_fernet.decrypt(raw_ct)
                except InvalidToken:
                    logger.warning(
                        f"    Row {row[pk_col]}: could not decrypt with old key — skipping"
                    )
                    continue
                new_ct = new_fernet.encrypt(plaintext).decode()
                updates.append((new_ct, row[pk_col]))

            if updates:
                cur.executemany(
                    f"UPDATE {table} SET {enc_col} = %s WHERE {pk_col} = %s",
                    updates,
                )
                conn.commit()
                rotated += len(updates)

            offset += BATCH_SIZE
            logger.info(f"    ... {min(offset, total)}/{total}")

    return rotated


def main():
    if not OLD_KEY:
        sys.exit("ERROR: Set OLD_FERNET_KEY environment variable")
    if not NEW_KEY:
        sys.exit("ERROR: Set NEW_FERNET_KEY environment variable")
    if not DATABASE_URL:
        sys.exit("ERROR: Set DATABASE_URL environment variable")

    old_fernet = Fernet(OLD_KEY.encode())
    new_fernet = Fernet(NEW_KEY.encode())

    logger.info("Connecting to database …")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    total_rows = 0
    try:
        for table, pk_col, enc_col in ENCRYPTED_COLUMNS:
            logger.info(f"Rotating {table}.{enc_col} …")
            n = rotate_column(conn, table, pk_col, enc_col, old_fernet, new_fernet)
            total_rows += n
            logger.info(f"  Done: {n} rows rotated")
    except Exception:
        conn.rollback()
        logger.exception("Migration failed — rolled back")
        sys.exit(1)
    finally:
        conn.close()

    logger.info(f"Migration complete. Total rows re-encrypted: {total_rows}")
    logger.info("Next steps:")
    logger.info("  1. Update FERNET_KEY in all .env files and GCP Cloud Run secrets")
    logger.info("  2. Run: bfg --delete-files enc.key  (on a bare clone)")
    logger.info("  3. git push --force --all && git push --force --tags")
    logger.info("  4. Rotate JWT private key, DB passwords, Redis password")


if __name__ == "__main__":
    main()
