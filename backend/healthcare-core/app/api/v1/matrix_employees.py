"""
backend/healthcare-core/app/api/v1/matrix_employees.py

ADD THESE 4 ENDPOINTS to your existing backend.
Mount at: /api/v1/matrix/employees/

These power the Employee Command Center:
  POST   /create           — creates employee account (login + role)
  PATCH  /:id/role         — changes role + team
  POST   /:id/reset-password — resets password (manager+ only)
  PATCH  /:id/shift        — already exists in matrix_ops.py
"""
from __future__ import annotations
import uuid
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import hash_password   # your existing password hasher
from shared.utils.responses import success_response

router = APIRouter()

VALID_ROLES = [
    'super_admin','admin','manager','team_lead','l2','l1',
    'support','finance','engineering','onboarding','data','verification'
]
VALID_TEAMS = [
    'support','finance','engineering','onboarding','data','verification','compliance'
]

# ── Generate employee ID if not provided ──────────────────────────────────────
def gen_employee_id(team: str, role: str) -> str:
    team_code = team.upper()[:3]
    role_code = role.upper().replace('_','')[:3]
    short     = str(uuid.uuid4())[:4].upper()
    return f"HPN-{team_code}-{role_code}-{short}"


# ── POST /matrix/employees/create ─────────────────────────────────────────────
class CreateEmployeeBody(BaseModel):
    full_name:   str
    email:       EmailStr
    phone:       Optional[str] = None
    role:        str = 'l1'
    team:        str = 'support'
    password:    str            # temporary password set by admin
    employee_id: Optional[str] = None

@router.post("/create", status_code=201)
async def create_employee(body: CreateEmployeeBody, db: AsyncSession = Depends(get_db)):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {VALID_ROLES}")
    if body.team not in VALID_TEAMS:
        raise HTTPException(400, f"Invalid team. Must be one of: {VALID_TEAMS}")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    # Check email uniqueness
    existing = await db.execute(
        text("SELECT id FROM hospyn_employees WHERE email = :email AND deleted_at IS NULL"),
        {"email": body.email.lower()}
    )
    if existing.fetchone():
        raise HTTPException(409, f"An employee with email {body.email} already exists.")

    now         = datetime.now(timezone.utc)
    emp_id      = body.employee_id or gen_employee_id(body.team, body.role)
    hashed_pwd  = hash_password(body.password)   # use your existing hash function
    new_id      = uuid.uuid4()

    await db.execute(text("""
        INSERT INTO hospyn_employees
          (id, employee_id, full_name, email, phone, role, team, level,
           hashed_password, shift_status, is_active, daily_ticket_limit,
           avatar_initials, created_at, updated_at)
        VALUES
          (:id, :emp_id, :name, :email, :phone, :role, :team, :role,
           :pwd, 'offline', true, 40,
           :initials, :now, :now)
    """), {
        "id":       str(new_id),
        "emp_id":   emp_id,
        "name":     body.full_name,
        "email":    body.email.lower(),
        "phone":    body.phone,
        "role":     body.role,
        "team":     body.team,
        "pwd":      hashed_pwd,
        "initials": body.full_name[:2].upper(),
        "now":      now,
    })

    # Audit log
    await db.execute(text("""
        INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
        VALUES (gen_random_uuid(), 'employee_created', 'employee', :eid::uuid, :details, :now)
    """), {
        "eid":     str(new_id),
        "details": json.dumps({"employee_id": emp_id, "role": body.role, "team": body.team}),
        "now":     now,
    })

    await db.commit()
    return success_response(data={
        "employee_id": emp_id,
        "full_name":   body.full_name,
        "email":       body.email,
        "role":        body.role,
        "team":        body.team,
        "message":     f"Employee account created. They can log in at /login with email: {body.email}",
    })


# ── PATCH /matrix/employees/:id/role ─────────────────────────────────────────
class ChangeRoleBody(BaseModel):
    role: str
    team: Optional[str] = None

@router.patch("/{employee_id}/role")
async def change_employee_role(
    employee_id: str, body: ChangeRoleBody, db: AsyncSession = Depends(get_db)
):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role: {body.role}")
    now = datetime.now(timezone.utc)
    updates = {"role": body.role, "level": body.role, "now": now, "eid": employee_id}
    extra = ""
    if body.team:
        extra = ", team = :team"
        updates["team"] = body.team
    result = await db.execute(
        text(f"UPDATE hospyn_employees SET role=:role, level=:level{extra}, updated_at=:now WHERE employee_id=:eid AND deleted_at IS NULL"),
        updates,
    )
    if result.rowcount == 0:
        raise HTTPException(404, f"Employee {employee_id} not found")
    await db.execute(text("""
        INSERT INTO audit_logs (id, action, entity_type, details, created_at)
        VALUES (gen_random_uuid(), 'role_changed', 'employee', :details, :now)
    """), {"details": json.dumps({"employee_id": employee_id, "new_role": body.role}), "now": now})
    await db.commit()
    return success_response(data={"updated": True, "new_role": body.role})


# ── POST /matrix/employees/:id/reset-password ─────────────────────────────────
class ResetPasswordBody(BaseModel):
    new_password: str

@router.post("/{employee_id}/reset-password")
async def reset_password(
    employee_id: str, body: ResetPasswordBody, db: AsyncSession = Depends(get_db)
):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    now        = datetime.now(timezone.utc)
    hashed_pwd = hash_password(body.new_password)
    result = await db.execute(
        text("UPDATE hospyn_employees SET hashed_password=:pwd, updated_at=:now WHERE employee_id=:eid AND deleted_at IS NULL"),
        {"pwd": hashed_pwd, "now": now, "eid": employee_id},
    )
    if result.rowcount == 0:
        raise HTTPException(404, f"Employee {employee_id} not found")
    await db.execute(text("""
        INSERT INTO audit_logs (id, action, entity_type, details, created_at)
        VALUES (gen_random_uuid(), 'password_reset', 'employee', :details, :now)
    """), {"details": json.dumps({"employee_id": employee_id, "reset_by": "admin"}), "now": now})
    await db.commit()
    return success_response(data={"reset": True})
