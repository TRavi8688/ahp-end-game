"""
auth-service/app/core/security.py

RS256 JWT token creation and JWKS key management.

FIXES:
  - Standardized on RS256 throughout (was mixed HS256/RS256)
  - create_access_token / create_refresh_token now use RSA private key
  - Public key exposed via JWKS endpoint for healthcare-core to validate
  - Keys loaded from env vars in production, generated in dev only

PLACE AT: backend/auth-service/app/core/security.py
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

logger = logging.getLogger(__name__)

ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

# ── Key loading ───────────────────────────────────────────────────────────────

def _load_or_generate_rsa_keys():
    """
    Load RSA keys from environment (production) or generate for dev.

    Env vars (base64-encoded PEM):
        JWT_PRIVATE_KEY_PEM
        JWT_PUBLIC_KEY_PEM

    To generate and store in GCP Secret Manager:
        openssl genrsa -out private_key.pem 2048
        openssl rsa -in private_key.pem -pubout -out public_key.pem
        base64 -w0 private_key.pem   # → JWT_PRIVATE_KEY_PEM
        base64 -w0 public_key.pem    # → JWT_PUBLIC_KEY_PEM
    """
    private_key_b64 = os.environ.get("JWT_PRIVATE_KEY_PEM")
    public_key_b64 = os.environ.get("JWT_PUBLIC_KEY_PEM")

    if private_key_b64 and public_key_b64:
        try:
            private_pem = base64.b64decode(private_key_b64)
            public_pem = base64.b64decode(public_key_b64)
            private_key = serialization.load_pem_private_key(
                private_pem, password=None, backend=default_backend()
            )
            public_key = serialization.load_pem_public_key(
                public_pem, backend=default_backend()
            )
            logger.info("JWT RSA keys loaded from environment")
            return private_key, public_key
        except Exception as e:
            logger.error("Failed to load JWT keys from env: %s", e)
            if ENVIRONMENT != "development":
                raise RuntimeError(
                    "JWT_PRIVATE_KEY_PEM or JWT_PUBLIC_KEY_PEM is invalid. "
                    "Cannot start auth-service in production without valid keys."
                ) from e

    if ENVIRONMENT != "development":
        raise RuntimeError(
            "JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM must be set in production."
        )

    logger.warning(
        "JWT keys not found — generating ephemeral pair (DEVELOPMENT ONLY). "
        "All sessions invalidated on restart."
    )

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    logger.warning("=" * 60)
    logger.warning("SAVE THESE TO GCP SECRET MANAGER (one-time setup):")
    logger.warning("JWT_PRIVATE_KEY_PEM=%s", base64.b64encode(private_pem).decode())
    logger.warning("JWT_PUBLIC_KEY_PEM=%s", base64.b64encode(public_pem).decode())
    logger.warning("=" * 60)

    return private_key, public_key


_PRIVATE_KEY, _PUBLIC_KEY = _load_or_generate_rsa_keys()

PRIVATE_KEY_PEM: bytes = _PRIVATE_KEY.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
)

PUBLIC_KEY_PEM: bytes = _PUBLIC_KEY.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
)

ALGORITHM = "RS256"


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed RS256 JWT access token."""
    from app.config.settings import settings
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, PRIVATE_KEY_PEM, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a signed RS256 JWT refresh token."""
    from app.config.settings import settings
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, PRIVATE_KEY_PEM, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT using our public key. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, PUBLIC_KEY_PEM, algorithms=[ALGORITHM])


def decode_refresh_token(token: str) -> dict | None:
    """Decode a refresh token. Returns None on any failure."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            return None
        return payload
    except jwt.PyJWTError:
        return None


# ── JWKS export ───────────────────────────────────────────────────────────────

def get_jwks() -> dict:
    """
    Return the JWKS (JSON Web Key Set) containing our RS256 public key.
    Served at /.well-known/jwks.json for healthcare-core to validate tokens.
    """
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
    pub_key: RSAPublicKey = _PUBLIC_KEY
    pub_numbers = pub_key.public_key().public_numbers() if hasattr(pub_key, "public_key") else pub_key.public_numbers()

    def _int_to_base64url(n: int) -> str:
        byte_length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(byte_length, "big")).rstrip(b"=").decode()

    return {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": "hospyn-auth-key-1",
                "n": _int_to_base64url(pub_numbers.n),
                "e": _int_to_base64url(pub_numbers.e),
            }
        ]
    }
