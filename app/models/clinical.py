from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import *

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

class PatientVisit(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "patient_visits"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True, index=True)
    
    visit_reason: Mapped[str] = mapped_column(TextEncryptedType)
    symptoms: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    department: Mapped[Optional[str]] = mapped_column(String(100))
    doctor_name: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[VisitStatusEnum] = mapped_column(SQLEnum(VisitStatusEnum), default=VisitStatusEnum.active)
    
    op_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    queue_token: Mapped[Optional[str]] = mapped_column(String(50))
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="patient_visits")
    hospital: Mapped["Hospital"] = relationship(back_populates="patient_visits")
    medical_records: Mapped[List["MedicalRecord"]] = relationship(back_populates="visit")



class PatientDashboard(Base):
    __tablename__ = "patient_dashboards"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True, index=True)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospitals.id"), index=True, nullable=True)
    data: Mapped[dict] = mapped_column(JSON_TYPE)  # Aggregated dashboard data
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    patient: Mapped["Patient"] = relationship(back_populates="dashboard")


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
    
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patient_visits.id"), nullable=True)
    
    patient: Mapped["Patient"] = relationship(back_populates="records")
    visit: Mapped[Optional["PatientVisit"]] = relationship(back_populates="medical_records")
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


class DigitalPrescription(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "digital_prescriptions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True, index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patient_visits.id"), nullable=True)
    
    status: Mapped[PrescriptionStatusEnum] = mapped_column(SQLEnum(PrescriptionStatusEnum), default=PrescriptionStatusEnum.pending)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    medications: Mapped[dict] = mapped_column(JSON_TYPE) # List of {name, dosage, frequency, duration}
    notes: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    
    qr_code_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    signature_hash: Mapped[Optional[str]] = mapped_column(String(255)) # Digital signature
    
    fulfilled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    pharmacist_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    
    items: Mapped[List["PrescriptionItem"]] = relationship(back_populates="prescription", cascade="all, delete-orphan")

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


class LabTestMaster(Base, TenantScopedMixin, TimestampMixin):
    """
    CLINICAL TEST DIRECTORY:
    Defines available tests, their categories, and standard reference ranges.
    """
    __tablename__ = "lab_test_master"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    test_name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[LabTestCategory] = mapped_column(SQLEnum(LabTestCategory))
    code: Mapped[Optional[str]] = mapped_column(String(50), index=True) # e.g. LOINC code
    
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    reference_range: Mapped[Optional[str]] = mapped_column(String(100))
    base_price: Mapped[float] = mapped_column(default=0.0)

class LabDiagnosticOrder(Base, TenantScopedMixin, TimestampMixin):
    """
    DIAGNOSTIC COMMAND:
    Tracks the lifecycle of a lab or radiology request.
    """
    __tablename__ = "lab_diagnostic_orders"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True, index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patient_visits.id"), nullable=True)
    prescription_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("digital_prescriptions.id"), nullable=True)
    
    status: Mapped[LabOrderStatusEnum] = mapped_column(SQLEnum(LabOrderStatusEnum), default=LabOrderStatusEnum.ordered)
    tests: Mapped[dict] = mapped_column(JSON_TYPE) # List of {test_id, test_name, priority}
    clinical_history: Mapped[Optional[str]] = mapped_column(TextEncryptedType)
    
    sample_id: Mapped[Optional[str]] = mapped_column(String(100), index=True) # Barcode/UID
    collected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    report_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id"))
    ai_risk_level: Mapped[Optional[str]] = mapped_column(String(50))
    
    results: Mapped[List["LabResult"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class LabResult(Base, TenantScopedMixin, TimestampMixin):
    """
    STRUCTURED PATHOLOGY DATA:
    Normalized findings for specific tests within an order.
    """
    __tablename__ = "lab_results"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("lab_diagnostic_orders.id"), index=True, nullable=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    record_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_records.id"), index=True, nullable=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), index=True, nullable=True)
    
    test_name: Mapped[str] = mapped_column(String(255), index=True)
    value: Mapped[str] = mapped_column(String(100))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    reference_range: Mapped[Optional[str]] = mapped_column(String(100))
    is_abnormal: Mapped[bool] = mapped_column(default=False)
    clinical_remarks: Mapped[Optional[str]] = mapped_column(Text)
    observation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    order: Mapped[Optional["LabDiagnosticOrder"]] = relationship(back_populates="results")
    patient: Mapped["Patient"] = relationship(back_populates="lab_results")
    record: Mapped[Optional["MedicalRecord"]] = relationship(back_populates="lab_results")

class PartnerLabRequest(Base, TenantScopedMixin, TimestampMixin):
    """
    B2B2C Referral: Routes a lab order from a referring clinic to a partner diagnostic center.
    """
    __tablename__ = "partner_lab_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lab_diagnostic_orders.id"), index=True)
    referring_hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    partner_hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    status: Mapped[PartnerReferralStatusEnum] = mapped_column(
        SQLEnum(PartnerReferralStatusEnum), default=PartnerReferralStatusEnum.pending
    )
    
    order: Mapped["LabDiagnosticOrder"] = relationship()
    patient: Mapped["Patient"] = relationship()
    referring_hospital: Mapped["Hospital"] = relationship(foreign_keys=[referring_hospital_id])
    partner_hospital: Mapped["Hospital"] = relationship(foreign_keys=[partner_hospital_id])


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

