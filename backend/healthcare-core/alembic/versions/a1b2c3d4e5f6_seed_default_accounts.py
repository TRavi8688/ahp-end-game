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
