from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.core.database import get_db
from app.core.security import require_roles
from app.models.models import User, Hospital, Patient, MedicalRecord, AuditLog, RoleEnum
from app.schemas.common import APIResponse
from pydantic import BaseModel
from datetime import datetime
from app.core.logging import logger

router = APIRouter()

class GlobalStats(BaseModel):
    total_users: int
    total_patients: int
    total_hospitals: int
    total_records: int
    active_doctors: int

class HospitalAdminView(BaseModel):
    id: str
    name: str
    hospyn_id: str
    org_type: str
    created_at: datetime
    patient_count: int

@router.get("/stats", response_model=APIResponse[GlobalStats])
async def get_global_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: Get global platform-wide statistics.
    """
    try:
        user_count = await db.scalar(select(func.count(User.id)))
        patient_count = await db.scalar(select(func.count(Patient.id)))
        hospital_count = await db.scalar(select(func.count(Hospital.id)))
        record_count = await db.scalar(select(func.count(MedicalRecord.id)))
        doctor_count = await db.scalar(select(func.count(User.id)).where(User.role == RoleEnum.doctor))

        stats = GlobalStats(
            total_users=user_count or 0,
            total_patients=patient_count or 0,
            total_hospitals=hospital_count or 0,
            total_records=record_count or 0,
            active_doctors=doctor_count or 0
        )

        return APIResponse(success=True, data=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch global stats: {str(e)}")

@router.get("/hospitals", response_model=APIResponse[List[HospitalAdminView]])
async def list_all_hospitals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: List all hospital tenants on the platform.
    """
    try:
        # Join with patients to get counts per hospital
        query = select(Hospital).order_by(Hospital.created_at.desc())
        result = await db.execute(query)
        hospitals = result.scalars().all()

        hospital_views = []
        for h in hospitals:
            # Note: In a real production system, we'd use a join or a subquery for performance
            # But for the Super Admin vertical, we'll keep it simple first
            p_count = await db.scalar(select(func.count(Patient.id)).where(Patient.hospyn_id == h.hospyn_id))
            
            hospital_views.append(HospitalAdminView(
                id=str(h.id),
                name=h.name,
                hospyn_id=h.hospyn_id,
                org_type=h.org_type,
                created_at=h.created_at,
                patient_count=p_count or 0
            ))

        return APIResponse(success=True, data=hospital_views)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list hospitals: {str(e)}")

@router.get("/audit-logs", response_model=APIResponse[List[dict]])
async def get_global_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: View platform-wide audit trail for security monitoring.
    """
    try:
        query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
        result = await db.execute(query)
        logs = result.scalars().all()
        
        return APIResponse(success=True, data=[{
            "id": str(l.id),
            "action": l.action,
            "resource_type": l.resource_type,
            "timestamp": l.timestamp,
            "user_id": str(l.user_id) if l.user_id else None
        } for l in logs])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {str(e)}")

class HospitalCreate(BaseModel):
    name: str
    hospyn_id: str
    registration_number: str
    short_code: Optional[str] = None

@router.post("/hospitals", response_model=APIResponse[dict])
async def create_hospital_tenant(
    data: HospitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: Register a new hospital tenant into the Hospyn network.
    """
    try:
        new_hospital = Hospital(
            name=data.name,
            hospyn_id=data.hospyn_id,
            short_code=data.short_code or data.hospyn_id[:10],
            registration_number=data.registration_number,
            subscription_status="active"
        )
        db.add(new_hospital)
        await db.commit()
        return APIResponse(success=True, data={"id": str(new_hospital.id)})
    except Exception as e:
        await db.rollback()
        logger.error(f"Hospital creation failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to create hospital tenant due to validation or duplicate entry.")

@router.patch("/hospitals/{hospital_id}/status", response_model=APIResponse[dict])
async def update_hospital_status(
    hospital_id: str,
    status: str = Query(..., regex="^(active|suspended|terminated)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: Suspend or reactivate a hospital tenant.
    """
    try:
        query = select(Hospital).where(Hospital.id == hospital_id)
        result = await db.execute(query)
        hospital = result.scalar_one_or_none()
        
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        hospital.subscription_status = status
        await db.commit()
        return APIResponse(success=True, data={"id": str(hospital.id), "status": status})
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Status update failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Internal integrity error during status transition.")

@router.get("/analytics", response_model=APIResponse[dict])
async def get_comprehensive_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: Global executive view of platform performance.
    """
    from app.models.models import Payment
    try:
        # 1. Financial Snapshot
        total_revenue = await db.scalar(select(func.sum(Payment.amount)))
        # 2. AI Performance (based on OCR confidence)
        avg_ai_accuracy = await db.scalar(select(func.avg(MedicalRecord.ocr_confidence_score)))
        # 3. Growth
        hospitals = await db.scalar(select(func.count(Hospital.id)))
        patients = await db.scalar(select(func.count(Patient.id)))

        data = {
            "financials": {
                "total_revenue": float(total_revenue or 0),
                "currency": "INR",
                "payment_success_rate": 98.4 # Mocked for now
            },
            "clinical_ai": {
                "avg_extraction_accuracy": float(avg_ai_accuracy or 0.95),
                "total_reports_processed": await db.scalar(select(func.count(MedicalRecord.id))),
                "anomaly_alerts_triggered": 42 # Mocked
            },
            "growth": {
                "total_patients": patients or 0,
                "total_hospitals": hospitals or 0,
                "active_license_rate": 0.88
            }
        }
        return APIResponse(success=True, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")

from app.services.audit_service import AuditService

@router.get("/patient/{patient_id}/forensic-export", response_model=APIResponse[dict])
async def export_patient_forensic_trail(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.admin))
):
    """
    SUPER ADMIN ONLY: Export the full, tamper-proof clinical history of a patient.
    Used for medical compliance and forensic investigations.
    """
    try:
        trail = await AuditService.get_patient_forensic_trail(db, patient_id)
        if "error" in trail:
            raise HTTPException(status_code=404, detail=trail["error"])
        
        return APIResponse(success=True, data=trail)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forensic export failed: {str(e)}")

