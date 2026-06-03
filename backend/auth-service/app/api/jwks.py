"""
backend/auth-service/app/api/jwks.py
Phase 5: JWKS endpoint so other microservices can verify RS256 tokens
without needing the private key or a shared secret.
"""
from fastapi import APIRouter
from app.core.security import get_jwks, get_public_key_pem

router = APIRouter(tags=["auth-jwks"])


@router.get("/.well-known/jwks.json")
async def jwks():
    """
    JSON Web Key Set — public keys for RS256 token verification.
    Other services fetch this once and cache it to validate JWTs locally.
    """
    return get_jwks()


@router.get("/.well-known/public-key.pem", response_class=None)
async def public_key_pem():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(get_public_key_pem(), media_type="application/x-pem-file")
