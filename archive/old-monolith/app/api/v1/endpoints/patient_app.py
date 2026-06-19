from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api import deps
from app.models.models import User, Hospital, OrganizationTypeEnum, DigitalPrescription, Patient, PharmacyInventory, InventoryTransaction, InventoryTransactionType, BillItem, Invoice
from typing import Dict, Any
import uuid

router = APIRouter()

@router.post("/scan-qr")
async def scan_qr_code(
    payload: Dict[str, str],
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Simulates a patient scanning a QR code using their phone.
    Identifies the entity (Hospital, Pharmacy, Lab).
    """
    qr_code_id = payload.get("qr_code_id")
    if not qr_code_id:
        raise HTTPException(status_code=400, detail="QR Code ID missing")
        
    stmt = select(Hospital).where(Hospital.qr_code_id == qr_code_id)
    entity = (await db.execute(stmt)).scalar_one_or_none()
    
    if not entity:
        raise HTTPException(status_code=404, detail="Invalid QR Code. Entity not found in Hospyn Network.")
        
    return {
        "success": True,
        "entity_id": str(entity.id),
        "entity_name": entity.name,
        "type": entity.org_type.value,
        "message": f"Successfully connected to {entity.name}."
    }

@router.post("/share-prescription")
async def share_prescription(
    payload: Dict[str, str],
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Patient explicitly pushes a specific prescription to a Partner Pharmacy.
    """
    qr_code_id = payload.get("qr_code_id")
    prescription_id = payload.get("prescription_id")
    
    # Verify patient
    stmt_p = select(Patient).where(Patient.user_id == current_user.id)
    patient = (await db.execute(stmt_p)).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    # Verify Pharmacy via QR
    stmt_h = select(Hospital).where(Hospital.qr_code_id == qr_code_id, Hospital.org_type == OrganizationTypeEnum.pharmacy)
    pharmacy = (await db.execute(stmt_h)).scalar_one_or_none()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Invalid Pharmacy QR Code.")
        
    # Verify Prescription belongs to Patient
    stmt_rx = select(DigitalPrescription).where(
        DigitalPrescription.id == prescription_id,
        DigitalPrescription.patient_id == patient.id
    )
    prescription = (await db.execute(stmt_rx)).scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found or access denied.")
        
    # In a real flow, this would create a 'PendingFulfillmentRequest' in the partner's queue.
    # For now, we will mark it as shared or log the action.
    # We will log the audit.
    from app.core.audit import log_clinical_audit
    await log_clinical_audit(
        db,
        user_id=current_user.id,
        action="PATIENT_PUSHED_PRESCRIPTION",
        resource_type="PRESCRIPTION",
        resource_id=prescription.id,
        patient_id=patient.id,
        details={"partner_hospital_id": str(pharmacy.id), "partner_name": pharmacy.name}
    )
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Prescription successfully shared with {pharmacy.name}. They are preparing your order."
    }
