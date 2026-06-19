import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base

class TenantBillingMetric(Base):
    """
    Cost Observability & Billing Tracker.
    Tracks API usage, active seat counts, and storage consumption per tenant
    for Stripe metered billing integration.
    """
    __tablename__ = "tenant_billing_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Billing Period
    billing_month = Column(String, nullable=False, index=True) # e.g. "2026-05"
    
    # Usage Metrics
    active_staff_seats = Column(Integer, default=0)
    api_requests_count = Column(Integer, default=0)
    storage_used_mb = Column(Float, default=0.0)
    ml_inference_seconds = Column(Float, default=0.0) # AI Fraud check compute time
    
    last_synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Track if this month's invoice was generated
    invoice_generated = Column(Boolean, default=False)
