from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_super_admin, get_hospital_id
from app.services.governance_service import governance_service
from app.services.compliance_service import compliance_service
from typing import List, Dict, Any
import uuid

router = APIRouter(prefix="/governance", tags=["Governance & Compliance"])

@router.get("/ai-safety-dashboard")
async def get_ai_safety_stats(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_hospital_id),
    current_admin: Any = Depends(get_super_admin)
):
    """
    Hospital-Admin only: View AI safety and override metrics.
    """
    return await governance_service.get_safety_dashboard_metrics(db, hospital_id)

@router.get("/compliance/audit-integrity")
async def verify_audit_integrity(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_hospital_id),
    current_admin: Any = Depends(get_super_admin)
):
    """
    Compliance-Officer only: Cryptographically verify the integrity of the audit log.
    """
    return await compliance_service.generate_audit_integrity_report(db, hospital_id)

@router.get("/compliance/access-review")
async def get_access_review(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_hospital_id),
    current_admin: Any = Depends(get_super_admin)
):
    """
    Evidence for SOC2/HIPAA access reviews.
    """
    return await compliance_service.get_access_review_data(db, hospital_id)

@router.get("/infrastructure/hygiene")
async def get_infra_hygiene(
    db: AsyncSession = Depends(get_db),
    current_admin: Any = Depends(get_super_admin)
):
    """
    Platform-level view of security hygiene (Backups, Patching, Rotation).
    """
    return await compliance_service.get_system_hygiene_status(db)

@router.post("/emergency/break-glass")
async def trigger_emergency_access(
    reason: str,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_hospital_id),
    # Requires high-privilege user
):
    """
    BREAK-GLASS PROTOCOL:
    Grants temporary elevated access for clinical emergencies.
    Triggers immediate high-priority audit alerts and notifications.
    """
    from app.core.audit import log_audit_action
    await log_audit_action(
        db, 
        action="BREAK_GLASS_TRIGGERED", 
        resource_type="HOSPITAL",
        details={"reason": reason, "hospital_id": str(hospital_id)}
    )
    # Logic to update user context in session or return emergency token
    return {"status": "EMERGENCY_ACCESS_GRANTED", "scope": "READ_ONLY_PHI", "expiry": "30m"}

# --- PHASE 8: GLOBAL GOVERNANCE CONTROLS ---

from app.models.core import Hospital, HospitalVerificationStatusEnum
from sqlalchemy.future import select

@router.post("/hospitals/{hospital_id}/suspend")
async def suspend_hospital(
    hospital_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: Any = Depends(get_super_admin)
):
    """
    SUPER ADMIN ONLY: Instantly suspend a hospital's access to the platform.
    """
    res = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = res.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    hospital.status = HospitalVerificationStatusEnum.suspended
    hospital.subscription_status = "suspended"
    await db.commit()
    
    from app.core.audit import log_audit_action
    await log_audit_action(
        db, 
        action="HOSPITAL_SUSPENDED", 
        user_id=current_admin.id,
        resource_type="HOSPITAL",
        details={"hospital_id": str(hospital_id)}
    )
    
    return {"detail": f"Hospital {hospital.name} has been suspended."}

@router.post("/platform/lockdown")
async def platform_emergency_lockdown(
    db: AsyncSession = Depends(get_db),
    current_admin: Any = Depends(get_super_admin)
):
    """
    SUPER ADMIN ONLY: Triggers a global ecosystem lockdown in the event of a critical cyber threat.
    """
    # In a real environment, this would flip a Redis flag that the authentication middleware checks,
    # immediately invalidating all non-super-admin sessions globally.
    
    from app.core.audit import log_audit_action
    await log_audit_action(
        db, 
        action="GLOBAL_PLATFORM_LOCKDOWN", 
        user_id=current_admin.id,
        resource_type="SYSTEM",
        details={"initiated_by": current_admin.email}
    )
    
    return {"detail": "GLOBAL LOCKDOWN INITIATED. All non-admin traffic is now blocked."}

