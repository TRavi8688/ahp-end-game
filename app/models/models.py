from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID
from sqlalchemy.dialects.postgresql import JSONB
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

class VisitStatusEnum(str, enum.Enum):
    scheduled = "scheduled"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"

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
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    forensic_audit_trail: Mapped[Optional[str]] = mapped_column(StringEncryptedType(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
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
    
    user: Mapped["User"] = relationship(back_populates="patient")
    records: Mapped[List["MedicalRecord"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    conditions: Mapped[List["Condition"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    medications: Mapped[List["Medication"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    allergies: Mapped[List["Allergy"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    family_members: Mapped[List["FamilyMember"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    dashboard: Mapped["PatientDashboard"] = relationship(back_populates="patient", uselist=False)
    patient_visits: Mapped[List["PatientVisit"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    lab_results: Mapped[List["LabResult"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

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
    patient_visits: Mapped[List["PatientVisit"]] = relationship(back_populates="hospital")

    __mapper_args__ = {"version_id_col": version_id}

class PatientVisit(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "patient_visits"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    visit_reason: Mapped[str] = mapped_column(TextEncryptedType)
    symptoms: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    department: Mapped[Optional[str]] = mapped_column(String(100))
    doctor_name: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[VisitStatusEnum] = mapped_column(SQLEnum(VisitStatusEnum), default=VisitStatusEnum.active)
    
    queue_token: Mapped[Optional[str]] = mapped_column(String(50))
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="patient_visits")
    hospital: Mapped["Hospital"] = relationship(back_populates="patient_visits")

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
    
    # Metadata for display
    record_name: Mapped[Optional[str]] = mapped_column(String(255))
    hospital_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ai_processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    record_checksum: Mapped[Optional[str]] = mapped_column(String(64), index=True) # SHA-256 Checksum
    
    # Phase 3: Clinical Hardening & Security
    ocr_confidence_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    needs_verification: Mapped[bool] = mapped_column(default=True) # Default true until doctor sign-off
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("doctors.id"), nullable=True)
    malware_scan_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, clean, quarantined
    
    patient: Mapped["Patient"] = relationship(back_populates="records")
    lab_results: Mapped[List["LabResult"]] = relationship(back_populates="record", cascade="all, delete-orphan")

class Condition(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "conditions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
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
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    generic_name: Mapped[str] = mapped_column(StringEncryptedType(255))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(default=True)
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    source_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id"))
    
    patient: Mapped["Patient"] = relationship(back_populates="medications")
    intake_logs: Mapped[List["MedicationIntakeLog"]] = relationship(back_populates="medication", cascade="all, delete-orphan")

class MedicationIntakeLog(Base, TimestampMixin):
    __tablename__ = "medication_intake_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    medication_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medications.id"))
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    medication: Mapped["Medication"] = relationship(back_populates="intake_logs")

class Allergy(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "allergies"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
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
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True, index=True)
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


class LabResult(Base, TenantScopedMixin, TimestampMixin):
    """
    STRUCTURED LAB NORMALIZATION:
    Stores parsed clinical findings (e.g. Hemoglobin, Glucose) for trending and AI analysis.
    """
    __tablename__ = "lab_results"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medical_records.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    
    test_name: Mapped[str] = mapped_column(String(255), index=True)
    value: Mapped[str] = mapped_column(String(100))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    reference_range: Mapped[Optional[str]] = mapped_column(String(100))
    is_abnormal: Mapped[bool] = mapped_column(default=False)
    
    observation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    patient: Mapped["Patient"] = relationship(back_populates="lab_results")
    record: Mapped["MedicalRecord"] = relationship(back_populates="lab_results")

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
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class Payment(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    FINANCIAL INTEGRITY LAYER (Section 2.2).
    Tracks every transaction with exactly-once semantic potential.
    """
    __tablename__ = "payments"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    amount: Mapped[float] = mapped_column()
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    provider: Mapped[str] = mapped_column(String(50)) # razorpay, stripe
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    metadata_json: Mapped[dict] = mapped_column(JSON_TYPE) # Store billing items
    
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
