"""add consent_records table

Revision ID: 002_consent_records
Revises: 001_initial_schema   # UPDATE to your actual ai-service head
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_consent_records"
down_revision = "001_initial_schema"   # UPDATE THIS to your ai-service head
branch_labels = None
depends_on = None


def upgrade() -> None:
    consenttype = postgresql.ENUM(
        "AI_PROCESSING", "PHI_SHARING", "RESEARCH",
        name="consenttype",
    )
    consenttype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consent_type", consenttype, nullable=False),
        sa.Column("granted", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("granted_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
    )
    op.create_index("ix_consent_records_patient_id", "consent_records", ["patient_id"])
    op.create_index("ix_consent_records_consent_type", "consent_records", ["consent_type"])


def downgrade() -> None:
    op.drop_index("ix_consent_records_consent_type", table_name="consent_records")
    op.drop_index("ix_consent_records_patient_id", table_name="consent_records")
    op.drop_table("consent_records")
    op.execute("DROP TYPE IF EXISTS consenttype")
