from fastapi import APIRouter
import base64
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from app.core.security import PUBLIC_KEY

router = APIRouter(prefix="/.well-known", tags=["jwks"])

def _int_to_base64url(val: int) -> str:
    """Convert an integer to a base64url encoded string per RFC 7518."""
    val_bytes = val.to_bytes((val.bit_length() + 7) // 8, byteorder='big')
    return base64.urlsafe_b64encode(val_bytes).decode('utf-8').rstrip('=')

@router.get("/jwks.json")
def get_jwks():
    """
    Public JWKS endpoint.
    Exposes the Auth Service public key so other services (like healthcare-core)
    can dynamically fetch and cache it to verify JWTs.
    """
    if isinstance(PUBLIC_KEY, RSAPublicKey):
        public_numbers = PUBLIC_KEY.public_numbers()
        jwk = {
            "kty": "RSA",
            "kid": "hospyn-auth-key-1",
            "use": "sig",
            "alg": "RS256",
            "n": _int_to_base64url(public_numbers.n),
            "e": _int_to_base64url(public_numbers.e),
        }
        return {"keys": [jwk]}
    
    return {"keys": []}
