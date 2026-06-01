"""
003_phase13_compliance_tables.py
Phase 13 Fix: DPDP consent_records + cryptographic audit_logs.
Links to 002_dpdp_compliance as the previous migration.

Run: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa

revision = '003_phase13_compliance'
down_revision = '002'   # ← chain to 002_dpdp_compliance
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── consent_records ───────────────────────────────────────────────────────
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("consent_id", sa.String(36), nullable=False, unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum(
                "medical_treatment", "prescription_management", "appointment_booking",
                "lab_results_sharing", "insurance_claim", "telemedicine",
                "ai_diagnosis_assist", "research_anonymized", "marketing",
                name="consentpurpose",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("active", "withdrawn", "expired", name="consentstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("granted_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("withdrawn_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("policy_version", sa.String(20), nullable=False, server_default="1.0"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("previous_hash", sa.String(64), nullable=True),
        sa.Column("record_hash", sa.String(64), nullable=False),
        sa.Column("hospital_id", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patient_id", "purpose", "hospital_id", name="uq_consent_patient_purpose"),
    )
    op.create_index("ix_consent_patient_id", "consent_records", ["patient_id"])
    op.create_index("ix_consent_status", "consent_records", ["status"])
    op.create_index("ix_consent_hospital_id", "consent_records", ["hospital_id"])

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("log_id", sa.String(36), nullable=False, unique=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("actor_role", sa.String(50), nullable=False),
        sa.Column("hospital_id", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("correlation_id", sa.String(36), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("previous_hash", sa.String(64), nullable=True),
        sa.Column("record_hash", sa.String(64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_event_type", "audit_logs", ["event_type"])
    op.create_index("ix_audit_hospital_id", "audit_logs", ["hospital_id"])
    op.create_index("ix_audit_occurred_at", "audit_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("consent_records")
    op.execute("DROP TYPE IF EXISTS consentstatus")
    op.execute("DROP TYPE IF EXISTS consentpurpose")
