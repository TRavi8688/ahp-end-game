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
<<<<<<< Updated upstream
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEMO_MODE: bool = False
=======
    ENVIRONMENT: str # production, staging, development
    DEBUG: bool = False  # CRITICAL: Must be False in production
    SENTRY_DSN: Optional[str] = None
    SECRET_KEY: str  # CRITICAL: For security operations
>>>>>>> Stashed changes
    
    # JWT Settings (Defaults for Production)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days (Shield V5 Default)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    
<<<<<<< Updated upstream
    # --- SECURITY (Hardened via Shield V5) ---
    @property
    def JWT_PRIVATE_KEY(self) -> Optional[str]:
        return load_rsa_key("JWT_PRIVATE_KEY", "priv.pem")

    @property
    def JWT_PUBLIC_KEY(self) -> Optional[str]:
        return load_rsa_key("JWT_PUBLIC_KEY", "pub.pem")

    @property
    def JWT_AUDIENCE(self) -> str:
        return get_secret("JWT_AUDIENCE", "hospyn-enterprise-clients")
=======
    # --- 2. CLOUD INFRASTRUCTURE (GCP/AWS) ---
    CLOUD_PROVIDER: str = "gcp" # "gcp" or "aws"
    
    # GCP specific
    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    
    # AWS specific
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: Optional[str] = None
>>>>>>> Stashed changes
    
    @property
    def SECRET_KEY(self) -> str:
        return get_secret("SECRET_KEY", "placeholder-for-debug-only-change-in-production")

    @property
    def ENCRYPTION_KEY(self) -> Optional[str]:
        return get_secret("ENCRYPTION_KEY")

    @property
    def GCP_PROJECT_ID(self) -> Optional[str]:
        return get_secret("GCP_PROJECT_ID")

    @property
    def GCS_BUCKET_NAME(self) -> Optional[str]:
        return get_secret("GCS_BUCKET_NAME")
    
    # --- DATABASE ISOLATION (Priority 1) ---
    @property
    def DATABASE_URL(self) -> str:
        v = get_secret("DATABASE_URL")
        if not v:
            return "sqlite+aiosqlite:///:memory:"
        url = str(v)
        # Transform for asyncpg compatibility
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Strip sslmode if present
        if "sslmode=" in url:
            import re
            url = re.sub(r"[?&]sslmode=[^&]*", "", url)
        return url

    @property
    def DATABASE_READER_URL(self) -> Optional[str]:
        return get_secret("DATABASE_READER_URL")

    @property
    def REDIS_URL(self) -> Optional[str]:
        return get_secret("REDIS_URL")
        
    USE_REDIS: bool = False

    ALLOWED_ORIGINS: Any = [
        "https://hospyn-495906.web.app",
        "https://app.hospyn.com"
    ]

    TRUSTED_PROXIES: List[str] = ["*"]
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_origins(cls, v: Any) -> Any:
        # Load from Secret Manager if available (Optional Resilience Patch)
        sm_val = get_secret("ALLOWED_ORIGINS", default="")
        if sm_val:
            return [i.strip() for i in sm_val.split(",") if i.strip()]
            
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    
<<<<<<< Updated upstream
=======
    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        """Enforce production safety requirements."""
        if self.ENVIRONMENT == "production":
            # CRITICAL: DEBUG must be False
            if self.DEBUG:
                raise ValueError("CRITICAL: DEBUG must be False in production")
            
            # CRITICAL: CORS must not be empty
            if not self.ALLOWED_ORIGINS or self.ALLOWED_ORIGINS == ["*"]:
                raise ValueError("CRITICAL: CORS origins must be explicitly set for production (no wildcards)")
            
            # CRITICAL: CORS must not be localhost
            if any("localhost" in origin or "127.0.0.1" in origin for origin in self.ALLOWED_ORIGINS):
                raise ValueError("CRITICAL: CORS origins cannot be localhost in production")
            
            # CRITICAL: All secrets must be set
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError("CRITICAL: SECRET_KEY must be set and >= 32 characters")
            
            if not self.ENCRYPTION_KEY or len(self.ENCRYPTION_KEY) < 32:
                raise ValueError("CRITICAL: ENCRYPTION_KEY must be set and >= 32 characters")
            
            if not self.JWT_PRIVATE_KEY or "PRIVATE KEY" not in self.JWT_PRIVATE_KEY:
                raise ValueError("CRITICAL: JWT_PRIVATE_KEY must be a valid private key")
            
            if not self.JWT_PUBLIC_KEY or "PUBLIC KEY" not in self.JWT_PUBLIC_KEY:
                raise ValueError("CRITICAL: JWT_PUBLIC_KEY must be a valid public key")
            
            # WARN: Recommend Sentry in production
            if not self.SENTRY_DSN:
                logger.warning("WARNING: SENTRY_DSN not set - error tracking disabled")
        
        return self
    
    # --- 5. SECURE COMMUNICATIONS ---
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        """Zero-fail startup strategy."""
=======
        """Fail-fast check for zero-trust compliance on Cloud."""
        if self.ENVIRONMENT == "production":
            if "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                raise ValueError("PRODUCTION_FAIL: Managed database (RDS/Cloud SQL) must be used.")
            
            if not self.REDIS_URL or "localhost" in self.REDIS_URL:
                raise ValueError("PRODUCTION_FAIL: Managed Redis (ElastiCache/Memorystore) is mandatory.")
            
            if self.CLOUD_PROVIDER == "gcp":
                if not self.GCP_PROJECT_ID:
                    raise ValueError("PRODUCTION_FAIL: GCP_PROJECT_ID mandatory for GCP.")
                if not self.GCS_BUCKET_NAME:
                    raise ValueError("PRODUCTION_FAIL: GCS_BUCKET_NAME mandatory for GCP.")
            
            elif self.CLOUD_PROVIDER == "aws":
                if not self.S3_BUCKET_NAME:
                    raise ValueError("PRODUCTION_FAIL: S3_BUCKET_NAME mandatory for AWS.")
                # Note: IAM Roles can be used instead of keys, so we don't strictly enforce keys here
        
>>>>>>> Stashed changes
        return self

print(">>> HOSPYN_CONFIG_IMPORT_BEGIN")

from functools import lru_cache

@lru_cache
def get_settings() -> Settings:
    """Lazy-loaded, cached settings to prevent boot-time schema crashes."""
    print(">>> HOSPYN_SETTINGS_INIT_BEGIN")
    try:
        s = Settings()
        print(">>> HOSPYN_SETTINGS_INIT_SUCCESS")
        return s
    except Exception as e:
        print(f">>> HOSPYN_SETTINGS_INIT_FATAL: {e}")
        # Re-raise so the import chain still fails, but with explicit diagnostic
        raise

settings = get_settings()

print(">>> HOSPYN_CONFIG_IMPORT_COMPLETE")
