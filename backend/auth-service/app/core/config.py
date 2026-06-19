"""
backend/auth-service/app/core/config.py
Phase 5 fix: startup refuses weak/default secrets; validates DB is PostgreSQL.
"""
import os
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "production"
    ENVIRONMENT: str = "production"
    PORT: int = 8001
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = ""
    SENTRY_DSN: str = ""

    # RS256 JWT — private key PEM loaded from Secret Manager at runtime
    # Set JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM as env vars from GCP Secret Manager
    JWT_PRIVATE_KEY_PEM: str = ""
    JWT_PUBLIC_KEY_PEM: str = ""
    JWT_ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    def model_post_init(self, __context):
        self._validate()

    def _validate(self):
        # Sync ENV and ENVIRONMENT
        env_val = self.ENV.lower() if self.ENV else "production"
        if self.ENVIRONMENT != "production" and self.ENV == "production":
            env_val = self.ENVIRONMENT.lower()
        elif self.ENV != "production" and self.ENVIRONMENT == "production":
            env_val = self.ENV.lower()

        # Block compromised Fernet key
        if "CUV3WDeZXcp_7F74LyTqqIDmgDqn5" in (self.SECRET_KEY or ""):
            _fatal("SECRET_KEY contains the known compromised key. Rotate immediately.")
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            _fatal("SECRET_KEY must be at least 32 characters. Generate: make gen-secret")
        weak = ("supersecretkey", "changeme", "secret", "password")
        if any(w in self.SECRET_KEY.lower() for w in weak):
            _fatal("SECRET_KEY contains a weak placeholder. Generate: make gen-secret")

        # SQLite is disallowed in production/test environments
        if env_val in ("production", "prod"):
            if "sqlite" in self.DATABASE_URL.lower():
                _fatal("DATABASE_URL points to SQLite. Use PostgreSQL: postgresql+asyncpg://...")
            if not self.ALLOWED_ORIGINS.strip():
                _fatal("ALLOWED_ORIGINS must be set in production. Example: https://app.hospyn.com")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        env_val = self.ENV.lower() if self.ENV else "production"
        if self.ENVIRONMENT != "production" and self.ENV == "production":
            env_val = self.ENVIRONMENT.lower()
        return env_val in ("production", "prod")


def _fatal(msg: str):
    if "pytest" in sys.modules or os.environ.get("ENV") == "test" or os.environ.get("ENVIRONMENT") == "test":
        raise ValueError(msg)
    print(f"\n{'='*60}\nSTARTUP ERROR: {msg}\n{'='*60}\n", file=sys.stderr)
    sys.exit(1)


@lru_cache
def get_settings() -> Settings:
    return Settings()
