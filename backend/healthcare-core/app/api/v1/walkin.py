"""
Walk-In API Routes (Patient-Facing)

Endpoints:
    POST /walkin/join/{signed_token}    - Patient submits intake via QR scan
    GET  /walkin/qr/{hospital_id}       - Generate QR token (hospital admin only)
    GET  /walkin/status/{request_id}    - Patient checks their queue position
"""

import uuid
from typing import Annotated, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.walkin import (
    WalkInRequest,
    QueueState,
    PriorityLevel,
    WalkInSource,
    ACTIVE_QUEUE_STATES,
)
from app.models.hospital import Hospital
from app.services.queue_service import (
    validate_walkin_token,
    generate_walkin_token,
    check_duplicate_walkin,
    generate_queue_number,
)
from shared.utils.responses import success_response
from shared.audit import log_audit_event

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class WalkInIntakeForm(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=30)
    age: int = Field(..., ge=0, le=150)
    gender: str = Field(..., min_length=1, max_length=20)
    reason_for_visit: str = Field(..., min_length=1, max_length=2000)
    symptoms: Optional[str] = Field(None, max_length=2000)
    is_emergency: bool = False


class WalkInStatusResponse(BaseModel):
    request_id: str
    queue_number: int
    queue_state: str
    estimated_wait_minutes: int
    position_in_queue: int


# ---------------------------------------------------------------------------
# Patient Walk-In Submission
# ---------------------------------------------------------------------------


@router.post("/join/{signed_token}", status_code=status.HTTP_201_CREATED)
async def submit_walkin(
    signed_token: str,
    form: WalkInIntakeForm,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint. Patient scans QR code and submits intake form.
    Creates a WalkInRequest with status WAITING_RECEPTION.
    """
    # 1. Validate the signed QR token
    hospital_id_str = validate_walkin_token(signed_token)
    if not hospital_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired QR code. Please scan a valid hospital QR code.",
        )

    hospital_id = uuid.UUID(hospital_id_str)

    # 2. Verify hospital exists and is active
    hospital_result = await db.execute(
        select(Hospital).where(
            Hospital.id == hospital_id,
            Hospital.is_active == True,
            Hospital.deleted_at.is_(None),
        )
    )
    hospital = hospital_result.scalars().first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found or inactive.",
        )

    # 3. Duplicate prevention — same phone + same hospital + active queue
    is_duplicate = await check_duplicate_walkin(db, form.phone, hospital_id)
    if is_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active walk-in request at this hospital. Please wait for your turn.",
        )

    # 4. Generate queue number
    queue_number = await generate_queue_number(db, hospital_id)

    # 5. Create the WalkInRequest
    priority = PriorityLevel.emergency if form.is_emergency else PriorityLevel.normal

    walkin = WalkInRequest(
        hospital_id=hospital_id,
        first_name=form.first_name.strip(),
        last_name=form.last_name.strip(),
        phone=form.phone.strip(),
        age=form.age,
        gender=form.gender.strip(),
        reason_for_visit=form.reason_for_visit.strip(),
        symptoms=form.symptoms.strip() if form.symptoms else None,
        queue_state=QueueState.waiting_reception,
        priority_level=priority,
        source=WalkInSource.qr_walkin,
        queue_number=queue_number,
    )
    db.add(walkin)
    await db.flush()  # Get the ID before commit

    # 6. Audit
    log_audit_event(
        action="walkin_request_created",
        actor_id=form.phone,  # No user_id for anonymous walk-ins
        target_id=str(walkin.id),
        details={
            "hospital_id": str(hospital_id),
            "hospital_name": hospital.name,
            "source": "qr_walkin",
            "queue_number": queue_number,
            "is_emergency": form.is_emergency,
        },
        ip_address=request.client.host if request.client else None,
    )

    # 7. Calculate estimated wait
    waiting_count = await _count_ahead_in_queue(db, hospital_id, walkin.created_at)
    estimated_wait = waiting_count * 8  # ~8 min per patient rough estimate

    return success_response(
        data={
            "request_id": str(walkin.id),
            "queue_number": queue_number,
            "queue_state": walkin.queue_state.value,
            "hospital_name": hospital.name,
            "estimated_wait_minutes": estimated_wait,
            "position_in_queue": waiting_count + 1,
            "message": "You are checked in! Please wait for the receptionist to call your name.",
        },
        message="Walk-in request submitted successfully.",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# Queue Position Check (Patient)
# ---------------------------------------------------------------------------


@router.get("/status/{request_id}")
async def check_walkin_status(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint. Patient checks their queue position.
    """
    result = await db.execute(
        select(WalkInRequest).where(
            WalkInRequest.id == request_id,
            WalkInRequest.deleted_at.is_(None),
        )
    )
    walkin = result.scalars().first()
    if not walkin:
        raise HTTPException(status_code=404, detail="Walk-in request not found.")

    position = await _count_ahead_in_queue(db, walkin.hospital_id, walkin.created_at)

    return success_response(
        data={
            "request_id": str(walkin.id),
            "queue_number": walkin.queue_number,
            "queue_state": walkin.queue_state.value,
            "estimated_wait_minutes": position * 8,
            "position_in_queue": position + 1,
        }
    )


# ---------------------------------------------------------------------------
# QR Token Generation (Hospital Admin)
# ---------------------------------------------------------------------------


@router.get("/qr-token")
async def get_qr_token(
    current_user: Annotated[
        TokenPayload, Depends(require_role("hospital_admin", "admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Hospital admin generates a signed QR token for their hospital.
    This token is embedded in the physical QR code displayed at the hospital.
    """
    # Find the hospital owned by this admin
    result = await db.execute(
        select(Hospital).where(
            Hospital.owner_user_id == uuid.UUID(current_user.sub),
            Hospital.is_active == True,
            Hospital.deleted_at.is_(None),
        )
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="No hospital found for this admin.")

    token = generate_walkin_token(str(hospital.id))

    log_audit_event(
        action="qr_token_generated",
        actor_id=current_user.sub,
        target_id=str(hospital.id),
    )

    return success_response(
        data={
            "signed_token": token,
            "hospital_id": str(hospital.id),
            "hospital_name": hospital.name,
            "walkin_url": f"https://walkin.hospyn.com/join/{token}",
        }
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _count_ahead_in_queue(
    db: AsyncSession, hospital_id: uuid.UUID, created_at: datetime
) -> int:
    """Count how many active walk-ins are ahead of this one in the queue."""
    active_states = [s.value for s in ACTIVE_QUEUE_STATES]
    result = await db.execute(
        select(func.count(WalkInRequest.id)).where(
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.queue_state.in_(active_states),
            WalkInRequest.created_at < created_at,
            WalkInRequest.deleted_at.is_(None),
        )
    )
    return result.scalar() or 0
