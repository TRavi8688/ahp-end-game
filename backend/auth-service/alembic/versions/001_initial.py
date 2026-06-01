"""initial auth tables

Revision ID: 001_initial
Revises:
Create Date: 2026-05-29
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column(
            "phone_number", sa.String(20), unique=True, nullable=True, index=True
        ),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "patient", "doctor", "admin", "hospital_admin", "staff", name="roleenum"
            ),
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
