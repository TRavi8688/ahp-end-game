"""merge_all_current_heads_for_production

Revision ID: f656beec4b06
Revises: 0011_staff_table, 010_surgery
Create Date: 2026-06-27 18:24:54.658119
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f656beec4b06'
down_revision: Union[str, None] = ('0011_staff_table', '010_surgery')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
