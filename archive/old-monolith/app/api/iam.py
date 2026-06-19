from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

from app.api import deps
from app.models.models import User, Hospital, RoleEnum, HospitalBranch
from app.core.security import get_password_hash

router = APIRouter()

# --- Schemas ---

class TenantRead(BaseModel):
    id: UUID
    name: str
    type: str # 'ORGANIZATION' or 'BRANCH'
    parent_id: Optional[UUID] = None

class UserRead(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    status: str
    mfa_enabled: bool = False
    last_login: Optional[datetime] = None

class UserInvite(BaseModel):
    email: EmailStr
    role: RoleEnum
    tenant_id: UUID
    enforce_mfa: bool = True

class UserStatusUpdate(BaseModel):
    status: str

# --- Endpoints ---

@router.get("/tenants", response_model=List[TenantRead])
async def get_tenants(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_super_admin)
):
    """
    Fetch all organizational tenants (Hospitals and Branches) for the IAM switcher.
    """
    tenants = []
    
    # Fetch Hospitals (Organizations)
    hosp_res = await db.execute(select(Hospital))
    for h in hosp_res.scalars().all():
        tenants.append(TenantRead(id=h.id, name=h.name, type="ORGANIZATION"))
        
    # Fetch Branches
    branch_res = await db.execute(select(HospitalBranch))
    for b in branch_res.scalars().all():
        tenants.append(TenantRead(id=b.id, name=b.name, type="BRANCH", parent_id=b.hospital_id))
        
    return tenants

@router.get("/users", response_model=List[UserRead])
async def get_users(
    tenant_id: Optional[UUID] = None,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_super_admin)
):
    """
    Fetch global or tenant-specific users.
    """
    stmt = select(User)
    
    # Note: For strict tenant filtering we'd join with StaffProfile. 
    # For global IAM view, we return all users if no tenant specified.
    if tenant_id:
        stmt = stmt.where(User.hospital_id == tenant_id) # Uses property or direct relation depending on schema
        
    stmt = stmt.order_by(User.created_at.desc())
    res = await db.execute(stmt)
    users = res.scalars().all()
    
    output = []
    for u in users:
        name = f"{u.first_name or ''} {u.last_name or ''}".strip()
        if not name:
            name = u.email.split('@')[0]
            
        output.append(UserRead(
            id=u.id,
            name=name,
            email=u.email,
            role=u.role.value if hasattr(u.role, 'value') else str(u.role),
            status=u.current_status or "ACTIVE",
            mfa_enabled=False, # Placeholder for MFA state
            last_login=u.last_login
        ))
        
    return output

@router.post("/invite")
async def invite_user(
    payload: UserInvite,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_super_admin)
):
    """
    Provision a new identity within a specific tenant.
    """
    # Check if user exists
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")
        
    new_user = User(
        email=payload.email,
        hashed_password=get_password_hash("TempPass123!"), # Temp password for invite
        role=payload.role,
        current_status="INVITED"
    )
    
    # Typically we'd also create a StaffProfile linked to the tenant_id here
    # from app.models.models import StaffProfile
    # ...
    
    db.add(new_user)
    await db.commit()
    
    # Generate audit log
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="USER_INVITED",
        user_id=current_admin.id,
        resource_type="USER",
        details={"invited_email": payload.email, "role": payload.role.value}
    )
    
    return {"detail": "User invited successfully", "user_id": str(new_user.id)}

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_super_admin)
):
    """
    Suspend or Activate a user.
    """
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.current_status = payload.status
    if payload.status == "SUSPENDED":
        user.token_version += 1 # Immediately revoke all sessions
        
    await db.commit()
    
    return {"detail": f"User status updated to {payload.status}"}
