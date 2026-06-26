"""initial healthcare tables

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
    # ─── Hospitals ────────────────────────────────────────────────
    op.create_table(
        "hospitals",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("registration_number", sa.String(100), unique=True, nullable=False),
        sa.Column("license_number", sa.String(100), unique=True, nullable=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("address_line1", sa.String(255), nullable=False),
        sa.Column("address_line2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=False, index=True),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("country", sa.String(100), nullable=False, server_default="India"),
        sa.Column("pin_code", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending_verification",
                "active",
                "suspended",
                "deactivated",
                name="hospitalstatus",
                create_type=False,
            ),
            server_default="pending_verification",
            nullable=False,
            index=True,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_user_id", sa.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ─── Doctors ──────────────────────────────────────────────────
    op.create_table(
        "doctors",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(as_uuid=True), unique=True, nullable=False, index=True
        ),
        sa.Column(
            "hospital_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("specialization", sa.String(200), nullable=False, index=True),
        sa.Column("qualification", sa.String(500), nullable=True),
        sa.Column(
            "medical_license_number", sa.String(100), unique=True, nullable=False
        ),
        sa.Column("years_of_experience", sa.Integer(), server_default=sa.text("0")),
        sa.Column("consultation_fee", sa.Integer(), server_default=sa.text("0")),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending_approval",
                "active",
                "on_leave",
                "suspended",
                "inactive",
                name="doctorstatus",
            ),
            server_default="pending_approval",
            nullable=False,
            index=True,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ─── Patients ─────────────────────────────────────────────────
    op.create_table(
        "patients",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(as_uuid=True), unique=True, nullable=False, index=True
        ),
        sa.Column(
            "hospital_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column(
            "gender",
            sa.Enum("male", "female", "other", "prefer_not_to_say", name="gender", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "blood_group",
            sa.Enum(
                "A+",
                "A-",
                "B+",
                "B-",
                "AB+",
                "AB-",
                "O+",
                "O-",
                "Unknown",
                name="bloodgroup",
                create_type=False,
            ),
            server_default="Unknown",
            nullable=True,
        ),
        sa.Column("known_allergies", sa.Text(), nullable=True),
        sa.Column("chronic_conditions", sa.Text(), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(30), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("pin_code", sa.String(20), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ─── Appointments ─────────────────────────────────────────────
    op.create_table(
        "appointments",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "doctor_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "hospital_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "scheduled_at", sa.DateTime(timezone=True), nullable=False, index=True
        ),
        sa.Column("duration_minutes", sa.Integer(), server_default=sa.text("30")),
        sa.Column(
            "appointment_type",
            sa.Enum(
                "in_person",
                "teleconsultation",
                "follow_up",
                "emergency",
                name="appointmenttype",
                create_type=False,
            ),
            server_default="in_person",
        ),
        sa.Column(
            "status",
            sa.Enum(
                "scheduled",
                "confirmed",
                "in_progress",
                "completed",
                "cancelled",
                "no_show",
                name="appointmentstatus",
                create_type=False,
            ),
            server_default="scheduled",
            index=True,
        ),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("prescription", sa.Text(), nullable=True),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("cancelled_by_user_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("appointments")
    op.drop_table("patients")
    op.drop_table("doctors")
    op.drop_table("hospitals")
    op.execute("DROP TYPE IF EXISTS appointmentstatus")
    op.execute("DROP TYPE IF EXISTS appointmenttype")
    op.execute("DROP TYPE IF EXISTS bloodgroup")
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS doctorstatus")
    op.execute("DROP TYPE IF EXISTS hospitalstatus")
