import os
import logging
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Any
from dotenv import load_dotenv

# Production-grade configuration loader
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "AHP 2.0 Secure (GCP)"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str # production, staging, development
    CLOUD_PROVIDER: str = "gcp" # gcp, aws
    SENTRY_DSN: Optional[str] = None
    
    # --- 1. ENTERPRISE AUTHENTICATION (RS256) ---
    JWT_PRIVATE_KEY: str
    JWT_PUBLIC_KEY: str
    JWT_AUDIENCE: str = "ahp-enterprise-clients"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # --- 2. CLOUD INFRASTRUCTURE ---
    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: Optional[str] = None
    
    # --- 3. DATA INTEGRITY ---
    DATABASE_URL: str
    REDIS_URL: str
    
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
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> Any:
        import json
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return [i.strip() for i in v.split(",")]
        return v
    
    # --- 5. SECURE COMMUNICATIONS ---
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    # --- 6. AI ENGINE (Multi-Provider) ---
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SARVAM_KEY: Optional[str] = None
    INSFORGE_BASE_URL: Optional[str] = None
    INSFORGE_ANON_KEY: Optional[str] = None

    # --- 7. OBSERVABILITY (OpenTelemetry) ---
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"


    # --- 7. FIELD-LEVEL ENCRYPTION ---
    ENCRYPTION_KEY: str
    PREVIOUS_ENCRYPTION_KEYS: List[str] = []
    
    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("sqlite://"):
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if "asyncpg" in url:
            url = url.replace("asyncpg", "psycopg2")
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        elif "aiosqlite" in url:
            url = url.replace("+aiosqlite", "")
        return url

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_lockdown(self) -> "Settings":
        """Fail-fast check for zero-trust compliance on GCP/AWS."""
        if self.ENVIRONMENT == "production":
            if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                raise ValueError("PRODUCTION_FAIL: Managed database must be used in production.")
            
            if not self.REDIS_URL or "localhost" in self.REDIS_URL:
                raise ValueError("PRODUCTION_FAIL: Managed cache (Redis) is mandatory.")
            
            if self.CLOUD_PROVIDER == "gcp":
                if not self.GCP_PROJECT_ID:
                    raise ValueError("PRODUCTION_FAIL: GCP_PROJECT_ID is mandatory for GCP.")
                if not self.GCS_BUCKET_NAME:
                    raise ValueError("PRODUCTION_FAIL: GCS_BUCKET_NAME is mandatory for GCP.")
            elif self.CLOUD_PROVIDER == "aws":
                if not self.AWS_S3_BUCKET:
                    raise ValueError("PRODUCTION_FAIL: AWS_S3_BUCKET is mandatory for AWS.")
                if not self.AWS_REGION:
                    raise ValueError("PRODUCTION_FAIL: AWS_REGION is mandatory for AWS.")
        
        return self

settings = Settings()
