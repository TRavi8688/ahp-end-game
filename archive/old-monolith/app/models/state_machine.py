import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class WorkflowState(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    PENDING_INFO = "PENDING_INFO"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"

class VerificationWorkflow(Base):
    """
    Explicit PostgreSQL State Machine for Hospital Onboarding.
    Tracks the lifecycle of an onboarding request, replacing complex distributed sagas for Phase 1.
    """
    __tablename__ = "verification_workflows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), nullable=False, index=True) # The hospital being verified
    
    current_state = Column(Enum(WorkflowState), default=WorkflowState.DRAFT, nullable=False)
    
    # SLA Tracking
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    sla_breach_at = Column(DateTime(timezone=True), nullable=True)
    
    # State Metadata
    fraud_score = Column(Integer, default=0) # 0-100
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Transitions are strictly logged in the audit_logs table
