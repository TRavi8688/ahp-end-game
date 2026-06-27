"""
backend/auth-service/app/middleware/rbac.py

FIXES APPLIED:
  BUG-2 FIX: Changed `from jose import JWTError` → `import jwt as pyjwt` (PyJWT)
              python-jose was not installed and caused 500 on every auth'd request.
  BUG-3 FIX: Token claim key was `hid` but JWT writes `hospital_id` → fixed to hospital_id
  BUG-4 FIX: Token claim key was `ver` but JWT writes `token_version` → fixed to token_version
  BUG-19 FIX (Matrix): Role check now uses exact equality, not substring match.
           "super_employee" no longer passes as "employee".

Usage in any FastAPI route:
    from app.middleware.rbac import require_roles, get_current_user

    @router.get("/patients")
    async def list_patients(
        user=Depends(require_roles("doctor", "nurse", "admin"))
    ):
        ...
"""
from typing import Optional
import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    user_id:              str
    hospital_id:          str
    role:                 str
    token_version:        int
    employee_id:          str = ""
    must_change_password: bool = False

    def belongs_to_hospital(self, hospital_id: str) -> bool:
        """ABAC check: user can only access their own hospital's data."""
        return self.hospital_id == hospital_id

    def is_superadmin(self) -> bool:
        return self.role in ("super_admin", "superadmin", "admin")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    """
    Extract and validate JWT from Authorization header.
    Raises 401 if missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Refresh tokens cannot be used for API access")

    return CurrentUser(
        user_id=payload["sub"],
        # BUG-3 FIX: was payload.get("hid", "") — JWT writes "hospital_id"
        hospital_id=payload.get("hospital_id", "") or "",
        role=payload.get("role", ""),
        # BUG-4 FIX: was payload.get("ver", 0) — JWT writes "token_version"
        token_version=payload.get("token_version", 0) or 0,
        employee_id=payload.get("employee_id", "") or "",
        must_change_password=bool(payload.get("must_change_password", False)),
    )


def require_roles(*allowed_roles: str):
    """
    Dependency factory: only allow users with specific roles.
    BUG-19 FIX: Uses exact equality check, not substring match.
    "super_employee" will NOT match "employee".

    Example:
        @router.delete("/patients/{id}")
        async def delete_patient(user=Depends(require_roles("admin", "super_admin"))):
    """
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        # Exact equality check (fixes audit bug #19 — substring match)
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
    as the resource being accessed. Super admin bypasses this check.
    """
    async def _check(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_superadmin():
            return user
        hospital_id = request.path_params.get(hospital_id_param)
        if not hospital_id:
            return user
        if not user.belongs_to_hospital(hospital_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not belong to this hospital",
            )
        return user
    return _check


# Pre-built common role combinations
require_doctor        = require_roles("doctor", "admin", "super_admin")
require_nurse         = require_roles("nurse", "doctor", "admin", "super_admin")
require_admin         = require_roles("admin", "super_admin")
require_pharmacist    = require_roles("pharmacist", "admin", "super_admin")
require_lab_tech      = require_roles("lab", "admin", "super_admin")
require_superadmin    = require_roles("super_admin")
require_hr            = require_roles("hr", "super_admin")
require_matrix_access = require_roles(
    "super_admin", "admin", "manager", "team_lead",
    "l1", "l2", "support", "finance", "engineering",
    "onboarding", "data", "verification", "employee", "hr"
)
