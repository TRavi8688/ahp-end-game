"""
backend/healthcare-core/app/api/v1/onboarding_simple.py

Simplified hospital registration — NO documents, NO payment.
Used by the rebuilt ActivationWizard (Hospin rebrand, payment removed).

Flow:
  POST /onboarding/register-enterprise-simple   — Step 1 (create OR update pending hospital)
  (reuses existing /onboarding/send-government-pan-otp/{id})
  (reuses existing /onboarding/verify-government-pan-otp/{id})

After OTP verification, hospital status = pending_verification.
Owner does NOT get dashboard access until super admin approves in SovereignConsole.

IMPORTANT: This does NOT touch or remove the existing payment endpoints in
onboarding.py (/generate-razorpay-qr, /submit-upi-vpa, /submit-card-payment,
/verify-card-otp). Those remain in the codebase, untouched, simply unused by
the frontend. If payment is reintroduced later, those endpoints are still there.

Register in router.py:
  from app.api.v1.onboarding_simple import router as onboarding_simple_router
  api_router.include_router(onboarding_simple_router, prefix="/onboarding", tags=["Onboarding Simple"])
"""

from __future__ import annotations

import logging
import random
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.hospital import Hospital, HospitalStatus
from app.api.v1.onboarding import _call_auth_internal

logger = logging.getLogger(__name__)
router = APIRouter()

MOCK_PAN = "ABCDE1234F"  # placeholder PAN since documents/PAN capture removed from this flow


class RegisterSimpleBody(BaseModel):
    hospital_id:          Optional[str] = None   # if provided, UPDATE this pending hospital instead of creating new
    name:                 str
    registration_number:  str
    owner_email:          str
    owner_password:       str
    phone_number:         str
    physical_address:     str
    staff_count:          str = "1"
    latitude:              Optional[str] = None
    longitude:             Optional[str] = None
    branches:             Optional[str] = None
    branch_locations:     Optional[str] = None


def _hospyn_id(name: str) -> str:
    prefix = "".join(c.upper() for c in name if c.isalpha())[:4].ljust(4, "H")
    return f"HOSP-{prefix}-{random.randint(1000, 9999)}"


@router.post("/register-enterprise-simple", status_code=201)
async def register_enterprise_simple(
    body: RegisterSimpleBody,
    db: AsyncSession = Depends(get_db),
):
    """
    Registers (or updates) a hospital with NO document upload and NO payment.

    Re-edit support: if body.hospital_id is provided AND that hospital is
    still in 'pending_verification' status, this UPDATES the existing row
    instead of creating a duplicate or throwing 409. This lets the user
    click "Back" on the OTP step, fix a typo, and resubmit cleanly.
    """
    parts    = [p.strip() for p in body.physical_address.split(",")]
    city     = parts[-3] if len(parts) >= 3 else (parts[0] if parts else "Unknown")
    state    = parts[-2] if len(parts) >= 2 else "Unknown"
    pin_code = parts[-1] if parts else "000000"

    # ── Re-edit path: update existing pending hospital ─────────────────────────
    if body.hospital_id:
        try:
            existing_uid = uuid.UUID(body.hospital_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid hospital_id.")

        result = await db.execute(select(Hospital).where(Hospital.id == existing_uid))
        existing = result.scalars().first()

        if existing and existing.status == HospitalStatus.pending_verification:
            existing.name                 = body.name
            existing.registration_number  = body.registration_number
            existing.email                = body.owner_email
            existing.phone                = body.phone_number
            existing.address_line1        = body.physical_address
            existing.city                 = city
            existing.state                = state
            existing.pin_code             = pin_code
            db.add(existing)
            await db.flush()
            await db.refresh(existing)

            logger.info("Hospital registration updated (re-edit): %s", existing.id)
            return {
                "hospital_id":  str(existing.id),
                "status":       existing.status,
                "message":      "Registration updated. Proceed to phone verification.",
            }
        # If hospital_id given but not found / not pending, fall through to create new

    # ── Duplicate registration_number check (only for brand new submissions) ──
    dup = await db.execute(
        text("""
            SELECT id FROM hospitals
            WHERE registration_number = :rn
              AND status != 'rejected'
            LIMIT 1
        """),
        {"rn": body.registration_number},
    )
    if dup.first():
        raise HTTPException(
            status_code=409,
            detail="A hospital with this registration number already exists.",
        )

    hospital_id = uuid.uuid4()
    hospyn_id   = _hospyn_id(body.name)

    # Create the owner user in auth-service
    auth_result = await _call_auth_internal(
        "/internal/create-partner-user",
        {
            "email": body.owner_email,
            "password": body.owner_password,
            "hospital_id": str(hospital_id),
            "role": "owner",
            "full_name": body.name,
        },
    )
    owner_user_id = uuid.UUID(auth_result["user_id"])

    hospital = Hospital(
        id=hospital_id,
        name=body.name,
        registration_number=body.registration_number,
        email=body.owner_email,
        phone=body.phone_number,
        address_line1=body.physical_address,
        city=city,
        state=state,
        country="India",
        pin_code=pin_code,
        status=HospitalStatus.pending_verification,
        owner_user_id=owner_user_id,
    )
    db.add(hospital)
    await db.flush()
    await db.refresh(hospital)

    logger.info(
        "Hospital registered (simple, no docs/payment): %s (%s)",
        hospital_id, body.name,
    )

    return {
        "hospital_id":  str(hospital.id),
        "hospyn_id":    hospyn_id,
        "status":       hospital.status,
        "message":      "Hospital registered. Proceed to phone verification.",
    }
