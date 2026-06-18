"""phase3 patient device tokens — FIXED

Revision ID: a7f3e9c21b84
Revises: b2c4e6f8a1d3
Create Date: 2026-06-05

FIX: down_revision stays as 'b2c4e6f8a1d3' (dpdp tables).
     Chain is now: d3e4f5a6b7c8 → b2c4e6f8a1d3 → a7f3e9c21b84 → c3d5f7a9b2e4
     (No change to this file's down_revision — it was already correct after
      the dpdp file's down_revision was fixed.)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a7f3e9c21b84'
down_revision = 'b2c4e6f8a1d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # patient_device_tokens — push notification targets per patient device
    op.create_table(
        'patient_device_tokens',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'patient_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('patients.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('device_token', sa.Text, nullable=False),
        sa.Column('platform', sa.String(20), nullable=False),  # ios / android / web
        sa.Column('device_name', sa.String(255), nullable=True),
        sa.Column('app_version', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('patient_id', 'device_token', name='uq_patient_device_token'),
    )

    # device_notification_preferences — per-device notification opt-in/out
    op.create_table(
        'device_notification_preferences',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'device_token_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('patient_device_tokens.id', ondelete='CASCADE'),
            nullable=False,
            unique=True,
        ),
        sa.Column('appointments', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('lab_results', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('prescriptions', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('billing', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('marketing', sa.Boolean, nullable=False, server_default='false'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index('ix_patient_device_tokens_patient_id', 'patient_device_tokens', ['patient_id'])
    op.create_index('ix_patient_device_tokens_active', 'patient_device_tokens', ['patient_id', 'is_active'])


def downgrade() -> None:
    op.drop_index('ix_patient_device_tokens_active', table_name='patient_device_tokens')
    op.drop_index('ix_patient_device_tokens_patient_id', table_name='patient_device_tokens')
    op.drop_table('device_notification_preferences')
    op.drop_table('patient_device_tokens')
