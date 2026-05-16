from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import app.api.deps as deps
from app.schemas.clinical import (
    PrescriptionCreate, 
    PrescriptionResponse
)
from app.schemas.lab import (
    LabOrderCreate, 
    LabOrderResponse,
    LabStatusUpdate
)
from app.services.clinical_service import ClinicalService
from app.models.models import RoleEnum

router = APIRouter()
clinical_service = ClinicalService()

@router.post("/prescriptions", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    *,
    db: AsyncSession = Depends(deps.get_db),
    prescription_in: PrescriptionCreate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Issue a new digital prescription. (Doctor only)
    """
    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can issue prescriptions")
        
    try:
        return await clinical_service.create_prescription(
            db=db,
            hospital_id=hospital_id,
            doctor_id=current_user.doctor_profile.id,
            patient_id=prescription_in.patient_id,
            medications=prescription_in.medications,
            notes=prescription_in.notes
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/prescriptions/{prescription_id}/fulfill", response_model=PrescriptionResponse)
async def fulfill_prescription(
    *,
    db: AsyncSession = Depends(deps.get_db),
    prescription_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Fulfill a digital prescription. (Pharmacist/Staff only)
    """
    # HARDENED RBAC: Only pharmacy or qualified staff
    if current_user.role not in [RoleEnum.pharmacy, RoleEnum.admin] and not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized fulfillment. Pharmacy credentials required.")
        
    try:
        return await clinical_service.fulfill_prescription(
            db=db,
            prescription_id=prescription_id,
            pharmacist_id=current_user.id,
            hospital_id=hospital_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/lab-orders", response_model=LabOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_order(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_in: LabOrderCreate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Create a new lab diagnostic order. (Doctor only)
    """
    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can order lab tests")
        
    try:
        return await clinical_service.create_lab_order(
            db=db,
            hospital_id=hospital_id,
            doctor_id=current_user.doctor_profile.id,
            patient_id=order_in.patient_id,
            tests=order_in.tests,
            history=order_in.clinical_history
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/lab-orders/{order_id}/status", response_model=LabOrderResponse)
async def update_lab_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_id: uuid.UUID,
    status_in: LabStatusUpdate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Update the status of a lab order. (Lab Staff/Doctor only)
    """
    if current_user.role not in [RoleEnum.nurse, RoleEnum.admin] and not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized status update")
        
    try:
        return await clinical_service.update_lab_status(
            db=db,
            order_id=order_id,
            status=status_in.status,
            hospital_id=hospital_id,
            user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/lab-orders/{order_id}/record-results", response_model=LabOrderResponse)
async def record_lab_results(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_id: uuid.UUID,
    results_in: List[dict],
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Record structured observations for a lab order.
    """
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized results recording")
        
    try:
        order = await clinical_service.record_lab_results(
            db=db,
            order_id=order_id,
            results_data=results_in,
            hospital_id=hospital_id,
            user_id=current_user.id
        )
        await db.commit()
        return order
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/records/{record_id}/verify", status_code=status.HTTP_200_OK)
async def verify_medical_record(
    *,
    db: AsyncSession = Depends(deps.get_db),
    record_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Formally verify an AI-extracted medical record. (Doctor only)
    """
    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can verify medical records")
        
    try:
        return await clinical_service.verify_medical_record(
            db=db,
            record_id=record_id,
            doctor_id=current_user.doctor_profile.id,
            hospital_id=hospital_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
