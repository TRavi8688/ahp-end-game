"""add_version_id_default

Revision ID: ab3f9c12d047
Revises: cac7ea08faaf
Create Date: 2026-06-04 10:00:00.000000

FIX: Replaces the broken migration 9b1c2d3e4f5g_add_version_id_default.py
     The old revision ID contained 'g' which is not valid hex.
     This file has the same logic with a valid 12-character hex revision ID.

STEPS TO APPLY:
  1. Delete the old file: alembic/versions/9b1c2d3e4f5g_add_version_id_default.py
  2. Place this file in alembic/versions/
  3. Run: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "ab3f9c12d047"
down_revision = "cac7ea08faaf"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists to make this migration idempotent."""
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # Add version_id only if it does not already exist (safe re-run)
    if not _column_exists("users", "version_id"):
        op.add_column("users", sa.Column("version_id", sa.Integer(), nullable=True))

    # Backfill existing rows so they have a valid version_id
    op.execute("UPDATE users SET version_id = 1 WHERE version_id IS NULL")

    # Make NOT NULL with server default going forward
    op.alter_column(
        "users",
        "version_id",
        nullable=False,
        server_default=sa.text("1"),
    )


def downgrade():
    op.drop_column("users", "version_id")
