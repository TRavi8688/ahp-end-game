"""Add advanced laboratory and pathology schemas

Revision ID: 552354cb97e6
Revises: 0390b57ae70c
Create Date: 2026-05-15 12:45:14.335391

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '552354cb97e6'
down_revision: Union[str, Sequence[str], None] = '0390b57ae70c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- LAB TEST MASTER ---
    op.create_table('lab_test_master',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('hospital_id', sa.UUID(), nullable=False),
        sa.Column('test_name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.Enum('PATHOLOGY', 'RADIOLOGY', 'CARDIOLOGY', 'OTHER', name='labtestcategory'), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('reference_range', sa.String(length=100), nullable=True),
        sa.Column('base_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('lab_test_master', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_lab_test_master_code'), ['code'], unique=False)
        batch_op.create_index(batch_op.f('ix_lab_test_master_hospital_id'), ['hospital_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_lab_test_master_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_lab_test_master_test_name'), ['test_name'], unique=False)

    # --- LAB DIAGNOSTIC ORDERS UPGRADE ---
    with op.batch_alter_table('lab_diagnostic_orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('visit_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('prescription_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('sample_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False))
        batch_op.create_index(batch_op.f('ix_lab_diagnostic_orders_sample_id'), ['sample_id'], unique=False)
        batch_op.create_foreign_key('fk_lab_orders_visit', 'patient_visits', ['visit_id'], ['id'])
        batch_op.create_foreign_key('fk_lab_orders_prescription', 'digital_prescriptions', ['prescription_id'], ['id'])

    # --- LAB RESULTS UPGRADE ---
    with op.batch_alter_table('lab_results', schema=None) as batch_op:
        batch_op.add_column(sa.Column('order_id', sa.Uuid(), nullable=False))
        batch_op.add_column(sa.Column('clinical_remarks', sa.Text(), nullable=True))
        batch_op.create_index(batch_op.f('ix_lab_results_order_id'), ['order_id'], unique=False)
        batch_op.create_foreign_key('fk_lab_results_order', 'lab_diagnostic_orders', ['order_id'], ['id'])
        # Drop legacy columns if they exist (manual check for safety in production)
        # batch_op.drop_column('family_member_id')
        # batch_op.drop_column('observation_date')
        # batch_op.drop_column('record_id')


def downgrade() -> None:
    with op.batch_alter_table('lab_results', schema=None) as batch_op:
        batch_op.drop_constraint('fk_lab_results_order', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_lab_results_order_id'))
        batch_op.drop_column('clinical_remarks')
        batch_op.drop_column('order_id')

    with op.batch_alter_table('lab_diagnostic_orders', schema=None) as batch_op:
        batch_op.drop_constraint('fk_lab_orders_prescription', type_='foreignkey')
        batch_op.drop_constraint('fk_lab_orders_visit', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_lab_diagnostic_orders_sample_id'))
        batch_op.drop_column('updated_at')
        batch_op.drop_column('collected_at')
        batch_op.drop_column('sample_id')
        batch_op.drop_column('prescription_id')
        batch_op.drop_column('visit_id')

    with op.batch_alter_table('lab_test_master', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_lab_test_master_test_name'))
        batch_op.drop_index(batch_op.f('ix_lab_test_master_id'))
        batch_op.drop_index(batch_op.f('ix_lab_test_master_hospital_id'))
        batch_op.drop_index(batch_op.f('ix_lab_test_master_code'))

    op.drop_table('lab_test_master')
