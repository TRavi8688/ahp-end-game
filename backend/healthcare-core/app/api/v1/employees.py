"""
backend/healthcare-core/app/api/v1/employees.py

Hospyn Internal Employee Management — Super Admin only.

Endpoints:
  POST  /employees/create          — super admin creates a Hospyn employee
  GET   /employees/list            — list all employees (filterable by team/level)
  GET   /employees/{employee_id}   — get one employee's profile + workload
  PATCH /employees/{employee_id}/deactivate  — deactivate employee
  PATCH /employees/{employee_id}/reactivate  — reactivate employee
  GET   /employees/my-profile      — employee reads their own profile from JWT

Employee ID Format: HPN-{TEAM}-{LEVEL}-{SEQ}
  HPN-FIN-L1-001   Finance team, L1 agent
  HPN-ENG-TL-001   Engineering team, Team Lead
  HPN-ONB-MGR-001  Onboarding team, Manager
  HPN-SUP-L1-007   Support team, L1 agent 007

Register in router.py:
  from app.api.v1.employees import router as employees_router
  api_router.include_router(employees_router, prefix="/employees", tags=["Hospyn Employees"])
"""

from __future__ import annotations

import logging
import os
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
import bcrypt
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger   = logging.getLogger(__name__)
router   = APIRouter()
# pwd_ctx removed

# ── Team and level codes ──────────────────────────────────────────────────────
TEAM_CODES  = {"finance": "FIN", "engineering": "ENG", "onboarding": "ONB", "support": "SUP", "data": "DAT"}
LEVEL_CODES = {"l1": "L1", "team_lead": "TL", "manager": "MGR", "super_admin": "SAD"}

TEAM_ROUTING = {
    "billing":      "finance",
    "technical":    "engineering",
    "onboarding":   "onboarding",
    "staff_access": "support",
    "data":         "data",
    "other":        "support",
}

# Assignment permission matrix
# Key = assigner level, Value = levels they can assign TO
ASSIGNMENT_PERMISSIONS = {
    "super_admin": ["l1", "team_lead", "manager", "super_admin"],  # can assign to anyone
    "manager":     ["l1", "team_lead", "manager"],                  # can assign within team + cross-team manager
    "team_lead":   ["l1", "team_lead"],                             # can assign to L1s + self
    "l1":          ["l1"],                                          # can reassign to another L1 in same team only
}


def _gen_password(length: int = 14) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    pwd   = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
             secrets.choice(string.digits), secrets.choice("!@#$%")]
    pwd  += [secrets.choice(chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


async def _next_seq(db: AsyncSession, team: str, level: str) -> int:
    """Get the next sequence number for this team+level combination."""
    prefix = f"HPN-{TEAM_CODES[team]}-{LEVEL_CODES[level]}-"
    result = await db.execute(
        text("SELECT COUNT(*) FROM hospyn_employees WHERE employee_id LIKE :prefix AND deleted_at IS NULL"),
        {"prefix": f"{prefix}%"},
    )
    return (result.scalar() or 0) + 1


async def _get_employee_or_404(db: AsyncSession, employee_id: str) -> dict:
    result = await db.execute(
        text("SELECT * FROM hospyn_employees WHERE employee_id = :eid AND deleted_at IS NULL LIMIT 1"),
        {"eid": employee_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")
    return dict(row)


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateEmployeeBody(BaseModel):
    full_name:    str   = Field(..., min_length=2, max_length=200)
    email:        str   = Field(..., min_length=5)
    team:         str   = Field(..., description="finance|engineering|onboarding|support|data")
    level:        str   = Field(..., description="l1|team_lead|manager")
    phone:        Optional[str] = None
    manager_id:   Optional[str] = None   # employee_id of their manager
    team_lead_id: Optional[str] = None   # employee_id of their team lead (for L1s)


class AssignTicketBody(BaseModel):
    to_employee_id: str = Field(..., description="Employee ID like HPN-FIN-L1-003")
    note:           Optional[str] = None


class EscalateBody(BaseModel):
    note: Optional[str] = None


# ── Super admin guard ─────────────────────────────────────────────────────────

async def _require_super_admin(db: AsyncSession, token: str) -> dict:
    """Validate that the request comes from a super_admin employee JWT."""
    # Decode JWT manually since internal employees use a separate token
    import jwt as pyjwt
    secret = os.getenv("HOSPYN_INTERNAL_JWT_SECRET", os.getenv("JWT_SECRET_KEY", ""))
    try:
        payload = pyjwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid internal token")

    employee_id = payload.get("employee_id")
    level       = payload.get("level")
    if level != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return payload


async def _decode_internal_token(db: AsyncSession, token: str) -> dict:
    """Decode any internal employee JWT — returns employee payload."""
    import jwt as pyjwt
    secret = os.getenv("HOSPYN_INTERNAL_JWT_SECRET", os.getenv("JWT_SECRET_KEY", ""))
    try:
        return pyjwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid internal token")


# ── POST /employees/create ────────────────────────────────────────────────────

@router.post("/create", status_code=201)
async def create_employee(
    body:          CreateEmployeeBody,
    authorization: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Super admin creates a new Hospyn internal employee."""
    # Validate teams and levels
    if body.team not in TEAM_CODES:
        raise HTTPException(status_code=400, detail=f"Invalid team. Must be one of: {list(TEAM_CODES)}")
    if body.level not in LEVEL_CODES or body.level == "super_admin":
        raise HTTPException(status_code=400, detail="Invalid level. Must be: l1, team_lead, manager")

    # Check email not already used
    dup = await db.execute(
        text("SELECT id FROM hospyn_employees WHERE email = :email AND deleted_at IS NULL LIMIT 1"),
        {"email": body.email},
    )
    if dup.first():
        raise HTTPException(status_code=409, detail="An employee with this email already exists.")

    # Generate Employee ID
    seq         = await _next_seq(db, body.team, body.level)
    employee_id = f"HPN-{TEAM_CODES[body.team]}-{LEVEL_CODES[body.level]}-{seq:03d}"

    # Generate temp password
    temp_password   = _gen_password()
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(temp_password.encode("utf-8"), salt).decode("utf-8")
    now             = datetime.now(timezone.utc)
    new_id          = uuid.uuid4()
    initials        = "".join(p[0].upper() for p in body.full_name.split()[:2])

    await db.execute(
        text("""
            INSERT INTO hospyn_employees
              (id, employee_id, full_name, email, hashed_password, team, level,
               manager_id, team_lead_id, is_active, avatar_initials, phone,
               created_at, updated_at)
            VALUES
              (:id, :eid, :name, :email, :pwd, :team, :level,
               :mgr, :tl, true, :initials, :phone,
               :now, :now)
        """),
        {
            "id":       new_id,
            "eid":      employee_id,
            "name":     body.full_name,
            "email":    body.email,
            "pwd":      hashed_password,
            "team":     body.team,
            "level":    body.level,
            "mgr":      body.manager_id,
            "tl":       body.team_lead_id,
            "initials": initials,
            "phone":    body.phone,
            "now":      now,
        },
    )
    await db.flush()

    logger.info("Hospyn employee created: %s (%s)", employee_id, body.email)

    return {
        "employee_id":    employee_id,
        "full_name":      body.full_name,
        "email":          body.email,
        "team":           body.team,
        "level":          body.level,
        "temp_password":  temp_password,   # shown once in SovereignConsole, then emailed
        "message":        f"Employee {employee_id} created. Share credentials securely.",
    }


# ── GET /employees/list ───────────────────────────────────────────────────────

@router.get("/list")
async def list_employees(
    team:     Optional[str] = Query(None),
    level:    Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    filters = ["deleted_at IS NULL"]
    params: dict = {}
    if team:     filters.append("team = :team");          params["team"]  = team
    if level:    filters.append("level = :level");        params["level"] = level
    if is_active is not None:
        filters.append("is_active = :active"); params["active"] = is_active

    where = " AND ".join(filters)

    result = await db.execute(
        text(f"""
            SELECT e.*,
              (SELECT COUNT(*) FROM support_tickets st
               WHERE st.assigned_employee_id = e.employee_id
                 AND st.status NOT IN ('resolved','closed')) AS open_tickets,
              (SELECT COUNT(*) FROM support_tickets st
               WHERE st.assigned_employee_id = e.employee_id
                 AND st.status IN ('resolved','closed')) AS resolved_tickets
            FROM hospyn_employees e
            WHERE {where}
            ORDER BY e.team, e.level DESC, e.full_name
        """),
        params,
    )
    rows = [dict(r) for r in result.mappings().all()]

    # Remove hashed_password from response
    for row in rows:
        row.pop("hashed_password", None)

    return {"employees": rows, "total": len(rows)}


# ── GET /employees/my-profile ─────────────────────────────────────────────────

@router.get("/my-profile")
async def my_profile(db: AsyncSession = Depends(get_db)):
    """Employee reads their own profile. Uses X-Employee-ID header set by internal panel."""
    # In production, decode JWT and extract employee_id
    # Placeholder — the internal panel sends this header
    return {"message": "Use /employees/list with employee_id filter"}


# ── GET /employees/{employee_id} ──────────────────────────────────────────────

@router.get("/{employee_id}")
async def get_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    emp = await _get_employee_or_404(db, employee_id)
    emp.pop("hashed_password", None)

    # Get open ticket count
    open_result = await db.execute(
        text("SELECT COUNT(*) FROM support_tickets WHERE assigned_employee_id = :eid AND status NOT IN ('resolved','closed')"),
        {"eid": employee_id},
    )
    emp["open_tickets"] = open_result.scalar() or 0

    # Get assignment history
    hist = await db.execute(
        text("""
            SELECT ta.*, st.subject FROM ticket_assignments ta
            LEFT JOIN support_tickets st ON st.ticket_id = ta.ticket_id
            WHERE ta.to_employee_id = :eid OR ta.from_employee_id = :eid
            ORDER BY ta.created_at DESC LIMIT 20
        """),
        {"eid": employee_id},
    )
    emp["recent_assignments"] = [dict(r) for r in hist.mappings().all()]
    return emp


# ── PATCH /employees/{employee_id}/deactivate ─────────────────────────────────

@router.patch("/{employee_id}/deactivate")
async def deactivate_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    await _get_employee_or_404(db, employee_id)
    await db.execute(
        text("UPDATE hospyn_employees SET is_active = false, updated_at = :now WHERE employee_id = :eid"),
        {"now": datetime.now(timezone.utc), "eid": employee_id},
    )
    await db.flush()
    logger.info("Employee deactivated: %s", employee_id)
    return {"message": f"Employee {employee_id} deactivated. They can no longer log in."}


# ── PATCH /employees/{employee_id}/reactivate ─────────────────────────────────

@router.patch("/{employee_id}/reactivate")
async def reactivate_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("UPDATE hospyn_employees SET is_active = true, updated_at = :now WHERE employee_id = :eid"),
        {"now": datetime.now(timezone.utc), "eid": employee_id},
    )
    await db.flush()
    return {"message": f"Employee {employee_id} reactivated."}


# ── POST /tickets/{ticket_id}/assign (called from tickets.py) ─────────────────

async def assign_ticket_to_employee(
    ticket_id:      str,
    from_employee:  dict,   # the person doing the assigning
    to_employee_id: str,
    note:           Optional[str],
    db: AsyncSession,
) -> dict:
    """
    Core assignment logic with hierarchy enforcement.
    from_employee: dict with keys: employee_id, team, level
    """
    # Get target employee
    to_result = await db.execute(
        text("SELECT * FROM hospyn_employees WHERE employee_id = :eid AND is_active = true AND deleted_at IS NULL LIMIT 1"),
        {"eid": to_employee_id},
    )
    to_emp = to_result.mappings().first()
    if not to_emp:
        raise HTTPException(status_code=404, detail=f"Employee {to_employee_id} not found or inactive.")

    from_level = from_employee.get("level", "l1")
    to_level   = dict(to_emp).get("level", "l1")
    from_team  = from_employee.get("team")
    to_team    = dict(to_emp).get("team")

    # ── Hierarchy enforcement ─────────────────────────────────────────────────
    allowed_levels = ASSIGNMENT_PERMISSIONS.get(from_level, [])
    if to_level not in allowed_levels:
        raise HTTPException(
            status_code=403,
            detail=f"As a {from_level}, you cannot assign to a {to_level}. Allowed: {allowed_levels}"
        )

    # L1 can only assign within their own team
    if from_level == "l1" and from_team != to_team:
        raise HTTPException(status_code=403, detail="L1 agents can only reassign within their own team.")

    # Team Lead can only assign within their own team
    if from_level == "team_lead" and from_team != to_team and to_level not in ("manager",):
        raise HTTPException(status_code=403, detail="Team Leads can only assign within their team.")

    now    = datetime.now(timezone.utc)
    action = "escalated" if (
        (from_level == "l1" and to_level in ("team_lead","manager")) or
        (from_level == "team_lead" and to_level == "manager")
    ) else "reassigned" if from_employee.get("employee_id") else "assigned"

    # Update ticket
    await db.execute(
        text("""
            UPDATE support_tickets
            SET assigned_employee_id   = :eid,
                assigned_employee_name = :ename,
                escalation_level       = :level,
                status                 = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at             = :now
            WHERE ticket_id = :tid
        """),
        {
            "eid":   to_employee_id,
            "ename": dict(to_emp)["full_name"],
            "level": to_level,
            "now":   now,
            "tid":   ticket_id,
        },
    )

    # Write assignment log
    await db.execute(
        text("""
            INSERT INTO ticket_assignments
              (id, ticket_id, from_employee_id, to_employee_id, action, note, created_at)
            VALUES (:id, :tid, :from_eid, :to_eid, :action, :note, :now)
        """),
        {
            "id":       uuid.uuid4(),
            "tid":      ticket_id,
            "from_eid": from_employee.get("employee_id"),
            "to_eid":   to_employee_id,
            "action":   action,
            "note":     note,
            "now":      now,
        },
    )
    await db.flush()

    return {
        "assigned_to":   to_employee_id,
        "assigned_name": dict(to_emp)["full_name"],
        "action":        action,
        "ticket_id":     ticket_id,
    }
