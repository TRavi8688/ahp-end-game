"""
healthcare-core/alembic/versions/008_enterprise_ticket_system.py

Full enterprise-grade ticket system migration.
Extends the existing support_tickets table (from 007) to support:
  - Cross-product tickets (not just partner tickets)
  - Conversation threads (ticket_messages table)
  - Internal notes (ticket_internal_notes table)
  - SLA tracking columns
  - Rating / CSAT
  - Team routing
  - Call-required flag
  - Missing roles in rolesenum
  - full_name + hospital_id columns on users
  - system_alerts table (super-admin EmergencyAlerts page)
  - fraud_signals table (super-admin VerificationDetail page)
  - hospital_documents table (super-admin verification)
  - hospital_branches table (HospitalDetail branches tab)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = "008_enterprise_ticket_system"
down_revision = "0010_merge_heads"
branch_labels = None
depends_on    = None


def upgrade() -> None:

    # (Removed invalid rolesenum and users alterations that belong in auth-service)

    # (Removed redundant hospital column additions that already exist from 001_initial.py)

    # (Removed redundant support_tickets, ticket_messages, and ticket_internal_notes blocks which were already fully created by 002_ticket_system.py)

    # ─── 7. system_alerts table (super-admin EmergencyAlerts page) ─────────────
    op.create_table(
        "system_alerts",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("type",        sa.String(100),  nullable=False, server_default="'SYSTEM'"),
        sa.Column("severity",    sa.String(20),   nullable=False, server_default="'medium'"),
        sa.Column("title",       sa.String(500),  nullable=False),
        sa.Column("message",     sa.Text(),       nullable=True),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved",    sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_system_alerts_resolved",    "system_alerts", ["resolved"])
    op.create_index("ix_system_alerts_hospital_id", "system_alerts", ["hospital_id"])
    op.create_index("ix_system_alerts_created_at",  "system_alerts", ["created_at"])

    # ─── 8. fraud_signals table (VerificationDetail risk score) ──────────────
    op.create_table(
        "fraud_signals",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id",  postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_type",  sa.String(100), nullable=False),
        sa.Column("description",  sa.Text(),      nullable=True),
        sa.Column("severity",     sa.String(20),  nullable=False, server_default="'medium'"),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_fraud_signals_hospital_id", "fraud_signals", ["hospital_id"])

    # ─── 9. hospital_documents table (VerificationDetail documents vault) ────
    op.create_table(
        "hospital_documents",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id",   postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_type", sa.String(200), nullable=False),
        sa.Column("file_url",      sa.Text(),      nullable=True),
        sa.Column("status",        sa.String(50),  nullable=False, server_default="'pending'"),
        sa.Column("uploaded_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("verified_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by",   postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at",    sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_hospital_documents_hospital_id", "hospital_documents", ["hospital_id"])

    # ─── 10. hospital_branches table (HospitalDetail branches tab) ───────────
    op.create_table(
        "hospital_branches",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("city",        sa.String(100), nullable=True),
        sa.Column("address",     sa.Text(),      nullable=True),
        sa.Column("phone",       sa.String(20),  nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_hospital_branches_hospital_id", "hospital_branches", ["hospital_id"])

    # (Removed redundant audit_logs alteration since the table is properly created in 009)


def downgrade() -> None:
    op.drop_table("hospital_branches")
    op.drop_table("hospital_documents")
    op.drop_table("fraud_signals")
    op.drop_table("system_alerts")
    # Note: enum values and added columns cannot be easily rolled back in PostgreSQL
