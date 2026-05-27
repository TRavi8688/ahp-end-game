"""add_risk_score_nullable

Revision ID: f1e2d3c4b5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-27 17:10:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "f1e2d3c4b5a6"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def _column_exists(table_name, column_name):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # Add risk_score only if it does not already exist
    if not _column_exists("hospitals", "risk_score"):
        op.add_column(
            "hospitals",
            sa.Column("risk_score", sa.Integer(), nullable=True),
        )

    # Backfill existing rows
    op.execute("UPDATE hospitals SET risk_score = 0 WHERE risk_score IS NULL")

    # Make NOT NULL with server default
    op.alter_column(
        "hospitals",
        "risk_score",
        nullable=False,
        server_default=sa.text("0"),
    )

    # trust_score - same pattern
    if not _column_exists("hospitals", "trust_score"):
        op.add_column(
            "hospitals",
            sa.Column("trust_score", sa.Integer(), nullable=True),
        )

    op.execute("UPDATE hospitals SET trust_score = 0 WHERE trust_score IS NULL")
    op.alter_column(
        "hospitals",
        "trust_score",
        nullable=False,
        server_default=sa.text("0"),
    )


def downgrade():
    op.drop_column("hospitals", "risk_score")
    op.drop_column("hospitals", "trust_score")
