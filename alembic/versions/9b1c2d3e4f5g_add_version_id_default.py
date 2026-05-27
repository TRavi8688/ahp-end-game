"""add_version_id_default

Revision ID: 9b1c2d3e4f5g
Revises: cac7ea08faaf
Create Date: 2026-05-27 16:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "9b1c2d3e4f5g"
down_revision = "cac7ea08faaf"
branch_labels = None
depends_on = None


def _column_exists(table_name, column_name):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # Add version_id only if it does not already exist
    if not _column_exists("users", "version_id"):
        op.add_column("users", sa.Column("version_id", sa.Integer(), nullable=True))

    # Backfill existing rows
    op.execute("UPDATE users SET version_id = 1 WHERE version_id IS NULL")

    # Make NOT NULL with server default
    op.alter_column(
        "users",
        "version_id",
        nullable=False,
        server_default=sa.text("1"),
    )


def downgrade():
    op.drop_column("users", "version_id")
