from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import *
from app.models.clinical import *

class PartnerPharmacyRequest(Base, TenantScopedMixin, TimestampMixin):
    """
    B2B2C Referral: Routes a prescription from a referring clinic to a partner pharmacy shop.
    """
    __tablename__ = "partner_pharmacy_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    prescription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("digital_prescriptions.id"), index=True)
    referring_hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    partner_pharmacy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    status: Mapped[PartnerReferralStatusEnum] = mapped_column(
        SQLEnum(PartnerReferralStatusEnum), default=PartnerReferralStatusEnum.pending
    )
    
    prescription: Mapped["DigitalPrescription"] = relationship()
    patient: Mapped["Patient"] = relationship()
    referring_hospital: Mapped["Hospital"] = relationship(foreign_keys=[referring_hospital_id])
    partner_pharmacy: Mapped["Hospital"] = relationship(foreign_keys=[partner_pharmacy_id])

class PharmacyStock(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pharmacy_stock"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    medication_name: Mapped[str] = mapped_column(String(255), index=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(default=0)
    unit: Mapped[str] = mapped_column(String(50)) # e.g., Tablets, Bottles
    min_stock_level: Mapped[int] = mapped_column(default=10)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    batch_number: Mapped[Optional[str]] = mapped_column(String(100))
    
    hospital: Mapped["Hospital"] = relationship(back_populates="inventory")

class StockMovementType(str, enum.Enum):
    INWARD = "INWARD" # Purchase / Return
    OUTWARD = "OUTWARD" # Dispensed / Expired / Damaged
    ADJUSTMENT = "ADJUSTMENT" # Manual correction

class StockLedger(Base, TenantScopedMixin, TimestampMixin):
    """
    PHARMACY AUDIT TRAIL.
    Permanent, immutable record of every stock movement.
    Prevents inventory leakage (theft/unrecorded sales).
    """
    __tablename__ = "pharmacy_stock_ledger"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    stock_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pharmacy_stock.id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    movement_type: Mapped[StockMovementType] = mapped_column(SQLEnum(StockMovementType))
    quantity: Mapped[int] = mapped_column() # Change in quantity
    balance_after: Mapped[int] = mapped_column() # Running balance for audit
    
    reference_type: Mapped[str] = mapped_column(String(50)) # e.g., PRESCRIPTION, PURCHASE_ORDER
    reference_id: Mapped[Optional[str]] = mapped_column(String(100))
    
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id")) # Who performed the move

class PurchaseOrder(Base, TenantScopedMixin, VersionedMixin, TimestampMixin):
    """
    AUTOMATED PROCUREMENT ENGINE.
    Staged when stock falls below min_stock_level.
    """
    __tablename__ = "purchase_orders"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    supplier_name: Mapped[str] = mapped_column(String(255), index=True)
    items_json: Mapped[dict] = mapped_column(JSON_TYPE) # List of meds and quantities
    total_estimated_cost: Mapped[float] = mapped_column()
    
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, APPROVED, SENT, RECEIVED, CANCELLED
    
    __mapper_args__ = {"version_id_col": VersionedMixin.version_id}

class InventoryTransactionType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"
    EXPIRY = "EXPIRY"
    RETURN = "RETURN"

class PharmacyInventory(Base, TenantScopedMixin, TimestampMixin):
    """
    HOSPYN PHARMACY LEDGER:
    Tracks medication stock levels, batches, and expiries.
    """
    __tablename__ = "pharmacy_inventory"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    
    item_name: Mapped[str] = mapped_column(String(255), index=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    batch_number: Mapped[str] = mapped_column(String(100), index=True)
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    
    stock_quantity: Mapped[float] = mapped_column(default=0.0)
    unit_price: Mapped[float] = mapped_column(default=0.0)
    reorder_level: Mapped[float] = mapped_column(default=10.0)
    
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    tax_percent: Mapped[float] = mapped_column(default=12.0) # GST
    
    transactions: Mapped[List["InventoryTransaction"]] = relationship(back_populates="item")

class InventoryTransaction(Base, TenantScopedMixin, TimestampMixin):
    """
    AUDIT TRAIL FOR STOCK:
    Records every movement of pharmacy items.
    """
    __tablename__ = "inventory_transactions"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pharmacy_inventory.id"), index=True)
    
    transaction_type: Mapped[InventoryTransactionType] = mapped_column(SQLEnum(InventoryTransactionType))
    quantity: Mapped[float] = mapped_column() # Positive for stock in, Negative for stock out
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True) # Invoice ID or Purchase Order ID
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    item: Mapped["PharmacyInventory"] = relationship(back_populates="transactions")
