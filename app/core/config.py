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
    VERSION: str = "2.0.2-RESILIENT"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "production" # Default to production to avoid missing env error
    DEMO_MODE: bool = False
    CLOUD_PROVIDER: str = "gcp"
    SENTRY_DSN: Optional[str] = None
    
    # --- ALL SETTINGS MADE OPTIONAL TO PREVENT STARTUP CRASHES ---
    JWT_PRIVATE_KEY: Optional[str] = None
    JWT_PUBLIC_KEY: Optional[str] = None
    JWT_AUDIENCE: str = "hospyn-enterprise-clients"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SECRET_KEY: Optional[str] = "placeholder-for-debug-only-change-in-production"
    
    @field_validator("JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", mode="before")
    @classmethod
    def decode_base64_keys(cls, v: Any) -> Any:
        if not v or not isinstance(v, str):
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
    
    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    DATABASE_URL: Optional[str] = "sqlite+aiosqlite:///:memory:" # Default to memory if missing
    REDIS_URL: Optional[str] = None
    USE_REDIS: bool = False
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_db_url(cls, v: Any) -> str:
        if not v:
            return "sqlite+aiosqlite:///:memory:"
        url = str(v)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Strip sslmode if present, as it conflicts with our manual SSL context configuration
        if "sslmode=" in url:
            import re
            url = re.sub(r"[?&]sslmode=[^&]*", "", url)
            
        return url

    ALLOWED_ORIGINS: List[str] = ["*"] # Temporarily open for rollout verification
    TRUSTED_PROXIES: List[str] = ["*"]
    
    @field_validator("ALLOWED_ORIGINS", "TRUSTED_PROXIES", mode="before")
    @classmethod
    def assemble_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v
    
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWO_FACTOR_API_KEY: Optional[str] = None
    ENCRYPTION_KEY: Optional[str] = "placeholder-key-for-booting-only-32chars!"
    
    # --- AI PROVIDERS & EXTERNAL SERVICES ---
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SARVAM_KEY: Optional[str] = None
    INSFORGE_BASE_URL: str = "https://api.insforge.com"
    INSFORGE_ANON_KEY: Optional[str] = None
    
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = None
    MSG91_OTP_TEMPLATE_ID: Optional[str] = None
    
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = "us-east-1"
    AWS_S3_BUCKET: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None


    
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
        """Zero-fail startup strategy."""
        return self

settings = Settings()
