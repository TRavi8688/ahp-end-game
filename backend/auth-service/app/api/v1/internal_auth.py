"""
backend/auth-service/app/api/v1/internal_auth.py

Hospyn Internal Employee Authentication -- separate from hospital owner auth.

Endpoints:
  POST /auth/internal/login        -- employee logs in with email + password
  GET  /auth/internal/me           -- get own profile from JWT
  POST /auth/internal/change-password

JWT payload includes:
  { sub, employee_id, team, level, full_name, email }

Register in auth-service main.py:
  from app.api.v1.internal_auth import router as internal_auth_router
  application.include_router(internal_auth_router, prefix="/api/v1/auth", tags=["Internal Auth"])
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger  = logging.getLogger(__name__)
router  = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

INTERNAL_JWT_SECRET  = os.getenv("HOSPYN_INTERNAL_JWT_SECRET", os.getenv("JWT_SECRET_KEY", "change_me"))
INTERNAL_JWT_ALGO    = "HS256"
INTERNAL_JWT_EXPIRES = 60 * 60 * 10   # 10 hours


def _create_internal_token(employee: dict) -> str:
    import jwt
    payload = {
        "sub":         str(employee["id"]),
        "employee_id": employee["employee_id"],
        "team":        employee["team"],
        "level":       employee["level"],
        "full_name":   employee["full_name"],
        "email":       employee["email"],
        "exp":         datetime.now(timezone.utc) + timedelta(seconds=INTERNAL_JWT_EXPIRES),
        "iat":         datetime.now(timezone.utc),
        "type":        "internal",
    }
    return jwt.encode(payload, INTERNAL_JWT_SECRET, algorithm=INTERNAL_JWT_ALGO)


def _decode_internal_token(token: str) -> dict:
    import jwt
    try:
        return jwt.decode(token, INTERNAL_JWT_SECRET, algorithms=[INTERNAL_JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired internal token.")


class LoginBody(BaseModel):
    email:    str
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8)


# -- POST /auth/internal/login -------------------------------------------------

@router.post("/internal/login")
async def internal_login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    """Hospyn employee login. Uses hospyn_employees table, not hospital users."""
    result = await db.execute(
        text("""
            SELECT id, employee_id, full_name, email, hashed_password,
                   team, level, is_active, avatar_initials, phone
            FROM hospyn_employees
            WHERE email = :email AND deleted_at IS NULL
            LIMIT 1
        """),
        {"email": body.email.strip().lower()},
    )
    row = result.mappings().first()

    if not row or not pwd_ctx.verify(body.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    emp = dict(row)

    if not emp["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Contact your manager or super admin.",
        )

    token = _create_internal_token(emp)

    logger.info("Internal login: %s (%s / %s)", emp["employee_id"], emp["team"], emp["level"])

    return {
        "access_token": token,
        "token_type":   "bearer",
        "employee": {
            "employee_id":    emp["employee_id"],
            "full_name":      emp["full_name"],
            "email":          emp["email"],
            "team":           emp["team"],
            "level":          emp["level"],
            "avatar_initials": emp["avatar_initials"],
            "phone":          emp["phone"],
        },
    }


# -- GET /auth/internal/me -----------------------------------------------------

@router.get("/internal/me")
async def internal_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Return employee profile from JWT."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    payload    = _decode_internal_token(auth[7:])
    employee_id = payload.get("employee_id")

    result = await db.execute(
        text("""
            SELECT id, employee_id, full_name, email, team, level,
                   is_active, avatar_initials, phone, created_at
            FROM hospyn_employees
            WHERE employee_id = :eid AND deleted_at IS NULL LIMIT 1
        """),
        {"eid": employee_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found.")

    emp = dict(row)

    # Append workload stats
    open_res = await db.execute(
        text("SELECT COUNT(*) FROM support_tickets WHERE assigned_employee_id = :eid AND status NOT IN ('resolved','closed')"),
        {"eid": employee_id},
    )
    emp["open_tickets"] = open_res.scalar() or 0

    resolved_res = await db.execute(
        text("SELECT COUNT(*) FROM support_tickets WHERE assigned_employee_id = :eid AND status IN ('resolved','closed')"),
        {"eid": employee_id},
    )
    emp["resolved_tickets"] = resolved_res.scalar() or 0

    return emp


# -- POST /auth/internal/change-password ---------------------------------------

@router.post("/internal/change-password")
async def change_password(
    body:    ChangePasswordBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    payload     = _decode_internal_token(auth[7:])
    employee_id = payload.get("employee_id")

    result = await db.execute(
        text("SELECT hashed_password FROM hospyn_employees WHERE employee_id = :eid LIMIT 1"),
        {"eid": employee_id},
    )
    row = result.mappings().first()
    if not row or not pwd_ctx.verify(body.current_password, row["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_hash = pwd_ctx.hash(body.new_password)
    await db.execute(
        text("UPDATE hospyn_employees SET hashed_password = :pwd, updated_at = :now WHERE employee_id = :eid"),
        {"pwd": new_hash, "now": datetime.now(timezone.utc), "eid": employee_id},
    )
    await db.flush()
    return {"message": "Password updated successfully."}
