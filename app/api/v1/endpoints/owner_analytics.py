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
        # Dummy aggregations for now until we have complex patient queues wired to branches
        results.append({
            "branch_id": str(branch.id),
            "name": branch.name,
            "active_patients": 12, # TODO: aggregate actual active admissions for this branch
            "doctors_on_duty": 4,  # TODO: count active staff
            "avg_wait_time": "14 mins"
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
            "vitals_state": "BP: 120/80, Pulse: 72" # Mocked until vitals integration
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
            "ward_type": "ICU" # Hardcoded mock
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
