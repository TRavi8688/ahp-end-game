"""add_appointments_source_type

Revision ID: fe40f4603a07
Revises: f656beec4b06
Create Date: 2026-06-27 19:07:33.479914
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'fe40f4603a07'
down_revision: Union[str, None] = 'f656beec4b06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create enum type
    op.execute("DO $$ BEGIN CREATE TYPE appointmentsource AS ENUM ('scheduled', 'walkin', 'receptionist'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    
    # 2. Add columns
    op.add_column('appointments', sa.Column('source_type', postgresql.ENUM('scheduled', 'walkin', 'receptionist', name='appointmentsource', create_type=False), server_default='scheduled', nullable=False))
    op.add_column('appointments', sa.Column('walkin_request_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('walkin_requests.id', ondelete='SET NULL'), nullable=True))
    op.create_index(op.f('ix_appointments_walkin_request_id'), 'appointments', ['walkin_request_id'], unique=False)

    # 3. Alter existing columns
    op.alter_column('appointments', 'patient_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_appointments_walkin_request_id'), table_name='appointments')
    op.drop_column('appointments', 'walkin_request_id')
    op.drop_column('appointments', 'source_type')
    op.execute("DROP TYPE IF EXISTS appointmentsource;")
