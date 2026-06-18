"""
Migration: Create queue, lab_order, and support_ticket tables.

Revision ID: 007_queue_lab_support
Revises: 006_partner_tables
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007_queue_lab_support"
down_revision = "006_partner_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── prescription_queues ───────────────────────────────────────────────────
    op.create_table(
        "prescription_queues",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id",   postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("patient_name",  sa.String(200), nullable=False),
        sa.Column("patient_phone", sa.String(50),  nullable=False),
        sa.Column("source",        sa.String(20),  nullable=False, server_default="'manual'"),
        sa.Column("status",        sa.String(30),  nullable=False, server_default="'waiting'"),
        sa.Column("queue_number",  sa.Integer(),   nullable=False),
        sa.Column("total_amount",  sa.Float(),     nullable=False, server_default="0"),
        sa.Column("accepted_by",   sa.String(255), nullable=True),
        sa.Column("upi_txn_ref",   sa.String(100), nullable=True),
        sa.Column("upi_txn_id",    sa.String(100), nullable=True),
        sa.Column("notes",         sa.Text(),      nullable=True),
        sa.Column("paid_at",       sa.DateTime(),  nullable=True),
        sa.Column("created_at",    sa.DateTime(),  nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at",    sa.DateTime(),  nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_pq_partner_id",   "prescription_queues", ["partner_id"])
    op.create_index("ix_pq_status",       "prescription_queues", ["status"])
    op.create_index("ix_pq_created_at",   "prescription_queues", ["created_at"])
    op.create_index("ix_pq_upi_txn_ref",  "prescription_queues", ["upi_txn_ref"])

    # ── queue_items (child rows of prescription_queues) ───────────────────────
    op.create_table(
        "queue_items",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("queue_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("prescription_queues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicine_name", sa.String(255), nullable=False),
        sa.Column("generic_name",  sa.String(255), nullable=True),
        sa.Column("quantity",      sa.Float(),     nullable=False, server_default="1"),
        sa.Column("dosage",        sa.String(100), nullable=True),
        sa.Column("unit_price",    sa.Float(),     nullable=False, server_default="0"),
    )
    op.create_index("ix_qi_queue_id", "queue_items", ["queue_id"])

    # ── lab_orders ────────────────────────────────────────────────────────────
    op.create_table(
        "lab_orders",
        sa.Column("id",                   postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",           postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id",           postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("order_number",         sa.String(100), nullable=False, unique=True),
        sa.Column("patient_name",         sa.String(200), nullable=False),
        sa.Column("patient_phone",        sa.String(50),  nullable=False),
        sa.Column("source",               sa.String(20),  nullable=False, server_default="'manual'"),
        sa.Column("status",               sa.String(30),  nullable=False, server_default="'pending'"),
        sa.Column("sample_qr",            sa.String(100), nullable=True),
        sa.Column("report_url",           sa.String(500), nullable=True),
        sa.Column("total_amount",         sa.Float(),     nullable=False, server_default="0"),
        sa.Column("notes",                sa.Text(),      nullable=True),
        sa.Column("sample_collected_at",  sa.DateTime(),  nullable=True),
        sa.Column("reported_at",          sa.DateTime(),  nullable=True),
        sa.Column("created_at",           sa.DateTime(),  nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at",           sa.DateTime(),  nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_lo_partner_id",  "lab_orders", ["partner_id"])
    op.create_index("ix_lo_status",      "lab_orders", ["status"])
    op.create_index("ix_lo_patient_id",  "lab_orders", ["patient_id"])
    op.create_index("ix_lo_created_at",  "lab_orders", ["created_at"])

    # ── lab_tests (child rows of lab_orders) ──────────────────────────────────
    op.create_table(
        "lab_tests",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("lab_order_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_name",    sa.String(255), nullable=False),
        sa.Column("test_code",    sa.String(100), nullable=False),
        sa.Column("normal_range", sa.String(100), nullable=True),
        sa.Column("unit",         sa.String(50),  nullable=True),
        sa.Column("price",        sa.Float(),     nullable=False, server_default="0"),
        sa.Column("result_value", sa.String(100), nullable=True),
        sa.Column("is_abnormal",  sa.Boolean(),   nullable=True),
    )
    op.create_index("ix_lt_lab_order_id", "lab_tests", ["lab_order_id"])

    # ── support_tickets ───────────────────────────────────────────────────────
    op.create_table(
        "support_tickets",
        sa.Column("id",                  postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id",          postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticket_number",       sa.String(50),   nullable=False, unique=True),
        sa.Column("category",            sa.String(50),   nullable=False),
        sa.Column("subject",             sa.String(500),  nullable=False),
        sa.Column("description",         sa.Text(),       nullable=False),
        sa.Column("status",              sa.String(30),   nullable=False, server_default="'open'"),
        sa.Column("priority",            sa.String(20),   nullable=False, server_default="'medium'"),
        sa.Column("reference_id",        sa.String(100),  nullable=True),
        sa.Column("reference_type",      sa.String(30),   nullable=True),
        sa.Column("sla_deadline",        sa.DateTime(),   nullable=False),
        sa.Column("partner_message",     sa.Text(),       nullable=True),
        sa.Column("partner_visible_note",sa.Text(),       nullable=True),
        sa.Column("internal_notes",      sa.Text(),       nullable=True),
        sa.Column("assigned_to",         sa.String(255),  nullable=True),
        sa.Column("resolved_at",         sa.DateTime(),   nullable=True),
        sa.Column("created_at",          sa.DateTime(),   nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at",          sa.DateTime(),   nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_st_partner_id",    "support_tickets", ["partner_id"])
    op.create_index("ix_st_status",        "support_tickets", ["status"])
    op.create_index("ix_st_priority",      "support_tickets", ["priority"])
    op.create_index("ix_st_sla_deadline",  "support_tickets", ["sla_deadline"])


def downgrade() -> None:
    op.drop_table("support_tickets")
    op.drop_table("lab_tests")
    op.drop_table("lab_orders")
    op.drop_table("queue_items")
    op.drop_table("prescription_queues")
