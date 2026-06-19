from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, Enum as SQLEnum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum
import uuid
from typing import Optional
from sqlalchemy.dialects.postgresql import UUID

from app.models.models import Base

class VerificationTaskStatusEnum(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    done = "done"

class VerificationTaskPriorityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class HospitalDocumentTypeEnum(str, enum.Enum):
    hospital_license = "hospital_license"
    gst_certificate = "gst_certificate"
    nabh_certificate = "nabh_certificate"
    drug_license = "drug_license"
    ownership_proof = "ownership_proof"
    address_proof = "address_proof"

class VerificationActionTypeEnum(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    request_more_info = "request_more_info"
    assign = "assign"
    reassign = "reassign"
    suspend = "suspend"
    blacklist = "blacklist"
    reopen = "reopen"
    edit_applied = "edit_applied"

class FraudSignalTypeEnum(str, enum.Enum):
    duplicate_gst = "duplicate_gst"
    duplicate_domain = "duplicate_domain"
    fake_license = "fake_license"
    suspicious_email = "suspicious_email"
    disposable_email = "disposable_email"
    ip_mismatch = "ip_mismatch"

class FraudSeverityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class BlacklistTypeEnum(str, enum.Enum):
    email = "email"
    domain = "domain"
    phone = "phone"
    gst = "gst"
    ip_address = "ip_address"

class VerificationTask(Base):
    __tablename__ = "verification_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    assigned_verifier_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[VerificationTaskStatusEnum] = mapped_column(SQLEnum(VerificationTaskStatusEnum), default=VerificationTaskStatusEnum.open)
    priority: Mapped[VerificationTaskPriorityEnum] = mapped_column(SQLEnum(VerificationTaskPriorityEnum), default=VerificationTaskPriorityEnum.medium)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class HospitalDocument(Base):
    __tablename__ = "hospital_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    document_type: Mapped[HospitalDocumentTypeEnum] = mapped_column(SQLEnum(HospitalDocumentTypeEnum))
    document_url: Mapped[str] = mapped_column(String(512))
    document_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, verified, rejected
    
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # AI Fields
    ai_confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_blurry: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class VerificationHistory(Base):
    __tablename__ = "verification_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    verifier_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action_type: Mapped[VerificationActionTypeEnum] = mapped_column(SQLEnum(VerificationActionTypeEnum))
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HospitalEditDraft(Base):
    __tablename__ = "hospital_edit_drafts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    field_name: Mapped[str] = mapped_column(String(100))
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposed_value: Mapped[str] = mapped_column(Text)
    edited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class VerifierNote(Base):
    __tablename__ = "verifier_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    verifier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FraudSignal(Base):
    __tablename__ = "fraud_signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    signal_type: Mapped[FraudSignalTypeEnum] = mapped_column(SQLEnum(FraudSignalTypeEnum))
    severity: Mapped[FraudSeverityEnum] = mapped_column(SQLEnum(FraudSeverityEnum))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BlacklistRegistry(Base):
    __tablename__ = "blacklist_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blacklist_type: Mapped[BlacklistTypeEnum] = mapped_column(SQLEnum(BlacklistTypeEnum))
    value: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
