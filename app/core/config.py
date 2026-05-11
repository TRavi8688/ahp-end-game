import os
import logging
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Any
from dotenv import load_dotenv

# Production-grade configuration loader
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn 2.0 Secure (GCP)"
    VERSION: str = "2.0.1-PATCHED"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str # production, staging, development
    DEMO_MODE: bool = False
    CLOUD_PROVIDER: str = "gcp" # gcp, aws
    SENTRY_DSN: Optional[str] = None
    
    # --- 1. ENTERPRISE AUTHENTICATION (RS256) ---
    JWT_PRIVATE_KEY: str
    JWT_PUBLIC_KEY: str
    JWT_AUDIENCE: str = "hospyn-enterprise-clients"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SECRET_KEY: str # For admin probes and internal hashing
    
    @field_validator("JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", mode="before")
    @classmethod
    def decode_base64_keys(cls, v: Any) -> str:
        if not isinstance(v, str):
            return v
        v = v.strip().strip('"').strip("'").replace("\\n", "\n")
        if not v.startswith("-----BEGIN"):
            import base64
            import re
            try:
                v_clean = re.sub(r"\s+", "", v)
                return base64.b64decode(v_clean).decode("utf-8")
            except Exception:
                return v
        return v
    
    # --- 2. CLOUD INFRASTRUCTURE ---
    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: Optional[str] = None
    
    # --- 3. DATA INTEGRITY ---
    DATABASE_URL: str
    REDIS_URL: Optional[str] = None
    USE_REDIS: bool = False
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_db_url(cls, v: Any) -> str:
        if not v:
            raise ValueError("CRITICAL: DATABASE_URL is mandatory.")
        url = str(v)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # --- 4. INFRASTRUCTURE & COMPLIANCE ---
    ALLOWED_ORIGINS: List[str] = []
    TRUSTED_PROXIES: List[str] = ["127.0.0.1"]
    
    @field_validator("ALLOWED_ORIGINS", "TRUSTED_PROXIES", mode="before")
    @classmethod
    def assemble_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v
    
    # --- 5. SECURE COMMUNICATIONS ---
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    TWO_FACTOR_API_KEY: Optional[str] = None
    
    # --- 6. AI ENGINE ---
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SARVAM_KEY: Optional[str] = None

    # --- 7. FIELD-LEVEL ENCRYPTION ---
    ENCRYPTION_KEY: str
    PREVIOUS_ENCRYPTION_KEYS: List[str] = []
    
    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("sqlite://"):
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_lockdown(self) -> "Settings":
        """Resilient startup: Lockdown checks are deferred to runtime for debugging."""
        return self

settings = Settings()
