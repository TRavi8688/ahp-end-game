"""
0007_doctor_notifications.py
Phase 4 — Doctor App: local notifications table.

DROP-IN INSTRUCTIONS:
  Save as: backend/healthcare-core/alembic/versions/0007_doctor_notifications.py
  Chains directly after 0006_doctor_schedule_system.py — apply that one first.
"""

from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007_doctor_notif"
down_revision: Union[str, None] = "0006_doctor_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "doctor_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.String(1000), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_doctor_notifications_doctor_id", "doctor_notifications", ["doctor_id"])
    op.create_index("ix_doctor_notifications_created_at", "doctor_notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("doctor_notifications")
