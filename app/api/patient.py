import os
import uuid
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

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
    
    hospyn_id = req.hospyn_id.strip()

    # 1. Atomic Search: Local Database is the ONLY Source of Truth
    result_p = await db.execute(select(models.Patient).where(func.lower(models.Patient.hospyn_id) == hospyn_id.lower()))
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
    access_token = security.create_access_token(user.id, user.role, token_version=user.token_version)
    refresh_token = security.create_refresh_token(user.id, user.role, token_version=user.token_version)
    
    await log_audit_action(db, user_id=user.id, action="LOGIN_SUCCESS", resource_type="AUTH")
    # Unit of Work: Commit handled by dependency or explicit flush if needed
    await db.commit() 

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "hospyn_id": hospyn_id
    }

@router.post("/setup-profile")
async def setup_patient_profile(
    req: schemas.PatientSetupRequest,
    current_user: models.User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Frictionless profile setup for Google OAuth and OTP-based skeleton users.
    Initializes their secure Patient medical vault and assigns a unique Hospyn ID.
    """
    logger.info(f"PATIENT_PROFILE_SETUP_ATTEMPT: User={current_user.email}")
    
    # 1. Ensure the user does not already have a patient profile
    existing_patient_stmt = select(models.Patient).where(models.Patient.user_id == current_user.id)
    existing_patient_res = await db.execute(existing_patient_stmt)
    if existing_patient_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient profile already exists for this account."
        )
        
    # 2. Generate a unique Hospyn ID
    import uuid
    hospyn_id = f"Hospyn-{uuid.uuid4().hex[:8].upper()}"
    
    # 3. Create Patient Record
    new_patient = models.Patient(
        user_id=current_user.id,
        hospyn_id=hospyn_id,
        phone_number=req.phone_number,
        language_code="en",
        date_of_birth=req.date_of_birth,
        gender=req.gender,
        blood_group=req.blood_group
    )
    db.add(new_patient)
    
    # 4. Link Hospyn ID to User record and set optional password
    current_user.hospyn_id = hospyn_id
    if req.password:
        from app.core import security
        current_user.hashed_password = security.get_password_hash(req.password)
        
    await db.commit()
    logger.info(f"PATIENT_PROFILE_SETUP_SUCCESS: HospynID={hospyn_id}, User={current_user.email}")
    
    return {
        "success": True,
        "hospyn_id": hospyn_id,
        "message": "Clinical profile successfully initialized."
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

@router.get("/timeline")
async def get_patient_clinical_timeline(
    current_patient: Any = Depends(deps.get_current_patient),
    active_member_id: Optional[uuid.UUID] = Depends(deps.get_active_family_member_id),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Returns a unified, cohesive chronological ledger of the patient's journey,
    grouping clinical items (prescriptions, lab orders, records) by visits
    to prevent patient confusion.
    """
    from sqlalchemy.orm import selectinload, joinedload
    from app.services.storage_service import get_secure_url
    from sqlalchemy import select
    from app.core.audit import log_audit_action
    
    # 1. Fetch all Patient Visits
    visits_res = await db.execute(
        select(models.PatientVisit)
        .options(joinedload(models.PatientVisit.hospital))
        .where(
            models.PatientVisit.patient_id == current_patient.id,
            models.PatientVisit.family_member_id == active_member_id
        )
        .order_by(models.PatientVisit.check_in_time.desc())
    )
    visits = visits_res.scalars().all()

    # 2. Fetch all Medical Records
    records_res = await db.execute(
        select(models.MedicalRecord)
        .where(
            models.MedicalRecord.patient_id == current_patient.id,
            models.MedicalRecord.family_member_id == active_member_id
        )
        .order_by(models.MedicalRecord.created_at.desc())
    )
    records = records_res.scalars().all()

    # 3. Fetch all Digital Prescriptions
    prescriptions_res = await db.execute(
        select(models.DigitalPrescription)
        .options(selectinload(models.DigitalPrescription.items))
        .where(
            models.DigitalPrescription.patient_id == current_patient.id,
            models.DigitalPrescription.family_member_id == active_member_id
        )
        .order_by(models.DigitalPrescription.created_at.desc())
    )
    prescriptions = prescriptions_res.scalars().all()

    # 4. Fetch all Lab Orders
    lab_orders_res = await db.execute(
        select(models.LabDiagnosticOrder)
        .options(selectinload(models.LabDiagnosticOrder.results))
        .where(
            models.LabDiagnosticOrder.patient_id == current_patient.id,
            models.LabDiagnosticOrder.family_member_id == active_member_id
        )
        .order_by(models.LabDiagnosticOrder.created_at.desc())
    )
    lab_orders = lab_orders_res.scalars().all()

    # Prepare secure URLs for records
    for r in records:
        try:
            r.secure_url = await get_secure_url(r.file_url, expires_in=600)
        except Exception:
            r.secure_url = None

    # Maps for grouping
    visits_map = {}
    for v in visits:
        visits_map[v.id] = {
            "id": v.id,
            "type": "visit",
            "timestamp": v.check_in_time,
            "hospital_name": v.hospital.name if v.hospital else "Unknown Hospital",
            "visit_reason": v.visit_reason,
            "symptoms": v.symptoms,
            "department": v.department,
            "doctor_name": v.doctor_name,
            "status": v.status.value if hasattr(v.status, "value") else str(v.status),
            "queue_token": v.queue_token,
            "prescriptions": [],
            "lab_orders": [],
            "records": []
        }

    timeline_items = []

    # Group prescriptions
    for p in prescriptions:
        p_data = {
            "id": p.id,
            "type": "prescription",
            "timestamp": p.created_at,
            "diagnosis": p.diagnosis,
            "notes": p.notes,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "medications": p.medications,
            "items": [{"name": i.name, "dosage": i.dosage, "instructions": i.instructions} for i in p.items]
        }
        if p.visit_id and p.visit_id in visits_map:
            visits_map[p.visit_id]["prescriptions"].append(p_data)
        else:
            p_data["type"] = "standalone_prescription"
            timeline_items.append(p_data)

    # Group lab orders
    for o in lab_orders:
        o_data = {
            "id": o.id,
            "type": "lab_order",
            "timestamp": o.created_at,
            "status": o.status.value if hasattr(o.status, "value") else str(o.status),
            "tests": o.tests,
            "clinical_history": o.clinical_history,
            "collected_at": o.collected_at.isoformat() if o.collected_at else None,
            "completed_at": o.completed_at.isoformat() if o.completed_at else None,
            "results": [
                {
                    "test_name": res.test_name,
                    "value": res.value,
                    "unit": res.unit,
                    "reference_range": res.reference_range,
                    "is_abnormal": res.is_abnormal,
                    "clinical_remarks": res.clinical_remarks
                } for res in o.results
            ]
        }
        if o.visit_id and o.visit_id in visits_map:
            visits_map[o.visit_id]["lab_orders"].append(o_data)
        else:
            o_data["type"] = "standalone_lab_order"
            timeline_items.append(o_data)

    # Group medical records
    for r in records:
        r_data = {
            "id": r.id,
            "type": "medical_record",
            "timestamp": r.created_at,
            "record_name": r.record_name,
            "hospital_name": r.hospital_name,
            "record_type": r.type.value if hasattr(r.type, "value") else str(r.type),
            "secure_url": r.secure_url,
            "patient_summary": r.patient_summary,
            "ai_summary": r.ai_summary,
            "ocr_confidence_score": r.ocr_confidence_score,
            "needs_verification": r.needs_verification
        }
        if r.visit_id and r.visit_id in visits_map:
            visits_map[r.visit_id]["records"].append(r_data)
        else:
            r_data["type"] = "standalone_record"
            timeline_items.append(r_data)

    # Add all visits to timeline
    for v_id, v_data in visits_map.items():
        timeline_items.append(v_data)

    # Sort everything descending by timestamp
    timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)

    # Convert timestamps to isoformat for output serialization
    for item in timeline_items:
        item["timestamp"] = item["timestamp"].isoformat()
        if "prescriptions" in item:
            for pr in item["prescriptions"]:
                pr["timestamp"] = pr["timestamp"].isoformat()
        if "lab_orders" in item:
            for lo in item["lab_orders"]:
                lo["timestamp"] = lo["timestamp"].isoformat()
        if "records" in item:
            for rec in item["records"]:
                rec["timestamp"] = rec["timestamp"].isoformat()

    # Log audit action
    await log_audit_action(
        db,
        action="READ_PHI",
        user_id=current_patient.user_id,
        details={"patient_id": str(current_patient.id), "scope": "unified_clinical_timeline"}
    )

    return timeline_items

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

        user_email = user.email if user else None
        user_first = user.first_name if user else ""
        user_last = user.last_name if user else ""
        
        full_name = "Patient"
        if user_first or user_last:
            full_name = f"{user_first} {user_last}".strip()

        await log_audit_action(
            db, 
            user_id=current_patient.user_id, 
            action="READ_PHI", 
            resource_type="PATIENT_PROFILE",
            patient_id=current_patient.id
        )
        return {
            "id": patient.id,
            "full_name": full_name,
            "email": user_email,
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
        date_of_birth=data.date_of_birth,
        linked_hospyn_id=f"{current_patient.hospyn_id}-FM-{__import__('uuid').uuid4().hex[:4].upper()}"
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    return new_member

@router.delete("/care-circle/{member_id}")
async def delete_family_member(
    member_id: uuid.UUID,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Removes a family member from the care circle."""
    result = await db.execute(
        select(models.FamilyMember).where(
            models.FamilyMember.id == member_id,
            models.FamilyMember.patient_id == current_patient.id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found in your Care Circle.")
    
    await db.delete(member)
    await db.commit()
    return {"status": "success", "message": f"Successfully removed {member.full_name} from your Care Circle."}

@router.get("/reception/directory")
async def get_patient_directory_for_reception(
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Fetches all registered patients for the receptionist."""
    # Strict role check
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val not in ["hospital_admin", "admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    from sqlalchemy.orm import joinedload
    
    result = await db.execute(
        select(models.Patient)
        .options(joinedload(models.Patient.user))
        .order_by(models.Patient.created_at.desc())
    )
    patients = result.scalars().all()
    
    response_data = []
    for p in patients:
        response_data.append({
            "id": p.id,
            "hospyn_id": p.hospyn_id,
            "first_name": p.user.first_name if p.user else "Unknown",
            "last_name": p.user.last_name if p.user else "Unknown",
            "phone_number": p.phone_number,
            "blood_group": p.blood_group,
            "gender": p.gender,
            "date_of_birth": p.date_of_birth,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return response_data

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
    else:
        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]
    
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
    files: Optional[List[UploadFile]] = File(None),
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
    
    msg_content = text or ""
    image_bytes_list = []
    image_s3_urls = []
    audio_bytes = None
    
    # Resolve Patient object
    result_p = await db.execute(select(models.Patient).where(models.Patient.user_id == current_user.id))
    patient = result_p.scalars().first()
    
    # PDF text extractor helper
    def extract_text_from_pdf(pdf_bytes: bytes) -> str:
        try:
            import pypdf
            import io
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            pdf_text = ""
            for page in reader.pages:
                pdf_text += page.extract_text() or ""
            return pdf_text.strip()
        except Exception as e:
            logger.error(f"PDF_TEXT_EXTRACTION_FAILED: {e}")
            return ""

    # Combine file and files
    all_upload_files = []
    if file:
        all_upload_files.append(file)
    if files:
        all_upload_files.extend(files)

    for f in all_upload_files:
        try:
            f_bytes = await f.read()
            ext = os.path.splitext(f.filename)[1].lower() or ".jpg"
            
            if ext == ".pdf":
                pdf_text = extract_text_from_pdf(f_bytes)
                if pdf_text:
                    msg_content += f"\n[Extracted PDF Report - {f.filename}]:\n{pdf_text}\n"
                else:
                    msg_content += f" (PDF Document attached: {f.filename})"
                
                # Auto-upload PDF to Cloud Storage
                if patient:
                    try:
                        from app.services.storage_service import StorageService
                        import io
                        storage = StorageService()
                        safe_filename = f"{uuid.uuid4()}.pdf"
                        s3_object_name = f"reports/{patient.hospyn_id or 'anon'}/{safe_filename}"
                        s3_url = await storage.upload_stream(
                            file_obj=io.BytesIO(f_bytes),
                            object_name=s3_object_name,
                            mime_type="application/pdf"
                        )
                        image_s3_urls.append(s3_url)
                    except Exception as upload_err:
                        logger.error(f"AUTO_SAVE_PDF_UPLOAD_FAILURE: {upload_err}")
            else:
                image_bytes_list.append(f_bytes)
                msg_content += f" (Image attached: {f.filename})"
                
                # Auto-upload image to Cloud Storage
                if patient:
                    try:
                        from app.services.storage_service import StorageService
                        import io
                        storage = StorageService()
                        safe_filename = f"{uuid.uuid4()}{ext}"
                        s3_object_name = f"reports/{patient.hospyn_id or 'anon'}/{safe_filename}"
                        s3_url = await storage.upload_stream(
                            file_obj=io.BytesIO(f_bytes),
                            object_name=s3_object_name,
                            mime_type=f.content_type or "image/jpeg"
                        )
                        image_s3_urls.append(s3_url)
                    except Exception as upload_err:
                        logger.error(f"AUTO_SAVE_IMAGE_UPLOAD_FAILURE: {upload_err}")
        except Exception as e:
            logger.error(f"Error processing attachment {f.filename}: {e}")

    if not msg_content:
        msg_content = "📎 Sent attachments"

    if audio:
        try:
            audio_bytes = await audio.read()
            msg_content += " (Voice message attached)"
        except Exception:
            pass

    # Save user message
    await ai.save_chat_message(
        user_id=str(current_user.id),
        conversation_id=conversation_id,
        role="user",
        content=msg_content,
        db=db
    )
    
    # Generate AI response using memory, vision, and language preference
    try:
        ai_text = await ai.chat_with_memory(
            str(current_user.id), 
            conversation_id, 
            msg_content, 
            family_member_id=active_member_id,
            image_bytes=image_bytes_list[0] if image_bytes_list else None, 
            image_bytes_list=image_bytes_list if image_bytes_list else None,
            audio_bytes=audio_bytes,
            language_code=language_code,
            db=db
        )
    except Exception as chat_err:
        logger.error(f"PATIENT_CHAT_ERROR: {chat_err}")
        ai_text = (
            "Hello! I am having a brief moment synchronizing my clinical memory network, but I am right here with you! "
            "Please try sending your message again, or let me know how you are feeling so I can assist you! 🩺❤️"
        )
    
    # Auto-save the vision/PDF scan records to their wallet/vault
    if patient and image_s3_urls:
        try:
            from datetime import datetime
            for s3_url in image_s3_urls:
                is_pdf = s3_url.lower().endswith(".pdf")
                rec_name = f"Chitti Report Scan ({datetime.now().strftime('%d %b %Y')})" if is_pdf else f"Chitti Vision Scan ({datetime.now().strftime('%d %b %Y')})"
                rec_type = "Chitti PDF Scan" if is_pdf else "Chitti Scan"
                
                new_record = models.MedicalRecord(
                    patient_id=patient.id,
                    family_member_id=active_member_id,
                    type=rec_type,
                    record_name=rec_name,
                    hospital_name="Chitti AI Companion",
                    file_url=s3_url,
                    raw_text="Chitti AI clinical document analysis.",
                    ai_summary=ai_text[:950] + "..." if len(ai_text) > 950 else ai_text,
                    patient_summary=ai_text
                )
                db.add(new_record)
            
            await db.commit()
            logger.info(f"AUTO_SAVED_CHITTI_SCAN_MULTIPLE: patient={patient.id} | count={len(image_s3_urls)}")
        except Exception as save_rec_err:
            await db.rollback()
            logger.error(f"AUTO_SAVE_RECORD_FAILURE: {save_rec_err}")
            
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

@router.get("/active-sharing")
async def get_active_sharing(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieve all active doctor access requests (granted status) for the patient."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.patient_id == current_patient.id,
        models.DoctorAccess.status == "granted"
    ).order_by(models.DoctorAccess.created_at.desc())
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "doctor_name": r.doctor_name,
            "clinic_name": r.clinic_name,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "granted_at": r.granted_at.isoformat() if r.granted_at else None,
        } for r in records
    ]

@router.get("/access-history")
async def get_patient_access_history(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Retrieve history of doctor access requests, approvals, and revocations for this patient."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.patient_id == current_patient.id
    ).order_by(models.DoctorAccess.created_at.desc())
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    history = []
    for r in records:
        history.append({
            "id": str(r.id),
            "doctor_name": r.doctor_name,
            "clinic_name": r.clinic_name,
            "status": r.status.value if hasattr(r.status, "value") else r.status,  # "requested", "granted", "revoked"
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "granted_at": r.granted_at.isoformat() if r.granted_at else None,
            "revoked_at": r.revoked_at.isoformat() if r.revoked_at else None,
            "last_accessed_at": r.last_accessed_at.isoformat() if hasattr(r, "last_accessed_at") and r.last_accessed_at else None
        })
    return history

@router.get("/notifications")
async def get_patient_notifications(
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Fetch all patient notifications, combining system alerts and pending doctor consent requests."""
    # 1. Fetch pending Doctor Access requests
    stmt_access = select(models.DoctorAccess).where(
        models.DoctorAccess.patient_id == current_patient.id,
        models.DoctorAccess.status == "requested"
    )
    res_access = await db.execute(stmt_access)
    pending_access = res_access.scalars().all()

    notifs = []
    
    # 2. Map pending consent requests to the notifications payload
    for r in pending_access:
        notifs.append({
            "id": f"consent-{r.id}",
            "type": "consent_request",
            "title": "Access Request",
            "body": f"{r.doctor_name} from {r.clinic_name or 'Hospyn Clinic'} is requesting access to your medical records.",
            "related_entity_id": str(r.id),
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

    # 3. Fetch standard system alerts/notifications from DB
    stmt_notifs = select(models.Notification).where(
        models.Notification.patient_id == current_patient.id
    ).order_by(models.Notification.created_at.desc())
    res_notifs = await db.execute(stmt_notifs)
    db_notifs = res_notifs.scalars().all()

    for n in db_notifs:
        notifs.append({
            "id": str(n.id),
            "type": "alert" if n.type == models.NotificationTypeEnum.alert else "message",
            "title": n.title,
            "body": n.body,
            "related_entity_id": str(n.doctor_user_id) if n.doctor_user_id else None,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })

    # 4. Sort all notifications chronologically (descending)
    notifs.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return notifs

@router.post("/approve-access/{access_id}")
async def approve_access(
    access_id: uuid.UUID,
    data: Optional[schemas.ApproveAccessRequest] = None,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Approve a doctor's request to view medical records securely. Supports one-tap fast approve or granular share."""
    # 1. Verify access request exists and belongs to this patient
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.id == access_id,
        models.DoctorAccess.patient_id == current_patient.id
    )
    result = await db.execute(stmt)
    access_req = result.scalar_one_or_none()
    
    if not access_req:
        raise HTTPException(status_code=404, detail="Access request not found")
        
    # 2. Verify Patient Password if password was supplied (Standard Vault mode)
    if data and data.password:
        from app.core import security
        stmt_user = select(models.User).where(models.User.id == current_patient.user_id)
        res_user = await db.execute(stmt_user)
        user = res_user.scalar_one_or_none()
        
        if not user or not security.verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=403, detail="Invalid confirmation password. Vault access denied.")
    
    # 3. Resolve record IDs to share (if empty/none, share all existing files)
    record_ids_to_share = []
    if data and data.record_ids:
        record_ids_to_share = data.record_ids
    else:
        stmt_recs = select(models.MedicalRecord.id).where(models.MedicalRecord.patient_id == current_patient.id)
        res_recs = await db.execute(stmt_recs)
        record_ids_to_share = res_recs.scalars().all()
        
    # 4. Save granular record shares
    for record_id in record_ids_to_share:
        # Check if already shared
        stmt_rec = select(models.MedicalRecord).where(
            models.MedicalRecord.id == record_id,
            models.MedicalRecord.patient_id == current_patient.id
        )
        res_rec = await db.execute(stmt_rec)
        if res_rec.scalar_one_or_none():
            # Check for existing active share
            stmt_existing = select(models.RecordShare).where(
                models.RecordShare.patient_id == current_patient.id,
                models.RecordShare.record_id == record_id,
                models.RecordShare.doctor_user_id == access_req.doctor_user_id,
                models.RecordShare.revoked == False
            )
            res_existing = await db.execute(stmt_existing)
            if not res_existing.scalar_one_or_none():
                share = models.RecordShare(
                    patient_id=current_patient.id,
                    record_id=record_id,
                    doctor_query=access_req.doctor_name,
                    doctor_user_id=access_req.doctor_user_id
                )
                db.add(share)
            
    # 5. Update status to granted
    access_req.status = "granted"
    from datetime import datetime
    access_req.granted_at = datetime.now()
    
    await db.commit()
    
    # 6. Trigger Real-time WebSocket event to Doctor
    from app.core.realtime import manager, RealtimeMessage
    try:
        await manager.send_personal_message(
            RealtimeMessage(
                type="access_granted",
                payload={
                    "access_id": str(access_req.id),
                    "patient_id": str(current_patient.id),
                    "hospyn_id": current_patient.hospyn_id,
                    "status": "granted"
                }
            ),
            user_id=access_req.doctor_user_id
        )
    except Exception as ws_err:
        logger.error(f"WS_NOTIFY_DOCTOR_FAILURE: {ws_err}")
        
    await log_audit_action(
        db, 
        user_id=current_patient.user_id, 
        action="ACCESS_GRANTED", 
        resource_type="CONSENT", 
        details={"doctor": access_req.doctor_name, "shared_files_count": len(record_ids_to_share)}
    )
    
    return {"status": "success", "message": f"Access granted to {access_req.doctor_name}"}

@router.post("/revoke-access/{access_id}")
async def revoke_access(
    access_id: uuid.UUID,
    current_patient: Any = Depends(deps.get_current_patient),
    db: AsyncSession = Depends(deps.get_db)
):
    """Revoke or reject a doctor's access, securing granular files and sending real-time kickout notifications."""
    stmt = select(models.DoctorAccess).where(
        models.DoctorAccess.id == access_id,
        models.DoctorAccess.patient_id == current_patient.id
    )
    result = await db.execute(stmt)
    access_req = result.scalar_one_or_none()
    
    if not access_req:
        raise HTTPException(status_code=404, detail="Access request not found")
    
    # 1. Update access status
    access_req.status = "revoked"
    from datetime import datetime
    access_req.revoked_at = datetime.now()
    
    # 2. Revoke granular record shares associated with this doctor and patient
    from sqlalchemy import update
    stmt_rs = update(models.RecordShare).where(
        models.RecordShare.patient_id == current_patient.id,
        models.RecordShare.doctor_user_id == access_req.doctor_user_id
    ).values(revoked=True)
    await db.execute(stmt_rs)
    
    await db.commit()
    
    # 3. Trigger Real-time WebSocket kickout notification to Doctor
    from app.core.realtime import manager, RealtimeMessage
    try:
        await manager.send_personal_message(
            RealtimeMessage(
                type="access_revoked",
                payload={
                    "access_id": str(access_req.id),
                    "patient_id": str(current_patient.id),
                    "hospyn_id": current_patient.hospyn_id,
                    "status": "revoked"
                }
            ),
            user_id=access_req.doctor_user_id
        )
    except Exception as ws_err:
        logger.error(f"WS_REVOKE_NOTIFY_FAILURE: {ws_err}")
        
    await log_audit_action(
        db, 
        user_id=current_patient.user_id, 
        action="ACCESS_REVOKED", 
        resource_type="CONSENT", 
        details={"doctor": access_req.doctor_name}
    )
    
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
