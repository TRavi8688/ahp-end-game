"""
backend/healthcare-core/app/middleware/rbac.py
Phase 5: Token verification for healthcare-core using RS256 + JWKS.
Fetches public key from auth-service JWKS endpoint (cached 1 hour).
"""
import time
from typing import Optional
import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel

from app.core.config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

# Simple in-memory JWKS cache (refresh every hour)
_jwks_cache: dict = {}
_jwks_cache_time: float = 0
_JWKS_TTL = 3600


async def _get_public_keys() -> list:
    global _jwks_cache, _jwks_cache_time
    if time.time() - _jwks_cache_time < _JWKS_TTL and _jwks_cache:
        return _jwks_cache.get("keys", [])
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(settings.jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = time.time()
    return _jwks_cache.get("keys", [])


class CurrentUser(BaseModel):
    user_id: str
    hospital_id: str
    role: str
    token_version: int

    def belongs_to_hospital(self, hospital_id: str) -> bool:
        return self.hospital_id == hospital_id

    def is_superadmin(self) -> bool:
        return self.role == "superadmin"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        keys = await _get_public_keys()
        payload = None
        for key in keys:
            try:
                payload = jwt.decode(credentials.credentials, key, algorithms=["RS256"])
                break
            except JWTError:
                continue
        if payload is None:
            raise JWTError("No valid key found")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}",
                            headers={"WWW-Authenticate": "Bearer"})

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Refresh token cannot access resources")

    return CurrentUser(
        user_id=payload["sub"],
        hospital_id=payload.get("hid", ""),
        role=payload.get("role", ""),
        token_version=payload.get("ver", 0),
    )


def require_roles(*allowed_roles: str):
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles and not user.is_superadmin():
            raise HTTPException(status_code=403,
                                detail=f"Role '{user.role}' not permitted. Required: {list(allowed_roles)}")
        return user
    return _check


def require_same_hospital(hospital_id_param: str = "hospital_id"):
    async def _check(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_superadmin():
            return user
        hid = request.path_params.get(hospital_id_param)
        if hid and not user.belongs_to_hospital(hid):
            raise HTTPException(status_code=403, detail="Access denied: wrong hospital")
        return user
    return _check


require_doctor = require_roles("doctor", "admin", "superadmin")
require_nurse = require_roles("nurse", "doctor", "admin", "superadmin")
require_admin = require_roles("admin", "superadmin")
require_pharmacist = require_roles("pharmacist", "admin", "superadmin")
require_lab_technician = require_roles("lab_technician", "admin", "superadmin")
