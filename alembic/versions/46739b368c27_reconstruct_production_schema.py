"""reconstruct_production_schema

Revision ID: 46739b368c27
Revises: da78d0891575
Create Date: 2026-05-12 13:47:13.189848

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '46739b368c27'
down_revision: Union[str, Sequence[str], None] = 'da78d0891575'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Fix Users
    op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS hospyn_id VARCHAR(50)'))
    op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS version_id INTEGER DEFAULT 1'))
    op.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS insforge_id VARCHAR(100)'))

    # 2. Fix Hospitals
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospyn_id VARCHAR(50)'))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS short_code VARCHAR(10)'))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS org_type VARCHAR(20) DEFAULT \'hospital\''))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)'))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT \'active\''))
    op.execute(sa.text('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS version_id INTEGER DEFAULT 1'))
    
    # Indices
    op.execute(sa.text('CREATE INDEX IF NOT EXISTS ix_hospitals_short_code ON hospitals (short_code)'))
    op.execute(sa.text('CREATE UNIQUE INDEX IF NOT EXISTS ix_hospitals_registration_number ON hospitals (registration_number)'))


def downgrade() -> None:
    """Downgrade schema."""
    pass
