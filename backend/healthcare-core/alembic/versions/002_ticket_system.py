"""
backend/healthcare-core/alembic/versions/002_ticket_system.py

Migration: Create ticket system tables.
Run: alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '002_ticket_system'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade():
    # ── support_tickets ───────────────────────────────────────────────────────
    op.create_table(
        'support_tickets',
        sa.Column('ticket_id',        sa.String(20),  primary_key=True),
        sa.Column('category',         sa.String(50),  nullable=False),
        sa.Column('priority',         sa.String(20),  nullable=False, server_default='medium'),
        sa.Column('product',          sa.String(50),  nullable=False, server_default='hospyn_web'),
        sa.Column('subject',          sa.String(120), nullable=False),
        sa.Column('description',      sa.Text(),      nullable=False),
        sa.Column('owner_email',      sa.String(255), nullable=True),
        sa.Column('org_name',         sa.String(255), nullable=True),
        sa.Column('owner_phone',      sa.String(20),  nullable=True),
        sa.Column('status',           sa.String(30),  nullable=False, server_default='open'),
        sa.Column('team',             sa.String(50),  nullable=True),
        sa.Column('assigned_to',      sa.String(255), nullable=True),
        sa.Column('sla_hours',        sa.Integer(),   nullable=True),
        sa.Column('call_required',    sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('rating',           sa.Integer(),   nullable=True),
        sa.Column('last_message',     sa.String(200), nullable=True),
        sa.Column('last_message_sender', sa.String(20), nullable=True),
        sa.Column('attachment_url',   sa.String(500), nullable=True),
        sa.Column('created_at',       sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at',       sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at',      sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index('ix_support_tickets_owner_email', 'support_tickets', ['owner_email'])
    op.create_index('ix_support_tickets_status',      'support_tickets', ['status'])
    op.create_index('ix_support_tickets_team',        'support_tickets', ['team'])
    op.create_index('ix_support_tickets_priority',    'support_tickets', ['priority'])
    op.create_index('ix_support_tickets_created_at',  'support_tickets', ['created_at'])

    # ── ticket_messages ───────────────────────────────────────────────────────
    op.create_table(
        'ticket_messages',
        sa.Column('id',            UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_id',     sa.String(20),  nullable=False),
        sa.Column('sender',        sa.String(20),  nullable=False),   # owner | agent
        sa.Column('sender_label',  sa.String(255), nullable=True),
        sa.Column('text',          sa.Text(),      nullable=False),
        sa.Column('read_by_owner', sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('read_by_agent', sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('created_at',    sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.ticket_id'], ondelete='CASCADE'),
    )

    op.create_index('ix_ticket_messages_ticket_id', 'ticket_messages', ['ticket_id'])

    # ── ticket_internal_notes ─────────────────────────────────────────────────
    op.create_table(
        'ticket_internal_notes',
        sa.Column('id',         UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_id',  sa.String(20),  nullable=False),
        sa.Column('note',       sa.Text(),      nullable=False),
        sa.Column('author',     sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.ticket_id'], ondelete='CASCADE'),
    )

    op.create_index('ix_ticket_notes_ticket_id', 'ticket_internal_notes', ['ticket_id'])


def downgrade():
    op.drop_table('ticket_internal_notes')
    op.drop_table('ticket_messages')
    op.drop_table('support_tickets')
