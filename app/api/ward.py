from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.core.database import get_db
from app.api import deps
from app.schemas.admission import AdmissionCreate, AdmissionRead, BedRead, WardStatusResponse
from app.services.admission_service import AdmissionService

router = APIRouter()

@router.post("/admissions", response_model=AdmissionRead)
async def admit_patient(
    obj_in: AdmissionCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin) # Strictly for hospital admins/nurses
):
    """
    CLINICAL ADMISSION:
    Formalizes the patient stay by assigning a bed and opening the ledger.
    """
    try:
        admission = await AdmissionService.admit_patient(
            db=db,
            hospital_id=user.staff_profile.hospital_id,
            patient_id=obj_in.patient_id,
            bed_id=obj_in.bed_id,
            staff_id=user.id
        )
        return admission
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admissions/{admission_id}/discharge", response_model=AdmissionRead)
async def discharge_patient(
    admission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin)
):
    """
    CLINICAL DISCHARGE:
    Closes the admission and triggers bed cleaning protocol.
    """
    try:
        admission = await AdmissionService.discharge_patient(
            db=db,
            hospital_id=user.staff_profile.hospital_id,
            admission_id=admission_id,
            staff_id=user.id
        )
        return admission
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status", response_model=WardStatusResponse)
async def get_ward_status(
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin)
):
    """
    WARD COMMAND CENTER:
    Live occupancy data for nursing staff.
    """
    hospital_id = user.staff_profile.hospital_id
    beds = await AdmissionService.get_ward_status(db, hospital_id)
    
    total = len(beds)
    available = sum(1 for b in beds if b["status"].value == "available")
    occupied = sum(1 for b in beds if b["status"].value == "occupied")
    
    return {
        "total_beds": total,
        "available_beds": available,
        "occupied_beds": occupied,
        "beds": beds
    }
