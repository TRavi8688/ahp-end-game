import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base

class TenantConfiguration(Base):
    """
    Dynamic Configuration Service.
    Allows centralized management of tenant-specific policies without code deploys.
    """
    __tablename__ = "tenant_configurations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    
    # Policies
    require_mfa = Column(Boolean, default=False)
    password_expiration_days = Column(Integer, default=90)
    session_timeout_minutes = Column(Integer, default=30)
    
    # Whitelabeled UI settings for Hospital Groups
    branding_config = Column(JSONB, default={"primary_color": "#0f172a", "logo_url": None})
    
    # Integration toggles
    enable_ehr_sync = Column(Boolean, default=False)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class FeatureFlag(Base):
    """
    Product Evolution Roadmap (LaunchDarkly equivalent).
    Enables dark launching, beta testing, and emergency kill switches.
    """
    __tablename__ = "feature_flags"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flag_key = Column(String, unique=True, nullable=False, index=True) # e.g. "new-ai-fraud-engine"
    description = Column(String, nullable=True)
    
    is_enabled_globally = Column(Boolean, default=False)
    
    # Targeting rules: If not enabled globally, check if tenant is explicitly enabled
    enabled_tenant_ids = Column(JSONB, default=list) # Array of UUIDs
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
