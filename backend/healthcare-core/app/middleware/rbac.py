"""
healthcare-core/app/middleware/rbac.py

RS256 JWT validation using JWKS from auth-service.
Token blacklist check via Redis.

FIXES:
  - `from jose import jwt, JWTError` → PyJWT (python-jose not in requirements)
  - JWKS cache is now a module-level dict (was fine) but TTL refresh is async-safe
  - Added Redis blacklist check (was missing in this file; core/security.py had it,
    but rbac.py is used by some partner routes that bypass core/security.py)
  - JWKS cache fails gracefully and retries on next request

PLACE AT: backend/healthcare-core/app/middleware/rbac.py
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config.settings import settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# ── JWKS cache ────────────────────────────────────────────────────────────────
# Module-level (shared across requests in the same process).
# On Cloud Run, each instance has its own cache — this is fine; each instance
# fetches once per hour at most.

_jwks_cache: dict = {}
_jwks_cache_time: float = 0.0
_JWKS_TTL = 3600  # 1 hour


@property
def _jwks_url(self) -> str:
    return getattr(settings, "AUTH_JWKS_URL",
                   "http://auth-service:8001/api/v1/auth/.well-known/jwks.json")


async def _get_public_keys() -> list[dict]:
    """Fetch and cache the JWKS from auth-service."""
    global _jwks_cache, _jwks_cache_time

    if time.time() - _jwks_cache_time < _JWKS_TTL and _jwks_cache.get("keys"):
        return _jwks_cache["keys"]

    jwks_url = getattr(
        settings, "AUTH_JWKS_URL",
        "http://auth-service:8001/api/v1/auth/.well-known/jwks.json"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_time = time.time()
            logger.info("JWKS refreshed from %s", jwks_url)
    except Exception as exc:
        logger.error("Failed to fetch JWKS from %s: %s", jwks_url, exc)
        if _jwks_cache.get("keys"):
            logger.warning("Using stale JWKS cache")
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable",
            ) from exc

    return _jwks_cache.get("keys", [])


# ── Token models ──────────────────────────────────────────────────────────────

class CurrentUser(BaseModel):
    user_id: str
    hospital_id: str
    role: str
    token_version: int
    jti: Optional[str] = None

    def belongs_to_hospital(self, hospital_id: str) -> bool:
        return self.hospital_id == hospital_id

    def is_superadmin(self) -> bool:
        return self.role == "superadmin"


# ── Core dependency ───────────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    """
    Validate the Bearer token using auth-service JWKS (RS256).
    Checks Redis blacklist on every request — fail-closed if Redis is down.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    keys = await _get_public_keys()

    payload = None
    last_error = None

    for key_data in keys:
        try:
            # PyJWT can consume a JWK dict directly via PyJWK
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                options={"require": ["exp", "iat", "sub", "jti"]},
            )
            break
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            last_error = e
            continue

    if payload is None:
        logger.warning("JWT validation failed for all JWKS keys: %s", last_error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Only access tokens are accepted here",
        )

    # ── Redis blacklist check (fail-closed) ───────────────────────────────────
    jti = payload.get("jti")
    if jti:
        try:
            from shared.redis_client import is_token_blacklisted
            if await is_token_blacklisted(jti):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been revoked",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Redis blacklist unavailable — rejecting request: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable",
            ) from exc

    return CurrentUser(
        user_id=payload["sub"],
        hospital_id=payload.get("hid", ""),
        role=payload.get("role", ""),
        token_version=payload.get("ver", 0),
        jti=jti,
    )


# ── Role guards ───────────────────────────────────────────────────────────────

def require_roles(*allowed_roles: str):
    """Factory: returns a dependency that enforces role membership."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_superadmin():
            return user
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return user
    return _check


def require_same_hospital(hospital_id_param: str = "hospital_id"):
    """Factory: enforces that the user belongs to the hospital in the path."""
    async def _check(
        request: Request,
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.is_superadmin():
            return user
        hid = request.path_params.get(hospital_id_param)
        if hid and not user.belongs_to_hospital(hid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not belong to this hospital",
            )
        return user
    return _check


# ── Convenience shorthands ────────────────────────────────────────────────────
require_doctor       = require_roles("doctor", "admin", "superadmin")
require_nurse        = require_roles("nurse", "doctor", "admin", "superadmin")
require_admin        = require_roles("admin", "superadmin")
require_pharmacist   = require_roles("pharmacist", "admin", "superadmin")
require_receptionist = require_roles("receptionist", "admin", "superadmin")
require_lab          = require_roles("lab_technician", "admin", "superadmin")
