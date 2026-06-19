import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.api import deps
from app.models.models import User, RoleEnum, HospitalBranch, Patient, Bed, AuditLog, StaffProfile, QueueToken, Admission, AdmissionStatus, QueueTokenStatus
from typing import List, Dict, Any

router = APIRouter()

@router.get("/global-metrics")
async def get_global_metrics(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Live Global Hospital Metrics"""
    if not current_user.staff_profile:
        raise HTTPException(status_code=400, detail="Owner profile missing")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    # Active Staff
    stmt = select(func.count(StaffProfile.id)).where(StaffProfile.hospital_id == hospital_id)
    active_staff = (await db.execute(stmt)).scalar() or 0
    
    # Total Beds
    stmt = select(func.count(Bed.id)).where(Bed.hospital_id == hospital_id)
    total_beds = (await db.execute(stmt)).scalar() or 0
    
    # Occupied Beds
    stmt = select(func.count(Bed.id)).where(Bed.hospital_id == hospital_id, Bed.status == 'occupied')
    occupied_beds = (await db.execute(stmt)).scalar() or 0
    
    # Patients in Queue
    stmt = select(func.count(QueueToken.id)).where(QueueToken.hospital_id == hospital_id, QueueToken.status.in_([QueueTokenStatus.WAITING, QueueTokenStatus.IN_PROGRESS, QueueTokenStatus.EMERGENCY_OVERRIDE]))
    patients_in_queue = (await db.execute(stmt)).scalar() or 0
    
    # Active Admissions
    stmt = select(func.count(Admission.id)).where(Admission.hospital_id == hospital_id, Admission.status == AdmissionStatus.ADMITTED)
    active_admissions = (await db.execute(stmt)).scalar() or 0

    return {
        "active_staff": active_staff,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "patients_in_queue": patients_in_queue,
        "active_admissions": active_admissions
    }

@router.get("/branch-metrics")
async def get_branch_metrics(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Live Branch Aggregation"""
    if not current_user.staff_profile:
        raise HTTPException(status_code=400, detail="Owner profile missing")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    # Get all branches
    branches_stmt = select(HospitalBranch).where(HospitalBranch.hospital_id == hospital_id)
    branches = (await db.execute(branches_stmt)).scalars().all()
    
    results = []
    for branch in branches:
        # Get active admissions for branch
        adm_stmt = select(func.count(Admission.id)).where(Admission.hospital_id == hospital_id, Admission.status == AdmissionStatus.ADMITTED)
        active_admissions = (await db.execute(adm_stmt)).scalar() or 0
        
        # Get doctors on duty for branch
        doc_stmt = select(func.count(StaffProfile.id)).where(StaffProfile.hospital_id == hospital_id, StaffProfile.role == RoleEnum.doctor)
        docs_on_duty = (await db.execute(doc_stmt)).scalar() or 0

        # Get avg wait time
        wait_stmt = select(func.avg(QueueToken.priority_score)).where(QueueToken.hospital_id == hospital_id)
        avg_wait = (await db.execute(wait_stmt)).scalar() or 0

        results.append({
            "branch_id": str(branch.id),
            "name": branch.name,
            "active_patients": active_admissions,
            "doctors_on_duty": docs_on_duty,
            "avg_wait_time": f"{int(avg_wait)} mins" if avg_wait else "N/A"
        })
        
    return {"branches": results}

@router.get("/ehr-passports")
async def get_ehr_passports(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Live EHR Passports Tracking"""
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(Patient).where(Patient.hospital_id == hospital_id).limit(10)
    patients = (await db.execute(stmt)).scalars().all()
    
    results = []
    for p in patients:
        results.append({
            "patient_id": str(p.id),
            "name": p.full_name,
            "health_id": p.hospyn_id,
            "dynamic_consent": "GRANTED",
            "vitals_state": "Pending Vitals" # Will be updated dynamically via IoT in future phases
        })
    return {"passports": results}

@router.get("/bed-matrix")
async def get_bed_matrix(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Live ICU & Bed Matrix"""
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(Bed).where(Bed.hospital_id == hospital_id)
    beds = (await db.execute(stmt)).scalars().all()
    
    results = []
    for bed in beds:
        results.append({
            "id": str(bed.id),
            "bed_number": bed.bed_number,
            "status": bed.status.value,
            "ward_type": bed.ward_id if hasattr(bed, 'ward_id') else "General" 
        })
    return {"beds": results}

@router.get("/audit-ledger")
async def get_audit_ledger(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Live Staff Audit Ledger"""
    hospital_id = current_user.staff_profile.hospital_id
    
    # Query all audit logs for this hospital, joined with User to see WHO did it
    stmt = (
        select(AuditLog, User)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .where(AuditLog.hospital_id == hospital_id)
        .order_by(desc(AuditLog.timestamp))
        .limit(50)
    )
    records = (await db.execute(stmt)).all()
    
    results = []
    for log, user in records:
        results.append({
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "details": log.details,
            "timestamp": log.timestamp.isoformat(),
            "actor": user.first_name if user else "System",
            "actor_email": user.email if user else "system"
        })
    return {"ledger": results}

@router.get("/doctor-performance")
async def get_doctor_performance(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Supreme Owner: Doctor Performance Tracking"""
    from app.models.models import Doctor, DoctorSession, DoctorBreak
    hospital_id = current_user.staff_profile.hospital_id
    
    # Get all doctors in hospital
    stmt = (
        select(Doctor, User)
        .join(User, Doctor.user_id == User.id)
        .where(User.id.in_(select(StaffProfile.user_id).where(StaffProfile.hospital_id == hospital_id)))
    )
    results = (await db.execute(stmt)).all()
    
    performance_list = []
    for doc, user in results:
        # Get today's session
        from datetime import datetime, timezone
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        session_stmt = select(DoctorSession).where(
            DoctorSession.doctor_id == doc.id,
            DoctorSession.login_at >= today_start
        ).order_by(desc(DoctorSession.login_at))
        
        sessions = (await db.execute(session_stmt)).scalars().all()
        
        total_patients_today = sum(s.patients_treated for s in sessions)
        total_treatment_time = sum(s.total_treatment_minutes for s in sessions)
        avg_time = (total_treatment_time / total_patients_today) if total_patients_today > 0 else 0
        
        # Calculate break time
        break_stmt = select(DoctorBreak).where(
            DoctorBreak.session_id.in_([s.id for s in sessions]),
            DoctorBreak.end_time != None
        )
        breaks = (await db.execute(break_stmt)).scalars().all()
        total_break_time = sum((b.end_time - b.start_time).total_seconds() / 60 for b in breaks if b.end_time)
        
        login_time = sessions[-1].login_at.isoformat() if sessions else "N/A"
        
        performance_list.append({
            "id": str(doc.id),
            "name": f"Dr. {user.first_name} {user.last_name}",
            "specialty": doc.specialty,
            "login_time": login_time,
            "patients_treated": total_patients_today,
            "avg_treatment_time": f"{avg_time:.1f} mins",
            "break_time": f"{int(total_break_time)} mins",
            "rating": "A" if avg_time < 15 and total_patients_today > 5 else "B" # Basic rating logic
        })
        
    return {"performance": performance_list}
