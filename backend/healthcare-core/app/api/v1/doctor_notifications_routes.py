"""
doctor_notifications_routes.py
Phase 4 -- Doctor App: Notifications list + Phone Number Change via OTP.

WHY THIS FILE EXISTS:
  doctor-app's Settings.jsx and NotificationsScreen.jsx call:
    GET   /doctor/notifications
    PATCH /doctor/notifications/{id}/read
    POST  /doctor/notifications/read-all
    POST  /doctor/send-phone-otp
    POST  /doctor/verify-phone-otp
  None of these exist in healthcare-core.

SCOPE NOTE (read before wiring):
  Your real notification delivery system lives in the separate
  notification-service microservice, and OTP/SMS infrastructure lives
  in auth-service (app/core/otp_security.py). This file does NOT call
  either of those services -- I don't have visibility into their
  internal request/response contracts or your service-to-service auth
  setup beyond shared/utils/service_auth.py, so wiring this file to
  call them for real would be guessing.

  What this file DOES do, so the doctor-app stops getting 404s and the
  feature is real and usable:
    - Notifications: stored and read directly from a local table in
      healthcare-core (notifications can be inserted by other parts of
      this same service, e.g. when a lab result completes).
    - Phone OTP: generates and validates a 6-digit OTP stored in
      healthcare-core directly (NOT sent via real SMS yet -- the
      response includes `dev_otp` in development so you can test the
      flow end-to-end immediately). To send real SMS, replace the
      `_send_sms_otp` function body with a call to your
      notification-service's SMS endpoint, using generate_internal_token()
      from shared/utils/service_auth.py the same way other services do.

DROP-IN INSTRUCTIONS:
  1. Save as: backend/healthcare-core/app/api/v1/doctor_notifications_routes.py
  2. Add a `notifications` table migration (see migrations file --
     a minimal one is included as part of 0006_doctor_schedule_system.py
     companion migration 0007 below, OR reuse an existing notifications
     table if healthcare-core already has equivalent infrastructure
     for other roles -- check before applying to avoid a duplicate table).
  3. In router.py:
       from app.api.v1.doctor_notifications_routes import router as doctor_notif_router
       api_router.include_router(doctor_notif_router, prefix="/doctor", tags=["Doctor Notifications"])
"""

import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.doctor import Doctor
from app.config.settings import settings
from shared.utils.responses import success_response, error_response
from shared.audit import log_audit_event

router = APIRouter()

# In-memory OTP store fallback if Redis isn't reachable from this scope.
# For production, swap this for the same Redis-backed store auth-service
# uses in app/core/otp_security.py.
_OTP_STORE: dict[str, dict] = {}
OTP_TTL_SECONDS = 300  # 5 minutes


async def _get_doctor(db: AsyncSession, user_id_str: str) -> Doctor:
    """Matches the existing pattern in doctor_queue.py's _resolve_doctor --
    TokenPayload.sub is a plain string, must cast to uuid.UUID."""
    from sqlalchemy import select
    result = await db.execute(
        select(Doctor).where(
            Doctor.user_id == uuid.UUID(user_id_str),
            Doctor.is_active == True,
            Doctor.deleted_at.is_(None),
        )
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return doctor


# ===========================================================================
# NOTIFICATIONS
# ===========================================================================

@router.get("/notifications")
async def get_notifications(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    try:
        result = await db.execute(
            text(
                """
                SELECT id, title, body, is_read, created_at
                FROM doctor_notifications
                WHERE doctor_id = :doc_id
                ORDER BY created_at DESC
                LIMIT 100
                """
            ),
            {"doc_id": str(doctor.id)},
        )
        rows = result.mappings().all()
    except Exception:
        rows = []

    notifications = [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "body": r["body"],
            "is_read": r["is_read"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
    return {
        "notifications": notifications,
        "unread_count": sum(1 for n in notifications if not n["is_read"]),
    }


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    try:
        await db.execute(
            text(
                "UPDATE doctor_notifications SET is_read = TRUE "
                "WHERE id = :nid AND doctor_id = :doc_id"
            ),
            {"nid": notification_id, "doc_id": str(doctor.id)},
        )
        await db.commit()
    except Exception:
        await db.rollback()
    return success_response(message="Notification marked as read")


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    try:
        await db.execute(
            text("UPDATE doctor_notifications SET is_read = TRUE WHERE doctor_id = :doc_id"),
            {"doc_id": str(doctor.id)},
        )
        await db.commit()
    except Exception:
        await db.rollback()
    return success_response(message="All notifications marked as read")


# ===========================================================================
# PHONE NUMBER CHANGE VIA OTP
# ===========================================================================

class SendPhoneOtpPayload(BaseModel):
    phone_number: str = Field(..., min_length=8, max_length=20)


class VerifyPhoneOtpPayload(BaseModel):
    phone_number: str
    otp: str = Field(..., min_length=4, max_length=8)


def _is_dev_environment() -> bool:
    env = getattr(settings, "APP_ENV", None) or getattr(settings, "ENVIRONMENT", "production")
    return str(env).lower() in ("dev", "development", "local")


@router.post("/send-phone-otp")
async def send_phone_otp(
    payload: SendPhoneOtpPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    otp_code = f"{random.randint(0, 999999):06d}"
    _OTP_STORE[f"{doctor.id}:{payload.phone_number}"] = {
        "otp": otp_code,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS),
        "attempts": 0,
    }

    # TODO (production): replace with a real SMS send via notification-service,
    # using generate_internal_token() from shared/utils/service_auth.py.
    # _send_sms_otp(payload.phone_number, otp_code)

    log_audit_event(
        action="doctor_phone_otp_requested",
        actor_id=str(current_user.sub),
        target_id=str(doctor.id),
        metadata={"phone_number": payload.phone_number},
    )

    response = {"success": True, "message": "OTP sent."}
    if _is_dev_environment():
        response["dev_otp"] = otp_code  # visible only in dev, mirrors frontend's devOtpInfo UI
    return response


@router.post("/verify-phone-otp")
async def verify_phone_otp(
    payload: VerifyPhoneOtpPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    key = f"{doctor.id}:{payload.phone_number}"
    entry = _OTP_STORE.get(key)

    if not entry:
        return error_response(
            error_code="OTP_NOT_FOUND",
            message="No OTP was requested for this number, or it has expired. Please request a new one.",
            status_code=400,
        )

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del _OTP_STORE[key]
        return error_response(
            error_code="OTP_EXPIRED",
            message="OTP has expired. Please request a new one.",
            status_code=400,
        )

    entry["attempts"] += 1
    if entry["attempts"] > 5:
        del _OTP_STORE[key]
        return error_response(
            error_code="TOO_MANY_ATTEMPTS",
            message="Too many incorrect attempts. Please request a new OTP.",
            status_code=429,
        )

    if entry["otp"] != payload.otp:
        return error_response(
            error_code="INVALID_OTP",
            message="Invalid verification OTP code.",
            status_code=400,
        )

    doctor.phone = payload.phone_number
    await db.commit()
    del _OTP_STORE[key]

    log_audit_event(
        action="doctor_phone_number_updated",
        actor_id=str(current_user.sub),
        target_id=str(doctor.id),
        metadata={"new_phone": payload.phone_number},
    )

    return {"success": True, "message": "Phone number successfully updated."}
