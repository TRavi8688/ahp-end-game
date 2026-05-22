from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Numeric, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import *
from app.models.clinical import *

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    NET_BANKING = "NET_BANKING"
    INSURANCE = "INSURANCE"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"

class Invoice(Base, TenantScopedMixin, TimestampMixin):
    """
    HOSPYN FINANCIAL LEDGER:
    The central authority for patient billing.
    """
    __tablename__ = "invoices"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("patient_visits.id"), nullable=True)
    
    total_amount: Mapped[float] = mapped_column(default=0.0)
    discount_amount: Mapped[float] = mapped_column(default=0.0)
    tax_amount: Mapped[float] = mapped_column(default=0.0)
    payable_amount: Mapped[float] = mapped_column(default=0.0)
    paid_amount: Mapped[float] = mapped_column(default=0.0)
    
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), default=PaymentStatus.DRAFT)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    items: Mapped[List["BillItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="invoice")

class BillItem(Base, TimestampMixin):
    """
    INDIVIDUAL CHARGE LINES:
    Detailed breakdown of consultation, pharmacy, and lab charges.
    """
    __tablename__ = "bill_items"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    
    item_name: Mapped[str] = mapped_column(String(255))
    item_category: Mapped[str] = mapped_column(String(100)) # Consultation, Lab, Pharmacy, Room, OT
    quantity: Mapped[float] = mapped_column(default=1.0)
    unit_price: Mapped[float] = mapped_column(default=0.0)
    subtotal: Mapped[float] = mapped_column(default=0.0)
    tax_percent: Mapped[float] = mapped_column(default=0.0)
    
    invoice: Mapped["Invoice"] = relationship(back_populates="items")

