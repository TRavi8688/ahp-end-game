"""
Migration: Create all partner-related tables.

BUG FIX: These 6 tables (partners, partner_inventories, orders, order_line_items,
referrals, payouts) had ORM models defined and API routes querying them, but NO
alembic migration existed. The database was missing all these tables, causing
every partner API endpoint to crash with a 500 (relation does not exist).

Revision ID: 006_partner_tables
Revises: 005_lab
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006_partner_tables"
down_revision = "005_lab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── partners ─────────────────────────────────────────────────────────────
    op.create_table(
        "partners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",            sa.String(200),  nullable=False),
        sa.Column("email",           sa.String(255),  nullable=False, unique=True),
        sa.Column("password_hash",   sa.String(255),  nullable=False),
        sa.Column("partner_code",    sa.String(50),   nullable=False, unique=True),
        sa.Column("commission_rate", sa.Float(),      nullable=False, server_default="0.15"),
        sa.Column("is_active",       sa.Boolean(),    nullable=False, server_default="true"),
        sa.Column("created_at",      sa.DateTime(),   nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_partners_email",        "partners", ["email"])
    op.create_index("ix_partners_partner_code", "partners", ["partner_code"])

    # ── partner_inventories ──────────────────────────────────────────────────
    op.create_table(
        "partner_inventories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_name",       sa.String(255), nullable=False),
        sa.Column("generic_name",    sa.String(255), nullable=True),
        sa.Column("category",        sa.String(100), nullable=True),
        sa.Column("sku_code",        sa.String(100), nullable=True),
        sa.Column("batch_number",    sa.String(100), nullable=True),
        sa.Column("expiry_date",     sa.DateTime(),  nullable=True),
        sa.Column("stock_quantity",  sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("reorder_level",   sa.Integer(),   nullable=False, server_default="10"),
        sa.Column("unit_price",      sa.Float(),     nullable=False, server_default="0"),
        sa.Column("mrp",             sa.Float(),     nullable=False, server_default="0"),
        sa.Column("manufacturer",    sa.String(255), nullable=True),
        sa.Column("qr_code",         sa.String(255), nullable=True, unique=True),
    )
    op.create_index("ix_partner_inventories_partner_id", "partner_inventories", ["partner_id"])

    # ── orders ───────────────────────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",        postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_number",      sa.String(100),  nullable=False, unique=True),
        sa.Column("patient_name",      sa.String(200),  nullable=False),
        sa.Column("patient_phone",     sa.String(50),   nullable=False),
        sa.Column("status",            sa.String(50),   nullable=False, server_default="'pending'"),
        sa.Column("total_amount",      sa.Float(),      nullable=False, server_default="0"),
        sa.Column("commission_amount", sa.Float(),      nullable=False, server_default="0"),
        sa.Column("notes",             sa.String(1000), nullable=True),
        sa.Column("created_at",        sa.DateTime(),   nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at",        sa.DateTime(),   nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_orders_partner_id",  "orders", ["partner_id"])
    op.create_index("ix_orders_status",      "orders", ["status"])
    op.create_index("ix_orders_created_at",  "orders", ["created_at"])

    # ── order_line_items ─────────────────────────────────────────────────────
    op.create_table(
        "order_line_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id",    postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name",  sa.String(255), nullable=False),
        sa.Column("quantity",   sa.Float(),     nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float(),     nullable=False, server_default="0"),
        sa.Column("total",      sa.Float(),     nullable=False, server_default="0"),
    )

    # ── referrals ────────────────────────────────────────────────────────────
    op.create_table(
        "referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",         postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_name",        sa.String(200), nullable=False),
        sa.Column("patient_phone",       sa.String(50),  nullable=False),
        sa.Column("referral_date",       sa.DateTime(),  nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("registration_date",   sa.DateTime(),  nullable=True),
        sa.Column("first_order_date",    sa.DateTime(),  nullable=True),
        sa.Column("status",              sa.String(50),  nullable=False, server_default="'clicked'"),
        sa.Column("commission_amount",   sa.Float(),     nullable=False, server_default="0"),
        sa.Column("commission_status",   sa.String(50),  nullable=False, server_default="'pending'"),
        sa.Column("order_count",         sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("lifetime_value",      sa.Float(),     nullable=False, server_default="0"),
    )
    op.create_index("ix_referrals_partner_id",   "referrals", ["partner_id"])
    op.create_index("ix_referrals_status",       "referrals", ["status"])

    # ── payouts ──────────────────────────────────────────────────────────────
    op.create_table(
        "payouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount",          sa.Float(),     nullable=False, server_default="0"),
        sa.Column("status",          sa.String(50),  nullable=False, server_default="'pending'"),
        sa.Column("period_start",    sa.DateTime(),  nullable=False),
        sa.Column("period_end",      sa.DateTime(),  nullable=False),
        sa.Column("paid_at",         sa.DateTime(),  nullable=True),
        sa.Column("transaction_ref", sa.String(100), nullable=True),
        sa.Column("referral_count",  sa.Integer(),   nullable=False, server_default="0"),
    )
    op.create_index("ix_payouts_partner_id", "payouts", ["partner_id"])


def downgrade() -> None:
    op.drop_table("payouts")
    op.drop_table("referrals")
    op.drop_table("order_line_items")
    op.drop_table("orders")
    op.drop_table("partner_inventories")
    op.drop_table("partners")
