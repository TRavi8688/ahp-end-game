"""Add consent_records and audit_logs tables for DPDP Act compliance

Revision ID: 001_dpdp_compliance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_dpdp"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # consent_records — DPDP Act 2023 §6: explicit patient consent required
    # -------------------------------------------------------------------------
    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        # What the patient consented to
        sa.Column("consent_type", sa.String(100), nullable=False),
        # e.g. "data_processing", "ai_analysis", "telemedicine", "data_sharing"
        sa.Column("granted", sa.Boolean, nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        # Exact text shown to user when they consented
        sa.Column("consent_text_version", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_consent_patient", "consent_records", ["patient_id"])
    op.create_index("ix_consent_hospital", "consent_records", ["hospital_id"])
    op.create_index("ix_consent_type", "consent_records", ["consent_type"])

    # -------------------------------------------------------------------------
    # audit_logs — immutable append-only PHI access log
    # DPDP Act + Healthcare IT: every access/modification to patient data logged
    # -------------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Could be system (migration, cron) — nullable
        sa.Column("actor_role", sa.String(50), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        # e.g. "PHI_READ", "PHI_UPDATE", "LOGIN", "LOGOUT", "CONSENT_GRANTED"
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("request_id", sa.String(128), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        # "success" | "failure" | "denied"
        sa.Column("detail", sa.Text, nullable=True),
        # HMAC of (id + actor_id + action + timestamp) for tamper detection
        sa.Column("integrity_hash", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_audit_hospital", "audit_logs", ["hospital_id"])
    op.create_index("ix_audit_actor", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_patient", "audit_logs", ["patient_id"])
    op.create_index("ix_audit_created", "audit_logs", ["created_at"])
    op.create_index("ix_audit_action", "audit_logs", ["action"])

    # Make audit_logs append-only: deny UPDATE and DELETE via PostgreSQL rule
    op.execute("""
        CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
    """)
    op.execute("""
        CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
    """)

    # -------------------------------------------------------------------------
    # data_deletion_requests — DPDP Act §13: right to erasure
    # -------------------------------------------------------------------------
    op.create_table(
        "data_deletion_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        # "pending" | "in_progress" | "completed" | "rejected"
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        # Legal hold flag — certain records cannot be deleted (regulatory retention)
        sa.Column("legal_hold", sa.Boolean, nullable=False, server_default="false"),
    )
    op.create_index("ix_deletion_patient", "data_deletion_requests", ["patient_id"])
    op.create_index("ix_deletion_status", "data_deletion_requests", ["status"])


def downgrade() -> None:
    # Remove rules first
    op.execute("DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;")
    op.execute("DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;")
    op.drop_table("data_deletion_requests")
    op.drop_table("audit_logs")
    op.drop_table("consent_records")
