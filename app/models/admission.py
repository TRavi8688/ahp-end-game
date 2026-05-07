from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin
from app.models.models import Base
import enum

class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    TEMP_RESERVED = "TEMP_RESERVED" # Doctor clicked admit, waiting for nurse to assign/patient to arrive
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"

class AdmissionStatus(str, enum.Enum):
    PENDING = "PENDING"
    ADMITTED = "ADMITTED"
    DISCHARGED = "DISCHARGED"

class Bed(Base, TenantScopedMixin, VersionedMixin, AuditableMixin):
    __tablename__ = "beds"

    id = Column(Integer, primary_key=True, index=True)
    # tenant_id is hospital_id from TenantScopedMixin
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True) # Optional zone link
    bed_number = Column(String(50), nullable=False, index=True)
    status = Column(Enum(BedStatus), nullable=False, default=BedStatus.AVAILABLE)

    # Relationships
    hospital = relationship("Hospital", backref="beds")
    department = relationship("Department", backref="beds")

class Admission(Base, TenantScopedMixin, VersionedMixin, AuditableMixin):
    __tablename__ = "admissions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    queue_token_id = Column(Integer, ForeignKey("queue_tokens.id"), nullable=True) # Source of admission
    bed_id = Column(Integer, ForeignKey("beds.id"), nullable=True) # Initially None if waiting for bed
    status = Column(Enum(AdmissionStatus), nullable=False, default=AdmissionStatus.PENDING)
    
    admitted_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    discharged_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    hospital = relationship("Hospital", backref="admissions")
    patient = relationship("Patient", backref="admissions")
    queue_token = relationship("QueueToken", backref="admission")
    bed = relationship("Bed", backref="admissions")
