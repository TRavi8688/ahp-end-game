"""
app/core/config.py
Startup validation: refuses to run with weak or default secrets.
Place this in: backend/auth-service/app/core/config.py
             AND backend/healthcare-core/app/core/config.py
"""
import os
import sys
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


INSECURE_SECRET_PATTERNS = (
    "supersecretkey",
    "secret",
    "changeme",
    "change_me",
    "password",
    "CHANGE_ME",
    "your_secret",
)

INSECURE_FERNET_PATTERNS = (
    "CHANGE_ME",
    "CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs=",  # The compromised key — always reject
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: str = "production"
    PORT: int = 8080

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Security
    SECRET_KEY: str
    FERNET_KEY: str

    # CORS
    ALLOWED_ORIGINS: str = ""

    # Optional
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "info"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        for pattern in INSECURE_SECRET_PATTERNS:
            if pattern.lower() in v.lower():
                _fatal(
                    f"SECRET_KEY contains insecure pattern '{pattern}'. "
                    "Generate with: python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
        if len(v) < 32:
            _fatal("SECRET_KEY must be at least 32 characters.")
        return v

    @field_validator("FERNET_KEY")
    @classmethod
    def fernet_key_must_be_valid(cls, v: str) -> str:
        for pattern in INSECURE_FERNET_PATTERNS:
            if v == pattern or pattern in v:
                _fatal(
                    f"FERNET_KEY is compromised or is a placeholder. "
                    "Generate with: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                )
        # Validate it's a real Fernet key
        try:
            from cryptography.fernet import Fernet
            Fernet(v.encode())
        except Exception:
            _fatal("FERNET_KEY is not a valid Fernet key. See generation command above.")
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_must_be_postgres(cls, v: str) -> str:
        if "sqlite" in v.lower():
            _fatal(
                "DATABASE_URL points to SQLite. "
                "SQLite is not supported in production — use PostgreSQL. "
                "Example: postgresql+asyncpg://user:password@postgres:5432/hospyn"
            )
        
        # Ensure postgresql+asyncpg
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Sanitize query parameters for asyncpg
        try:
            from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
            parsed = urlparse(v)
            q_params = dict(parse_qsl(parsed.query))
            q_params.pop("channel_binding", None)
            if "sslmode" in q_params:
                val = q_params.pop("sslmode")
                if val in ("disable", "allow", "prefer", "require", "verify-ca", "verify-full"):
                    q_params["ssl"] = val
                else:
                    q_params["ssl"] = "require"
            new_query = urlencode(q_params)
            parsed = parsed._replace(query=new_query)
            v = urlunparse(parsed)
        except Exception:
            pass
        return v

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def cors_must_not_be_wildcard(cls, v: str) -> str:
        if v.strip() == "*":
            _fatal(
                "ALLOWED_ORIGINS='*' is not allowed. "
                "Set it to your actual frontend domains: https://app.hospyn.com"
            )
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"


def _fatal(message: str) -> None:
    print(f"\n{'='*60}\nSTARTUP SECURITY ERROR\n{'='*60}\n{message}\n{'='*60}\n", file=sys.stderr)
    sys.exit(1)


@lru_cache
def get_settings() -> Settings:
    return Settings()
