# backend/healthcare-core/app/models/lab_order.py
from datetime import datetime
from typing import List, Optional
import uuid
from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class LabTest(Base):
    __tablename__ = "lab_tests"

    id:           Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lab_order_id: Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False)
    test_name:    Mapped[str]            = mapped_column(String(255), nullable=False)
    test_code:    Mapped[str]            = mapped_column(String(100), nullable=False)
    normal_range: Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    unit:         Mapped[Optional[str]]  = mapped_column(String(50), nullable=True)
    price:        Mapped[float]          = mapped_column(Float, default=0)
    result_value: Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    is_abnormal:  Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id:                   Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id:           Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    patient_id:           Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    order_number:         Mapped[str]           = mapped_column(String(100), nullable=False, unique=True)
    patient_name:         Mapped[str]           = mapped_column(String(200), nullable=False)
    patient_phone:        Mapped[str]           = mapped_column(String(50), nullable=False)
    source:               Mapped[str]           = mapped_column(String(20), default="manual")
    status:               Mapped[str]           = mapped_column(String(30), default="pending")
    sample_qr:            Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    report_url:           Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    total_amount:         Mapped[float]         = mapped_column(Float, default=0)
    notes:                Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sample_collected_at:  Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reported_at:          Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:           Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tests: Mapped[List[LabTest]] = relationship("LabTest", cascade="all, delete-orphan", lazy="selectin")
