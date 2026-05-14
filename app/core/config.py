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
    
    # JWT Settings (Defaults for Production)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days (Shield V5 Default)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    
    # --- SECURITY (Hardened via Shield V5) ---
    JWT_PRIVATE_KEY: Optional[str] = None
    JWT_PUBLIC_KEY: Optional[str] = None
    JWT_AUDIENCE: str = "hospyn-enterprise-clients"
    SECRET_KEY: str = "placeholder-for-debug-only-change-in-production"
    ENCRYPTION_KEY: str = "placeholder-key-for-booting-only-32chars!"

    GCP_PROJECT_ID: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    
    # --- DATABASE ISOLATION (Priority 1) ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./hospyn_local.db"
    DATABASE_READER_URL: Optional[str] = None
    REDIS_URL: Optional[str] = None
        
    USE_REDIS: bool = False

    ALLOWED_ORIGINS: Any = [
        "https://hospyn-495906.web.app",
        "https://app.hospyn.com"
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
            # SHIELD V9.0: Support JSON list strings or comma-separated strings
            clean_v = v.strip()
            if clean_v.startswith("[") and clean_v.endswith("]"):
                try:
                    import json
                    return json.loads(clean_v)
                except Exception:
                    # Fallback to string splitting if JSON parsing fails
                    v = clean_v[1:-1]
            
            return [i.strip().replace('"', '').replace("'", "") for i in v.split(",") if i.strip()]
        return v

    
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWO_FACTOR_API_KEY: Optional[str] = None
    
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
        """SHIELD V10: Resilient post-init secret loading & DB URL transformation."""
        # 1. Lazy load critical secrets from SM if they are still defaults
        if self.SECRET_KEY == "placeholder-for-debug-only-change-in-production":
            self.SECRET_KEY = get_secret("SECRET_KEY", self.SECRET_KEY)
        
        if self.ENCRYPTION_KEY == "placeholder-key-for-booting-only-32chars!":
            self.ENCRYPTION_KEY = get_secret("ENCRYPTION_KEY", self.ENCRYPTION_KEY)

        # 2. Transform Database URL for asyncpg
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Strip sslmode (handled via connect_args in database.py)
        if "[?&]sslmode=" in url:
            import re
            url = re.sub(r"[?&]sslmode=[^&]*", "", url)
        self.DATABASE_URL = url

        # 3. Load Keys
        if not self.JWT_PRIVATE_KEY:
            self.JWT_PRIVATE_KEY = load_rsa_key("JWT_PRIVATE_KEY", "priv.pem")
        if not self.JWT_PUBLIC_KEY:
            self.JWT_PUBLIC_KEY = load_rsa_key("JWT_PUBLIC_KEY", "pub.pem")

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
