"""create missing tables: payment_transactions, consent_records, data_deletion_requests,
lab_results, marketing_preferences, notification_tokens, device_tokens

Revision ID: c2g03dd759f5
Revises: b1f92cc648e4
Create Date: 2026-06-07 14:00:00.000000

These 7 tables have SQLAlchemy ORM models but were never added to the Alembic migration
chain. Without this migration, any endpoint that touches these models (payments, DPDP
consent, lab results, marketing preferences, notification/device tokens) will raise
`asyncpg.exceptions.UndefinedTableError` at runtime.

Dependency order (all FK parents are created in earlier migrations):
  - `patients`       ← created in 001_initial.py
  - `hospitals`      ← created in 001_initial.py
  - `walkin_requests` ← created in 6df9cf33819a_make_patient_hospital_id_nullable.py
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "c2g03dd759f5"
down_revision: Union[str, None] = "b1f92cc648e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. payment_transactions
    #    References: walkin_requests.id
    # ------------------------------------------------------------------
    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("walkin_request_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("transaction_reference", sa.String(length=100), nullable=True),
        sa.Column("collected_by", sa.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["walkin_request_id"],
            ["walkin_requests.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_transactions_id", "payment_transactions", ["id"], unique=False)
    op.create_index(
        "ix_payment_transactions_walkin_request_id",
        "payment_transactions",
        ["walkin_request_id"],
        unique=False,
    )
    op.create_index(
        "ix_payment_transactions_transaction_reference",
        "payment_transactions",
        ["transaction_reference"],
        unique=False,
    )
    op.create_index(
        "ix_payment_transactions_collected_by",
        "payment_transactions",
        ["collected_by"],
        unique=False,
    )
    op.create_index(
        "ix_payment_transactions_paid_at",
        "payment_transactions",
        ["paid_at"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 2. consent_records
    #    References: patients.id, hospitals.id
    # ------------------------------------------------------------------
    op.create_table(
        "consent_records",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("hospital_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("consent_type", sa.String(length=50), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("version", sa.String(length=20), nullable=False, server_default="1.0"),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["hospital_id"],
            ["hospitals.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_consent_records_id", "consent_records", ["id"], unique=False)
    op.create_index(
        "ix_consent_records_patient_id", "consent_records", ["patient_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 3. data_deletion_requests
    #    References: patients.id
    # ------------------------------------------------------------------
    op.create_table(
        "data_deletion_requests",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_data_deletion_requests_id", "data_deletion_requests", ["id"], unique=False
    )
    op.create_index(
        "ix_data_deletion_requests_patient_id",
        "data_deletion_requests",
        ["patient_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 4. lab_results
    #    References: patients.id
    # ------------------------------------------------------------------
    op.create_table(
        "lab_results",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_name", sa.String(length=200), nullable=True),
        sa.Column("test_name", sa.String(length=255), nullable=False),
        sa.Column("result_value", sa.String(length=255), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("reference_range", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lab_results_id", "lab_results", ["id"], unique=False)
    op.create_index("ix_lab_results_patient_id", "lab_results", ["patient_id"], unique=False)

    # ------------------------------------------------------------------
    # 5. marketing_preferences
    #    References: patients.id
    # ------------------------------------------------------------------
    op.create_table(
        "marketing_preferences",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("preference_key", sa.String(length=100), nullable=False),
        sa.Column("preference_value", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_marketing_preferences_id", "marketing_preferences", ["id"], unique=False
    )
    op.create_index(
        "ix_marketing_preferences_patient_id",
        "marketing_preferences",
        ["patient_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 6. notification_tokens
    #    References: patients.id
    # ------------------------------------------------------------------
    op.create_table(
        "notification_tokens",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notification_tokens_id", "notification_tokens", ["id"], unique=False
    )
    op.create_index(
        "ix_notification_tokens_patient_id",
        "notification_tokens",
        ["patient_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 7. device_tokens
    #    References: patients.id
    # ------------------------------------------------------------------
    op.create_table(
        "device_tokens",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(length=255), nullable=False),
        sa.Column("device_name", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_device_tokens_id", "device_tokens", ["id"], unique=False)
    op.create_index(
        "ix_device_tokens_patient_id", "device_tokens", ["patient_id"], unique=False
    )


def downgrade() -> None:
    # Drop in reverse order (no cross-dependencies between these 7 tables)
    op.drop_index("ix_device_tokens_patient_id", table_name="device_tokens")
    op.drop_index("ix_device_tokens_id", table_name="device_tokens")
    op.drop_table("device_tokens")

    op.drop_index("ix_notification_tokens_patient_id", table_name="notification_tokens")
    op.drop_index("ix_notification_tokens_id", table_name="notification_tokens")
    op.drop_table("notification_tokens")

    op.drop_index("ix_marketing_preferences_patient_id", table_name="marketing_preferences")
    op.drop_index("ix_marketing_preferences_id", table_name="marketing_preferences")
    op.drop_table("marketing_preferences")

    op.drop_index("ix_lab_results_patient_id", table_name="lab_results")
    op.drop_index("ix_lab_results_id", table_name="lab_results")
    op.drop_table("lab_results")

    op.drop_index("ix_data_deletion_requests_patient_id", table_name="data_deletion_requests")
    op.drop_index("ix_data_deletion_requests_id", table_name="data_deletion_requests")
    op.drop_table("data_deletion_requests")

    op.drop_index("ix_consent_records_patient_id", table_name="consent_records")
    op.drop_index("ix_consent_records_id", table_name="consent_records")
    op.drop_table("consent_records")

    op.drop_index("ix_payment_transactions_paid_at", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_collected_by", table_name="payment_transactions")
    op.drop_index(
        "ix_payment_transactions_transaction_reference", table_name="payment_transactions"
    )
    op.drop_index(
        "ix_payment_transactions_walkin_request_id", table_name="payment_transactions"
    )
    op.drop_index("ix_payment_transactions_id", table_name="payment_transactions")
    op.drop_table("payment_transactions")
