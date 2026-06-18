import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


# ── Request schemas ────────────────────────────────────────────────────────────

class OTPRequest(BaseModel):
    phone_number: str
    otp: str
    hospital_id: Optional[uuid.UUID] = None


class AppointmentReminderRequest(BaseModel):
    patient_phone: str
    doctor_name: str
    appointment_time: datetime
    hospital_name: str
    appointment_id: uuid.UUID


class AppointmentConfirmationRequest(BaseModel):
    patient_phone: str
    doctor_name: str
    appointment_time: datetime
    hospital_name: str
    appointment_id: uuid.UUID


class GenericNotificationRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None
    channel: str
    type: str
    recipient: str
    body: str
    subject: Optional[str] = None
    hospital_id: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None
    scheduled_for: Optional[datetime] = None

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        valid = {"sms", "push", "email", "in_app"}
        if v not in valid:
            raise ValueError(f"channel must be one of {valid}")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid = {
            "otp", "appointment_reminder", "appointment_confirmed",
            "appointment_cancelled", "prescription_ready", "lab_result_ready",
            "payment_received", "system_alert", "staff_alert",
        }
        if v not in valid:
            raise ValueError(f"type must be one of {valid}")
        return v


# ── History query params ───────────────────────────────────────────────────────

class NotificationHistoryParams(BaseModel):
    user_id: Optional[uuid.UUID] = None
    hospital_id: Optional[uuid.UUID] = None
    type: Optional[str] = None
    status: Optional[str] = None
    limit: int = 50
    offset: int = 0


# ── Response schemas ───────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: uuid.UUID
    hospital_id: Optional[uuid.UUID]
    user_id: Optional[uuid.UUID]
    channel: str
    type: str
    status: str
    recipient: str
    subject: Optional[str]
    body: str
    metadata: Optional[dict[str, Any]]
    attempts: int
    max_attempts: int
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    failed_reason: Optional[str]
    scheduled_for: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class SendResult(BaseModel):
    success: bool
    notification_id: Optional[uuid.UUID] = None
    message: str


class HealthResponse(BaseModel):
    status: str
    service: str
    twilio_configured: bool
