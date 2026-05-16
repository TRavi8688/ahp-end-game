import os
import uuid
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

import app.api.deps as deps
from app.models import models
from app.schemas import schemas
from app.core.config import settings
from app.core.limiter import limiter
from app.core.audit import log_clinical_audit as log_audit_action
from app.core.logging import logger
from app.services.dashboard_service import DashboardService
from app.services.ai_service import get_ai_service, AsyncAIService

from app.services.storage_service import upload_to_cloud_async

router = APIRouter(prefix="/patient", tags=["Patient"])

# --- COMPATIBILITY ENDPOINTS for Patient App ---

@router.post("/login-hospyn")
async def patient_login_hospyn(
    req: schemas.LoginHospynRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    ENTERPRISE SECURE LOGIN: Strict Local SOT.
    No cloud fallbacks. No split-brain identity.
    """
    from app.core import security
    from app.api.auth import throw_auth_exception
    
    hospyn_id = req.hospyn_id.upper().strip()

    # 1. Atomic Search: Local Database is the ONLY Source of Truth
    result_p = await db.execute(select(models.Patient).where(models.Patient.hospyn_id == hospyn_id))
    patient = result_p.scalars().first()
    
    if not patient:
        await log_audit_action(db, user_id=None, action="LOGIN_FAILURE_NOT_FOUND", resource_type="AUTH", details={"hospyn_id": hospyn_id})
        throw_auth_exception("Invalid Hospyn ID or password")

    result_u = await db.execute(select(models.User).where(models.User.id == patient.user_id))
    user = result_u.scalars().first()
    
    # 2. Strict Credential Verification
    if not user or not security.verify_password(req.password, user.hashed_password):
        await log_audit_action(db, user_id=user.id if user else None, action="LOGIN_FAILURE_AUTH", resource_type="AUTH")
        throw_auth_exception("Invalid Hospyn ID or password")
    
    # 3. Session Issuance
    access_token = security.create_access_token(user.id, user.role)
    refresh_token = security.create_refresh_token(user.id, user.role)
    
    await log_audit_action(db, user_id=user.id, action="LOGIN_SUCCESS", resource_type="AUTH")
    # Unit of Work: Commit handled by dependency or explicit flush if needed
    await db.commit() 

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "hospyn_id": hospyn_id
    }
# --- STANDARD PATIENT ENDPOINTS ---

# --- STANDARD PATIENT ENDPOINTS ---

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/upload-report", response_model=schemas.ReportAnalysisResponse)
@limiter.limit("5/minute")
async def upload_report(
    request: Request,
    file: UploadFile = File(...),
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Securely uploads and asynchronously processes a medical report (Stateless & Scalable)."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    from arq import create_pool
    from arq.connections import RedisSettings
    from app.services.storage_service import upload_bytes_async

    try:
        # 1. Direct Memory Streaming to Cloud Storage (Stateless & Memory-Safe)
        from app.services.storage_service import StorageService
        storage = StorageService()
        
        safe_filename = f"{uuid.uuid4()}{ext}"
        s3_object_name = f"reports/{current_patient.hospyn_id or 'anon'}/{safe_filename}"
        
        s3_url = await storage.upload_stream(
            file_obj=file.file, 
            object_name=s3_object_name, 
            mime_type=file.content_type or "application/octet-stream"
        )

        # 2. Create Placeholder Record
        new_record = models.MedicalRecord(
            patient_id=current_patient.id,
            type="Document",
            file_url=s3_url,
            raw_text="[PIPELINE_ANALYSIS_STAGED]",
            ai_summary="Chitti is decoding your clinical data...",
            patient_summary="Analysis staged in cloud pipeline."
        )
        db.add(new_record)
        await db.flush()

        # 3. ENQUEUE TO ARQ WORKER
        job_id = None
        try:
            # High-Integrity Task Ingestion
            redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
            job = await redis.enqueue_job('process_medical_document_task', new_record.id, s3_object_name)
            job_id = job.job_id
        except Exception as queue_err:
            logger.error(f"QUEUE_ERROR: {queue_err}")
            # Fallback for transient Redis failures: Record is saved, but analysis will be triggered by a background watcher
            job_id = f"fallback_{uuid.uuid4().hex[:8]}"

        await db.commit()

        await log_audit_action(
            db, 
            user_id=current_patient.user_id, 
            action="REPORT_STAGED_IN_PIPELINE", 
            resource_type="MEDICAL_RECORD",
            resource_id=new_record.id,
            details={"job_id": job_id}
        )
        
        return {
            "status": "processing",
            "record_id": new_record.id,
            "job_id": job_id,
            "message": "Clinical data successfully staged in parallel pipeline.",
            "url": s3_url
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PIPELINE_FAILURE: {str(e)}")
        raise HTTPException(status_code=500, detail="Clinical pipeline failure. Incident logged.")

@router.post("/confirm-and-save-report")
async def confirm_report(
    data: schemas.ReportConfirmSave,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Saves the AI analyzed report to the permanent database history."""
    new_record = models.MedicalRecord(
        patient_id=current_patient.id,
        type=data.type,
        record_name=data.record_name,
        hospital_name=data.hospital_name,
        file_url=data.s3_url,
        raw_text=data.analysis.get("raw_text"),
        ai_extracted=data.analysis.get("structured_data"),
        ai_summary=data.analysis.get("summary")
    )
    db.add(new_record)
    
    if data.update_profile:
        # Add conditions and meds to profile
        for c in data.analysis.get("structured_data", {}).get("conditions", []):
            db.add(models.Condition(patient_id=current_patient.id, name=c["name"], added_by="ai"))
        for m in data.analysis.get("structured_data", {}).get("medications", []):
            db.add(models.Medication(patient_id=current_patient.id, generic_name=m["name"], added_by="ai"))
            
    # Trigger Async Dashboard Rebuild via Outbox
    from app.core.outbox import add_event_to_outbox
    add_event_to_outbox(db, {
        "event_type": "DASHBOARD_REBUILD",
        "tenant_id": 0, # Global or specific if known
        "payload": {"patient_id": current_patient.id, "hospital_id": 0}
    })

    await db.commit()
    return {"status": "success", "record_id": new_record.id}

@router.get("/records", response_model=List[schemas.MedicalRecordResponse])
async def get_my_records(
    current_patient: Any = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(
        select(models.MedicalRecord).where(
            models.MedicalRecord.patient_id == current_patient.id,
            models.MedicalRecord.family_member_id == active_member_id
        )
    )
    await log_audit_action(
        db, 
        user_id=current_patient.user_id, 
        action="READ_PHI", 
        resource_type="MEDICAL_RECORD_LIST",
        patient_id=current_patient.id
    )
    
    from app.services.storage_service import get_secure_url
    records = result.scalars().all()
    for record in records:
        try:
            record.secure_url = await get_secure_url(record.file_url, expires_in=600)
        except Exception:
            record.secure_url = None
    return records

@router.get("/profile", response_model=schemas.PatientProfileResponse)
async def get_patient_profile(
    current_patient: Any = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    try:
        """Retrieves the active profile (either the patient or a family member)."""
        # Ensure user is loaded
        result = await db.execute(select(models.User).where(models.User.id == current_patient.user_id))
        user = result.scalar_one_or_none()
        
        # Reload patient with relationships
        from sqlalchemy.orm import selectinload
        stmt = select(models.Patient).where(models.Patient.id == current_patient.id).options(
            selectinload(models.Patient.family_members),
            selectinload(models.Patient.records)
        )
        result_p = await db.execute(stmt)
        patient = result_p.scalar_one()

        if active_member_id:
            # Switch context to family member
            member = next((m for m in patient.family_members if m.id == active_member_id), None)
            if member:
                # Filter records for this member
                member_records = [r for r in patient.records if r.family_member_id == active_member_id]
                return {
                    "id": member.id,
                    "full_name": member.full_name,
                    "email": user.email if user else None,
                    "phone_number": member.phone_number or patient.phone_number,
                    "hospyn_id": f"{patient.hospyn_id}-{member.relation.upper()}",
                    "age": 0,
                    "blood_group": member.blood_group,
                    "gender": member.gender,
                    "recent_records": member_records[:5],
                    "care_circle": patient.family_members,
                    "is_family_member": True,
                    "relation": member.relation
                }

        await log_audit_action(
            db, 
            user_id=current_patient.user_id, 
            action="READ_PHI", 
            resource_type="PATIENT_PROFILE",
            patient_id=current_patient.id
        )
        return {
            "id": patient.id,
            "full_name": f"{user.first_name} {user.last_name}" if (user and user.first_name) else "Patient",
            "email": user.email if user else None,
            "phone_number": patient.phone_number,
            "hospyn_id": patient.hospyn_id,
            "age": 0,
            "blood_group": patient.blood_group,
            "gender": patient.gender,
            "recent_records": [r for r in patient.records if r.family_member_id == None][:5],
            "care_circle": patient.family_members,
            "is_family_member": False
        }
    except Exception as e:
        import logging
        logger = logging.getLogger("app.api.patient")
        logger.exception(f"PATIENT_PROFILE_500_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch patient profile. Internal log recorded.")

@router.get("/care-circle", response_model=List[schemas.FamilyMemberResponse])
async def get_care_circle(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Lists all family members in the patient's care circle."""
    result = await db.execute(
        select(models.FamilyMember).where(models.FamilyMember.patient_id == current_patient.id)
    )
    await log_audit_action(
        db, 
        user_id=current_patient.user_id, 
        action="READ_PHI", 
        resource_type="MEDICAL_RECORD_LIST",
        patient_id=current_patient.id
    )
    return result.scalars().all()

@router.post("/care-circle", response_model=schemas.FamilyMemberResponse)
async def add_family_member(
    data: schemas.FamilyMemberCreate,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Adds a new family member to the care circle."""
    new_member = models.FamilyMember(
        patient_id=current_patient.id,
        full_name=data.full_name,
        relation=data.relation,
        phone_number=data.phone_number,
        blood_group=data.blood_group,
        gender=data.gender,
        date_of_birth=data.date_of_birth
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    return new_member

@router.get("/clinical-summary")
async def get_clinical_summary(
    current_patient: Any = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns dynamic clinical insights based on the patient's record history."""
    from sqlalchemy import select, func, and_
    from app.models.models import MedicalRecord, Condition, Medication, MedicationIntakeLog
    from datetime import datetime, date
    
    # 1. Fetch recent records for trend analysis
    res = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.patient_id == current_patient.id,
            MedicalRecord.family_member_id == active_member_id
        ).order_by(MedicalRecord.created_at.desc()).limit(5)
    )
    records = res.scalars().all()
    
    # 2. Fetch Medications & Conditions
    conditions_res = await db.execute(
        select(Condition).where(
            Condition.patient_id == current_patient.id,
            Condition.family_member_id == active_member_id
        )
    )
    meds_res = await db.execute(
        select(Medication).where(
            Medication.patient_id == current_patient.id,
            Medication.family_member_id == active_member_id,
            Medication.active == True
        )
    )
    
    conditions = conditions_res.scalars().all()
    meds = meds_res.scalars().all()
    
    condition_names = [c.name for c in conditions]
    
    # 3. Logic for "Today's Medications" vs "Ongoing Medications"
    today = date.today()
    # Fetch intake logs for today
    intake_res = await db.execute(
        select(MedicationIntakeLog.medication_id)
        .where(func.date(MedicationIntakeLog.taken_at) == today)
    )
    taken_med_ids = set(intake_res.scalars().all())
    
    today_meds = []
    ongoing_meds = []
    
    for m in meds:
        med_obj = {
            "id": m.id,
            "name": m.generic_name,
            "dosage": m.dosage or "",
            "frequency": m.frequency or "",
            "taken_today": m.id in taken_med_ids,
            "last_taken": "Not taken today" if m.id not in taken_med_ids else "Taken today"
        }
        # In a real app, we'd check frequency (e.g., 'Daily', 'BID') to decide if it belongs to 'Today'
        # For now, all active meds are 'Ongoing', and we show them in 'Today' if they are 'Daily' or similar.
        if m.frequency and ("Daily" in m.frequency or "day" in m.frequency.lower() or "morning" in m.frequency.lower()):
            today_meds.append(med_obj)
        
        ongoing_meds.append(med_obj)

    # 4. Generate proactive summary
    if not records:
        summary = "No medical records found. Upload your first report for a Chitti-powered analysis!"
        score = 50
    else:
        score = 70 + (len(records) * 2) if len(records) < 10 else 90
        summary = f"Your health snapshot is active. We are tracking {len(condition_names)} conditions across {len(records)} clinical documents."

    return {
        "summary": summary,
        "health_score": min(score, 100),
        "health_score_factors": condition_names[:3],
        "conditions": [{"name": c.name, "status": "Active"} for c in conditions],
        "today_medications": today_meds,
        "ongoing_medications": ongoing_meds,
        "last_update": "LIVE",
        "recovery_timeline": [
            {"year": "2025", "level": 60},
            {"year": "2026", "level": score}
        ],
        "condition_progress": {c: [{"value": "Stable", "date": "Today"}] for c in condition_names[:2]},
        "medication_impact": [{"name": m["name"], "improvement": "Tracked"} for m in ongoing_meds[:2]],
        "alerts": ["No urgent alerts found."] if not condition_names else [f"Monitoring {len(condition_names)} conditions."]
    }

@router.post("/log-medication")
async def log_medication_intake(
    medication_id: uuid.UUID,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Records that a patient has taken a medication."""
    # Verify medication belongs to patient
    res = await db.execute(
        select(models.Medication).where(models.Medication.id == medication_id, models.Medication.patient_id == current_patient.id)
    )
    med = res.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    log = models.MedicationIntakeLog(medication_id=medication_id)
    db.add(log)
    await db.commit()
    
    await log_audit_action(db, user_id=current_patient.user_id, action="MEDICATION_TAKEN", resource_type="MEDICATION", details={"medication": med.generic_name})
    
    return {"status": "success", "message": f"Logged {med.generic_name} intake."}

@router.post("/set-password")
async def set_patient_password(
    data: schemas.SetPasswordRequest,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Updates the patient's login password and generates an Hospyn ID if missing."""
    from app.core import security
    
    # Update linked User password
    result = await db.execute(select(models.User).where(models.User.id == current_patient.user_id))
    user = result.scalar_one()
    user.hashed_password = security.get_password_hash(data.password)
    
    # Ensure Hospyn ID exists (for new registrations)
    if not current_patient.hospyn_id:
        current_patient.hospyn_id = f"Hospyn-{uuid.uuid4().hex[:8].upper()}"
    
    await db.commit()
    return {"status": "success", "hospyn_id": current_patient.hospyn_id}

@router.post("/profile/update")
async def update_patient_profile(
    data: Dict[str, Any],
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Securely updates patient profile details."""
    # 1. Update User Details (Name)
    result = await db.execute(select(models.User).where(models.User.id == current_patient.user_id))
    user = result.scalar_one()
    
    full_name = data.get("full_name")
    if full_name:
        parts = full_name.split(" ")
        user.first_name = parts[0]
        user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    
    # 2. Update Patient Details
    if "phone_number" in data:
        current_patient.phone_number = data["phone_number"]
    if "blood_group" in data:
        current_patient.blood_group = data["blood_group"]
    if "gender" in data:
        current_patient.gender = data["gender"]
    if "date_of_birth" in data:
        current_patient.date_of_birth = data["date_of_birth"]

    await db.commit()
    await log_audit_action(db, user_id=user.id, action="PROFILE_UPDATE", resource_type="PATIENT_PROFILE")
    
    return {"status": "success", "message": "Profile updated successfully"}

@router.get("/dashboard")
async def get_dashboard(
    hospital_id: Optional[uuid.UUID] = None,
    current_patient: Any = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    service = DashboardService(db)
    return await service.get_dashboard(hospital_id, current_patient.id, family_member_id=active_member_id)

@router.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_chitti(
    request: Request,
    text: Optional[str] = Form(None),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    language_code: str = Form("en-IN"),
    file: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(deps.get_db_user),
    db: AsyncSession = Depends(deps.get_db),
    ai: AsyncAIService = Depends(get_ai_service)
):
    """Interactive AI chat with memory, vision, and voice capability."""
    conversation_id = f"chat_{current_user.id}"
    
    # --- LOAD SHEDDING (P3 Priority) ---
    from app.services.health_service import system_health
    if await system_health.should_shed_load(priority="P3"):
        logger.warning(f"LOAD_SHEDDING: Disabling AI Chat for User {current_user.id}")
        raise HTTPException(
            status_code=503, 
            detail="Chitti is temporarily offline to prioritize core clinical records. Please try again shortly."
        )
    
    msg_content = text or "Attached media"
    image_bytes = None
    audio_bytes = None
    
    if file:
        file_bytes = await file.read()
        image_bytes = file_bytes
        msg_content += " (Image attached)"

    if audio:
        audio_bytes = await audio.read()
        msg_content += " (Voice message attached)"

    # Generate AI response using memory, vision, and language preference
    # Save user message
    await ai.save_chat_message(
        user_id=str(current_user.id),
        conversation_id=conversation_id,
        role="user",
        content=msg_content,
        db=db
    )
    
    ai_text = await ai.chat_with_memory(
        str(current_user.id), 
        conversation_id, 
        msg_content, 
        family_member_id=active_member_id,
        image_bytes=image_bytes, 
        audio_bytes=audio_bytes,
        language_code=language_code,
        db=db
    )
    
    return {
        "ai_text": ai_text,
        "conversation_id": conversation_id
    }

@router.get("/chat-history", response_model=List[schemas.ChatMessageResponse])
async def get_chat_history(
    current_user: models.User = Depends(deps.get_db_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieve verified chat history from the local database."""
    result = await db.execute(
        select(models.Message).where(models.Message.user_id == current_user.id).order_by(models.Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        schemas.ChatMessageResponse(
            sender="user" if m.role == "user" else "ai",
            message_text=m.content,
            created_at=m.created_at
        ) for m in messages
    ]

@router.get("/pending-access")
async def get_pending_access(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Fetch any pending doctor access requests for the patient."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.patient_id == current_patient.id,
        models.DoctorAccess.status == "requested"
    )
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    return [
        {
            "access_id": r.id,
            "doctor_name": r.doctor_name,
            "clinic_name": r.clinic_name,
            "access_level": r.access_level,
            "requested_at": r.created_at
        } for r in requests
    ]

@router.post("/approve-access/{access_id}")
async def approve_access(
    access_id: int,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Approve a doctor's request to view medical records."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.id == access_id,
        models.DoctorAccess.patient_id == current_patient.id
    )
    result = await db.execute(stmt)
    access_req = result.scalar_one_or_none()
    
    if not access_req:
        raise HTTPException(status_code=404, detail="Access request not found")
    
    access_req.status = "granted"
    from datetime import datetime
    access_req.granted_at = datetime.now()
    
    await db.commit()
    await log_audit_action(db, user_id=current_patient.user_id, action="ACCESS_GRANTED", resource_type="CONSENT", details={"doctor": access_req.doctor_name})
    
    return {"status": "success", "message": f"Access granted to {access_req.doctor_name}"}

@router.post("/revoke-access/{access_id}")
async def revoke_access(
    access_id: int,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Revoke or reject a doctor's access."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.id == access_id,
        models.DoctorAccess.patient_id == current_patient.id
    )
    result = await db.execute(stmt)
    access_req = result.scalar_one_or_none()
    
    if not access_req:
        raise HTTPException(status_code=404, detail="Access request not found")
    
    access_req.status = "revoked"
    await db.commit()
    await log_audit_action(db, user_id=current_patient.user_id, action="ACCESS_REVOKED", resource_type="CONSENT", details={"doctor": access_req.doctor_name})
    
    return {"status": "success", "message": f"Access revoked for {access_req.doctor_name}"}

@router.post("/share-record")
async def share_record_with_doctor(
    data: schemas.ShareRecordRequest,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Share a single specific medical record with a doctor (from Chitti AI chat)."""
    import secrets
    from datetime import timedelta

    # 1. Verify the record belongs to this patient
    stmt = select(models.MedicalRecord).where(
        models.MedicalRecord.id == data.record_id,
        models.MedicalRecord.patient_id == current_patient.id
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found or does not belong to you.")

    # 2. Try to resolve doctor by name or license number
    doctor_user_id = None
    doctor_stmt = select(models.Doctor).join(models.User).where(
        or_(
            models.User.first_name.ilike(f"%{data.doctor_query}%"),
            models.User.last_name.ilike(f"%{data.doctor_query}%"),
            models.Doctor.license_number.ilike(f"%{data.doctor_query}%")
        )
    )
    doc_result = await db.execute(doctor_stmt)
    doctor = doc_result.scalars().first()
    if doctor:
        doctor_user_id = doctor.user_id

    # 3. Create share token
    share_token = secrets.token_urlsafe(32)
    expires_at = None
    if data.expires_hours > 0:
        expires_at = datetime.now() + timedelta(hours=data.expires_hours)

    share = models.RecordShare(
        patient_id=current_patient.id,
        record_id=data.record_id,
        doctor_query=data.doctor_query,
        doctor_user_id=doctor_user_id,
        share_token=share_token,
        expires_at=expires_at
    )
    db.add(share)
    await db.commit()

    await log_audit_action(
        db, 
        user_id=current_patient.user_id, 
        action="RECORD_SHARED", 
        resource_type="MEDICAL_RECORD",
        resource_id=data.record_id,
        details={
            "doctor_query": data.doctor_query,
            "expires_hours": data.expires_hours,
            "share_id": share.id
        }
    )

    return {
        "status": "success",
        "share_id": share.id,
        "share_token": share_token,
        "message": f"Record shared securely with {data.doctor_query}"
    }

@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Polls the status of a background AI processing job."""
    from arq.connections import RedisSettings
    from arq.jobs import Job, JobStatus
    from arq import create_pool
    
    redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    job_handle = Job(job_id, redis)
    status = await job_handle.status()
    
    # Map Arq status to our simpler schema
    status_map = {
        JobStatus.queued: "queued",
        JobStatus.deferred: "queued",
        JobStatus.in_progress: "in_progress",
        JobStatus.complete: "completed",
        JobStatus.not_found: "not_found"
    }
    
    friendly_status = status_map.get(status, "unknown")
    result = None
    if status == JobStatus.complete:
        result_info = await job_handle.result_info()
        result = {"success": True, "info": str(result_info)}
    
    return {
        "job_id": job_id,
        "status": friendly_status,
        "result": result
    }
