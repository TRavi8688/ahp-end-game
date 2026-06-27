"""
Staff HR API Routes
====================
PHASE 3 FIX — HR Portal backend: staff directory, shift roster, leave requests.

Endpoints:
  GET   /staff/list                    - Staff directory for this hospital
  GET   /staff/shifts                  - Weekly shift roster
  POST  /staff/shifts                  - Assign a staff member to a shift
  GET   /staff/leaves                  - Leave requests (pending/approved/rejected)
  POST  /staff/leaves                  - Submit a leave request
  PATCH /staff/leaves/{id}/approve     - Approve leave request
  PATCH /staff/leaves/{id}/reject      - Reject leave request
  POST  /staff/invites                 - Invite a new staff member (Owner Dashboard)

HOW TO REGISTER:
  In backend/healthcare-core/app/api/router.py add:
    from app.api.v1.staff import router as staff_router
    router.include_router(staff_router, prefix="/staff", tags=["Staff HR"])
"""

import uuid
import secrets
import string
from datetime import datetime, timezone, date
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from shared.utils.responses import success_response, error_response
from shared.audit import log_audit_event

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ShiftAssignPayload(BaseModel):
    staff_id: uuid.UUID
    shift_date: date
    shift_type: str = Field(..., description="MORNING | AFTERNOON | NIGHT | ON_CALL")
    department: Optional[str] = None
    notes: Optional[str] = None


class LeaveRequestPayload(BaseModel):
    leave_type: str = Field(..., description="SICK | CASUAL | ANNUAL | MATERNITY | OTHER")
    from_date: date
    to_date: date
    reason: str = Field(..., max_length=500)


class LeaveReviewPayload(BaseModel):
    remarks: Optional[str] = Field(None, max_length=500)


class StaffInvitePayload(BaseModel):
    email: str
    role: str
    full_name: str
    phone_number: Optional[str] = None
    specialty: Optional[str] = None
    job_title: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_staff_hospital_id(user_id: str, db: AsyncSession) -> Optional[str]:
    """Get the hospital_id for the authenticated user (staff or owner)."""
    try:
        import uuid
        uid_obj = uuid.UUID(str(user_id))
        uid_dashes = str(uid_obj)
        uid_hex = uid_obj.hex
    except Exception:
        uid_dashes = user_id
        uid_hex = user_id

    try:
        result = await db.execute(
            text("SELECT hospital_id FROM staff WHERE (user_id = :uid_dashes OR user_id = :uid_hex) AND deleted_at IS NULL LIMIT 1"),
            {"uid_dashes": uid_dashes, "uid_hex": uid_hex},
        )
        row = result.fetchone()
        if row:
            return str(row[0])

        # Check if owner
        result2 = await db.execute(
            text("SELECT id FROM hospitals WHERE (owner_user_id = :uid_dashes OR owner_user_id = :uid_hex) AND deleted_at IS NULL LIMIT 1"),
            {"uid_dashes": uid_dashes, "uid_hex": uid_hex},
        )
        row2 = result2.fetchone()
        return str(row2[0]) if row2 else None
    except Exception as e:
        logger.error(f"Error resolving staff hospital_id: {e}")
        return None


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    pwd = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    pwd += [secrets.choice(chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


# ─── GET /staff/list ──────────────────────────────────────────────────────────

@router.get("/list")
async def list_staff(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    department: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="ACTIVE | INACTIVE | ON_LEAVE"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the staff directory for the authenticated user's hospital.
    Used by HR Portal Staff Directory tab.
    """
    hospital_id = await _get_staff_hospital_id(current_user.sub, db)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    try:
        # EXECUTION FIX: this used to `JOIN users u ON u.id = s.user_id` — the
        # users table lives in auth-service's own database
        # (hospyn_auth_db), not this one, so the join could never resolve.
        # It also referenced s.specialty / s.job_title / s.status, none of
        # which exist on the Staff model (see app/models/staff.py — only
        # first_name, last_name, phone, role, department, is_active are
        # real columns). Rewritten against the actual schema. Email isn't
        # available here (it lives in auth-service); not fabricated.
        query = """
            SELECT
                s.id, s.first_name, s.last_name, s.role, s.department,
                s.phone, s.is_active, s.created_at AS joined_at
            FROM staff s
            WHERE s.hospital_id = :hid AND s.deleted_at IS NULL
        """
        params: dict = {"hid": hospital_id}

        if department:
            query += " AND s.department = :dept"
            params["dept"] = department
        if role:
            query += " AND s.role = :role"
            params["role"] = role
        if status:
            is_active = status.upper() == "ACTIVE"
            query += " AND s.is_active = :is_active"
            params["is_active"] = is_active
        if search:
            query += " AND (s.first_name ILIKE :search OR s.last_name ILIKE :search)"
            params["search"] = f"%{search}%"

        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM ({query}) AS q"), params
        )
        total = count_result.scalar() or 0

        query += " ORDER BY s.first_name ASC LIMIT :limit OFFSET :offset"
        params["limit"] = per_page
        params["offset"] = (page - 1) * per_page

        result = await db.execute(text(query), params)
        rows = result.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    staff_list = [
        {
            "id": str(row.id),
            "full_name": f"{row.first_name} {row.last_name}".strip() or "Unknown",
            "role": row.role,
            "department": row.department,
            "status": "ACTIVE" if row.is_active else "INACTIVE",
            "phone_number": row.phone,
            "joined_at": row.joined_at.strftime("%d %b %Y") if row.joined_at else None,
        }
        for row in rows
    ]

    return success_response(
        data={
            "staff": staff_list,
            "total_count": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
        },
        message="Staff directory loaded",
    )


# ─── GET /staff/shifts ────────────────────────────────────────────────────────

@router.get("/shifts")
async def get_shift_roster(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    week_start: Optional[str] = Query(None, description="ISO date for week start, e.g. 2026-06-02"),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the weekly shift roster for this hospital.
    Used by HR Portal Shift Roster tab.
    """
    hospital_id = await _get_staff_hospital_id(current_user.sub, db)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    # Default to current week if not specified
    if not week_start:
        today = datetime.now(timezone.utc).date()
        week_start_date = today - __import__("datetime").timedelta(days=today.weekday())
    else:
        try:
            week_start_date = date.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid week_start date format. Use YYYY-MM-DD")

    week_end_date = week_start_date + __import__("datetime").timedelta(days=6)

    try:
        query = """
            SELECT
                sh.id, sh.staff_id, sh.shift_date, sh.shift_type,
                sh.department, sh.notes,
                u.full_name AS staff_name, s.role, s.department AS staff_department
            FROM staff_shifts sh
            JOIN staff s ON s.id = sh.staff_id
            JOIN users u ON u.id = s.user_id
            WHERE s.hospital_id = :hid
              AND sh.shift_date >= :week_start
              AND sh.shift_date <= :week_end
              AND sh.deleted_at IS NULL
        """
        params: dict = {
            "hid": hospital_id,
            "week_start": week_start_date,
            "week_end": week_end_date,
        }
        if department:
            query += " AND sh.department = :dept"
            params["dept"] = department

        query += " ORDER BY sh.shift_date ASC, sh.shift_type ASC"
        result = await db.execute(text(query), params)
        rows = result.fetchall()
    except Exception:
        # Table may not exist yet
        rows = []

    shifts = [
        {
            "id": str(row.id),
            "staff_id": str(row.staff_id),
            "staff_name": row.staff_name,
            "role": row.role,
            "department": row.department or row.staff_department,
            "shift_date": row.shift_date.isoformat() if row.shift_date else None,
            "shift_type": row.shift_type,
            "notes": row.notes,
        }
        for row in rows
    ]

    return success_response(
        data={
            "shifts": shifts,
            "week_start": week_start_date.isoformat(),
            "week_end": week_end_date.isoformat(),
            "total_shifts": len(shifts),
        },
        message="Shift roster loaded",
    )


# ─── POST /staff/shifts ───────────────────────────────────────────────────────

@router.post("/shifts", status_code=201)
async def assign_shift(
    payload: ShiftAssignPayload,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """Assign a staff member to a shift."""
    hospital_id = await _get_staff_hospital_id(current_user.sub, db)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    # Verify staff belongs to this hospital
    try:
        staff_check = await db.execute(
            text("SELECT id FROM staff WHERE id = :sid AND hospital_id = :hid AND deleted_at IS NULL"),
            {"sid": str(payload.staff_id), "hid": hospital_id},
        )
        if not staff_check.fetchone():
            raise HTTPException(status_code=404, detail="Staff member not found in your hospital")

        shift_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO staff_shifts (id, staff_id, shift_date, shift_type, department, notes, created_at)
                VALUES (:id, :staff_id, :shift_date, :shift_type, :dept, :notes, :now)
                ON CONFLICT (staff_id, shift_date, shift_type)
                DO UPDATE SET department = :dept, notes = :notes, updated_at = :now
            """),
            {
                "id": shift_id,
                "staff_id": str(payload.staff_id),
                "shift_date": payload.shift_date,
                "shift_type": payload.shift_type.upper(),
                "dept": payload.department,
                "notes": payload.notes,
                "now": now,
            },
        )
        await db.flush()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign shift: {e}")

    return success_response(
        data={"shift_id": shift_id},
        message="Shift assigned successfully",
        status_code=201,
    )


# ─── GET /staff/leaves ────────────────────────────────────────────────────────

@router.get("/leaves")
async def list_leave_requests(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    status: Optional[str] = Query(None, description="PENDING | APPROVED | REJECTED"),
    db: AsyncSession = Depends(get_db),
):
    """
    List leave requests for this hospital.
    Used by HR Portal Leave Requests tab.
    """
    hospital_id = await _get_staff_hospital_id(current_user.sub, db)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    try:
        query = """
            SELECT
                lr.id, lr.leave_type, lr.from_date, lr.to_date,
                lr.reason, lr.status, lr.remarks, lr.created_at,
                u.full_name AS staff_name, s.role, s.department
            FROM leave_requests lr
            JOIN staff s ON s.id = lr.staff_id
            JOIN users u ON u.id = s.user_id
            WHERE s.hospital_id = :hid AND lr.deleted_at IS NULL
        """
        params: dict = {"hid": hospital_id}
        if status:
            query += " AND lr.status = :status"
            params["status"] = status.upper()

        query += " ORDER BY lr.created_at DESC LIMIT 100"
        result = await db.execute(text(query), params)
        rows = result.fetchall()
    except Exception:
        rows = []

    leaves = [
        {
            "id": str(row.id),
            "staff_name": row.staff_name,
            "role": row.role,
            "department": row.department,
            "leave_type": row.leave_type,
            "from_date": row.from_date.isoformat() if row.from_date else None,
            "to_date": row.to_date.isoformat() if row.to_date else None,
            "reason": row.reason,
            "status": row.status or "PENDING",
            "remarks": row.remarks,
            "requested_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]

    return success_response(
        data={
            "leave_requests": leaves,
            "total_count": len(leaves),
            "pending_count": sum(1 for l in leaves if l["status"] == "PENDING"),
        },
        message="Leave requests loaded",
    )


# ─── PATCH /staff/leaves/{id}/approve ────────────────────────────────────────

@router.patch("/leaves/{leave_id}/approve")
async def approve_leave(
    leave_id: uuid.UUID,
    payload: LeaveReviewPayload,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """Approve a leave request."""
    try:
        await db.execute(
            text("""
                UPDATE leave_requests
                SET status = 'APPROVED',
                    remarks = :remarks,
                    reviewed_by = :reviewer,
                    reviewed_at = :now,
                    updated_at = :now
                WHERE id = :id AND status = 'PENDING'
            """),
            {
                "id": str(leave_id),
                "remarks": payload.remarks,
                "reviewer": current_user.sub,
                "now": datetime.now(timezone.utc),
            },
        )
        await db.flush()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve leave: {e}")

    log_audit_event(action="leave_approved", actor_id=current_user.sub, target_id=str(leave_id))

    return success_response(message="Leave request approved")


# ─── PATCH /staff/leaves/{id}/reject ─────────────────────────────────────────

@router.patch("/leaves/{leave_id}/reject")
async def reject_leave(
    leave_id: uuid.UUID,
    payload: LeaveReviewPayload,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """Reject a leave request."""
    try:
        await db.execute(
            text("""
                UPDATE leave_requests
                SET status = 'REJECTED',
                    remarks = :remarks,
                    reviewed_by = :reviewer,
                    reviewed_at = :now,
                    updated_at = :now
                WHERE id = :id AND status = 'PENDING'
            """),
            {
                "id": str(leave_id),
                "remarks": payload.remarks,
                "reviewer": current_user.sub,
                "now": datetime.now(timezone.utc),
            },
        )
        await db.flush()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject leave: {e}")

    log_audit_event(action="leave_rejected", actor_id=current_user.sub, target_id=str(leave_id))

    return success_response(message="Leave request rejected")


# ─── POST /staff/invites ──────────────────────────────────────────────────────

@router.post("/invites", status_code=201)
async def invite_staff_member(
    payload: StaffInvitePayload,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "hr_manager", "owner")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a new staff member to the hospital.
    Creates a user account with a temporary password and staff profile.
    Called by OwnerDashboard.jsx Staff Provisioner IAM form.
    """
    hospital_id = await _get_staff_hospital_id(current_user.sub, db)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    # Check email not already registered
    try:
        existing = await db.execute(
            text("SELECT id FROM users WHERE email = :email LIMIT 1"),
            {"email": payload.email},
        )
        if existing.fetchone():
            return error_response("EMAIL_EXISTS", "A user with this email already exists", 409)
    except Exception:
        pass

    temp_password = _generate_temp_password()
    now = datetime.now(timezone.utc)
    new_user_id = str(uuid.uuid4())
    new_staff_id = str(uuid.uuid4())

    try:
        import bcrypt
        salt = bcrypt.gensalt()
        hashed_pwd = bcrypt.hashpw(temp_password.encode("utf-8"), salt).decode("utf-8")

        # Create user
        await db.execute(
            text("""
                INSERT INTO users (id, email, phone_number, full_name, role, hashed_password,
                                   is_active, must_change_password, token_version, created_at, updated_at)
                VALUES (:id, :email, :phone, :name, :role, :pwd,
                        TRUE, TRUE, 1, :now, :now)
            """),
            {
                "id": new_user_id,
                "email": payload.email,
                "phone": payload.phone_number,
                "name": payload.full_name,
                "role": payload.role,
                "pwd": hashed_pwd,
                "now": now,
            },
        )

        # Create staff profile
        await db.execute(
            text("""
                INSERT INTO staff (id, user_id, hospital_id, role, specialty, job_title,
                                   status, created_at, updated_at)
                VALUES (:id, :user_id, :hospital_id, :role, :specialty, :job_title,
                        'ACTIVE', :now, :now)
            """),
            {
                "id": new_staff_id,
                "user_id": new_user_id,
                "hospital_id": hospital_id,
                "role": payload.role,
                "specialty": payload.specialty,
                "job_title": payload.job_title,
                "now": now,
            },
        )
        await db.flush()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create staff account: {e}")

    log_audit_event(
        action="staff_invited",
        actor_id=current_user.sub,
        target_id=new_user_id,
        details={
            "email": payload.email,
            "role": payload.role,
            "hospital_id": hospital_id,
        },
    )

    # In production: send temp_password via email (Twilio SendGrid / Resend)
    # For now: returned in response (the OwnerDashboard modal shows it)
    return success_response(
        data={
            "staff_id": new_staff_id,
            "user_id": new_user_id,
            "email": payload.email,
            "temp_password": temp_password,  # Shown in credentials modal; backend will email it
            "role": payload.role,
            "must_change_password": True,
        },
        message="Staff member invited successfully. Credentials ready to dispatch.",
        status_code=201,
    )
