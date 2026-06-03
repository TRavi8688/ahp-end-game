# backend/healthcare-core/app/models/pharmacy.py
# DB-4 FIX: Pharmacy inventory models migrated from old monolith.

import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, Date, ForeignKey,
    Integer, Numeric, String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base  # adjust path as needed


class Medicine(Base):
    """
    Master catalogue of medicines.
    Check if this already exists in your models — if so, skip creation
    but add any missing columns.
    """
    __tablename__ = "medicines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, index=True)
    generic_name = Column(String(200), nullable=False)
    manufacturer = Column(String(200), nullable=True)
    category = Column(String(100), nullable=True)   # e.g. Antibiotic, Analgesic
    unit = Column(String(20), nullable=False)        # tablet, ml, mg, capsule

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    inventory_items = relationship("PharmacyInventory", back_populates="medicine", lazy="select")


class PharmacyInventory(Base):
    __tablename__ = "pharmacy_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    medicine_id = Column(UUID(as_uuid=True), ForeignKey("medicines.id", ondelete="RESTRICT"),
                         nullable=False, index=True)

    batch_number = Column(String(60), nullable=False)
    quantity_available = Column(Integer, nullable=False, default=0)
    quantity_reserved = Column(Integer, nullable=False, default=0)  # held for pending prescriptions
    reorder_level = Column(Integer, nullable=False, default=10)
    expiry_date = Column(Date, nullable=False)

    purchase_price = Column(Numeric(10, 2), nullable=False)
    selling_price = Column(Numeric(10, 2), nullable=False)

    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    medicine = relationship("Medicine", back_populates="inventory_items")
    dispenses = relationship("PrescriptionDispense", back_populates="inventory", lazy="select")


class PrescriptionDispense(Base):
    __tablename__ = "prescription_dispenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("prescriptions.id", ondelete="RESTRICT"),
                              nullable=False, index=True)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_inventory.id", ondelete="RESTRICT"),
                          nullable=False, index=True)
    quantity_dispensed = Column(Integer, nullable=False)
    dispensed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                          nullable=True)
    dispensed_at = Column(DateTime, nullable=False, server_default=func.now())

    inventory = relationship("PharmacyInventory", back_populates="dispenses")
