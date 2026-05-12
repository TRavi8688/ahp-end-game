from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Doctor, User, Patient, DoctorAccess, Allergy, QueueEntry, ClinicalAIEvent, ClinicianOverride
from app.api.deps import get_current_doctor
from app.repositories.base import PatientRepository
from typing import List
from app.core.limiter import limiter

router = APIRouter(prefix="/doctor", tags=["Doctor"])

# --- COMPATIBILITY ENDPOINTS for React Doctor App ---

@router.post("/send-otp")
async def doctor_send_otp(req: schemas.OTPRequest):
    """Alias for /auth/send-otp used by React Doctor App."""
    from app.api.auth import send_otp
    return await send_otp(req)

@router.post("/token")
@limiter.limit("10/minute")
async def doctor_token(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Compatibility login for React Doctor App. 
    Handles 'identifier' and 'password_or_otp' from form-data.
    """
    form_data = await request.form()
    username = form_data.get("identifier")
    password = form_data.get("password_or_otp")
    is_otp = form_data.get("is_otp") == "true"

    # Logic similar to auth.login but with different field names
    from app.core import security
    from app.api.auth import throw_auth_exception
    from app.core.audit import log_audit_action
    from app.core.config import settings
    # Standard lookup
    result = await db.execute(select(User).where(User.email == username))
    user = result.scalars().first()

    if not user:
        await log_audit_action(db, "LOGIN_FAILURE", resource_type="USER", details={"email": username})
        throw_auth_exception("User not found")

    if is_otp:
        # Validate Real OTP via Redis (Mandatory for Scalability)
        from app.services.redis_service import redis_service
        
        cache_key = f"otp:{username}"
        try:
            stored_otp = await redis_service.get(cache_key)
        except Exception as e:
            logger.error(f"OTP_VERIFY_CACHE_FAILURE: Redis required. Error: {e}")
            throw_auth_exception("Authentication system (Redis) is temporarily unavailable.")
            
        if not stored_otp or stored_otp != password:
            await log_audit_action(db, "LOGIN_FAILURE", resource_type="USER", details={"email": username, "reason": "invalid_otp"})
            throw_auth_exception("Invalid or expired OTP")
            
        # Cleanup
        try:
            await redis_service.delete(cache_key)
        except Exception as e:
            logger.warning(f"OTP_CLEANUP_FAILURE: {e}")
    else:
        if not security.verify_password(password, user.hashed_password):
            await log_audit_action(db, "LOGIN_FAILURE", resource_type="USER", details={"email": username})
            throw_auth_exception("Invalid email or password")
            
    user.is_active = True
    await db.commit()
    
    access_token = security.create_access_token(user.id, user.role)
    refresh_token = security.create_refresh_token(user.id, user.role)
    
    await log_audit_action(db, "LOGIN_SUCCESS", user_id=user.id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# --- STANDARD DOCTOR ENDPOINTS ---

@router.get("/profile", response_model=schemas.DoctorResponse)
@router.get("/profile/me", response_model=schemas.DoctorResponse)
async def get_doctor_profile(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Securely fetch the authenticated doctor's profile."""
    # Ensure User data is loaded if needed, or return the model if it has attributes
    return current_doctor

@router.get("/patient/{hospyn_id}", response_model=schemas.PatientLookupResponse)
async def lookup_patient(
    hospyn_id: str,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Lookup a patient by Hospyn ID for scanning/clinical entry."""
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(hospyn_id)
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # 1. AUDIT: Record that a lookup occurred (Accountability)
    from app.core.audit import log_audit_action
    
    # Check if access already exists (moved up to use in audit log)
    stmt = select(DoctorAccess).where(
        DoctorAccess.patient_id == patient.id,
        DoctorAccess.doctor_user_id == current_doctor.user_id,
        DoctorAccess.status == "granted"
    )
    result = await db.execute(stmt)
    existing_access = result.scalar_one_or_none()

    await log_audit_action(
        db=db,
        action="PATIENT_LOOKUP",
        user_id=current_doctor.user_id,
        resource_type="PATIENT",
        resource_id=patient.id,
        details={
            "hospyn_id": hospyn_id, 
            "access_already_granted": existing_access is not None,
            "purpose": "clinical_lookup"
        }
    )
    
    # Get user profile for name
    stmt_user = select(User).where(User.id == patient.user_id)
    result_user = await db.execute(stmt_user)
    user = result_user.scalar_one_or_none()
    name = f"{user.first_name} {user.last_name}" if user else "Hospyn Patient"
    
    # Fetch allergies
    stmt_allergies = select(Allergy).where(Allergy.patient_id == patient.id)
    result_allergies = await db.execute(stmt_allergies)
    allergies = result_allergies.scalars().all()

    # Masking Logic: Only reveal PII/PHI if access is GRANTED
    if not existing_access:
        # Mask name: "Rahul Sharma" -> "R**** S****"
        name_parts = name.split()
        masked_name = " ".join([n[0] + "*" * (len(n) - 1) if len(n) > 1 else n for n in name_parts])
        
        return {
            "profile": {
                "hospyn_id": patient.hospyn_id, 
                "name": masked_name
            },
            "allergies": [], # Hide PHI until consent
            "status": "pending_consent",
            "consent_required": True
        }
    
    return {
        "profile": {"hospyn_id": patient.hospyn_id, "name": name},
        "allergies": [{"allergen": a.allergen, "severity": a.severity} for a in allergies],
        "status": "granted"
    }

@router.post("/emergency-access", response_model=schemas.DoctorScanResponse)
async def emergency_break_glass(
    request: schemas.DoctorScanRequest,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """
    CRITICAL: Bypasses patient consent for life-threatening emergencies.
    Triggers immediate high-priority audit alerts and forensic logging.
    """
    from app.core.audit import log_audit_action
    
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(request.hospyn_id)
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # 1. Create Break-Glass Access Record
    new_access = DoctorAccess(
        patient_id=patient.id,
        doctor_user_id=current_doctor.user_id,
        doctor_name="EMERGENCY_OVERRIDE",
        clinic_name=request.clinic_name,
        access_level="read", # Emergency is usually read-only for history
        status="granted",
        granted_at=func.now()
    )
    db.add(new_access)
    
    # 2. Forensic Audit Log (High Priority)
    await log_audit_action(
        db=db,
        action="EMERGENCY_BREAK_GLASS_ACCESS",
        user_id=current_doctor.user_id,
        resource_type="PATIENT_PHI",
        resource_id=patient.id,
        details={
            "justification": "Emergency Clinical Override",
            "hospyn_id": request.hospyn_id,
            "clinic": request.clinic_name
        }
    )
    
    await db.commit()
    
    return {
        "status": "success",
        "message": "EMERGENCY ACCESS GRANTED. This action has been logged and reported to the compliance department.",
        "access_id": new_access.id
    }

@router.post("/scan-patient", response_model=schemas.DoctorScanResponse)
async def scan_patient(
    request: schemas.DoctorScanRequest,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Initiate a clinical access request via QR scan/Hospyn ID."""
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(request.hospyn_id)
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # 1. Check for existing request
    stmt = select(DoctorAccess).where(
        DoctorAccess.patient_id == patient.id,
        DoctorAccess.doctor_user_id == current_doctor.user_id
    ).order_by(DoctorAccess.created_at.desc())
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing and existing.status == "granted":
        return {"status": "success", "message": "Access already granted."}
    
    # 2. Create new request
    stmt_user = select(User).where(User.id == current_doctor.user_id)
    res_user = await db.execute(stmt_user)
    doctor_user = res_user.scalar_one()
    
    new_access = DoctorAccess(
        patient_id=patient.id,
        doctor_user_id=current_doctor.user_id,
        doctor_name=f"Dr. {doctor_user.last_name}",
        clinic_name=request.clinic_name,
        access_level=request.access_level,
        status="requested"
    )
    db.add(new_access)
    await db.commit()
    await db.refresh(new_access)
    
    # 3. Trigger Real-time Notification
    from app.core.realtime import manager, RealtimeMessage, MessageType
    try:
        await manager.send_personal_message(
            RealtimeMessage(
                type=MessageType.CONSENT_REQUEST,
                payload={
                    "access_id": new_access.id,
                    "doctor_name": new_access.doctor_name,
                    "clinic_name": new_access.clinic_name,
                    "message": f"{new_access.doctor_name} from {new_access.clinic_name} is requesting access to your medical records."
                }
            ),
            user_id=patient.user_id
        )
    except Exception as e:
        from app.core.logging import logger
        logger.error(f"Failed to send real-time consent request: {e}")
    
    return {
        "status": "pending",
        "message": "Access request sent to patient.",
        "access_id": new_access.id
    }

@router.get("/patients")
async def list_patients(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """List patients that this doctor has clinical access to."""
    stmt = select(DoctorAccess, Patient, User).join(
        Patient, DoctorAccess.patient_id == Patient.id
    ).join(
        User, Patient.user_id == User.id
    ).where(
        DoctorAccess.doctor_user_id == current_doctor.user_id,
        DoctorAccess.status == "granted"
    )
    result = await db.execute(stmt)
    
    patients = []
    for access, patient, user in result:
        patients.append({
            "hospyn_id": patient.hospyn_id,
            "name": f"{user.first_name} {user.last_name}",
            "access_level": access.access_level,
            "granted_at": access.granted_at
        })
    return patients

@router.get("/stats")
async def get_doctor_stats(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Fetch dashboard statistics for the doctor."""
    # 1. Patients Count
    stmt_p = select(func.count(DoctorAccess.id)).where(
        DoctorAccess.doctor_user_id == current_doctor.user_id,
        DoctorAccess.status == "granted"
    )
    patients_count = (await db.execute(stmt_p)).scalar() or 0

    # 2. Schedule Count (Mock for now or use actual appointments if they existed)
    schedule_count = 0 

    # 3. Alerts Count
    # In a real app, this would query an Alerts table. For now, let's return a sample count.
    alerts_count = 2

    # 4. Pending Rx Count
    # Mocking for demo
    pending_rx_count = 0

    return {
        "patients_count": patients_count,
        "schedule_count": schedule_count,
        "alerts_count": alerts_count,
        "pending_rx_count": pending_rx_count
    }

@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Doctor-specific health analytics with sample data for UI visualization."""
    return {
        "total_patients": 42,
        "stable_count": 35,
        "followup_count": 5,
        "high_risk_count": 2,
        "conditions": [
            {"label": "Hypertension", "percent": 45, "color": "#3b82f6"},
            {"label": "Diabetes", "percent": 30, "color": "#10b981"},
            {"label": "Asthma", "percent": 15, "color": "#f59e0b"},
            {"label": "Other", "percent": 10, "color": "#ef4444"}
        ],
        "weekly_stats": [
            {"day": "Mon", "count": 12, "max": 20},
            {"day": "Tue", "count": 18, "max": 20},
            {"day": "Wed", "count": 15, "max": 20},
            {"day": "Thu", "count": 10, "max": 20},
            {"day": "Fri", "count": 14, "max": 20}
        ],
        "alerts": [
            {"title": "Amoxicillin Conflict", "patient_name": "Rahul Sharma", "date": "2 hours ago", "status": "Prevented"}
        ]
    }

@router.get("/alerts")
async def get_doctor_alerts(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Fetch active alerts for the doctor dashboard."""
    # Mocking for React App UI demo
    return [
        {
            "id": 1,
            "type": "drug",
            "title": "Clinical Safety Alert",
            "desc": "Potential drug interaction detected for Amoxicillin prescription.",
            "time": "2 hours ago",
            "unread": True
        },
        {
            "id": 2,
            "type": "granted",
            "title": "Access Granted",
            "desc": "Rahul Sharma has approved your access request.",
            "time": "5 hours ago",
            "unread": True
        }
    ]

@router.get("/access-history")
async def get_access_history(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Fetch history of patient records accessed/shared."""
    # Joining access history with patient/user names
    stmt = select(DoctorAccess, Patient, User).join(
        Patient, DoctorAccess.patient_id == Patient.id
    ).join(
        User, Patient.user_id == User.id
    ).where(
        DoctorAccess.doctor_user_id == current_doctor.user_id
    ).order_by(DoctorAccess.created_at.desc())
    
    result = await db.execute(stmt)
    
    history = []
    for access, patient, user in result:
        history.append({
            "id": access.id,
            "patient_name": f"{user.first_name} {user.last_name}",
            "hospyn_id": patient.hospyn_id,
            "type": "Clinical Record",
            "typeRaw": "all",
            "ai_summary": "Access granted to patient longitudinal record.",
            "date": access.created_at.strftime("%Y-%m-%d"),
            "status": access.status
        })
    return history

# Queue Management Endpoints
@router.post("/queue/join", response_model=schemas.QueueEntryResponse)
async def join_queue(
    request: schemas.QueueEntryBase,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Check a patient into the clinical queue."""
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(request.hospyn_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get user for name
    stmt_user = select(User).where(User.id == patient.user_id)
    res_user = await db.execute(stmt_user)
    user = res_user.scalar_one()

    # Determine token number (simple count for the day)
    stmt_count = select(func.count(QueueEntry.id)).where(
        QueueEntry.doctor_id == current_doctor.id,
        func.date(QueueEntry.check_in_time) == func.current_date()
    )
    res_count = await db.execute(stmt_count)
    token = res_count.scalar() + 1

    new_entry = QueueEntry(
        patient_id=patient.id,
        doctor_id=current_doctor.id,
        clinic_name=request.clinic_name,
        token_number=token,
        status="waiting"
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)

    return {
        "id": new_entry.id,
        "patient_name": f"{user.first_name} {user.last_name}",
        "hospyn_id": patient.hospyn_id,
        "status": new_entry.status,
        "token_number": new_entry.token_number,
        "check_in_time": new_entry.check_in_time
    }

@router.get("/queue", response_model=List[schemas.QueueEntryResponse])
async def get_queue(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Fetch the active clinical queue for this doctor."""
    stmt = select(QueueEntry, Patient, User).join(
        Patient, QueueEntry.patient_id == Patient.id
    ).join(
        User, Patient.user_id == User.id
    ).where(
        QueueEntry.doctor_id == current_doctor.id,
        QueueEntry.status.in_(["waiting", "active"])
    ).order_by(QueueEntry.token_number.asc())
    
    result = await db.execute(stmt)
    
    queue = []
    for entry, patient, user in result:
        queue.append({
            "id": entry.id,
            "patient_name": f"{user.first_name} {user.last_name}",
            "hospyn_id": patient.hospyn_id,
            "status": entry.status,
            "token_number": entry.token_number,
            "check_in_time": entry.check_in_time
        })
    return queue

@router.put("/queue/{entry_id}", response_model=schemas.QueueEntryResponse)
async def update_queue_status(
    entry_id: int,
    update: schemas.QueueUpdate,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Update a patient's status in the queue."""
    stmt = select(QueueEntry).where(
        QueueEntry.id == entry_id,
        QueueEntry.doctor_id == current_doctor.id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    
    entry.status = update.status
    if update.status == "completed":
        entry.completed_at = func.now()
        
    await db.commit()
    await db.refresh(entry)
    
    # Get patient/user info for response
    stmt_info = select(Patient, User).join(User, Patient.user_id == User.id).where(Patient.id == entry.patient_id)
    res_info = await db.execute(stmt_info)
    patient, user = res_info.one()
    
    return {
        "id": entry.id,
        "patient_name": f"{user.first_name} {user.last_name}",
        "hospyn_id": patient.hospyn_id,
        "status": entry.status,
        "token_number": entry.token_number,
        "check_in_time": entry.check_in_time
    }

# --- AI GOVERNANCE: CLINICIAN SUPREMACY ---

@router.post("/ai/override", status_code=201)
async def override_ai_recommendation(
    override: schemas.AIOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """
    Clinician Override: Allows formal correction of AI findings.
    Mandatory for medical-legal accountability.
    """
    # 1. Verify AI Event exists
    result = await db.execute(select(ClinicalAIEvent).where(ClinicalAIEvent.id == override.ai_event_id))
    ai_event = result.scalars().first()
    if not ai_event:
        raise HTTPException(status_code=404, detail="AI Event not found for forensics replay.")

    # 2. Record the Override
    new_override = ClinicianOverride(
        hospital_id=current_doctor.user.staff_profile.hospital_id,
        ai_event_id=override.ai_event_id,
        doctor_user_id=current_doctor.user_id,
        override_type=override.override_type,
        justification=override.justification,
        correction_text=override.correction_text,
        severity_impact=override.severity_impact
    )
    
    # 3. Mark the AI event as overridden
    ai_event.overridden = True
    
    db.add(new_override)
    await db.commit()
    
    # 4. Trigger Retraining/Alerting Pipeline
    # (In a real system, this would push to a specialized queue for safety engineers)
    from app.core.audit import log_audit_action
    await log_audit_action(
        db, 
        action="AI_CLINICAL_OVERRIDE", 
        user_id=current_doctor.user_id,
        resource_type="AI_EVENT",
        resource_id=ai_event.id,
        details={"type": override.override_type, "severity": override.severity_impact}
    )
    
    return {"status": "overridden", "audit_id": str(new_override.id)}

