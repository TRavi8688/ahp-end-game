"""add phone_verified, auth_provider, has_usable_password to users

Revision ID: 002_account_verification
Revises: 001_initial
Create Date: 2026-06-23

WHY THIS MIGRATION EXISTS (root-cause fix, not a patch):
  1. registration had no way to know if a user finished OTP verification,
     so a user who registered but never completed the OTP step looked
     IDENTICAL in the DB to a fully verified user. /check-user then told
     them "already registered, go log in" with no way back into the OTP
     flow -> permanent dead end. `phone_verified` lets /register and
     /check-user tell these two cases apart and resume verification
     instead of blocking the user.
  2. Google/Apple sign-in creates a user with a random password the user
     never sees, with no record that this happened. `auth_provider` and
     `has_usable_password` let the API tell the frontend "this account
     can't use Hospyn ID + password yet" so we can offer a real fix
     (a one-time "set a password" step) instead of a silent dead end.

BACKWARD COMPATIBILITY:
  Existing rows default to phone_verified=true and has_usable_password=true
  so no currently-working account is locked out by this migration. This
  does mean pre-existing Google-created accounts won't be auto-flagged
  retroactively -- only new ones going forward. Those users can still use
  the new "Set up password" option voluntarily from Settings.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_account_verification"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]

    if "phone_verified" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "phone_verified", sa.Boolean(), server_default=sa.text("true"), nullable=False
            ),
        )
    if "auth_provider" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "auth_provider", sa.String(20), server_default=sa.text("'local'"), nullable=False
            ),
        )
    if "has_usable_password" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "has_usable_password", sa.Boolean(), server_default=sa.text("true"), nullable=False
            ),
        )


def downgrade() -> None:
    op.drop_column("users", "has_usable_password")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "phone_verified")
