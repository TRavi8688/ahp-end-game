from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.api.tenant import get_hospital_tenant_id
from app.models.models import User, HospitalSettings
from app.schemas.hospital import HospitalSettingsResponse, HospitalSettingsUpdate
import uuid

router = APIRouter()

@router.get("/", response_model=HospitalSettingsResponse)
async def get_hospital_settings(
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id)
    )
    settings = result.scalars().first()
    if not settings:
        # Return default if not exists
        return HospitalSettingsResponse(id="", hospital_id=str(hospital_id))
    return settings

@router.post("/", response_model=HospitalSettingsResponse)
async def update_hospital_settings(
    data: HospitalSettingsUpdate,
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure role is appropriate (accepts enum or string)
    role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_str not in ["hospital_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Only hospital admins can change settings.")
        
    result = await db.execute(
        select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id)
    )
    settings = result.scalars().first()
    
    if not settings:
        settings = HospitalSettings(hospital_id=hospital_id)
        db.add(settings)
        
    settings.enable_pharmacy = data.enable_pharmacy
    settings.enable_labs = data.enable_labs
    settings.enable_inpatient_beds = data.enable_inpatient_beds
    settings.enable_hr = data.enable_hr
    settings.enable_billing = data.enable_billing
    settings.max_beds_configured = data.max_beds_configured
    settings.has_multiple_branches = data.has_multiple_branches
    
    await db.commit()
    await db.refresh(settings)
    
    return settings
