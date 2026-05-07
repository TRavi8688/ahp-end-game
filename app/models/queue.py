from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin
import enum

class QueueTokenStatus(str, enum.Enum):
    WAITING = "WAITING"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    EMERGENCY_OVERRIDE = "EMERGENCY_OVERRIDE"

class QueueToken(TenantScopedMixin, VersionedMixin, AuditableMixin):
    __tablename__ = "queue_tokens"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    patient_id = Column(Integer, nullable=False, index=True)  # reference to patient profile elsewhere
    status = Column(Enum(QueueTokenStatus), nullable=False, default=QueueTokenStatus.WAITING)
    priority_score = Column(Integer, nullable=False, default=0)
    # timestamps, version_id, created_by_id, updated_by_id are provided by mixins

    # Relationships (optional, for ORM convenience)
    hospital = relationship("Hospital", backref="queue_tokens")
