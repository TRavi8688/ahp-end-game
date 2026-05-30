from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.core.database import get_db
from app.core.security import require_roles
from app.schemas.patient import PatientCreate, PatientRead
from app.services.patient_service import PatientService
import app.api.deps as deps

router = APIRouter()

@router.post("/", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
async def register_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(require_roles("admin", "hospital_admin", "receptionist", "doctor", "nurse"))
):
    """
    Registers a new patient and links them to the hospital tenant.
    """
    try:
        patient = await PatientService.create_patient(db, hospital_id, patient_in)
        # Create dict to match the schema
        return {
            "id": patient.id,
            "user_id": patient.user_id,
            "hospyn_id": patient.hospyn_id,
            "first_name": patient.user.first_name,
            "last_name": patient.user.last_name,
            "phone_number": patient.phone_number,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "created_at": patient.created_at
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/search", response_model=List[dict])
async def search_patients(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(require_roles("admin", "hospital_admin", "receptionist", "doctor", "nurse"))
):
    """
    Search patients by name, phone, or Hospyn ID.
    """
    return await PatientService.search_patients(db, hospital_id, q)
