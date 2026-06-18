import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.services.sms_service import send_sms

logger = logging.getLogger(__name__)


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _create_record(
    db: AsyncSession,
    *,
    channel: str,
    type_: str,
    recipient: str,
    body: str,
    hospital_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    subject: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    scheduled_for: Optional[datetime] = None,
) -> Notification:
    notif = Notification(
        hospital_id=hospital_id,
        user_id=user_id,
        channel=channel,
        type=type_,
        status="pending",
        recipient=recipient,
        subject=subject,
        body=body,
        metadata=metadata,
        scheduled_for=scheduled_for,
    )
    db.add(notif)
    await db.flush()  # get PK without committing
    return notif


async def _mark_sent(db: AsyncSession, notif: Notification) -> None:
    notif.status = "sent"
    notif.sent_at = datetime.now(timezone.utc)
    notif.attempts += 1


async def _mark_failed(db: AsyncSession, notif: Notification, reason: str) -> None:
    notif.attempts += 1
    if notif.attempts >= notif.max_attempts:
        notif.status = "failed"
        notif.failed_reason = reason
    else:
        notif.status = "pending"  # will be retried
        notif.failed_reason = reason


async def _dispatch_sms(
    db: AsyncSession,
    notif: Notification,
    redis_client: Optional[aioredis.Redis],
) -> bool:
    success = await send_sms(notif.recipient, notif.body, redis_client)
    if success:
        await _mark_sent(db, notif)
    else:
        await _mark_failed(db, notif, "SMS delivery failed")
    return success


# ── Public API ─────────────────────────────────────────────────────────────────

async def send_otp(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    phone_number: str,
    otp: str,
    hospital_id: Optional[uuid.UUID] = None,
) -> bool:
    """Send OTP via SMS. Called by auth-service."""
    body = (
        f"Your Hospyn OTP is: {otp}. "
        "Valid for 10 minutes. Do not share this code."
    )
    notif = await _create_record(
        db,
        channel="sms",
        type_="otp",
        recipient=phone_number,
        body=body,
        hospital_id=hospital_id,
        metadata={"purpose": "otp"},
    )
    return await _dispatch_sms(db, notif, redis_client)


async def send_appointment_reminder(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    patient_phone: str,
    doctor_name: str,
    appointment_time: datetime,
    hospital_name: str,
    appointment_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    hospital_id: Optional[uuid.UUID] = None,
) -> bool:
    """Send 24-hour appointment reminder."""
    formatted_time = appointment_time.strftime("%I:%M %p")
    body = (
        f"Reminder: Your appointment with {doctor_name} at {hospital_name} "
        f"is tomorrow at {formatted_time}. Reply CANCEL to cancel."
    )
    notif = await _create_record(
        db,
        channel="sms",
        type_="appointment_reminder",
        recipient=patient_phone,
        body=body,
        hospital_id=hospital_id,
        user_id=user_id,
        metadata={"appointment_id": str(appointment_id), "doctor_name": doctor_name},
    )
    return await _dispatch_sms(db, notif, redis_client)


async def send_appointment_confirmation(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    patient_phone: str,
    doctor_name: str,
    appointment_time: datetime,
    hospital_name: str,
    appointment_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    hospital_id: Optional[uuid.UUID] = None,
) -> bool:
    """Send booking confirmation immediately after appointment created."""
    formatted_time = appointment_time.strftime("%A, %d %B %Y at %I:%M %p")
    body = (
        f"Confirmed: Your appointment with {doctor_name} at {hospital_name} "
        f"is scheduled for {formatted_time}. "
        "Please arrive 10 minutes early. Ref: " + str(appointment_id)[:8]
    )
    notif = await _create_record(
        db,
        channel="sms",
        type_="appointment_confirmed",
        recipient=patient_phone,
        body=body,
        hospital_id=hospital_id,
        user_id=user_id,
        metadata={"appointment_id": str(appointment_id), "doctor_name": doctor_name},
    )
    return await _dispatch_sms(db, notif, redis_client)


async def send_prescription_ready(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    patient_phone: str,
    hospital_name: str,
    user_id: Optional[uuid.UUID] = None,
    hospital_id: Optional[uuid.UUID] = None,
) -> bool:
    """Notify patient when prescription is ready for pickup."""
    body = (
        f"Your prescription is ready for pickup at {hospital_name}. "
        "Please visit the pharmacy counter during working hours."
    )
    notif = await _create_record(
        db,
        channel="sms",
        type_="prescription_ready",
        recipient=patient_phone,
        body=body,
        hospital_id=hospital_id,
        user_id=user_id,
    )
    return await _dispatch_sms(db, notif, redis_client)


async def send_lab_result_ready(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    patient_phone: str,
    hospital_name: str,
    user_id: Optional[uuid.UUID] = None,
    hospital_id: Optional[uuid.UUID] = None,
) -> bool:
    """Notify patient when lab results are available."""
    body = (
        f"Your lab results are now available at {hospital_name}. "
        "Please log in to the Hospyn portal or contact your doctor to review them."
    )
    notif = await _create_record(
        db,
        channel="sms",
        type_="lab_result_ready",
        recipient=patient_phone,
        body=body,
        hospital_id=hospital_id,
        user_id=user_id,
    )
    return await _dispatch_sms(db, notif, redis_client)


async def send_staff_alert(
    db: AsyncSession,
    redis_client: Optional[aioredis.Redis],
    staff_phone: str,
    message: str,
    hospital_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> bool:
    """Send urgent alert to clinical staff."""
    body = f"[HOSPYN ALERT] {message}"
    notif = await _create_record(
        db,
        channel="sms",
        type_="staff_alert",
        recipient=staff_phone,
        body=body,
        hospital_id=hospital_id,
        user_id=user_id,
        metadata={"priority": "high"},
    )
    return await _dispatch_sms(db, notif, redis_client)
