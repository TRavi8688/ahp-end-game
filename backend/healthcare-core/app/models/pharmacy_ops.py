# backend/healthcare-core/app/models/pharmacy_ops.py
#
# Supplier Management, Purchase Entry, and Finance/Expense tracking — the
# "More" tab's Supplier Management, Purchase Entry, and Finance screens had
# no backing data model anywhere in this codebase before this file.

import enum
import uuid

from sqlalchemy import (
    Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Supplier(Base):
    __tablename__ = "pharmacy_suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(Text, nullable=True)
    gstin = Column(String(20), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier", lazy="select")


class PurchaseOrder(Base):
    """Header for a stock-in event (Screen 30: Purchase Entry)."""
    __tablename__ = "pharmacy_purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_suppliers.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    invoice_number = Column(String(60), nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", lazy="selectin")


class PurchaseOrderItem(Base):
    __tablename__ = "pharmacy_purchase_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_purchase_orders.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_inventory.id", ondelete="SET NULL"),
                               nullable=True)
    medicine_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(10, 2), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")


class ExpenseCategory(str, enum.Enum):
    rent = "rent"
    salaries = "salaries"
    utilities = "utilities"
    purchase = "purchase"   # stock purchases, auto-logged from PurchaseOrder
    other = "other"


class Expense(Base):
    """Backs the Finance tab's Expenses line."""
    __tablename__ = "pharmacy_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    category = Column(SQLEnum(ExpenseCategory), nullable=False, default=ExpenseCategory.other)
    description = Column(String(255), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
