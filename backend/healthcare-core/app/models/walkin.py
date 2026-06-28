"""
WalkInRequest Model

The core intake entity for the hospital walk-in flow.
This is NOT an appointment. Walk-in requests track the patient's journey
through the hospital queue: Reception -> Triage -> Doctor Consultation.

An Appointment record is only created when the doctor starts consultation.
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
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.hospital import Hospital


class QueueState(str, enum.Enum):
    """
    Tracks the patient's position in the hospital operations pipeline.
    Each state transition is audited and timestamped.
    """

    waiting_reception = "waiting_reception"
    waiting_triage = "waiting_triage"
    in_triage = "in_triage"
    waiting_doctor = "waiting_doctor"
    in_consultation = "in_consultation"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"
    referred = "referred"
    emergency = "emergency"


# States that count as "active" -- used for duplicate prevention
ACTIVE_QUEUE_STATES = {
    QueueState.waiting_reception,
    QueueState.waiting_triage,
    QueueState.in_triage,
    QueueState.waiting_doctor,
    QueueState.in_consultation,
    QueueState.emergency,
}


class PriorityLevel(str, enum.Enum):
    low = "low"
    normal = "normal"
    urgent = "urgent"
    emergency = "emergency"


class WalkInSource(str, enum.Enum):
    qr_walkin = "qr_walkin"
    manual_reception = "manual_reception"


class WalkInRequest(Base):
    __tablename__ = "walkin_requests"
    __table_args__ = (
        # Hot query: "give me all waiting_reception for this hospital, ordered by priority"
        Index("ix_walkin_hospital_state", "hospital_id", "queue_state"),
        Index("ix_walkin_priority_created", "priority_level", "created_at"),
        Index("ix_walkin_assigned_doctor", "assigned_doctor_id"),
        Index("ix_walkin_assigned_nurse", "assigned_nurse_id"),
        # Duplicate prevention: same phone + same hospital + active states
        Index("ix_walkin_phone_hospital", "phone", "hospital_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Hospital scope -- every walk-in belongs to exactly one hospital
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Patient identity -- linked AFTER they have a Hospyn account, nullable for walk-ins
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Intake details (collected from QR form or manual reception entry)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    reason_for_visit: Mapped[str] = mapped_column(Text, nullable=False)
    symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Queue management
    queue_state: Mapped[QueueState] = mapped_column(
        SQLEnum(QueueState),
        default=QueueState.waiting_reception,
        nullable=False,
        index=True,
    )
    priority_level: Mapped[PriorityLevel] = mapped_column(
        SQLEnum(PriorityLevel), default=PriorityLevel.normal, nullable=False, index=True
    )
    source: Mapped[WalkInSource] = mapped_column(
        SQLEnum(WalkInSource), default=WalkInSource.qr_walkin, nullable=False
    )
    queue_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Triage data (filled by nurse)
    triage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    triage_vitals_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Staff assignments
    receptionist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    assigned_nurse_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    assigned_doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Billing & Payments (paise/cents precise integer)
    billing_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    billing_amount: Mapped[int] = mapped_column(Integer, default=50000, nullable=False)
    payment_method: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Lifecycle timestamps
    checked_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    triaged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    routed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consultation_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Standard timestamps + soft delete
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_active(self) -> bool:
        return self.queue_state in ACTIVE_QUEUE_STATES

    def __repr__(self) -> str:
        return f"<WalkInRequest id={self.id} state={self.queue_state} patient={self.full_name}>"
