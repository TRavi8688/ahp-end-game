import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base
import enum

class ConsentType(str, enum.Enum):
    DATA_SHARING = "DATA_SHARING"
    RESEARCH = "RESEARCH"
    MARKETING = "MARKETING"
    TELEMETRY = "TELEMETRY"

class ConsentStatus(str, enum.Enum):
    GRANTED = "GRANTED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"

class PatientConsent(Base):
    """
    HIPAA/GDPR Consent Registry.
    Tracks explicit patient consent for data sharing across the hospital network.
    """
    __tablename__ = "patient_consents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True) # Org/Branch where consent was captured
    
    consent_type = Column(Enum(ConsentType), nullable=False)
    status = Column(Enum(ConsentStatus), default=ConsentStatus.GRANTED, nullable=False)
    
    # Cryptographic proof or reference to the signed document (e.g. PDF hash)
    document_hash = Column(String, nullable=True) 
    
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True) # Consent might require yearly renewal
    
    # Audit trail of exactly what was consented to
    metadata_snapshot = Column(JSONB, nullable=True)
