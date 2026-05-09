from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, ForeignKey, JSON, Float, Enum as SQLEnum
from datetime import datetime, timezone
from app.models.base import Base
import enum
import uuid

class VerificationTypeEnum(str, enum.Enum):
    drug_license = "drug_license"
    medical_degree = "medical_degree"
    hospital_registration = "hospital_registration"
    identity_proof = "identity_proof"

class VerificationStatusEnum(str, enum.Enum):
    pending = "pending"
    ai_processing = "ai_processing"
    flagged = "flagged"
    verified = "verified"
    rejected = "rejected"

class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospyn_id: Mapped[str] = mapped_column(String(50), index=True) # Tenant lock
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True) # ID of the User or Organization being verified
    document_type: Mapped[VerificationTypeEnum] = mapped_column(SQLEnum(VerificationTypeEnum))
    document_url: Mapped[str] = mapped_column(String(512))
    
    # Advanced Trust Data
    license_number: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    biometric_hash: Mapped[Optional[str]] = mapped_column(String(255)) # For high-security Face Match
    identity_photo_url: Mapped[Optional[str]] = mapped_column(String(512)) # For visual clarity and accountability
    
    # AI Results
    status: Mapped[VerificationStatusEnum] = mapped_column(SQLEnum(VerificationStatusEnum), default=VerificationStatusEnum.pending)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    extracted_data: Mapped[dict] = mapped_column(JSON, nullable=True) # Data from OCR (Registration #, Expiry, etc.)
    ai_notes: Mapped[str] = mapped_column(String(1000), nullable=True)
    
    # Human Audit
    audited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    audited_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
