"""add_version_id_default
Revision ID: 9b1c2d3e4f5g
Revises: cac7ea08faaf
Create Date: 2026-05-27 16:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "9b1c2d3e4f5g"
 down_revision = "cac7ea08faaf"
branch_labels = None
depends_on = None

def upgrade():
    # Ensure column exists (no-op if already present)
    op.add_column('users', sa.Column('version_id', sa.Integer(), nullable=True))
    # Backfill existing rows
    op.execute("UPDATE users SET version_id = 1 WHERE version_id IS NULL")
    # Make NOT NULL with default
    op.alter_column('users', 'version_id', nullable=False, server_default=sa.text('1'))

def downgrade():
    op.drop_column('users', 'version_id')
