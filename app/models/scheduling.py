from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import *
from app.models.clinical import *

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


class QueueEntry(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "queue_entries"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
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
