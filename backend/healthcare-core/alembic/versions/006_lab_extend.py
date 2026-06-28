"""extend lab order items with unit/reference_range/remarks + report file_url

Revision ID: 006_lab_extend
Revises: 0007_doctor_notif
Create Date: 2026-06-19 00:00:00.000000

005_lab.py created lab_tests / lab_orders / lab_order_items with a sound
normalized schema, but lab_results.py (the API module that was supposed to
use it) never existed in the repo. Rebuilding that module against the
LabDashboard.tsx frontend contract surfaced a few fields the original
migration didn't have: per-result unit/reference_range/clinical_remarks,
and a report attachment URL on the order. Adding them here rather than
reshaping 005_lab.py, since it may already be applied in some environments.

NOTE: chained after "0007_doctor_notif" (the actual revision id inside
0007_doctor_notifications.py -- filename and revision id differ here), not
"005_lab" directly. 0006_doctor_schedule_system.py already branches off
005_lab, so pointing here at 005_lab too would create two diverging heads
and break `alembic upgrade head`. Verified the full chain is linear with
this as the single head: 001_initial -> 6df9cf33819a -> a5f82bb547d2 ->
002_ticket_system -> 003_hospyn_employees_ticket_hierarchy -> 003_billing
-> 004_pharmacy -> 005_lab -> 0006_doctor_schedule -> 0007_doctor_notif
-> 006_lab_extend.
"""
from alembic import op
import sqlalchemy as sa

revision = "006_lab_extend"
down_revision = "0007_doctor_notif"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lab_order_items", sa.Column("unit", sa.String(50), nullable=True))
    op.add_column("lab_order_items", sa.Column("reference_range", sa.String(100), nullable=True))
    op.add_column("lab_order_items", sa.Column("clinical_remarks", sa.Text(), nullable=True))
    op.add_column("lab_orders", sa.Column("file_url", sa.String(500), nullable=True))
    op.add_column("lab_orders", sa.Column("updated_at", sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column("lab_orders", "updated_at")
    op.drop_column("lab_orders", "file_url")
    op.drop_column("lab_order_items", "clinical_remarks")
    op.drop_column("lab_order_items", "reference_range")
    op.drop_column("lab_order_items", "unit")
