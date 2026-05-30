from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func, Enum as SQLEnum, Float, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid

from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import Base, JSON_TYPE, NotificationTypeEnum, MessageRoleEnum, AISafetyMode

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

class Message(Base, TenantScopedMixin):
    __tablename__ = "messages"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    conversation_id: Mapped[str] = mapped_column(String(50), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[MessageRoleEnum] = mapped_column(SQLEnum(MessageRoleEnum), default=MessageRoleEnum.user)
    content: Mapped[str] = mapped_column(Text)
    safety_metadata: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class JobFailure(Base):
    __tablename__ = "job_failures"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(100), index=True)
    function_name: Mapped[str] = mapped_column(String(100))
    args: Mapped[Optional[dict]] = mapped_column(JSON_TYPE)
    error: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class ClinicalAIEvent(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "clinical_ai_events"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("hospitals.id"), index=True)
    trace_id: Mapped[str] = mapped_column(String(100), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    
    prompt_template: Mapped[str] = mapped_column(String(255))
    prompt_payload: Mapped[dict] = mapped_column(JSON_TYPE)
    
    response_text: Mapped[str] = mapped_column(Text)
    safety_metadata: Mapped[dict] = mapped_column(JSON_TYPE)
    
    provider: Mapped[str] = mapped_column(String(50))
    model_version: Mapped[str] = mapped_column(String(50))
    latency_ms: Mapped[int] = mapped_column()
    
    safety_mode: Mapped[AISafetyMode] = mapped_column(SQLEnum(AISafetyMode), default=AISafetyMode.informational)
    policy_filters_applied: Mapped[Optional[List[str]]] = mapped_column(JSON_TYPE)
    
    overridden: Mapped[bool] = mapped_column(default=False)

class ClinicianOverride(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "clinician_overrides"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    ai_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinical_ai_events.id"), index=True)
    doctor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    
    override_type: Mapped[str] = mapped_column(String(50))
    justification: Mapped[str] = mapped_column(Text)
    correction_text: Mapped[Optional[str]] = mapped_column(Text)
    
    severity_impact: Mapped[str] = mapped_column(String(50))

class ClinicalEvent(Base):
    __tablename__ = "clinical_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    aggregate_type: Mapped[str] = mapped_column(String(100), index=True)
    aggregate_id: Mapped[str] = mapped_column(String(100), index=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    payload: Mapped[dict] = mapped_column(JSON_TYPE)
    metadata_info: Mapped[dict] = mapped_column(JSON_TYPE)
    
    signature: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(default=1)

class ClinicalJobTracker(Base, TimestampMixin):
    __tablename__ = "clinical_job_tracker"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[uuid.UUID] = mapped_column(index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    worker_id: Mapped[Optional[str]] = mapped_column(String(100))
    error_log: Mapped[Optional[str]] = mapped_column(Text)
    
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    retry_count: Mapped[int] = mapped_column(default=0)
    retry_reason: Mapped[Optional[str]] = mapped_column(String(255))
    
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

class NotificationQueue(Base, TimestampMixin):
    __tablename__ = "notification_queue"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patients.id"), index=True)
    provider: Mapped[str] = mapped_column(String(50))
    message_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON_TYPE)
    
    status: Mapped[str] = mapped_column(String(20), default="pending")
    retry_count: Mapped[int] = mapped_column(default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

class DeviceType(str, enum.Enum):
    SCANNER = "SCANNER"
    MONITOR = "MONITOR"
    LAB_ANALYZER = "LAB_ANALYZER"
    WEARABLE = "WEARABLE"

class MedicalDevice(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "medical_devices"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    name: Mapped[str] = mapped_column(String(255))
    device_type: Mapped[DeviceType] = mapped_column(SQLEnum(DeviceType))
    model_number: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    last_ping: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="ONLINE")

class FHIRResource(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fhir_resources"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    resource_type: Mapped[str] = mapped_column(String(100), index=True)
    fhir_json: Mapped[dict] = mapped_column(JSON_TYPE)
    
    source_device_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("medical_devices.id"))
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

class WearableDataType(str, enum.Enum):
    HEART_RATE = "HEART_RATE"
    STEPS = "STEPS"
    SLEEP = "SLEEP"
    SPO2 = "SPO2"
    BLOOD_GLUCOSE = "BLOOD_GLUCOSE"

class WearableData(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "wearable_data"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    
    data_type: Mapped[WearableDataType] = mapped_column(SQLEnum(WearableDataType))
    value: Mapped[float] = mapped_column()
    unit: Mapped[str] = mapped_column(String(50))
    
    source: Mapped[str] = mapped_column(String(50))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

class DailyHospitalMetrics(Base, TenantScopedMixin):
    __tablename__ = "daily_hospital_metrics"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    
    total_revenue: Mapped[float] = mapped_column(default=0.0)
    pharmacy_revenue: Mapped[float] = mapped_column(default=0.0)
    insurance_pending_amount: Mapped[float] = mapped_column(default=0.0)
    
    total_patients_seen: Mapped[int] = mapped_column(default=0)
    average_wait_time_minutes: Mapped[float] = mapped_column(default=0.0)
    bed_occupancy_rate: Mapped[float] = mapped_column(default=0.0)
    
    total_prescriptions_issued: Mapped[int] = mapped_column(default=0)
    critical_alerts_triggered: Mapped[int] = mapped_column(default=0)
    
    metadata_snapshot: Mapped[dict] = mapped_column(JSON_TYPE)

class PatientRiskProfile(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "patient_risk_profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), unique=True, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    readmission_risk: Mapped[float] = mapped_column(default=0.0)
    critical_deterioration_risk: Mapped[float] = mapped_column(default=0.0)
    no_show_risk: Mapped[float] = mapped_column(default=0.0)
    
    risk_factors: Mapped[dict] = mapped_column(JSON_TYPE)
    last_evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    alert_triggered: Mapped[bool] = mapped_column(default=False)
    clinical_priority: Mapped[str] = mapped_column(String(20), default="LOW")

class HospitalBranch(Base, TimestampMixin):
    __tablename__ = "hospital_branches"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    hospital: Mapped["Hospital"] = relationship(back_populates="branches")
    staff: Mapped[List["StaffProfile"]] = relationship(back_populates="branch")

class ForensicVerificationLog(Base, TimestampMixin):
    __tablename__ = "forensic_verification_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    phone_number: Mapped[str] = mapped_column(String(50))
    phone_otp_verified: Mapped[bool] = mapped_column(default=False)
    phone_otp_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    pan_number: Mapped[str] = mapped_column(String(50))
    pan_matched_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_pan_valid: Mapped[bool] = mapped_column(default=False)
    pan_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    certificate_url: Mapped[str] = mapped_column(String(512))
    is_certificate_valid: Mapped[bool] = mapped_column(default=False)
    cert_extracted_reg_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cert_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    pan_otp_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    pan_otp_verified: Mapped[bool] = mapped_column(default=False)
    pan_card_photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    hospital: Mapped["Hospital"] = relationship(backref="verification_logs")
