from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.models import User, RoleEnum, LabTestMaster, LabDiagnosticOrder, LabResult, LabOrderStatusEnum, LabTestCategory
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter()

# --- Lab Test Master (Directory) ---

class LabTestCreate(BaseModel):
    test_name: str
    category: LabTestCategory
    code: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    base_price: float = 0.0

@router.get("/tests")
async def get_lab_tests(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab, RoleEnum.doctor])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieves the hospital's lab test directory."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(LabTestMaster).where(LabTestMaster.hospital_id == hospital_id)
    result = await db.execute(stmt)
    tests = result.scalars().all()
    
    return tests

@router.post("/tests")
async def create_lab_test(
    test_in: LabTestCreate,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Adds a new test to the hospital's lab directory."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    new_test = LabTestMaster(
        hospital_id=hospital_id,
        test_name=test_in.test_name,
        category=test_in.category,
        code=test_in.code,
        unit=test_in.unit,
        reference_range=test_in.reference_range,
        base_price=test_in.base_price
    )
    db.add(new_test)
    await db.commit()
    
    return {"success": True, "id": str(new_test.id)}

# --- Lab Orders & Results ---

@router.get("/queue")
async def get_lab_queue(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieves all active diagnostic orders for the hospital (frontend queue)."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(LabDiagnosticOrder).where(LabDiagnosticOrder.hospital_id == hospital_id).order_by(LabDiagnosticOrder.created_at.desc())
    result = await db.execute(stmt)
    orders = result.scalars().all()
    
    from app.models.billing import Invoice
    
    # Format for frontend
    formatted_orders = []
    for o in orders:
        # Fetch the invoice for this lab order
        inv_stmt = select(Invoice).where(
            Invoice.patient_id == o.patient_id,
            Invoice.notes.like(f"%{str(o.id)[:8]}%")
        )
        inv_res = await db.execute(inv_stmt)
        invoice = inv_res.scalar_one_or_none()
        
        formatted_orders.append({
            "id": str(o.id),
            "patient_id": str(o.patient_id),
            "patient_name": "Patient", # In real app, join with Patient table
            "status": o.status.value if hasattr(o.status, 'value') else o.status,
            "tests": o.tests or [],
            "created_at": o.created_at.isoformat() if o.created_at else "",
            "sample_id": o.sample_id,
            "collected_at": o.collected_at.isoformat() if o.collected_at else None,
            "invoice_id": str(invoice.id) if invoice else None,
            "payable_amount": invoice.payable_amount if invoice else 0.0,
            "payment_status": invoice.status.value if invoice and hasattr(invoice.status, 'value') else (invoice.status if invoice else "N/A")
        })
    
    return formatted_orders

from datetime import datetime

@router.post("/orders/{order_id}/collect")
async def collect_sample(
    order_id: str,
    sample_id: str,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Marks a sample as collected."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    stmt = select(LabDiagnosticOrder).where(LabDiagnosticOrder.id == order_id, LabDiagnosticOrder.hospital_id == hospital_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    order.sample_id = sample_id
    order.status = LabOrderStatusEnum.collecting
    order.collected_at = datetime.utcnow()
    await db.commit()
    return {"success": True}

from fastapi import UploadFile, File

@router.post("/upload-report")
async def upload_lab_report(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
):
    """Mock file upload for Lab Reports."""
    return {"success": True, "file_url": f"https://hospyn.com/reports/{file.filename}"}

@router.get("/orders")
async def get_lab_orders(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieves all diagnostic orders for the hospital."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(LabDiagnosticOrder).where(LabDiagnosticOrder.hospital_id == hospital_id).order_by(LabDiagnosticOrder.created_at.desc())
    result = await db.execute(stmt)
    orders = result.scalars().all()
    
    return orders

class ResultEntry(BaseModel):
    test_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool = False
    clinical_remarks: Optional[str] = None

class LabResultSubmit(BaseModel):
    results: List[ResultEntry]
    file_url: Optional[str] = None

@router.post("/orders/{order_id}/results")
async def submit_lab_results(
    order_id: str,
    payload: LabResultSubmit,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Submits results for a diagnostic order and marks it completed."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(LabDiagnosticOrder).where(
        LabDiagnosticOrder.id == order_id,
        LabDiagnosticOrder.hospital_id == hospital_id
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == LabOrderStatusEnum.completed:
        raise HTTPException(status_code=400, detail="Order is already completed")
        
    for r in payload.results:
        lab_res = LabResult(
            hospital_id=hospital_id,
            order_id=order.id,
            patient_id=order.patient_id,
            test_name=r.test_name,
            value=r.value,
            unit=r.unit,
            reference_range=r.reference_range,
            is_abnormal=r.is_abnormal,
            clinical_remarks=r.clinical_remarks,
            observation_date=datetime.utcnow()
        )
        db.add(lab_res)
        
    order.status = LabOrderStatusEnum.completed
    order.completed_at = datetime.utcnow()
    
    # Log Audit
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="LAB_RESULT_SUBMITTED",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="LAB_ORDER",
        details={"order_id": str(order.id), "result_count": len(payload.results)}
    )
    
    await db.commit()
    return {"success": True, "message": "Results submitted successfully"}

@router.get("/history")
async def get_lab_history(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.lab])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns all historically completed lab orders."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    from app.models.models import Patient
    
    stmt = (
        select(LabDiagnosticOrder, Patient)
        .join(Patient, LabDiagnosticOrder.patient_id == Patient.id)
        .where(
            LabDiagnosticOrder.hospital_id == hospital_id,
            LabDiagnosticOrder.status == LabOrderStatusEnum.completed
        )
        .order_by(LabDiagnosticOrder.completed_at.desc())
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    history = []
    for order, patient in rows:
        history.append({
            "id": str(order.id),
            "date": order.completed_at.isoformat() if order.completed_at else (order.created_at.isoformat() if order.created_at else ""),
            "patient_name": f"{patient.user.first_name} {patient.user.last_name}" if patient.user else "Unknown Patient",
            "hospyn_id": patient.hospyn_id,
            "tests": order.tests,
            "results_data": order.results_data
        })
        
    return history
