"""
Appointment Model

Core scheduling entity linking a Patient to a Doctor.
Tracks appointment lifecycle: scheduled -> confirmed -> completed/cancelled.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    String,
    DateTime,
    Enum as SQLEnum,
    UUID,
    Text,
    ForeignKey,
    Integer,
    func,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base
from shared.encryption import EncryptedText

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.doctor import Doctor


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class AppointmentType(str, enum.Enum):
    in_person = "in_person"
    teleconsultation = "teleconsultation"
    follow_up = "follow_up"
    emergency = "emergency"


class AppointmentSource(str, enum.Enum):
    """How was this appointment created?"""

    scheduled = "scheduled"  # Patient booked via app
    walkin = "walkin"  # Created from a WalkInRequest
    receptionist = "receptionist"  # Receptionist booked on behalf


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_doctor_date", "doctor_id", "scheduled_at"),
        Index("ix_appointments_patient_status", "patient_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Core relationships
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Scheduling
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)

    # Type & Status
    appointment_type: Mapped[AppointmentType] = mapped_column(
        SQLEnum(AppointmentType), default=AppointmentType.in_person
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        SQLEnum(AppointmentStatus), default=AppointmentStatus.scheduled, index=True
    )

    # Clinical Notes (only doctors can write these)
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=True)
    clinical_notes: Mapped[str] = mapped_column(EncryptedText, nullable=True)
    prescription: Mapped[str] = mapped_column(EncryptedText, nullable=True)
    diagnosis: Mapped[str] = mapped_column(EncryptedText, nullable=True)

    # Walk-in provenance — links back to the intake pipeline
    source_type: Mapped[AppointmentSource] = mapped_column(
        SQLEnum(AppointmentSource), default=AppointmentSource.scheduled, nullable=False
    )
    walkin_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("walkin_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Cancellation tracking
    cancelled_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    cancellation_reason: Mapped[str] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships — string references, no circular imports
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")

    def __repr__(self) -> str:
        return f"<Appointment id={self.id} status={self.status}>"
