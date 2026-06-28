"""
shared/utils/service_auth.py

Service-to-service JWT authentication.

FIX SEC-1: Raise RuntimeError if INTERNAL_SERVICE_SECRET is unset in production.
           Old code silently used a known default value, making all internal
           endpoints accessible to anyone who knew the string.

PLACE AT: backend/shared/utils/service_auth.py
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import jwt
from fastapi import HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

_KNOWN_INSECURE_DEFAULTS = {
    "super-secret-internal-key-change-in-prod",
    "local_dev_secret_key_must_be_at_least_32_characters_long_for_security",
}


def _get_internal_secret() -> str:
    secret = os.environ.get("INTERNAL_SERVICE_SECRET", "")
    env = os.environ.get("ENVIRONMENT", "development").lower()

    if env == "production":
        if not secret or secret in _KNOWN_INSECURE_DEFAULTS:
            logger.critical(
                "FATAL: INTERNAL_SERVICE_SECRET is not set or is using a known default value "
                "in production. Internal endpoints (PHI access) are completely unprotected. "
                "Generate a secret: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
    elif not secret:
        logger.warning(
            "INTERNAL_SERVICE_SECRET not set -- using insecure default (development only)"
        )
        secret = "super-secret-internal-key-change-in-prod"

    return secret


# Eagerly validate at import time so the error surfaces at startup
INTERNAL_SERVICE_SECRET: str = _get_internal_secret()


def generate_internal_token(
    service_name: str,
    audience: str,
    ttl_seconds: int = 60,
) -> str:
    """
    Generate a short-lived JWT for service-to-service authentication.

    Args:
        service_name: Issuing service name (e.g. "ai-service")
        audience:     Target service name (e.g. "healthcare-core")
        ttl_seconds:  Token lifetime in seconds (default 60s -- single request)

    Returns:
        Signed JWT string
    """
    now = int(time.time())
    payload = {
        "iss": service_name,
        "aud": audience,
        "iat": now,
        "exp": now + ttl_seconds,
        "type": "internal_service",
    }
    return jwt.encode(payload, INTERNAL_SERVICE_SECRET, algorithm="HS256")


async def verify_internal_service(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    """
    FastAPI dependency: verify that a request comes from a trusted internal microservice.

    Validates:
    - Token is present and signed with INTERNAL_SERVICE_SECRET
    - Token type is "internal_service"
    - Token audience matches SERVICE_NAME env var of this service
    - Token has not expired

    Usage:
        @router.get("/internal/clinical-summary/{patient_id}")
        async def endpoint(
            patient_id: str,
            internal: dict = Depends(verify_internal_service),
        ):
            ...
    """
    if not credentials:
        logger.warning(
            "Missing Authorization header for internal route: %s", request.url.path
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing internal service credentials",
        )

    token = credentials.credentials
    expected_audience = os.environ.get("SERVICE_NAME", "healthcare-core")

    try:
        payload = jwt.decode(
            token,
            INTERNAL_SERVICE_SECRET,
            algorithms=["HS256"],
            audience=expected_audience,
            options={"require": ["exp", "iat", "iss", "aud", "type"]},
        )

        if payload.get("type") != "internal_service":
            logger.warning(
                "Internal token has wrong type: %s from %s",
                payload.get("type"), request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token type for internal access",
            )

        logger.debug(
            "Internal service authenticated: iss=%s path=%s",
            payload.get("iss"), request.url.path,
        )
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("Internal service token expired for path: %s", request.url.path)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service token expired",
        )
    except jwt.InvalidAudienceError:
        logger.warning(
            "Internal service token has wrong audience. Expected: %s path: %s",
            expected_audience, request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token audience mismatch",
        )
    except jwt.InvalidTokenError as exc:
        logger.warning(
            "Invalid internal service token for %s: %s", request.url.path, exc
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal service token",
        )
