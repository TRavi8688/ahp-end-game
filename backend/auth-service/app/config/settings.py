from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional
import secrets


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn Auth Service"
    ENVIRONMENT: str = "development"

    # Database URL — enforced PostgreSQL connection
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn"

    # Redis (Required)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS — comma-separated origins for production
    ALLOWED_ORIGINS: str = "https://hospyn.com,https://www.hospyn.com"

    # JWT Configuration — default for local development, MUST override in production.
    JWT_SECRET_KEY: str = "local_dev_secret_key_must_be_at_least_32_characters_long_for_security"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # OTP Configuration
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5  # Max failed OTP attempts before lockout

    # Password Reset Token Configuration
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # External APIs (Optional for local dev, required for prod)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # SMTP (for email OTP delivery)
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
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
