"""
0006_doctor_schedule_system.py
Phase 4 — Doctor App: Profile, Leave, Break, Roster & Holiday tables.

DROP-IN INSTRUCTIONS:
  Save as: backend/healthcare-core/alembic/versions/0006_doctor_schedule_system.py

IMPORTANT — YOUR MIGRATION CHAIN HAS A BUG, READ THIS FIRST:
  Before applying this migration, your alembic/versions folder has a
  circular reference that will make `alembic upgrade head` fail with
  "Cycle detected":

      a7f3e9c21b84 (20260605_phase3_patient_device_tokens.py)
        down_revision -> b2c4e6f8a1d3
      b2c4e6f8a1d3 (20260605_dpdp_compliance_tables.py)
        down_revision -> c3d5f7a9b2e4
      c3d5f7a9b2e4 (20260605_add_performance_indexes.py)
        down_revision -> a7f3e9c21b84   <-- points back to the first one

  At the same time, d3e4f5a6b7c8_make_appointment_patient_id_nullable.py
  (the true end of your *other* migration branch) is orphaned — nothing
  continues from it.

  FIX REQUIRED (one line, in 20260605_add_performance_indexes.py):
      down_revision = '005_lab'
  change to:
      down_revision = 'd3e4f5a6b7c8'

  That breaks the cycle and reconnects the two branches into one line:
      ... -> d3e4f5a6b7c8 -> c3d5f7a9b2e4 -> b2c4e6f8a1d3 -> a7f3e9c21b84

  THIS FILE's down_revision below already assumes that fix has been made
  (down_revision = '005_lab', which becomes the true head once the
  cycle is broken).
"""

from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_doctor_schedule"
down_revision: Union[str, None] = "005_lab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── FIX: patients.hospyn_id was referenced by reception_service.py and
    # doctor_queue.py as if it already existed — it never did, in the model
    # OR in any prior migration. Adding it here since doctor-app's patient
    # lookup (provision_slot, my-patients) depends on it being real.
    op.add_column(
        "patients",
        sa.Column("hospyn_id", sa.String(40), nullable=True),
    )
    op.create_index("ix_patients_hospyn_id", "patients", ["hospyn_id"], unique=True)

    # ── doctor_profile_extensions ───────────────────────────────────────
    op.create_table(
        "doctor_profile_extensions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("hospyn_id", sa.String(40), unique=True, nullable=True),
        sa.Column("email_notifications_enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column("sms_notifications_enabled", sa.Boolean(), server_default=sa.false()),
        sa.Column("session_timeout_minutes", sa.Integer(), server_default="15"),
        sa.Column("two_factor_enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_doctor_profile_ext_doctor_id", "doctor_profile_extensions", ["doctor_id"]
    )
    op.create_index(
        "ix_doctor_profile_ext_hospyn_id", "doctor_profile_extensions", ["hospyn_id"]
    )

    # ── doctor_leaves ────────────────────────────────────────────────────
    leave_type_enum = postgresql.ENUM(
        "day_off", "half_day", "emergency_leave", "conference_cme",
        "personal", "vacation", "sick",
        name="leavetype", create_type=False,
    )
    leave_status_enum = postgresql.ENUM(
        "pending", "approved", "rejected", "cancelled", name="leavestatus", create_type=False
    )
    leave_type_enum.create(op.get_bind(), checkfirst=True)
    leave_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "doctor_leaves",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("leave_type", leave_type_enum, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("status", leave_status_enum, server_default="pending"),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_remarks", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_doctor_leaves_doctor_id", "doctor_leaves", ["doctor_id"])
    op.create_index("ix_doctor_leaves_hospital_id", "doctor_leaves", ["hospital_id"])
    op.create_index("ix_doctor_leaves_start_date", "doctor_leaves", ["start_date"])
    op.create_index("ix_doctor_leaves_end_date", "doctor_leaves", ["end_date"])
    op.create_index("ix_doctor_leaves_status", "doctor_leaves", ["status"])

    # ── doctor_break_logs ────────────────────────────────────────────────
    break_type_enum = postgresql.ENUM(
        "bio_break", "lunch_break", "tea_break", "meeting",
        "emergency_pause", "other",
        name="breaktype", create_type=False,
    )
    break_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "doctor_break_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("break_type", break_type_enum, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(300), nullable=True),
    )
    op.create_index("ix_doctor_break_logs_doctor_id", "doctor_break_logs", ["doctor_id"])
    op.create_index("ix_doctor_break_logs_started_at", "doctor_break_logs", ["started_at"])

    # ── doctor_roster_shifts ─────────────────────────────────────────────
    shift_type_enum = postgresql.ENUM(
        "morning", "afternoon", "evening", "night", "on_call", "off",
        name="shifttypedoctor", create_type=False,
    )
    shift_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "doctor_roster_shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("shift_date", sa.Date(), nullable=False),
        sa.Column("shift_type", shift_type_enum, nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("notes", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("doctor_id", "shift_date", name="uq_doctor_roster_day"),
    )
    op.create_index("ix_doctor_roster_doctor_id", "doctor_roster_shifts", ["doctor_id"])
    op.create_index("ix_doctor_roster_hospital_id", "doctor_roster_shifts", ["hospital_id"])
    op.create_index("ix_doctor_roster_shift_date", "doctor_roster_shifts", ["shift_date"])

    # ── hospital_holidays ────────────────────────────────────────────────
    op.create_table(
        "hospital_holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "hospital_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hospitals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("is_full_day", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("hospital_id", "holiday_date", name="uq_hospital_holiday_date"),
    )
    op.create_index("ix_hospital_holidays_hospital_id", "hospital_holidays", ["hospital_id"])
    op.create_index("ix_hospital_holidays_date", "hospital_holidays", ["holiday_date"])


def downgrade() -> None:
    op.drop_index("ix_patients_hospyn_id", table_name="patients")
    op.drop_column("patients", "hospyn_id")

    op.drop_table("hospital_holidays")
    op.drop_table("doctor_roster_shifts")
    op.drop_table("doctor_break_logs")
    op.drop_table("doctor_leaves")
    op.drop_table("doctor_profile_extensions")

    op.execute("DROP TYPE IF EXISTS shifttypedoctor")
    op.execute("DROP TYPE IF EXISTS breaktype")
    op.execute("DROP TYPE IF EXISTS leavestatus")
    op.execute("DROP TYPE IF EXISTS leavetype")
