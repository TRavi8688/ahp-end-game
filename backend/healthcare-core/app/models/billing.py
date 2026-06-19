# backend/healthcare-core/app/models/billing.py
# DB-3 FIX: Billing/Invoice/Payment models migrated from old monolith.

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, Date, Enum, ForeignKey,
    Numeric, String, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base  # EXECUTION FIX: was `from app.db.base_class import Base`,
                                     # a module that doesn't exist anywhere in healthcare-core.
                                     # This broke import of api/v1/billing.py (and therefore
                                     # api/router.py, and therefore the whole app) before it
                                     # ever got near boot. Same bug as found in models/pharmacy.py.


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    UPI = "UPI"
    NETBANKING = "NETBANKING"
    INSURANCE = "INSURANCE"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"),
                        nullable=False, index=True)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"),
                            nullable=True)

    # Human-readable invoice number, e.g. INV-2026-00001
    invoice_number = Column(String(30), nullable=False, unique=True, index=True)

    # line_items: [{description, quantity, unit_price, total}]
    line_items = Column(JSONB, nullable=False, default=list)

    subtotal = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT, index=True)

    issued_at = Column(DateTime, nullable=True)
    due_date = Column(Date, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    # relationships
    payments = relationship("Payment", back_populates="invoice", lazy="select")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"),
                        nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"),
                        nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    transaction_id = Column(String(120), nullable=True)    # digital payment ref
    payment_gateway = Column(String(60), nullable=True)    # e.g. Razorpay, Stripe

    status = Column(Enum(PaymentStatus), nullable=False,
                    default=PaymentStatus.PENDING, index=True)

    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # relationships
    invoice = relationship("Invoice", back_populates="payments")
