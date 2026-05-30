"""
Patient Model

Represents a patient registered in a hospital.
References user_id from the Auth Service for authentication identity.
All PHI (Protected Health Information) fields are stored here.
"""
import uuid
import enum
from datetime import datetime, date
from sqlalchemy import (
    String, Boolean, DateTime, Date, Enum as SQLEnum,
    UUID, Text, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base
from shared.encryption import EncryptedString, EncryptedText

if TYPE_CHECKING:
    from app.models.hospital import Hospital
    from app.models.appointment import Appointment


class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "Unknown"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Link to auth-service user (cross-service, NOT a DB foreign key)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)

    # Hospital association
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Personal Info (PHI)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender] = mapped_column(SQLEnum(Gender), nullable=True)

    # Medical Info
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup), default=BloodGroup.UNKNOWN, nullable=True
    )
    known_allergies: Mapped[str] = mapped_column(EncryptedText, nullable=True)
    chronic_conditions: Mapped[str] = mapped_column(EncryptedText, nullable=True)
    emergency_contact_name: Mapped[str] = mapped_column(EncryptedString(600), nullable=True)
    emergency_contact_phone: Mapped[str] = mapped_column(EncryptedString(200), nullable=True)

    # Address
    address: Mapped[str] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=True)
    pin_code: Mapped[str] = mapped_column(String(20), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships — string references, no circular imports
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="patients")
    appointments: Mapped[list["Appointment"]] = relationship("Appointment", back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Patient id={self.id} name={self.full_name}>"
