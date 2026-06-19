"""create_hospitalverificationstatusenum

Revision ID: a1b2c3d4e5f6
Revises: ab3f9c12d047
Create Date: 2026-05-27 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "a1b2c3d4e5f6"
down_revision = "ab3f9c12d047"
branch_labels = None
depends_on = None


def _enum_exists(enum_name):
    bind = op.get_bind()
    result = bind.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = :name"),
        {"name": enum_name},
    )
    return result.scalar() is not None


def _column_exists(table_name, column_name):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # Create the enum type only if it does not already exist
    if not _enum_exists("hospitalverificationstatusenum"):
        hospital_status_enum = sa.Enum(
            "draft",
            "submitted",
            "under_review",
            "request_more_info",
            "verified",
            "rejected",
            "suspended",
            "blacklisted",
            "verification_expired",
            name="hospitalverificationstatusenum",
        )
        hospital_status_enum.create(op.get_bind())

    # Add status column only if it does not already exist
    if not _column_exists("hospitals", "status"):
        op.add_column(
            "hospitals",
            sa.Column(
                "status",
                sa.Enum(
                    "draft",
                    "submitted",
                    "under_review",
                    "request_more_info",
                    "verified",
                    "rejected",
                    "suspended",
                    "blacklisted",
                    "verification_expired",
                    name="hospitalverificationstatusenum",
                    create_type=False,
                ),
                nullable=False,
                server_default="draft",
            ),
        )


def downgrade():
    op.drop_column("hospitals", "status")
    op.execute("DROP TYPE IF EXISTS hospitalverificationstatusenum")
