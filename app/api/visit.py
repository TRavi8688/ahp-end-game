import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import app.api.deps as deps
from app.models import models
from app.schemas import schemas
from app.core.audit import log_audit_action
from app.core.logging import logger

router = APIRouter(prefix="/visit", tags=["Visit"])

@router.post("/scan", response_model=schemas.HospitalQRScan)
async def scan_hospital_qr(
    data: schemas.HospitalQRScan,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Validates a hospital QR code and returns hospital metadata.
    QR Data can be a Hospital UUID or a short code.
    """
    try:
        hospital_id = uuid.UUID(data.qr_data)
        stmt = select(models.Hospital).where(models.Hospital.id == hospital_id)
    except ValueError:
        # Try as short code
        stmt = select(models.Hospital).where(models.Hospital.short_code == data.qr_data.upper())

    result = await db.execute(stmt)
    hospital = result.scalar_one_or_none()

    if not hospital:
        raise HTTPException(status_code=404, detail="Invalid Hospital QR Code")

    return {
        "qr_data": str(hospital.id),
        "name": hospital.name,
        "hospyn_id": hospital.hospyn_id
    }

from pydantic import BaseModel

class QuickRegisterRequest(BaseModel):
    hospital_id: str
    name: str
    phone: str
    age: int
    reason: str

@router.post("/public/quick-register")
async def public_quick_register(
    data: QuickRegisterRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Public endpoint for patients to register via QR code without logging in.
    Creates a temporary patient profile (if needed) and a queue entry.
    """
    try:
        hospital_id = uuid.UUID(data.hospital_id)
        # Verify hospital exists
        stmt = select(models.Hospital).where(models.Hospital.id == hospital_id)
        hospital = (await db.execute(stmt)).scalar_one_or_none()
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # We create a QueueEntry directly, assuming the hospital has a reception/queue system.
        # But wait, doctor-app my-patients requires DoctorAccess. 
        # Doctor Dashboard 'Recent Consultations' queries DoctorAccess!
        # Wait, the doctor dashboard /doctor/my-patients endpoint queries DoctorAccess.
        # Let's create a Patient record and grant DoctorAccess to all doctors in the hospital? Or create a QueueEntry.
        # To make it visible to the doctor-app (which queries /doctor/my-patients -> DoctorAccess),
        # we must create a Patient and a DoctorAccess.
        
        # 1. Create a shadow User and Patient
        new_hospyn_id = f"Hospyn-{uuid.uuid4().hex[:8].upper()}"
        import secrets
        shadow_user = models.User(
            email=f"{uuid.uuid4().hex[:8]}@guest.hospyn.com",
            first_name=data.name.split()[0],
            last_name=" ".join(data.name.split()[1:]) if len(data.name.split()) > 1 else "",
            role=models.RoleEnum.patient,
            hashed_password=f"shadow_{secrets.token_hex(16)}",
            is_active=True
        )
        db.add(shadow_user)
        await db.flush()
        
        shadow_patient = models.Patient(
            user_id=shadow_user.id,
            hospyn_id=new_hospyn_id,
            phone_number=data.phone,
            language_code="en"
        )
        db.add(shadow_patient)
        await db.flush()

        # 2. Grant DoctorAccess to all doctors in this hospital so it shows up in their dashboard
        stmt_docs = select(models.Doctor).where(models.Doctor.hospital_id == hospital_id)
        docs = (await db.execute(stmt_docs)).scalars().all()
        for doc in docs:
            stmt_doc_user = select(models.User).where(models.User.id == doc.user_id)
            doc_user = (await db.execute(stmt_doc_user)).scalar_one()
            access = models.DoctorAccess(
                patient_id=shadow_patient.id,
                doctor_user_id=doc.user_id,
                doctor_name=f"Dr. {doc_user.last_name}",
                clinic_name=hospital.name,
                access_level="write",
                status="granted"
            )
            db.add(access)

        # 3. Create PatientVisit
        new_visit = models.PatientVisit(
            patient_id=shadow_patient.id,
            hospital_id=hospital_id,
            visit_reason=data.reason,
            symptoms=f"Age {data.age}. Check-in from QR.",
            department="General Medicine",
            status=models.VisitStatusEnum.active
        )
        db.add(new_visit)
        
        await db.commit()
        return {"status": "success", "patient_id": str(shadow_patient.id), "hospyn_id": new_hospyn_id}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create", response_model=schemas.VisitResponse)
async def create_visit(
    data: schemas.VisitCreate,
    current_patient: models.Patient = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Initiates a new hospital visit for the patient.
    """
    # 1. Verify Hospital Exists
    h_stmt = select(models.Hospital).where(models.Hospital.id == data.hospital_id)
    h_res = await db.execute(h_stmt)
    hospital = h_res.scalar_one_or_none()
    
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    # Determine family member scope
    f_member_id = data.family_member_id or active_member_id

    # 2. Create Visit Record
    new_visit = models.PatientVisit(
        patient_id=current_patient.id,
        hospital_id=data.hospital_id,
        family_member_id=f_member_id,
        visit_reason=data.visit_reason,
        symptoms=data.symptoms,
        department=data.department,
        doctor_name=data.doctor_name,
        status=models.VisitStatusEnum.active
    )
    db.add(new_visit)
    
    # 3. Create a Queue Entry (Optional but recommended for hospital flow)
    # This simulates checking into the hospital's digital queue
    queue_token = f"T-{uuid.uuid4().hex[:4].upper()}"
    new_visit.queue_token = queue_token
    
    await db.commit()
    await db.refresh(new_visit)

    await log_audit_action(
        db, 
        "HOSPITAL_VISIT_STARTED", 
        user_id=current_patient.user_id, 
        details={"hospital": hospital.name, "reason": data.visit_reason}
    )

    return {
        "id": new_visit.id,
        "hospital_name": hospital.name,
        "visit_reason": new_visit.visit_reason,
        "status": new_visit.status,
        "check_in_time": new_visit.check_in_time,
        "queue_token": new_visit.queue_token,
        "family_member_id": new_visit.family_member_id
    }

@router.get("/my-visits", response_model=List[schemas.VisitResponse])
async def get_my_visits(
    current_patient: models.Patient = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    """Lists all hospital visits for the current patient."""
    stmt = select(models.PatientVisit).where(
        models.PatientVisit.patient_id == current_patient.id,
        models.PatientVisit.family_member_id == active_member_id
    ).order_by(models.PatientVisit.check_in_time.desc())
    result = await db.execute(stmt)
    visits = result.scalars().all()
    
    # Enrich with hospital names
    enriched_visits = []
    for v in visits:
        h_stmt = select(models.Hospital.name).where(models.Hospital.id == v.hospital_id)
        h_name = (await db.execute(h_stmt)).scalar()
        enriched_visits.append({
            "id": v.id,
            "hospital_name": h_name or "Hospyn Clinic",
            "visit_reason": v.visit_reason or "Clinical Consultation",
            "status": v.status,
            "check_in_time": v.check_in_time or v.created_at or datetime.now(timezone.utc),
            "queue_token": v.queue_token,
            "family_member_id": v.family_member_id
        })
        
    return enriched_visits
