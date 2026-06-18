"""create queue_events table

Revision ID: b1f92cc648e4
Revises: a6f82bb547d3
Create Date: 2026-06-07 13:00:00.000000

Creates the queue_events audit table used to track every state transition
in the walk-in queue pipeline (reception → triage → doctor → completed).
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "b1f92cc648e4"
down_revision: Union[str, None] = "a6f82bb547d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "queue_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("walkin_request_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("old_status", sa.String(length=50), nullable=False),
        sa.Column("new_status", sa.String(length=50), nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["walkin_request_id"],
            ["walkin_requests.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_queue_events_id"),
        "queue_events",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_queue_events_walkin_request_id",
        "queue_events",
        ["walkin_request_id"],
        unique=False,
    )
    op.create_index(
        "ix_queue_events_event_type",
        "queue_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_queue_events_actor_user_id",
        "queue_events",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_queue_events_created_at",
        "queue_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_queue_events_created_at", table_name="queue_events")
    op.drop_index("ix_queue_events_actor_user_id", table_name="queue_events")
    op.drop_index("ix_queue_events_event_type", table_name="queue_events")
    op.drop_index("ix_queue_events_walkin_request_id", table_name="queue_events")
    op.drop_index(op.f("ix_queue_events_id"), table_name="queue_events")
    op.drop_table("queue_events")
