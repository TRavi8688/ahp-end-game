"""
backend/healthcare-core/app/core/config.py
Phase 5: startup validation + JWKS-based token verification.
Healthcare-core never holds the JWT private key — it fetches the public key
from auth-service's JWKS endpoint and verifies tokens locally.
"""
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "production"
    PORT: int = 8002
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = ""
    SENTRY_DSN: str = ""

    # Auth service JWKS URL — healthcare-core fetches public key from here
    AUTH_SERVICE_URL: str = "http://auth-service:8001"

    @property
    def jwks_url(self) -> str:
        return f"{self.AUTH_SERVICE_URL}/.well-known/jwks.json"

    def model_post_init(self, __context):
        if "sqlite" in self.DATABASE_URL.lower():
            _fatal("DATABASE_URL points to SQLite. Use PostgreSQL.")
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            _fatal("SECRET_KEY must be at least 32 characters.")
        if self.ENV == "production" and not self.ALLOWED_ORIGINS.strip():
            _fatal("ALLOWED_ORIGINS must be set in production.")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"


def _fatal(msg: str):
    print(f"\nSTARTUP ERROR: {msg}\n", file=sys.stderr)
    sys.exit(1)


@lru_cache
def get_settings() -> Settings:
    return Settings()
