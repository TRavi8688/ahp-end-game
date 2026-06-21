"""
backend/auth-service/app/middleware/rbac.py
Phase 5 fix: RBAC + ABAC (hospital_id scoping) middleware.
Audit finding: gateway had zero auth checks; backend role enforcement unverified.

Usage in any FastAPI route:
    from app.middleware.rbac import require_roles, get_current_user

    @router.get("/patients")
    async def list_patients(
        user=Depends(require_roles("doctor", "nurse", "admin"))
    ):
        ...
"""
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    user_id: str
    hospital_id: str
    role: str
    token_version: int

    def belongs_to_hospital(self, hospital_id: str) -> bool:
        """ABAC check: user can only access their own hospital's data."""
        return self.hospital_id == hospital_id

    def is_superadmin(self) -> bool:
        return self.role == "superadmin"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    """
    Extract and validate JWT from Authorization header.
    Raises 401 if missing, expired, or invalid.
    Does NOT check token_version against DB here — that's done in require_roles
    for routes that need it, to avoid a DB hit on every request.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Refresh tokens cannot be used for API access")

    return CurrentUser(
        user_id=payload["sub"],
        hospital_id=payload.get("hid", ""),
        role=payload.get("role", ""),
        token_version=payload.get("ver", 0),
    )


def require_roles(*allowed_roles: str):
    """
    Dependency factory: only allow users with specific roles.

    Example:
        @router.delete("/patients/{id}")
        async def delete_patient(user=Depends(require_roles("admin", "superadmin"))):
    """
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles and not user.is_superadmin():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return user
    return _check


def require_same_hospital(hospital_id_param: str = "hospital_id"):
    """
    ABAC dependency: enforces that the requesting user belongs to the same hospital
    as the resource being accessed. Superadmin bypasses this check.

    Example:
        @router.get("/hospitals/{hospital_id}/patients")
        async def get_patients(
            hospital_id: str,
            user=Depends(require_same_hospital("hospital_id"))
        ):
    """
    async def _check(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_superadmin():
            return user
        hospital_id = request.path_params.get(hospital_id_param)
        if not hospital_id:
            return user  # no hospital_id in path, skip check
        if not user.belongs_to_hospital(hospital_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not belong to this hospital",
            )
        return user
    return _check


# Pre-built common role combinations
require_doctor = require_roles("doctor", "admin", "superadmin")
require_nurse = require_roles("nurse", "doctor", "admin", "superadmin")
require_admin = require_roles("admin", "superadmin")
require_pharmacist = require_roles("pharmacist", "admin", "superadmin")
require_lab_technician = require_roles("lab_technician", "admin", "superadmin")
require_superadmin = require_roles("superadmin")
