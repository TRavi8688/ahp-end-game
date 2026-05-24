from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")

class RoleEnum(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"
    nurse = "nurse"
    pharmacy = "pharmacy"
    hospital_admin = "hospital_admin"
    receptionist = "receptionist"
    lab = "lab"

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

class PartnerReferralStatusEnum(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    fulfilled = "fulfilled"
    rejected = "rejected"


class AISafetyMode(str, enum.Enum):
    informational = "informational"
    clinical_assist = "clinical_assist"
    restricted = "restricted"

class LabTestCategory(str, enum.Enum):
    PATHOLOGY = "PATHOLOGY"
    RADIOLOGY = "RADIOLOGY"
    CARDIOLOGY = "CARDIOLOGY"
    OTHER = "OTHER"
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
    email: Mapped[str] = mapped_column("phone_number", String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.patient)
    hospyn_id: Mapped[Optional[str]] = mapped_column(String(50), index=True) # Tenant lock
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_temporary_password: Mapped[bool] = mapped_column(default=False)
    # --- Enterprise: JWT Revocation ---
    # Incrementing this field instantly invalidates ALL existing tokens for
    # this user without a token blacklist. One-click revoke for any staff.
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    forensic_audit_trail: Mapped[Optional[str]] = mapped_column(StringEncryptedType(255), nullable=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_status: Mapped[Optional[str]] = mapped_column(String(50), default="ACTIVE")
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
    doctor_profile: Mapped["Doctor"] = relationship(back_populates="user", uselist=False)
    staff_profile: Mapped["StaffProfile"] = relationship(back_populates="user", uselist=False)

    @property
    def hospital_id(self) -> Optional[uuid.UUID]:
        if self.staff_profile:
            return self.staff_profile.hospital_id
        if self.patient:
            return self.patient.hospital_id
        return None

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
    qr_code_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    
    # --- New Onboarding Flow Fields ---
    verification_status: Mapped[VerificationStatusEnum] = mapped_column(SQLEnum(VerificationStatusEnum), default=VerificationStatusEnum.pending)
    is_approved: Mapped[bool] = mapped_column(default=False)
    payment_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, paid
    staff_count: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    certificate_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    selfie_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Precise physical locations and geolocations
    physical_address: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    pan_card_photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    departments: Mapped[List["Department"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    branches: Mapped[List["HospitalBranch"]] = relationship(back_populates="hospital", cascade="all, delete-orphan")
    subscription: Mapped[Optional["BillingSubscription"]] = relationship(back_populates="hospital", uselist=False, cascade="all, delete-orphan")
    queues: Mapped[List["QueueToken"]] = relationship(back_populates="hospital")
    queue_entries: Mapped[List["QueueEntry"]] = relationship(back_populates="hospital")
    beds: Mapped[List["Bed"]] = relationship(back_populates="hospital")
    inventory: Mapped[List["PharmacyStock"]] = relationship(back_populates="hospital")
    patient_visits: Mapped[List["PatientVisit"]] = relationship(back_populates="hospital")
    settings: Mapped[Optional["HospitalSettings"]] = relationship(back_populates="hospital", uselist=False, cascade="all, delete-orphan")


    __mapper_args__ = {"version_id_col": version_id}

class HospitalSettings(Base):
    """
    APP STORE CONFIGURATION:
    Defines which modules are enabled for a specific hospital.
    """
    __tablename__ = "hospital_settings"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), unique=True, index=True)
    
    # Module Toggles
    enable_pharmacy: Mapped[bool] = mapped_column(default=False)
    enable_labs: Mapped[bool] = mapped_column(default=False)
    enable_inpatient_beds: Mapped[bool] = mapped_column(default=False)
    enable_hr: Mapped[bool] = mapped_column(default=False)
    enable_billing: Mapped[bool] = mapped_column(default=True)
    
    # Quotas & Limits
    max_beds_configured: Mapped[int] = mapped_column(default=0)
    has_multiple_branches: Mapped[bool] = mapped_column(default=False)

    # Notifications & Privacy
    sms_notifications_enabled: Mapped[bool] = mapped_column(default=True)
    email_notifications_enabled: Mapped[bool] = mapped_column(default=True)
    whatsapp_notifications_enabled: Mapped[bool] = mapped_column(default=False)
    require_patient_consent: Mapped[bool] = mapped_column(default=True)
    data_sharing_enabled: Mapped[bool] = mapped_column(default=False)
    
    hospital: Mapped["Hospital"] = relationship(back_populates="settings")

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
    
    branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospital_branches.id"), nullable=True)
    
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    specialty: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    user: Mapped["User"] = relationship(back_populates="staff_profile")
    hospital: Mapped["Hospital"] = relationship(back_populates="staff")
    department: Mapped["Department"] = relationship(back_populates="staff")
    branch: Mapped[Optional["HospitalBranch"]] = relationship(back_populates="staff")
    
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

    @property
    def hospital_id(self) -> Optional[uuid.UUID]:
        if self.user and self.user.staff_profile:
            return self.user.staff_profile.hospital_id
        return None

    __mapper_args__ = {"version_id_col": version_id}


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


class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True) # Phone or Email
    otp: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_verified: Mapped[bool] = mapped_column(default=False)

