from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn Auth Service"
    ENVIRONMENT: str = "development"

    # Database URL — enforced PostgreSQL connection
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn"

    # Redis (Required — OTP brute-force lockout depends on this)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS — comma-separated origins for production
    ALLOWED_ORIGINS: str = "https://hospyn.com,https://www.hospyn.com"

    # JWT Configuration — default for local development, MUST override in production.
    JWT_SECRET_KEY: str = (
        "local_dev_secret_key_must_be_at_least_32_characters_long_for_security"
    )
    JWT_ALGORITHM: str = "RS256"  # BUG-1 FIX: was HS256, security.py uses RS256
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # OTP Configuration
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5  # Max failed OTP attempts before lockout

    # Password Reset Token Configuration
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Twilio SMS (Primary OTP delivery) ───────────────────────────────────
    # Get these from your Twilio console: console.twilio.com
    # These are already set as GitHub Secrets — copy them into .env for local dev.
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None  # Must be a valid Twilio number, e.g. +14155552671

    # ── SMTP Email (Fallback OTP delivery) ──────────────────────────────────
    # Recommended: use Resend (resend.com) — free tier, 3000 emails/month
    # SMTP_HOST=smtp.resend.com
    # SMTP_PORT=587
    # SMTP_USER=resend
    # SMTP_PASSWORD=re_xxxxxxxxxxxx   (your Resend API key)
    # SMTP_FROM_EMAIL=otp@hospyn.com  (domain must be verified in Resend)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return v

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )


settings = Settings()
