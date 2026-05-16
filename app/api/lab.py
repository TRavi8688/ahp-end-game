from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.core.database import get_db
from app.api import deps
from app.schemas.lab import LabOrderCreate, LabOrderResponse, LabOrderResultSubmit
from app.services.lab_service import LabService
from app.models.models import LabDiagnosticOrder, LabOrderStatusEnum

router = APIRouter(prefix="/lab", tags=["Laboratory"])

@router.post("/orders", response_model=LabOrderResponse)
async def create_order(
    obj_in: LabOrderCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_doctor) # Only doctors can order tests
):
    """
    DOCTOR COMMAND:
    Issue a new diagnostic request for a patient.
    """
    try:
        order = await LabService.create_order(
            db=db,
            hospital_id=user.hospital_id,
            doctor_id=user.id,
            patient_id=obj_in.patient_id,
            tests=obj_in.tests,
            visit_id=obj_in.visit_id
        )
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/orders/{order_id}/results", response_model=dict)
async def submit_results(
    order_id: uuid.UUID,
    obj_in: LabOrderResultSubmit,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin) # Staff/Technicians
):
    """
    LAB TECHNICIAN ACTION:
    Upload structured results and finalize the order.
    """
    try:
        results = await LabService.upload_results(
            db=db,
            hospital_id=user.staff_profile.hospital_id,
            order_id=order_id,
            results_data=[r.dict() for r in obj_in.results],
            staff_id=user.id
        )
        return {"status": "success", "message": f"{len(results)} results finalized and bound to patient."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/orders/{order_id}", response_model=LabOrderResponse)
async def get_order_details(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_user)
):
    """
    Retrieve specific order details with status.
    """
    from sqlalchemy import select
    stmt = select(LabDiagnosticOrder).where(LabDiagnosticOrder.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    return order
