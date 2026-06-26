"""add pharmacy ledger + prescription network-share tables

Backs the partner-app "Transactions Ledger" and "Network Orders" views,
which had no corresponding tables at all (see app/models/pharmacy.py).

Revision ID: 0008_pharmacy_ledger_network
Revises: 0007_doctor_notif
Create Date: 2026-06-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_pharmacy_ledger_network"
down_revision = "009_hospin_matrix_3"
branch_labels = None
depends_on = None

transaction_type_enum = postgresql.ENUM(
    "purchase", "dispense", "adjustment", "return_",
    name="transactiontype",
    create_type=False,
)


def upgrade() -> None:
    # 004_pharmacy created pharmacy_inventory without created_at — model now
    # declares it, so the column needs to exist for ORM inserts to succeed.
    op.add_column(
        "pharmacy_inventory",
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    transaction_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "pharmacy_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_inventory.id", ondelete="SET NULL"), nullable=True),
        sa.Column("transaction_type", transaction_type_enum, nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_transactions_hospital_id", "pharmacy_transactions", ["hospital_id"])
    op.create_index("ix_pharmacy_transactions_inventory_item_id", "pharmacy_transactions", ["inventory_item_id"])
    op.create_index("ix_pharmacy_transactions_created_at", "pharmacy_transactions", ["created_at"])

    op.create_table(
        "prescription_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pharmacy_hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("shared_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_prescription_shares_prescription_id", "prescription_shares", ["prescription_id"])
    op.create_index("ix_prescription_shares_pharmacy_hospital_id", "prescription_shares", ["pharmacy_hospital_id"])


def downgrade() -> None:
    op.drop_table("prescription_shares")
    op.drop_table("pharmacy_transactions")
    transaction_type_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_column("pharmacy_inventory", "created_at")
