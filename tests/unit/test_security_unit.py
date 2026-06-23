import pytest
from app.core import security
from jose import jwt
from app.core.config import settings

def test_password_hashing():
    """Verify that password hashing and verification are consistent."""
    password = "BillionDollarPassword123!"
    hashed = security.get_password_hash(password)
    
    assert hashed != password
    assert security.verify_password(password, hashed) is True
    assert security.verify_password("wrong_password", hashed) is False

def test_jwt_token_creation_and_decoding():
    """Verify that JWT tokens are correctly created and decoded with claims."""
    subject = "user@example.com"
    role = "patient"
    
    token = security.create_access_token(subject, role)
    decoded = security.decode_token(token)
    
    assert decoded["sub"] == subject
    assert decoded["role"] == role
    assert "exp" in decoded

def test_token_expiration():
    """Verify that decoded tokens contain an expiration claim."""
    token = security.create_access_token("test", "patient")
    decoded = security.decode_token(token)
    assert decoded is not None
    assert "exp" in decoded
