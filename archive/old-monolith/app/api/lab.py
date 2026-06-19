from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid
import os

from app.core.database import get_db
from app.api import deps
from app.schemas.lab import LabOrderCreate, LabOrderResponse, LabOrderResultSubmit
from app.services.lab_service import LabService
from app.models.models import LabDiagnosticOrder, LabOrderStatusEnum

from app.core.security import require_module

router = APIRouter(prefix="/lab", tags=["Laboratory"], dependencies=[Depends(require_module("labs"))])


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

@router.get("/queue", response_model=List[LabOrderResponse])
async def lab_queue(
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_user)
):
    """
    LAB TECH VIEW: List all active lab orders (ordered, collecting).
    """
    from sqlalchemy import select
    hospital_id = getattr(user, 'hospital_id', None) or getattr(getattr(user, 'staff_profile', None), 'hospital_id', None)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="No hospital context found for this user.")

    stmt = select(LabDiagnosticOrder).where(
        LabDiagnosticOrder.hospital_id == hospital_id,
        LabDiagnosticOrder.status.in_([LabOrderStatusEnum.ordered, LabOrderStatusEnum.collecting])
    ).order_by(LabDiagnosticOrder.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/history", response_model=List[LabOrderResponse])
async def lab_history(
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_user)
):
    """
    LAB TECH VIEW: List all completed/cancelled lab orders.
    """
    from sqlalchemy import select
    hospital_id = getattr(user, 'hospital_id', None) or getattr(getattr(user, 'staff_profile', None), 'hospital_id', None)
    if not hospital_id:
        raise HTTPException(status_code=403, detail="No hospital context found for this user.")

    stmt = select(LabDiagnosticOrder).where(
        LabDiagnosticOrder.hospital_id == hospital_id,
        LabDiagnosticOrder.status.in_([LabOrderStatusEnum.completed, LabOrderStatusEnum.cancelled])
    ).order_by(LabDiagnosticOrder.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/orders/{order_id}/collect")
async def collect_sample(
    order_id: uuid.UUID,
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_user)
):
    """
    LAB TECHNICIAN ACTION:
    Register sample ID and mark order as collecting.
    """
    from sqlalchemy import select
    from datetime import datetime
    stmt = select(LabDiagnosticOrder).where(LabDiagnosticOrder.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    order.sample_id = sample_id
    order.status = LabOrderStatusEnum.collecting
    order.collected_at = datetime.utcnow()
    
    await db.commit()
    return {"status": "success", "message": "Sample registered successfully"}


@router.post("/upload-report", response_model=dict)
async def upload_lab_report(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin) # Staff/Technicians
):
    """
    Allows authorized technicians to upload PDF/Image results directly to secure storage.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")
    
    from app.services.storage_service import StorageService
    
    storage = StorageService()
    safe_filename = f"{uuid.uuid4()}{ext}"
    s3_object_name = f"reports/lab/{safe_filename}"
    
    s3_url = await storage.upload_stream(
        file_obj=file.file, 
        object_name=s3_object_name, 
        mime_type=file.content_type or "application/octet-stream"
    )
    
    return {"status": "success", "file_url": s3_url}

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
            staff_id=user.id,
            file_url=obj_in.file_url
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
