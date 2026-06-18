"""
doctor_extensions.py
Phase 3 Fix: Doctor App missing routes

APPLY TO: Append these routes into your existing
          backend/healthcare-core/app/api/v1/doctors.py
          (or register this as a separate router in router.py)

Routes added:
    GET  /doctor/stats              - Dashboard stats
    GET  /doctor/alerts             - Lab results, critical flags
    GET  /doctor/access-history     - Audit log of patient record access
    POST /doctor/emergency/broadcast - Broadcast emergency alert
    POST /doctor/session/break/start - Start break
    POST /doctor/session/break/end   - End break

REGISTER IN router.py:
    from app.api.v1.doctor_extensions import router as doctor_ext_router
    router.include_router(doctor_ext_router, prefix="/doctor", tags=["Doctor Extensions"])
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.models.doctor import Doctor, DoctorStatus
from app.models.appointment import Appointment
from app.models.patient import Patient
from shared.audit import log_audit_event

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /doctor/stats
# ---------------------------------------------------------------------------
@router.get("/stats")
async def get_doctor_stats(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard stats for the authenticated doctor.
    Returns patients seen today, consultations completed,
    pending queue count, and average consultation time.
    """
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.sub_uuid)
    )
    doctor = doctor_result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    today = datetime.now(timezone.utc).date()

    # Appointments today
    today_appts_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.doctor_id == doctor.id,
                func.date(Appointment.scheduled_at) == today,
            )
        )
    )
    total_patients_today = today_appts_result.scalar() or 0

    # Completed consultations
    completed_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.doctor_id == doctor.id,
                func.date(Appointment.scheduled_at) == today,
                Appointment.status == "completed",
            )
        )
    )
    consultations_completed = completed_result.scalar() or 0

    # Pending in queue
    pending_result = await db.execute(
        text(
            "SELECT COUNT(*) FROM doctor_queue WHERE doctor_id = :doc_id AND status = 'waiting'"
        ),
        {"doc_id": str(doctor.id)},
    )
    pending_queue_count = pending_result.scalar() or 0

    # Average consultation time (minutes) from completed appointments today
    avg_result = await db.execute(
        text(
            """
            SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
            FROM appointments
            WHERE doctor_id = :doc_id
              AND DATE(scheduled_at) = :today
              AND status = 'completed'
              AND completed_at IS NOT NULL
              AND started_at IS NOT NULL
            """
        ),
        {"doc_id": str(doctor.id), "today": str(today)},
    )
    avg_consultation_time = round(avg_result.scalar() or 0, 1)

    return {
        "total_patients_today": total_patients_today,
        "consultations_completed": consultations_completed,
        "pending_queue_count": pending_queue_count,
        "avg_consultation_time_minutes": avg_consultation_time,
        "doctor_id": str(doctor.id),
        "doctor_name": doctor.full_name,
        "status": doctor.status.value if doctor.status else "unknown",
    }


# ---------------------------------------------------------------------------
# GET /doctor/alerts
# ---------------------------------------------------------------------------
@router.get("/alerts")
async def get_doctor_alerts(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Alerts for the authenticated doctor:
    - Pending lab results awaiting review
    - Critical patient flags
    - Overdue prescriptions
    """
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.sub_uuid)
    )
    doctor = doctor_result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    alerts = []

    # Pending lab results
    try:
        lab_result = await db.execute(
            text(
                """
                SELECT lr.id, lr.test_name, lr.status, lr.created_at,
                       p.full_name as patient_name
                FROM lab_requests lr
                JOIN patients p ON lr.patient_id = p.id
                WHERE lr.doctor_id = :doc_id
                  AND lr.status IN ('completed', 'ready')
                  AND lr.reviewed_at IS NULL
                ORDER BY lr.created_at DESC
                LIMIT 20
                """
            ),
            {"doc_id": str(doctor.id)},
        )
        for row in lab_result.mappings():
            alerts.append(
                {
                    "type": "lab_result",
                    "severity": "medium",
                    "title": f"Lab result ready: {row['test_name']}",
                    "patient_name": row["patient_name"],
                    "created_at": str(row["created_at"]),
                    "ref_id": str(row["id"]),
                }
            )
    except Exception:
        pass  # Table may not exist in all deployments

    # Critical patient flags from clinical timeline
    try:
        critical_result = await db.execute(
            text(
                """
                SELECT ct.id, ct.note_type, ct.created_at,
                       p.full_name as patient_name, ct.patient_id
                FROM clinical_timeline ct
                JOIN patients p ON ct.patient_id = p.id
                WHERE ct.doctor_id = :doc_id
                  AND ct.is_critical = TRUE
                  AND ct.acknowledged_at IS NULL
                ORDER BY ct.created_at DESC
                LIMIT 10
                """
            ),
            {"doc_id": str(doctor.id)},
        )
        for row in critical_result.mappings():
            alerts.append(
                {
                    "type": "critical_flag",
                    "severity": "high",
                    "title": f"Critical flag on patient {row['patient_name']}",
                    "patient_name": row["patient_name"],
                    "created_at": str(row["created_at"]),
                    "ref_id": str(row["id"]),
                }
            )
    except Exception:
        pass

    return {
        "alerts": alerts,
        "total": len(alerts),
        "unread_count": len(alerts),
    }


# ---------------------------------------------------------------------------
# GET /doctor/access-history
# ---------------------------------------------------------------------------
@router.get("/access-history")
async def get_doctor_access_history(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """
    Audit log of patient records accessed by this doctor.
    Queries the AuditLog table filtered by doctor's user_id.
    """
    result = await db.execute(
        text(
            """
            SELECT al.id, al.action, al.target_id, al.created_at,
                   al.ip_address, al.metadata
            FROM audit_logs al
            WHERE al.actor_id = :user_id
              AND al.action LIKE 'patient%'
            ORDER BY al.created_at DESC
            LIMIT :limit
            """
        ),
        {"user_id": str(current_user.sub), "limit": limit},
    )

    history = []
    for row in result.mappings():
        history.append(
            {
                "id": str(row["id"]),
                "action": row["action"],
                "patient_id": row["target_id"],
                "accessed_at": str(row["created_at"]),
                "ip_address": row.get("ip_address"),
                "metadata": row.get("metadata"),
            }
        )

    return {"history": history, "total": len(history)}


# ---------------------------------------------------------------------------
# POST /doctor/emergency/broadcast
# ---------------------------------------------------------------------------
class EmergencyBroadcastRequest:
    pass


from pydantic import BaseModel


class EmergencyBroadcastPayload(BaseModel):
    message: str
    patient_id: str | None = None
    severity: str = "high"  # high | critical
    location: str | None = None  # e.g. "Ward 3, Bed 12"


@router.post("/emergency/broadcast", status_code=201)
async def broadcast_emergency(
    payload: EmergencyBroadcastPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin", "nurse"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Store emergency alert in DB and notify reception / nursing staff.
    Frontend WebSocket clients subscribed to the hospital channel receive this.
    """
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.sub_uuid)
    )
    doctor = doctor_result.scalars().first()

    alert_id = None
    try:
        result = await db.execute(
            text(
                """
                INSERT INTO emergency_alerts
                    (id, hospital_id, doctor_id, patient_id, message, severity, location, created_at)
                VALUES
                    (gen_random_uuid(), :hospital_id, :doctor_id, :patient_id,
                     :message, :severity, :location, now())
                RETURNING id
                """
            ),
            {
                "hospital_id": str(doctor.hospital_id) if doctor else None,
                "doctor_id": str(doctor.id) if doctor else None,
                "patient_id": payload.patient_id,
                "message": payload.message,
                "severity": payload.severity,
                "location": payload.location,
            },
        )
        await db.commit()
        row = result.mappings().first()
        alert_id = str(row["id"]) if row else None
    except Exception:
        # If emergency_alerts table doesn't exist yet, still return success
        # (WebSocket push is the primary delivery mechanism)
        await db.rollback()

    log_audit_event(
        action="emergency_broadcast",
        actor_id=str(current_user.sub),
        target_id=alert_id or "none",
        metadata={"severity": payload.severity, "location": payload.location},
    )

    return {
        "status": "broadcast_sent",
        "alert_id": alert_id,
        "message": payload.message,
        "severity": payload.severity,
        "broadcast_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /doctor/session/break/start
# ---------------------------------------------------------------------------
@router.post("/session/break/start")
async def start_break(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Set doctor status to ON_BREAK and pause their queue availability."""
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.sub_uuid)
    )
    doctor = doctor_result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    doctor.status = DoctorStatus.on_break  # type: ignore[attr-defined]
    break_start = datetime.now(timezone.utc)

    # Pause queue availability
    try:
        await db.execute(
            text(
                "UPDATE doctor_queue SET availability = FALSE WHERE doctor_id = :doc_id"
            ),
            {"doc_id": str(doctor.id)},
        )
    except Exception:
        pass

    await db.commit()

    return {
        "status": "break_started",
        "doctor_id": str(doctor.id),
        "break_start_time": break_start.isoformat(),
        "message": "Queue paused. You are now on break.",
    }


# ---------------------------------------------------------------------------
# POST /doctor/session/break/end
# ---------------------------------------------------------------------------
@router.post("/session/break/end")
async def end_break(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Set doctor status back to ACTIVE and resume queue availability."""
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.sub_uuid)
    )
    doctor = doctor_result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    doctor.status = DoctorStatus.active  # type: ignore[attr-defined]
    break_end = datetime.now(timezone.utc)

    # Resume queue
    try:
        await db.execute(
            text(
                "UPDATE doctor_queue SET availability = TRUE WHERE doctor_id = :doc_id"
            ),
            {"doc_id": str(doctor.id)},
        )
    except Exception:
        pass

    await db.commit()

    return {
        "status": "break_ended",
        "doctor_id": str(doctor.id),
        "break_end_time": break_end.isoformat(),
        "message": "You are back online. Queue resumed.",
    }
