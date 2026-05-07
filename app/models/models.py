from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime
from typing import List, Optional
import enum
from app.core.encryption import StringEncryptedType, TextEncryptedType

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
class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)  # Optimistic Locking
    insforge_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.patient)
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

class Patient(Base):
    __tablename__ = "patients"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    ahp_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    # Encrypt PII Fields
    phone_number: Mapped[str] = mapped_column(StringEncryptedType(255))
    date_of_birth: Mapped[Optional[str]] = mapped_column(StringEncryptedType(255))
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    blood_group: Mapped[Optional[str]] = mapped_column(String(10))
    language_code: Mapped[str] = mapped_column(String(10), default="en")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255)) # Secondary AHP login
    
    user: Mapped["User"] = relationship(back_populates="patient_profile")
    records: Mapped[List["MedicalRecord"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    conditions: Mapped[List["Condition"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    medications: Mapped[List["Medication"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    allergies: Mapped[List["Allergy"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    dashboard: Mapped["PatientDashboard"] = relationship(back_populates="patient", uselist=False)

    __mapper_args__ = {"version_id_col": version_id}

class Doctor(Base):
    __tablename__ = "doctors"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    specialty: Mapped[Optional[str]] = mapped_column(String(100))
    license_number: Mapped[str] = mapped_column(String(100), unique=True)
    license_status: Mapped[LicenseStatusEnum] = mapped_column(SQLEnum(LicenseStatusEnum), default=LicenseStatusEnum.pending)
    license_copy_url: Mapped[Optional[str]] = mapped_column(String(255))
    verification_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    user: Mapped["User"] = relationship(back_populates="doctor_profile")

    __mapper_args__ = {"version_id_col": version_id}

class Hospital(Base):
    __tablename__ = "hospitals"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    name: Mapped[str] = mapped_column(String(255), index=True)
    registration_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    subscription_status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    departments: Mapped[List["Department"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    queues: Mapped[List["QueueEntry"]] = relationship(back_populates="hospital")

    __mapper_args__ = {"version_id_col": version_id}

class Department(Base):
    __tablename__ = "departments"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    name: Mapped[str] = mapped_column(String(100))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="departments")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="department")
    queues: Mapped[List["QueueEntry"]] = relationship(back_populates="department")

class StaffProfile(Base):
    __tablename__ = "staff_profiles"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"))
    
    user: Mapped["User"] = relationship(back_populates="staff_profile")
    hospital: Mapped["Hospital"] = relationship(back_populates="staff")
    department: Mapped["Department"] = relationship(back_populates="staff")
    
    __mapper_args__ = {"version_id_col": version_id}

class MedicalRecord(Base):
    __tablename__ = "medical_records"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    type: Mapped[RecordTypeEnum] = mapped_column(SQLEnum(RecordTypeEnum), default=RecordTypeEnum.document)
    file_url: Mapped[str] = mapped_column(String(255))
    raw_text: Mapped[Optional[str]] = mapped_column(TextEncryptedType)

    __mapper_args__ = {"version_id_col": version_id}
    ai_extracted: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    ai_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    patient_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    doctor_summary: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ai_processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    record_checksum: Mapped[Optional[str]] = mapped_column(String(64), index=True) # SHA-256 Checksum
    
    patient: Mapped["Patient"] = relationship(back_populates="records")

class Condition(Base):
    __tablename__ = "conditions"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    name: Mapped[str] = mapped_column(StringEncryptedType(255))
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    source_record_id: Mapped[Optional[int]] = mapped_column(ForeignKey("medical_records.id"))
    
    patient: Mapped["Patient"] = relationship(back_populates="conditions")

class Medication(Base):
    __tablename__ = "medications"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    generic_name: Mapped[str] = mapped_column(StringEncryptedType(255))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(default=True)
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    source_record_id: Mapped[Optional[int]] = mapped_column(ForeignKey("medical_records.id"))
    
    patient: Mapped["Patient"] = relationship(back_populates="medications")

class Allergy(Base):
    __tablename__ = "allergies"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    allergen: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(50), default="Moderate")
    added_by: Mapped[AddedByEnum] = mapped_column(SQLEnum(AddedByEnum), default=AddedByEnum.patient)
    confirmed_by_patient: Mapped[bool] = mapped_column(default=False)
    hidden_by_patient: Mapped[bool] = mapped_column(default=False)
    
    patient: Mapped["Patient"] = relationship(back_populates="allergies")

class DoctorAccess(Base):
    __tablename__ = "doctor_access"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    doctor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
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
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("medical_records.id"), index=True)
    doctor_query: Mapped[str] = mapped_column(String(255))  # name or MUL-DOC-xxx
    doctor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accessed: Mapped[bool] = mapped_column(default=False)
    revoked: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("patients.id"))
    doctor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    type: Mapped[NotificationTypeEnum] = mapped_column(SQLEnum(NotificationTypeEnum), default=NotificationTypeEnum.alert)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class AISummary(Base):
    __tablename__ = "ai_summaries"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    one_page_summary: Mapped[str] = mapped_column(TextEncryptedType)
    patient_summary: Mapped[str] = mapped_column(TextEncryptedType)
    doctor_summary: Mapped[str] = mapped_column(TextEncryptedType)
    structured_data: Mapped[dict] = mapped_column(JSON_TYPE) # Dashboard analytics
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class PatientDashboard(Base):
    __tablename__ = "patient_dashboards"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[Optional[int]] = mapped_column(ForeignKey("hospitals.id"), index=True, nullable=True)
    data: Mapped[dict] = mapped_column(JSON_TYPE)  # Aggregated dashboard data
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="dashboard")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    hospital_id: Mapped[Optional[int]] = mapped_column(ForeignKey("hospitals.id"), nullable=True, index=True)
    action_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    signature_hash: Mapped[Optional[str]] = mapped_column(String(255)) # HMAC of content

class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    event_version: Mapped[str] = mapped_column(String(20))
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("hospitals.id"), index=True, nullable=True)
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

class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[str] = mapped_column(String(50), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[MessageRoleEnum] = mapped_column(SQLEnum(MessageRoleEnum), default=MessageRoleEnum.user)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class QueueEntry(Base):
    __tablename__ = "queue_entries"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hospital_id: Mapped[Optional[int]] = mapped_column(ForeignKey("hospitals.id"))
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("doctors.id"))
    clinic_name: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[QueueStatusEnum] = mapped_column(SQLEnum(QueueStatusEnum), default=QueueStatusEnum.checked_in)
    token_number: Mapped[Optional[int]] = mapped_column()
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="queues")
    department: Mapped["Department"] = relationship(back_populates="queues")

class JobFailure(Base):
    __tablename__ = "job_failures"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(100), index=True)
    function_name: Mapped[str] = mapped_column(String(100))
    args: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    error: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
