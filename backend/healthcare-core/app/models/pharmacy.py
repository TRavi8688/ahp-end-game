# backend/healthcare-core/app/models/pharmacy.py
#
# EXECUTION FIX (critical):
#   - Was `from app.db.base_class import Base` -- that module does not exist
#     anywhere in healthcare-core. These models were never registered with
#     SQLAlchemy's metadata and importing this file raised ModuleNotFoundError,
#     which is why app/api/router.py couldn't boot.
#   - `PrescriptionDispense.dispensed_by` had `ForeignKey("users.id")`, but
#     `users` lives in the auth-service's own Postgres database
#     (hospyn_auth_db), not healthcare-core's (hospyn_healthcare_db) -- see
#     infra/init-databases.sh. A cross-database FK is impossible in Postgres;
#     this migration would fail to apply. Fixed to a plain UUID column, same
#     convention already used in models/staff.py and models/doctor.py for
#     auth-service user references.
#
# Added in this pass (previously missing, needed by partner-app Dashboard):
#   - PharmacyTransaction: ledger rows for the "Transactions Ledger" view.
#   - PrescriptionShare: links a Prescription to a pharmacy's Hospital row
#     when a patient scans the pharmacy's QR code -- backs the "Network Orders"
#     view. Without this there was no way to represent "patient shared their
#     prescription with pharmacy X" at all.

import enum
import uuid

from sqlalchemy import (
    Column, DateTime, Date, Enum as SQLEnum, ForeignKey,
    Integer, Numeric, String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Medicine(Base):
    """Master catalogue of medicines, shared across all pharmacies on the platform."""
    __tablename__ = "medicines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, index=True)
    generic_name = Column(String(200), nullable=False, index=True)
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

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    medicine = relationship("Medicine", back_populates="inventory_items")
    dispenses = relationship("PrescriptionDispense", back_populates="inventory", lazy="select")
    transactions = relationship("PharmacyTransaction", back_populates="inventory", lazy="select")


class PrescriptionDispense(Base):
    __tablename__ = "prescription_dispenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("prescriptions.id", ondelete="RESTRICT"),
                              nullable=False, index=True)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_inventory.id", ondelete="RESTRICT"),
                          nullable=False, index=True)
    quantity_dispensed = Column(Integer, nullable=False)
    # EXECUTION FIX: was ForeignKey("users.id") -- users live in a different
    # service's database. Plain UUID, same as Staff.user_id / Doctor.user_id.
    dispensed_by = Column(UUID(as_uuid=True), nullable=True)
    dispensed_at = Column(DateTime, nullable=False, server_default=func.now())

    inventory = relationship("PharmacyInventory", back_populates="dispenses")


class TransactionType(str, enum.Enum):
    purchase = "purchase"        # stock received (AI scan / CSV upload / manual add)
    dispense = "dispense"        # stock sold/dispensed to a patient
    adjustment = "adjustment"    # manual correction (loss, damage, recount)
    return_ = "return"           # patient/customer return


class PharmacyTransaction(Base):
    """
    Append-only ledger of every inventory movement for a pharmacy.
    Backs the partner-app "Transactions Ledger" view.
    """
    __tablename__ = "pharmacy_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    inventory_item_id = Column(UUID(as_uuid=True),
                               ForeignKey("pharmacy_inventory.id", ondelete="SET NULL"),
                               nullable=True, index=True)
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    # Positive for stock added (purchase/return), negative for stock removed (dispense).
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # dispense_id / prescription_id, etc.
    created_by = Column(UUID(as_uuid=True), nullable=True)    # auth-service user id, no cross-DB FK
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    inventory = relationship("PharmacyInventory", back_populates="transactions")


class WalkInCustomer(Base):
    """
    A counter customer with no Hospin account -- name + phone only (see
    Patient.user_id being NOT NULL, which makes a bare Patient row impossible
    for someone with no login). Kept separate until they sign up for real;
    POST /patients/ links matching WalkInCustomer rows by phone at that point
    (sets merged_patient_id) so their counter-sale history carries over.
    """
    __tablename__ = "walkin_customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=False, index=True)
    merged_patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"),
                               nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    upi = "upi"
    card = "card"


class PharmacySale(Base):
    """
    A completed bill -- walk-in counter sale OR a fulfilled Hospin order.
    Exactly one of patient_id / walkin_customer_id is set. This is the
    invoice-level record (Bill Success screen); stock movement is still
    tracked per-item in PharmacyTransaction as before.
    """
    __tablename__ = "pharmacy_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    invoice_number = Column(String(40), nullable=False, unique=True, index=True)

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True)
    walkin_customer_id = Column(UUID(as_uuid=True), ForeignKey("walkin_customers.id", ondelete="SET NULL"), nullable=True)
    prescription_share_id = Column(UUID(as_uuid=True), ForeignKey("prescription_shares.id", ondelete="SET NULL"), nullable=True)

    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    gst_amount = Column(Numeric(10, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True)

    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    items = relationship("PharmacySaleItem", back_populates="sale", lazy="selectin")


class PharmacySaleItem(Base):
    __tablename__ = "pharmacy_sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_sales.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("pharmacy_inventory.id", ondelete="RESTRICT"), nullable=False)
    medicine_name = Column(String(200), nullable=False)  # denormalized snapshot for invoice history
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)

    sale = relationship("PharmacySale", back_populates="items")


class PrescriptionShare(Base):
    """
    Created when a patient scans a pharmacy's QR code and shares a prescription
    with it. Backs the partner-app Orders tab pipeline.

    status values: pending -> accepted -> preparing -> ready -> delivered
                                       \\-> rejected
    token_number is assigned when status becomes "ready" (counter pickup token).
    """
    __tablename__ = "prescription_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("prescriptions.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    pharmacy_hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"),
                                  nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")
    token_number = Column(Integer, nullable=True)
    shared_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    prescription = relationship("Prescription", lazy="joined")
