"""
Lab Models

Maps to tables created in alembic/versions/005_lab.py and extended in
006_lab_extend.py. lab_results.py (rebuilt — the original file was missing
from the repo, which crashed the whole app's startup) is the API layer on
top of these.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Numeric, DateTime, ForeignKey, Enum as SQLEnum, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.doctor import Doctor


class LabOrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    SAMPLE_COLLECTED = "SAMPLE_COLLECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class LabResultStatus(str, enum.Enum):
    PENDING = "PENDING"
    NORMAL = "NORMAL"
    ABNORMAL = "ABNORMAL"
    CRITICAL = "CRITICAL"


class LabTest(Base):
    """Catalog of orderable lab tests. Created on-the-fly by name if not found
    (see lab_results.py's _get_or_create_test) — there's no curated catalog
    UI yet, so this acts as a dedupe table more than a managed price list."""
    __tablename__ = "lab_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    normal_range: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    turnaround_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)

    items: Mapped[list["LabOrderItem"]] = relationship(back_populates="test")


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False)
    ordered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[LabOrderStatus] = mapped_column(SQLEnum(LabOrderStatus, name="laborderstatus"), nullable=False, default=LabOrderStatus.ORDERED)
    ordered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=func.now())

    items: Mapped[list["LabOrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    patient: Mapped["Patient"] = relationship()
    doctor: Mapped[Optional["Doctor"]] = relationship()


class LabOrderItem(Base):
    __tablename__ = "lab_order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False)
    test_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_tests.id", ondelete="RESTRICT"), nullable=False)
    result_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    result_status: Mapped[LabResultStatus] = mapped_column(SQLEnum(LabResultStatus, name="labresultstatus"), nullable=False, default=LabResultStatus.PENDING)
    resulted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resulted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    clinical_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    order: Mapped["LabOrder"] = relationship(back_populates="items")
    test: Mapped["LabTest"] = relationship(back_populates="items")
