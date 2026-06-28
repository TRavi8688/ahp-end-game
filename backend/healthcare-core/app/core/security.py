"""
backend/healthcare-core/app/core/security.py

Token verification for healthcare-core.

FIXES:
  FIX-S1: Added missing roles to TokenPayload.role Literal:
           nurse, pharmacist, super_admin, owner, receptionist, lab, hr
           Any JWT with these roles returned 401 Pydantic validation error.
  FIX-S2: Added require_role() factory for role-based endpoint guards.
  FIX-S3: Switched from HS256 (jose + JWT_SECRET_KEY) to RS256 (PyJWT + JWKS).
           Auth-service now signs tokens with RS256. The old HS256 verification
           would always fail since the token algorithm doesn't match, causing
           401/500 on every authenticated request.

           On startup, healthcare-core fetches the public key from auth-service's
           JWKS endpoint. If JWKS is unreachable (e.g., during local dev without
           auth-service running), it falls back to JWT_SECRET_KEY + HS256 so
           existing local dev workflows don't break.
"""

import logging
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Literal, Optional

import jwt as pyjwt
from jwt.exceptions import PyJWTError

from app.config.settings import settings

bearer_scheme = HTTPBearer(auto_error=True)
_logger = logging.getLogger(__name__)


# -- JWKS / Key loading --------------------------------------------------------

_PUBLIC_KEY = None
_ALGORITHM = "RS256"


def _load_public_key():
    """Load the RS256 public key for token verification.

    Priority:
      1. JWT_PUBLIC_KEY_PEM env var (base64-encoded PEM, set by deployment)
      2. Fetch from auth-service JWKS endpoint (AUTH_JWKS_URL in settings)
      3. Fall back to HS256 + JWT_SECRET_KEY for local dev
    """
    global _PUBLIC_KEY, _ALGORITHM
    import base64

    # 1. Try env var
    pub_b64 = os.environ.get("JWT_PUBLIC_KEY_PEM", "")
    if pub_b64:
        try:
            pub_pem = base64.b64decode(pub_b64)
            from cryptography.hazmat.primitives.serialization import load_pem_public_key
            _PUBLIC_KEY = load_pem_public_key(pub_pem)
            _ALGORITHM = "RS256"
            _logger.info("healthcare-core: JWT public key loaded from JWT_PUBLIC_KEY_PEM env var")
            return
        except Exception as e:
            _logger.warning("Failed to load JWT_PUBLIC_KEY_PEM: %s", e)

    # 2. Try JWKS
    jwks_url = getattr(settings, "AUTH_JWKS_URL", "")
    if jwks_url:
        try:
            import httpx
            resp = httpx.get(jwks_url, timeout=5)
            if resp.status_code == 200:
                jwks = resp.json()
                from jwt import PyJWKClient
                # Build the key from the JWKS response
                for key_data in jwks.get("keys", []):
                    if key_data.get("alg") == "RS256":
                        from jwt import PyJWK
                        jwk = PyJWK(key_data)
                        _PUBLIC_KEY = jwk.key
                        _ALGORITHM = "RS256"
                        _logger.info("healthcare-core: JWT public key loaded from JWKS (%s)", jwks_url)
                        return
        except Exception as e:
            _logger.warning("Failed to fetch JWKS from %s: %s", jwks_url, e)

    # 3. Fall back to HS256 for local dev
    _PUBLIC_KEY = settings.JWT_SECRET_KEY
    _ALGORITHM = settings.JWT_ALGORITHM
    _logger.warning(
        "healthcare-core: Using HS256 fallback for JWT verification. "
        "This is OK for local dev but MUST NOT happen in production."
    )


# Load key at module import time
_load_public_key()


class TokenPayload(BaseModel):
    sub: str           # user_id (UUID string)
    # FIX-S1: Added nurse, pharmacist, super_admin, owner, receptionist, lab, hr
    role: Literal[
        "patient",
        "doctor",
        "admin",
        "hospital_admin",
        "staff",
        "nurse",
        "pharmacist",
        "super_admin",
        "owner",
        "receptionist",
        "lab",
        "hr",
        "manager",
        "team_lead",
        "l1",
        "l2",
        "support",
        "finance",
        "engineering",
        "onboarding",
        "data",
        "verification",
        "employee",
    ]
    token_version: int = 0
    # EXECUTION FIX: auth-service's /auth/login embeds "hospital_id" directly
    # in the token (see auth-service/app/api/v1/auth.py token_data dict). This
    # field was missing here, so pydantic silently dropped it on every decode
    # and every downstream route had to re-derive hospital_id with an extra
    # DB lookup (see owner.py). Declaring it here means current_user.hospital_id
    # just works everywhere.
    hospital_id: Optional[str] = None


async def _decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT. Checks Redis blacklist for revoked tokens."""
    try:
        payload = pyjwt.decode(
            token,
            _PUBLIC_KEY,
            algorithms=[_ALGORITHM]
        )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check Redis blacklist for revoked tokens
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
        except Exception as e:
            _logger.error(
                f"Redis blacklist unavailable -- rejecting request: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable. Please try again shortly.",
            )

    # Check user status (active flag + token version) from Redis cache
    try:
        from shared.redis_client import get_user_status
        user_status = await get_user_status(payload.get("sub"))
        if user_status is not None:
            if user_status.get("is_active") == "0":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account suspended",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            cached_version = user_status.get("token_version")
            token_version = payload.get("token_version")
            if (
                cached_version is not None
                and token_version is not None
                and cached_version != str(token_version)
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning(f"User status check failed (fail-open): {e}")

    return TokenPayload(**payload)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    """FastAPI dependency: validates JWT and returns the token payload."""
    return await _decode_token(credentials.credentials)


def require_role(*allowed_roles: str):
    """
    FIX-S2: Role-based access control dependency factory.

    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_role("doctor", "admin"))])

    Or to get the user object:
        @router.get("/endpoint")
        async def handler(user: TokenPayload = Depends(require_role("doctor"))):
    """
    async def role_checker(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(allowed_roles)}",
            )
        return current_user
    return role_checker
