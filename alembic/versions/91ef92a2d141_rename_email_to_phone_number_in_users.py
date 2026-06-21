"""rename_email_to_phone_number_in_users

Revision ID: 91ef92a2d141
Revises: 5cb7dcf95d86
Create Date: 2026-05-17 13:11:57.744555

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91ef92a2d141'
down_revision: Union[str, Sequence[str], None] = '5cb7dcf95d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('users', 'email', new_column_name='phone_number')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('users', 'phone_number', new_column_name='email')
