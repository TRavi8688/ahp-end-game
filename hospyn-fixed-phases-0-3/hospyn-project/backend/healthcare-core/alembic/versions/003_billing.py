"""add billing invoices payments tables

Revision ID: 003_billing
Revises: 002_previous_head   # <-- UPDATE to your current healthcare-core head
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003_billing"
down_revision = "002_previous_head"   # UPDATE THIS
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enums
    invoicestatus = postgresql.ENUM(
        "DRAFT", "ISSUED", "PAID", "PARTIALLY_PAID", "CANCELLED", "OVERDUE",
        name="invoicestatus",
    )
    paymentmethod = postgresql.ENUM(
        "CASH", "CARD", "UPI", "NETBANKING", "INSURANCE",
        name="paymentmethod",
    )
    paymentstatus = postgresql.ENUM(
        "PENDING", "SUCCESS", "FAILED", "REFUNDED",
        name="paymentstatus",
    )
    invoicestatus.create(op.get_bind(), checkfirst=True)
    paymentmethod.create(op.get_bind(), checkfirst=True)
    paymentstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_number", sa.String(30), nullable=False, unique=True),
        sa.Column("line_items", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("status", invoicestatus, nullable=False, server_default="DRAFT"),
        sa.Column("issued_at", sa.DateTime, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("paid_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_invoices_patient_id", "invoices", ["patient_id"])
    op.create_index("ix_invoices_hospital_id", "invoices", ["hospital_id"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", paymentmethod, nullable=False),
        sa.Column("transaction_id", sa.String(120), nullable=True),
        sa.Column("payment_gateway", sa.String(60), nullable=True),
        sa.Column("status", paymentstatus, nullable=False, server_default="PENDING"),
        sa.Column("paid_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])
    op.create_index("ix_payments_patient_id", "payments", ["patient_id"])
    op.create_index("ix_payments_status", "payments", ["status"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("invoices")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
    op.execute("DROP TYPE IF EXISTS invoicestatus")
