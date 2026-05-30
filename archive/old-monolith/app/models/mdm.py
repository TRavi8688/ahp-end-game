import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base

class GlobalPatientIdentity(Base):
    """
    Master Data Management (MDM) Engine.
    Resolves fragmented patient records across different hospital branches 
    into a single, unified "Golden Record".
    """
    __tablename__ = "mdm_global_identities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_national_id = Column(String, unique=True, nullable=False, index=True)
    master_first_name = Column(String, nullable=False)
    master_last_name = Column(String, nullable=False)
    
    # AI Confidence score that this identity is correctly resolved
    resolution_confidence = Column(Float, default=1.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class LocalPatientRecord(Base):
    """
    The local, fragmented record owned by a specific hospital branch.
    Maps back to the Golden Record via the MDM Engine.
    """
    __tablename__ = "mdm_local_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True) # Branch Hospital
    
    global_identity_id = Column(UUID(as_uuid=True), ForeignKey("mdm_global_identities.id"), nullable=True, index=True)
    
    local_mrn = Column(String, nullable=False) # Local Medical Record Number
    raw_data_snapshot = Column(JSONB, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
