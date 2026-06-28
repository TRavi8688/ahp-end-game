# Healthcare Core Models Registry
# Import all models here so SQLAlchemy registers them with Base.metadata
from app.models.hospital import Hospital
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.walkin import WalkInRequest
from app.models.staff import Staff
from app.models.queue_event import QueueEvent
from app.models.payment_transaction import PaymentTransaction
from app.models.prescription import Prescription, PrescriptionItem
from app.models.doctor_schedule import (
    DoctorProfileExtension, DoctorLeave, DoctorBreakLog,
    RosterShift, Holiday, LeaveStatus, BreakType, ShiftType,
)
# EXECUTION FIX: pharmacy models existed as a file but were never imported
# here, so SQLAlchemy never registered them and Base.metadata.create_all()
# (and alembic autogenerate) didn't know they existed.
from app.models.pharmacy import (
    Medicine, PharmacyInventory, PrescriptionDispense,
    PharmacyTransaction, TransactionType, PrescriptionShare,
    WalkInCustomer, PharmacySale, PharmacySaleItem, PaymentMethod,
)
from app.models.pharmacy_ops import (
    Supplier, PurchaseOrder, PurchaseOrderItem, Expense, ExpenseCategory,
)
# EXECUTION FIX: billing models had the same broken-Base bug as pharmacy.py
# and were never registered either, despite api/v1/billing.py depending on them.
from app.models.billing import Invoice, Payment, InvoiceStatus, PaymentMethod as InvoicePaymentMethod, PaymentStatus

# Missing models registrations
from app.models.lab import LabTest, LabOrder, LabOrderItem
from app.models.surgery import Surgery
from app.models.workflow import (
    WorkflowDefinition, WorkflowStage, WorkflowTransition,
    PatientToken, TokenStageHistory, DoctorSession,
)
from app.models.consent_stub import ConsentRecord, DataDeletionRequest, LabResult

__all__ = [
    "Hospital",
    "Doctor",
    "Patient",
    "Appointment",
    "MedicalRecord",
    "WalkInRequest",
    "Staff",
    "QueueEvent",
    "PaymentTransaction",
    "Prescription",
    "PrescriptionItem",
    "DoctorProfileExtension",
    "DoctorLeave",
    "DoctorBreakLog",
    "RosterShift",
    "Holiday",
    "LeaveStatus",
    "BreakType",
    "ShiftType",
    "Medicine",
    "PharmacyInventory",
    "PrescriptionDispense",
    "PharmacyTransaction",
    "TransactionType",
    "PrescriptionShare",
    "WalkInCustomer",
    "PharmacySale",
    "PharmacySaleItem",
    "PaymentMethod",
    "Supplier",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "Expense",
    "ExpenseCategory",
    "Invoice",
    "Payment",
    "InvoiceStatus",
    "InvoicePaymentMethod",
    "PaymentStatus",
    "LabTest",
    "LabOrder",
    "LabOrderItem",
    "Surgery",
    "WorkflowDefinition",
    "WorkflowStage",
    "WorkflowTransition",
    "PatientToken",
    "TokenStageHistory",
    "DoctorSession",
    "ConsentRecord",
    "DataDeletionRequest",
    "LabResult",
]
