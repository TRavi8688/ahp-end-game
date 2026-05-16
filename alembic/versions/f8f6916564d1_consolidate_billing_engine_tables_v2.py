"""Consolidate Billing Engine tables v2

Revision ID: f8f6916564d1
Revises: 552354cb97e6
Create Date: 2026-05-16 01:27:42.314654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8f6916564d1'
down_revision: Union[str, Sequence[str], None] = '552354cb97e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Skipping hospital_invites cleanup to avoid SQLite index sync issues
    pass
    with op.batch_alter_table('admissions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('allergies', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('beds', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('clinical_ai_events', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('clinical_events', schema=None) as batch_op:
        batch_op.alter_column('tenant_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('clinician_overrides', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('conditions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('daily_hospital_metrics', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('digital_prescriptions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               nullable=False,
               existing_server_default=sa.text('(CURRENT_TIMESTAMP)'))

    with op.batch_alter_table('fhir_resources', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        batch_op.add_column(sa.Column('verification_status', sa.Enum('pending', 'basic_verified', 'identity_verified', 'otp_verified', 'completed', name='verificationstatusenum'), nullable=False))
        batch_op.add_column(sa.Column('is_approved', sa.Boolean(), nullable=False))
        batch_op.add_column(sa.Column('payment_status', sa.String(length=50), nullable=False))
        batch_op.add_column(sa.Column('staff_count', sa.Integer(), nullable=False))
        batch_op.add_column(sa.Column('owner_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('certificate_url', sa.String(length=512), nullable=True))
        batch_op.alter_column('id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.create_foreign_key('fk_hospitals_owner_id', 'users', ['owner_id'], ['id'])

    with op.batch_alter_table('insurance_claims', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('lab_diagnostic_orders', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('lab_results', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               nullable=False)
        batch_op.drop_index(batch_op.f('ix_lab_results_record_id'))
        batch_op.create_foreign_key('fk_lab_results_hospital_id', 'hospitals', ['hospital_id'], ['id'])
        batch_op.drop_column('record_id')
        batch_op.drop_column('family_member_id')
        batch_op.drop_column('observation_date')

    with op.batch_alter_table('lab_test_master', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('medical_devices', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('medical_records', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('medications', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('outbox_events', schema=None) as batch_op:
        batch_op.alter_column('tenant_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('patient_dashboards', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('patient_risk_profiles', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('patient_visits', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('payment_method',
               existing_type=sa.VARCHAR(length=11),
               type_=sa.Enum('CASH', 'UPI', 'CARD', 'NET_BANKING', 'INSURANCE', 'BANK_TRANSFER', 'OTHER', name='paymentmethod'),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_inventory', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_stock', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_stock_ledger', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('purchase_orders', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('queue_entries', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('queue_tokens', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    with op.batch_alter_table('staff_profiles', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('tele_consultations', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('wearable_data', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=True)

    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('wearable_data', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('tele_consultations', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('staff_profiles', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('queue_tokens', schema=None) as batch_op:
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('queue_entries', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('purchase_orders', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_stock_ledger', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_stock', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('pharmacy_inventory', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.alter_column('payment_method',
               existing_type=sa.Enum('CASH', 'UPI', 'CARD', 'NET_BANKING', 'INSURANCE', 'BANK_TRANSFER', 'OTHER', name='paymentmethod'),
               type_=sa.VARCHAR(length=11),
               existing_nullable=False)
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('patient_visits', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('patient_risk_profiles', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('patient_dashboards', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('outbox_events', schema=None) as batch_op:
        batch_op.alter_column('tenant_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('medications', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('medical_records', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('medical_devices', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('lab_test_master', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('lab_results', schema=None) as batch_op:
        batch_op.add_column(sa.Column('observation_date', sa.DATETIME(), nullable=True))
        batch_op.add_column(sa.Column('family_member_id', sa.CHAR(length=32), nullable=True))
        batch_op.add_column(sa.Column('record_id', sa.CHAR(length=32), nullable=False))
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(None, 'hospitals', ['hospital_id'], ['id'], ondelete='RESTRICT')
        batch_op.create_foreign_key(None, 'family_members', ['family_member_id'], ['id'])
        batch_op.create_foreign_key(None, 'medical_records', ['record_id'], ['id'])
        batch_op.create_index(batch_op.f('ix_lab_results_record_id'), ['record_id'], unique=False)
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               nullable=True)

    with op.batch_alter_table('lab_diagnostic_orders', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('insurance_claims', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)
        batch_op.drop_column('certificate_url')
        batch_op.drop_column('owner_id')
        batch_op.drop_column('staff_count')
        batch_op.drop_column('payment_status')
        batch_op.drop_column('is_approved')
        batch_op.drop_column('verification_status')

    with op.batch_alter_table('fhir_resources', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('digital_prescriptions', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               nullable=True,
               existing_server_default=sa.text('(CURRENT_TIMESTAMP)'))
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('daily_hospital_metrics', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('conditions', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('clinician_overrides', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('clinical_events', schema=None) as batch_op:
        batch_op.alter_column('tenant_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('clinical_ai_events', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('beds', schema=None) as batch_op:
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('allergies', schema=None) as batch_op:
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)

    with op.batch_alter_table('admissions', schema=None) as batch_op:
        batch_op.alter_column('last_modified_by_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=True)
        batch_op.alter_column('hospital_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    op.create_table('hospital_invites',
    sa.Column('id', sa.CHAR(length=32), nullable=False),
    sa.Column('hospital_id', sa.NUMERIC(), nullable=False),
    sa.Column('email', sa.VARCHAR(length=255), nullable=False),
    sa.Column('token_hash', sa.VARCHAR(length=255), nullable=False),
    sa.Column('role', sa.VARCHAR(length=50), nullable=False),
    sa.Column('is_used', sa.BOOLEAN(), nullable=False),
    sa.Column('expires_at', sa.DATETIME(), nullable=False),
    sa.Column('created_at', sa.DATETIME(), nullable=False),
    sa.Column('hospyn_id', sa.VARCHAR(length=50), nullable=False),
    sa.Column('created_by', sa.CHAR(length=32), nullable=True),
    sa.Column('ip_address', sa.VARCHAR(length=45), nullable=True),
    sa.Column('used_at', sa.DATETIME(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('hospital_invites', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_hospital_invites_hospyn_id'), ['hospyn_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_hospital_invites_hospital_id'), ['hospital_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_hospital_invites_email'), ['email'], unique=False)

    # ### end Alembic commands ###
