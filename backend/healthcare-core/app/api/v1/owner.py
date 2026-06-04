"""
owner.py
Phase 3 Fix: Owner Dashboard — real data, mock_token_123 replacement

APPLY TO: Create as new file
          backend/healthcare-core/app/api/v1/owner.py

REGISTER IN router.py:
    from app.api.v1.owner import router as owner_router
    router.include_router(owner_router, prefix="/owner", tags=["Owner Dashboard"])
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.security import require_role, TokenPayload

router = APIRouter()


@router.get("/dashboard")
async def get_owner_dashboard(
    current_user: Annotated[
        TokenPayload, Depends(require_role("hospital_admin", "owner", "admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Real owner dashboard data.
    RBAC-scoped to the hospital_id from the JWT token.
    Replaces the mock_token_123 bypass in OwnerDashboard.jsx.
    """
    # Resolve hospital_id from the owner's token or user record
    hospital_id = getattr(current_user, "hospital_id", None)
    if not hospital_id:
        # Look up the hospital this admin owns
        result = await db.execute(
            text(
                "SELECT id FROM hospitals WHERE owner_user_id = :uid AND deleted_at IS NULL LIMIT 1"
            ),
            {"uid": str(current_user.sub)},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(403, "No hospital associated with this account")
        hospital_id = str(row["id"])

    today = datetime.now(timezone.utc).date()
    today_str = str(today)

    # Run all stats queries
    stats = {}

    # Hospital name
    h_result = await db.execute(
        text("SELECT name, verification_status FROM hospitals WHERE id = :hid"),
        {"hid": hospital_id},
    )
    h = h_result.mappings().first()
    stats["hospital_name"] = h["name"] if h else "Unknown"
    stats["verification_status"] = h["verification_status"] if h else "unknown"

    # Total patients today
    try:
        r = await db.execute(
            text(
                "SELECT COUNT(DISTINCT patient_id) FROM appointments "
                "WHERE hospital_id = :hid AND DATE(scheduled_at) = :today"
            ),
            {"hid": hospital_id, "today": today_str},
        )
        stats["total_patients_today"] = r.scalar() or 0
    except Exception:
        stats["total_patients_today"] = 0

    # Total appointments today
    try:
        r = await db.execute(
            text(
                "SELECT COUNT(*) FROM appointments "
                "WHERE hospital_id = :hid AND DATE(scheduled_at) = :today"
            ),
            {"hid": hospital_id, "today": today_str},
        )
        stats["total_appointments_today"] = r.scalar() or 0
    except Exception:
        stats["total_appointments_today"] = 0

    # Revenue today (paid invoices)
    try:
        r = await db.execute(
            text(
                "SELECT COALESCE(SUM(total_amount), 0) FROM invoices "
                "WHERE hospital_id = :hid AND DATE(paid_at) = :today AND status = 'paid'"
            ),
            {"hid": hospital_id, "today": today_str},
        )
        stats["revenue_today"] = float(r.scalar() or 0)
    except Exception:
        stats["revenue_today"] = 0.0

    # Active doctors
    try:
        r = await db.execute(
            text(
                "SELECT COUNT(*) FROM doctors "
                "WHERE hospital_id = :hid AND status = 'active'"
            ),
            {"hid": hospital_id},
        )
        stats["active_doctors"] = r.scalar() or 0
    except Exception:
        stats["active_doctors"] = 0

    # Queue length (patients waiting)
    try:
        r = await db.execute(
            text(
                "SELECT COUNT(*) FROM doctor_queue "
                "WHERE hospital_id = :hid AND status = 'waiting'"
            ),
            {"hid": hospital_id},
        )
        stats["queue_length"] = r.scalar() or 0
    except Exception:
        stats["queue_length"] = 0

    # Recent alerts (last 5)
    try:
        r = await db.execute(
            text(
                "SELECT id, message, severity, created_at FROM emergency_alerts "
                "WHERE hospital_id = :hid ORDER BY created_at DESC LIMIT 5"
            ),
            {"hid": hospital_id},
        )
        stats["recent_alerts"] = [dict(row) for row in r.mappings()]
    except Exception:
        stats["recent_alerts"] = []

    stats["hospital_id"] = hospital_id
    stats["generated_at"] = datetime.now(timezone.utc).isoformat()

    return stats
