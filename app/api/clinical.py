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

router = APIRouter()

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
    # 1. Prepare clinical payload for cryptographic sealing
    clinical_data = {
        "patient_id": str(req.patient_id),
        "doctor_id": str(current_user.id),
        "diagnosis": req.diagnosis,
        "medications": [m.model_dump() for m in req.medications],
        "visit_id": str(req.visit_id) if req.visit_id else None
    }
    
    # 2. Seal the prescription record
    from app.services.integrity import integrity_service
    signature_hash = integrity_service.calculate_entity_hash(clinical_data)

    prescription = DigitalPrescription(
        hospital_id=hospital_id,
        doctor_id=current_user.id,
        patient_id=req.patient_id,
        visit_id=req.visit_id,
        diagnosis=req.diagnosis,
        medications=[m.model_dump() for m in req.medications],
        notes=req.notes,
        status=PrescriptionStatusEnum.pending,
        signature_hash=signature_hash # SEALED
    )
    db.add(prescription)
    await db.flush()

    # 3. Emit Sovereign Audit Link (Event Ledger)
    await notification_service.trigger_event(
        db=db,
        hospital_id=hospital_id,
        actor_id=current_user.id,
        action="ISSUE_PRESCRIPTION",
        resource_type="Prescription",
        resource_id=prescription.id,
        patient_id=req.patient_id,
        notification_text=f"A digital prescription (HASH: {signature_hash[:8]}...) has been issued by Dr. {current_user.last_name}.",
        payload={
            "diagnosis": req.diagnosis, 
            "medication_count": len(req.medications),
            "forensic_seal": signature_hash
        }
    )

    await db.commit()
    await db.refresh(prescription)
    return prescription

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

