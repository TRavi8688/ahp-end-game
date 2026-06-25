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
down_revision = "007_workflow_engine"
branch_labels = None
depends_on    = None


def upgrade() -> None:

    # ─── 1. Add missing roles to rolesenum ───────────────────────────────────
    # PostgreSQL requires committing before ALTER TYPE, so we use raw SQL
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'nurse'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'pharmacist'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'super_admin'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'owner'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'receptionist'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'lab'")
    op.execute("ALTER TYPE rolesenum ADD VALUE IF NOT EXISTS 'hr'")

    # ─── 2. Add missing columns to users table ────────────────────────────────
    op.add_column("users", sa.Column(
        "full_name",   sa.String(255), nullable=True
    ))
    op.add_column("users", sa.Column(
        "hospital_id", postgresql.UUID(as_uuid=True), nullable=True
    ))
    op.create_index("ix_users_hospital_id", "users", ["hospital_id"])

    # token_version default 1 (not 0) — ensure existing rows are set
    op.execute("UPDATE users SET token_version = 1 WHERE token_version IS NULL OR token_version = 0")

    # ─── 3. Add missing columns to hospitals table ────────────────────────────
    op.add_column("hospitals", sa.Column("city",                sa.String(100),  nullable=True))
    op.add_column("hospitals", sa.Column("state",               sa.String(100),  nullable=True))
    op.add_column("hospitals", sa.Column("phone",               sa.String(20),   nullable=True))
    op.add_column("hospitals", sa.Column("registration_number", sa.String(100),  nullable=True))
    op.add_column("hospitals", sa.Column("is_active",           sa.Boolean(),    nullable=False, server_default="true"))
    op.add_column("hospitals", sa.Column("updated_at",          sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    op.add_column("hospitals", sa.Column("deleted_at",          sa.DateTime(timezone=True), nullable=True))

    # ─── 4. Extend support_tickets for full enterprise use ────────────────────
    # The existing table has partner_id FK — add nullable columns for cross-product use
    op.add_column("support_tickets", sa.Column(
        "ticket_id",           sa.String(20),  nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "product",             sa.String(50),  nullable=True, server_default="'hospyn_web'"
    ))
    op.add_column("support_tickets", sa.Column(
        "team",                sa.String(50),  nullable=True, server_default="'support'"
    ))
    op.add_column("support_tickets", sa.Column(
        "owner_email",         sa.String(255), nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "org_name",            sa.String(255), nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "sla_hours",           sa.Integer(),   nullable=True, server_default="24"
    ))
    op.add_column("support_tickets", sa.Column(
        "last_message",        sa.Text(),      nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "last_message_sender", sa.String(20),  nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "call_required",       sa.Boolean(),   nullable=False, server_default="false"
    ))
    op.add_column("support_tickets", sa.Column(
        "rating",              sa.Integer(),   nullable=True
    ))
    # Generate ticket_id for existing rows
    op.execute("""
        UPDATE support_tickets
        SET ticket_id = 'HSP-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' || LPAD((RANDOM() * 99999)::INT::TEXT, 5, '0')
        WHERE ticket_id IS NULL
    """)
    op.create_index("ix_support_tickets_ticket_id",    "support_tickets", ["ticket_id"])
    op.create_index("ix_support_tickets_owner_email",  "support_tickets", ["owner_email"])
    op.create_index("ix_support_tickets_team",         "support_tickets", ["team"])

    # ─── 5. ticket_messages table ─────────────────────────────────────────────
    op.create_table(
        "ticket_messages",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id",     sa.String(20), nullable=False, index=True),
        sa.Column("sender",        sa.String(20), nullable=False),    # "owner" | "agent"
        sa.Column("sender_label",  sa.String(100), nullable=True),
        sa.Column("text",          sa.Text(),    nullable=False),
        sa.Column("read_by_owner", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_by_agent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_ticket_messages_ticket_id",   "ticket_messages", ["ticket_id"])
    op.create_index("ix_ticket_messages_created_at",  "ticket_messages", ["created_at"])

    # ─── 6. ticket_internal_notes table ──────────────────────────────────────
    op.create_table(
        "ticket_internal_notes",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id",  sa.String(20),  nullable=False, index=True),
        sa.Column("note",       sa.Text(),      nullable=False),
        sa.Column("author",     sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

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

    # ─── 11. audit_logs: add hospital_id + details columns if missing ─────────
    op.add_column("audit_logs", sa.Column(
        "hospital_id", postgresql.UUID(as_uuid=True), nullable=True
    ))
    op.add_column("audit_logs", sa.Column(
        "details", sa.Text(), nullable=True
    ))
    op.create_index("ix_audit_logs_hospital_id", "audit_logs", ["hospital_id"])


def downgrade() -> None:
    op.drop_table("hospital_branches")
    op.drop_table("hospital_documents")
    op.drop_table("fraud_signals")
    op.drop_table("system_alerts")
    op.drop_table("ticket_internal_notes")
    op.drop_table("ticket_messages")
    # Note: enum values and added columns cannot be easily rolled back in PostgreSQL
    # Manual downgrade: ALTER TABLE users DROP COLUMN full_name, hospital_id; etc.
