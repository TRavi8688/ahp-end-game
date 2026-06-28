"""
consent.py -- DPDP Act 2023 consent management models and service.
Phase 13 Fix: "No consent management code -- DPDP compliance claim is false."

Place at: backend/app/models/consent.py and backend/app/services/consent.py
"""
from __future__ import annotations

import enum
import hashlib
import hmac
import json
import os
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

# --- Import base -- adjust path to match your project -------------------------
# from backend.app.models.base import Base
# Using a placeholder here; replace with your actual Base import
from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()


# --- Enums --------------------------------------------------------------------

class ConsentPurpose(str, enum.Enum):
    """DPDP Act §7 -- Lawful purposes for processing personal data."""
    MEDICAL_TREATMENT = "medical_treatment"
    PRESCRIPTION_MANAGEMENT = "prescription_management"
    APPOINTMENT_BOOKING = "appointment_booking"
    LAB_RESULTS_SHARING = "lab_results_sharing"
    INSURANCE_CLAIM = "insurance_claim"
    TELEMEDICINE = "telemedicine"
    AI_DIAGNOSIS_ASSIST = "ai_diagnosis_assist"      # Requires explicit consent
    RESEARCH_ANONYMIZED = "research_anonymized"       # Requires explicit consent
    MARKETING = "marketing"                            # Requires explicit consent + easy withdrawal


class ConsentStatus(str, enum.Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


# --- Models -------------------------------------------------------------------

class ConsentRecord(Base):
    """
    DPDP Act 2023 §6(1): Consent must be free, specific, informed, unconditional, unambiguous.
    This table stores one record per patient per purpose.
    """
    __tablename__ = "consent_records"

    id = Column(Integer, primary_key=True, index=True)
    consent_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid4()))

    # Who gave consent
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # What was consented to
    purpose = Column(Enum(ConsentPurpose), nullable=False)

    # Status
    status = Column(Enum(ConsentStatus), default=ConsentStatus.ACTIVE, nullable=False)

    # When
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    withdrawn_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Some consents can be time-limited

    # What version of the privacy policy was shown
    policy_version = Column(String(20), nullable=False)

    # IP and user agent at time of consent (for audit)
    ip_address = Column(String(45), nullable=True)   # IPv6 max 45 chars
    user_agent = Column(String(500), nullable=True)

    # Cryptographic integrity -- HMAC-SHA256 chain (Blueprint §14.3)
    previous_hash = Column(String(64), nullable=True)  # Hash of previous record in chain
    record_hash = Column(String(64), nullable=False)   # Hash of this record

    # Hospital scoping
    hospital_id = Column(String(100), nullable=False)

    __table_args__ = (
        UniqueConstraint("patient_id", "purpose", "hospital_id", name="uq_consent_patient_purpose"),
        Index("ix_consent_patient_id", "patient_id"),
        Index("ix_consent_status", "status"),
    )


class AuditLog(Base):
    """
    Cryptographically chained audit log.
    Phase 13 Fix: "Cryptographic audit log chaining -- Not Implemented (Blueprint §14.3)"

    Each log entry includes the HMAC of the previous entry, creating
    a tamper-evident chain. Any modification invalidates all subsequent entries.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid4()))

    # Event classification
    event_type = Column(String(100), nullable=False)  # e.g. "record.accessed"
    actor_id = Column(Integer, nullable=False)         # User who performed action
    actor_role = Column(String(50), nullable=False)
    hospital_id = Column(String(100), nullable=False)

    # What was affected
    resource_type = Column(String(100), nullable=True)  # e.g. "patient_record"
    resource_id = Column(String(100), nullable=True)

    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    correlation_id = Column(String(36), nullable=True)  # Links to request log

    # Extra context as JSON (sanitized -- no PHI)
    metadata_json = Column(Text, nullable=True)

    # Timestamp
    occurred_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Cryptographic chain
    previous_hash = Column(String(64), nullable=True)
    record_hash = Column(String(64), nullable=False)

    __table_args__ = (
        Index("ix_audit_actor_id", "actor_id"),
        Index("ix_audit_event_type", "event_type"),
        Index("ix_audit_hospital_id", "hospital_id"),
        Index("ix_audit_occurred_at", "occurred_at"),
    )


# --- Service: Consent management ---------------------------------------------

AUDIT_HMAC_SECRET = os.environ.get("AUDIT_HMAC_SECRET", os.environ.get("SECRET_KEY", ""))


def _compute_record_hash(data: dict, previous_hash: Optional[str]) -> str:
    """
    Compute HMAC-SHA256 of a record, chained to the previous record's hash.
    This creates a tamper-evident audit chain.
    """
    chain_input = json.dumps({
        **data,
        "previous_hash": previous_hash or "GENESIS",
    }, sort_keys=True, default=str)

    return hmac.new(
        AUDIT_HMAC_SECRET.encode(),
        chain_input.encode(),
        hashlib.sha256,
    ).hexdigest()


class ConsentService:
    """DPDP Act 2023 consent lifecycle management."""

    def __init__(self, db):
        self.db = db

    async def grant_consent(
        self,
        patient_id: int,
        purpose: ConsentPurpose,
        hospital_id: str,
        policy_version: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsentRecord:
        """
        Record explicit patient consent for a specific purpose.
        DPDP §6(1): consent must be specific and documented.
        """
        from sqlalchemy import select

        # Get last record for chaining
        result = await self.db.execute(
            select(ConsentRecord)
            .where(ConsentRecord.patient_id == patient_id)
            .order_by(ConsentRecord.granted_at.desc())
            .limit(1)
        )
        last_record = result.scalars().first()
        previous_hash = last_record.record_hash if last_record else None

        record_data = {
            "patient_id": patient_id,
            "purpose": purpose.value,
            "hospital_id": hospital_id,
            "policy_version": policy_version,
            "granted_at": datetime.utcnow().isoformat(),
            "status": ConsentStatus.ACTIVE.value,
        }

        record_hash = _compute_record_hash(record_data, previous_hash)

        consent = ConsentRecord(
            patient_id=patient_id,
            purpose=purpose,
            hospital_id=hospital_id,
            policy_version=policy_version,
            status=ConsentStatus.ACTIVE,
            ip_address=ip_address,
            user_agent=user_agent,
            previous_hash=previous_hash,
            record_hash=record_hash,
        )

        self.db.add(consent)
        await self.db.commit()
        await self.db.refresh(consent)
        return consent

    async def withdraw_consent(
        self,
        patient_id: int,
        purpose: ConsentPurpose,
        hospital_id: str,
    ) -> bool:
        """
        DPDP §6(4): Withdrawal of consent must be as easy as granting it.
        """
        from sqlalchemy import select

        result = await self.db.execute(
            select(ConsentRecord).where(
                ConsentRecord.patient_id == patient_id,
                ConsentRecord.purpose == purpose,
                ConsentRecord.hospital_id == hospital_id,
                ConsentRecord.status == ConsentStatus.ACTIVE,
            )
        )
        record = result.scalars().first()
        if not record:
            return False

        record.status = ConsentStatus.WITHDRAWN
        record.withdrawn_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def has_consent(
        self,
        patient_id: int,
        purpose: ConsentPurpose,
        hospital_id: str,
    ) -> bool:
        """Check if a patient has active consent for a purpose."""
        from sqlalchemy import select

        result = await self.db.execute(
            select(ConsentRecord).where(
                ConsentRecord.patient_id == patient_id,
                ConsentRecord.purpose == purpose,
                ConsentRecord.hospital_id == hospital_id,
                ConsentRecord.status == ConsentStatus.ACTIVE,
            )
        )
        return result.scalars().first() is not None

    async def get_patient_consents(self, patient_id: int) -> List[ConsentRecord]:
        """DPDP §12: Data principal has right to access their own data."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(ConsentRecord).where(ConsentRecord.patient_id == patient_id)
        )
        return result.scalars().all()


class AuditLogService:
    """
    Cryptographically chained audit logging.
    Phase 13 Fix: Blueprint §14.3 mandated this; it was not implemented.
    """

    def __init__(self, db):
        self.db = db

    async def log(
        self,
        event_type: str,
        actor_id: int,
        actor_role: str,
        hospital_id: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        correlation_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> AuditLog:
        """
        Append an event to the tamper-evident audit chain.
        All PHI must be excluded from metadata -- use resource_id references only.
        """
        from sqlalchemy import select

        # Get previous record for chain
        result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.hospital_id == hospital_id)
            .order_by(AuditLog.occurred_at.desc())
            .limit(1)
        )
        last_log = result.scalars().first()
        previous_hash = last_log.record_hash if last_log else None

        # Sanitize metadata -- remove any PHI fields
        safe_metadata = _sanitize_metadata(metadata or {})

        record_data = {
            "event_type": event_type,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "hospital_id": hospital_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "occurred_at": datetime.utcnow().isoformat(),
        }

        record_hash = _compute_record_hash(record_data, previous_hash)

        log_entry = AuditLog(
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            hospital_id=hospital_id,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            ip_address=ip_address,
            correlation_id=correlation_id,
            metadata_json=json.dumps(safe_metadata) if safe_metadata else None,
            previous_hash=previous_hash,
            record_hash=record_hash,
        )

        self.db.add(log_entry)
        await self.db.commit()
        await self.db.refresh(log_entry)
        return log_entry

    async def verify_chain_integrity(self, hospital_id: str) -> bool:
        """
        Verify the cryptographic chain has not been tampered with.
        Returns True if all records chain correctly, False if any tampering detected.
        """
        from sqlalchemy import select

        result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.hospital_id == hospital_id)
            .order_by(AuditLog.occurred_at.asc())
        )
        logs = result.scalars().all()

        if not logs:
            return True

        previous_hash = None
        for log in logs:
            record_data = {
                "event_type": log.event_type,
                "actor_id": log.actor_id,
                "actor_role": log.actor_role,
                "hospital_id": log.hospital_id,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "occurred_at": log.occurred_at.isoformat(),
            }
            expected_hash = _compute_record_hash(record_data, previous_hash)
            if expected_hash != log.record_hash:
                return False  # Tampering detected
            previous_hash = log.record_hash

        return True


def _sanitize_metadata(metadata: dict) -> dict:
    """Remove PHI keys from audit log metadata."""
    PHI_KEYS = {
        "name", "phone", "email", "address", "dob", "diagnosis",
        "prescription", "lab_result", "aadhaar", "pan", "password", "otp",
    }
    return {k: v for k, v in metadata.items() if k.lower() not in PHI_KEYS}
