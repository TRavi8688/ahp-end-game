"""Merge heads: workflow-engine branch + walkin-pos-ops branch

Revision ID: 0010_merge_heads
Revises: 007_workflow_engine, 0009_walkin_pos_ops
Create Date: 2026-06-26 00:00:00.000000

FIXED: 008_enterprise_ticket_system.py's down_revision pointed at
"007_queue_lab_support", a revision id that does not exist anywhere in this
directory (likely a typo/leftover from a renamed or deleted file). That
broke `alembic upgrade head` outright -- Alembic can't locate that revision,
so migrations would fail to run at all from a fresh database.

The repo actually has two independent migration branches both forking off
0007_doctor_notif:
  - 0007_doctor_notif -> 006_lab_extend -> 007_workflow_engine
  - 0007_doctor_notif -> 0008_pharmacy_ledger_network ->
    0009_hospital_enabled_modules -> 0009_walkin_pos_ops

This is a no-op merge revision joining both into a single head, so
008_enterprise_ticket_system (next in the chain) has one real revision to
point at instead of a dangling reference.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_merge_heads"
down_revision = ("007_workflow_engine", "0009_walkin_pos_ops")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
