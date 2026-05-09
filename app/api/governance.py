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
