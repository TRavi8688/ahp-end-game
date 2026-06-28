"""
backend/healthcare-core/app/api/v1/prescriptions.py

EXECUTION FIX: this file did not exist. app/api/router.py already imported
`from app.api.v1.prescriptions import router as prescriptions_router`, which
broke the backend's boot before any request could be served.

Endpoints:
  POST /prescriptions/                 - doctor creates a prescription (+ items)
  GET  /prescriptions/{id}             - fetch one (doctor, patient, pharmacist)
  GET  /prescriptions/                 - list, filterable by patient_id/status
  POST /prescriptions/{id}/share       - patient shares an Rx with a pharmacy
                                          via QR scan (feeds /pharmacy/network-orders)
"""

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.prescription import Prescription, PrescriptionItem
from app.models.pharmacy import PrescriptionShare
from app.models.hospital import Hospital

router = APIRouter()


class PrescriptionItemIn(BaseModel):
    drug_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None


class PrescriptionCreate(BaseModel):
    patient_id: str
    walkin_request_id: Optional[str] = None
    items: List[PrescriptionItemIn]


def _item_to_dict(item: PrescriptionItem) -> dict:
    return {
        "id": str(item.id),
        "drug_name": item.drug_name,
        "dosage": item.dosage,
        "frequency": item.frequency,
        "duration": item.duration,
        "instructions": item.instructions,
    }


def _prescription_to_dict(rx: Prescription) -> dict:
    return {
        "id": str(rx.id),
        "patient_id": str(rx.patient_id),
        "doctor_id": str(rx.doctor_id),
        "status": rx.status,
        "created_at": rx.created_at.isoformat() if rx.created_at else None,
        "items": [_item_to_dict(i) for i in (rx.items or [])],
        "medications": [_item_to_dict(i) for i in (rx.items or [])],  # alias used by some clients
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_prescription(
    payload: PrescriptionCreate,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    try:
        patient_uuid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient_id.")

    if not payload.items:
        raise HTTPException(status_code=400, detail="A prescription needs at least one item.")

    rx = Prescription(
        id=uuid.uuid4(),
        patient_id=patient_uuid,
        doctor_id=uuid.UUID(current_user.sub),
        walkin_request_id=(
            uuid.UUID(payload.walkin_request_id) if payload.walkin_request_id else None
        ),
        status="pending",
    )
    db.add(rx)
    await db.flush()

    for item in payload.items:
        db.add(PrescriptionItem(
            id=uuid.uuid4(),
            prescription_id=rx.id,
            drug_name=item.drug_name,
            dosage=item.dosage,
            frequency=item.frequency,
            duration=item.duration,
            instructions=item.instructions,
        ))

    await db.flush()
    result = await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.id == rx.id)
    )
    return _prescription_to_dict(result.scalars().first())


@router.get("/{prescription_id}")
async def get_prescription(
    prescription_id: str,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("doctor", "admin", "patient", "pharmacist", "hospital_admin")),
    ],
    db: AsyncSession = Depends(get_db),
):
    try:
        rx_uuid = uuid.UUID(prescription_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid prescription id.")

    result = await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.id == rx_uuid)
    )
    rx = result.scalars().first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return _prescription_to_dict(rx)


@router.get("/")
async def list_prescriptions(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("doctor", "admin", "patient", "pharmacist", "hospital_admin")),
    ],
    db: AsyncSession = Depends(get_db),
    patient_id: Optional[str] = Query(None),
    rx_status: Optional[str] = Query(None, alias="status"),
):
    query = select(Prescription).options(selectinload(Prescription.items))

    if patient_id:
        try:
            query = query.where(Prescription.patient_id == uuid.UUID(patient_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid patient_id.")
    elif current_user.role == "doctor":
        query = query.where(Prescription.doctor_id == uuid.UUID(current_user.sub))

    if rx_status:
        query = query.where(Prescription.status == rx_status)

    query = query.order_by(Prescription.created_at.desc()).limit(200)
    result = await db.execute(query)
    return [_prescription_to_dict(rx) for rx in result.scalars().all()]


class ShareRequest(BaseModel):
    pharmacy_hospital_id: str


@router.post("/{prescription_id}/share", status_code=status.HTTP_201_CREATED)
async def share_prescription_with_pharmacy(
    prescription_id: str,
    payload: ShareRequest,
    current_user: Annotated[TokenPayload, Depends(require_role("patient", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Called when a patient scans a pharmacy's QR code (the QR encodes the
    pharmacy's hospital_id -- see Dashboard.jsx's "Universal Receiving QR").
    Creates the PrescriptionShare row that /pharmacy/network-orders reads.
    """
    try:
        rx_uuid = uuid.UUID(prescription_id)
        pharmacy_uuid = uuid.UUID(payload.pharmacy_hospital_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id.")

    rx_result = await db.execute(select(Prescription).where(Prescription.id == rx_uuid))
    rx = rx_result.scalars().first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found.")

    pharmacy_result = await db.execute(select(Hospital).where(Hospital.id == pharmacy_uuid))
    if not pharmacy_result.scalars().first():
        raise HTTPException(status_code=404, detail="Pharmacy not found.")

    share = PrescriptionShare(
        id=uuid.uuid4(),
        prescription_id=rx_uuid,
        pharmacy_hospital_id=pharmacy_uuid,
        status="pending",
    )
    db.add(share)
    await db.flush()

    return {"id": str(share.id), "status": share.status, "shared_at": share.shared_at}
