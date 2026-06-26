"""
backend/healthcare-core/alembic/versions/003_hospyn_employees_ticket_hierarchy.py

Creates:
  - hospyn_employees      : Hospyn internal staff with Employee IDs (HPN-FIN-L1-001)
  - ticket_assignments    : Full audit trail of every assignment/escalation
  - Updates support_tickets: adds assigned_employee_id, team, level columns
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '003_hospyn_emp_tickets'
down_revision = '002_ticket_system'
branch_labels = None
depends_on = None

TEAMS  = ('finance', 'engineering', 'onboarding', 'support', 'data')
LEVELS = ('l1', 'team_lead', 'manager', 'super_admin')


def upgrade():
    # Create ENUMs explicitly (create_type=False is set on inline sa.Enum)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_team') THEN
                CREATE TYPE employee_team AS ENUM ('finance', 'engineering', 'onboarding', 'support', 'data');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_level') THEN
                CREATE TYPE employee_level AS ENUM ('l1', 'team_lead', 'manager', 'super_admin');
            END IF;
        END $$;
    """)

    # ── hospyn_employees ──────────────────────────────────────────────────────
    op.create_table(
        'hospyn_employees',
        sa.Column('id',            UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id',   sa.String(30),  unique=True, nullable=False),  # HPN-FIN-L1-001
        sa.Column('full_name',     sa.String(200), nullable=False),
        sa.Column('email',         sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('team',          sa.Enum(*TEAMS,  name='employee_team', create_type=False),  nullable=False),
        sa.Column('level',         sa.Enum(*LEVELS, name='employee_level', create_type=False), nullable=False),
        # manager_id → the manager this employee reports to (NULL for managers/super_admin)
        sa.Column('manager_id',    UUID(as_uuid=True), nullable=True),
        # team_lead_id → the TL this L1 reports to (NULL for TLs and above)
        sa.Column('team_lead_id',  UUID(as_uuid=True), nullable=True),
        sa.Column('is_active',     sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('avatar_initials', sa.String(3), nullable=True),
        sa.Column('phone',         sa.String(20), nullable=True),
        sa.Column('created_by',    UUID(as_uuid=True), nullable=True),  # always super_admin id
        sa.Column('created_at',    sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at',    sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at',    sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_hospyn_employees_team',       'hospyn_employees', ['team'])
    op.create_index('ix_hospyn_employees_level',      'hospyn_employees', ['level'])
    op.create_index('ix_hospyn_employees_employee_id','hospyn_employees', ['employee_id'])
    op.create_index('ix_hospyn_employees_email',      'hospyn_employees', ['email'])

    # ── ticket_assignments  (full audit trail) ────────────────────────────────
    op.create_table(
        'ticket_assignments',
        sa.Column('id',            UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_id',     sa.String(20),  nullable=False),
        sa.Column('from_employee_id', sa.String(30), nullable=True),   # NULL = system/auto
        sa.Column('to_employee_id',   sa.String(30), nullable=False),
        sa.Column('action',        sa.String(30),  nullable=False),
        # action: assigned | reassigned | escalated | taken | resolved | closed
        sa.Column('note',          sa.Text(),      nullable=True),
        sa.Column('created_at',    sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_ticket_assignments_ticket_id', 'ticket_assignments', ['ticket_id'])
    op.create_index('ix_ticket_assignments_to',        'ticket_assignments', ['to_employee_id'])

    # ── Add columns to support_tickets ────────────────────────────────────────
    op.add_column('support_tickets', sa.Column('assigned_employee_id', sa.String(30), nullable=True))
    op.add_column('support_tickets', sa.Column('assigned_employee_name', sa.String(200), nullable=True))
    op.add_column('support_tickets', sa.Column('escalation_level', sa.String(20), nullable=True, server_default='l1'))
    # NOTE: owner_phone is NOT added here — it already exists from 002_ticket_system CREATE TABLE.
    op.create_index('ix_support_tickets_assigned', 'support_tickets', ['assigned_employee_id'])


def downgrade():
    op.drop_index('ix_support_tickets_assigned', 'support_tickets')
    op.drop_column('support_tickets', 'escalation_level')
    op.drop_column('support_tickets', 'assigned_employee_name')
    op.drop_column('support_tickets', 'assigned_employee_id')
    # NOTE: owner_phone is NOT dropped here — it belongs to 002_ticket_system.
    op.drop_table('ticket_assignments')
    op.drop_table('hospyn_employees')
    op.execute('DROP TYPE IF EXISTS employee_team')
    op.execute('DROP TYPE IF EXISTS employee_level')
