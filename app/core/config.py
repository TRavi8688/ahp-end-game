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
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str # production, staging, development
    DEMO_MODE: bool = True
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
            
        # 1. Strip quotes and surrounding whitespace
        v = v.strip().strip('"').strip("'")
        
        # 2. Handle literal \n or mixed whitespace from CI/CD injection
        v = v.replace("\\n", "\n")
        
        # 3. If it doesn't look like a PEM, assume it's Base64 and STRIP ALL INTERNAL WHITESPACE
        if not v.startswith("-----BEGIN"):
            import base64
            import re
            try:
                # Remove spaces, newlines, and tabs that often corrupt CI secrets
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
    REDIS_URL: str
    USE_REDIS: bool = True
    
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
    TRUSTED_PROXIES: List[str] = ["127.0.0.1"] # Whitelist of trusted proxy IPs
    
    @field_validator("ALLOWED_ORIGINS", "TRUSTED_PROXIES", mode="before")
    @classmethod
    def assemble_list(cls, v: Any) -> Any:
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
    
    TWO_FACTOR_API_KEY: Optional[str] = None
    
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
        """Fail-fast check for zero-trust compliance and production safety."""
        if self.ENVIRONMENT == "production":
            # Infrastructure Checks
            if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                raise ValueError("PRODUCTION_FAIL: Managed database must be used in production.")
            
            if not self.REDIS_URL or "localhost" in self.REDIS_URL:
                raise ValueError("PRODUCTION_FAIL: Managed cache (Redis) is mandatory.")

            # Network Security Checks
            if "*" in self.TRUSTED_PROXIES:
                raise ValueError("PRODUCTION_FAIL: trusted_hosts wildcard '*' is strictly forbidden in production.")
            
            if "*" in self.ALLOWED_ORIGINS:
                 raise ValueError("PRODUCTION_FAIL: CORS wildcard '*' is strictly forbidden in production.")

            # Feature/Mode Checks
            if self.DEMO_MODE:
                raise ValueError("PRODUCTION_FAIL: DEMO_MODE must be disabled in production.")

            # Secret Entropy Checks
            if len(self.SECRET_KEY) < 32:
                 raise ValueError("PRODUCTION_FAIL: SECRET_KEY is too weak (min 32 chars).")

            # Communication Checks
            if not self.TWO_FACTOR_API_KEY:
                raise ValueError("PRODUCTION_FAIL: TWO_FACTOR_API_KEY is mandatory for production SMS.")

            # Cloud Provider Specifics
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
