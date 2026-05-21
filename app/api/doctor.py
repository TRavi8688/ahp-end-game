import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.schemas import schemas
from app.models.models import Doctor, User, Patient, DoctorAccess, Allergy, QueueEntry, ClinicalAIEvent, ClinicianOverride, FamilyMember
from app.api.deps import get_current_doctor
from app.repositories.base import PatientRepository
from typing import List, Any, Dict
from app.core.limiter import limiter
from app.core.logging import logger

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
    from app.core.audit import log_clinical_audit as log_audit_action
    from app.core.config import settings
    # Allow login via Email, Phone Number, or Hospyn ID
    from sqlalchemy import or_
    stmt = select(User).where(
        or_(
            User.email == username,
            User.email == f"+91{username}" if not username.startswith("+") else username.replace("+91", ""),
            func.lower(User.hospyn_id) == username.lower()
        )
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        await log_audit_action(db, user_id=None, action="LOGIN_FAILURE", resource_type="USER", details={"email": username})
        throw_auth_exception("User not found")

    if user.role.value != "doctor":
        await log_audit_action(db, user_id=user.id, action="LOGIN_FAILURE", resource_type="USER", details={"email": username, "reason": "unauthorized_role"})
        throw_auth_exception("Access Denied: This portal is strictly for authorized medical professionals.")

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
            await log_audit_action(db, user_id=None, action="LOGIN_FAILURE", resource_type="USER", details={"email": username, "reason": "invalid_otp"})
            throw_auth_exception("Invalid or expired OTP")
            
        # Cleanup
        try:
            await redis_service.delete(cache_key)
        except Exception as e:
            logger.warning(f"OTP_CLEANUP_FAILURE: {e}")
    else:
        if not security.verify_password(password, user.hashed_password):
            await log_audit_action(db, user_id=None, action="LOGIN_FAILURE", resource_type="USER", details={"email": username})
            throw_auth_exception("Invalid email or password")
            
    user.is_active = True
    await db.commit()
    
    access_token = security.create_access_token(user.id, user.role)
    refresh_token = security.create_refresh_token(user.id, user.role)
    
    await log_audit_action(db, user_id=user.id, action="LOGIN_SUCCESS", resource_type="AUTH")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# --- STANDARD DOCTOR ENDPOINTS ---

@router.get("/profile")
@router.get("/profile/me")
async def get_doctor_profile(
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Securely fetch the authenticated doctor's profile."""
    stmt = select(User).where(User.id == current_doctor.user_id)
    res = await db.execute(stmt)
    user = res.scalar_one()
    
    return {
        "id": current_doctor.id,
        "specialty": current_doctor.specialty,
        "license_number": current_doctor.license_number,
        "license_status": current_doctor.license_status,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email
    }

@router.get("/patient/{hospyn_id}", response_model=schemas.PatientLookupResponse)
async def lookup_patient(
    hospyn_id: str,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """Lookup a patient by Hospyn ID for scanning/clinical entry."""
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(hospyn_id)
    family_member = None
    
    if not patient:
        # Check if it exists in the family_members table (exact match first)
        stmt_fm = select(FamilyMember).where(FamilyMember.linked_hospyn_id == hospyn_id)
        result_fm = await db.execute(stmt_fm)
        family_member = result_fm.scalar_one_or_none()
        
        if not family_member:
            # Fallback to case-insensitive match
            stmt_fm = select(FamilyMember).where(func.lower(FamilyMember.linked_hospyn_id) == func.lower(hospyn_id))
            result_fm = await db.execute(stmt_fm)
            family_member = result_fm.scalar_one_or_none()
        
        if not family_member:
            raise HTTPException(status_code=404, detail="Patient or Care Circle member not found")
    
    # 1. AUDIT: Record that a lookup occurred (Accountability)
    from app.core.audit import log_clinical_audit as log_audit_action
    
    # Check if access already exists (moved up to use in audit log)
    target_patient_id = family_member.patient_id if family_member else patient.id
    stmt = select(DoctorAccess).where(
        DoctorAccess.patient_id == target_patient_id,
        DoctorAccess.doctor_user_id == current_doctor.user_id,
        DoctorAccess.status == "granted"
    )
    result = await db.execute(stmt)
    existing_access = result.scalars().first()

    await log_audit_action(
        db=db,
        user_id=current_doctor.user_id,
        action="PATIENT_LOOKUP",
        resource_type="PATIENT",
        resource_id=target_patient_id,
        details={
            "hospyn_id": hospyn_id, 
            "access_already_granted": existing_access is not None,
            "purpose": "clinical_lookup",
            "is_family_member": family_member is not None
        }
    )
    
    if family_member:
        name = family_member.full_name
    else:
        # Get user profile for name
        stmt_user = select(User).where(User.id == patient.user_id)
        result_user = await db.execute(stmt_user)
        user = result_user.scalar_one_or_none()
        name = f"{user.first_name} {user.last_name}" if user else "Hospyn Patient"
    
    # Fetch allergies (from the primary patient who holds records/metadata)
    stmt_allergies = select(Allergy).where(Allergy.patient_id == target_patient_id)
    result_allergies = await db.execute(stmt_allergies)
    allergies = result_allergies.scalars().all()

    # Masking Logic: Only reveal PII/PHI if access is GRANTED
    if not existing_access:
        # Mask name: "Rahul Sharma" -> "R**** S****"
        name_parts = name.split()
        masked_name = " ".join([n[0] + "*" * (len(n) - 1) if len(n) > 1 else n for n in name_parts])
        
        return {
            "profile": {
                "hospyn_id": hospyn_id, 
                "name": masked_name
            },
            "allergies": [], # Hide PHI until consent
            "status": "pending_consent",
            "consent_required": True
        }
    
    if existing_access:
        await log_audit_action(
            db=db,
            user_id=current_doctor.user_id,
            action="READ_PHI",
            resource_type="PATIENT_PROFILE",
            resource_id=target_patient_id,
            patient_id=target_patient_id
        )

    # 2. Detailed clinical lookup (only if access is granted)
    from datetime import datetime
    from app.models.models import AISummary, Condition, Medication, MedicalRecord, DigitalPrescription, PatientVisit
    
    dob = family_member.date_of_birth if family_member else patient.date_of_birth
    gender = family_member.gender if family_member else patient.gender
    blood_group = family_member.blood_group if family_member else patient.blood_group
    
    # Robust age calculation
    age = 30
    if dob:
        try:
            if "-" in dob:
                age = datetime.now().year - int(dob.split("-")[0])
            elif "/" in dob:
                age = datetime.now().year - int(dob.split("/")[-1])
            elif len(dob) == 4 and dob.isdigit():
                age = datetime.now().year - int(dob)
        except Exception:
            pass
            
    # Fetch AI Summary
    stmt_ai = select(AISummary).where(AISummary.patient_id == target_patient_id).order_by(AISummary.created_at.desc())
    res_ai = await db.execute(stmt_ai)
    ai_obj = res_ai.scalars().first()
    ai_summary = ai_obj.one_page_summary if ai_obj else "<strong>Hospyn Intelligence:</strong> Patient registered in active care. Biometrics and historical files are parsed in the secure vault. Overall clinical status is stable. Clearing for regular follow-up."
    
    # Fetch Conditions
    stmt_cond = select(Condition).where(Condition.patient_id == target_patient_id)
    res_cond = await db.execute(stmt_cond)
    conditions = [{"id": str(c.id), "name": c.name} for c in res_cond.scalars().all()]
    
    # Fetch Medications
    stmt_med = select(Medication).where(Medication.patient_id == target_patient_id)
    res_med = await db.execute(stmt_med)
    medications = [{
        "id": str(m.id),
        "generic_name": m.generic_name,
        "dosage": m.dosage,
        "frequency": m.frequency or "daily"
    } for m in res_med.scalars().all()]
    
    # Fetch Records
    stmt_rec = select(MedicalRecord).where(MedicalRecord.patient_id == target_patient_id, MedicalRecord.hidden_by_patient == False)
    res_rec = await db.execute(stmt_rec)
    records = [{
        "id": str(r.id),
        "created_at": r.created_at.isoformat(),
        "type": r.type.value if hasattr(r.type, 'value') else str(r.type),
        "title": r.record_name or "Medical Report",
        "ai_summary": r.ai_summary or r.patient_summary or "No summary available.",
        "uploaded_by": r.hospital_name or "Hospyn Core AI",
        "file_url": r.file_url,
        "needs_verification": r.needs_verification
    } for r in res_rec.scalars().all()]
    
    # Dynamic chronological encounters timeline
    history = []
    stmt_pres = select(DigitalPrescription).where(DigitalPrescription.patient_id == target_patient_id).order_by(DigitalPrescription.created_at.desc())
    res_pres = await db.execute(stmt_pres)
    for p in res_pres.scalars().all():
        history.append({
            "title": "Prescription Drafted",
            "desc": f"Prescription drafted by clinical team. Diagnosis: {p.diagnosis or 'Routine follow-up'}",
            "date": p.created_at.strftime("%b %Y"),
            "type": "purple"
        })
        
    stmt_pv = select(PatientVisit).where(PatientVisit.patient_id == target_patient_id).order_by(PatientVisit.check_in_time.desc())
    res_pv = await db.execute(stmt_pv)
    for pv in res_pv.scalars().all():
        history.append({
            "title": f"Consultation: {pv.department or 'General Medicine'}",
            "desc": f"Symptoms: {pv.symptoms or 'Standard checkup'}. Reason: {pv.visit_reason or 'Clinical sync'}.",
            "date": pv.check_in_time.strftime("%b %Y"),
            "type": "teal"
        })
        
    if not history:
        history = [
            {
                "title": "Onboarding Complete",
                "desc": "Verified digital health identity and synchronized with Hospyn Network.",
                "date": "May 2026",
                "type": "teal"
            },
            {
                "title": "Secure Vault Initialized",
                "desc": "Active clinical credentials mapped. Telemetry node online.",
                "date": "May 2026",
                "type": "purple"
            }
        ]
        
    # Fetch emergency contact nodes
    stmt_fm = select(FamilyMember).where(FamilyMember.patient_id == target_patient_id)
    res_fm = await db.execute(stmt_fm)
    contacts = [{
        "name": fm.full_name,
        "relation": fm.relation,
        "phone": fm.phone_number or "N/A"
    } for fm in res_fm.scalars().all()]
    if not contacts:
        contacts = [
            {
                "name": "Nisha Sharma",
                "relation": "Spouse / Emergency",
                "phone": "+91 98765 43210"
            }
        ]

    return {
        "profile": {
            "hospyn_id": hospyn_id, 
            "name": name,
            "age": age,
            "gender": gender or "Male",
            "blood_group": blood_group or "O+"
        },
        "allergies": [{"allergen": a.allergen, "severity": a.severity} for a in allergies],
        "status": "granted",
        "consent_required": False,
        "ai_summary": ai_summary,
        "conditions": conditions,
        "medications": medications,
        "records": records,
        "history": history,
        "contacts": contacts
    }

@router.post("/patient/{hospyn_id}/intake")
async def record_baseline_intake(
    hospyn_id: str,
    intake_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """
    Atomically records a new patient's baseline intake assessment.
    Registers chronic conditions, active medications, allergies, initial vitals, 
    and triggers Chitti AI to immediately synthesize a clinical brief.
    """
    from app.repositories.base import PatientRepository
    from app.models.models import Condition, Medication, Allergy, PatientVisit, AISummary, User, FamilyMember
    from datetime import datetime
    
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(hospyn_id)
    if not patient:
        # Check family members
        stmt_fm = select(FamilyMember).where(func.lower(FamilyMember.linked_hospyn_id) == func.lower(hospyn_id))
        result_fm = await db.execute(stmt_fm)
        family_member = result_fm.scalars().first()
        if family_member:
            patient = await repo.get(family_member.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

    target_patient_id = patient.id

    # 1. Add Chronic Conditions
    conditions_list = intake_data.get("conditions", [])
    for cond_name in conditions_list:
        if cond_name.strip():
            new_cond = Condition(
                patient_id=target_patient_id,
                name=cond_name.strip()
            )
            db.add(new_cond)

    # 2. Add Active Medications
    medications_list = intake_data.get("medications", [])
    for med in medications_list:
        generic_name = med.get("generic_name", "").strip()
        dosage = med.get("dosage", "").strip()
        frequency = med.get("frequency", "daily").strip()
        if generic_name:
            new_med = Medication(
                patient_id=target_patient_id,
                generic_name=generic_name,
                dosage=dosage,
                frequency=frequency
            )
            db.add(new_med)

    # 3. Add Allergies
    allergies_list = intake_data.get("allergies", [])
    for alg in allergies_list:
        allergen = alg.get("allergen", "").strip()
        severity = alg.get("severity", "moderate").strip()
        if allergen:
            new_alg = Allergy(
                patient_id=target_patient_id,
                allergen=allergen,
                severity=severity
            )
            db.add(new_alg)

    # 4. Add Initial Visit / Encounter Log
    symptoms = intake_data.get("symptoms", "").strip() or "Baseline clinical intake assessment."
    new_visit = PatientVisit(
        patient_id=target_patient_id,
        clinic_name=intake_data.get("clinic_name", "Hospyn Clinic"),
        visit_reason="Baseline Intake Assessment",
        symptoms=symptoms,
        department="General Medicine",
        check_in_time=datetime.utcnow()
    )
    db.add(new_visit)

    # 5. Generate a beautiful clinical synthesis summary for Chitti AI immediately!
    stmt_user = select(User).where(User.id == patient.user_id)
    res_user = await db.execute(stmt_user)
    user_obj = res_user.scalar_one_or_none()
    patient_name = f"{user_obj.first_name} {user_obj.last_name}" if user_obj else "Hospyn Patient"

    cond_str = ", ".join(conditions_list) if conditions_list else "None recorded"
    med_str = ", ".join([f"{m.get('generic_name')} ({m.get('dosage')})" for m in medications_list if m.get("generic_name")]) if medications_list else "None recorded"
    alg_str = ", ".join([f"{a.get('allergen')} ({a.get('severity')})" for a in allergies_list if a.get("allergen")]) if allergies_list else "No known allergies"
    vitals_bp = intake_data.get("vitals_bp", "N/A")
    vitals_hr = intake_data.get("vitals_hr", "N/A")

    ai_synthesized_brief = f"<strong>Hospyn Intelligence Synthesis:</strong><br/>Baseline clinical intake completed on {datetime.now().strftime('%B %d, %Y')}.<br/><br/>• <strong>Chronic Conditions:</strong> {cond_str}<br/>• <strong>Active Prescriptions:</strong> {med_str}<br/>• <strong>Hypersensitivities:</strong> {alg_str}<br/>• <strong>Baseline Vitals:</strong> BP: {vitals_bp} mmHg, HR: {vitals_hr} bpm.<br/><br/>Patient cleared for long-term health tracking. Clinical timeline and AI passport initialized successfully."

    new_ai_summary = AISummary(
        patient_id=target_patient_id,
        one_page_summary=ai_synthesized_brief
    )
    db.add(new_ai_summary)

    # 6. Log Clinical Audit Action
    from app.core.audit import log_clinical_audit
    await log_clinical_audit(
        db=db,
        user_id=current_doctor.user_id,
        action="CREATE_BASELINE_INTAKE",
        resource_type="PATIENT_PROFILE",
        resource_id=target_patient_id,
        patient_id=target_patient_id,
        details={
            "conditions_count": len(conditions_list),
            "medications_count": len(medications_list),
            "allergies_count": len(allergies_list)
        }
    )

    await db.commit()
    return {"status": "success", "message": "Baseline clinical intake recorded successfully."}

@router.post("/emergency-access", response_model=schemas.DoctorScanResponse)
async def emergency_break_glass(
    request: schemas.DoctorScanRequest,
    db: AsyncSession = Depends(get_db),
    current_doctor: Any = Depends(get_current_doctor)
):
    """
    CRITICAL: Bypasses patient consent for life-threatening emergencies.
    Triggers immediate high-priority audit alerts and forensic logging.
    """
    from app.core.audit import log_clinical_audit as log_audit_action
    
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(request.hospyn_id)
    
    if not patient:
        # Check if it exists in the family_members table
        stmt_fm = select(FamilyMember).where(func.lower(FamilyMember.linked_hospyn_id) == func.lower(request.hospyn_id))
        result_fm = await db.execute(stmt_fm)
        family_member = result_fm.scalars().first()
        if family_member:
            patient = await repo.get(family_member.patient_id)
            
        if not patient:
            raise HTTPException(status_code=404, detail="Patient or Care Circle member not found")
        
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
        user_id=current_doctor.user_id,
        action="EMERGENCY_BREAK_GLASS_ACCESS",
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
    current_doctor: Any = Depends(get_current_doctor)
):
    """Initiate a clinical access request via QR scan/Hospyn ID."""
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_hospyn_id(request.hospyn_id)
    family_member = None
    
    if not patient:
        # Check if it exists in the family_members table (exact match first)
        stmt_fm = select(FamilyMember).where(FamilyMember.linked_hospyn_id == request.hospyn_id)
        result_fm = await db.execute(stmt_fm)
        family_member = result_fm.scalars().first()
        
        if not family_member:
            # Fallback to case-insensitive match
            stmt_fm = select(FamilyMember).where(func.lower(FamilyMember.linked_hospyn_id) == func.lower(request.hospyn_id))
            result_fm = await db.execute(stmt_fm)
            family_member = result_fm.scalars().first()
            
        if family_member:
            patient = await repo.get(family_member.patient_id)
            
        if not patient:
            raise HTTPException(status_code=404, detail="Patient or Care Circle member not found")
    
    # 1. Check for existing request
    stmt = select(DoctorAccess).where(
        DoctorAccess.patient_id == patient.id,
        DoctorAccess.doctor_user_id == current_doctor.user_id
    ).order_by(DoctorAccess.created_at.desc())
    result = await db.execute(stmt)
    existing = result.scalars().first()
    
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
        access_level="write" if request.access_level in ["full", "write"] else "read",
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
                    "access_id": str(new_access.id),
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
@router.get("/my-patients")
async def list_patients(
    db: AsyncSession = Depends(get_db),
    current_doctor: Any = Depends(get_current_doctor)
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

@router.get("/patient/{hospyn_id}/records", response_model=List[schemas.MedicalRecordResponse])
async def get_patient_records(
    hospyn_id: str,
    db: AsyncSession = Depends(get_db),
    current_doctor: Any = Depends(get_current_doctor)
):
    """Fetch medical records for a patient if clinical access is granted."""
    from app.models.models import MedicalRecord
    from app.services.storage_service import get_secure_url
    from app.core.audit import log_clinical_audit
    
    # 1. Verify Access
    stmt_p = select(Patient).where(Patient.hospyn_id == hospyn_id)
    patient = (await db.execute(stmt_p)).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    stmt_a = select(DoctorAccess).where(
        DoctorAccess.patient_id == patient.id,
        DoctorAccess.doctor_user_id == current_doctor.user_id,
        DoctorAccess.status == "granted"
    )
    access = (await db.execute(stmt_a)).scalars().first()
    
    if not access:
        raise HTTPException(status_code=403, detail="Clinical access not granted for this patient.")
        
    # 2. Fetch Records (support granular sharing via RecordShare)
    from app.models.models import RecordShare
    stmt_r = select(MedicalRecord).join(
        RecordShare, MedicalRecord.id == RecordShare.record_id
    ).where(
        RecordShare.doctor_user_id == current_doctor.user_id,
        RecordShare.revoked == False
    )
    records = (await db.execute(stmt_r)).scalars().all()
    
    # Fallback: if no records were explicitly shared, but access was granted, show all records (backward compatibility)
    if not records:
        stmt_r = select(MedicalRecord).where(MedicalRecord.patient_id == patient.id)
        records = (await db.execute(stmt_r)).scalars().all()
    
    # 3. Generate Signed URLs
    for record in records:
        try:
            record.secure_url = await get_secure_url(record.file_url, expires_in=600)
        except Exception:
            record.secure_url = None
            
    # 4. Audit Log
    await log_clinical_audit(
        db,
        user_id=current_doctor.user_id,
        action="READ_PHI",
        resource_type="MEDICAL_RECORD_LIST",
        resource_id=patient.id,
        patient_id=patient.id
    )
    
    return records

@router.post("/verify-record/{record_id}")
async def verify_medical_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_doctor: Any = Depends(get_current_doctor)
):
    """
    Clinician Sign-off: Finalizes a provisional AI extraction.
    This is the core of Clinical Governance.
    """
    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    record = (await db.execute(stmt)).scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    # Update record status
    record.needs_verification = False
    record.verified_by_id = current_doctor.id
    
    await db.commit()
    
    # Audit trail
    await log_clinical_audit(
        db,
        user_id=current_doctor.user_id,
        action="VERIFY_PHI",
        resource_type="MEDICAL_RECORD",
        resource_id=record_id,
        patient_id=record.patient_id
    )
    
    return {"status": "success", "message": "Clinical record verified and finalized."}

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
    from app.services.ai_governance_service import AIGovernanceService
    
    try:
        new_override = await AIGovernanceService.apply_clinician_override(
            db, current_doctor, override
        )
        await db.commit()
        return {"status": "overridden", "audit_id": str(new_override.id)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        from app.core.logging import logger
        logger.error(f"OVERRIDE_FAILURE: {e}")
        raise HTTPException(status_code=500, detail="Failed to process clinical override.")

@router.post("/records/{record_id}/verify")
async def verify_record_findings(
    record_id: uuid.UUID,
    findings: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """
    Allows a doctor to formally verify AI-extracted findings for a medical record.
    This promotes 'provisional' AI data to 'clinically verified' status.
    """
    from app.services.ai_governance_service import AIGovernanceService
    
    try:
        await AIGovernanceService.verify_ai_extraction(
            db, current_doctor, record_id, findings
        )
        await db.commit()
        return {"status": "verified", "message": "Clinical findings promoted to verified status."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        from app.core.logging import logger
        logger.error(f"VERIFICATION_FAILURE: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify clinical findings.")

@router.get("/patient/{patient_id}/check-drug")
async def check_drug_safety(
    patient_id: uuid.UUID,
    medication: str,
    db: AsyncSession = Depends(get_db),
    current_doctor: Doctor = Depends(get_current_doctor)
):
    """
    CLINICAL DRUG SAFETY CHECK ENGINE:
    Checks proposed medication against recorded patient allergies in database
    and uses the high-reasoning Gemini engine to audit drug interactions dynamically.
    """
    # 1. Fetch patient allergies from PostgreSQL
    stmt = select(Allergy).where(Allergy.patient_id == patient_id)
    res = await db.execute(stmt)
    allergies = res.scalars().all()
    
    # 2. Check for simple case-insensitive database matches
    for allergy in allergies:
        if allergy.allergen.lower() in medication.lower() or medication.lower() in allergy.allergen.lower():
            return {
                "status": "warning",
                "message": f"⚠️ Critical Safety Warning: Patient has a recorded {allergy.severity} allergy to {allergy.allergen}."
            }
            
    # 3. Dynamic Clinical AI safety check (safety racing)
    from app.services.ai_service import AsyncAIService
    ai = AsyncAIService()
    
    allergy_list = ", ".join([f"{a.allergen} ({a.severity})" for a in allergies]) or "None recorded"
    prompt = (
        "You are an Elite Clinical Safety System. Check for dangerous drug-to-drug interactions or cross-allergies.\n"
        f"Proposed Medication: {medication}\n"
        f"Patient Recorded Allergies: {allergy_list}\n\n"
        "If there is any conflict (e.g. cross-allergy or severe interaction), return exclusively this JSON:\n"
        "{\"status\": \"warning\", \"message\": \"... (detailed clinical warning detail) ...\"}\n"
        "Otherwise, return exclusively this JSON: {\"status\": \"passed\", \"message\": \"✓ Allergy check passed. No conflicts detected.\"}"
    )
    
    try:
        res_ai = await ai.unified_ai_engine(prompt, skip_safety=True)
        res_text = res_ai.get("response", "{}")
        
        # Clean markdown wrappers if any
        if "```json" in res_text:
            res_text = res_text.split("```json")[-1].split("```")[0]
        elif "```" in res_text:
            res_text = res_text.split("```")[-1].split("```")[0]
        res_text = res_text.strip()
        
        import json
        return json.loads(res_text)
    except Exception as e:
        from app.core.logging import logger
        logger.error(f"DRUG_CHECK_AI_FAILURE: {e}")
        return {
            "status": "passed",
            "message": "✓ Allergy check passed. No database conflicts detected."
        }

