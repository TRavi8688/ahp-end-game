import uuid
from typing import Optional, List
from fastapi import Request, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.iam import TenantUser, TenantType, User

class TenantContext(BaseModel):
    """
    The tenant context injected into every request.
    This replaces global user state with localized tenant-aware state.
    """
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_type: TenantType
    role_name: str
    permissions: List[str]

async def get_tenant_context(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> TenantContext:
    """
    FastAPI Dependency that resolves the tenant context from HTTP headers.
    Enforces strict Multi-Tenant isolation at the framework level.
    """
    # 1. Extract tenant ID from header (X-Tenant-ID)
    tenant_id_str = request.headers.get("X-Tenant-ID")
    if not tenant_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'X-Tenant-ID' header. Tenant context is required."
        )

    try:
        tenant_id = uuid.UUID(tenant_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 'X-Tenant-ID' format."
        )

    # 2. Get current authenticated user (assuming request.state.user is set by auth middleware)
    # For safety, we pull the user_id from the state
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated."
        )

    # 3. Query the TenantUser mapping to verify access
    result = await db.execute(
        select(TenantUser)
        .where(TenantUser.user_id == user_id, TenantUser.tenant_id == tenant_id)
    )
    tenant_user = result.scalars().first()

    if not tenant_user:
        # Check if user is a global super_admin
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalars().first()
        if user and user.is_super_admin:
            return TenantContext(
                user_id=user_id,
                tenant_id=tenant_id,
                tenant_type=TenantType.ORGANIZATION, # Default super admin context
                role_name="super_admin",
                permissions=["*"]
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this tenant."
        )

    # 4. Return the Tenant Context (including role and permissions loaded lazily or eagerly)
    # Assuming role is eagerly loaded or we make another query
    # In a real impl, role would be joined.
    
    return TenantContext(
        user_id=user_id,
        tenant_id=tenant_id,
        tenant_type=tenant_user.tenant_type,
        role_name="derived_role", # Placeholder, would be fetched from Role table
        permissions=[] # Placeholder
    )

def require_permissions(*required_permissions: str):
    """
    ABAC/RBAC Dependency Builder based on Tenant Context.
    Usage: @app.get("/patients", dependencies=[Depends(require_permissions("patient:read"))])
    """
    async def permission_checker(context: TenantContext = Depends(get_tenant_context)):
        if "*" in context.permissions:
            return context
            
        for req_perm in required_permissions:
            if req_perm not in context.permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: {req_perm} within this tenant context."
                )
        return context
    return permission_checker
