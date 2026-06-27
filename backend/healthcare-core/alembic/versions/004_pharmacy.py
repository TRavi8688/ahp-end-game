"""add pharmacy inventory tables

Revision ID: 004_pharmacy
Revises: 003_billing   # UPDATE to your actual previous head
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004_pharmacy"
down_revision = "003b_core_models"   # UPDATE THIS
branch_labels = None
depends_on = None


def upgrade() -> None:
    # medicines master catalogue
    op.create_table(
        "medicines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("generic_name", sa.String(200), nullable=False),
        sa.Column("manufacturer", sa.String(200), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_medicines_name", "medicines", ["name"])

    # pharmacy_inventory
    op.create_table(
        "pharmacy_inventory",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("medicine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("batch_number", sa.String(60), nullable=False),
        sa.Column("quantity_available", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quantity_reserved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("reorder_level", sa.Integer, nullable=False, server_default="10"),
        sa.Column("expiry_date", sa.Date, nullable=False),
        sa.Column("purchase_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("selling_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_inventory_hospital_id", "pharmacy_inventory", ["hospital_id"])
    op.create_index("ix_pharmacy_inventory_medicine_id", "pharmacy_inventory", ["medicine_id"])

    # prescription_dispenses
    op.create_table(
        "prescription_dispenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("prescriptions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("inventory_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_inventory.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity_dispensed", sa.Integer, nullable=False),
        # EXECUTION FIX: was `sa.ForeignKey("users.id")`. The `users` table
        # lives in the auth-service's own database (hospyn_auth_db), not this
        # one (hospyn_healthcare_db) — see infra/init-databases.sh. A foreign
        # key across two separate Postgres databases is not possible; this
        # migration would have failed to apply. Plain UUID column instead,
        # matching the convention in models/staff.py and models/doctor.py.
        sa.Column("dispensed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dispensed_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_prescription_dispenses_prescription_id",
                    "prescription_dispenses", ["prescription_id"])
    op.create_index("ix_prescription_dispenses_inventory_id",
                    "prescription_dispenses", ["inventory_id"])


def downgrade() -> None:
    op.drop_table("prescription_dispenses")
    op.drop_table("pharmacy_inventory")
    op.drop_table("medicines")
