"""fix_hospital_schema_mismatch

Revision ID: da78d0891575
Revises: 2ab387af2e05
Create Date: 2026-05-12 13:45:38.984153

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da78d0891575'
down_revision: Union[str, Sequence[str], None] = '2ab387af2e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing hospyn_id for tenant mapping (hospitals)
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospyn_id VARCHAR(50)'))
    op.execute(sa.text('CREATE UNIQUE INDEX IF NOT EXISTS ix_hospitals_hospyn_id ON hospitals (hospyn_id)'))
    
    # Ensure version_id exists for hospitals
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS version_id INTEGER DEFAULT 1'))


def downgrade() -> None:
    """Downgrade schema."""
    pass
