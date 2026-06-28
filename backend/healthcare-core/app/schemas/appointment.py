"""
Appointment Pydantic Schemas
"""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from app.models.appointment import AppointmentStatus, AppointmentType


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    hospital_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = 30
    appointment_type: AppointmentType = AppointmentType.in_person
    chief_complaint: Optional[str] = None
    patient_consent_token: Optional[str] = None

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v < 10 or v > 480:
            raise ValueError("Duration must be between 10 and 480 minutes")
        return v

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at(cls, v: datetime) -> datetime:
        from datetime import timezone

        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            raise ValueError("scheduled_at must be timezone-aware")
        if v <= now:
            raise ValueError("Appointment must be scheduled in the future")
        return v


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    appointment_type: Optional[AppointmentType] = None
    chief_complaint: Optional[str] = None
    status: Optional[AppointmentStatus] = None


class AppointmentClinicalUpdate(BaseModel):
    """Only doctors can fill clinical notes after appointment."""

    clinical_notes: Optional[str] = None
    diagnosis: Optional[str] = None
    prescription: Optional[str] = None


class AppointmentCancelRequest(BaseModel):
    reason: str


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    hospital_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    appointment_type: AppointmentType
    status: AppointmentStatus
    chief_complaint: Optional[str]
    clinical_notes: Optional[str]
    diagnosis: Optional[str]
    prescription: Optional[str]
    cancellation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    # FIXED: TodaysAppointmentsPage.tsx (staff-portal) displays patient_name,
    # patient_phone, doctor_name, and department for every appointment -- none
    # of these fields existed on this schema, so every row silently fell back
    # to "Anonymous Patient" / "No Phone" / "Dr. Staff (General)" regardless
    # of the real data. Optional + default None so existing callers that
    # build this from a bare Appointment ORM row (no joins) are unaffected.
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None

    model_config = {"from_attributes": True}


class AppointmentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AppointmentResponse]
