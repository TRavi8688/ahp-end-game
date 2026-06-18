"""dpdp compliance tables — FIXED

Revision ID: b2c4e6f8a1d3
Revises: c3d5f7a9b2e4
Create Date: 2026-06-05

FIX 1: down_revision changed from 'd3e4f5a6b7c8' to 'c3d5f7a9b2e4'
        so this migration sits at the END of the chain (after indexes),
        not creating a fork at d3e4f5a6b7c8.

FIX 2: Removed create_table for consent_records and data_deletion_requests —
        both are already created in c2g03dd759f5_create_missing_tables.py.
        Keeping them caused "relation already exists" crash on fresh DB.

FIX 3: Only creates data_breach_log (genuinely new) and adds 3 indexes
        that were missing from the c2g03dd759f5 version of consent_records.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c4e6f8a1d3'
down_revision = 'c3d5f7a9b2e4'   # ← FIXED: was 'd3e4f5a6b7c8' (created a fork)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── data_breach_log — genuinely new, not in c2g03dd759f5 ─────────────────
    # DPDP §8: 72-hour Data Protection Board notification requirement
    op.create_table(
        'data_breach_log',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'detected_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('affected_records_count', sa.Integer, nullable=True),
        sa.Column('notified_dpb', sa.Boolean, server_default='false', nullable=False),
        sa.Column('notified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('severity', sa.String(20), nullable=False),  # low/medium/high/critical
    )
    op.create_index(
        'ix_data_breach_log_severity',
        'data_breach_log',
        ['severity', 'detected_at'],
    )

    # ── Indexes missing from the c2g03dd759f5 version of consent_records ─────
    # c2g03dd759f5 only created ix_consent_records_patient_id.
    # These two composite indexes are new here.
    op.create_index(
        'ix_consent_records_hospital_id',
        'consent_records',
        ['hospital_id'],
    )
    op.create_index(
        'ix_consent_records_type_granted',
        'consent_records',
        ['consent_type', 'granted'],
    )

    # ── Index for data_deletion_requests.status (missing from c2g03dd759f5) ──
    op.create_index(
        'ix_data_deletion_requests_status',
        'data_deletion_requests',
        ['status'],
    )


def downgrade() -> None:
    op.drop_index('ix_data_deletion_requests_status', table_name='data_deletion_requests')
    op.drop_index('ix_consent_records_type_granted', table_name='consent_records')
    op.drop_index('ix_consent_records_hospital_id', table_name='consent_records')
    op.drop_index('ix_data_breach_log_severity', table_name='data_breach_log')
    op.drop_table('data_breach_log')
