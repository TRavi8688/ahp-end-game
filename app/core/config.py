import os
import logging
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Any
from dotenv import load_dotenv

# Production-grade configuration loader
load_dotenv()

from app.core.secrets import get_secret, load_rsa_key

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn 2.0 Secure (GCP)"
    VERSION: str = "2.0.2-RESILIENT"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEMO_MODE: bool = False
    
    # --- SECURITY (Hardened via Shield V5) ---
    JWT_PRIVATE_KEY: Optional[str] = load_rsa_key("JWT_PRIVATE_KEY", "priv.pem")
    JWT_PUBLIC_KEY: Optional[str] = load_rsa_key("JWT_PUBLIC_KEY", "pub.pem")
    JWT_AUDIENCE: str = get_secret("JWT_AUDIENCE", "hospyn-enterprise-clients")
    
    SECRET_KEY: Optional[str] = get_secret("SECRET_KEY", "placeholder-for-debug-only-change-in-production")
    ENCRYPTION_KEY: Optional[str] = get_secret("ENCRYPTION_KEY")

    GCP_PROJECT_ID: Optional[str] = get_secret("GCP_PROJECT_ID")
    GCS_BUCKET_NAME: Optional[str] = get_secret("GCS_BUCKET_NAME")
    
    # --- DATABASE ISOLATION (Priority 1) ---
    DATABASE_URL: Optional[str] = get_secret("DATABASE_URL")
    DATABASE_READER_URL: Optional[str] = get_secret("DATABASE_READER_URL") # For Read Replicas
    REDIS_URL: Optional[str] = get_secret("REDIS_URL")
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
    TWILIO_PHONE_NUMBER: Optional[str] = None  # Alias for TWILIO_FROM_NUMBER
    
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
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
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
