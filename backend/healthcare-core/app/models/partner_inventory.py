"""
PartnerInventory ORM model for healthcare-core.
"""

import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class PartnerInventory(Base):
    __tablename__ = "partner_inventories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    generic_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    sku_code = Column(String(100), nullable=True)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    stock_quantity = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=10)
    unit_price = Column(Float, nullable=False, default=0.0)
    mrp = Column(Float, nullable=False, default=0.0)
    manufacturer = Column(String(255), nullable=True)
    qr_code = Column(String(255), nullable=True, unique=True)
