"""add full_name and hospital_id columns to users

These two columns have existed on the SQLAlchemy User model (app/models/user.py)
since the "FIX-U2" pass, but no migration was ever written for them. Every
login/register query selects these columns, so any fresh database (one that
only ran 001-004) fails with:
    asyncpg.exceptions.UndefinedColumnError: column users.full_name does not exist

Revision ID: 005_add_full_name_hospital_id
Revises: 004_make_email_nullable
Create Date: 2026-06-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005_add_full_name_hospital_id'
down_revision: Union[str, None] = '004_make_email_nullable'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('full_name', sa.String(length=255), nullable=True))
    op.add_column(
        'users',
        sa.Column('hospital_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f('ix_users_hospital_id'), 'users', ['hospital_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_hospital_id'), table_name='users')
    op.drop_column('users', 'hospital_id')
    op.drop_column('users', 'full_name')
