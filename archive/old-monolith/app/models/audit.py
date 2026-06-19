import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base

class AuditLog(Base):
    """Immutable, append-only ledger for all system mutations."""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True) # Null if system-wide action
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    action = Column(String, nullable=False, index=True) # e.g. "HOSPITAL_APPROVED", "USER_INVITED"
    resource_type = Column(String, nullable=False) # e.g. "Hospital", "User"
    resource_id = Column(String, nullable=False, index=True)
    
    old_state = Column(JSONB, nullable=True)
    new_state = Column(JSONB, nullable=True)
    
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
