from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Any
import uuid
from datetime import datetime, timezone

import app.api.deps as deps
from app.models.models import (
    PartnerLabRequest, PartnerPharmacyRequest, PartnerReferralStatusEnum, 
    Hospital, LabDiagnosticOrder, DigitalPrescription, PatientVisit
)
from app.schemas.lab import PartnerLabRequestCreate, PartnerLabRequestResponse
from app.schemas.pharmacy import PartnerPharmacyRequestCreate, PartnerPharmacyRequestResponse

router = APIRouter()

# --- Patient Facing Endpoints ---

@router.get("/patients/latest-lab-order")
async def get_latest_lab_order(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(LabDiagnosticOrder).where(
        LabDiagnosticOrder.patient_id == current_patient.id,
        LabDiagnosticOrder.status == "pending"
    ).order_by(LabDiagnosticOrder.created_at.desc()).limit(1)
    
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="No active lab orders found.")
    return {"id": order.id, "created_at": order.created_at, "status": order.status}

@router.get("/patients/latest-prescription")
async def get_latest_prescription(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(DigitalPrescription).where(
        DigitalPrescription.patient_id == current_patient.id,
        DigitalPrescription.status == "active"
    ).order_by(DigitalPrescription.created_at.desc()).limit(1)
    
    prescription = (await db.execute(stmt)).scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="No active prescriptions found.")
    return {"id": prescription.id, "created_at": prescription.created_at, "status": prescription.status}

@router.post("/labs/request", response_model=PartnerLabRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_partner_lab_request(
    request_in: PartnerLabRequestCreate,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Patient submits a lab diagnostic order to an external partner lab.
    """
    # Verify order belongs to patient
    stmt = select(LabDiagnosticOrder).where(
        LabDiagnosticOrder.id == request_in.order_id,
        LabDiagnosticOrder.patient_id == current_patient.id
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found in your vault.")

    # Prevent duplicate submission to another partner if already accepted/fulfilled
    stmt_existing = select(PartnerLabRequest).where(
        PartnerLabRequest.order_id == request_in.order_id,
        PartnerLabRequest.status.in_([PartnerReferralStatusEnum.accepted, PartnerReferralStatusEnum.fulfilled])
    )
    existing_req = (await db.execute(stmt_existing)).scalars().first()
    if existing_req:
        raise HTTPException(
            status_code=400, 
            detail="This lab order is already being processed by another diagnostic center."
        )

    # Verify partner hospital exists and is a lab
    stmt_partner = select(Hospital).where(Hospital.id == request_in.partner_hospital_id)
    partner = (await db.execute(stmt_partner)).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner diagnostic center not found.")

    new_req = PartnerLabRequest(
        order_id=order.id,
        referring_hospital_id=order.hospital_id,
        partner_hospital_id=partner.id,
        patient_id=current_patient.id,
        status=PartnerReferralStatusEnum.pending
    )
    db.add(new_req)
    await db.commit()
    
    # Reload with eagerly loaded order relationship for schema serialization
    stmt_reload = select(PartnerLabRequest).options(selectinload(PartnerLabRequest.order)).where(
        PartnerLabRequest.id == new_req.id
    )
    new_req = (await db.execute(stmt_reload)).scalar_one()
    
    # In production, trigger WebSockets to notify partner ERP
    return new_req


@router.post("/pharmacies/request", response_model=PartnerPharmacyRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_partner_pharmacy_request(
    request_in: PartnerPharmacyRequestCreate,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Patient submits a digital prescription to an external partner pharmacy.
    """
    stmt = select(DigitalPrescription).where(
        DigitalPrescription.id == request_in.prescription_id,
        DigitalPrescription.patient_id == current_patient.id
    )
    prescription = (await db.execute(stmt)).scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found in your vault.")

    stmt_existing = select(PartnerPharmacyRequest).where(
        PartnerPharmacyRequest.prescription_id == request_in.prescription_id,
        PartnerPharmacyRequest.status.in_([PartnerReferralStatusEnum.accepted, PartnerReferralStatusEnum.fulfilled])
    )
    existing_req = (await db.execute(stmt_existing)).scalars().first()
    if existing_req:
        raise HTTPException(
            status_code=400, 
            detail="This prescription is already being prepared by another pharmacy."
        )

    stmt_partner = select(Hospital).where(Hospital.id == request_in.partner_pharmacy_id)
    partner = (await db.execute(stmt_partner)).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner pharmacy not found.")

    new_req = PartnerPharmacyRequest(
        prescription_id=prescription.id,
        referring_hospital_id=prescription.hospital_id,
        partner_pharmacy_id=partner.id,
        patient_id=current_patient.id,
        status=PartnerReferralStatusEnum.pending
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)
    
    return new_req


# --- Partner/Hospital Facing Endpoints ---

@router.get("/labs/incoming", response_model=List[PartnerLabRequestResponse])
async def get_incoming_lab_requests(
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    Partner Lab Staff retrieves incoming referral requests sent to their specific location.
    """
    stmt = select(PartnerLabRequest).options(selectinload(PartnerLabRequest.order)).where(
        PartnerLabRequest.partner_hospital_id == hospital_id
    ).order_by(PartnerLabRequest.created_at.desc())
    
    requests = (await db.execute(stmt)).scalars().all()
    return requests

@router.get("/pharmacies/incoming", response_model=List[PartnerPharmacyRequestResponse])
async def get_incoming_pharmacy_requests(
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    Partner Pharmacy Staff retrieves incoming prescription requests sent to their location.
    """
    stmt = select(PartnerPharmacyRequest).where(
        PartnerPharmacyRequest.partner_pharmacy_id == hospital_id
    ).order_by(PartnerPharmacyRequest.created_at.desc())
    
    requests = (await db.execute(stmt)).scalars().all()
    return requests

@router.post("/labs/{request_id}/action", response_model=PartnerLabRequestResponse)
async def action_lab_request(
    request_id: uuid.UUID,
    action: str, # "accept" or "reject"
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    Partner Lab accepts or rejects an incoming lab referral.
    """
    stmt = select(PartnerLabRequest).options(selectinload(PartnerLabRequest.order)).where(
        PartnerLabRequest.id == request_id,
        PartnerLabRequest.partner_hospital_id == hospital_id
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if action == "accept":
        req.status = PartnerReferralStatusEnum.accepted
        # Automatically spawn a patient visit at the partner lab
        new_visit = PatientVisit(
            hospital_id=hospital_id,
            patient_id=req.patient_id,
            visit_reason="External Lab Referral Fulfillment",
            department="Pathology",
            check_in_time=datetime.now(timezone.utc),
            status="active"
        )
        db.add(new_visit)
    elif action == "reject":
        req.status = PartnerReferralStatusEnum.rejected
    else:
        raise HTTPException(status_code=400, detail="Invalid action.")
        
    await db.commit()
    await db.refresh(req)
    return req

@router.post("/pharmacies/{request_id}/action", response_model=PartnerPharmacyRequestResponse)
async def action_pharmacy_request(
    request_id: uuid.UUID,
    action: str, # "accept" or "reject"
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    Partner Pharmacy accepts or rejects an incoming prescription referral.
    """
    stmt = select(PartnerPharmacyRequest).where(
        PartnerPharmacyRequest.id == request_id,
        PartnerPharmacyRequest.partner_pharmacy_id == hospital_id
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if action == "accept":
        req.status = PartnerReferralStatusEnum.accepted
    elif action == "reject":
        req.status = PartnerReferralStatusEnum.rejected
    else:
        raise HTTPException(status_code=400, detail="Invalid action.")
        
    await db.commit()
    await db.refresh(req)
    return req
