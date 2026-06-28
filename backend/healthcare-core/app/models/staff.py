"""
Staff Model

Represents a hospital staff member (receptionist, nurse, admin).
Links to user_id from the Auth Service and is scoped to a single hospital.
Doctors have their own model -- this is for operational staff only.
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
    ForeignKey,
    func,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.hospital import Hospital


class StaffRole(str, enum.Enum):
    receptionist = "receptionist"
    nurse = "nurse"
    admin = "admin"
    lab_technician = "lab_technician"
    pharmacist = "pharmacist"


class ShiftStatus(str, enum.Enum):
    on_duty = "on_duty"
    off_duty = "off_duty"
    on_break = "on_break"


class Staff(Base):
    __tablename__ = "staff"
    __table_args__ = (
        Index("ix_staff_hospital_role", "hospital_id", "role"),
        Index("ix_staff_user_hospital", "user_id", "hospital_id", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # Link to auth-service user -- NOT a DB-level FK (cross-service boundary)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    # Hospital scope -- every staff member belongs to exactly one hospital
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Identity
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Role & status
    role: Mapped[StaffRole] = mapped_column(
        SQLEnum(StaffRole), nullable=False, index=True
    )
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    shift_status: Mapped[ShiftStatus] = mapped_column(
        SQLEnum(ShiftStatus), default=ShiftStatus.off_duty
    )

    # Timestamps
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

    def __repr__(self) -> str:
        return f"<Staff id={self.id} role={self.role} name={self.full_name}>"
