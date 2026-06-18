"""
Payout ORM model for healthcare-core.
"""

import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="pending")
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    transaction_ref = Column(String(100), nullable=True)
    referral_count = Column(Integer, nullable=False, default=0)
