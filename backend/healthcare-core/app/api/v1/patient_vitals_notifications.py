"""
Patient Vitals & Notifications Routes
======================================
PHASE 1.5 FIX -- Routes returning 404 that frontend calls:
  GET /patient/vitals
  GET /patient/notifications

HOW TO REGISTER:
  In backend/healthcare-core/app/api/router.py add:
    from app.api.v1.patient_vitals_notifications import router as patient_extras_router
    router.include_router(patient_extras_router, prefix="/patient", tags=["Patient Vitals"])

  This must come BEFORE the main patients router to avoid prefix conflicts.
"""

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.patient import Patient
from shared.utils.responses import success_response

router = APIRouter()


# --- GET /patient/vitals ------------------------------------------------------

@router.get("/vitals")
async def get_patient_vitals(
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the latest recorded vitals for the authenticated patient.

    The patient-app VitalsScreen.js and HomeScreen.js call this.
    Reads from clinical_timeline / vitals tables if they exist.
    Returns a safe fallback structure if no records exist yet.
    """
    # Get the patient profile for this user
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # Try to load vitals from clinical_timeline or medical_records table
    vitals_data = None

    try:
        # Attempt to query vitals -- table may exist under different names
        # depending on which migration was applied
        from sqlalchemy import text
        vitals_query = await db.execute(
            text("""
                SELECT
                    blood_pressure,
                    heart_rate,
                    blood_oxygen,
                    temperature,
                    weight_kg,
                    height_cm,
                    recorded_at
                FROM patient_vitals
                WHERE patient_id = :patient_id
                ORDER BY recorded_at DESC
                LIMIT 1
            """),
            {"patient_id": str(patient.id)},
        )
        row = vitals_query.fetchone()
        if row:
            vitals_data = {
                "blood_pressure": row.blood_pressure,
                "heart_rate": row.heart_rate,
                "blood_oxygen": row.blood_oxygen,
                "temperature": row.temperature,
                "weight_kg": float(row.weight_kg) if row.weight_kg else None,
                "height_cm": float(row.height_cm) if row.height_cm else None,
                "recorded_at": row.recorded_at.isoformat() if row.recorded_at else None,
            }
    except Exception:
        # Table may not exist yet -- return empty vitals structure
        vitals_data = None

    if not vitals_data:
        # Return an empty-but-valid structure -- frontend handles None values gracefully
        vitals_data = {
            "blood_pressure": None,
            "heart_rate": None,
            "blood_oxygen": None,
            "temperature": None,
            "weight_kg": None,
            "height_cm": None,
            "recorded_at": None,
            "message": "No vitals recorded yet. Your doctor will update these during your next visit.",
        }

    return success_response(
        data=vitals_data,
        message="Vitals loaded",
    )


# --- GET /patient/notifications -----------------------------------------------

@router.get("/notifications")
async def get_patient_notifications(
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns notifications for the authenticated patient.
    Types: appointment_reminder, prescription_ready, lab_result, bill_generated, general

    The patient-app NotificationsScreen.js and HomeScreen.js badge call this.
    """
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    notifications = []
    total_count = 0
    unread_count = 0

    try:
        # Try reading from notifications table (migration 4addab7eb67c adds this)
        from sqlalchemy import text
        count_result = await db.execute(
            text("""
                SELECT COUNT(*) FROM notifications
                WHERE patient_id = :patient_id
                  AND (:unread_only = FALSE OR is_read = FALSE)
            """),
            {"patient_id": str(patient.id), "unread_only": unread_only},
        )
        total_count = count_result.scalar() or 0

        unread_result = await db.execute(
            text("SELECT COUNT(*) FROM notifications WHERE patient_id = :patient_id AND is_read = FALSE"),
            {"patient_id": str(patient.id)},
        )
        unread_count = unread_result.scalar() or 0

        offset = (page - 1) * per_page
        notif_result = await db.execute(
            text("""
                SELECT id, notification_type, title, message, is_read, created_at, metadata
                FROM notifications
                WHERE patient_id = :patient_id
                  AND (:unread_only = FALSE OR is_read = FALSE)
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {
                "patient_id": str(patient.id),
                "unread_only": unread_only,
                "limit": per_page,
                "offset": offset,
            },
        )
        rows = notif_result.fetchall()
        for row in rows:
            notifications.append({
                "id": str(row.id),
                "type": row.notification_type,
                "title": row.title,
                "message": row.message,
                "is_read": row.is_read,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })

    except Exception:
        # Notifications table may not exist yet
        notifications = []
        total_count = 0
        unread_count = 0

    return success_response(
        data={
            "notifications": notifications,
            "total_count": total_count,
            "unread_count": unread_count,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total_count + per_page - 1) // per_page) if total_count else 1,
        },
        message="Notifications loaded",
    )


# --- POST /patient/notifications/{id}/mark-read -------------------------------

@router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    try:
        from sqlalchemy import text
        await db.execute(
            text("""
                UPDATE notifications
                SET is_read = TRUE, read_at = NOW()
                WHERE id = :notif_id AND patient_id = :patient_id
            """),
            {"notif_id": str(notification_id), "patient_id": str(patient.id)},
        )
        await db.flush()
    except Exception:
        raise HTTPException(status_code=500, detail="Could not mark notification as read")

    return success_response(message="Notification marked as read")
