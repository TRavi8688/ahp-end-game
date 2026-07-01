"""initial auth tables

Revision ID: 001_initial
Revises:
Create Date: 2026-05-29
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The complete, authoritative set of role labels -- MUST stay in sync with
# RoleEnum in app/models/user.py. Creating them all up front means later
# migrations never need the fragile ALTER TYPE ... ADD VALUE dance.
ROLE_VALUES = [
    "patient", "doctor", "admin", "hospital_admin", "staff",
    "nurse", "pharmacist", "super_admin", "owner", "receptionist",
    "lab", "hr",
    # Hospain internal employee roles
    "manager", "team_lead", "l1", "l2", "support", "finance",
    "engineering", "onboarding", "data", "verification", "employee",
]


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect
    import logging
    logger = logging.getLogger("alembic.runtime.migration")
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    logger.info(f"=== 001_initial upgrade: tables in DB = {tables} ===")

    # Create the roleenum type ONCE, with every label, only if it doesn't
    # already exist. checkfirst=True makes this a no-op on an existing type,
    # so a lingering type from a previous partial run no longer blocks us.
    role_enum = postgresql.ENUM(*ROLE_VALUES, name="roleenum")
    role_enum.create(conn, checkfirst=True)

    # Reference the type without letting create_table re-emit CREATE TYPE.
    role_col_type = postgresql.ENUM(*ROLE_VALUES, name="roleenum", create_type=False)

    # Users table
    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
            sa.Column("email", sa.String(255), unique=True, nullable=True, index=True),
            sa.Column(
                "phone_number", sa.String(20), unique=True, nullable=True, index=True
            ),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column(
                "role",
                role_col_type,
                server_default="patient",
                nullable=False,
            ),
            sa.Column(
                "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
            ),
            sa.Column(
                "token_version", sa.Integer(), server_default=sa.text("1"), nullable=False
            ),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
            ),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    # OTP verifications table
    if "otp_verifications" not in tables:
        op.create_table(
            "otp_verifications",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
            sa.Column("identifier", sa.String(255), nullable=False, index=True),
            sa.Column("hashed_otp", sa.String(255), nullable=False),
            sa.Column(
                "attempts", sa.Integer(), server_default=sa.text("0"), nullable=False
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
            ),
            sa.Column(
                "is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False
            ),
        )

    # Password reset tokens table
    if "password_reset_tokens" not in tables:
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column("hashed_token", sa.String(255), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "is_used", sa.Boolean(), server_default=sa.text("false"), nullable=False
            ),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
            ),
        )


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_table("otp_verifications")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS roleenum")