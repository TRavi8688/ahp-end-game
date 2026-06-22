"""
Phase 6 Fix — Push Token Endpoint for Patient App

ADD THIS TO: backend/healthcare-core/app/api/v1/patients.py

Paste this block BEFORE the final `@router.get("/{patient_id}")` route
(which must stay last to avoid swallowing other paths).

The Patient model needs a push_token column — see the Alembic migration
file in phase6/backend/add_push_token_to_patients.py

No other changes required — the router is already included in router.py.
"""

# ── Schema (add to schemas/patient.py or inline here) ─────────────────────────
from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional

class PushTokenPayload(_BaseModel):
    push_token: str
    platform: _Optional[str] = None   # "Android" | "iOS" — from expo-device


# ── Endpoint ───────────────────────────────────────────────────────────────────
@router.post("/push-token", status_code=200)
async def save_push_token(
    payload: PushTokenPayload,
    current_user: TokenPayload = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """
    Store the Expo/FCM push token for this patient device.

    Called by patient-app/src/services/notifications.js after
    registerForPushNotifications() succeeds.

    The token is used by the backend notification service to send:
    - Appointment reminders
    - Bill-generated notifications
    - Lab result availability
    """
    from sqlalchemy import update

    result = await db.execute(
        select(Patient).where(Patient.user_id == current_user.sub)
    )
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    await db.execute(
        update(Patient)
        .where(Patient.user_id == current_user.sub)
        .values(
            push_token=payload.push_token,
            push_token_platform=payload.platform,
        )
    )
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=str(current_user.sub),
        actor_role="patient",
        action="push_token_registered",
        resource_type="patient",
        resource_id=str(patient.id),
        details={"platform": payload.platform},
    )

    return {"status": "ok", "message": "Push token registered"}
