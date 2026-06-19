"""
backend/healthcare-core/app/core/security.py

FIXES:
  FIX-S1: Added missing roles to TokenPayload.role Literal:
           nurse, pharmacist, super_admin, owner, receptionist, lab, hr
           Any JWT with these roles returned 401 Pydantic validation error.
  FIX-S2: Added require_role() factory for role-based endpoint guards.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Literal
from app.config.settings import settings

bearer_scheme = HTTPBearer(auto_error=True)


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
    ]
    token_version: int = 0


async def _decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT. Checks Redis blacklist for revoked tokens."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
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
                detail="Authentication service temporarily unavailable. Please try again shortly.",
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
