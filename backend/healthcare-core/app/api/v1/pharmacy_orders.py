"""
backend/healthcare-core/app/api/v1/pharmacy_orders.py

Backs the Orders tab pipeline (Screens 5-9):
  New Orders (pending) -> Accept/Reject -> Order Details (Reserve Stock,
  Ready) -> Accepted Orders (accepted/preparing/ready) -> Ready Orders
  (token + Delivered) -> Order History (Today/Week/Month + search).

GET  /pharmacy/orders                 - list, filterable by status/period/q
GET  /pharmacy/orders/{id}            - order detail (patient, image, items)
POST /pharmacy/orders/{id}/accept
POST /pharmacy/orders/{id}/reject
POST /pharmacy/orders/{id}/status     - move to preparing/ready/delivered
                                         (assigns a token_number on -> ready)
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.pharmacy import PrescriptionShare
from app.models.prescription import Prescription
from app.models.patient import Patient
from app.api.v1.pharmacy import _resolve_pharmacy_hospital_id, PHARMACY_ROLES

router = APIRouter()

VALID_STATUSES = {"pending", "accepted", "preparing", "ready", "delivered", "rejected"}
PERIOD_DAYS = {"today": 1, "week": 7, "month": 30}


async def _order_to_dict(db: AsyncSession, share: PrescriptionShare) -> dict:
    rx = share.prescription
    patient = None
    if rx:
        p = await db.execute(select(Patient).where(Patient.id == rx.patient_id))
        patient = p.scalars().first()
    return {
        "id": str(share.id),
        "status": share.status,
        "token_number": share.token_number,
        "shared_at": share.shared_at.isoformat() if share.shared_at else None,
        "updated_at": share.updated_at.isoformat() if share.updated_at else None,
        "patient_id": str(rx.patient_id) if rx else None,
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown Patient",
        "patient_phone": patient.phone if patient else "",
        "patient_code": (patient.hospyn_id or str(patient.id)[:8]) if patient else None,  # uses the real platform-wide ID
        "prescription_image_url": rx.image_url if rx else None,
        "medications": [
            {"name": item.drug_name, "dosage": item.dosage, "duration": item.duration, "frequency": item.frequency}
            for item in (rx.items or [])
        ] if rx else [],
    }


@router.get("/orders")
async def list_orders(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
    order_status: Optional[str] = Query(None, alias="status"),
    period: Optional[str] = Query(None, description="today | week | month"),
    q: Optional[str] = Query(None, description="search by patient name or phone"),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    query = select(PrescriptionShare).options(
        selectinload(PrescriptionShare.prescription).selectinload(Prescription.items)
    ).where(PrescriptionShare.pharmacy_hospital_id == hospital_id)

    if order_status:
        if order_status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_STATUSES)}")
        query = query.where(PrescriptionShare.status == order_status)

    if period:
        days = PERIOD_DAYS.get(period)
        if not days:
            raise HTTPException(status_code=400, detail="period must be today, week, or month")
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(PrescriptionShare.shared_at >= cutoff)

    query = query.order_by(PrescriptionShare.shared_at.desc()).limit(100)
    result = await db.execute(query)
    shares = result.scalars().all()

    orders = [await _order_to_dict(db, s) for s in shares]

    if q:
        q_lower = q.lower()
        orders = [o for o in orders if q_lower in (o["patient_name"] or "").lower() or q_lower in (o["patient_phone"] or "")]

    return orders


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    share = await _get_share_or_404(db, order_id, hospital_id)
    return await _order_to_dict(db, share)


async def _get_share_or_404(db: AsyncSession, order_id: str, hospital_id) -> PrescriptionShare:
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order id.")
    result = await db.execute(
        select(PrescriptionShare).options(
            selectinload(PrescriptionShare.prescription).selectinload(Prescription.items)
        ).where(PrescriptionShare.id == oid, PrescriptionShare.pharmacy_hospital_id == hospital_id)
    )
    share = result.scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="Order not found.")
    return share


@router.post("/orders/{order_id}/accept")
async def accept_order(
    order_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    share = await _get_share_or_404(db, order_id, hospital_id)
    if share.status != "pending":
        raise HTTPException(status_code=400, detail=f"Order is '{share.status}', not 'pending'.")
    share.status = "accepted"
    await db.flush()
    return await _order_to_dict(db, share)


@router.post("/orders/{order_id}/reject")
async def reject_order(
    order_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    share = await _get_share_or_404(db, order_id, hospital_id)
    if share.status in ("delivered", "rejected"):
        raise HTTPException(status_code=400, detail=f"Order already '{share.status}'.")
    share.status = "rejected"
    await db.flush()
    return await _order_to_dict(db, share)


class StatusUpdate(BaseModel):
    status: str  # preparing | ready | delivered


@router.post("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: StatusUpdate,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    share = await _get_share_or_404(db, order_id, hospital_id)

    allowed_transitions = {
        "accepted": {"preparing"},
        "preparing": {"ready"},
        "ready": {"delivered"},
    }
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    if payload.status not in allowed_transitions.get(share.status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from '{share.status}' to '{payload.status}'.",
        )

    share.status = payload.status

    if payload.status == "ready" and share.token_number is None:
        # Simple daily-reset counter: next number among today's ready orders at this pharmacy.
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count()).select_from(PrescriptionShare).where(
                and_(
                    PrescriptionShare.pharmacy_hospital_id == hospital_id,
                    PrescriptionShare.token_number.is_not(None),
                    PrescriptionShare.updated_at >= today_start,
                )
            )
        )
        share.token_number = (count_result.scalar_one() or 0) + 1

    await db.flush()
    return await _order_to_dict(db, share)
