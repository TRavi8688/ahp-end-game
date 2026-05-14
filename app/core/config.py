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
    DATABASE_URL: str = "sqlite+aiosqlite:///./hospyn_local.db"
    REDIS_URL: Optional[str] = None
    USE_REDIS: bool = True
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # --- 5. NETWORK & CORS ---
    ALLOWED_ORIGINS: Any = [
        "https://hospyn-495906.web.app",
        "https://app.hospyn.com",
        "http://localhost:8081",
        "http://localhost:3000"
    ]
    TRUSTED_PROXIES: List[str] = ["*"]
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_origins(cls, v: Any) -> Any:
        # Load from Secret Manager if available
        sm_val = get_secret("ALLOWED_ORIGINS", default="")
        if sm_val:
            v = sm_val

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

    @model_validator(mode="after")
    def validate_production_lockdown(self) -> "Settings":
        """SHIELD V10: Resilient post-init secret loading & DB URL transformation."""
        
        # 1. Lazy load critical secrets from SM if they are still defaults
        if self.SECRET_KEY == "placeholder-for-debug-only-change-in-production":
            self.SECRET_KEY = get_secret("SECRET_KEY", self.SECRET_KEY)
        
        if self.ENCRYPTION_KEY == "placeholder-key-for-booting-only-32chars!":
            self.ENCRYPTION_KEY = get_secret("ENCRYPTION_KEY", self.ENCRYPTION_KEY)

        # 2. Production Safety Checks
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("PRODUCTION_FAIL: DEBUG must be False")
            
            if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                raise ValueError("PRODUCTION_FAIL: Managed database (RDS/Cloud SQL) must be used.")
            
            if not self.REDIS_URL or "localhost" in self.REDIS_URL:
                logger.warning("PRODUCTION_WARN: Using local Redis or Redis disabled. Managed Redis recommended.")

            if len(self.SECRET_KEY) < 32:
                raise ValueError("PRODUCTION_FAIL: SECRET_KEY too short.")

        # 3. Load Keys
        if not self.JWT_PRIVATE_KEY:
            self.JWT_PRIVATE_KEY = load_rsa_key("JWT_PRIVATE_KEY", "priv.pem")
        if not self.JWT_PUBLIC_KEY:
            self.JWT_PUBLIC_KEY = load_rsa_key("JWT_PUBLIC_KEY", "pub.pem")

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
