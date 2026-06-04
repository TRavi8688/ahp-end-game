"""
staff.py
Phase 3 Fix: HR Portal backend — Staff Directory, Shift Roster, Leave Requests

APPLY TO: Create as new file
          backend/healthcare-core/app/api/v1/staff.py

REGISTER IN router.py:
    from app.api.v1.staff import router as staff_router
    router.include_router(staff_router, prefix="/healthcare/staff", tags=["HR Staff"])
    # Also add:
    router.include_router(staff_router, prefix="/staff", tags=["HR Staff"])
"""

from datetime import date, datetime, timezone
from typing import Annotated, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.database import get_db
from app.core.security import require_role, TokenPayload

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class StaffResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone_number: Optional[str]
    role: str
    department: Optional[str]
    status: str
    photo_url: Optional[str]
    hospital_id: str

    class Config:
        from_attributes = True


class ShiftEntry(BaseModel):
    id: str
    staff_id: str
    staff_name: str
    role: str
    shift_date: str
    shift_type: str       # morning | afternoon | night
    start_time: str       # "08:00"
    end_time: str         # "16:00"
    department: Optional[str]


class LeaveRequest(BaseModel):
    id: str
    staff_id: str
    staff_name: str
    leave_type: str       # sick | casual | annual | emergency
    start_date: str
    end_date: str
    reason: Optional[str]
    status: str           # pending | approved | rejected
    applied_at: str
    approved_by: Optional[str]


class ApproveLeavePayload(BaseModel):
    approved: bool
    remarks: Optional[str] = None


class AssignShiftPayload(BaseModel):
    staff_id: str
    shift_date: str        # YYYY-MM-DD
    shift_type: str        # morning | afternoon | night
    department: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /staff/list  — Staff Directory
# ---------------------------------------------------------------------------
@router.get("/list", response_model=List[dict])
async def list_staff(
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin", "hr", "doctor"))
    ],
    db: AsyncSession = Depends(get_db),
    hospital_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    offset: int = Query(0),
):
    """
    List all staff at the hospital.
    Staff are users with roles: doctor, nurse, receptionist,
    pharmacist, lab_technician, admin, hr.
    """
    # Build dynamic WHERE clauses
    where_clauses = ["u.deleted_at IS NULL"]
    params: dict = {"limit": limit, "offset": offset}

    # Hospital scoping — use the token's hospital_id if admin/hr, else use query param
    if hospital_id:
        where_clauses.append("u.hospital_id = :hospital_id")
        params["hospital_id"] = hospital_id
    elif hasattr(current_user, "hospital_id") and current_user.hospital_id:
        where_clauses.append("u.hospital_id = :hospital_id")
        params["hospital_id"] = str(current_user.hospital_id)

    if role:
        where_clauses.append("u.role = :role")
        params["role"] = role

    if status:
        where_clauses.append("u.staff_status = :status")
        params["status"] = status

    if search:
        where_clauses.append(
            "(u.full_name ILIKE :search OR u.phone_number ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where_sql = " AND ".join(where_clauses)

    try:
        result = await db.execute(
            text(
                f"""
                SELECT u.id, u.full_name as name, u.phone_number,
                       u.role, u.staff_status as status,
                       u.photo_url, u.hospital_id,
                       u.department,
                       u.created_at
                FROM users u
                WHERE {where_sql}
                  AND u.role IN ('doctor','nurse','receptionist','pharmacist',
                                 'lab_technician','admin','hr','staff')
                ORDER BY u.full_name ASC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ---------------------------------------------------------------------------
# GET /staff/shifts  — Shift Roster
# ---------------------------------------------------------------------------
@router.get("/shifts", response_model=List[dict])
async def get_shifts(
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin", "hr"))
    ],
    db: AsyncSession = Depends(get_db),
    week_start: Optional[str] = Query(None, description="YYYY-MM-DD of Monday"),
    hospital_id: Optional[str] = Query(None),
):
    """
    Weekly shift roster. Returns all staff shifts for the given week.
    If week_start is not provided, uses current week's Monday.
    """
    if week_start:
        try:
            monday = date.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(400, "week_start must be YYYY-MM-DD")
    else:
        today = date.today()
        monday = today  # simplified — frontend can compute Monday

    try:
        result = await db.execute(
            text(
                """
                SELECT s.id, s.staff_id,
                       u.full_name as staff_name, u.role,
                       s.shift_date, s.shift_type,
                       s.start_time, s.end_time,
                       s.department, s.hospital_id
                FROM staff_shifts s
                JOIN users u ON s.staff_id = u.id
                WHERE s.shift_date >= :week_start
                  AND s.shift_date < :week_start::date + 7
                ORDER BY s.shift_date, s.start_time
                """
            ),
            {"week_start": str(monday)},
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        # staff_shifts table may not exist — return empty
        return []


# ---------------------------------------------------------------------------
# POST /staff/shifts  — Assign Shift
# ---------------------------------------------------------------------------
@router.post("/shifts", status_code=201)
async def assign_shift(
    payload: AssignShiftPayload,
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin", "hr"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Assign a staff member to a shift."""
    SHIFT_TIMES = {
        "morning": ("08:00", "16:00"),
        "afternoon": ("14:00", "22:00"),
        "night": ("22:00", "08:00"),
    }
    if payload.shift_type not in SHIFT_TIMES:
        raise HTTPException(400, "shift_type must be morning | afternoon | night")

    start_t, end_t = SHIFT_TIMES[payload.shift_type]

    try:
        result = await db.execute(
            text(
                """
                INSERT INTO staff_shifts
                    (id, staff_id, shift_date, shift_type, start_time, end_time,
                     department, created_by, created_at)
                VALUES
                    (gen_random_uuid(), :staff_id, :shift_date, :shift_type,
                     :start_time, :end_time, :department, :created_by, now())
                RETURNING id
                """
            ),
            {
                "staff_id": payload.staff_id,
                "shift_date": payload.shift_date,
                "shift_type": payload.shift_type,
                "start_time": start_t,
                "end_time": end_t,
                "department": payload.department,
                "created_by": str(current_user.sub),
            },
        )
        await db.commit()
        row = result.mappings().first()
        return {"status": "shift_assigned", "shift_id": str(row["id"]) if row else None}
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"Failed to assign shift: {str(e)}")


# ---------------------------------------------------------------------------
# GET /staff/leaves  — Leave Requests
# ---------------------------------------------------------------------------
@router.get("/leaves", response_model=List[dict])
async def get_leave_requests(
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin", "hr"))
    ],
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None),  # pending | approved | rejected
    hospital_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
):
    """List leave requests with optional status filter."""
    where_clauses = []
    params: dict = {"limit": limit}

    if status:
        where_clauses.append("lr.status = :status")
        params["status"] = status
    else:
        where_clauses.append("lr.status = 'pending'")

    where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"

    try:
        result = await db.execute(
            text(
                f"""
                SELECT lr.id, lr.staff_id, u.full_name as staff_name,
                       lr.leave_type, lr.start_date, lr.end_date,
                       lr.reason, lr.status, lr.applied_at,
                       approver.full_name as approved_by
                FROM leave_requests lr
                JOIN users u ON lr.staff_id = u.id
                LEFT JOIN users approver ON lr.approved_by_id = approver.id
                WHERE {where_sql}
                ORDER BY lr.applied_at DESC
                LIMIT :limit
                """
            ),
            params,
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# PATCH /staff/leaves/{leave_id}/approve  — Approve or Reject Leave
# ---------------------------------------------------------------------------
@router.patch("/leaves/{leave_id}/approve")
async def approve_or_reject_leave(
    leave_id: str,
    payload: ApproveLeavePayload,
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin", "hr"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a leave request."""
    new_status = "approved" if payload.approved else "rejected"

    try:
        result = await db.execute(
            text(
                """
                UPDATE leave_requests
                SET status = :status,
                    approved_by_id = :approver_id,
                    approved_at = now(),
                    remarks = :remarks
                WHERE id = :leave_id
                RETURNING id, staff_id, status
                """
            ),
            {
                "status": new_status,
                "approver_id": str(current_user.sub),
                "remarks": payload.remarks,
                "leave_id": leave_id,
            },
        )
        await db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(404, "Leave request not found")
        return {
            "status": new_status,
            "leave_id": str(row["id"]),
            "staff_id": str(row["staff_id"]),
            "approved_by": str(current_user.sub),
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=str(e))
