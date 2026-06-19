"""upgrade_prescription_schema_and_add_audit_log_indexes

Revision ID: 0390b57ae70c
Revises: d1a4f78ade9b
Create Date: 2026-05-15 12:31:44.251522

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0390b57ae70c'
down_revision: Union[str, Sequence[str], None] = 'd1a4f78ade9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Surgical Update for Digital Prescriptions
    with op.batch_alter_table('digital_prescriptions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('visit_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('diagnosis', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True))
        
        # Relax constraints for drafts
        batch_op.alter_column('qr_code_id', existing_type=sa.String(length=100), nullable=True)
        batch_op.alter_column('signature_hash', existing_type=sa.String(length=255), nullable=True)
        
        # Add Foreign Key to Visits
        batch_op.create_foreign_key('fk_prescription_visit', 'patient_visits', ['visit_id'], ['id'])

def downgrade() -> None:
    with op.batch_alter_table('digital_prescriptions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_prescription_visit', type_='foreignkey')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('diagnosis')
        batch_op.drop_column('visit_id')
        batch_op.alter_column('qr_code_id', existing_type=sa.String(length=100), nullable=False)
        batch_op.alter_column('signature_hash', existing_type=sa.String(length=255), nullable=False)
