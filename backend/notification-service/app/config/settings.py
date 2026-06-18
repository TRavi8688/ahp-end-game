"""
notification-service/app/config/settings.py

PLACE AT: backend/notification-service/app/config/settings.py
FIX: Added SENTRY_DSN — referenced in main.py line 27 but missing
     from Settings class, causing AttributeError at startup.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENV: str = "development"
    PORT: int = 8004

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn_notifications"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/2"

    # JWT — must match auth-service
    SECRET_KEY: str = "local_dev_secret_key_must_be_at_least_32_characters"
    ALGORITHM: str = "HS256"

    # FIX: SENTRY_DSN was referenced in main.py line 27 but missing here
    SENTRY_DSN: Optional[str] = None

    # Internal service auth
    INTERNAL_SERVICE_SECRET: str = "change_me_in_production"

    # Twilio SMS
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # Feature flags
    SMS_TEST_MODE: bool = True   # Set False in production .env

    @property
    def twilio_configured(self) -> bool:
        return all([
            self.TWILIO_ACCOUNT_SID,
            self.TWILIO_AUTH_TOKEN,
            self.TWILIO_PHONE_NUMBER,
        ])

    def validate_required(self) -> None:
        missing = []
        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")
        if not self.REDIS_URL:
            missing.append("REDIS_URL")
        if not self.SECRET_KEY:
            missing.append("SECRET_KEY")
        if not self.INTERNAL_SERVICE_SECRET:
            missing.append("INTERNAL_SERVICE_SECRET")
        if not self.SMS_TEST_MODE and not self.twilio_configured:
            missing.append("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER")
        if missing:
            raise RuntimeError(f"Missing required settings: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
