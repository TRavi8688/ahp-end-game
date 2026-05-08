from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.security import require_roles
from app.schemas.admission import AdmissionCreate, AdmissionRead, BedRead
from app.services.admission_service import admit_patient, assign_bed, discharge_patient

router = APIRouter()

@router.post("/", response_model=AdmissionRead, status_code=status.HTTP_201_CREATED)
async def create_admission(
    payload: AdmissionCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("doctor", "admin", "hospital_admin"))
):
    try:
        return await admit_patient(db, payload.patient_id, user, payload.queue_token_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{admission_id}/assign-bed", response_model=AdmissionRead)
async def assign_patient_bed(
    admission_id: int,
    bed_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("nurse", "admin", "hospital_admin"))
):
    try:
        return await assign_bed(db, admission_id, bed_id, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{admission_id}/discharge", response_model=AdmissionRead)
async def discharge_patient_record(
    admission_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("doctor", "admin", "hospital_admin"))
):
    try:
        return await discharge_patient(db, admission_id, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
