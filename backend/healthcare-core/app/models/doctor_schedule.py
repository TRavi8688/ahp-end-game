"""
doctor_schedule.py
Phase 4 — Doctor App: Profile, Leave, Break, Roster & Holiday models.

WHY THIS FILE EXISTS:
  The Doctor model (app/models/doctor.py) has no fields for notification
  preferences, session timeout, or a public-facing "Hospyn ID". There were
  also no tables anywhere in the schema for doctor leave requests, break
  logs, monthly roster shifts, or hospital holidays. The frontend
  (doctor-app) calls endpoints for all of these and none existed.

ADDITIONAL BUG FOUND WHILE BUILDING THIS (separate from doctor-app, but
blocks doctor-app's patient search/schedule features):
  app/services/reception_service.py and app/api/v1/doctor_queue.py both
  reference `Patient.hospyn_id` as if it's a real column. It is not —
  there is no `hospyn_id` column on the `patients` table in the model
  (app/models/patient.py) OR in any Alembic migration. This is a
  pre-existing bug that will throw AttributeError the moment that code
  path runs. This migration adds the missing column (see
  migrations/0006_doctor_schedule_system.py — the `patients.hospyn_id`
  addition is bundled into that same file since both bugs block the same
  doctor-app feature: finding a patient by Hospyn ID).

DROP-IN INSTRUCTIONS:
  1. Save this file as:
       backend/healthcare-core/app/models/doctor_schedule.py
  2. Add to backend/healthcare-core/app/models/__init__.py:
       from app.models.doctor_schedule import (
           DoctorProfileExtension, DoctorLeave, DoctorBreakLog,
           RosterShift, Holiday, LeaveStatus, BreakType, ShiftType,
       )
  3. IMPORTANT — also add this field to app/models/patient.py's Patient
     class (it is currently missing, see "ADDITIONAL BUG FOUND" above):
       hospyn_id: Mapped[str] = mapped_column(String(40), unique=True, nullable=True, index=True)
  4. Run the migration in migrations/0006_doctor_schedule_system.py
     (see that file's header for alembic revision chaining instructions).
"""

import uuid
import enum
from datetime import datetime, date, time
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Date,
    Time,
    Integer,
    Text,
    Enum as SQLEnum,
    UUID,
    ForeignKey,
    func,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class LeaveType(str, enum.Enum):
    day_off = "day_off"
    half_day = "half_day"
    emergency_leave = "emergency_leave"
    conference_cme = "conference_cme"
    personal = "personal"
    vacation = "vacation"
    sick = "sick"


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class BreakType(str, enum.Enum):
    bio_break = "bio_break"
    lunch_break = "lunch_break"
    tea_break = "tea_break"
    meeting = "meeting"
    emergency_pause = "emergency_pause"
    other = "other"


class ShiftType(str, enum.Enum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    night = "night"
    on_call = "on_call"
    off = "off"


# ---------------------------------------------------------------------------
# DoctorProfileExtension — 1:1 extension of Doctor, holds fields the
# original Doctor model is missing. Kept as a separate table (rather than
# an ALTER on `doctors`) to avoid touching the existing, already-deployed
# doctors table and any migrations that depend on its exact shape.
# ---------------------------------------------------------------------------

class DoctorProfileExtension(Base):
    __tablename__ = "doctor_profile_extensions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Public-facing, permanently-locked identifier shown in the doctor app
    # Settings screen ("Hospyn ID"). Generated once at first profile fetch.
    hospyn_id: Mapped[str] = mapped_column(String(40), unique=True, nullable=True, index=True)

    # Notification preferences
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Security
    session_timeout_minutes: Mapped[int] = mapped_column(Integer, default=15)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<DoctorProfileExtension doctor_id={self.doctor_id}>"


# ---------------------------------------------------------------------------
# DoctorLeave — day-off / vacation / conference requests
# ---------------------------------------------------------------------------

class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    leave_type: Mapped[LeaveType] = mapped_column(SQLEnum(LeaveType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=True)

    status: Mapped[LeaveStatus] = mapped_column(
        SQLEnum(LeaveStatus), default=LeaveStatus.pending, index=True
    )
    reviewed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    review_remarks: Mapped[str] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<DoctorLeave doctor_id={self.doctor_id} {self.start_date}..{self.end_date}>"


# ---------------------------------------------------------------------------
# DoctorBreakLog — every break start/end, typed (lunch, tea, bio, meeting...)
# This is what allows the queue to know *why* a doctor paused, and for how
# long, and feeds the "doctor is on break" badge + queue auto-pause logic.
# ---------------------------------------------------------------------------

class DoctorBreakLog(Base):
    __tablename__ = "doctor_break_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    break_type: Mapped[BreakType] = mapped_column(SQLEnum(BreakType), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(300), nullable=True)

    def __repr__(self) -> str:
        return f"<DoctorBreakLog doctor_id={self.doctor_id} type={self.break_type}>"


# ---------------------------------------------------------------------------
# RosterShift — monthly roster, one row per doctor per day
# ---------------------------------------------------------------------------

class RosterShift(Base):
    __tablename__ = "doctor_roster_shifts"
    __table_args__ = (
        UniqueConstraint("doctor_id", "shift_date", name="uq_doctor_roster_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_type: Mapped[ShiftType] = mapped_column(SQLEnum(ShiftType), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=True)
    end_time: Mapped[time] = mapped_column(Time, nullable=True)
    notes: Mapped[str] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<RosterShift doctor_id={self.doctor_id} date={self.shift_date} type={self.shift_type}>"


# ---------------------------------------------------------------------------
# Holiday — hospital-wide holiday calendar, shared across all doctors at
# a hospital so roster generation can auto-block these dates.
# ---------------------------------------------------------------------------

class Holiday(Base):
    __tablename__ = "hospital_holidays"
    __table_args__ = (
        UniqueConstraint("hospital_id", "holiday_date", name="uq_hospital_holiday_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_full_day: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Holiday {self.holiday_date} {self.name}>"
