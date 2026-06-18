"""
Zero-Trust JWT Validation Dependency.
FIXED: Added "super_admin" to TokenPayload.role Literal.
Previously, any JWT with role="super_admin" failed Pydantic validation
and returned 401. Now super_admin tokens pass through correctly.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import PyJWTError
from pydantic import BaseModel
from typing import Literal
from app.config.settings import settings

bearer_scheme = HTTPBearer(auto_error=True)


class TokenPayload(BaseModel):
    sub:           str
    # FIXED: Added "super_admin" to the valid roles
    role:          Literal[
                       "patient", "doctor", "admin", "hospital_admin",
                       "staff", "nurse", "pharmacist", "super_admin"
                   ]
    token_version: int = 0  # default 0 for backwards compat


import os

jwks_client = jwt.PyJWKClient(
    os.environ.get(
        "AUTH_JWKS_URL",
        "http://localhost:8001/api/v1/auth/.well-known/jwks.json"
    )
)


async def _decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT using Auth Service JWKS. Checks Redis blacklist for revoked tokens."""
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"]
        )
    except PyJWTError as e:
        import logging
        logging.getLogger(__name__).warning(f"JWT Validation failed: {e}")
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
            logging.getLogger(__name__).error(f"Redis blacklist unavailable — rejecting request: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable. Please try again shortly.",
            )

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
            stored_version = user_status.get("token_version")
            if stored_version and str(payload.get("token_version", 0)) != str(stored_version):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been invalidated. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning(f"Redis user status check skipped: {e}")

    try:
        return TokenPayload(**payload)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    return await _decode_token(credentials.credentials)


def require_role(*roles: str):
    """Dependency factory: raises 403 if user's role is not in the allowed list."""
    async def _check(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ) -> TokenPayload:
        payload = await _decode_token(credentials.credentials)
        if payload.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(roles)}",
            )
        return payload
    return _check
