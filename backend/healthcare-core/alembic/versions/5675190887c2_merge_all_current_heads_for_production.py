"""Merge all current heads for production

Revision ID: 5675190887c2
Revises: 0011_staff_table, 003b_core_models, 010_surgery
Create Date: 2026-06-27 18:12:02.272891
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5675190887c2'
down_revision: Union[str, None] = ('0011_staff_table', '003b_core_models', '010_surgery')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
