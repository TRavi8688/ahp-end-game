"""seed default accounts

Revision ID: a1b2c3d4e5f6
Revises: b7c8d9e0f1a2
Create Date: 2026-06-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip seeding during unit tests to avoid test database contamination
    import sys
    if "pytest" in sys.modules:
        return

    # 1. Hashed password (Admin@Hospain2024!)
    default_hash = "$2b$12$AC7HVUHGBWXLgQZbJI7PhOGihtjrGbdooHJOzyOMi5WpsZO4CEbxW"

    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # --- Self-healing for missing tables/columns from skipped migrations ---
    
    # 1. hospyn_employees table
    if not inspector.has_table("hospyn_employees"):
        from sqlalchemy.dialects import postgresql
        op.execute("DO $$ BEGIN CREATE TYPE employee_team AS ENUM ('finance', 'engineering', 'onboarding', 'support', 'data'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.execute("DO $$ BEGIN CREATE TYPE employee_level AS ENUM ('l1', 'team_lead', 'manager', 'super_admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.execute("DO $$ BEGIN CREATE TYPE shift_status_enum AS ENUM ('online', 'offline', 'break', 'meeting', 'training', 'leave'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.create_table(
            'hospyn_employees',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('employee_id', sa.String(30), unique=True, nullable=False),
            sa.Column('full_name', sa.String(200), nullable=False),
            sa.Column('email', sa.String(255), unique=True, nullable=False),
            sa.Column('hashed_password', sa.String(255), nullable=False),
            sa.Column('team', postgresql.ENUM('finance', 'engineering', 'onboarding', 'support', 'data', name='employee_team', create_type=False), nullable=False),
            sa.Column('level', postgresql.ENUM('l1', 'team_lead', 'manager', 'super_admin', name='employee_level', create_type=False), nullable=False),
            sa.Column('manager_id', sa.UUID(as_uuid=True), nullable=True),
            sa.Column('team_lead_id', sa.UUID(as_uuid=True), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('avatar_initials', sa.String(3), nullable=True),
            sa.Column('phone', sa.String(20), nullable=True),
            sa.Column('created_by', sa.UUID(as_uuid=True), nullable=True),
            sa.Column('shift_status', postgresql.ENUM('online', 'offline', 'break', 'meeting', 'training', 'leave', name='shift_status_enum', create_type=False), nullable=False, server_default='offline'),
            sa.Column('skills', sa.ARRAY(sa.String()), nullable=True),
            sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('daily_ticket_limit', sa.Integer(), nullable=False, server_default='40'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_hospyn_employees_team', 'hospyn_employees', ['team'])
        op.create_index('ix_hospyn_employees_level', 'hospyn_employees', ['level'])
        op.create_index('ix_hospyn_employees_employee_id', 'hospyn_employees', ['employee_id'])
        op.create_index('ix_hospyn_employees_email', 'hospyn_employees', ['email'])

    # 2. ticket_assignments table
    if not inspector.has_table("ticket_assignments"):
        op.create_table(
            'ticket_assignments',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('ticket_id', sa.String(20), nullable=False),
            sa.Column('from_employee_id', sa.String(30), nullable=True),
            sa.Column('to_employee_id', sa.String(30), nullable=False),
            sa.Column('action', sa.String(30), nullable=False),
            sa.Column('note', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        )
        op.create_index('ix_ticket_assignments_ticket_id', 'ticket_assignments', ['ticket_id'])
        op.create_index('ix_ticket_assignments_to', 'ticket_assignments', ['to_employee_id'])

    # 3. support_tickets columns
    if inspector.has_table("support_tickets"):
        support_tickets_cols = [c["name"] for c in inspector.get_columns("support_tickets")]
        if "assigned_employee_id" not in support_tickets_cols:
            op.add_column('support_tickets', sa.Column('assigned_employee_id', sa.String(30), nullable=True))
            op.create_index('ix_support_tickets_assigned', 'support_tickets', ['assigned_employee_id'])
        if "assigned_employee_name" not in support_tickets_cols:
            op.add_column('support_tickets', sa.Column('assigned_employee_name', sa.String(200), nullable=True))
        if "escalation_level" not in support_tickets_cols:
            op.add_column('support_tickets', sa.Column('escalation_level', sa.String(20), nullable=True, server_default='l1'))

    # 4. staff table
    if not inspector.has_table("staff"):
        from sqlalchemy.dialects import postgresql
        op.execute("DO $$ BEGIN CREATE TYPE staffrole AS ENUM ('receptionist', 'nurse', 'admin', 'lab_technician', 'pharmacist'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.execute("DO $$ BEGIN CREATE TYPE shiftstatus AS ENUM ('on_duty', 'off_duty', 'on_break'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.create_table(
            "staff",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column("hospital_id", sa.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("first_name", sa.String(100), nullable=False),
            sa.Column("last_name", sa.String(100), nullable=False),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("role", postgresql.ENUM("receptionist", "nurse", "admin", "lab_technician", "pharmacist", name="staffrole", create_type=False), nullable=False),
            sa.Column("department", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("shift_status", postgresql.ENUM("on_duty", "off_duty", "on_break", name="shiftstatus", create_type=False), nullable=False, server_default="off_duty"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )

    # 5. hospitals table columns self-healing
    if inspector.has_table("hospitals"):
        hospitals_cols = [c["name"] for c in inspector.get_columns("hospitals")]
        if "license_number" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('license_number', sa.String(100), unique=True, nullable=True))
        if "email" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('email', sa.String(255), unique=True, nullable=True))
        if "phone" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('phone', sa.String(30), nullable=True))
        if "website" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('website', sa.String(255), nullable=True))
        if "address_line1" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('address_line1', sa.String(255), nullable=True))
        if "address_line2" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('address_line2', sa.String(255), nullable=True))
        if "city" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('city', sa.String(100), nullable=True))
        if "state" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('state', sa.String(100), nullable=True))
        if "country" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('country', sa.String(100), nullable=True, server_default='India'))
        if "pin_code" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('pin_code', sa.String(20), nullable=True))
        if "status" not in hospitals_cols:
            from sqlalchemy.dialects import postgresql
            op.execute("DO $$ BEGIN CREATE TYPE hospitalstatus AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
            op.add_column('hospitals', sa.Column('status', postgresql.ENUM('pending_verification', 'active', 'suspended', 'deactivated', name='hospitalstatus', create_type=False), nullable=True, server_default='pending_verification'))
        if "is_active" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'))
        if "description" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('description', sa.Text(), nullable=True))
        if "owner_user_id" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('owner_user_id', sa.UUID(as_uuid=True), nullable=True))
        if "updated_at" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
        if "deleted_at" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
        if "verified_at" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
        if "verified_by" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('verified_by', sa.String(50), nullable=True))
        if "monthly_revenue" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('monthly_revenue', sa.BigInteger(), nullable=False, server_default='0'))
        if "branch_count" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('branch_count', sa.Integer(), nullable=False, server_default='1'))
        if "bed_count" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('bed_count', sa.Integer(), nullable=True))
        if "complaint_count_7d" not in hospitals_cols:
            op.add_column('hospitals', sa.Column('complaint_count_7d', sa.Integer(), nullable=False, server_default='0'))
        if "enabled_modules" not in hospitals_cols:
            from sqlalchemy.dialects import postgresql
            op.add_column('hospitals', sa.Column('enabled_modules', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='["reception", "nurse", "doctor", "pharmacy", "laboratory", "billing", "ward", "admin"]'))

    # 6. doctors table self-healing
    if not inspector.has_table("doctors"):
        from sqlalchemy.dialects import postgresql
        op.execute("DO $$ BEGIN CREATE TYPE doctorstatus AS ENUM ('pending_approval', 'active', 'on_leave', 'suspended', 'inactive'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
        op.create_table(
            "doctors",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.UUID(as_uuid=True), unique=True, nullable=False),
            sa.Column("hospital_id", sa.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("first_name", sa.String(100), nullable=False),
            sa.Column("last_name", sa.String(100), nullable=False),
            sa.Column("email", sa.String(255), unique=True, nullable=False),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("specialization", sa.String(200), nullable=False),
            sa.Column("qualification", sa.String(500), nullable=True),
            sa.Column("medical_license_number", sa.String(100), unique=True, nullable=False),
            sa.Column("years_of_experience", sa.Integer(), server_default=sa.text("0")),
            sa.Column("consultation_fee", sa.Integer(), server_default=sa.text("0")),
            sa.Column("bio", sa.Text(), nullable=True),
            sa.Column("avatar_url", sa.String(500), nullable=True),
            sa.Column("status", postgresql.ENUM("pending_approval", "active", "on_leave", "suspended", "inactive", name="doctorstatus", create_type=False), server_default="pending_approval", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_doctors_user_id', 'doctors', ['user_id'])
        op.create_index('ix_doctors_hospital_id', 'doctors', ['hospital_id'])
        op.create_index('ix_doctors_email', 'doctors', ['email'])
        op.create_index('ix_doctors_specialization', 'doctors', ['specialization'])

    has_users = inspector.has_table("users")

    # 2. Seed Super Admin in hospyn_employees
    op.execute(f"""
        INSERT INTO hospyn_employees 
          (id, employee_id, full_name, email, hashed_password, team, level, is_active, shift_status, daily_ticket_limit, created_at, updated_at)
        VALUES (
          '00000000-0000-0000-0000-000000000000',
          'HPN-SADM-001',
          'Super Admin',
          'admin@hospain.in',
          '{default_hash}',
          'onboarding',
          'super_admin',
          true,
          'online',
          100,
          NOW(), NOW()
        )
        ON CONFLICT (email) DO NOTHING
    """)

    # 3. Seed Default Hospital
    op.execute("""
        INSERT INTO hospitals
          (id, name, registration_number, email, phone, address_line1, city, state, country, pin_code, status, is_active, owner_user_id, created_at, updated_at)
        VALUES (
          '11111111-1111-1111-1111-111111111111',
          'Hospyn Test Hospital',
          'HSP-TEST-999',
          'admin@sdl05.com',
          '+919999999999',
          'Test Street, Bangalore, Karnataka, 560001',
          'Bangalore',
          'Karnataka',
          'India',
          '560001',
          'active',
          true,
          '22222222-2222-2222-2222-222222222222',
          NOW(), NOW()
        )
        ON CONFLICT (registration_number) DO NOTHING
    """)

    # 4. Seed Staff User in users table
    if has_users:
        op.execute(f"""
            INSERT INTO users
              (id, email, phone_number, hashed_password, role, is_active, token_version, created_at, updated_at)
            VALUES (
              '22222222-2222-2222-2222-222222222222',
              'admin@sdl05.com',
              '+919999999999',
              '{default_hash}',
              'staff',
              true,
              1,
              NOW(), NOW()
            )
            ON CONFLICT (email) DO NOTHING
        """)

    # 5. Seed Staff in staff table
    op.execute("""
        INSERT INTO staff
          (id, user_id, hospital_id, first_name, last_name, phone, role, is_active, shift_status, created_at, updated_at)
        VALUES (
          '22222222-2222-2222-2222-222222222222',
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111',
          'Staff',
          'Admin',
          '+919999999999',
          'admin',
          true,
          'on_duty',
          NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
    """)

    # 6. Seed Doctor User in users table
    if has_users:
        op.execute(f"""
            INSERT INTO users
              (id, email, phone_number, hashed_password, role, is_active, token_version, created_at, updated_at)
            VALUES (
              '33333333-3333-3333-3333-333333333333',
              'ravi@hospyn.com',
              '+919999999998',
              '{default_hash}',
              'doctor',
              true,
              1,
              NOW(), NOW()
            )
            ON CONFLICT (email) DO NOTHING
        """)

    # 7. Seed Doctor in doctors table
    op.execute("""
        INSERT INTO doctors
          (id, user_id, hospital_id, first_name, last_name, email, phone, specialization, medical_license_number, years_of_experience, consultation_fee, status, is_active, created_at, updated_at)
        VALUES (
          '33333333-3333-3333-3333-333333333333',
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111',
          'Ravi',
          'Kumar',
          'ravi@hospyn.com',
          '+919999999998',
          'General Medicine',
          'MC-99999',
          5,
          50000,
          'active',
          true,
          NOW(), NOW()
        )
        ON CONFLICT (email) DO NOTHING
    """)

def downgrade() -> None:
    pass
