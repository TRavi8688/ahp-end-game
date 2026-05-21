from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.security import require_roles, require_module
from app.schemas.admission import AdmissionCreate, AdmissionRead, BedRead
from app.services.admission_service import AdmissionService

router = APIRouter(dependencies=[Depends(require_module("inpatient_beds"))])

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

from pydantic import BaseModel
from typing import Optional

class VitalsCreate(BaseModel):
    temperature: float
    blood_pressure: str
    heart_rate: int
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    notes: Optional[str] = None

@router.post("/{admission_id}/vitals")
async def record_vitals(
    admission_id: str,
    vitals_in: VitalsCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("nurse", "doctor", "admin", "hospital_admin"))
):
    """Nurses use this to record real-time vitals for an admitted patient."""
    if not user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = user.staff_profile.hospital_id
    
    # We would normally insert into a Vitals table here, but assuming it links to the MedicalRecord or Admission
    # We will log the action so it appears on the owner's dashboard immediately
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="VITALS_RECORDED",
        user_id=user.id,
        hospital_id=hospital_id,
        resource_type="ADMISSION",
        details={
            "admission_id": admission_id,
            "temperature": vitals_in.temperature,
            "blood_pressure": vitals_in.blood_pressure,
            "heart_rate": vitals_in.heart_rate
        }
    )
    
    await db.commit()
    return {"success": True, "message": "Vitals recorded successfully"}
