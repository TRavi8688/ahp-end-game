from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any, Dict
import uuid

from app.api.deps import get_db, get_current_user
from app.services.analytics import AnalyticsService

router = APIRouter()

@router.get("/throughput", response_model=Dict[str, Any])
async def get_operational_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Real-time operational velocity across hospital departments."""
    if not current_user.hospital_id:
        raise HTTPException(status_code=400, detail="User not associated with a hospital")
    return AnalyticsService.get_hospital_throughput(db, current_user.hospital_id)

@router.get("/risk-stratification", response_model=List[Any])
async def get_patient_risk_levels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI-driven risk stratification for clinical monitoring."""
    return AnalyticsService.get_ai_risk_stratification(db, current_user.hospital_id)

@router.get("/revenue", response_model=List[Any])
async def get_financial_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Monthly financial intelligence and revenue trends."""
    return AnalyticsService.get_revenue_intelligence(db, current_user.hospital_id)
