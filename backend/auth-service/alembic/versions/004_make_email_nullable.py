"""make email nullable

Revision ID: 004_make_email_nullable
Revises: 003_employee_id_temp_password
Create Date: 2026-06-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_make_email_nullable'
down_revision: Union[str, None] = '003_employee_id_temp_password'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'email',
               existing_type=sa.String(length=255),
               nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'email',
               existing_type=sa.String(length=255),
               nullable=False)
