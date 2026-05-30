from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Numeric, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.core.encryption import StringEncryptedType, TextEncryptedType
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


class Payment(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    FINANCIAL INTEGRITY LAYER (Section 2.2).
    Tracks every transaction with exactly-once semantic potential.
    """
    __tablename__ = "payments"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("invoices.id"), index=True)
    
    amount: Mapped[float] = mapped_column()
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod), default=PaymentMethod.CASH)
    
    provider: Mapped[Optional[str]] = mapped_column(String(50)) # razorpay, stripe
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON_TYPE) # Store billing items
    
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="payments")
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}


class InsuranceClaim(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    REVENUE CYCLE MANAGEMENT (RCM).
    Tracks claims submitted to TPAs.
    """
    __tablename__ = "insurance_claims"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("payments.id"))
    
    tpa_name: Mapped[str] = mapped_column(String(100), index=True)
    policy_number: Mapped[str] = mapped_column(StringEncryptedType(100))
    claim_amount: Mapped[float] = mapped_column()
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED") # SUBMITTED, APPROVED, REJECTED, DISBURSED
    
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}


class BillingSubscription(Base, TimestampMixin):
    __tablename__ = "billing_subscriptions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), unique=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100))
    auto_debit_token: Mapped[Optional[str]] = mapped_column(String(255)) # Tokenized card ref
    upi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # Unified Payment Interface
    payment_method_type: Mapped[str] = mapped_column(String(50), default="card") # card or upi
    trial_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc) + timedelta(days=60))
    subscription_status: Mapped[str] = mapped_column(String(50), default="trialing") # trialing, active, past_due, cancelled
    
    hospital: Mapped["Hospital"] = relationship(back_populates="subscription")



