"""
Referral ORM model for healthcare-core.
"""

import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    patient_name = Column(String(200), nullable=False)
    patient_phone = Column(String(50), nullable=False)
    referral_date = Column(DateTime, nullable=False, server_default=func.now())
    registration_date = Column(DateTime, nullable=True)
    first_order_date = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default="clicked")
    commission_amount = Column(Float, nullable=False, default=0.0)
    commission_status = Column(String(50), nullable=False, default="pending")
    order_count = Column(Integer, nullable=False, default=0)
    lifetime_value = Column(Float, nullable=False, default=0.0)
