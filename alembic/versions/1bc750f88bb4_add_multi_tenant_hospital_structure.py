"""Add multi-tenant hospital structure

Revision ID: 1bc750f88bb4
Revises: 61f0cb3f76c4
Create Date: 2026-05-07 07:48:59.660784

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1bc750f88bb4'
down_revision: Union[str, Sequence[str], None] = '61f0cb3f76c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('hospitals',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('version_id', sa.Integer(), nullable=False),

    sa.Column('name', sa.String(length=255), nullable=False),

    sa.Column('registration_number', sa.String(length=100), nullable=False),

    sa.Column('subscription_status', sa.String(length=50), nullable=False),

    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('hospitals', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_hospitals_id'), ['id'], unique=False)

        batch_op.create_index(batch_op.f('ix_hospitals_name'), ['name'], unique=False)

        batch_op.create_index(batch_op.f('ix_hospitals_registration_number'), ['registration_number'], unique=True)



    op.create_table('job_failures',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('job_id', sa.String(length=100), nullable=False),

    sa.Column('function_name', sa.String(length=100), nullable=False),

    sa.Column('args', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),

    sa.Column('error', sa.Text(), nullable=False),

    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('job_failures', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_job_failures_id'), ['id'], unique=False)

        batch_op.create_index(batch_op.f('ix_job_failures_job_id'), ['job_id'], unique=False)



    op.create_table('departments',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('hospital_id', sa.Integer(), nullable=False),

    sa.Column('name', sa.String(length=100), nullable=False),

    sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('departments', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_departments_id'), ['id'], unique=False)



    op.create_table('messages',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('conversation_id', sa.String(length=50), nullable=False),

    sa.Column('user_id', sa.Integer(), nullable=False),

    sa.Column('role', sa.String(50), nullable=False),

    sa.Column('content', sa.Text(), nullable=False),

    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('messages', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_messages_conversation_id'), ['conversation_id'], unique=False)

        batch_op.create_index(batch_op.f('ix_messages_id'), ['id'], unique=False)

        batch_op.create_index(batch_op.f('ix_messages_user_id'), ['user_id'], unique=False)



    op.create_table('queue_entries',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('hospital_id', sa.Integer(), nullable=True),

    sa.Column('department_id', sa.Integer(), nullable=True),

    sa.Column('patient_id', sa.Integer(), nullable=False),

    sa.Column('doctor_id', sa.Integer(), nullable=True),

    sa.Column('clinic_name', sa.String(length=255), nullable=True),

    sa.Column('status', sa.String(50), nullable=False),

    sa.Column('token_number', sa.Integer(), nullable=True),

    sa.Column('check_in_time', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

    sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),

    sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ),

    sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),

    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('queue_entries', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_queue_entries_id'), ['id'], unique=False)



    op.create_table('staff_profiles',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('version_id', sa.Integer(), nullable=False),

    sa.Column('user_id', sa.Integer(), nullable=False),

    sa.Column('hospital_id', sa.Integer(), nullable=False),

    sa.Column('department_id', sa.Integer(), nullable=True),

    sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),

    sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),

    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('staff_profiles', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_staff_profiles_id'), ['id'], unique=False)



    op.create_table('record_shares',

    sa.Column('id', sa.Integer(), nullable=False),

    sa.Column('patient_id', sa.Integer(), nullable=False),

    sa.Column('record_id', sa.Integer(), nullable=False),

    sa.Column('doctor_query', sa.String(length=255), nullable=False),

    sa.Column('doctor_user_id', sa.Integer(), nullable=True),

    sa.Column('share_token', sa.String(length=64), nullable=False),

    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),

    sa.Column('accessed', sa.Boolean(), nullable=False),

    sa.Column('revoked', sa.Boolean(), nullable=False),

    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

    sa.ForeignKeyConstraint(['doctor_user_id'], ['users.id'], ),

    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),

    sa.ForeignKeyConstraint(['record_id'], ['medical_records.id'], ),

    sa.PrimaryKeyConstraint('id')

    )

    with op.batch_alter_table('record_shares', schema=None) as batch_op:

        batch_op.create_index(batch_op.f('ix_record_shares_id'), ['id'], unique=False)

        batch_op.create_index(batch_op.f('ix_record_shares_patient_id'), ['patient_id'], unique=False)

        batch_op.create_index(batch_op.f('ix_record_shares_record_id'), ['record_id'], unique=False)

        batch_op.create_index(batch_op.f('ix_record_shares_share_token'), ['share_token'], unique=True)



    with op.batch_alter_table('allergies', schema=None) as batch_op:

        batch_op.alter_column('added_by',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('audit_logs', schema=None) as batch_op:

        op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS signature VARCHAR(255)'))

        op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(255)'))

        batch_op.alter_column('resource_type',

               existing_type=sa.VARCHAR(length=100),

               type_=sa.String(length=50),

               existing_nullable=False)

        batch_op.alter_column('ip_address',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(length=45),

               existing_nullable=True)

        batch_op.alter_column('user_agent',

               existing_type=sa.TEXT(),

               type_=sa.String(length=255),

               existing_nullable=True)

        op.execute(sa.text('DROP INDEX IF EXISTS ix_audit_logs_patient_id'))

        op.execute(sa.text('DROP INDEX IF EXISTS ix_audit_logs_resource_id'))

        op.execute(sa.text('DROP INDEX IF EXISTS ix_audit_logs_user_id'))

        batch_op.create_index(batch_op.f('ix_audit_logs_action'), ['action'], unique=False)



    with op.batch_alter_table('conditions', schema=None) as batch_op:

        batch_op.alter_column('added_by',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('doctor_access', schema=None) as batch_op:

        batch_op.alter_column('access_level',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)

        batch_op.alter_column('status',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('doctor_verification_sessions', schema=None) as batch_op:

        batch_op.alter_column('status',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('doctors', schema=None) as batch_op:

        op.execute(sa.text('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS version_id INTEGER'))

        batch_op.alter_column('license_status',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('medical_records', schema=None) as batch_op:

        op.execute(sa.text('ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS version_id INTEGER'))

        batch_op.alter_column('type',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('medications', schema=None) as batch_op:

        batch_op.alter_column('added_by',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('notifications', schema=None) as batch_op:

        batch_op.alter_column('type',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)



    with op.batch_alter_table('patients', schema=None) as batch_op:

        op.execute(sa.text('ALTER TABLE patients ADD COLUMN IF NOT EXISTS version_id INTEGER'))



    with op.batch_alter_table('users', schema=None) as batch_op:

        op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS version_id INTEGER'))

        op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS insforge_id VARCHAR(255)'))

        batch_op.alter_column('role',

               existing_type=sa.VARCHAR(length=50),

               type_=sa.String(50),

               existing_nullable=False)

        batch_op.create_index(batch_op.f('ix_users_insforge_id'), ['insforge_id'], unique=True)



    # ### end Alembic commands ###





def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_users_insforge_id'))
        batch_op.alter_column('role',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
        batch_op.drop_column('insforge_id')
        batch_op.drop_column('version_id')

    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.drop_column('version_id')

    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.alter_column('type',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('medications', schema=None) as batch_op:
        batch_op.alter_column('added_by',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('medical_records', schema=None) as batch_op:
        batch_op.alter_column('type',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
        batch_op.drop_column('version_id')

    with op.batch_alter_table('doctors', schema=None) as batch_op:
        batch_op.alter_column('license_status',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
        batch_op.drop_column('version_id')

    with op.batch_alter_table('doctor_verification_sessions', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('doctor_access', schema=None) as batch_op:
        batch_op.alter_column('status',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
        batch_op.alter_column('access_level',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('conditions', schema=None) as batch_op:
        batch_op.alter_column('added_by',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_audit_logs_action'))
        batch_op.create_index(batch_op.f('ix_audit_logs_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_resource_id'), ['resource_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_patient_id'), ['patient_id'], unique=False)
        batch_op.alter_column('user_agent',
               existing_type=sa.String(length=255),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('ip_address',
               existing_type=sa.String(length=45),
               type_=sa.VARCHAR(length=50),
               existing_nullable=True)
        batch_op.alter_column('resource_type',
               existing_type=sa.String(length=50),
               type_=sa.VARCHAR(length=100),
               existing_nullable=False)
        batch_op.drop_column('prev_hash')
        batch_op.drop_column('signature')

    with op.batch_alter_table('allergies', schema=None) as batch_op:
        batch_op.alter_column('added_by',
               existing_type=sa.String(50),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)

    with op.batch_alter_table('record_shares', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_record_shares_share_token'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_record_shares_record_id'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_record_shares_patient_id'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_record_shares_id'))

    op.drop_table('record_shares')
    with op.batch_alter_table('staff_profiles', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_staff_profiles_id'))

    op.drop_table('staff_profiles')
    with op.batch_alter_table('queue_entries', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_queue_entries_id'))

    op.drop_table('queue_entries')
    with op.batch_alter_table('messages', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_messages_user_id'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_messages_id'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_messages_conversation_id'))

    op.drop_table('messages')
    with op.batch_alter_table('departments', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_departments_id'))

    op.drop_table('departments')
    with op.batch_alter_table('job_failures', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_job_failures_job_id'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_job_failures_id'))

    op.drop_table('job_failures')
    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        op.execute(sa.text('DROP INDEX IF EXISTS ix_hospitals_registration_number'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_hospitals_name'))
        op.execute(sa.text('DROP INDEX IF EXISTS ix_hospitals_id'))

    op.drop_table('hospitals')
    # ### end Alembic commands ###