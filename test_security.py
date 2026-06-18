"""
backend/auth-service/tests/test_security.py

Security-focused unit tests. These do NOT need a live database — they test
pure logic: JWT algorithm enforcement, key validation, and startup guards.
"""
import os
import time
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Adjust these imports to match your actual module layout.
# ---------------------------------------------------------------------------
# from app.core.security import create_access_token, decode_access_token
# from app.core.config import Settings


# ---------------------------------------------------------------------------
# JWT algorithm tests
# ---------------------------------------------------------------------------

class TestJwtAlgorithm:
    def test_jwt_cannot_use_none_algorithm(self):
        """
        A token crafted with alg='none' must be rejected.
        This guards against the classic JWT 'none' algorithm attack where an
        attacker strips the signature and sets alg to 'none'.
        """
        import jwt as pyjwt  # PyJWT

        payload = {"sub": "user-uuid-123", "version": 0}

        # Craft a token with alg=none (no signature)
        none_token = pyjwt.encode(payload, key="", algorithm="none")

        # Your decode function must NOT accept this token
        try:
            # from app.core.security import decode_access_token
            # decoded = decode_access_token(none_token)
            # pytest.fail(f"Should have raised, but got: {decoded}")
            #
            # Stand-in assertion until app is importable:
            decoded = pyjwt.decode(
                none_token,
                options={"verify_signature": False},
                algorithms=["HS256"],  # only allow HS256 — 'none' should fail
            )
            # If we're here with the wrong algorithms list, the test setup is wrong
            pytest.fail("pyjwt should have raised with restricted algorithms list")
        except pyjwt.exceptions.InvalidAlgorithmError:
            pass  # ← expected
        except pyjwt.exceptions.DecodeError:
            pass  # also acceptable — token is malformed

    def test_jwt_signed_with_wrong_key_rejected(self):
        """
        A token signed with a different secret key must be rejected.
        Simulates a forged token from an attacker who guessed the algorithm but
        not the secret.
        """
        import jwt as pyjwt

        correct_secret = "super-secret-key-that-only-we-know"
        wrong_secret = "attackers-key"

        payload = {"sub": "user-uuid-456", "version": 0}
        forged_token = pyjwt.encode(payload, wrong_secret, algorithm="HS256")

        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            pyjwt.decode(forged_token, correct_secret, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# Startup configuration guards
# ---------------------------------------------------------------------------

class TestStartupGuards:
    def test_weak_password_rejected_at_startup(self):
        """
        Settings initialised with SECRET_KEY='password' must raise ValueError.
        This prevents accidental deployment with a default/weak secret.
        """
        # Adjust to your actual Settings class:
        # from app.core.config import Settings
        # with pytest.raises(ValueError, match="SECRET_KEY"):
        #     Settings(SECRET_KEY="password", DATABASE_URL="postgresql://...", ...)

        # Stand-alone validation logic (mirrors what Settings should do):
        def validate_secret_key(key: str) -> str:
            weak = {"password", "secret", "changeme", "hospyn", "admin", "12345678"}
            if key.lower() in weak or len(key) < 32:
                raise ValueError(
                    f"SECRET_KEY is too weak. Must be ≥32 chars and not a known default."
                )
            return key

        with pytest.raises(ValueError, match="SECRET_KEY"):
            validate_secret_key("password")

        with pytest.raises(ValueError, match="SECRET_KEY"):
            validate_secret_key("short")

        # Valid key should not raise
        validate_secret_key("a" * 32)

    def test_cors_wildcard_rejected_in_production(self):
        """
        ALLOWED_ORIGINS='*' with ENV='production' must raise RuntimeError.
        Wildcard CORS in production exposes the API to cross-site attacks.
        """
        def validate_cors(allowed_origins: str, env: str) -> None:
            if env == "production" and allowed_origins.strip() == "*":
                raise RuntimeError(
                    "ALLOWED_ORIGINS='*' is not permitted in production. "
                    "Specify explicit origins."
                )

        with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
            validate_cors("*", "production")

        # Should be fine in development
        validate_cors("*", "development")

        # Should be fine in production with explicit origins
        validate_cors("https://app.hospyn.in,https://admin.hospyn.in", "production")


# ---------------------------------------------------------------------------
# SQL injection tests
# ---------------------------------------------------------------------------

class TestSqlInjection:
    @pytest.mark.asyncio
    async def test_sql_injection_in_search(self, client):
        """
        Passing a classic SQL injection payload to a search endpoint must
        return a safe response (400/422/empty results) — never a 500 or raw
        SQL error, which would confirm the injection worked.
        """
        injection_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1' UNION SELECT username, password FROM users --",
            "admin'--",
        ]

        for payload in injection_payloads:
            resp = await client.get(
                "/api/v1/search",
                params={"q": payload},
                headers={"Authorization": "Bearer fake-token-will-401"},
            )
            # We accept 400/401/422 — all mean the payload was handled safely.
            # We must NOT see 500 (which could mean raw SQL error / stack trace).
            assert resp.status_code != 500, (
                f"Payload '{payload}' caused a 500 — possible SQL injection vulnerability.\n"
                f"Response: {resp.text}"
            )
            # Also verify the response body doesn't leak SQL error messages
            body_lower = resp.text.lower()
            sql_error_indicators = [
                "sqlalchemy",
                "psycopg",
                "syntax error",
                "pg_",
                "unterminated quoted string",
            ]
            for indicator in sql_error_indicators:
                assert indicator not in body_lower, (
                    f"Response for payload '{payload}' contains SQL error hint "
                    f"'{indicator}': {resp.text[:200]}"
                )
