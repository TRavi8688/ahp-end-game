"""add_record_name_and_hospital_name_to_medical_records

Revision ID: 7fe81c25f628
Revises: 42e7f9361f9c
Create Date: 2026-05-13 21:25:03.873120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fe81c25f628'
down_revision: Union[str, Sequence[str], None] = '42e7f9361f9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('medical_records', sa.Column('record_name', sa.String(length=255), nullable=True))
    op.add_column('medical_records', sa.Column('hospital_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('medical_records', 'hospital_name')
    op.drop_column('medical_records', 'record_name')
