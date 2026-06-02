"""add consent_records table

Revision ID: 002_consent_records
Revises: 001_initial_schema   # <-- set to your current head revision ID
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_consent_records"
down_revision = "001_initial_schema"   # UPDATE THIS to match your actual head
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "consent_type",
            sa.Enum("AI_PROCESSING", "PHI_SHARING", name="consenttype"),
            nullable=False,
        ),
        sa.Column("granted_at", sa.DateTime(), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_consent_records_patient_id", "consent_records", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_consent_records_patient_id", table_name="consent_records")
    op.drop_table("consent_records")
    op.execute("DROP TYPE IF EXISTS consenttype")
