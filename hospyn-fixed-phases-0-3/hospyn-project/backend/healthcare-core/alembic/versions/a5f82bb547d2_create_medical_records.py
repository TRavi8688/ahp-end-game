"""create medical_records

Revision ID: a5f82bb547d2
Revises: 6df9cf33819a
Create Date: 2026-05-29 11:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a5f82bb547d2"
down_revision: Union[str, None] = "6df9cf33819a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medical_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("record_name", sa.String(length=500), nullable=False),
        sa.Column("hospital_name", sa.String(length=500), nullable=True),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column(
            "record_type",
            sa.String(length=50),
            nullable=True,
            server_default="document",
        ),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_extracted", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("patient_summary", sa.Text(), nullable=True),
        sa.Column(
            "hidden_by_patient",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_medical_records_id"), "medical_records", ["id"], unique=False
    )
    op.create_index(
        "ix_medical_records_patient", "medical_records", ["patient_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_medical_records_patient", table_name="medical_records")
    op.drop_index(op.f("ix_medical_records_id"), table_name="medical_records")
    op.drop_table("medical_records")
