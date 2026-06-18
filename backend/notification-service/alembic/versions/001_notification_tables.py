"""create notification tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

channel_enum = ENUM(
    "sms", "push", "email", "in_app",
    name="notification_channel",
    create_type=True,
)

type_enum = ENUM(
    "otp", "appointment_reminder", "appointment_confirmed",
    "appointment_cancelled", "prescription_ready", "lab_result_ready",
    "payment_received", "system_alert", "staff_alert",
    name="notification_type",
    create_type=True,
)

status_enum = ENUM(
    "pending", "sent", "delivered", "failed", "cancelled",
    name="notification_status",
    create_type=True,
)


def upgrade() -> None:
    channel_enum.create(op.get_bind(), checkfirst=True)
    type_enum.create(op.get_bind(), checkfirst=True)
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hospital_id", UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("channel", channel_enum, nullable=False),
        sa.Column("type", type_enum, nullable=False),
        sa.Column("status", status_enum, nullable=False, server_default="pending"),
        sa.Column("recipient", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_reason", sa.Text, nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_hospital_id", "notifications", ["hospital_id"])
    op.create_index("ix_notifications_status", "notifications", ["status"])
    op.create_index("ix_notifications_type", "notifications", ["type"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    status_enum.drop(op.get_bind(), checkfirst=True)
    type_enum.drop(op.get_bind(), checkfirst=True)
    channel_enum.drop(op.get_bind(), checkfirst=True)
