"""
Doctor Model

Represents a doctor who is affiliated with a hospital.
References user_id from the Auth Service for identity.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Enum as SQLEnum,
    UUID,
    Text,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.appointment import Appointment


class DoctorStatus(str, enum.Enum):
    pending_approval = "pending_approval"
    active = "active"
    on_leave = "on_leave"
    suspended = "suspended"
    inactive = "inactive"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Link to auth-service user -- NOT a foreign key (cross-service boundary)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )

    # Hospital affiliation
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Professional Details
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    phone: Mapped[str] = mapped_column(String(30), nullable=True)

    specialization: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    qualification: Mapped[str] = mapped_column(String(500), nullable=True)
    medical_license_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    years_of_experience: Mapped[int] = mapped_column(Integer, default=0)
    consultation_fee: Mapped[int] = mapped_column(
        Integer, default=0
    )  # in paisa / cents

    # Bio & Avatar
    bio: Mapped[str] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str] = mapped_column(
        String(500), nullable=True
    )  # MinIO object URL

    # Status
    status: Mapped[DoctorStatus] = mapped_column(
        SQLEnum(DoctorStatus), default=DoctorStatus.pending_approval, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships -- string references
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="doctors")
    appointments: Mapped[list["Appointment"]] = relationship(
        "Appointment", back_populates="doctor"
    )

    @property
    def full_name(self) -> str:
        return f"Dr. {self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Doctor id={self.id} name={self.full_name}>"
