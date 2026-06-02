# backend/ai-service/app/models/consent.py
# SEC-3 FIX: ConsentRecord model for DPDP compliance

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base  # adjust import path as needed


class ConsentType(str, enum.Enum):
    AI_PROCESSING = "AI_PROCESSING"
    PHI_SHARING = "PHI_SHARING"


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    consent_type = Column(Enum(ConsentType), nullable=False)
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True, default=None)
    granted_by = Column(UUID(as_uuid=True), nullable=True)  # user_id who granted (self or proxy)

    def is_active(self) -> bool:
        """Return True if consent was granted and not yet revoked."""
        return self.granted_at is not None and self.revoked_at is None
