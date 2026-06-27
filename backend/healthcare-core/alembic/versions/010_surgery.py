"""Add surgeries table

Revision ID: 010_surgery
Revises: 009_hospin_matrix_3
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010_surgery'
down_revision = '009_hospin_matrix_3'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surgerystatus') THEN 
                CREATE TYPE surgerystatus AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'); 
            END IF; 
        END 
        $$;
    """)
    op.create_table(
        'surgeries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('hospital_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hospitals.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('surgeon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('anesthetist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('procedure_name', sa.String(500), nullable=False),
        sa.Column('icd10_code', sa.String(20), nullable=True),
        sa.Column('scheduled_at', sa.DateTime, nullable=True),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('ot_room', sa.String(50), nullable=True),
        sa.Column('status', postgresql.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED', name='surgerystatus', create_type=False), nullable=False, server_default='SCHEDULED'),
        sa.Column('pre_op_notes', sa.Text, nullable=True),
        sa.Column('post_op_notes', sa.Text, nullable=True),
        sa.Column('consent_obtained', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_surgeries_patient_id', 'surgeries', ['patient_id'])
    op.create_index('ix_surgeries_hospital_id', 'surgeries', ['hospital_id'])


def downgrade():
    op.drop_table('surgeries')
    op.execute("DROP TYPE IF EXISTS surgerystatus")
