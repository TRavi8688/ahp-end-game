"""
009_hospin_matrix_3.py

Hospin Matrix 3.0 -- new tables required by all 21 modules.

New tables:
  - matrix_incidents          Module 15: Incident War Room
  - matrix_incident_timeline  Module 15: Timeline entries per incident
  - matrix_broadcasts         Module 19: Emergency broadcast history
  - matrix_broadcast_targets  Module 19: Channels per broadcast
  - matrix_sla_rules          Module 8:  Configurable SLA rules per priority
  - matrix_sla_breaches       Module 8:  Logged SLA breach events
  - matrix_shift_log          Module 6:  Employee shift state changes
  - matrix_ai_queries         Module 20: AI Copilot query/response log

Extends existing tables:
  - hospyn_employees: adds shift_status, skills, last_seen_at
  - support_tickets:  adds sla_response_due, sla_resolution_due, breached columns
  - hospitals:        adds verified_at, verified_by, monthly_revenue, branch_count
  - pharmacies:       adds verification_status, revenue
  - labs:             adds verification_status, revenue

Down revision: 003_hospyn_employees_ticket_hierarchy
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects import postgresql

revision      = "009_hospin_matrix_3"
down_revision = "008_enterprise_ticket_system"
branch_labels = None
depends_on    = None

SHIFT_STATUSES = ("online", "offline", "break", "meeting", "training", "leave")
INCIDENT_SEVERITIES = ("P1", "P2", "P3", "P4")
INCIDENT_STATUSES   = ("active", "mitigated", "resolved", "postmortem")


def upgrade() -> None:

    # Explicitly create enums to avoid asyncpg issues
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status_enum') THEN 
                CREATE TYPE shift_status_enum AS ENUM ('online', 'offline', 'break', 'meeting', 'training', 'leave'); 
            END IF; 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN 
                CREATE TYPE incident_severity AS ENUM ('P1', 'P2', 'P3', 'P4'); 
            END IF; 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN 
                CREATE TYPE incident_status AS ENUM ('active', 'mitigated', 'resolved', 'postmortem'); 
            END IF; 
        END 
        $$;
    """)

    # -- 1. Extend hospyn_employees --------------------------------------------
    op.add_column("hospyn_employees", sa.Column(
        "shift_status",
        postgresql.ENUM(*SHIFT_STATUSES, name="shift_status_enum", create_type=False),
        nullable=False,
        server_default="offline",
    ))
    op.add_column("hospyn_employees", sa.Column(
        "skills", sa.ARRAY(sa.String()), nullable=True
    ))
    op.add_column("hospyn_employees", sa.Column(
        "last_seen_at", sa.DateTime(timezone=True), nullable=True
    ))
    op.add_column("hospyn_employees", sa.Column(
        "daily_ticket_limit", sa.Integer(), nullable=False, server_default="40"
    ))

    # -- 2. Extend support_tickets with SLA deadline cols ----------------------
    op.add_column("support_tickets", sa.Column(
        "sla_response_due", sa.DateTime(timezone=True), nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "sla_resolution_due", sa.DateTime(timezone=True), nullable=True
    ))
    op.add_column("support_tickets", sa.Column(
        "sla_response_breached", sa.Boolean(), nullable=False, server_default="false"
    ))
    op.add_column("support_tickets", sa.Column(
        "sla_resolution_breached", sa.Boolean(), nullable=False, server_default="false"
    ))
    op.add_column("support_tickets", sa.Column(
        "first_response_at", sa.DateTime(timezone=True), nullable=True
    ))

    # -- 3. Extend hospitals ---------------------------------------------------
    op.add_column("hospitals", sa.Column(
        "verified_at", sa.DateTime(timezone=True), nullable=True
    ))
    op.add_column("hospitals", sa.Column(
        "verified_by", sa.String(50), nullable=True  # employee_id of verifier
    ))
    op.add_column("hospitals", sa.Column(
        "monthly_revenue", sa.BigInteger(), nullable=False, server_default="0"
    ))
    op.add_column("hospitals", sa.Column(
        "branch_count", sa.Integer(), nullable=False, server_default="1"
    ))
    op.add_column("hospitals", sa.Column(
        "bed_count", sa.Integer(), nullable=True
    ))
    op.add_column("hospitals", sa.Column(
        "complaint_count_7d", sa.Integer(), nullable=False, server_default="0"
    ))

    # -- 4. matrix_incidents ---------------------------------------------------
    op.create_table(
        "matrix_incidents",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("incident_id",  sa.String(20),  unique=True, nullable=False),
        sa.Column("title",        sa.String(300), nullable=False),
        sa.Column("severity",     postgresql.ENUM(*INCIDENT_SEVERITIES, name="incident_severity", create_type=False),
                  nullable=False, server_default="P3"),
        sa.Column("status",       postgresql.ENUM(*INCIDENT_STATUSES, name="incident_status", create_type=False),
                  nullable=False, server_default="active"),
        sa.Column("owner_employee_id", sa.String(30), nullable=True),
        sa.Column("team",         sa.String(50),  nullable=True),
        sa.Column("affected_count", sa.String(100), nullable=True),
        sa.Column("root_cause",   sa.Text(),      nullable=True),
        sa.Column("resolution",   sa.Text(),      nullable=True),
        sa.Column("created_by",   sa.String(50),  nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("mitigated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_matrix_incidents_status",   "matrix_incidents", ["status"])
    op.create_index("ix_matrix_incidents_severity", "matrix_incidents", ["severity"])

    # -- 5. matrix_incident_timeline -------------------------------------------
    op.create_table(
        "matrix_incident_timeline",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("incident_id", sa.String(20),  nullable=False),
        sa.Column("entry_type",  sa.String(30),  nullable=False),
        # entry_type: alert | action | finding | resolution | postmortem
        sa.Column("message",     sa.Text(),      nullable=False),
        sa.Column("author",      sa.String(100), nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_incident_timeline_incident_id", "matrix_incident_timeline", ["incident_id"])

    # -- 6. matrix_broadcasts -------------------------------------------------
    op.create_table(
        "matrix_broadcasts",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("title",       sa.String(300), nullable=False),
        sa.Column("body",        sa.Text(),      nullable=False),
        sa.Column("targets",     sa.ARRAY(sa.String()), nullable=True),
        sa.Column("channels",    sa.ARRAY(sa.String()), nullable=True),
        sa.Column("reach_count", sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("sent_by",     sa.String(50),  nullable=True),
        sa.Column("sent_at",     sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # -- 7. matrix_sla_rules (configurable per priority) -----------------------
    op.create_table(
        "matrix_sla_rules",
        sa.Column("id",                   UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("priority",             sa.String(20),  unique=True, nullable=False),
        sa.Column("response_minutes",     sa.Integer(),   nullable=False),
        sa.Column("resolution_minutes",   sa.Integer(),   nullable=False),
        sa.Column("escalate_after_minutes", sa.Integer(), nullable=False),
        sa.Column("updated_by",           sa.String(50),  nullable=True),
        sa.Column("updated_at",           sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    # Seed default SLA rules
    op.execute("""
        INSERT INTO matrix_sla_rules
          (priority, response_minutes, resolution_minutes, escalate_after_minutes)
        VALUES
          ('critical', 15,   120,  15),
          ('high',     30,   240,  30),
          ('medium',   60,   720,  90),
          ('low',      240, 1440, 300)
        ON CONFLICT (priority) DO NOTHING
    """)

    # -- 8. matrix_sla_breaches ------------------------------------------------
    op.create_table(
        "matrix_sla_breaches",
        sa.Column("id",            UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id",     sa.String(20), nullable=False),
        sa.Column("breach_type",   sa.String(30), nullable=False),
        # breach_type: response | resolution
        sa.Column("priority",      sa.String(20), nullable=False),
        sa.Column("overage_minutes", sa.Integer(), nullable=False),
        sa.Column("assigned_to",   sa.String(30), nullable=True),
        sa.Column("auto_escalated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_sla_breaches_ticket_id",  "matrix_sla_breaches", ["ticket_id"])
    op.create_index("ix_sla_breaches_created_at", "matrix_sla_breaches", ["created_at"])

    # -- 9. matrix_shift_log ---------------------------------------------------
    op.create_table(
        "matrix_shift_log",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", sa.String(30), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status",   sa.String(20), nullable=False),
        sa.Column("reason",      sa.String(200), nullable=True),
        sa.Column("tickets_redistributed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_shift_log_employee_id", "matrix_shift_log", ["employee_id"])

    # -- 10. matrix_ai_queries -------------------------------------------------
    op.create_table(
        "matrix_ai_queries",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("queried_by",  sa.String(50),  nullable=True),
        sa.Column("query",       sa.Text(),      nullable=False),
        sa.Column("response",    sa.Text(),      nullable=True),
        sa.Column("model",       sa.String(50),  nullable=False, server_default="claude-sonnet-4-6"),
        sa.Column("latency_ms",  sa.Integer(),   nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("matrix_ai_queries")
    op.drop_table("matrix_shift_log")
    op.drop_table("matrix_sla_breaches")
    op.drop_table("matrix_sla_rules")
    op.drop_table("matrix_broadcasts")
    op.drop_table("matrix_incident_timeline")
    op.drop_table("matrix_incidents")
    # Remove added columns -- PostgreSQL enums must be dropped separately
    for col in ("shift_status","skills","last_seen_at","daily_ticket_limit"):
        op.drop_column("hospyn_employees", col)
    for col in ("sla_response_due","sla_resolution_due","sla_response_breached",
                "sla_resolution_breached","first_response_at"):
        op.drop_column("support_tickets", col)
    for col in ("verified_at","verified_by","monthly_revenue","branch_count","bed_count","complaint_count_7d"):
        op.drop_column("hospitals", col)
