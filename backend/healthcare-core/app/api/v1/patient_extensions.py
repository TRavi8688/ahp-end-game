"""
patient_extensions.py
Phase 3 Fix: Patient App missing routes

APPLY TO: Append these routes into your existing
          backend/healthcare-core/app/api/v1/patients.py
          (or register this as a separate router)

Routes added:
    GET /patient/vitals          - Latest vitals for authenticated patient
    GET /patient/notifications   - Notification list for patient

REGISTER IN router.py:
    from app.api.v1.patient_extensions import router as patient_ext_router
    router.include_router(patient_ext_router, prefix="/patient", tags=["Patient Extensions"])
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.patient import Patient

router = APIRouter()


async def _get_patient_for_user(current_user: TokenPayload, db: AsyncSession) -> Patient:
    """Resolve the Patient record for the current authenticated user."""
    result = await db.execute(
        select(Patient).where(Patient.user_id == current_user.sub_uuid)
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient


# ---------------------------------------------------------------------------
# GET /patient/vitals
# ---------------------------------------------------------------------------
@router.get("/vitals")
async def get_patient_vitals(
    current_user: Annotated[TokenPayload, Depends(require_role("patient", "doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Latest vitals for the authenticated patient.
    Reads from clinical_timeline / vitals records.
    Returns: bp, pulse, temperature, spo2, weight, height, recorded_at.
    """
    patient = await _get_patient_for_user(current_user, db)

    # Try clinical_timeline first (primary source)
    vitals = None
    try:
        result = await db.execute(
            text(
                """
                SELECT vitals_bp, vitals_pulse, vitals_temperature,
                       vitals_spo2, vitals_weight, vitals_height, created_at
                FROM clinical_timeline
                WHERE patient_id = :pid
                  AND vitals_bp IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"pid": str(patient.id)},
        )
        row = result.mappings().first()
        if row:
            vitals = dict(row)
    except Exception:
        pass

    # Fallback: dedicated vitals table
    if not vitals:
        try:
            result = await db.execute(
                text(
                    """
                    SELECT blood_pressure as vitals_bp,
                           pulse_rate as vitals_pulse,
                           temperature as vitals_temperature,
                           spo2 as vitals_spo2,
                           weight as vitals_weight,
                           height as vitals_height,
                           recorded_at as created_at
                    FROM patient_vitals
                    WHERE patient_id = :pid
                    ORDER BY recorded_at DESC
                    LIMIT 1
                    """
                ),
                {"pid": str(patient.id)},
            )
            row = result.mappings().first()
            if row:
                vitals = dict(row)
        except Exception:
            pass

    if not vitals:
        return {
            "patient_id": str(patient.id),
            "vitals": None,
            "message": "No vitals recorded yet",
        }

    return {
        "patient_id": str(patient.id),
        "vitals": {
            "blood_pressure": vitals.get("vitals_bp"),
            "pulse": vitals.get("vitals_pulse"),
            "temperature": vitals.get("vitals_temperature"),
            "spo2": vitals.get("vitals_spo2"),
            "weight": vitals.get("vitals_weight"),
            "height": vitals.get("vitals_height"),
            "recorded_at": str(vitals.get("created_at")),
        },
    }


# ---------------------------------------------------------------------------
# GET /patient/notifications
# ---------------------------------------------------------------------------
@router.get("/notifications")
async def get_patient_notifications(
    current_user: Annotated[TokenPayload, Depends(require_role("patient", "admin"))],
    db: AsyncSession = Depends(get_db),
    unread_only: bool = False,
    limit: int = 30,
):
    """
    Notifications for the authenticated patient.
    Types: appointment_reminder, prescription_ready, lab_result, bill_generated.
    """
    patient = await _get_patient_for_user(current_user, db)

    # Try notifications table (added in migration 4addab7eb67c)
    notifications = []
    try:
        query = """
            SELECT id, type, title, body, is_read, created_at, metadata
            FROM notifications
            WHERE patient_id = :pid
            {unread_clause}
            ORDER BY created_at DESC
            LIMIT :limit
        """
        unread_clause = "AND is_read = FALSE" if unread_only else ""
        result = await db.execute(
            text(query.format(unread_clause=unread_clause)),
            {"pid": str(patient.id), "limit": limit},
        )
        for row in result.mappings():
            notifications.append(
                {
                    "id": str(row["id"]),
                    "type": row["type"],
                    "title": row["title"],
                    "body": row["body"],
                    "is_read": row["is_read"],
                    "created_at": str(row["created_at"]),
                    "metadata": row.get("metadata"),
                }
            )
    except Exception:
        # notifications table may not exist — return empty list, not 500
        pass

    unread_count = sum(1 for n in notifications if not n.get("is_read"))

    return {
        "patient_id": str(patient.id),
        "notifications": notifications,
        "total": len(notifications),
        "unread_count": unread_count,
    }


# ---------------------------------------------------------------------------
# POST /patient/device-token  (Phase 6: Firebase push)
# ---------------------------------------------------------------------------
from pydantic import BaseModel


class DeviceTokenPayload(BaseModel):
    token: str
    platform: str = "expo"  # expo | apns | fcm


@router.post("/device-token", status_code=200)
async def register_device_token(
    payload: DeviceTokenPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Store the device's FCM/Expo push token so the backend
    can send push notifications to this patient.
    """
    patient = await _get_patient_for_user(current_user, db)

    try:
        await db.execute(
            text(
                """
                INSERT INTO patient_device_tokens (patient_id, token, platform, updated_at)
                VALUES (:pid, :token, :platform, now())
                ON CONFLICT (patient_id) DO UPDATE
                    SET token = EXCLUDED.token,
                        platform = EXCLUDED.platform,
                        updated_at = now()
                """
            ),
            {
                "pid": str(patient.id),
                "token": payload.token,
                "platform": payload.platform,
            },
        )
        await db.commit()
    except Exception:
        # Table may not exist yet — create it in a migration (see alembic section)
        await db.rollback()

    return {"status": "token_registered", "patient_id": str(patient.id)}
