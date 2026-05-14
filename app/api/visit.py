import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import app.api.deps as deps
from app.models import models
from app.schemas import schemas
from app.core.audit import log_audit_action
from app.core.logging import logger

router = APIRouter(prefix="/visit", tags=["Visit"])

@router.post("/scan", response_model=schemas.HospitalQRScan)
async def scan_hospital_qr(
    data: schemas.HospitalQRScan,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Validates a hospital QR code and returns hospital metadata.
    QR Data can be a Hospital UUID or a short code.
    """
    try:
        hospital_id = uuid.UUID(data.qr_data)
        stmt = select(models.Hospital).where(models.Hospital.id == hospital_id)
    except ValueError:
        # Try as short code
        stmt = select(models.Hospital).where(models.Hospital.short_code == data.qr_data.upper())

    result = await db.execute(stmt)
    hospital = result.scalar_one_or_none()

    if not hospital:
        raise HTTPException(status_code=404, detail="Invalid Hospital QR Code")

    return {
        "qr_data": str(hospital.id),
        "name": hospital.name,
        "hospyn_id": hospital.hospyn_id
    }

@router.post("/create", response_model=schemas.VisitResponse)
async def create_visit(
    data: schemas.VisitCreate,
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Initiates a new hospital visit for the patient.
    """
    # 1. Verify Hospital Exists
    h_stmt = select(models.Hospital).where(models.Hospital.id == data.hospital_id)
    h_res = await db.execute(h_stmt)
    hospital = h_res.scalar_one_or_none()
    
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    # 2. Create Visit Record
    new_visit = models.PatientVisit(
        patient_id=current_patient.id,
        hospital_id=data.hospital_id,
        visit_reason=data.visit_reason,
        symptoms=data.symptoms,
        department=data.department,
        doctor_name=data.doctor_name,
        status=models.VisitStatusEnum.active
    )
    db.add(new_visit)
    
    # 3. Create a Queue Entry (Optional but recommended for hospital flow)
    # This simulates checking into the hospital's digital queue
    queue_token = f"T-{uuid.uuid4().hex[:4].upper()}"
    new_visit.queue_token = queue_token
    
    await db.commit()
    await db.refresh(new_visit)

    await log_audit_action(
        db, 
        "HOSPITAL_VISIT_STARTED", 
        user_id=current_patient.user_id, 
        details={"hospital": hospital.name, "reason": data.visit_reason}
    )

    return {
        "id": new_visit.id,
        "hospital_name": hospital.name,
        "visit_reason": new_visit.visit_reason,
        "status": new_visit.status,
        "check_in_time": new_visit.check_in_time,
        "queue_token": new_visit.queue_token
    }

@router.get("/my-visits", response_model=List[schemas.VisitResponse])
async def get_my_visits(
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Lists all hospital visits for the current patient."""
    stmt = select(models.PatientVisit).where(models.PatientVisit.patient_id == current_patient.id).order_by(models.PatientVisit.check_in_time.desc())
    result = await db.execute(stmt)
    visits = result.scalars().all()
    
    # Enrich with hospital names
    enriched_visits = []
    for v in visits:
        h_stmt = select(models.Hospital.name).where(models.Hospital.id == v.hospital_id)
        h_name = (await db.execute(h_stmt)).scalar()
        enriched_visits.append({
            "id": v.id,
            "hospital_name": h_name or "Unknown Hospital",
            "visit_reason": v.visit_reason,
            "status": v.status,
            "check_in_time": v.check_in_time,
            "queue_token": v.queue_token
        })
        
    return enriched_visits
