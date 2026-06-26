"""add lab tests orders results tables

Revision ID: 005_lab
Revises: 004_pharmacy   # UPDATE to your actual previous head
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005_lab"
down_revision = "004_pharmacy"   # UPDATE THIS
branch_labels = None
depends_on = None


def upgrade() -> None:
    laborderstatus = postgresql.ENUM(
        "ORDERED", "SAMPLE_COLLECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
        name="laborderstatus", create_type=False
    )
    labresultstatus = postgresql.ENUM(
        "PENDING", "NORMAL", "ABNORMAL", "CRITICAL",
        name="labresultstatus", create_type=False
    )
    laborderstatus.create(op.get_bind(), checkfirst=True)
    labresultstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lab_tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("normal_range", postgresql.JSONB, nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("turnaround_hours", sa.Integer, nullable=False, server_default="24"),
    )
    op.create_index("ix_lab_tests_code", "lab_tests", ["code"], unique=True)

    op.create_table(
        "lab_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("ordered_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", laborderstatus, nullable=False, server_default="ORDERED"),
        sa.Column("ordered_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_lab_orders_patient_id", "lab_orders", ["patient_id"])
    op.create_index("ix_lab_orders_hospital_id", "lab_orders", ["hospital_id"])
    op.create_index("ix_lab_orders_status", "lab_orders", ["status"])

    op.create_table(
        "lab_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("lab_tests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("result_value", sa.String(500), nullable=True),
        sa.Column("result_status", labresultstatus, nullable=False, server_default="PENDING"),
        sa.Column("resulted_at", sa.DateTime, nullable=True),
        sa.Column("resulted_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_lab_order_items_order_id", "lab_order_items", ["order_id"])
    op.create_index("ix_lab_order_items_test_id", "lab_order_items", ["test_id"])
    op.create_index("ix_lab_order_items_result_status", "lab_order_items", ["result_status"])


def downgrade() -> None:
    op.drop_table("lab_order_items")
    op.drop_table("lab_orders")
    op.drop_table("lab_tests")
    op.execute("DROP TYPE IF EXISTS labresultstatus")
    op.execute("DROP TYPE IF EXISTS laborderstatus")
