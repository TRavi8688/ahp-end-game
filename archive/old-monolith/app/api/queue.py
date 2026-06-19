from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
import uuid
from typing import List, Optional
from datetime import datetime

from app.api import deps
from app.models.models import User, RoleEnum, Patient, Hospital
from app.models.scheduling import QueueEntry, QueueStatusEnum

router = APIRouter(prefix="/queue", tags=["Queue"])

class QueueCheckInRequest(BaseModel):
    hospyn_id: str
    doctor_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    op_fee: Optional[float] = None
    payment_method: Optional[str] = None

@router.post("/checkin", status_code=status.HTTP_201_CREATED)
async def checkin_patient(
    data: QueueCheckInRequest,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.receptionist, RoleEnum.hospital_admin, RoleEnum.admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Receptionist checks in a patient into the live queue."""
    # Find patient by hospyn_id
    stmt = select(User).where(User.hospyn_id == data.hospyn_id)
    patient_user = (await db.execute(stmt)).scalars().first()
    if not patient_user:
        raise HTTPException(status_code=404, detail="Patient not found with this Hospyn ID")
        
    stmt_p = select(Patient).where(Patient.user_id == patient_user.id)
    patient_record = (await db.execute(stmt_p)).scalars().first()
    if not patient_record:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # Get hospital context from current_user
    # Actually current_user might be a staff member. We need their hospital_id.
    from app.models.models import StaffProfile
    stmt_staff = select(StaffProfile).where(StaffProfile.user_id == current_user.id)
    staff_profile = (await db.execute(stmt_staff)).scalars().first()
    
    hospital_id = staff_profile.hospital_id if staff_profile else None
    if not hospital_id:
        # Fallback to hospital admin checking their own tenant
        if current_user.role == RoleEnum.hospital_admin:
            stmt_hosp = select(Hospital).where(Hospital.owner_id == current_user.id)
            hosp = (await db.execute(stmt_hosp)).scalars().first()
            if hosp:
                hospital_id = hosp.id

    if not hospital_id:
        raise HTTPException(status_code=400, detail="Cannot determine hospital context for receptionist")

    # Generate next token number
    stmt_token = select(func.max(QueueEntry.token_number)).where(
        and_(
            QueueEntry.hospital_id == hospital_id,
            func.date(QueueEntry.check_in_time) == func.current_date()
        )
    )
    max_token = (await db.execute(stmt_token)).scalar()
    next_token = (max_token or 0) + 1

    queue_entry = QueueEntry(
        hospital_id=hospital_id,
        patient_id=patient_record.id,
        doctor_id=data.doctor_id,
        department_id=data.department_id,
        status=QueueStatusEnum.checked_in,
        token_number=next_token,
        op_fee=data.op_fee,
        payment_method=data.payment_method
    )
    
    db.add(queue_entry)
    await db.commit()
    await db.refresh(queue_entry)
    
    return {
        "message": "Patient checked in successfully",
        "token_number": next_token,
        "queue_entry_id": queue_entry.id
    }

@router.get("/active", response_model=List[dict])
async def get_active_queue(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.doctor, RoleEnum.nurse, RoleEnum.receptionist, RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Doctors/Staff view the active queue of patients waiting."""
    from sqlalchemy.orm import selectinload
    
    # Determine hospital
    from app.models.models import StaffProfile, Doctor
    hospital_id = None
    doctor_id = None
    
    if current_user.role == RoleEnum.doctor:
        stmt_doc = select(Doctor).where(Doctor.user_id == current_user.id)
        doc = (await db.execute(stmt_doc)).scalars().first()
        if doc:
            hospital_id = doc.hospital_id
            doctor_id = doc.id
    else:
        stmt_staff = select(StaffProfile).where(StaffProfile.user_id == current_user.id)
        staff = (await db.execute(stmt_staff)).scalars().first()
        if staff:
            hospital_id = staff.hospital_id
            
    if not hospital_id:
        raise HTTPException(status_code=400, detail="Hospital context not found")
        
    stmt = select(QueueEntry).options(
        selectinload(QueueEntry.patient).selectinload(Patient.user)
    ).where(
        and_(
            QueueEntry.hospital_id == hospital_id,
            QueueEntry.status == QueueStatusEnum.checked_in
        )
    ).order_by(QueueEntry.token_number.asc())
    
    if doctor_id:
        stmt = stmt.where(QueueEntry.doctor_id == doctor_id)
        
    entries = (await db.execute(stmt)).scalars().all()
    
    result = []
    for entry in entries:
        user = entry.patient.user if entry.patient else None
        result.append({
            "queue_entry_id": str(entry.id),
            "token_number": entry.token_number,
            "check_in_time": entry.check_in_time,
            "patient_name": f"{user.first_name} {user.last_name}" if user else "Unknown Patient",
            "patient_hospyn_id": user.hospyn_id if user else None,
            "patient_id": str(entry.patient_id) if entry.patient_id else None,
            "status": entry.status.value if hasattr(entry.status, 'value') else str(entry.status)
        })
        
    return result
