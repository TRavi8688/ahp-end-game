"""add push_token to patients

Revision ID: b7c8d9e0f1a2
Revises: 003_phase13_compliance_tables
Create Date: 2026-06-04

Phase 6 Fix: Adds push_token and push_token_platform columns to the Patient
table so that Expo/FCM push notification tokens can be stored per patient.

APPLY:
    DATABASE_URL=<your_url> alembic upgrade head

ROLLBACK:
    alembic downgrade b7c8d9e0f1a2-1
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("push_token", sa.String(512), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column("push_token_platform", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("patients", "push_token_platform")
    op.drop_column("patients", "push_token")
