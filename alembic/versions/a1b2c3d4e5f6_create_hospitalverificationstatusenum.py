"""create_hospitalverificationstatusenum
Revision ID: a1b2c3d4e5f6
Revises: 9b1c2d3e4f5g
Create Date: 2026-05-27 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
 down_revision = "9b1c2d3e4f5g"
branch_labels = None
depends_on = None

def upgrade():
    # Create enum type for hospital verification status
    hospitalverificationstatusenum = sa.Enum(
        'draft',
        'submitted',
        'under_review',
        'request_more_info',
        'verified',
        'rejected',
        'suspended',
        'blacklisted',
        'verification_expired',
        name='hospitalverificationstatusenum'
    )
    hospitalverificationstatusenum.create(op.get_bind())
    # Add column if it does not exist
    op.add_column('hospitals', sa.Column('status', hospitalverificationstatusenum, nullable=False, server_default='draft'))

def downgrade():
    op.drop_column('hospitals', 'status')
    hospitalverificationstatusenum = sa.Enum(name='hospitalverificationstatusenum')
    hospitalverificationstatusenum.drop(op.get_bind())
