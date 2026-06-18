"""add source_type to appointments

Revision ID: a6f82bb547d3
Revises: a5f82bb547d2
Create Date: 2026-06-07 12:52:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a6f82bb547d3"
down_revision: Union[str, None] = "005_lab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the ENUM type first
    op.execute("CREATE TYPE appointmentsource AS ENUM ('scheduled', 'walkin', 'receptionist')")
    
    # Add columns to appointments
    op.add_column(
        "appointments",
        sa.Column(
            "source_type",
            postgresql.ENUM("scheduled", "walkin", "receptionist", name="appointmentsource", create_type=False),
            server_default="scheduled",
            nullable=False,
        )
    )
    op.add_column(
        "appointments",
        sa.Column("walkin_request_id", sa.UUID(), nullable=True)
    )
    
    # Create index and foreign key
    op.create_index(
        op.f("ix_appointments_walkin_request_id"),
        "appointments",
        ["walkin_request_id"],
        unique=False
    )
    op.create_foreign_key(
        "fk_appointments_walkin_request_id_walkin_requests",
        "appointments",
        "walkin_requests",
        ["walkin_request_id"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_appointments_walkin_request_id_walkin_requests", "appointments", type_="foreignkey")
    op.drop_index(op.f("ix_appointments_walkin_request_id"), table_name="appointments")
    op.drop_column("appointments", "walkin_request_id")
    op.drop_column("appointments", "source_type")
    op.execute("DROP TYPE appointmentsource")
