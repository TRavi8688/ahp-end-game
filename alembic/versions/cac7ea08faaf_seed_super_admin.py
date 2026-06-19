"""seed_super_admin

Revision ID: cac7ea08faaf
Revises: 2fe6f99be20f
Create Date: 2026-05-27 14:26:50.380978

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cac7ea08faaf'
down_revision: Union[str, Sequence[str], None] = '2fe6f99be20f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert super admin user with ALL non-nullable columns explicitly set.
    # phone_number is the actual DB column name (mapped from email in the model).
    # token_version, is_active, is_temporary_password all have NOT NULL constraints.
    op.execute("""
    INSERT INTO users (
        id,
        version_id,
        phone_number,
        hashed_password,
        role,
        first_name,
        last_name,
        is_active,
        is_temporary_password,
        token_version,
        current_status,
        created_at
    )
    VALUES (
        '123e4567-e89b-12d3-a456-426614174000',
        1,
        'superadmin@hospyn.com',
        '$2b$12$MmCsjW7TIjNeEzQoQLXovOhk8qV2Rzuy9oPD0xsz5fe8uR6Ll3g96',
        'admin',
        'Super',
        'Admin',
        true,
        false,
        1,
        'ACTIVE',
        NOW()
    )
    ON CONFLICT (phone_number) DO UPDATE SET
        hashed_password = EXCLUDED.hashed_password,
        role = 'admin',
        version_id = EXCLUDED.version_id,
        token_version = EXCLUDED.token_version,
        is_active = true;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE phone_number = 'superadmin@hospyn.com'")
