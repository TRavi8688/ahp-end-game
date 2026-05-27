from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from app.api import deps
from app.models.core import User, Hospital, HospitalVerificationStatusEnum, RoleEnum
from app.models.hospital_verification import (
    VerificationTask, VerificationTaskStatusEnum, VerificationHistory, 
    VerificationActionTypeEnum, VerifierNote, HospitalDocument, FraudSignal
)
from app.schemas.hospital_verification import (
    VerificationTaskRead, HospitalVerificationDetailResponse, 
    VerificationActionPayload, RequestMoreInfoPayload, VerifierNoteCreate,
    VerifierNoteRead, FraudSignalRead
)

router = APIRouter()

# --- RBAC Dependency ---
def require_verifier_role(current_user: User = Depends(deps.get_current_user)):
    # Assuming 'admin' and 'hospital_admin' can verify for now.
    if current_user.role not in [RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Not enough permissions to access verification queue")
    return current_user

# --- API Endpoints ---

@router.get("/queue", response_model=List[VerificationTaskRead])
async def get_verification_queue(
    db: AsyncSession = Depends(deps.get_db),
    task_status: Optional[VerificationTaskStatusEnum] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_verifier_role)
):
    stmt = select(VerificationTask)
    if task_status:
        stmt = stmt.where(VerificationTask.status == task_status)
    
    stmt = stmt.order_by(VerificationTask.priority.desc(), VerificationTask.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return tasks

@router.get("/{hospital_id}", response_model=HospitalVerificationDetailResponse)
async def get_hospital_verification_details(
    hospital_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(require_verifier_role)
):
    hospital_res = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = hospital_res.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    task_res = await db.execute(select(VerificationTask).where(VerificationTask.hospital_id == hospital_id))
    task = task_res.scalars().first()
    
    docs_res = await db.execute(select(HospitalDocument).where(HospitalDocument.hospital_id == hospital_id))
    documents = docs_res.scalars().all()
    
    hist_res = await db.execute(select(VerificationHistory).where(VerificationHistory.hospital_id == hospital_id).order_by(VerificationHistory.created_at.desc()))
    history = hist_res.scalars().all()
    
    notes_res = await db.execute(select(VerifierNote).where(VerifierNote.hospital_id == hospital_id).order_by(VerifierNote.created_at.desc()))
    notes = notes_res.scalars().all()
    
    fraud_res = await db.execute(select(FraudSignal).where(FraudSignal.hospital_id == hospital_id))
    fraud_signals = fraud_res.scalars().all()

    return HospitalVerificationDetailResponse(
        id=hospital.id,
        name=hospital.name,
        hospital_email=hospital.hospital_email,
        hospital_phone=hospital.hospital_phone,
        domain=hospital.domain,
        gst_number=hospital.gst_number,
        status=hospital.status,
        risk_score=hospital.risk_score,
        trust_score=hospital.trust_score,
        submitted_at=hospital.submitted_at,
        task=task,
        documents=documents,
        history=history,
        notes=notes,
        fraud_signals=fraud_signals
    )

@router.post("/{hospital_id}/approve")
async def approve_hospital(
    hospital_id: UUID,
    payload: VerificationActionPayload,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(require_verifier_role)
):
    hospital_res = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = hospital_res.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    hospital.status = HospitalVerificationStatusEnum.verified
    hospital.verified_at = datetime.now(timezone.utc)
    
    task_res = await db.execute(select(VerificationTask).where(VerificationTask.hospital_id == hospital_id))
    task = task_res.scalars().first()
    if task:
        task.status = VerificationTaskStatusEnum.done
        task.completed_at = datetime.now(timezone.utc)
    
    history = VerificationHistory(
        hospital_id=hospital_id,
        verifier_id=current_user.id,
        action_type=VerificationActionTypeEnum.approve,
        notes=payload.notes
    )
    db.add(history)
    await db.commit()
    
    return {"detail": "Hospital approved successfully"}

@router.post("/{hospital_id}/reject")
async def reject_hospital(
    hospital_id: UUID,
    payload: VerificationActionPayload,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(require_verifier_role)
):
    hospital_res = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = hospital_res.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    hospital.status = HospitalVerificationStatusEnum.rejected
    hospital.rejected_at = datetime.now(timezone.utc)
    
    task_res = await db.execute(select(VerificationTask).where(VerificationTask.hospital_id == hospital_id))
    task = task_res.scalars().first()
    if task:
        task.status = VerificationTaskStatusEnum.done
        task.completed_at = datetime.now(timezone.utc)
        
    history = VerificationHistory(
        hospital_id=hospital_id,
        verifier_id=current_user.id,
        action_type=VerificationActionTypeEnum.reject,
        notes=payload.notes
    )
    db.add(history)
    await db.commit()
    
    return {"detail": "Hospital rejected"}

@router.post("/{hospital_id}/request-more-info")
async def request_more_info(
    hospital_id: UUID,
    payload: RequestMoreInfoPayload,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(require_verifier_role)
):
    hospital_res = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = hospital_res.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    hospital.status = HospitalVerificationStatusEnum.request_more_info
    
    task_res = await db.execute(select(VerificationTask).where(VerificationTask.hospital_id == hospital_id))
    task = task_res.scalars().first()
    if task:
        task.status = VerificationTaskStatusEnum.open
        
    notes_str = f"Missing: {', '.join(payload.missing_items)}. Message: {payload.custom_message}"
    history = VerificationHistory(
        hospital_id=hospital_id,
        verifier_id=current_user.id,
        action_type=VerificationActionTypeEnum.request_more_info,
        notes=notes_str
    )
    db.add(history)
    await db.commit()
    
    return {"detail": "Requested more info from hospital owner"}

@router.post("/{hospital_id}/notes", response_model=VerifierNoteRead)
async def add_note(
    hospital_id: UUID,
    note_in: VerifierNoteCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(require_verifier_role)
):
    note = VerifierNote(
        hospital_id=hospital_id,
        verifier_id=current_user.id,
        note=note_in.note
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note
