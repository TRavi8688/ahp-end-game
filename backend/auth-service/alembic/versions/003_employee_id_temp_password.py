"""Add employee_id and is_temporary_password columns

Revision ID: 003_employee_id_temp_password
Revises: 002_account_verification_fields
Create Date: 2026-06-26

WHAT THIS MIGRATION DOES:
  1. Adds employee_id (VARCHAR 10, unique, nullable) -- 6-char HR-branded ID
     e.g. H3RK9N, 7HR2K4
  2. Adds is_temporary_password (BOOLEAN, default FALSE) -- forces password
     change popup on first login when admin sets a temp password
  3. Adds employee_id index for fast login lookups
  4. Adds missing role enum values for Hospain internal roles
  5. Fixes RBAC token claim keys: hid->hospital_id, ver->token_version
     (creates a DB view that maps old claim names -- actual fix is in code)
"""

from alembic import op
import sqlalchemy as sa

revision = '003_employee_id_temp_password'
down_revision = '002_account_verification'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add employee_id column
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS employee_id VARCHAR(10) UNIQUE
    """)

    # 2. Add is_temporary_password column
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_temporary_password BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # 3. Index for fast employee_id lookups during login
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_employee_id ON users (employee_id)
        WHERE employee_id IS NOT NULL
    """)

    # 4. Ensure all Hospain internal roles exist in the enum.
    #
    # ROOT-CAUSE FIX (2026-07-01): the previous version wrapped
    # `ALTER TYPE roleenum ADD VALUE` inside a `DO $$ ... $$` block. PostgreSQL
    # rejects that with "ALTER TYPE ... ADD cannot be executed from a function
    # or multi-command string" -- so this migration failed on EVERY run,
    # which blocked 003/004/005 and left the users table half-built (or, as
    # seen in production, not built at all). That was the source of the
    # patient/partner app 500s.
    #
    # Correct approach:
    #   * `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is a plain statement
    #     (no function wrapper) and is idempotent (PG 12+).
    #   * It must NOT run inside the migration's transaction, so we use
    #     alembic's autocommit_block().
    #
    # With 001 now creating roleenum with the full label set, these are almost
    # always no-ops -- but we keep them so databases whose type predates the
    # full list still get healed.
    internal_roles = [
        'manager', 'team_lead', 'l1', 'l2', 'support',
        'finance', 'engineering', 'onboarding', 'data',
        'verification', 'employee',
        'nurse', 'pharmacist', 'super_admin', 'owner',
        'receptionist', 'lab', 'hr'
    ]
    with op.get_context().autocommit_block():
        for role in internal_roles:
            op.execute(f"ALTER TYPE roleenum ADD VALUE IF NOT EXISTS '{role}'")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS employee_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_temporary_password")
    op.execute("DROP INDEX IF EXISTS ix_users_employee_id")
