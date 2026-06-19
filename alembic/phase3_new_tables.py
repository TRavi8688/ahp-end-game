"""
phase3_new_tables.py
Phase 3 Database Migration — New tables for Phase 3 features

APPLY:
  1. Copy this file to:
     alembic/versions/phase3_new_tables.py

  2. Check your current head:
     alembic history | head -3

  3. Update down_revision below to your current head revision ID.

  4. Apply:
     alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Replace 'YOUR_CURRENT_HEAD' with the output of `alembic heads`
revision = "phase3_new_tables"
down_revision = "YOUR_CURRENT_HEAD"   # ← MANUAL STEP: set this
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── patient_device_tokens ─────────────────────────────────────────────
    op.create_table(
        "patient_device_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.Text, nullable=False),
        sa.Column("platform", sa.String(20), nullable=False, server_default="expo"),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_patient_device_tokens_patient_id",
                    "patient_device_tokens", ["patient_id"], unique=True)

    # ── emergency_alerts ──────────────────────────────────────────────────
    op.create_table(
        "emergency_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="high"),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("acknowledged_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_emergency_alerts_hospital_id",
                    "emergency_alerts", ["hospital_id"])
    op.create_index("ix_emergency_alerts_created_at",
                    "emergency_alerts", ["created_at"])

    # ── staff_shifts ──────────────────────────────────────────────────────
    op.create_table(
        "staff_shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("shift_date", sa.Date, nullable=False),
        sa.Column("shift_type", sa.String(20), nullable=False),  # morning|afternoon|night
        sa.Column("start_time", sa.String(5), nullable=False),   # "08:00"
        sa.Column("end_time", sa.String(5), nullable=False),     # "16:00"
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_staff_shifts_date", "staff_shifts", ["shift_date"])
    op.create_index("ix_staff_shifts_staff", "staff_shifts", ["staff_id"])

    # ── leave_requests ────────────────────────────────────────────────────
    op.create_table(
        "leave_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("leave_type", sa.String(30), nullable=False),   # sick|casual|annual|emergency
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("applied_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_leave_requests_staff", "leave_requests", ["staff_id"])
    op.create_index("ix_leave_requests_status", "leave_requests", ["status"])

    # ── invoices: add upi_transaction_ref and paid_by if missing ─────────
    # (safe to run even if column exists — use try/except in practice)
    try:
        op.add_column("invoices",
            sa.Column("upi_transaction_ref", sa.String(200), nullable=True))
        op.add_column("invoices",
            sa.Column("paid_by", sa.String(200), nullable=True))
        op.add_column("invoices",
            sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True))
    except Exception:
        pass  # Columns already exist from earlier migration


def downgrade() -> None:
    op.drop_table("leave_requests")
    op.drop_table("staff_shifts")
    op.drop_table("emergency_alerts")
    op.drop_table("patient_device_tokens")

    try:
        op.drop_column("invoices", "paid_at")
        op.drop_column("invoices", "paid_by")
        op.drop_column("invoices", "upi_transaction_ref")
    except Exception:
        pass
