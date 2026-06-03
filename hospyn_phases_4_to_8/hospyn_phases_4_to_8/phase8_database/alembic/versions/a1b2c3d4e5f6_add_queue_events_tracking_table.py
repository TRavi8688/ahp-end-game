"""add_queue_events_tracking_table

Revision ID: a1b2c3d4e5f6
Revises: (set this to your current latest migration revision ID)
Create Date: 2026-06-03

Phase 8 Fix: Create the queue_events table for WebSocket event tracking.
The WebSocket /ws endpoint emits queue events in real-time but there was no
persistent audit trail of queue state changes.

APPLY TO: alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py

BEFORE RUNNING:
  1. Check your current Alembic head:
       alembic history | head -5
  2. Replace the `down_revision` value below with your actual latest revision ID.
  3. Run: alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = None  # REPLACE WITH YOUR CURRENT HEAD REVISION ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create queue_events table for walk-in queue state change tracking."""

    op.create_table(
        'queue_events',
        # Primary key
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),

        # References
        sa.Column(
            'walkin_id',
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment='References walk_in_tokens.id — the queue token this event belongs to',
        ),
        sa.Column(
            'hospital_id',
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment='Hospital this event belongs to — for multi-tenant partitioning',
        ),
        sa.Column(
            'actor_id',
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment='The staff user who triggered this event (NULL for system events)',
        ),

        # Event details
        sa.Column(
            'event_type',
            sa.String(50),
            nullable=False,
            comment='e.g. status_changed, doctor_assigned, triage_completed, patient_called',
        ),
        sa.Column(
            'previous_status',
            sa.String(50),
            nullable=True,
            comment='Walk-in status before this event',
        ),
        sa.Column(
            'new_status',
            sa.String(50),
            nullable=True,
            comment='Walk-in status after this event',
        ),

        # Flexible metadata
        sa.Column(
            'metadata',
            postgresql.JSONB(),
            nullable=True,
            comment='Additional event data: doctor_id, room_number, triage_score, etc.',
        ),

        # Timestamp
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Performance indexes
    op.create_index(
        'ix_queue_events_walkin_id',
        'queue_events',
        ['walkin_id'],
        comment='Fast lookup of all events for a walk-in token',
    )
    op.create_index(
        'ix_queue_events_hospital_id',
        'queue_events',
        ['hospital_id'],
        comment='Fast lookup of all events for a hospital (for audit dashboards)',
    )
    op.create_index(
        'ix_queue_events_created_at',
        'queue_events',
        ['created_at'],
        comment='Time-range queries for reporting',
    )
    op.create_index(
        'ix_queue_events_hospital_created',
        'queue_events',
        ['hospital_id', 'created_at'],
        comment='Composite index for hospital+time queries (most common analytics pattern)',
    )


def downgrade() -> None:
    """Drop queue_events table and its indexes."""
    op.drop_index('ix_queue_events_hospital_created', table_name='queue_events')
    op.drop_index('ix_queue_events_created_at', table_name='queue_events')
    op.drop_index('ix_queue_events_hospital_id', table_name='queue_events')
    op.drop_index('ix_queue_events_walkin_id', table_name='queue_events')
    op.drop_table('queue_events')
