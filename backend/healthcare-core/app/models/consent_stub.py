import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, UUID, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class ConsentRecord(Base):
    __tablename__ = "consent_records"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    consent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

class DataDeletionRequest(Base):
    __tablename__ = "data_deletion_requests"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

class LabResult(Base):
    __tablename__ = "lab_results_stub"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    test_name: Mapped[str] = mapped_column(String(100), nullable=False)
    result_value: Mapped[str] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=True)
    reference_range: Mapped[str] = mapped_column(String(100), nullable=True)
