import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.api import deps
from app.models import models
from app.schemas import schemas
from app.core.config import settings
from app.core.limiter import limiter
from app.core.audit import log_audit_action
from app.core.logging import logger
from app.services.dashboard_service import DashboardService
from app.services.ai_service import get_ai_service, AsyncAIService

from app.services.storage_service import upload_to_cloud_async

router = APIRouter(prefix="/patient", tags=["Patient"])

# --- COMPATIBILITY ENDPOINTS for Patient App ---

@router.post("/login-ahp")
async def patient_login_ahp(
    req: schemas.LoginAHPRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    ENTERPRISE SECURE LOGIN: Strict Local SOT.
    No cloud fallbacks. No split-brain identity.
    """
    from app.core import security
    from app.api.auth import throw_auth_exception
    
    ahp_id = req.ahp_id.upper().strip()

    # 1. Atomic Search: Local Database is the ONLY Source of Truth
    result_p = await db.execute(select(models.Patient).where(models.Patient.ahp_id == ahp_id))
    patient = result_p.scalars().first()
    
    if not patient:
        await log_audit_action(db, "LOGIN_FAILURE_NOT_FOUND", details={"ahp_id": ahp_id})
        throw_auth_exception("Invalid Mulajna ID or password")

    result_u = await db.execute(select(models.User).where(models.User.id == patient.user_id))
    user = result_u.scalars().first()
    
    # 2. Strict Credential Verification
    if not user or not security.verify_password(req.password, user.hashed_password):
        await log_audit_action(db, "LOGIN_FAILURE_AUTH", user_id=user.id if user else None)
        throw_auth_exception("Invalid Mulajna ID or password")
    
    # 3. Session Issuance
    access_token = security.create_access_token(user.id, user.role)
    refresh_token = security.create_refresh_token(user.id, user.role)
    
    await log_audit_action(db, "LOGIN_SUCCESS", user_id=user.id)
    # Unit of Work: Commit handled by dependency or explicit flush if needed
    await db.commit() 

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "ahp_id": ahp_id
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
        # 1. Direct Memory Streaming to Cloud Storage (Stateless)
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
             raise HTTPException(status_code=413, detail="File too large")
             
        safe_filename = f"{uuid.uuid4()}{ext}"
        s3_object_name = f"reports/{current_patient.ahp_id or 'anon'}/{safe_filename}"
        
        s3_url = await upload_bytes_async(
            content=content, 
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
        job_id = "demo_job_analysis"
        if not settings.DEMO_MODE:
            try:
                redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
                job = await redis.enqueue_job('process_medical_document_task', new_record.id, s3_object_name)
                job_id = job.job_id
            except Exception as queue_err:
                logger.error(f"QUEUE_ERROR: {queue_err}")
                job_id = "no_queue"

        await db.commit()

        await log_audit_action(
            db, 
            "REPORT_STAGED_IN_PIPELINE", 
            user_id=current_patient.user_id, 
            resource_type="MEDICAL_RECORD",
            details={"record_id": new_record.id, "job_id": job_id}
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Saves the AI analyzed report to the permanent database history."""
    new_record = models.MedicalRecord(
        patient_id=current_patient.id,
        type=data.type,
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(
        select(models.MedicalRecord).where(models.MedicalRecord.patient_id == current_patient.id)
    )
    return result.scalars().all()

@router.get("/profile", response_model=schemas.PatientProfileResponse)
async def get_patient_profile(
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieves the full profile of the authenticated patient."""
    # Ensure user is loaded
    result = await db.execute(select(models.User).where(models.User.id == current_patient.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return {
            "id": current_patient.id,
            "full_name": "Valued Patient",
            "email": "patient@ahp.local",
            "phone_number": current_patient.phone_number or "N/A",
            "ahp_id": current_patient.ahp_id,
            "age": current_patient.age,
            "blood_group": current_patient.blood_group,
            "gender": current_patient.gender,
            "recent_records": []
        }
    
    return {
        "id": current_patient.id,
        "full_name": f"{user.first_name} {user.last_name}",
        "email": user.email,
        "phone_number": current_patient.phone_number,
        "ahp_id": current_patient.ahp_id,
        "age": current_patient.age,
        "blood_group": current_patient.blood_group,
        "gender": current_patient.gender,
        "recent_records": [] # Can be populated via join if needed
    }

@router.get("/clinical-summary")
async def get_clinical_summary(
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns dynamic clinical insights based on the patient's record history."""
    from sqlalchemy import select, func
    from app.models.models import MedicalRecord, Condition, Medication
    
    # 1. Fetch recent records for trend analysis
    res = await db.execute(
        select(MedicalRecord).where(MedicalRecord.patient_id == current_patient.id).order_by(MedicalRecord.created_at.desc()).limit(5)
    )
    records = res.scalars().all()
    
    # 2. Basic Aggregation
    conditions_res = await db.execute(select(Condition).where(Condition.patient_id == current_patient.id))
    meds_res = await db.execute(select(Medication).where(Medication.patient_id == current_patient.id))
    
    condition_names = [c.name for c in conditions_res.scalars().all()]
    med_names = [m.generic_name for m in meds_res.scalars().all()]

    # Build structured arrays for the frontend health context banner
    condition_objects = [{"name": c.name, "status": "Active", "added_by": c.added_by} for c in conditions_res.scalars().all()] if False else []
    medication_objects = [{"name": m.generic_name, "dosage": m.dosage or "", "frequency": m.frequency or ""} for m in meds_res.scalars().all()] if False else []
    # Re-query since scalars were consumed above
    conditions_res2 = await db.execute(select(Condition).where(Condition.patient_id == current_patient.id))
    meds_res2 = await db.execute(select(Medication).where(Medication.patient_id == current_patient.id))
    condition_objects = [{"name": c.name, "status": "Active", "added_by": c.added_by} for c in conditions_res2.scalars().all()]
    medication_objects = [{"name": m.generic_name, "dosage": m.dosage or "", "frequency": m.frequency or ""} for m in meds_res2.scalars().all()]
    
    # 3. Generate proactive summary
    if not records:
        summary = "No medical records found. Upload your first report for a Chitti-powered analysis!"
        score = 50
    else:
        # Simplified score for now
        score = 70 + (len(records) * 2) if len(records) < 10 else 90
        summary = f"Your health snapshot is active. We are tracking {len(condition_names)} conditions across {len(records)} clinical documents."

    return {
        "summary": summary,
        "health_score": min(score, 100),
        "health_score_factors": condition_names[:3],
        "conditions": condition_objects,
        "medications": medication_objects,
        "last_update": "Latest Data",
        "recovery_timeline": [
            {"year": "2025", "level": 60},
            {"year": "2026", "level": score}
        ],
        "condition_progress": {c: [{"value": "Stable", "date": "Today"}] for c in condition_names[:2]},
        "medication_impact": [{"name": m, "improvement": "Tracked"} for m in med_names[:2]],
        "alerts": ["No urgent alerts found."] if not condition_names else [f"Monitoring {len(condition_names)} conditions."]
    }

@router.post("/set-password")
async def set_patient_password(
    data: schemas.SetPasswordRequest,
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Updates the patient's login password and generates an AHP ID if missing."""
    from app.core import security
    
    # Update linked User password
    result = await db.execute(select(models.User).where(models.User.id == current_patient.user_id))
    user = result.scalar_one()
    user.hashed_password = security.pwd_context.hash(data.password)
    
    # Ensure AHP ID exists (for new registrations)
    if not current_patient.ahp_id:
        current_patient.ahp_id = f"AHP-{uuid.uuid4().hex[:8].upper()}"
    
    await db.commit()
    return {"status": "success", "ahp_id": current_patient.ahp_id}

@router.get("/dashboard")
async def get_dashboard(
    hospital_id: int = 0,
    current_patient: models.Patient = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    service = DashboardService(db)
    return await service.get_dashboard(hospital_id, current_patient.id)

@router.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_chitti(
    request: Request,
    text: Optional[str] = Form(None),
    language_code: str = Form("en-IN"),
    file: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(deps.get_db_user),
    db: AsyncSession = Depends(deps.get_db),
    ai: AsyncAIService = Depends(get_ai_service)
):
    """Interactive AI chat with memory, vision, and voice capability."""
    conversation_id = f"chat_{current_user.id}"
    
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
    ai_text = await ai.chat_with_memory(
        str(current_user.id), 
        conversation_id, 
        msg_content, 
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
    await log_audit_action(db, "ACCESS_GRANTED", user_id=current_patient.user_id, details={"doctor": access_req.doctor_name})
    
    return {"status": "success", "message": f"Access granted to {access_req.doctor_name}"}

@router.post("/revoke-access/{access_id}")
async def revoke_access(
    access_id: int,
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
    await log_audit_action(db, "ACCESS_REVOKED", user_id=current_patient.user_id, details={"doctor": access_req.doctor_name})
    
    return {"status": "success", "message": f"Access revoked for {access_req.doctor_name}"}

@router.post("/share-record")
async def share_record_with_doctor(
    data: schemas.ShareRecordRequest,
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
        "RECORD_SHARED", 
        user_id=current_patient.user_id, 
        resource_type="MEDICAL_RECORD",
        details={
            "record_id": data.record_id, 
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
    current_patient: models.Patient = Depends(deps.get_current_patient),
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
