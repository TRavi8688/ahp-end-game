from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospyn Healthcare Core"
    ENVIRONMENT: str = "development"

    # Database URL — enforced PostgreSQL connection
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn"

    # Redis (Required)
    REDIS_URL: str = "redis://localhost:6379/1"

    # CORS — comma-separated origins for production
    ALLOWED_ORIGINS: str = "https://hospyn.com,https://www.hospyn.com"

    # JWT Validation — MUST match Auth Service.
    JWT_SECRET_KEY: str = (
        "local_dev_secret_key_must_be_at_least_32_characters_long_for_security"
    )
    JWT_ALGORITHM: str = "HS256"

    # Google Cloud Storage (GCP)
    GCP_STORAGE_BUCKET: str = "hospyn-medical-records"

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters. "
                "This MUST match the Auth Service's JWT_SECRET_KEY."
            )
        return v

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )


settings = Settings()
