"""fix_production_schema_mismatch

Revision ID: 2ab387af2e05
Revises: e1968b40395c
Create Date: 2026-05-12 13:41:02.467769

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ab387af2e05'
down_revision: Union[str, Sequence[str], None] = 'e1968b40395c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing hospyn_id for tenant mapping (users)
    op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS hospyn_id VARCHAR(50)'))
    
    # Add missing hospyn_id for tenant mapping (hospitals)
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospyn_id VARCHAR(50)'))
    op.execute(sa.text('CREATE UNIQUE INDEX IF NOT EXISTS ix_hospitals_hospyn_id ON hospitals (hospyn_id)'))
    
    # Ensure version_id exists for optimistic locking
    op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS version_id INTEGER DEFAULT 1'))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS version_id INTEGER DEFAULT 1'))


def downgrade() -> None:
    """Downgrade schema."""
    pass
