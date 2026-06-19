import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_roles, require_module
import app.api.deps as deps
from app.schemas.admission import AdmissionCreate, AdmissionRead, BedRead, BedCreate
from app.services.admission_service import AdmissionService
from app.models.models import Bed, Admission, Patient, AdmissionStatus

router = APIRouter(dependencies=[Depends(require_module("inpatient_beds"))])
admission_service = AdmissionService()

@router.get("/", response_model=List[dict])
async def get_active_admissions(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    user = Depends(require_roles("nurse", "doctor", "admin", "hospital_admin"))
):
    """Get all active admissions for the ward dashboard."""
    stmt = select(Admission, Patient).join(Patient, Admission.patient_id == Patient.id).where(
        Admission.hospital_id == hospital_id,
        Admission.status == AdmissionStatus.ADMITTED
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        {
            "id": str(adm.id),
            "patient_id": str(patient.id),
            "patient_name": patient.full_name,
            "bed_id": str(adm.bed_id) if adm.bed_id else None,
            "status": adm.status.value,
            "admission_date": adm.admitted_at.isoformat()
        }
        for adm, patient in rows
    ]

@router.get("/beds", response_model=List[BedRead])
async def get_beds(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    user = Depends(require_roles("nurse", "doctor", "admin", "hospital_admin"))
):
    """Get real-time status of all hospital beds."""
    status_list = await admission_service.get_ward_status(db, hospital_id)
    return status_list

@router.post("/beds", response_model=BedRead)
async def create_bed(
    bed_in: BedCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    user = Depends(require_roles("admin", "hospital_admin"))
):
    """Setup a new bed (Owner/Admin only)."""
    bed = Bed(
        hospital_id=hospital_id,
        bed_number=bed_in.bed_number,
        department_id=bed_in.department_id,
        status=bed_in.status
    )
    db.add(bed)
    await db.commit()
    await db.refresh(bed)
    return bed

@router.post("/", response_model=AdmissionRead, status_code=status.HTTP_201_CREATED)
async def create_admission(
    payload: AdmissionCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    user = Depends(require_roles("nurse", "doctor", "admin", "hospital_admin"))
):
    """Admit a patient to a bed."""
    try:
        return await admission_service.admit_patient(
            db=db,
            hospital_id=hospital_id,
            patient_id=payload.patient_id,
            bed_id=payload.bed_id,
            staff_id=user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{admission_id}/discharge", response_model=AdmissionRead)
async def discharge_patient_record(
    admission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    user = Depends(require_roles("nurse", "doctor", "admin", "hospital_admin"))
):
    """Discharge a patient and free their bed."""
    try:
        return await admission_service.discharge_patient(
            db=db,
            hospital_id=hospital_id,
            admission_id=admission_id,
            staff_id=user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
