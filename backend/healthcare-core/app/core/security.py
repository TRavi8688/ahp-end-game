"""
backend/healthcare-core/app/core/security.py

WHAT CHANGED vs existing file:
  - TokenPayload.role Literal expanded: added nurse, pharmacist, super_admin,
    owner, receptionist, lab, hr
  - token_version field renamed from "token_version" to "ver" to match what
    auth-service/app/core/security.py actually puts in the JWT payload
  - Both "ver" and "token_version" are accepted for backwards compat
  - require_role() and get_current_user() unchanged
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, model_validator
from typing import Literal, Optional
from app.config.settings import settings

bearer_scheme = HTTPBearer(auto_error=True)


class TokenPayload(BaseModel):
    sub: str           # user_id (UUID string)
    # FIXED: Added all missing roles. Without these, ANY JWT with these roles
    # throws a Pydantic ValidationError → 401 Unauthorized for nurse/pharmacist/etc.
    role: Literal[
        "patient",
        "doctor",
        "admin",
        "hospital_admin",
        "staff",
        "nurse",          # FIX: was missing
        "pharmacist",     # FIX: was missing
        "super_admin",    # FIX: was missing — super-admin dashboard always 401
        "owner",          # FIX: was missing
        "receptionist",   # FIX: was missing
        "lab",            # FIX: was missing
        "hr",             # FIX: was missing
    ]
    # FIXED: auth-service puts "ver" in JWT, not "token_version"
    # Accept both for backwards compat
    ver: Optional[int] = None
    token_version: Optional[int] = None
    hid: Optional[str] = None   # hospital_id from JWT payload

    @model_validator(mode="after")
    def normalise_version(self) -> "TokenPayload":
        # Unify: ver takes priority, fallback to token_version
        if self.ver is None and self.token_version is not None:
            self.ver = self.token_version
        if self.token_version is None and self.ver is not None:
            self.token_version = self.ver
        return self


async def _decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT. Checks Redis blacklist for revoked tokens."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
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
            import logging
            logging.getLogger(__name__).error(
                f"Redis blacklist unavailable — rejecting request: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable.",
            )

    # Check user status (active flag + token version) from Redis cache
    import logging as _logging
    _logger = _logging.getLogger(__name__)
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
            token_ver = payload.get("ver") or payload.get("token_version")
            if (
                cached_version is not None
                and token_ver is not None
                and cached_version != str(token_ver)
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


# Alias used by some existing endpoints
get_current_internal_user = get_current_user


def require_role(*allowed_roles: str):
    """
    Role-based access control dependency factory.

    Usage:
        # Guard only — no user object:
        @router.get("/hospitals", dependencies=[Depends(require_role("super_admin"))])

        # Guard + get user object:
        @router.get("/hospitals")
        async def list_hospitals(user: TokenPayload = Depends(require_role("super_admin", "admin"))):
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
