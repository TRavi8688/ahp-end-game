import os
import logging
from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Any
from dotenv import load_dotenv

# Production-grade configuration loader
load_dotenv()

from app.core.secrets import get_secret, load_rsa_key

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn 2.0 Secure (GCP)"
    VERSION: str = "2.0.2-RESILIENT"
    API_V1_STR: str = "/api/v1"
    
    # --- 1. ENVIRONMENT ---
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development") # production, staging, development
    DEBUG: bool = False  # CRITICAL: Must be False in production
    SENTRY_DSN: Optional[str] = None
    
    # --- 2. SECURITY (Hardened via Shield V10) ---
    JWT_PRIVATE_KEY: Optional[str] = None
    JWT_PUBLIC_KEY: Optional[str] = None
    JWT_AUDIENCE: str = "hospyn-enterprise-clients"
    SECRET_KEY: str = "placeholder-for-debug-only-change-in-production"
    ENCRYPTION_KEY: str = "placeholder-key-for-booting-only-32chars!"
    
    # JWT Settings (Defaults for Production)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- 3. CLOUD INFRASTRUCTURE (GCP/AWS) ---
    CLOUD_PROVIDER: str = "gcp" # "gcp" or "aws"
    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    
    # AWS specific
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: Optional[str] = None
    
    # --- 4. DATABASE & CACHE ---
    DATABASE_URL: str = os.getenv("ASYNC_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./hospyn_local.db"))
    REDIS_URL: Optional[str] = None
    USE_REDIS: bool = True
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40

    ALLOWED_ORIGINS: Any = [
        "http://localhost:3000",
        "http://localhost:19006",
        "https://hospyn-patient-app.web.app",
        "https://hospyn-patient-app.firebaseapp.com",
        "https://hospyn-doctor-pro.web.app",
        "https://hospyn-doctor-pro.firebaseapp.com",
        "https://hospyn-erp-portal.web.app",
        "https://hospyn-erp-portal.firebaseapp.com",
        "https://hospyn-gateway.web.app",
        "https://hospyn-gateway.firebaseapp.com",
        "https://hospyn-495906-96438.web.app",
        "https://hospyn-495906-96438.firebaseapp.com",
    ]
    TRUSTED_PROXIES: List[str] = [] # Tighten for production; add specific proxy IPs if needed
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_origins(cls, v: Any) -> Any:
        # Load from ENV or Secret Manager if available
        val = os.getenv("HOSPYN_ALLOWED_ORIGINS", get_secret("ALLOWED_ORIGINS", default=""))
        if val:
            v = val

        if isinstance(v, str):
            clean_v = v.strip()
            if clean_v.startswith("[") and clean_v.endswith("]"):
                try:
                    import json
                    return json.loads(clean_v)
                except Exception:
                    v = clean_v[1:-1]
            return [i.strip().replace('"', '').replace("'", "") for i in v.split(",") if i.strip()]
        return v

    # --- 6. EXTERNAL SERVICES ---
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SARVAM_KEY: Optional[str] = None
    
    # --- 7. PREMIUM SERVICES ---
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_placeholder")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "placeholder_secret")
    SENDGRID_API_KEY: Optional[str] = os.getenv("SENDGRID_API_KEY", None)
    
    # --- LOGIC & VALIDATION ---

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("sqlite://"):
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        # Remove +asyncpg or +aiosqlite if present
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "")
        if "+aiosqlite" in url:
            url = url.replace("+aiosqlite", "")
        # For postgres, ensure it's postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    @property
    def DATABASE_READER_URL(self) -> Optional[str]:
        # Legacy support for reader URL from secrets
        return get_secret("DATABASE_READER_URL")

    @property
    def sync_reader_url(self) -> str:
        url = self.DATABASE_READER_URL or self.DATABASE_URL
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "")
        if "+aiosqlite" in url:
            url = url.replace("+aiosqlite", "")
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    @model_validator(mode="after")
    def validate_production_lockdown(self) -> "Settings":
        """SHIELD V10: Resilient post-init secret loading & DB URL transformation."""
        
        # 1. Lazy load critical secrets from SM/ENV if they are still defaults
        self.SECRET_KEY = os.getenv("HOSPYN_SECRET_KEY", get_secret("SECRET_KEY", self.SECRET_KEY))
        self.ENCRYPTION_KEY = os.getenv("HOSPYN_ENCRYPTION_KEY", get_secret("ENCRYPTION_KEY", self.ENCRYPTION_KEY))

        # 2. Load Keys (Must happen before validation)
        if not self.JWT_PRIVATE_KEY:
            self.JWT_PRIVATE_KEY = os.getenv("HOSPYN_PRIVATE_KEY", load_rsa_key("JWT_PRIVATE_KEY", "priv.pem"))
        if not self.JWT_PUBLIC_KEY:
            self.JWT_PUBLIC_KEY = os.getenv("HOSPYN_PUBLIC_KEY", load_rsa_key("JWT_PUBLIC_KEY", "pub.pem"))

        # 3. Production Safety Checks
        if self.ENVIRONMENT == "production":
            # Force Debug off in production regardless of input
            self.DEBUG = False
            
            allow_insecure = os.getenv("HOSPYN_ALLOW_INSECURE_BOOT", "false").lower() == "true"
            
            if not allow_insecure:
                if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                    raise ValueError("PRODUCTION_FAIL: Managed database (RDS/Cloud SQL) must be used.")
                
                if len(self.SECRET_KEY) < 32 or "placeholder" in self.SECRET_KEY:
                    raise ValueError("PRODUCTION_FAIL: SECRET_KEY is missing or insecure. Add HOSPYN_SECRET_KEY to GitHub Secrets.")
                
                if not self.JWT_PRIVATE_KEY or "BEGIN" not in self.JWT_PRIVATE_KEY:
                     raise ValueError("PRODUCTION_FAIL: Valid JWT_PRIVATE_KEY is required for Production. Add HOSPYN_PRIVATE_KEY to GitHub Secrets.")

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except Exception as e:
        print(f">>> HOSPYN_SETTINGS_INIT_FATAL: {e}")
        raise

settings = get_settings()
from functools import lru_cache
