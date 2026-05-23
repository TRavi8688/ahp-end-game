from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.api.tenant import get_hospital_tenant_id
from app.models.models import User, HospitalSettings, Hospital
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

# --- Hospital Metadata Endpoints ---
from pydantic import BaseModel

class HospitalMetadataUpdate(BaseModel):
    name: str
    registration_number: str

@router.get("/metadata")
async def get_hospital_metadata(
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return {
        "name": hospital.name,
        "registration_number": hospital.registration_number,
        "status": hospital.subscription_status
    }

@router.put("/metadata")
async def update_hospital_metadata(
    data: HospitalMetadataUpdate,
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_str not in ["hospital_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Only hospital admins can change metadata.")
        
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalars().first()
    
    hospital.name = data.name
    hospital.registration_number = data.registration_number
    await db.commit()
    return {"message": "Metadata updated successfully"}

# --- Department Endpoints ---
from app.models.models import Department

class DepartmentCreate(BaseModel):
    name: str

@router.get("/departments")
async def get_departments(
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Department).where(Department.hospital_id == hospital_id))
    return [{"id": str(d.id), "name": d.name} for d in result.scalars().all()]

@router.post("/departments")
async def create_department(
    data: DepartmentCreate,
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_str not in ["hospital_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Only hospital admins can add departments.")
        
    new_dept = Department(hospital_id=hospital_id, name=data.name)
    db.add(new_dept)
    await db.commit()
    await db.refresh(new_dept)
    return {"id": str(new_dept.id), "name": new_dept.name}

@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(get_hospital_tenant_id),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_str not in ["hospital_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Only hospital admins can delete departments.")
        
    result = await db.execute(select(Department).where(Department.id == dept_id, Department.hospital_id == hospital_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    await db.delete(dept)
    await db.commit()
    return {"message": "Department deleted"}
