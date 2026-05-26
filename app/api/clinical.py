from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.api import deps
from app.models.models import DigitalPrescription, PrescriptionStatusEnum, User
from app.schemas.clinical import PrescriptionResponse, PrescriptionCreate
from app.services.notifications import notification_service

router = APIRouter(prefix="/clinical")

@router.post("/prescribe", response_model=PrescriptionResponse)
async def create_prescription(
    req: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user: User = Depends(deps.get_current_user)
):
    """
    DOCTOR COMMAND:
    Signs and issues a digital prescription for a patient.
    Triggers automated notifications to the patient and pharmacy.
    """
    from sqlalchemy import func
    from app.models.models import Doctor, Patient
    from app.services.clinical_service import ClinicalService

    # 0. Load Doctor profile by user_id
    stmt_doc = select(Doctor).where(Doctor.user_id == current_user.id)
    res_doc = await db.execute(stmt_doc)
    doctor = res_doc.scalars().first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found. Please contact admin."
        )

    # 1. Resolve Patient ID (handles UUIDs and Hospyn IDs)
    final_patient_id = None
    if req.patient_id and req.patient_id not in ["null", "undefined", ""]:
        try:
            final_patient_id = uuid.UUID(str(req.patient_id))
        except ValueError:
            stmt_p = select(Patient).where(func.lower(Patient.hospyn_id) == func.lower(str(req.patient_id)))
            patient_res = await db.execute(stmt_p)
            patient_obj = patient_res.scalars().first()
            if patient_obj:
                final_patient_id = patient_obj.id
            else:
                raise HTTPException(status_code=404, detail="Patient not found in system")
    else:
        raise HTTPException(status_code=422, detail="Empty patient_id")

    # 2. Resolve Visit ID
    final_visit_id = None
    if req.visit_id and req.visit_id not in ["null", "undefined", ""]:
        try:
            final_visit_id = uuid.UUID(str(req.visit_id))
        except ValueError:
            pass

    # 3. Use enterprise clinical service
    clinical_service = ClinicalService()
    try:
        prescription = await clinical_service.create_prescription(
            db=db,
            hospital_id=hospital_id,
            user_id=current_user.id,
            doctor_id=doctor.id,
            patient_id=final_patient_id,
            medications=[m.model_dump() for m in req.medications],
            notes=req.notes,
            diagnosis=req.diagnosis,
            visit_id=final_visit_id
        )
        await db.commit()
        return prescription
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to issue prescription: {str(e)}")

@router.get("/prescriptions", response_model=List[PrescriptionResponse])
async def get_prescriptions(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    CLINICAL AUDIT:
    Returns the history of digital prescriptions.
    If the caller is a patient, returns only their own prescriptions.
    If the caller is staff/doctor, returns prescriptions matching their hospital_id.
    """
    from app.models.models import RoleEnum, Patient
    
    if current_user.role == RoleEnum.patient:
        # Retrieve patient profile
        stmt_p = select(Patient).where(Patient.user_id == current_user.id)
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found."
            )
        stmt = select(DigitalPrescription).where(DigitalPrescription.patient_id == patient.id)
    else:
        # Staff role, enforce tenant isolation
        if not current_user.staff_profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff profile not found. Access denied."
            )
        stmt = select(DigitalPrescription).where(DigitalPrescription.hospital_id == current_user.staff_profile.hospital_id)
        if patient_id:
            stmt = stmt.where(DigitalPrescription.patient_id == patient_id)
            
    result = await db.execute(stmt)
    return result.scalars().all()

