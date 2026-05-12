from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin

# Portable JSON type: JSONB on Postgres, JSON on others (SQLite)
JSON_TYPE = JSON().with_variant(JSONB, "postgresql")

class RoleEnum(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"
    nurse = "nurse"
    pharmacy = "pharmacy"
    hospital_admin = "hospital_admin"

class LicenseStatusEnum(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"

class VerificationStatusEnum(str, enum.Enum):
    pending = "pending"
    basic_verified = "basic_verified"
    identity_verified = "identity_verified"
    otp_verified = "otp_verified"
    completed = "completed"

class BedStatusEnum(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    occupied = "occupied"
    cleaning = "cleaning"
    maintenance = "maintenance"

class QueueStatusEnum(str, enum.Enum):
    checked_in = "checked_in"
    waiting_vitals = "waiting_vitals"
    waiting_doctor = "waiting_doctor"
    consultation = "consultation"
    pharmacy = "pharmacy"
    completed = "completed"
    cancelled = "cancelled"

class AccessLevelEnum(str, enum.Enum):
    read = "read"
    write = "write"

class AccessStatusEnum(str, enum.Enum):
    requested = "requested"
    granted = "granted"
    revoked = "revoked"

class RecordTypeEnum(str, enum.Enum):
    document = "document"
    scan = "scan"
    vitals = "vitals"
    prescription = "prescription"
    lab_report = "lab_report"

class AddedByEnum(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    ai = "ai"
    nurse = "nurse"
    system = "system"

class NotificationTypeEnum(str, enum.Enum):
    alert = "alert"
    message = "message"
    consent_request = "consent_request"
    consent_granted = "consent_granted"
    system = "system"

class MessageRoleEnum(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
class PrescriptionStatusEnum(str, enum.Enum):
    pending = "pending"
    fulfilled = "fulfilled"
    cancelled = "cancelled"
    expired = "expired"

class LabOrderStatusEnum(str, enum.Enum):
    ordered = "ordered"
    sample_collected = "sample_collected"
    processing = "processing"
    completed = "completed"
    rejected = "rejected"

class AISafetyMode(str, enum.Enum):
    informational = "informational"
    clinical_assist = "clinical_assist"
    restricted = "restricted"
    emergency = "emergency"
    human_only = "human_only"

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)  # Optimistic Locking
    insforge_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.patient)
    hospyn_id: Mapped[Optional[str]] = mapped_column(String(50), index=True) # Tenant lock
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    # --- Enterprise: JWT Revocation ---
    # Incrementing this field instantly invalidates ALL existing tokens for
    # this user without a token blacklist. One-click revoke for any staff.
    token_version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    patient_profile: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
    doctor_profile: Mapped["Doctor"] = relationship(back_populates="user", uselist=False)
    staff_profile: Mapped["StaffProfile"] = relationship(back_populates="user", uselist=False)

    __mapper_args__ = {"version_id_col": version_id}

class Patient(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "patients"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    hospyn_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    # Encrypt PII Fields
    phone_number: Mapped[str] = mapped_column(StringEncryptedType(255))
    date_of_birth: Mapped[Optional[str]] = mapped_column(StringEncryptedType(255))
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    blood_group: Mapped[Optional[str]] = mapped_column(String(10))
    language_code: Mapped[str] = mapped_column(String(10), default="en")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255)) # Secondary Hospyn login
    
    user: Mapped["User"] = relationship(back_populates="patient_profile")
    records: Mapped[List["MedicalRecord"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    conditions: Mapped[List["Condition"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    medications: Mapped[List["Medication"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    allergies: Mapped[List["Allergy"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    family_members: Mapped[List["FamilyMember"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    dashboard: Mapped["PatientDashboard"] = relationship(back_populates="patient", uselist=False)

    __mapper_args__ = {"version_id_col": version_id}

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

    __mapper_args__ = {"version_id_col": version_id}

class OrganizationTypeEnum(str, enum.Enum):
    hospital = "hospital"
    pharmacy = "pharmacy"
    lab = "lab"

class Hospital(Base):
    __tablename__ = "hospitals"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospyn_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    short_code: Mapped[str] = mapped_column(String(10), unique=True, index=True) # For manual patient entry
    org_type: Mapped[OrganizationTypeEnum] = mapped_column(SQLEnum(OrganizationTypeEnum), default=OrganizationTypeEnum.hospital)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    name: Mapped[str] = mapped_column(String(255), index=True)
    registration_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    subscription_status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    departments: Mapped[List["Department"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    queues: Mapped[List["QueueToken"]] = relationship(back_populates="hospital")
    queue_entries: Mapped[List["QueueEntry"]] = relationship(back_populates="hospital")
    beds: Mapped[List["Bed"]] = relationship(back_populates="hospital")
    inventory: Mapped[List["PharmacyStock"]] = relationship(back_populates="hospital")

    __mapper_args__ = {"version_id_col": version_id}

class Department(Base):
    __tablename__ = "departments"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"))
    name: Mapped[str] = mapped_column(String(100))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="departments")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="department")
    queues: Mapped[List["QueueToken"]] = relationship(back_populates="department")
    queue_entries: Mapped[List["QueueEntry"]] = relationship(back_populates="department")
    beds: Mapped[List["Bed"]] = relationship(back_populates="department")

class StaffProfile(Base):
    __tablename__ = "staff_profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"))
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"))
    
    user: Mapped["User"] = relationship(back_populates="staff_profile")
    hospital: Mapped["Hospital"] = relationship(back_populates="staff")
    department: Mapped["Department"] = relationship(back_populates="staff")
    
    __mapper_args__ = {"version_id_col": version_id}

class MedicalRecord(Base, TenantScopedMixin):
    __tablename__ = "medical_records"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    type: Mapped[RecordTypeEnum] = mapped_column(SQLEnum(RecordTypeEnum), default=RecordTypeEnum.document)
    file_url: Mapped[str] = mapped_column(String(255))
    raw_text: Mapped[Optional[str]] = mapped_column(TextEncryptedType)

    __mapper_args__ = {"version_id_col": version_id}
    # hospital_id now provided by TenantScopedMixin
    ai_extracted: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    ai_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    patient_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    doctor_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ai_processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    record_checksum: Mapped[Optional[str]] = mapped_column(String(64), index=True) # SHA-256 Checksum
    
    patient: Mapped["Patient"] = relationship(back_populates="records")

class Condition(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "conditions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    name: Mapped[str] = mapped_column(StringEncryptedType(255))
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    source_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id"))
    
    patient: Mapped["Patient"] = relationship(back_populates="conditions")

class Medication(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "medications"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    generic_name: Mapped[str] = mapped_column(StringEncryptedType(255))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(default=True)
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    source_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id"))
    
    patient: Mapped["Patient"] = relationship(back_populates="medications")

class Allergy(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "allergies"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    allergen: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(50), default="Moderate")
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    
    patient: Mapped["Patient"] = relationship(back_populates="allergies")

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

class RecordShare(Base):
    """Granular per-record sharing from Chitti AI chat."""
    __tablename__ = "record_shares"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medical_records.id"), index=True)
    doctor_query: Mapped[str] = mapped_column(String(255))  # name or MUL-DOC-xxx
    doctor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accessed: Mapped[bool] = mapped_column(default=False)
    revoked: Mapped[bool] = mapped_column(default=False)
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

class PatientDashboard(Base):
    __tablename__ = "patient_dashboards"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospitals.id"), index=True, nullable=True)
    data: Mapped[dict] = mapped_column(JSON_TYPE)  # Aggregated dashboard data
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="dashboard")

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

class DigitalPrescription(Base):
    __tablename__ = "digital_prescriptions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    status: Mapped[PrescriptionStatusEnum] = mapped_column(SQLEnum(PrescriptionStatusEnum), default=PrescriptionStatusEnum.pending)
    medications: Mapped[dict] = mapped_column(JSON_TYPE) # List of {name, dosage, frequency, duration}
    notes: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    
    qr_code_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    signature_hash: Mapped[str] = mapped_column(String(255)) # Digital signature of the prescription
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fulfilled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    pharmacist_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id")) # User ID of pharmacist who fulfilled
    
    items: Mapped[List["PrescriptionItem"]] = relationship(back_populates="prescription", cascade="all, delete-orphan")

class LabDiagnosticOrder(Base):
    __tablename__ = "lab_diagnostic_orders"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    status: Mapped[LabOrderStatusEnum] = mapped_column(SQLEnum(LabOrderStatusEnum), default=LabOrderStatusEnum.ordered)
    tests: Mapped[dict] = mapped_column(JSON_TYPE) # List of test names or codes
    clinical_history: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    
    report_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id")) # Link to the OCR'd report
    ai_risk_level: Mapped[Optional[str]] = mapped_column(String(50))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    results: Mapped[List["LabResult"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class LabResult(Base):
    """
    STRUCTURED OBSERVATIONS: The data engine for AI and Analytics.
    Stores normalized lab metrics (e.g., Hemoglobin 14.2 g/dL).
    """
    __tablename__ = "lab_results"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lab_diagnostic_orders.id"), index=True)
    
    test_name: Mapped[str] = mapped_column(String(100), index=True) # e.g., Hemoglobin
    value: Mapped[float] = mapped_column()
    unit: Mapped[str] = mapped_column(String(20)) # e.g., g/dL
    
    reference_range_min: Mapped[Optional[float]] = mapped_column()
    reference_range_max: Mapped[Optional[float]] = mapped_column()
    
    flag: Mapped[Optional[str]] = mapped_column(String(20)) # e.g., LOW, HIGH, CRITICAL
    interpretation: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    order: Mapped["LabDiagnosticOrder"] = relationship(back_populates="results")

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

class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    prescription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("digital_prescriptions.id"), index=True)
    medication_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("pharmacy_stock.id")) # Link to inventory
    
    name: Mapped[str] = mapped_column(String(255))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    duration: Mapped[str] = mapped_column(String(100))
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, dispensed, out_of_stock
    
    prescription: Mapped["DigitalPrescription"] = relationship(back_populates="items")

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
    status: Mapped[str] = mapped_column(String(50), default="admitted")
    
    admitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    discharged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    hospital: Mapped["Hospital"] = relationship(backref="admissions")
    patient: Mapped["Patient"] = relationship(backref="admissions")
    bed: Mapped[Optional["Bed"]] = relationship(backref="admissions")
