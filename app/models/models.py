from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin

# Portable JSON type: JSONB on Postgres, JSON on others (SQLite)






















from .core import *
from .clinical import *


class Doctor(Base):
    __tablename__ = "doctors"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    specialty: Mapped[Optional[str]] = mapped_column(String(100))
    license_number: Mapped[str] = mapped_column(String(100), unique=True)
    license_status: Mapped[LicenseStatusEnum] = mapped_column(SQLEnum(LicenseStatusEnum), default=LicenseStatusEnum.pending)
    license_copy_url: Mapped[Optional[str]] = mapped_column(String(255))
    verification_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    user: Mapped["User"] = relationship(back_populates="doctor_profile")

    @property
    def hospital_id(self) -> Optional[uuid.UUID]:
        if self.user and self.user.staff_profile:
            return self.user.staff_profile.hospital_id
        return None

    __mapper_args__ = {"version_id_col": version_id}









class DoctorAccess(Base):
    __tablename__ = "doctor_access"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    doctor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    doctor_name: Mapped[str] = mapped_column(String(255))
    clinic_name: Mapped[Optional[str]] = mapped_column(String(255))
    access_level: Mapped[AccessLevelEnum] = mapped_column(SQLEnum(AccessLevelEnum), default=AccessLevelEnum.read)
    status: Mapped[AccessStatusEnum] = mapped_column(SQLEnum(AccessStatusEnum), default=AccessStatusEnum.requested)
    granted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patients.id"))
    doctor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    type: Mapped[NotificationTypeEnum] = mapped_column(SQLEnum(NotificationTypeEnum), default=NotificationTypeEnum.alert)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class AISummary(Base):
    __tablename__ = "ai_summaries"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    one_page_summary: Mapped[str] = mapped_column(TextEncryptedType)
    patient_summary: Mapped[str] = mapped_column(TextEncryptedType)
    doctor_summary: Mapped[str] = mapped_column(TextEncryptedType)
    structured_data: Mapped[dict] = mapped_column(JSON_TYPE) # Dashboard analytics
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base, TenantScopedMixin):
    __tablename__ = "audit_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patients.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(100), index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(255))
    # hospital_id now provided by TenantScopedMixin
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    signature: Mapped[str] = mapped_column(String(255)) 
    prev_hash: Mapped[str] = mapped_column(String(255))

class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    event_version: Mapped[str] = mapped_column(String(20))
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospitals.id"), index=True, nullable=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    payload: Mapped[dict] = mapped_column(JSON_TYPE)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

class DoctorVerificationSession(Base):
    __tablename__ = "doctor_verification_sessions"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    registration_number: Mapped[str] = mapped_column(String(100))
    state_medical_council: Mapped[str] = mapped_column(String(255))
    mobile_number: Mapped[str] = mapped_column(String(20))
    status: Mapped[VerificationStatusEnum] = mapped_column(SQLEnum(VerificationStatusEnum), default=VerificationStatusEnum.pending)
    aadhaar_url: Mapped[Optional[str]] = mapped_column(String(255))
    selfie_url: Mapped[Optional[str]] = mapped_column(String(255))
    face_match_score: Mapped[Optional[float]] = mapped_column(default=0.0)
    otp: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Message(Base, TenantScopedMixin):
    __tablename__ = "messages"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    conversation_id: Mapped[str] = mapped_column(String(50), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[MessageRoleEnum] = mapped_column(SQLEnum(MessageRoleEnum), default=MessageRoleEnum.user)
    content: Mapped[str] = mapped_column(Text)
    # AI Safety Metadata (Confidence, Evidence, Traceability)
    safety_metadata: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class QueueEntry(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "queue_entries"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    # hospital_id now provided by TenantScopedMixin
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("doctors.id"))
    clinic_name: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[QueueStatusEnum] = mapped_column(SQLEnum(QueueStatusEnum), default=QueueStatusEnum.checked_in)
    token_number: Mapped[Optional[int]] = mapped_column()
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="queue_entries")
    department: Mapped["Department"] = relationship(back_populates="queue_entries")

class JobFailure(Base):
    __tablename__ = "job_failures"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(100), index=True)
    function_name: Mapped[str] = mapped_column(String(100))
    args: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    error: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class ClinicalAIEvent(Base, TenantScopedMixin, TimestampMixin):
    """
    ENTERPRISE AI BLACK BOX RECORDER:
    Stores every LLM interaction with full context for forensic replay.
    """
    __tablename__ = "clinical_ai_events"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospitals.id"), index=True)
    trace_id: Mapped[str] = mapped_column(String(100), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    
    # Prompt Provenance
    prompt_template: Mapped[str] = mapped_column(String(255))
    prompt_payload: Mapped[dict] = mapped_column(JSON_TYPE) # Masked/Encrypted
    
    # Response Data
    response_text: Mapped[str] = mapped_column(Text)
    safety_metadata: Mapped[dict] = mapped_column(JSON_TYPE) # {confidence, evidence, risk_score}
    
    # Provider Diagnostics
    provider: Mapped[str] = mapped_column(String(50))
    model_version: Mapped[str] = mapped_column(String(50))
    latency_ms: Mapped[int] = mapped_column()
    
    # Safety Governance
    safety_mode: Mapped[AISafetyMode] = mapped_column(SQLEnum(AISafetyMode), default=AISafetyMode.informational)
    policy_filters_applied: Mapped[Optional[List[str]]] = mapped_column(JSON_TYPE)
    
    overridden: Mapped[bool] = mapped_column(default=False)

class ClinicianOverride(Base, TenantScopedMixin, TimestampMixin):
    """
    CLINICIAN SUPREMACY LAYER:
    Allows doctors to formally dismiss or correct AI recommendations.
    """
    __tablename__ = "clinician_overrides"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    ai_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinical_ai_events.id"), index=True)
    doctor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    
    override_type: Mapped[str] = mapped_column(String(50)) # e.g., DISMISS, CORRECT, ESCALATE
    justification: Mapped[str] = mapped_column(Text)
    correction_text: Mapped[Optional[str]] = mapped_column(Text)
    
    # Retraining feedback
    severity_impact: Mapped[str] = mapped_column(String(50)) # e.g., LOW, MEDIUM, CRITICAL_SAFETY_RISK






class PartnerPharmacyRequest(Base, TenantScopedMixin, TimestampMixin):
    """
    B2B2C Referral: Routes a prescription from a referring clinic to a partner pharmacy shop.
    """
    __tablename__ = "partner_pharmacy_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    prescription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("digital_prescriptions.id"), index=True)
    referring_hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    partner_pharmacy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    status: Mapped[PartnerReferralStatusEnum] = mapped_column(
        SQLEnum(PartnerReferralStatusEnum), default=PartnerReferralStatusEnum.pending
    )
    
    prescription: Mapped["DigitalPrescription"] = relationship()
    patient: Mapped["Patient"] = relationship()
    referring_hospital: Mapped["Hospital"] = relationship(foreign_keys=[referring_hospital_id])
    partner_pharmacy: Mapped["Hospital"] = relationship(foreign_keys=[partner_pharmacy_id])

class PharmacyStock(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pharmacy_stock"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    medication_name: Mapped[str] = mapped_column(String(255), index=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(default=0)
    unit: Mapped[str] = mapped_column(String(50)) # e.g., Tablets, Bottles
    min_stock_level: Mapped[int] = mapped_column(default=10)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    batch_number: Mapped[Optional[str]] = mapped_column(String(100))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="inventory")


class ClinicalEvent(Base):
    """
    THE HEART OF Hospyn: Immutable Clinical Event Stream.
    Stores every longitudinal action with zero mutation.
    Used for Timeline reconstruction, AI Context, and Auditing.
    """
    __tablename__ = "clinical_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True) # Staff/User ID
    
    event_type: Mapped[str] = mapped_column(String(100), index=True) # e.g., PRESCRIPTION_CREATED
    aggregate_type: Mapped[str] = mapped_column(String(100), index=True) # e.g., lab_order
    aggregate_id: Mapped[str] = mapped_column(String(100), index=True) # Entity ID
    
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    payload: Mapped[dict] = mapped_column(JSON_TYPE) # Structured clinical data
    metadata_info: Mapped[dict] = mapped_column(JSON_TYPE) # IP, device, app_version
    
    signature: Mapped[str] = mapped_column(String(255)) # Integrity hash
    version: Mapped[int] = mapped_column(default=1)

class FamilyMember(Base, TimestampMixin):
    """
    CARE CIRCLE: Managing blood-line coordination for dependents.
    """
    __tablename__ = "family_members"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    full_name: Mapped[str] = mapped_column(String(255))
    relation: Mapped[str] = mapped_column(String(50)) # Mother, Father, Spouse, Child, etc.
    phone_number: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Basic Health Profile for Member
    blood_group: Mapped[Optional[str]] = mapped_column(String(10))
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Cross-link if the family member has their own Hospyn ID
    linked_hospyn_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    patient: Mapped["Patient"] = relationship(back_populates="family_members")

# --- QUEUE & ADMISSION MODELS (Consolidated for Metadata Integrity) ---

class QueueTokenStatus(str, enum.Enum):
    WAITING = "WAITING"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    EMERGENCY_OVERRIDE = "EMERGENCY_OVERRIDE"

class QueueToken(Base, TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin):
    __tablename__ = "queue_tokens"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), nullable=False, index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    status: Mapped[QueueTokenStatus] = mapped_column(SQLEnum(QueueTokenStatus), nullable=False, default=QueueTokenStatus.WAITING)
    priority_score: Mapped[int] = mapped_column(nullable=False, default=0)

    hospital = relationship("Hospital", back_populates="queues")
    department = relationship("Department", back_populates="queues")

class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    TEMP_RESERVED = "TEMP_RESERVED"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"

class AdmissionStatus(str, enum.Enum):
    PENDING = "PENDING"
    ADMITTED = "ADMITTED"
    DISCHARGED = "DISCHARGED"

class Bed(Base, TenantScopedMixin, VersionedMixin, AuditableMixin):
    __tablename__ = "beds"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    bed_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[BedStatusEnum] = mapped_column(SQLEnum(BedStatusEnum), nullable=False, default=BedStatusEnum.available)

    hospital: Mapped["Hospital"] = relationship(back_populates="beds")
    department: Mapped[Optional["Department"]] = relationship(back_populates="beds")

class Admission(Base, TenantScopedMixin, VersionedMixin, AuditableMixin):
    __tablename__ = "admissions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    queue_token_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("queue_tokens.id"), nullable=True)
    bed_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("beds.id"), nullable=True)
    status: Mapped[AdmissionStatus] = mapped_column(SQLEnum(AdmissionStatus), default=AdmissionStatus.ADMITTED)
    
    admitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    discharged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    hospital: Mapped["Hospital"] = relationship(backref="admissions")
    patient: Mapped["Patient"] = relationship(backref="admissions")
    bed: Mapped[Optional["Bed"]] = relationship(backref="admissions")

class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True) # Phone or Email
    otp: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_verified: Mapped[bool] = mapped_column(default=False)

class ClinicalJobTracker(Base, TimestampMixin):
    """
    P0 QUEUE DURABILITY GUARD.
    Tracks the lifecycle of critical background jobs (OCR, AI).
    Ensures that if Redis crashes, we can recover 'lost' jobs from the DB.
    """
    __tablename__ = "clinical_job_tracker"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_type: Mapped[str] = mapped_column(String(50)) # OCR, REPORT_AI
    resource_id: Mapped[uuid.UUID] = mapped_column(index=True) # MedicalRecord ID
    status: Mapped[str] = mapped_column(String(20), default="queued") # queued, processing, complete, failed
    worker_id: Mapped[Optional[str]] = mapped_column(String(100))
    error_log: Mapped[Optional[str]] = mapped_column(Text)
    
    # Heartbeat & Self-Healing (Section 8 Drift Defense)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    retry_count: Mapped[int] = mapped_column(default=0)
    retry_reason: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Expiry for automatic cleanup of completed jobs
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
class NotificationQueue(Base, TimestampMixin):
    """
    P0 NOTIFICATION RESILIENCE (Section 3.2).
    Stages all outgoing messages (SMS, WhatsApp) in Postgres.
    Ensures clinical alerts (Abnormal Labs) are retried and escalated if providers fail.
    """
    __tablename__ = "notification_queue"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patients.id"), index=True)
    provider: Mapped[str] = mapped_column(String(50)) # twilio, whatsapp, firebase
    message_type: Mapped[str] = mapped_column(String(50)) # OTP, LAB_ALERT, APPOINTMENT
    payload: Mapped[dict] = mapped_column(JSON_TYPE)
    
    status: Mapped[str] = mapped_column(String(20), default="pending") # pending, sent, failed, escalated
    retry_count: Mapped[int] = mapped_column(default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    NET_BANKING = "NET_BANKING"
    INSURANCE = "INSURANCE"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"

class Invoice(Base, TenantScopedMixin, TimestampMixin):
    """
    HOSPYN FINANCIAL LEDGER:
    The central authority for patient billing.
    """
    __tablename__ = "invoices"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patient_visits.id"), nullable=True)
    
    total_amount: Mapped[float] = mapped_column(default=0.0)
    discount_amount: Mapped[float] = mapped_column(default=0.0)
    tax_amount: Mapped[float] = mapped_column(default=0.0)
    payable_amount: Mapped[float] = mapped_column(default=0.0)
    paid_amount: Mapped[float] = mapped_column(default=0.0)
    
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), default=PaymentStatus.DRAFT)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    items: Mapped[List["BillItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="invoice")

class BillItem(Base, TimestampMixin):
    """
    INDIVIDUAL CHARGE LINES:
    Detailed breakdown of consultation, pharmacy, and lab charges.
    """
    __tablename__ = "bill_items"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    
    item_name: Mapped[str] = mapped_column(String(255))
    item_category: Mapped[str] = mapped_column(String(100)) # Consultation, Lab, Pharmacy, Room, OT
    quantity: Mapped[float] = mapped_column(default=1.0)
    unit_price: Mapped[float] = mapped_column(default=0.0)
    subtotal: Mapped[float] = mapped_column(default=0.0)
    tax_percent: Mapped[float] = mapped_column(default=0.0)
    
    invoice: Mapped["Invoice"] = relationship(back_populates="items")

class Payment(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    FINANCIAL INTEGRITY LAYER (Section 2.2).
    Tracks every transaction with exactly-once semantic potential.
    """
    __tablename__ = "payments"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("invoices.id"), index=True)
    
    amount: Mapped[float] = mapped_column()
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod), default=PaymentMethod.CASH)
    
    provider: Mapped[Optional[str]] = mapped_column(String(50)) # razorpay, stripe
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON_TYPE) # Store billing items
    
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="payments")
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}

class InsuranceClaim(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    REVENUE CYCLE MANAGEMENT (RCM).
    Tracks claims submitted to TPAs.
    """
    __tablename__ = "insurance_claims"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("payments.id"))
    
    tpa_name: Mapped[str] = mapped_column(String(100), index=True)
    policy_number: Mapped[str] = mapped_column(StringEncryptedType(100))
    claim_amount: Mapped[float] = mapped_column()
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED") # SUBMITTED, APPROVED, REJECTED, DISBURSED
    
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}

class StockMovementType(str, enum.Enum):
    INWARD = "INWARD" # Purchase / Return
    OUTWARD = "OUTWARD" # Dispensed / Expired / Damaged
    ADJUSTMENT = "ADJUSTMENT" # Manual correction

class StockLedger(Base, TenantScopedMixin, TimestampMixin):
    """
    PHARMACY AUDIT TRAIL.
    Permanent, immutable record of every stock movement.
    Prevents inventory leakage (theft/unrecorded sales).
    """
    __tablename__ = "pharmacy_stock_ledger"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    stock_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pharmacy_stock.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    movement_type: Mapped[StockMovementType] = mapped_column(SQLEnum(StockMovementType))
    quantity: Mapped[int] = mapped_column() # Change in quantity
    balance_after: Mapped[int] = mapped_column() # Running balance for audit
    
    reference_type: Mapped[str] = mapped_column(String(50)) # e.g., PRESCRIPTION, PURCHASE_ORDER
    reference_id: Mapped[Optional[str]] = mapped_column(String(100))
    
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id")) # Who performed the move

class PurchaseOrder(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    AUTOMATED PROCUREMENT ENGINE.
    Staged when stock falls below min_stock_level.
    """
    __tablename__ = "purchase_orders"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    supplier_name: Mapped[str] = mapped_column(String(255), index=True)
    items_json: Mapped[dict] = mapped_column(JSON_TYPE) # List of meds and quantities
    total_estimated_cost: Mapped[float] = mapped_column()
    
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, APPROVED, SENT, RECEIVED, CANCELLED
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}

class DeviceType(str, enum.Enum):
    SCANNER = "SCANNER" # MRI / CT / X-Ray
    MONITOR = "MONITOR" # Bedside Pulse/Oxy
    LAB_ANALYZER = "LAB_ANALYZER" # Blood testing machines
    WEARABLE = "WEARABLE" # Apple Watch / Fitbit

class MedicalDevice(Base, TenantScopedMixin, TimestampMixin):
    """
    HOSPYN MACHINE INTEGRATION.
    Registers physical hardware in the hospital for HL7/FHIR data ingestion.
    """
    __tablename__ = "medical_devices"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    name: Mapped[str] = mapped_column(String(255))
    device_type: Mapped[DeviceType] = mapped_column(SQLEnum(DeviceType))
    model_number: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    ip_address: Mapped[Optional[str]] = mapped_column(String(50)) # For local network discovery
    last_ping: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="ONLINE")

class FHIRResource(Base, TenantScopedMixin, TimestampMixin):
    """
    HL7/FHIR INTEROPERABILITY GATEWAY.
    Stores standardized healthcare data for exchange with external systems.
    Ensures Hospyn is compliant with international health data standards.
    """
    __tablename__ = "fhir_resources"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    resource_type: Mapped[str] = mapped_column(String(100), index=True) # e.g., Observation, Condition, Procedure
    fhir_json: Mapped[dict] = mapped_column(JSON_TYPE) # Full FHIR-compliant JSON
    
    source_device_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_devices.id"))
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True) # ID in external system

class TeleConsultStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    MISSED = "MISSED"

class TeleConsultation(Base, TenantScopedMixin, TimestampMixin):
    """
    DECENTRALIZED CARE GATEWAY.
    Manages secure video session metadata.
    """
    __tablename__ = "tele_consultations"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    
    status: Mapped[TeleConsultStatus] = mapped_column(SQLEnum(TeleConsultStatus), default=TeleConsultStatus.SCHEDULED)
    
    meeting_provider: Mapped[str] = mapped_column(String(50)) # daily.co, zoom, twilio
    meeting_id: Mapped[str] = mapped_column(String(255), unique=True)
    meeting_url: Mapped[Optional[str]] = mapped_column(String(512))
    
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

class WearableDataType(str, enum.Enum):
    HEART_RATE = "HEART_RATE"
    STEPS = "STEPS"
    SLEEP = "SLEEP"
    SPO2 = "SPO2"
    BLOOD_GLUCOSE = "BLOOD_GLUCOSE"

class WearableData(Base, TenantScopedMixin, TimestampMixin):
    """
    REMOTE PATIENT MONITORING (RPM).
    Ingests longitudinal health data from Apple Health / Google Fit.
    """
    __tablename__ = "wearable_data"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    data_type: Mapped[WearableDataType] = mapped_column(SQLEnum(WearableDataType))
    value: Mapped[float] = mapped_column()
    unit: Mapped[str] = mapped_column(String(50))
    
    source: Mapped[str] = mapped_column(String(50)) # apple_health, google_fit, garmin
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

class DailyHospitalMetrics(Base, TenantScopedMixin):
    """
    EXECUTIVE COMMAND CENTER (Phase 4.1).
    Caches aggregated daily performance metrics for CEOs and Admins.
    Ensures dashboard performance without heavy live query overhead.
    """
    __tablename__ = "daily_hospital_metrics"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    
    # Financial Intelligence
    total_revenue: Mapped[float] = mapped_column(default=0.0)
    pharmacy_revenue: Mapped[float] = mapped_column(default=0.0)
    insurance_pending_amount: Mapped[float] = mapped_column(default=0.0)
    
    # Operational Intelligence
    total_patients_seen: Mapped[int] = mapped_column(default=0)
    average_wait_time_minutes: Mapped[float] = mapped_column(default=0.0)
    bed_occupancy_rate: Mapped[float] = mapped_column(default=0.0)
    
    # Clinical Intelligence
    total_prescriptions_issued: Mapped[int] = mapped_column(default=0)
    critical_alerts_triggered: Mapped[int] = mapped_column(default=0)
    
    metadata_snapshot: Mapped[dict] = mapped_column(JSON_TYPE) # Detailed breakdown

class PatientRiskProfile(Base, TenantScopedMixin, TimestampMixin):
    """
    PREDICTIVE CLINICAL INTELLIGENCE (Phase 4.2).
    Stores AI-calculated risk scores for proactive medical intervention.
    The "Early Warning System" of the hospital.
    """
    __tablename__ = "patient_risk_profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), unique=True, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    # AI Risk Scores (0.0 to 1.0)
    readmission_risk: Mapped[float] = mapped_column(default=0.0)
    critical_deterioration_risk: Mapped[float] = mapped_column(default=0.0) # Sepsis/Shock prediction
    no_show_risk: Mapped[float] = mapped_column(default=0.0) # Appointment reliability
    
    # Reasoning & Evidence
    risk_factors: Mapped[dict] = mapped_column(JSON_TYPE) # e.g., ["Uncontrolled Diabetes", "High Pulse Trend"]
    last_evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Actionable Alerting
    alert_triggered: Mapped[bool] = mapped_column(default=False)
    clinical_priority: Mapped[str] = mapped_column(String(20), default="LOW") # LOW, MEDIUM, HIGH, CRITICAL

    # Actionable Alerting
    alert_triggered: Mapped[bool] = mapped_column(default=False)
    clinical_priority: Mapped[str] = mapped_column(String(20), default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
class InventoryTransactionType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"
    EXPIRY = "EXPIRY"
    RETURN = "RETURN"

class PharmacyInventory(Base, TenantScopedMixin, TimestampMixin):
    """
    HOSPYN PHARMACY LEDGER:
    Tracks medication stock levels, batches, and expiries.
    """
    __tablename__ = "pharmacy_inventory"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    item_name: Mapped[str] = mapped_column(String(255), index=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    batch_number: Mapped[str] = mapped_column(String(100), index=True)
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    
    stock_quantity: Mapped[float] = mapped_column(default=0.0)
    unit_price: Mapped[float] = mapped_column(default=0.0)
    reorder_level: Mapped[float] = mapped_column(default=10.0)
    
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    tax_percent: Mapped[float] = mapped_column(default=12.0) # GST
    
    transactions: Mapped[List["InventoryTransaction"]] = relationship(back_populates="item")

class InventoryTransaction(Base, TenantScopedMixin, TimestampMixin):
    """
    AUDIT TRAIL FOR STOCK:
    Records every movement of pharmacy items.
    """
    __tablename__ = "inventory_transactions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pharmacy_inventory.id"), index=True)
    
    transaction_type: Mapped[InventoryTransactionType] = mapped_column(SQLEnum(InventoryTransactionType))
    quantity: Mapped[float] = mapped_column() # Positive for stock in, Negative for stock out
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True) # Invoice ID or Purchase Order ID
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    item: Mapped["PharmacyInventory"] = relationship(back_populates="transactions")

# --- OPERATION THEATRE & SURGERY MODELS ---

class SurgeryStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    PRE_OP = "PRE_OP"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    POST_OP = "POST_OP"
    CANCELLED = "CANCELLED"

class OperationTheatre(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "operation_theatres"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    name: Mapped[str] = mapped_column(String(100)) # e.g. "OT-1", "Cardiac OT"
    is_active: Mapped[bool] = mapped_column(default=True)
    
    surgeries: Mapped[List["Surgery"]] = relationship(back_populates="theatre")

class Surgery(Base, TenantScopedMixin, TimestampMixin, VersionedMixin):
    __tablename__ = "surgeries"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    theatre_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("operation_theatres.id"), index=True)
    lead_surgeon_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    
    procedure_name: Mapped[str] = mapped_column(String(255))
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    status: Mapped[SurgeryStatus] = mapped_column(SQLEnum(SurgeryStatus), default=SurgeryStatus.SCHEDULED)
    notes: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    
    theatre: Mapped["OperationTheatre"] = relationship(back_populates="surgeries")
    patient: Mapped["Patient"] = relationship(backref="surgeries")
    surgeon: Mapped["Doctor"] = relationship(backref="performed_surgeries")

    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}

class HospitalBranch(Base, TimestampMixin):
    __tablename__ = "hospital_branches"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    
    # Coordinates per branch node
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    hospital: Mapped["Hospital"] = relationship(back_populates="branches")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="branch")

class BillingSubscription(Base, TimestampMixin):
    __tablename__ = "billing_subscriptions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), unique=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100))
    auto_debit_token: Mapped[Optional[str]] = mapped_column(String(255)) # Tokenized card ref
    upi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # Unified Payment Interface
    payment_method_type: Mapped[str] = mapped_column(String(50), default="card") # card or upi
    trial_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc) + timedelta(days=60))
    subscription_status: Mapped[str] = mapped_column(String(50), default="trialing") # trialing, active, past_due, cancelled
    
    hospital: Mapped["Hospital"] = relationship(back_populates="subscription")

class ForensicVerificationLog(Base, TimestampMixin):
    __tablename__ = "forensic_verification_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    # Phone Verification via OTP
    phone_number: Mapped[str] = mapped_column(String(50))
    phone_otp_verified: Mapped[bool] = mapped_column(default=False)
    phone_otp_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # NSDL Income Tax Database PAN Verification
    pan_number: Mapped[str] = mapped_column(String(50))
    pan_matched_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_pan_valid: Mapped[bool] = mapped_column(default=False)
    pan_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Healthcare Certificate Validation (NABH / ISO)
    certificate_url: Mapped[str] = mapped_column(String(512))
    is_certificate_valid: Mapped[bool] = mapped_column(default=False)
    cert_extracted_reg_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cert_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Aadhaar/NSDL dynamic verification fields
    pan_otp_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    pan_otp_verified: Mapped[bool] = mapped_column(default=False)
    pan_card_photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    hospital: Mapped["Hospital"] = relationship(backref="verification_logs")
