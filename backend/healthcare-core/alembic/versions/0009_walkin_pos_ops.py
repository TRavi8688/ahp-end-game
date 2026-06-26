"""add walk-in POS, order pipeline, supplier/purchase/expense tables

Backs: Walk-In tab (counter sales for customers with no Hospin account),
Orders tab pipeline (accepted/preparing/ready/delivered + pickup tokens),
and the More tab's Supplier Management / Purchase Entry / Finance screens.

Revision ID: 0009_walkin_pos_ops
Revises: 0008_pharmacy_ledger_network
Create Date: 2026-06-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_walkin_pos_ops"
down_revision = "0009_hospital_enabled_modules"
branch_labels = None
depends_on = None

payment_method_enum = postgresql.ENUM("cash", "upi", "card", name="paymentmethod", create_type=False)
expense_category_enum = postgresql.ENUM(
    "rent", "salaries", "utilities", "purchase", "other", name="expensecategory", create_type=False
)


def upgrade() -> None:
    payment_method_enum.create(op.get_bind(), checkfirst=True)
    expense_category_enum.create(op.get_bind(), checkfirst=True)

    # ── Order pipeline additions ────────────────────────────────────────────
    op.add_column("prescription_shares", sa.Column("token_number", sa.Integer, nullable=True))
    op.add_column("prescription_shares", sa.Column(
        "updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")
    ))
    op.add_column("prescriptions", sa.Column("image_url", sa.String(500), nullable=True))

    # ── walkin_customers ─────────────────────────────────────────────────────
    op.create_table(
        "walkin_customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("merged_patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_walkin_customers_hospital_id", "walkin_customers", ["hospital_id"])
    op.create_index("ix_walkin_customers_phone", "walkin_customers", ["phone"])
    op.create_index("ix_walkin_customers_merged_patient_id", "walkin_customers", ["merged_patient_id"])

    # ── pharmacy_sales / pharmacy_sale_items ────────────────────────────────
    op.create_table(
        "pharmacy_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_number", sa.String(40), nullable=False, unique=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("walkin_customer_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("walkin_customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("prescription_share_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("prescription_shares.id", ondelete="SET NULL"), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("gst_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("payment_method", payment_method_enum, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_sales_hospital_id", "pharmacy_sales", ["hospital_id"])
    op.create_index("ix_pharmacy_sales_created_at", "pharmacy_sales", ["created_at"])

    op.create_table(
        "pharmacy_sale_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_inventory.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("medicine_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
    )
    op.create_index("ix_pharmacy_sale_items_sale_id", "pharmacy_sale_items", ["sale_id"])

    # ── pharmacy_suppliers / purchase orders ────────────────────────────────
    op.create_table(
        "pharmacy_suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("contact_person", sa.String(150), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(150), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("gstin", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_suppliers_hospital_id", "pharmacy_suppliers", ["hospital_id"])

    op.create_table(
        "pharmacy_purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_suppliers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_number", sa.String(60), nullable=True),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_purchase_orders_hospital_id", "pharmacy_purchase_orders", ["hospital_id"])
    op.create_index("ix_pharmacy_purchase_orders_supplier_id", "pharmacy_purchase_orders", ["supplier_id"])

    op.create_table(
        "pharmacy_purchase_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pharmacy_inventory.id", ondelete="SET NULL"), nullable=True),
        sa.Column("medicine_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False),
    )
    op.create_index("ix_purchase_order_items_po_id", "pharmacy_purchase_order_items", ["purchase_order_id"])

    # ── pharmacy_expenses ────────────────────────────────────────────────────
    op.create_table(
        "pharmacy_expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("category", expense_category_enum, nullable=False, server_default="other"),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pharmacy_expenses_hospital_id", "pharmacy_expenses", ["hospital_id"])
    op.create_index("ix_pharmacy_expenses_created_at", "pharmacy_expenses", ["created_at"])


def downgrade() -> None:
    op.drop_column("prescriptions", "image_url")
    op.drop_table("pharmacy_expenses")
    op.drop_table("pharmacy_purchase_order_items")
    op.drop_table("pharmacy_purchase_orders")
    op.drop_table("pharmacy_suppliers")
    op.drop_table("pharmacy_sale_items")
    op.drop_table("pharmacy_sales")
    op.drop_table("walkin_customers")
    op.drop_column("prescription_shares", "updated_at")
    op.drop_column("prescription_shares", "token_number")
    expense_category_enum.drop(op.get_bind(), checkfirst=True)
    payment_method_enum.drop(op.get_bind(), checkfirst=True)
