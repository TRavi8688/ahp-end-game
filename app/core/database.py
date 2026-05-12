import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings
from app.core.logging import logger

# --- PRODUCTION-GRADE SSL CONTEXT ---
# Required for Cloud SQL connectivity from Cloud Run
def get_ssl_context():
    if "localhost" in settings.DATABASE_URL or "127.0.0.1" in settings.DATABASE_URL:
        return None
    
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE  # Flexible for managed cloud DBs
        return ctx
    except Exception as e:
        logger.warning(f"SSL_CONTEXT_CREATION_FAILED: {e}")
        return None

# Create engine with high-concurrency settings
primary_engine = create_async_engine(
    settings.async_database_url,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    connect_args={"ssl": get_ssl_context()} if "postgresql" in settings.DATABASE_URL else {}
)

AsyncSessionLocal = sessionmaker(
    primary_engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    """Dependency for obtaining an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def set_tenant_context(session: AsyncSession, tenant_id: str):
    """Sets the PostgreSQL RLS context for the current session."""
    if not tenant_id:
        return
    from sqlalchemy import text
    # Sanitized via UUID validation in middleware already
    await session.execute(text(f"SET app.current_tenant = '{tenant_id}'"))
