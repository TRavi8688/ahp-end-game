"""
Owner Dashboard API
====================
PHASE 1.4 + PHASE 2 FIX — Real endpoint for GET /owner/dashboard.

The OwnerDashboard.jsx (after mock bypass removal) calls this.
Returns real data from the database scoped to the hospital owner's hospital.

HOW TO REGISTER:
  In backend/healthcare-core/app/api/router.py add:
    from app.api.v1.owner import router as owner_router
    router.include_router(owner_router, prefix="/owner", tags=["Owner Dashboard"])
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.hospital import Hospital
from app.models.doctor import Doctor, DoctorStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.walkin import WalkInRequest, QueueState
from shared.utils.responses import success_response

router = APIRouter()


@router.get("/dashboard")
async def get_owner_dashboard(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_owner", "hospital_admin", "admin")),
    ],
    branch_id: Optional[str] = Query(None, description="Filter by specific branch UUID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns complete hospital dashboard telemetry for the owner console.
    All data is scoped to the current owner's hospital(s) — no cross-tenant leakage.
    """
    # ── 1. Find the owner's hospital ────────────────────────────────────────
    try:
        staff_result = await db.execute(
            text("SELECT hospital_id FROM staff WHERE user_id = :uid AND deleted_at IS NULL LIMIT 1"),
            {"uid": current_user.sub},
        )
        staff_row = staff_result.fetchone()
        hospital_id = str(staff_row.hospital_id) if staff_row else None
    except Exception:
        hospital_id = None

    # Fallback: check if this user owns a hospital directly
    if not hospital_id:
        try:
            hosp_result = await db.execute(
                text("SELECT id FROM hospitals WHERE owner_user_id = :uid AND deleted_at IS NULL LIMIT 1"),
                {"uid": current_user.sub},
            )
            hosp_row = hosp_result.fetchone()
            hospital_id = str(hosp_row.id) if hosp_row else None
        except Exception:
            pass

    if not hospital_id:
        raise HTTPException(status_code=403, detail="No hospital linked to this account")

    # If branch filter specified, validate it belongs to this hospital
    active_hospital_id = hospital_id
    if branch_id and branch_id != "All":
        try:
            branch_result = await db.execute(
                text("SELECT id FROM hospital_branches WHERE id = :bid AND hospital_id = :hid"),
                {"bid": branch_id, "hid": hospital_id},
            )
            if not branch_result.fetchone():
                raise HTTPException(status_code=403, detail="Branch does not belong to your hospital")
            active_hospital_id = branch_id  # Use branch as scope
        except HTTPException:
            raise
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # ── 2. Hospital info ─────────────────────────────────────────────────────
    hosp_result = await db.execute(
        select(Hospital).where(Hospital.id == uuid.UUID(active_hospital_id))
    )
    hospital = hosp_result.scalars().first()
    hospital_name = hospital.name if hospital else "Your Hospital"

    # ── 3. Revenue today ─────────────────────────────────────────────────────
    income_today = 0.0
    try:
        rev_result = await db.execute(
            text("""
                SELECT COALESCE(SUM(total_amount), 0) as revenue
                FROM invoices
                WHERE hospital_id = :hid
                  AND status = 'PAID'
                  AND paid_at >= :today
                  AND deleted_at IS NULL
            """),
            {"hid": active_hospital_id, "today": today_start},
        )
        income_today = float(rev_result.scalar() or 0)
    except Exception:
        pass

    # ── 4. Staff count ───────────────────────────────────────────────────────
    staff_list = []
    try:
        staff_query = await db.execute(
            text("""
                SELECT u.id, u.full_name as name, s.role, s.department,
                       s.status, s.specialty
                FROM staff s
                JOIN users u ON u.id = s.user_id
                WHERE s.hospital_id = :hid AND s.deleted_at IS NULL
                ORDER BY s.role, u.full_name
                LIMIT 200
            """),
            {"hid": active_hospital_id},
        )
        for row in staff_query.fetchall():
            staff_list.append({
                "id": str(row.id),
                "name": row.name or "Unknown",
                "role": row.role,
                "department": row.department,
                "specialty": row.specialty,
                "status": row.status or "ACTIVE",
            })
    except Exception:
        pass

    # ── 5. Bed occupancy ─────────────────────────────────────────────────────
    beds_total = 0
    beds_occupied = 0
    try:
        bed_result = await db.execute(
            text("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) AS occupied
                FROM ward_beds
                WHERE hospital_id = :hid AND deleted_at IS NULL
            """),
            {"hid": active_hospital_id},
        )
        bed_row = bed_result.fetchone()
        if bed_row:
            beds_total = int(bed_row.total or 0)
            beds_occupied = int(bed_row.occupied or 0)
    except Exception:
        pass

    # ── 6. Low stock count ───────────────────────────────────────────────────
    low_stock_count = 0
    try:
        stock_result = await db.execute(
            text("""
                SELECT COUNT(*) FROM pharmacy_inventory
                WHERE hospital_id = :hid
                  AND current_stock <= reorder_level
                  AND deleted_at IS NULL
            """),
            {"hid": active_hospital_id},
        )
        low_stock_count = int(stock_result.scalar() or 0)
    except Exception:
        pass

    # ── 7. Active queue count ────────────────────────────────────────────────
    queue_count = 0
    try:
        queue_result = await db.execute(
            text("""
                SELECT COUNT(*) FROM walk_in_requests
                WHERE hospital_id = :hid
                  AND queue_state IN ('WAITING_NURSE', 'WAITING_DOCTOR', 'WITH_DOCTOR')
                  AND deleted_at IS NULL
            """),
            {"hid": active_hospital_id},
        )
        queue_count = int(queue_result.scalar() or 0)
    except Exception:
        pass

    # ── 8. Recent activity feed ───────────────────────────────────────────────
    activity_feed = []
    try:
        activity_result = await db.execute(
            text("""
                SELECT
                    al.action,
                    al.created_at AS timestamp,
                    u.full_name AS actor_name,
                    u.role AS actor_role,
                    al.target_id AS patient
                FROM audit_logs al
                LEFT JOIN users u ON u.id::text = al.actor_id
                WHERE al.hospital_id = :hid
                ORDER BY al.created_at DESC
                LIMIT 20
            """),
            {"hid": active_hospital_id},
        )
        for row in activity_result.fetchall():
            activity_feed.append({
                "action": row.action or "SYSTEM_EVENT",
                "timestamp": row.timestamp.isoformat() if row.timestamp else now.isoformat(),
                "actor_name": row.actor_name or "System",
                "actor_role": row.actor_role or "System",
                "patient": str(row.patient) if row.patient else "—",
            })
    except Exception:
        pass

    # ── 9. Recent ledger ──────────────────────────────────────────────────────
    ledger = []
    try:
        ledger_result = await db.execute(
            text("""
                SELECT
                    i.invoice_number,
                    i.total_amount,
                    i.status,
                    i.upi_transaction_ref,
                    i.paid_at,
                    p.full_name AS patient_name
                FROM invoices i
                LEFT JOIN patients pt ON pt.id = i.patient_id
                LEFT JOIN users p ON p.id = pt.user_id
                WHERE i.hospital_id = :hid AND i.deleted_at IS NULL
                ORDER BY i.created_at DESC
                LIMIT 10
            """),
            {"hid": active_hospital_id},
        )
        for row in ledger_result.fetchall():
            ledger.append({
                "patient_name": row.patient_name or "Patient",
                "invoice_number": row.invoice_number,
                "total_amount": float(row.total_amount or 0),
                "status": row.status,
                "payment_method": "UPI",
                "upi_transaction_ref": row.upi_transaction_ref,
            })
    except Exception:
        pass

    # ── 10. Branch list ───────────────────────────────────────────────────────
    branches = []
    try:
        branch_result = await db.execute(
            text("SELECT id, name, city FROM hospital_branches WHERE hospital_id = :hid AND deleted_at IS NULL"),
            {"hid": hospital_id},
        )
        for row in branch_result.fetchall():
            branches.append({"id": str(row.id), "name": row.name, "city": row.city})
    except Exception:
        # If no branches table, return the hospital itself as the single "branch"
        branches = [{"id": hospital_id, "name": hospital_name, "city": "Main"}]

    # ── Determine scale ───────────────────────────────────────────────────────
    scale = "Low"
    if len(staff_list) > 50 or beds_total > 100:
        scale = "High"
    elif len(staff_list) > 20 or beds_total > 30:
        scale = "Mid"

    return success_response(
        data={
            "hospital_name": hospital_name,
            "hospital_id": hospital_id,
            "scale": scale,
            "telemetry": {
                "income_today": income_today,
                "beds_occupied": beds_occupied,
                "beds_total": beds_total,
                "low_stock_count": low_stock_count,
                "active_queue_count": queue_count,
            },
            "staff": staff_list,
            "branches": branches,
            "activity_feed": activity_feed,
            "ledger": ledger,
            "generated_at": now.isoformat(),
        },
        message="Dashboard data loaded",
    )
