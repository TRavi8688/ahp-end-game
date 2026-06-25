# backend/ai-service/app/models/consent.py
# DB-6 FIX: ConsentRecord model for DPDP compliance.
# Also fixes the SEC-3 security issue from the earlier audit.

import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from shared.database.core import Base  # adjust path as needed


class ConsentType(str, enum.Enum):
    AI_PROCESSING = "AI_PROCESSING"
    PHI_SHARING = "PHI_SHARING"
    RESEARCH = "RESEARCH"


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
                server_default=func.gen_random_uuid())
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    consent_type = Column(Enum(ConsentType), nullable=False)

    granted = Column(Boolean, nullable=False, default=True)
    granted_at = Column(DateTime, nullable=False, server_default=func.now())
    revoked_at = Column(DateTime, nullable=True)
    granted_by = Column(UUID(as_uuid=True), nullable=True)  # patient user_id (or proxy)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6

    def is_active(self) -> bool:
        """True if consent was granted and has not been revoked."""
        return self.granted and self.revoked_at is None
