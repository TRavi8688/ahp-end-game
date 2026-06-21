"""
backend/auth-service/app/api/internal.py

EXECUTION: this file did not exist. Closes a real gap found while wiring the
partner-app registration flow: healthcare-core's POST /onboarding/register-enterprise
created a Hospital row but never created a matching login account (owner_user_id
was a throwaway uuid.uuid4() that was never replaced — see onboarding.py).
Approving a hospital only flipped its status; it never granted anyone the
ability to log in.

Per your instruction: account is created immediately at registration
(is_active=False, "pending"), and unblocked only once the hospital is
approved. Login already rejects inactive users (see api/v1/auth.py line ~83,
`if not user.is_active`) — that check already existed, it just had nothing
gating it until now.

Internal-only: requires a signed service-to-service JWT (see
shared/utils/service_auth.py), same pattern as healthcare-core's own
app/api/internal.py. NOT exposed via nginx.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User, RoleEnum
from app.services.auth_service import get_password_hash
from shared.utils.service_auth import verify_internal_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal", tags=["Internal Service-to-Service"])

ALLOWED_CALLERS = {"healthcare-core"}


def _check_caller(internal_token_payload: dict):
    calling_service = internal_token_payload.get("iss", "unknown")
    if calling_service not in ALLOWED_CALLERS:
        logger.warning("internal_access_denied: service=%s", calling_service)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Service '{calling_service}' is not authorized for internal access",
        )
    return calling_service


class CreatePartnerUserRequest(BaseModel):
    email: EmailStr
    password: str
    hospital_id: str
    role: str = "owner"
    full_name: str | None = None


@router.post("/create-partner-user", status_code=status.HTTP_201_CREATED)
async def create_partner_user(
    payload: CreatePartnerUserRequest,
    internal_token_payload: dict = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by healthcare-core's register-enterprise flow right after the
    Hospital row is created. The account exists immediately but is_active is
    False, so login is blocked (see auth.py) until admin-approve-hospital
    calls POST /internal/activate-user/{user_id} below.
    """
    _check_caller(internal_token_payload)

    try:
        role = RoleEnum(payload.role)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {payload.role}")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    try:
        hospital_uuid = uuid.UUID(payload.hospital_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="hospital_id must be a UUID.")

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        hospital_id=hospital_uuid,
        full_name=payload.full_name,
        is_active=False,  # blocked from logging in until the hospital is approved
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("partner_user_created_pending: user_id=%s hospital_id=%s", user.id, payload.hospital_id)

    return {"user_id": str(user.id), "is_active": user.is_active}


@router.post("/activate-user/{user_id}")
async def activate_user(
    user_id: str,
    internal_token_payload: dict = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db),
):
    """Called by healthcare-core's admin-approve-hospital once a hospital passes review."""
    _check_caller(internal_token_payload)

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a UUID.")

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = True
    await db.flush()

    logger.info("partner_user_activated: user_id=%s", user_id)
    return {"user_id": str(user.id), "is_active": True}
