# backend/healthcare-core/app/models/queue.py
from datetime import datetime
from typing import List, Optional
import uuid
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class QueueItem(Base):
    __tablename__ = "queue_items"

    id:            Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    queue_id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prescription_queues.id", ondelete="CASCADE"), nullable=False)
    medicine_name: Mapped[str]       = mapped_column(String(255), nullable=False)
    generic_name:  Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quantity:      Mapped[float]     = mapped_column(Float, default=1)
    dosage:        Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    unit_price:    Mapped[float]     = mapped_column(Float, default=0)


class PrescriptionQueue(Base):
    __tablename__ = "prescription_queues"

    id:            Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id:    Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    patient_id:    Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    patient_name:  Mapped[str]           = mapped_column(String(200), nullable=False)
    patient_phone: Mapped[str]           = mapped_column(String(50), nullable=False)
    source:        Mapped[str]           = mapped_column(String(20), default="manual")
    status:        Mapped[str]           = mapped_column(String(30), default="waiting")
    queue_number:  Mapped[int]           = mapped_column(Integer, nullable=False)
    total_amount:  Mapped[float]         = mapped_column(Float, default=0)
    accepted_by:   Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    upi_txn_ref:   Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    upi_txn_id:    Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes:         Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at:       Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:    Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items: Mapped[List[QueueItem]] = relationship("QueueItem", cascade="all, delete-orphan", lazy="selectin")
