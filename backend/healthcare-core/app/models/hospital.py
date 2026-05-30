"""
Hospital Model

Represents a registered hospital/clinic on the platform.
One hospital can have many doctors and many patients.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, UUID, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.doctor import Doctor
    from app.models.patient import Patient


class HospitalStatus(str, enum.Enum):
    pending_verification = "pending_verification"
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    registration_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    license_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=True)

    # Contact
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    website: Mapped[str] = mapped_column(String(255), nullable=True)

    # Location
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[str] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    pin_code: Mapped[str] = mapped_column(String(20), nullable=False)

    # Status & Metadata
    status: Mapped[HospitalStatus] = mapped_column(
        SQLEnum(HospitalStatus), default=HospitalStatus.pending_verification, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # The user_id of the hospital admin in the auth-service
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships — use string references to avoid circular imports
    doctors: Mapped[list["Doctor"]] = relationship("Doctor", back_populates="hospital")
    patients: Mapped[list["Patient"]] = relationship(
        "Patient", back_populates="hospital"
    )

    def __repr__(self) -> str:
        return f"<Hospital id={self.id} name={self.name}>"
