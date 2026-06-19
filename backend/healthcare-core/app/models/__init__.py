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
]
