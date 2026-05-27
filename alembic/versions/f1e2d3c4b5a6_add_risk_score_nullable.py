"""add_risk_score_nullable
Revision ID: f1e2d3c4b5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-27 17:10:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f1e2d3c4b5a6"
 down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

def upgrade():
    # Add column as nullable first
    op.add_column('hospitals', sa.Column('risk_score', sa.Integer(), nullable=True))
    # Back‑fill existing rows with a sensible default (0)
    op.execute("UPDATE hospitals SET risk_score = 0 WHERE risk_score IS NULL")
    # Alter to NOT NULL with default
    op.alter_column('hospitals', 'risk_score', nullable=False, server_default=sa.text('0'))

def downgrade():
    op.drop_column('hospitals', 'risk_score')
